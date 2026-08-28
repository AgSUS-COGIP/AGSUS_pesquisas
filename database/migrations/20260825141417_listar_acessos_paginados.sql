begin;

create or replace function public.fc_listar_acessos_paginados(
  p_busca text default '',
  p_limite integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_busca text := btrim(coalesce(p_busca, ''));
  v_limite integer := greatest(1, least(coalesce(p_limite, 100), 100));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_total bigint;
  v_people jsonb;
  v_roles jsonb;
begin
  if not public.is_platform_administrator() then
    raise exception 'Apenas o Superadmin pode consultar pessoas e permissões.';
  end if;

  select count(*)
  into v_total
  from public.people as person
  where person.active
    and (
      v_busca = ''
      or public.unaccent_lower(person.full_name) like '%' || public.unaccent_lower(v_busca) || '%'
      or coalesce(person.employee_number, '') ilike '%' || v_busca || '%'
      or coalesce(person.institutional_email, '') ilike '%' || v_busca || '%'
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', role.id,
    'code', role.code,
    'name', role.name,
    'description', role.description
  ) order by role.name, role.id), '[]'::jsonb)
  into v_roles
  from public.system_roles as role;

  select coalesce(jsonb_agg(jsonb_build_object(
    'personId', person.id,
    'fullName', person.full_name,
    'employeeNumber', person.employee_number,
    'institutionalEmail', person.institutional_email,
    'jobTitle', person.job_title,
    'unit', coalesce(person.metadata->>'unit', person.cost_center),
    'active', person.active,
    'roles', coalesce((
      select jsonb_agg(jsonb_build_object(
        'assignmentId', assignment.id,
        'code', role.code,
        'name', role.name,
        'startsAt', assignment.starts_at,
        'endsAt', assignment.ends_at
      ) order by role.name, role.id)
      from public.person_role_assignments as assignment
      join public.system_roles as role on role.id = assignment.role_id
      where assignment.person_id = person.id
        and assignment.starts_at <= timezone('utc', now())
        and (assignment.ends_at is null or assignment.ends_at > timezone('utc', now()))
    ), '[]'::jsonb)
  ) order by person.full_name, person.id), '[]'::jsonb)
  into v_people
  from (
    select candidate.*
    from public.people as candidate
    where candidate.active
      and (
        v_busca = ''
        or public.unaccent_lower(candidate.full_name) like '%' || public.unaccent_lower(v_busca) || '%'
        or coalesce(candidate.employee_number, '') ilike '%' || v_busca || '%'
        or coalesce(candidate.institutional_email, '') ilike '%' || v_busca || '%'
      )
    order by candidate.full_name, candidate.id
    limit v_limite
    offset v_offset
  ) as person;

  return jsonb_build_object(
    'status', 'OK',
    'roles', v_roles,
    'people', v_people,
    'total', v_total,
    'limit', v_limite,
    'offset', v_offset,
    'hasMore', v_offset + jsonb_array_length(v_people) < v_total
  );
end;
$$;

revoke all on function public.fc_listar_acessos_paginados(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.fc_listar_acessos_paginados(text, integer, integer)
  to authenticated;

notify pgrst, 'reload schema';

commit;
