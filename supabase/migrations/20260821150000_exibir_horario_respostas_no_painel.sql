begin;

-- O painel passa a mostrar o momento de cada resposta aberta, inclusive em
-- ciclos anônimos. A identidade segue ausente: o retorno não contém pessoa ou
-- participante, apenas texto e instante de envio.
do $migration$
declare v_definition text;
begin
  select pg_get_functiondef('public.fc_obter_painel_pesquisa(text)'::regprocedure) into v_definition;
  v_definition := replace(
    v_definition,
    'case when v_anonimo then null else sample.submitted_at end',
    'sample.submitted_at'
  );
  if position($$'submittedAt', sample.submitted_at$$ in v_definition) = 0 then
    raise exception 'Não foi possível incluir o horário no painel.';
  end if;
  execute v_definition;
end;
$migration$;

comment on function public.fc_obter_painel_pesquisa(text) is
  'Painel de uma pesquisa. Em ciclo anônimo, mostra resultados sem identidade, incluindo o horário de envio das respostas abertas.';

notify pgrst, 'reload schema';
commit;
