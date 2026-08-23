-- Hardening complementar da auditoria de 2026-08-23.
--
-- 1. adiciona um contador durável para rate limiting de rotas públicas;
-- 2. reduz a ACL das RPCs exclusivas do worker de e-mail;
-- 3. mantém toda a superfície nova fora do alcance de anon/authenticated.

create table if not exists public.tb_limite_requisicao_publica (
  no_escopo varchar(80) not null,
  co_chave char(64) not null,
  dt_janela timestamptz not null,
  nu_requisicoes integer not null default 1,
  dt_atualizacao timestamptz not null default timezone('utc', now()),
  constraint pk_limite_requisicao_publica primary key (no_escopo, co_chave, dt_janela),
  constraint ck_limite_req_publica_contagem check (nu_requisicoes > 0)
);

create index if not exists in_limite_req_publica_janela
  on public.tb_limite_requisicao_publica (dt_janela);

alter table public.tb_limite_requisicao_publica enable row level security;

revoke all on table public.tb_limite_requisicao_publica from public, anon, authenticated;
grant select, insert, update, delete on table public.tb_limite_requisicao_publica to service_role;

create or replace function public.fc_srv_consumir_limite_publico(
  target_scope text,
  target_key_hash text,
  target_limit integer,
  target_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
  v_retry_after integer;
begin
  if target_scope is null or btrim(target_scope) = '' or length(target_scope) > 80 then
    raise exception 'Escopo de rate limit inválido.';
  end if;

  if target_key_hash is null or target_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Chave de rate limit inválida.';
  end if;

  if target_limit is null or target_limit < 1 or target_limit > 10000 then
    raise exception 'Limite de requisições inválido.';
  end if;

  if target_window_seconds is null or target_window_seconds < 1 or target_window_seconds > 86400 then
    raise exception 'Janela de rate limit inválida.';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / target_window_seconds) * target_window_seconds
  );

  insert into public.tb_limite_requisicao_publica (
    no_escopo,
    co_chave,
    dt_janela,
    nu_requisicoes,
    dt_atualizacao
  ) values (
    btrim(target_scope),
    target_key_hash,
    v_window_start,
    1,
    v_now
  )
  on conflict (no_escopo, co_chave, dt_janela)
  do update set
    nu_requisicoes = public.tb_limite_requisicao_publica.nu_requisicoes + 1,
    dt_atualizacao = excluded.dt_atualizacao
  returning nu_requisicoes into v_count;

  -- Limpeza probabilística evita crescimento indefinido sem executar DELETE em
  -- toda requisição pública. O índice por janela mantém a coleta barata.
  if random() < 0.02 then
    delete from public.tb_limite_requisicao_publica
    where dt_janela < v_now - interval '2 days';
  end if;

  v_retry_after := greatest(
    1,
    ceil(extract(epoch from (
      (v_window_start + make_interval(secs => target_window_seconds)) - v_now
    )))::integer
  );

  return jsonb_build_object(
    'allowed', v_count <= target_limit,
    'remaining', greatest(target_limit - v_count, 0),
    'retryAfter', v_retry_after
  );
end;
$function$;

revoke all on function public.fc_srv_consumir_limite_publico(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.fc_srv_consumir_limite_publico(text, text, integer, integer)
  to service_role;

-- As três RPCs abaixo são contratos internos de processamento de e-mail. A
-- guarda em runtime permanece como defesa em profundidade, mas a ACL agora
-- impede que uma sessão autenticada sequer invoque a função.
revoke execute on function public.fc_reivindicar_emails()
  from public, anon, authenticated;
grant execute on function public.fc_reivindicar_emails()
  to service_role;

revoke execute on function public.fc_concluir_email_participante(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.fc_concluir_email_participante(uuid, boolean, text)
  to service_role;

revoke execute on function public.fc_concluir_email_participante(uuid, uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.fc_concluir_email_participante(uuid, uuid, boolean, text)
  to service_role;

-- Contratos explícitos do backend. O prefixo fc_srv_* identifica para o gate de
-- RPC que estas entradas devem ser chamáveis por service_role, não por usuários
-- autenticados. As funções de domínio permanecem separadas e com sua própria
-- guarda, evitando conceder EXECUTE a authenticated só para satisfazer tooling.
create or replace function public.fc_srv_reivindicar_emails()
returns jsonb
language sql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
  select public.fc_reivindicar_emails();
$function$;

revoke all on function public.fc_srv_reivindicar_emails()
  from public, anon, authenticated;
grant execute on function public.fc_srv_reivindicar_emails()
  to service_role;

create or replace function public.fc_srv_concluir_email(
  target_email_id uuid,
  target_success boolean,
  target_error text default null
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
begin
  perform public.fc_concluir_email_participante(
    target_email_id,
    target_success,
    target_error
  );
end;
$function$;

revoke all on function public.fc_srv_concluir_email(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.fc_srv_concluir_email(uuid, boolean, text)
  to service_role;

create or replace function public.fc_srv_concluir_email(
  target_email_id uuid,
  target_claim_token uuid,
  target_success boolean,
  target_error text default null
)
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
begin
  perform public.fc_concluir_email_participante(
    target_email_id,
    target_claim_token,
    target_success,
    target_error
  );
end;
$function$;

revoke all on function public.fc_srv_concluir_email(uuid, uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function public.fc_srv_concluir_email(uuid, uuid, boolean, text)
  to service_role;

notify pgrst, 'reload schema';
