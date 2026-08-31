-- Auditoria da manutenção operacional.
--
-- A função é curta, e é justamente por isso que precisa ser executada: um
-- ensaio de migration valida a sintaxe do corpo, não o comportamento dele. Uma
-- função que compila e recusa o administrador legítimo — ou que aceita
-- qualquer sessão — passaria pelo ensaio sem um ruído.
--
-- O que importa aqui é a autorização acontecer **dentro do banco**. A rota HTTP
-- confere o papel para dar erro cedo e com mensagem decente, mas quem garante é
-- esta função: se amanhã outra rota chamar sem conferir, a garantia continua de
-- pé.

begin;

select plan(9);

-- Duas identidades: uma com ADMINISTRATOR, outra sem nenhum papel privilegiado.
insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000e001', 'authenticated', 'authenticated', 'manut-admin@agenciasus.org.br', now(), now()),
  ('00000000-0000-4000-8000-00000000e003', 'authenticated', 'authenticated', 'manut-comum@agenciasus.org.br', now(), now());

insert into sigav.people (id, auth_user_id, employee_number, full_name, institutional_email, active)
values
  ('00000000-0000-4000-8000-00000000e002', '00000000-0000-4000-8000-00000000e001', 'TESTE-MANUT-ADM', 'Administração', 'manut-admin@agenciasus.org.br', true),
  ('00000000-0000-4000-8000-00000000e004', '00000000-0000-4000-8000-00000000e003', 'TESTE-MANUT-COM', 'Pessoa Comum', 'manut-comum@agenciasus.org.br', true);

insert into sigav.person_role_assignments (person_id, role_id)
select '00000000-0000-4000-8000-00000000e002', id from sigav.system_roles where code = 'ADMINISTRATOR';

-- Papel que administra pesquisas, mas não a plataforma. É o caso mais fácil de
-- errar: quem pode publicar avaliação não pode parar o SIGAV inteiro.
insert into sigav.person_role_assignments (person_id, role_id)
select '00000000-0000-4000-8000-00000000e004', id from sigav.system_roles where code = 'SURVEY_MANAGER';

-- ── Administrador ───────────────────────────────────────────────────────────
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000e001","role":"authenticated"}',
  true
);

select is(
  (sigav.fc_registrar_manutencao_auditoria(
    'PLATFORM_MAINTENANCE_ENABLED',
    'Implantação da nova versão do construtor.',
    '{"global": false, "modules": []}'::jsonb,
    '{"global": true, "modules": []}'::jsonb,
    '{}'::text[]
  ) ->> 'status'),
  'OK',
  'ADMINISTRATOR registra a ativação global'
);

select is(
  (select event_type from sigav.audit_events where entity_type = 'PLATFORM_MAINTENANCE' order by id desc limit 1),
  'PLATFORM_MAINTENANCE_ENABLED',
  'o evento gravado é o que foi pedido'
);

select is(
  (select actor_person_id from sigav.audit_events where entity_type = 'PLATFORM_MAINTENANCE' order by id desc limit 1),
  '00000000-0000-4000-8000-00000000e002'::uuid,
  'o ator é a pessoa da sessão, e não um valor vindo do cliente'
);

select is(
  (select metadata ->> 'reason' from sigav.audit_events where entity_type = 'PLATFORM_MAINTENANCE' order by id desc limit 1),
  'Implantação da nova versão do construtor.',
  'o motivo obrigatório fica registrado'
);

select is(
  (select before_data ->> 'global' from sigav.audit_events where entity_type = 'PLATFORM_MAINTENANCE' order by id desc limit 1),
  'false',
  'o estado anterior é preservado'
);

select is(
  (select after_data ->> 'global' from sigav.audit_events where entity_type = 'PLATFORM_MAINTENANCE' order by id desc limit 1),
  'true',
  'o estado posterior é preservado'
);

-- Módulos afetados chegam à auditoria: sem eles o registro diria que houve
-- manutenção de módulo sem dizer de qual.
select is(
  (sigav.fc_registrar_manutencao_auditoria(
    'MODULE_MAINTENANCE_ENABLED',
    'Ajuste no painel institucional.',
    '{"global": false, "modules": []}'::jsonb,
    '{"global": false, "modules": ["DASHBOARDS"]}'::jsonb,
    array['DASHBOARDS']
  ) ->> 'status'),
  'OK',
  'ADMINISTRATOR registra a manutenção de um módulo'
);

select is(
  (select metadata -> 'modules' from sigav.audit_events where entity_type = 'PLATFORM_MAINTENANCE' order by id desc limit 1),
  '["DASHBOARDS"]'::jsonb,
  'os módulos afetados ficam registrados'
);

-- ── Sem permissão ───────────────────────────────────────────────────────────
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000e003","role":"authenticated"}',
  true
);

select throws_ok(
  $$select sigav.fc_registrar_manutencao_auditoria(
      'PLATFORM_MAINTENANCE_ENABLED', 'tentativa', '{}'::jsonb, '{}'::jsonb, '{}'::text[]
    )$$,
  '42501',
  'Apenas a administração da plataforma pode registrar manutenção.',
  'SURVEY_MANAGER não consegue registrar manutenção'
);

select * from finish();

rollback;
