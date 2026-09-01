-- Fase 1 — o que acontece com quem já está no público.
--
-- O arquivo vizinho cobre a resolução da regra: quem o critério alcança. Este
-- cobre a parte perigosa: aplicar a regra sobre um snapshot que já existe.
--
-- Dois defeitos motivaram estas asserções, os dois encontrados em revisão:
--
--   1. o upsert forçava `ELIGIBLE` em todo mundo, rebaixando quem estava
--      `IN_PROGRESS` ou `COMPLETED` — e a tela, ao mesmo tempo, prometia que
--      pessoas já vinculadas "permanecem como estão";
--   2. aplicar uma regra nova só adicionava. Trocar Diretoria A por Diretoria B
--      deixava A+B vinculados enquanto `settings.audience` registrava só B, e o
--      snapshot deixava de descrever a regra sem nada acusar.
--
-- A asserção final é a que amarra as outras: o número que a prévia mostra tem
-- de ser o número de pessoas com acesso depois de aplicar.

begin;

select plan(16);

insert into sigav."TB_USUARIO_IDENTIDADE" ("SQ_USUARIO", "TP_AUDIENCIA", "TP_PAPEL", "DS_EMAIL", "DT_INCLUSAO", "DT_ALTERACAO")
values ('00000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'recon-admin@agenciasus.org.br', now(), now());

insert into sigav."TB_PESSOA" ("SQ_PESSOA", "SQ_USUARIO_IDENTIDADE", "CO_MATRICULA", "NO_PESSOA", "DS_EMAIL_INSTITUCIONAL", "ST_ATIVO")
values ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000101', 'TESTE-RECON-ADM', 'Administração', 'recon-admin@agenciasus.org.br', true);

-- Preset Admin - era a role SURVEY_MANAGER, e as tabelas de perfil sairam do
-- banco em 20260828150000_remover_perfis_legados_do_banco.sql. A autorizacao
-- hoje e permissao por pessoa; as funcoes sob teste exigem ADMIN_SURVEYS, via
-- can_manage_surveys().
insert into sigav."RL_PESSOA_MODULO" ("SQ_PESSOA", "CO_MODULO", "ST_PERMITIDO")
select '00000000-0000-4000-8000-000000000102', modulo, true
  from unnest(array[
    'HOME', 'SURVEYS', 'DASHBOARDS', 'ONLINE_PRESENCE',
    'ADMIN_SURVEYS', 'ADMIN_PARTICIPANTS'
  ]) modulo;

-- Cinco pessoas na Diretoria A, uma por estado inicial, e uma na Diretoria B
-- para a troca de regra.
insert into sigav."TB_PESSOA" ("SQ_PESSOA", "CO_MATRICULA", "NO_PESSOA", "DS_EMAIL_INSTITUCIONAL", "ST_ATIVO", "DS_METADADO")
values
  ('00000000-0000-4000-8000-000000000111', 'RECON-1', 'Um Elegivel',    'r1@agenciasus.org.br', true, '{"directorate":"DIR-A"}'::jsonb),
  ('00000000-0000-4000-8000-000000000112', 'RECON-2', 'Dois Andamento', 'r2@agenciasus.org.br', true, '{"directorate":"DIR-A"}'::jsonb),
  ('00000000-0000-4000-8000-000000000113', 'RECON-3', 'Tres Concluido', 'r3@agenciasus.org.br', true, '{"directorate":"DIR-A"}'::jsonb),
  ('00000000-0000-4000-8000-000000000114', 'RECON-4', 'Quatro Bloqueado','r4@agenciasus.org.br', true, '{"directorate":"DIR-A"}'::jsonb),
  ('00000000-0000-4000-8000-000000000115', 'RECON-5', 'Cinco Removido', 'r5@agenciasus.org.br', true, '{"directorate":"DIR-A"}'::jsonb),
  ('00000000-0000-4000-8000-000000000116', 'RECON-6', 'Seis DiretoriaB','r6@agenciasus.org.br', true, '{"directorate":"DIR-B"}'::jsonb);

insert into sigav."TB_PESQUISA" ("SQ_PESQUISA", "CO_PESQUISA", "NO_PESQUISA")
values ('00000000-0000-4000-8000-000000000121', 'TESTE-RECON', 'Pesquisa de reconciliação');

insert into sigav."TH_VERSAO_PESQUISA" ("SQ_VERSAO_PESQUISA", "SQ_PESQUISA", "NU_VERSAO", "NO_VERSAO", "ST_SITUACAO")
values ('00000000-0000-4000-8000-000000000122', '00000000-0000-4000-8000-000000000121', 1, 'Versão 1', 'PUBLISHED');

insert into sigav."TB_APLICACAO_PESQUISA" ("SQ_APLICACAO", "SQ_VERSAO_PESQUISA", "CO_APLICACAO", "NO_APLICACAO", "ST_SITUACAO")
values ('00000000-0000-4000-8000-000000000123', '00000000-0000-4000-8000-000000000122', 'TESTE-RECON-1', 'Ciclo', 'DRAFT');

-- Snapshot anterior, com os cinco estados que a aplicação precisa respeitar.
insert into sigav."RL_APLICACAO_PESSOA" ("SQ_APLICACAO", "SQ_PESSOA", "TP_PARTICIPANTE", "ST_SITUACAO", "TP_ACESSO")
values
  ('00000000-0000-4000-8000-000000000123', '00000000-0000-4000-8000-000000000111', 'RESPONDENT', 'ELIGIBLE', null),
  ('00000000-0000-4000-8000-000000000123', '00000000-0000-4000-8000-000000000112', 'RESPONDENT', 'IN_PROGRESS', 'GESTOR-DE-TESTE'),
  ('00000000-0000-4000-8000-000000000123', '00000000-0000-4000-8000-000000000113', 'RESPONDENT', 'COMPLETED', null),
  ('00000000-0000-4000-8000-000000000123', '00000000-0000-4000-8000-000000000114', 'RESPONDENT', 'BLOCKED', null),
  ('00000000-0000-4000-8000-000000000123', '00000000-0000-4000-8000-000000000115', 'RESPONDENT', 'EXCLUDED', null);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000101","role":"authenticated"}',
  true
);

-- ---------------------------------------------------------------------------
-- Regra A — a Diretoria em que todos os cinco estão
-- ---------------------------------------------------------------------------

select sigav."FC_APLICAR_PUBLICO_AVALIACAO"(
  '00000000-0000-4000-8000-000000000123',
  '{"filters":{"directorate":["DIR-A"]}}'::jsonb
);

-- Este é o bloqueador 1: o upsert antigo escrevia 'ELIGIBLE' aqui e apagava o
-- fato de a pessoa ter começado a responder.
select is(
  (select "ST_SITUACAO" from sigav."RL_APLICACAO_PESSOA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-000000000123'
     and "SQ_PESSOA" = '00000000-0000-4000-8000-000000000112'),
  'IN_PROGRESS',
  'quem estava respondendo continua IN_PROGRESS depois de aplicar a regra'
);

select is(
  (select "ST_SITUACAO" from sigav."RL_APLICACAO_PESSOA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-000000000123'
     and "SQ_PESSOA" = '00000000-0000-4000-8000-000000000113'),
  'COMPLETED',
  'quem concluiu continua COMPLETED depois de aplicar a regra'
);

-- Bloqueio é ato administrativo deliberado sobre a pessoa. Reaplicar uma regra
-- de público não é lugar para desfazê-lo.
select is(
  (select "ST_SITUACAO" from sigav."RL_APLICACAO_PESSOA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-000000000123'
     and "SQ_PESSOA" = '00000000-0000-4000-8000-000000000114'),
  'BLOCKED',
  'bloqueio administrativo sobrevive à aplicação da regra'
);

-- EXCLUDED significa "fora do público", e a regra nova diz que está dentro.
select is(
  (select "ST_SITUACAO" from sigav."RL_APLICACAO_PESSOA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-000000000123'
     and "SQ_PESSOA" = '00000000-0000-4000-8000-000000000115'),
  'ELIGIBLE',
  'quem estava removido volta quando a regra o alcança de novo'
);

-- ...mas não volta se a mesma aplicação o exclui explicitamente.
select sigav."FC_APLICAR_PUBLICO_AVALIACAO"(
  '00000000-0000-4000-8000-000000000123',
  '{"filters":{"directorate":["DIR-A"]},"excludePersonIds":["00000000-0000-4000-8000-000000000115"]}'::jsonb
);

select is(
  (select "ST_SITUACAO" from sigav."RL_APLICACAO_PESSOA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-000000000123'
     and "SQ_PESSOA" = '00000000-0000-4000-8000-000000000115'),
  'EXCLUDED',
  'exclusão explícita vence a reativação na mesma aplicação'
);

select is(
  (select "DS_METADADO" ->> 'reason' from sigav."RL_APLICACAO_PESSOA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-000000000123'
     and "SQ_PESSOA" = '00000000-0000-4000-8000-000000000115'),
  'explicit_exclusion',
  'o registro distingue exclusão deliberada de saída por mudança de regra'
);

-- ---------------------------------------------------------------------------
-- Regra B — bloqueador 2: o público é substituído, não somado
-- ---------------------------------------------------------------------------

-- A prévia é consultada antes de aplicar, e os valores guardados para
-- conferência depois. É o que amarra prévia e efeito.
--
-- Guardados em `set_config`, não em tabela temporária: a PR afirma não usar
-- tabela temporária, e um teste que abre exceção à própria regra ensina que a
-- regra admite exceções. O escopo é a transação (`true` no terceiro argumento),
-- então o `rollback` do fim leva tudo junto.
select set_config('teste_publico.efetivo',
  sigav."FC_PREVISUALIZAR_PUBLICO"(
    '00000000-0000-4000-8000-000000000123',
    '{"filters":{"directorate":["DIR-B"]}}'::jsonb) ->> 'effectiveCount', true);

select set_config('teste_publico.removidos',
  sigav."FC_PREVISUALIZAR_PUBLICO"(
    '00000000-0000-4000-8000-000000000123',
    '{"filters":{"directorate":["DIR-B"]}}'::jsonb) ->> 'removedCount', true);

select set_config('teste_publico.preservados',
  sigav."FC_PREVISUALIZAR_PUBLICO"(
    '00000000-0000-4000-8000-000000000123',
    '{"filters":{"directorate":["DIR-B"]}}'::jsonb) ->> 'retainedWithProgressCount', true);

select is(
  current_setting('teste_publico.removidos')::integer,
  1,
  'a prévia avisa que alguém sai do público ao trocar de regra'
);

select is(
  current_setting('teste_publico.preservados')::integer,
  2,
  'a prévia avisa quem permanece por já ter progresso'
);

select sigav."FC_APLICAR_PUBLICO_AVALIACAO"(
  '00000000-0000-4000-8000-000000000123',
  '{"filters":{"directorate":["DIR-B"]}}'::jsonb
);

-- O coração do bloqueador 2: sem reconciliação, este seria 'ELIGIBLE' e o
-- público ficaria sendo A+B enquanto a regra registrada diz só B.
select is(
  (select "ST_SITUACAO" from sigav."RL_APLICACAO_PESSOA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-000000000123'
     and "SQ_PESSOA" = '00000000-0000-4000-8000-000000000111'),
  'EXCLUDED',
  'quem deixou de casar com a regra sai do público'
);

select is(
  (select "DS_METADADO" ->> 'reason' from sigav."RL_APLICACAO_PESSOA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-000000000123'
     and "SQ_PESSOA" = '00000000-0000-4000-8000-000000000111'),
  'rule_no_longer_matches',
  'o registro diz que a saída foi por mudança de regra, não por exclusão'
);

-- Nada foi apagado: a linha continua lá, com histórico.
select is(
  (select count(*)::integer from sigav."RL_APLICACAO_PESSOA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-000000000123'),
  6,
  'reduzir o público não apaga vínculo — as seis linhas continuam existindo'
);

select results_eq(
  $$select p."NO_PESSOA", ap."ST_SITUACAO"
    from sigav."RL_APLICACAO_PESSOA" ap
    join sigav."TB_PESSOA" p on p."SQ_PESSOA" = ap."SQ_PESSOA"
    where ap."SQ_APLICACAO" = '00000000-0000-4000-8000-000000000123'
      and ap."ST_SITUACAO" not in ('BLOCKED', 'EXCLUDED')
    order by p."NO_PESSOA"$$,
  $$values ('Dois Andamento'::text, 'IN_PROGRESS'::text),
           ('Seis DiretoriaB'::text, 'ELIGIBLE'::text),
           ('Tres Concluido'::text, 'COMPLETED'::text)$$,
  'o público efetivo é o alcançado pela regra mais quem já tinha progresso'
);

-- `p_perfil_acesso` é o padrão para vínculo **novo**. Aplicá-lo a quem já tem
-- perfil próprio rebaixaria a pessoa ao padrão a cada reaplicação da regra.
select is(
  (select "TP_ACESSO" from sigav."RL_APLICACAO_PESSOA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-000000000123'
     and "SQ_PESSOA" = '00000000-0000-4000-8000-000000000112'),
  'GESTOR-DE-TESTE',
  'perfil de acesso de vínculo existente sobrevive à aplicação da regra'
);

-- A asserção que amarra tudo: o número prometido é o número entregue.
select is(
  (select count(*)::integer from sigav."RL_APLICACAO_PESSOA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-000000000123'
     and "ST_SITUACAO" not in ('BLOCKED', 'EXCLUDED')),
  current_setting('teste_publico.efetivo')::integer,
  'a contagem da prévia corresponde ao snapshot efetivo depois de aplicar'
);

-- ---------------------------------------------------------------------------
-- Bloqueio não é levantado por caminho indireto
-- ---------------------------------------------------------------------------

-- Havia um caminho de dois passos que desfazia a sanção sem ninguém pedir:
-- excluir a pessoa bloqueada pela regra (BLOCKED -> EXCLUDED) e reaplicar sem a
-- exclusão (EXCLUDED -> ELIGIBLE). A exclusão vinha antes da preservação de
-- BLOCKED no plano, e o construtor de público acabava com poder que a própria
-- PR dizia não ter.

select sigav."FC_APLICAR_PUBLICO_AVALIACAO"(
  '00000000-0000-4000-8000-000000000123',
  '{"filters":{"directorate":["DIR-A"]},"excludePersonIds":["00000000-0000-4000-8000-000000000114"]}'::jsonb
);

select is(
  (select "ST_SITUACAO" from sigav."RL_APLICACAO_PESSOA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-000000000123'
     and "SQ_PESSOA" = '00000000-0000-4000-8000-000000000114'),
  'BLOCKED',
  'pessoa bloqueada e excluída explicitamente continua BLOCKED, não vira EXCLUDED'
);

-- O segundo passo do caminho antigo. Sem a correção, aqui viraria ELIGIBLE.
select sigav."FC_APLICAR_PUBLICO_AVALIACAO"(
  '00000000-0000-4000-8000-000000000123',
  '{"filters":{"directorate":["DIR-A"]}}'::jsonb
);

select is(
  (select "ST_SITUACAO" from sigav."RL_APLICACAO_PESSOA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-000000000123'
     and "SQ_PESSOA" = '00000000-0000-4000-8000-000000000114'),
  'BLOCKED',
  'reaplicar a regra sem a exclusão não levanta o bloqueio administrativo'
);

select * from finish();

rollback;
