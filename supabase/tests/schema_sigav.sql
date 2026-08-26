begin;

select plan(8);

select has_schema('sigav', 'o schema da aplicação existe');

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p', 'f', 'S', 'v', 'm')
  ),
  0,
  'public não contém relações da aplicação'
);

select ok(
  (
    select count(*) > 0
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'sigav'
      and c.relkind in ('r', 'p')
  ),
  'sigav contém as tabelas da aplicação'
);

select is(
  (
    select count(*)::integer
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'sigav'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
  ),
  0,
  'todas as tabelas expostas continuam com RLS'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
  ),
  0,
  'public não contém funções da aplicação'
);

select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('sigav', 'private')
      and (
        p.prosrc like '%public.%'
        or p.prosrc like '%''public''%'
        or array_to_string(p.proconfig, ',') like '%public%'
      )
  ),
  0,
  'funções da aplicação não conservam referências ao schema antigo'
);

select ok(
  has_schema_privilege('anon', 'sigav', 'USAGE')
  and has_schema_privilege('authenticated', 'sigav', 'USAGE')
  and has_schema_privilege('service_role', 'sigav', 'USAGE'),
  'papéis da Data API têm USAGE no schema sigav'
);

select is(
  (
    select count(*)::integer
    from pg_views
    where schemaname = 'DB_PESQUISAS'
      and definition like '%public.%'
  ),
  0,
  'views analíticas acompanham as relações movidas'
);

select * from finish();

rollback;
