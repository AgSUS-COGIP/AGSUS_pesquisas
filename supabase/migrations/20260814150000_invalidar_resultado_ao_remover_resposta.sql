begin;

-- Remover a resposta precisa derrubar o resultado calculado a partir dela.
--
-- O que estava errado
-- -------------------
-- `fc_remover_resposta_pessoa` cuidava da submissão e esquecia do que fora
-- derivado dela:
--
--   · **DELETE** apagava `cddi_competency_results`, anulava os vínculos em
--     `cddi_final_results` — obrigatório, porque a chave é `on delete restrict`
--     — e deixava **a linha do resultado de pé**, com `final_score` e status
--     `CALCULATED`;
--   · **INVALIDATE** não tocava em `cddi_final_results`. A submissão ficava
--     `INVALIDATED` e a nota consolidada seguia se apresentando como válida.
--
-- Nos dois casos a nota individual de uma pessoa sobrevivia ao desaparecimento
-- da evidência que a produziu. É o pior tipo de resíduo num instrumento de
-- avaliação de desempenho: um número atribuído a alguém, sem nada por trás, e
-- que continua sendo lido como se tivesse.
--
-- Isto não é hipótese. Em 14/08/2026 o painel do CDDI exibia "4,27 média final ·
-- 2 resultados consolidados" num ciclo com **zero** submissões: resíduo de
-- testes de 06 e 07/08 cujas submissões foram apagadas depois. O painel estava
-- certo; o dado é que não podia existir.
--
-- A correção
-- ----------
-- Nos dois modos, todo resultado consolidado que aponte para a submissão passa a
-- `INVALIDATED`, com as três notas zeradas e o motivo no `metadata`. A linha
-- permanece — ela é histórico de que houve um cálculo, e apagá-la esconderia do
-- próximo operador que ali existiu uma nota.
--
-- A ordem importa no `DELETE`: os resultados são marcados **antes** de os
-- vínculos serem anulados. Depois disso não há mais como saber quais eram.
--
-- `cddi_competency_results` continua sendo apagada no `DELETE` e agora também no
-- `INVALIDATE`: ela é o detalhe por competência daquela submissão, não tem
-- estado próprio e, sem a submissão valendo, não representa mais nada.

-- Os defaults são os da definição original. Removê-los faria o PostgreSQL
-- recusar o `create or replace` — e, pior, mudaria o contrato de quem já chama.
create or replace function public.fc_remover_resposta_pessoa(
  p_submissao uuid,
  p_modo text default 'INVALIDATE',
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_pessoa uuid;
  v_submissao public.submissions%rowtype;
  v_modo text;
  v_motivo text;
  v_respostas integer;
  v_retrato jsonb;
  v_resultados uuid[];
begin
  if not public.is_platform_administrator() then
    raise exception 'Apenas o Superadmin pode anular ou apagar a resposta de outra pessoa.';
  end if;

  v_pessoa := public.current_person_id();
  v_modo := upper(btrim(coalesce(p_modo, '')));
  v_motivo := btrim(coalesce(p_motivo, ''));

  if v_modo not in ('INVALIDATE', 'DELETE') then
    raise exception 'Modo inválido. Use INVALIDATE para anular ou DELETE para apagar.';
  end if;

  if length(v_motivo) < 10 then
    raise exception 'Descreva o motivo da operação com pelo menos 10 caracteres.';
  end if;

  select * into v_submissao from public.submissions where id = p_submissao;
  if v_submissao.id is null then
    raise exception 'Resposta não localizada.';
  end if;

  select count(*)::integer into v_respostas from public.answers where submission_id = p_submissao;

  -- Quais resultados consolidados dependem desta submissão. Levantado agora
  -- porque o `DELETE` anula os vínculos logo adiante, e depois disso a
  -- informação some.
  select coalesce(array_agg(id), '{}')
  into v_resultados
  from public.cddi_final_results
  where auto_submission_id = p_submissao or leader_submission_id = p_submissao;

  -- Retrato do que existia, gravado na auditoria antes de qualquer alteração.
  select jsonb_build_object(
    'submissionId', v_submissao.id,
    'status', v_submissao.status,
    'submissionType', v_submissao.submission_type,
    'submittedAt', v_submissao.submitted_at,
    'answers', v_respostas,
    'consolidatedResults', coalesce(array_length(v_resultados, 1), 0),
    'respondent', jsonb_build_object(
      'personId', pessoa.id, 'employeeNumber', pessoa.employee_number, 'fullName', pessoa.full_name
    ),
    'application', jsonb_build_object('id', aplicacao.id, 'code', aplicacao.code, 'name', aplicacao.name)
  )
  into v_retrato
  from public.survey_applications as aplicacao
  left join public.people as pessoa on pessoa.id = v_submissao.respondent_person_id
  where aplicacao.id = v_submissao.application_id;

  insert into public.audit_events (
    actor_person_id, event_type, entity_type, entity_id, application_id, before_data, metadata
  ) values (
    v_pessoa,
    case when v_modo = 'DELETE' then 'SUBMISSION_DELETED' else 'SUBMISSION_INVALIDATED' end,
    'SUBMISSION', v_submissao.id::text, v_submissao.application_id, v_retrato,
    jsonb_build_object('reason', v_motivo, 'mode', v_modo)
  );

  -- Vale para os dois modos: o cálculo derivado não sobrevive à resposta que o
  -- originou. A linha fica, como registro de que houve um cálculo; o número sai.
  if array_length(v_resultados, 1) > 0 then
    update public.cddi_final_results
    set status = 'INVALIDATED',
        auto_score = null,
        leader_score = null,
        final_score = null,
        published_at = null,
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'invalidatedBy', v_pessoa,
          'invalidatedAt', now(),
          'invalidationReason', v_motivo,
          'invalidationSource', 'SUBMISSION_' || v_modo
        )
    where id = any(v_resultados);
  end if;

  -- Detalhe por competência daquela submissão: sem estado próprio, some nos dois
  -- modos.
  delete from public.cddi_competency_results where submission_id = p_submissao;

  if v_modo = 'INVALIDATE' then
    -- As respostas continuam gravadas; o que muda é o estado da submissão, e é
    -- ele que os painéis e o cálculo leem.
    update public.submissions
    set status = 'INVALIDATED',
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'invalidatedBy', v_pessoa, 'invalidatedAt', now(), 'invalidationReason', v_motivo
        )
    where id = p_submissao;
  else
    -- De baixo para cima, como toda remoção neste banco. Os vínculos só são
    -- anulados aqui, depois de os resultados já terem sido marcados.
    update public.cddi_final_results set auto_submission_id = null where auto_submission_id = p_submissao;
    update public.cddi_final_results set leader_submission_id = null where leader_submission_id = p_submissao;
    delete from public.answer_options where answer_id in (
      select id from public.answers where submission_id = p_submissao
    );
    delete from public.answers where submission_id = p_submissao;
    delete from public.submissions where id = p_submissao;
  end if;

  -- A pessoa volta a constar como pendente no ciclo: sem isso, o painel
  -- continuaria contando como concluída uma resposta que não existe mais.
  update public.application_participants
  set status = 'ELIGIBLE', completed_at = null, updated_at = now()
  where application_id = v_submissao.application_id
    and person_id = v_submissao.respondent_person_id
    and status = 'COMPLETED';

  return jsonb_build_object(
    'status', 'OK',
    'mode', v_modo,
    'submissionId', p_submissao,
    'answers', v_respostas,
    'invalidatedResults', coalesce(array_length(v_resultados, 1), 0)
  );
end;
$$;

revoke all on function public.fc_remover_resposta_pessoa(uuid, text, text) from public, anon;
grant execute on function public.fc_remover_resposta_pessoa(uuid, text, text) to authenticated;

comment on function public.fc_remover_resposta_pessoa(uuid, text, text) is
  'Anula ou apaga a resposta de uma pessoa, exigindo motivo e auditando. Nos dois modos invalida o resultado consolidado derivado daquela submissão.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   -- Restaurar a definição de 20260813180000 faz a nota consolidada voltar a
--   -- sobreviver à remoção da resposta que a originou.
-- commit;
