begin;

update public.institutional_domains
set active = (domain = 'agenciasus.org.br')
where domain in ('agenciasus.org.br', 'agsus.org.br');

insert into public.institutional_domains(domain, active)
values ('agenciasus.org.br', true)
on conflict(domain) do update set active = true;

create or replace function public.set_my_avatar_choice(
  p_source text,
  p_avatar_url text default null
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
begin
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
  set metadata = (coalesce(metadata, '{}'::jsonb) - 'avatar_url' - 'avatar_source' - 'avatar_updated_at')
      || jsonb_build_object(
        'avatar_url', v_final_url,
        'avatar_source', v_source,
        'avatar_updated_at', timezone('utc', now())
      ),
      updated_at = timezone('utc', now())
  where id = v_person_id;

  return jsonb_build_object('status','OK','avatarUrl',v_final_url,'avatarSource',v_source);
end;
$function$;

revoke all on function public.set_my_avatar_choice(text, text) from public, anon;
grant execute on function public.set_my_avatar_choice(text, text) to authenticated;

create or replace function public.set_my_avatar_url(p_avatar_url text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_url text := nullif(btrim(coalesce(p_avatar_url, '')), '');
  v_source text;
begin
  v_source := case
    when v_url is null then 'INITIALS'
    when v_url like 'data:image/%' then 'GENERATED'
    when v_url like '%/storage/v1/object/%/avatars/%' then 'UPLOADED'
    else 'UPLOADED'
  end;
  return public.set_my_avatar_choice(v_source, v_url);
end;
$function$;

commit;