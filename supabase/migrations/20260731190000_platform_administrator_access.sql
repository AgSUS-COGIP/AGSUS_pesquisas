begin;

insert into public.system_roles (code, name, description)
select 'ADMINISTRATOR', 'Administrador da Plataforma', 'Gerencia papéis, permissões e configurações críticas da plataforma.'
where not exists (select 1 from public.system_roles where code = 'ADMINISTRATOR');

insert into public.person_role_assignments (person_id, role_id, starts_at, assigned_by)
select p.id, r.id, timezone('utc', now()), p.id
from public.people p
join public.system_roles r on r.code = 'ADMINISTRATOR'
where lower(p.institutional_email) = lower('yassury.suira@agenciasus.org.br')
  and not exists (
    select 1
    from public.person_role_assignments pra
    where pra.person_id = p.id
      and pra.role_id = r.id
      and pra.starts_at <= timezone('utc', now())
      and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
  );

create or replace function public.is_platform_administrator()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select public.has_active_role('ADMINISTRATOR');
$$;

create or replace function public.list_access_workspace(search_term text default '')
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_people jsonb;
  v_roles jsonb;
begin
  if not public.is_platform_administrator() then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', r.id,
    'code', r.code,
    'name', r.name,
    'description', r.description
  ) order by r.name), '[]'::jsonb)
  into v_roles
  from public.system_roles r;

  select coalesce(jsonb_agg(jsonb_build_object(
    'personId', p.id,
    'fullName', p.full_name,
    'employeeNumber', p.employee_number,
    'institutionalEmail', p.institutional_email,
    'jobTitle', p.job_title,
    'unit', coalesce(p.metadata->>'unit', p.cost_center),
    'active', p.active,
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'assignmentId', pra.id,
        'code', sr.code,
        'name', sr.name,
        'startsAt', pra.starts_at,
        'endsAt', pra.ends_at
      ) order by sr.name)
      from public.person_role_assignments pra
      join public.system_roles sr on sr.id = pra.role_id
      where pra.person_id = p.id
        and pra.starts_at <= timezone('utc', now())
        and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
    ), '[]'::jsonb)
  ) order by p.full_name), '[]'::jsonb)
  into v_people
  from (
    select p.*
    from public.people p
    where p.active
      and (
        nullif(btrim(search_term), '') is null
        or public.unaccent_lower(p.full_name) like '%' || public.unaccent_lower(btrim(search_term)) || '%'
        or coalesce(p.employee_number, '') ilike '%' || btrim(search_term) || '%'
        or coalesce(p.institutional_email, '') ilike '%' || btrim(search_term) || '%'
      )
    order by p.full_name
    limit 100
  ) p;

  return jsonb_build_object('status', 'OK', 'roles', v_roles, 'people', v_people);
end;
$$;

create or replace function public.set_person_role(
  target_person_id uuid,
  target_role_code text,
  enabled boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor_id uuid;
  v_role_id uuid;
  v_assignment_id uuid;
  v_person_name text;
  v_role_name text;
begin
  if not public.is_platform_administrator() then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;

  v_actor_id := public.current_person_id();
  select id, name into v_role_id, v_role_name
  from public.system_roles
  where code = upper(btrim(target_role_code));
  if v_role_id is null then raise exception 'Papel não encontrado.'; end if;

  select full_name into v_person_name from public.people where id = target_person_id and active;
  if v_person_name is null then raise exception 'Pessoa ativa não encontrada.'; end if;

  if not enabled and target_person_id = v_actor_id and upper(btrim(target_role_code)) = 'ADMINISTRATOR' then
    raise exception 'Você não pode retirar seu próprio papel de administrador.';
  end if;

  if enabled then
    select pra.id into v_assignment_id
    from public.person_role_assignments pra
    where pra.person_id = target_person_id
      and pra.role_id = v_role_id
      and pra.starts_at <= timezone('utc', now())
      and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
    order by pra.starts_at desc
    limit 1;

    if v_assignment_id is null then
      insert into public.person_role_assignments (person_id, role_id, starts_at, assigned_by)
      values (target_person_id, v_role_id, timezone('utc', now()), v_actor_id)
      returning id into v_assignment_id;
    end if;
  else
    update public.person_role_assignments
    set ends_at = timezone('utc', now())
    where person_id = target_person_id
      and role_id = v_role_id
      and starts_at <= timezone('utc', now())
      and (ends_at is null or ends_at > timezone('utc', now()))
    returning id into v_assignment_id;
  end if;

  insert into public.audit_events (
    actor_person_id, event_type, entity_type, entity_id, after_data, metadata
  ) values (
    v_actor_id,
    case when enabled then 'ROLE_GRANTED' else 'ROLE_REVOKED' end,
    'PERSON_ROLE_ASSIGNMENT',
    coalesce(v_assignment_id::text, target_person_id::text),
    jsonb_build_object(
      'personId', target_person_id,
      'personName', v_person_name,
      'roleCode', upper(btrim(target_role_code)),
      'roleName', v_role_name,
      'enabled', enabled
    ),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'status', 'OK',
    'personName', v_person_name,
    'roleName', v_role_name,
    'enabled', enabled
  );
end;
$$;

grant execute on function public.is_platform_administrator() to authenticated;
grant execute on function public.list_access_workspace(text) to authenticated;
grant execute on function public.set_person_role(uuid, text, boolean) to authenticated;

commit;
