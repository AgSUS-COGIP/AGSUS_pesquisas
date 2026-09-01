begin;

-- Uma avaliação criada pela tela administrativa é sempre um rascunho. O
-- período informado é planejamento; somente manage_survey_cycle/SCHEDULE pode
-- transformar o ciclo em SCHEDULED, depois que a versão estiver publicada.
create or replace function public.create_survey_draft(
  p_code text,
  p_name text,
  p_description text,
  p_application_name text,
  p_opens_at timestamptz default null,
  p_closes_at timestamptz default null,
  p_anonymous boolean default false,
  p_allow_drafts boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person_id uuid;
  v_survey_id uuid;
  v_version_id uuid;
  v_application_id uuid;
  v_code text;
begin
  if not public.can_manage_surveys() then
    raise exception 'Você não possui permissão para criar pesquisas.';
  end if;

  v_code := upper(regexp_replace(btrim(p_code), '[^A-Za-z0-9_-]+', '-', 'g'));
  if v_code = '' then raise exception 'Informe um código válido.'; end if;
  if btrim(p_name) = '' then raise exception 'Informe o nome da pesquisa.'; end if;
  if p_opens_at is not null and p_opens_at < now() - interval '1 minute' then
    raise exception 'A abertura não pode ser anterior à data e hora atuais.';
  end if;
  if p_closes_at is not null and p_opens_at is not null and p_closes_at <= p_opens_at then
    raise exception 'A data de encerramento deve ser posterior à abertura.';
  end if;
  if p_closes_at is not null and p_opens_at is null and p_closes_at <= now() then
    raise exception 'O encerramento não pode ser anterior à data e hora atuais.';
  end if;

  select id into v_person_id
  from public.people
  where auth_user_id = auth.uid()
  limit 1;

  insert into public.surveys (code, name, description, status, settings, created_by)
  values (v_code, btrim(p_name), nullif(btrim(p_description), ''), 'DRAFT', '{}'::jsonb, v_person_id)
  returning id into v_survey_id;

  insert into public.survey_versions (
    survey_id, version_number, title, description, status, schema_version,
    settings, created_by
  )
  values (
    v_survey_id, 1, btrim(p_name), nullif(btrim(p_description), ''), 'DRAFT',
    1, '{}'::jsonb, v_person_id
  )
  returning id into v_version_id;

  insert into public.survey_applications (
    survey_version_id, code, name, opens_at, closes_at, status,
    allow_drafts, allow_resubmission, anonymous, settings, created_by
  )
  values (
    v_version_id,
    v_code || '-1',
    coalesce(nullif(btrim(p_application_name), ''), btrim(p_name)),
    p_opens_at,
    p_closes_at,
    'DRAFT',
    p_allow_drafts,
    false,
    p_anonymous,
    '{}'::jsonb,
    v_person_id
  )
  returning id into v_application_id;

  insert into public.survey_sections (
    survey_version_id, code, title, description, position, settings
  )
  values (
    v_version_id, 'INTRO', 'Introdução', 'Seção inicial da pesquisa.', 1,
    '{}'::jsonb
  );

  return jsonb_build_object(
    'status', 'OK',
    'surveyId', v_survey_id,
    'versionId', v_version_id,
    'applicationId', v_application_id,
    'code', v_code
  );
end;
$$;

revoke all on function public.create_survey_draft(text, text, text, text, timestamptz, timestamptz, boolean, boolean)
  from public, anon;
grant execute on function public.create_survey_draft(text, text, text, text, timestamptz, timestamptz, boolean, boolean)
  to authenticated;

-- Cada execução recebe somente as linhas marcadas com seu token. PROCESSANDO
-- sem confirmação expira depois de quinze minutos e pode ser reivindicado de
-- novo; isso recupera uma função interrompida sem permitir que cron e after()
-- enviem simultaneamente a mesma linha.
alter table public.tl_email_participante
  add column if not exists co_reivindicacao uuid,
  add column if not exists nu_tentativas integer not null default 0;

comment on column public.tl_email_participante.co_reivindicacao is
  'Token da execução que detém temporariamente o envio.';
comment on column public.tl_email_participante.nu_tentativas is
  'Quantidade de vezes em que o envio foi reivindicado.';

alter table public.tl_email_participante
  alter column st_envio set default 'PENDENTE';

alter table public.tl_email_participante
  drop constraint if exists ck_email_participante_envio;
alter table public.tl_email_participante
  add constraint ck_email_participante_envio
  check (st_envio in ('PENDENTE', 'PROCESSANDO', 'ENVIADO', 'FALHOU'));

create index if not exists in_email_participante_fila
  on public.tl_email_participante (st_envio, dt_atualizacao);

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
  on conflict on constraint uk_email_participante do nothing;

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
      and a.st_notificacao_email
      and a.status = 'OPEN'
      and t.nu_tentativas < 5
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
    'closesAt', a.closes_at
  ) order by t.dt_criacao, t.sq_email), '[]'::jsonb)
  into v_result
  from public.tl_email_participante t
  join public.survey_applications a on a.id = t.sq_aplicacao
  join public.survey_versions sv on sv.id = a.survey_version_id
  join public.surveys s on s.id = sv.survey_id
  join public.people p on p.id = t.sq_pessoa
  where t.st_envio = 'PROCESSANDO'
    and t.co_reivindicacao = v_claim_token;

  return v_result;
end;
$$;

revoke all on function public.fc_reivindicar_emails() from public, anon;
grant execute on function public.fc_reivindicar_emails() to authenticated, service_role;

create or replace function public.fc_concluir_email_participante(
  target_email_id uuid,
  target_claim_token uuid,
  target_success boolean,
  target_error text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  update public.tl_email_participante
  set st_envio = case when target_success then 'ENVIADO' else 'FALHOU' end,
      dt_envio = case when target_success then timezone('utc', now()) else dt_envio end,
      ds_erro = case
        when target_success then null
        else left(coalesce(target_error, 'Falha não detalhada.'), 500)
      end,
      co_reivindicacao = null,
      dt_atualizacao = timezone('utc', now())
  where sq_email = target_email_id
    and st_envio = 'PROCESSANDO'
    and co_reivindicacao = target_claim_token;

  if not found then
    raise exception 'A reivindicação deste e-mail não está mais vigente.';
  end if;
end;
$$;

revoke all on function public.fc_concluir_email_participante(uuid, uuid, boolean, text)
  from public, anon;
grant execute on function public.fc_concluir_email_participante(uuid, uuid, boolean, text)
  to authenticated, service_role;

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_concluir_email_participante(uuid, uuid, boolean, text);
--   drop index if exists public.in_email_participante_fila;
--   alter table public.tl_email_participante
--     drop column if exists co_reivindicacao,
--     drop column if exists nu_tentativas;
--   -- Reaplique as definições de create_survey_draft,
--   -- fc_reivindicar_emails e a constraint ck_email_participante_envio da
--   -- migration 20260818130000 antes de usar o banco revertido.
-- commit;
