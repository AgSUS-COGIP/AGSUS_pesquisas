begin;

-- Anonimato estrutural para aplicações marcadas como anônimas.
--
-- O que "estrutural" quer dizer aqui
-- ----------------------------------
-- Não é promessa de política nem campo escondido na interface: **depois do
-- envio, não existe no banco nenhuma linha que ligue a pessoa às respostas
-- dela**. Quem tiver acesso total ao banco não consegue refazer o vínculo,
-- porque ele não está em lugar nenhum.
--
-- Isso obriga a resolver um conflito real: para a pessoa retomar o rascunho, a
-- plataforma precisa saber que aquele rascunho é dela. A saída é um bilhete —
-- `tb_bilhete_anonimo` — que liga pessoa e submissão **enquanto o rascunho
-- existe** e é destruído no envio.
--
-- A consequência honesta, que precisa estar escrita: durante o preenchimento o
-- vínculo existe. Uma pessoa com acesso ao banco naquele intervalo conseguiria
-- ver quem está respondendo o quê. O anonimato vale a partir do envio, e é isso
-- que a interface deve dizer — não "ninguém nunca saberá".
--
-- O que continua identificado, de propósito
-- -----------------------------------------
-- `application_participants` registra que a pessoa **respondeu**, com data. Sem
-- isso não haveria como cobrar quem falta nem impedir resposta em dobro. Saber
-- que alguém participou é diferente de saber o que respondeu.
--
-- O CDDI não é afetado: ele é nominal por natureza — a devolutiva individual e
-- a avaliação da chefia exigem identificação — e sua jornada usa outras RPCs.

alter table public.survey_applications
  add column if not exists nu_limiar_anonimato integer not null default 5;

alter table public.survey_applications
  drop constraint if exists ck_survey_applications_limiar;
alter table public.survey_applications
  add constraint ck_survey_applications_limiar check (nu_limiar_anonimato >= 2);

comment on column public.survey_applications.nu_limiar_anonimato is
  'Mínimo de respostas para que um recorte anônimo possa ser exibido. Abaixo disso, o painel suprime — grupo pequeno identifica por eliminação.';

---------------------------------------------------------------------------
-- Bilhete: vínculo temporário entre pessoa e rascunho anônimo.
---------------------------------------------------------------------------
create table if not exists public.tb_bilhete_anonimo (
  sq_bilhete uuid primary key default gen_random_uuid(),
  sq_aplicacao uuid not null,
  sq_pessoa uuid not null,
  sq_submissao uuid not null,
  dt_criacao timestamptz not null default timezone('utc', now()),
  constraint fk_bilhete_anonimo_aplicacao foreign key (sq_aplicacao) references public.survey_applications (id) on delete cascade,
  constraint fk_bilhete_anonimo_pessoa foreign key (sq_pessoa) references public.people (id) on delete cascade,
  constraint fk_bilhete_anonimo_submissao foreign key (sq_submissao) references public.submissions (id) on delete cascade,
  constraint uk_bilhete_anonimo_pessoa unique (sq_aplicacao, sq_pessoa),
  constraint uk_bilhete_anonimo_submissao unique (sq_submissao)
);

comment on table public.tb_bilhete_anonimo is
  'Liga pessoa e submissão apenas enquanto o rascunho anônimo existe. Destruído no envio — é o que torna o anonimato estrutural.';

alter table public.tb_bilhete_anonimo enable row level security;

revoke all on table public.tb_bilhete_anonimo from public, anon, authenticated;
grant select on table public.tb_bilhete_anonimo to authenticated;

-- Só a própria pessoa enxerga o próprio bilhete. A administração **não** tem
-- política de leitura aqui de propósito: poder listar bilhetes seria poder
-- observar quem está respondendo o quê durante o preenchimento, que é
-- exatamente o que o anonimato existe para impedir. As RPCs manipulam a tabela
-- por `security definer`, sem depender de grant para o operador.
create policy bilhete_anonimo_select_proprio on public.tb_bilhete_anonimo
  for select to authenticated
  using (sq_pessoa = public.current_person_id());

---------------------------------------------------------------------------
-- Acesso ao próprio rascunho anônimo.
--
-- As políticas existentes de `submissions` e `answers` reconhecem a pessoa por
-- `respondent_person_id`, que numa submissão anônima é nulo. As políticas
-- abaixo são **adicionais** — em RLS permissiva as regras se somam, então
-- nada do comportamento atual muda; apenas passa a existir um segundo caminho,
-- pelo bilhete, para quem está preenchendo anonimamente.
---------------------------------------------------------------------------
drop policy if exists submissions_select_bilhete on public.submissions;
create policy submissions_select_bilhete on public.submissions
  for select to authenticated
  using (exists (
    select 1 from public.tb_bilhete_anonimo b
    where b.sq_submissao = submissions.id and b.sq_pessoa = public.current_person_id()
  ));

drop policy if exists submissions_update_bilhete on public.submissions;
create policy submissions_update_bilhete on public.submissions
  for update to authenticated
  using (status = 'DRAFT' and exists (
    select 1 from public.tb_bilhete_anonimo b
    where b.sq_submissao = submissions.id and b.sq_pessoa = public.current_person_id()
  ));

drop policy if exists answers_select_bilhete on public.answers;
create policy answers_select_bilhete on public.answers
  for select to authenticated
  using (exists (
    select 1 from public.tb_bilhete_anonimo b
    where b.sq_submissao = answers.submission_id and b.sq_pessoa = public.current_person_id()
  ));

---------------------------------------------------------------------------
-- Quando um ciclo pode ser marcado como anônimo.
--
-- Substitui o bloqueio total criado enquanto o anonimato era só uma promessa.
-- Agora a marcação é permitida, mas **não depois que alguém já respondeu**:
-- ligar o anonimato no meio deixaria respostas identificadas convivendo com
-- anônimas sob a mesma promessa, e desligá-lo revelaria quem respondeu
-- acreditando no contrário.
---------------------------------------------------------------------------
create or replace function public.fc_validar_ciclo_anonimo()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if new.anonymous is distinct from old.anonymous
     and exists (select 1 from public.submissions s where s.application_id = new.id) then
    raise exception 'Este ciclo já tem respostas: o anonimato não pode ser ligado nem desligado agora.';
  end if;
  return new;
end;
$$;

-- O PostgreSQL concede `execute` a `public` por padrão e `anon` herda de
-- `public`: função `security definer` criada sem revoke nasce chamável por quem
-- nem se autenticou. Vale também para função de gatilho.
revoke all on function public.fc_validar_ciclo_anonimo() from public, anon, authenticated;

drop trigger if exists tba_aplicacao_anonima on public.survey_applications;
drop function if exists public.fc_bloquear_aplicacao_anonima();

create trigger tba_ciclo_anonimo
  before update on public.survey_applications
  for each row execute function public.fc_validar_ciclo_anonimo();

---------------------------------------------------------------------------
-- Início/retomada: sem identidade na submissão quando o ciclo é anônimo.
---------------------------------------------------------------------------
create or replace function public.start_or_resume_my_survey_submission(target_application_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_person uuid := public.current_person_id();
  v_app public.survey_applications%rowtype;
  v_part public.application_participants%rowtype;
  v_sub public.submissions%rowtype;
  v_answers jsonb := '{}'::jsonb;
  v_edit boolean := false;
begin
  if v_person is null then raise exception 'Cadastro institucional não identificado.'; end if;
  select * into v_app from public.survey_applications where code = btrim(target_application_code) limit 1;
  if v_app.id is null then raise exception 'Aplicação não encontrada.'; end if;
  if not public.can_access_application(v_app.id) then raise exception 'Seu cadastro não está autorizado para esta pesquisa.'; end if;

  select * into v_part from public.application_participants
  where application_id = v_app.id and person_id = v_person and participant_role = 'RESPONDENT'
    and status not in ('BLOCKED','EXCLUDED')
  order by created_at desc limit 1;

  if v_part.id is null and v_app.access_mode = 'INSTITUTIONAL' then
    insert into public.application_participants(application_id, person_id, participant_role, status, access_profile, metadata)
    values (v_app.id, v_person, 'RESPONDENT', 'ELIGIBLE', 'USUARIO_INSTITUCIONAL', jsonb_build_object('origin','INSTITUTIONAL_ACCESS'))
    on conflict (application_id, person_id, participant_role) do update
      set status = case when public.application_participants.status in ('BLOCKED','EXCLUDED')
                        then public.application_participants.status else 'ELIGIBLE' end,
          updated_at = timezone('utc', now())
    returning * into v_part;
  end if;
  if v_part.id is null and not public.can_manage_surveys() then raise exception 'Seu cadastro não está elegível para esta pesquisa.'; end if;

  if v_app.anonymous then
    -- A submissão nunca recebe a identidade; quem sabe de quem é o rascunho é o
    -- bilhete, e só enquanto ele existir.
    select s.* into v_sub
    from public.submissions s
    join public.tb_bilhete_anonimo b on b.sq_submissao = s.id
    where b.sq_aplicacao = v_app.id and b.sq_pessoa = v_person
    limit 1;

    -- Sem bilhete e com participação concluída, a pessoa já enviou: não há
    -- rascunho a retomar e um novo seria resposta em dobro.
    if v_sub.id is null and v_part.status = 'COMPLETED' then
      return jsonb_build_object(
        'status', 'ALREADY_SUBMITTED', 'applicationStatus', v_app.status,
        'anonymous', true, 'canEdit', false, 'submission', null, 'answers', '{}'::jsonb
      );
    end if;

    if v_sub.id is null and public.application_accepts_responses(v_app.id) then
      insert into public.submissions(application_id, participant_id, respondent_person_id, subject_person_id, submission_type, status, metadata)
      values (v_app.id, null, null, null, 'RESPONSE', 'DRAFT', jsonb_build_object('origin','PLATFORM_WEB_ANONYMOUS'))
      returning * into v_sub;

      insert into public.tb_bilhete_anonimo (sq_aplicacao, sq_pessoa, sq_submissao)
      values (v_app.id, v_person, v_sub.id);

      update public.application_participants
      set status = 'IN_PROGRESS', started_at = coalesce(started_at, timezone('utc', now())), updated_at = timezone('utc', now())
      where id = v_part.id and status in ('ELIGIBLE','INVITED');
    end if;
  else
    select * into v_sub from public.submissions
    where application_id = v_app.id and respondent_person_id = v_person and subject_person_id = v_person
      and submission_type in ('RESPONSE','AUTO') and status in ('DRAFT','SUBMITTED','VALIDATED')
    order by version desc, created_at desc limit 1;

    if v_sub.id is null and public.application_accepts_responses(v_app.id) then
      if v_part.id is null then raise exception 'Inclua seu cadastro como participante antes de responder.'; end if;
      insert into public.submissions(application_id, participant_id, respondent_person_id, subject_person_id, submission_type, status, metadata)
      values (v_app.id, v_part.id, v_person, v_person, 'RESPONSE', 'DRAFT', jsonb_build_object('origin','PLATFORM_WEB_GENERIC'))
      returning * into v_sub;
      update public.application_participants
      set status = 'IN_PROGRESS', started_at = coalesce(started_at, timezone('utc', now())), updated_at = timezone('utc', now())
      where id = v_part.id and status in ('ELIGIBLE','INVITED');
    end if;
  end if;

  if v_sub.id is not null then
    select coalesce(jsonb_object_agg(a.question_id::text, jsonb_build_object(
      'answerText', a.answer_text, 'answerNumber', a.answer_number, 'answerBoolean', a.answer_boolean,
      'answerDate', a.answer_date, 'answerDatetime', a.answer_datetime, 'answerJson', a.answer_json,
      'optionIds', coalesce(o.ids, '[]'::jsonb))), '{}'::jsonb)
    into v_answers
    from public.answers a
    left join lateral (
      select jsonb_agg(ao.option_id order by ao.position) ids
      from public.answer_options ao where ao.answer_id = a.id
    ) o on true
    where a.submission_id = v_sub.id;
  end if;

  v_edit := v_sub.id is not null and v_sub.status = 'DRAFT' and public.application_accepts_responses(v_app.id);
  return jsonb_build_object(
    'status', case when public.application_accepts_responses(v_app.id) then 'OK' else 'PERIOD_CLOSED' end,
    'applicationStatus', v_app.status,
    'anonymous', v_app.anonymous,
    'canEdit', v_edit,
    'submission', case when v_sub.id is null then null else jsonb_build_object(
      'id', v_sub.id, 'status', v_sub.status, 'startedAt', v_sub.started_at,
      'submittedAt', v_sub.submitted_at, 'updatedAt', v_sub.updated_at) end,
    'answers', v_answers
  );
end $function$;

---------------------------------------------------------------------------
-- Envio: é aqui que o vínculo é destruído.
---------------------------------------------------------------------------
create or replace function public.submit_my_survey_submission(target_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_person_id uuid := public.current_person_id();
  v_submission public.submissions%rowtype;
  v_application public.survey_applications%rowtype;
  v_bilhete public.tb_bilhete_anonimo%rowtype;
  v_participante uuid;
  v_missing integer;
  v_submitted_at timestamptz := now();
begin
  if v_person_id is null then raise exception 'Usuário não identificado.'; end if;
  select * into v_submission from public.submissions where id = target_submission_id for update;
  if v_submission.id is null or v_submission.status <> 'DRAFT' then
    raise exception 'A resposta não está disponível para envio.';
  end if;
  select * into v_application from public.survey_applications where id = v_submission.application_id;

  -- A titularidade vem do bilhete quando o ciclo é anônimo, e da própria
  -- submissão quando não é.
  if v_application.anonymous then
    select * into v_bilhete from public.tb_bilhete_anonimo
    where sq_submissao = v_submission.id and sq_pessoa = v_person_id;
    if v_bilhete.sq_bilhete is null then raise exception 'A resposta não está disponível para envio.'; end if;
    select id into v_participante from public.application_participants
    where application_id = v_application.id and person_id = v_person_id and participant_role = 'RESPONDENT';
  else
    if v_submission.respondent_person_id is distinct from v_person_id then
      raise exception 'A resposta não está disponível para envio.';
    end if;
    v_participante := v_submission.participant_id;
  end if;

  if not public.application_accepts_responses(v_application.id) then
    raise exception 'O período de respostas está encerrado.';
  end if;

  select count(*)::integer into v_missing
  from public.survey_questions q
  where q.survey_version_id = v_application.survey_version_id and q.required
    and public.fc_pergunta_visivel(v_submission.id, q.id)
    and not exists (
      select 1 from public.answers a where a.submission_id = v_submission.id and a.question_id = q.id and (
        (q.question_type in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE') and exists(select 1 from public.answer_options ao where ao.answer_id = a.id))
        or (q.question_type in ('SHORT_TEXT','LONG_TEXT') and nullif(btrim(a.answer_text),'') is not null)
        or (q.question_type in ('INTEGER','DECIMAL') and a.answer_number is not null)
        or (q.question_type = 'BOOLEAN' and a.answer_boolean is not null)
        or (q.question_type = 'DATE' and a.answer_date is not null)
        or (q.question_type = 'DATETIME' and a.answer_datetime is not null)
        or (q.question_type not in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE','SHORT_TEXT','LONG_TEXT','INTEGER','DECIMAL','BOOLEAN','DATE','DATETIME')
            and num_nonnulls(a.answer_text, a.answer_number, a.answer_boolean, a.answer_date, a.answer_datetime, a.answer_json) > 0)
      )
    );
  if v_missing > 0 then raise exception 'Existem % pergunta(s) obrigatória(s) sem resposta.', v_missing; end if;

  update public.submissions
  set status = 'SUBMITTED', submitted_at = v_submitted_at, updated_at = v_submitted_at,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'submitted_from', case when v_application.anonymous then 'PLATFORM_WEB_ANONYMOUS' else 'PLATFORM_WEB_GENERIC' end)
  where id = v_submission.id;

  update public.application_participants
  set status = 'COMPLETED', completed_at = v_submitted_at, updated_at = v_submitted_at
  where id = v_participante;

  if v_application.anonymous then
    -- Os três atos que tornam o anonimato estrutural, nesta ordem.
    --
    -- 1. O bilhete é apagado: era a única linha ligando pessoa e submissão.
    delete from public.tb_bilhete_anonimo where sq_bilhete = v_bilhete.sq_bilhete;

    -- 2. A auditoria registra o envio **sem ator e sem a submissão**. Gravar
    --    `actor_person_id` com o id da submissão refaria o vínculo dentro da
    --    própria trilha de auditoria — seria anonimato desfeito pelo registro
    --    de que houve anonimato.
    insert into public.audit_events(actor_person_id, event_type, entity_type, entity_id, application_id, after_data, metadata)
    values (null, 'ANONYMOUS_SUBMISSION_SUBMITTED', 'APPLICATION', v_application.id::text, v_application.id,
            jsonb_build_object('status','SUBMITTED'), jsonb_build_object('anonymous', true));
  else
    insert into public.audit_events(actor_person_id, event_type, entity_type, entity_id, application_id, after_data, metadata)
    values (v_person_id, 'SURVEY_SUBMISSION_SUBMITTED', 'SUBMISSION', v_submission.id::text, v_submission.application_id,
            jsonb_build_object('status','SUBMITTED'), '{}'::jsonb);
  end if;

  return jsonb_build_object('status','OK','submissionStatus','SUBMITTED','submittedAt',v_submitted_at,'anonymous',v_application.anonymous);
end $function$;

revoke all on function public.start_or_resume_my_survey_submission(text) from public, anon;
grant execute on function public.start_or_resume_my_survey_submission(text) to authenticated;
revoke all on function public.submit_my_survey_submission(uuid) from public, anon;
grant execute on function public.submit_my_survey_submission(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Rollback: exige restaurar as duas RPCs às definições anteriores e recriar o
-- gatilho de bloqueio. O bilhete pode ser removido junto.
-- begin;
--   drop table if exists public.tb_bilhete_anonimo cascade;
--   drop trigger if exists tba_ciclo_anonimo on public.survey_applications;
--   drop function if exists public.fc_validar_ciclo_anonimo();
--   alter table public.survey_applications drop column if exists nu_limiar_anonimato;
-- commit;
