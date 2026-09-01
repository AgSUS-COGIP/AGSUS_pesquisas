-- O token da jornada anonima funciona como credencial bearer do rascunho.
-- Guardar o valor original em submissions.metadata faz uma leitura indevida do
-- banco se transformar imediatamente em capacidade de editar a resposta.
--
-- Esta migration preserva as sessoes ja abertas: converte o token existente em
-- SHA-256 e passa a comparar somente o hash do token apresentado pelo cliente.

-- Converte rascunhos existentes antes de trocar o contrato das funcoes.
update public.submissions
set metadata = (coalesce(metadata, '{}'::jsonb) - 'public_session_token')
  || jsonb_build_object(
    'public_session_token_hash',
    pg_catalog.encode(
      extensions.digest(metadata ->> 'public_session_token', 'sha256'),
      'hex'
    )
  )
where status = 'DRAFT'
  and metadata ->> 'origin' = 'PUBLIC_ANONYMOUS_LINK'
  and nullif(metadata ->> 'public_session_token', '') is not null;

create or replace function public.fc_iniciar_resp_anon(target_application_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_application public.survey_applications%rowtype;
  v_submission public.submissions%rowtype;
  v_token text := gen_random_uuid()::text;
  v_token_hash text := pg_catalog.encode(extensions.digest(v_token, 'sha256'), 'hex');
begin
  select *
  into v_application
  from public.survey_applications
  where code = btrim(target_application_code)
  limit 1;

  if v_application.id is null or not v_application.anonymous then
    raise exception 'A avaliação anônima não foi encontrada.';
  end if;
  if not public.application_accepts_responses(v_application.id) then
    raise exception 'O período de respostas está encerrado.';
  end if;

  insert into public.submissions(
    application_id,
    participant_id,
    respondent_person_id,
    subject_person_id,
    submission_type,
    status,
    metadata
  )
  values (
    v_application.id,
    null,
    null,
    null,
    'RESPONSE',
    'DRAFT',
    jsonb_build_object(
      'origin', 'PUBLIC_ANONYMOUS_LINK',
      'public_session_token_hash', v_token_hash
    )
  )
  returning * into v_submission;

  return jsonb_build_object(
    'status', 'OK',
    'anonymous', true,
    'canEdit', true,
    'sessionToken', v_token,
    'submission', jsonb_build_object(
      'id', v_submission.id,
      'status', v_submission.status,
      'submittedAt', null
    ),
    'answers', '{}'::jsonb
  );
end;
$function$;

create or replace function public.fc_gravar_resp_anon(
  target_submission_id uuid,
  target_session_token text,
  target_question_id uuid,
  target_option_ids uuid[],
  target_text text,
  target_number numeric,
  target_boolean boolean,
  target_date date,
  target_datetime timestamptz,
  target_json jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_submission public.submissions%rowtype;
  v_version_id uuid;
  v_question public.survey_questions%rowtype;
  v_answer_id uuid;
  v_option_ids uuid[];
  v_invalid_options integer;
  v_text text;
  v_token_hash text;
begin
  if target_session_token is null then
    raise exception 'O rascunho anônimo não está disponível para edição.';
  end if;
  v_token_hash := pg_catalog.encode(extensions.digest(target_session_token, 'sha256'), 'hex');

  select *
  into v_submission
  from public.submissions
  where id = target_submission_id
  for update;

  if v_submission.id is null
     or v_submission.status <> 'DRAFT'
     or coalesce(v_submission.metadata ->> 'public_session_token_hash', '') <> v_token_hash then
    raise exception 'O rascunho anônimo não está disponível para edição.';
  end if;
  if not public.application_accepts_responses(v_submission.application_id) then
    raise exception 'O período de respostas está encerrado.';
  end if;

  select survey_version_id
  into v_version_id
  from public.survey_applications
  where id = v_submission.application_id
    and anonymous;
  if v_version_id is null then
    raise exception 'A avaliação anônima não está disponível.';
  end if;

  select *
  into v_question
  from public.survey_questions
  where id = target_question_id
    and survey_version_id = v_version_id;
  if v_question.id is null then
    raise exception 'Pergunta inválida para esta pesquisa.';
  end if;

  if v_question.question_type in ('SCALE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE') then
    select coalesce(array_agg(distinct option_id), '{}'::uuid[])
    into v_option_ids
    from unnest(coalesce(target_option_ids, '{}'::uuid[])) option_id;

    if coalesce(array_length(v_option_ids, 1), 0) = 0 then
      delete from public.answers
      where submission_id = v_submission.id
        and question_id = v_question.id;
    else
      if v_question.question_type in ('SCALE', 'SINGLE_CHOICE')
         and array_length(v_option_ids, 1) <> 1 then
        raise exception 'Selecione apenas uma alternativa.';
      end if;

      select count(*)
      into v_invalid_options
      from unnest(v_option_ids) selected_id
      left join public.question_options qo
        on qo.id = selected_id
       and qo.question_id = v_question.id
       and qo.active
      where qo.id is null;
      if v_invalid_options > 0 then
        raise exception 'Uma ou mais alternativas são inválidas.';
      end if;

      insert into public.answers(submission_id, question_id)
      values (v_submission.id, v_question.id)
      on conflict(submission_id, question_id) do update
      set answer_text = null,
          answer_number = null,
          answer_boolean = null,
          answer_date = null,
          answer_datetime = null,
          answer_json = null,
          score = null,
          updated_at = now()
      returning id into v_answer_id;

      delete from public.answer_options where answer_id = v_answer_id;
      insert into public.answer_options(answer_id, option_id, position)
      select v_answer_id, option_id, row_number() over(order by option_id)::integer
      from unnest(v_option_ids) option_id;
    end if;
  elsif v_question.question_type in ('SHORT_TEXT', 'LONG_TEXT') then
    v_text := nullif(btrim(coalesce(target_text, '')), '');
    if length(coalesce(v_text, '')) > 12000 then
      raise exception 'O texto excede o limite de 12.000 caracteres.';
    end if;
    if v_text is null then
      delete from public.answers
      where submission_id = v_submission.id
        and question_id = v_question.id;
    else
      insert into public.answers(submission_id, question_id, answer_text)
      values (v_submission.id, v_question.id, v_text)
      on conflict(submission_id, question_id) do update
      set answer_text = excluded.answer_text,
          answer_number = null,
          answer_boolean = null,
          answer_date = null,
          answer_datetime = null,
          answer_json = null,
          score = null,
          updated_at = now();
    end if;
  elsif v_question.question_type in ('INTEGER', 'DECIMAL') then
    if target_number is null then
      delete from public.answers
      where submission_id = v_submission.id
        and question_id = v_question.id;
    else
      if v_question.question_type = 'INTEGER' and target_number <> trunc(target_number) then
        raise exception 'Informe um número inteiro.';
      end if;
      insert into public.answers(submission_id, question_id, answer_number)
      values (v_submission.id, v_question.id, target_number)
      on conflict(submission_id, question_id) do update
      set answer_text = null,
          answer_number = excluded.answer_number,
          answer_boolean = null,
          answer_date = null,
          answer_datetime = null,
          answer_json = null,
          score = null,
          updated_at = now();
    end if;
  elsif v_question.question_type = 'BOOLEAN' then
    if target_boolean is null then
      delete from public.answers
      where submission_id = v_submission.id
        and question_id = v_question.id;
    else
      insert into public.answers(submission_id, question_id, answer_boolean)
      values (v_submission.id, v_question.id, target_boolean)
      on conflict(submission_id, question_id) do update
      set answer_text = null,
          answer_number = null,
          answer_boolean = excluded.answer_boolean,
          answer_date = null,
          answer_datetime = null,
          answer_json = null,
          score = null,
          updated_at = now();
    end if;
  elsif v_question.question_type = 'DATE' then
    if target_date is null then
      delete from public.answers
      where submission_id = v_submission.id
        and question_id = v_question.id;
    else
      insert into public.answers(submission_id, question_id, answer_date)
      values (v_submission.id, v_question.id, target_date)
      on conflict(submission_id, question_id) do update
      set answer_text = null,
          answer_number = null,
          answer_boolean = null,
          answer_date = excluded.answer_date,
          answer_datetime = null,
          answer_json = null,
          score = null,
          updated_at = now();
    end if;
  elsif v_question.question_type = 'DATETIME' then
    if target_datetime is null then
      delete from public.answers
      where submission_id = v_submission.id
        and question_id = v_question.id;
    else
      insert into public.answers(submission_id, question_id, answer_datetime)
      values (v_submission.id, v_question.id, target_datetime)
      on conflict(submission_id, question_id) do update
      set answer_text = null,
          answer_number = null,
          answer_boolean = null,
          answer_date = null,
          answer_datetime = excluded.answer_datetime,
          answer_json = null,
          score = null,
          updated_at = now();
    end if;
  else
    raise exception 'Tipo de pergunta ainda não suportado: %.', v_question.question_type;
  end if;

  update public.submissions
  set updated_at = now()
  where id = v_submission.id;

  return jsonb_build_object('status', 'OK', 'savedAt', now());
end;
$function$;

create or replace function public.fc_enviar_resp_anon(
  target_submission_id uuid,
  target_session_token text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_submission public.submissions%rowtype;
  v_application public.survey_applications%rowtype;
  v_missing integer;
  v_submitted_at timestamptz := now();
  v_token_hash text;
begin
  if target_session_token is null then
    raise exception 'A resposta anônima não está disponível para envio.';
  end if;
  v_token_hash := pg_catalog.encode(extensions.digest(target_session_token, 'sha256'), 'hex');

  select *
  into v_submission
  from public.submissions
  where id = target_submission_id
  for update;

  if v_submission.id is null
     or v_submission.status <> 'DRAFT'
     or coalesce(v_submission.metadata ->> 'public_session_token_hash', '') <> v_token_hash then
    raise exception 'A resposta anônima não está disponível para envio.';
  end if;

  select *
  into v_application
  from public.survey_applications
  where id = v_submission.application_id;
  if not v_application.anonymous or not public.application_accepts_responses(v_application.id) then
    raise exception 'O período de respostas está encerrado.';
  end if;

  select count(*)::integer
  into v_missing
  from public.survey_questions q
  where q.survey_version_id = v_application.survey_version_id
    and q.required
    and public.fc_pergunta_visivel(v_submission.id, q.id)
    and not exists (
      select 1
      from public.answers a
      where a.submission_id = v_submission.id
        and a.question_id = q.id
        and (
          (q.question_type in ('SCALE', 'SINGLE_CHOICE', 'MULTIPLE_CHOICE') and exists(
            select 1 from public.answer_options ao where ao.answer_id = a.id
          ))
          or (q.question_type in ('SHORT_TEXT', 'LONG_TEXT') and nullif(btrim(a.answer_text), '') is not null)
          or (q.question_type in ('INTEGER', 'DECIMAL') and a.answer_number is not null)
          or (q.question_type = 'BOOLEAN' and a.answer_boolean is not null)
          or (q.question_type = 'DATE' and a.answer_date is not null)
          or (q.question_type = 'DATETIME' and a.answer_datetime is not null)
        )
    );
  if v_missing > 0 then
    raise exception 'Existem % pergunta(s) obrigatória(s) sem resposta.', v_missing;
  end if;

  update public.submissions
  set status = 'SUBMITTED',
      submitted_at = v_submitted_at,
      updated_at = v_submitted_at,
      metadata = (coalesce(metadata, '{}'::jsonb) - 'public_session_token' - 'public_session_token_hash')
        || jsonb_build_object('submitted_from', 'PUBLIC_ANONYMOUS_LINK')
  where id = v_submission.id;

  insert into public.audit_events(
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    after_data,
    metadata
  )
  values (
    null,
    'ANONYMOUS_SUBMISSION_SUBMITTED',
    'APPLICATION',
    v_application.id::text,
    v_application.id,
    jsonb_build_object('status', 'SUBMITTED'),
    jsonb_build_object('anonymous', true)
  );

  return jsonb_build_object(
    'status', 'OK',
    'submissionStatus', 'SUBMITTED',
    'submittedAt', v_submitted_at,
    'anonymous', true
  );
end;
$function$;

-- As funcoes de dominio continuam inacessiveis a papeis da Data API; somente
-- as envoltorias fc_srv_* permanecem como contratos do backend.
revoke all on function public.fc_iniciar_resp_anon(text) from public, anon, authenticated, service_role;
revoke all on function public.fc_gravar_resp_anon(uuid, text, uuid, uuid[], text, numeric, boolean, date, timestamptz, jsonb) from public, anon, authenticated, service_role;
revoke all on function public.fc_enviar_resp_anon(uuid, text) from public, anon, authenticated, service_role;

notify pgrst, 'reload schema';
