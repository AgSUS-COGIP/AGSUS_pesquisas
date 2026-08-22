-- Regressões da auditoria de segurança de 2026-08-22.

begin;

select plan(14);

-- O contrato entregue ao respondente não carrega a fórmula de pontuação.
select ok(
  pg_catalog.pg_get_functiondef('public.fc_obter_formulario_publico(text)'::regprocedure)
    not like '%''scoring'', sq.scoring%',
  'formulário público não expõe scoring da pergunta'
);

select ok(
  pg_catalog.pg_get_functiondef('public.fc_obter_formulario_publico(text)'::regprocedure)
    not like '%''score'', qo.score%',
  'formulário público não expõe score da alternativa'
);

select ok(
  has_function_privilege('authenticated', 'public.fc_obter_formulario_publico(text)'::regprocedure, 'execute'),
  'authenticated executa a RPC institucional do formulário'
);

select ok(
  not has_function_privilege('anon', 'public.fc_obter_formulario_publico(text)'::regprocedure, 'execute'),
  'anon não executa a RPC institucional do formulário diretamente'
);

select ok(
  not has_function_privilege('authenticated', 'public.get_public_survey_form(text)'::regprocedure, 'execute'),
  'contrato legado do formulário não é mais executável por authenticated'
);

select ok(
  pg_catalog.pg_get_functiondef('public.fc_obter_form_anonimo(text)'::regprocedure)
    like '%fc_obter_formulario_publico%',
  'jornada anônima reutiliza o formulário saneado'
);

-- Os LIMITs ficam dentro das subconsultas que alimentam o jsonb_agg.
select ok(
  regexp_replace(
    pg_catalog.pg_get_functiondef('public.fc_pesquisar_pessoa_admin(text,integer)'::regprocedure),
    E'\\s+', ' ', 'g'
  ) like '%from ( select candidate.*%limit v_limit ) p%',
  'busca administrativa limita candidatos antes do aggregate'
);

select ok(
  has_function_privilege('authenticated', 'public.fc_pesquisar_pessoa_admin(text,integer)'::regprocedure, 'execute'),
  'authenticated executa a nova busca administrativa'
);

select ok(
  not has_function_privilege('anon', 'public.fc_pesquisar_pessoa_admin(text,integer)'::regprocedure, 'execute'),
  'anon não executa a nova busca administrativa'
);

select ok(
  not has_function_privilege('authenticated', 'public.search_platform_admin_people(text,integer)'::regprocedure, 'execute'),
  'busca administrativa legada não é mais executável por authenticated'
);

select ok(
  regexp_replace(
    pg_catalog.pg_get_functiondef('public.fc_listar_auditoria_pessoa(uuid,integer)'::regprocedure),
    E'\\s+', ' ', 'g'
  ) like '%from ( select event.*%limit v_limit ) e%',
  'auditoria limita eventos antes do aggregate'
);

select ok(
  has_function_privilege('authenticated', 'public.fc_listar_auditoria_pessoa(uuid,integer)'::regprocedure, 'execute'),
  'authenticated executa a nova auditoria administrativa'
);

select ok(
  not has_function_privilege('anon', 'public.fc_listar_auditoria_pessoa(uuid,integer)'::regprocedure, 'execute'),
  'anon não executa a nova auditoria administrativa'
);

select ok(
  not has_function_privilege('authenticated', 'public.list_platform_admin_person_audit(uuid,integer)'::regprocedure, 'execute'),
  'auditoria administrativa legada não é mais executável por authenticated'
);

select * from finish();
rollback;
