create or replace function public.update_survey_section(
  target_section_id uuid,
  section_title text,
  section_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_actor_id uuid := public.current_person_id();
  v_version public.survey_versions%rowtype;
  v_section public.survey_sections%rowtype;
  v_application_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_title text := btrim(coalesce(section_title, ''));
  v_description text := nullif(btrim(section_description), '');
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à Equipe Técnica.';
  end if;
  if v_title = '' then
    raise exception 'Informe o título da seção.';
  end if;
  if length(v_title) > 160 then
    raise exception 'O título da seção deve ter no máximo 160 caracteres.';
  end if;
  if length(coalesce(v_description, '')) > 1000 then
    raise exception 'A descrição da seção deve ter no máximo 1.000 caracteres.';
  end if;

  select sv.*
  into v_version
  from public.survey_versions sv
  join public.survey_sections sec on sec.survey_version_id = sv.id
  where sec.id = target_section_id
    and sv.status = 'DRAFT'
  for update of sv;

  if v_version.id is null then
    raise exception 'Seção em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
  end if;

  select *
  into v_section
  from public.survey_sections
  where id = target_section_id
    and survey_version_id = v_version.id
  for update;

  v_before := jsonb_build_object(
    'title', v_section.title,
    'description', v_section.description,
    'position', v_section.position
  );

  update public.survey_sections
  set title = v_title,
      description = v_description,
      updated_at = timezone('utc', now())
  where id = target_section_id
  returning * into v_section;

  v_after := jsonb_build_object(
    'title', v_section.title,
    'description', v_section.description,
    'position', v_section.position
  );

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
    'SURVEY_SECTION_UPDATED',
    'SURVEY_SECTION',
    target_section_id::text,
    v_application_id,
    v_before,
    v_after,
    jsonb_build_object('surveyId', v_version.survey_id, 'surveyVersionId', v_version.id)
  );

  return jsonb_build_object(
    'status', 'OK',
    'sectionId', target_section_id,
    'updatedAt', timezone('utc', now())
  );
end;
$function$;

create or replace function public.update_survey_question(
  target_question_id uuid,
  question_title text,
  question_description text,
  question_type text,
  is_required boolean,
  question_options jsonb
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
  v_application_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_options jsonb := coalesce(question_options, '[]'::jsonb);
  v_option jsonb;
  v_ordinal bigint;
  v_score numeric;
  v_title text := btrim(coalesce(question_title, ''));
  v_description text := nullif(btrim(question_description), '');
  v_type text := upper(btrim(coalesce(question_type, '')));
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à Equipe Técnica.';
  end if;
  if v_title = '' then
    raise exception 'Informe o enunciado da pergunta.';
  end if;
  if length(v_title) > 500 then
    raise exception 'O enunciado deve ter no máximo 500 caracteres.';
  end if;
  if length(coalesce(v_description, '')) > 2000 then
    raise exception 'A descrição deve ter no máximo 2.000 caracteres.';
  end if;
  if v_type not in (
    'SHORT_TEXT',
    'LONG_TEXT',
    'INTEGER',
    'DECIMAL',
    'DATE',
    'DATETIME',
    'BOOLEAN',
    'SINGLE_CHOICE',
    'MULTIPLE_CHOICE',
    'SCALE'
  ) then
    raise exception 'Tipo de pergunta não suportado neste construtor.';
  end if;
  if jsonb_typeof(v_options) <> 'array' then
    raise exception 'As alternativas devem ser enviadas em uma lista.';
  end if;
  if v_type in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE') then
    if jsonb_array_length(v_options) < 2 then
      raise exception 'Informe pelo menos duas alternativas.';
    end if;
    if jsonb_array_length(v_options) > 50 then
      raise exception 'Use no máximo 50 alternativas.';
    end if;

    for v_option, v_ordinal in
      select value, ordinality
      from jsonb_array_elements(v_options) with ordinality
    loop
      if jsonb_typeof(v_option) <> 'object' then
        raise exception 'A alternativa % possui um formato inválido.', v_ordinal;
      end if;
      if nullif(btrim(v_option->>'label'), '') is null then
        raise exception 'Informe o texto da alternativa %.', v_ordinal;
      end if;
      if length(btrim(v_option->>'label')) > 200 then
        raise exception 'A alternativa % deve ter no máximo 200 caracteres.', v_ordinal;
      end if;
      if length(coalesce(nullif(btrim(v_option->>'value'), ''), v_ordinal::text)) > 200 then
        raise exception 'O valor da alternativa % deve ter no máximo 200 caracteres.', v_ordinal;
      end if;
      if nullif(v_option->>'score', '') is not null then
        begin
          v_score := (v_option->>'score')::numeric;
        exception
          when invalid_text_representation or numeric_value_out_of_range then
            raise exception 'A pontuação da alternativa % é inválida.', v_ordinal;
        end;
      end if;
    end loop;

    if exists (
      select 1
      from (
        select lower(btrim(option_item->>'label')) as normalized_label
        from jsonb_array_elements(v_options) as option_rows(option_item)
        group by lower(btrim(option_item->>'label'))
        having count(*) > 1
      ) duplicate_options
    ) then
      raise exception 'As alternativas não podem ser repetidas.';
    end if;
  else
    v_options := '[]'::jsonb;
  end if;

  select sv.*
  into v_version
  from public.survey_versions sv
  join public.survey_questions question on question.survey_version_id = sv.id
  where question.id = target_question_id
    and sv.status = 'DRAFT'
  for update of sv;

  if v_version.id is null then
    raise exception 'Pergunta em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
  end if;

  select *
  into v_question
  from public.survey_questions
  where id = target_question_id
    and survey_version_id = v_version.id
  for update;

  v_before := jsonb_build_object(
    'title', v_question.title,
    'description', v_question.description,
    'questionType', v_question.question_type,
    'required', v_question.required,
    'options', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', option_row.id,
          'label', option_row.label,
          'value', option_row.value,
          'score', option_row.score,
          'position', option_row.position
        ) order by option_row.position
      )
      from public.question_options option_row
      where option_row.question_id = target_question_id
    ), '[]'::jsonb)
  );

  update public.survey_questions
  set title = v_title,
      description = v_description,
      question_type = v_type,
      required = coalesce(is_required, false),
      updated_at = timezone('utc', now())
  where id = target_question_id
  returning * into v_question;

  delete from public.question_options
  where question_id = target_question_id;

  if v_type in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE') then
    for v_option, v_ordinal in
      select value, ordinality
      from jsonb_array_elements(v_options) with ordinality
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
        target_question_id,
        'O' || lpad(v_ordinal::text, 2, '0'),
        btrim(v_option->>'label'),
        coalesce(nullif(btrim(v_option->>'value'), ''), v_ordinal::text),
        case when nullif(v_option->>'score', '') is null then null else (v_option->>'score')::numeric end,
        v_ordinal::integer,
        true,
        '{}'::jsonb
      );
    end loop;
  end if;

  v_after := jsonb_build_object(
    'title', v_question.title,
    'description', v_question.description,
    'questionType', v_question.question_type,
    'required', v_question.required,
    'options', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', option_row.id,
          'label', option_row.label,
          'value', option_row.value,
          'score', option_row.score,
          'position', option_row.position
        ) order by option_row.position
      )
      from public.question_options option_row
      where option_row.question_id = target_question_id
    ), '[]'::jsonb)
  );

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
    'SURVEY_QUESTION_UPDATED',
    'SURVEY_QUESTION',
    target_question_id::text,
    v_application_id,
    v_before,
    v_after,
    jsonb_build_object('surveyId', v_version.survey_id, 'surveyVersionId', v_version.id)
  );

  return jsonb_build_object(
    'status', 'OK',
    'questionId', target_question_id,
    'updatedAt', timezone('utc', now())
  );
end;
$function$;

revoke execute on function public.update_survey_section(uuid, text, text) from public, anon, service_role;
grant execute on function public.update_survey_section(uuid, text, text) to authenticated;

revoke execute on function public.update_survey_question(uuid, text, text, text, boolean, jsonb) from public, anon, service_role;
grant execute on function public.update_survey_question(uuid, text, text, text, boolean, jsonb) to authenticated;
