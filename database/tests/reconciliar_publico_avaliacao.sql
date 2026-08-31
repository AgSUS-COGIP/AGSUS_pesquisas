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

insert into sigav.tb_usuario_identidade (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000101', 'authenticated', 'authenticated', 'recon-admin@agenciasus.org.br', now(), now());

insert into sigav.people (id, auth_user_id, employee_number, full_name, institutional_email, active)
values ('00000000-0000-4000-8000-000000000102', '00000000-0000-4000-8000-000000000101', 'TESTE-RECON-ADM', 'Administração', 'recon-admin@agenciasus.org.br', true);

-- Preset Admin - era a role SURVEY_MANAGER, e as tabelas de perfil sairam do
-- banco em 20260828150000_remover_perfis_legados_do_banco.sql. A autorizacao
-- hoje e permissao por pessoa; as funcoes sob teste exigem ADMIN_SURVEYS, via
-- can_manage_surveys().
insert into sigav.person_module_permissions (person_id, module_code, allowed)
select '00000000-0000-4000-8000-000000000102', modulo, true
  from unnest(array[
    'HOME', 'SURVEYS', 'DASHBOARDS', 'ONLINE_PRESENCE',
    'ADMIN_SURVEYS', 'ADMIN_PARTICIPANTS'
  ]) modulo;

-- Cinco pessoas na Diretoria A, uma por estado inicial, e uma na Diretoria B
-- para a troca de regra.
insert into sigav.people (id, employee_number, full_name, institutional_email, active, metadata)
values
  ('00000000-0000-4000-8000-000000000111', 'RECON-1', 'Um Elegivel',    'r1@agenciasus.org.br', true, '{"directorate":"DIR-A"}'::jsonb),
  ('00000000-0000-4000-8000-000000000112', 'RECON-2', 'Dois Andamento', 'r2@agenciasus.org.br', true, '{"directorate":"DIR-A"}'::jsonb),
  ('00000000-0000-4000-8000-000000000113', 'RECON-3', 'Tres Concluido', 'r3@agenciasus.org.br', true, '{"directorate":"DIR-A"}'::jsonb),
  ('00000000-0000-4000-8000-000000000114', 'RECON-4', 'Quatro Bloqueado','r4@agenciasus.org.br', true, '{"directorate":"DIR-A"}'::jsonb),
  ('00000000-0000-4000-8000-000000000115', 'RECON-5', 'Cinco Removido', 'r5@agenciasus.org.br', true, '{"directorate":"DIR-A"}'::jsonb),
  ('00000000-0000-4000-8000-000000000116', 'RECON-6', 'Seis DiretoriaB','r6@agenciasus.org.br', true, '{"directorate":"DIR-B"}'::jsonb);

insert into sigav.surveys (id, code, name)
values ('00000000-0000-4000-8000-000000000121', 'TESTE-RECON', 'Pesquisa de reconciliação');

insert into sigav.survey_versions (id, survey_id, version_number, title, status)
values ('00000000-0000-4000-8000-000000000122', '00000000-0000-4000-8000-000000000121', 1, 'Versão 1', 'PUBLISHED');

insert into sigav.survey_applications (id, survey_version_id, code, name, status)
values ('00000000-0000-4000-8000-000000000123', '00000000-0000-4000-8000-000000000122', 'TESTE-RECON-1', 'Ciclo', 'DRAFT');

-- Snapshot anterior, com os cinco estados que a aplicação precisa respeitar.
insert into sigav.application_participants (application_id, person_id, participant_role, status, access_profile)
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

select sigav.fc_aplicar_publico_avaliacao(
  '00000000-0000-4000-8000-000000000123',
  '{"filters":{"directorate":["DIR-A"]}}'::jsonb
);

-- Este é o bloqueador 1: o upsert antigo escrevia 'ELIGIBLE' aqui e apagava o
-- fato de a pessoa ter começado a responder.
select is(
  (select status from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-000000000123'
     and person_id = '00000000-0000-4000-8000-000000000112'),
  'IN_PROGRESS',
  'quem estava respondendo continua IN_PROGRESS depois de aplicar a regra'
);

select is(
  (select status from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-000000000123'
     and person_id = '00000000-0000-4000-8000-000000000113'),
  'COMPLETED',
  'quem concluiu continua COMPLETED depois de aplicar a regra'
);

-- Bloqueio é ato administrativo deliberado sobre a pessoa. Reaplicar uma regra
-- de público não é lugar para desfazê-lo.
select is(
  (select status from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-000000000123'
     and person_id = '00000000-0000-4000-8000-000000000114'),
  'BLOCKED',
  'bloqueio administrativo sobrevive à aplicação da regra'
);

-- EXCLUDED significa "fora do público", e a regra nova diz que está dentro.
select is(
  (select status from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-000000000123'
     and person_id = '00000000-0000-4000-8000-000000000115'),
  'ELIGIBLE',
  'quem estava removido volta quando a regra o alcança de novo'
);

-- ...mas não volta se a mesma aplicação o exclui explicitamente.
select sigav.fc_aplicar_publico_avaliacao(
  '00000000-0000-4000-8000-000000000123',
  '{"filters":{"directorate":["DIR-A"]},"excludePersonIds":["00000000-0000-4000-8000-000000000115"]}'::jsonb
);

select is(
  (select status from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-000000000123'
     and person_id = '00000000-0000-4000-8000-000000000115'),
  'EXCLUDED',
  'exclusão explícita vence a reativação na mesma aplicação'
);

select is(
  (select metadata ->> 'reason' from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-000000000123'
     and person_id = '00000000-0000-4000-8000-000000000115'),
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
  sigav.fc_previsualizar_publico_avaliacao(
    '00000000-0000-4000-8000-000000000123',
    '{"filters":{"directorate":["DIR-B"]}}'::jsonb) ->> 'effectiveCount', true);

select set_config('teste_publico.removidos',
  sigav.fc_previsualizar_publico_avaliacao(
    '00000000-0000-4000-8000-000000000123',
    '{"filters":{"directorate":["DIR-B"]}}'::jsonb) ->> 'removedCount', true);

select set_config('teste_publico.preservados',
  sigav.fc_previsualizar_publico_avaliacao(
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

select sigav.fc_aplicar_publico_avaliacao(
  '00000000-0000-4000-8000-000000000123',
  '{"filters":{"directorate":["DIR-B"]}}'::jsonb
);

-- O coração do bloqueador 2: sem reconciliação, este seria 'ELIGIBLE' e o
-- público ficaria sendo A+B enquanto a regra registrada diz só B.
select is(
  (select status from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-000000000123'
     and person_id = '00000000-0000-4000-8000-000000000111'),
  'EXCLUDED',
  'quem deixou de casar com a regra sai do público'
);

select is(
  (select metadata ->> 'reason' from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-000000000123'
     and person_id = '00000000-0000-4000-8000-000000000111'),
  'rule_no_longer_matches',
  'o registro diz que a saída foi por mudança de regra, não por exclusão'
);

-- Nada foi apagado: a linha continua lá, com histórico.
select is(
  (select count(*)::integer from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-000000000123'),
  6,
  'reduzir o público não apaga vínculo — as seis linhas continuam existindo'
);

select results_eq(
  $$select p.full_name, ap.status
    from sigav.application_participants ap
    join sigav.people p on p.id = ap.person_id
    where ap.application_id = '00000000-0000-4000-8000-000000000123'
      and ap.status not in ('BLOCKED', 'EXCLUDED')
    order by p.full_name$$,
  $$values ('Dois Andamento'::text, 'IN_PROGRESS'::text),
           ('Seis DiretoriaB'::text, 'ELIGIBLE'::text),
           ('Tres Concluido'::text, 'COMPLETED'::text)$$,
  'o público efetivo é o alcançado pela regra mais quem já tinha progresso'
);

-- `p_perfil_acesso` é o padrão para vínculo **novo**. Aplicá-lo a quem já tem
-- perfil próprio rebaixaria a pessoa ao padrão a cada reaplicação da regra.
select is(
  (select access_profile from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-000000000123'
     and person_id = '00000000-0000-4000-8000-000000000112'),
  'GESTOR-DE-TESTE',
  'perfil de acesso de vínculo existente sobrevive à aplicação da regra'
);

-- A asserção que amarra tudo: o número prometido é o número entregue.
select is(
  (select count(*)::integer from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-000000000123'
     and status not in ('BLOCKED', 'EXCLUDED')),
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

select sigav.fc_aplicar_publico_avaliacao(
  '00000000-0000-4000-8000-000000000123',
  '{"filters":{"directorate":["DIR-A"]},"excludePersonIds":["00000000-0000-4000-8000-000000000114"]}'::jsonb
);

select is(
  (select status from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-000000000123'
     and person_id = '00000000-0000-4000-8000-000000000114'),
  'BLOCKED',
  'pessoa bloqueada e excluída explicitamente continua BLOCKED, não vira EXCLUDED'
);

-- O segundo passo do caminho antigo. Sem a correção, aqui viraria ELIGIBLE.
select sigav.fc_aplicar_publico_avaliacao(
  '00000000-0000-4000-8000-000000000123',
  '{"filters":{"directorate":["DIR-A"]}}'::jsonb
);

select is(
  (select status from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-000000000123'
     and person_id = '00000000-0000-4000-8000-000000000114'),
  'BLOCKED',
  'reaplicar a regra sem a exclusão não levanta o bloqueio administrativo'
);

select * from finish();

rollback;
