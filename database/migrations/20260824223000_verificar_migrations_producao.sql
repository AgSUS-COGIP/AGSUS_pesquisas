begin;

create or replace function public.fc_srv_verificar_migrations(p_versoes text[])
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  with esperadas as (
    select distinct versao
    from unnest(coalesce(p_versoes, array[]::text[])) as t(versao)
    where versao is not null and btrim(versao) <> ''
  ),
  ausentes as (
    select e.versao
    from esperadas e
    where not exists (
      select 1
      from sigav.tb_migracao m
      where m.co_versao = e.versao
    )
  )
  select jsonb_build_object(
    'checked', (select count(*) from esperadas),
    'missing', coalesce((select jsonb_agg(versao order by versao) from ausentes), '[]'::jsonb),
    'compatible', not exists (select 1 from ausentes),
    'latestApplied', (select max(co_versao) from sigav.tb_migracao)
  );
$$;

revoke all on function public.fc_srv_verificar_migrations(text[]) from public, anon, authenticated;
grant execute on function public.fc_srv_verificar_migrations(text[]) to service_role;

comment on function public.fc_srv_verificar_migrations(text[]) is
  'Compara as migrations esperadas pelo deploy com o historico registrado no banco.';

notify pgrst, 'reload schema';
commit;
