begin;

-- Estas RPCs são somente de leitura do módulo Painéis. O modelo de permissões
-- já concede DASHBOARDS a SuperAdmin, Admin e Gestor. Não ampliar
-- can_manage_surveys(): essa capacidade continua reservada à administração de
-- avaliações.
--
-- A alteração trabalha sobre a definição atual da função para preservar todo o
-- corpo existente e troca somente a capacidade usada no guard. A checagem é
-- idempotente: se a função já estiver protegida por DASHBOARDS, nada é refeito.
do $migration$
declare
  v_oid oid;
  v_definition text;
  v_old_check constant text := 'sigav.can_manage_surveys()';
  v_new_check constant text := 'sigav.has_platform_module(''DASHBOARDS'')';
begin
  for v_oid in
    select unnest(array[
      'sigav.fc_listar_ciclos_pesquisa(text)'::regprocedure::oid,
      'sigav.fc_obter_painel_pesquisa(text)'::regprocedure::oid
    ])
  loop
    select pg_get_functiondef(v_oid)
    into v_definition;

    -- Estado já corrigido: mantém a migration reaplicável sem alterar o corpo.
    if position(v_new_check in v_definition) > 0 then
      continue;
    end if;

    -- Falha fechada se a função deixar de ter o guard legado esperado.
    if position(v_old_check in v_definition) = 0 then
      raise exception 'Guard de administração não localizado na função %.', v_oid::regprocedure;
    end if;

    v_definition := replace(v_definition, v_old_check, v_new_check);
    v_definition := replace(
      v_definition,
      'Acesso restrito à administração de avaliações.',
      'Acesso restrito ao módulo de Painéis.'
    );

    execute v_definition;
  end loop;
end;
$migration$;

notify pgrst, 'reload schema';

commit;
