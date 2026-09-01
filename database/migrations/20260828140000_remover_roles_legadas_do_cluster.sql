begin;

-- ============================================================================
-- Uma única role no cluster: usr_sip_app
-- ============================================================================
--
-- 20260828130000_unificar_autorizacao_por_permissao.sql terminou de mover a
-- autorização para a aplicação: quem pode chamar cada RPC é decidido por
-- `src/lib/db/rpc-permissions.ts`, e o que cada pessoa pode ver vem de
-- `sigav.person_module_permissions`. Nenhuma dessas decisões passa por role do
-- Postgres — a conexão é sempre `usr_sip_app`, dona de todas as tabelas e
-- funções de `sigav`, e o adaptador nunca executa `set role`.
--
-- Sobraram no cluster as roles do contrato PostgREST/GoTrue, herdadas da stack
-- anterior: anon, authenticated, service_role, authenticator, dashboard_user,
-- pgbouncer e as quatro supabase_*. Nenhuma tem login, nenhuma é dona de
-- objeto de `sigav`, nenhuma aparece em policy daqui. O que restava delas eram
-- ACLs de EXECUTE em dez funções — privilégio redundante, porque a única
-- conexão que existe é a da dona.
--
-- ATENÇÃO À HOMONÍMIA. As palavras `anon`, `authenticated` e `service_role`
-- continuam no código e nos corpos das funções, e continuam certas: ali são
-- CLAIM de sessão (`request.jwt.claim.role`, lida por `sigav.fc_papel_sessao()`),
-- string de aplicação, não role do Postgres. Esta migration remove as roles do
-- catálogo; as claims ficam.
--
-- POR QUE O DROP É CONDICIONAL. Role é objeto de CLUSTER, e `DROP ROLE` exige
-- CREATEROLE — que `usr_sip_app` não tem no db_dataware, uma instância
-- compartilhada com outras aplicações (sip, sigepsi). Mesmo critério de
-- 20260827180000_remover_schema_public.sql: a migration faz o que cabe à
-- aplicação (retirar os privilégios que ela concedeu, no banco que é dela),
-- tenta o drop, e onde não puder registra aviso em vez de falhar. O passo de
-- cluster fica para quem tem o privilégio, com
-- `scripts/remover-roles-legadas-do-cluster.sql`.
--
-- POR QUE REVOGAR OBJETO POR OBJETO, e não `revoke ... on all tables in schema
-- sigav`: a forma `on all` alcança também o que a aplicação não possui — em
-- `sigav` moram as funções do pgcrypto, cujo dono é o administrador da
-- instância. Cada uma delas rende um `WARNING: no privileges could be revoked`
-- (foram 360 na primeira medição), ruído que esconderia um aviso de verdade.
-- Consultar a ACL antes emite só os comandos que têm efeito.
--
-- O QUE NUNCA É TOCADO: `usr_sip_app` (a conexão), `postgres` (superusuário de
-- bootstrap, não removível), as roles `pg_*` (predefinidas do PostgreSQL) e o
-- pseudo-papel PUBLIC. `revoke ... from public` segue aparecendo nas migrations
-- e continua correto: PUBLIC não é role, é a ausência de restrição.

do $migration$
declare
  -- Lista fechada, escrita à mão. Não derivar de "toda role que não é
  -- usr_sip_app": num cluster compartilhado isso alcançaria as credenciais de
  -- sip e sigepsi, que não são desta aplicação.
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
  v_oid_atual oid := current_user::regrole::oid;
  v_comando text;
  v_revogados int;
  v_alheios bigint;
  v_objetos bigint;
  v_removidas int := 0;
  v_mantidas text[] := array[]::text[];
begin
  foreach v_role in array c_legadas loop
    if not exists (select 1 from pg_roles where rolname = v_role) then
      continue;
    end if;

    v_oid_role := v_role::regrole::oid;
    v_revogados := 0;

    -- 1. Retirar os privilégios que a aplicação concedeu -------------------
    -- Tabelas, views e sequências de sigav com ACL para a role. Nenhuma tem
    -- hoje; o laço existe para a migration continuar correta se uma aparecer
    -- entre a escrita e a aplicação (a instância tem escritores paralelos).
    for v_comando in
      select format(
               'revoke all privileges on %s %s from %I',
               case c.relkind when 'S' then 'sequence' else 'table' end,
               c.oid::regclass::text,
               v_role)
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'sigav'
         and c.relkind in ('r', 'p', 'v', 'm', 'S')
         and c.relowner = v_oid_atual
         and exists (select 1 from aclexplode(c.relacl) a where a.grantee = v_oid_role)
    loop
      execute v_comando;
      v_revogados := v_revogados + 1;
    end loop;

    -- Funções e procedures. `routine` cobre as duas desde o PostgreSQL 11.
    for v_comando in
      select format('revoke all privileges on routine %s from %I',
                    p.oid::regprocedure::text, v_role)
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'sigav'
         and p.proowner = v_oid_atual
         and exists (select 1 from aclexplode(p.proacl) a where a.grantee = v_oid_role)
    loop
      execute v_comando;
      v_revogados := v_revogados + 1;
    end loop;

    -- O que tem ACL para a role mas pertence a outro dono (pgcrypto). A
    -- aplicação não pode revogar, e não deve fingir que revogou.
    select count(*) into v_alheios
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'sigav'
       and p.proowner <> v_oid_atual
       and exists (select 1 from aclexplode(p.proacl) a where a.grantee = v_oid_role);

    if v_alheios <> 0 then
      raise notice '% função(ões) de outro dono ainda concedem privilégio a %; fora do alcance desta migration.',
        v_alheios, v_role;
    end if;

    -- Schema, banco e associação de role: cada um só se existir de fato.
    if exists (
      select 1 from pg_namespace n
       where n.nspname = 'sigav'
         and exists (select 1 from aclexplode(n.nspacl) a where a.grantee = v_oid_role)
    ) then
      execute format('revoke all privileges on schema sigav from %I', v_role);
      v_revogados := v_revogados + 1;
    end if;

    if exists (
      select 1 from pg_database d
       where d.datname = current_database()
         and exists (select 1 from aclexplode(d.datacl) a where a.grantee = v_oid_role)
    ) then
      -- Revogar no banco exige ser dono DELE, e na instância compartilhada o
      -- dono pode ser o administrador.
      begin
        execute format('revoke all privileges on database %I from %I', current_database(), v_role);
        v_revogados := v_revogados + 1;
      exception
        when insufficient_privilege then
          raise notice 'sem privilégio para revogar no banco %; segue.', current_database();
      end;
    end if;

    -- Privilégios padrão: sem isto, objeto criado por migration futura
    -- nasceria com ACL para uma role que não existe mais — e o `create` falha.
    if exists (
      select 1 from pg_default_acl d
       where exists (select 1 from aclexplode(d.defaclacl) a where a.grantee = v_oid_role)
    ) then
      begin
        execute format(
          'alter default privileges for role usr_sip_app in schema sigav revoke all on tables from %I', v_role);
        execute format(
          'alter default privileges for role usr_sip_app in schema sigav revoke all on sequences from %I', v_role);
        execute format(
          'alter default privileges for role usr_sip_app in schema sigav revoke all on functions from %I', v_role);
        v_revogados := v_revogados + 1;
      exception
        when insufficient_privilege then
          raise notice 'sem privilégio para ajustar default privileges de usr_sip_app; segue.';
      end;
    end if;

    -- Herança: `scripts/restaurar-contrato-postgrest-empresa.sql` (supersedido)
    -- previa `grant anon to usr_sip_app`. Se algum ambiente executou aquilo, a
    -- associação impediria o drop.
    if exists (
      select 1 from pg_auth_members m
       where m.roleid = v_oid_role
         and m.member = 'usr_sip_app'::regrole::oid
    ) then
      execute format('revoke %I from usr_sip_app', v_role);
      v_revogados := v_revogados + 1;
    end if;

    if v_revogados > 0 then
      raise notice '% privilégio(s) de % retirado(s).', v_revogados, v_role;
    end if;

    -- 2. Só remover role que não seja dona de nada -------------------------
    -- `DROP OWNED BY` apaga OBJETO de quem é dono, não apenas privilégio. Numa
    -- instância compartilhada isso é destrutivo demais para rodar às cegas: se
    -- a role possui algo, a migration para e reporta, e a decisão é humana.
    select count(*) into v_objetos from (
      select 1 from pg_class      c where c.relowner = v_oid_role
      union all select 1 from pg_proc      p where p.proowner = v_oid_role
      union all select 1 from pg_namespace n where n.nspowner = v_oid_role
      union all select 1 from pg_type      t where t.typowner = v_oid_role
    ) donos;

    if v_objetos <> 0 then
      raise notice 'role % é dona de % objeto(s) neste banco; mantida para análise manual.',
        v_role, v_objetos;
      v_mantidas := v_mantidas || v_role;
      continue;
    end if;

    begin
      -- Limpa o que sobrou no banco corrente (ACL fora de sigav, participação
      -- em policy). Seguro depois da checagem de posse acima.
      execute format('drop owned by %I', v_role);
      execute format('drop role %I', v_role);
      v_removidas := v_removidas + 1;
      raise notice 'role % removida.', v_role;
    exception
      when insufficient_privilege then
        raise notice 'sem CREATEROLE para remover %; privilégios retirados, role mantida.', v_role;
        v_mantidas := v_mantidas || v_role;
      when dependent_objects_still_exist then
        -- Caso típico: a role tem privilégio em OUTRO banco do cluster, que
        -- `DROP OWNED BY` daqui não alcança.
        raise notice 'role % ainda tem dependente em outro banco do cluster; mantida.', v_role;
        v_mantidas := v_mantidas || v_role;
      when object_in_use then
        raise notice 'role % está em uso por uma sessão aberta; mantida.', v_role;
        v_mantidas := v_mantidas || v_role;
    end;
  end loop;

  raise notice '% role(s) legada(s) removida(s) do cluster.', v_removidas;
  if array_length(v_mantidas, 1) > 0 then
    raise notice 'Ainda no catálogo, agora sem privilégio nenhum: %.', array_to_string(v_mantidas, ', ');
    raise notice 'O drop de cluster exige CREATEROLE: scripts/remover-roles-legadas-do-cluster.sql.';
  end if;
end;
$migration$;

commit;

-- Rollback: não há, e a ausência é deliberada. Recriar as roles não restaura o
-- que elas significavam — o contrato PostgREST que as usava não existe mais.
-- O que um rollback precisaria desfazer (as ACLs de EXECUTE) era redundante:
-- `usr_sip_app` é dona das funções e as executa por posse, não por grant.
