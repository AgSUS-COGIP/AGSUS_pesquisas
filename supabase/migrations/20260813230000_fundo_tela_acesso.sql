begin;

-- Imagem de fundo da tela de acesso, configurável pela administração.
--
-- Por que configurável, e não fixa no código
-- ------------------------------------------
-- A arte da tela de acesso acompanha campanha institucional — Agosto Lilás,
-- Setembro Amarelo, Outubro Rosa. Fixa no repositório, cada troca vira pedido
-- para a equipe técnica e um deploy; e entre o fim da campanha e o deploy a
-- plataforma anuncia o mês errado.
--
-- Reaproveita o que já existe: mesma tabela de linha única da marca, mesmo
-- bucket `platform-assets`, mesma tela de configurações.
--
-- Duas decisões de compatibilidade
-- --------------------------------
-- `fc_obter_marca_plataforma` é redefinida com a **mesma assinatura**, apenas
-- acrescentando chaves ao retorno: bundle antigo ignora chave que não conhece,
-- então nada quebra enquanto o frontend novo não está no ar.
--
-- A gravação ganha função **própria** em vez de novos parâmetros em
-- `fc_atualizar_marca_plataforma`. Acrescentar parâmetros criaria uma segunda
-- assinatura da mesma função, e o PostgREST passaria a ter duas candidatas para
-- a mesma chamada — ambiguidade que só apareceria em produção.

alter table public.tb_config_plataforma
  add column if not exists tx_url_fundo_acesso text,
  add column if not exists tx_caminho_fundo_acesso text,
  add column if not exists co_cor_painel_acesso text;

alter table public.tb_config_plataforma
  drop constraint if exists ck_cor_painel_acesso;
alter table public.tb_config_plataforma
  add constraint ck_cor_painel_acesso
  check (co_cor_painel_acesso is null or co_cor_painel_acesso ~* '^#[0-9a-f]{6}$');

comment on column public.tb_config_plataforma.tx_url_fundo_acesso is
  'URL pública da arte de fundo da tela de acesso. Nulo devolve a arte institucional padrão.';
comment on column public.tb_config_plataforma.co_cor_painel_acesso is
  'Cor do painel do formulário de acesso. Nulo mantém o branco institucional. O contraste do texto é derivado da luminância desta cor, não configurado.';

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
    'logoUrl', tx_url_logotipo,
    'logoPath', tx_caminho_logotipo,
    'primaryColor', co_cor_principal,
    'accessBackgroundUrl', tx_url_fundo_acesso,
    'accessBackgroundPath', tx_caminho_fundo_acesso,
    'accessPanelColor', co_cor_painel_acesso,
    'updatedAt', dt_alteracao
  )
  from public.tb_config_plataforma
  where co_configuracao = 1;
$$;

-- A tela de acesso é pública: quem ainda não entrou precisa ver logotipo, nome
-- e agora também o fundo. Nenhum dado pessoal trafega aqui.
revoke all on function public.fc_obter_marca_plataforma() from public;
grant execute on function public.fc_obter_marca_plataforma() to anon, authenticated;

create or replace function public.fc_definir_visual_acesso(
  p_url text default null,
  p_caminho text default null,
  p_cor_painel text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
  v_caminho text := nullif(btrim(coalesce(p_caminho, '')), '');
  v_cor text := lower(nullif(btrim(coalesce(p_cor_painel, '')), ''));
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração da plataforma.';
  end if;

  -- URL e caminho andam juntos: guardar um sem o outro deixaria a imagem
  -- impossível de substituir ou de remover do storage depois.
  if (v_url is null) <> (v_caminho is null) then
    raise exception 'Informe a imagem e o caminho de armazenamento em conjunto.';
  end if;

  -- A tela de acesso é servida por HTTPS; imagem em HTTP causaria conteúdo
  -- misto e permitiria troca da arte em trânsito.
  if v_url is not null and v_url not like 'https://%' then
    raise exception 'A imagem de fundo precisa ser servida por HTTPS.';
  end if;

  -- A constraint da coluna já recusa formato inválido; validar aqui existe para
  -- a mensagem chegar em português a quem está configurando, e não como erro de
  -- restrição do banco.
  if v_cor is not null and v_cor !~* '^#[0-9a-f]{6}$' then
    raise exception 'Use uma cor no formato #RRGGBB.';
  end if;

  update public.tb_config_plataforma
  set tx_url_fundo_acesso = v_url,
      tx_caminho_fundo_acesso = v_caminho,
      co_cor_painel_acesso = v_cor,
      au_usuario_alteracao = public.current_person_id(),
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  return jsonb_build_object(
    'status', 'OK',
    'accessBackgroundUrl', v_url,
    'accessBackgroundPath', v_caminho,
    'accessPanelColor', v_cor
  );
end;
$$;

revoke all on function public.fc_definir_visual_acesso(text, text, text) from public, anon;
grant execute on function public.fc_definir_visual_acesso(text, text, text) to authenticated;

comment on function public.fc_definir_visual_acesso(text, text, text) is
  'Define ou remove a arte de fundo da tela de acesso. Nulo em ambos restaura a arte institucional padrão.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_definir_visual_acesso(text, text, text);
--   alter table public.tb_config_plataforma
--     drop column if exists tx_url_fundo_acesso, drop column if exists tx_caminho_fundo_acesso;
--   -- `fc_obter_marca_plataforma` precisa voltar à definição sem as duas chaves.
--   notify pgrst, 'reload schema';
-- commit;
