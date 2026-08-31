-- Fase 1 — Definir público da avaliação.
--
-- O critério que mais importa aqui é o da igualdade entre prévia e aplicação: o
-- número mostrado antes de gravar tem de ser o número gravado. Ele é garantido
-- estruturalmente — as duas chamam `fc_resolver_publico_avaliacao` —, e as
-- asserções abaixo verificam que a estrutura entrega o que promete.
--
-- Cobre também o que a regra faz de não óbvio: OR dentro da dimensão, AND entre
-- dimensões, inclusão individual adicional, exclusão com precedência, regra
-- vazia que não seleciona ninguém, e normalização que impede grafias
-- equivalentes de fragmentar a mesma coordenação.

begin;

select plan(22);

insert into sigav.tb_usuario_identidade (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-0000000000c1', 'authenticated', 'authenticated', 'publico-admin@agenciasus.org.br', now(), now());

insert into sigav.people (id, auth_user_id, employee_number, full_name, institutional_email, active)
values ('00000000-0000-4000-8000-0000000000c2', '00000000-0000-4000-8000-0000000000c1', 'TESTE-PUB-ADM', 'Administração de Teste', 'publico-admin@agenciasus.org.br', true);

-- Preset Admin - era a role SURVEY_MANAGER, e as tabelas de perfil sairam do
-- banco em 20260828150000_remover_perfis_legados_do_banco.sql. A autorizacao
-- hoje e permissao por pessoa; as funcoes sob teste exigem ADMIN_SURVEYS, via
-- can_manage_surveys().
insert into sigav.person_module_permissions (person_id, module_code, allowed)
select '00000000-0000-4000-8000-0000000000c2', modulo, true
  from unnest(array[
    'HOME', 'SURVEYS', 'DASHBOARDS', 'ONLINE_PRESENCE',
    'ADMIN_SURVEYS', 'ADMIN_PARTICIPANTS'
  ]) modulo;

-- Quatro pessoas cobrindo as combinações que a regra precisa distinguir. As
-- duas coordenações são a mesma, escritas diferente de propósito.
insert into sigav.people (id, employee_number, full_name, institutional_email, active, job_title, cost_center, metadata)
values
  ('00000000-0000-4000-8000-0000000000d1', 'TESTE-PUB-1', 'Ana Assessora',   'pub1@agenciasus.org.br', true,  'Assessor', 'CC-100',
   '{"directorate":"DGP","unit":"Escritorio A","coordination":"Coord  de  Gestão"}'::jsonb),
  ('00000000-0000-4000-8000-0000000000d2', 'TESTE-PUB-2', 'Bruno Assessor',  'pub2@agenciasus.org.br', true,  'Assessor', 'CC-200',
   '{"directorate":"DGP","unit":"Escritório B","coordination":"COORD DE GESTAO"}'::jsonb),
  ('00000000-0000-4000-8000-0000000000d3', 'TESTE-PUB-3', 'Carla Analista',  'pub3@agenciasus.org.br', true,  'Analista', 'CC-100',
   '{"directorate":"DGP","unit":"Escritorio A"}'::jsonb),
  ('00000000-0000-4000-8000-0000000000d4', 'TESTE-PUB-4', 'Davi Inativo',    'pub4@agenciasus.org.br', false, 'Assessor', 'CC-100',
   '{"directorate":"DGP","unit":"Escritorio A"}'::jsonb);

insert into sigav.surveys (id, code, name)
values ('00000000-0000-4000-8000-0000000000e1', 'TESTE-PUBLICO', 'Pesquisa de público');

insert into sigav.survey_versions (id, survey_id, version_number, title, status)
values ('00000000-0000-4000-8000-0000000000e2', '00000000-0000-4000-8000-0000000000e1', 1, 'Versão 1', 'PUBLISHED');

insert into sigav.survey_applications (id, survey_version_id, code, name, status)
values ('00000000-0000-4000-8000-0000000000e3', '00000000-0000-4000-8000-0000000000e2', 'TESTE-PUBLICO-1', 'Ciclo de público', 'DRAFT');

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-0000000000c1","role":"authenticated"}',
  true
);

-- ---------------------------------------------------------------------------
-- Normalização
-- ---------------------------------------------------------------------------

select is(
  sigav.fc_normalizar_rotulo('Coord  de  Gestão'),
  sigav.fc_normalizar_rotulo('COORD DE GESTAO'),
  'caixa, acento e espaço repetido não fragmentam o mesmo valor'
);

-- Se a normalização falhasse, apareceriam duas coordenações distintas na tela.
select is(
  (select jsonb_array_length(sigav.fc_listar_dimensoes_publico() -> 'dimensions' -> 'coordination')),
  1,
  'grafias equivalentes viram uma única opção de Coordenação'
);

select is(
  (select sigav.fc_listar_dimensoes_publico() -> 'dimensions' -> 'coordination' -> 0 ->> 'count'),
  '2',
  'a opção agrupada conta as duas pessoas'
);

-- ---------------------------------------------------------------------------
-- Semântica da seleção
-- ---------------------------------------------------------------------------

-- Davi tem Diretoria e Cargo compatíveis, mas está inativo: elegibilidade é
-- `people.active`, e ela vale antes de qualquer filtro.
select is(
  (sigav.fc_previsualizar_publico_avaliacao(
    '00000000-0000-4000-8000-0000000000e3',
    '{"filters":{"directorate":["DGP"],"jobTitle":["Assessor"]}}'::jsonb) ->> 'matchedCount')::integer,
  2,
  'AND entre dimensões: Diretoria E Cargo, sem a pessoa inativa'
);

select is(
  (sigav.fc_previsualizar_publico_avaliacao(
    '00000000-0000-4000-8000-0000000000e3',
    '{"filters":{"unit":["Escritorio A","Escritório B"]}}'::jsonb) ->> 'matchedCount')::integer,
  3,
  'OR dentro da dimensão: duas unidades somam'
);

-- Carla é Analista e não casaria com o filtro; entra por inclusão individual.
select is(
  (sigav.fc_previsualizar_publico_avaliacao(
    '00000000-0000-4000-8000-0000000000e3',
    '{"filters":{"jobTitle":["Assessor"]},"includePersonIds":["00000000-0000-4000-8000-0000000000d3"]}'::jsonb) ->> 'matchedCount')::integer,
  3,
  'inclusão individual é adicional ao resultado dos filtros'
);

-- Inclusão não é passe livre: a elegibilidade é a mesma para todo mundo.
select is(
  (sigav.fc_previsualizar_publico_avaliacao(
    '00000000-0000-4000-8000-0000000000e3',
    '{"includePersonIds":["00000000-0000-4000-8000-0000000000d4"]}'::jsonb) ->> 'ineligibleIncludedCount')::integer,
  1,
  'pessoa inativa incluída à mão é reportada como não elegível'
);

select is(
  (sigav.fc_previsualizar_publico_avaliacao(
    '00000000-0000-4000-8000-0000000000e3',
    '{"filters":{"jobTitle":["Assessor"]},"excludePersonIds":["00000000-0000-4000-8000-0000000000d2"]}'::jsonb) ->> 'matchedCount')::integer,
  1,
  'exclusão tem precedência sobre o filtro que selecionou a pessoa'
);

-- Formulário em branco não pode significar a instituição inteira.
select is(
  (sigav.fc_previsualizar_publico_avaliacao(
    '00000000-0000-4000-8000-0000000000e3', '{}'::jsonb) ->> 'matchedCount')::integer,
  0,
  'regra sem filtro e sem inclusão não seleciona ninguém'
);

-- ---------------------------------------------------------------------------
-- Validação da regra
-- ---------------------------------------------------------------------------

-- Uma chave desconhecida ligava a busca por filtro sem restringir nada, e o
-- resultado era a instituição inteira — furando a garantia de que só
-- `allEligible` faz isso. O erro é explícito de propósito: devolver conjunto
-- vazio esconderia a integração quebrada em vez de acusá-la.
select throws_ok(
  $$select * from sigav.fc_resolver_publico_avaliacao('{"filters":{"foo":["bar"]}}'::jsonb)$$,
  'Regra de público inválida: dimensão desconhecida "foo". Dimensões aceitas: directorate, unit, coordination, costCenter, jobTitle.',
  'dimensão desconhecida é recusada, e nunca seleciona a instituição inteira'
);

select throws_ok(
  $$select * from sigav.fc_resolver_publico_avaliacao('{"filters":{"jobTitle":"Assessor"}}'::jsonb)$$,
  'Regra de público inválida: a dimensão "jobTitle" precisa ser uma lista de valores.',
  'valor de dimensão que não é lista é recusado'
);

select throws_ok(
  $$select * from sigav.fc_resolver_publico_avaliacao('{"includePersonIds":["nao-e-uuid"]}'::jsonb)$$,
  'Regra de público inválida: "includePersonIds" contém identificador que não é um UUID.',
  'identificador malformado é recusado com mensagem própria'
);

-- A recusa alcança a prévia e a aplicação, não só o resolvedor: as três descem
-- pelo mesmo ponto de validação.
select throws_ok(
  $$select sigav.fc_previsualizar_publico_avaliacao('00000000-0000-4000-8000-0000000000e3', '{"filters":{"foo":["bar"]}}'::jsonb)$$,
  'Regra de público inválida: dimensão desconhecida "foo". Dimensões aceitas: directorate, unit, coordination, costCenter, jobTitle.',
  'a prévia recusa a mesma regra inválida'
);

select is(
  (sigav.fc_previsualizar_publico_avaliacao(
    '00000000-0000-4000-8000-0000000000e3', '{"allEligible":true}'::jsonb) ->> 'matchedCount')::integer,
  4,
  'allEligible seleciona todas as pessoas ativas, e só as ativas'
);

-- ---------------------------------------------------------------------------
-- Prévia não muta
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::integer from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-0000000000e3'),
  0,
  'nenhuma das prévias acima criou vínculo'
);

-- ---------------------------------------------------------------------------
-- Aplicação
-- ---------------------------------------------------------------------------

select sigav.fc_aplicar_publico_avaliacao(
  '00000000-0000-4000-8000-0000000000e3',
  '{"filters":{"jobTitle":["Assessor"]},"excludePersonIds":["00000000-0000-4000-8000-0000000000d2"]}'::jsonb
);

-- O critério de aceite central: a prévia dissera 1, e o snapshot tem 1 elegível.
select results_eq(
  $$select p.full_name, ap.status
    from sigav.application_participants ap
    join sigav.people p on p.id = ap.person_id
    where ap.application_id = '00000000-0000-4000-8000-0000000000e3'
    order by p.full_name$$,
  $$values ('Ana Assessora'::text, 'ELIGIBLE'::text),
           ('Bruno Assessor'::text, 'EXCLUDED'::text)$$,
  'o snapshot materializa o público e marca EXCLUDED quem foi retirado de propósito'
);

select is(
  (select settings -> 'audience' ->> 'resultCount'
   from sigav.survey_applications where id = '00000000-0000-4000-8000-0000000000e3'),
  '1',
  'a regra fica recuperável em settings.audience'
);

select is(
  (select count(*)::integer from sigav.audit_events
   where application_id = '00000000-0000-4000-8000-0000000000e3'
     and event_type = 'APPLICATION_AUDIENCE_APPLIED'),
  1,
  'a aplicação é auditada pelo mecanismo existente'
);

-- ---------------------------------------------------------------------------
-- Busca de pessoa, para inclusão e exclusão individual
-- ---------------------------------------------------------------------------

-- A busca administrativa existente exige `employment_status = 'ATIVO'`,
-- enquanto a elegibilidade desta fase é `active`. Se o seletor usasse aquela,
-- alguém elegível pelo filtro ficaria invisível na busca — e não haveria como
-- explicar a diferença a quem opera.
select is(
  (select sigav.fc_buscar_pessoas_publico('ana assessora') -> 'people' -> 0 ->> 'fullName'),
  'Ana Assessora',
  'a busca encontra apesar da diferença de acento e caixa no termo'
);

select is(
  (select jsonb_array_length(sigav.fc_buscar_pessoas_publico('Davi') -> 'people')),
  0,
  'pessoa inativa não aparece na busca, coerente com a elegibilidade da fase'
);

select is(
  (select sigav.fc_buscar_pessoas_publico('TESTE-PUB-2') -> 'people' -> 0 ->> 'fullName'),
  'Bruno Assessor',
  'a busca aceita matrícula, não só nome'
);

-- Buscar por cargo é o que torna a seleção em lote útil: "assessor" traz o
-- grupo inteiro de uma vez. Ana e Bruno são Assessor e estão ativos; Davi
-- também é Assessor mas está inativo e não entra.
select is(
  (select jsonb_array_length(sigav.fc_buscar_pessoas_publico('assessor') -> 'people')),
  2,
  'a busca por cargo traz o grupo, respeitando a elegibilidade'
);

select * from finish();

rollback;
