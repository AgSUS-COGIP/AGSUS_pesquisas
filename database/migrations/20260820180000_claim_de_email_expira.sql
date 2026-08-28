begin;

-- O claim de e-mail passa a expirar.
--
-- O problema
-- `fc_agendar_envio_manual` recusa enfileirar quem já tem lembrete em
-- `PENDENTE` ou `PROCESSANDO` — é o que substitui a unicidade que o tipo manual
-- deixou de ter, e protege do clique duplo. Só que `PROCESSANDO` significa
-- "alguém reivindicou", não "vai sair": se o despacho morre entre o claim e o
-- envio — ou nem chega a rodar, como num ambiente sem `SMTP_APP_PASSWORD` —, a
-- linha fica reivindicada **para sempre**.
--
-- O efeito prático, observado em 20/08/2026: um lembrete reivindicado e não
-- enviado bloqueou toda tentativa seguinte de enfileirar a mesma pessoa, e a
-- tela só sabia dizer "verifique se as pessoas continuam elegíveis". Proteção
-- contra duplicata virou impedimento permanente.
--
-- A correção: lease com prazo
-- É o que a auditoria de 20/08/2026 chamou de "lease/lock temporário". Um claim
-- só vale por 15 minutos. Passado esse tempo sem desfecho gravado, a linha é
-- considerada abandonada e volta a ser reivindicável — e deixa de bloquear um
-- envio novo.
--
-- Por que 15 minutos: um lote é curto por construção (40 mensagens, orçamento
-- de 20 s), então nenhum claim honesto chega perto disso. O prazo é folgado o
-- bastante para nunca competir com um despacho em curso, e curto o bastante
-- para que uma falha não prenda a fila até alguém perceber.
--
-- `dt_atualizacao` é o relógio do lease: `fc_reivindicar_emails_lote` já o
-- atualiza ao mover para `PROCESSANDO`.

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
      -- Bloqueia o clique duplo sem bloquear para sempre.
      --
      -- PENDENTE sempre impede: o lembrete está na fila e vai sair.
      -- PROCESSANDO só impede enquanto o lease vale — passados 15 minutos sem
      -- desfecho, o claim é tratado como abandonado, e insistir é legítimo.
      and not exists (
        select 1 from public.tl_email_participante t
        where t.sq_aplicacao = p_aplicacao
          and t.sq_pessoa = p.id
          and t.tp_email = 'manual_reminder'
          and (
            t.st_envio = 'PENDENTE'
            or (t.st_envio = 'PROCESSANDO'
                and t.dt_atualizacao > timezone('utc', now()) - interval '15 minutes')
          )
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

---------------------------------------------------------------------------
-- Devolve à fila os claims já abandonados.
--
-- Sem isto, uma linha reivindicada e nunca enviada continua PROCESSANDO até
-- alguém reparar. O `update` roda no início do despacho, junto do rearme de
-- FALHOU, e é a outra metade do lease: expirar não basta se ninguém recolhe.
---------------------------------------------------------------------------
create or replace function public.fc_liberar_emails_travados()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_liberados integer;
begin
  update public.tl_email_participante
  set st_envio = 'PENDENTE',
      dt_atualizacao = timezone('utc', now())
  where st_envio = 'PROCESSANDO'
    and dt_atualizacao <= timezone('utc', now()) - interval '15 minutes';

  get diagnostics v_liberados = row_count;
  return v_liberados;
end;
$$;

-- Sem grant: é chamada de dentro de fc_reivindicar_emails_lote, que executa
-- como dona e dispensa EXECUTE de quem chamou. Mesmo desenho de
-- fc_abrir_ciclos_agendados().
revoke all on function public.fc_liberar_emails_travados() from public, anon, authenticated;

comment on function public.fc_liberar_emails_travados() is
  'Devolve à fila os envios reivindicados há mais de 15 minutos sem desfecho. Chamada pelo despacho.';

---------------------------------------------------------------------------
-- Reivindicação: recolhe os abandonados antes de montar o lote.
--
-- Derivada da definição de 20260820160000, com uma linha a mais. Nada mais
-- do corpo muda, e a assinatura é a mesma.
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

  -- Recolhe claims abandonados antes de reivindicar: linha travada em
  -- PROCESSANDO volta a PENDENTE e deixa de ocupar a fila e a tela.
  perform public.fc_liberar_emails_travados();

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

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_liberar_emails_travados();
--   -- fc_agendar_envio_manual precisa ser restaurada de 20260820160000, mas
--   -- isso reintroduz o bloqueio permanente.
-- commit;
