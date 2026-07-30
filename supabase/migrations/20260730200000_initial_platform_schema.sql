begin;

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.organizational_units (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid,
  code text,
  name text not null,
  unit_type text not null default 'UNIDADE',
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint organizational_units_name_not_blank check (btrim(name) <> ''),
  constraint organizational_units_code_not_blank check (code is null or btrim(code) <> ''),
  constraint organizational_units_parent_fk foreign key (parent_id)
    references public.organizational_units(id) on delete restrict
);

create unique index organizational_units_code_unique_idx
  on public.organizational_units(code)
  where code is not null;

create table public.people (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  employee_number text not null,
  full_name text not null,
  institutional_email text,
  job_title text,
  cost_center text,
  organizational_unit_id uuid references public.organizational_units(id) on delete set null,
  workplace text,
  employment_status text not null default 'ATIVO',
  active boolean not null default true,
  source_system text,
  source_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint people_employee_number_not_blank check (btrim(employee_number) <> ''),
  constraint people_full_name_not_blank check (btrim(full_name) <> ''),
  constraint people_email_not_blank check (institutional_email is null or btrim(institutional_email) <> ''),
  constraint people_source_pair_complete check ((source_system is null) = (source_key is null)),
  constraint people_employee_number_unique unique (employee_number)
);

create unique index people_email_unique_idx
  on public.people(lower(btrim(institutional_email)))
  where institutional_email is not null and btrim(institutional_email) <> '';

create unique index people_source_unique_idx
  on public.people(source_system, source_key)
  where source_system is not null and source_key is not null;

create table public.system_roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint system_roles_code_not_blank check (btrim(code) <> ''),
  constraint system_roles_name_not_blank check (btrim(name) <> '')
);

create table public.person_role_assignments (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  role_id uuid not null references public.system_roles(id) on delete restrict,
  starts_at timestamptz not null default timezone('utc', now()),
  ends_at timestamptz,
  assigned_by uuid references public.people(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint person_role_assignments_period_valid check (ends_at is null or ends_at > starts_at),
  constraint person_role_assignments_unique unique (person_id, role_id, starts_at)
);

create table public.surveys (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  owner_unit_id uuid references public.organizational_units(id) on delete set null,
  status text not null default 'DRAFT',
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.people(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint surveys_code_not_blank check (btrim(code) <> ''),
  constraint surveys_name_not_blank check (btrim(name) <> ''),
  constraint surveys_status_valid check (status in ('DRAFT','ACTIVE','ARCHIVED'))
);

create table public.survey_versions (
  id uuid primary key default gen_random_uuid(),
  survey_id uuid not null references public.surveys(id) on delete cascade,
  version_number integer not null,
  title text not null,
  description text,
  status text not null default 'DRAFT',
  schema_version integer not null default 1,
  settings jsonb not null default '{}'::jsonb,
  published_at timestamptz,
  created_by uuid references public.people(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint survey_versions_number_positive check (version_number > 0),
  constraint survey_versions_status_valid check (status in ('DRAFT','PUBLISHED','RETIRED')),
  constraint survey_versions_unique unique (survey_id, version_number)
);

create table public.survey_applications (
  id uuid primary key default gen_random_uuid(),
  survey_version_id uuid not null references public.survey_versions(id) on delete restrict,
  code text not null unique,
  name text not null,
  opens_at timestamptz,
  closes_at timestamptz,
  status text not null default 'DRAFT',
  allow_drafts boolean not null default true,
  allow_resubmission boolean not null default false,
  anonymous boolean not null default false,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.people(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint survey_applications_period_valid check (closes_at is null or opens_at is null or closes_at > opens_at),
  constraint survey_applications_status_valid check (status in ('DRAFT','SCHEDULED','OPEN','CLOSED','CANCELLED'))
);

create table public.survey_sections (
  id uuid primary key default gen_random_uuid(),
  survey_version_id uuid not null references public.survey_versions(id) on delete cascade,
  parent_section_id uuid,
  code text,
  title text not null,
  description text,
  position integer not null,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint survey_sections_position_nonnegative check (position >= 0),
  constraint survey_sections_id_version_unique unique (id, survey_version_id),
  constraint survey_sections_parent_same_version_fk foreign key (parent_section_id, survey_version_id)
    references public.survey_sections(id, survey_version_id) on delete cascade
);

create unique index survey_sections_position_unique_idx
  on public.survey_sections(
    survey_version_id,
    coalesce(parent_section_id, '00000000-0000-0000-0000-000000000000'::uuid),
    position
  );

create unique index survey_sections_code_unique_idx
  on public.survey_sections(survey_version_id, code)
  where code is not null;

create table public.survey_questions (
  id uuid primary key default gen_random_uuid(),
  survey_version_id uuid not null references public.survey_versions(id) on delete cascade,
  section_id uuid not null,
  code text not null,
  title text not null,
  description text,
  question_type text not null,
  required boolean not null default false,
  position integer not null,
  validation jsonb not null default '{}'::jsonb,
  display_logic jsonb not null default '{}'::jsonb,
  scoring jsonb not null default '{}'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint survey_questions_section_same_version_fk foreign key (section_id, survey_version_id)
    references public.survey_sections(id, survey_version_id) on delete cascade,
  constraint survey_questions_type_valid check (question_type in (
    'SHORT_TEXT','LONG_TEXT','INTEGER','DECIMAL','DATE','DATETIME','BOOLEAN',
    'SINGLE_CHOICE','MULTIPLE_CHOICE','SCALE','MATRIX','FILE','PERSON','ORGANIZATIONAL_UNIT'
  )),
  constraint survey_questions_position_nonnegative check (position >= 0),
  constraint survey_questions_unique_code unique (survey_version_id, code),
  constraint survey_questions_unique_position unique (section_id, position)
);

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references public.survey_questions(id) on delete cascade,
  code text not null,
  label text not null,
  value text not null,
  score numeric(12,4),
  position integer not null,
  active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint question_options_position_nonnegative check (position >= 0),
  constraint question_options_unique_code unique (question_id, code),
  constraint question_options_unique_position unique (question_id, position)
);

create table public.application_participants (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.survey_applications(id) on delete cascade,
  person_id uuid not null references public.people(id) on delete restrict,
  participant_role text not null default 'RESPONDENT',
  status text not null default 'ELIGIBLE',
  access_profile text,
  invited_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint application_participants_status_valid check (status in ('ELIGIBLE','INVITED','IN_PROGRESS','COMPLETED','BLOCKED','EXCLUDED')),
  constraint application_participants_unique unique (application_id, person_id, participant_role)
);

create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.survey_applications(id) on delete restrict,
  participant_id uuid references public.application_participants(id) on delete restrict,
  respondent_person_id uuid references public.people(id) on delete restrict,
  subject_person_id uuid references public.people(id) on delete restrict,
  submission_type text not null default 'STANDARD',
  status text not null default 'DRAFT',
  started_at timestamptz not null default timezone('utc', now()),
  submitted_at timestamptz,
  version integer not null default 1,
  calculated_result numeric(12,4),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint submissions_status_valid check (status in ('DRAFT','SUBMITTED','VALIDATED','INVALIDATED','CANCELLED')),
  constraint submissions_version_positive check (version > 0),
  constraint submissions_submitted_at_valid check (status not in ('SUBMITTED','VALIDATED') or submitted_at is not null)
);

create table public.answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  question_id uuid not null references public.survey_questions(id) on delete restrict,
  answer_text text,
  answer_number numeric(18,6),
  answer_boolean boolean,
  answer_date date,
  answer_datetime timestamptz,
  answer_json jsonb,
  score numeric(12,4),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint answers_unique_question unique (submission_id, question_id),
  constraint answers_single_value check (num_nonnulls(answer_text, answer_number, answer_boolean, answer_date, answer_datetime, answer_json) <= 1)
);

create table public.answer_options (
  answer_id uuid not null references public.answers(id) on delete cascade,
  option_id uuid not null references public.question_options(id) on delete restrict,
  position integer,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (answer_id, option_id)
);

create unique index answer_options_position_unique_idx
  on public.answer_options(answer_id, position)
  where position is not null;

create table public.user_preferences (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  preference_key text not null,
  preference_value jsonb not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint user_preferences_unique unique (person_id, preference_key)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor_person_id uuid references public.people(id) on delete set null,
  event_type text not null,
  entity_type text not null,
  entity_id text,
  application_id uuid references public.survey_applications(id) on delete set null,
  request_id uuid,
  ip_address inet,
  user_agent text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index organizational_units_parent_idx on public.organizational_units(parent_id);
create index people_auth_user_idx on public.people(auth_user_id) where auth_user_id is not null;
create index people_organizational_unit_idx on public.people(organizational_unit_id);
create index person_role_assignments_role_idx on public.person_role_assignments(role_id);
create index person_role_assignments_assigned_by_idx on public.person_role_assignments(assigned_by) where assigned_by is not null;
create index surveys_owner_unit_idx on public.surveys(owner_unit_id) where owner_unit_id is not null;
create index surveys_created_by_idx on public.surveys(created_by) where created_by is not null;
create index survey_versions_survey_idx on public.survey_versions(survey_id);
create index survey_versions_created_by_idx on public.survey_versions(created_by) where created_by is not null;
create index survey_applications_version_idx on public.survey_applications(survey_version_id);
create index survey_applications_created_by_idx on public.survey_applications(created_by) where created_by is not null;
create index survey_sections_parent_idx on public.survey_sections(parent_section_id) where parent_section_id is not null;
create index survey_questions_version_idx on public.survey_questions(survey_version_id);
create index survey_questions_section_idx on public.survey_questions(section_id, position);
create index application_participants_person_idx on public.application_participants(person_id, application_id);
create index submissions_application_idx on public.submissions(application_id, status);
create index submissions_participant_idx on public.submissions(participant_id) where participant_id is not null;
create index submissions_respondent_idx on public.submissions(respondent_person_id, application_id);
create index submissions_subject_idx on public.submissions(subject_person_id, application_id);
create index answers_submission_idx on public.answers(submission_id);
create index answer_options_option_idx on public.answer_options(option_id);
create index audit_events_actor_idx on public.audit_events(actor_person_id) where actor_person_id is not null;
create index audit_events_application_idx on public.audit_events(application_id) where application_id is not null;
create index audit_events_entity_idx on public.audit_events(entity_type, entity_id);
create index audit_events_created_at_idx on public.audit_events(created_at desc);

create trigger organizational_units_set_updated_at before update on public.organizational_units for each row execute function public.set_updated_at();
create trigger people_set_updated_at before update on public.people for each row execute function public.set_updated_at();
create trigger surveys_set_updated_at before update on public.surveys for each row execute function public.set_updated_at();
create trigger survey_versions_set_updated_at before update on public.survey_versions for each row execute function public.set_updated_at();
create trigger survey_applications_set_updated_at before update on public.survey_applications for each row execute function public.set_updated_at();
create trigger survey_sections_set_updated_at before update on public.survey_sections for each row execute function public.set_updated_at();
create trigger survey_questions_set_updated_at before update on public.survey_questions for each row execute function public.set_updated_at();
create trigger question_options_set_updated_at before update on public.question_options for each row execute function public.set_updated_at();
create trigger application_participants_set_updated_at before update on public.application_participants for each row execute function public.set_updated_at();
create trigger submissions_set_updated_at before update on public.submissions for each row execute function public.set_updated_at();
create trigger answers_set_updated_at before update on public.answers for each row execute function public.set_updated_at();
create trigger user_preferences_set_updated_at before update on public.user_preferences for each row execute function public.set_updated_at();

insert into public.system_roles(code, name, description) values
('ADMINISTRATOR','Administrador','Administração integral da plataforma.'),
('SURVEY_MANAGER','Gestor de pesquisa','Configuração e acompanhamento das pesquisas autorizadas.'),
('AUDITOR','Auditor','Consulta de dados e trilhas de auditoria sem alteração operacional.'),
('LEADER','Liderança','Responsável por avaliações ou equipes vinculadas.'),
('RESPONDENT','Participante','Respondente comum das aplicações.')
on conflict (code) do nothing;

create or replace function public.current_person_id()
returns uuid
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select p.id from public.people p
  where p.auth_user_id = auth.uid() and p.active = true
  limit 1;
$$;

create or replace function public.has_active_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select exists (
    select 1
    from public.person_role_assignments pra
    join public.system_roles sr on sr.id = pra.role_id
    where pra.person_id = public.current_person_id()
      and sr.code = required_role
      and pra.starts_at <= timezone('utc', now())
      and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
  );
$$;

create or replace function public.can_manage_surveys()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select public.has_active_role('ADMINISTRATOR') or public.has_active_role('SURVEY_MANAGER');
$$;

create or replace function public.can_audit_platform()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select public.can_manage_surveys() or public.has_active_role('AUDITOR');
$$;

create or replace function public.can_access_application(target_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select public.can_manage_surveys() or exists (
    select 1 from public.application_participants ap
    where ap.application_id = target_application_id
      and ap.person_id = public.current_person_id()
      and ap.status not in ('BLOCKED','EXCLUDED')
  );
$$;

create or replace function public.can_edit_submission(target_submission_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select public.can_manage_surveys() or exists (
    select 1 from public.submissions s
    where s.id = target_submission_id
      and s.respondent_person_id = public.current_person_id()
      and s.status = 'DRAFT'
      and public.can_access_application(s.application_id)
  );
$$;

create or replace function public.validate_submission_participant()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  app_anonymous boolean;
  participant_application uuid;
  participant_person uuid;
begin
  select anonymous into app_anonymous from public.survey_applications where id = new.application_id;
  if app_anonymous is null then raise exception 'Aplicação inexistente.'; end if;
  if not app_anonymous and (new.participant_id is null or new.respondent_person_id is null) then
    raise exception 'Aplicações identificadas exigem participante e respondente.';
  end if;
  if new.participant_id is not null then
    select application_id, person_id into participant_application, participant_person
    from public.application_participants where id = new.participant_id;
    if participant_application is distinct from new.application_id then
      raise exception 'Participante não pertence à aplicação.';
    end if;
    if participant_person is distinct from new.respondent_person_id then
      raise exception 'Respondente não corresponde ao participante.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.validate_answer_question()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  app_version uuid;
  question_version uuid;
begin
  select sa.survey_version_id into app_version
  from public.submissions s join public.survey_applications sa on sa.id = s.application_id
  where s.id = new.submission_id;
  select survey_version_id into question_version from public.survey_questions where id = new.question_id;
  if app_version is distinct from question_version then
    raise exception 'Pergunta não pertence à versão aplicada.';
  end if;
  return new;
end;
$$;

create or replace function public.validate_answer_option()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  answer_question uuid;
  option_question uuid;
begin
  select question_id into answer_question from public.answers where id = new.answer_id;
  select question_id into option_question from public.question_options where id = new.option_id;
  if answer_question is distinct from option_question then
    raise exception 'Alternativa não pertence à pergunta respondida.';
  end if;
  return new;
end;
$$;

create trigger submissions_validate_participant before insert or update of application_id, participant_id, respondent_person_id on public.submissions for each row execute function public.validate_submission_participant();
create trigger answers_validate_question before insert or update of submission_id, question_id on public.answers for each row execute function public.validate_answer_question();
create trigger answer_options_validate_question before insert or update of answer_id, option_id on public.answer_options for each row execute function public.validate_answer_option();

revoke all on function public.current_person_id() from public;
revoke all on function public.has_active_role(text) from public;
revoke all on function public.can_manage_surveys() from public;
revoke all on function public.can_audit_platform() from public;
revoke all on function public.can_access_application(uuid) from public;
revoke all on function public.can_edit_submission(uuid) from public;
grant execute on function public.current_person_id() to authenticated;
grant execute on function public.has_active_role(text) to authenticated;
grant execute on function public.can_manage_surveys() to authenticated;
grant execute on function public.can_audit_platform() to authenticated;
grant execute on function public.can_access_application(uuid) to authenticated;
grant execute on function public.can_edit_submission(uuid) to authenticated;

alter table public.organizational_units enable row level security;
alter table public.people enable row level security;
alter table public.system_roles enable row level security;
alter table public.person_role_assignments enable row level security;
alter table public.surveys enable row level security;
alter table public.survey_versions enable row level security;
alter table public.survey_applications enable row level security;
alter table public.survey_sections enable row level security;
alter table public.survey_questions enable row level security;
alter table public.question_options enable row level security;
alter table public.application_participants enable row level security;
alter table public.submissions enable row level security;
alter table public.answers enable row level security;
alter table public.answer_options enable row level security;
alter table public.user_preferences enable row level security;
alter table public.audit_events enable row level security;

create policy organizational_units_read_authenticated on public.organizational_units for select to authenticated using (true);
create policy people_select_authorized on public.people for select to authenticated using (auth_user_id = auth.uid() or public.can_audit_platform());
create policy roles_read_authenticated on public.system_roles for select to authenticated using (true);
create policy role_assignments_read_self_or_privileged on public.person_role_assignments for select to authenticated using (person_id = public.current_person_id() or public.can_audit_platform());
create policy surveys_read_authorized on public.surveys for select to authenticated using (public.can_manage_surveys() or exists (select 1 from public.survey_versions sv join public.survey_applications sa on sa.survey_version_id = sv.id where sv.survey_id = surveys.id and public.can_access_application(sa.id)));
create policy survey_versions_read_authorized on public.survey_versions for select to authenticated using (public.can_manage_surveys() or exists (select 1 from public.survey_applications sa where sa.survey_version_id = survey_versions.id and public.can_access_application(sa.id)));
create policy applications_read_authorized on public.survey_applications for select to authenticated using (public.can_access_application(id));
create policy sections_read_authorized on public.survey_sections for select to authenticated using (public.can_manage_surveys() or exists (select 1 from public.survey_applications sa where sa.survey_version_id = survey_sections.survey_version_id and public.can_access_application(sa.id)));
create policy questions_read_authorized on public.survey_questions for select to authenticated using (public.can_manage_surveys() or exists (select 1 from public.survey_applications sa where sa.survey_version_id = survey_questions.survey_version_id and public.can_access_application(sa.id)));
create policy options_read_authorized on public.question_options for select to authenticated using (public.can_manage_surveys() or exists (select 1 from public.survey_questions sq join public.survey_applications sa on sa.survey_version_id = sq.survey_version_id where sq.id = question_options.question_id and public.can_access_application(sa.id)));
create policy participants_read_authorized on public.application_participants for select to authenticated using (person_id = public.current_person_id() or public.can_manage_surveys());
create policy preferences_manage_self on public.user_preferences for all to authenticated using (person_id = public.current_person_id()) with check (person_id = public.current_person_id());
create policy submissions_select_authorized on public.submissions for select to authenticated using (respondent_person_id = public.current_person_id() or public.can_manage_surveys() or public.has_active_role('AUDITOR'));
create policy submissions_insert_own_draft on public.submissions for insert to authenticated with check (public.can_manage_surveys() or (respondent_person_id = public.current_person_id() and status = 'DRAFT' and public.can_access_application(application_id)));
create policy submissions_update_own_draft on public.submissions for update to authenticated using (public.can_manage_surveys() or (respondent_person_id = public.current_person_id() and status = 'DRAFT')) with check (public.can_manage_surveys() or (respondent_person_id = public.current_person_id() and status in ('DRAFT','SUBMITTED') and public.can_access_application(application_id)));
create policy submissions_delete_own_draft on public.submissions for delete to authenticated using (public.can_manage_surveys() or (respondent_person_id = public.current_person_id() and status = 'DRAFT'));
create policy answers_select_authorized on public.answers for select to authenticated using (exists (select 1 from public.submissions s where s.id = answers.submission_id and (s.respondent_person_id = public.current_person_id() or public.can_manage_surveys() or public.has_active_role('AUDITOR'))));
create policy answers_insert_editable_submission on public.answers for insert to authenticated with check (public.can_edit_submission(submission_id));
create policy answers_update_editable_submission on public.answers for update to authenticated using (public.can_edit_submission(submission_id)) with check (public.can_edit_submission(submission_id));
create policy answers_delete_editable_submission on public.answers for delete to authenticated using (public.can_edit_submission(submission_id));
create policy answer_options_select_authorized on public.answer_options for select to authenticated using (exists (select 1 from public.answers a join public.submissions s on s.id = a.submission_id where a.id = answer_options.answer_id and (s.respondent_person_id = public.current_person_id() or public.can_manage_surveys() or public.has_active_role('AUDITOR'))));
create policy answer_options_insert_editable_submission on public.answer_options for insert to authenticated with check (exists (select 1 from public.answers a where a.id = answer_options.answer_id and public.can_edit_submission(a.submission_id)));
create policy answer_options_update_editable_submission on public.answer_options for update to authenticated using (exists (select 1 from public.answers a where a.id = answer_options.answer_id and public.can_edit_submission(a.submission_id))) with check (exists (select 1 from public.answers a where a.id = answer_options.answer_id and public.can_edit_submission(a.submission_id)));
create policy answer_options_delete_editable_submission on public.answer_options for delete to authenticated using (exists (select 1 from public.answers a where a.id = answer_options.answer_id and public.can_edit_submission(a.submission_id)));
create policy audit_events_read_auditor on public.audit_events for select to authenticated using (public.can_audit_platform());

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select on public.organizational_units, public.people, public.system_roles, public.person_role_assignments, public.surveys, public.survey_versions, public.survey_applications, public.survey_sections, public.survey_questions, public.question_options, public.application_participants, public.audit_events to authenticated;
grant select, insert, update, delete on public.submissions, public.answers, public.answer_options, public.user_preferences to authenticated;
grant usage, select on sequence public.audit_events_id_seq to authenticated;

comment on table public.people is 'Cadastro institucional de pessoas, separado das contas de autenticação.';
comment on table public.surveys is 'Definição permanente de uma pesquisa ou avaliação.';
comment on table public.survey_versions is 'Versões publicáveis da estrutura de uma pesquisa.';
comment on table public.survey_applications is 'Execuções de uma versão em um período e público determinados.';
comment on table public.submissions is 'Respostas em rascunho ou concluídas de uma aplicação.';
comment on table public.answers is 'Resposta normalizada para uma pergunta.';
comment on table public.audit_events is 'Trilha de auditoria para operações relevantes.';

commit;
