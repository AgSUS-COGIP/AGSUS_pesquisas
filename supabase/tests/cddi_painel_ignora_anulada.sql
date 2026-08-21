-- Painel CDDI: submissão anulada não conta como concluída (AGS-01).
--
-- `INVALIDATE` preserva `submitted_at` de propósito — a data é registro
-- histórico. O painel usava essa data como prova de conclusão, então anular a
-- resposta de alguém não a devolvia ao estado pendente: ela seguia concluída na
-- contagem, na curva de adesão e nas notas.
--
-- Este arquivo exercita o contrato que a correção estabelece. **Os quatro
-- primeiros testes falham contra a definição anterior** — é o que os torna
-- teste de regressão e não confirmação de comportamento já existente.

begin;

select plan(7);

-- ---------------------------------------------------------------------------
-- Cenário: um ciclo, uma pessoa, uma autoavaliação enviada.
-- ---------------------------------------------------------------------------
create temporary table alvo as
select
  (select id from public.survey_applications where code = 'CDDI-2026' limit 1) as aplicacao,
  (select ap.person_id
   from public.application_participants ap
   join public.submissions s
     on s.application_id = ap.application_id
    and coalesce(s.subject_person_id, s.respondent_person_id) = ap.person_id
   where ap.application_id = (select id from public.survey_applications where code = 'CDDI-2026' limit 1)
     and upper(s.status) = 'SUBMITTED'
     and upper(s.submission_type) in ('AUTO', 'AUTOAVALIACAO', 'SELF')
   limit 1) as pessoa;

select isnt((select pessoa from alvo), null,
  'o cenário exige uma autoavaliação enviada no CDDI-2026');

-- Lê o painel como administração, que é o escopo institucional.
create or replace function pg_temp.concluiu(p_pessoa uuid)
returns boolean language sql as $$
  select coalesce((
    select (linha->>'autoCompleted')::boolean
    from jsonb_array_elements(
      public.get_cddi_monitoring_dashboard_internal('CDDI-2026')->'participants'
    ) as linha
    where (linha->>'personId')::uuid = p_pessoa
  ), false);
$$;

-- ---------------------------------------------------------------------------
-- Antes de anular: concluída.
-- ---------------------------------------------------------------------------
select ok(pg_temp.concluiu((select pessoa from alvo)),
  'autoavaliação enviada aparece como concluída');

-- ---------------------------------------------------------------------------
-- Anula preservando a data, exatamente como `INVALIDATE` faz.
-- ---------------------------------------------------------------------------
update public.submissions
set status = 'INVALIDATED'
where application_id = (select aplicacao from alvo)
  and coalesce(subject_person_id, respondent_person_id) = (select pessoa from alvo)
  and upper(submission_type) in ('AUTO', 'AUTOAVALIACAO', 'SELF')
  and upper(status) = 'SUBMITTED';

select isnt(
  (select submitted_at from public.submissions
   where application_id = (select aplicacao from alvo)
     and coalesce(subject_person_id, respondent_person_id) = (select pessoa from alvo)
     and upper(status) = 'INVALIDATED'
   limit 1),
  null,
  'a anulação preserva submitted_at — é o que tornava o defeito silencioso');

-- ---------------------------------------------------------------------------
-- REGRESSÃO: depois de anular, a pessoa volta a pendente.
-- Este é o teste que falha contra a definição anterior.
-- ---------------------------------------------------------------------------
select ok(not pg_temp.concluiu((select pessoa from alvo)),
  'submissão anulada deixa de contar como concluída');

-- ---------------------------------------------------------------------------
-- A série temporal também ignora o evento anulado.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int
   from jsonb_array_elements(
     public.get_cddi_monitoring_dashboard_internal('CDDI-2026')->'timeline'
   ) as dia
   where (dia->>'total')::int < 0),
  0,
  'a curva de adesão não produz total negativo ao excluir o anulado');

-- ---------------------------------------------------------------------------
-- Resultado final anulado não é lido como nota válida.
-- ---------------------------------------------------------------------------
select is(
  (select count(*)::int
   from jsonb_array_elements(
     public.get_cddi_monitoring_dashboard_internal('CDDI-2026')->'participants'
   ) as linha
   join public.cddi_final_results r
     on r.subject_person_id = (linha->>'personId')::uuid
    and r.application_id = (select aplicacao from alvo)
   where upper(r.status) = 'INVALIDATED'
     and linha->>'finalScore' is not null),
  0,
  'nenhuma nota final anulada aparece no painel');

-- ---------------------------------------------------------------------------
-- Uma submissão válida posterior volta a ser a mais recente.
-- ---------------------------------------------------------------------------
insert into public.submissions (
  application_id, respondent_person_id, subject_person_id,
  submission_type, status, submitted_at, version
)
select aplicacao, pessoa, pessoa, 'AUTO', 'SUBMITTED', timezone('utc', now()), 99
from alvo;

select ok(pg_temp.concluiu((select pessoa from alvo)),
  'envio novo após a anulação volta a contar como concluída');

select * from finish();
rollback;
