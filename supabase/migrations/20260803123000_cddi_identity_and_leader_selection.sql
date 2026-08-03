create or replace function public.get_my_cddi_identity(target_application_code text default 'CDDI-2026')
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person_id uuid;
  v_application_id uuid;
  v_result jsonb;
begin
  v_person_id := public.current_person_id();
  if v_person_id is null then raise exception 'Cadastro institucional não identificado.'; end if;
  select id into v_application_id from public.survey_applications where code = btrim(target_application_code) limit 1;
  if v_application_id is null then raise exception 'Ciclo de pesquisa não encontrado.'; end if;

  select jsonb_build_object(
    'person', jsonb_build_object(
      'id', p.id,
      'employeeNumber', p.employee_number,
      'fullName', p.full_name,
      'institutionalEmail', p.institutional_email,
      'jobTitle', p.job_title,
      'directorate', coalesce(p.metadata->>'directorate', p.metadata->>'diretoria'),
      'unit', coalesce(p.metadata->>'unit', p.metadata->>'unidade', p.cost_center),
      'coordination', coalesce(p.metadata->>'coordination', p.metadata->>'coordenacao'),
      'workplace', p.workplace,
      'metadata', p.metadata
    ),
    'leader', case when leader.id is null then null else jsonb_build_object(
      'personId', leader.id,
      'fullName', leader.full_name,
      'institutionalEmail', leader.institutional_email,
      'employeeNumber', leader.employee_number,
      'jobTitle', leader.job_title,
      'unit', coalesce(leader.metadata->>'unit', leader.metadata->>'unidade', leader.cost_center),
      'coordination', coalesce(leader.metadata->>'coordination', leader.metadata->>'coordenacao')
    ) end,
    'canChangeLeader', (app.status = 'OPEN' or public.can_manage_surveys())
  ) into v_result
  from public.people p
  cross join public.survey_applications app
  left join lateral (
    select lp.*
    from public.cddi_leadership_links l
    join public.people lp on lp.id = l.leader_person_id
    where l.application_id = v_application_id
      and l.subordinate_person_id = p.id
      and l.status = 'ACTIVE'
      and l.valid_to is null
    order by l.valid_from desc
    limit 1
  ) leader on true
  where p.id = v_person_id and app.id = v_application_id;
  return v_result;
end;
$$;

create or replace function public.search_cddi_leaders(target_application_code text default 'CDDI-2026', search_term text default '')
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person_id uuid;
  v_application_id uuid;
  v_result jsonb;
begin
  v_person_id := public.current_person_id();
  if v_person_id is null then raise exception 'Cadastro institucional não identificado.'; end if;
  select id into v_application_id from public.survey_applications where code = btrim(target_application_code) limit 1;
  if v_application_id is null then raise exception 'Ciclo de pesquisa não encontrado.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'personId', p.id,
    'fullName', p.full_name,
    'institutionalEmail', p.institutional_email,
    'employeeNumber', p.employee_number,
    'jobTitle', p.job_title,
    'unit', coalesce(p.metadata->>'unit', p.metadata->>'unidade', p.cost_center),
    'coordination', coalesce(p.metadata->>'coordination', p.metadata->>'coordenacao')
  ) order by p.full_name), '[]'::jsonb)
  into v_result
  from (
    select p.*
    from public.people p
    where p.active = true
      and p.id <> v_person_id
      and (
        exists (
          select 1
          from public.person_role_assignments pra
          join public.system_roles sr on sr.id = pra.role_id
          where pra.person_id = p.id
            and sr.code = 'LEADER'
            and pra.starts_at <= timezone('utc', now())
            and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
        )
        or upper(coalesce(p.job_title, '')) like '%COORDEN%'
        or upper(coalesce(p.job_title, '')) like '%GESTOR%'
        or upper(coalesce(p.job_title, '')) like '%GERENTE%'
      )
      and (
        nullif(btrim(search_term), '') is null
        or public.unaccent_lower(p.full_name) like '%' || public.unaccent_lower(btrim(search_term)) || '%'
        or coalesce(p.institutional_email, '') ilike '%' || btrim(search_term) || '%'
        or p.employee_number ilike '%' || btrim(search_term) || '%'
        or public.unaccent_lower(coalesce(p.metadata->>'unit', p.metadata->>'unidade', p.cost_center, '')) like '%' || public.unaccent_lower(btrim(search_term)) || '%'
      )
    order by p.full_name
    limit 20
  ) p;
  return v_result;
end;
$$;

create or replace function public.set_my_cddi_leader(target_application_code text, target_leader_person_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person_id uuid;
  v_application public.survey_applications%rowtype;
  v_link_id uuid;
  v_leader public.people%rowtype;
begin
  v_person_id := public.current_person_id();
  if v_person_id is null then raise exception 'Cadastro institucional não identificado.'; end if;
  select * into v_application from public.survey_applications where code = btrim(target_application_code) limit 1;
  if v_application.id is null then raise exception 'Ciclo de pesquisa não encontrado.'; end if;
  if v_application.status <> 'OPEN' and not public.can_manage_surveys() then raise exception 'O período do ciclo está encerrado para alteração da chefia.'; end if;
  if target_leader_person_id = v_person_id then raise exception 'Você não pode indicar a si próprio como chefia.'; end if;
  select * into v_leader from public.people where id = target_leader_person_id and active = true;
  if v_leader.id is null then raise exception 'A liderança selecionada não está ativa.'; end if;

  update public.cddi_leadership_links
  set status = 'ENDED', valid_to = timezone('utc', now()), updated_at = timezone('utc', now())
  where application_id = v_application.id
    and subordinate_person_id = v_person_id
    and status = 'ACTIVE'
    and valid_to is null;

  insert into public.cddi_leadership_links (
    application_id, leader_person_id, subordinate_person_id, status, valid_from, origin, metadata
  ) values (
    v_application.id, target_leader_person_id, v_person_id, 'ACTIVE', timezone('utc', now()), 'SELF_DECLARED', jsonb_build_object('declared_by_person_id', v_person_id)
  ) returning id into v_link_id;

  insert into public.audit_events (
    actor_person_id, event_type, entity_type, entity_id, application_id, after_data, metadata
  ) values (
    v_person_id, 'CDDI_LEADER_SELECTED', 'CDDI_LEADERSHIP_LINK', v_link_id::text, v_application.id,
    jsonb_build_object('leaderPersonId', target_leader_person_id, 'subordinatePersonId', v_person_id), '{}'::jsonb
  );

  return jsonb_build_object(
    'status', 'OK',
    'linkId', v_link_id,
    'leader', jsonb_build_object(
      'personId', v_leader.id,
      'fullName', v_leader.full_name,
      'institutionalEmail', v_leader.institutional_email,
      'employeeNumber', v_leader.employee_number,
      'jobTitle', v_leader.job_title,
      'unit', coalesce(v_leader.metadata->>'unit', v_leader.metadata->>'unidade', v_leader.cost_center),
      'coordination', coalesce(v_leader.metadata->>'coordination', v_leader.metadata->>'coordenacao')
    )
  );
end;
$$;

grant execute on function public.get_my_cddi_identity(text) to authenticated;
grant execute on function public.search_cddi_leaders(text, text) to authenticated;
grant execute on function public.set_my_cddi_leader(text, uuid) to authenticated;