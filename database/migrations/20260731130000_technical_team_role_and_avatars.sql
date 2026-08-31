begin;

insert into public.system_roles (code, name, description)
values ('TECHNICAL_TEAM', 'Equipe Técnica', 'Equipe responsável pela criação, configuração, publicação e governança de pesquisas institucionais.')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description;

insert into public.person_role_assignments (person_id, role_id, starts_at)
select p.id, r.id, timezone('utc', now())
from public.people p
join public.system_roles r on r.code = 'TECHNICAL_TEAM'
where p.employee_number = '294446'
  and not exists (
    select 1 from public.person_role_assignments pra
    where pra.person_id = p.id
      and pra.role_id = r.id
      and pra.starts_at <= timezone('utc', now())
      and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
  );

create or replace function public.can_manage_surveys()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select public.has_active_role('ADMINISTRATOR')
      or public.has_active_role('SURVEY_MANAGER')
      or public.has_active_role('TECHNICAL_TEAM');
$$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "avatar_public_read"
on storage.objects for select
to public
using (bucket_id = 'avatars');

create policy "avatar_owner_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar_owner_update"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "avatar_owner_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

create or replace function public.set_my_avatar_url(p_avatar_url text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person_id uuid;
begin
  select id into v_person_id
  from public.people
  where auth_user_id = auth.uid()
  limit 1;

  if v_person_id is null then
    raise exception 'Cadastro institucional não localizado.';
  end if;

  update public.people
  set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{avatar_url}', to_jsonb(p_avatar_url), true),
      updated_at = timezone('utc', now())
  where id = v_person_id;

  return jsonb_build_object('status','OK','avatarUrl',p_avatar_url);
end;
$$;

grant execute on function public.set_my_avatar_url(text) to authenticated;

commit;
