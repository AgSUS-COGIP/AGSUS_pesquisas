begin;

-- Performance indexes for foreign keys and operational joins.
create index if not exists answers_question_id_idx on public.answers(question_id);
create index if not exists cddi_final_results_auto_submission_id_idx on public.cddi_final_results(auto_submission_id);
create index if not exists cddi_final_results_leader_submission_id_idx on public.cddi_final_results(leader_submission_id);
create index if not exists cddi_final_results_subject_person_id_idx on public.cddi_final_results(subject_person_id);
create index if not exists cddi_leadership_links_leader_person_id_idx on public.cddi_leadership_links(leader_person_id);
create index if not exists cddi_leadership_links_subordinate_person_id_idx on public.cddi_leadership_links(subordinate_person_id);
create index if not exists cddi_link_correction_requests_analyzed_by_idx on public.cddi_link_correction_requests(analyzed_by);
create index if not exists cddi_link_correction_requests_current_leader_idx on public.cddi_link_correction_requests(current_leader_person_id);
create index if not exists cddi_link_correction_requests_proposed_leader_idx on public.cddi_link_correction_requests(proposed_leader_person_id);
create index if not exists cddi_link_correction_requests_requester_person_id_idx on public.cddi_link_correction_requests(requester_person_id);
create index if not exists data_import_batches_executed_by_idx on public.data_import_batches(executed_by);
create index if not exists data_import_issues_resolved_by_idx on public.data_import_issues(resolved_by);
create index if not exists survey_questions_section_version_idx on public.survey_questions(section_id, survey_version_id);
create index if not exists survey_sections_parent_version_idx on public.survey_sections(parent_section_id, survey_version_id) where parent_section_id is not null;

-- Public object URLs do not require broad listing permission.
drop policy if exists avatar_public_read on storage.objects;

-- Restrict institutional configuration to privileged users.
drop policy if exists institutional_domains_privileged_read on public.institutional_domains;
create policy institutional_domains_privileged_read
on public.institutional_domains
for select to authenticated
using ((select public.can_manage_surveys()) or (select public.can_audit_platform()));

-- Avoid reevaluating auth.uid() for every row.
drop policy if exists people_select_authorized on public.people;
create policy people_select_authorized
on public.people
for select to authenticated
using (auth_user_id = (select auth.uid()) or (select public.can_audit_platform()));

-- Consolidate read policies and keep writes restricted to managers.
drop policy if exists cddi_competency_results_manage on public.cddi_competency_results;
drop policy if exists cddi_competency_results_read on public.cddi_competency_results;
create policy cddi_competency_results_select on public.cddi_competency_results for select to authenticated
using ((select public.can_manage_surveys()) or (select public.can_audit_platform()) or exists (
  select 1 from public.submissions s where s.id=cddi_competency_results.submission_id
  and (s.respondent_person_id=(select public.current_person_id()) or s.subject_person_id=(select public.current_person_id()))
));
create policy cddi_competency_results_insert on public.cddi_competency_results for insert to authenticated with check ((select public.can_manage_surveys()));
create policy cddi_competency_results_update on public.cddi_competency_results for update to authenticated using ((select public.can_manage_surveys())) with check ((select public.can_manage_surveys()));
create policy cddi_competency_results_delete on public.cddi_competency_results for delete to authenticated using ((select public.can_manage_surveys()));

drop policy if exists cddi_final_results_manage on public.cddi_final_results;
drop policy if exists cddi_final_results_read on public.cddi_final_results;
create policy cddi_final_results_select on public.cddi_final_results for select to authenticated
using ((select public.can_manage_surveys()) or (select public.can_audit_platform()) or (subject_person_id=(select public.current_person_id()) and status='PUBLISHED'));
create policy cddi_final_results_insert on public.cddi_final_results for insert to authenticated with check ((select public.can_manage_surveys()));
create policy cddi_final_results_update on public.cddi_final_results for update to authenticated using ((select public.can_manage_surveys())) with check ((select public.can_manage_surveys()));
create policy cddi_final_results_delete on public.cddi_final_results for delete to authenticated using ((select public.can_manage_surveys()));

drop policy if exists cddi_leadership_links_manage on public.cddi_leadership_links;
drop policy if exists cddi_leadership_links_read on public.cddi_leadership_links;
create policy cddi_leadership_links_select on public.cddi_leadership_links for select to authenticated
using ((select public.can_manage_surveys()) or (select public.can_audit_platform()) or leader_person_id=(select public.current_person_id()) or subordinate_person_id=(select public.current_person_id()));
create policy cddi_leadership_links_insert on public.cddi_leadership_links for insert to authenticated with check ((select public.can_manage_surveys()));
create policy cddi_leadership_links_update on public.cddi_leadership_links for update to authenticated using ((select public.can_manage_surveys())) with check ((select public.can_manage_surveys()));
create policy cddi_leadership_links_delete on public.cddi_leadership_links for delete to authenticated using ((select public.can_manage_surveys()));

drop policy if exists data_import_batches_manage on public.data_import_batches;
drop policy if exists data_import_batches_read on public.data_import_batches;
create policy data_import_batches_select on public.data_import_batches for select to authenticated using ((select public.can_manage_surveys()) or (select public.can_audit_platform()));
create policy data_import_batches_insert on public.data_import_batches for insert to authenticated with check ((select public.can_manage_surveys()));
create policy data_import_batches_update on public.data_import_batches for update to authenticated using ((select public.can_manage_surveys())) with check ((select public.can_manage_surveys()));
create policy data_import_batches_delete on public.data_import_batches for delete to authenticated using ((select public.can_manage_surveys()));

drop policy if exists data_import_issues_manage on public.data_import_issues;
drop policy if exists data_import_issues_read on public.data_import_issues;
create policy data_import_issues_select on public.data_import_issues for select to authenticated using ((select public.can_manage_surveys()) or (select public.can_audit_platform()));
create policy data_import_issues_insert on public.data_import_issues for insert to authenticated with check ((select public.can_manage_surveys()));
create policy data_import_issues_update on public.data_import_issues for update to authenticated using ((select public.can_manage_surveys())) with check ((select public.can_manage_surveys()));
create policy data_import_issues_delete on public.data_import_issues for delete to authenticated using ((select public.can_manage_surveys()));

drop policy if exists person_access_identities_manage on public.person_access_identities;
drop policy if exists person_access_identities_read_authorized on public.person_access_identities;
create policy person_access_identities_select on public.person_access_identities for select to authenticated
using ((select public.can_manage_surveys()) or (select public.can_audit_platform()) or person_id=(select public.current_person_id()));
create policy person_access_identities_insert on public.person_access_identities for insert to authenticated with check ((select public.can_manage_surveys()));
create policy person_access_identities_update on public.person_access_identities for update to authenticated using ((select public.can_manage_surveys())) with check ((select public.can_manage_surveys()));
create policy person_access_identities_delete on public.person_access_identities for delete to authenticated using ((select public.can_manage_surveys()));

-- Generic answer persistence with strict validation and support for all builder types.
create or replace function public.save_my_survey_answer(
  target_submission_id uuid,
  target_question_id uuid,
  target_option_ids uuid[],
  target_text text,
  target_number numeric,
  target_boolean boolean,
  target_date date,
  target_datetime timestamptz,
  target_json jsonb
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare
  v_person_id uuid:=public.current_person_id();
  v_submission public.submissions%rowtype;
  v_version_id uuid;
  v_question public.survey_questions%rowtype;
  v_answer_id uuid;
  v_option_ids uuid[];
  v_invalid_options integer;
  v_text text;
begin
  if v_person_id is null then raise exception 'Usuário não identificado.'; end if;
  select * into v_submission from public.submissions where id=target_submission_id for update;
  if v_submission.id is null or v_submission.respondent_person_id is distinct from v_person_id or v_submission.status<>'DRAFT' then raise exception 'O rascunho não está disponível para edição.'; end if;
  if not public.application_accepts_responses(v_submission.application_id) then raise exception 'O período de respostas está encerrado.'; end if;
  select survey_version_id into v_version_id from public.survey_applications where id=v_submission.application_id;
  select * into v_question from public.survey_questions where id=target_question_id and survey_version_id=v_version_id;
  if v_question.id is null then raise exception 'Pergunta inválida para esta pesquisa.'; end if;

  if v_question.question_type in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE') then
    select coalesce(array_agg(distinct option_id),'{}'::uuid[]) into v_option_ids from unnest(coalesce(target_option_ids,'{}'::uuid[])) option_id;
    if coalesce(array_length(v_option_ids,1),0)=0 then
      delete from public.answers where submission_id=v_submission.id and question_id=v_question.id;
    else
      if v_question.question_type in ('SCALE','SINGLE_CHOICE') and array_length(v_option_ids,1)<>1 then raise exception 'Selecione apenas uma alternativa.'; end if;
      select count(*) into v_invalid_options from unnest(v_option_ids) selected_id left join public.question_options qo on qo.id=selected_id and qo.question_id=v_question.id and qo.active where qo.id is null;
      if v_invalid_options>0 then raise exception 'Uma ou mais alternativas são inválidas.'; end if;
      insert into public.answers(submission_id,question_id) values(v_submission.id,v_question.id)
      on conflict(submission_id,question_id) do update set answer_text=null,answer_number=null,answer_boolean=null,answer_date=null,answer_datetime=null,answer_json=null,score=null,updated_at=now()
      returning id into v_answer_id;
      delete from public.answer_options where answer_id=v_answer_id;
      insert into public.answer_options(answer_id,option_id,position)
      select v_answer_id,option_id,row_number() over(order by option_id)::integer from unnest(v_option_ids) option_id;
    end if;
  elsif v_question.question_type in ('SHORT_TEXT','LONG_TEXT') then
    v_text:=nullif(btrim(coalesce(target_text,'')),'');
    if length(coalesce(v_text,''))>12000 then raise exception 'O texto excede o limite de 12.000 caracteres.'; end if;
    if v_text is null then delete from public.answers where submission_id=v_submission.id and question_id=v_question.id;
    else insert into public.answers(submission_id,question_id,answer_text) values(v_submission.id,v_question.id,v_text)
      on conflict(submission_id,question_id) do update set answer_text=excluded.answer_text,answer_number=null,answer_boolean=null,answer_date=null,answer_datetime=null,answer_json=null,score=null,updated_at=now(); end if;
  elsif v_question.question_type in ('INTEGER','DECIMAL') then
    if target_number is null then delete from public.answers where submission_id=v_submission.id and question_id=v_question.id;
    else
      if v_question.question_type='INTEGER' and target_number<>trunc(target_number) then raise exception 'Informe um número inteiro.'; end if;
      insert into public.answers(submission_id,question_id,answer_number) values(v_submission.id,v_question.id,target_number)
      on conflict(submission_id,question_id) do update set answer_text=null,answer_number=excluded.answer_number,answer_boolean=null,answer_date=null,answer_datetime=null,answer_json=null,score=null,updated_at=now();
    end if;
  elsif v_question.question_type='BOOLEAN' then
    if target_boolean is null then delete from public.answers where submission_id=v_submission.id and question_id=v_question.id;
    else insert into public.answers(submission_id,question_id,answer_boolean) values(v_submission.id,v_question.id,target_boolean)
      on conflict(submission_id,question_id) do update set answer_text=null,answer_number=null,answer_boolean=excluded.answer_boolean,answer_date=null,answer_datetime=null,answer_json=null,score=null,updated_at=now(); end if;
  elsif v_question.question_type='DATE' then
    if target_date is null then delete from public.answers where submission_id=v_submission.id and question_id=v_question.id;
    else insert into public.answers(submission_id,question_id,answer_date) values(v_submission.id,v_question.id,target_date)
      on conflict(submission_id,question_id) do update set answer_text=null,answer_number=null,answer_boolean=null,answer_date=excluded.answer_date,answer_datetime=null,answer_json=null,score=null,updated_at=now(); end if;
  elsif v_question.question_type='DATETIME' then
    if target_datetime is null then delete from public.answers where submission_id=v_submission.id and question_id=v_question.id;
    else insert into public.answers(submission_id,question_id,answer_datetime) values(v_submission.id,v_question.id,target_datetime)
      on conflict(submission_id,question_id) do update set answer_text=null,answer_number=null,answer_boolean=null,answer_date=null,answer_datetime=excluded.answer_datetime,answer_json=null,score=null,updated_at=now(); end if;
  else raise exception 'Tipo de pergunta ainda não suportado: %.',v_question.question_type;
  end if;

  update public.submissions set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('last_saved_at',now()),updated_at=now() where id=v_submission.id;
  return jsonb_build_object('status','OK','savedAt',now());
end;
$$;

-- Final validation now correctly recognizes required multiple-choice responses.
create or replace function public.submit_my_survey_submission(target_submission_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare
  v_person_id uuid:=public.current_person_id();
  v_submission public.submissions%rowtype;
  v_application public.survey_applications%rowtype;
  v_missing integer;
  v_submitted_at timestamptz:=now();
begin
  if v_person_id is null then raise exception 'Usuário não identificado.'; end if;
  select * into v_submission from public.submissions where id=target_submission_id for update;
  if v_submission.id is null or v_submission.respondent_person_id is distinct from v_person_id or v_submission.status<>'DRAFT' then raise exception 'A resposta não está disponível para envio.'; end if;
  select * into v_application from public.survey_applications where id=v_submission.application_id;
  if not public.application_accepts_responses(v_application.id) then raise exception 'O período de respostas está encerrado.'; end if;

  select count(*)::integer into v_missing
  from public.survey_questions q
  where q.survey_version_id=v_application.survey_version_id and q.required
    and not exists (
      select 1 from public.answers a where a.submission_id=v_submission.id and a.question_id=q.id and (
        (q.question_type in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE') and exists(select 1 from public.answer_options ao where ao.answer_id=a.id))
        or (q.question_type in ('SHORT_TEXT','LONG_TEXT') and nullif(btrim(a.answer_text),'') is not null)
        or (q.question_type in ('INTEGER','DECIMAL') and a.answer_number is not null)
        or (q.question_type='BOOLEAN' and a.answer_boolean is not null)
        or (q.question_type='DATE' and a.answer_date is not null)
        or (q.question_type='DATETIME' and a.answer_datetime is not null)
        or (q.question_type not in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE','SHORT_TEXT','LONG_TEXT','INTEGER','DECIMAL','BOOLEAN','DATE','DATETIME') and num_nonnulls(a.answer_text,a.answer_number,a.answer_boolean,a.answer_date,a.answer_datetime,a.answer_json)>0)
      )
    );
  if v_missing>0 then raise exception 'Existem % pergunta(s) obrigatória(s) sem resposta.',v_missing; end if;

  update public.submissions set status='SUBMITTED',submitted_at=v_submitted_at,updated_at=v_submitted_at,metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('submitted_from','PLATFORM_WEB_GENERIC') where id=v_submission.id;
  update public.application_participants set status='COMPLETED',completed_at=v_submitted_at,updated_at=v_submitted_at where id=v_submission.participant_id;
  insert into public.audit_events(actor_person_id,event_type,entity_type,entity_id,application_id,after_data,metadata)
  values(v_person_id,'SURVEY_SUBMISSION_SUBMITTED','SUBMISSION',v_submission.id::text,v_submission.application_id,jsonb_build_object('status','SUBMITTED'),'{}'::jsonb);
  return jsonb_build_object('status','OK','submissionStatus','SUBMITTED','submittedAt',v_submitted_at);
end;
$$;

-- Replace obsolete participant status names in the existing dashboard function.
do $migration$
declare v_definition text;
begin
  select pg_get_functiondef('public.get_cddi_monitoring_dashboard(text)'::regprocedure) into v_definition;
  if position('ap.status not in (''REMOVED'', ''INELIGIBLE'')' in v_definition)>0 then
    execute replace(v_definition,'ap.status not in (''REMOVED'', ''INELIGIBLE'')','ap.status not in (''BLOCKED'', ''EXCLUDED'')');
  end if;
end;
$migration$;

commit;
