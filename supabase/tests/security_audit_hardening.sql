begin;

select plan(26);

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
  'service_role preserva a função de domínio do worker de e-mail'
);

select ok(
  not has_function_privilege('authenticated', 'public.fc_srv_reivindicar_emails()', 'execute'),
  'authenticated não executa o contrato de backend da fila de e-mail'
);

select ok(
  has_function_privilege('service_role', 'public.fc_srv_reivindicar_emails()', 'execute'),
  'service_role executa o contrato de backend da fila de e-mail'
);

select ok(
  not has_function_privilege('authenticated', 'public.fc_srv_concluir_email(uuid,boolean,text)', 'execute'),
  'authenticated não executa a conclusão simples do backend'
);

select ok(
  has_function_privilege('service_role', 'public.fc_srv_concluir_email(uuid,boolean,text)', 'execute'),
  'service_role executa a conclusão simples do backend'
);

select ok(
  not has_function_privilege('authenticated', 'public.fc_srv_concluir_email(uuid,uuid,boolean,text)', 'execute'),
  'authenticated não executa a conclusão reivindicada do backend'
);

select ok(
  has_function_privilege('service_role', 'public.fc_srv_concluir_email(uuid,uuid,boolean,text)', 'execute'),
  'service_role executa a conclusão reivindicada do backend'
);

select is(
  (select count(*)::bigint
   from pg_catalog.pg_class
   where relkind = 'i'
     and relname in (
       'in_perm_mod_concedido_por',
       'in_perm_mod_codigo',
       'in_perfil_mod_codigo',
       'in_bilhete_anon_pessoa',
       'in_cond_regra_opcao',
       'in_config_plat_usuario_alt',
       'in_regra_cond_usuario_inc',
       'in_email_part_pessoa'
     )),
  8::bigint,
  'as oito FKs apontadas pelo Advisor possuem índices de cobertura'
);

select is(
  (select count(*)::bigint
   from pg_catalog.pg_policies
   where schemaname = 'public'
     and tablename = 'answers'
     and cmd = 'SELECT'
     and 'authenticated' = any (roles)
     and permissive = 'PERMISSIVE'),
  1::bigint,
  'answers possui uma única política permissiva de SELECT para authenticated'
);

select is(
  (select count(*)::bigint
   from pg_catalog.pg_policies
   where schemaname = 'public'
     and tablename = 'submissions'
     and cmd = 'SELECT'
     and 'authenticated' = any (roles)
     and permissive = 'PERMISSIVE'),
  1::bigint,
  'submissions possui uma única política permissiva de SELECT para authenticated'
);

select is(
  (select count(*)::bigint
   from pg_catalog.pg_policies
   where schemaname = 'public'
     and tablename = 'submissions'
     and cmd = 'UPDATE'
     and 'authenticated' = any (roles)
     and permissive = 'PERMISSIVE'),
  1::bigint,
  'submissions possui uma única política permissiva de UPDATE para authenticated'
);

-- A ACL das funcoes internas criadas pela PR de deploy/idempotencia.
--
-- Sao afirmacoes de regressao, nao cobertura nova: o que motivou escreve-las
-- foi a redefinicao de fc_reivindicar_emails reconceder execute a authenticated
-- sem conflito e sem historico. Redefinir funcao nao preserva a ACL anterior,
-- entao o unico jeito de a proxima redefinicao nao repetir o erro em silencio e'
-- o teste cobrar o estado final.
select ok(
  not has_function_privilege('authenticated', 'public.fc_srv_verificar_contrato_rpc(text[])', 'execute'),
  'authenticated nao executa a verificacao de contrato de RPC'
);

select ok(
  has_function_privilege('service_role', 'public.fc_srv_verificar_contrato_rpc(text[])', 'execute'),
  'service_role executa a verificacao de contrato de RPC'
);

select ok(
  not has_function_privilege('authenticated', 'public.fc_srv_registrar_transporte(uuid,uuid,text)', 'execute'),
  'authenticated nao executa o registro de transporte de e-mail'
);

select ok(
  has_function_privilege('service_role', 'public.fc_srv_registrar_transporte(uuid,uuid,text)', 'execute'),
  'service_role executa o registro de transporte de e-mail'
);

select * from finish();

rollback;
