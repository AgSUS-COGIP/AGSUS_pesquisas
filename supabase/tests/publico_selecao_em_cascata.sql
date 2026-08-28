-- Seleção em cascata nas dimensões do público.
--
-- Duas propriedades precisam valer ao mesmo tempo, e é a tensão entre elas que
-- estas asserções guardam:
--
--   1. dimensão posterior é restringida pelas anteriores — escolher a Diretoria
--      deve enxugar a lista de Unidades;
--   2. não é hierarquia obrigatória — sem Diretoria escolhida, Unidade mostra
--      tudo, e começar a regra direto por Unidade ou Cargo continua valendo.
--
-- A terceira propriedade é o que distingue cascata de faceta cruzada: dimensão
-- **anterior** nunca é restringida pela posterior. Escolher um Cargo não pode
-- mexer na lista de Diretorias — se mexesse, mudar qualquer campo remexeria
-- todos os outros e a tela ficaria imprevisível.

begin;

select plan(13);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000501', 'authenticated', 'authenticated', 'casc-admin@agenciasus.org.br', now(), now());

insert into sigav.people (id, auth_user_id, employee_number, full_name, institutional_email, active)
values ('00000000-0000-4000-8000-000000000502', '00000000-0000-4000-8000-000000000501', 'TESTE-CASC-ADM', 'Administração', 'casc-admin@agenciasus.org.br', true);

insert into sigav.person_role_assignments (person_id, role_id)
select '00000000-0000-4000-8000-000000000502', id from sigav.system_roles where code = 'SURVEY_MANAGER';

-- Duas diretorias, três unidades, e uma pessoa inativa numa unidade que só ela
-- ocupa: a unidade dela não pode aparecer em lista nenhuma.
insert into sigav.people (id, employee_number, full_name, institutional_email, active, job_title, cost_center, metadata)
values
  ('00000000-0000-4000-8000-000000000511', 'CASC-1', 'Ana Assessora',  'c1@agenciasus.org.br', true,  'Assessor', 'CC-1',
   '{"directorate":"DAIS","unit":"Escritorio A","coordination":"Coord Um"}'::jsonb),
  ('00000000-0000-4000-8000-000000000512', 'CASC-2', 'Bruno Analista', 'c2@agenciasus.org.br', true,  'Analista', 'CC-2',
   '{"directorate":"DAIS","unit":"Escritorio B","coordination":"Coord Dois"}'::jsonb),
  ('00000000-0000-4000-8000-000000000513', 'CASC-3', 'Carla Tecnica',  'c3@agenciasus.org.br', true,  'Tecnica',  'CC-3',
   '{"directorate":"DGP","unit":"Escritorio C","coordination":"Coord Tres"}'::jsonb),
  ('00000000-0000-4000-8000-000000000514', 'CASC-4', 'Davi Inativo',   'c4@agenciasus.org.br', false, 'Assessor', 'CC-4',
   '{"directorate":"DAIS","unit":"Escritorio Fantasma"}'::jsonb);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000501","role":"authenticated"}',
  true
);

-- ---------------------------------------------------------------------------
-- Sem escolha, nada é restringido
-- ---------------------------------------------------------------------------

select is(
  (select jsonb_array_length(sigav.fc_listar_dimensoes_publico() -> 'dimensions' -> 'unit')),
  3,
  'sem Diretoria escolhida, Unidade mostra todas as unidades com gente ativa'
);

-- A unidade do inativo não existe para efeito nenhum: elegibilidade é `active`,
-- e ela vale antes de qualquer contexto.
select is(
  (select count(*)::integer
   from jsonb_array_elements(sigav.fc_listar_dimensoes_publico() -> 'dimensions' -> 'unit') as item(valor)
   where item.valor ->> 'label' = 'Escritorio Fantasma'),
  0,
  'unidade que só tem pessoa inativa não aparece'
);

-- ---------------------------------------------------------------------------
-- A cascata
-- ---------------------------------------------------------------------------

select is(
  (select jsonb_array_length(
    sigav.fc_listar_dimensoes_publico('{"filters":{"directorate":["DAIS"]}}'::jsonb) -> 'dimensions' -> 'unit')),
  2,
  'com Diretoria escolhida, Unidade mostra só as unidades daquela diretoria'
);

select is(
  (select jsonb_array_length(
    sigav.fc_listar_dimensoes_publico('{"filters":{"directorate":["DAIS"],"unit":["Escritorio A"]}}'::jsonb)
      -> 'dimensions' -> 'coordination')),
  1,
  'Coordenação é restringida por Diretoria e Unidade juntas'
);

select is(
  (select sigav.fc_listar_dimensoes_publico('{"filters":{"directorate":["DAIS"],"unit":["Escritorio A"]}}'::jsonb)
     -> 'dimensions' -> 'jobTitle' -> 0 ->> 'label'),
  'Assessor',
  'Cargo chega ao fim da cascata restringido por tudo que veio antes'
);

-- OR dentro da dimensão vale na cascata: duas diretorias somam suas unidades.
select is(
  (select jsonb_array_length(
    sigav.fc_listar_dimensoes_publico('{"filters":{"directorate":["DAIS","DGP"]}}'::jsonb) -> 'dimensions' -> 'unit')),
  3,
  'duas Diretorias escolhidas somam as unidades das duas'
);

-- ---------------------------------------------------------------------------
-- O que a cascata NÃO faz
-- ---------------------------------------------------------------------------

-- Se isto falhar, viramos faceta cruzada: mexer num campo remexeria todos.
select is(
  (select jsonb_array_length(
    sigav.fc_listar_dimensoes_publico('{"filters":{"jobTitle":["Assessor"]}}'::jsonb) -> 'dimensions' -> 'directorate')),
  2,
  'escolher Cargo não restringe Diretoria — dimensão anterior não olha para a posterior'
);

select is(
  (select jsonb_array_length(
    sigav.fc_listar_dimensoes_publico('{"filters":{"directorate":["DAIS"]}}'::jsonb) -> 'dimensions' -> 'directorate')),
  2,
  'a própria dimensão escolhida continua mostrando todas as suas opções'
);

-- Começar direto por uma dimensão do meio precisa continuar funcionando.
select is(
  (select jsonb_array_length(
    sigav.fc_listar_dimensoes_publico('{"filters":{"unit":["Escritorio A"]}}'::jsonb) -> 'dimensions' -> 'jobTitle')),
  1,
  'regra iniciada direto por Unidade restringe Cargo, sem exigir Diretoria'
);

-- ---------------------------------------------------------------------------
-- Contagem no contexto
-- ---------------------------------------------------------------------------

select is(
  (select sigav.fc_listar_dimensoes_publico('{"filters":{"directorate":["DAIS"]}}'::jsonb)
     -> 'dimensions' -> 'jobTitle' -> 0 ->> 'count'),
  '1',
  'a contagem da opção descreve o contexto, não o total institucional'
);

-- ---------------------------------------------------------------------------
-- Incompatibilidade
-- ---------------------------------------------------------------------------

-- Escritorio A é da DAIS. Trocar a Diretoria para DGP deixa a Unidade órfã, e a
-- tela precisa saber disso para remover a seleção em vez de guardar um valor
-- invisível na regra.
select is(
  (select sigav.fc_listar_dimensoes_publico('{"filters":{"directorate":["DGP"],"unit":["Escritorio A"]}}'::jsonb)
     -> 'incompatible' -> 'unit' ->> 0),
  'Escritorio A',
  'seleção que saiu do contexto é reportada como incompatível'
);

select is(
  (select sigav.fc_listar_dimensoes_publico('{"filters":{"directorate":["DAIS"],"unit":["Escritorio A"]}}'::jsonb)
     -> 'incompatible'),
  '{}'::jsonb,
  'combinação válida não reporta incompatibilidade'
);

-- ---------------------------------------------------------------------------
-- A busca de pessoa dentro do contexto
-- ---------------------------------------------------------------------------

-- Ana é da DAIS. Com o contexto em DGP, oferecê-la seria sugerir uma inclusão
-- que contradiz o critério montado logo acima, sem explicar por quê.
select is(
  (select jsonb_array_length(
    sigav.fc_buscar_pessoas_publico('Ana', 20, '{"filters":{"directorate":["DGP"]}}'::jsonb) -> 'people')),
  0,
  'a busca de pessoa não oferece quem está fora do contexto institucional'
);

select * from finish();

rollback;
