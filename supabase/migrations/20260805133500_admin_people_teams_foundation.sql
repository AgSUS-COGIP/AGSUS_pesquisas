begin;

create or replace function public.search_platform_admin_people(
  target_search text default null,
  target_limit integer default 50
)
returns table (
  person_id uuid,
  employee_number text,
  full_name text,
  institutional_email text,
  job_title text,
  cost_center text,
  workplace text,
  directorate text,
  organizational_unit text,
  coordination text,
  employment_status text,
  active boolean,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_search text := lower(btrim(coalesce(target_search, '')));
  v_limit integer := least(greatest(coalesce(target_limit, 50), 1), 100);
begin
  if not public.is_platform_administrator() then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;

  return query
  select
    p.id,
    p.employee_number,
    p.full_name,
    p.institutional_email,
    p.job_title,
    p.cost_center,
    p.workplace,
    nullif(btrim(coalesce(p.metadata->>'directorate', '')), ''),
    nullif(btrim(coalesce(p.metadata->>'unit', '')), ''),
    nullif(btrim(coalesce(p.metadata->>'coordination', '')), ''),
    p.employment_status,
    p.active,
    p.updated_at
  from public.people p
  where v_search = ''
     or lower(p.full_name) like '%' || v_search || '%'
     or lower(p.employee_number) like '%' || v_search || '%'
     or lower(coalesce(p.institutional_email, '')) like '%' || v_search || '%'
     or lower(coalesce(p.job_title, '')) like '%' || v_search || '%'
     or lower(coalesce(p.cost_center, '')) like '%' || v_search || '%'
     or lower(coalesce(p.workplace, '')) like '%' || v_search || '%'
     or lower(coalesce(p.metadata->>'directorate', '')) like '%' || v_search || '%'
     or lower(coalesce(p.metadata->>'unit', '')) like '%' || v_search || '%'
     or lower(coalesce(p.metadata->>'coordination', '')) like '%' || v_search || '%'
  order by p.active desc, p.full_name
  limit v_limit;
end;
$function$;

create or replace function public.update_platform_admin_person(
  target_person_id uuid,
  target_full_name text,
  target_institutional_email text default null,
  target_job_title text default null,
  target_cost_center text default null,
  target_workplace text default null,
  target_directorate text default null,
  target_organizational_unit text default null,
  target_coordination text default null,
  target_employment_status text default 'ATIVO',
  target_active boolean default true,
  target_justification text default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_actor_id uuid;
  v_before public.people%rowtype;
  v_after public.people%rowtype;
  v_before_data jsonb;
  v_after_data jsonb;
  v_name text := btrim(coalesce(target_full_name, ''));
  v_email text := lower(btrim(coalesce(target_institutional_email, '')));
  v_status text := upper(btrim(coalesce(target_employment_status, 'ATIVO')));
  v_justification text := btrim(coalesce(target_justification, ''));
begin
  if not public.is_platform_administrator() then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;

  v_actor_id := public.current_person_id();
  if v_actor_id is null then
    raise exception 'Cadastro institucional do administrador não identificado.';
  end if;
  if length(v_justification) < 10 then
    raise exception 'Informe uma justificativa com pelo menos 10 caracteres.';
  end if;
  if v_name = '' then
    raise exception 'O nome completo é obrigatório.';
  end if;
  if v_status = '' then
    raise exception 'A situação funcional é obrigatória.';
  end if;
  if v_email <> '' and not public.is_allowed_institutional_email(v_email) then
    raise exception 'Informe um e-mail institucional AgSUS válido.';
  end if;

  select * into v_before
  from public.people
  where id = target_person_id
  for update;

  if v_before.id is null then
    raise exception 'Pessoa não encontrada.';
  end if;

  if v_email <> '' and exists (
    select 1
    from public.people other
    where other.id <> target_person_id
      and lower(btrim(coalesce(other.institutional_email, ''))) = v_email
  ) then
    raise exception 'O e-mail informado já pertence a outra pessoa.';
  end if;

  v_before_data := jsonb_strip_nulls(jsonb_build_object(
    'personId', v_before.id,
    'employeeNumber', v_before.employee_number,
    'fullName', v_before.full_name,
    'institutionalEmail', v_before.institutional_email,
    'jobTitle', v_before.job_title,
    'costCenter', v_before.cost_center,
    'workplace', v_before.workplace,
    'directorate', nullif(btrim(coalesce(v_before.metadata->>'directorate', '')), ''),
    'organizationalUnit', nullif(btrim(coalesce(v_before.metadata->>'unit', '')), ''),
    'coordination', nullif(btrim(coalesce(v_before.metadata->>'coordination', '')), ''),
    'employmentStatus', v_before.employment_status,
    'active', v_before.active
  ));

  update public.people
  set full_name = v_name,
      institutional_email = nullif(v_email, ''),
      job_title = nullif(btrim(coalesce(target_job_title, '')), ''),
      cost_center = nullif(btrim(coalesce(target_cost_center, '')), ''),
      workplace = nullif(btrim(coalesce(target_workplace, '')), ''),
      employment_status = v_status,
      active = coalesce(target_active, true),
      metadata = (
        coalesce(metadata, '{}'::jsonb) - 'directorate' - 'unit' - 'coordination'
      ) || jsonb_strip_nulls(jsonb_build_object(
        'directorate', nullif(btrim(coalesce(target_directorate, '')), ''),
        'unit', nullif(btrim(coalesce(target_organizational_unit, '')), ''),
        'coordination', nullif(btrim(coalesce(target_coordination, '')), ''),
        'last_admin_update_by', v_actor_id,
        'last_admin_update_at', timezone('utc', now()),
        'last_admin_update_justification', v_justification
      )),
      updated_at = timezone('utc', now())
  where id = target_person_id
  returning * into v_after;

  v_after_data := jsonb_strip_nulls(jsonb_build_object(
    'personId', v_after.id,
    'employeeNumber', v_after.employee_number,
    'fullName', v_after.full_name,
    'institutionalEmail', v_after.institutional_email,
    'jobTitle', v_after.job_title,
    'costCenter', v_after.cost_center,
    'workplace', v_after.workplace,
    'directorate', nullif(btrim(coalesce(v_after.metadata->>'directorate', '')), ''),
    'organizationalUnit', nullif(btrim(coalesce(v_after.metadata->>'unit', '')), ''),
    'coordination', nullif(btrim(coalesce(v_after.metadata->>'coordination', '')), ''),
    'employmentStatus', v_after.employment_status,
    'active', v_after.active
  ));

  insert into public.audit_events(
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'PERSON_FUNCTIONAL_DATA_UPDATED',
    'PERSON',
    target_person_id::text,
    v_before_data,
    v_after_data,
    jsonb_build_object('justification', v_justification)
  );

  return jsonb_build_object(
    'status', 'OK',
    'personId', v_after.id,
    'employeeNumber', v_after.employee_number,
    'fullName', v_after.full_name
  );
end;
$function$;

create or replace function public.list_platform_admin_person_audit(
  target_person_id uuid,
  target_limit integer default 30
)
returns table (
  event_id bigint,
  event_type text,
  actor_person_id uuid,
  actor_name text,
  before_data jsonb,
  after_data jsonb,
  justification text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_limit integer := least(greatest(coalesce(target_limit, 30), 1), 100);
begin
  if not public.is_platform_administrator() then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;
  if not exists (select 1 from public.people where id = target_person_id) then
    raise exception 'Pessoa não encontrada.';
  end if;

  return query
  select
    event.id,
    event.event_type,
    event.actor_person_id,
    actor.full_name,
    event.before_data,
    event.after_data,
    nullif(btrim(coalesce(event.metadata->>'justification', '')), ''),
    event.created_at
  from public.audit_events event
  left join public.people actor on actor.id = event.actor_person_id
  where event.entity_type = 'PERSON'
    and event.entity_id = target_person_id::text
  order by event.created_at desc
  limit v_limit;
end;
$function$;

create or replace function public.list_platform_admin_leadership_links(
  target_application_id uuid,
  target_search text default null,
  target_limit integer default 100
)
returns table (
  link_id uuid,
  application_id uuid,
  leader_person_id uuid,
  leader_name text,
  leader_employee_number text,
  subordinate_person_id uuid,
  subordinate_name text,
  subordinate_employee_number text,
  status text,
  valid_from timestamptz,
  valid_to timestamptz,
  origin text
)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_search text := lower(btrim(coalesce(target_search, '')));
  v_limit integer := least(greatest(coalesce(target_limit, 100), 1), 250);
begin
  if not public.is_platform_administrator() then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;
  if not exists (select 1 from public.survey_applications where id = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  return query
  select
    link.id,
    link.application_id,
    link.leader_person_id,
    leader.full_name,
    leader.employee_number,
    link.subordinate_person_id,
    subordinate.full_name,
    subordinate.employee_number,
    link.status,
    link.valid_from,
    link.valid_to,
    link.origin
  from public.cddi_leadership_links link
  join public.people leader on leader.id = link.leader_person_id
  join public.people subordinate on subordinate.id = link.subordinate_person_id
  where link.application_id = target_application_id
    and (
      v_search = ''
      or lower(leader.full_name) like '%' || v_search || '%'
      or lower(leader.employee_number) like '%' || v_search || '%'
      or lower(subordinate.full_name) like '%' || v_search || '%'
      or lower(subordinate.employee_number) like '%' || v_search || '%'
    )
  order by (link.status = 'ACTIVE' and link.valid_to is null) desc, subordinate.full_name, link.valid_from desc
  limit v_limit;
end;
$function$;

create or replace function public.set_platform_admin_leadership_link(
  target_application_id uuid,
  target_subordinate_person_id uuid,
  target_leader_person_id uuid,
  target_justification text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_actor_id uuid;
  v_justification text := btrim(coalesce(target_justification, ''));
  v_previous public.cddi_leadership_links%rowtype;
  v_new_link public.cddi_leadership_links%rowtype;
  v_leader_name text;
  v_subordinate_name text;
begin
  if not public.is_platform_administrator() then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;

  v_actor_id := public.current_person_id();
  if v_actor_id is null then
    raise exception 'Cadastro institucional do administrador não identificado.';
  end if;
  if length(v_justification) < 10 then
    raise exception 'Informe uma justificativa com pelo menos 10 caracteres.';
  end if;
  if target_leader_person_id = target_subordinate_person_id then
    raise exception 'Uma pessoa não pode ser liderança de si própria.';
  end if;
  if not exists (select 1 from public.survey_applications where id = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  select full_name into v_leader_name
  from public.people
  where id = target_leader_person_id and active;
  if v_leader_name is null then
    raise exception 'Liderança ativa não encontrada.';
  end if;

  select full_name into v_subordinate_name
  from public.people
  where id = target_subordinate_person_id and active;
  if v_subordinate_name is null then
    raise exception 'Integrante ativo não encontrado.';
  end if;

  select * into v_previous
  from public.cddi_leadership_links
  where application_id = target_application_id
    and subordinate_person_id = target_subordinate_person_id
    and status = 'ACTIVE'
    and valid_to is null
  order by valid_from desc
  limit 1
  for update;

  if v_previous.id is not null and v_previous.leader_person_id = target_leader_person_id then
    raise exception 'A pessoa já está vinculada a esta liderança no ciclo selecionado.';
  end if;

  if v_previous.id is not null then
    update public.cddi_leadership_links
    set status = 'ENDED',
        valid_to = timezone('utc', now()),
        metadata = coalesce(metadata, '{}'::jsonb)
          || jsonb_build_object(
            'ended_by_admin', v_actor_id,
            'end_justification', v_justification
          ),
        updated_at = timezone('utc', now())
    where id = v_previous.id;
  end if;

  insert into public.cddi_leadership_links(
    application_id,
    leader_person_id,
    subordinate_person_id,
    status,
    valid_from,
    origin,
    metadata
  ) values (
    target_application_id,
    target_leader_person_id,
    target_subordinate_person_id,
    'ACTIVE',
    timezone('utc', now()),
    'ADMIN_CORRECTION',
    jsonb_build_object(
      'created_by_admin', v_actor_id,
      'justification', v_justification,
      'replaces_link_id', v_previous.id
    )
  ) returning * into v_new_link;

  insert into public.audit_events(
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'LEADERSHIP_LINK_CORRECTED',
    'CDDI_LEADERSHIP_LINK',
    v_new_link.id::text,
    target_application_id,
    case when v_previous.id is null then null else to_jsonb(v_previous) end,
    to_jsonb(v_new_link),
    jsonb_build_object(
      'justification', v_justification,
      'leaderName', v_leader_name,
      'subordinateName', v_subordinate_name
    )
  );

  return jsonb_build_object(
    'status', 'OK',
    'linkId', v_new_link.id,
    'leaderName', v_leader_name,
    'subordinateName', v_subordinate_name,
    'replacedLinkId', v_previous.id
  );
end;
$function$;

revoke all on function public.search_platform_admin_people(text, integer) from public, anon;
revoke all on function public.update_platform_admin_person(uuid, text, text, text, text, text, text, text, text, text, boolean, text) from public, anon;
revoke all on function public.list_platform_admin_person_audit(uuid, integer) from public, anon;
revoke all on function public.list_platform_admin_leadership_links(uuid, text, integer) from public, anon;
revoke all on function public.set_platform_admin_leadership_link(uuid, uuid, uuid, text) from public, anon;

grant execute on function public.search_platform_admin_people(text, integer) to authenticated;
grant execute on function public.update_platform_admin_person(uuid, text, text, text, text, text, text, text, text, text, boolean, text) to authenticated;
grant execute on function public.list_platform_admin_person_audit(uuid, integer) to authenticated;
grant execute on function public.list_platform_admin_leadership_links(uuid, text, integer) to authenticated;
grant execute on function public.set_platform_admin_leadership_link(uuid, uuid, uuid, text) to authenticated;

commit;
