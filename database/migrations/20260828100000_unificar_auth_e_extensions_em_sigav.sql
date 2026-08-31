begin;

-- ============================================================================
-- Unificação final: auth e extensions absorvidos por sigav
-- ============================================================================
--
-- Fecha o que 20260827170000 (private/db_governanca/"DB_PESQUISAS") e
-- 20260827180000 (public) começaram: o banco desta aplicação passa a ter um
-- único schema. A exigência é institucional — o padrão de nomenclatura AgSUS
-- prevê um schema por aplicação (`DB_SIGLAAPLICACAO`), não um conjunto deles.
--
-- O QUE MUDOU DESDE QUE ESSES SCHEMAS EXISTIAM. `auth` era do GoTrue: um
-- serviço externo, dono das tabelas, que a aplicação não podia tocar. Isso
-- acabou em duas etapas. A conexão virou direta (`usr_sip_app` em db_dataware,
-- sem PostgREST), e o login usa Auth.js,
-- que resolve identidade por `fc_srv_resolver_identidade_oauth` — uma função
-- desta aplicação, que escreve nas tabelas que antes só o GoTrue escrevia. Sem
-- serviço dono, `auth` deixou de ser fronteira e virou apenas um schema com
-- duas tabelas vivas e vinte e uma mortas.
--
-- ---------------------------------------------------------------------------
-- O que entra em sigav, e com que nome
-- ---------------------------------------------------------------------------
--   auth.users      → sigav.tb_usuario_identidade   (29 linhas; alvo de FK de
--                     sigav.people e sigav.tb_arquivo)
--   auth.identities → sigav.tb_identidade_oauth     (30 linhas; lida por
--                     sync_my_google_avatar e pelo resolvedor OAuth)
--   auth.uid()      → sigav.fc_uid_sessao()
--   auth.role()     → sigav.fc_papel_sessao()
--   auth.jwt()      → sigav.fc_claims_sessao()
--
-- `auth.email()` não é recriada: nenhuma função a chama. As três que ficam são
-- wrappers de `current_setting('request.jwt.claims')` — não tocam tabela
-- alguma. Quem popula esse ajuste é o adaptador de RPC
-- (`src/lib/db/rpc-adapter.ts`), a cada transação; era o PostgREST que fazia
-- isso antes, e o contrato de claims não muda aqui.
--
-- As duas tabelas sobreviventes não usam nenhum tipo declarado em `auth` —
-- todas as colunas são de `pg_catalog` — então a transferência é um
-- `set schema` limpo, sem migrar enum junto. As colunas geradas
-- (`identities.email`, `users.confirmed_at`) acompanham.
--
-- ---------------------------------------------------------------------------
-- O que é removido, e por que é seguro
-- ---------------------------------------------------------------------------
-- As outras 21 tabelas de `auth` são estado de sessão do GoTrue: `sessions` e
-- `refresh_tokens` (sessão que o Auth.js não usa — ele emite JWT em cookie),
-- `flow_state`, `one_time_tokens`, `mfa_*`, `saml_*`, `sso_*`, `oauth_*`,
-- `webauthn_*`, `instances`, `schema_migrations` e `audit_log_entries`. Nenhuma
-- tem leitor nesta aplicação, e nenhuma tem escritor agora que o GoTrue não
-- roda contra este banco. Vão embora com os 32 enums que só elas usavam.
--
-- Isto é irreversível: leva junto o histórico de login do GoTrue em
-- `audit_log_entries`. O backup prévio, que o procedimento do projeto já manda
-- confirmar antes de qualquer migration, é o que cobre esse risco.
--
-- ---------------------------------------------------------------------------
-- extensions: dependência removida, não realocada
-- ---------------------------------------------------------------------------
-- O único uso de pgcrypto nesta aplicação é `digest(token, 'sha256')`, em três
-- funções de sessão anônima. O PostgreSQL tem `sha256(bytea)` embutido em
-- `pg_catalog` desde a versão 11, e `encode(sha256(convert_to(t,'UTF8')),'hex')`
-- produz exatamente o mesmo hash que `encode(digest(t,'sha256'),'hex')` —
-- verificado antes de escrever isto, o que significa que nenhum token já
-- gravado deixa de casar.
--
-- Por isso a extensão é dispensada em vez de movida: trazer pgcrypto para
-- dentro de `sigav` cumpriria a regra de "um schema só", mas ao custo de 36
-- funções (`crypt`, `pgp_*`, `gen_salt`…) que ninguém chama e que não seguem a
-- nomenclatura institucional. `gen_random_uuid()` não depende dela: é nativa em
-- `pg_catalog` desde a versão 13, e é de lá que os defaults já resolvem.
--
-- A remoção de pgcrypto e do schema `extensions` é CONDICIONAL, ao contrário do
-- resto. Em db_dataware a instância é compartilhada (schemas `sip`, `sigepsi`),
-- e em stack PostgreSQL local `extensions` abriga outras extensões da
-- infraestrutura. A migration só remove o que ninguém mais referencia, e avisa
-- quando decide não remover.

-- ---------------------------------------------------------------------------
-- 1. Trocar pgcrypto pelo sha256 nativo nas três funções que o usam
-- ---------------------------------------------------------------------------

do $etapa1$
declare
  v_funcao record;
  v_definicao text;
  v_restantes bigint;
begin
  for v_funcao in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'sigav'
       and p.prosrc like '%extensions.digest%'
     order by p.proname
  loop
    v_definicao := pg_get_functiondef(v_funcao.oid);
    -- Os argumentos nas três chamadas são identificadores simples, sem vírgula,
    -- o que torna a captura não-ambígua.
    v_definicao := regexp_replace(
      v_definicao,
      'extensions\.digest\(([^,()]+), ''sha256''\)',
      'pg_catalog.sha256(pg_catalog.convert_to(\1, ''UTF8''))',
      'g'
    );
    execute v_definicao;
  end loop;

  select count(*)
    into v_restantes
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'sigav'
     and p.prosrc like '%extensions.%';

  if v_restantes <> 0 then
    raise exception 'ainda há % função(ões) de sigav citando extensions.; a substituição não cobriu todos os casos.', v_restantes;
  end if;
end;
$etapa1$;

-- ---------------------------------------------------------------------------
-- 2. Funções de claims da sessão, agora em sigav
-- ---------------------------------------------------------------------------
--
-- Mesma leitura que as de `auth` faziam, inclusive o par de ajustes
-- (`request.jwt.claim.x` antes de `request.jwt.claims`) que o PostgREST
-- populava e que o adaptador de RPC reproduz. `search_path` fixo em
-- `pg_catalog` porque nada aqui resolve objeto da aplicação.

create or replace function sigav.fc_uid_sessao()
returns uuid
language sql
stable
set search_path = pg_catalog
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$$;

create or replace function sigav.fc_papel_sessao()
returns text
language sql
stable
set search_path = pg_catalog
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text;
$$;

create or replace function sigav.fc_claims_sessao()
returns jsonb
language sql
stable
set search_path = pg_catalog
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb;
$$;

comment on function sigav.fc_uid_sessao() is
  'Identificador da sessão autenticada (claim sub). Sucede auth.uid().';
comment on function sigav.fc_papel_sessao() is
  'Papel lógico da sessão (anon/authenticated/service_role). Sucede auth.role().';
comment on function sigav.fc_claims_sessao() is
  'Conjunto de claims da sessão. Sucede auth.jwt().';

-- ---------------------------------------------------------------------------
-- 3. Tabelas de identidade, transferidas e renomeadas
-- ---------------------------------------------------------------------------

do $etapa3$
begin
  if to_regclass('auth.users') is not null then
    alter table auth.users set schema sigav;
    alter table sigav.users rename to tb_usuario_identidade;

    alter table sigav.tb_usuario_identidade
      rename constraint users_pkey to pk_tb_usuario_identidade;
    alter table sigav.tb_usuario_identidade
      rename constraint users_phone_key to uk_tb_usuario_identidade_telefone;
    alter table sigav.tb_usuario_identidade
      rename constraint users_email_change_confirm_status_check
                     to ck_tb_usuario_identidade_status_email;
  end if;

  if to_regclass('auth.identities') is not null then
    alter table auth.identities set schema sigav;
    alter table sigav.identities rename to tb_identidade_oauth;

    alter table sigav.tb_identidade_oauth
      rename constraint identities_pkey to pk_tb_identidade_oauth;
    alter table sigav.tb_identidade_oauth
      rename constraint identities_provider_id_provider_unique
                     to uk_tb_identidade_oauth_provedor;
    alter table sigav.tb_identidade_oauth
      rename constraint identities_user_id_fkey
                     to fk_tb_usuario_identidade_tb_identidade_oauth;
  end if;
end;
$etapa3$;

comment on table sigav.tb_usuario_identidade is
  'Contas de acesso. Herdada de auth.users (GoTrue) e hoje mantida por fc_srv_resolver_identidade_oauth, sob Auth.js. Alvo da FK de people.auth_user_id.';
comment on table sigav.tb_identidade_oauth is
  'Vínculo entre uma conta e o provedor OAuth que a autenticou. Herdada de auth.identities; identity_data guarda a foto lida por sync_my_google_avatar.';

-- As duas já chegam com RLS habilitada, o que preserva o invariante de sigav
-- ("nenhuma tabela do schema sem RLS"). Como no restante do schema, ela não é a
-- barreira efetiva — a aplicação conecta como dono, e quem autoriza são as
-- funções `security definer` mais a lista de src/lib/db/rpc-permissions.ts.
alter table sigav.tb_usuario_identidade enable row level security;
alter table sigav.tb_identidade_oauth enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Recompilar as funções que citavam auth
-- ---------------------------------------------------------------------------
--
-- Mesmo mecanismo de 20260826180000: `set schema` preserva dependências de
-- catálogo, mas corpo e search_path de função são texto e não se atualizam
-- sozinhos. Recompilar por `pg_get_functiondef` mantém OID, dono e ACL.
--
-- A ordem importa: as etapas 2 e 3 vieram antes porque função em linguagem SQL
-- é validada na criação — recriar um corpo que cite `sigav.fc_uid_sessao()` ou
-- `sigav.tb_identidade_oauth` antes de eles existirem falharia.

do $etapa4$
declare
  v_funcao record;
  v_definicao text;
  v_restantes bigint;
begin
  for v_funcao in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'sigav'
       and p.prosrc like '%auth.%'
     order by p.proname, pg_get_function_identity_arguments(p.oid)
  loop
    v_definicao := pg_get_functiondef(v_funcao.oid);
    v_definicao := replace(v_definicao, 'auth.uid()', 'sigav.fc_uid_sessao()');
    v_definicao := replace(v_definicao, 'auth.role()', 'sigav.fc_papel_sessao()');
    v_definicao := replace(v_definicao, 'auth.jwt()', 'sigav.fc_claims_sessao()');
    v_definicao := replace(v_definicao, 'auth.users', 'sigav.tb_usuario_identidade');
    v_definicao := replace(v_definicao, 'auth.identities', 'sigav.tb_identidade_oauth');
    execute v_definicao;
  end loop;

  -- O search_path é uniforme no schema inteiro (`pg_catalog, sigav, auth`), e
  -- sai por ALTER em vez de por substituição de texto na definição: assim a
  -- mudança é explícita e não depende de como o Postgres renderizou a lista.
  for v_funcao in
    select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as argumentos
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'sigav'
       and array_to_string(p.proconfig, ',') like '%auth%'
     order by p.proname
  loop
    execute format(
      'alter function sigav.%I(%s) set search_path = pg_catalog, sigav',
      v_funcao.proname,
      v_funcao.argumentos
    );
  end loop;

  select count(*)
    into v_restantes
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'sigav'
     and (p.prosrc like '%auth.%' or array_to_string(p.proconfig, ',') like '%auth%');

  if v_restantes <> 0 then
    raise exception 'ainda há % função(ões) de sigav vinculada(s) a auth após a recompilação.', v_restantes;
  end if;
end;
$etapa4$;

-- ---------------------------------------------------------------------------
-- 5. Remover o que restou de auth
-- ---------------------------------------------------------------------------

do $etapa5$
declare
  v_referencias bigint;
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    raise notice 'schema auth já não existe; nada a remover.';
    return;
  end if;

  -- A instância é compartilhada: a varredura cobre TODO schema que não seja de
  -- catálogo, não só sigav. Se outra aplicação depender de auth, a migration
  -- falha inteira e a decisão volta para uma pessoa — melhor do que remover o
  -- schema por baixo de um sistema de terceiros.
  select
    (select count(*)
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname not in ('pg_catalog', 'information_schema', 'auth')
        and n.nspname not like 'pg\_%'
        and (p.prosrc like '%auth.%' or array_to_string(p.proconfig, ',') like '%auth%'))
    + (select count(*)
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname not in ('pg_catalog', 'information_schema', 'auth')
          and n.nspname not like 'pg\_%'
          and c.relkind in ('v', 'm')
          and pg_get_viewdef(c.oid, true) like '%auth.%')
    + (select count(*)
         from pg_constraint con
         join pg_class c on c.oid = con.conrelid
         join pg_namespace n on n.oid = c.relnamespace
         join pg_class tgt on tgt.oid = con.confrelid
         join pg_namespace nt on nt.oid = tgt.relnamespace
        where con.contype = 'f' and nt.nspname = 'auth' and n.nspname <> 'auth')
    + (select count(*)
         from pg_attribute a
         join pg_class c on c.oid = a.attrelid
         join pg_namespace n on n.oid = c.relnamespace
         join pg_type t on t.oid = a.atttypid
         join pg_namespace tn on tn.oid = t.typnamespace
        where tn.nspname = 'auth' and n.nspname <> 'auth'
          and a.attnum > 0 and not a.attisdropped)
    + (select count(*)
         from pg_policy p
        where coalesce(pg_get_expr(p.polqual, p.polrelid), '')
              || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') like '%auth.%')
    into v_referencias;

  if v_referencias <> 0 then
    raise exception 'ainda existem % referência(s) a auth fora do próprio schema; a remoção foi interrompida.', v_referencias;
  end if;

  -- CASCADE é o certo aqui, e só porque a asserção acima já provou que nada
  -- fora de `auth` depende dele: o que o cascade alcança são as tabelas mortas
  -- do GoTrue, seus enums e suas sequências, que é exatamente o alvo.
  drop schema auth cascade;
  raise notice 'schema auth removido (tabelas mortas do GoTrue, enums e sequências).';
end;
$etapa5$;

-- ---------------------------------------------------------------------------
-- 6. pgcrypto e o schema extensions, se ninguém mais os usar
-- ---------------------------------------------------------------------------

do $etapa6$
declare
  v_referencias bigint;
  v_restantes bigint;
begin
  if not exists (select 1 from pg_namespace where nspname = 'extensions') then
    raise notice 'schema extensions já não existe; nada a fazer.';
    return;
  end if;

  select
    (select count(*)
       from pg_proc p
       join pg_namespace n on n.oid = p.pronamespace
      where n.nspname not in ('pg_catalog', 'information_schema', 'extensions')
        and n.nspname not like 'pg\_%'
        and (p.prosrc like '%extensions.%' or array_to_string(p.proconfig, ',') like '%extensions%'))
    + (select count(*)
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname not in ('pg_catalog', 'information_schema', 'extensions')
          and n.nspname not like 'pg\_%'
          and c.relkind in ('v', 'm')
          and pg_get_viewdef(c.oid, true) like '%extensions.%')
    + (select count(*)
         from pg_attrdef d
        where pg_get_expr(d.adbin, d.adrelid) like '%extensions.%')
    + (select count(*)
         from pg_index i
        where pg_get_indexdef(i.indexrelid) like '%extensions.%')
    + (select count(*)
         from pg_constraint c
        where pg_get_constraintdef(c.oid, true) like '%extensions.%')
    into v_referencias;

  if v_referencias <> 0 then
    raise notice 'extensions ainda é referenciado por % objeto(s) de outro schema; mantido.', v_referencias;
    return;
  end if;

  if exists (select 1 from pg_extension where extname = 'pgcrypto') then
    begin
      drop extension pgcrypto;
      raise notice 'extensão pgcrypto removida (substituída por sha256 nativo).';
    exception
      when dependent_objects_still_exist then
        raise notice 'pgcrypto tem dependentes; extensão e schema mantidos.';
        return;
      when insufficient_privilege then
        raise notice 'sem privilégio para remover pgcrypto; extensão e schema mantidos.';
        return;
    end;
  end if;

  select
    (select count(*) from pg_extension where extnamespace = 'extensions'::regnamespace)
    + (select count(*)
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'extensions')
    + (select count(*)
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'extensions')
    into v_restantes;

  if v_restantes <> 0 then
    raise notice 'schema extensions ainda abriga % objeto(s) de infraestrutura; mantido.', v_restantes;
    return;
  end if;

  begin
    drop schema extensions restrict;
    raise notice 'schema extensions removido.';
  exception
    when insufficient_privilege then
      raise notice 'sem privilégio para remover o schema extensions; mantido.';
    when dependent_objects_still_exist then
      raise notice 'schema extensions ganhou dependente durante a migration; mantido.';
  end;
end;
$etapa6$;

-- ---------------------------------------------------------------------------
-- 7. Validação de fechamento
-- ---------------------------------------------------------------------------

do $etapa7$
declare
  v_quantidade bigint;
begin
  if exists (select 1 from pg_namespace where nspname = 'auth') then
    raise exception 'o schema auth continua existindo ao final da migration.';
  end if;

  select count(*)
    into v_quantidade
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'sigav'
     and (
       p.prosrc like '%auth.%'
       or p.prosrc like '%extensions.%'
       or array_to_string(p.proconfig, ',') like '%auth%'
     );

  if v_quantidade <> 0 then
    raise exception 'restaram % função(ões) de sigav referenciando auth ou extensions.', v_quantidade;
  end if;

  if to_regclass('sigav.tb_usuario_identidade') is null
     or to_regclass('sigav.tb_identidade_oauth') is null then
    raise exception 'as tabelas de identidade não chegaram a sigav.';
  end if;

  -- As FKs seguem por OID, mas conferir é barato e o custo de descobrir tarde
  -- que o vínculo de pessoa com conta se perdeu seria alto.
  select count(*)
    into v_quantidade
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_class tgt on tgt.oid = con.confrelid
    join pg_namespace nt on nt.oid = tgt.relnamespace
   where con.contype = 'f'
     and nt.nspname = 'sigav'
     and tgt.relname = 'tb_usuario_identidade'
     and src.relname in ('people', 'tb_arquivo');

  if v_quantidade <> 2 then
    raise exception 'esperava 2 FKs apontando para tb_usuario_identidade, encontrei %.', v_quantidade;
  end if;

  select count(*)
    into v_quantidade
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'sigav'
     and c.relkind in ('r', 'p')
     and not c.relrowsecurity;

  if v_quantidade <> 0 then
    raise exception 'a validação final encontrou % tabela(s) de sigav sem RLS.', v_quantidade;
  end if;
end;
$etapa7$;

commit;

-- Rollback:
-- Não há caminho automático: a etapa 5 remove definitivamente as tabelas de
-- sessão do GoTrue e seus enums, e nenhuma migration os reconstrói. Voltar
-- atrás significa restaurar o backup anterior à aplicação.
--
-- O que É reversível, caso só se queira desfazer a mudança de nomes sem
-- recuperar o GoTrue:
-- begin;
--   create schema auth;
--   alter table sigav.tb_usuario_identidade set schema auth;
--   alter table auth.tb_usuario_identidade rename to users;
--   alter table sigav.tb_identidade_oauth set schema auth;
--   alter table auth.tb_identidade_oauth rename to identities;
--   -- Recriar auth.uid()/role()/jwt() com os corpos da etapa 2, recompilar as
--   -- funções de sigav trocando sigav.fc_*_sessao() de volta e devolver `auth`
--   -- ao final de cada search_path.
-- commit;
