begin;

create table if not exists public.tb_config_plataforma (
  co_configuracao smallint not null default 1,
  no_organizacao text not null default 'AgSUS',
  no_produto text not null default 'Pesquisas',
  tx_url_logotipo text,
  tx_caminho_logotipo text,
  co_cor_principal text not null default '#0b4f82',
  au_usuario_alteracao uuid,
  dt_alteracao timestamptz not null default timezone('utc', now()),
  constraint pk_tb_config_plataforma primary key (co_configuracao),
  constraint ck_tb_config_plataforma_unica check (co_configuracao = 1),
  constraint fk_tb_config_plataforma_pessoa foreign key (au_usuario_alteracao)
    references public.people(id) on delete set null
);

alter table public.tb_config_plataforma enable row level security;
revoke all on table public.tb_config_plataforma from anon, authenticated;

insert into public.tb_config_plataforma (co_configuracao)
values (1)
on conflict (co_configuracao) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'platform-assets',
  'platform-assets',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists platform_assets_manage_select on storage.objects;
create policy platform_assets_manage_select
on storage.objects for select to authenticated
using (bucket_id = 'platform-assets' and public.can_manage_surveys());

drop policy if exists platform_assets_manage_insert on storage.objects;
create policy platform_assets_manage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'platform-assets'
  and name like 'branding/%'
  and public.can_manage_surveys()
);

drop policy if exists platform_assets_manage_update on storage.objects;
create policy platform_assets_manage_update
on storage.objects for update to authenticated
using (bucket_id = 'platform-assets' and public.can_manage_surveys())
with check (
  bucket_id = 'platform-assets'
  and name like 'branding/%'
  and public.can_manage_surveys()
);

drop policy if exists platform_assets_manage_delete on storage.objects;
create policy platform_assets_manage_delete
on storage.objects for delete to authenticated
using (bucket_id = 'platform-assets' and public.can_manage_surveys());

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
    'updatedAt', dt_alteracao
  )
  from public.tb_config_plataforma
  where co_configuracao = 1;
$$;

create or replace function public.fc_atualizar_marca_plataforma(
  no_organizacao_param text,
  no_produto_param text,
  tx_url_logotipo_param text default null,
  tx_caminho_param text default null,
  co_cor_principal_param text default '#0b4f82'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_organization_name text := nullif(btrim(no_organizacao_param), '');
  v_product_name text := nullif(btrim(no_produto_param), '');
  v_logo_url text := nullif(btrim(tx_url_logotipo_param), '');
  v_logo_path text := nullif(btrim(tx_caminho_param), '');
  v_primary_color text := lower(coalesce(nullif(btrim(co_cor_principal_param), ''), '#0b4f82'));
begin
  v_actor_id := public.current_person_id();
  if v_actor_id is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração da plataforma.';
  end if;

  if v_organization_name is null or length(v_organization_name) > 60 then
    raise exception 'O nome da organização deve possuir entre 1 e 60 caracteres.';
  end if;
  if v_product_name is null or length(v_product_name) > 60 then
    raise exception 'O nome do produto deve possuir entre 1 e 60 caracteres.';
  end if;
  if v_primary_color !~ '^#[0-9a-f]{6}$' then
    raise exception 'A cor principal deve utilizar o formato hexadecimal #RRGGBB.';
  end if;

  if (v_logo_url is null) <> (v_logo_path is null) then
    raise exception 'A URL e o caminho do logotipo devem ser informados em conjunto.';
  end if;
  if v_logo_url is not null then
    if v_logo_url !~ '^https://[^[:space:]]+$' then
      raise exception 'A URL do logotipo deve utilizar HTTPS.';
    end if;
    if position('/storage/v1/object/public/platform-assets/' in v_logo_url) = 0
       or position(v_logo_path in v_logo_url) = 0
       or v_logo_path !~ '^branding/[^/]+\.(jpg|jpeg|png|webp)$' then
      raise exception 'O logotipo deve pertencer ao armazenamento institucional.';
    end if;
  end if;

  select to_jsonb(settings) - 'co_configuracao'
  into v_before
  from public.tb_config_plataforma settings
  where co_configuracao = 1
  for update;

  update public.tb_config_plataforma
  set no_organizacao = v_organization_name,
      no_produto = v_product_name,
      tx_url_logotipo = v_logo_url,
      tx_caminho_logotipo = v_logo_path,
      co_cor_principal = v_primary_color,
      au_usuario_alteracao = v_actor_id,
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  select to_jsonb(settings) - 'co_configuracao'
  into v_after
  from public.tb_config_plataforma settings
  where co_configuracao = 1;

  insert into public.audit_events (
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'PLATFORM_BRANDING_UPDATED',
    'PLATFORM_SETTINGS',
    'branding',
    v_before,
    v_after,
    jsonb_build_object('source', 'ADMIN_SETTINGS')
  );

  return public.fc_obter_marca_plataforma();
end;
$$;

revoke all on function public.fc_obter_marca_plataforma() from public;
revoke all on function public.fc_atualizar_marca_plataforma(text, text, text, text, text) from public;
grant execute on function public.fc_obter_marca_plataforma() to anon, authenticated;
grant execute on function public.fc_atualizar_marca_plataforma(text, text, text, text, text) to authenticated;

comment on table public.tb_config_plataforma is
  'Configurações institucionais globais da interface, mantidas em registro único.';
comment on function public.fc_obter_marca_plataforma() is
  'Retorna somente configurações públicas de identidade da plataforma.';
comment on function public.fc_atualizar_marca_plataforma(text, text, text, text, text) is
  'Atualiza a identidade global com validação, armazenamento institucional e auditoria.';

commit;
