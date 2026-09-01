-- Auditoria da manutenção operacional com autorização por ADMIN_ACCESS.

begin;

select plan(9);

insert into sigav."TB_USUARIO_IDENTIDADE"(
  "SQ_USUARIO", "TP_AUDIENCIA", "TP_PAPEL", "DS_EMAIL", "DT_INCLUSAO", "DT_ALTERACAO"
) values
  ('00000000-0000-4000-8000-00000000e001', 'authenticated', 'authenticated', 'manut-admin@agenciasus.org.br', now(), now()),
  ('00000000-0000-4000-8000-00000000e003', 'authenticated', 'authenticated', 'manut-comum@agenciasus.org.br', now(), now());

insert into sigav."TB_PESSOA"(
  "SQ_PESSOA", "SQ_USUARIO_IDENTIDADE", "CO_MATRICULA", "NO_PESSOA", "DS_EMAIL_INSTITUCIONAL", "ST_ATIVO"
) values
  ('00000000-0000-4000-8000-00000000e002', '00000000-0000-4000-8000-00000000e001', 'TESTE-MANUT-ADM', 'Administração', 'manut-admin@agenciasus.org.br', true),
  ('00000000-0000-4000-8000-00000000e004', '00000000-0000-4000-8000-00000000e003', 'TESTE-MANUT-COM', 'Pessoa Comum', 'manut-comum@agenciasus.org.br', true);

insert into sigav."RL_PESSOA_MODULO"("SQ_PESSOA", "CO_MODULO", "ST_PERMITIDO")
values
  ('00000000-0000-4000-8000-00000000e002', 'ADMIN_ACCESS', true),
  ('00000000-0000-4000-8000-00000000e004', 'ADMIN_SURVEYS', true);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000e001","role":"authenticated"}',
  true
);

select is(
  (sigav."FC_REGISTRAR_MANUT_AUDITORIA"(
    'PLATFORM_MAINTENANCE_ENABLED',
    'Implantação da nova versão do construtor.',
    '{"global": false, "modules": []}'::jsonb,
    '{"global": true, "modules": []}'::jsonb,
    '{}'::text[]
  ) ->> 'status'),
  'OK',
  'ADMIN_ACCESS registra a ativação global'
);

select is(
  (select "TP_EVENTO" from sigav."TL_EVENTO_AUDITORIA" where "TP_ENTIDADE" = 'PLATFORM_MAINTENANCE' order by "SQ_EVENTO" desc limit 1),
  'PLATFORM_MAINTENANCE_ENABLED',
  'o evento gravado é o que foi pedido'
);

select is(
  (select "SQ_PESSOA_ATOR" from sigav."TL_EVENTO_AUDITORIA" where "TP_ENTIDADE" = 'PLATFORM_MAINTENANCE' order by "SQ_EVENTO" desc limit 1),
  '00000000-0000-4000-8000-00000000e002'::uuid,
  'o ator é a pessoa da sessão'
);

select is(
  (select "DS_METADADO" ->> 'reason' from sigav."TL_EVENTO_AUDITORIA" where "TP_ENTIDADE" = 'PLATFORM_MAINTENANCE' order by "SQ_EVENTO" desc limit 1),
  'Implantação da nova versão do construtor.',
  'o motivo fica registrado'
);

select is(
  (select "DS_DADO_ANTERIOR" ->> 'global' from sigav."TL_EVENTO_AUDITORIA" where "TP_ENTIDADE" = 'PLATFORM_MAINTENANCE' order by "SQ_EVENTO" desc limit 1),
  'false',
  'o estado anterior é preservado'
);

select is(
  (select "DS_DADO_POSTERIOR" ->> 'global' from sigav."TL_EVENTO_AUDITORIA" where "TP_ENTIDADE" = 'PLATFORM_MAINTENANCE' order by "SQ_EVENTO" desc limit 1),
  'true',
  'o estado posterior é preservado'
);

select is(
  (sigav."FC_REGISTRAR_MANUT_AUDITORIA"(
    'MODULE_MAINTENANCE_ENABLED',
    'Ajuste no painel institucional.',
    '{"global": false, "modules": []}'::jsonb,
    '{"global": false, "modules": ["DASHBOARDS"]}'::jsonb,
    array['DASHBOARDS']
  ) ->> 'status'),
  'OK',
  'ADMIN_ACCESS registra a manutenção de um módulo'
);

select is(
  (select "DS_METADADO" -> 'modules' from sigav."TL_EVENTO_AUDITORIA" where "TP_ENTIDADE" = 'PLATFORM_MAINTENANCE' order by "SQ_EVENTO" desc limit 1),
  '["DASHBOARDS"]'::jsonb,
  'os módulos afetados ficam registrados'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000e003","role":"authenticated"}',
  true
);

select throws_ok(
  $$select sigav."FC_REGISTRAR_MANUT_AUDITORIA"(
      'PLATFORM_MAINTENANCE_ENABLED', 'tentativa', '{}'::jsonb, '{}'::jsonb, '{}'::text[]
    )$$,
  '42501',
  'Apenas a administração da plataforma pode registrar manutenção.',
  'ADMIN_SURVEYS não consegue registrar manutenção'
);

select * from finish();

rollback;
