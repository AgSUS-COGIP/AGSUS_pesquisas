begin;

-- Correção de `fc_excluir_pesquisa_rascunho`: a versão de 20260811143000 ainda
-- falha com "Versão da pesquisa não encontrada." em avaliação cujas seções
-- tenham aninhamento (seção com `parent_section_id` preenchido).
--
-- Causa. `survey_sections` tem uma chave estrangeira para si mesma —
-- `survey_sections_parent_same_version_fk (parent_section_id, survey_version_id)`
-- declarada `on delete cascade` em 20260730200000. O `delete from
-- survey_sections where survey_version_id = any(...)` alcança pais e filhas na
-- mesma varredura; quando o pai sai primeiro, o PostgreSQL dispara o cascade
-- para as filhas, e esse cascade executa `enforce_draft_survey_structure`
-- novamente sobre uma linha cuja versão ainda existe — mas dentro de um
-- contexto em que a linha-pai já foi removida. O trigger é `before delete`,
-- `security definer`, e não há como suprimi-lo por sessão.
--
-- É a mesma armadilha que 20260811143000 documentou para `survey_versions`,
-- só que uma camada abaixo e dentro da própria tabela: **enquanto houver
-- trigger estrutural, nenhum cascade é caminho viável — nem o cascade que a
-- tabela faz para ela mesma.**
--
-- Correção. Apagar as seções da folha para a raiz, explicitamente, usando a
-- profundidade do aninhamento. Cada `delete` remove só linhas que já não têm
-- filhas, então o cascade nunca chega a disparar e cada linha é avaliada pelo
-- trigger com a versão presente e em DRAFT — o estado que ele exige.
--
-- O restante da ordem (alternativas → perguntas → seções → ciclo → versão →
-- pesquisa) permanece de 20260811143000 e continua sendo requisito.

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

  -- Seções da folha para a raiz. `delete` sem filhas restantes nunca aciona o
  -- cascade de survey_sections_parent_same_version_fk, então o trigger avalia
  -- cada linha com a versão presente. Um `delete` direto pela versão removeria
  -- o pai antes da filha e traria de volta "Versão da pesquisa não encontrada.".
  loop
    delete from public.survey_sections filha
    where filha.survey_version_id = any(v_versoes)
      and not exists (
        select 1
        from public.survey_sections neta
        where neta.parent_section_id = filha.id
      );
    exit when not found;
  end loop;

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
--   -- Reaplicar a definição de 20260811143000_corrigir_exclusao_pesquisa_rascunho.sql.
--   -- Atenção: aquela versão falha com "Versão da pesquisa não encontrada."
--   -- em avaliação com seções aninhadas.
--   notify pgrst, 'reload schema';
-- commit;
