begin;

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
      'settings', sa.settings
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
      select jsonb_agg(
        jsonb_build_object(
          'id', ss.id,
          'code', ss.code,
          'title', ss.title,
          'description', ss.description,
          'position', ss.position,
          'settings', ss.settings,
          'questions', coalesce((
            select jsonb_agg(
              jsonb_build_object(
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
                  select jsonb_agg(
                    jsonb_build_object(
                      'id', qo.id,
                      'code', qo.code,
                      'label', qo.label,
                      'value', qo.value,
                      'score', qo.score,
                      'position', qo.position
                    ) order by qo.position
                  )
                  from public.question_options qo
                  where qo.question_id = sq.id
                    and qo.active = true
                ), '[]'::jsonb)
              ) order by sq.position
            )
            from public.survey_questions sq
            where sq.section_id = ss.id
          ), '[]'::jsonb)
        ) order by ss.position
      )
      from public.survey_sections ss
      where ss.survey_version_id = sv.id
        and ss.parent_section_id is null
    ), '[]'::jsonb)
  )
  from public.survey_applications sa
  join public.survey_versions sv on sv.id = sa.survey_version_id
  join public.surveys s on s.id = sv.survey_id
  where sa.code = target_application_code
    and sv.status in ('PUBLISHED', 'RETIRED')
    and sa.status in ('SCHEDULED', 'OPEN', 'CLOSED')
  limit 1;
$$;

revoke all on function public.get_public_survey_form(text) from public;
grant execute on function public.get_public_survey_form(text) to anon, authenticated;

comment on function public.get_public_survey_form(text) is
  'Retorna somente a definicao publica de um formulario, sem participantes, respostas ou dados pessoais.';

commit;
