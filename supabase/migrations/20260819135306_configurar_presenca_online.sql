alter table public.tb_config_plataforma
  add column if not exists fl_presenca_online_ativa boolean not null default true,
  add column if not exists tx_perfis_visualizacao_presenca text[] not null
    default array['ADMINISTRATOR', 'SURVEY_MANAGER']::text[];

alter table public.tb_config_plataforma
  drop constraint if exists ck_config_plataforma_perfis_presenca;

alter table public.tb_config_plataforma
  add constraint ck_config_plataforma_perfis_presenca check (
    cardinality(tx_perfis_visualizacao_presenca) > 0
    and tx_perfis_visualizacao_presenca <@ array[
      'ADMINISTRATOR', 'SURVEY_MANAGER', 'LEADER', 'RESPONDENT'
    ]::text[]
  );

create or replace function private.can_view_platform_presence()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select coalesce((
    select c.fl_presenca_online_ativa
      and exists (
        select 1
        from public.person_role_assignments pra
        join public.system_roles sr on sr.id = pra.role_id
        where pra.person_id = public.current_person_id()
          and sr.code = any(c.tx_perfis_visualizacao_presenca)
          and pra.starts_at <= timezone('utc', now())
          and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
      )
    from public.tb_config_plataforma c
    where c.co_configuracao = 1
  ), false);
$$;

grant usage on schema private to authenticated;
revoke all on function private.can_view_platform_presence() from public, anon;
grant execute on function private.can_view_platform_presence() to authenticated;

create or replace function private.can_track_platform_presence()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select coalesce((
    select c.fl_presenca_online_ativa
      and public.current_person_id() is not null
    from public.tb_config_plataforma c
    where c.co_configuracao = 1
  ), false);
$$;

revoke all on function private.can_track_platform_presence() from public, anon;
grant execute on function private.can_track_platform_presence() to authenticated;

create or replace function public.fc_definir_presenca_plataforma(
  fl_ativa_param boolean,
  tx_perfis_param text[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  perfis text[];
begin
  if not public.has_active_role('ADMINISTRATOR') then
    raise exception 'Somente Superadmin pode alterar a presença online.' using errcode = '42501';
  end if;

  select array_agg(distinct perfil order by perfil)
  into perfis
  from unnest(coalesce(tx_perfis_param, array[]::text[])) perfil
  where perfil = any(array['ADMINISTRATOR', 'SURVEY_MANAGER', 'LEADER', 'RESPONDENT']::text[]);

  if coalesce(cardinality(perfis), 0) = 0 then
    raise exception 'Selecione ao menos um perfil para a presença online.' using errcode = '22023';
  end if;

  update public.tb_config_plataforma
  set fl_presenca_online_ativa = coalesce(fl_ativa_param, false),
      tx_perfis_visualizacao_presenca = perfis,
      au_usuario_alteracao = public.current_person_id(),
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  return jsonb_build_object(
    'onlinePresenceEnabled', coalesce(fl_ativa_param, false),
    'onlinePresenceViewerRoles', perfis
  );
end;
$$;

revoke all on function public.fc_definir_presenca_plataforma(boolean, text[]) from public, anon;
grant execute on function public.fc_definir_presenca_plataforma(boolean, text[]) to authenticated;

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
    'onlinePresenceEnabled', fl_presenca_online_ativa,
    'onlinePresenceViewerRoles', tx_perfis_visualizacao_presenca,
    'updatedAt', dt_alteracao
  )
  from public.tb_config_plataforma
  where co_configuracao = 1;
$$;

drop policy if exists "authenticated can read platform presence" on realtime.messages;
drop policy if exists "configured profiles can read platform presence" on realtime.messages;
create policy "configured profiles can read platform presence"
on realtime.messages for select to authenticated
using (
  (select realtime.topic()) = 'platform-online'
  and realtime.messages.extension = 'presence'
  and (select private.can_view_platform_presence())
);

drop policy if exists "authenticated can track platform presence" on realtime.messages;
drop policy if exists "configured profiles can track platform presence" on realtime.messages;
create policy "configured profiles can track platform presence"
on realtime.messages for insert to authenticated
with check (
  (select realtime.topic()) = 'platform-online'
  and realtime.messages.extension = 'presence'
  and (select private.can_track_platform_presence())
);

drop function if exists public.can_view_platform_presence();
