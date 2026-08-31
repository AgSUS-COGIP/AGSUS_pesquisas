begin;

-- Separa a gravação do fundo e da cor da tela de acesso.
--
-- O defeito
-- ---------
-- `fc_definir_visual_acesso(url, caminho, cor)` gravava os três campos numa
-- única instrução. Quem chamasse para mudar **um** deles precisava reenviar os
-- outros dois — e a tela os reenviava a partir do estado que tinha em mãos.
-- Bastava esse estado estar um passo atrás para o valor ausente virar `null`:
-- trocar a cor do painel apagava a imagem de fundo que a pessoa acabara de
-- enviar, sem erro e sem aviso.
--
-- Aconteceu em produção: a arte configurada às 19h12 foi apagada às 19h27 por
-- uma troca de cor.
--
-- Por que a correção é na função, e não no chamador
-- ------------------------------------------------
-- Dava para exigir que a tela recarregasse a marca antes de cada gravação. Mas
-- isso deixaria a armadilha montada para o próximo chamador — e a mesma classe
-- de erro voltaria na primeira tela nova que gravasse só um dos campos.
--
-- Uma função que grava três coisas exige que quem chama conheça as três. Duas
-- funções, cada uma dona de um campo, tornam o erro impossível de cometer.

drop function if exists public.fc_definir_visual_acesso(text, text, text);

create or replace function public.fc_definir_fundo_acesso(
  p_url text default null,
  p_caminho text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
  v_caminho text := nullif(btrim(coalesce(p_caminho, '')), '');
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

  -- Grava **apenas** os campos da imagem. A cor do painel não é tocada aqui.
  update public.tb_config_plataforma
  set tx_url_fundo_acesso = v_url,
      tx_caminho_fundo_acesso = v_caminho,
      au_usuario_alteracao = public.current_person_id(),
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  return jsonb_build_object('status', 'OK', 'accessBackgroundUrl', v_url, 'accessBackgroundPath', v_caminho);
end;
$$;

revoke all on function public.fc_definir_fundo_acesso(text, text) from public, anon;
grant execute on function public.fc_definir_fundo_acesso(text, text) to authenticated;

comment on function public.fc_definir_fundo_acesso(text, text) is
  'Define ou remove só a arte de fundo da tela de acesso. Não toca na cor do painel.';

create or replace function public.fc_definir_cor_painel_acesso(p_cor text default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_cor text := lower(nullif(btrim(coalesce(p_cor, '')), ''));
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração da plataforma.';
  end if;

  -- A constraint da coluna já recusa formato inválido; validar aqui existe para
  -- a mensagem chegar em português a quem está configurando.
  if v_cor is not null and v_cor !~* '^#[0-9a-f]{6}$' then
    raise exception 'Use uma cor no formato #RRGGBB.';
  end if;

  -- Grava **apenas** a cor. A imagem de fundo não é tocada aqui.
  update public.tb_config_plataforma
  set co_cor_painel_acesso = v_cor,
      au_usuario_alteracao = public.current_person_id(),
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  return jsonb_build_object('status', 'OK', 'accessPanelColor', v_cor);
end;
$$;

revoke all on function public.fc_definir_cor_painel_acesso(text) from public, anon;
grant execute on function public.fc_definir_cor_painel_acesso(text) to authenticated;

comment on function public.fc_definir_cor_painel_acesso(text) is
  'Define ou remove só a cor do painel da tela de acesso. Não toca na arte de fundo.';

notify pgrst, 'reload schema';

commit;

-- Rollback: recriar fc_definir_visual_acesso(text, text, text) e remover as
-- duas funções acima. Não recomendado — a função combinada é a origem do
-- defeito que esta migration corrige.
