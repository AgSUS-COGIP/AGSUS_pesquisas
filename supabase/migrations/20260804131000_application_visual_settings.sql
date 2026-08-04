begin;

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
) values (
  'survey-assets',
  'survey-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists survey_assets_manage_insert on storage.objects;
create policy survey_assets_manage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'survey-assets'
  and public.can_manage_surveys()
);

drop policy if exists survey_assets_manage_update on storage.objects;
create policy survey_assets_manage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'survey-assets'
  and public.can_manage_surveys()
)
with check (
  bucket_id = 'survey-assets'
  and public.can_manage_surveys()
);

drop policy if exists survey_assets_manage_delete on storage.objects;
create policy survey_assets_manage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'survey-assets'
  and public.can_manage_surveys()
);

create or replace function public.get_application_visual_settings(
  target_application_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_application public.survey_applications%rowtype;
  v_visual jsonb;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à Equipe Técnica.';
  end if;

  select *
  into v_application
  from public.survey_applications
  where id = target_application_id;

  if v_application.id is null then
    raise exception 'Aplicação de pesquisa não encontrada.';
  end if;

  v_visual := coalesce(v_application.settings->'visualIdentity', '{}'::jsonb);

  return jsonb_build_object(
    'status', 'OK',
    'applicationId', v_application.id,
    'applicationCode', v_application.code,
    'applicationName', v_application.name,
    'visualIdentity', jsonb_build_object(
      'bannerUrl', nullif(btrim(v_visual->>'bannerUrl'), ''),
      'bannerPath', nullif(btrim(v_visual->>'bannerPath'), ''),
      'bannerAlt', nullif(btrim(v_visual->>'bannerAlt'), ''),
      'heroTitle', nullif(btrim(v_visual->>'heroTitle'), ''),
      'heroSubtitle', nullif(btrim(v_visual->>'heroSubtitle'), ''),
      'themeVariant', coalesce(nullif(btrim(v_visual->>'themeVariant'), ''), 'INSTITUTIONAL')
    )
  );
end;
$$;

create or replace function public.update_application_visual_settings(
  target_application_id uuid,
  banner_url text default null,
  banner_path text default null,
  banner_alt text default null,
  hero_title text default null,
  hero_subtitle text default null,
  theme_variant text default 'INSTITUTIONAL'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor_id uuid;
  v_application public.survey_applications%rowtype;
  v_before jsonb;
  v_visual jsonb;
  v_theme text;
begin
  v_actor_id := public.current_person_id();
  if v_actor_id is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à Equipe Técnica.';
  end if;

  select *
  into v_application
  from public.survey_applications
  where id = target_application_id
  for update;

  if v_application.id is null then
    raise exception 'Aplicação de pesquisa não encontrada.';
  end if;

  if nullif(btrim(banner_url), '') is not null
     and btrim(banner_url) !~ '^https://[^[:space:]]+$' then
    raise exception 'A URL do banner deve utilizar HTTPS.';
  end if;

  if length(coalesce(banner_alt, '')) > 180 then
    raise exception 'O texto alternativo deve ter no máximo 180 caracteres.';
  end if;
  if length(coalesce(hero_title, '')) > 160 then
    raise exception 'O título deve ter no máximo 160 caracteres.';
  end if;
  if length(coalesce(hero_subtitle, '')) > 500 then
    raise exception 'O subtítulo deve ter no máximo 500 caracteres.';
  end if;

  v_theme := upper(coalesce(nullif(btrim(theme_variant), ''), 'INSTITUTIONAL'));
  if v_theme not in ('INSTITUTIONAL', 'CUSTOM') then
    raise exception 'Tema visual inválido.';
  end if;

  v_before := coalesce(v_application.settings->'visualIdentity', '{}'::jsonb);
  v_visual := jsonb_strip_nulls(jsonb_build_object(
    'bannerUrl', nullif(btrim(banner_url), ''),
    'bannerPath', nullif(btrim(banner_path), ''),
    'bannerAlt', nullif(btrim(banner_alt), ''),
    'heroTitle', nullif(btrim(hero_title), ''),
    'heroSubtitle', nullif(btrim(hero_subtitle), ''),
    'themeVariant', v_theme
  ));

  update public.survey_applications
  set settings = jsonb_set(
        coalesce(settings, '{}'::jsonb),
        '{visualIdentity}',
        v_visual,
        true
      ),
      updated_at = timezone('utc', now())
  where id = target_application_id;

  insert into public.audit_events (
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'APPLICATION_VISUAL_IDENTITY_UPDATED',
    'SURVEY_APPLICATION',
    target_application_id::text,
    target_application_id,
    v_before,
    v_visual,
    jsonb_build_object('applicationCode', v_application.code)
  );

  return jsonb_build_object(
    'status', 'OK',
    'applicationId', target_application_id,
    'visualIdentity', v_visual,
    'updatedAt', timezone('utc', now())
  );
end;
$$;

revoke all on function public.get_application_visual_settings(uuid) from public;
revoke all on function public.update_application_visual_settings(uuid, text, text, text, text, text, text) from public;

grant execute on function public.get_application_visual_settings(uuid) to authenticated;
grant execute on function public.update_application_visual_settings(uuid, text, text, text, text, text, text) to authenticated;

comment on function public.get_application_visual_settings(uuid) is
  'Retorna a identidade visual configurada para uma aplicação de pesquisa.';
comment on function public.update_application_visual_settings(uuid, text, text, text, text, text, text) is
  'Atualiza a identidade visual de uma aplicação de pesquisa, preservando demais configurações e registrando auditoria.';

commit;
