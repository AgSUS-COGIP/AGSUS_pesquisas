create or replace function public.unaccent_lower(input_text text)
returns text
language sql
immutable
parallel safe
set search_path = pg_catalog, public
as $$
  select lower(translate(
    coalesce(input_text, ''),
    'ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝŸáàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
    'AAAAAAEEEEIIIIOOOOOUUUUCNYYaaaaaaeeeeiiiiooooouuuucnyy'
  ));
$$;

create or replace function public.get_my_platform_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person public.people%rowtype;
  v_roles text[] := array[]::text[];
  v_modules text[] := array[]::text[];
  v_participant public.application_participants%rowtype;
  v_application public.survey_applications%rowtype;
  v_participant_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'AUTH_REQUIRED');
  end if;

  select * into v_person
  from public.people
  where auth_user_id = auth.uid()
    and active = true
  limit 1;

  if v_person.id is null then
    return jsonb_build_object('status', 'UNLINKED', 'message', 'Conta autenticada sem cadastro institucional ativo.');
  end if;

  select coalesce(array_agg(distinct sr.code order by sr.code), array[]::text[])
  into v_roles
  from public.person_role_assignments pra
  join public.system_roles sr on sr.id = pra.role_id
  where pra.person_id = v_person.id
    and pra.starts_at <= timezone('utc', now())
    and (pra.ends_at is null or pra.ends_at > timezone('utc', now()));

  if 'ADMINISTRATOR' = any(v_roles) or 'TECHNICAL_TEAM' = any(v_roles) then
    v_modules := array['HOME','SURVEYS','DASHBOARDS','TEAM','RESULTS','ADMIN_SURVEYS','ADMIN_PARTICIPANTS','ADMIN_TEAMS','ADMIN_ACCESS','ADMIN_IMPORT'];
  elsif 'SURVEY_MANAGER' = any(v_roles) then
    v_modules := array['HOME','SURVEYS','DASHBOARDS','TEAM','RESULTS','ADMIN_SURVEYS','ADMIN_PARTICIPANTS','ADMIN_TEAMS','ADMIN_IMPORT'];
  else
    v_modules := array['HOME','SURVEYS','DASHBOARDS','RESULTS'];
    if 'LEADER' = any(v_roles) then
      v_modules := array_append(v_modules, 'TEAM');
    end if;
  end if;

  select ap.id into v_participant_id
  from public.application_participants ap
  join public.survey_applications sa on sa.id = ap.application_id
  where ap.person_id = v_person.id
    and ap.status not in ('REMOVED','INELIGIBLE')
  order by
    case sa.status when 'OPEN' then 0 when 'SCHEDULED' then 1 when 'DRAFT' then 2 else 3 end,
    coalesce(sa.closes_at, sa.opens_at, sa.created_at) desc
  limit 1;

  if v_participant_id is not null then
    select * into v_participant
    from public.application_participants
    where id = v_participant_id;

    select * into v_application
    from public.survey_applications
    where id = v_participant.application_id;
  end if;

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
      'metadata', coalesce(v_person.metadata, '{}'::jsonb),
      'avatarUrl', v_person.metadata->>'avatar_url'
    ),
    'participant', case when v_participant.id is null then null else jsonb_build_object(
      'id', v_participant.id,
      'status', v_participant.status,
      'accessProfile', v_participant.access_profile,
      'completedAt', v_participant.completed_at,
      'metadata', coalesce(v_participant.metadata, '{}'::jsonb)
    ) end,
    'application', case when v_application.id is null then null else jsonb_build_object(
      'id', v_application.id,
      'code', v_application.code,
      'name', v_application.name,
      'status', v_application.status,
      'opensAt', v_application.opens_at,
      'closesAt', v_application.closes_at
    ) end,
    'isLeader', ('LEADER' = any(v_roles)),
    'roles', to_jsonb(v_roles),
    'modules', to_jsonb(v_modules),
    'canManageSurveys', public.can_manage_surveys()
  );
end;
$$;

grant execute on function public.get_my_platform_context() to authenticated;
grant execute on function public.unaccent_lower(text) to authenticated;

create or replace function public.search_team_candidates(target_application_id uuid, search_term text default '')
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person_id uuid;
  v_result jsonb;
begin
  v_person_id := public.current_person_id();
  if v_person_id is null then raise exception 'Cadastro institucional não identificado.'; end if;
  if not (public.has_active_role('LEADER') or public.can_manage_surveys()) then raise exception 'Você não possui permissão para pesquisar integrantes.'; end if;
  if not exists (select 1 from public.survey_applications where id = target_application_id) then raise exception 'O ciclo selecionado não foi encontrado.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'personId', p.id,
    'fullName', p.full_name,
    'employeeNumber', p.employee_number,
    'institutionalEmail', p.institutional_email,
    'jobTitle', p.job_title,
    'unit', coalesce(p.metadata->>'unit', p.metadata->>'unidade', p.cost_center),
    'workplace', p.workplace
  ) order by p.full_name), '[]'::jsonb)
  into v_result
  from (
    select p.*
    from public.application_participants ap
    join public.people p on p.id = ap.person_id
    where ap.application_id = target_application_id
      and p.id <> v_person_id
      and p.active = true
      and ap.status not in ('REMOVED','INELIGIBLE')
      and not exists (
        select 1 from public.cddi_leadership_links l
        where l.application_id = target_application_id
          and l.subordinate_person_id = p.id
          and l.status = 'ACTIVE'
          and l.valid_to is null
      )
      and (
        nullif(btrim(search_term), '') is null
        or public.unaccent_lower(p.full_name) like '%' || public.unaccent_lower(btrim(search_term)) || '%'
        or public.unaccent_lower(coalesce(p.institutional_email, '')) like '%' || public.unaccent_lower(btrim(search_term)) || '%'
        or public.unaccent_lower(coalesce(p.employee_number, '')) like '%' || public.unaccent_lower(btrim(search_term)) || '%'
        or public.unaccent_lower(coalesce(p.metadata->>'unit', p.metadata->>'unidade', p.cost_center, '')) like '%' || public.unaccent_lower(btrim(search_term)) || '%'
      )
    order by p.full_name
    limit 30
  ) p;

  return v_result;
end;
$$;

grant execute on function public.search_team_candidates(uuid, text) to authenticated;
