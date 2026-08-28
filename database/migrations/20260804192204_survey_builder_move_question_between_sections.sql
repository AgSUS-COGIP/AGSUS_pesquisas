create or replace function public.move_survey_question_to_section(
  target_question_id uuid,
  target_section_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_actor_id uuid := public.current_person_id();
  v_version public.survey_versions%rowtype;
  v_question public.survey_questions%rowtype;
  v_target_section public.survey_sections%rowtype;
  v_application_id uuid;
  v_target_position integer;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à Equipe Técnica.';
  end if;

  if target_question_id is null or target_section_id is null then
    raise exception 'Informe a pergunta e a seção de destino.';
  end if;

  select version.*
  into v_version
  from public.survey_versions version
  join public.survey_questions question
    on question.survey_version_id = version.id
  where question.id = target_question_id
    and version.status = 'DRAFT'
  for update of version;

  if v_version.id is null then
    raise exception 'Pergunta em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
  end if;

  select *
  into v_question
  from public.survey_questions
  where id = target_question_id
    and survey_version_id = v_version.id;

  select *
  into v_target_section
  from public.survey_sections
  where id = target_section_id
    and survey_version_id = v_version.id;

  if v_target_section.id is null then
    raise exception 'A seção de destino precisa pertencer à mesma versão em rascunho.';
  end if;

  if v_question.section_id = v_target_section.id then
    return jsonb_build_object(
      'status', 'NO_CHANGE',
      'questionId', v_question.id,
      'sectionId', v_question.section_id,
      'position', v_question.position
    );
  end if;

  perform section.id
  from public.survey_sections section
  where section.id in (v_question.section_id, v_target_section.id)
  order by section.id
  for update;

  perform question.id
  from public.survey_questions question
  where question.section_id in (v_question.section_id, v_target_section.id)
  order by question.id
  for update;

  select coalesce(max(question.position), 0) + 1
  into v_target_position
  from public.survey_questions question
  where question.section_id = v_target_section.id;

  update public.survey_questions
  set section_id = v_target_section.id,
      position = v_target_position,
      updated_at = timezone('utc', now())
  where id = v_question.id
    and survey_version_id = v_version.id;

  select application.id
  into v_application_id
  from public.survey_applications application
  where application.survey_version_id = v_version.id
  order by application.created_at desc
  limit 1;

  insert into public.audit_events(
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'SURVEY_QUESTION_MOVED',
    'SURVEY_QUESTION',
    v_question.id::text,
    v_application_id,
    jsonb_build_object(
      'sectionId', v_question.section_id,
      'position', v_question.position
    ),
    jsonb_build_object(
      'sectionId', v_target_section.id,
      'position', v_target_position
    ),
    jsonb_build_object(
      'surveyId', v_version.survey_id,
      'surveyVersionId', v_version.id,
      'title', v_question.title
    )
  );

  return jsonb_build_object(
    'status', 'OK',
    'questionId', v_question.id,
    'previousSectionId', v_question.section_id,
    'sectionId', v_target_section.id,
    'previousPosition', v_question.position,
    'position', v_target_position
  );
end;
$function$;

revoke execute on function public.move_survey_question_to_section(uuid, uuid)
  from public, anon, service_role;
grant execute on function public.move_survey_question_to_section(uuid, uuid)
  to authenticated;
