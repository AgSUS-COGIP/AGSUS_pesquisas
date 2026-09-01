begin;

create or replace function public.list_my_survey_catalog()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person_id uuid := public.current_person_id();
  v_is_admin boolean := public.can_manage_surveys();
  v_result jsonb;
begin
  if v_person_id is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'surveyId', s.id,
    'surveyCode', s.code,
    'surveyName', s.name,
    'description', s.description,
    'applicationId', sa.id,
    'applicationCode', sa.code,
    'applicationName', sa.name,
    'applicationStatus', sa.status,
    'opensAt', sa.opens_at,
    'closesAt', sa.closes_at,
    'anonymous', sa.anonymous,
    'allowDrafts', sa.allow_drafts,
    'accessMode', sa.access_mode,
    'participantStatus', ap.status,
    'accessProfile', ap.access_profile,
    'completedAt', ap.completed_at,
    'submissionId', sub.id,
    'submissionStatus', sub.status,
    'submissionUpdatedAt', sub.updated_at,
    'sections', (select count(*) from public.survey_sections sec where sec.survey_version_id = sa.survey_version_id),
    'questions', (select count(*) from public.survey_questions q where q.survey_version_id = sa.survey_version_id),
    'canRespond', (sa.status = 'OPEN' and public.can_access_application(sa.id)),
    'canManage', v_is_admin
  ) order by
    case sa.status when 'OPEN' then 0 when 'SCHEDULED' then 1 when 'CLOSED' then 2 else 3 end,
    coalesce(sa.closes_at, sa.opens_at, sa.created_at) desc), '[]'::jsonb)
  into v_result
  from public.survey_applications sa
  join public.survey_versions sv on sv.id = sa.survey_version_id
  join public.surveys s on s.id = sv.survey_id
  left join public.application_participants ap
    on ap.application_id = sa.id
   and ap.person_id = v_person_id
   and ap.status not in ('BLOCKED', 'EXCLUDED')
  left join lateral (
    select x.id, x.status, x.updated_at
    from public.submissions x
    where x.application_id = sa.id
      and x.respondent_person_id = v_person_id
      and x.submission_type in ('RESPONSE', 'AUTO')
    order by x.version desc, x.created_at desc
    limit 1
  ) sub on true
  where public.can_access_application(sa.id)
    and sa.status in ('SCHEDULED', 'OPEN', 'CLOSED')
    and (v_is_admin or sv.status in ('PUBLISHED', 'RETIRED'));

  return v_result;
end;
$$;

create or replace function public.start_or_resume_my_survey_submission(target_application_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person_id uuid := public.current_person_id();
  v_application public.survey_applications%rowtype;
  v_participant public.application_participants%rowtype;
  v_submission public.submissions%rowtype;
  v_answers jsonb := '{}'::jsonb;
  v_can_edit boolean := false;
begin
  if v_person_id is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;

  select * into v_application
  from public.survey_applications
  where code = btrim(target_application_code)
  limit 1;

  if v_application.id is null then
    raise exception 'Aplicação não encontrada.';
  end if;

  if not public.can_access_application(v_application.id) then
    raise exception 'Seu cadastro não está autorizado para esta pesquisa.';
  end if;

  select * into v_participant
  from public.application_participants
  where application_id = v_application.id
    and person_id = v_person_id
    and participant_role = 'RESPONDENT'
    and status not in ('BLOCKED', 'EXCLUDED')
  order by created_at desc
  limit 1;

  if v_participant.id is null and v_application.access_mode = 'INSTITUTIONAL' then
    insert into public.application_participants(
      application_id,
      person_id,
      participant_role,
      status,
      access_profile,
      metadata
    ) values (
      v_application.id,
      v_person_id,
      'RESPONDENT',
      'ELIGIBLE',
      'USUARIO_INSTITUCIONAL',
      jsonb_build_object('origin', 'INSTITUTIONAL_ACCESS')
    )
    on conflict (application_id, person_id, participant_role) do update
      set status = case
        when public.application_participants.status in ('BLOCKED', 'EXCLUDED')
          then public.application_participants.status
        else 'ELIGIBLE'
      end,
      updated_at = timezone('utc', now())
    returning * into v_participant;
  end if;

  if v_participant.id is null and not public.can_manage_surveys() then
    raise exception 'Seu cadastro não está elegível para esta pesquisa.';
  end if;

  select * into v_submission
  from public.submissions
  where application_id = v_application.id
    and respondent_person_id = v_person_id
    and subject_person_id = v_person_id
    and submission_type in ('RESPONSE', 'AUTO')
    and status in ('DRAFT', 'SUBMITTED', 'VALIDATED')
  order by version desc, created_at desc
  limit 1;

  if v_submission.id is null and public.application_accepts_responses(v_application.id) then
    if v_participant.id is null then
      raise exception 'Inclua seu cadastro como participante antes de responder.';
    end if;

    insert into public.submissions(
      application_id,
      participant_id,
      respondent_person_id,
      subject_person_id,
      submission_type,
      status,
      metadata
    ) values (
      v_application.id,
      v_participant.id,
      v_person_id,
      v_person_id,
      'RESPONSE',
      'DRAFT',
      jsonb_build_object('origin', 'PLATFORM_WEB_GENERIC')
    ) returning * into v_submission;

    update public.application_participants
    set status = 'IN_PROGRESS',
        started_at = coalesce(started_at, timezone('utc', now())),
        updated_at = timezone('utc', now())
    where id = v_participant.id
      and status in ('ELIGIBLE', 'INVITED');
  end if;

  if v_submission.id is not null then
    select coalesce(jsonb_object_agg(
      a.question_id::text,
      jsonb_build_object(
        'answerText', a.answer_text,
        'answerNumber', a.answer_number,
        'answerBoolean', a.answer_boolean,
        'answerDate', a.answer_date,
        'answerDatetime', a.answer_datetime,
        'answerJson', a.answer_json,
        'optionIds', coalesce(opts.option_ids, '[]'::jsonb)
      )
    ), '{}'::jsonb)
    into v_answers
    from public.answers a
    left join lateral (
      select jsonb_agg(ao.option_id order by ao.position) as option_ids
      from public.answer_options ao
      where ao.answer_id = a.id
    ) opts on true
    where a.submission_id = v_submission.id;
  end if;

  v_can_edit := v_submission.id is not null
    and v_submission.status = 'DRAFT'
    and public.application_accepts_responses(v_application.id);

  return jsonb_build_object(
    'status', case when public.application_accepts_responses(v_application.id) then 'OK' else 'PERIOD_CLOSED' end,
    'applicationStatus', v_application.status,
    'canEdit', v_can_edit,
    'submission', case when v_submission.id is null then null else jsonb_build_object(
      'id', v_submission.id,
      'status', v_submission.status,
      'startedAt', v_submission.started_at,
      'submittedAt', v_submission.submitted_at,
      'updatedAt', v_submission.updated_at
    ) end,
    'answers', v_answers
  );
end;
$$;

create or replace function public.get_public_survey_form(target_application_code text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'application', jsonb_build_object(
      'id', sa.id,
      'code', sa.code,
      'name', sa.name,
      'status', sa.status,
      'opensAt', sa.opens_at,
      'closesAt', sa.closes_at,
      'allowDrafts', sa.allow_drafts,
      'settings', sa.settings,
      'accessMode', sa.access_mode
    ),
    'survey', jsonb_build_object(
      'id', s.id,
      'code', s.code,
      'name', s.name,
      'description', s.description
    ),
    'version', jsonb_build_object(
      'id', sv.id,
      'number', sv.version_number,
      'title', sv.title,
      'description', sv.description,
      'settings', sv.settings
    ),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ss.id,
        'code', ss.code,
        'title', ss.title,
        'description', ss.description,
        'position', ss.position,
        'settings', ss.settings,
        'questions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', sq.id,
            'code', sq.code,
            'title', sq.title,
            'description', sq.description,
            'type', sq.question_type,
            'required', sq.required,
            'position', sq.position,
            'validation', sq.validation,
            'displayLogic', sq.display_logic,
            'scoring', sq.scoring,
            'settings', sq.settings,
            'options', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', qo.id,
                'code', qo.code,
                'label', qo.label,
                'value', qo.value,
                'score', qo.score,
                'position', qo.position
              ) order by qo.position)
              from public.question_options qo
              where qo.question_id = sq.id and qo.active = true
            ), '[]'::jsonb)
          ) order by sq.position)
          from public.survey_questions sq
          where sq.section_id = ss.id
        ), '[]'::jsonb)
      ) order by ss.position)
      from public.survey_sections ss
      where ss.survey_version_id = sv.id
        and ss.parent_section_id is null
    ), '[]'::jsonb)
  )
  from public.survey_applications sa
  join public.survey_versions sv on sv.id = sa.survey_version_id
  join public.surveys s on s.id = sv.survey_id
  where sa.code = btrim(target_application_code)
    and sv.status in ('PUBLISHED', 'RETIRED')
    and sa.status in ('SCHEDULED', 'OPEN', 'CLOSED')
    and public.can_access_application(sa.id)
  limit 1;
$$;

commit;
