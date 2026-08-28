begin;

-- A fila de e-mail passa a reconhecer o estado PENDENTE.
--
-- O que foi encontrado em 20/08/2026
-- A tabela `tl_email_participante` **em produção** não é a que o repositório
-- declara. `20260818130000` cria a coluna com default `'PROCESSANDO'` e uma
-- constraint de três estados; o banco real tem default `'PENDENTE'` e aceita
-- quatro (`PENDENTE`, `PROCESSANDO`, `ENVIADO`, `FALHOU`). A diferença chegou
-- por SQL aplicado direto, sem migration — exatamente o modo de divergir que
-- `database/README.md` já documenta, e que aqui produziu um defeito silencioso.
--
-- Por que isso quebrava o envio dirigido
-- `fc_agendar_envio_manual` insere sem informar `st_envio`, então a linha nasce
-- com o default do banco: `PENDENTE`. Só que a reivindicação procurava
-- `st_envio = 'PROCESSANDO'`. Resultado: o lembrete entrava na fila, nada o
-- pegava, e **nada acusava** — o despacho respondia "0 enviados" como se não
-- houvesse trabalho, e a linha ficava parada para sempre.
--
-- A decisão: adotar o estado, não removê-lo
-- Reverter o banco para três estados seria desfazer, sem combinar, uma mudança
-- que alguém aplicou de propósito — e o estado extra **melhora** o desenho:
-- separa "está na fila, ninguém tentou" de "alguém reivindicou e não terminou".
-- Essa distinção é o que torna a recuperação de falha precisa, em vez de
-- reenviar tudo que estiver em voo.
--
-- Com isso o claim-first passa a ser literal: a reivindicação **move**
-- `PENDENTE → PROCESSANDO` e devolve o que moveu, mais o `PROCESSANDO` órfão de
-- uma execução que morreu no meio. Antes o "claim" era só o insert.
--
-- Esta migration alinha o repositório ao banco: declara os quatro estados e o
-- default `PENDENTE` de forma idempotente, para que um ambiente novo nasça
-- igual à produção em vez de repetir a divergência.

---------------------------------------------------------------------------
-- 1. Alinhar a tabela ao que produção já tem.
---------------------------------------------------------------------------
alter table public.tl_email_participante
  alter column st_envio set default 'PENDENTE';

alter table public.tl_email_participante
  drop constraint if exists ck_email_participante_envio;
alter table public.tl_email_participante
  add constraint ck_email_participante_envio
  check (st_envio in ('PENDENTE', 'PROCESSANDO', 'ENVIADO', 'FALHOU'));

comment on column public.tl_email_participante.st_envio is
  'PENDENTE (na fila, ninguém tentou) → PROCESSANDO (reivindicado) → ENVIADO ou FALHOU. FALHOU volta à fila enquanto a janela do tipo continuar válida.';

---------------------------------------------------------------------------
-- 2. Reivindicação: mover PENDENTE para PROCESSANDO e devolver o lote.
---------------------------------------------------------------------------
create or replace function public.fc_reivindicar_emails_lote(p_limite integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_result jsonb;
  v_limite integer := greatest(1, least(coalesce(p_limite, 100), 500));
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  perform public.fc_abrir_ciclos_agendados();

  -- Rearma falhas cuja janela continua válida. Pessoa que saiu do ciclo, foi
  -- bloqueada ou concluiu entre a falha e o reprocessamento não volta.
  update public.tl_email_participante t
  set st_envio = 'PENDENTE',
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
    and a.status = 'OPEN'
    and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
    and p.active
    and p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    and (
      t.tp_email = 'manual_reminder'
      or (
        a.st_notificacao_email
        and (
          (t.tp_email = 'research_opened' and (a.closes_at is null or a.closes_at > now()))
          or (t.tp_email = 'research_expiring_24h'
              and a.closes_at is not null
              and a.closes_at > now()
              and a.closes_at <= now() + interval '24 hours')
        )
      )
    );

  -- Enfileira os automáticos que faltam. Nascem PENDENTE, como os manuais.
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
      (e.tp_email = 'research_opened' and (a.closes_at is null or a.closes_at > now()))
      or (e.tp_email = 'research_expiring_24h'
          and a.closes_at is not null
          and a.closes_at > now()
          and a.closes_at <= now() + interval '24 hours')
    )
  on conflict (sq_aplicacao, sq_pessoa, tp_email)
    where tp_email in ('research_opened', 'research_expiring_24h')
  do nothing;

  -- O claim de verdade: move PENDENTE elegível para PROCESSANDO, no limite do
  -- lote, e devolve exatamente o que moveu.
  --
  -- `for update skip locked` é o que torna seguro rodar dois despachos ao mesmo
  -- tempo — a interface chamando em laço e o cron acordando no meio. Sem ele,
  -- os dois selecionariam as mesmas linhas e a pessoa receberia em dobro.
  with alvo as (
    select t.sq_email
    from public.tl_email_participante t
    join public.survey_applications a on a.id = t.sq_aplicacao
    join public.application_participants ap
      on ap.application_id = t.sq_aplicacao and ap.person_id = t.sq_pessoa
    join public.people p on p.id = t.sq_pessoa
    where t.st_envio = 'PENDENTE'
      and a.status = 'OPEN'
      and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
      and p.active
      and p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      and (
        t.tp_email = 'manual_reminder'
        or (
          a.st_notificacao_email
          and (
            (t.tp_email = 'research_opened' and (a.closes_at is null or a.closes_at > now()))
            or (t.tp_email = 'research_expiring_24h'
                and a.closes_at is not null
                and a.closes_at > now()
                and a.closes_at <= now() + interval '24 hours')
          )
        )
      )
    -- Manual primeiro: é ato deliberado de quem está olhando a tela agora.
    order by (t.tp_email = 'manual_reminder') desc, t.dt_criacao
    limit v_limite
    for update of t skip locked
  )
  update public.tl_email_participante t
  set st_envio = 'PROCESSANDO',
      dt_atualizacao = timezone('utc', now())
  from alvo
  where t.sq_email = alvo.sq_email;

  -- Devolve o que está PROCESSANDO: o lote recém-movido mais o órfão de uma
  -- execução que morreu entre o claim e o envio — a recuperação de falha.
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.sq_email,
    'applicationId', f.sq_aplicacao,
    'personId', f.sq_pessoa,
    'kind', f.tp_email,
    'personName', f.full_name,
    'personEmail', f.institutional_email,
    'applicationName', f.name,
    'applicationCode', f.code,
    'surveyCode', f.survey_code,
    'closesAt', f.closes_at,
    'surveyDescription', f.description,
    'organizationName', f.no_organizacao,
    'productName', f.no_produto,
    'emailInstruction', f.tx_instrucao_email,
    'emailFooter', f.tx_rodape_email
  )), '[]'::jsonb)
  into v_result
  from (
    select t.sq_email, t.sq_aplicacao, t.sq_pessoa, t.tp_email,
           p.full_name, p.institutional_email,
           a.name, a.code, a.closes_at,
           s.code as survey_code, s.description,
           cfg.no_organizacao, cfg.no_produto,
           cfg.tx_instrucao_email, cfg.tx_rodape_email
    from public.tl_email_participante t
    join public.survey_applications a on a.id = t.sq_aplicacao
    join public.survey_versions sv on sv.id = a.survey_version_id
    join public.surveys s on s.id = sv.survey_id
    join public.application_participants ap
      on ap.application_id = t.sq_aplicacao and ap.person_id = t.sq_pessoa
    join public.people p on p.id = t.sq_pessoa
    -- LEFT JOIN de propósito: configuração ausente faz o template cair no
    -- padrão do código, e nunca impede o envio.
    left join public.tb_config_plataforma cfg on cfg.co_configuracao = 1
    where t.st_envio = 'PROCESSANDO'
      and a.status = 'OPEN'
      and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
      and p.active
      and p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      and (
        t.tp_email = 'manual_reminder'
        or (
          a.st_notificacao_email
          and (
            (t.tp_email = 'research_opened' and (a.closes_at is null or a.closes_at > now()))
            or (t.tp_email = 'research_expiring_24h'
                and a.closes_at is not null
                and a.closes_at > now()
                and a.closes_at <= now() + interval '24 hours')
          )
        )
      )
    order by (t.tp_email = 'manual_reminder') desc, t.dt_criacao
    limit v_limite
  ) f;

  return v_result;
end;
$$;

revoke all on function public.fc_reivindicar_emails_lote(integer) from public, anon;
grant execute on function public.fc_reivindicar_emails_lote(integer) to authenticated;

---------------------------------------------------------------------------
-- 3. Histórico: o filtro precisa conhecer o quarto estado.
--
-- Sem isto, escolher "Na fila" na tela devolveria erro de situação inválida —
-- e, pior, o resumo escondia o estado que ninguém esperava.
---------------------------------------------------------------------------
create or replace function public.fc_listar_envios_email(
  p_aplicacao uuid default null,
  p_situacao text default 'ALL',
  p_limite integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_result jsonb;
  v_limite integer := greatest(1, least(coalesce(p_limite, 200), 1000));
  v_situacao text := upper(coalesce(nullif(btrim(p_situacao), ''), 'ALL'));
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  if v_situacao not in ('ALL', 'PENDENTE', 'PROCESSANDO', 'ENVIADO', 'FALHOU') then
    raise exception 'Situação inválida. Use ALL, PENDENTE, PROCESSANDO, ENVIADO ou FALHOU.';
  end if;

  select jsonb_build_object(
    'resumo', (
      select coalesce(jsonb_object_agg(x.st_envio, x.total), '{}'::jsonb)
      from (
        select t.st_envio, count(*) as total
        from public.tl_email_participante t
        where p_aplicacao is null or t.sq_aplicacao = p_aplicacao
        group by t.st_envio
      ) x
    ),
    'envios', (
      -- O apelido entre aspas, e não `f.dt_criacao`: é o nome que existe aqui.
      select coalesce(jsonb_agg(to_jsonb(f) order by f."createdAt" desc), '[]'::jsonb)
      from (
        select t.sq_email as id,
               t.tp_email as kind,
               t.st_envio as status,
               t.ds_erro as erro,
               t.dt_criacao as "createdAt",
               t.dt_envio as "sentAt",
               p.full_name as "personName",
               p.institutional_email as "personEmail",
               a.code as "applicationCode",
               a.name as "applicationName"
        from public.tl_email_participante t
        join public.people p on p.id = t.sq_pessoa
        join public.survey_applications a on a.id = t.sq_aplicacao
        where (p_aplicacao is null or t.sq_aplicacao = p_aplicacao)
          and (v_situacao = 'ALL' or t.st_envio = v_situacao)
        order by t.dt_criacao desc
        limit v_limite
      ) f
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.fc_listar_envios_email(uuid, text, integer) from public, anon;
grant execute on function public.fc_listar_envios_email(uuid, text, integer) to authenticated;

---------------------------------------------------------------------------
-- 4. Envio dirigido: o bloqueio do clique duplo cobre os dois estados de fila.
---------------------------------------------------------------------------
create or replace function public.fc_agendar_envio_manual(
  p_aplicacao uuid,
  p_pessoas uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor uuid := public.current_person_id();
  v_application public.survey_applications%rowtype;
  v_pedidas integer := coalesce(array_length(p_pessoas, 1), 0);
  v_enfileiradas integer := 0;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  if p_aplicacao is null then
    raise exception 'Informe o ciclo.';
  end if;

  if v_pedidas = 0 then
    raise exception 'Selecione ao menos uma pessoa.';
  end if;

  -- Teto por disparo: proteção contra o clique acidental que atinge a base
  -- inteira. A cota diária da conta institucional do Google é finita, e
  -- estourá-la derruba também os e-mails de quem realmente precisa receber.
  if v_pedidas > 1500 then
    raise exception 'Selecione no máximo 1500 pessoas por disparo.';
  end if;

  select * into v_application
  from public.survey_applications
  where id = p_aplicacao;

  if v_application.id is null then
    raise exception 'Ciclo não encontrado.';
  end if;

  if v_application.status <> 'OPEN' then
    raise exception 'O ciclo precisa estar aberto para receber envios.';
  end if;

  with elegiveis as (
    select p.id
    from public.people p
    join public.application_participants ap
      on ap.person_id = p.id and ap.application_id = p_aplicacao
    where p.id = any(p_pessoas)
      and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
      and p.active
      and p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      -- Substitui a unicidade que este tipo deixou de ter. Cobre os **dois**
      -- estados de fila: um lembrete ainda não despachado (PENDENTE) ou já
      -- reivindicado (PROCESSANDO) torna o segundo clique um duplicado.
      and not exists (
        select 1 from public.tl_email_participante t
        where t.sq_aplicacao = p_aplicacao
          and t.sq_pessoa = p.id
          and t.tp_email = 'manual_reminder'
          and t.st_envio in ('PENDENTE', 'PROCESSANDO')
      )
  )
  insert into public.tl_email_participante (sq_aplicacao, sq_pessoa, tp_email)
  select p_aplicacao, e.id, 'manual_reminder'
  from elegiveis e;

  get diagnostics v_enfileiradas = row_count;

  insert into public.audit_events(
    actor_person_id, event_type, entity_type, entity_id, application_id,
    before_data, after_data, metadata
  )
  values (
    v_actor, 'EMAIL_MANUAL_QUEUED', 'survey_application', p_aplicacao, p_aplicacao,
    null, null,
    jsonb_build_object('solicitadas', v_pedidas, 'enfileiradas', v_enfileiradas)
  );

  return jsonb_build_object(
    'status', 'OK',
    'solicitadas', v_pedidas,
    'enfileiradas', v_enfileiradas,
    'ignoradas', v_pedidas - v_enfileiradas
  );
end;
$$;

revoke all on function public.fc_agendar_envio_manual(uuid, uuid[]) from public, anon;
grant execute on function public.fc_agendar_envio_manual(uuid, uuid[]) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   -- As definições anteriores estão em 20260820120000 e 20260820140000, mas
--   -- restaurá-las reintroduz o defeito de PENDENTE nunca ser reivindicado.
--   alter table public.tl_email_participante alter column st_envio set default 'PROCESSANDO';
-- commit;
