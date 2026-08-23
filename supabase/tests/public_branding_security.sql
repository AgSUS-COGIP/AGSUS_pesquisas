-- Estado final do rollout expand/contract da marca publica.

begin;

select plan(6);

select ok(
  has_function_privilege('anon', 'public.fc_obter_marca_publica()'::regprocedure, 'execute'),
  'anon executa o contrato visual minimo'
);

select ok(
  not exists (
    select 1
    from pg_catalog.pg_proc p
    cross join lateral pg_catalog.aclexplode(
      coalesce(p.proacl, pg_catalog.acldefault('f', p.proowner))
    ) acl
    where p.oid = 'public.fc_obter_marca_publica()'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC nao herda execucao da RPC visual'
);

select ok(
  position('tx_instrucao_email' in lower(pg_catalog.pg_get_functiondef('public.fc_obter_marca_publica()'::regprocedure))) = 0
  and position('tx_rodape_email' in lower(pg_catalog.pg_get_functiondef('public.fc_obter_marca_publica()'::regprocedure))) = 0
  and position('fl_presenca_online_ativa' in lower(pg_catalog.pg_get_functiondef('public.fc_obter_marca_publica()'::regprocedure))) = 0
  and position('tx_perfis_visualizacao_presenca' in lower(pg_catalog.pg_get_functiondef('public.fc_obter_marca_publica()'::regprocedure))) = 0,
  'definicao publica nao le configuracoes operacionais'
);

select ok(
  not (coalesce(public.fc_obter_marca_publica(), '{}'::jsonb) ?| array[
    'emailInstruction',
    'emailFooter',
    'onlinePresenceEnabled',
    'onlinePresenceViewerRoles',
    'updatedAt'
  ]),
  'payload visual nao contem configuracoes operacionais'
);

select ok(
  has_function_privilege('authenticated', 'public.fc_obter_marca_plataforma()'::regprocedure, 'execute'),
  'authenticated preserva o contrato completo da marca'
);

select ok(
  not has_function_privilege('anon', 'public.fc_obter_marca_plataforma()'::regprocedure, 'execute'),
  'anon nao executa mais o contrato completo da marca'
);

select * from finish();
rollback;
