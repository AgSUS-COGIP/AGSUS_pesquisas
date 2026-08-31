begin;

-- Comparação SQL com NULL produz NULL. Embora as funções de permissão
-- recusassem uma sessão sem pessoa, a fronteira técnica deve falhar fechada por
-- construção: ausência da claim não pode depender do segundo termo do IF.
do $endurecimento$
declare
  v_funcao record;
  v_definicao text;
  v_restantes integer;
begin
  for v_funcao in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'sigav'
      and p.prosrc like '%sigav.fc_papel_sessao() <> ''authenticated''%'
    order by p.proname, pg_get_function_identity_arguments(p.oid)
  loop
    v_definicao := pg_get_functiondef(v_funcao.oid);
    v_definicao := replace(
      v_definicao,
      'sigav.fc_papel_sessao() <> ''authenticated''',
      'sigav.fc_papel_sessao() is distinct from ''authenticated'''
    );
    execute v_definicao;
  end loop;

  select count(*)::integer
  into v_restantes
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'sigav'
    and p.prosrc like '%sigav.fc_papel_sessao() <> ''authenticated''%';

  if v_restantes <> 0 then
    raise exception 'Ainda existem % funções com comparação anulável da role técnica.', v_restantes;
  end if;
end;
$endurecimento$;

commit;

-- Rollback não se aplica: restaurar a comparação anulável reabriria o defeito.
