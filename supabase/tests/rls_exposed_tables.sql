begin;

select plan(1);

select is(
  (
    select count(*)::bigint
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and relation.relrowsecurity = false
  ),
  0::bigint,
  'todas as tabelas expostas no schema public possuem RLS habilitado'
);

select * from finish();

rollback;
