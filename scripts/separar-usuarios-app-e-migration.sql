-- ============================================================================
-- Arquitetura de três roles: app_user, migration_user e postgres
-- ============================================================================
--
-- Separa a credencial única (usr_sip_app) em duas, cada uma com um trabalho:
--
--   migration_user  dona de tudo em `sigav`. É quem roda migrations e DDL
--                   (scripts/aplicar-migrations.mjs). Nasce por RENAME de
--                   usr_sip_app — renomear preserva a posse de todos os
--                   objetos, o dono do banco e, com SCRAM, até a senha.
--   app_user        a credencial de runtime da aplicação (src/lib/db/pool.ts).
--                   Pode conectar, executar as funções de `sigav` e fazer DML
--                   nas tabelas — e nada além disso: não é dona de objeto
--                   algum, não tem CREATE no schema, não altera nem remove
--                   nada. Uma injeção de SQL no runtime para aqui.
--   postgres        administração do servidor, como sempre. Não é tocada.
--
-- Usuários finais NÃO viram role: continuam sendo claims de sessão
-- (`request.jwt.claims`), com perfis geridos pela aplicação em
-- `sigav.person_module_permissions`.
--
-- ----------------------------------------------------------------------------
-- QUEM PODE RODAR: uma conexão com CREATEROLE — na prática `postgres`.
-- ----------------------------------------------------------------------------
-- Rodar como `app_user` falha em "permission denied to create role", e é bom
-- que falhe: o runtime não administra credenciais. No DBeaver isso significa
-- uma conexão separada com o usuário `postgres`, não a conexão da aplicação.
--
-- SQL PURO, DE PROPÓSITO: nenhum comando de psql (`\set`, `\if`, `\echo`,
-- `\gset`). A primeira versão deste arquivo usava, e o DBeaver devolveu
-- `syntax error at or near "\"` — aquelas são instruções do CLIENTE psql, que
-- o servidor nunca vê. Assim o arquivo roda igual no psql, no DBeaver, no
-- pgAdmin ou por qualquer driver.
--
-- USO (psql):
--   docker exec -i agsus-local psql -U postgres -d db_dataware \
--     -v ON_ERROR_STOP=1 < scripts/separar-usuarios-app-e-migration.sql
--
-- USO (DBeaver): abra o arquivo numa conexão do usuário `postgres` e execute o
-- script inteiro (Alt+X / "Execute script"), não statement por statement.
--
-- SENHA DE app_user: o padrão é 'dev_local_only', a convenção descartável do
-- ambiente local. Para outra senha, rode ANTES, na mesma sessão:
--     set script.senha_app = 'a-senha-real';
-- Reexecutar NUNCA troca a senha de uma role que já existe.
--
-- POR QUE AS POLICIES: todas as tabelas de `sigav` têm RLS habilitada sem
-- policy alguma. Isso nunca barrou a aplicação porque a conexão era a DONA
-- (dono ignora RLS sem `force`). `app_user` não é dona — então cada tabela
-- ganha uma policy explícita para ela. O efeito prático é o mesmo acesso de
-- antes; a diferença é que agora ele está escrito, e qualquer outra role
-- continua sem ver linha nenhuma.
--
-- IDEMPOTENTE E RE-EXECUTÁVEL: rode de novo à vontade — em particular DEPOIS DE
-- CADA REPLICAÇÃO (scripts/replicar-banco-local.mjs recria o banco a partir do
-- dump da empresa, que não traz estas policies nem estes grants).
-- ============================================================================

begin;

do $script$
declare
  -- `current_setting(..., true)` devolve NULL em vez de erro quando a variável
  -- não foi definida — é o que permite o padrão sem exigir um `set` antes.
  v_senha_app text := coalesce(
    nullif(current_setting('script.senha_app', true), ''),
    'dev_local_only'
  );
  v_comando text;
  v_tabelas int := 0;
  v_policies int := 0;
  v_posse int := 0;
begin
  -- --------------------------------------------------------------------------
  -- 1. migration_user: rename de usr_sip_app
  -- --------------------------------------------------------------------------
  -- Rename e não CREATE + REASSIGN OWNED: é a mesma role com nome novo, então
  -- posse de tabelas/funções, dono do banco e senha (SCRAM) ficam intactos.
  -- Sessões já abertas como usr_sip_app continuam vivas (a role é a mesma, por
  -- OID); só conexões NOVAS precisam do nome novo.
  if exists (select 1 from pg_roles where rolname = 'usr_sip_app')
     and not exists (select 1 from pg_roles where rolname = 'migration_user') then
    alter role usr_sip_app rename to migration_user;
    raise notice 'usr_sip_app renomeada para migration_user (posse e senha preservadas).';
  elsif exists (select 1 from pg_roles where rolname = 'migration_user') then
    raise notice 'migration_user já existe; rename dispensado.';
  else
    raise exception
      'nem usr_sip_app nem migration_user existem neste cluster — banco inesperado, nada alterado.';
  end if;

  -- Higiene: quem faz DDL não precisa (nem deve) criar roles ou bancos.
  alter role migration_user nosuperuser nocreatedb nocreaterole;

  -- --------------------------------------------------------------------------
  -- 2. app_user: criada do zero, sem posse de nada
  -- --------------------------------------------------------------------------
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    execute format(
      'create role app_user login password %L nosuperuser nocreatedb nocreaterole noinherit',
      v_senha_app
    );
    raise notice 'app_user criada.';
  else
    raise notice 'app_user já existe; senha mantida como está.';
  end if;

  -- --------------------------------------------------------------------------
  -- 3. O que app_user PODE: conectar, usar o schema, executar, DML
  -- --------------------------------------------------------------------------
  execute format('grant connect on database %I to app_user', current_database());
  grant usage on schema sigav to app_user;

  -- Sem TRUNCATE, REFERENCES ou TRIGGER: são operações de estrutura, e
  -- estrutura é trabalho da migration_user.
  grant select, insert, update, delete on all tables in schema sigav to app_user;
  grant usage, select, update on all sequences in schema sigav to app_user;
  grant execute on all functions in schema sigav to app_user;

  -- Objetos criados por migrations FUTURAS (pela migration_user) já nascem
  -- acessíveis ao runtime, sem cada migration precisar repetir os grants.
  alter default privileges for role migration_user in schema sigav
    grant select, insert, update, delete on tables to app_user;
  alter default privileges for role migration_user in schema sigav
    grant usage, select, update on sequences to app_user;
  alter default privileges for role migration_user in schema sigav
    grant execute on functions to app_user;

  -- --------------------------------------------------------------------------
  -- 4. RLS: uma policy explícita por tabela, só para app_user
  -- --------------------------------------------------------------------------
  -- `using (true)` reproduz o acesso que o runtime sempre teve (era o dono).
  -- A porta continua estreita onde importa: quem decide o que cada PESSOA pode
  -- é a aplicação (rpc-permissions.ts + person_module_permissions), e quem não
  -- é app_user nem dona segue sem enxergar linha alguma.
  for v_comando in
    select format(
             'create policy pl_app_user_acesso_total on %I.%I for all to app_user using (true) with check (true)',
             n.nspname, c.relname
           )
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'sigav'
       and c.relkind in ('r', 'p')
       and not exists (
             select 1 from pg_policy p
              where p.polrelid = c.oid and p.polname = 'pl_app_user_acesso_total'
           )
  loop
    execute v_comando;
    v_policies := v_policies + 1;
  end loop;

  select count(*) into v_tabelas
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'sigav' and c.relkind in ('r', 'p');

  raise notice '% policy(ies) criada(s) nesta execução; % tabela(s) cobertas no total.',
    v_policies, v_tabelas;

  -- --------------------------------------------------------------------------
  -- 5. O que app_user NÃO pode — verificado, não presumido
  -- --------------------------------------------------------------------------
  if pg_catalog.has_schema_privilege('app_user', 'sigav', 'create') then
    raise exception 'app_user ganhou CREATE no schema sigav — não deveria; investigar.';
  end if;

  select count(*) into v_posse from (
    select 1 from pg_class c where c.relowner = 'app_user'::regrole
    union all
    select 1 from pg_proc p where p.proowner = 'app_user'::regrole
  ) posse;

  if v_posse <> 0 then
    raise exception 'app_user é dona de % objeto(s) — não deveria; investigar.', v_posse;
  end if;

  raise notice 'Pronto. Runtime = app_user; DDL = migration_user; servidor = postgres.';
  raise notice 'Lembre: .env.local (USERNAME_DATABASE_URL=app_user, MIGRATION_USERNAME_DATABASE_URL=migration_user)';
  raise notice 'e rode este script de novo após cada scripts/replicar-banco-local.mjs.';
end;
$script$;

commit;

-- Relatório final. SQL puro: aparece igual no psql e na grade do DBeaver.
select rolname as role,
       case when rolcanlogin then 'sim' else 'não' end as conecta,
       case rolname
         when 'app_user' then 'runtime da aplicação (src/lib/db/pool.ts)'
         when 'migration_user' then 'migrations e DDL, dona de sigav (scripts/aplicar-migrations.mjs)'
         when 'postgres' then 'manutenção do servidor'
         else 'AVALIAR — fora da arquitetura'
       end as trabalho
  from pg_roles
 where rolname not like 'pg\_%'
 order by rolname;
