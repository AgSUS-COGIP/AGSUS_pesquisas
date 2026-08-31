begin;

create table if not exists public.institutional_domains (
  domain text primary key,
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  constraint institutional_domains_normalized
    check (domain = lower(btrim(domain)) and domain not like '%@%')
);

insert into public.institutional_domains(domain, active) values
  ('agenciasus.org.br', true),
  ('agsus.org.br', true)
on conflict (domain) do update set active = excluded.active;

alter table public.survey_applications
  add column if not exists access_mode text not null default 'RESTRICTED';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'survey_applications_access_mode_valid'
      and conrelid = 'public.survey_applications'::regclass
  ) then
    alter table public.survey_applications
      add constraint survey_applications_access_mode_valid
      check (access_mode in ('INSTITUTIONAL', 'RESTRICTED'));
  end if;
end;
$$;

create or replace function public.is_allowed_institutional_email(target_email text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.institutional_domains d
    where d.active = true
      and split_part(lower(btrim(coalesce(target_email, ''))), '@', 2) = d.domain
  );
$$;

create or replace function public.resolve_authenticated_person(target_employee_number text default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_auth_user uuid := auth.uid();
  v_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_name text := nullif(btrim(coalesce(
    auth.jwt() #>> '{user_metadata,full_name}',
    auth.jwt() #>> '{user_metadata,name}',
    split_part(v_email, '@', 1)
  )), '');
  v_person public.people%rowtype;
  v_candidate_count integer := 0;
  v_employee_number text;
begin
  if v_auth_user is null then
    return jsonb_build_object('status', 'AUTH_REQUIRED', 'message', 'Autenticação necessária.');
  end if;

  if not public.is_allowed_institutional_email(v_email) then
    return jsonb_build_object('status', 'INVALID_DOMAIN', 'message', 'Utilize uma conta institucional AgSUS autorizada.');
  end if;

  select * into v_person
  from public.people
  where auth_user_id = v_auth_user and active = true
  limit 1;

  if v_person.id is null then
    select count(*) into v_candidate_count
    from public.people
    where active = true
      and lower(btrim(coalesce(institutional_email, ''))) = v_email
      and (target_employee_number is null or employee_number = btrim(target_employee_number));

    if v_candidate_count > 1 and target_employee_number is null then
      return jsonb_build_object('status', 'NEEDS_EMPLOYEE_NUMBER', 'message', 'Há mais de um cadastro associado ao e-mail. Informe sua matrícula.');
    end if;

    select * into v_person
    from public.people
    where active = true
      and lower(btrim(coalesce(institutional_email, ''))) = v_email
      and (target_employee_number is null or employee_number = btrim(target_employee_number))
    order by (auth_user_id is null) desc, created_at
    limit 1;
  end if;

  if v_person.id is null then
    select p.* into v_person
    from public.person_access_identities pai
    join public.people p on p.id = pai.person_id
    where lower(pai.email) = v_email
      and pai.status in ('PENDING', 'ACTIVE')
      and p.active = true
      and (target_employee_number is null or p.employee_number = btrim(target_employee_number))
    order by pai.status = 'ACTIVE' desc, pai.created_at
    limit 1;
  end if;

  if v_person.id is null then
    v_employee_number := 'AUTH-' || upper(substr(replace(v_auth_user::text, '-', ''), 1, 20));
    insert into public.people(
      auth_user_id,
      employee_number,
      full_name,
      institutional_email,
      employment_status,
      active,
      source_system,
      source_key,
      metadata
    ) values (
      v_auth_user,
      v_employee_number,
      coalesce(v_name, v_email),
      v_email,
      'ATIVO',
      true,
      'AUTHJS',
      v_auth_user::text,
      jsonb_build_object('provisioning', 'INSTITUTIONAL_DOMAIN', 'provisioned_at', timezone('utc', now()))
    ) returning * into v_person;
  else
    if v_person.auth_user_id is not null and v_person.auth_user_id <> v_auth_user then
      return jsonb_build_object('status', 'ALREADY_LINKED', 'message', 'Este cadastro já está vinculado a outra conta autenticada.');
    end if;

    update public.people
    set auth_user_id = v_auth_user,
        institutional_email = coalesce(nullif(btrim(institutional_email), ''), v_email),
        updated_at = timezone('utc', now())
    where id = v_person.id
    returning * into v_person;
  end if;

  insert into public.person_access_identities(
    person_id,
    identity_type,
    email,
    status,
    source,
    verified_at,
    metadata
  ) values (
    v_person.id,
    'INSTITUTIONAL_EMAIL',
    v_email,
    'ACTIVE',
    'AUTHJS',
    timezone('utc', now()),
    jsonb_build_object('auth_user_id', v_auth_user)
  )
  on conflict (person_id, identity_type, email) do update
    set status = 'ACTIVE',
        verified_at = coalesce(public.person_access_identities.verified_at, excluded.verified_at),
        revoked_at = null,
        updated_at = timezone('utc', now());

  return jsonb_build_object(
    'status', 'OK',
    'person', jsonb_build_object(
      'id', v_person.id,
      'employeeNumber', v_person.employee_number,
      'fullName', v_person.full_name,
      'institutionalEmail', v_person.institutional_email,
      'jobTitle', v_person.job_title,
      'costCenter', v_person.cost_center,
      'workplace', v_person.workplace,
      'metadata', v_person.metadata
    )
  );
end;
$$;

create or replace function public.can_access_application(target_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select public.can_manage_surveys()
    or exists (
      select 1
      from public.survey_applications sa
      where sa.id = target_application_id
        and sa.access_mode = 'INSTITUTIONAL'
        and public.current_person_id() is not null
    )
    or exists (
      select 1
      from public.application_participants ap
      where ap.application_id = target_application_id
        and ap.person_id = public.current_person_id()
        and ap.status not in ('BLOCKED', 'EXCLUDED')
    );
$$;

revoke all on public.institutional_domains from anon, authenticated;
grant select on public.institutional_domains to authenticated;

commit;
