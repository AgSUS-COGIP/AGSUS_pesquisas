begin;

-- Expansão da sigla, textos da tela de acesso e cor da barra lateral passam a
-- ser configuráveis.
--
-- O que estava fixo no código
-- Quatro coisas que a administração precisava trocar e não conseguia: a
-- expansão da sigla exibida abaixo da assinatura, a saudação e a instrução da
-- tela de acesso, e a cor da barra lateral. Todas viviam em
-- `DEFAULT_PLATFORM_BRANDING` ou soltas no JSX, então trocar o nome do produto
-- em /admin/configuracoes deixava a expansão desatualizada — a sigla nova
-- aparecia com o significado antigo.
--
-- Por que funções novas em vez de parâmetros novos
-- `fc_atualizar_marca_plataforma` tem cinco parâmetros e é chamada pelo nome
-- por bundles já publicados. Acrescentar parâmetro **não** redefine aquela
-- função: cria uma sobrecarga, e o PostgREST passa a ter duas candidatas para
-- resolver. É a classe de problema que derrubou a plataforma em 10/08/2026.
--
-- O projeto já resolveu isso uma vez do jeito certo: `20260813230000` não
-- estendeu a RPC de marca para acrescentar a arte de fundo — criou
-- `fc_definir_visual_acesso`, focada naquele conjunto de campos. Esta migration
-- segue o mesmo caminho, com duas funções focadas. Nenhuma assinatura existente
-- muda, e nenhum bundle publicado quebra.
--
-- `fc_obter_marca_plataforma()` é redefinida, mas **sem alterar a assinatura**:
-- ela não tem parâmetros e continua sem. Acrescentar chaves ao JSON de retorno
-- é seguro — quem não conhece as chaves novas simplesmente as ignora.
--
-- Sobre o logotipo
-- Continua fora: `normalizePlatformBranding()` ignora de propósito o que estiver
-- gravado nas colunas de logotipo e força a marca institucional, para a
-- identidade não divergir entre telas. Reverter isso é decisão de identidade
-- visual, não de banco, e não cabe numa migration que trata de texto e cor.

alter table public.tb_config_plataforma
  add column if not exists ds_produto text,
  add column if not exists tx_saudacao_acesso text,
  add column if not exists tx_instrucao_acesso text,
  add column if not exists co_cor_barra_lateral text;

-- Cor malformada é recusada pela constraint, e não normalizada em silêncio: a
-- tela de acesso e a barra lateral leem esse valor direto no `style`, então um
-- valor inválido viraria atributo CSS ignorado e a pessoa veria a cor antiga
-- sem entender por quê.
alter table public.tb_config_plataforma
  drop constraint if exists ck_config_cor_barra_lateral;
alter table public.tb_config_plataforma
  add constraint ck_config_cor_barra_lateral
  check (co_cor_barra_lateral is null or co_cor_barra_lateral ~* '^#[0-9a-f]{6}$');

comment on column public.tb_config_plataforma.ds_produto is
  'Expansão da sigla do produto, exibida abaixo da assinatura na tela de acesso. Nulo usa o padrão do código.';
comment on column public.tb_config_plataforma.tx_saudacao_acesso is
  'Título de boas-vindas da tela de acesso. Nulo usa o padrão do código.';
comment on column public.tb_config_plataforma.tx_instrucao_acesso is
  'Linha de instrução abaixo da saudação, na tela de acesso. Nulo usa o padrão do código.';
comment on column public.tb_config_plataforma.co_cor_barra_lateral is
  'Cor de fundo da barra lateral da aplicação. Nulo mantém a cor institucional.';

---------------------------------------------------------------------------
-- Leitura: mesma assinatura, quatro chaves a mais.
---------------------------------------------------------------------------
create or replace function public.fc_obter_marca_plataforma()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
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
    'accessInstruction', tx_instrucao_acesso,
    'updatedAt', dt_alteracao
  )
  from public.tb_config_plataforma
  where co_configuracao = 1;
$$;

revoke all on function public.fc_obter_marca_plataforma() from public;
grant execute on function public.fc_obter_marca_plataforma() to anon, authenticated;

---------------------------------------------------------------------------
-- Textos: expansão da sigla, saudação e instrução.
---------------------------------------------------------------------------
create or replace function public.fc_definir_textos_marca(
  p_expansao text default null,
  p_saudacao text default null,
  p_instrucao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_expansao text := nullif(btrim(coalesce(p_expansao, '')), '');
  v_saudacao text := nullif(btrim(coalesce(p_saudacao, '')), '');
  v_instrucao text := nullif(btrim(coalesce(p_instrucao, '')), '');
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  -- Os limites existem porque estes textos aparecem num cartão estreito: a
  -- expansão ocupa duas linhas no celular, e a saudação é o título de maior
  -- destaque da tela. Texto longo demais não quebra nada, mas descaracteriza a
  -- tela de quem entra — e é mais honesto recusar do que truncar calado.
  if v_expansao is not null and length(v_expansao) > 120 then
    raise exception 'A expansão da sigla deve ter no máximo 120 caracteres.';
  end if;
  if v_saudacao is not null and length(v_saudacao) > 80 then
    raise exception 'A saudação deve ter no máximo 80 caracteres.';
  end if;
  if v_instrucao is not null and length(v_instrucao) > 120 then
    raise exception 'A instrução deve ter no máximo 120 caracteres.';
  end if;

  update public.tb_config_plataforma
  set ds_produto = v_expansao,
      tx_saudacao_acesso = v_saudacao,
      tx_instrucao_acesso = v_instrucao,
      au_usuario_alteracao = public.current_person_id(),
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  return jsonb_build_object(
    'status', 'OK',
    'productDescription', v_expansao,
    'accessGreeting', v_saudacao,
    'accessInstruction', v_instrucao
  );
end;
$$;

revoke all on function public.fc_definir_textos_marca(text, text, text) from public, anon;
grant execute on function public.fc_definir_textos_marca(text, text, text) to authenticated;

comment on function public.fc_definir_textos_marca(text, text, text) is
  'Define expansão da sigla, saudação e instrução da tela de acesso. Vazio em qualquer um restaura o texto padrão do código.';

---------------------------------------------------------------------------
-- Cor da barra lateral.
---------------------------------------------------------------------------
create or replace function public.fc_definir_cor_barra_lateral(p_cor text default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_cor text := nullif(btrim(coalesce(p_cor, '')), '');
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  -- A constraint da coluna já recusaria formato inválido; validar aqui existe
  -- para a mensagem chegar em português a quem está configurando, e não como
  -- erro de restrição do banco.
  if v_cor is not null and v_cor !~* '^#[0-9a-f]{6}$' then
    raise exception 'Use uma cor no formato #RRGGBB.';
  end if;

  update public.tb_config_plataforma
  set co_cor_barra_lateral = v_cor,
      au_usuario_alteracao = public.current_person_id(),
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  return jsonb_build_object('status', 'OK', 'sidebarColor', v_cor);
end;
$$;

revoke all on function public.fc_definir_cor_barra_lateral(text) from public, anon;
grant execute on function public.fc_definir_cor_barra_lateral(text) to authenticated;

comment on function public.fc_definir_cor_barra_lateral(text) is
  'Define a cor de fundo da barra lateral. Nulo restaura a cor institucional.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_definir_textos_marca(text, text, text);
--   drop function if exists public.fc_definir_cor_barra_lateral(text);
--   alter table public.tb_config_plataforma
--     drop constraint if exists ck_config_cor_barra_lateral,
--     drop column if exists ds_produto,
--     drop column if exists tx_saudacao_acesso,
--     drop column if exists tx_instrucao_acesso,
--     drop column if exists co_cor_barra_lateral;
--   -- `fc_obter_marca_plataforma` precisa voltar à definição sem as quatro chaves.
--   notify pgrst, 'reload schema';
-- commit;
