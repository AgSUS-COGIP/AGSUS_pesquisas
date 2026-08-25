-- Regressão: participantes concluídos precisam aparecer na audiência DONE/ALL.

begin;

select plan(6);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  '00000000-0000-4000-8000-00000000e100',
  'authenticated',
  'authenticated',
  'gestor-email@agenciasus.org.br',
  now(),
  now()
);

insert into public.people (id, auth_user_id, employee_number, full_name, institutional_email)
values
  ('00000000-0000-4000-8000-00000000e100', '00000000-0000-4000-8000-00000000e100', 'EML-ADMIN', 'Gestor Email Teste', 'gestor-email@agenciasus.org.br'),
  ('00000000-0000-4000-8000-00000000e101', null, 'EML-001', 'Pessoa Concluída Email', 'concluida-email@agenciasus.org.br');

insert into public.person_role_assignments (person_id, role_id, assigned_by)
select '00000000-0000-4000-8000-00000000e100', id, '00000000-0000-4000-8000-00000000e100'
from public.system_roles
where code = 'ADMINISTRATOR';

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000e100","role":"authenticated"}',
  true
);

insert into public.surveys (id, code, name, status)
values (
  '00000000-0000-4000-8000-00000000e200',
  'EMAIL-DONE-TESTE',
  'Pesquisa Email Done Teste',
  'ACTIVE'
);

insert into public.survey_versions (id, survey_id, version_number, title, status)
values (
  '00000000-0000-4000-8000-00000000e201',
  '00000000-0000-4000-8000-00000000e200',
  1,
  'Versão Email Done Teste',
  'PUBLISHED'
);

insert into public.survey_applications (id, survey_version_id, code, name, status)
values (
  '00000000-0000-4000-8000-00000000e202',
  '00000000-0000-4000-8000-00000000e201',
  'EMAIL-DONE-APP',
  'Aplicação Email Done Teste',
  'OPEN'
);

insert into public.application_participants (
  id,
  application_id,
  person_id,
  status,
  completed_at
)
values (
  '00000000-0000-4000-8000-00000000e203',
  '00000000-0000-4000-8000-00000000e202',
  '00000000-0000-4000-8000-00000000e101',
  'COMPLETED',
  timezone('utc', now())
);

insert into public.submissions (
  id,
  application_id,
  participant_id,
  respondent_person_id,
  subject_person_id,
  submission_type,
  status,
  started_at,
  submitted_at,
  version
)
values (
  '00000000-0000-4000-8000-00000000e204',
  '00000000-0000-4000-8000-00000000e202',
  '00000000-0000-4000-8000-00000000e203',
  '00000000-0000-4000-8000-00000000e101',
  '00000000-0000-4000-8000-00000000e101',
  'SELF',
  'SUBMITTED',
  timezone('utc', now()),
  timezone('utc', now()),
  1
);

select is(
  jsonb_array_length(public.fc_listar_audiencia_email('00000000-0000-4000-8000-00000000e202', 'DONE', null, 100)),
  1,
  'participante COMPLETED com submissão enviada aparece em DONE'
);

select is(
  public.fc_listar_audiencia_email('00000000-0000-4000-8000-00000000e202', 'DONE', null, 100)->0->>'participantStatus',
  'COMPLETED',
  'DONE preserva o status COMPLETED da participação'
);

select is(
  jsonb_array_length(public.fc_listar_audiencia_email('00000000-0000-4000-8000-00000000e202', 'ALL', null, 100)),
  1,
  'participante COMPLETED também aparece em ALL'
);

select is(
  jsonb_array_length(public.fc_listar_audiencia_email('00000000-0000-4000-8000-00000000e202', 'PENDING', null, 100)),
  0,
  'participante concluído não aparece em PENDING'
);

select is(
  jsonb_array_length(public.fc_listar_audiencia_email('00000000-0000-4000-8000-00000000e202', 'DRAFT', null, 100)),
  0,
  'participante concluído não aparece em DRAFT'
);

select ok(
  (
    public.fc_listar_audiencia_email('00000000-0000-4000-8000-00000000e202', 'DONE', 'Pessoa Concluída', 100)->0->>'personId'
  ) = '00000000-0000-4000-8000-00000000e101',
  'busca continua encontrando participante concluído'
);

select * from finish();

rollback;
