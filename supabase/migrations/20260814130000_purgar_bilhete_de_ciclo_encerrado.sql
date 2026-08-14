begin;

-- Bilhete anônimo de rascunho abandonado precisa morrer no encerramento.
--
-- O furo
-- ------
-- `tb_bilhete_anonimo` liga pessoa e submissão **enquanto o rascunho existe**, e
-- `submit_my_survey_submission` o destrói no envio. Esse é o desenho, e ele está
-- certo para quem envia.
--
-- Quem **não** envia fica de fora dele. Se a pessoa começa uma pesquisa anônima e
-- abandona, o ciclo encerra e o bilhete permanece — ligando nome a respostas
-- parciais por tempo indeterminado, numa pesquisa que a plataforma chamou de
-- anônima. Nada purgava esse resíduo: a única exclusão de bilhete no banco estava
-- dentro do envio.
--
-- O efeito é pior do que parece. O rascunho abandonado tende a ser justamente o
-- de quem começou a responder, leu uma pergunta sensível e desistiu — e é o
-- vínculo dessa pessoa que sobrevivia.
--
-- A correção
-- ----------
-- Encerrado o ciclo, o bilhete é apagado. O rascunho continua gravado, agora sem
-- vínculo nenhum — a submissão anônima já nasce com `participant_id` e
-- `respondent_person_id` nulos, então cortar o bilhete a torna tão anônima quanto
-- as enviadas. Não apagamos resposta: destruir dado é decisão de outra ordem, e
-- aqui basta cortar a ligação.
--
-- Perder o bilhete impede a pessoa de retomar aquele rascunho, porque as
-- políticas de RLS o usam para reconhecê-la. Isso não custa nada: o ciclo está
-- encerrado e `application_accepts_responses()` já recusaria a gravação.
--
-- Por que aqui
-- ------------
-- `fc_abrir_ciclos_agendados()` já é o ponto de manutenção preguiçosa do estado
-- do ciclo, chamado por `get_survey_operations`, `list_my_survey_catalog` e
-- `get_public_survey_form`. O projeto não tem job agendado (sem `pg_cron`, sem
-- cron da Vercel), então pendurar a purga em qualquer outro lugar significaria
-- inventar um agendador só para isto. As duas tarefas respondem ao mesmo fato: o
-- relógio andou, materialize a consequência — abre o que venceu, corta o vínculo
-- do que encerrou.
--
-- A auditoria registra a purga **sem** dizer de quem era o bilhete. Gravar a
-- pessoa ali recriaria, no log, exatamente o vínculo que a purga existe para
-- destruir.

create or replace function public.fc_abrir_ciclos_agendados()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  with abertos as (
    update public.survey_applications sa
    set status = 'OPEN',
        updated_at = now()
    where sa.status = 'SCHEDULED'
      and sa.opens_at is not null
      and sa.opens_at <= now()
      and sa.closes_at is not null
      and sa.closes_at > now()
      and exists (
        select 1
        from public.survey_versions sv
        where sv.id = sa.survey_version_id
          and sv.status = 'PUBLISHED'
      )
    returning sa.id, sa.code, sa.survey_version_id, sa.opens_at, sa.closes_at
  )
  insert into public.audit_events(
    actor_person_id, event_type, entity_type, entity_id, application_id,
    before_data, after_data, metadata
  )
  select
    null,
    'SURVEY_CYCLE_AUTO_OPEN',
    'SURVEY_APPLICATION',
    abertos.id::text,
    abertos.id,
    jsonb_build_object('applicationStatus', 'SCHEDULED'),
    jsonb_build_object('applicationStatus', 'OPEN'),
    jsonb_build_object(
      'applicationCode', abertos.code,
      'versionId', abertos.survey_version_id,
      'opensAt', abertos.opens_at,
      'closesAt', abertos.closes_at,
      'reason', 'opens_at_reached'
    )
  from abertos;

  -- Ciclo encerrado — por ação administrativa ou porque a data passou — não tem
  -- mais rascunho a retomar. O que resta do bilhete é só o vínculo.
  with purgados as (
    delete from public.tb_bilhete_anonimo b
    using public.survey_applications sa
    where sa.id = b.sq_aplicacao
      and (
        sa.status in ('CLOSED', 'CANCELLED')
        or (sa.closes_at is not null and sa.closes_at <= now())
      )
    returning b.sq_aplicacao
  ), totais as (
    select sq_aplicacao, count(*)::integer as quantidade
    from purgados
    group by sq_aplicacao
  )
  insert into public.audit_events(
    actor_person_id, event_type, entity_type, entity_id, application_id,
    before_data, after_data, metadata
  )
  select
    null,
    'ANONYMOUS_TICKET_PURGED',
    'SURVEY_APPLICATION',
    totais.sq_aplicacao::text,
    totais.sq_aplicacao,
    '{}'::jsonb,
    '{}'::jsonb,
    -- Só a contagem. Registrar a pessoa aqui desfaria a purga no próprio log.
    jsonb_build_object('ticketsPurged', totais.quantidade, 'reason', 'cycle_closed')
  from totais;
end;
$$;

comment on function public.fc_abrir_ciclos_agendados() is
  'Manutenção preguiçosa do estado do ciclo: abre o agendado cuja abertura venceu e apaga o bilhete anônimo de ciclo encerrado, cortando o vínculo de rascunho abandonado.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   -- Restaurar a definição de 20260814100000, apenas com a abertura. Nesse caso
--   -- o bilhete de rascunho abandonado volta a sobreviver ao encerramento, e o
--   -- vínculo entre pessoa e resposta parcial permanece.
-- commit;
