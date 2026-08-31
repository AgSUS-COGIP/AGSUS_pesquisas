begin;

create or replace function public.prevent_uploaded_profile_photos()
returns trigger
language plpgsql
set search_path to 'pg_catalog', 'public'
as $function$
begin
  if coalesce(new.metadata->>'avatar_source', '') = 'UPLOADED'
     and (
       coalesce(old.metadata->>'avatar_source', '') is distinct from 'UPLOADED'
       or coalesce(new.metadata->>'avatar_url', '') is distinct from coalesce(old.metadata->>'avatar_url', '')
     ) then
    raise exception 'O envio de fotos foi desativado. Use a foto da conta Google, as iniciais ou o avatar institucional.';
  end if;
  return new;
end;
$function$;

drop trigger if exists prevent_uploaded_profile_photos_trigger on public.people;
create trigger prevent_uploaded_profile_photos_trigger
before update of metadata on public.people
for each row execute function public.prevent_uploaded_profile_photos();

create or replace function public.set_my_avatar_url(p_avatar_url text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
begin
  if nullif(btrim(coalesce(p_avatar_url, '')), '') is not null then
    raise exception 'O envio de fotos foi desativado. Use a foto da conta Google, as iniciais ou o avatar institucional.';
  end if;
  return public.set_my_avatar_choice('INITIALS', null);
end;
$function$;

notify pgrst, 'reload schema';

commit;
