begin;

-- A tela Minha equipe passa a permitir a escolha da avaliação quando a pessoa
-- lidera equipe em mais de um ciclo. Esta função lista apenas os ciclos em que
-- a pessoa autenticada possui vínculo de liderança ativo — o catálogo do
-- participante (list_my_survey_catalog) não serve para isso porque um ciclo
-- RESTRICTED não aparece para quem é somente liderança, sem ser participante.
-- A ordenação (mais recente primeiro) espelha a resolução automática de
-- get_my_team_workspace, garantindo que o item pré-selecionado no seletor seja
-- o mesmo ciclo carregado quando nenhum código é informado.

create or replace function public.fc_listar_ciclos_lideranca()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person_id uuid;
  v_result jsonb;
begin
  v_person_id := public.current_person_id();
  if v_person_id is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;

  select coalesce(jsonb_agg(cycle order by cycle_sort desc), '[]'::jsonb)
  into v_result
  from (
    select
      jsonb_build_object(
        'id', sa.id,
        'code', sa.code,
        'name', sa.name,
        'status', sa.status,
        'opensAt', sa.opens_at,
        'closesAt', sa.closes_at
      ) as cycle,
      coalesce(sa.closes_at, sa.opens_at, sa.created_at) as cycle_sort
    from public.survey_applications sa
    where exists (
      select 1
      from public.cddi_leadership_links l
      where l.application_id = sa.id
        and l.leader_person_id = v_person_id
        and l.status = 'ACTIVE'
        and l.valid_to is null
    )
  ) cycles;

  return v_result;
end;
$$;

revoke all on function public.fc_listar_ciclos_lideranca() from public, anon;
grant execute on function public.fc_listar_ciclos_lideranca() to authenticated;

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_listar_ciclos_lideranca();
-- commit;
