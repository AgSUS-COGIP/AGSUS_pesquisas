begin;

-- Correção de `fc_excluir_pesquisa_rascunho`: a versão anterior falhava sempre,
-- com "Versão da pesquisa não encontrada.", em qualquer avaliação que tivesse
-- pergunta ou alternativa cadastrada.
--
-- Causa. A função apagava só `survey_versions` e confiava no cascade para levar
-- seções, perguntas e alternativas. Mas as três tabelas estruturais têm o
-- trigger `enforce_draft_survey_structure` (`before insert or update or delete`,
-- de 20260804195030), que resolve a versão da linha afetada e exige que ela
-- exista e esteja em DRAFT:
--
--   if (select count(*) from public.survey_versions
--       where id = any(v_version_ids)) <> v_expected
--   then raise exception 'Versão da pesquisa não encontrada.';
--
-- No PostgreSQL o `on delete cascade` remove a linha-pai **antes** das filhas.
-- Quando o trigger de cada seção/pergunta/alternativa consultava a versão, ela
-- já não existia: `count(*)` devolvia 0, o `<> v_expected` batia e a transação
-- inteira era abortada. O trigger é `security definer` e não pode ser desligado
-- por sessão, então o cascade simplesmente não é um caminho viável aqui.
--
-- Correção. Apagar a estrutura explicitamente, de baixo para cima e **enquanto a
-- versão ainda existe** — alternativas, perguntas, seções, e só então ciclo,
-- versão e pesquisa. Cada `delete` roda com a versão presente e em DRAFT, que é
-- exatamente o estado que o trigger exige para liberar a operação.
--
-- A ordem não é estilo, é requisito: qualquer inversão traz o erro de volta.

create or replace function public.fc_excluir_pesquisa_rascunho(p_pesquisa uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor uuid := public.current_person_id();
  v_survey public.surveys%rowtype;
  v_publicadas integer;
  v_submissoes integer;
  v_aplicacoes jsonb;
  v_versoes uuid[];
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração.';
  end if;

  select * into v_survey
  from public.surveys
  where id = p_pesquisa
  for update;
  if v_survey.id is null then
    raise exception 'Avaliação não encontrada.';
  end if;

  -- Publicada uma única vez, a avaliação deixa de ser descartável: a estrutura
  -- vira referência histórica de quem respondeu, mesmo que o ciclo esteja
  -- encerrado ou cancelado. O trigger estrutural também barraria o delete.
  select count(*)::integer into v_publicadas
  from public.survey_versions
  where survey_id = p_pesquisa
    and status <> 'DRAFT';
  if v_publicadas > 0 then
    raise exception 'Esta avaliação já foi publicada e não pode ser excluída. Cancele o ciclo para encerrá-la.';
  end if;

  select count(*)::integer into v_submissoes
  from public.submissions s
  join public.survey_applications a on a.id = s.application_id
  join public.survey_versions v on v.id = a.survey_version_id
  where v.survey_id = p_pesquisa;
  if v_submissoes > 0 then
    raise exception 'Esta avaliação já possui respostas registradas e não pode ser excluída.';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_versoes
  from public.survey_versions
  where survey_id = p_pesquisa;

  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'code', a.code, 'status', a.status)), '[]'::jsonb)
  into v_aplicacoes
  from public.survey_applications a
  where a.survey_version_id = any(v_versoes);

  -- Auditoria antes do delete e com `application_id` nulo: a coluna referencia
  -- survey_applications com `on delete set null`, e o identificador do ciclo
  -- fica preservado em `metadata`, que é jsonb e não tem chave estrangeira.
  insert into public.audit_events(
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor,
    'SURVEY_DELETED',
    'SURVEY',
    v_survey.id::text,
    null,
    jsonb_build_object(
      'code', v_survey.code,
      'name', v_survey.name,
      'status', v_survey.status,
      'applications', v_aplicacoes
    ),
    null,
    jsonb_build_object('surveyId', v_survey.id, 'applications', v_aplicacoes)
  );

  -- Estrutura de baixo para cima, com a versão ainda existente e em DRAFT —
  -- é o que satisfaz enforce_draft_survey_structure em cada linha removida.
  delete from public.question_options
  where question_id in (
    select id from public.survey_questions where survey_version_id = any(v_versoes)
  );

  delete from public.survey_questions
  where survey_version_id = any(v_versoes);

  delete from public.survey_sections
  where survey_version_id = any(v_versoes);

  -- application_participants e os vínculos do CDDI caem por cascade a partir do
  -- ciclo; submissions referencia com `restrict`, e a checagem acima é a
  -- garantia de que não há nenhuma para destruir.
  delete from public.survey_applications
  where survey_version_id = any(v_versoes);

  delete from public.survey_versions where survey_id = p_pesquisa;
  delete from public.surveys where id = p_pesquisa;

  return jsonb_build_object(
    'status', 'OK',
    'code', v_survey.code,
    'name', v_survey.name
  );
end;
$$;

revoke all on function public.fc_excluir_pesquisa_rascunho(uuid) from public, anon;
grant execute on function public.fc_excluir_pesquisa_rascunho(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   -- Reaplicar a definição de 20260811120000_periodo_futuro_e_exclusao_rascunho.sql.
--   -- Atenção: aquela versão falha com "Versão da pesquisa não encontrada."
--   -- em avaliação que tenha seção, pergunta ou alternativa.
--   notify pgrst, 'reload schema';
-- commit;
