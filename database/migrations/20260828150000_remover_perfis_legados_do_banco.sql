begin;

-- ============================================================================
-- O banco deixa de guardar perfis: só permissão por pessoa
-- ============================================================================
--
-- 20260828130000_unificar_autorizacao_por_permissao.sql encerrou as atribuições
-- funcionais e passou a autorização para `sigav.person_module_permissions`
-- sobre `sigav.platform_modules`. Manteve `system_roles`,
-- `person_role_assignments` e `role_module_permissions` "como legado/histórico".
-- 20260828140000_remover_roles_legadas_do_cluster.sql tirou do Postgres as
-- roles do contrato PostgREST.
--
-- Sobrou o que esta migration remove: cinco linhas em `system_roles`
-- (SuperAdmin, Admin, Gestor, Avaliador, Participante), 144 atribuições — todas
-- encerradas, zero vigentes — e duas funções que ainda leem `system_roles`,
-- `fc_definir_perfil_pessoa` e `list_access_workspace`. Nenhuma das duas é
-- alcançável: não constam em `src/lib/db/rpc-permissions.ts`, e o adaptador
-- recusa com 42501 qualquer função fora daquela lista. Nada em `src/` lê as
-- três tabelas.
--
-- Enquanto elas existem, "perfil de acesso" tem duas moradas no banco — e a que
-- ninguém usa é a que ninguém revisa. Depois desta migration, a palavra "role"
-- só significa `usr_sip_app`, e perfil de acesso só existe como permissão por
-- pessoa (no banco) e preset de interface (em
-- `src/lib/platform-access-presets.ts`).
--
-- POR QUE ARQUIVAR ANTES. `audit_events` já registra ROLE_GRANTED (17) e
-- ROLE_REVOKED (7): 24 eventos para 144 atribuições, cobrindo 03/08 a 07/08 de
-- um histórico que começa em 28/07. Ou seja, a auditoria NÃO cobre o que as
-- tabelas guardam, e apagar sem arquivar perderia quem teve qual perfil e
-- quando. O arquivo vai para `audit_events` — mesma tabela, mesmo dono, mesmo
-- regime de acesso, e viaja em qualquer cópia do banco — no formato que os
-- eventos ROLE_GRANTED já usam (`entity_type = 'PERSON_ROLE_ASSIGNMENT'`,
-- `entity_id` = id da atribuição). Não em CSV solto: seriam nome, e-mail e
-- matrícula de pessoas reais num arquivo fora de qualquer controle.

do $migration$
declare
  v_atribuicoes bigint := 0;
  v_perfis bigint := 0;
  v_pacotes bigint := 0;
  v_vigentes bigint := 0;
begin
  if to_regclass('sigav.system_roles') is null then
    raise notice 'perfis legados já removidos; nada a fazer.';
    return;
  end if;

  select count(*) into v_perfis from sigav.system_roles;
  select count(*) into v_atribuicoes from sigav.person_role_assignments;
  select count(*) into v_pacotes from sigav.role_module_permissions;

  -- Trava de segurança. Se alguém reativou uma atribuição depois de
  -- 20260828130000, esta migration está apagando autorização viva — e aí é
  -- defeito, não limpeza. A instância tem escritores paralelos.
  select count(*)
    into v_vigentes
    from sigav.person_role_assignments
   where starts_at <= timezone('utc', now())
     and (ends_at is null or ends_at > timezone('utc', now()));

  if v_vigentes <> 0 then
    raise exception
      'ABORTADO: % atribuição(ões) funcional(is) vigente(s) em person_role_assignments. '
      'A autorização deveria estar toda em person_module_permissions. Investigar antes de remover.',
      v_vigentes;
  end if;

  -- 1. Arquivar cada atribuição -------------------------------------------
  -- `before_data` e não `after_data`: o evento registra o que deixou de
  -- existir. Nome do perfil e da pessoa vão desnormalizados de propósito — o
  -- arquivo tem de ser legível depois de as tabelas de origem sumirem.
  insert into sigav.audit_events (
    actor_person_id, event_type, entity_type, entity_id, before_data, metadata
  )
  select
    pra.assigned_by,
    'ROLE_LEGACY_ARCHIVED',
    'PERSON_ROLE_ASSIGNMENT',
    pra.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'personId',   pra.person_id,
      'personName', p.full_name,
      'roleCode',   sr.code,
      'roleName',   sr.name,
      'startsAt',   pra.starts_at,
      'endsAt',     pra.ends_at,
      'assignedBy', pra.assigned_by,
      'createdAt',  pra.created_at
    )),
    jsonb_build_object(
      'migration', '20260828150000_remover_perfis_legados_do_banco',
      'motivo', 'tabelas de perfil removidas; autorização vive em person_module_permissions'
    )
  from sigav.person_role_assignments pra
  join sigav.system_roles sr on sr.id = pra.role_id
  left join sigav.people p on p.id = pra.person_id;

  -- 2. Um evento agregado, com o catálogo de perfis que sai --------------
  -- Serve para responder "o que existia?" sem varrer 144 eventos, e preserva as
  -- descrições dos cinco perfis — que são a origem dos presets da interface.
  insert into sigav.audit_events (
    event_type, entity_type, entity_id, before_data, metadata
  )
  values (
    'ROLE_MODEL_TABLES_REMOVED',
    'PLATFORM',
    'sigav',
    jsonb_build_object(
      'systemRoles', (
        select coalesce(jsonb_agg(jsonb_build_object(
                 'code', sr.code, 'name', sr.name, 'description', sr.description
               ) order by sr.code), '[]'::jsonb)
          from sigav.system_roles sr
      ),
      'contagens', jsonb_build_object(
        'systemRoles', v_perfis,
        'personRoleAssignments', v_atribuicoes,
        'roleModulePermissions', v_pacotes
      )
    ),
    jsonb_build_object(
      'migration', '20260828150000_remover_perfis_legados_do_banco',
      'presetsAgora', 'src/lib/platform-access-presets.ts'
    )
  );

  raise notice '% atribuição(ões) e % perfil(is) arquivados em audit_events.', v_atribuicoes, v_perfis;

  -- 3. Remover as funções órfãs -------------------------------------------
  -- Assinaturas explícitas: `drop function` sem argumentos falha se houver
  -- sobrecarga, e falhar aqui por ambiguidade seria ruído.
  drop function if exists sigav.fc_definir_perfil_pessoa(uuid, text);
  drop function if exists sigav.list_access_workspace(text);

  -- 4. Remover as tabelas --------------------------------------------------
  -- Ordem de FK: as duas dependentes primeiro. RESTRICT implícito de propósito
  -- — se alguma dependência apareceu entre o levantamento e a aplicação, o erro
  -- é preferível a um CASCADE que levaria embora algo não previsto.
  drop table if exists sigav.role_module_permissions;
  drop table if exists sigav.person_role_assignments;
  drop table if exists sigav.system_roles;

  raise notice 'perfis legados removidos do banco: 3 tabelas e 2 funções.';
end;
$migration$;

commit;

-- Rollback:
-- As três tabelas voltam pelo DDL das migrations que as criaram, e os dados
-- pelos eventos arquivados:
--
-- begin;
--   -- (recriar as tabelas com o DDL original antes desta parte)
--   insert into sigav.system_roles (code, name, description)
--   select item->>'code', item->>'name', item->>'description'
--     from sigav.audit_events e,
--          jsonb_array_elements(e.before_data->'systemRoles') item
--    where e.event_type = 'ROLE_MODEL_TABLES_REMOVED';
--
--   insert into sigav.person_role_assignments
--          (id, person_id, role_id, starts_at, ends_at, assigned_by, created_at)
--   select e.entity_id::uuid,
--          (e.before_data->>'personId')::uuid,
--          sr.id,
--          (e.before_data->>'startsAt')::timestamptz,
--          (e.before_data->>'endsAt')::timestamptz,
--          (e.before_data->>'assignedBy')::uuid,
--          (e.before_data->>'createdAt')::timestamptz
--     from sigav.audit_events e
--     join sigav.system_roles sr on sr.code = e.before_data->>'roleCode'
--    where e.event_type = 'ROLE_LEGACY_ARCHIVED';
-- commit;
--
-- `role_module_permissions` não tem o que restaurar: estava vazia desde
-- 20260828130000.
