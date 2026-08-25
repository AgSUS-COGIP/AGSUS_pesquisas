-- Paginação completa e autorização da matriz de acessos.

begin;

select plan(12);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  '00000000-0000-4000-8000-00000000d100',
  'authenticated',
  'authenticated',
  'gestor-paginacao@agenciasus.org.br',
  now(),
  now()
);

insert into public.people (id, auth_user_id, employee_number, full_name, institutional_email)
values
  ('00000000-0000-4000-8000-00000000d100', '00000000-0000-4000-8000-00000000d100', 'PAG-ADMIN', 'Gestor do teste', 'gestor-paginacao@agenciasus.org.br'),
  ('00000000-0000-4000-8000-00000000d101', null, 'PAG-001', 'Pessoa Paginação 01', 'paginacao-01@agenciasus.org.br'),
  ('00000000-0000-4000-8000-00000000d102', null, 'PAG-002', 'Pessoa Paginação 02', 'paginacao-02@agenciasus.org.br'),
  ('00000000-0000-4000-8000-00000000d103', null, 'PAG-003', 'Pessoa Paginação 03', 'paginacao-03@agenciasus.org.br'),
  ('00000000-0000-4000-8000-00000000d104', null, 'PAG-004', 'Pessoa Paginação 04', 'paginacao-04@agenciasus.org.br'),
  ('00000000-0000-4000-8000-00000000d105', null, 'PAG-005', 'Pessoa Paginação 05', 'paginacao-05@agenciasus.org.br');

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000d100","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select public.fc_listar_acessos_paginados('Pessoa Paginação', 2, 0) $$,
  'Apenas o Superadmin pode consultar pessoas e permissões.',
  'uma sessão sem perfil de Superadmin não enumera acessos'
);

insert into public.person_role_assignments (person_id, role_id, assigned_by)
select '00000000-0000-4000-8000-00000000d100', id, '00000000-0000-4000-8000-00000000d100'
from public.system_roles
where code = 'ADMINISTRATOR';

select is(
  (public.fc_listar_acessos_paginados('Pessoa Paginação', 2, 0)->>'total')::integer,
  5,
  'o total considera todos os resultados filtrados'
);

select is(
  jsonb_array_length(public.fc_listar_acessos_paginados('Pessoa Paginação', 2, 0)->'people'),
  2,
  'a primeira página respeita o limite solicitado'
);

select is(
  public.fc_listar_acessos_paginados('Pessoa Paginação', 2, 0)->>'hasMore',
  'true',
  'a primeira página informa que há continuação'
);

select is(
  public.fc_listar_acessos_paginados('Pessoa Paginação', 2, 4)->>'hasMore',
  'false',
  'a última página informa que não há continuação'
);

select is(
  jsonb_array_length(public.fc_listar_acessos_paginados('Pessoa Paginação', 2, 4)->'people'),
  1,
  'a última página devolve o resultado restante'
);

select is(
  (
    select array_agg(item->>'fullName' order by ordinalidade)
    from jsonb_array_elements(public.fc_listar_acessos_paginados('Pessoa Paginação', 5, 0)->'people')
      with ordinality as page(item, ordinalidade)
  ),
  array['Pessoa Paginação 01', 'Pessoa Paginação 02', 'Pessoa Paginação 03', 'Pessoa Paginação 04', 'Pessoa Paginação 05'],
  'a ordenação é estável entre páginas'
);

select is(
  (
    select count(*)::integer
    from jsonb_array_elements(public.fc_listar_acessos_paginados('Pessoa Paginação', 2, 0)->'people') as first_page(item)
    join jsonb_array_elements(public.fc_listar_acessos_paginados('Pessoa Paginação', 2, 2)->'people') as second_page(item)
      on first_page.item->>'personId' = second_page.item->>'personId'
  ),
  0,
  'páginas consecutivas não repetem pessoas'
);

select is(
  (public.fc_listar_acessos_paginados('PAG-005', 2, 0)->>'total')::integer,
  1,
  'a busca alcança uma pessoa fora da primeira página'
);

select ok(
  has_function_privilege('authenticated', 'public.fc_listar_acessos_paginados(text,integer,integer)'::regprocedure, 'execute'),
  'authenticated pode executar a RPC protegida'
);

select ok(
  not has_function_privilege('anon', 'public.fc_listar_acessos_paginados(text,integer,integer)'::regprocedure, 'execute'),
  'anon não pode executar a RPC'
);

select ok(
  (
    select proc.prosecdef
      and exists (
        select 1
        from unnest(coalesce(proc.proconfig, array[]::text[])) as config
        where config like 'search_path=%'
      )
    from pg_catalog.pg_proc as proc
    where proc.oid = 'public.fc_listar_acessos_paginados(text,integer,integer)'::regprocedure
  ),
  'a função SECURITY DEFINER fixa o search_path'
);

select * from finish();

rollback;
