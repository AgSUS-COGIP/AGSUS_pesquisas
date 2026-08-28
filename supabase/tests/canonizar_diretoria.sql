-- Canonização da Diretoria.
--
-- Três siglas eram a mesma diretoria que o nome institucional completo, e o
-- construtor de público as tratava como opções distintas. `DAIS` com 1 pessoa
-- ao lado de `DIRETORIA DE ATENCAO INTEGRAL A SAUDE` com 417.
--
-- A normalização existente não resolvia: ela cuida de caixa, acento e espaço
-- repetido, e `dais` não é variação ortográfica de
-- `diretoria de atencao integral a saude`. Equivalência institucional precisa
-- ser declarada.
--
-- Corrigir os dados resolve hoje. Estas asserções guardam as portas por onde a
-- sigla voltaria: importação, edição administrativa e comparação do público.
-- A última é a que mais importa — sem ela, uma integração que ainda mandasse
-- `DAIS` passaria a selecionar zero pessoas **em silêncio**, que é o pior
-- desfecho possível porque parece regra que simplesmente não alcança ninguém.

begin;

select plan(14);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-000000000601', 'authenticated', 'authenticated', 'canon-admin@agenciasus.org.br', now(), now());

insert into sigav.people (id, auth_user_id, employee_number, full_name, institutional_email, active)
values ('00000000-0000-4000-8000-000000000602', '00000000-0000-4000-8000-000000000601', 'TESTE-CANON-ADM', 'Administração', 'canon-admin@agenciasus.org.br', true);

insert into sigav.person_role_assignments (person_id, role_id)
-- ADMINISTRATOR, não SURVEY_MANAGER: `update_platform_admin_person` exige
-- Administrador da Plataforma, e o Superadmin também satisfaz
-- `can_manage_surveys()`, então o mesmo perfil cobre os dois portões do teste.
select '00000000-0000-4000-8000-000000000602', id from sigav.system_roles where code = 'ADMINISTRATOR';

-- ---------------------------------------------------------------------------
-- A equivalência
-- ---------------------------------------------------------------------------

select is(sigav.fc_canonizar_diretoria('DAIS'), 'DIRETORIA DE ATENCAO INTEGRAL A SAUDE',
  'DAIS resolve para o nome institucional completo');

select is(sigav.fc_canonizar_diretoria('diop'), 'DIRETORIA DE OPERACOES',
  'DIOP resolve independentemente da caixa');

select is(sigav.fc_canonizar_diretoria('  Presidência  '), 'DIRETORIA DA PRESIDENCIA',
  'PRESIDENCIA resolve com acento e espaço em volta');

-- Só as três. Inventar sinônimo para outros valores seria decidir por conta
-- própria o que ninguém aprovou.
select is(sigav.fc_canonizar_diretoria('DIRETORIA NOVA'), 'DIRETORIA NOVA',
  'valor fora das três equivalências volta como está');

select is(sigav.fc_canonizar_diretoria('   '), null::text,
  'valor em branco continua sendo ausência, não texto vazio');

-- ---------------------------------------------------------------------------
-- Os registros existentes
-- ---------------------------------------------------------------------------

-- A migration já rodou quando este teste executa: nenhuma sigla pode ter
-- sobrado na base reconstruída.
select is(
  (select count(*)::integer from sigav.people
   where sigav.fc_normalizar_rotulo(metadata ->> 'directorate') in ('dais', 'diop', 'presidencia')),
  0,
  'nenhuma pessoa permanece com a sigla depois da migration'
);

-- ---------------------------------------------------------------------------
-- Importação
-- ---------------------------------------------------------------------------

-- A próxima carga não pode reintroduzir o que a migration acabou de corrigir.
select sigav.sync_people_base_rows(
  jsonb_build_array(jsonb_build_object(
    'employeeNumber', 'TESTE-CANON-IMP',
    'fullName', 'Pessoa Importada',
    'institutionalEmail', 'canon-imp@agenciasus.org.br',
    'directorate', 'DAIS',
    'unit', 'Escritorio Z'
  )),
  null
);

select is(
  (select metadata ->> 'directorate' from sigav.people where employee_number = 'TESTE-CANON-IMP'),
  'DIRETORIA DE ATENCAO INTEGRAL A SAUDE',
  'importação canoniza a Diretoria antes de gravar'
);

-- A regra vale só para Diretoria: Unidade não pode ganhar sinônimo de brinde.
select is(
  (select metadata ->> 'unit' from sigav.people where employee_number = 'TESTE-CANON-IMP'),
  'Escritorio Z',
  'a importação não mexe em Unidade'
);

-- ---------------------------------------------------------------------------
-- Edição administrativa
-- ---------------------------------------------------------------------------

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-000000000601","role":"authenticated"}',
  true
);

insert into sigav.people (id, employee_number, full_name, institutional_email, active, metadata)
values ('00000000-0000-4000-8000-000000000611', 'TESTE-CANON-ED', 'Pessoa Editada', 'canon-ed@agenciasus.org.br', true,
        '{"directorate":"DIRETORIA DE OPERACOES"}'::jsonb);

select sigav.update_platform_admin_person(
  target_person_id => '00000000-0000-4000-8000-000000000611',
  target_full_name => 'Pessoa Editada',
  target_directorate => 'DIOP',
  target_justification => 'teste de canonização'
);

select is(
  (select metadata ->> 'directorate' from sigav.people
   where id = '00000000-0000-4000-8000-000000000611'),
  'DIRETORIA DE OPERACOES',
  'edição administrativa canoniza a Diretoria antes de gravar'
);

-- ---------------------------------------------------------------------------
-- Cascata, prévia e aplicação
-- ---------------------------------------------------------------------------

insert into sigav.people (id, employee_number, full_name, institutional_email, active, job_title, metadata)
values
  ('00000000-0000-4000-8000-000000000621', 'TESTE-CANON-1', 'Ana Canon', 'cn1@agenciasus.org.br', true, 'Assessor',
   '{"directorate":"DIRETORIA DA PRESIDENCIA","unit":"Escritorio P"}'::jsonb),
  ('00000000-0000-4000-8000-000000000622', 'TESTE-CANON-2', 'Bruno Canon', 'cn2@agenciasus.org.br', true, 'Analista',
   '{"directorate":"DIRETORIA DA PRESIDENCIA","unit":"Escritorio Q"}'::jsonb);

insert into sigav.surveys (id, code, name)
values ('00000000-0000-4000-8000-000000000631', 'TESTE-CANON', 'Pesquisa de canonização');

insert into sigav.survey_versions (id, survey_id, version_number, title, status)
values ('00000000-0000-4000-8000-000000000632', '00000000-0000-4000-8000-000000000631', 1, 'Versão 1', 'PUBLISHED');

insert into sigav.survey_applications (id, survey_version_id, code, name, status)
values ('00000000-0000-4000-8000-000000000633', '00000000-0000-4000-8000-000000000632', 'TESTE-CANON-1', 'Ciclo', 'DRAFT');

-- A asserção central: chamada antiga com a sigla continua encontrando as
-- pessoas. Sem a equivalência na comparação, isto daria zero — e zero por
-- vocabulário desatualizado é indistinguível de zero por critério estreito.
select is(
  (sigav.fc_previsualizar_publico_avaliacao(
    '00000000-0000-4000-8000-000000000633',
    '{"filters":{"directorate":["PRESIDENCIA"]}}'::jsonb) ->> 'matchedCount')::integer,
  2,
  'regra com a sigla encontra as mesmas pessoas que o nome completo'
);

select is(
  (sigav.fc_previsualizar_publico_avaliacao(
    '00000000-0000-4000-8000-000000000633',
    '{"filters":{"directorate":["DIRETORIA DA PRESIDENCIA"]}}'::jsonb) ->> 'matchedCount')::integer,
  2,
  'e o nome completo encontra o mesmo conjunto'
);

-- A cascata desce a partir da sigla como desceria do nome completo.
select is(
  (select jsonb_array_length(
    sigav.fc_listar_dimensoes_publico('{"filters":{"directorate":["PRESIDENCIA"]}}'::jsonb)
      -> 'dimensions' -> 'unit')),
  2,
  'a cascata parte da sigla e restringe Unidade igual ao nome completo'
);

-- Regra antiga com a sigla não pode ser reportada como incompatível agora que
-- os dados usam o nome completo — isso apagaria o critério de quem já o tinha.
select is(
  (select sigav.fc_listar_dimensoes_publico('{"filters":{"directorate":["PRESIDENCIA"]}}'::jsonb)
     -> 'incompatible'),
  '{}'::jsonb,
  'a sigla não é tratada como seleção incompatível'
);

-- E a aplicação materializa pelo mesmo caminho, provando que a equivalência não
-- ficou só na leitura.
select sigav.fc_aplicar_publico_avaliacao(
  '00000000-0000-4000-8000-000000000633',
  '{"filters":{"directorate":["PRESIDENCIA"]}}'::jsonb
);

select is(
  (select count(*)::integer from sigav.application_participants
   where application_id = '00000000-0000-4000-8000-000000000633'
     and status = 'ELIGIBLE'),
  2,
  'aplicar a regra com a sigla materializa o mesmo público'
);

select * from finish();

rollback;
