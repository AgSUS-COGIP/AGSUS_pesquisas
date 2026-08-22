-- A configuracao completa da marca nao e superficie anonima do Data API.

begin;

select plan(4);

select ok(
  not has_function_privilege('anon', 'public.fc_obter_marca_plataforma()'::regprocedure, 'execute'),
  'anon nao executa a RPC completa da marca'
);

select ok(
  not has_function_privilege('public', 'public.fc_obter_marca_plataforma()'::regprocedure, 'execute'),
  'PUBLIC nao herda execucao da RPC completa da marca'
);

select ok(
  has_function_privilege('authenticated', 'public.fc_obter_marca_plataforma()'::regprocedure, 'execute'),
  'authenticated preserva o contrato completo da marca'
);

select ok(
  has_function_privilege('service_role', 'public.fc_obter_marca_plataforma()'::regprocedure, 'execute'),
  'service_role pode ler a marca no servidor para a resposta publica saneada'
);

select * from finish();
rollback;
