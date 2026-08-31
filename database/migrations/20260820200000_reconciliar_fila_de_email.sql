begin;

-- Reconcilia as duas frentes que trabalharam na fila de e-mail em 20/08/2026.
--
-- O que aconteceu
-- Duas frentes mexeram no mesmo assunto no mesmo dia, sem se ver:
--
--   · `20260820153000` criou a máquina de estados (`PENDENTE`), o contador de
--     tentativas com corte em 5, o token de reivindicação e a regra de só
--     mandar o aviso de 24 h a quem já recebeu o de abertura;
--   · `20260820120000`…`20260820180000` criaram o envio dirigido
--     (`manual_reminder`), a leitura administrativa e os textos configuráveis
--     do corpo do e-mail.
--
-- **As duas redefiniram `fc_reivindicar_emails()`.** A segunda entrou por
-- último em produção e sobrescreveu a primeira, deixando `nu_tentativas` órfão
-- — a coluna existia, ninguém a incrementava, e o corte em 5 tentativas nunca
-- disparava. Nada quebrou visivelmente, que é o pior tipo de regressão.
--
-- A decisão
-- A base é a versão de `20260820153000`, que é mais completa na camada de
-- despacho: reivindicação com token, retry com dead-letter e ordenação estável.
-- Sobre ela entram as duas coisas que só a outra frente tinha:
--
--   1. `manual_reminder` na fila — sem exigir `st_notificacao_email` e sem
--      janela de tempo própria, porque quem dispara escolheu o momento;
--   2. o payload de conteúdo — descrição da avaliação e textos institucionais,
--      que é o que faz o e-mail se identificar e explicar como acessar.
--
-- Uma correção obrigatória de compatibilidade
-- A versão de `20260820153000` faz `on conflict on constraint
-- uk_email_participante`, e essa constraint **não existe mais**: virou o índice
-- parcial `in_email_partic_auto_unico`, para que `manual_reminder` possa
-- repetir. Restaurá-la literalmente falharia em tempo de execução. Aqui o
-- conflito é inferido pelo índice parcial.
--
-- O que é removido
-- `fc_reivindicar_emails_lote` e `fc_liberar_emails_travados` deixam de existir:
-- a versão vigente já entrega em lotes de 100 por token e já expira a
-- reivindicação em 15 minutos. Nenhum bundle publicado as chama — nasceram numa
-- branch que nunca foi ao ar —, então removê-las não repete 10/08/2026.

---------------------------------------------------------------------------
-- 1. Reivindicação reconciliada.
---------------------------------------------------------------------------
create or replace function public.fc_reivindicar_emails()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_claim_token uuid := gen_random_uuid();
  v_now timestamptz := timezone('utc', now());
  v_result jsonb;
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  perform public.fc_abrir_ciclos_agendados();

  update public.tl_email_participante
  set st_envio = case when nu_tentativas >= 5 then 'FALHOU' else 'PENDENTE' end,
      co_reivindicacao = null,
      ds_erro = case
        when nu_tentativas >= 5 then 'Limite de tentativas atingido após expiração da reivindicação.'
        else 'A reivindicação anterior expirou antes da confirmação.'
      end,
      dt_atualizacao = v_now
  where st_envio = 'PROCESSANDO'
    and dt_atualizacao < v_now - interval '15 minutes';

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
$$;

revoke all on function public.fc_reivindicar_emails() from public, anon;
grant execute on function public.fc_reivindicar_emails() to authenticated;

comment on function public.fc_reivindicar_emails() is
  'Service role apenas. Entrega até 100 envios por token, com retry limitado a 5 tentativas e reivindicação que expira em 15 minutos. Inclui lembretes dirigidos e o conteúdo configurável do e-mail.';

---------------------------------------------------------------------------
-- 2. Superfície redundante sai de cena.
---------------------------------------------------------------------------
drop function if exists public.fc_reivindicar_emails_lote(integer);
drop function if exists public.fc_liberar_emails_travados();

commit;

-- Rollback:
-- begin;
--   -- Restaurar exige escolher uma das duas versões anteriores de
--   -- fc_reivindicar_emails() (20260820153000 ou 20260820120000), sabendo que
--   -- cada uma perde o que a outra trouxe.
-- commit;
