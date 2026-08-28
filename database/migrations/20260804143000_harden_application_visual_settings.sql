begin;

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
  v_banner_url text;
  v_banner_path text;
  v_banner_alt text;
  v_hero_title text;
  v_hero_subtitle text;
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

  v_theme := upper(coalesce(nullif(btrim(theme_variant), ''), 'INSTITUTIONAL'));
  if v_theme not in ('INSTITUTIONAL', 'CUSTOM') then
    raise exception 'Tema visual inválido.';
  end if;

  v_banner_url := nullif(btrim(banner_url), '');
  v_banner_path := nullif(btrim(banner_path), '');
  v_banner_alt := nullif(btrim(banner_alt), '');
  v_hero_title := nullif(btrim(hero_title), '');
  v_hero_subtitle := nullif(btrim(hero_subtitle), '');

  if length(coalesce(v_banner_alt, '')) > 180 then
    raise exception 'O texto alternativo deve ter no máximo 180 caracteres.';
  end if;
  if length(coalesce(v_hero_title, '')) > 160 then
    raise exception 'O título deve ter no máximo 160 caracteres.';
  end if;
  if length(coalesce(v_hero_subtitle, '')) > 500 then
    raise exception 'O subtítulo deve ter no máximo 500 caracteres.';
  end if;

  if v_theme = 'CUSTOM' then
    if v_banner_url is null or v_banner_path is null then
      raise exception 'Envie uma imagem antes de salvar o modo personalizado.';
    end if;
    if v_banner_alt is null then
      raise exception 'O texto alternativo é obrigatório para imagens personalizadas.';
    end if;
    if v_banner_url !~ '^https://[^[:space:]]+$' then
      raise exception 'A URL do banner deve utilizar HTTPS.';
    end if;
    if position('/storage/v1/object/public/survey-assets/' in v_banner_url) = 0
       or position(v_banner_path in v_banner_url) = 0 then
      raise exception 'A imagem personalizada deve pertencer ao armazenamento institucional.';
    end if;
    if v_banner_path !~ ('^' || target_application_id::text || '/[^/]+\.(jpg|jpeg|png|webp)$') then
      raise exception 'O caminho da imagem não pertence a esta aplicação.';
    end if;
  else
    v_banner_url := null;
    v_banner_path := null;
    v_banner_alt := null;
  end if;

  v_before := coalesce(v_application.settings->'visualIdentity', '{}'::jsonb);
  v_visual := jsonb_strip_nulls(jsonb_build_object(
    'bannerUrl', v_banner_url,
    'bannerPath', v_banner_path,
    'bannerAlt', v_banner_alt,
    'heroTitle', v_hero_title,
    'heroSubtitle', v_hero_subtitle,
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

revoke all on function public.update_application_visual_settings(uuid, text, text, text, text, text, text) from public;
grant execute on function public.update_application_visual_settings(uuid, text, text, text, text, text, text) to authenticated;

comment on function public.update_application_visual_settings(uuid, text, text, text, text, text, text) is
  'Atualiza a identidade visual, exige metadados acessíveis para capas personalizadas e restringe imagens ao storage institucional.';

commit;
