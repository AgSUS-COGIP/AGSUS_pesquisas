begin;

-- Participante bloqueado entrava no denominador da taxa de conclusão do painel
-- genérico, deprimindo o indicador com gente que não pode responder.
--
-- A causa é um filtro que nunca correspondeu ao domínio real: a função excluía
-- 'REMOVED' e 'INELIGIBLE', dois valores que a constraint de
-- `application_participants.status` sequer permite —
--   ELIGIBLE · INVITED · IN_PROGRESS · COMPLETED · BLOCKED · EXCLUDED
-- — e deixava 'BLOCKED' passar. As demais funções que leem participantes
-- (`can_access_application`, `list_my_survey_catalog`,
-- `get_cddi_monitoring_dashboard_internal`) já excluem 'BLOCKED'; esta era a
-- única fora do padrão.
--
-- A correção nasce numa função nova com o prefixo institucional: `get_survey_dashboard`
-- permanece intacta como ponte para bundles já publicados, e sai numa migration
-- futura, depois que o frontend novo estiver no ar. Só o filtro de status muda.

create or replace function public.fc_obter_painel_pesquisa(target_application_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
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
      -- Quem está bloqueado ou excluído não pode responder: manter no
      -- denominador faria a taxa de conclusão nunca chegar a 100%.
      and ap.status not in ('BLOCKED', 'EXCLUDED')
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
$function$;

revoke all on function public.fc_obter_painel_pesquisa(text) from public, anon;
grant execute on function public.fc_obter_painel_pesquisa(text) to authenticated;

comment on function public.fc_obter_painel_pesquisa(text) is
  'Painel analítico de uma aplicação. Substitui get_survey_dashboard, que mantinha participantes BLOCKED no denominador da taxa de conclusão.';

notify pgrst, 'reload schema';

commit;

-- Rollback: a função antiga continua publicada e íntegra, então basta apontar o
-- frontend de volta para `get_survey_dashboard` e remover a nova.
-- begin;
--   drop function if exists public.fc_obter_painel_pesquisa(text);
--   notify pgrst, 'reload schema';
-- commit;
