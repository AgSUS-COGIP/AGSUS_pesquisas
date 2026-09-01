begin;

-- Comunicado institucional curto e opcional da pagina inicial.
-- Esta migration sucede a fundacao do schema sigav e nao recria objetos em
-- public. A gravacao e focada para nao substituir os demais campos da marca.

alter table sigav.tb_config_plataforma
  add column if not exists fl_comunicado_inicio_ativo boolean not null default false,
  add column if not exists tx_comunicado_inicio_titulo varchar(120),
  add column if not exists tx_comunicado_inicio_mensagem varchar(400),
  add column if not exists tx_comunicado_inicio_link varchar(500),
  add column if not exists tx_comunicado_inicio_rotulo_link varchar(60);

alter table sigav.tb_config_plataforma
  drop constraint if exists ck_cfg_comunicado_conteudo,
  add constraint ck_cfg_comunicado_conteudo check (
    not fl_comunicado_inicio_ativo
    or (
      nullif(btrim(tx_comunicado_inicio_titulo), '') is not null
      and nullif(btrim(tx_comunicado_inicio_mensagem), '') is not null
    )
  ),
  drop constraint if exists ck_cfg_comunicado_link,
  add constraint ck_cfg_comunicado_link check (
    tx_comunicado_inicio_link is null
    or tx_comunicado_inicio_link ~* '^https://[^[:space:]]+$'
    or tx_comunicado_inicio_link ~ '^/[^/[:space:]][^[:space:]]*$'
  ),
  drop constraint if exists ck_cfg_comunicado_rotulo,
  add constraint ck_cfg_comunicado_rotulo check (
    tx_comunicado_inicio_link is not null
    or tx_comunicado_inicio_rotulo_link is null
  );

comment on column sigav.tb_config_plataforma.fl_comunicado_inicio_ativo is
  'Exibe o comunicado institucional compacto na pagina inicial.';
comment on column sigav.tb_config_plataforma.tx_comunicado_inicio_link is
  'Destino opcional HTTPS ou rota interna iniciada por uma unica barra.';

-- Preserva todas as chaves do contrato autenticado vigente e acrescenta
-- somente as cinco chaves do comunicado. A RPC publica anterior ao login
-- permanece separada e enxuta.
create or replace function sigav.fc_obter_marca_plataforma()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, sigav
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
    'emailInstruction', tx_instrucao_email,
    'emailFooter', tx_rodape_email,
    'onlinePresenceEnabled', fl_presenca_online_ativa,
    'onlinePresenceViewerRoles', tx_perfis_visualizacao_presenca,
    'homeAnnouncementEnabled', fl_comunicado_inicio_ativo,
    'homeAnnouncementTitle', tx_comunicado_inicio_titulo,
    'homeAnnouncementMessage', tx_comunicado_inicio_mensagem,
    'homeAnnouncementLink', tx_comunicado_inicio_link,
    'homeAnnouncementLinkLabel', tx_comunicado_inicio_rotulo_link,
    'updatedAt', dt_alteracao
  )
  from sigav.tb_config_plataforma
  where co_configuracao = 1;
$$;

revoke all on function sigav.fc_obter_marca_plataforma() from public, anon;
grant execute on function sigav.fc_obter_marca_plataforma() to authenticated, service_role;

create or replace function sigav.fc_definir_comunicado_inicio(
  p_ativo boolean,
  p_titulo text,
  p_mensagem text,
  p_link text default null,
  p_rotulo_link text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, sigav
as $$
declare
  v_ator uuid := sigav.current_person_id();
  v_titulo text := nullif(btrim(p_titulo), '');
  v_mensagem text := nullif(btrim(p_mensagem), '');
  v_link text := nullif(btrim(p_link), '');
  v_rotulo text := nullif(btrim(p_rotulo_link), '');
  v_anterior jsonb;
  v_novo jsonb;
begin
  if v_ator is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;
  if not sigav.is_platform_administrator() then
    raise exception 'Acesso restrito ao Superadmin da plataforma.';
  end if;

  if coalesce(p_ativo, false) and (v_titulo is null or v_mensagem is null) then
    raise exception 'Informe título e mensagem antes de ativar o comunicado.';
  end if;
  if length(coalesce(v_titulo, '')) > 120 then
    raise exception 'O título deve ter no máximo 120 caracteres.';
  end if;
  if length(coalesce(v_mensagem, '')) > 400 then
    raise exception 'A mensagem deve ter no máximo 400 caracteres.';
  end if;
  if length(coalesce(v_rotulo, '')) > 60 then
    raise exception 'O texto do link deve ter no máximo 60 caracteres.';
  end if;
  if v_link is not null
     and v_link !~* '^https://[^[:space:]]+$'
     and v_link !~ '^/[^/[:space:]][^[:space:]]*$' then
    raise exception 'O link deve ser uma rota interna ou um endereço HTTPS.';
  end if;
  if v_link is null then
    v_rotulo := null;
  end if;

  select jsonb_build_object(
    'enabled', fl_comunicado_inicio_ativo,
    'title', tx_comunicado_inicio_titulo,
    'message', tx_comunicado_inicio_mensagem,
    'link', tx_comunicado_inicio_link,
    'linkLabel', tx_comunicado_inicio_rotulo_link
  )
  into v_anterior
  from sigav.tb_config_plataforma
  where co_configuracao = 1
  for update;

  update sigav.tb_config_plataforma
  set fl_comunicado_inicio_ativo = coalesce(p_ativo, false),
      tx_comunicado_inicio_titulo = v_titulo,
      tx_comunicado_inicio_mensagem = v_mensagem,
      tx_comunicado_inicio_link = v_link,
      tx_comunicado_inicio_rotulo_link = v_rotulo,
      au_usuario_alteracao = v_ator,
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  select jsonb_build_object(
    'enabled', fl_comunicado_inicio_ativo,
    'title', tx_comunicado_inicio_titulo,
    'message', tx_comunicado_inicio_mensagem,
    'link', tx_comunicado_inicio_link,
    'linkLabel', tx_comunicado_inicio_rotulo_link
  )
  into v_novo
  from sigav.tb_config_plataforma
  where co_configuracao = 1;

  insert into sigav.audit_events (
    actor_person_id, event_type, entity_type, entity_id,
    before_data, after_data, metadata
  ) values (
    v_ator, 'HOME_ANNOUNCEMENT_UPDATED', 'PLATFORM_SETTINGS', 'home-announcement',
    v_anterior, v_novo, jsonb_build_object('source', 'ADMIN_SETTINGS')
  );

  return sigav.fc_obter_marca_plataforma();
end;
$$;

revoke all on function sigav.fc_definir_comunicado_inicio(boolean, text, text, text, text)
  from public, anon;
grant execute on function sigav.fc_definir_comunicado_inicio(boolean, text, text, text, text)
  to authenticated;

comment on function sigav.fc_definir_comunicado_inicio(boolean, text, text, text, text) is
  'Configura e audita o comunicado da pagina inicial. Restrita ao Superadmin.';

notify pgrst, 'reload schema';

commit;

-- Rollback operacional:
-- begin;
--   drop function if exists sigav.fc_definir_comunicado_inicio(boolean, text, text, text, text);
--   -- Antes de remover as colunas, restaure fc_obter_marca_plataforma() para
--   -- o contrato vigente sem as cinco chaves do comunicado.
--   alter table sigav.tb_config_plataforma
--     drop constraint if exists ck_cfg_comunicado_rotulo,
--     drop constraint if exists ck_cfg_comunicado_link,
--     drop constraint if exists ck_cfg_comunicado_conteudo,
--     drop column if exists tx_comunicado_inicio_rotulo_link,
--     drop column if exists tx_comunicado_inicio_link,
--     drop column if exists tx_comunicado_inicio_mensagem,
--     drop column if exists tx_comunicado_inicio_titulo,
--     drop column if exists fl_comunicado_inicio_ativo;
-- commit;
