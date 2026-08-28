-- Trava a regra de elegibilidade de `assign_admin_all_available_participants`.
--
-- Esta função derivou de produção sem que nada acusasse: `set schema` não
-- reescreve corpo de função, nenhuma migration posterior a redefiniu, e o job
-- de reconstrução não compara com produção — ele reconstrói do zero, onde a
-- versão da main sempre vence.
--
-- Um teste de comportamento fecha essa porta: a regra passa a estar escrita em
-- asserções, e mudá-la sem querer quebra o CI. Se alguém precisar mudá-la de
-- propósito — a Fase 1 vai, adotando `people.active` como critério canônico —,
-- quebrar este arquivo é o aviso de que a decisão é deliberada.

begin;

select plan(4);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-00000000f001', 'authenticated', 'authenticated', 'eleg-admin@agenciasus.org.br', now(), now());

insert into sigav.people (id, auth_user_id, employee_number, full_name, institutional_email, active, employment_status)
values ('00000000-0000-4000-8000-00000000f002', '00000000-0000-4000-8000-00000000f001', 'TESTE-ELEG-ADMIN', 'Administração de Teste', 'eleg-admin@agenciasus.org.br', true, 'ATIVO');

insert into sigav.person_role_assignments (person_id, role_id)
select '00000000-0000-4000-8000-00000000f002', id from sigav.system_roles where code = 'SURVEY_MANAGER';

-- Quatro pessoas, uma por regra. A administradora acima também é candidata
-- elegível, por isso as contagens abaixo olham pessoa a pessoa e não o total.
insert into sigav.people (id, employee_number, full_name, institutional_email, active, employment_status, metadata)
values
  ('00000000-0000-4000-8000-00000000f011', 'TESTE-ELEG-1', 'Ativa e ATIVO',      'eleg1@agenciasus.org.br', true,  'ATIVO',  '{}'::jsonb),
  ('00000000-0000-4000-8000-00000000f012', 'TESTE-ELEG-2', 'Ativa e NORMAL',     'eleg2@agenciasus.org.br', true,  'NORMAL', '{}'::jsonb),
  ('00000000-0000-4000-8000-00000000f013', 'TESTE-ELEG-3', 'Ativa e isenta',     'eleg3@agenciasus.org.br', true,  'ATIVO',  '{"evaluation_exempt": true}'::jsonb),
  ('00000000-0000-4000-8000-00000000f014', 'TESTE-ELEG-4', 'Inativa',            'eleg4@agenciasus.org.br', false, 'ATIVO',  '{}'::jsonb);

insert into sigav.surveys (id, code, name)
values ('00000000-0000-4000-8000-00000000f021', 'TESTE-ELEG', 'Pesquisa de elegibilidade');

insert into sigav.survey_versions (id, survey_id, version_number, title, status)
values ('00000000-0000-4000-8000-00000000f022', '00000000-0000-4000-8000-00000000f021', 1, 'Versão 1', 'PUBLISHED');

insert into sigav.survey_applications (id, survey_version_id, code, name, opens_at, closes_at, status)
values ('00000000-0000-4000-8000-00000000f023', '00000000-0000-4000-8000-00000000f022',
        'TESTE-ELEG-1', 'Ciclo de elegibilidade', now() - interval '1 day', now() + interval '7 days', 'OPEN');

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000f001","role":"authenticated"}',
  true
);

select sigav.assign_admin_all_available_participants('00000000-0000-4000-8000-00000000f023');

select is(
  (select count(*)::integer from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-00000000f023'
     and person_id = '00000000-0000-4000-8000-00000000f011'),
  1,
  'pessoa ativa com employment_status ATIVO é vinculada'
);

-- A asserção que trava a deriva. A definição antiga da main aceitava 'NORMAL';
-- produção não aceita. Se alguém reintroduzir a versão permissiva, cai aqui.
select is(
  (select count(*)::integer from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-00000000f023'
     and person_id = '00000000-0000-4000-8000-00000000f012'),
  0,
  'employment_status NORMAL não é elegível'
);

select is(
  (select count(*)::integer from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-00000000f023'
     and person_id = '00000000-0000-4000-8000-00000000f013'),
  0,
  'pessoa marcada com evaluation_exempt não é vinculada'
);

select is(
  (select count(*)::integer from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-00000000f023'
     and person_id = '00000000-0000-4000-8000-00000000f014'),
  0,
  'pessoa inativa não é vinculada'
);

select * from finish();

rollback;
