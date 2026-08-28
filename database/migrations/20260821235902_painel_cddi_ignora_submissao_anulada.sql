begin;

-- AGS-01 — submissão invalidada deixa de contar como concluída no painel CDDI.
--
-- `INVALIDATE` preserva `submitted_at` como histórico. O painel não pode usar
-- apenas essa data como prova de conclusão, nem manter eventos, competências ou
-- resultado final derivados de uma submissão anulada.
--
-- A função é legada e já existe em produção. Em vez de copiar novamente todo o
-- corpo, esta migration altera quatro trechos ancorados da definição vigente e
-- falha explicitamente se algum deles não for encontrado. Assim preserva os
-- demais ajustes acumulados, inclusive a otimização de papéis de 14/08/2026.
do $migration$
declare
  v_definition text;
  v_before text;
begin
  select pg_get_functiondef(
    'public.get_cddi_monitoring_dashboard_internal(text)'::regprocedure
  ) into v_definition;

  if v_definition is null then
    raise exception 'A função interna do painel CDDI não foi localizada.';
  end if;

  -- 1. Submissão anulada ou cancelada não disputa o `distinct on` que escolhe a
  -- submissão mais recente. Rascunhos continuam visíveis no painel.
  v_before := v_definition;
  v_definition := regexp_replace(
    v_definition,
    $pattern$where s\.application_id = v_application_id[[:space:]]+order by coalesce\(s\.subject_person_id, s\.respondent_person_id\)$pattern$,
    $replacement$where s.application_id = v_application_id
      and upper(s.status) not in ('INVALIDATED', 'CANCELLED')
    order by coalesce(s.subject_person_id, s.respondent_person_id)$replacement$
  );
  if v_definition = v_before then
    raise exception 'Não foi possível filtrar submissões anuladas em latest_submissions.';
  end if;

  -- 2. Conclusão depende do estado, não da simples presença de `submitted_at`.
  v_before := v_definition;
  v_definition := regexp_replace(
    v_definition,
    $pattern$case when auto\.submitted_at is not null then true else false end as auto_completed,[[:space:]]+case when leader\.submitted_at is not null then true else false end as leader_completed$pattern$,
    $replacement$case when upper(coalesce(auto.status, '')) in ('SUBMITTED', 'VALIDATED') then true else false end as auto_completed,
      case when upper(coalesce(leader.status, '')) in ('SUBMITTED', 'VALIDATED') then true else false end as leader_completed$replacement$
  );
  if v_definition = v_before then
    raise exception 'Não foi possível corrigir os indicadores de conclusão do CDDI.';
  end if;

  -- 3. Resultado consolidado anulado não volta ao painel como nota válida.
  v_before := v_definition;
  v_definition := regexp_replace(
    v_definition,
    $pattern$where r\.application_id = v_application_id and r\.subject_person_id = sp\.person_id[[:space:]]+order by r\.calculated_at desc, r\.updated_at desc$pattern$,
    $replacement$where r.application_id = v_application_id and r.subject_person_id = sp.person_id
        and upper(r.status) <> 'INVALIDATED'
      order by r.calculated_at desc, r.updated_at desc$replacement$
  );
  if v_definition = v_before then
    raise exception 'Não foi possível excluir resultados finais anulados do painel CDDI.';
  end if;

  -- 4. Evento anulado não compõe a série temporal de adesão.
  v_before := v_definition;
  v_definition := regexp_replace(
    v_definition,
    $pattern$where s\.application_id = v_application_id[[:space:]]+and s\.submitted_at is not null[[:space:]]+\)$pattern$,
    $replacement$where s.application_id = v_application_id
      and s.submitted_at is not null
      and upper(s.status) not in ('INVALIDATED', 'CANCELLED')
  )$replacement$
  );
  if v_definition = v_before then
    raise exception 'Não foi possível excluir eventos anulados do painel CDDI.';
  end if;

  execute v_definition;
end;
$migration$;

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   -- Restaurar a definição de
--   -- 20260814170000_acelerar_painel_cddi.sql reintroduz o defeito.
-- commit;
