-- fc_obter_contexto_plataforma: contrato de autorização de toda a plataforma.
-- Governa navegação, guardas de página e o mapa perfil → módulo. Nunca tinha
-- teste, apesar de já ter sido redefinida várias vezes (a mais recente tirou
-- o módulo TEAM do perfil Admin).

begin;

select plan(13);

-- Estado 1: sem sessão nenhuma — nenhum set_config ainda foi chamado nesta
-- transação, então auth.uid() é null por padrão.
select is(
  (select public.fc_obter_contexto_plataforma() ->> 'status'),
  'AUTH_REQUIRED',
  'sem sessão autenticada, o status é AUTH_REQUIRED'
);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000e001', 'authenticated', 'authenticated', 'ctx-sem-cadastro@agenciasus.org.br', now(), now()),
  ('00000000-0000-4000-8000-00000000e003', 'authenticated', 'authenticated', 'ctx-participante@agenciasus.org.br', now(), now()),
  ('00000000-0000-4000-8000-00000000e005', 'authenticated', 'authenticated', 'ctx-lideranca@agenciasus.org.br', now(), now()),
  ('00000000-0000-4000-8000-00000000e007', 'authenticated', 'authenticated', 'ctx-admin@agenciasus.org.br', now(), now()),
  ('00000000-0000-4000-8000-00000000e009', 'authenticated', 'authenticated', 'ctx-superadmin@agenciasus.org.br', now(), now());

-- Estado 2: sessão válida no Supabase Auth, mas sem cadastro institucional
-- ativo vinculado — é o estado de quem nunca terminou resolve_authenticated_person.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000e001","role":"authenticated"}',
  true
);

select is(
  (select public.fc_obter_contexto_plataforma() ->> 'status'),
  'UNLINKED',
  'autenticado sem cadastro institucional ativo, o status é UNLINKED'
);

insert into public.people (id, auth_user_id, employee_number, full_name, institutional_email)
values
  ('00000000-0000-4000-8000-00000000e004', '00000000-0000-4000-8000-00000000e003', 'TESTE-CTX-PARTICIPANTE', 'Participante de Teste', 'ctx-participante@agenciasus.org.br'),
  ('00000000-0000-4000-8000-00000000e006', '00000000-0000-4000-8000-00000000e005', 'TESTE-CTX-LIDERANCA', 'Avaliador de Teste', 'ctx-lideranca@agenciasus.org.br'),
  ('00000000-0000-4000-8000-00000000e008', '00000000-0000-4000-8000-00000000e007', 'TESTE-CTX-ADMIN', 'Admin de Teste', 'ctx-admin@agenciasus.org.br'),
  ('00000000-0000-4000-8000-00000000e010', '00000000-0000-4000-8000-00000000e009', 'TESTE-CTX-SUPERADMIN', 'Superadmin de Teste', 'ctx-superadmin@agenciasus.org.br');

insert into public.person_role_assignments (person_id, role_id)
select '00000000-0000-4000-8000-00000000e006', id from public.system_roles where code = 'LEADER';
insert into public.person_role_assignments (person_id, role_id)
select '00000000-0000-4000-8000-00000000e008', id from public.system_roles where code = 'SURVEY_MANAGER';
insert into public.person_role_assignments (person_id, role_id)
select '00000000-0000-4000-8000-00000000e010', id from public.system_roles where code = 'ADMINISTRATOR';

-- Estado 3: cadastro ativo sem papel algum — piso do modelo é Participante.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000e003","role":"authenticated"}',
  true
);

select is(
  (select public.fc_obter_contexto_plataforma() -> 'roles'),
  '["RESPONDENT"]'::jsonb,
  'pessoa sem papel vigente resolve para o perfil Participante'
);

select is(
  (select public.fc_obter_contexto_plataforma() -> 'modules'),
  '["SURVEYS"]'::jsonb,
  'Participante só recebe o módulo SURVEYS'
);

select is(
  (select public.fc_obter_contexto_plataforma() -> 'participant'),
  'null'::jsonb,
  'sem inscrição em nenhuma aplicação, participant é null'
);

-- Inscreve o Participante numa aplicação para conferir o enriquecimento de
-- participant/application no retorno. Criar a pesquisa exige can_manage_surveys(),
-- então a sessão troca para o Admin só para esta chamada.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000e007","role":"authenticated"}',
  true
);

select public.create_survey_draft(
  'TESTE-CTX-INSCRICAO', 'Pesquisa de inscrição', 'Descrição', 'Ciclo 1',
  now() + interval '1 day', now() + interval '2 days', false, true
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000e003","role":"authenticated"}',
  true
);

insert into public.application_participants (application_id, person_id, status, access_profile)
select a.id, '00000000-0000-4000-8000-00000000e004', 'IN_PROGRESS', 'RESPONDENT'
from public.survey_applications a
where a.code = 'TESTE-CTX-INSCRICAO-1';

select is(
  (select public.fc_obter_contexto_plataforma() -> 'participant' ->> 'status'),
  'IN_PROGRESS',
  'inscrito numa aplicação, o contexto devolve o participante'
);

select is(
  (select public.fc_obter_contexto_plataforma() -> 'application' ->> 'code'),
  'TESTE-CTX-INSCRICAO-1',
  'o contexto devolve também a aplicação da inscrição mais relevante'
);

-- Estado 4: Avaliador (LEADER).
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000e005","role":"authenticated"}',
  true
);

select is(
  (select public.fc_obter_contexto_plataforma() -> 'modules'),
  '["HOME","SURVEYS","TEAM"]'::jsonb,
  'Avaliador recebe HOME, SURVEYS e TEAM'
);

select is(
  (select public.fc_obter_contexto_plataforma() ->> 'isLeader')::boolean,
  true,
  'Avaliador é isLeader'
);

-- Estado 5: Admin (SURVEY_MANAGER) — não recebe mais TEAM desde
-- 20260817180000_admin_sem_modulo_de_equipe.sql. É a checagem de regressão
-- desta mudança: nada garante que uma futura redefinição não devolva o
-- módulo por engano.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000e007","role":"authenticated"}',
  true
);

select is(
  (select public.fc_obter_contexto_plataforma() -> 'modules'),
  '["HOME","SURVEYS","DASHBOARDS","ADMIN_SURVEYS","ADMIN_PARTICIPANTS"]'::jsonb,
  'Admin não recebe o módulo TEAM'
);

select is(
  (select public.fc_obter_contexto_plataforma() ->> 'canManageSurveys')::boolean,
  true,
  'Admin tem canManageSurveys'
);

select is(
  (select public.fc_obter_contexto_plataforma() ->> 'isLeader')::boolean,
  false,
  'Admin não é isLeader mesmo administrando avaliações'
);

-- Estado 6: Superadmin (ADMINISTRATOR) — todos os 9 módulos.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000e009","role":"authenticated"}',
  true
);

select is(
  (select public.fc_obter_contexto_plataforma() -> 'modules'),
  '["HOME","SURVEYS","DASHBOARDS","TEAM","ADMIN_SURVEYS","ADMIN_PARTICIPANTS","ADMIN_TEAMS","ADMIN_ACCESS","ADMIN_IMPORT"]'::jsonb,
  'Superadmin recebe todos os 9 módulos'
);

select * from finish();

rollback;
