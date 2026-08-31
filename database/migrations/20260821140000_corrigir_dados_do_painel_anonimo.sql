begin;

-- Garante o contrato mesmo em bancos cuja definição anterior do painel tenha
-- sido formatada de forma diferente: não há mais caso de supressão e o resumo
-- de ciclo anônimo vem das submissões públicas, que não têm participante.
do $migration$
declare v_definition text;
begin
  select pg_get_functiondef('public.fc_obter_painel_pesquisa(text)'::regprocedure) into v_definition;
  v_definition := regexp_replace(v_definition, 'respostas\.total < v_limiar', 'false', 'g');
  v_definition := replace(v_definition,
$$  return v_payload;$$,
$$  if v_anonimo then
    v_payload := jsonb_set(v_payload, '{summary}', jsonb_build_object(
      'totalParticipants', (select count(*) from public.submissions s where s.application_id = v_application_id and s.status in ('DRAFT', 'SUBMITTED', 'VALIDATED')),
      'drafts', (select count(*) from public.submissions s where s.application_id = v_application_id and s.status = 'DRAFT'),
      'submitted', (select count(*) from public.submissions s where s.application_id = v_application_id and s.status in ('SUBMITTED', 'VALIDATED')),
      'notStarted', 0,
      'completionRate', case when (select count(*) from public.submissions s where s.application_id = v_application_id and s.status in ('DRAFT', 'SUBMITTED', 'VALIDATED')) = 0 then 0 else round((select count(*) from public.submissions s where s.application_id = v_application_id and s.status in ('SUBMITTED', 'VALIDATED'))::numeric * 100 / (select count(*) from public.submissions s where s.application_id = v_application_id and s.status in ('DRAFT', 'SUBMITTED', 'VALIDATED')), 1) end
    ));
  end if;
  return v_payload;$$);
  if position($$'suppressed', false$$ in v_definition) = 0 then
    raise exception 'Não foi possível remover a supressão do painel anônimo.';
  end if;
  execute v_definition;
end;
$migration$;

notify pgrst, 'reload schema';
commit;
