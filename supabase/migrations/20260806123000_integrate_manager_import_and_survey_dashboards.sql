begin;

create or replace function public.sync_cddi_manager_rows(p_rows jsonb, p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_row jsonb;
  v_person public.people%rowtype;
  v_manager public.people%rowtype;
  v_application_id uuid;
  v_employee text;
  v_manager_name text;
  v_manager_email text;
  v_manager_matches integer;
  v_created integer := 0;
  v_updated integer := 0;
  v_preserved integer := 0;
  v_pending integer := 0;
begin
  if auth.role() <> 'service_role' and not public.can_manage_surveys() then
    raise exception 'Seu perfil não possui permissão para sincronizar chefias.';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'O conteúdo da importação deve ser uma lista de pessoas.';
  end if;

  select id into v_application_id
  from public.survey_applications
  where code = 'CDDI-2026'
  order by created_at desc
  limit 1;

  if v_application_id is null then
    return jsonb_build_object('status', 'SKIPPED', 'reason', 'CDDI_APPLICATION_NOT_FOUND');
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_employee := btrim(coalesce(v_row->>'employeeNumber', ''));
    v_manager_name := nullif(btrim(coalesce(v_row->>'managerName', '')), '');
    v_manager_email := nullif(lower(btrim(coalesce(v_row->>'managerEmail', ''))), '');

    select * into v_person from public.people where employee_number = v_employee limit 1;
    if v_person.id is null then v_pending := v_pending + 1; continue; end if;

    update public.people
    set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'manager_name', v_manager_name,
      'manager_email', v_manager_email,
      'manager_resolution', case when v_manager_email is null then 'MISSING_EMAIL' else 'PENDING' end,
      'manager_import_batch_id', p_batch_id,
      'manager_imported_at', timezone('utc', now())
    )), updated_at = timezone('utc', now())
    where id = v_person.id;

    if v_manager_email is null then v_pending := v_pending + 1; continue; end if;

    select count(*) into v_manager_matches
    from public.people p
    where p.active = true and lower(btrim(coalesce(p.institutional_email, ''))) = v_manager_email;

    if v_manager_matches <> 1 then
      update public.people
      set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{manager_resolution}', to_jsonb(case when v_manager_matches = 0 then 'NOT_FOUND' else 'AMBIGUOUS' end::text), true)
      where id = v_person.id;
      v_pending := v_pending + 1;
      continue;
    end if;

    select * into v_manager
    from public.people p
    where p.active = true and lower(btrim(coalesce(p.institutional_email, ''))) = v_manager_email
    limit 1;

    if v_manager.id = v_person.id then
      update public.people set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{manager_resolution}', '"SELF_REFERENCE"'::jsonb, true) where id = v_person.id;
      v_pending := v_pending + 1;
      continue;
    end if;

    if exists (
      select 1 from public.cddi_leadership_links l
      where l.application_id = v_application_id and l.subordinate_person_id = v_person.id
        and l.status = 'ACTIVE' and l.valid_to is null
        and l.origin in ('SELF_DECLARED', 'SELF_SERVICE', 'ADMIN_CORRECTION', 'ADMINISTRATIVE')
    ) then
      update public.people set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{manager_resolution}', '"PRESERVED_MANUAL_LINK"'::jsonb, true) where id = v_person.id;
      v_preserved := v_preserved + 1;
      continue;
    end if;

    if exists (
      select 1 from public.cddi_leadership_links l
      where l.application_id = v_application_id and l.subordinate_person_id = v_person.id
        and l.status = 'ACTIVE' and l.valid_to is null
    ) then
      update public.cddi_leadership_links
      set leader_person_id = v_manager.id,
          origin = 'PEOPLE_BASE_IMPORT',
          source_key = 'PEOPLE_BASE:' || v_person.employee_number,
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('manager_name', v_manager_name, 'manager_email', v_manager_email, 'import_batch_id', p_batch_id),
          updated_at = timezone('utc', now())
      where application_id = v_application_id and subordinate_person_id = v_person.id and status = 'ACTIVE' and valid_to is null;
      v_updated := v_updated + 1;
    else
      insert into public.cddi_leadership_links(application_id, leader_person_id, subordinate_person_id, status, valid_from, origin, source_key, metadata)
      values(v_application_id, v_manager.id, v_person.id, 'ACTIVE', timezone('utc', now()), 'PEOPLE_BASE_IMPORT', 'PEOPLE_BASE:' || v_person.employee_number,
        jsonb_build_object('manager_name', v_manager_name, 'manager_email', v_manager_email, 'import_batch_id', p_batch_id));
      v_created := v_created + 1;
    end if;

    update public.people set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{manager_resolution}', '"RESOLVED"'::jsonb, true) where id = v_person.id;
  end loop;

  return jsonb_build_object('status', 'OK', 'created', v_created, 'updated', v_updated, 'preserved', v_preserved, 'pending', v_pending);
end;
$$;

revoke all on function public.sync_cddi_manager_rows(jsonb, uuid) from public, anon, authenticated;
grant execute on function public.sync_cddi_manager_rows(jsonb, uuid) to service_role;

create or replace function public.get_survey_dashboard(target_application_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare v_application_id uuid; v_payload jsonb;
begin
  if not public.can_manage_surveys() then raise exception 'Acesso restrito à Equipe Técnica.'; end if;
  select id into v_application_id from public.survey_applications where code = btrim(target_application_code) limit 1;
  if v_application_id is null then raise exception 'Pesquisa ou ciclo não localizado.'; end if;

  with app as (
    select sa.*, sv.title version_title, sv.description version_description, sv.version_number,
           s.code survey_code, s.name survey_name, s.description survey_description
    from public.survey_applications sa
    join public.survey_versions sv on sv.id = sa.survey_version_id
    join public.surveys s on s.id = sv.survey_id
    where sa.id = v_application_id
  ), latest_submissions as (
    select distinct on (s.participant_id) s.id, s.participant_id, s.status, s.updated_at
    from public.submissions s where s.application_id = v_application_id
    order by s.participant_id, s.updated_at desc
  ), participant_summary as (
    select count(*) total,
      count(*) filter (where sub.status = 'DRAFT') drafts,
      count(*) filter (where sub.status in ('SUBMITTED', 'VALIDATED')) submitted,
      count(*) filter (where sub.id is null) not_started
    from public.application_participants ap
    left join latest_submissions sub on sub.participant_id = ap.id
    where ap.application_id = v_application_id and ap.status not in ('REMOVED', 'INELIGIBLE', 'EXCLUDED')
  ), question_rows as (
    select q.id, q.code, q.title, q.description, q.question_type, q.position,
      sec.id section_id, sec.title section_title, sec.position section_position
    from public.survey_questions q
    join public.survey_sections sec on sec.id = q.section_id
    join app on app.survey_version_id = q.survey_version_id
  ), submitted_answers as (
    select a.*, s.submitted_at
    from public.answers a join public.submissions s on s.id = a.submission_id
    where s.application_id = v_application_id and s.status in ('SUBMITTED', 'VALIDATED')
  ), option_counts as (
    select ao.question_id, ao.option_id, count(*) answer_count
    from public.answer_options ao join submitted_answers a on a.id = ao.answer_id
    group by ao.question_id, ao.option_id
  )
  select jsonb_build_object(
    'status', 'OK', 'generatedAt', timezone('utc', now()),
    'application', (select jsonb_build_object(
      'id', id, 'code', code, 'name', name, 'status', status, 'opensAt', opens_at, 'closesAt', closes_at,
      'surveyCode', survey_code, 'surveyName', survey_name,
      'surveyDescription', coalesce(survey_description, version_description),
      'versionTitle', version_title, 'versionNumber', version_number) from app),
    'summary', (select jsonb_build_object(
      'totalParticipants', total, 'drafts', drafts, 'submitted', submitted, 'notStarted', not_started,
      'completionRate', case when total = 0 then 0 else round(submitted::numeric * 100 / total, 1) end) from participant_summary),
    'questions', coalesce((select jsonb_agg(jsonb_build_object(
      'id', qr.id, 'code', qr.code, 'title', qr.title, 'description', qr.description,
      'type', qr.question_type, 'position', qr.position, 'sectionId', qr.section_id,
      'sectionTitle', qr.section_title, 'sectionPosition', qr.section_position,
      'responseCount', (select count(*) from submitted_answers a where a.question_id = qr.id),
      'options', coalesce((select jsonb_agg(jsonb_build_object(
        'id', o.id, 'label', o.label, 'value', o.value, 'count', coalesce(oc.answer_count, 0)) order by o.position)
        from public.question_options o left join option_counts oc on oc.question_id = qr.id and oc.option_id = o.id
        where o.question_id = qr.id and o.active), '[]'::jsonb),
      'textResponses', coalesce((select jsonb_agg(jsonb_build_object(
        'text', left(sample.answer_text, 1000), 'submittedAt', sample.submitted_at) order by sample.submitted_at desc)
        from (select a.answer_text, a.submitted_at from submitted_answers a
          where a.question_id = qr.id and nullif(btrim(a.answer_text), '') is not null
          order by a.submitted_at desc limit 100) sample), '[]'::jsonb)
    ) order by qr.section_position, qr.position) from question_rows qr), '[]'::jsonb)
  ) into v_payload;
  return v_payload;
end;
$$;

revoke all on function public.get_survey_dashboard(text) from public, anon;
grant execute on function public.get_survey_dashboard(text) to authenticated;

with target as (
  select p.id subordinate_id, manager.id leader_id, app.id application_id
  from public.people p
  join public.people manager on lower(btrim(coalesce(manager.institutional_email, ''))) = 'felipe.mendes@agenciasus.org.br' and manager.active = true
  join public.survey_applications app on app.code = 'CDDI-2026'
  where p.employee_number = '294446' and p.active = true
)
insert into public.cddi_leadership_links(application_id, leader_person_id, subordinate_person_id, status, valid_from, origin, source_key, metadata)
select application_id, leader_id, subordinate_id, 'ACTIVE', timezone('utc', now()), 'PEOPLE_BASE_IMPORT', 'PEOPLE_BASE:294446',
  jsonb_build_object('manager_name', 'FELIPE RODRIGO DE MORAES MENDES', 'manager_email', 'felipe.mendes@agenciasus.org.br', 'repair_reason', 'OFFICIAL_NORMALIZED_BASE')
from target t
where not exists (select 1 from public.cddi_leadership_links l
  where l.application_id = t.application_id and l.subordinate_person_id = t.subordinate_id and l.status = 'ACTIVE' and l.valid_to is null)
on conflict (application_id, source_key) do update set
  leader_person_id = excluded.leader_person_id, subordinate_person_id = excluded.subordinate_person_id,
  status = 'ACTIVE', valid_from = timezone('utc', now()), valid_to = null, origin = excluded.origin,
  metadata = coalesce(public.cddi_leadership_links.metadata, '{}'::jsonb) || excluded.metadata,
  updated_at = timezone('utc', now());

notify pgrst, 'reload schema';
commit;
