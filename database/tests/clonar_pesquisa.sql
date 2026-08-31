-- fc_clonar_pesquisa: duplica seções (inclusive aninhadas), perguntas,
-- alternativas e regras condicionais remapeando identificadores. O cerne da
-- função é o remapeamento — copiar apontando para os identificadores do
-- original deixaria a cópia com lógica dependente de outro instrumento — e
-- isso nunca teve teste.

begin;

select plan(24);

insert into sigav.tb_usuario_identidade (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000d001', 'authenticated', 'authenticated', 'clone-admin@agenciasus.org.br', now(), now()),
  ('00000000-0000-4000-8000-00000000d003', 'authenticated', 'authenticated', 'clone-comum@agenciasus.org.br', now(), now());

insert into sigav.people (id, auth_user_id, employee_number, full_name, institutional_email)
values
  ('00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-00000000d001', 'TESTE-CLONE-ADMIN', 'Administração de Teste', 'clone-admin@agenciasus.org.br'),
  ('00000000-0000-4000-8000-00000000d004', '00000000-0000-4000-8000-00000000d003', 'TESTE-CLONE-COMUM', 'Pessoa Comum de Teste', 'clone-comum@agenciasus.org.br');

-- Preset Admin — era a role SURVEY_MANAGER, e as tabelas de perfil saíram do
-- banco em 20260828150000_remover_perfis_legados_do_banco.sql. A autorização
-- hoje é permissão por pessoa; as funções sob teste exigem ADMIN_SURVEYS, via
-- can_manage_surveys().
insert into sigav.person_module_permissions (person_id, module_code, allowed)
select '00000000-0000-4000-8000-00000000d002', modulo, true
  from unnest(array[
    'HOME', 'SURVEYS', 'DASHBOARDS', 'ONLINE_PRESENCE',
    'ADMIN_SURVEYS', 'ADMIN_PARTICIPANTS'
  ]) modulo;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000d001","role":"authenticated"}',
  true
);

-- Instrumento original: INTRO (criada por create_survey_draft) com Q1, e uma
-- seção aninhada S1A com Q2 — Q2 só aparece quando Q1 = Sim.
select sigav.create_survey_draft(
  'TESTE-CLONE-ORIG', 'Pesquisa original', 'Descrição', 'Ciclo 1',
  now() + interval '1 day', now() + interval '2 days', false, true
);

insert into sigav.survey_sections (id, survey_version_id, parent_section_id, code, title, position)
select
  '00000000-0000-4000-8000-00000000d010',
  v.id,
  (select id from sigav.survey_sections where survey_version_id = v.id and code = 'INTRO'),
  'S1A', 'Seção aninhada', 2
from sigav.survey_versions v join sigav.surveys s on s.id = v.survey_id
where s.code = 'TESTE-CLONE-ORIG';

insert into sigav.survey_questions (id, survey_version_id, section_id, code, title, question_type, required, position)
select '00000000-0000-4000-8000-00000000d011', v.id, sec.id, 'Q1', 'Pergunta 1', 'SINGLE_CHOICE', true, 1
from sigav.survey_versions v
join sigav.surveys s on s.id = v.survey_id
join sigav.survey_sections sec on sec.survey_version_id = v.id and sec.code = 'INTRO'
where s.code = 'TESTE-CLONE-ORIG';

insert into sigav.question_options (id, question_id, code, label, value, position)
values
  ('00000000-0000-4000-8000-00000000d021', '00000000-0000-4000-8000-00000000d011', 'SIM', 'Sim', 'SIM', 1),
  ('00000000-0000-4000-8000-00000000d022', '00000000-0000-4000-8000-00000000d011', 'NAO', 'Não', 'NAO', 2);

insert into sigav.survey_questions (id, survey_version_id, section_id, code, title, question_type, required, position)
values (
  '00000000-0000-4000-8000-00000000d012',
  (select v.id from sigav.survey_versions v join sigav.surveys s on s.id = v.survey_id where s.code = 'TESTE-CLONE-ORIG'),
  '00000000-0000-4000-8000-00000000d010',
  'Q2', 'Pergunta 2', 'SHORT_TEXT', false, 1
);

select sigav.fc_salvar_regra_condicional(
  'QUESTION', '00000000-0000-4000-8000-00000000d012', 'SHOW', 'ALL',
  jsonb_build_array(jsonb_build_object(
    'questionId', '00000000-0000-4000-8000-00000000d011',
    'operator', 'SELECTED',
    'optionId', '00000000-0000-4000-8000-00000000d021'
  )),
  'Q2 aparece quando Q1 = Sim'
);

-- Instrumento sem estrutura copiável: só tem versão RETIRED.
insert into sigav.surveys (id, code, name, status)
values ('00000000-0000-4000-8000-00000000d030', 'TESTE-CLONE-RETIRED', 'Pesquisa aposentada', 'ACTIVE');
insert into sigav.survey_versions (id, survey_id, version_number, title, status)
values ('00000000-0000-4000-8000-00000000d031', '00000000-0000-4000-8000-00000000d030', 1, 'Versão aposentada', 'RETIRED');

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000d003","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select sigav.fc_clonar_pesquisa('00000000-0000-4000-8000-00000000d030') $$,
  'Acesso restrito à administração de avaliações.',
  'quem não administra avaliações não clona pesquisa'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000d001","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select sigav.fc_clonar_pesquisa('00000000-0000-4000-8000-00000000d999') $$,
  'Avaliação não localizada.',
  'pesquisa inexistente é recusada'
);

select throws_ok(
  $$ select sigav.fc_clonar_pesquisa('00000000-0000-4000-8000-00000000d030') $$,
  'Esta avaliação não tem versão com estrutura para copiar.',
  'pesquisa só com versão RETIRED não pode ser clonada'
);

select lives_ok(
  $$ select sigav.fc_clonar_pesquisa((select id from sigav.surveys where code = 'TESTE-CLONE-ORIG')) $$,
  'clonar a partir de uma versão em rascunho é aceito'
);

select is(
  (
    select count(*)::integer
    from sigav.survey_applications aplicacao
    join sigav.survey_versions versao on versao.id = aplicacao.survey_version_id
    join sigav.surveys pesquisa on pesquisa.id = versao.survey_id
    where pesquisa.code = 'TESTE-CLONE-ORIG-COPIA'
  ),
  1,
  'a cópia nasce com um ciclo próprio'
);

select is(
  (
    select aplicacao.status
    from sigav.survey_applications aplicacao
    join sigav.survey_versions versao on versao.id = aplicacao.survey_version_id
    join sigav.surveys pesquisa on pesquisa.id = versao.survey_id
    where pesquisa.code = 'TESTE-CLONE-ORIG-COPIA'
  ),
  'DRAFT',
  'o ciclo da cópia nasce em rascunho'
);

select ok(
  (
    select aplicacao.opens_at is null and aplicacao.closes_at is null
    from sigav.survey_applications aplicacao
    join sigav.survey_versions versao on versao.id = aplicacao.survey_version_id
    join sigav.surveys pesquisa on pesquisa.id = versao.survey_id
    where pesquisa.code = 'TESTE-CLONE-ORIG-COPIA'
  ),
  'o ciclo da cópia não herda o período da origem'
);

select lives_ok(
  $$
    select sigav.manage_survey_cycle(
      (select id from sigav.surveys where code = 'TESTE-CLONE-ORIG-COPIA'),
      'UPDATE_PERIOD', now() - interval '30 seconds', now() + interval '2 hours'
    )
  $$,
  'o ciclo clonado aceita a configuração do período'
);

select lives_ok(
  $$
    select sigav.manage_survey_cycle(
      (select id from sigav.surveys where code = 'TESTE-CLONE-ORIG-COPIA'),
      'PUBLISH'
    )
  $$,
  'a versão clonada pode ser publicada'
);

select lives_ok(
  $$
    select sigav.manage_survey_cycle(
      (select id from sigav.surveys where code = 'TESTE-CLONE-ORIG-COPIA'),
      'OPEN'
    )
  $$,
  'o ciclo clonado pode ser iniciado'
);

select lives_ok(
  $$
    select sigav.manage_survey_cycle(
      (select id from sigav.surveys where code = 'TESTE-CLONE-ORIG-COPIA'),
      'CLOSE'
    )
  $$,
  'o ciclo clonado pode ser interrompido'
);

select lives_ok(
  $$
    select sigav.manage_survey_cycle(
      (select id from sigav.surveys where code = 'TESTE-CLONE-ORIG-COPIA'),
      'ARCHIVE'
    )
  $$,
  'a cópia interrompida pode ser arquivada pelo catálogo'
);

select lives_ok(
  $$
    select sigav.manage_survey_cycle(
      (select id from sigav.surveys where code = 'TESTE-CLONE-ORIG-COPIA'),
      'UNARCHIVE'
    )
  $$,
  'a cópia arquivada pode voltar ao catálogo'
);

select is(
  (select count(*)::integer from sigav.survey_sections where survey_version_id = (
    select v.id from sigav.survey_versions v join sigav.surveys s on s.id = v.survey_id
    where s.code = 'TESTE-CLONE-ORIG-COPIA'
  )),
  2,
  'a cópia leva as duas seções (INTRO e a aninhada)'
);

select is(
  (select count(*)::integer from sigav.survey_questions where survey_version_id = (
    select v.id from sigav.survey_versions v join sigav.surveys s on s.id = v.survey_id
    where s.code = 'TESTE-CLONE-ORIG-COPIA'
  )),
  2,
  'a cópia leva as duas perguntas'
);

select is(
  (select count(*)::integer from sigav.tb_regra_condicional where sq_versao_pesquisa = (
    select v.id from sigav.survey_versions v join sigav.surveys s on s.id = v.survey_id
    where s.code = 'TESTE-CLONE-ORIG-COPIA'
  )),
  1,
  'a cópia leva a regra condicional'
);

-- O cerne da função: a regra copiada aponta para a pergunta Q1 **da cópia**,
-- não para a original.
select is(
  (
    select condicao.sq_pergunta_origem
    from sigav.tb_condicao_regra condicao
    join sigav.tb_regra_condicional regra on regra.sq_regra = condicao.sq_regra
    where regra.sq_versao_pesquisa = (
      select v.id from sigav.survey_versions v join sigav.surveys s on s.id = v.survey_id
      where s.code = 'TESTE-CLONE-ORIG-COPIA'
    )
  ),
  (
    select q.id from sigav.survey_questions q
    where q.code = 'Q1' and q.survey_version_id = (
      select v.id from sigav.survey_versions v join sigav.surveys s on s.id = v.survey_id
      where s.code = 'TESTE-CLONE-ORIG-COPIA'
    )
  ),
  'a regra copiada aponta para o Q1 da cópia, não para o original'
);

-- Seção aninhada: o parent_section_id da cópia aponta para o INTRO da
-- cópia, não para o INTRO original.
select is(
  (
    select parent_section_id from sigav.survey_sections
    where code = 'S1A' and survey_version_id = (
      select v.id from sigav.survey_versions v join sigav.surveys s on s.id = v.survey_id
      where s.code = 'TESTE-CLONE-ORIG-COPIA'
    )
  ),
  (
    select id from sigav.survey_sections
    where code = 'INTRO' and survey_version_id = (
      select v.id from sigav.survey_versions v join sigav.surveys s on s.id = v.survey_id
      where s.code = 'TESTE-CLONE-ORIG-COPIA'
    )
  ),
  'a seção aninhada da cópia aponta para o INTRO da própria cópia'
);

-- Sem código customizado, uma segunda cópia colide com a primeira e ganha
-- sufixo — a função existe para que a tela nunca devolva erro de constraint.
select lives_ok(
  $$ select sigav.fc_clonar_pesquisa((select id from sigav.surveys where code = 'TESTE-CLONE-ORIG')) $$,
  'clonar de novo, sem código customizado, é aceito'
);

select is(
  (select code from sigav.surveys where name = 'Pesquisa original (cópia)' and code <> 'TESTE-CLONE-ORIG-COPIA'),
  'TESTE-CLONE-ORIG-COPIA-2',
  'a segunda cópia sem código customizado ganha sufixo -2'
);

select lives_ok(
  $$
    select sigav.fc_clonar_pesquisa(
      (select id from sigav.surveys where code = 'TESTE-CLONE-ORIG'),
      'Cópia customizada',
      'CLONE-CUSTOM'
    )
  $$,
  'clonar com nome e código customizados é aceito'
);

select is(
  (select name from sigav.surveys where code = 'CLONE-CUSTOM'),
  'Cópia customizada',
  'o nome customizado é usado quando informado'
);

select ok(
  exists (select 1 from sigav.surveys where code = 'CLONE-CUSTOM'),
  'o código customizado é usado quando informado'
);

-- Versão PUBLISHED é preferida mesmo havendo uma versão DRAFT mais recente —
-- a ordem do "order by" na função, não o version_number, decide qual é
-- copiada.
select sigav.create_survey_draft(
  'TESTE-CLONE-PREF', 'Pesquisa com duas versões', 'Descrição', 'Ciclo 1',
  now() + interval '1 day', now() + interval '2 days', false, true
);

insert into sigav.survey_questions (survey_version_id, section_id, code, title, question_type, required, position)
select v.id, sec.id, 'Q1', 'Pergunta única', 'SHORT_TEXT', false, 1
from sigav.survey_versions v
join sigav.surveys s on s.id = v.survey_id
join sigav.survey_sections sec on sec.survey_version_id = v.id and sec.code = 'INTRO'
where s.code = 'TESTE-CLONE-PREF';

update sigav.survey_versions
set status = 'PUBLISHED', published_at = now()
where survey_id = (select id from sigav.surveys where code = 'TESTE-CLONE-PREF') and version_number = 1;

-- Versão 2 é criada direto por insert (sem estrutura nenhuma), só para provar
-- que a função ignora o version_number maior quando ele não é PUBLISHED.
insert into sigav.survey_versions (survey_id, version_number, title, status)
select id, 2, 'Rascunho mais novo, sem estrutura', 'DRAFT'
from sigav.surveys where code = 'TESTE-CLONE-PREF';

select sigav.fc_clonar_pesquisa((select id from sigav.surveys where code = 'TESTE-CLONE-PREF'));

select is(
  (select count(*)::integer from sigav.survey_sections where survey_version_id = (
    select v.id from sigav.survey_versions v join sigav.surveys s on s.id = v.survey_id
    where s.code = 'TESTE-CLONE-PREF-COPIA'
  )),
  1,
  'a cópia usa a versão PUBLISHED (1 seção), não o rascunho mais novo e vazio'
);

select * from finish();

rollback;
