-- ============================================================================
-- Bootstrap de db_dataware — arquitetura de usuário único
-- ============================================================================
--
-- Substitui scripts/restaurar-contrato-postgrest-empresa.sql (superseded):
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
--   supabase.from("tl_erro_aplicacao").upsert({...}, { onConflict: "co_referencia", ignoreDuplicates: true })
-- direto pelo cliente admin. Sem RLS/roles para apoiar esse acesso, a escrita
-- vira RPC como todo o resto do sistema — mantém a autorização (hoje:
-- restrita a service_role via rpc-permissions.ts) num único lugar.

create or replace function sigav.fc_srv_registrar_erro_aplicacao(
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
  insert into sigav.tl_erro_aplicacao (
    co_referencia, no_rota, tp_erro, ds_mensagem, ds_contexto, st_ambiente, nu_http_status
  ) values (
    p_co_referencia, p_no_rota, p_tp_erro, p_ds_mensagem,
    coalesce(p_ds_contexto, '{}'::jsonb), p_st_ambiente, p_nu_http_status
  )
  on conflict (co_referencia) do nothing;
end;
$$;

comment on function sigav.fc_srv_registrar_erro_aplicacao(text, text, text, text, jsonb, text, integer) is
  'Único ponto de escrita em sigav.tl_erro_aplicacao. Substitui o upsert direto que POST /api/observability/errors fazia antes da migração para db_dataware.';

commit;
