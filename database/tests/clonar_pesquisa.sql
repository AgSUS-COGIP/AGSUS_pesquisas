-- fc_clonar_pesquisa: duplica seções (inclusive aninhadas), perguntas,
-- alternativas e regras condicionais remapeando identificadores. O cerne da
-- função é o remapeamento — copiar apontando para os identificadores do
-- original deixaria a cópia com lógica dependente de outro instrumento — e
-- isso nunca teve teste.

begin;

select plan(24);

insert into sigav."TB_USUARIO_IDENTIDADE" ("SQ_USUARIO", "TP_AUDIENCIA", "TP_PAPEL", "DS_EMAIL", "DT_INCLUSAO", "DT_ALTERACAO")
values
  ('00000000-0000-4000-8000-00000000d001', 'authenticated', 'authenticated', 'clone-admin@agenciasus.org.br', now(), now()),
  ('00000000-0000-4000-8000-00000000d003', 'authenticated', 'authenticated', 'clone-comum@agenciasus.org.br', now(), now());

insert into sigav."TB_PESSOA" ("SQ_PESSOA", "SQ_USUARIO_IDENTIDADE", "CO_MATRICULA", "NO_PESSOA", "DS_EMAIL_INSTITUCIONAL")
values
  ('00000000-0000-4000-8000-00000000d002', '00000000-0000-4000-8000-00000000d001', 'TESTE-CLONE-ADMIN', 'Administração de Teste', 'clone-admin@agenciasus.org.br'),
  ('00000000-0000-4000-8000-00000000d004', '00000000-0000-4000-8000-00000000d003', 'TESTE-CLONE-COMUM', 'Pessoa Comum de Teste', 'clone-comum@agenciasus.org.br');

-- Preset Admin — era a role SURVEY_MANAGER, e as tabelas de perfil saíram do
-- banco em 20260828150000_remover_perfis_legados_do_banco.sql. A autorização
-- hoje é permissão por pessoa; as funções sob teste exigem ADMIN_SURVEYS, via
-- can_manage_surveys().
insert into sigav."RL_PESSOA_MODULO" ("SQ_PESSOA", "CO_MODULO", "ST_PERMITIDO")
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
select sigav."FC_CRIAR_RASCUNHO_PESQUISA"(
  'TESTE-CLONE-ORIG', 'Pesquisa original', 'Descrição', 'Ciclo 1',
  now() + interval '1 day', now() + interval '2 days', false, true
);

insert into sigav."TB_SECAO_PESQUISA" ("SQ_SECAO", "SQ_VERSAO_PESQUISA", "SQ_SECAO_PAI", "CO_SECAO", "NO_SECAO", "NU_ORDEM")
select
  '00000000-0000-4000-8000-00000000d010',
  v."SQ_VERSAO_PESQUISA",
  (select "SQ_SECAO" from sigav."TB_SECAO_PESQUISA" where "SQ_VERSAO_PESQUISA" = v."SQ_VERSAO_PESQUISA" and "CO_SECAO" = 'INTRO'),
  'S1A', 'Seção aninhada', 2
from sigav."TH_VERSAO_PESQUISA" v join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = v."SQ_PESQUISA"
where s."CO_PESQUISA" = 'TESTE-CLONE-ORIG';

insert into sigav."TB_PERGUNTA_PESQUISA" ("SQ_PERGUNTA", "SQ_VERSAO_PESQUISA", "SQ_SECAO", "CO_PERGUNTA", "NO_PERGUNTA", "TP_PERGUNTA", "ST_OBRIGATORIA", "NU_ORDEM")
select '00000000-0000-4000-8000-00000000d011', v."SQ_VERSAO_PESQUISA", sec."SQ_SECAO", 'Q1', 'Pergunta 1', 'SINGLE_CHOICE', true, 1
from sigav."TH_VERSAO_PESQUISA" v
join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = v."SQ_PESQUISA"
join sigav."TB_SECAO_PESQUISA" sec on sec."SQ_VERSAO_PESQUISA" = v."SQ_VERSAO_PESQUISA" and sec."CO_SECAO" = 'INTRO'
where s."CO_PESQUISA" = 'TESTE-CLONE-ORIG';

insert into sigav."TB_OPCAO_PERGUNTA" ("SQ_OPCAO", "SQ_PERGUNTA", "CO_OPCAO", "NO_OPCAO", "DS_VALOR", "NU_ORDEM")
values
  ('00000000-0000-4000-8000-00000000d021', '00000000-0000-4000-8000-00000000d011', 'SIM', 'Sim', 'SIM', 1),
  ('00000000-0000-4000-8000-00000000d022', '00000000-0000-4000-8000-00000000d011', 'NAO', 'Não', 'NAO', 2);

insert into sigav."TB_PERGUNTA_PESQUISA" ("SQ_PERGUNTA", "SQ_VERSAO_PESQUISA", "SQ_SECAO", "CO_PERGUNTA", "NO_PERGUNTA", "TP_PERGUNTA", "ST_OBRIGATORIA", "NU_ORDEM")
values (
  '00000000-0000-4000-8000-00000000d012',
  (select v."SQ_VERSAO_PESQUISA" from sigav."TH_VERSAO_PESQUISA" v join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = v."SQ_PESQUISA" where s."CO_PESQUISA" = 'TESTE-CLONE-ORIG'),
  '00000000-0000-4000-8000-00000000d010',
  'Q2', 'Pergunta 2', 'SHORT_TEXT', false, 1
);

select sigav."FC_SALVAR_REGRA_CONDICIONAL"(
  'QUESTION', '00000000-0000-4000-8000-00000000d012', 'SHOW', 'ALL',
  jsonb_build_array(jsonb_build_object(
    'questionId', '00000000-0000-4000-8000-00000000d011',
    'operator', 'SELECTED',
    'optionId', '00000000-0000-4000-8000-00000000d021'
  )),
  'Q2 aparece quando Q1 = Sim'
);

-- Instrumento sem estrutura copiável: só tem versão RETIRED.
insert into sigav."TB_PESQUISA" ("SQ_PESQUISA", "CO_PESQUISA", "NO_PESQUISA", "ST_SITUACAO")
values ('00000000-0000-4000-8000-00000000d030', 'TESTE-CLONE-RETIRED', 'Pesquisa aposentada', 'ACTIVE');
insert into sigav."TH_VERSAO_PESQUISA" ("SQ_VERSAO_PESQUISA", "SQ_PESQUISA", "NU_VERSAO", "NO_VERSAO", "ST_SITUACAO")
values ('00000000-0000-4000-8000-00000000d031', '00000000-0000-4000-8000-00000000d030', 1, 'Versão aposentada', 'RETIRED');

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000d003","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select sigav."FC_CLONAR_PESQUISA"('00000000-0000-4000-8000-00000000d030') $$,
  'Acesso restrito à administração de avaliações.',
  'quem não administra avaliações não clona pesquisa'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000d001","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select sigav."FC_CLONAR_PESQUISA"('00000000-0000-4000-8000-00000000d999') $$,
  'Avaliação não localizada.',
  'pesquisa inexistente é recusada'
);

select throws_ok(
  $$ select sigav."FC_CLONAR_PESQUISA"('00000000-0000-4000-8000-00000000d030') $$,
  'Esta avaliação não tem versão com estrutura para copiar.',
  'pesquisa só com versão RETIRED não pode ser clonada'
);

select lives_ok(
  $$ select sigav."FC_CLONAR_PESQUISA"((select "SQ_PESQUISA" from sigav."TB_PESQUISA" where "CO_PESQUISA" = 'TESTE-CLONE-ORIG')) $$,
  'clonar a partir de uma versão em rascunho é aceito'
);

select is(
  (
    select count(*)::integer
    from sigav."TB_APLICACAO_PESQUISA" aplicacao
    join sigav."TH_VERSAO_PESQUISA" versao on versao."SQ_VERSAO_PESQUISA" = aplicacao."SQ_VERSAO_PESQUISA"
    join sigav."TB_PESQUISA" pesquisa on pesquisa."SQ_PESQUISA" = versao."SQ_PESQUISA"
    where pesquisa."CO_PESQUISA" = 'TESTE-CLONE-ORIG-COPIA'
  ),
  1,
  'a cópia nasce com um ciclo próprio'
);

select is(
  (
    select aplicacao."ST_SITUACAO"
    from sigav."TB_APLICACAO_PESQUISA" aplicacao
    join sigav."TH_VERSAO_PESQUISA" versao on versao."SQ_VERSAO_PESQUISA" = aplicacao."SQ_VERSAO_PESQUISA"
    join sigav."TB_PESQUISA" pesquisa on pesquisa."SQ_PESQUISA" = versao."SQ_PESQUISA"
    where pesquisa."CO_PESQUISA" = 'TESTE-CLONE-ORIG-COPIA'
  ),
  'DRAFT',
  'o ciclo da cópia nasce em rascunho'
);

select ok(
  (
    select aplicacao."DT_ABERTURA" is null and aplicacao."DT_ENCERRAMENTO" is null
    from sigav."TB_APLICACAO_PESQUISA" aplicacao
    join sigav."TH_VERSAO_PESQUISA" versao on versao."SQ_VERSAO_PESQUISA" = aplicacao."SQ_VERSAO_PESQUISA"
    join sigav."TB_PESQUISA" pesquisa on pesquisa."SQ_PESQUISA" = versao."SQ_PESQUISA"
    where pesquisa."CO_PESQUISA" = 'TESTE-CLONE-ORIG-COPIA'
  ),
  'o ciclo da cópia não herda o período da origem'
);

select lives_ok(
  $$
    select sigav."FC_GERIR_CICLO_PESQUISA"(
      (select "SQ_PESQUISA" from sigav."TB_PESQUISA" where "CO_PESQUISA" = 'TESTE-CLONE-ORIG-COPIA'),
      'UPDATE_PERIOD', now() - interval '30 seconds', now() + interval '2 hours'
    )
  $$,
  'o ciclo clonado aceita a configuração do período'
);

select lives_ok(
  $$
    select sigav."FC_GERIR_CICLO_PESQUISA"(
      (select "SQ_PESQUISA" from sigav."TB_PESQUISA" where "CO_PESQUISA" = 'TESTE-CLONE-ORIG-COPIA'),
      'PUBLISH'
    )
  $$,
  'a versão clonada pode ser publicada'
);

select lives_ok(
  $$
    select sigav."FC_GERIR_CICLO_PESQUISA"(
      (select "SQ_PESQUISA" from sigav."TB_PESQUISA" where "CO_PESQUISA" = 'TESTE-CLONE-ORIG-COPIA'),
      'OPEN'
    )
  $$,
  'o ciclo clonado pode ser iniciado'
);

select lives_ok(
  $$
    select sigav."FC_GERIR_CICLO_PESQUISA"(
      (select "SQ_PESQUISA" from sigav."TB_PESQUISA" where "CO_PESQUISA" = 'TESTE-CLONE-ORIG-COPIA'),
      'CLOSE'
    )
  $$,
  'o ciclo clonado pode ser interrompido'
);

select lives_ok(
  $$
    select sigav."FC_GERIR_CICLO_PESQUISA"(
      (select "SQ_PESQUISA" from sigav."TB_PESQUISA" where "CO_PESQUISA" = 'TESTE-CLONE-ORIG-COPIA'),
      'ARCHIVE'
    )
  $$,
  'a cópia interrompida pode ser arquivada pelo catálogo'
);

select lives_ok(
  $$
    select sigav."FC_GERIR_CICLO_PESQUISA"(
      (select "SQ_PESQUISA" from sigav."TB_PESQUISA" where "CO_PESQUISA" = 'TESTE-CLONE-ORIG-COPIA'),
      'UNARCHIVE'
    )
  $$,
  'a cópia arquivada pode voltar ao catálogo'
);

select is(
  (select count(*)::integer from sigav."TB_SECAO_PESQUISA" where "SQ_VERSAO_PESQUISA" = (
    select v."SQ_VERSAO_PESQUISA" from sigav."TH_VERSAO_PESQUISA" v join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = v."SQ_PESQUISA"
    where s."CO_PESQUISA" = 'TESTE-CLONE-ORIG-COPIA'
  )),
  2,
  'a cópia leva as duas seções (INTRO e a aninhada)'
);

select is(
  (select count(*)::integer from sigav."TB_PERGUNTA_PESQUISA" where "SQ_VERSAO_PESQUISA" = (
    select v."SQ_VERSAO_PESQUISA" from sigav."TH_VERSAO_PESQUISA" v join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = v."SQ_PESQUISA"
    where s."CO_PESQUISA" = 'TESTE-CLONE-ORIG-COPIA'
  )),
  2,
  'a cópia leva as duas perguntas'
);

select is(
  (select count(*)::integer from sigav."TB_REGRA_CONDICIONAL" where "SQ_VERSAO_PESQUISA" = (
    select v."SQ_VERSAO_PESQUISA" from sigav."TH_VERSAO_PESQUISA" v join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = v."SQ_PESQUISA"
    where s."CO_PESQUISA" = 'TESTE-CLONE-ORIG-COPIA'
  )),
  1,
  'a cópia leva a regra condicional'
);

-- O cerne da função: a regra copiada aponta para a pergunta Q1 **da cópia**,
-- não para a original.
select is(
  (
    select condicao."SQ_PERGUNTA_ORIGEM"
    from sigav."TB_CONDICAO_REGRA" condicao
    join sigav."TB_REGRA_CONDICIONAL" regra on regra."SQ_REGRA" = condicao."SQ_REGRA"
    where regra."SQ_VERSAO_PESQUISA" = (
      select v."SQ_VERSAO_PESQUISA" from sigav."TH_VERSAO_PESQUISA" v join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = v."SQ_PESQUISA"
      where s."CO_PESQUISA" = 'TESTE-CLONE-ORIG-COPIA'
    )
  ),
  (
    select q."SQ_PERGUNTA" from sigav."TB_PERGUNTA_PESQUISA" q
    where q."CO_PERGUNTA" = 'Q1' and q."SQ_VERSAO_PESQUISA" = (
      select v."SQ_VERSAO_PESQUISA" from sigav."TH_VERSAO_PESQUISA" v join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = v."SQ_PESQUISA"
      where s."CO_PESQUISA" = 'TESTE-CLONE-ORIG-COPIA'
    )
  ),
  'a regra copiada aponta para o Q1 da cópia, não para o original'
);

-- Seção aninhada: o parent_section_id da cópia aponta para o INTRO da
-- cópia, não para o INTRO original.
select is(
  (
    select "SQ_SECAO_PAI" from sigav."TB_SECAO_PESQUISA"
    where "CO_SECAO" = 'S1A' and "SQ_VERSAO_PESQUISA" = (
      select v."SQ_VERSAO_PESQUISA" from sigav."TH_VERSAO_PESQUISA" v join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = v."SQ_PESQUISA"
      where s."CO_PESQUISA" = 'TESTE-CLONE-ORIG-COPIA'
    )
  ),
  (
    select "SQ_SECAO" from sigav."TB_SECAO_PESQUISA"
    where "CO_SECAO" = 'INTRO' and "SQ_VERSAO_PESQUISA" = (
      select v."SQ_VERSAO_PESQUISA" from sigav."TH_VERSAO_PESQUISA" v join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = v."SQ_PESQUISA"
      where s."CO_PESQUISA" = 'TESTE-CLONE-ORIG-COPIA'
    )
  ),
  'a seção aninhada da cópia aponta para o INTRO da própria cópia'
);

-- Sem código customizado, uma segunda cópia colide com a primeira e ganha
-- sufixo — a função existe para que a tela nunca devolva erro de constraint.
select lives_ok(
  $$ select sigav."FC_CLONAR_PESQUISA"((select "SQ_PESQUISA" from sigav."TB_PESQUISA" where "CO_PESQUISA" = 'TESTE-CLONE-ORIG')) $$,
  'clonar de novo, sem código customizado, é aceito'
);

select is(
  (select "CO_PESQUISA" from sigav."TB_PESQUISA" where "NO_PESQUISA" = 'Pesquisa original (cópia)' and "CO_PESQUISA" <> 'TESTE-CLONE-ORIG-COPIA'),
  'TESTE-CLONE-ORIG-COPIA-2',
  'a segunda cópia sem código customizado ganha sufixo -2'
);

select lives_ok(
  $$
    select sigav."FC_CLONAR_PESQUISA"(
      (select "SQ_PESQUISA" from sigav."TB_PESQUISA" where "CO_PESQUISA" = 'TESTE-CLONE-ORIG'),
      'Cópia customizada',
      'CLONE-CUSTOM'
    )
  $$,
  'clonar com nome e código customizados é aceito'
);

select is(
  (select "NO_PESQUISA" from sigav."TB_PESQUISA" where "CO_PESQUISA" = 'CLONE-CUSTOM'),
  'Cópia customizada',
  'o nome customizado é usado quando informado'
);

select ok(
  exists (select 1 from sigav."TB_PESQUISA" where "CO_PESQUISA" = 'CLONE-CUSTOM'),
  'o código customizado é usado quando informado'
);

-- Versão PUBLISHED é preferida mesmo havendo uma versão DRAFT mais recente —
-- a ordem do "order by" na função, não o version_number, decide qual é
-- copiada.
select sigav."FC_CRIAR_RASCUNHO_PESQUISA"(
  'TESTE-CLONE-PREF', 'Pesquisa com duas versões', 'Descrição', 'Ciclo 1',
  now() + interval '1 day', now() + interval '2 days', false, true
);

insert into sigav."TB_PERGUNTA_PESQUISA" ("SQ_VERSAO_PESQUISA", "SQ_SECAO", "CO_PERGUNTA", "NO_PERGUNTA", "TP_PERGUNTA", "ST_OBRIGATORIA", "NU_ORDEM")
select v."SQ_VERSAO_PESQUISA", sec."SQ_SECAO", 'Q1', 'Pergunta única', 'SHORT_TEXT', false, 1
from sigav."TH_VERSAO_PESQUISA" v
join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = v."SQ_PESQUISA"
join sigav."TB_SECAO_PESQUISA" sec on sec."SQ_VERSAO_PESQUISA" = v."SQ_VERSAO_PESQUISA" and sec."CO_SECAO" = 'INTRO'
where s."CO_PESQUISA" = 'TESTE-CLONE-PREF';

update sigav."TH_VERSAO_PESQUISA"
set "ST_SITUACAO" = 'PUBLISHED', "DT_PUBLICACAO" = now()
where "SQ_PESQUISA" = (select "SQ_PESQUISA" from sigav."TB_PESQUISA" where "CO_PESQUISA" = 'TESTE-CLONE-PREF') and "NU_VERSAO" = 1;

-- Versão 2 é criada direto por insert (sem estrutura nenhuma), só para provar
-- que a função ignora o version_number maior quando ele não é PUBLISHED.
insert into sigav."TH_VERSAO_PESQUISA" ("SQ_PESQUISA", "NU_VERSAO", "NO_VERSAO", "ST_SITUACAO")
select "SQ_PESQUISA", 2, 'Rascunho mais novo, sem estrutura', 'DRAFT'
from sigav."TB_PESQUISA" where "CO_PESQUISA" = 'TESTE-CLONE-PREF';

select sigav."FC_CLONAR_PESQUISA"((select "SQ_PESQUISA" from sigav."TB_PESQUISA" where "CO_PESQUISA" = 'TESTE-CLONE-PREF'));

select is(
  (select count(*)::integer from sigav."TB_SECAO_PESQUISA" where "SQ_VERSAO_PESQUISA" = (
    select v."SQ_VERSAO_PESQUISA" from sigav."TH_VERSAO_PESQUISA" v join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = v."SQ_PESQUISA"
    where s."CO_PESQUISA" = 'TESTE-CLONE-PREF-COPIA'
  )),
  1,
  'a cópia usa a versão PUBLISHED (1 seção), não o rascunho mais novo e vazio'
);

select * from finish();

rollback;
