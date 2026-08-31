begin;

create or replace function public.resolve_authenticated_person(target_employee_number text default null)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  authenticated_user uuid := auth.uid();
  authenticated_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  candidate_count integer;
  selected_person public.people%rowtype;
  participant_record public.application_participants%rowtype;
  is_leader boolean;
begin
  if authenticated_user is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if authenticated_email = '' or authenticated_email not like '%@agenciasus.org.br' then
    return jsonb_build_object(
      'status', 'INVALID_DOMAIN',
      'message', 'Utilize um e-mail institucional @agenciasus.org.br.'
    );
  end if;

  select count(*)
    into candidate_count
  from public.person_access_identities pai
  join public.people p on p.id = pai.person_id
  where lower(pai.email) = authenticated_email
    and pai.status in ('PENDING', 'ACTIVE')
    and p.active = true
    and (target_employee_number is null or p.employee_number = btrim(target_employee_number));

  if target_employee_number is null then
    select count(*)
      into candidate_count
    from public.person_access_identities pai
    join public.people p on p.id = pai.person_id
    where lower(pai.email) = authenticated_email
      and pai.status in ('PENDING', 'ACTIVE')
      and p.active = true;
  end if;

  if candidate_count = 0 then
    return jsonb_build_object(
      'status', 'NOT_FOUND',
      'message', case
        when target_employee_number is null then 'O e-mail autenticado não possui identidade de acesso elegível no ciclo.'
        else 'A matrícula não corresponde ao e-mail autenticado.'
      end
    );
  end if;

  if candidate_count > 1 and target_employee_number is null then
    return jsonb_build_object(
      'status', 'NEEDS_EMPLOYEE_NUMBER',
      'message', 'Há mais de um cadastro associado ao e-mail. Informe sua matrícula.'
    );
  end if;

  select p.*
    into selected_person
  from public.person_access_identities pai
  join public.people p on p.id = pai.person_id
  where lower(pai.email) = authenticated_email
    and pai.status in ('PENDING', 'ACTIVE')
    and p.active = true
    and (target_employee_number is null or p.employee_number = btrim(target_employee_number))
  order by pai.status = 'ACTIVE' desc, pai.created_at
  limit 1;

  if selected_person.auth_user_id is not null and selected_person.auth_user_id <> authenticated_user then
    return jsonb_build_object(
      'status', 'ALREADY_LINKED',
      'message', 'Este cadastro já está vinculado a outra conta autenticada.'
    );
  end if;

  update public.people
     set auth_user_id = authenticated_user,
         updated_at = timezone('utc', now())
   where id = selected_person.id
     and (auth_user_id is null or auth_user_id = authenticated_user);

  update public.person_access_identities
     set status = 'ACTIVE',
         verified_at = coalesce(verified_at, timezone('utc', now())),
         updated_at = timezone('utc', now())
   where person_id = selected_person.id
     and lower(email) = authenticated_email
     and status in ('PENDING', 'ACTIVE');

  select ap.*
    into participant_record
  from public.application_participants ap
  join public.survey_applications sa on sa.id = ap.application_id
  where ap.person_id = selected_person.id
    and sa.code = 'CDDI-2026'
  order by ap.created_at desc
  limit 1;

  select exists (
    select 1
    from public.person_role_assignments pra
    join public.system_roles sr on sr.id = pra.role_id
    where pra.person_id = selected_person.id
      and sr.code = 'LEADER'
      and pra.starts_at <= timezone('utc', now())
      and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
  ) into is_leader;

  return jsonb_build_object(
    'status', 'OK',
    'person', jsonb_build_object(
      'id', selected_person.id,
      'employeeNumber', selected_person.employee_number,
      'fullName', selected_person.full_name,
      'institutionalEmail', selected_person.institutional_email,
      'jobTitle', selected_person.job_title,
      'costCenter', selected_person.cost_center,
      'workplace', selected_person.workplace,
      'metadata', selected_person.metadata
    ),
    'participant', case
      when participant_record.id is null then null
      else jsonb_build_object(
        'id', participant_record.id,
        'status', participant_record.status,
        'accessProfile', participant_record.access_profile,
        'completedAt', participant_record.completed_at,
        'metadata', participant_record.metadata
      )
    end,
    'isLeader', is_leader
  );
end;
$$;

create or replace function public.get_my_cddi_context()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select case
    when auth.uid() is null then jsonb_build_object('status', 'AUTH_REQUIRED')
    when public.current_person_id() is null then jsonb_build_object('status', 'UNLINKED')
    else (
      select jsonb_build_object(
        'status', 'OK',
        'person', jsonb_build_object(
          'id', p.id,
          'employeeNumber', p.employee_number,
          'fullName', p.full_name,
          'institutionalEmail', p.institutional_email,
          'jobTitle', p.job_title,
          'costCenter', p.cost_center,
          'workplace', p.workplace,
          'metadata', p.metadata
        ),
        'participant', jsonb_build_object(
          'id', ap.id,
          'status', ap.status,
          'accessProfile', ap.access_profile,
          'completedAt', ap.completed_at,
          'metadata', ap.metadata
        ),
        'application', jsonb_build_object(
          'id', sa.id,
          'code', sa.code,
          'name', sa.name,
          'status', sa.status,
          'opensAt', sa.opens_at,
          'closesAt', sa.closes_at
        ),
        'isLeader', public.has_active_role('LEADER')
      )
      from public.people p
      left join public.application_participants ap on ap.person_id = p.id
      left join public.survey_applications sa on sa.id = ap.application_id and sa.code = 'CDDI-2026'
      where p.id = public.current_person_id()
      order by ap.created_at desc nulls last
      limit 1
    )
  end;
$$;

revoke all on function public.resolve_authenticated_person(text) from public;
revoke all on function public.get_my_cddi_context() from public;
grant execute on function public.resolve_authenticated_person(text) to authenticated;
grant execute on function public.get_my_cddi_context() to authenticated;

comment on function public.resolve_authenticated_person(text) is
  'Vincula com segurança a conta autenticada ao cadastro elegível por e-mail e, quando necessário, matrícula.';
comment on function public.get_my_cddi_context() is
  'Retorna o contexto do participante autenticado no CDDI sem expor dados de terceiros.';

commit;
