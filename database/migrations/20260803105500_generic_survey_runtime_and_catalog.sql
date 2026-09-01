-- Catálogo do usuário, runtime genérico e diagnóstico administrativo.
-- A implementação completa desta migration já foi aplicada no projeto PostgreSQL.

create or replace function public.list_my_survey_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare v_person_id uuid; v_is_admin boolean; v_result jsonb;
begin
  v_person_id := public.current_person_id();
  if v_person_id is null then raise exception 'Cadastro institucional não identificado.'; end if;
  v_is_admin := public.can_manage_surveys();
  select coalesce(jsonb_agg(jsonb_build_object(
    'surveyId',s.id,'surveyCode',s.code,'surveyName',s.name,'description',s.description,
    'applicationId',sa.id,'applicationCode',sa.code,'applicationName',sa.name,
    'applicationStatus',sa.status,'opensAt',sa.opens_at,'closesAt',sa.closes_at,
    'anonymous',sa.anonymous,'allowDrafts',sa.allow_drafts,'participantStatus',ap.status,
    'accessProfile',ap.access_profile,'completedAt',ap.completed_at,
    'submissionId',sub.id,'submissionStatus',sub.status,'submissionUpdatedAt',sub.updated_at,
    'sections',(select count(*) from public.survey_sections sec where sec.survey_version_id=sa.survey_version_id),
    'questions',(select count(*) from public.survey_questions q where q.survey_version_id=sa.survey_version_id),
    'canRespond',(sa.status='OPEN' and (v_is_admin or ap.id is not null)),
    'canManage',v_is_admin
  ) order by case sa.status when 'OPEN' then 0 when 'SCHEDULED' then 1 when 'CLOSED' then 2 else 3 end, coalesce(sa.closes_at,sa.opens_at,sa.created_at) desc),'[]'::jsonb)
  into v_result
  from public.survey_applications sa
  join public.survey_versions sv on sv.id=sa.survey_version_id
  join public.surveys s on s.id=sv.survey_id
  left join public.application_participants ap on ap.application_id=sa.id and ap.person_id=v_person_id and ap.status not in ('REMOVED','INELIGIBLE','BLOCKED','EXCLUDED')
  left join lateral (select x.id,x.status,x.updated_at from public.submissions x where x.application_id=sa.id and x.respondent_person_id=v_person_id and x.submission_type='RESPONSE' order by x.version desc,x.created_at desc limit 1) sub on true
  where (v_is_admin or ap.id is not null) and sa.status in ('DRAFT','SCHEDULED','OPEN','CLOSED') and (v_is_admin or sv.status in ('PUBLISHED','RETIRED'));
  return v_result;
end;$$;

grant execute on function public.list_my_survey_catalog() to authenticated;

create or replace function public.start_or_resume_my_survey_submission(target_application_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare v_person_id uuid:=public.current_person_id(); v_application public.survey_applications%rowtype; v_participant public.application_participants%rowtype; v_submission public.submissions%rowtype; v_answers jsonb:='{}'::jsonb; v_can_edit boolean:=false;
begin
  if v_person_id is null then raise exception 'Cadastro institucional não identificado.'; end if;
  select * into v_application from public.survey_applications where code=btrim(target_application_code) limit 1;
  if v_application.id is null then raise exception 'Aplicação não encontrada.'; end if;
  select * into v_participant from public.application_participants where application_id=v_application.id and person_id=v_person_id and status not in ('REMOVED','INELIGIBLE','BLOCKED','EXCLUDED') order by created_at desc limit 1;
  if v_participant.id is null and not public.can_manage_surveys() then raise exception 'Seu cadastro não está elegível para esta pesquisa.'; end if;
  select * into v_submission from public.submissions where application_id=v_application.id and respondent_person_id=v_person_id and subject_person_id=v_person_id and submission_type='RESPONSE' and status in ('DRAFT','SUBMITTED','VALIDATED') order by version desc,created_at desc limit 1;
  if v_submission.id is null and v_application.status='OPEN' then
    insert into public.submissions(application_id,participant_id,respondent_person_id,subject_person_id,submission_type,status,metadata)
    values(v_application.id,v_participant.id,v_person_id,v_person_id,'RESPONSE','DRAFT',jsonb_build_object('origin','PLATFORM_WEB_GENERIC')) returning * into v_submission;
  end if;
  if v_submission.id is not null then
    select coalesce(jsonb_object_agg(a.question_id::text,jsonb_build_object('answerText',a.answer_text,'answerNumber',a.answer_number,'answerBoolean',a.answer_boolean,'answerDate',a.answer_date,'answerDatetime',a.answer_datetime,'answerJson',a.answer_json,'optionIds',coalesce(opts.option_ids,'[]'::jsonb),'optionValues',coalesce(opts.option_values,'[]'::jsonb))),'{}'::jsonb)
    into v_answers from public.answers a left join lateral (select jsonb_agg(ao.option_id order by ao.position) option_ids,jsonb_agg(qo.value order by ao.position) option_values from public.answer_options ao join public.question_options qo on qo.id=ao.option_id where ao.answer_id=a.id) opts on true where a.submission_id=v_submission.id;
  end if;
  v_can_edit:=v_submission.id is not null and v_submission.status='DRAFT' and v_application.status='OPEN';
  return jsonb_build_object('status',case when v_application.status='OPEN' then 'OK' else 'PERIOD_CLOSED' end,'applicationStatus',v_application.status,'canEdit',v_can_edit,'submission',case when v_submission.id is null then null else jsonb_build_object('id',v_submission.id,'status',v_submission.status,'startedAt',v_submission.started_at,'submittedAt',v_submission.submitted_at,'updatedAt',v_submission.updated_at) end,'answers',v_answers);
end;$$;

grant execute on function public.start_or_resume_my_survey_submission(text) to authenticated;

create or replace function public.get_platform_health()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.can_manage_surveys() then raise exception 'Acesso restrito à administração.'; end if;
  return jsonb_build_object('status','OK','generatedAt',timezone('utc',now()),'counts',jsonb_build_object('activePeople',(select count(*) from public.people where active),'surveys',(select count(*) from public.surveys),'applications',(select count(*) from public.survey_applications),'openApplications',(select count(*) from public.survey_applications where status='OPEN'),'participants',(select count(*) from public.application_participants where status not in ('REMOVED','INELIGIBLE')),'submissions',(select count(*) from public.submissions),'draftSubmissions',(select count(*) from public.submissions where status='DRAFT'),'submittedSubmissions',(select count(*) from public.submissions where status in ('SUBMITTED','VALIDATED')),'activeLeadershipLinks',(select count(*) from public.cddi_leadership_links where status='ACTIVE' and valid_to is null)),'checks',jsonb_build_object('platformContext',to_regprocedure('public.get_my_platform_context()') is not null,'surveyCatalog',to_regprocedure('public.list_my_survey_catalog()') is not null,'teamSearch',to_regprocedure('public.search_team_candidates(uuid,text)') is not null,'genericRuntime',to_regprocedure('public.start_or_resume_my_survey_submission(text)') is not null,'auditTable',to_regclass('public.audit_events') is not null));
end;$$;

grant execute on function public.get_platform_health() to authenticated;
