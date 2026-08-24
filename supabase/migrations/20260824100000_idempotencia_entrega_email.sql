begin;

-- Item 3 — reduzir o reenvio na janela de entrega ambígua.
--
-- A janela
-- SMTP aceita a mensagem → a confirmação no banco não chega (queda da função,
-- timeout, rede) → o lease de 15 minutos vence → a linha volta para PENDENTE →
-- **a pessoa recebe o mesmo e-mail de novo**.
--
-- Nenhum número de estados fecha essa janela. O instante entre "o servidor de
-- e-mail aceitou" e "o banco registrou" existe sempre, e um crash ali é
-- indistinguível de um envio que nunca saiu. O que dá para fazer é parar de
-- **presumir** que não saiu.
--
-- Duas peças
--
-- 1. `co_message_id`, gravado **antes** do envio. Sua presença significa "o
--    transporte foi iniciado com este identificador". A expiração do lease
--    passa a distinguir dois casos que antes eram um só:
--
--      com identificador  → entrega ambígua → ENVIADO + aviso para conferência
--      sem identificador  → nunca chegou ao SMTP → PENDENTE (retry legítimo)
--
--    Marcar ENVIADO é a escolha conservadora: reenviar às cegas incomoda quem
--    já recebeu e consome cota; registrar a dúvida deixa a decisão com quem
--    opera, e a mensagem de erro diz exatamente o que conferir.
--
-- 2. O identificador é **determinístico**, derivado do id da linha. Isso vale
--    além do banco: o cabeçalho `Message-ID` viaja na mensagem, e servidores de
--    e-mail costumam descartar duplicata do mesmo identificador. É a única
--    proteção que atua depois que a mensagem saiu daqui.
--
-- O que NÃO muda
-- Falha real de SMTP continua no caminho de antes: sem identificador gravado,
-- a linha volta a PENDENTE e o retry acontece, limitado a 5 tentativas.

---------------------------------------------------------------------------
-- 1. Onde o identificador mora.
---------------------------------------------------------------------------
alter table public.tl_email_participante
  add column if not exists co_message_id text,
  add column if not exists dt_transporte timestamptz;

comment on column public.tl_email_participante.co_message_id is
  'Message-ID determinístico da mensagem, gravado antes do envio. Presente = o transporte foi iniciado; usado para distinguir entrega ambígua de falha antes do SMTP.';
comment on column public.tl_email_participante.dt_transporte is
  'Quando o transporte foi iniciado. Diferente de dt_envio, que marca a confirmação de sucesso.';

-- A reconciliação procura por identificador; o índice é parcial porque a
-- coluna é nula na maioria das linhas.
create index if not exists in_email_partic_msgid
  on public.tl_email_participante (co_message_id)
  where co_message_id is not null;

---------------------------------------------------------------------------
-- 2. Registrar o transporte antes de enviar.
--
-- Chamada imediatamente antes do `sendMail`. Exige o token da reivindicação:
-- sem ele, uma execução concorrente poderia carimbar linha que não reivindicou.
---------------------------------------------------------------------------
create or replace function public.fc_srv_registrar_transporte(
  target_email_id uuid,
  target_claim_token uuid,
  target_message_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_afetadas integer;
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  if target_email_id is null or target_claim_token is null then
    raise exception 'Informe o envio e o token da reivindicação.';
  end if;

  if coalesce(btrim(target_message_id), '') = '' then
    raise exception 'Informe o identificador da mensagem.';
  end if;

  update public.tl_email_participante
  set co_message_id = btrim(target_message_id),
      dt_transporte = timezone('utc', now()),
      dt_atualizacao = timezone('utc', now())
  where sq_email = target_email_id
    and co_reivindicacao = target_claim_token
    and st_envio = 'PROCESSANDO';

  get diagnostics v_afetadas = row_count;

  -- Zero linhas não é erro: o lease pode ter vencido entre reivindicar e
  -- enviar. Quem chamou precisa saber para **não** prosseguir com o envio.
  return jsonb_build_object('status', case when v_afetadas = 1 then 'OK' else 'EXPIRADO' end);
end;
$$;

revoke all on function public.fc_srv_registrar_transporte(uuid, uuid, text) from public, anon, authenticated;

comment on function public.fc_srv_registrar_transporte(uuid, uuid, text) is
  'Service role apenas. Carimba o identificador da mensagem antes do envio. Devolve EXPIRADO quando o lease já venceu — nesse caso o envio deve ser abortado.';

---------------------------------------------------------------------------
-- 3. A expiração do lease passa a reconciliar.
--
-- Corpo extraído do banco por pg_get_functiondef e alterado num ponto só: o
-- `update` de expiração vira dois, separados pela presença do identificador.
-- Nada mais muda — em particular o token de reivindicação, o limite de cinco
-- tentativas e a regra de 24 horas continuam como estão.
---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fc_reivindicar_emails()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_claim_token uuid := gen_random_uuid();
  v_now timestamptz := timezone('utc', now());
  v_result jsonb;
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  perform public.fc_abrir_ciclos_agendados();

  /*
    Reivindicação expirada: reconciliar antes de reenfileirar.

    O caso perigoso é a entrega ambígua — o SMTP aceitou a mensagem e a
    confirmação no banco não chegou (queda da função, timeout, rede). A linha
    fica PROCESSANDO, o lease vence, e a versão anterior devolvia tudo para
    PENDENTE: a pessoa recebia o mesmo e-mail de novo.

    `co_message_id` é gravado **antes** do envio, por
    `fc_srv_registrar_transporte`. Sua presença significa "o transporte foi
    iniciado com este identificador". Quem tem identificador não volta para a
    fila: é marcado ENVIADO e sinalizado para conferência humana, porque
    reenviar às cegas é pior do que registrar a dúvida.

    Quem NÃO tem identificador nunca chegou ao SMTP — esse é o retry legítimo, e
    continua funcionando exatamente como antes.
  */
  update public.tl_email_participante
  set st_envio = 'ENVIADO',
      co_reivindicacao = null,
      ds_erro = 'Entrega ambígua: o transporte foi iniciado e a confirmação não chegou. Conferir na caixa de saída antes de reenviar.',
      dt_envio = coalesce(dt_envio, v_now),
      dt_atualizacao = v_now
  where st_envio = 'PROCESSANDO'
    and dt_atualizacao < v_now - interval '15 minutes'
    and co_message_id is not null;

  update public.tl_email_participante
  set st_envio = case when nu_tentativas >= 5 then 'FALHOU' else 'PENDENTE' end,
      co_reivindicacao = null,
      ds_erro = case
        when nu_tentativas >= 5 then 'Limite de tentativas atingido após expiração da reivindicação.'
        else 'A reivindicação anterior expirou antes da confirmação.'
      end,
      dt_atualizacao = v_now
  where st_envio = 'PROCESSANDO'
    and dt_atualizacao < v_now - interval '15 minutes'
    and co_message_id is null;

  insert into public.tl_email_participante (
    sq_aplicacao, sq_pessoa, tp_email, st_envio
  )
  select a.id, p.id, e.tp_email, 'PENDENTE'
  from public.survey_applications a
  join public.application_participants ap on ap.application_id = a.id
  join public.people p on p.id = ap.person_id
  cross join lateral (
    values ('research_opened'), ('research_expiring_24h')
  ) as e(tp_email)
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
        and a.closes_at <= now() + interval '24 hours'
        and exists (
          select 1
          from public.tl_email_participante abertura
          where abertura.sq_aplicacao = a.id
            and abertura.sq_pessoa = p.id
            and abertura.tp_email = 'research_opened'
            and abertura.st_envio = 'ENVIADO'
            and abertura.dt_envio <= now() - interval '1 hour'
        ))
    )
  on conflict (sq_aplicacao, sq_pessoa, tp_email)
    where tp_email in ('research_opened', 'research_expiring_24h')
  do nothing;

  with candidates as (
    select t.sq_email
    from public.tl_email_participante t
    join public.survey_applications a on a.id = t.sq_aplicacao
    join public.application_participants ap
      on ap.application_id = t.sq_aplicacao
     and ap.person_id = t.sq_pessoa
    join public.people p on p.id = t.sq_pessoa
    where (
        t.st_envio = 'PENDENTE'
        or (
          t.st_envio = 'FALHOU'
          and t.dt_atualizacao <= v_now - interval '5 minutes'
        )
      )
      -- Envio dirigido nao exige o interruptor do ciclo: e ato explicito de
      -- quem opera, e exigi-lo impediria cobrar quem falta num ciclo sem
      -- aviso automatico ligado.
      and (t.tp_email = 'manual_reminder' or a.st_notificacao_email)
      and a.status = 'OPEN'
      and t.nu_tentativas < 5
      and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
      and p.active
      and p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      and (
        -- Sem janela propria: o lembrete dirigido vale enquanto o ciclo estiver
        -- aberto, porque quem o disparou decidiu o momento.
        t.tp_email = 'manual_reminder'
        or
        (t.tp_email = 'research_opened'
          and (a.closes_at is null or a.closes_at > now()))
        or
        (t.tp_email = 'research_expiring_24h'
          and a.closes_at is not null
          and a.closes_at > now()
          and a.closes_at <= now() + interval '24 hours'
          and exists (
            select 1
            from public.tl_email_participante abertura
            where abertura.sq_aplicacao = t.sq_aplicacao
              and abertura.sq_pessoa = t.sq_pessoa
              and abertura.tp_email = 'research_opened'
              and abertura.st_envio = 'ENVIADO'
              and abertura.dt_envio <= now() - interval '1 hour'
          ))
      )
    order by t.dt_criacao, t.sq_email
    for update of t skip locked
    limit 100
  )
  update public.tl_email_participante t
  set st_envio = 'PROCESSANDO',
      co_reivindicacao = v_claim_token,
      nu_tentativas = t.nu_tentativas + 1,
      ds_erro = null,
      dt_atualizacao = v_now
  from candidates c
  where t.sq_email = c.sq_email;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.sq_email,
    'claimToken', t.co_reivindicacao,
    'applicationId', t.sq_aplicacao,
    'personId', t.sq_pessoa,
    'kind', t.tp_email,
    'personName', p.full_name,
    'personEmail', p.institutional_email,
    'applicationName', a.name,
    'applicationCode', a.code,
    'surveyCode', s.code,
    'closesAt', a.closes_at,
    'surveyDescription', s.description,
    'organizationName', cfg.no_organizacao,
    'productName', cfg.no_produto,
    'emailInstruction', cfg.tx_instrucao_email,
    'emailFooter', cfg.tx_rodape_email
  ) order by t.dt_criacao, t.sq_email), '[]'::jsonb)
  into v_result
  from public.tl_email_participante t
  join public.survey_applications a on a.id = t.sq_aplicacao
  join public.survey_versions sv on sv.id = a.survey_version_id
  join public.surveys s on s.id = sv.survey_id
  join public.people p on p.id = t.sq_pessoa
  -- LEFT de proposito: configuracao ausente faz o template cair no padrao do
  -- codigo, e nunca impede o envio.
  left join public.tb_config_plataforma cfg on cfg.co_configuracao = 1
  where t.st_envio = 'PROCESSANDO'
    and t.co_reivindicacao = v_claim_token;

  return v_result;
end;
$function$;

revoke all on function public.fc_reivindicar_emails() from public, anon;
grant execute on function public.fc_reivindicar_emails() to authenticated;

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_srv_registrar_transporte(uuid, uuid, text);
--   drop index if exists public.in_email_partic_msgid;
--   alter table public.tl_email_participante
--     drop column if exists co_message_id,
--     drop column if exists dt_transporte;
--   -- fc_reivindicar_emails precisa voltar à definição anterior, ciente de que
--   -- isso reintroduz o reenvio na janela de entrega ambígua.
-- commit;
