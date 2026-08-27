begin;

-- Estas RPCs são somente de leitura do módulo Painéis. O modelo de permissões
-- já concede DASHBOARDS a SuperAdmin, Admin e Gestor. Não ampliar
-- can_manage_surveys(): essa capacidade continua reservada à administração de
-- avaliações.
do $migration$
declare
  v_oid oid;
  v_definition text;
  v_old_guard constant text := $guard$
if not sigav.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;
$guard$;
  v_new_guard constant text := $guard$
if not sigav.has_platform_module('DASHBOARDS') then
    raise exception 'Acesso restrito ao módulo de Painéis.';
  end if;
$guard$;
begin
  for v_oid in
    select unnest(array[
      'sigav.fc_listar_ciclos_pesquisa(text)'::regprocedure::oid,
      'sigav.fc_obter_painel_pesquisa(text)'::regprocedure::oid
    ])
  loop
    select pg_get_functiondef(v_oid)
    into v_definition;

    if position(v_old_guard in v_definition) = 0 then
      raise exception 'Guard legado não localizado na função %.', v_oid::regprocedure;
    end if;

    execute replace(v_definition, v_old_guard, v_new_guard);
  end loop;
end;
$migration$;

notify pgrst, 'reload schema';

commit;
