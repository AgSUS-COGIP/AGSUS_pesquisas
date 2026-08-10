begin;

-- A foto de perfil passa a vir exclusivamente da identidade OAuth do Google.
-- Limpa escolhas antigas (iniciais, upload e DiceBear) antes de aplicar a regra.
update public.people
set metadata = coalesce(metadata, '{}'::jsonb)
    - 'avatar_url'
    - 'avatar_source'
    - 'avatar_updated_at'
    - 'avatar_config'
    - 'google_avatar_url',
    updated_at = timezone('utc', now())
where coalesce(metadata, '{}'::jsonb) ?| array[
  'avatar_url',
  'avatar_source',
  'avatar_updated_at',
  'avatar_config',
  'google_avatar_url'
];

with google_photos as (
  select distinct on (identity.user_id)
    identity.user_id,
    coalesce(
      nullif(btrim(identity.identity_data->>'picture'), ''),
      nullif(btrim(identity.identity_data->>'avatar_url'), '')
    ) as picture
  from auth.identities as identity
  where identity.provider = 'google'
  order by identity.user_id, identity.last_sign_in_at desc nulls last
)
update public.people as person
set metadata = coalesce(person.metadata, '{}'::jsonb) || jsonb_build_object(
      'google_avatar_url', google_photos.picture,
      'avatar_url', google_photos.picture,
      'avatar_source', 'GOOGLE',
      'avatar_updated_at', timezone('utc', now())
    ),
    updated_at = timezone('utc', now())
from google_photos
where person.auth_user_id = google_photos.user_id
  and google_photos.picture is not null;

create or replace function public.sync_my_google_avatar()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_picture text;
  v_person_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select coalesce(
    nullif(btrim(identity_data->>'picture'), ''),
    nullif(btrim(identity_data->>'avatar_url'), '')
  )
  into v_picture
  from auth.identities
  where user_id = v_user_id
    and provider = 'google'
  order by last_sign_in_at desc nulls last
  limit 1;

  select id into v_person_id
  from public.people
  where auth_user_id = v_user_id
  limit 1;

  if v_person_id is null then
    return jsonb_build_object('status', 'UNLINKED', 'googleAvatarUrl', v_picture);
  end if;

  update public.people
  set metadata = (
        coalesce(metadata, '{}'::jsonb)
        - 'avatar_url'
        - 'avatar_source'
        - 'avatar_updated_at'
        - 'avatar_config'
        - 'google_avatar_url'
      ) || case
        when v_picture is null then '{}'::jsonb
        else jsonb_build_object(
          'google_avatar_url', v_picture,
          'avatar_url', v_picture,
          'avatar_source', 'GOOGLE',
          'avatar_updated_at', timezone('utc', now())
        )
      end,
      updated_at = timezone('utc', now())
  where id = v_person_id
    and (
      nullif(btrim(coalesce(metadata->>'avatar_url', '')), '') is distinct from v_picture
      or nullif(btrim(coalesce(metadata->>'google_avatar_url', '')), '') is distinct from v_picture
      or coalesce(metadata->>'avatar_source', '') is distinct from case when v_picture is null then '' else 'GOOGLE' end
      or metadata ? 'avatar_config'
    );

  return jsonb_build_object('status', 'OK', 'googleAvatarUrl', v_picture);
end;
$function$;

revoke all on function public.sync_my_google_avatar() from public, anon, service_role;
grant execute on function public.sync_my_google_avatar() to authenticated;

-- Compatibilidade com versões anteriores do frontend: os setters deixam de
-- aceitar escolhas e apenas restauram a foto oficial do Google.
create or replace function public.set_my_avatar_choice(
  p_source text,
  p_avatar_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
begin
  return public.sync_my_google_avatar();
end;
$function$;

create or replace function public.set_my_avatar_choice(
  p_source text,
  p_avatar_url text,
  p_avatar_config jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
begin
  return public.sync_my_google_avatar();
end;
$function$;

create or replace function public.set_my_avatar_url(p_avatar_url text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
begin
  return public.sync_my_google_avatar();
end;
$function$;

revoke all on function public.set_my_avatar_choice(text, text) from public, anon, service_role;
revoke all on function public.set_my_avatar_choice(text, text, jsonb) from public, anon, service_role;
revoke all on function public.set_my_avatar_url(text) from public, anon, service_role;
grant execute on function public.set_my_avatar_choice(text, text) to authenticated;
grant execute on function public.set_my_avatar_choice(text, text, jsonb) to authenticated;
grant execute on function public.set_my_avatar_url(text) to authenticated;

comment on function public.set_my_avatar_choice(text, text) is
  'Compatibilidade: ignora escolhas de avatar e sincroniza a foto da identidade Google.';
comment on function public.set_my_avatar_choice(text, text, jsonb) is
  'Compatibilidade: ignora escolhas de avatar e sincroniza a foto da identidade Google.';
comment on function public.set_my_avatar_url(text) is
  'Compatibilidade: ignora URLs informadas e sincroniza a foto da identidade Google.';

drop trigger if exists prevent_uploaded_profile_photos_trigger on public.people;
drop function if exists public.prevent_uploaded_profile_photos();

create function public.fc_validar_foto_google()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if new.metadata ? 'avatar_config'
     or coalesce(new.metadata->>'avatar_source', '') not in ('', 'GOOGLE')
     or nullif(btrim(coalesce(new.metadata->>'avatar_url', '')), '')
        is distinct from nullif(btrim(coalesce(new.metadata->>'google_avatar_url', '')), '') then
    raise exception 'A foto de perfil é sincronizada automaticamente com a conta Google.';
  end if;
  return new;
end;
$function$;

revoke all on function public.fc_validar_foto_google() from public, anon, authenticated, service_role;

create trigger tbu_people_foto_google
before update of metadata on public.people
for each row execute function public.fc_validar_foto_google();

comment on function public.fc_validar_foto_google() is
  'Impede fotos, iniciais e avatares personalizados; somente a foto sincronizada do Google é aceita.';

notify pgrst, 'reload schema';

commit;
