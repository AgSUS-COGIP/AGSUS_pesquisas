begin;

-- Correção de dado: resultados consolidados sem nenhuma submissão de origem.
--
-- O que existe
-- -----------
-- Em 14/08/2026 o painel do CDDI exibia "4,27 média final · 2 resultados
-- consolidados" num ciclo com zero submissões enviadas. Eram quatro linhas de
-- `cddi_final_results` criadas em 06 e 07/08, duas `CALCULATED` com nota e duas
-- `PARTIAL`, todas com `auto_submission_id` **e** `leader_submission_id` nulos.
--
-- Elas vieram de testes cujas submissões foram apagadas depois: até
-- `20260814150000`, remover a resposta anulava os vínculos e deixava a linha do
-- resultado intacta, com a nota. Aquela migration fecha a porta daqui para
-- frente; não alcança o que já passou por ela, porque as submissões que diriam
-- quais linhas corrigir não existem mais.
--
-- O critério
-- ----------
-- Uma linha que afirma cálculo — `PARTIAL`, `CALCULATED` ou `PUBLISHED` — e não
-- aponta para submissão nenhuma é incoerente por construção: não há de onde a
-- nota ter saído. São essas, e só essas.
--
-- `PENDING` fica de fora de propósito: nascer sem vínculo é o estado normal de
-- quem ainda não teve nada calculado. Invalidar ali seria confundir "ainda não
-- aconteceu" com "aconteceu errado".
--
-- Por que invalidar em vez de apagar
-- ----------------------------------
-- Mesma razão de `20260814150000`: a linha é registro de que houve um cálculo.
-- Apagá-la esconderia do próximo operador que ali existiu uma nota — e é
-- justamente esse histórico que explica por que o painel mostrava o que
-- mostrava. O que sai é o número.
--
-- Idempotente: rodar de novo não encontra mais nada, porque `INVALIDATED` não
-- está na lista de status afetados.

with orfaos as (
  select id, application_id, status, final_score
  from public.cddi_final_results
  where status in ('PARTIAL', 'CALCULATED', 'PUBLISHED')
    and auto_submission_id is null
    and leader_submission_id is null
), corrigidos as (
  update public.cddi_final_results fr
  set status = 'INVALIDATED',
      auto_score = null,
      leader_score = null,
      final_score = null,
      published_at = null,
      updated_at = now(),
      metadata = coalesce(fr.metadata, '{}'::jsonb) || jsonb_build_object(
        'invalidatedAt', now(),
        'invalidationReason', 'Resultado sem submissão de origem: as submissões que o geraram foram removidas antes de 20260814150000.',
        'invalidationSource', 'ORPHAN_CLEANUP',
        'previousStatus', orfaos.status,
        'previousFinalScore', orfaos.final_score
      )
  from orfaos
  where fr.id = orfaos.id
  returning fr.id, fr.application_id, orfaos.status as status_anterior, orfaos.final_score as nota_anterior
)
insert into public.audit_events (
  actor_person_id, event_type, entity_type, entity_id, application_id,
  before_data, after_data, metadata
)
select
  -- Sem ator: a correção é da plataforma, não de uma pessoa. Atribuir a alguém
  -- seria inventar responsável para um ato que ninguém praticou.
  null,
  'CDDI_RESULT_INVALIDATED',
  'CDDI_FINAL_RESULT',
  corrigidos.id::text,
  corrigidos.application_id,
  jsonb_build_object('status', corrigidos.status_anterior, 'finalScore', corrigidos.nota_anterior),
  jsonb_build_object('status', 'INVALIDATED', 'finalScore', null),
  jsonb_build_object('reason', 'orphan_cleanup', 'migration', '20260814160000')
from corrigidos;

commit;

-- Rollback:
-- begin;
--   -- Não há volta útil: o estado anterior afirmava uma nota sem origem. Se for
--   -- necessário auditar o que havia, os valores estão em
--   -- cddi_final_results.metadata (previousStatus, previousFinalScore) e em
--   -- audit_events, evento CDDI_RESULT_INVALIDATED.
-- commit;
