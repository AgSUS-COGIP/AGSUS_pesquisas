-- PR 02 — lista operacional de participantes do painel.
--
-- Três coisas precisam ser verdade ao mesmo tempo, e são elas que este arquivo
-- afirma: o recorte tem de bater com o da regra de público (senão o painel e a
-- definição do ciclo discordam sobre quem é "Diretoria de Operações"); a página
-- tem de ser estável (senão paginar perde gente em silêncio); e a lista não
-- pode abrir caminho da pessoa até a resposta.
--
-- O último ponto é garantido pela estrutura, não pelo cuidado de quem escreve:
-- a função não referencia `submissions` nem `answers`. A asserção sobre isso lê
-- a definição viva da função, para que acrescentar esse join um dia quebre o
-- teste em vez de passar despercebido.

begin;

select plan(24);

-- Superadmin: tem DASHBOARDS, que é o guard da função.
insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-00000000f001', 'authenticated', 'authenticated', 'painel-admin@agenciasus.org.br', now(), now());

insert into sigav.people (id, auth_user_id, employee_number, full_name, institutional_email, active)
values ('00000000-0000-4000-8000-00000000f002', '00000000-0000-4000-8000-00000000f001', 'TESTE-PAI-ADM', 'Administração do Painel', 'painel-admin@agenciasus.org.br', true);

insert into sigav.person_role_assignments (person_id, role_id)
select '00000000-0000-4000-8000-00000000f002', id from sigav.system_roles where code = 'ADMINISTRATOR';

-- Participante puro: não tem DASHBOARDS, e serve para provar que o guard morde.
insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-00000000f003', 'authenticated', 'authenticated', 'painel-resp@agenciasus.org.br', now(), now());

insert into sigav.people (id, auth_user_id, employee_number, full_name, institutional_email, active)
values ('00000000-0000-4000-8000-00000000f004', '00000000-0000-4000-8000-00000000f003', 'TESTE-PAI-RESP', 'Respondente do Painel', 'painel-resp@agenciasus.org.br', true);

insert into sigav.person_role_assignments (person_id, role_id)
select '00000000-0000-4000-8000-00000000f004', id from sigav.system_roles where code = 'RESPONDENT';

-- Cinco participantes cobrindo as combinações que os filtros precisam separar.
-- As duas grafias de coordenação são a mesma, escritas diferente de propósito.
insert into sigav.people (id, employee_number, full_name, institutional_email, active, job_title, cost_center, metadata)
values
  ('00000000-0000-4000-8000-00000000fa01', 'TESTE-PAI-1', 'Ana Assessora',  'pai1@agenciasus.org.br', true, 'Assessor', 'CC-100',
   '{"directorate":"DIRETORIA DE OPERACOES","unit":"Escritorio A","coordination":"Coord  de  Gestão"}'::jsonb),
  ('00000000-0000-4000-8000-00000000fa02', 'TESTE-PAI-2', 'Bruno Assessor', 'pai2@agenciasus.org.br', true, 'Assessor', 'CC-200',
   '{"directorate":"DIRETORIA DE OPERACOES","unit":"Escritório B","coordination":"COORD DE GESTAO"}'::jsonb),
  ('00000000-0000-4000-8000-00000000fa03', 'TESTE-PAI-3', 'Carla Analista', 'pai3@agenciasus.org.br', true, 'Analista', 'CC-100',
   '{"directorate":"DIRETORIA DE OPERACOES","unit":"Escritorio A"}'::jsonb),
  ('00000000-0000-4000-8000-00000000fa04', 'TESTE-PAI-4', 'Davi Analista',  'pai4@agenciasus.org.br', true, 'Analista', 'CC-300',
   '{"directorate":"DIRETORIA DA PRESIDENCIA","unit":"Sede"}'::jsonb),
  ('00000000-0000-4000-8000-00000000fa05', 'TESTE-PAI-5', 'Elza Assessora', 'pai5@agenciasus.org.br', true, 'Assessor', 'CC-100',
   '{"directorate":"DIRETORIA DE OPERACOES","unit":"Escritorio A"}'::jsonb);

insert into sigav.surveys (id, code, name)
values ('00000000-0000-4000-8000-00000000fb01', 'TESTE-PAINEL', 'Pesquisa do painel');

insert into sigav.survey_versions (id, survey_id, version_number, title, status)
values ('00000000-0000-4000-8000-00000000fb02', '00000000-0000-4000-8000-00000000fb01', 1, 'Versão 1', 'PUBLISHED');

insert into sigav.survey_applications (id, survey_version_id, code, name, status)
values ('00000000-0000-4000-8000-00000000fb03', '00000000-0000-4000-8000-00000000fb02', 'TESTE-PAINEL-1', 'Ciclo do painel', 'OPEN');

-- Situações diferentes de propósito: a ordem da lista é a da cobrança.
insert into sigav.application_participants (application_id, person_id, status, started_at, completed_at)
values
  ('00000000-0000-4000-8000-00000000fb03', '00000000-0000-4000-8000-00000000fa01', 'COMPLETED',   now() - interval '2 day', now() - interval '1 day'),
  ('00000000-0000-4000-8000-00000000fb03', '00000000-0000-4000-8000-00000000fa02', 'IN_PROGRESS', now() - interval '1 day', null),
  ('00000000-0000-4000-8000-00000000fb03', '00000000-0000-4000-8000-00000000fa03', 'ELIGIBLE',    null, null),
  ('00000000-0000-4000-8000-00000000fb03', '00000000-0000-4000-8000-00000000fa04', 'ELIGIBLE',    null, null),
  ('00000000-0000-4000-8000-00000000fb03', '00000000-0000-4000-8000-00000000fa05', 'INVITED',     null, null);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000f001","role":"authenticated"}',
  true
);

-- ---------------------------------------------------------------------------
-- A função executa, e conta o que existe
-- ---------------------------------------------------------------------------

select is(
  (sigav.fc_listar_participantes_do_painel('TESTE-PAINEL-1') ->> 'total')::integer,
  5,
  'sem filtro, conta os cinco participantes do ciclo'
);

select is(
  jsonb_array_length(sigav.fc_listar_participantes_do_painel('TESTE-PAINEL-1') -> 'participantes'),
  5,
  'sem filtro, devolve os cinco na primeira página'
);

-- ---------------------------------------------------------------------------
-- Recorte: o mesmo da regra de público
-- ---------------------------------------------------------------------------

select is(
  (sigav.fc_listar_participantes_do_painel(
    'TESTE-PAINEL-1',
    '{"directorate":["DIRETORIA DE OPERACOES"]}'::jsonb
  ) ->> 'total')::integer,
  4,
  'filtro por diretoria exclui quem é de outra'
);

select is(
  (sigav.fc_listar_participantes_do_painel(
    'TESTE-PAINEL-1',
    '{"jobTitle":["Assessor"]}'::jsonb
  ) ->> 'total')::integer,
  3,
  'filtro por cargo alcança só os assessores'
);

-- Duas dimensões se cruzam, não se somam.
select is(
  (sigav.fc_listar_participantes_do_painel(
    'TESTE-PAINEL-1',
    '{"jobTitle":["Assessor"],"unit":["Escritorio A"]}'::jsonb
  ) ->> 'total')::integer,
  2,
  'dimensões diferentes se cruzam: assessor E do Escritório A'
);

-- Dentro da dimensão, os valores somam.
select is(
  (sigav.fc_listar_participantes_do_painel(
    'TESTE-PAINEL-1',
    '{"costCenter":["CC-200","CC-300"]}'::jsonb
  ) ->> 'total')::integer,
  2,
  'valores da mesma dimensão somam'
);

-- Se a normalização não fosse compartilhada com a regra de público, as duas
-- grafias contariam como coordenações distintas e este número seria 1.
select is(
  (sigav.fc_listar_participantes_do_painel(
    'TESTE-PAINEL-1',
    '{"coordination":["COORD DE GESTAO"]}'::jsonb
  ) ->> 'total')::integer,
  2,
  'grafias equivalentes de coordenação alcançam as duas pessoas'
);

select is(
  (sigav.fc_listar_participantes_do_painel(
    'TESTE-PAINEL-1',
    '{"situacao":["ELIGIBLE","INVITED"]}'::jsonb
  ) ->> 'total')::integer,
  3,
  'filtro por situação seleciona quem ainda não enviou'
);

select is(
  (sigav.fc_listar_participantes_do_painel(
    'TESTE-PAINEL-1',
    '{"busca":"bruno"}'::jsonb
  ) ->> 'total')::integer,
  1,
  'busca por nome ignora caixa'
);

select is(
  (sigav.fc_listar_participantes_do_painel(
    'TESTE-PAINEL-1',
    '{"busca":"TESTE-PAI-4"}'::jsonb
  ) ->> 'total')::integer,
  1,
  'busca alcança a matrícula'
);

-- ---------------------------------------------------------------------------
-- Página: estável, e com total independente do recorte da página
-- ---------------------------------------------------------------------------

select is(
  jsonb_array_length(sigav.fc_listar_participantes_do_painel('TESTE-PAINEL-1', '{}'::jsonb, 1, 2) -> 'participantes'),
  2,
  'a página respeita o tamanho pedido'
);

-- O total precisa continuar sendo o do filtro, não o da página — senão a tela
-- diria "2 participantes" quando há cinco.
select is(
  (sigav.fc_listar_participantes_do_painel('TESTE-PAINEL-1', '{}'::jsonb, 1, 2) ->> 'total')::integer,
  5,
  'o total é o do filtro, não o da página'
);

-- Nenhuma pessoa pode aparecer em duas páginas nem sumir entre elas.
select is(
  (
    select count(distinct pessoa ->> 'employeeNumber')::integer
    from (
      select jsonb_array_elements(sigav.fc_listar_participantes_do_painel('TESTE-PAINEL-1', '{}'::jsonb, 1, 2) -> 'participantes') as pessoa
      union all
      select jsonb_array_elements(sigav.fc_listar_participantes_do_painel('TESTE-PAINEL-1', '{}'::jsonb, 2, 2) -> 'participantes')
      union all
      select jsonb_array_elements(sigav.fc_listar_participantes_do_painel('TESTE-PAINEL-1', '{}'::jsonb, 3, 2) -> 'participantes')
    ) paginas
  ),
  5,
  'as três páginas somam as cinco pessoas, sem repetir nem perder'
);

-- Quem ainda não começou vem primeiro: a lista é de cobrança.
select is(
  sigav.fc_listar_participantes_do_painel('TESTE-PAINEL-1', '{}'::jsonb, 1, 1) -> 'participantes' -> 0 ->> 'status',
  'ELIGIBLE',
  'a ordem começa por quem não iniciou'
);

-- ---------------------------------------------------------------------------
-- Opções de filtro: do ciclo, e estáveis sob filtro
-- ---------------------------------------------------------------------------

select is(
  jsonb_array_length(sigav.fc_listar_participantes_do_painel('TESTE-PAINEL-1') -> 'dimensoes' -> 'unit'),
  3,
  'as opções de Unidade são as três que existem entre os participantes'
);

-- Opção que some conforme se filtra deixa quem filtrou sem caminho de volta.
select is(
  sigav.fc_listar_participantes_do_painel('TESTE-PAINEL-1', '{"unit":["Sede"]}'::jsonb) -> 'dimensoes',
  sigav.fc_listar_participantes_do_painel('TESTE-PAINEL-1') -> 'dimensoes',
  'as opções não encolhem quando um filtro é aplicado'
);

-- Se não normalizasse, as duas grafias de coordenação virariam duas opções — e
-- clicar em qualquer uma devolveria as mesmas duas pessoas.
select is(
  jsonb_array_length(sigav.fc_listar_participantes_do_painel('TESTE-PAINEL-1') -> 'dimensoes' -> 'coordination'),
  1,
  'grafias equivalentes de coordenação viram uma única opção'
);

/*
  Duas grafias empatadas em frequência — uma ocorrência cada.

  Com `mode() within group`, o vencedor dependia da ordem em que o planejador
  leu as linhas: a opção podia alternar entre execuções, e um filtro salvo
  apontaria para um rótulo que sumiu da lista.

  A asserção compara com `least(...)` em vez de um literal, porque qual das duas
  é "a menor" depende da collation do banco. O que o teste precisa provar é que
  a escolha segue a regra declarada — frequência, depois ordem alfabética —, e
  não qual string uma collation específica considera menor.
*/
select is(
  sigav.fc_listar_participantes_do_painel('TESTE-PAINEL-1') -> 'dimensoes' -> 'coordination' ->> 0,
  least('COORD DE GESTAO', 'Coord  de  Gestão'),
  'no empate de frequência, vence a grafia alfabeticamente menor'
);

-- ---------------------------------------------------------------------------
-- Payload, autorização e anonimato
-- ---------------------------------------------------------------------------

-- O payload não carrega e-mail: ele não é exibido em lugar nenhum da tela, e
-- mandá-lo ao navegador exporia dado pessoal sem propósito. A busca **por**
-- e-mail continua funcionando, porque acontece no SQL.
select ok(
  not (
    sigav.fc_listar_participantes_do_painel('TESTE-PAINEL-1') -> 'participantes' -> 0
    ? 'institutionalEmail'
  ),
  'o payload devolvido não inclui e-mail institucional'
);

select is(
  (sigav.fc_listar_participantes_do_painel(
    'TESTE-PAINEL-1',
    '{"busca":"pai3@agenciasus.org.br"}'::jsonb
  ) ->> 'total')::integer,
  1,
  'a busca por e-mail continua alcançando a pessoa, mesmo sem devolvê-lo'
);

-- A garantia de anonimato é estrutural: sem referência a `submissions` ou
-- `answers`, não existe caminho de leitura da pessoa até o que ela respondeu.
-- Acrescentar esse join um dia passa a quebrar aqui.
select ok(
  pg_get_functiondef('sigav.fc_listar_participantes_do_painel(text,jsonb,integer,integer)'::regprocedure) !~* '\m(submissions|answers)\M',
  'a função não referencia submissions nem answers'
);

/*
  O helper é `security definer` e não tem guard próprio — quem o protege é a
  função de listagem, que confere `DASHBOARDS` antes de chamá-lo. Concedido a
  `authenticated`, viraria porta lateral: qualquer sessão leria a composição
  organizacional de qualquer ciclo passando o identificador.

  A verificação é em duas camadas porque uma só não bastaria. O catálogo prova
  que o privilégio não existe; a chamada real prova que ele é cobrado — e a
  chamada precisa de `set local role`, já que o pgTAP roda como superusuário,
  que ignora privilégio e faria a asserção passar sem provar nada.
*/
select ok(
  not has_function_privilege('authenticated', 'sigav.fc_valores_de_dimensao(uuid,text)'::regprocedure, 'EXECUTE'),
  'o helper de dimensões não é executável por authenticated'
);

set local role authenticated;

select throws_ok(
  format(
    $$ select sigav.fc_valores_de_dimensao(%L::uuid, 'unit') $$,
    '00000000-0000-4000-8000-00000000fb03'
  ),
  '42501',
  null,
  'chamar o helper diretamente é recusado por falta de privilégio'
);

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000f003","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select sigav.fc_listar_participantes_do_painel('TESTE-PAINEL-1') $$,
  'Acesso restrito ao módulo de Painéis.',
  'perfil sem DASHBOARDS é recusado no servidor, não na tela'
);

select * from finish();

rollback;
