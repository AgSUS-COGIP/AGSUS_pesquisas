-- O bearer token do rascunho anonimo nunca deve ser persistido em texto puro.

begin;

select plan(8);

select ok(
  position('''public_session_token_hash''' in lower(pg_catalog.pg_get_functiondef(
    'public.fc_iniciar_resp_anon(text)'::regprocedure
  ))) > 0,
  'a criacao persiste somente o hash da sessao anonima'
);

select ok(
  position('''public_session_token''' in lower(pg_catalog.pg_get_functiondef(
    'public.fc_iniciar_resp_anon(text)'::regprocedure
  ))) = 0,
  'a criacao nao persiste o token anonimo em texto puro'
);

select ok(
  position('extensions.digest(target_session_token' in lower(pg_catalog.pg_get_functiondef(
    'public.fc_gravar_resp_anon(uuid,text,uuid,uuid[],text,numeric,boolean,date,timestamptz,jsonb)'::regprocedure
  ))) > 0,
  'a gravacao compara o hash do token apresentado'
);

select ok(
  position('metadata ->> ''public_session_token''' in lower(pg_catalog.pg_get_functiondef(
    'public.fc_gravar_resp_anon(uuid,text,uuid,uuid[],text,numeric,boolean,date,timestamptz,jsonb)'::regprocedure
  ))) = 0,
  'a gravacao nao consulta token persistido em texto puro'
);

select ok(
  position('extensions.digest(target_session_token' in lower(pg_catalog.pg_get_functiondef(
    'public.fc_enviar_resp_anon(uuid,text)'::regprocedure
  ))) > 0,
  'o envio compara o hash do token apresentado'
);

select ok(
  position('metadata ->> ''public_session_token''' in lower(pg_catalog.pg_get_functiondef(
    'public.fc_enviar_resp_anon(uuid,text)'::regprocedure
  ))) = 0,
  'o envio nao consulta token persistido em texto puro'
);

select is(
  (
    select count(*)::bigint
    from public.submissions
    where metadata ->> 'origin' = 'PUBLIC_ANONYMOUS_LINK'
      and metadata ? 'public_session_token'
  ),
  0::bigint,
  'nenhuma submissao anonima mantem o bearer token em texto puro'
);

select ok(
  not has_function_privilege('anon', 'public.fc_iniciar_resp_anon(text)'::regprocedure, 'execute')
  and not has_function_privilege('authenticated', 'public.fc_iniciar_resp_anon(text)'::regprocedure, 'execute')
  and not has_function_privilege('service_role', 'public.fc_iniciar_resp_anon(text)'::regprocedure, 'execute'),
  'a funcao de dominio continua isolada dos papeis da Data API'
);

select * from finish();
rollback;
