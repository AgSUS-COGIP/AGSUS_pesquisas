begin;

create table if not exists public.platform_modules (
  code text primary key,
  name text not null,
  description text,
  category text not null default 'MAIN',
  position integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.role_module_permissions (
  role_id uuid not null references public.system_roles(id) on delete cascade,
  module_code text not null references public.platform_modules(code) on delete cascade,
  allowed boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (role_id, module_code)
);

create table if not exists public.person_module_permissions (
  person_id uuid not null references public.people(id) on delete cascade,
  module_code text not null references public.platform_modules(code) on delete cascade,
  allowed boolean not null,
  granted_by uuid references public.people(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (person_id, module_code)
);

insert into public.platform_modules (code, name, category, position) values
  ('HOME', 'Início', 'MAIN', 10),
  ('SURVEYS', 'Pesquisas', 'MAIN', 20),
  ('DASHBOARDS', 'Painéis', 'MAIN', 30),
  ('TEAM', 'Minha equipe', 'WORK', 40),
  ('RESULTS', 'Meus resultados', 'WORK', 50),
  ('ADMIN_SURVEYS', 'Pesquisas e ciclos', 'ADMIN', 100),
  ('ADMIN_PARTICIPANTS', 'Participantes', 'ADMIN', 110),
  ('ADMIN_TEAMS', 'Equipes e lideranças', 'ADMIN', 120),
  ('ADMIN_ACCESS', 'Acessos e permissões', 'ADMIN', 130),
  ('ADMIN_IMPORT', 'Importações', 'ADMIN', 140)
on conflict (code) do update set
  name = excluded.name,
  category = excluded.category,
  position = excluded.position,
  active = true;

insert into public.role_module_permissions (role_id, module_code, allowed)
select r.id, m.code, true
from public.system_roles r
join public.platform_modules m on (
  r.code = 'ADMINISTRATOR'
  or (r.code = 'SURVEY_MANAGER' and m.code <> 'ADMIN_ACCESS')
  or (r.code = 'AUDITOR' and m.code in ('HOME','SURVEYS','DASHBOARDS','RESULTS'))
  or (r.code = 'LEADER' and m.code in ('HOME','SURVEYS','DASHBOARDS','TEAM','RESULTS'))
  or (r.code = 'RESPONDENT' and m.code in ('HOME','SURVEYS','DASHBOARDS','RESULTS'))
)
on conflict (role_id, module_code) do update set allowed = true;

create or replace function public.get_my_platform_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person_id uuid := public.current_person_id();
  v_person public.people%rowtype;
  v_participant public.application_participants%rowtype;
  v_application public.survey_applications%rowtype;
  v_roles jsonb := '[]'::jsonb;
  v_modules jsonb := '[]'::jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'AUTH_REQUIRED');
  end if;

  if v_person_id is null then
    return jsonb_build_object('status', 'UNLINKED', 'message', 'Conta sem cadastro institucional vinculado.');
  end if;

  select * into v_person from public.people where id = v_person_id;

  select ap.* into v_participant
  from public.application_participants ap
  where ap.person_id = v_person_id
  order by ap.created_at desc
  limit 1;

  if found then
    select * into v_application
    from public.survey_applications
    where id = v_participant.application_id;
  end if;

  select coalesce(jsonb_agg(r.code order by r.code), '[]'::jsonb)
    into v_roles
  from public.person_role_assignments pra
  join public.system_roles r on r.id = pra.role_id
  where pra.person_id = v_person_id
    and pra.starts_at <= now()
    and (pra.ends_at is null or pra.ends_at > now());

  select coalesce(jsonb_agg(module_code order by position), '[]'::jsonb)
    into v_modules
  from (
    select m.code as module_code, m.position
    from public.platform_modules m
    where m.active = true
      and coalesce(
        (select pmp.allowed
         from public.person_module_permissions pmp
         where pmp.person_id = v_person_id
           and pmp.module_code = m.code),
        exists (
          select 1
          from public.person_role_assignments pra
          join public.role_module_permissions rmp on rmp.role_id = pra.role_id
          where pra.person_id = v_person_id
            and pra.starts_at <= now()
            and (pra.ends_at is null or pra.ends_at > now())
            and rmp.module_code = m.code
            and rmp.allowed = true
        )
      ) = true
  ) allowed_modules;

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
    ),
    'participant', case when v_participant.id is null then null else jsonb_build_object(
      'status', v_participant.status,
      'accessProfile', v_participant.access_profile,
      'completedAt', v_participant.completed_at
    ) end,
    'application', case when v_application.id is null then null else jsonb_build_object(
      'id', v_application.id,
      'code', v_application.code,
      'name', v_application.name,
      'status', v_application.status,
      'opensAt', v_application.opens_at,
      'closesAt', v_application.closes_at
    ) end,
    'roles', v_roles,
    'modules', v_modules,
    'isLeader', v_roles ? 'LEADER'
  );
end;
$$;

alter table public.platform_modules enable row level security;
alter table public.role_module_permissions enable row level security;
alter table public.person_module_permissions enable row level security;

revoke all on function public.get_my_platform_context() from public;
grant execute on function public.get_my_platform_context() to authenticated;

commit;