-- Regressões da auditoria de segurança de 2026-08-22.

begin;

select plan(10);

-- O contrato entregue ao respondente não carrega a fórmula de pontuação.
select ok(
  pg_catalog.pg_get_functiondef('public.get_public_survey_form(text)'::regprocedure)
    not like '%''scoring'', sq.scoring%',
  'formulário público não expõe scoring da pergunta'
);

select ok(
  pg_catalog.pg_get_functiondef('public.get_public_survey_form(text)'::regprocedure)
    not like '%''score'', qo.score%',
  'formulário público não expõe score da alternativa'
);

-- A função continua sendo contrato somente de pessoa autenticada; a jornada
-- anônima passa pela envoltória service_role já coberta em rpcs_anonimas_acl.
select ok(
  has_function_privilege('authenticated', 'public.get_public_survey_form(text)'::regprocedure, 'execute'),
  'authenticated executa get_public_survey_form'
);
select ok(
  not has_function_privilege('anon', 'public.get_public_survey_form(text)'::regprocedure, 'execute'),
  'anon não executa get_public_survey_form diretamente'
);

-- Os LIMITs precisam estar dentro das subconsultas que alimentam o jsonb_agg;
-- caso contrário o aggregate reduz tudo a uma linha e LIMIT deixa de limitar
-- pessoas/eventos.
select ok(
  pg_catalog.pg_get_functiondef('public.search_platform_admin_people(text,integer)'::regprocedure)
    like '%select candidate.*%limit v_limit% ) p%',
  'busca administrativa limita candidatos antes do aggregate'
);
select ok(
  pg_catalog.pg_get_functiondef('public.list_platform_admin_person_audit(uuid,integer)'::regprocedure)
    like '%select event.*%limit v_limit% ) e%',
  'auditoria limita eventos antes do aggregate'
);

select ok(
  has_function_privilege('authenticated', 'public.search_platform_admin_people(text,integer)'::regprocedure, 'execute'),
  'authenticated mantém acesso ao contrato de busca administrativa'
);
select ok(
  not has_function_privilege('anon', 'public.search_platform_admin_people(text,integer)'::regprocedure, 'execute'),
  'anon não executa busca administrativa'
);
select ok(
  has_function_privilege('authenticated', 'public.list_platform_admin_person_audit(uuid,integer)'::regprocedure, 'execute'),
  'authenticated mantém acesso ao contrato de auditoria administrativa'
);
select ok(
  not has_function_privilege('anon', 'public.list_platform_admin_person_audit(uuid,integer)'::regprocedure, 'execute'),
  'anon não executa auditoria administrativa'
);

select * from finish();
rollback;
