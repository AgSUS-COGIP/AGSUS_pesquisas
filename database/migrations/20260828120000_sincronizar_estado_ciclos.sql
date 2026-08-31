-- Encerramento automático de ciclos vencidos.
--
-- O problema: `fc_abrir_ciclos_agendados()` fazia só a metade temporal da
-- transição — `SCHEDULED -> OPEN` quando a abertura chegava — e nunca a
-- inversa. Como `application_accepts_responses(...)` já barra resposta depois
-- de `closes_at`, o ciclo passava a existir num estado que não deveria existir:
--
--   status     = OPEN     (o banco diz que está aberto)
--   canRespond = false    (o banco recusa resposta)
--
-- Foi o que aconteceu com TESTE-TRIBAL-1 / one_piece: prazo em 27/08, ainda
-- listado como pendente em 28/08. `get_survey_operations(...)` já reconhecia a
-- situação e devolvia o aviso OPEN_PERIOD_EXPIRED, tratando o encerramento como
-- tarefa administrativa manual. A regra de produto passou a ser outra: ao
-- atingir `closes_at`, o ciclo é encerrado sozinho.
--
-- Um `SCHEDULED` cuja janela inteira passou sem ninguém abrir também precisa
-- fechar — senão fica agendado para um prazo que já venceu.
--
-- Desenho: a função nova concentra a sincronização temporal e
-- `fc_abrir_ciclos_agendados()` vira ponte para ela. O nome antigo é chamado por
-- cinco funções vivas (`list_my_survey_catalog`, `get_survey_operations`,
-- `fc_obter_formulario_publico`, `get_public_survey_form`,
-- `fc_reivindicar_emails`); mantê-lo como wrapper preserva esses contratos e
-- estende a cobertura do fechamento a todos eles sem tocar em nenhum.
--
-- O que NÃO muda:
--   * `closes_at` é preservado — o prazo institucional é registro histórico e
--     não pode virar `now()` só porque a rotina passou por ali;
--   * `surveys.dt_arquivamento` não é tocado — CLOSED não é arquivado;
--   * submissões, respostas, participantes e auditoria não são apagados.

create or replace function sigav.fc_sincronizar_estado_ciclos()
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'sigav', 'auth'
as $function$
begin
  -- 1. Fechar o que venceu.
  --
  -- Vem antes da abertura de propósito: um SCHEDULED cuja janela inteira já
  -- passou fecha aqui e some do passo seguinte, gerando uma transição só e um
  -- evento só. Fosse o contrário, ele seria aberto para fechar em seguida.
  --
  -- `for update skip locked` é o que sustenta a idempotência sob concorrência.
  -- A sincronização é preguiçosa: cinco funções a disparam, e duas requisições
  -- simultâneas veriam a mesma linha vencida. Sem o lock, ambas gravariam
  -- SURVEY_CYCLE_AUTO_CLOSE para a mesma transição. Com ele, quem chega depois
  -- pula a linha que já está sendo tratada — o fechamento acontece uma vez.
  with alvos as (
    select sa.id, sa.code, sa.status as status_anterior, sa.opens_at, sa.closes_at
    from sigav.survey_applications sa
    where sa.closes_at is not null
      and sa.closes_at <= now()
      and sa.status in ('OPEN', 'SCHEDULED')
    for update skip locked
  ), fechados as (
    update sigav.survey_applications sa
    set status = 'CLOSED',
        updated_at = now()
    from alvos
    where sa.id = alvos.id
    returning sa.id, sa.code, alvos.status_anterior, sa.opens_at, sa.closes_at
  )
  insert into sigav.audit_events(
    actor_person_id, event_type, entity_type, entity_id, application_id,
    before_data, after_data, metadata
  )
  select
    -- Não houve ator humano. Registrar um seria inventar responsável.
    null,
    'SURVEY_CYCLE_AUTO_CLOSE',
    'SURVEY_APPLICATION',
    fechados.id::text,
    fechados.id,
    jsonb_build_object('applicationStatus', fechados.status_anterior),
    jsonb_build_object('applicationStatus', 'CLOSED'),
    jsonb_build_object(
      'applicationCode', fechados.code,
      'opensAt', fechados.opens_at,
      'closesAt', fechados.closes_at,
      'reason', 'closes_at_reached'
    )
  from fechados;

  -- 2. Abrir o que chegou a hora. Lógica preservada de
  -- `fc_abrir_ciclos_agendados()` sem alteração de comportamento.
  with abertos as (
    update sigav.survey_applications sa
    set status = 'OPEN',
        updated_at = now()
    where sa.status = 'SCHEDULED'
      and sa.opens_at is not null
      and sa.opens_at <= now()
      and sa.closes_at is not null
      and sa.closes_at > now()
      and exists (
        select 1
        from sigav.survey_versions sv
        where sv.id = sa.survey_version_id
          and sv.status = 'PUBLISHED'
      )
    returning sa.id, sa.code, sa.survey_version_id, sa.opens_at, sa.closes_at
  )
  insert into sigav.audit_events(
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

  -- 3. Purga de bilhetes anônimos. Preservada como estava.
  --
  -- Ciclo encerrado — por ação administrativa ou porque a data passou — não tem
  -- mais rascunho a retomar. O que resta do bilhete é só o vínculo.
  with purgados as (
    delete from sigav.tb_bilhete_anonimo b
    using sigav.survey_applications sa
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
  insert into sigav.audit_events(
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
$function$;

revoke all on function sigav.fc_sincronizar_estado_ciclos() from public, anon, authenticated;

comment on function sigav.fc_sincronizar_estado_ciclos() is
  'Sincroniza o estado temporal dos ciclos: fecha OPEN/SCHEDULED vencidos, abre SCHEDULED cuja janela começou e purga bilhetes anônimos de ciclo encerrado. Preserva closes_at e registra auditoria sem ator humano. Idempotente.';

-- A ponte. Assinatura, privilégios e chamadores permanecem exatamente como
-- estavam; só o corpo delega. Nenhum dos cinco chamadores vivos precisa mudar,
-- e todos passam a receber o fechamento automático junto com a abertura.
create or replace function sigav.fc_abrir_ciclos_agendados()
returns void
language plpgsql
security definer
set search_path to 'pg_catalog', 'sigav', 'auth'
as $function$
begin
  perform sigav.fc_sincronizar_estado_ciclos();
end;
$function$;

revoke all on function sigav.fc_abrir_ciclos_agendados() from public, anon, authenticated;

comment on function sigav.fc_abrir_ciclos_agendados() is
  'Ponte histórica para sigav.fc_sincronizar_estado_ciclos(). Mantida porque é chamada por list_my_survey_catalog, get_survey_operations, fc_obter_formulario_publico, get_public_survey_form e fc_reivindicar_emails. O nome fala só de abertura; o comportamento hoje é a sincronização completa.';
