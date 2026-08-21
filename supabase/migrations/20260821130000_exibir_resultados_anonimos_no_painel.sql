begin;

-- O painel passa a exibir o agregado de ciclos anônimos sem limiar. As
-- submissões públicas não possuem `participant_id`; por isso seus indicadores
-- precisam ser calculados pela própria tabela de submissões, e não pelo público
-- institucional vinculado ao ciclo.
do $migration$
declare v_definition text;
begin
  select pg_get_functiondef('public.fc_obter_painel_pesquisa(text)'::regprocedure) into v_definition;

  v_definition := replace(v_definition,
$$  if not v_anonimo then
    v_limiar := 0;
  end if;$$,
$$  v_limiar := 0;$$);

  v_definition := replace(v_definition,
$$        'totalParticipants', total,
        'drafts', drafts,
        'submitted', submitted,
        'notStarted', not_started,
        'completionRate', case when total = 0 then 0 else round(submitted::numeric * 100 / total, 1) end$$,
$$        'totalParticipants', case when v_anonimo then (select count(*) from public.submissions s where s.application_id = v_application_id and s.status in ('DRAFT', 'SUBMITTED', 'VALIDATED')) else total end,
        'drafts', case when v_anonimo then (select count(*) from public.submissions s where s.application_id = v_application_id and s.status = 'DRAFT') else drafts end,
        'submitted', case when v_anonimo then (select count(*) from public.submissions s where s.application_id = v_application_id and s.status in ('SUBMITTED', 'VALIDATED')) else submitted end,
        'notStarted', case when v_anonimo then 0 else not_started end,
        'completionRate', case when v_anonimo then case when (select count(*) from public.submissions s where s.application_id = v_application_id and s.status in ('DRAFT', 'SUBMITTED', 'VALIDATED')) = 0 then 0 else round((select count(*) from public.submissions s where s.application_id = v_application_id and s.status in ('SUBMITTED', 'VALIDATED'))::numeric * 100 / (select count(*) from public.submissions s where s.application_id = v_application_id and s.status in ('DRAFT', 'SUBMITTED', 'VALIDATED')), 1) end else case when total = 0 then 0 else round(submitted::numeric * 100 / total, 1) end end$$);

  if position($$'suppressed', respostas.total < v_limiar$$ in v_definition) = 0 then
    raise exception 'Não foi possível atualizar o contrato do painel anônimo.';
  end if;
  execute v_definition;
end;
$migration$;

comment on function public.fc_obter_painel_pesquisa(text) is
  'Painel de uma pesquisa. Em ciclo anônimo, mostra somente dados agregados e respostas sem identidade ou horário de envio.';

notify pgrst, 'reload schema';
commit;
