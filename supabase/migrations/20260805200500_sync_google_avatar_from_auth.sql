begin;

create or replace function public.sync_my_google_avatar()
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog','public','auth'
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
    nullif(btrim(raw_user_meta_data->>'picture'), ''),
    nullif(btrim(raw_user_meta_data->>'avatar_url'), '')
  )
  into v_picture
  from auth.users
  where id = v_user_id;

  select id into v_person_id
  from public.people
  where auth_user_id = v_user_id;

  if v_person_id is null then
    return jsonb_build_object('status', 'UNLINKED', 'googleAvatarUrl', v_picture);
  end if;

  if v_picture is not null then
    update public.people
    set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('google_avatar_url', v_picture),
        updated_at = timezone('utc', now())
    where id = v_person_id
      and coalesce(metadata->>'google_avatar_url', '') is distinct from v_picture;
  end if;

  return jsonb_build_object('status', 'OK', 'googleAvatarUrl', v_picture);
end;
$function$;

revoke all on function public.sync_my_google_avatar() from public, anon;
grant execute on function public.sync_my_google_avatar() to authenticated;

notify pgrst, 'reload schema';

commit;
