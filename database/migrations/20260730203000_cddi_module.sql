begin;

-- O e-mail informado na base cadastral pode estar ausente ou repetido.
-- A identidade de acesso validada é controlada separadamente.
drop index if exists public.people_email_unique_idx;
drop index if exists public.people_email_idx;
create index if not exists people_email_lookup_idx
  on public.people (lower(btrim(institutional_email)))
  where institutional_email is not null and btrim(institutional_email) <> '';

create table public.person_access_identities (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references public.people(id) on delete cascade,
  identity_type text not null default 'INSTITUTIONAL_EMAIL',
  email text not null,
  status text not null default 'PENDING',
  source text not null,
  verified_at timestamptz,
  revoked_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint person_access_identities_email_normalized check (email = lower(btrim(email)) and email like '%@%'),
  constraint person_access_identities_type_valid check (identity_type in ('INSTITUTIONAL_EMAIL','ALTERNATIVE_EMAIL')),
  constraint person_access_identities_status_valid check (status in ('PENDING','ACTIVE','BLOCKED','REVOKED')),
  constraint person_access_identities_person_email_unique unique (person_id, identity_type, email),
  constraint person_access_identities_revoked_at_valid check (status <> 'REVOKED' or revoked_at is not null)
);
create unique index person_access_active_email_unique_idx
  on public.person_access_identities(lower(email))
  where status in ('PENDING','ACTIVE');
create index person_access_identities_person_idx
  on public.person_access_identities(person_id, status);

create table public.data_import_batches (
  id uuid primary key default gen_random_uuid(),
  source_name text not null,
  source_file_id text,
  source_version text,
  entity_type text not null,
  status text not null default 'RUNNING',
  received_rows integer not null default 0,
  accepted_rows integer not null default 0,
  rejected_rows integer not null default 0,
  warning_rows integer not null default 0,
  checksum text,
  executed_by uuid references public.people(id) on delete set null,
  started_at timestamptz not null default timezone('utc', now()),
  completed_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  constraint data_import_batches_status_valid check (status in ('RUNNING','COMPLETED','COMPLETED_WITH_WARNINGS','FAILED','ROLLED_BACK')),
  constraint data_import_batches_counts_valid check (received_rows >= 0 and accepted_rows >= 0 and rejected_rows >= 0 and warning_rows >= 0)
);

create table public.data_import_issues (
  id bigint generated always as identity primary key,
  batch_id uuid not null references public.data_import_batches(id) on delete cascade,
  row_number integer,
  entity_key text,
  severity text not null,
  issue_code text not null,
  message text not null,
  payload jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolved_by uuid references public.people(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint data_import_issues_severity_valid check (severity in ('INFO','WARNING','ERROR')),
  constraint data_import_issues_row_valid check (row_number is null or row_number > 0)
);
create index data_import_issues_batch_idx on public.data_import_issues(batch_id, severity);
create index data_import_issues_entity_idx on public.data_import_issues(entity_key) where entity_key is not null;

create table public.cddi_leadership_links (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.survey_applications(id) on delete cascade,
  leader_person_id uuid not null references public.people(id) on delete restrict,
  subordinate_person_id uuid not null references public.people(id) on delete restrict,
  status text not null default 'ACTIVE',
  valid_from timestamptz not null default timezone('utc', now()),
  valid_to timestamptz,
  origin text not null,
  source_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint cddi_leadership_links_people_different check (leader_person_id <> subordinate_person_id),
  constraint cddi_leadership_links_status_valid check (status in ('PENDING','ACTIVE','ENDED','REJECTED')),
  constraint cddi_leadership_links_period_valid check (valid_to is null or valid_to > valid_from),
  constraint cddi_leadership_links_source_unique unique (application_id, source_key)
);
create unique index cddi_leadership_links_active_subordinate_unique_idx
  on public.cddi_leadership_links(application_id, subordinate_person_id)
  where status = 'ACTIVE' and valid_to is null;
create index cddi_leadership_links_leader_idx
  on public.cddi_leadership_links(application_id, leader_person_id, status);

create table public.cddi_link_correction_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.survey_applications(id) on delete cascade,
  requester_person_id uuid not null references public.people(id) on delete restrict,
  current_leader_person_id uuid references public.people(id) on delete set null,
  proposed_leader_person_id uuid not null references public.people(id) on delete restrict,
  justification text not null,
  status text not null default 'PENDING',
  analyzed_by uuid references public.people(id) on delete set null,
  analyzed_at timestamptz,
  admin_notes text,
  source_key text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint cddi_link_correction_people_different check (requester_person_id <> proposed_leader_person_id),
  constraint cddi_link_correction_justification_not_blank check (btrim(justification) <> ''),
  constraint cddi_link_correction_status_valid check (status in ('PENDING','APPROVED','REJECTED','CANCELLED')),
  constraint cddi_link_correction_analysis_valid check ((status = 'PENDING' and analyzed_at is null) or status = 'CANCELLED' or (analyzed_at is not null and analyzed_by is not null)),
  constraint cddi_link_correction_source_unique unique (application_id, source_key)
);
create index cddi_link_correction_requester_idx
  on public.cddi_link_correction_requests(application_id, requester_person_id, status);

create table public.cddi_competency_results (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  competency_section_id uuid not null references public.survey_sections(id) on delete restrict,
  behavior_average numeric(6,4) not null,
  development_level numeric(6,4) not null,
  result numeric(6,4) not null,
  calculation_version text not null default 'CDDI-2026-V1',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint cddi_competency_results_values_valid check (behavior_average between 1 and 5 and development_level between 1 and 5 and result between 1 and 5),
  constraint cddi_competency_results_unique unique (submission_id, competency_section_id)
);
create index cddi_competency_results_section_idx on public.cddi_competency_results(competency_section_id);

create table public.cddi_final_results (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.survey_applications(id) on delete cascade,
  subject_person_id uuid not null references public.people(id) on delete restrict,
  auto_submission_id uuid references public.submissions(id) on delete restrict,
  leader_submission_id uuid references public.submissions(id) on delete restrict,
  auto_score numeric(6,4),
  leader_score numeric(6,4),
  final_score numeric(6,4),
  status text not null default 'PENDING',
  calculation_version text not null default 'CDDI-2026-V1',
  calculated_at timestamptz,
  published_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint cddi_final_results_score_valid check ((auto_score is null or auto_score between 1 and 5) and (leader_score is null or leader_score between 1 and 5) and (final_score is null or final_score between 1 and 5)),
  constraint cddi_final_results_status_valid check (status in ('PENDING','PARTIAL','CALCULATED','PUBLISHED','INVALIDATED')),
  constraint cddi_final_results_published_valid check (status <> 'PUBLISHED' or published_at is not null),
  constraint cddi_final_results_unique unique (application_id, subject_person_id)
);
create index cddi_final_results_status_idx on public.cddi_final_results(application_id, status);

create trigger person_access_identities_set_updated_at before update on public.person_access_identities for each row execute function public.set_updated_at();
create trigger cddi_leadership_links_set_updated_at before update on public.cddi_leadership_links for each row execute function public.set_updated_at();
create trigger cddi_link_correction_requests_set_updated_at before update on public.cddi_link_correction_requests for each row execute function public.set_updated_at();
create trigger cddi_competency_results_set_updated_at before update on public.cddi_competency_results for each row execute function public.set_updated_at();
create trigger cddi_final_results_set_updated_at before update on public.cddi_final_results for each row execute function public.set_updated_at();

create or replace function public.validate_cddi_submission()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
declare survey_code text;
begin
  select s.code into survey_code from public.survey_applications sa
  join public.survey_versions sv on sv.id = sa.survey_version_id
  join public.surveys s on s.id = sv.survey_id where sa.id = new.application_id;
  if survey_code <> 'CDDI' then return new; end if;
  if new.submission_type not in ('AUTO','CHEFIA') then raise exception 'O CDDI aceita somente submissões AUTO ou CHEFIA.'; end if;
  if new.subject_person_id is null then raise exception 'A pessoa avaliada é obrigatória no CDDI.'; end if;
  if new.submission_type = 'AUTO' and new.respondent_person_id is distinct from new.subject_person_id then raise exception 'Na autoavaliação, respondente e avaliado devem ser a mesma pessoa.'; end if;
  if new.submission_type = 'CHEFIA' and not exists (
    select 1 from public.cddi_leadership_links l where l.application_id = new.application_id
    and l.leader_person_id = new.respondent_person_id and l.subordinate_person_id = new.subject_person_id
    and l.status = 'ACTIVE' and l.valid_from <= timezone('utc', now())
    and (l.valid_to is null or l.valid_to > timezone('utc', now()))
  ) then raise exception 'Não existe vínculo ativo entre a liderança e a pessoa avaliada.'; end if;
  return new;
end;
$$;
create trigger submissions_validate_cddi before insert or update of application_id, respondent_person_id, subject_person_id, submission_type on public.submissions for each row execute function public.validate_cddi_submission();

create or replace function public.validate_cddi_final_result()
returns trigger language plpgsql security invoker set search_path = pg_catalog, public as $$
declare sid uuid; app uuid; subject uuid; stype text;
begin
  foreach sid in array array[new.auto_submission_id, new.leader_submission_id] loop
    if sid is null then continue; end if;
    select application_id, subject_person_id, submission_type into app, subject, stype from public.submissions where id = sid;
    if app is distinct from new.application_id or subject is distinct from new.subject_person_id then raise exception 'A submissão não corresponde à aplicação e ao avaliado do resultado final.'; end if;
    if sid = new.auto_submission_id and stype <> 'AUTO' then raise exception 'A submissão de autoavaliação deve ser do tipo AUTO.'; end if;
    if sid = new.leader_submission_id and stype <> 'CHEFIA' then raise exception 'A submissão de chefia deve ser do tipo CHEFIA.'; end if;
  end loop;
  return new;
end;
$$;
create trigger cddi_final_results_validate_submissions before insert or update of application_id, subject_person_id, auto_submission_id, leader_submission_id on public.cddi_final_results for each row execute function public.validate_cddi_final_result();

alter table public.person_access_identities enable row level security;
alter table public.data_import_batches enable row level security;
alter table public.data_import_issues enable row level security;
alter table public.cddi_leadership_links enable row level security;
alter table public.cddi_link_correction_requests enable row level security;
alter table public.cddi_competency_results enable row level security;
alter table public.cddi_final_results enable row level security;

create policy person_access_identities_read_authorized on public.person_access_identities for select to authenticated using (person_id = public.current_person_id() or public.can_audit_platform());
create policy person_access_identities_manage on public.person_access_identities for all to authenticated using (public.can_manage_surveys()) with check (public.can_manage_surveys());
create policy data_import_batches_read on public.data_import_batches for select to authenticated using (public.can_audit_platform());
create policy data_import_batches_manage on public.data_import_batches for all to authenticated using (public.can_manage_surveys()) with check (public.can_manage_surveys());
create policy data_import_issues_read on public.data_import_issues for select to authenticated using (public.can_audit_platform());
create policy data_import_issues_manage on public.data_import_issues for all to authenticated using (public.can_manage_surveys()) with check (public.can_manage_surveys());
create policy cddi_leadership_links_read on public.cddi_leadership_links for select to authenticated using (leader_person_id = public.current_person_id() or subordinate_person_id = public.current_person_id() or public.can_audit_platform());
create policy cddi_leadership_links_manage on public.cddi_leadership_links for all to authenticated using (public.can_manage_surveys()) with check (public.can_manage_surveys());
create policy cddi_link_correction_requests_read on public.cddi_link_correction_requests for select to authenticated using (requester_person_id = public.current_person_id() or public.can_audit_platform());
create policy cddi_link_correction_requests_insert on public.cddi_link_correction_requests for insert to authenticated with check (requester_person_id = public.current_person_id() and status = 'PENDING');
create policy cddi_link_correction_requests_update on public.cddi_link_correction_requests for update to authenticated using (public.can_manage_surveys()) with check (public.can_manage_surveys());
create policy cddi_competency_results_read on public.cddi_competency_results for select to authenticated using (public.can_audit_platform() or exists (select 1 from public.submissions s where s.id = cddi_competency_results.submission_id and (s.respondent_person_id = public.current_person_id() or s.subject_person_id = public.current_person_id())));
create policy cddi_competency_results_manage on public.cddi_competency_results for all to authenticated using (public.can_manage_surveys()) with check (public.can_manage_surveys());
create policy cddi_final_results_read on public.cddi_final_results for select to authenticated using (public.can_audit_platform() or (subject_person_id = public.current_person_id() and status = 'PUBLISHED'));
create policy cddi_final_results_manage on public.cddi_final_results for all to authenticated using (public.can_manage_surveys()) with check (public.can_manage_surveys());

revoke all on public.person_access_identities, public.data_import_batches, public.data_import_issues, public.cddi_leadership_links, public.cddi_link_correction_requests, public.cddi_competency_results, public.cddi_final_results from anon;
grant select, insert, update, delete on public.person_access_identities, public.data_import_batches, public.data_import_issues, public.cddi_leadership_links, public.cddi_link_correction_requests, public.cddi_competency_results, public.cddi_final_results to authenticated;
grant usage, select on sequence public.data_import_issues_id_seq to authenticated;

comment on table public.person_access_identities is 'Identidades de acesso validadas, separadas dos e-mails informados na fonte cadastral.';
comment on table public.cddi_leadership_links is 'Vínculos de liderança válidos por aplicação do CDDI.';
comment on table public.cddi_competency_results is 'Resultados calculados por competência e submissão do CDDI.';
comment on table public.cddi_final_results is 'Resultado pareado da autoavaliação e avaliação da chefia.';

commit;
