begin;

create or replace function public.application_accepts_responses(target_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.survey_applications sa
    where sa.id = target_application_id
      and sa.status = 'OPEN'
      and (sa.opens_at is null or sa.opens_at <= now())
      and (sa.closes_at is null or sa.closes_at > now())
  );
$$;

create or replace function public.can_edit_submission(target_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select public.can_manage_surveys() or exists (
    select 1
    from public.submissions s
    where s.id = target_submission_id
      and s.respondent_person_id = public.current_person_id()
      and s.status = 'DRAFT'
      and public.can_access_application(s.application_id)
      and public.application_accepts_responses(s.application_id)
  );
$$;

create or replace function public.start_or_resume_my_cddi_submission(
  target_application_code text default 'CDDI-2026',
  target_submission_type text default 'AUTO',
  target_subject_person_id uuid default null
)
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
  v_subject_person_id uuid;
  v_type text := upper(btrim(coalesce(target_submission_type, 'AUTO')));
  v_answers jsonb := '{}'::jsonb;
  v_can_edit boolean := false;
begin
  if auth.uid() is null or v_person_id is null then
    raise exception 'Usuário autenticado sem cadastro institucional vinculado.';
  end if;

  select sa.*
    into v_application
  from public.survey_applications sa
  join public.survey_versions sv on sv.id = sa.survey_version_id
  join public.surveys s on s.id = sv.survey_id
  where sa.code = target_application_code
    and s.code = 'CDDI'
  limit 1;

  if not found then
    raise exception 'Aplicação CDDI não encontrada.';
  end if;

  select ap.*
    into v_participant
  from public.application_participants ap
  where ap.application_id = v_application.id
    and ap.person_id = v_person_id
    and ap.participant_role = 'RESPONDENT'
    and ap.status not in ('BLOCKED', 'EXCLUDED')
  order by ap.created_at desc
  limit 1;

  if not found then
    raise exception 'Seu cadastro não está elegível para esta aplicação.';
  end if;

  if v_type = 'AUTO' then
    v_subject_person_id := v_person_id;
  elsif v_type = 'CHEFIA' then
    v_subject_person_id := target_subject_person_id;
    if v_subject_person_id is null then
      raise exception 'A pessoa avaliada é obrigatória para a avaliação da chefia.';
    end if;

    if not exists (
      select 1
      from public.cddi_leadership_links l
      where l.application_id = v_application.id
        and l.leader_person_id = v_person_id
        and l.subordinate_person_id = v_subject_person_id
        and l.status = 'ACTIVE'
        and l.valid_from <= now()
        and (l.valid_to is null or l.valid_to > now())
    ) then
      raise exception 'Não existe vínculo ativo com a pessoa avaliada.';
    end if;
  else
    raise exception 'Tipo de avaliação inválido.';
  end if;

  select s.*
    into v_submission
  from public.submissions s
  where s.application_id = v_application.id
    and s.respondent_person_id = v_person_id
    and s.subject_person_id = v_subject_person_id
    and s.submission_type = v_type
    and s.status in ('DRAFT', 'SUBMITTED', 'VALIDATED')
  order by s.version desc, s.created_at desc
  limit 1;

  if not found then
    if not public.application_accepts_responses(v_application.id) then
      return jsonb_build_object(
        'status', 'PERIOD_CLOSED',
        'applicationStatus', v_application.status,
        'canEdit', false,
        'submission', null,
        'answers', '{}'::jsonb
      );
    end if;

    insert into public.submissions (
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
      v_subject_person_id,
      v_type,
      'DRAFT',
      jsonb_build_object('origin', 'PLATFORM_WEB')
    )
    returning * into v_submission;

    if v_type = 'AUTO' then
      update public.application_participants
      set status = case when status in ('ELIGIBLE', 'INVITED') then 'IN_PROGRESS' else status end,
          started_at = coalesce(started_at, now())
      where id = v_participant.id;
    end if;
  end if;

  select coalesce(
    jsonb_object_agg(
      a.question_id::text,
      jsonb_build_object(
        'answerText', a.answer_text,
        'answerNumber', a.answer_number,
        'optionId', selected_option.option_id,
        'optionValue', qo.value
      )
    ),
    '{}'::jsonb
  )
  into v_answers
  from public.answers a
  left join lateral (
    select ao.option_id
    from public.answer_options ao
    where ao.answer_id = a.id
    order by ao.position nulls last, ao.created_at
    limit 1
  ) selected_option on true
  left join public.question_options qo on qo.id = selected_option.option_id
  where a.submission_id = v_submission.id;

  v_can_edit := v_submission.status = 'DRAFT'
    and public.application_accepts_responses(v_application.id);

  return jsonb_build_object(
    'status', 'OK',
    'applicationStatus', v_application.status,
    'canEdit', v_can_edit,
    'submission', jsonb_build_object(
      'id', v_submission.id,
      'status', v_submission.status,
      'startedAt', v_submission.started_at,
      'submittedAt', v_submission.submitted_at,
      'updatedAt', v_submission.updated_at,
      'result', v_submission.calculated_result,
      'type', v_submission.submission_type
    ),
    'answers', v_answers
  );
end;
$$;

create or replace function public.save_my_cddi_answer(
  target_submission_id uuid,
  target_question_id uuid,
  target_option_id uuid default null,
  target_text text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person_id uuid := public.current_person_id();
  v_submission public.submissions%rowtype;
  v_survey_version_id uuid;
  v_question public.survey_questions%rowtype;
  v_option public.question_options%rowtype;
  v_answer_id uuid;
  v_numeric numeric(18,6);
  v_text text;
begin
  if auth.uid() is null or v_person_id is null then
    raise exception 'Usuário não identificado.';
  end if;

  select s.*
    into v_submission
  from public.submissions s
  where s.id = target_submission_id
  for update;

  if not found
    or v_submission.respondent_person_id is distinct from v_person_id
    or v_submission.status <> 'DRAFT' then
    raise exception 'O rascunho não está disponível para edição.';
  end if;

  if not public.application_accepts_responses(v_submission.application_id) then
    raise exception 'O período de respostas está encerrado.';
  end if;

  select sa.survey_version_id
    into v_survey_version_id
  from public.survey_applications sa
  where sa.id = v_submission.application_id;

  select q.*
    into v_question
  from public.survey_questions q
  where q.id = target_question_id
    and q.survey_version_id = v_survey_version_id;

  if not found then
    raise exception 'Pergunta inválida para esta aplicação.';
  end if;

  if v_question.question_type = 'SCALE' then
    if target_option_id is null then
      raise exception 'Selecione uma alternativa da escala.';
    end if;

    select qo.*
      into v_option
    from public.question_options qo
    where qo.id = target_option_id
      and qo.question_id = v_question.id
      and qo.active = true;

    if not found then
      raise exception 'Alternativa inválida para esta pergunta.';
    end if;

    v_numeric := coalesce(
      v_option.score,
      case
        when v_option.value ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$'
          then v_option.value::numeric
        else null
      end
    );

    insert into public.answers (
      submission_id,
      question_id,
      answer_text,
      answer_number,
      answer_boolean,
      answer_date,
      answer_datetime,
      answer_json,
      score
    ) values (
      v_submission.id,
      v_question.id,
      null,
      v_numeric,
      null,
      null,
      null,
      null,
      v_numeric
    )
    on conflict (submission_id, question_id) do update
      set answer_text = null,
          answer_number = excluded.answer_number,
          answer_boolean = null,
          answer_date = null,
          answer_datetime = null,
          answer_json = null,
          score = excluded.score,
          updated_at = now()
    returning id into v_answer_id;

    delete from public.answer_options where answer_id = v_answer_id;
    insert into public.answer_options (answer_id, option_id, position)
    values (v_answer_id, v_option.id, 1);

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
      insert into public.answers (
        submission_id,
        question_id,
        answer_text,
        answer_number,
        answer_boolean,
        answer_date,
        answer_datetime,
        answer_json,
        score
      ) values (
        v_submission.id,
        v_question.id,
        v_text,
        null,
        null,
        null,
        null,
        null,
        null
      )
      on conflict (submission_id, question_id) do update
        set answer_text = excluded.answer_text,
            answer_number = null,
            answer_boolean = null,
            answer_date = null,
            answer_datetime = null,
            answer_json = null,
            score = null,
            updated_at = now()
      returning id into v_answer_id;

      delete from public.answer_options where answer_id = v_answer_id;
    end if;
  else
    raise exception 'Tipo de pergunta ainda não suportado pelo formulário CDDI.';
  end if;

  update public.submissions
  set metadata = metadata || jsonb_build_object('last_saved_at', now())
  where id = v_submission.id;

  return jsonb_build_object(
    'status', 'OK',
    'savedAt', now()
  );
end;
$$;

create or replace function public.submit_my_cddi_submission(target_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person_id uuid := public.current_person_id();
  v_submission public.submissions%rowtype;
  v_application public.survey_applications%rowtype;
  v_missing_count integer := 0;
  v_section record;
  v_behavior_average numeric(12,6);
  v_development_level numeric(12,6);
  v_section_result numeric(12,6);
  v_final_score numeric(12,6);
  v_submitted_at timestamptz := now();
begin
  if auth.uid() is null or v_person_id is null then
    raise exception 'Usuário não identificado.';
  end if;

  select s.*
    into v_submission
  from public.submissions s
  where s.id = target_submission_id
  for update;

  if not found
    or v_submission.respondent_person_id is distinct from v_person_id
    or v_submission.status <> 'DRAFT' then
    raise exception 'A avaliação não está disponível para envio.';
  end if;

  select sa.*
    into v_application
  from public.survey_applications sa
  where sa.id = v_submission.application_id;

  if not public.application_accepts_responses(v_application.id) then
    raise exception 'O período de respostas está encerrado.';
  end if;

  select count(*)::integer
    into v_missing_count
  from public.survey_questions q
  where q.survey_version_id = v_application.survey_version_id
    and q.required = true
    and not exists (
      select 1
      from public.answers a
      where a.submission_id = v_submission.id
        and a.question_id = q.id
        and (
          (q.question_type = 'SCALE' and exists (
            select 1 from public.answer_options ao where ao.answer_id = a.id
          ))
          or (q.question_type in ('SHORT_TEXT', 'LONG_TEXT') and nullif(btrim(a.answer_text), '') is not null)
          or (q.question_type not in ('SCALE', 'SHORT_TEXT', 'LONG_TEXT') and num_nonnulls(
            a.answer_text,
            a.answer_number,
            a.answer_boolean,
            a.answer_date,
            a.answer_datetime,
            a.answer_json
          ) > 0)
        )
    );

  if v_missing_count > 0 then
    raise exception 'Existem % pergunta(s) obrigatória(s) sem resposta.', v_missing_count;
  end if;

  for v_section in
    select ss.id
    from public.survey_sections ss
    where ss.survey_version_id = v_application.survey_version_id
      and coalesce(ss.code, '') <> 'FINAL'
    order by ss.position
  loop
    select
      avg(a.score) filter (where q.scoring ->> 'component' = 'BEHAVIOR'),
      max(a.score) filter (where q.scoring ->> 'component' = 'DEVELOPMENT_LEVEL')
      into v_behavior_average, v_development_level
    from public.survey_questions q
    join public.answers a
      on a.question_id = q.id
     and a.submission_id = v_submission.id
    where q.section_id = v_section.id;

    if v_behavior_average is null or v_development_level is null then
      raise exception 'Não foi possível calcular uma das competências.';
    end if;

    v_section_result := round((v_behavior_average * 0.70 + v_development_level * 0.30)::numeric, 4);

    insert into public.cddi_competency_results (
      submission_id,
      competency_section_id,
      behavior_average,
      development_level,
      result,
      calculation_version
    ) values (
      v_submission.id,
      v_section.id,
      round(v_behavior_average::numeric, 4),
      round(v_development_level::numeric, 4),
      v_section_result,
      'CDDI-2026-V1'
    )
    on conflict (submission_id, competency_section_id) do update
      set behavior_average = excluded.behavior_average,
          development_level = excluded.development_level,
          result = excluded.result,
          calculation_version = excluded.calculation_version,
          updated_at = now();
  end loop;

  select round(avg(cr.result)::numeric, 4)
    into v_final_score
  from public.cddi_competency_results cr
  where cr.submission_id = v_submission.id;

  update public.submissions
  set status = 'SUBMITTED',
      submitted_at = v_submitted_at,
      calculated_result = v_final_score,
      metadata = metadata || jsonb_build_object('submitted_from', 'PLATFORM_WEB')
  where id = v_submission.id;

  if v_submission.submission_type = 'AUTO' then
    update public.application_participants
    set status = 'COMPLETED',
        completed_at = v_submitted_at
    where id = v_submission.participant_id;

    insert into public.cddi_final_results (
      application_id,
      subject_person_id,
      auto_submission_id,
      auto_score,
      final_score,
      status,
      calculated_at
    ) values (
      v_submission.application_id,
      v_submission.subject_person_id,
      v_submission.id,
      v_final_score,
      null,
      'PARTIAL',
      null
    )
    on conflict (application_id, subject_person_id) do update
      set auto_submission_id = excluded.auto_submission_id,
          auto_score = excluded.auto_score,
          final_score = case
            when public.cddi_final_results.leader_score is null then null
            else round((excluded.auto_score * 0.40 + public.cddi_final_results.leader_score * 0.60)::numeric, 4)
          end,
          status = case
            when public.cddi_final_results.leader_score is null then 'PARTIAL'
            else 'CALCULATED'
          end,
          calculated_at = case
            when public.cddi_final_results.leader_score is null then null
            else v_submitted_at
          end,
          updated_at = now();
  else
    insert into public.cddi_final_results (
      application_id,
      subject_person_id,
      leader_submission_id,
      leader_score,
      final_score,
      status,
      calculated_at
    ) values (
      v_submission.application_id,
      v_submission.subject_person_id,
      v_submission.id,
      v_final_score,
      null,
      'PARTIAL',
      null
    )
    on conflict (application_id, subject_person_id) do update
      set leader_submission_id = excluded.leader_submission_id,
          leader_score = excluded.leader_score,
          final_score = case
            when public.cddi_final_results.auto_score is null then null
            else round((public.cddi_final_results.auto_score * 0.40 + excluded.leader_score * 0.60)::numeric, 4)
          end,
          status = case
            when public.cddi_final_results.auto_score is null then 'PARTIAL'
            else 'CALCULATED'
          end,
          calculated_at = case
            when public.cddi_final_results.auto_score is null then null
            else v_submitted_at
          end,
          updated_at = now();
  end if;

  insert into public.audit_events (
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    after_data,
    metadata
  ) values (
    v_person_id,
    'CDDI_SUBMISSION_SUBMITTED',
    'SUBMISSION',
    v_submission.id::text,
    v_submission.application_id,
    jsonb_build_object('status', 'SUBMITTED', 'result', v_final_score),
    jsonb_build_object('submission_type', v_submission.submission_type)
  );

  return jsonb_build_object(
    'status', 'OK',
    'submissionStatus', 'SUBMITTED',
    'submittedAt', v_submitted_at,
    'result', v_final_score
  );
end;
$$;

drop policy if exists submissions_insert_own_draft on public.submissions;
create policy submissions_insert_own_draft
on public.submissions
for insert
to authenticated
with check (
  public.can_manage_surveys()
  or (
    respondent_person_id = public.current_person_id()
    and status = 'DRAFT'
    and public.can_access_application(application_id)
    and public.application_accepts_responses(application_id)
  )
);

drop policy if exists submissions_update_own_draft on public.submissions;
create policy submissions_update_own_draft
on public.submissions
for update
to authenticated
using (
  public.can_manage_surveys()
  or (
    respondent_person_id = public.current_person_id()
    and status = 'DRAFT'
    and public.application_accepts_responses(application_id)
  )
)
with check (
  public.can_manage_surveys()
  or (
    respondent_person_id = public.current_person_id()
    and status in ('DRAFT', 'SUBMITTED')
    and public.can_access_application(application_id)
    and public.application_accepts_responses(application_id)
  )
);

revoke all on function public.application_accepts_responses(uuid) from public;
revoke all on function public.can_edit_submission(uuid) from public;
revoke all on function public.start_or_resume_my_cddi_submission(text, text, uuid) from public;
revoke all on function public.save_my_cddi_answer(uuid, uuid, uuid, text) from public;
revoke all on function public.submit_my_cddi_submission(uuid) from public;

grant execute on function public.application_accepts_responses(uuid) to authenticated;
grant execute on function public.can_edit_submission(uuid) to authenticated;
grant execute on function public.start_or_resume_my_cddi_submission(text, text, uuid) to authenticated;
grant execute on function public.save_my_cddi_answer(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.submit_my_cddi_submission(uuid) to authenticated;

commit;