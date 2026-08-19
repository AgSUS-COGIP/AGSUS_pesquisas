begin;

-- Notificação por e-mail aos participantes de um ciclo.
--
-- A administração passa a poder marcar, nas propriedades do ciclo, "Enviar
-- e-mails aos participantes". Com a opção ligada existem dois disparos:
--
--   · research_opened        — quando o ciclo abre, um e-mail por participante;
--   · research_expiring_24h  — nas 24 horas finais antes do encerramento.
--
-- O envio em si acontece fora do banco (rota de tarefa da aplicação, chamada
-- por cron), mas TODA a decisão de quem recebe o quê mora aqui, seguindo a
-- regra do projeto: a lógica de negócio vive no PostgreSQL.
--
-- Idempotência é estrutural, não convenção: `tl_email_participante` tem chave
-- única (aplicação, pessoa, tipo). O despacho é claim-first — a linha nasce
-- PROCESSANDO via `insert … on conflict do nothing`, o envio acontece depois,
-- e o desfecho é gravado (ENVIADO ou FALHOU). Rodar o processamento duas vezes
-- não duplica: o segundo insert não acha vaga e a linha ENVIADO não volta.
-- FALHOU volta de propósito, enquanto a janela do tipo continuar válida — é o
-- que permite reenviar após um erro transitório ou após a correção do e-mail
-- da pessoa, sem nenhuma intervenção manual.

---------------------------------------------------------------------------
-- Opção do ciclo: enviar e-mails aos participantes.
---------------------------------------------------------------------------
alter table public.survey_applications
  add column if not exists st_notificacao_email boolean not null default false;

comment on column public.survey_applications.st_notificacao_email is
  'Quando verdadeiro, os participantes do ciclo recebem e-mail na abertura e outro nas 24 horas finais. O controle de envios fica em tl_email_participante.';

---------------------------------------------------------------------------
-- Log de envios: uma linha por (aplicação, pessoa, tipo).
--
-- A unicidade é a garantia de "no máximo um e-mail por combinação". A tabela
-- fica trancada: sem grant para anon/authenticated e sem política — quem lê e
-- escreve são as funções security definer e a rota de tarefa (service role).
---------------------------------------------------------------------------
create table if not exists public.tl_email_participante (
  sq_email uuid primary key default gen_random_uuid(),
  sq_aplicacao uuid not null,
  sq_pessoa uuid not null,
  tp_email text not null,
  st_envio text not null default 'PROCESSANDO',
  ds_erro text,
  dt_envio timestamptz,
  dt_criacao timestamptz not null default timezone('utc', now()),
  dt_atualizacao timestamptz not null default timezone('utc', now()),
  constraint fk_email_participante_aplic foreign key (sq_aplicacao) references public.survey_applications (id) on delete cascade,
  constraint fk_email_participante_pessoa foreign key (sq_pessoa) references public.people (id) on delete cascade,
  constraint uk_email_participante unique (sq_aplicacao, sq_pessoa, tp_email),
  constraint ck_email_participante_tipo check (tp_email in ('research_opened', 'research_expiring_24h')),
  constraint ck_email_participante_envio check (st_envio in ('PROCESSANDO', 'ENVIADO', 'FALHOU'))
);

comment on table public.tl_email_participante is
  'Controle de e-mails enviados aos participantes de um ciclo. A chave única (aplicação, pessoa, tipo) é o que impede envio em dobro quando o processamento roda mais de uma vez.';

create index if not exists in_email_participante_situacao
  on public.tl_email_participante (st_envio, sq_aplicacao);

alter table public.tl_email_participante enable row level security;
revoke all on table public.tl_email_participante from public, anon, authenticated;

---------------------------------------------------------------------------
-- Liga/desliga a notificação do ciclo. Chamada pela tela de propriedades.
--
-- Resolve pesquisa → última versão → último ciclo, como manage_survey_cycle,
-- e audita a mudança. Ligar não dispara nada por si: o despacho decide quem
-- recebe na próxima execução, sempre contra o estado atual do ciclo.
---------------------------------------------------------------------------
create or replace function public.fc_definir_notificacao_email(
  target_survey_id uuid,
  target_enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor uuid := public.current_person_id();
  v_application public.survey_applications%rowtype;
  v_before boolean;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração.';
  end if;

  if target_enabled is null then
    raise exception 'Informe se a notificação deve ficar ligada ou desligada.';
  end if;

  select a.*
  into v_application
  from public.survey_applications a
  join public.survey_versions v on v.id = a.survey_version_id
  where v.survey_id = target_survey_id
  order by v.version_number desc, a.created_at desc
  limit 1;

  if v_application.id is null then
    raise exception 'O ciclo de aplicação ainda não foi criado.';
  end if;

  v_before := v_application.st_notificacao_email;

  update public.survey_applications
  set st_notificacao_email = target_enabled,
      updated_at = timezone('utc', now())
  where id = v_application.id;

  if v_before is distinct from target_enabled then
    insert into public.audit_events(
      actor_person_id, event_type, entity_type, entity_id, application_id,
      before_data, after_data, metadata
    )
    values (
      v_actor,
      'SURVEY_EMAIL_NOTIFICATIONS_SET',
      'SURVEY_APPLICATION',
      v_application.id::text,
      v_application.id,
      jsonb_build_object('emailNotifications', v_before),
      jsonb_build_object('emailNotifications', target_enabled),
      jsonb_build_object('surveyId', target_survey_id)
    );
  end if;

  return jsonb_build_object(
    'status', 'OK',
    'applicationId', v_application.id,
    'emailNotifications', target_enabled
  );
end;
$$;

revoke all on function public.fc_definir_notificacao_email(uuid, boolean) from public, anon;
grant execute on function public.fc_definir_notificacao_email(uuid, boolean) to authenticated;

---------------------------------------------------------------------------
-- Reivindica os e-mails pendentes e devolve o payload de envio.
--
-- Chamada apenas pela rota de tarefa (service role): EXECUTE revogado de
-- anon e authenticated. O retorno é um array jsonb — cada item traz o
-- identificador do registro de controle e os dados necessários para montar
-- a mensagem, sem que a rota precise consultar tabela alguma.
--
-- Quem recebe, por tipo (as três condições dos participantes valem para os
-- dois): vínculo não bloqueado nem excluído, pessoa ativa, e-mail com forma
-- válida. Participante que já concluiu não recebe nenhum dos dois — o
-- convite para responder não faz sentido para quem já respondeu.
--
--   · research_opened        — ciclo OPEN com encerramento nulo ou futuro;
--   · research_expiring_24h  — ciclo OPEN com encerramento nas próximas 24 h.
--
-- A janela tem tolerância deliberada: o cron pode rodar a qualquer momento
-- dentro dela (uma execução diária ainda cai dentro de qualquer janela de
-- 24 horas). Ciclo que encerrou sem nenhuma execução dentro da janela não
-- dispara depois — lembrete de prazo vencido seria pior que silêncio.
---------------------------------------------------------------------------
create or replace function public.fc_reivindicar_emails()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_result jsonb;
begin
  -- Restrita ao processamento interno. A guarda fica no corpo — e não só no
  -- grant — porque o gate de contratos de RPC exige EXECUTE de authenticated
  -- em toda chamada presente no código; aqui, como em toda RPC do projeto, a
  -- barreira real é a validação interna. `auth.role()` nulo é sessão direta
  -- de banco (testes, manutenção), que já tem privilégio total.
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  -- Materializa aberturas agendadas cuja data chegou: sem isto, um ciclo
  -- SCHEDULED que ninguém abriu no navegador nunca dispararia o e-mail.
  perform public.fc_abrir_ciclos_agendados();

  -- Rearma os envios que falharam e cuja janela continua válida. As mesmas
  -- condições do claim valem aqui: pessoa que saiu do ciclo, foi bloqueada
  -- ou concluiu entre a falha e o reprocessamento não volta para a fila.
  update public.tl_email_participante t
  set st_envio = 'PROCESSANDO',
      ds_erro = null,
      dt_atualizacao = timezone('utc', now())
  from public.survey_applications a,
       public.application_participants ap,
       public.people p
  where a.id = t.sq_aplicacao
    and ap.application_id = t.sq_aplicacao
    and ap.person_id = t.sq_pessoa
    and p.id = t.sq_pessoa
    and t.st_envio = 'FALHOU'
    and a.st_notificacao_email
    and a.status = 'OPEN'
    and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
    and p.active
    and p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    and (
      (t.tp_email = 'research_opened'
        and (a.closes_at is null or a.closes_at > now()))
      or
      (t.tp_email = 'research_expiring_24h'
        and a.closes_at is not null
        and a.closes_at > now()
        and a.closes_at <= now() + interval '24 hours')
    );

  -- Reivindica as combinações ainda sem registro. O `on conflict do nothing`
  -- contra a chave única é a idempotência: reprocessar não cria segunda vaga.
  insert into public.tl_email_participante (sq_aplicacao, sq_pessoa, tp_email)
  select a.id, p.id, e.tp_email
  from public.survey_applications a
  join public.application_participants ap on ap.application_id = a.id
  join public.people p on p.id = ap.person_id
  cross join lateral (values ('research_opened'), ('research_expiring_24h')) as e(tp_email)
  where a.st_notificacao_email
    and a.status = 'OPEN'
    and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
    and p.active
    and p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    and (
      (e.tp_email = 'research_opened'
        and (a.closes_at is null or a.closes_at > now()))
      or
      (e.tp_email = 'research_expiring_24h'
        and a.closes_at is not null
        and a.closes_at > now()
        and a.closes_at <= now() + interval '24 hours')
    )
  on conflict on constraint uk_email_participante do nothing;

  -- Devolve tudo que está PROCESSANDO e continua elegível. Linhas órfãs de
  -- uma execução que morreu entre o claim e o envio voltam aqui — é a
  -- recuperação de falha; a checagem de elegibilidade impede que uma pessoa
  -- retirada do ciclo nesse meio-tempo receba a mensagem.
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.sq_email,
    'applicationId', t.sq_aplicacao,
    'personId', t.sq_pessoa,
    'kind', t.tp_email,
    'personName', p.full_name,
    'personEmail', p.institutional_email,
    'applicationName', a.name,
    'applicationCode', a.code,
    'surveyCode', s.code,
    'closesAt', a.closes_at
  )), '[]'::jsonb)
  into v_result
  from public.tl_email_participante t
  join public.survey_applications a on a.id = t.sq_aplicacao
  join public.survey_versions sv on sv.id = a.survey_version_id
  join public.surveys s on s.id = sv.survey_id
  join public.application_participants ap on ap.application_id = t.sq_aplicacao and ap.person_id = t.sq_pessoa
  join public.people p on p.id = t.sq_pessoa
  where t.st_envio = 'PROCESSANDO'
    and a.st_notificacao_email
    and a.status = 'OPEN'
    and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
    and p.active
    and p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    and (
      (t.tp_email = 'research_opened'
        and (a.closes_at is null or a.closes_at > now()))
      or
      (t.tp_email = 'research_expiring_24h'
        and a.closes_at is not null
        and a.closes_at > now()
        and a.closes_at <= now() + interval '24 hours')
    );

  return v_result;
end;
$$;

revoke all on function public.fc_reivindicar_emails() from public, anon;
grant execute on function public.fc_reivindicar_emails() to authenticated, service_role;

---------------------------------------------------------------------------
-- Registra o desfecho de um envio. Também restrita ao service role.
---------------------------------------------------------------------------
create or replace function public.fc_concluir_email_participante(
  target_email_id uuid,
  target_success boolean,
  target_error text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  -- Mesma guarda de fc_reivindicar_emails: EXECUTE de authenticated existe
  -- pelo gate de contratos, mas só o processamento interno passa daqui.
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  update public.tl_email_participante
  set st_envio = case when target_success then 'ENVIADO' else 'FALHOU' end,
      dt_envio = case when target_success then timezone('utc', now()) else dt_envio end,
      ds_erro = case when target_success then null else left(coalesce(target_error, 'Falha não detalhada.'), 500) end,
      dt_atualizacao = timezone('utc', now())
  where sq_email = target_email_id;
end;
$$;

revoke all on function public.fc_concluir_email_participante(uuid, boolean, text) from public, anon;
grant execute on function public.fc_concluir_email_participante(uuid, boolean, text) to authenticated, service_role;

---------------------------------------------------------------------------
-- `get_survey_operations` passa a devolver o estado da opção, para a tela de
-- propriedades exibir o checkbox já carregado. Redefinição da função legada
-- consumida pelo nome por bundles publicados — mesma política das demais
-- entradas de LEGACY_RESTORED_OBJECTS; a única mudança é o campo
-- `emailNotifications` no bloco `application`.
---------------------------------------------------------------------------
create or replace function public.get_survey_operations(target_survey_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_survey public.surveys%rowtype;
  v_version public.survey_versions%rowtype;
  v_application public.survey_applications%rowtype;
  v_sections integer := 0;
  v_questions integer := 0;
  v_required integer := 0;
  v_participants integer := 0;
  v_drafts integer := 0;
  v_submitted integer := 0;
  v_integrity jsonb;
  v_issues jsonb := '[]'::jsonb;
  v_ready_to_publish boolean := false;
  v_ready_to_open boolean := false;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração.';
  end if;

  perform public.fc_abrir_ciclos_agendados();

  select *
  into v_survey
  from public.surveys
  where id = target_survey_id;

  if v_survey.id is null then
    raise exception 'Pesquisa não encontrada.';
  end if;

  select *
  into v_version
  from public.survey_versions
  where survey_id = target_survey_id
  order by version_number desc
  limit 1;

  if v_version.id is null then
    raise exception 'Versão da pesquisa não encontrada.';
  end if;

  select *
  into v_application
  from public.survey_applications
  where survey_version_id = v_version.id
  order by created_at desc
  limit 1;

  v_integrity := public.validate_survey_version_integrity(v_version.id);
  v_issues := coalesce(v_integrity -> 'issues', '[]'::jsonb);

  select count(*)::integer
  into v_sections
  from public.survey_sections
  where survey_version_id = v_version.id;

  select
    count(*)::integer,
    count(*) filter (where required)::integer
  into v_questions, v_required
  from public.survey_questions
  where survey_version_id = v_version.id;

  if v_application.id is null then
    v_issues := v_issues || jsonb_build_array(
      jsonb_build_object(
        'id', 'NO_APPLICATION',
        'code', 'NO_APPLICATION',
        'severity', 'BLOCKING',
        'category', 'CYCLE',
        'entityType', 'VERSION',
        'entityId', v_version.id,
        'message', 'Configure um ciclo de aplicação.',
        'action', 'Crie o ciclo antes de publicar a versão.'
      )
    );
  else
    select count(*)::integer
    into v_participants
    from public.application_participants
    where application_id = v_application.id
      and status not in ('BLOCKED', 'EXCLUDED');

    select
      count(*) filter (where status = 'DRAFT')::integer,
      count(*) filter (where status in ('SUBMITTED', 'VALIDATED'))::integer
    into v_drafts, v_submitted
    from public.submissions
    where application_id = v_application.id;

    if v_application.opens_at is null or v_application.closes_at is null then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'NO_PERIOD',
          'code', 'NO_PERIOD',
          'severity', 'BLOCKING',
          'category', 'PERIOD',
          'entityType', 'APPLICATION',
          'entityId', v_application.id,
          'message', 'Defina abertura e encerramento do ciclo.',
          'action', 'Preencha as duas datas e salve o período.'
        )
      );
    elsif v_application.closes_at <= v_application.opens_at then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'INVALID_PERIOD',
          'code', 'INVALID_PERIOD',
          'severity', 'BLOCKING',
          'category', 'PERIOD',
          'entityType', 'APPLICATION',
          'entityId', v_application.id,
          'message', 'O período do ciclo é inválido.',
          'action', 'Defina o encerramento depois da abertura.'
        )
      );
    elsif v_application.status in ('DRAFT', 'SCHEDULED')
      and v_application.closes_at <= now() then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'PERIOD_EXPIRED',
          'code', 'PERIOD_EXPIRED',
          'severity', 'BLOCKING',
          'category', 'PERIOD',
          'entityType', 'APPLICATION',
          'entityId', v_application.id,
          'message', 'O encerramento informado já passou.',
          'action', 'Atualize o período antes de abrir o ciclo.'
        )
      );
    elsif v_application.status = 'OPEN'
      and v_application.closes_at <= now() then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'OPEN_PERIOD_EXPIRED',
          'code', 'OPEN_PERIOD_EXPIRED',
          'severity', 'WARNING',
          'category', 'PERIOD',
          'entityType', 'APPLICATION',
          'entityId', v_application.id,
          'message', 'O prazo terminou, mas o ciclo ainda está aberto.',
          'action', 'Encerre o ciclo para consolidar o período.'
        )
      );
    end if;

    if v_application.status = 'CLOSED' then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'CYCLE_CLOSED',
          'code', 'CYCLE_CLOSED',
          'severity', 'WARNING',
          'category', 'CYCLE',
          'entityType', 'APPLICATION',
          'entityId', v_application.id,
          'message', 'Este ciclo está encerrado.',
          'action', 'Informe um novo período se precisar reabri-lo.'
        )
      );
    end if;

    if v_participants = 0 then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'NO_PARTICIPANTS',
          'code', 'NO_PARTICIPANTS',
          'severity', 'WARNING',
          'category', 'AUDIENCE',
          'entityType', 'APPLICATION',
          'entityId', v_application.id,
          'message', 'Nenhum participante foi vinculado ao ciclo.',
          'action', 'Revise o público antes da abertura.'
        )
      );
    end if;
  end if;

  v_ready_to_publish :=
    (v_integrity ->> 'valid')::boolean
    and v_application.id is not null
    and v_version.status = 'DRAFT';

  v_ready_to_open :=
    (v_integrity ->> 'valid')::boolean
    and v_version.status = 'PUBLISHED'
    and v_application.id is not null
    and v_application.opens_at is not null
    and v_application.closes_at is not null
    and v_application.closes_at > v_application.opens_at
    and v_application.closes_at > now();

  return jsonb_build_object(
    'status', 'OK',
    'survey', jsonb_build_object(
      'id', v_survey.id,
      'code', v_survey.code,
      'name', v_survey.name,
      'status', v_survey.status,
      'description', v_survey.description
    ),
    'version', jsonb_build_object(
      'id', v_version.id,
      'number', v_version.version_number,
      'status', v_version.status
    ),
    'application', case
      when v_application.id is null then null
      else jsonb_build_object(
        'id', v_application.id,
        'code', v_application.code,
        'name', v_application.name,
        'status', v_application.status,
        'opensAt', v_application.opens_at,
        'closesAt', v_application.closes_at,
        'allowDrafts', v_application.allow_drafts,
        'accessMode', v_application.access_mode,
        'emailNotifications', v_application.st_notificacao_email
      )
    end,
    'metrics', jsonb_build_object(
      'sections', v_sections,
      'questions', v_questions,
      'requiredQuestions', v_required,
      'participants', v_participants,
      'draftSubmissions', v_drafts,
      'submittedSubmissions', v_submitted
    ),
    'integrity', v_integrity,
    'issues', v_issues,
    'readyToPublish', v_ready_to_publish,
    'readyToOpen', v_ready_to_open
  );
end;
$$;

commit;

-- Rollback:
-- begin;
--   -- Restaure `get_survey_operations` pela definição de
--   -- 20260814100000_abrir_ciclos_agendados.sql (sem o campo emailNotifications).
--   drop function if exists public.fc_concluir_email_participante(uuid, boolean, text);
--   drop function if exists public.fc_reivindicar_emails();
--   drop function if exists public.fc_definir_notificacao_email(uuid, boolean);
--   drop table if exists public.tl_email_participante;
--   alter table public.survey_applications drop column if exists st_notificacao_email;
-- commit;
