begin;

create function public.set_my_avatar_choice(
  p_source text,
  p_avatar_url text,
  p_avatar_config jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_person_id uuid;
  v_full_name text;
  v_source text := upper(btrim(coalesce(p_source, '')));
  v_requested_url text := nullif(btrim(coalesce(p_avatar_url, '')), '');
  v_google_url text;
  v_final_url text;
  v_parts text[];
  v_initials text;
  v_config jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sessão autenticada não localizada.';
  end if;

  if v_source not in ('GOOGLE', 'UPLOADED', 'GENERATED', 'INITIALS') then
    raise exception 'Origem de avatar inválida.';
  end if;

  select id, full_name, nullif(btrim(coalesce(metadata->>'google_avatar_url', '')), '')
  into v_person_id, v_full_name, v_google_url
  from public.people
  where auth_user_id = auth.uid()
  limit 1;

  if v_person_id is null then
    raise exception 'Cadastro institucional não localizado.';
  end if;

  if p_avatar_config is not null and v_source <> 'GENERATED' then
    raise exception 'A configuração detalhada só pode ser usada em avatar personalizado.';
  end if;

  if v_source = 'GENERATED' then
    if v_requested_url is null
       or v_requested_url not like 'data:image/svg+xml;charset=utf-8,%3Csvg%' then
      raise exception 'O avatar personalizado deve ser uma imagem SVG gerada pela plataforma.';
    end if;
    if char_length(v_requested_url) > 200000 then
      raise exception 'O avatar personalizado excede o tamanho permitido.';
    end if;
  end if;

  if p_avatar_config is not null then
    if jsonb_typeof(p_avatar_config) <> 'object' or pg_column_size(p_avatar_config) > 4096 then
      raise exception 'Configuração de avatar inválida.';
    end if;

    if exists (
      select 1
      from jsonb_object_keys(p_avatar_config) as item(key)
      where item.key not in (
        'version', 'style', 'seed', 'hairVariant', 'eyesVariant', 'mouthVariant',
        'eyebrowsVariant', 'headVariant', 'noseVariant', 'glassesVariant',
        'beardVariant', 'earringsVariant', 'glasses', 'beard', 'freckles',
        'earrings', 'hairAccessory', 'hairColor', 'skinColor', 'backgroundColor'
      )
    ) then
      raise exception 'A configuração contém campos não permitidos.';
    end if;

    if p_avatar_config->>'version' <> '1' or p_avatar_config->>'style' <> 'lorelei' then
      raise exception 'Versão ou estilo de avatar inválido.';
    end if;
    if nullif(btrim(coalesce(p_avatar_config->>'seed', '')), '') is null
       or char_length(p_avatar_config->>'seed') > 120 then
      raise exception 'Identificador do avatar inválido.';
    end if;
    if not (p_avatar_config->>'hairVariant' = any(array['variant01','variant05','variant12','variant18','variant24','variant31','variant40','variant47'])) then
      raise exception 'Cabelo inválido.';
    end if;
    if not (p_avatar_config->>'eyesVariant' = any(array['variant01','variant06','variant10','variant16','variant22'])) then
      raise exception 'Olhos inválidos.';
    end if;
    if not (p_avatar_config->>'mouthVariant' = any(array['happy01','happy06','happy12','happy17','sad03'])) then
      raise exception 'Boca inválida.';
    end if;
    if not (p_avatar_config->>'eyebrowsVariant' = any(array['variant01','variant04','variant08','variant12'])) then
      raise exception 'Sobrancelhas inválidas.';
    end if;
    if not (p_avatar_config->>'headVariant' = any(array['variant01','variant02','variant03','variant04'])) then
      raise exception 'Formato do rosto inválido.';
    end if;
    if not (p_avatar_config->>'noseVariant' = any(array['variant01','variant02','variant03','variant04','variant05','variant06'])) then
      raise exception 'Nariz inválido.';
    end if;
    if not (p_avatar_config->>'glassesVariant' = any(array['variant01','variant02','variant03','variant04','variant05'])) then
      raise exception 'Modelo de óculos inválido.';
    end if;
    if not (p_avatar_config->>'beardVariant' = any(array['variant01','variant02'])) then
      raise exception 'Modelo de barba inválido.';
    end if;
    if not (p_avatar_config->>'earringsVariant' = any(array['variant01','variant02','variant03'])) then
      raise exception 'Modelo de brinco inválido.';
    end if;
    if not (p_avatar_config->>'hairColor' = any(array['1f2937','3f2d20','6b4226','a16207','d4a574','d1d5db'])) then
      raise exception 'Cor de cabelo inválida.';
    end if;
    if not (p_avatar_config->>'skinColor' = any(array['ffdbb4','edb98a','d08b5b','ae5d29','614335'])) then
      raise exception 'Tom de pele inválido.';
    end if;
    if not (p_avatar_config->>'backgroundColor' = any(array['eaf7f6','eaf2ff','f4eeff','fff4e5','fdeef2','eef2f6'])) then
      raise exception 'Cor de fundo inválida.';
    end if;

    if jsonb_typeof(p_avatar_config->'glasses') is distinct from 'boolean'
       or jsonb_typeof(p_avatar_config->'beard') is distinct from 'boolean'
       or jsonb_typeof(p_avatar_config->'freckles') is distinct from 'boolean'
       or jsonb_typeof(p_avatar_config->'earrings') is distinct from 'boolean'
       or jsonb_typeof(p_avatar_config->'hairAccessory') is distinct from 'boolean' then
      raise exception 'Os detalhes do avatar devem ser verdadeiros ou falsos.';
    end if;

    v_config := jsonb_build_object(
      'version', 1,
      'style', 'lorelei',
      'seed', btrim(p_avatar_config->>'seed'),
      'hairVariant', p_avatar_config->>'hairVariant',
      'eyesVariant', p_avatar_config->>'eyesVariant',
      'mouthVariant', p_avatar_config->>'mouthVariant',
      'eyebrowsVariant', p_avatar_config->>'eyebrowsVariant',
      'headVariant', p_avatar_config->>'headVariant',
      'noseVariant', p_avatar_config->>'noseVariant',
      'glassesVariant', p_avatar_config->>'glassesVariant',
      'beardVariant', p_avatar_config->>'beardVariant',
      'earringsVariant', p_avatar_config->>'earringsVariant',
      'glasses', (p_avatar_config->>'glasses')::boolean,
      'beard', (p_avatar_config->>'beard')::boolean,
      'freckles', (p_avatar_config->>'freckles')::boolean,
      'earrings', (p_avatar_config->>'earrings')::boolean,
      'hairAccessory', (p_avatar_config->>'hairAccessory')::boolean,
      'hairColor', p_avatar_config->>'hairColor',
      'skinColor', p_avatar_config->>'skinColor',
      'backgroundColor', p_avatar_config->>'backgroundColor'
    );
  end if;

  v_parts := regexp_split_to_array(btrim(coalesce(v_full_name, '')), '\s+');
  v_initials := upper(coalesce(substr(v_parts[1], 1, 1), '') || coalesce(substr(v_parts[array_length(v_parts, 1)], 1, 1), ''));

  v_final_url := case
    when v_source = 'GOOGLE' then v_google_url
    when v_source in ('UPLOADED', 'GENERATED') then v_requested_url
    else 'data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%20200%20200%22%3E%3Crect%20width=%22200%22%20height=%22200%22%20rx=%22100%22%20fill=%22%23E8F1F8%22/%3E%3Ctext%20x=%22100%22%20y=%22118%22%20text-anchor=%22middle%22%20font-family=%22Arial,sans-serif%22%20font-size=%2264%22%20font-weight=%22700%22%20fill=%22%230B4F82%22%3E' || v_initials || '%3C/text%3E%3C/svg%3E'
  end;

  if v_source = 'GOOGLE' and v_final_url is null then
    raise exception 'A conta Google não forneceu uma foto de perfil.';
  end if;
  if v_source in ('UPLOADED', 'GENERATED') and v_final_url is null then
    raise exception 'A imagem escolhida não foi informada.';
  end if;

  update public.people
  set metadata = (coalesce(metadata, '{}'::jsonb) - 'avatar_url' - 'avatar_source' - 'avatar_updated_at' - 'avatar_config')
      || jsonb_build_object(
        'avatar_url', v_final_url,
        'avatar_source', v_source,
        'avatar_updated_at', timezone('utc', now())
      )
      || case when v_config is null then '{}'::jsonb else jsonb_build_object('avatar_config', v_config) end,
      updated_at = timezone('utc', now())
  where id = v_person_id;

  return jsonb_build_object(
    'status', 'OK',
    'avatarUrl', v_final_url,
    'avatarSource', v_source,
    'avatarConfig', v_config
  );
end;
$function$;

revoke all on function public.set_my_avatar_choice(text, text, jsonb) from public, anon, service_role;
grant execute on function public.set_my_avatar_choice(text, text, jsonb) to authenticated;

comment on function public.set_my_avatar_choice(text, text, jsonb) is
  'Atualiza a identidade visual do usuário autenticado e valida a composição detalhada de avatares gerados.';

commit;

-- Rollback: drop only public.set_my_avatar_choice(text, text, jsonb) and remove
-- avatar_config from people.metadata when required. The existing two-argument
-- function remains untouched for backwards compatibility.
