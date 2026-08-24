-- fc_criar_nova_versao_pesquisa: só aposenta a versão publicada e cria a
-- seguinte depois que o ciclo anterior encerrou — nunca há dois ciclos
-- operacionalmente relevantes ao mesmo tempo.

begin;

select plan(11);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000d001', 'authenticated', 'authenticated', 'nova-versao-admin@agenciasus.org.br', now(), now()),
  ('00000000-0000-4000-8000-00000000d003', 'authenticated', 'authenticated', 'nova-versao-comum@agenciasus.org.br', now(), now());

insert into public.people (id, auth_user_id, employee_number, full_name, institutional_email)
values
  ('00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-00000000d001', 'TESTE-NOVAVERSAO-ADMIN', 'Administração de Teste', 'nova-versao-admin@agenciasus.org.br'),
  ('00000000-0000-4000-8000-00000000d004', '00000000-0000-4000-8000-00000000d003', 'TESTE-NOVAVERSAO-COMUM', 'Pessoa Comum de Teste', 'nova-versao-comum@agenciasus.org.br');

insert into public.person_role_assignments (person_id, role_id)
select '00000000-0000-4000-8000-00000000d002', id
from public.system_roles where code = 'SURVEY_MANAGER';

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000d001","role":"authenticated"}',
  true
);

-- Pesquisa 1: vai até o fim do fluxo feliz (publicar, abrir, encerrar, criar
-- nova versão).
select public.create_survey_draft(
  'TESTE-NOVAVERSAO-1', 'Pesquisa versionada 1', 'Descrição 1', 'Ciclo 1',
  now() + interval '1 day', now() + interval '2 days', false, true
);

insert into public.survey_questions (survey_version_id, section_id, code, title, question_type, required, position)
select v.id, sec.id, 'Q1', 'Pergunta única', 'SHORT_TEXT', false, 1
from public.survey_versions v
join public.survey_sections sec on sec.survey_version_id = v.id
join public.surveys s on s.id = v.survey_id
where s.code = 'TESTE-NOVAVERSAO-1';

select public.manage_survey_cycle((select id from public.surveys where code = 'TESTE-NOVAVERSAO-1'), 'PUBLISH');

-- Não usa OPEN seguido de CLOSE: as duas ações forçam, cada uma, o seu campo
-- (opens_at / closes_at) para now(), e como este arquivo inteiro roda numa
-- única transação, now() não muda entre as duas chamadas — as duas gravariam
-- o mesmo instante, violando survey_applications_period_valid
-- (closes_at > opens_at). Fora do teste isso não ocorre: OPEN e CLOSE são
-- requisições separadas, com now() naturalmente distintos. O ciclo é fechado
-- direto, com o mesmo efeito que a RPC produziria em duas chamadas reais.
update public.survey_applications
set status = 'CLOSED', opens_at = now() - interval '2 days', closes_at = now() - interval '1 day'
where code = 'TESTE-NOVAVERSAO-1-1';

select lives_ok(
  $$ select public.fc_criar_nova_versao_pesquisa((select id from public.surveys where code = 'TESTE-NOVAVERSAO-1')) $$,
  'ciclo encerrado permite criar a próxima versão'
);

select is(
  (select status from public.survey_versions where survey_id = (select id from public.surveys where code = 'TESTE-NOVAVERSAO-1') and version_number = 1),
  'RETIRED',
  'a versão publicada é aposentada'
);

select is(
  (select version_number from public.survey_versions where survey_id = (select id from public.surveys where code = 'TESTE-NOVAVERSAO-1') order by version_number desc limit 1),
  2,
  'a versão nova é a número seguinte'
);

select is(
  (select status from public.survey_versions where survey_id = (select id from public.surveys where code = 'TESTE-NOVAVERSAO-1') order by version_number desc limit 1),
  'DRAFT',
  'a versão nova nasce em rascunho'
);

select is(
  (
    select a.status
    from public.survey_applications a
    join public.survey_versions v on v.id = a.survey_version_id
    where v.survey_id = (select id from public.surveys where code = 'TESTE-NOVAVERSAO-1')
    order by v.version_number desc, a.created_at desc
    limit 1
  ),
  'DRAFT',
  'o ciclo novo também nasce em rascunho'
);

select ok(
  (
    select a.opens_at is null and a.closes_at is null
    from public.survey_applications a
    join public.survey_versions v on v.id = a.survey_version_id
    where v.survey_id = (select id from public.surveys where code = 'TESTE-NOVAVERSAO-1')
    order by v.version_number desc, a.created_at desc
    limit 1
  ),
  'o ciclo novo nasce sem período — o operador configura antes de publicar'
);

select is(
  (
    select count(*)::integer
    from public.survey_questions q
    join public.survey_versions v on v.id = q.survey_version_id
    where v.survey_id = (select id from public.surveys where code = 'TESTE-NOVAVERSAO-1')
    order by v.version_number desc
    limit 1
  ),
  1,
  'a estrutura de perguntas é copiada para a versão nova'
);

select throws_ok(
  $$ select public.fc_criar_nova_versao_pesquisa((select id from public.surveys where code = 'TESTE-NOVAVERSAO-1')) $$,
  'A versão mais recente desta avaliação ainda está em rascunho. Publique-a (ou conclua as alterações pendentes) antes de criar uma nova versão.',
  'não é possível criar uma terceira versão enquanto a segunda ainda está em rascunho'
);

-- Pesquisa 2: ciclo ainda aberto — não pode criar nova versão.
select public.create_survey_draft(
  'TESTE-NOVAVERSAO-2', 'Pesquisa versionada 2', 'Descrição 2', 'Ciclo 1',
  now() + interval '1 day', now() + interval '2 days', false, true
);

insert into public.survey_questions (survey_version_id, section_id, code, title, question_type, required, position)
select v.id, sec.id, 'Q1', 'Pergunta única', 'SHORT_TEXT', false, 1
from public.survey_versions v
join public.survey_sections sec on sec.survey_version_id = v.id
join public.surveys s on s.id = v.survey_id
where s.code = 'TESTE-NOVAVERSAO-2';

select public.manage_survey_cycle((select id from public.surveys where code = 'TESTE-NOVAVERSAO-2'), 'PUBLISH');
select public.manage_survey_cycle((select id from public.surveys where code = 'TESTE-NOVAVERSAO-2'), 'OPEN');

select throws_ok(
  $$ select public.fc_criar_nova_versao_pesquisa((select id from public.surveys where code = 'TESTE-NOVAVERSAO-2')) $$,
  'O ciclo desta versão ainda está aberto. Encerre-o (Pausar ou Finalizar, em Propriedades do ciclo) antes de criar uma nova versão.',
  'ciclo aberto bloqueia a criação de nova versão'
);

-- Pesquisa 3: cancelada (arquivada automaticamente por CANCEL) — precisa ser
-- restaurada antes de criar nova versão.
select public.create_survey_draft(
  'TESTE-NOVAVERSAO-3', 'Pesquisa versionada 3', 'Descrição 3', 'Ciclo 1',
  now() + interval '1 day', now() + interval '2 days', false, true
);

insert into public.survey_questions (survey_version_id, section_id, code, title, question_type, required, position)
select v.id, sec.id, 'Q1', 'Pergunta única', 'SHORT_TEXT', false, 1
from public.survey_versions v
join public.survey_sections sec on sec.survey_version_id = v.id
join public.surveys s on s.id = v.survey_id
where s.code = 'TESTE-NOVAVERSAO-3';

select public.manage_survey_cycle((select id from public.surveys where code = 'TESTE-NOVAVERSAO-3'), 'PUBLISH');
select public.manage_survey_cycle((select id from public.surveys where code = 'TESTE-NOVAVERSAO-3'), 'CANCEL');

select throws_ok(
  $$ select public.fc_criar_nova_versao_pesquisa((select id from public.surveys where code = 'TESTE-NOVAVERSAO-3')) $$,
  'Esta avaliação está arquivada. Restaure-a antes de criar uma nova versão.',
  'avaliação arquivada não permite criar nova versão sem restaurar antes'
);

-- Sem papel de administração: acesso restrito, independente do estado da pesquisa.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000d003","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select public.fc_criar_nova_versao_pesquisa((select id from public.surveys where code = 'TESTE-NOVAVERSAO-2')) $$,
  'Acesso restrito à administração de avaliações.',
  'quem não administra avaliações não cria nova versão'
);

select * from finish();

rollback;
