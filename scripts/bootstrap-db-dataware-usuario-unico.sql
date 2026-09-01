-- ============================================================================
-- Bootstrap de db_dataware — arquitetura de usuário único
-- ============================================================================
--
-- Substitui o antigo scripts/restaurar-contrato-postgrest-empresa.sql, removido
-- em 31/08/2026 (recuperável por `git log -- scripts/`):
-- usr_sip_app não tem CREATEROLE nesta instância compartilhada (sip,
-- sigepsi), então a distinção anon/authenticated/service_role deixou de ser
-- feita por roles do Postgres e passou para a aplicação
-- (src/lib/db/rpc-permissions.ts). Este script só contém o que ainda se
-- aplica com uma única credencial de conexão.
--
-- Executável pela própria usr_sip_app — nenhum passo aqui exige privilégio
-- que ela não tenha (criar função/extensão não exige CREATEROLE).
--
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Extensão
-- ----------------------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
-- 2. Substitui o único acesso direto a tabela que restava no código
-- ----------------------------------------------------------------------------
-- POST /api/observability/errors fazia
--   PostgreSQL.from("tl_erro_aplicacao").upsert({...}, { onConflict: "co_referencia", ignoreDuplicates: true })
-- direto pelo cliente admin. Sem RLS/roles para apoiar esse acesso, a escrita
-- vira RPC como todo o resto do sistema — mantém a autorização (hoje:
-- restrita a service_role via rpc-permissions.ts) num único lugar.

create or replace function sigav."FC_SRV_REGISTRAR_ERRO"(
  p_co_referencia text,
  p_no_rota text,
  p_tp_erro text,
  p_ds_mensagem text,
  p_ds_contexto jsonb,
  p_st_ambiente text,
  p_nu_http_status integer
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, sigav
as $$
begin
  insert into sigav."TL_ERRO_APLICACAO" (
    "CO_REFERENCIA", "NO_ROTA", "TP_ERRO", "DS_MENSAGEM", "DS_CONTEXTO", "ST_AMBIENTE", "NU_HTTP_STATUS"
  ) values (
    p_co_referencia, p_no_rota, p_tp_erro, p_ds_mensagem,
    coalesce(p_ds_contexto, '{}'::jsonb), p_st_ambiente, p_nu_http_status
  )
  on conflict ("CO_REFERENCIA") do nothing;
end;
$$;

comment on function sigav."FC_SRV_REGISTRAR_ERRO"(text, text, text, text, jsonb, text, integer) is
  'Único ponto de escrita em sigav."TL_ERRO_APLICACAO". Substitui o upsert direto que POST /api/observability/errors fazia antes da migração para db_dataware.';

commit;
