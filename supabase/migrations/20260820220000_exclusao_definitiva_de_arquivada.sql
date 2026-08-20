begin;

-- A exclusão definitiva é exclusiva de avaliações já arquivadas. Como ela é
-- uma ação administrativa confirmada, pode remover uma versão publicada e as
-- respostas associadas. O gatilho estrutural normalmente protege versões
-- publicadas contra alterações; a exceção abaixo só existe durante esta RPC e
-- exige que a pesquisa continue arquivada.
create or replace function public.enforce_draft_survey_structure()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_version_ids uuid[];
  v_expected integer;
begin
  if tg_table_name = 'survey_sections' then
    select array_agg(distinct version_id order by version_id)
    into v_version_ids
    from (
      select old.survey_version_id as version_id where tg_op in ('UPDATE', 'DELETE')
      union all
      select new.survey_version_id where tg_op in ('INSERT', 'UPDATE')
    ) versions;
  elsif tg_table_name = 'survey_questions' then
    select array_agg(distinct version_id order by version_id)
    into v_version_ids
    from (
      select old.survey_version_id as version_id where tg_op in ('UPDATE', 'DELETE')
      union all
      select new.survey_version_id where tg_op in ('INSERT', 'UPDATE')
    ) versions;
  elsif tg_table_name = 'question_options' then
    select array_agg(distinct question.survey_version_id order by question.survey_version_id)
    into v_version_ids
    from public.survey_questions question
    where question.id in (
      select old.question_id where tg_op in ('UPDATE', 'DELETE')
      union
      select new.question_id where tg_op in ('INSERT', 'UPDATE')
    );
    if v_version_ids is null and tg_op = 'DELETE' then return old; end if;
  else
    raise exception 'Tabela estrutural não suportada: %.', tg_table_name;
  end if;

  if v_version_ids is null or cardinality(v_version_ids) = 0 then
    raise exception 'Não foi possível identificar a versão da pesquisa.';
  end if;
  v_expected := cardinality(v_version_ids);

  perform version.id from public.survey_versions version
  where version.id = any(v_version_ids) order by version.id for update;

  if (select count(*) from public.survey_versions version where version.id = any(v_version_ids)) <> v_expected then
    raise exception 'Versão da pesquisa não encontrada.';
  end if;

  if tg_op = 'DELETE'
    and current_setting('app.exclusao_arquivada', true) = 'on'
    and not exists (
      select 1
      from public.survey_versions version
      join public.surveys survey on survey.id = version.survey_id
      where version.id = any(v_version_ids)
        and survey.dt_arquivamento is null
    ) then
    return old;
  end if;

  if exists (
    select 1 from public.survey_versions version
    where version.id = any(v_version_ids) and version.status <> 'DRAFT'
  ) then
    raise exception 'Versões publicadas não podem ser alteradas. Crie uma nova versão em rascunho.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create or replace function public.fc_excluir_pesquisa_arquivada(p_pesquisa uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor uuid := public.current_person_id();
  v_survey public.surveys%rowtype;
  v_versoes uuid[];
  v_aplicacoes uuid[];
  v_aplicacoes_auditoria jsonb;
  v_submissoes integer;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração.';
  end if;

  select * into v_survey from public.surveys where id = p_pesquisa for update;
  if v_survey.id is null then raise exception 'Avaliação não encontrada.'; end if;
  if v_survey.dt_arquivamento is null then
    raise exception 'Apenas avaliações arquivadas podem ser apagadas definitivamente.';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_versoes
  from public.survey_versions where survey_id = p_pesquisa;
  select coalesce(array_agg(id), '{}'::uuid[]) into v_aplicacoes
  from public.survey_applications where survey_version_id = any(v_versoes);
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'code', code, 'status', status)), '[]'::jsonb)
  into v_aplicacoes_auditoria
  from public.survey_applications where id = any(v_aplicacoes);
  select count(*)::integer into v_submissoes
  from public.submissions where application_id = any(v_aplicacoes);

  insert into public.audit_events(
    actor_person_id, event_type, entity_type, entity_id, application_id,
    before_data, after_data, metadata
  ) values (
    v_actor, 'SURVEY_ARCHIVED_DELETED', 'SURVEY', v_survey.id::text, null,
    jsonb_build_object('code', v_survey.code, 'name', v_survey.name, 'applications', v_aplicacoes_auditoria),
    null,
    jsonb_build_object('surveyId', v_survey.id, 'applications', v_aplicacoes_auditoria, 'submissionsDeleted', v_submissoes)
  );

  -- Resultado final aponta para submissões com RESTRICT; remove-o antes das
  -- submissões. As demais dependências de submissão e de aplicação usam cascade.
  delete from public.cddi_final_results where application_id = any(v_aplicacoes);
  delete from public.submissions where application_id = any(v_aplicacoes);
  delete from public.tb_regra_condicional where sq_versao_pesquisa = any(v_versoes);

  perform set_config('app.exclusao_arquivada', 'on', true);
  delete from public.question_options
  where question_id in (select id from public.survey_questions where survey_version_id = any(v_versoes));
  delete from public.survey_questions where survey_version_id = any(v_versoes);

  -- Sempre remove folhas antes das seções-pai: isso impede o cascade da FK
  -- recursiva de acionar o gatilho estrutural num estado intermediário.
  loop
    delete from public.survey_sections filha
    where filha.survey_version_id = any(v_versoes)
      and not exists (
        select 1 from public.survey_sections neta where neta.parent_section_id = filha.id
      );
    exit when not found;
  end loop;

  delete from public.survey_applications where id = any(v_aplicacoes);
  delete from public.survey_versions where survey_id = p_pesquisa;
  delete from public.surveys where id = p_pesquisa;

  return jsonb_build_object('status', 'OK', 'code', v_survey.code, 'name', v_survey.name);
end;
$$;

revoke all on function public.fc_excluir_pesquisa_arquivada(uuid) from public, anon;
grant execute on function public.fc_excluir_pesquisa_arquivada(uuid) to authenticated;

-- Arquivar sempre encerra o ciclo. A ação CANCEL já o fazia explicitamente;
-- este gatilho cobre a ação ARCHIVE e qualquer arquivamento administrativo
-- equivalente, para não deixar uma avaliação fora do catálogo com ciclo ativo.
create or replace function public.fc_cancela_ciclos_arq()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  if old.dt_arquivamento is null and new.dt_arquivamento is not null then
    update public.survey_applications application
    set status = 'CANCELLED', updated_at = now()
    from public.survey_versions version
    where version.id = application.survey_version_id
      and version.survey_id = new.id
      and application.status <> 'CANCELLED';
  end if;
  return new;
end;
$$;

drop trigger if exists cancelar_ciclos_ao_arquivar_pesquisa on public.surveys;
drop trigger if exists tau_cancela_ciclos_arq on public.surveys;
drop function if exists public.fc_cancelar_ciclos_ao_arquivar_pesquisa();
create trigger tau_cancela_ciclos_arq
  after update of dt_arquivamento on public.surveys
  for each row execute function public.fc_cancela_ciclos_arq();

revoke all on function public.fc_cancela_ciclos_arq() from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;
