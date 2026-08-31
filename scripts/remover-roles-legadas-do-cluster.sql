-- ============================================================================
-- Remoção das roles legadas do CLUSTER — passo de superusuário
-- ============================================================================
--
-- Complemento de database/migrations/20260828140000_remover_roles_legadas_do_cluster.sql.
-- A migration faz o que cabe à aplicação: retira, no banco dela, todo
-- privilégio das roles do contrato PostgREST/GoTrue. O que ela não pode fazer é
-- `DROP ROLE`, que exige CREATEROLE — privilégio que `usr_sip_app` não tem no
-- db_dataware, instância compartilhada com sip e sigepsi.
--
-- Este arquivo é script de OPERAÇÃO, não migration versionada: mesma categoria
-- de scripts/bootstrap-db-dataware-usuario-unico.sql e
-- scripts/manutencao-pre-pico.sql. Não entra em database/migrations/ nem em
-- sigav.tb_migracao.
--
-- USO — por padrão não altera nada, só relata:
--
--   docker exec -i agsus-local psql -U postgres -d db_dataware \
--     < scripts/remover-roles-legadas-do-cluster.sql
--
-- Para aplicar de verdade:
--
--   docker exec -i agsus-local psql -U postgres -d db_dataware -v aplicar=1 \
--     -v ON_ERROR_STOP=1 < scripts/remover-roles-legadas-do-cluster.sql
--
-- No db_dataware da empresa, quem roda é o DBA (com a conexão dele, não a da
-- aplicação), e vale rodar o relatório primeiro.
--
-- ROLE É OBJETO DE CLUSTER, PRIVILÉGIO É DE BANCO. É por isso que este script
-- precisa ser rodado uma vez POR BANCO em que a role ainda tenha privilégio:
-- `DROP OWNED BY` só alcança o banco da conexão corrente. O relatório da seção
-- 1 lê `pg_shdepend` (catálogo compartilhado) e diz exatamente quais bancos
-- ainda seguram cada role — de qualquer conexão, sem precisar visitá-los.
--
-- O QUE NUNCA É TOCADO: `usr_sip_app` (credencial da aplicação), `postgres`
-- (superusuário de bootstrap; não é removível nem deve ser), as roles `pg_*`
-- (predefinidas do PostgreSQL) e o pseudo-papel PUBLIC.

\set ON_ERROR_STOP on
\if :{?aplicar}
\else
  \set aplicar 0
\endif

-- ----------------------------------------------------------------------------
-- 1. Relatório: o que existe e o que segura cada role
-- ----------------------------------------------------------------------------

\echo ''
\echo '== Roles do cluster, por veredito =='

select case
         when rolname in ('usr_sip_app', 'app_user', 'migration_user')
           then '1. manter — credencial da aplicação (única na empresa; app/migration no local)'
         when rolsuper then '2. manter — superusuário da instância'
         when rolname like 'pg\_%' then '3. manter — predefinida do PostgreSQL'
         when rolname in (
           'anon', 'authenticated', 'service_role', 'authenticator',
           'dashboard_user', 'pgbouncer', 'supabase_admin',
           'supabase_auth_admin', 'supabase_read_only_user',
           'supabase_storage_admin'
         ) then '4. remover — legado PostgREST/GoTrue'
         else '5. AVALIAR — não prevista por este script'
       end as veredito,
       count(*) as quantidade,
       string_agg(rolname, ', ' order by rolname) as roles
  from pg_roles
 group by 1
 order by 1;

\echo ''
\echo '== O que ainda segura cada role legada, por banco =='
\echo '(vazio = nada segura; pode ser removida desta conexão)'

select r.rolname                        as role,
       coalesce(d.datname, '(compartilhado)') as banco,
       -- `deptype` é do tipo "char" (1 byte). Sem o cast para text, o CASE
       -- resolve o tipo do resultado como "char" e trunca cada rótulo à
       -- primeira letra — 'privilégio em ACL' saía como 'p'.
       case s.deptype::text
         when 'a' then 'privilégio em ACL'
         when 'o' then 'É DONA de objeto'
         when 'r' then 'citada em policy de RLS'
         when 'i' then 'privilégio inicial de extensão'
         when 't' then 'tablespace'
         else s.deptype::text
       end                              as vinculo,
       count(*)                         as ocorrencias,
       case
         when d.datname is null or d.datname = current_database()
           then 'esta execução resolve'
         else 'rode este script conectado a ' || d.datname
       end                              as acao
  from pg_shdepend s
  join pg_roles r on r.oid = s.refobjid
  left join pg_database d on d.oid = s.dbid
 where r.rolname in (
         'anon', 'authenticated', 'service_role', 'authenticator',
         'dashboard_user', 'pgbouncer', 'supabase_admin',
         'supabase_auth_admin', 'supabase_read_only_user',
         'supabase_storage_admin'
       )
 group by 1, 2, 3, 5
 order by 1, 2, 3;

\if :aplicar
\else
  \echo ''
  \echo '-- MODO RELATÓRIO: nada foi alterado.'
  \echo '-- Para aplicar, rode de novo com  -v aplicar=1'
  \echo ''
\endif

\if :aplicar

-- ----------------------------------------------------------------------------
-- 2. Remoção
-- ----------------------------------------------------------------------------
-- Transação única: num cluster compartilhado, meia remoção é pior que nenhuma.

begin;

do $script$
declare
  c_legadas constant text[] := array[
    'anon',
    'authenticated',
    'service_role',
    'authenticator',
    'dashboard_user',
    'pgbouncer',
    'supabase_admin',
    'supabase_auth_admin',
    'supabase_read_only_user',
    'supabase_storage_admin'
  ];
  v_role text;
  v_oid_role oid;
  v_objetos bigint;
  v_bancos text;
  v_removidas int := 0;
  v_mantidas text[] := array[]::text[];
begin
  foreach v_role in array c_legadas loop
    if not exists (select 1 from pg_roles where rolname = v_role) then
      continue;
    end if;

    v_oid_role := v_role::regrole::oid;

    -- Posse é linha vermelha, igual na migration: `DROP OWNED BY` apaga o
    -- objeto de quem é dono, não só o privilégio. Se a role possui algo, este
    -- script não decide sozinho.
    select count(*) into v_objetos from (
      select 1 from pg_class      c where c.relowner = v_oid_role
      union all select 1 from pg_proc      p where p.proowner = v_oid_role
      union all select 1 from pg_namespace n where n.nspowner = v_oid_role
      union all select 1 from pg_type      t where t.typowner = v_oid_role
    ) donos;

    if v_objetos <> 0 then
      raise notice 'role % é dona de % objeto(s) em %; NÃO removida — decida o destino desses objetos primeiro.',
        v_role, v_objetos, current_database();
      v_mantidas := v_mantidas || v_role;
      continue;
    end if;

    -- Outros bancos do cluster ainda com vínculo. `DROP OWNED BY` daqui não os
    -- alcança, e o `DROP ROLE` falharia — melhor dizer qual banco visitar.
    select string_agg(distinct d.datname, ', ' order by d.datname)
      into v_bancos
      from pg_shdepend s
      join pg_database d on d.oid = s.dbid
     where s.refobjid = v_oid_role
       and d.datname <> current_database();

    if v_bancos is not null then
      raise notice 'role % ainda tem vínculo em: %. Rode este script conectado a esse(s) banco(s) antes.',
        v_role, v_bancos;
      v_mantidas := v_mantidas || v_role;
      continue;
    end if;

    execute format('drop owned by %I', v_role);
    execute format('drop role %I', v_role);
    v_removidas := v_removidas + 1;
    raise notice 'role % removida do cluster.', v_role;
  end loop;

  raise notice '--- % role(s) removida(s) ---', v_removidas;
  if array_length(v_mantidas, 1) > 0 then
    raise notice 'Mantidas por vínculo pendente: %.', array_to_string(v_mantidas, ', ');
  end if;
end;
$script$;

commit;

\echo ''
\echo '== Cluster depois da remoção =='

select rolname,
       case
         when rolname in ('usr_sip_app', 'app_user', 'migration_user')
           then 'credencial da aplicação'
         when rolsuper then 'superusuário da instância'
         when rolname in (
           'anon', 'authenticated', 'service_role', 'authenticator',
           'dashboard_user', 'pgbouncer', 'supabase_admin',
           'supabase_auth_admin', 'supabase_read_only_user',
           'supabase_storage_admin'
         ) then 'LEGADA — vínculo pendente em outro banco (ver relatório acima)'
         else 'não prevista por este script — avaliar'
       end as papel
  from pg_roles
 where rolname not like 'pg\_%'
 order by rolsuper desc, rolname;

\endif
