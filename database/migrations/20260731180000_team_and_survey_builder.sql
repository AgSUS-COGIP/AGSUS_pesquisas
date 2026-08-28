begin;

create or replace function public.get_my_team_workspace(target_application_code text default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person_id uuid;
  v_application public.survey_applications%rowtype;
  v_members jsonb;
begin
  v_person_id := public.current_person_id();
  if v_person_id is null then raise exception 'Cadastro institucional não identificado.'; end if;
  if not (public.has_active_role('LEADER') or public.can_manage_surveys()) then
    raise exception 'Somente lideranças autorizadas podem gerenciar equipes.';
  end if;

  if nullif(btrim(target_application_code), '') is not null then
    select * into v_application from public.survey_applications where code = btrim(target_application_code) limit 1;
  else
    select sa.* into v_application
    from public.survey_applications sa
    where exists (
      select 1 from public.application_participants ap
      where ap.application_id = sa.id and ap.person_id = v_person_id
    ) or exists (
      select 1 from public.cddi_leadership_links l
      where l.application_id = sa.id and l.leader_person_id = v_person_id
    )
    order by coalesce(sa.closes_at, sa.opens_at, sa.created_at) desc
    limit 1;
  end if;

  if v_application.id is null then
    select * into v_application from public.survey_applications
    order by coalesce(closes_at, opens_at, created_at) desc limit 1;
  end if;
  if v_application.id is null then raise exception 'Nenhum ciclo de pesquisa foi encontrado.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'linkId', l.id,
    'personId', p.id,
    'fullName', p.full_name,
    'employeeNumber', p.employee_number,
    'institutionalEmail', p.institutional_email,
    'jobTitle', p.job_title,
    'unit', coalesce(p.metadata->>'unit', p.cost_center),
    'workplace', p.workplace,
    'status', l.status,
    'validFrom', l.valid_from,
    'submissionStatus', s.status,
    'submissionUpdatedAt', s.updated_at
  ) order by p.full_name), '[]'::jsonb)
  into v_members
  from public.cddi_leadership_links l
  join public.people p on p.id = l.subordinate_person_id
  left join lateral (
    select sub.status, sub.updated_at
    from public.submissions sub
    where sub.application_id = l.application_id
      and sub.respondent_person_id = v_person_id
      and sub.subject_person_id = l.subordinate_person_id
      and sub.submission_type = 'CHEFIA'
    order by sub.updated_at desc limit 1
  ) s on true
  where l.application_id = v_application.id
    and l.leader_person_id = v_person_id
    and l.status = 'ACTIVE'
    and l.valid_to is null;

  return jsonb_build_object(
    'status', 'OK',
    'application', jsonb_build_object(
      'id', v_application.id,
      'code', v_application.code,
      'name', v_application.name,
      'status', v_application.status,
      'opensAt', v_application.opens_at,
      'closesAt', v_application.closes_at
    ),
    'members', v_members,
    'total', jsonb_array_length(v_members)
  );
end;
$$;

create or replace function public.search_team_candidates(
  target_application_id uuid,
  search_term text default ''
)
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
  if not (public.has_active_role('LEADER') or public.can_manage_surveys()) then
    raise exception 'Você não possui permissão para pesquisar integrantes.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'personId', p.id,
    'fullName', p.full_name,
    'employeeNumber', p.employee_number,
    'institutionalEmail', p.institutional_email,
    'jobTitle', p.job_title,
    'unit', coalesce(p.metadata->>'unit', p.cost_center),
    'workplace', p.workplace
  ) order by p.full_name), '[]'::jsonb)
  into v_result
  from (
    select p.*
    from public.application_participants ap
    join public.people p on p.id = ap.person_id
    where ap.application_id = target_application_id
      and p.id <> v_person_id
      and p.active
      and ap.status not in ('REMOVED', 'INELIGIBLE')
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
        or p.employee_number ilike '%' || btrim(search_term) || '%'
        or coalesce(p.institutional_email, '') ilike '%' || btrim(search_term) || '%'
      )
    order by p.full_name
    limit 30
  ) p;

  return v_result;
end;
$$;

create or replace function public.add_person_to_my_team(
  target_application_id uuid,
  target_person_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_leader_id uuid;
  v_link_id uuid;
  v_person_name text;
begin
  v_leader_id := public.current_person_id();
  if v_leader_id is null then raise exception 'Cadastro institucional não identificado.'; end if;
  if not (public.has_active_role('LEADER') or public.can_manage_surveys()) then
    raise exception 'Você não possui permissão para incluir integrantes.';
  end if;
  if target_person_id = v_leader_id then raise exception 'Uma pessoa não pode ser vinculada a si própria.'; end if;
  if not exists (
    select 1 from public.application_participants ap
    where ap.application_id = target_application_id and ap.person_id = target_person_id
      and ap.status not in ('REMOVED', 'INELIGIBLE')
  ) then raise exception 'A pessoa não participa deste ciclo.'; end if;
  if exists (
    select 1 from public.cddi_leadership_links l
    where l.application_id = target_application_id and l.subordinate_person_id = target_person_id
      and l.status = 'ACTIVE' and l.valid_to is null
  ) then raise exception 'A pessoa já possui uma liderança ativa neste ciclo.'; end if;

  insert into public.cddi_leadership_links (
    application_id, leader_person_id, subordinate_person_id, status, valid_from, origin, metadata
  ) values (
    target_application_id, v_leader_id, target_person_id, 'ACTIVE', timezone('utc', now()),
    'SELF_SERVICE', jsonb_build_object('created_by_role', case when public.can_manage_surveys() then 'TECHNICAL_TEAM' else 'LEADER' end)
  ) returning id into v_link_id;

  select full_name into v_person_name from public.people where id = target_person_id;
  insert into public.audit_events (actor_person_id, event_type, entity_type, entity_id, application_id, after_data, metadata)
  values (v_leader_id, 'TEAM_MEMBER_ADDED', 'CDDI_LEADERSHIP_LINK', v_link_id::text, target_application_id,
          jsonb_build_object('leaderPersonId', v_leader_id, 'subordinatePersonId', target_person_id), '{}'::jsonb);

  return jsonb_build_object('status', 'OK', 'linkId', v_link_id, 'personName', v_person_name);
end;
$$;

create or replace function public.remove_person_from_my_team(target_link_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor_id uuid;
  v_link public.cddi_leadership_links%rowtype;
  v_person_name text;
begin
  v_actor_id := public.current_person_id();
  if v_actor_id is null then raise exception 'Cadastro institucional não identificado.'; end if;

  select * into v_link from public.cddi_leadership_links where id = target_link_id for update;
  if v_link.id is null then raise exception 'Vínculo não encontrado.'; end if;
  if v_link.status <> 'ACTIVE' or v_link.valid_to is not null then raise exception 'O vínculo já foi encerrado.'; end if;
  if v_link.leader_person_id <> v_actor_id and not public.can_manage_surveys() then
    raise exception 'Você não possui permissão para retirar esta pessoa.';
  end if;

  update public.cddi_leadership_links
  set status = 'ENDED', valid_to = timezone('utc', now()), updated_at = timezone('utc', now())
  where id = target_link_id;

  select full_name into v_person_name from public.people where id = v_link.subordinate_person_id;
  insert into public.audit_events (actor_person_id, event_type, entity_type, entity_id, application_id, before_data, after_data, metadata)
  values (v_actor_id, 'TEAM_MEMBER_REMOVED', 'CDDI_LEADERSHIP_LINK', target_link_id::text, v_link.application_id,
          to_jsonb(v_link), jsonb_build_object('status', 'ENDED', 'validTo', timezone('utc', now())), '{}'::jsonb);

  return jsonb_build_object('status', 'OK', 'personName', v_person_name);
end;
$$;

create or replace function public.list_managed_surveys()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare v_result jsonb;
begin
  if not public.can_manage_surveys() then raise exception 'Acesso restrito à Equipe Técnica.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'surveyId', s.id,
    'code', s.code,
    'name', s.name,
    'description', s.description,
    'status', s.status,
    'versionId', sv.id,
    'versionNumber', sv.version_number,
    'versionStatus', sv.status,
    'applicationId', sa.id,
    'applicationCode', sa.code,
    'applicationName', sa.name,
    'applicationStatus', sa.status,
    'opensAt', sa.opens_at,
    'closesAt', sa.closes_at,
    'sections', (select count(*) from public.survey_sections sec where sec.survey_version_id = sv.id),
    'questions', (select count(*) from public.survey_questions q where q.survey_version_id = sv.id),
    'updatedAt', greatest(s.updated_at, sv.updated_at, coalesce(sa.updated_at, s.updated_at))
  ) order by greatest(s.updated_at, sv.updated_at, coalesce(sa.updated_at, s.updated_at)) desc), '[]'::jsonb)
  into v_result
  from public.surveys s
  join lateral (
    select * from public.survey_versions x where x.survey_id = s.id order by x.version_number desc limit 1
  ) sv on true
  left join lateral (
    select * from public.survey_applications a where a.survey_version_id = sv.id order by a.created_at desc limit 1
  ) sa on true;
  return v_result;
end;
$$;

create or replace function public.get_survey_builder(target_survey_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_survey public.surveys%rowtype;
  v_version public.survey_versions%rowtype;
  v_application public.survey_applications%rowtype;
  v_sections jsonb;
begin
  if not public.can_manage_surveys() then raise exception 'Acesso restrito à Equipe Técnica.'; end if;
  select * into v_survey from public.surveys where id = target_survey_id;
  if v_survey.id is null then raise exception 'Pesquisa não encontrada.'; end if;
  select * into v_version from public.survey_versions where survey_id = target_survey_id order by version_number desc limit 1;
  select * into v_application from public.survey_applications where survey_version_id = v_version.id order by created_at desc limit 1;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', sec.id,
    'code', sec.code,
    'title', sec.title,
    'description', sec.description,
    'position', sec.position,
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', q.id,
        'code', q.code,
        'title', q.title,
        'description', q.description,
        'questionType', q.question_type,
        'required', q.required,
        'position', q.position,
        'options', coalesce((select jsonb_agg(jsonb_build_object(
          'id', o.id, 'label', o.label, 'value', o.value, 'score', o.score, 'position', o.position
        ) order by o.position) from public.question_options o where o.question_id = q.id), '[]'::jsonb)
      ) order by q.position)
      from public.survey_questions q where q.section_id = sec.id
    ), '[]'::jsonb)
  ) order by sec.position), '[]'::jsonb)
  into v_sections
  from public.survey_sections sec where sec.survey_version_id = v_version.id;

  return jsonb_build_object(
    'status', 'OK',
    'survey', jsonb_build_object('id', v_survey.id, 'code', v_survey.code, 'name', v_survey.name, 'description', v_survey.description, 'status', v_survey.status),
    'version', jsonb_build_object('id', v_version.id, 'number', v_version.version_number, 'status', v_version.status),
    'application', jsonb_build_object('id', v_application.id, 'code', v_application.code, 'name', v_application.name, 'status', v_application.status, 'opensAt', v_application.opens_at, 'closesAt', v_application.closes_at),
    'sections', v_sections
  );
end;
$$;

create or replace function public.add_survey_section(
  target_survey_id uuid,
  section_title text,
  section_description text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare v_version_id uuid; v_position integer; v_id uuid;
begin
  if not public.can_manage_surveys() then raise exception 'Acesso restrito à Equipe Técnica.'; end if;
  if nullif(btrim(section_title), '') is null then raise exception 'Informe o título da seção.'; end if;
  select id into v_version_id from public.survey_versions
  where survey_id = target_survey_id and status = 'DRAFT' order by version_number desc limit 1;
  if v_version_id is null then raise exception 'A pesquisa não possui uma versão em rascunho.'; end if;
  select coalesce(max(position), 0) + 1 into v_position from public.survey_sections where survey_version_id = v_version_id;
  insert into public.survey_sections (survey_version_id, code, title, description, position, settings)
  values (v_version_id, 'S_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)), btrim(section_title), nullif(btrim(section_description), ''), v_position, '{}'::jsonb)
  returning id into v_id;
  return jsonb_build_object('status', 'OK', 'sectionId', v_id);
end;
$$;

create or replace function public.add_survey_question(
  target_survey_id uuid,
  target_section_id uuid,
  question_title text,
  question_description text,
  question_type text,
  is_required boolean default true,
  question_options jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_version_id uuid;
  v_position integer;
  v_question_id uuid;
  v_option jsonb;
  v_ordinal bigint;
  v_type text;
begin
  if not public.can_manage_surveys() then raise exception 'Acesso restrito à Equipe Técnica.'; end if;
  if nullif(btrim(question_title), '') is null then raise exception 'Informe o enunciado da pergunta.'; end if;
  v_type := upper(btrim(question_type));
  if v_type not in ('SHORT_TEXT','LONG_TEXT','INTEGER','DECIMAL','DATE','DATETIME','BOOLEAN','SINGLE_CHOICE','MULTIPLE_CHOICE','SCALE') then
    raise exception 'Tipo de pergunta não suportado neste construtor.';
  end if;
  select sv.id into v_version_id
  from public.survey_versions sv join public.survey_sections sec on sec.survey_version_id = sv.id
  where sv.survey_id = target_survey_id and sv.status = 'DRAFT' and sec.id = target_section_id
  order by sv.version_number desc limit 1;
  if v_version_id is null then raise exception 'Seção ou versão em rascunho não encontrada.'; end if;
  if v_type in ('SINGLE_CHOICE','MULTIPLE_CHOICE','SCALE') and jsonb_array_length(coalesce(question_options, '[]'::jsonb)) < 2 then
    raise exception 'Informe pelo menos duas alternativas.';
  end if;
  select coalesce(max(position), 0) + 1 into v_position from public.survey_questions where section_id = target_section_id;
  insert into public.survey_questions (
    survey_version_id, section_id, code, title, description, question_type, required, position,
    validation, display_logic, scoring, settings
  ) values (
    v_version_id, target_section_id, 'Q_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
    btrim(question_title), nullif(btrim(question_description), ''), v_type, is_required, v_position,
    '{}'::jsonb, '{}'::jsonb, '{}'::jsonb, '{}'::jsonb
  ) returning id into v_question_id;

  if v_type in ('SINGLE_CHOICE','MULTIPLE_CHOICE','SCALE') then
    for v_option, v_ordinal in select value, ordinality from jsonb_array_elements(question_options) with ordinality loop
      insert into public.question_options (question_id, code, label, value, score, position, active, metadata)
      values (
        v_question_id,
        'O' || lpad(v_ordinal::text, 2, '0'),
        coalesce(nullif(btrim(v_option->>'label'), ''), 'Opção ' || v_ordinal),
        coalesce(nullif(btrim(v_option->>'value'), ''), v_ordinal::text),
        case when nullif(v_option->>'score', '') is null then null else (v_option->>'score')::numeric end,
        v_ordinal::integer,
        true,
        '{}'::jsonb
      );
    end loop;
  end if;
  return jsonb_build_object('status', 'OK', 'questionId', v_question_id);
end;
$$;

create or replace function public.delete_survey_question(target_question_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare v_title text;
begin
  if not public.can_manage_surveys() then raise exception 'Acesso restrito à Equipe Técnica.'; end if;
  select q.title into v_title from public.survey_questions q
  join public.survey_versions sv on sv.id = q.survey_version_id
  where q.id = target_question_id and sv.status = 'DRAFT';
  if v_title is null then raise exception 'Pergunta em rascunho não encontrada.'; end if;
  delete from public.survey_questions where id = target_question_id;
  return jsonb_build_object('status', 'OK', 'title', v_title);
end;
$$;

grant execute on function public.get_my_team_workspace(text) to authenticated;
grant execute on function public.search_team_candidates(uuid, text) to authenticated;
grant execute on function public.add_person_to_my_team(uuid, uuid) to authenticated;
grant execute on function public.remove_person_from_my_team(uuid) to authenticated;
grant execute on function public.list_managed_surveys() to authenticated;
grant execute on function public.get_survey_builder(uuid) to authenticated;
grant execute on function public.add_survey_section(uuid, text, text) to authenticated;
grant execute on function public.add_survey_question(uuid, uuid, text, text, text, boolean, jsonb) to authenticated;
grant execute on function public.delete_survey_question(uuid) to authenticated;

commit;
