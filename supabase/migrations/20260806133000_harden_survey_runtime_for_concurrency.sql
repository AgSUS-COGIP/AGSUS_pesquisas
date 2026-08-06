begin;

create index if not exists submissions_application_participant_updated_idx
  on public.submissions (application_id, participant_id, updated_at desc)
  where participant_id is not null;

create index if not exists answers_submission_question_updated_idx
  on public.answers (submission_id, question_id, updated_at desc);

create or replace function public.get_survey_dashboard(target_application_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_application_id uuid;
  v_payload jsonb;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à Equipe Técnica.';
  end if;

  select id into v_application_id
  from public.survey_applications
  where code = btrim(target_application_code)
  limit 1;

  if v_application_id is null then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  with app as (
    select sa.*, sv.title version_title, sv.description version_description,
      sv.version_number, s.code survey_code, s.name survey_name,
      s.description survey_description
    from public.survey_applications sa
    join public.survey_versions sv on sv.id = sa.survey_version_id
    join public.surveys s on s.id = sv.survey_id
    where sa.id = v_application_id
  ), latest_submissions as (
    select distinct on (s.participant_id)
      s.id, s.participant_id, s.status, s.updated_at
    from public.submissions s
    where s.application_id = v_application_id
      and s.participant_id is not null
    order by s.participant_id, s.updated_at desc
  ), participant_summary as (
    select
      count(*) total,
      count(*) filter (where sub.status = 'DRAFT') drafts,
      count(*) filter (where sub.status in ('SUBMITTED', 'VALIDATED')) submitted,
      count(*) filter (where sub.id is null) not_started
    from public.application_participants ap
    left join latest_submissions sub on sub.participant_id = ap.id
    where ap.application_id = v_application_id
      and ap.status not in ('REMOVED', 'INELIGIBLE', 'EXCLUDED')
  ), question_rows as (
    select q.id, q.code, q.title, q.description, q.question_type, q.position,
      sec.id section_id, sec.title section_title, sec.position section_position
    from public.survey_questions q
    join public.survey_sections sec on sec.id = q.section_id
    join app on app.survey_version_id = q.survey_version_id
  ), submitted_answers as (
    select a.*, s.submitted_at
    from public.answers a
    join public.submissions s on s.id = a.submission_id
    where s.application_id = v_application_id
      and s.status in ('SUBMITTED', 'VALIDATED')
  ), option_counts as (
    select a.question_id, ao.option_id, count(*) answer_count
    from public.answer_options ao
    join submitted_answers a on a.id = ao.answer_id
    group by a.question_id, ao.option_id
  )
  select jsonb_build_object(
    'status', 'OK',
    'generatedAt', timezone('utc', now()),
    'application', (
      select jsonb_build_object(
        'id', id,
        'code', code,
        'name', name,
        'status', status,
        'opensAt', opens_at,
        'closesAt', closes_at,
        'surveyCode', survey_code,
        'surveyName', survey_name,
        'surveyDescription', coalesce(survey_description, version_description),
        'versionTitle', version_title,
        'versionNumber', version_number
      ) from app
    ),
    'summary', (
      select jsonb_build_object(
        'totalParticipants', total,
        'drafts', drafts,
        'submitted', submitted,
        'notStarted', not_started,
        'completionRate', case when total = 0 then 0 else round(submitted::numeric * 100 / total, 1) end
      ) from participant_summary
    ),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', qr.id,
        'code', qr.code,
        'title', qr.title,
        'description', qr.description,
        'type', qr.question_type,
        'position', qr.position,
        'sectionId', qr.section_id,
        'sectionTitle', qr.section_title,
        'sectionPosition', qr.section_position,
        'responseCount', (select count(*) from submitted_answers a where a.question_id = qr.id),
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', o.id,
            'label', o.label,
            'value', o.value,
            'count', coalesce(oc.answer_count, 0)
          ) order by o.position)
          from public.question_options o
          left join option_counts oc on oc.question_id = qr.id and oc.option_id = o.id
          where o.question_id = qr.id and o.active
        ), '[]'::jsonb),
        'textResponses', coalesce((
          select jsonb_agg(jsonb_build_object(
            'text', left(sample.answer_text, 1000),
            'submittedAt', sample.submitted_at
          ) order by sample.submitted_at desc)
          from (
            select a.answer_text, a.submitted_at
            from submitted_answers a
            where a.question_id = qr.id
              and nullif(btrim(a.answer_text), '') is not null
            order by a.submitted_at desc
            limit 100
          ) sample
        ), '[]'::jsonb)
      ) order by qr.section_position, qr.position)
      from question_rows qr
    ), '[]'::jsonb)
  ) into v_payload;

  return v_payload;
end;
$$;

revoke all on function public.get_survey_dashboard(text) from public, anon;
grant execute on function public.get_survey_dashboard(text) to authenticated;

notify pgrst, 'reload schema';
commit;
