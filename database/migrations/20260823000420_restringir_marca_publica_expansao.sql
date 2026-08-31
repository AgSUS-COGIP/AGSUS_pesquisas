-- Primeira etapa de um rollout expand/contract para a marca institucional.
--
-- A RPC completa ainda e usada por telas autenticadas e, ate que a aplicacao
-- publicada passe a consumir o contrato novo, precisa continuar executavel pelo
-- papel anonimo para que uma migration aplicada antes do deploy nao derrube a
-- tela de acesso. A revogacao do contrato legado sera feita em uma migration
-- posterior, depois da troca do consumidor.

create or replace function public.fc_obter_marca_publica()
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'public'
as $function$
  select jsonb_build_object(
    'organizationName', no_organizacao,
    'productName', no_produto,
    'productDescription', ds_produto,
    'logoUrl', tx_url_logotipo,
    'logoPath', tx_caminho_logotipo,
    'primaryColor', co_cor_principal,
    'sidebarColor', co_cor_barra_lateral,
    'accessBackgroundUrl', tx_url_fundo_acesso,
    'accessBackgroundPath', tx_caminho_fundo_acesso,
    'accessPanelColor', co_cor_painel_acesso,
    'accessGreeting', tx_saudacao_acesso,
    'accessInstruction', tx_instrucao_acesso
  )
  from public.tb_config_plataforma
  where co_configuracao = 1;
$function$;

revoke all on function public.fc_obter_marca_publica() from public;
grant execute on function public.fc_obter_marca_publica() to anon, authenticated, service_role;
