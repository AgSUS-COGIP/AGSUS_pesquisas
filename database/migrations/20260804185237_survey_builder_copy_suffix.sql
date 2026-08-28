create or replace function public.duplicate_survey_builder_item(
  target_item_type text,
  target_item_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_actor_id uuid := public.current_person_id();
  v_item_type text := upper(btrim(coalesce(target_item_type, '')));
  v_version public.survey_versions%rowtype;
  v_source_section public.survey_sections%rowtype;
  v_source_question public.survey_questions%rowtype;
  v_question_row public.survey_questions%rowtype;
  v_option_row public.question_options%rowtype;
  v_source_section_id uuid;
  v_new_section_id uuid;
  v_new_question_id uuid;
  v_new_item_id uuid;
  v_application_id uuid;
  v_position integer;
  v_copied_questions integer := 0;
  v_copied_options integer := 0;
  v_new_title text;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à Equipe Técnica.';
  end if;
  if v_item_type not in ('SECTION', 'QUESTION') then
    raise exception 'Tipo de item inválido para duplicação.';
  end if;

  if v_item_type = 'SECTION' then
    select sv.*
    into v_version
    from public.survey_versions sv
    join public.survey_sections sec on sec.survey_version_id = sv.id
    where sec.id = target_item_id
      and sv.status = 'DRAFT'
    for update of sv;

    if v_version.id is null then
      raise exception 'Seção em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
    end if;

    perform sec.id
    from public.survey_sections sec
    where sec.survey_version_id = v_version.id
    order by sec.id
    for update;

    select *
    into v_source_section
    from public.survey_sections
    where id = target_item_id
      and survey_version_id = v_version.id;

    perform question.id
    from public.survey_questions question
    where question.section_id = target_item_id
    order by question.id
    for update;

    select coalesce(max(sec.position), 0) + 1
    into v_position
    from public.survey_sections sec
    where sec.survey_version_id = v_version.id;

    v_new_title := left(v_source_section.title, 152) || ' — cópia';

    insert into public.survey_sections(
      survey_version_id,
      parent_section_id,
      code,
      title,
      description,
      position,
      settings
    ) values (
      v_version.id,
      v_source_section.parent_section_id,
      'S_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      v_new_title,
      v_source_section.description,
      v_position,
      v_source_section.settings
    )
    returning id into v_new_section_id;

    for v_question_row in
      select *
      from public.survey_questions
      where section_id = target_item_id
      order by position, id
    loop
      insert into public.survey_questions(
        survey_version_id,
        section_id,
        code,
        title,
        description,
        question_type,
        required,
        position,
        validation,
        display_logic,
        scoring,
        settings
      ) values (
        v_version.id,
        v_new_section_id,
        'Q_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
        v_question_row.title,
        v_question_row.description,
        v_question_row.question_type,
        v_question_row.required,
        v_question_row.position,
        v_question_row.validation,
        v_question_row.display_logic,
        v_question_row.scoring,
        v_question_row.settings
      )
      returning id into v_new_question_id;

      v_copied_questions := v_copied_questions + 1;

      for v_option_row in
        select *
        from public.question_options
        where question_id = v_question_row.id
        order by position, id
      loop
        insert into public.question_options(
          question_id,
          code,
          label,
          value,
          score,
          position,
          active,
          metadata
        ) values (
          v_new_question_id,
          v_option_row.code,
          v_option_row.label,
          v_option_row.value,
          v_option_row.score,
          v_option_row.position,
          v_option_row.active,
          v_option_row.metadata
        );
        v_copied_options := v_copied_options + 1;
      end loop;
    end loop;

    v_new_item_id := v_new_section_id;
  else
    select sv.*
    into v_version
    from public.survey_versions sv
    join public.survey_questions question on question.survey_version_id = sv.id
    where question.id = target_item_id
      and sv.status = 'DRAFT'
    for update of sv;

    if v_version.id is null then
      raise exception 'Pergunta em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
    end if;

    select question.section_id
    into v_source_section_id
    from public.survey_questions question
    where question.id = target_item_id
      and question.survey_version_id = v_version.id;

    perform question.id
    from public.survey_questions question
    where question.section_id = v_source_section_id
    order by question.id
    for update;

    select *
    into v_source_question
    from public.survey_questions
    where id = target_item_id
      and survey_version_id = v_version.id;

    if v_source_question.id is null then
      raise exception 'Pergunta em rascunho não encontrada.';
    end if;

    select coalesce(max(question.position), 0) + 1
    into v_position
    from public.survey_questions question
    where question.section_id = v_source_question.section_id;

    v_new_title := left(v_source_question.title, 492) || ' — cópia';

    insert into public.survey_questions(
      survey_version_id,
      section_id,
      code,
      title,
      description,
      question_type,
      required,
      position,
      validation,
      display_logic,
      scoring,
      settings
    ) values (
      v_version.id,
      v_source_question.section_id,
      'Q_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      v_new_title,
      v_source_question.description,
      v_source_question.question_type,
      v_source_question.required,
      v_position,
      v_source_question.validation,
      v_source_question.display_logic,
      v_source_question.scoring,
      v_source_question.settings
    )
    returning id into v_new_question_id;

    for v_option_row in
      select *
      from public.question_options
      where question_id = target_item_id
      order by position, id
    loop
      insert into public.question_options(
        question_id,
        code,
        label,
        value,
        score,
        position,
        active,
        metadata
      ) values (
        v_new_question_id,
        v_option_row.code,
        v_option_row.label,
        v_option_row.value,
        v_option_row.score,
        v_option_row.position,
        v_option_row.active,
        v_option_row.metadata
      );
      v_copied_options := v_copied_options + 1;
    end loop;

    v_new_item_id := v_new_question_id;
  end if;

  select app.id
  into v_application_id
  from public.survey_applications app
  where app.survey_version_id = v_version.id
  order by app.created_at desc
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
    'SURVEY_' || v_item_type || '_DUPLICATED',
    'SURVEY_' || v_item_type,
    v_new_item_id::text,
    v_application_id,
    jsonb_build_object('sourceId', target_item_id),
    jsonb_build_object(
      'itemId', v_new_item_id,
      'title', v_new_title,
      'position', v_position,
      'copiedQuestions', v_copied_questions,
      'copiedOptions', v_copied_options
    ),
    jsonb_build_object('surveyId', v_version.survey_id, 'surveyVersionId', v_version.id)
  );

  return jsonb_build_object(
    'status', 'OK',
    'itemType', v_item_type,
    'itemId', v_new_item_id,
    'position', v_position,
    'copiedQuestions', v_copied_questions,
    'copiedOptions', v_copied_options
  );
end;
$function$;


revoke execute on function public.duplicate_survey_builder_item(text, uuid) from public, anon, service_role;
grant execute on function public.duplicate_survey_builder_item(text, uuid) to authenticated;

