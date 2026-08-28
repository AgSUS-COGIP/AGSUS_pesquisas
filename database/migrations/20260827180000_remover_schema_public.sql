begin;

-- ============================================================================
-- Remoção do schema public, vazio desde a migração para sigav
-- ============================================================================
--
-- 20260826180000_migrar_schema_sigav.sql esvaziou o `public` e deixou um teste
-- de prontidão (`database/tests/public_drop_readiness.sql`) como gate para este
-- passo. Com 20260827170000_unificar_schemas_em_sigav.sql o projeto passou a
-- ter um único schema de aplicação, e um `public` vazio é só um lugar a mais
-- para procurar coisa que não está lá — além de convidar um `create table` sem
-- qualificador a nascer no schema errado.
--
-- POR QUE A REMOÇÃO É CONDICIONAL: esta migration roda em dois mundos. Na
-- stack PostgreSQL local e na réplica Docker, `public` é vazio e a credencial
-- tem poder para removê-lo. No db_dataware da empresa, a instância é
-- compartilhada com outras aplicações (schemas sip e sigepsi) — o `public` de
-- lá é território comum: pode ter objeto de terceiros, e o dono é o
-- administrador do banco, não `usr_sip_app`. Nesses casos a migration registra
-- um aviso e segue, em vez de falhar: remover o `public` de uma instância
-- compartilhada é decisão do DBA, não desta aplicação.
--
-- O que NÃO sai, e por quê:
--   - `auth`: `auth.users`/`auth.identities` são alvo de FK de sigav.people e
--     das funções de identidade OAuth; `auth.uid()` aparece no corpo e no
--     search_path de dezenas de funções security definer. É a fronteira de
--     identidade, não burocracia.
--   - `extensions`: abriga pgcrypto, e `extensions.digest(...)` é chamado
--     textualmente pelas funções de token de sessão anônima
--     (20260822213947_hash_token_sessao_anonima.sql). Na instância da empresa
--     o schema também é infraestrutura compartilhada.

do $migration$
declare
  v_quantidade bigint;
begin
  if not exists (select 1 from pg_namespace where nspname = 'public') then
    raise notice 'schema public já não existe; nada a fazer.';
    return;
  end if;

  -- Mesmo critério do teste de prontidão: dependências 'a' são metadados
  -- automáticos (default privileges) que o próprio DROP remove; qualquer outra
  -- dependência é objeto real e mantém o schema vivo.
  select count(*)
    into v_quantidade
    from pg_depend d
   where d.refclassid = 'pg_namespace'::regclass
     and d.refobjid = (select oid from pg_namespace where nspname = 'public')
     and d.deptype <> 'a';

  if v_quantidade <> 0 then
    raise notice 'schema public tem % dependente(s) — instância compartilhada; mantido.', v_quantidade;
    return;
  end if;

  begin
    -- RESTRICT de propósito: se algo apareceu entre a contagem e o drop, o
    -- erro é preferível a um CASCADE que apagaria o objeto em silêncio.
    drop schema public restrict;
    raise notice 'schema public removido.';
  exception
    when insufficient_privilege then
      raise notice 'sem privilégio para remover public (dono: administrador da instância); mantido.';
    when dependent_objects_still_exist then
      raise notice 'schema public ganhou dependente durante a migration; mantido.';
  end;
end;
$migration$;

commit;

-- Rollback:
-- begin;
--   create schema public;
--   alter schema public owner to pg_database_owner;
--   comment on schema public is 'standard public schema';
--   -- Padrão do PostgreSQL 15+: USAGE para todos, CREATE só para o dono.
--   grant usage on schema public to public;
-- commit;
