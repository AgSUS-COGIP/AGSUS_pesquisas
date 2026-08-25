-- Motor de lógica condicional (20260813120000_motor_logica_condicional.sql):
-- detecção de ciclo no grafo de dependências e visibilidade recursiva
-- (seção → pergunta) em tempo de resposta. Zero cobertura até aqui, apesar de
-- ser o motor mais complexo do banco e o único que se autoavalia
-- recursivamente.

begin;

select plan(32);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000c001', 'authenticated', 'authenticated', 'logica-admin@agenciasus.org.br', now(), now()),
  ('00000000-0000-4000-8000-00000000c003', 'authenticated', 'authenticated', 'logica-respondente@agenciasus.org.br', now(), now());

insert into public.people (id, auth_user_id, employee_number, full_name, institutional_email)
values
  ('00000000-0000-4000-8000-00000000c002', '00000000-0000-4000-8000-00000000c001', 'TESTE-LOGICA-ADMIN', 'Administração de Teste', 'logica-admin@agenciasus.org.br'),
  ('00000000-0000-4000-8000-00000000c004', '00000000-0000-4000-8000-00000000c003', 'TESTE-LOGICA-RESP', 'Respondente de Teste', 'logica-respondente@agenciasus.org.br');

insert into public.person_role_assignments (person_id, role_id)
select '00000000-0000-4000-8000-00000000c002', id from public.system_roles where code = 'SURVEY_MANAGER';

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000c001","role":"authenticated"}',
  true
);

-- Instrumento principal: seção INTRO (criada por create_survey_draft) mais
-- uma seção nova (S2) para exercitar "esconder a seção esconde a pergunta".
select public.create_survey_draft(
  'TESTE-LOGICA', 'Pesquisa da lógica condicional', 'Descrição', 'Ciclo 1',
  now() + interval '1 day', now() + interval '2 days', false, true
);

insert into public.survey_sections (id, survey_version_id, code, title, position)
select '00000000-0000-4000-8000-00000000c010',
       v.id, 'S2', 'Seção condicional', 2
from public.survey_versions v join public.surveys s on s.id = v.survey_id
where s.code = 'TESTE-LOGICA';

-- Q1 (SINGLE_CHOICE, em INTRO): origem das regras de SELECTED.
insert into public.survey_questions (id, survey_version_id, section_id, code, title, question_type, required, position)
select '00000000-0000-4000-8000-00000000c011', v.id, sec.id, 'Q1', 'Pergunta 1', 'SINGLE_CHOICE', true, 1
from public.survey_versions v
join public.surveys s on s.id = v.survey_id
join public.survey_sections sec on sec.survey_version_id = v.id and sec.code = 'INTRO'
where s.code = 'TESTE-LOGICA';

insert into public.question_options (id, question_id, code, label, value, position)
values
  ('00000000-0000-4000-8000-00000000c021', '00000000-0000-4000-8000-00000000c011', 'SIM', 'Sim', 'SIM', 1),
  ('00000000-0000-4000-8000-00000000c022', '00000000-0000-4000-8000-00000000c011', 'NAO', 'Não', 'NAO', 2);

-- Q2 (INTEGER, em INTRO): origem das regras numéricas (GREATER_THAN, EQUALS).
insert into public.survey_questions (id, survey_version_id, section_id, code, title, question_type, required, position)
select '00000000-0000-4000-8000-00000000c012', v.id, sec.id, 'Q2', 'Pergunta 2', 'INTEGER', false, 2
from public.survey_versions v
join public.surveys s on s.id = v.survey_id
join public.survey_sections sec on sec.survey_version_id = v.id and sec.code = 'INTRO'
where s.code = 'TESTE-LOGICA';

-- Q4 (SHORT_TEXT, em INTRO): alvo da regra EQUALS numérico-texto.
insert into public.survey_questions (id, survey_version_id, section_id, code, title, question_type, required, position)
select '00000000-0000-4000-8000-00000000c014', v.id, sec.id, 'Q4', 'Pergunta 4', 'SHORT_TEXT', true, 3
from public.survey_versions v
join public.surveys s on s.id = v.survey_id
join public.survey_sections sec on sec.survey_version_id = v.id and sec.code = 'INTRO'
where s.code = 'TESTE-LOGICA';

-- Q5 (SHORT_TEXT, em INTRO): descartável, só para os testes de substituição
-- e exclusão de regra — não entra nos testes de visibilidade em tempo real.
insert into public.survey_questions (id, survey_version_id, section_id, code, title, question_type, required, position)
select '00000000-0000-4000-8000-00000000c015', v.id, sec.id, 'Q5', 'Pergunta 5', 'SHORT_TEXT', false, 4
from public.survey_versions v
join public.surveys s on s.id = v.survey_id
join public.survey_sections sec on sec.survey_version_id = v.id and sec.code = 'INTRO'
where s.code = 'TESTE-LOGICA';

-- Opção solta, presa a Q4 — usada só para provar que SELECTED recusa
-- alternativa de outra pergunta.
insert into public.question_options (id, question_id, code, label, value, position)
values ('00000000-0000-4000-8000-00000000c023', '00000000-0000-4000-8000-00000000c014', 'X', 'X', 'X', 1);

-- Q3 (SHORT_TEXT, em S2): alvo cuja visibilidade depende de Q1, e que a
-- seção S2 pode esconder por cima.
insert into public.survey_questions (id, survey_version_id, section_id, code, title, question_type, required, position)
values (
  '00000000-0000-4000-8000-00000000c013',
  (select v.id from public.survey_versions v join public.surveys s on s.id = v.survey_id where s.code = 'TESTE-LOGICA'),
  '00000000-0000-4000-8000-00000000c010',
  'Q3', 'Pergunta 3', 'SHORT_TEXT', true, 1
);

-- Segundo instrumento, publicado logo em seguida — serve só para os testes
-- de "pergunta de outra versão" e "versão não é rascunho".
select public.create_survey_draft(
  'TESTE-LOGICA-OUTRA', 'Outra pesquisa', 'Descrição', 'Ciclo 1',
  now() + interval '1 day', now() + interval '2 days', false, true
);

insert into public.survey_questions (id, survey_version_id, section_id, code, title, question_type, required, position)
select '00000000-0000-4000-8000-00000000c031', v.id, sec.id, 'OQ1', 'Pergunta de outra pesquisa', 'SHORT_TEXT', false, 1
from public.survey_versions v
join public.surveys s on s.id = v.survey_id
join public.survey_sections sec on sec.survey_version_id = v.id and sec.code = 'INTRO'
where s.code = 'TESTE-LOGICA-OUTRA';

select public.manage_survey_cycle((select id from public.surveys where code = 'TESTE-LOGICA-OUTRA'), 'PUBLISH');

-- ---------------------------------------------------------------------------
-- Validação de fc_salvar_regra_condicional
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000c003","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select public.fc_salvar_regra_condicional('QUESTION', '00000000-0000-4000-8000-00000000c013', 'SHOW', 'ALL', '[]'::jsonb, null) $$,
  'Acesso restrito à administração de avaliações.',
  'quem não administra avaliações não salva regra condicional'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000c001","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select public.fc_salvar_regra_condicional('QUESTION', '00000000-0000-4000-8000-00000000c031', 'SHOW', 'ALL', '[]'::jsonb, null) $$,
  'A lógica condicional só pode ser alterada enquanto a versão está em rascunho.',
  'versão publicada recusa nova regra'
);

select throws_ok(
  $$ select public.fc_salvar_regra_condicional('PAGE', '00000000-0000-4000-8000-00000000c013', 'SHOW', 'ALL', '[]'::jsonb, null) $$,
  'Informe se a regra vale para uma pergunta ou para uma seção.',
  'tipo de alvo fora de QUESTION/SECTION é recusado'
);

select throws_ok(
  $$ select public.fc_salvar_regra_condicional('QUESTION', '00000000-0000-4000-8000-00000000c013', 'DELETE', 'ALL', '[]'::jsonb, null) $$,
  'A ação da regra precisa ser SHOW ou HIDE.',
  'ação fora de SHOW/HIDE é recusada'
);

select throws_ok(
  $$ select public.fc_salvar_regra_condicional('QUESTION', '00000000-0000-4000-8000-00000000c013', 'SHOW', 'XOR', '[]'::jsonb, null) $$,
  'O conector da regra precisa ser ALL ou ANY.',
  'conector fora de ALL/ANY é recusado'
);

select throws_ok(
  $$ select public.fc_salvar_regra_condicional('QUESTION', '00000000-0000-4000-8000-00000000c999', 'SHOW', 'ALL', '[]'::jsonb, null) $$,
  'Pergunta ou seção não localizada.',
  'alvo inexistente é recusado'
);

select throws_ok(
  $$
    select public.fc_salvar_regra_condicional(
      'QUESTION', '00000000-0000-4000-8000-00000000c013', 'SHOW', 'ALL',
      jsonb_build_array(jsonb_build_object('questionId', '00000000-0000-4000-8000-00000000c031', 'operator', 'ANSWERED')),
      null
    )
  $$,
  'A pergunta de origem não pertence a esta versão da avaliação.',
  'pergunta de origem de outra versão é recusada'
);

select throws_ok(
  $$
    select public.fc_salvar_regra_condicional(
      'QUESTION', '00000000-0000-4000-8000-00000000c013', 'SHOW', 'ALL',
      jsonb_build_array(jsonb_build_object('questionId', '00000000-0000-4000-8000-00000000c013', 'operator', 'ANSWERED')),
      null
    )
  $$,
  'Uma pergunta não pode condicionar a si mesma.',
  'pergunta não pode condicionar a si mesma'
);

select throws_ok(
  $$
    select public.fc_salvar_regra_condicional(
      'QUESTION', '00000000-0000-4000-8000-00000000c013', 'SHOW', 'ALL',
      jsonb_build_array(jsonb_build_object(
        'questionId', '00000000-0000-4000-8000-00000000c011',
        'operator', 'SELECTED',
        'optionId', '00000000-0000-4000-8000-00000000c023'
      )),
      null
    )
  $$,
  'A alternativa comparada não pertence à pergunta de origem.',
  'alternativa de outra pergunta é recusada'
);

select lives_ok(
  $$
    select public.fc_salvar_regra_condicional(
      'QUESTION', '00000000-0000-4000-8000-00000000c013', 'SHOW', 'ALL',
      jsonb_build_array(jsonb_build_object(
        'questionId', '00000000-0000-4000-8000-00000000c011',
        'operator', 'SELECTED',
        'optionId', '00000000-0000-4000-8000-00000000c021'
      )),
      'Q3 aparece quando Q1 = Sim'
    )
  $$,
  'regra válida é salva'
);

select is(
  (
    select public.fc_salvar_regra_condicional(
      'QUESTION', '00000000-0000-4000-8000-00000000c013', 'SHOW', 'ALL',
      jsonb_build_array(jsonb_build_object(
        'questionId', '00000000-0000-4000-8000-00000000c011',
        'operator', 'SELECTED',
        'optionId', '00000000-0000-4000-8000-00000000c021'
      )),
      'Q3 aparece quando Q1 = Sim'
    ) ->> 'conditions'
  ),
  '1',
  'a regra salva devolve a contagem de condições gravadas'
);

-- Ciclo: Q3 já depende de Q1. Fazer Q1 depender de Q3 fecharia o laço.
select throws_ok(
  $$
    select public.fc_salvar_regra_condicional(
      'QUESTION', '00000000-0000-4000-8000-00000000c011', 'SHOW', 'ALL',
      jsonb_build_array(jsonb_build_object('questionId', '00000000-0000-4000-8000-00000000c013', 'operator', 'ANSWERED')),
      null
    )
  $$,
  'Esta regra cria uma dependência circular entre as perguntas.',
  'dependência circular é recusada'
);

-- Substituição em bloco: salvar de novo para o mesmo alvo troca a regra, não
-- duplica.
select lives_ok(
  $$
    select public.fc_salvar_regra_condicional(
      'QUESTION', '00000000-0000-4000-8000-00000000c015', 'SHOW', 'ALL',
      jsonb_build_array(jsonb_build_object(
        'questionId', '00000000-0000-4000-8000-00000000c011',
        'operator', 'SELECTED',
        'optionId', '00000000-0000-4000-8000-00000000c021'
      )),
      null
    )
  $$,
  'primeira regra de Q5 é salva'
);

select lives_ok(
  $$
    select public.fc_salvar_regra_condicional(
      'QUESTION', '00000000-0000-4000-8000-00000000c015', 'SHOW', 'ALL',
      jsonb_build_array(jsonb_build_object('questionId', '00000000-0000-4000-8000-00000000c012', 'operator', 'ANSWERED')),
      null
    )
  $$,
  'segunda regra de Q5 substitui a primeira'
);

select is(
  (select count(*)::integer from public.tb_regra_condicional where sq_alvo = '00000000-0000-4000-8000-00000000c015'),
  1,
  'só existe uma regra vigente para Q5 depois da substituição'
);

select is(
  (public.fc_excluir_regra_condicional('00000000-0000-4000-8000-00000000c015') ->> 'removed'),
  '1',
  'excluir a regra de Q5 remove a linha vigente'
);

select is(
  (public.fc_excluir_regra_condicional('00000000-0000-4000-8000-00000000c015') ->> 'removed'),
  '0',
  'excluir de novo, sem regra vigente, não é erro — só não remove nada'
);

-- Regra de seção: some com S2 (e tudo dentro) quando Q2 > 100.
select lives_ok(
  $$
    select public.fc_salvar_regra_condicional(
      'SECTION', '00000000-0000-4000-8000-00000000c010', 'HIDE', 'ALL',
      jsonb_build_array(jsonb_build_object('questionId', '00000000-0000-4000-8000-00000000c012', 'operator', 'GREATER_THAN', 'value', '100')),
      'Esconde S2 quando Q2 > 100'
    )
  $$,
  'regra de seção (HIDE) é salva'
);

-- Regra numérico-texto: Q4 aparece quando Q2 = 5 — exercita o trim_scale que
-- resolve a paridade numeric(18,6) vs. texto digitado.
select lives_ok(
  $$
    select public.fc_salvar_regra_condicional(
      'QUESTION', '00000000-0000-4000-8000-00000000c014', 'SHOW', 'ALL',
      jsonb_build_array(jsonb_build_object('questionId', '00000000-0000-4000-8000-00000000c012', 'operator', 'EQUALS', 'value', '5')),
      'Q4 aparece quando Q2 = 5'
    )
  $$,
  'regra EQUALS numérico-texto é salva'
);

-- ---------------------------------------------------------------------------
-- Avaliação em tempo de resposta
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ select public.manage_survey_cycle((select id from public.surveys where code = 'TESTE-LOGICA'), 'PUBLISH') $$,
  'publicar a versão principal, com as regras já gravadas, é aceito'
);

select lives_ok(
  $$ select public.manage_survey_cycle((select id from public.surveys where code = 'TESTE-LOGICA'), 'OPEN') $$,
  'abrir o ciclo principal é aceito'
);

-- Aplicação identificada (não anônima) exige participante vinculado, além do
-- respondente — validate_submission_participant() recusa submissão sem os dois.
insert into public.application_participants (id, application_id, person_id)
select '00000000-0000-4000-8000-00000000c042', a.id, '00000000-0000-4000-8000-00000000c004'
from public.survey_applications a where a.code = 'TESTE-LOGICA-1';

insert into public.submissions (id, application_id, participant_id, respondent_person_id, status)
values (
  '00000000-0000-4000-8000-00000000c041',
  (select id from public.survey_applications where code = 'TESTE-LOGICA-1'),
  '00000000-0000-4000-8000-00000000c042',
  '00000000-0000-4000-8000-00000000c004',
  'DRAFT'
);

select is(
  public.fc_pergunta_visivel('00000000-0000-4000-8000-00000000c041', '00000000-0000-4000-8000-00000000c013'),
  false,
  'Q3 começa escondida: Q1 ainda não foi respondida'
);

select is(
  public.fc_pergunta_visivel('00000000-0000-4000-8000-00000000c041', '00000000-0000-4000-8000-00000000c014'),
  false,
  'Q4 começa escondida: Q2 ainda não foi respondida'
);

select is(
  public.fc_alvo_visivel('00000000-0000-4000-8000-00000000c041', '00000000-0000-4000-8000-00000000c010'),
  true,
  'S2 começa visível: a condição de escondê-la (Q2 > 100) ainda não está satisfeita'
);

insert into public.answers (id, submission_id, question_id)
values ('00000000-0000-4000-8000-00000000c051', '00000000-0000-4000-8000-00000000c041', '00000000-0000-4000-8000-00000000c011');
insert into public.answer_options (answer_id, option_id)
values ('00000000-0000-4000-8000-00000000c051', '00000000-0000-4000-8000-00000000c021');

select is(
  public.fc_pergunta_visivel('00000000-0000-4000-8000-00000000c041', '00000000-0000-4000-8000-00000000c013'),
  true,
  'Q3 aparece depois que Q1 = Sim é respondida'
);

insert into public.answers (id, submission_id, question_id, answer_number)
values ('00000000-0000-4000-8000-00000000c052', '00000000-0000-4000-8000-00000000c041', '00000000-0000-4000-8000-00000000c012', 5);

select is(
  public.fc_pergunta_visivel('00000000-0000-4000-8000-00000000c041', '00000000-0000-4000-8000-00000000c014'),
  true,
  'Q4 aparece quando Q2 = 5, mesmo comparando numeric(18,6) com o texto "5"'
);

select is(
  public.fc_alvo_visivel('00000000-0000-4000-8000-00000000c041', '00000000-0000-4000-8000-00000000c010'),
  true,
  'S2 continua visível: Q2 = 5 não satisfaz a condição Q2 > 100'
);

update public.answers set answer_number = 200
where id = '00000000-0000-4000-8000-00000000c052';

select is(
  public.fc_alvo_visivel('00000000-0000-4000-8000-00000000c041', '00000000-0000-4000-8000-00000000c010'),
  false,
  'S2 fica escondida quando Q2 = 200 satisfaz a condição da regra HIDE'
);

select is(
  public.fc_pergunta_visivel('00000000-0000-4000-8000-00000000c041', '00000000-0000-4000-8000-00000000c013'),
  false,
  'Q3 fica escondida junto com a seção, mesmo com a própria regra SHOW satisfeita'
);

select is(
  public.fc_pergunta_visivel('00000000-0000-4000-8000-00000000c041', '00000000-0000-4000-8000-00000000c014'),
  false,
  'Q4 fica escondida: Q2 = 200 deixou de satisfazer a condição Q2 = 5'
);

-- Envio: Q3 e Q4 são obrigatórias e estão escondidas — não podem bloquear o
-- envio (é o que 20260813120000 redefiniu em submit_my_survey_submission).
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000c003","role":"authenticated"}',
  true
);

select lives_ok(
  $$ select public.submit_my_survey_submission('00000000-0000-4000-8000-00000000c041') $$,
  'envio é aceito mesmo com obrigatórias escondidas sem resposta'
);

select is(
  (select status from public.submissions where id = '00000000-0000-4000-8000-00000000c041'),
  'SUBMITTED',
  'a submissão fica SUBMITTED depois do envio'
);

select * from finish();

rollback;
