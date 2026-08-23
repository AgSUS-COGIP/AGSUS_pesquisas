begin;

select plan(12);

select ok(
  (select relrowsecurity from pg_catalog.pg_class where oid = 'public.tb_limite_requisicao_publica'::regclass),
  'a tabela de rate limit usa RLS'
);

select is(
  (select count(*)::bigint from information_schema.role_table_grants
   where table_schema = 'public'
     and table_name = 'tb_limite_requisicao_publica'
     and grantee in ('anon', 'authenticated')),
  0::bigint,
  'anon e authenticated não possuem privilégios diretos na tabela de rate limit'
);

select ok(
  not has_function_privilege(
    'anon',
    'public.fc_srv_consumir_limite_publico(text,text,integer,integer)',
    'execute'
  ),
  'anon não executa o limitador privilegiado'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.fc_srv_consumir_limite_publico(text,text,integer,integer)',
    'execute'
  ),
  'authenticated não executa o limitador privilegiado'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.fc_srv_consumir_limite_publico(text,text,integer,integer)',
    'execute'
  ),
  'service_role executa o limitador privilegiado'
);

select ok(
  (public.fc_srv_consumir_limite_publico(
    'teste-rate-limit', repeat('a', 64), 2, 300
  ) ->> 'allowed')::boolean,
  'primeira requisição da janela é permitida'
);

select ok(
  (public.fc_srv_consumir_limite_publico(
    'teste-rate-limit', repeat('a', 64), 2, 300
  ) ->> 'allowed')::boolean,
  'segunda requisição da janela é permitida'
);

select ok(
  not (public.fc_srv_consumir_limite_publico(
    'teste-rate-limit', repeat('a', 64), 2, 300
  ) ->> 'allowed')::boolean,
  'requisição acima do limite é bloqueada'
);

select ok(
  not has_function_privilege('authenticated', 'public.fc_reivindicar_emails()', 'execute'),
  'authenticated não executa fc_reivindicar_emails'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.fc_concluir_email_participante(uuid,boolean,text)',
    'execute'
  ),
  'authenticated não executa a conclusão simples de e-mail'
);

select ok(
  not has_function_privilege(
    'authenticated',
    'public.fc_concluir_email_participante(uuid,uuid,boolean,text)',
    'execute'
  ),
  'authenticated não executa a conclusão reivindicada de e-mail'
);

select ok(
  has_function_privilege('service_role', 'public.fc_reivindicar_emails()', 'execute'),
  'service_role preserva o contrato do worker de e-mail'
);

select * from finish();

rollback;
