begin;

-- SECURITY DEFINER functions are intentionally available only after login.
-- Internal helper functions remain callable by authenticated policies and RPCs,
-- while anonymous clients can no longer invoke privileged database routines.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon', r.signature);

    if r.proname <> 'rls_auto_enable' then
      execute format('grant execute on function %s to authenticated', r.signature);
    end if;
  end loop;
end;
$$;

commit;
