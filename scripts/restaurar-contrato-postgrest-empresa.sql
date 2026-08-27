-- ============================================================================
-- SUPERSEDIDO — não rode este arquivo.
-- ============================================================================
-- A credencial de conexão (usr_sip_app) não tem CREATEROLE nesta instância, e
-- pedir essa elevação num banco compartilhado com outras aplicações (sip,
-- sigepsi) não é o caminho escolhido. A arquitetura mudou para: uma única
-- credencial de conexão, sem roles anon/authenticated/service_role no
-- Postgres, com a distinção de quem pode chamar qual RPC decidida em nível de
-- aplicação (ver src/lib/db/rpc-permissions.ts, gerado a partir do mesmo
-- levantamento histórico que produziu este arquivo).
--
-- Consequência: as seções 1, 3, 4, 5 e 7 abaixo referenciam roles que nunca
-- vão existir neste cluster e vão FALHAR se executadas. Só sobrevivem:
--   - Seção 2 (pgcrypto) — ainda necessária, sem relação com roles.
--   - Seção 6 (views "DB_PESQUISAS") — só se ainda quiserem essa camada para
--     BI; os "grant ... to authenticated, service_role" no fim da seção
--     também vão falhar e precisam ser removidos ou trocados por um grant
--     para quem de fato for consultar (uma credencial de BI separada, a
--     definir).
--
-- O script corrigido e mínimo, coerente com a arquitetura atual, está em
-- scripts/bootstrap-db-dataware-usuario-unico.sql.
-- ============================================================================

-- ============================================================================
-- Reconstrução do contrato PostgREST/RLS em db_dataware (schema sigav)
-- ============================================================================
--
-- CONTEXTO
-- db_dataware é um banco Postgres 16 compartilhado com outras aplicações da
-- empresa (schemas "sip" e "sigepsi"). O schema "sigav" e os dados desta
-- aplicação já foram restaurados via pg_dump/pg_restore de um projeto
-- Supabase real: 155 funções, 35 tabelas, auth.users com 29 linhas reais e
-- sigav.people com 1030 linhas já estão presentes e corretos.
--
-- O que NÃO veio na restauração (roles são objetos de CLUSTER, não de banco,
-- e por isso pg_dump/pg_restore por banco não os carrega):
--   - As roles anon/authenticated/service_role não existem no cluster.
--   - RLS está habilitada em todas as tabelas de sigav, mas há ZERO policies
--     — ou seja, hoje só quem tem BYPASSRLS (o superuser) enxerga qualquer
--     linha.
--   - A extensão pgcrypto não está instalada.
--   - O schema "DB_PESQUISAS" (views analíticas para BI) não existe.
--
-- Este script foi montado por extração automática das 192 migrations do
-- histórico do projeto (supabase/migrations), cruzando cada GRANT/POLICY
-- contra o catálogo REAL do banco de destino — não apenas replay cego do
-- histórico. Statements cujo alvo (tabela/função) não existe mais ao vivo
-- foram excluídos e estão listados no apêndice ao final, para revisão manual.
--
-- IMPORTANTE:
--   1. Rode isto revisado por alguém com CREATEROLE nesta instância — a
--      credencial da aplicação (usr_sip_app) não tem privilégio para criar
--      roles.
--   2. Todo o script está em uma única transação: se qualquer statement
--      falhar, nada é aplicado. Isso é deliberado num banco compartilhado.
--   3. Este script NÃO é uma migration versionada do projeto (não deve ir
--      para supabase/migrations/) — é um script de bootstrap de um ambiente
--      que não participa do supabase_migrations.schema_migrations local.
--      Trate-o como scripts/diagnostico-supabase.sql e
--      scripts/reconciliar-historico-migrations.sql: script de operação,
--      não histórico versionado do schema.
--
-- ============================================================================

begin;

-- ----------------------------------------------------------------------------
-- 1. Roles do contrato PostgREST
-- ----------------------------------------------------------------------------
-- Convenção real do Supabase (self-hosted): NOLOGIN NOINHERIT, e service_role
-- com BYPASSRLS. Como aqui a aplicação conecta diretamente como usr_sip_app
-- (sem um proxy "authenticator" separado), o adaptador fará "set local role"
-- a partir dessa conexão — por isso a role de conexão precisa ser MEMBRO das
-- três, mas NOINHERIT garante que ela só usa os privilégios ao trocar de role
-- explicitamente, igual ao comportamento do PostgREST.

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

grant anon to usr_sip_app;
grant authenticated to usr_sip_app;
grant service_role to usr_sip_app;

-- ----------------------------------------------------------------------------
-- 2. Extensão
-- ----------------------------------------------------------------------------

create extension if not exists pgcrypto with schema extensions;

-- ----------------------------------------------------------------------------
-- 3. Grants de schema e privilégios padrão para objetos futuros
-- ----------------------------------------------------------------------------
-- A linha abaixo está, na migration original, dentro de um bloco "do $$"
-- dinâmico (20260826180000_migrar_schema_sigav.sql) que meu extrator
-- automático não abre — por isso foi adicionada aqui manualmente.

grant usage on schema sigav to postgres, anon, authenticated, service_role;

-- Os "alter default privileges" originais são "for role postgres", mas neste
-- banco quem cria os objetos é usr_sip_app (dono real das 35 tabelas e das
-- 155 funções de sigav hoje). Adaptado para produzir o mesmo efeito prático:
-- migrations futuras aplicadas por usr_sip_app herdam os grants corretos sem
-- precisar repeti-los.
alter default privileges for role usr_sip_app in schema sigav
  grant select, insert, update, delete, truncate, references, trigger
  on tables to anon, authenticated, service_role;
alter default privileges for role usr_sip_app in schema sigav
  grant usage, select, update on sequences to anon, authenticated, service_role;
alter default privileges for role usr_sip_app in schema sigav
  grant execute on functions to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 4. Hardening de RPCs (baseline replicado de 20260803133300_harden_rpc_permissions.sql)
-- ----------------------------------------------------------------------------
-- A migration original rodou uma vez só, sobre "public", e ficou registrada
-- em supabase/CLAUDE.md como convenção do projeto ("regra 5: EXECUTE
-- revogado de public/anon em função interna"). Replicado aqui contra o
-- estado ATUAL de sigav para cobrir tanto as funções antigas quanto as
-- criadas depois — é idempotente e não deveria remover nada que os grants
-- explícitos da seção 5 re-concedam em seguida.

do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'sigav'
      and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon', r.signature);

    if r.proname <> 'rls_auto_enable' then
      execute format('grant execute on function %s to authenticated', r.signature);
    end if;
  end loop;
end;
$$;

-- Exceção documentada (supabase/CLAUDE.md, seção "Helpers internos"):
-- fc_abrir_ciclos_agendados() não recebe grant nenhum de propósito — só é
-- chamada de dentro de outras RPCs security definer.
revoke execute on function sigav.fc_abrir_ciclos_agendados() from authenticated;

-- ----------------------------------------------------------------------------
-- 5. Grants e revokes específicos extraídos do histórico de migrations
-- ----------------------------------------------------------------------------
-- 321 statements, deduplicados, na ordem cronológica
-- original (arquivos mais antigos primeiro). Cada bloco é precedido de um
-- comentário com o arquivo de origem, para auditoria.


-- origem: 20260730200000_initial_platform_schema.sql
grant execute on function sigav.current_person_id() to authenticated;
grant execute on function sigav.has_active_role(text) to authenticated;
grant execute on function sigav.can_manage_surveys() to authenticated;
grant execute on function sigav.can_access_application(uuid) to authenticated;
revoke all on all tables in schema sigav from anon;
revoke all on all sequences in schema sigav from anon;
revoke all on all tables in schema sigav from authenticated;
grant select on sigav.organizational_units, sigav.people, sigav.system_roles, sigav.person_role_assignments, sigav.surveys, sigav.survey_versions, sigav.survey_applications, sigav.survey_sections, sigav.survey_questions, sigav.question_options, sigav.application_participants, sigav.audit_events to authenticated;
grant select, insert, update, delete on sigav.submissions, sigav.answers, sigav.answer_options, sigav.user_preferences to authenticated;
grant usage, select on sequence sigav.audit_events_id_seq to authenticated;

-- origem: 20260730203000_cddi_module.sql
revoke all on sigav.person_access_identities, sigav.data_import_batches, sigav.data_import_issues, sigav.cddi_leadership_links, sigav.cddi_link_correction_requests, sigav.cddi_competency_results, sigav.cddi_final_results from anon;
grant select, insert, update, delete on sigav.person_access_identities, sigav.data_import_batches, sigav.data_import_issues, sigav.cddi_leadership_links, sigav.cddi_link_correction_requests, sigav.cddi_competency_results, sigav.cddi_final_results to authenticated;
grant usage, select on sequence sigav.data_import_issues_id_seq to authenticated;

-- origem: 20260730211500_public_form_definition.sql
grant execute on function sigav.get_public_survey_form(text) to anon, authenticated;

-- origem: 20260730211600_authenticated_participant_access.sql
grant execute on function sigav.resolve_authenticated_person(text) to authenticated;
grant execute on function sigav.get_my_cddi_context() to authenticated;

-- origem: 20260731104000_cddi_authenticated_form_flow.sql
grant execute on function sigav.application_accepts_responses(uuid) to authenticated;
grant execute on function sigav.start_or_resume_my_cddi_submission(text, text, uuid) to authenticated;
grant execute on function sigav.save_my_cddi_answer(uuid, uuid, uuid, text) to authenticated;
grant execute on function sigav.submit_my_cddi_submission(uuid) to authenticated;

-- origem: 20260731130000_technical_team_role_and_avatars.sql
grant execute on function sigav.set_my_avatar_url(text) to authenticated;

-- origem: 20260731131500_create_survey_draft_rpc.sql
grant execute on function sigav.create_survey_draft(text,text,text,text,timestamptz,timestamptz,boolean,boolean) to authenticated;

-- origem: 20260731180000_team_and_survey_builder.sql
grant execute on function sigav.get_my_team_workspace(text) to authenticated;
grant execute on function sigav.search_team_candidates(uuid, text) to authenticated;
grant execute on function sigav.add_person_to_my_team(uuid, uuid) to authenticated;
grant execute on function sigav.remove_person_from_my_team(uuid) to authenticated;
grant execute on function sigav.list_managed_surveys() to authenticated;
grant execute on function sigav.get_survey_builder(uuid) to authenticated;
grant execute on function sigav.add_survey_section(uuid, text, text) to authenticated;
grant execute on function sigav.add_survey_question(uuid, uuid, text, text, text, boolean, jsonb) to authenticated;
grant execute on function sigav.delete_survey_question(uuid) to authenticated;

-- origem: 20260731190000_platform_administrator_access.sql
grant execute on function sigav.is_platform_administrator() to authenticated;
grant execute on function sigav.list_access_workspace(text) to authenticated;
grant execute on function sigav.set_person_role(uuid, text, boolean) to authenticated;

-- origem: 20260803104000_restore_platform_context_and_team_search.sql
grant execute on function sigav.unaccent_lower(text) to authenticated;

-- origem: 20260803105500_generic_survey_runtime_and_catalog.sql
grant execute on function sigav.list_my_survey_catalog() to authenticated;
grant execute on function sigav.start_or_resume_my_survey_submission(text) to authenticated;
grant execute on function sigav.get_platform_health() to authenticated;

-- origem: 20260803120000_cddi_monitoring_dashboard_rpc.sql
grant execute on function sigav.get_cddi_monitoring_dashboard(text) to authenticated;

-- origem: 20260803120500_improve_survey_cycle_state_machine.sql
grant execute on function sigav.manage_survey_cycle(uuid,text,timestamptz,timestamptz) to authenticated;

-- origem: 20260803123000_cddi_identity_and_leader_selection.sql
grant execute on function sigav.get_my_cddi_identity(text) to authenticated;

-- origem: 20260803133000_institutional_access_schema.sql
revoke all on sigav.institutional_domains from anon, authenticated;
grant select on sigav.institutional_domains to authenticated;

-- origem: 20260803180500_people_base_avatar_policy.sql
revoke all on function sigav.get_admin_people_base_summary(uuid) from public,anon;
grant execute on function sigav.get_admin_people_base_summary(uuid) to authenticated;
revoke all on function sigav.sync_people_base_rows(jsonb,uuid) from public,anon,authenticated;
grant execute on function sigav.sync_people_base_rows(jsonb,uuid) to service_role;

-- origem: 20260803182500_single_domain_and_avatar_choice.sql
revoke all on function sigav.set_my_avatar_choice(text, text) from public, anon;
grant execute on function sigav.set_my_avatar_choice(text, text) to authenticated;

-- origem: 20260804131000_application_visual_settings.sql
grant execute on function sigav.get_application_visual_settings(uuid) to authenticated;
grant execute on function sigav.update_application_visual_settings(uuid, text, text, text, text, text, text) to authenticated;

-- origem: 20260804172000_move_rls_policy_helpers_to_private_schema.sql
revoke all on schema private from anon;
revoke all on schema private from authenticated;
revoke all on schema private from service_role;
revoke all on function private.can_audit_platform() from anon;
revoke all on function private.can_audit_platform() from service_role;
grant execute on function private.can_audit_platform() to authenticated;
revoke all on function private.can_edit_submission(uuid) from anon;
revoke all on function private.can_edit_submission(uuid) from service_role;
grant execute on function private.can_edit_submission(uuid) to authenticated;

-- origem: 20260804174641_personalized_avatar_config.sql
revoke all on function sigav.set_my_avatar_choice(text, text, jsonb) from public, anon, service_role;
grant execute on function sigav.set_my_avatar_choice(text, text, jsonb) to authenticated;

-- origem: 20260804182523_survey_builder_safe_editing.sql
revoke execute on function sigav.update_survey_section(uuid, text, text) from public, anon, service_role;
grant execute on function sigav.update_survey_section(uuid, text, text) to authenticated;
revoke execute on function sigav.update_survey_question(uuid, text, text, text, boolean, jsonb) from public, anon, service_role;
grant execute on function sigav.update_survey_question(uuid, text, text, text, boolean, jsonb) to authenticated;

-- origem: 20260804184541_survey_builder_duplicate_reorder.sql
revoke execute on function sigav.duplicate_survey_builder_item(text, uuid) from public, anon, service_role;
grant execute on function sigav.duplicate_survey_builder_item(text, uuid) to authenticated;
revoke execute on function sigav.reorder_survey_builder_item(text, uuid, text) from public, anon, service_role;
grant execute on function sigav.reorder_survey_builder_item(text, uuid, text) to authenticated;

-- origem: 20260804192204_survey_builder_move_question_between_sections.sql
revoke execute on function sigav.move_survey_question_to_section(uuid, uuid)
  from public, anon, service_role;
grant execute on function sigav.move_survey_question_to_section(uuid, uuid)
  to authenticated;

-- origem: 20260804195030_validate_survey_integrity_before_publish.sql
revoke all on function sigav.validate_survey_version_integrity(uuid)
from public, anon, service_role;
grant execute on function sigav.validate_survey_version_integrity(uuid)
to authenticated;
revoke all on function sigav.enforce_draft_survey_structure()
from public, anon, authenticated, service_role;
revoke all on function sigav.get_survey_operations(uuid)
from public, anon, service_role;
grant execute on function sigav.get_survey_operations(uuid)
to authenticated;
revoke all on function sigav.manage_survey_cycle(uuid, text, timestamptz, timestamptz)
from public, anon, service_role;
grant execute on function sigav.manage_survey_cycle(uuid, text, timestamptz, timestamptz)
to authenticated;

-- origem: 20260804195236_restrict_survey_integrity_validator.sql
revoke all on function sigav.validate_survey_version_integrity(uuid)
from public, anon, authenticated, service_role;

-- origem: 20260805114500_bulk_assign_application_participants.sql
revoke all on function sigav.assign_admin_application_participants_bulk(uuid, uuid[], text) from anon;
revoke all on function sigav.assign_admin_application_participants_bulk(uuid, uuid[], text) from service_role;
grant execute on function sigav.assign_admin_application_participants_bulk(uuid, uuid[], text) to authenticated;

-- origem: 20260805133500_admin_people_teams_foundation.sql
revoke all on function sigav.search_platform_admin_people(text, integer) from public, anon;
revoke all on function sigav.update_platform_admin_person(uuid, text, text, text, text, text, text, text, text, text, boolean, text) from public, anon;
revoke all on function sigav.list_platform_admin_person_audit(uuid, integer) from public, anon;
revoke all on function sigav.list_platform_admin_leadership_links(uuid, text, integer) from public, anon;
revoke all on function sigav.set_platform_admin_leadership_link(uuid, uuid, uuid, text) from public, anon;
grant execute on function sigav.search_platform_admin_people(text, integer) to authenticated;
grant execute on function sigav.update_platform_admin_person(uuid, text, text, text, text, text, text, text, text, text, boolean, text) to authenticated;
grant execute on function sigav.list_platform_admin_person_audit(uuid, integer) to authenticated;
grant execute on function sigav.list_platform_admin_leadership_links(uuid, text, integer) to authenticated;
grant execute on function sigav.set_platform_admin_leadership_link(uuid, uuid, uuid, text) to authenticated;

-- origem: 20260805194600_assign_all_available_participants.sql
revoke all on function sigav.assign_admin_all_available_participants(uuid, text) from public, anon;
grant execute on function sigav.assign_admin_all_available_participants(uuid, text) to authenticated;

-- origem: 20260805200500_sync_google_avatar_from_auth.sql
revoke all on function sigav.sync_my_google_avatar() from public, anon;
grant execute on function sigav.sync_my_google_avatar() to authenticated;

-- origem: 20260806100500_fix_cddi_leader_submission_requirement.sql
revoke all on function sigav.sync_cddi_leader_technical_answer(uuid, uuid, uuid)
  from public, anon, authenticated;
revoke all on function sigav.handle_cddi_leadership_answer_sync()
  from public, anon, authenticated;

-- origem: 20260806121000_catalogo_conformidade_nomenclatura.sql
revoke all on schema db_governanca from public, anon, authenticated;
grant usage on schema db_governanca to service_role;
revoke all on db_governanca.tb_catalogo_objeto from public, anon, authenticated;
grant select, insert, update, delete on db_governanca.tb_catalogo_objeto to service_role;

-- origem: 20260806123000_integrate_manager_import_and_survey_dashboards.sql
revoke all on function sigav.sync_cddi_manager_rows(jsonb, uuid) from public, anon, authenticated;
grant execute on function sigav.sync_cddi_manager_rows(jsonb, uuid) to service_role;
revoke all on function sigav.get_survey_dashboard(text) from public, anon;
grant execute on function sigav.get_survey_dashboard(text) to authenticated;

-- origem: 20260806123500_endurecer_governanca_banco.sql
revoke all on db_governanca.vw_resumo_migracao from public, anon, authenticated;
grant select on db_governanca.vw_resumo_migracao to service_role;

-- origem: 20260806140500_observabilidade_erros_aplicacao.sql
revoke all on sigav.tl_erro_aplicacao from public, anon, authenticated;
grant select, insert, delete on sigav.tl_erro_aplicacao to service_role;

-- origem: 20260807093000_platform_branding_settings.sql
revoke all on table sigav.tb_config_plataforma from anon, authenticated;
grant execute on function sigav.fc_obter_marca_plataforma() to anon, authenticated;
grant execute on function sigav.fc_atualizar_marca_plataforma(text, text, text, text, text) to authenticated;

-- origem: 20260807101500_team_avatar_contracts.sql
grant execute on function sigav.fc_obter_minha_equipe(text) to authenticated;
grant execute on function sigav.fc_pesquisar_equipe(uuid, text) to authenticated;

-- origem: 20260807113000_fix_cddi_leader_submission_contract.sql
revoke all on function sigav.sync_new_cddi_submission_leader_answer()
  from public, anon, authenticated;

-- origem: 20260807150000_simplificar_modelo_papeis.sql
revoke all on function sigav.fc_obter_contexto_plataforma() from public, anon;
grant execute on function sigav.fc_obter_contexto_plataforma() to authenticated;

-- origem: 20260807151500_listar_ciclos_lideranca.sql
revoke all on function sigav.fc_listar_ciclos_lideranca() from public, anon;
grant execute on function sigav.fc_listar_ciclos_lideranca() to authenticated;

-- origem: 20260810120000_perfis_exclusivos_quatro_papeis.sql
revoke all on function sigav.fc_definir_perfil_pessoa(uuid, text) from public, anon;
grant execute on function sigav.fc_definir_perfil_pessoa(uuid, text) to authenticated;

-- origem: 20260810130000_restaurar_catalogo_modulos_plataforma.sql
revoke all on table sigav.platform_modules from public, anon, authenticated;
revoke all on table sigav.role_module_permissions from public, anon, authenticated;
revoke all on table sigav.person_module_permissions from public, anon, authenticated;

-- origem: 20260810141000_usar_foto_google_automaticamente.sql
revoke all on function sigav.sync_my_google_avatar() from public, anon, service_role;
revoke all on function sigav.set_my_avatar_choice(text, text) from public, anon, service_role;
revoke all on function sigav.set_my_avatar_url(text) from public, anon, service_role;
revoke all on function sigav.fc_validar_foto_google() from public, anon, authenticated, service_role;

-- origem: 20260811120000_periodo_futuro_e_exclusao_rascunho.sql
revoke all on function sigav.manage_survey_cycle(uuid, text, timestamptz, timestamptz) from public, anon;
revoke all on function sigav.fc_excluir_pesquisa_rascunho(uuid) from public, anon;
grant execute on function sigav.fc_excluir_pesquisa_rascunho(uuid) to authenticated;

-- origem: 20260812120000_listar_pessoas_sem_chefia.sql
revoke all on function sigav.fc_listar_pessoas_sem_chefia(uuid, text, integer) from public, anon;
grant execute on function sigav.fc_listar_pessoas_sem_chefia(uuid, text, integer) to authenticated;

-- origem: 20260812150000_corrigir_denominador_participantes_bloqueados.sql
revoke all on function sigav.fc_obter_painel_pesquisa(text) from public, anon;
grant execute on function sigav.fc_obter_painel_pesquisa(text) to authenticated;

-- origem: 20260812160000_restaurar_event_trigger_rls_automatica.sql
revoke all on function sigav.rls_auto_enable() from public, anon, authenticated, service_role;

-- origem: 20260812170000_restaurar_rpcs_de_participantes_e_painel.sql
revoke all on function sigav.list_admin_participant_applications() from public, anon;
grant execute on function sigav.list_admin_participant_applications() to authenticated;
revoke all on function sigav.list_admin_application_participants(uuid) from public, anon;
grant execute on function sigav.list_admin_application_participants(uuid) to authenticated;
revoke all on function sigav.search_admin_people_for_application(uuid, text) from public, anon;
grant execute on function sigav.search_admin_people_for_application(uuid, text) to authenticated;
revoke all on function sigav.assign_admin_application_participant(uuid, uuid, text) from public, anon;
grant execute on function sigav.assign_admin_application_participant(uuid, uuid, text) to authenticated;
revoke all on function sigav.create_and_assign_admin_participant(uuid, text, text, text, text, text, text, text) from public, anon;
grant execute on function sigav.create_and_assign_admin_participant(uuid, text, text, text, text, text, text, text) to authenticated;
revoke all on function sigav.set_admin_application_participant_status(uuid, text) from public, anon;
grant execute on function sigav.set_admin_application_participant_status(uuid, text) to authenticated;
revoke all on function sigav.get_cddi_monitoring_dashboard_internal(text) from public, anon, authenticated;

-- origem: 20260813120000_motor_logica_condicional.sql
revoke all on table sigav.tb_regra_condicional from anon, authenticated;
revoke all on table sigav.tb_condicao_regra from anon, authenticated;
revoke all on function sigav.fc_origens_da_regra(uuid) from public, anon;
revoke all on function sigav.fc_regra_gera_ciclo(uuid, uuid[]) from public, anon;
revoke all on function sigav.fc_condicao_atendida(uuid, uuid) from public, anon;
revoke all on function sigav.fc_alvo_visivel(uuid, uuid) from public, anon;
revoke all on function sigav.fc_pergunta_visivel(uuid, uuid) from public, anon;
revoke all on function sigav.fc_salvar_regra_condicional(text, uuid, text, text, jsonb, text) from public, anon;
revoke all on function sigav.fc_excluir_regra_condicional(uuid) from public, anon;
revoke all on function sigav.fc_listar_regras_condicionais(uuid) from public, anon;
revoke all on function sigav.fc_obter_regras_do_ciclo(text) from public, anon;
grant execute on function sigav.fc_condicao_atendida(uuid, uuid) to authenticated;
grant execute on function sigav.fc_alvo_visivel(uuid, uuid) to authenticated;
grant execute on function sigav.fc_pergunta_visivel(uuid, uuid) to authenticated;
grant execute on function sigav.fc_salvar_regra_condicional(text, uuid, text, text, jsonb, text) to authenticated;
grant execute on function sigav.fc_excluir_regra_condicional(uuid) to authenticated;
grant execute on function sigav.fc_listar_regras_condicionais(uuid) to authenticated;
grant execute on function sigav.fc_obter_regras_do_ciclo(text) to authenticated;
revoke all on function sigav.submit_my_survey_submission(uuid) from public, anon;
grant execute on function sigav.submit_my_survey_submission(uuid) to authenticated;

-- origem: 20260813160000_clonar_pesquisa.sql
revoke all on function sigav.fc_clonar_pesquisa(uuid, text, text) from public, anon;
grant execute on function sigav.fc_clonar_pesquisa(uuid, text, text) to authenticated;

-- origem: 20260813170000_listar_ciclos_pesquisa.sql
revoke all on function sigav.fc_listar_ciclos_pesquisa(text) from public, anon;
grant execute on function sigav.fc_listar_ciclos_pesquisa(text) to authenticated;

-- origem: 20260813180000_remover_resposta_participante.sql
revoke all on function sigav.fc_remover_resposta_pessoa(uuid, text, text) from public, anon;
grant execute on function sigav.fc_remover_resposta_pessoa(uuid, text, text) to authenticated;
revoke all on function sigav.fc_listar_respostas_ciclo(text, text, integer) from public, anon;
grant execute on function sigav.fc_listar_respostas_ciclo(text, text, integer) to authenticated;

-- origem: 20260813190000_galeria_de_modelos.sql
revoke all on function sigav.list_managed_surveys() from public, anon;
revoke all on function sigav.fc_listar_modelos_avaliacao() from public, anon;
grant execute on function sigav.fc_listar_modelos_avaliacao() to authenticated;
revoke all on function sigav.fc_definir_modelo_avaliacao(uuid, boolean, text) from public, anon;
grant execute on function sigav.fc_definir_modelo_avaliacao(uuid, boolean, text) to authenticated;

-- origem: 20260813210000_ciclo_cddi_vigente.sql
revoke all on function sigav.fc_obter_ciclo_cddi_vigente() from public, anon;
grant execute on function sigav.fc_obter_ciclo_cddi_vigente() to authenticated;

-- origem: 20260813220000_anonimato_estrutural.sql
revoke all on table sigav.tb_bilhete_anonimo from public, anon, authenticated;
grant select on table sigav.tb_bilhete_anonimo to authenticated;
revoke all on function sigav.fc_validar_ciclo_anonimo() from public, anon, authenticated;
revoke all on function sigav.start_or_resume_my_survey_submission(text) from public, anon;

-- origem: 20260813240000_separar_fundo_e_cor_do_acesso.sql
revoke all on function sigav.fc_definir_fundo_acesso(text, text) from public, anon;
grant execute on function sigav.fc_definir_fundo_acesso(text, text) to authenticated;
revoke all on function sigav.fc_definir_cor_painel_acesso(text) from public, anon;
grant execute on function sigav.fc_definir_cor_painel_acesso(text) to authenticated;

-- origem: 20260814090000_arquivar_pesquisa.sql
revoke all on function sigav.fc_expirar_pesquisas_arq() from public, anon;
grant execute on function sigav.fc_expirar_pesquisas_arq() to authenticated;
revoke all on function sigav.fc_listar_pesquisas_arq() from public, anon;
grant execute on function sigav.fc_listar_pesquisas_arq() to authenticated;

-- origem: 20260814100000_abrir_ciclos_agendados.sql
revoke all on function sigav.fc_abrir_ciclos_agendados() from public, anon, authenticated;
revoke all on function sigav.get_public_survey_form(text) from public, anon;
grant execute on function sigav.get_public_survey_form(text) to authenticated;

-- origem: 20260814140000_limpar_superficie_legada.sql
revoke all on function sigav.set_person_role(uuid, text, boolean) from public, anon;

-- origem: 20260817160000_textos_e_cores_configuraveis.sql
revoke all on function sigav.fc_definir_textos_marca(text, text, text) from public, anon;
grant execute on function sigav.fc_definir_textos_marca(text, text, text) to authenticated;
revoke all on function sigav.fc_definir_cor_barra_lateral(text) from public, anon;
grant execute on function sigav.fc_definir_cor_barra_lateral(text) to authenticated;

-- origem: 20260818130000_notificar_participantes_por_email.sql
revoke all on table sigav.tl_email_participante from public, anon, authenticated;
revoke all on function sigav.fc_definir_notificacao_email(uuid, boolean) from public, anon;
grant execute on function sigav.fc_definir_notificacao_email(uuid, boolean) to authenticated;
revoke all on function sigav.fc_reivindicar_emails() from public, anon;
grant execute on function sigav.fc_reivindicar_emails() to authenticated, service_role;
revoke all on function sigav.fc_concluir_email_participante(uuid, boolean, text) from public, anon;
grant execute on function sigav.fc_concluir_email_participante(uuid, boolean, text) to authenticated, service_role;

-- origem: 20260819135306_configurar_presenca_online.sql
grant usage on schema private to authenticated;
revoke all on function private.can_view_platform_presence() from public, anon;
grant execute on function private.can_view_platform_presence() to authenticated;
revoke all on function private.can_track_platform_presence() from public, anon;
grant execute on function private.can_track_platform_presence() to authenticated;
revoke all on function sigav.fc_definir_presenca_plataforma(boolean, text[]) from public, anon;
grant execute on function sigav.fc_definir_presenca_plataforma(boolean, text[]) to authenticated;

-- origem: 20260820120000_central_de_emails.sql
revoke all on function sigav.fc_definir_textos_email(text, text) from public, anon;
grant execute on function sigav.fc_definir_textos_email(text, text) to authenticated;
grant execute on function sigav.fc_reivindicar_emails() to authenticated;
revoke all on function sigav.fc_agendar_envio_manual(uuid, uuid[]) from public, anon;
grant execute on function sigav.fc_agendar_envio_manual(uuid, uuid[]) to authenticated;
revoke all on function sigav.fc_listar_audiencia_email(uuid, text, text, integer) from public, anon;
grant execute on function sigav.fc_listar_audiencia_email(uuid, text, text, integer) to authenticated;
revoke all on function sigav.fc_listar_envios_email(uuid, text, integer) from public, anon;
grant execute on function sigav.fc_listar_envios_email(uuid, text, integer) to authenticated;

-- origem: 20260820153000_corrigir_criacao_e_fila_emails.sql
revoke all on function sigav.create_survey_draft(text, text, text, text, timestamptz, timestamptz, boolean, boolean)
  from public, anon;
grant execute on function sigav.create_survey_draft(text, text, text, text, timestamptz, timestamptz, boolean, boolean)
  to authenticated;
revoke all on function sigav.fc_concluir_email_participante(uuid, uuid, boolean, text)
  from public, anon;
grant execute on function sigav.fc_concluir_email_participante(uuid, uuid, boolean, text)
  to authenticated, service_role;

-- origem: 20260820210000_excluir_pesquisa_arquivada.sql
revoke all on function sigav.fc_excluir_pesquisa_arquivada(uuid) from public, anon;
grant execute on function sigav.fc_excluir_pesquisa_arquivada(uuid) to authenticated;

-- origem: 20260820220000_exclusao_definitiva_de_arquivada.sql
revoke all on function sigav.fc_cancela_ciclos_arq() from public, anon, authenticated;

-- origem: 20260821100000_resposta_anonima_publica.sql
revoke all on function sigav.fc_obter_form_anonimo(text), sigav.fc_iniciar_resp_anon(text), sigav.fc_gravar_resp_anon(uuid,text,uuid,uuid[],text,numeric,boolean,date,timestamptz,jsonb), sigav.fc_enviar_resp_anon(uuid,text) from public, anon, authenticated;
grant execute on function sigav.fc_obter_form_anonimo(text), sigav.fc_iniciar_resp_anon(text), sigav.fc_gravar_resp_anon(uuid,text,uuid,uuid[],text,numeric,boolean,date,timestamptz,jsonb), sigav.fc_enviar_resp_anon(uuid,text) to service_role;
grant execute on function sigav.fc_obter_form_anonimo(text), sigav.fc_iniciar_resp_anon(text), sigav.fc_gravar_resp_anon(uuid,text,uuid,uuid[],text,numeric,boolean,date,timestamptz,jsonb), sigav.fc_enviar_resp_anon(uuid,text) to authenticated;

-- origem: 20260821180000_reparar_execucao_rpcs_anonimas.sql
revoke all on function sigav.fc_obter_form_anonimo(text) from public, anon;
revoke all on function sigav.fc_iniciar_resp_anon(text) from public, anon;
revoke all on function sigav.fc_gravar_resp_anon(uuid, text, uuid, uuid[], text, numeric, boolean, date, timestamptz, jsonb) from public, anon;
revoke all on function sigav.fc_enviar_resp_anon(uuid, text) from public, anon;
grant execute on function sigav.fc_obter_form_anonimo(text) to service_role, authenticated;
grant execute on function sigav.fc_iniciar_resp_anon(text) to service_role, authenticated;
grant execute on function sigav.fc_gravar_resp_anon(uuid, text, uuid, uuid[], text, numeric, boolean, date, timestamptz, jsonb) to service_role, authenticated;
grant execute on function sigav.fc_enviar_resp_anon(uuid, text) to service_role, authenticated;

-- origem: 20260821190000_criar_entradas_internas_resposta_anonima.sql
revoke all on function sigav.fc_srv_obter_form_anonimo(text) from public, anon, authenticated;
revoke all on function sigav.fc_srv_iniciar_resp_anon(text) from public, anon, authenticated;
revoke all on function sigav.fc_srv_gravar_resp_anon(uuid, text, uuid, uuid[], text, numeric, boolean, date, timestamptz, jsonb) from public, anon, authenticated;
revoke all on function sigav.fc_srv_enviar_resp_anon(uuid, text) from public, anon, authenticated;
grant execute on function sigav.fc_srv_obter_form_anonimo(text) to service_role;
grant execute on function sigav.fc_srv_iniciar_resp_anon(text) to service_role;
grant execute on function sigav.fc_srv_gravar_resp_anon(uuid, text, uuid, uuid[], text, numeric, boolean, date, timestamptz, jsonb) to service_role;
grant execute on function sigav.fc_srv_enviar_resp_anon(uuid, text) to service_role;

-- origem: 20260821235901_presenca_online_com_rls.sql
revoke all on table sigav.tb_presenca_online from public, anon, authenticated;
revoke all on function sigav.fc_registrar_presenca() from public, anon;
grant execute on function sigav.fc_registrar_presenca() to authenticated;
revoke all on function sigav.fc_listar_presenca_online() from public, anon;
grant execute on function sigav.fc_listar_presenca_online() to authenticated;

-- origem: 20260821235903_isolar_funcoes_internas.sql
revoke execute on function sigav.fc_expirar_pesquisas_arq() from public, anon, authenticated;
revoke execute on function sigav.fc_condicao_atendida(uuid, uuid) from public, anon, authenticated;
revoke execute on function sigav.fc_alvo_visivel(uuid, uuid) from public, anon, authenticated;
revoke execute on function sigav.fc_pergunta_visivel(uuid, uuid) from public, anon, authenticated;

-- origem: 20260821235904_restringir_dominio_rpcs_anonimas_ao_owner.sql
revoke all on function sigav.fc_obter_form_anonimo(text)
  from public, anon, authenticated, service_role;
revoke all on function sigav.fc_iniciar_resp_anon(text)
  from public, anon, authenticated, service_role;
revoke all on function sigav.fc_gravar_resp_anon(
  uuid, text, uuid, uuid[], text, numeric, boolean, date, timestamptz, jsonb
) from public, anon, authenticated, service_role;
revoke all on function sigav.fc_enviar_resp_anon(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function sigav.fc_srv_gravar_resp_anon(
  uuid, text, uuid, uuid[], text, numeric, boolean, date, timestamptz, jsonb
) from public, anon, authenticated;
grant execute on function sigav.fc_srv_gravar_resp_anon(
  uuid, text, uuid, uuid[], text, numeric, boolean, date, timestamptz, jsonb
) to service_role;

-- origem: 20260822150000_security_audit_followup.sql
revoke all on function sigav.fc_obter_formulario_publico(text) from public, anon;
grant execute on function sigav.fc_obter_formulario_publico(text) to authenticated;
revoke all on function sigav.get_public_survey_form(text) from public, anon, authenticated;
revoke all on function sigav.fc_pesquisar_pessoa_admin(text, integer) from public, anon;
grant execute on function sigav.fc_pesquisar_pessoa_admin(text, integer) to authenticated;
revoke all on function sigav.search_platform_admin_people(text, integer) from public, anon, authenticated;
revoke all on function sigav.fc_listar_auditoria_pessoa(uuid, integer) from public, anon;
grant execute on function sigav.fc_listar_auditoria_pessoa(uuid, integer) to authenticated;
revoke all on function sigav.list_platform_admin_person_audit(uuid, integer) from public, anon, authenticated;

-- origem: 20260822213947_hash_token_sessao_anonima.sql
revoke all on function sigav.fc_gravar_resp_anon(uuid, text, uuid, uuid[], text, numeric, boolean, date, timestamptz, jsonb) from public, anon, authenticated, service_role;

-- origem: 20260823000420_restringir_marca_publica_expansao.sql
grant execute on function sigav.fc_obter_marca_publica() to anon, authenticated, service_role;

-- origem: 20260823001052_revogar_marca_completa_anon.sql
revoke execute on function sigav.fc_obter_marca_plataforma() from anon;

-- origem: 20260823201245_endurecer_auditoria_seguranca.sql
revoke all on table sigav.tb_limite_requisicao_publica from public, anon, authenticated;
grant select, insert, update, delete on table sigav.tb_limite_requisicao_publica to service_role;
revoke all on function sigav.fc_srv_consumir_limite_publico(text, text, integer, integer)
  from public, anon, authenticated;
grant execute on function sigav.fc_srv_consumir_limite_publico(text, text, integer, integer)
  to service_role;
revoke execute on function sigav.fc_reivindicar_emails()
  from public, anon, authenticated;
grant execute on function sigav.fc_reivindicar_emails()
  to service_role;
revoke execute on function sigav.fc_concluir_email_participante(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function sigav.fc_concluir_email_participante(uuid, boolean, text)
  to service_role;
revoke execute on function sigav.fc_concluir_email_participante(uuid, uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function sigav.fc_concluir_email_participante(uuid, uuid, boolean, text)
  to service_role;
revoke all on function sigav.fc_srv_reivindicar_emails()
  from public, anon, authenticated;
grant execute on function sigav.fc_srv_reivindicar_emails()
  to service_role;
revoke all on function sigav.fc_srv_concluir_email(uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function sigav.fc_srv_concluir_email(uuid, boolean, text)
  to service_role;
revoke all on function sigav.fc_srv_concluir_email(uuid, uuid, boolean, text)
  from public, anon, authenticated;
grant execute on function sigav.fc_srv_concluir_email(uuid, uuid, boolean, text)
  to service_role;

-- origem: 20260824090000_verificar_contrato_rpc.sql
revoke all on function sigav.fc_srv_verificar_contrato_rpc(text[]) from public, anon, authenticated;
grant execute on function sigav.fc_srv_verificar_contrato_rpc(text[]) to service_role;

-- origem: 20260824100000_idempotencia_entrega_email.sql
revoke all on function sigav.fc_srv_registrar_transporte(uuid, uuid, text) from public, anon, authenticated;
grant execute on function sigav.fc_srv_registrar_transporte(uuid, uuid, text) to service_role;
revoke all on function sigav.fc_reivindicar_emails() from public, anon, authenticated;

-- origem: 20260824110000_criar_nova_versao_pesquisa.sql
revoke all on function sigav.fc_criar_nova_versao_pesquisa(uuid) from public, anon;
grant execute on function sigav.fc_criar_nova_versao_pesquisa(uuid) to authenticated;

-- origem: 20260824120000_expirar_rascunhos_anonimos.sql
revoke all on function sigav.fc_definir_retencao_anonima(integer) from public, anon;
grant execute on function sigav.fc_definir_retencao_anonima(integer) to authenticated;
revoke all on function sigav.fc_expirar_rascunhos_anonimos() from public, anon, authenticated;
revoke all on function sigav.fc_srv_expirar_rascunhos_anon() from public, anon, authenticated;
grant execute on function sigav.fc_srv_expirar_rascunhos_anon() to service_role;

-- origem: 20260824223000_verificar_migrations_producao.sql
revoke all on function sigav.fc_srv_verificar_migrations(text[]) from public, anon, authenticated;
grant execute on function sigav.fc_srv_verificar_migrations(text[]) to service_role;

-- origem: 20260825141417_listar_acessos_paginados.sql
revoke all on function sigav.fc_listar_acessos_paginados(text, integer, integer)
  from public, anon, authenticated;
grant execute on function sigav.fc_listar_acessos_paginados(text, integer, integer)
  to authenticated;

-- origem: 20260825145000_corrigir_audiencia_email_concluidos.sql
revoke all on function sigav.fc_listar_audiencia_email(uuid, text, text, integer)
  from public, anon, authenticated;

-- origem: 20260825194624_corrigir_definicao_lideranca.sql
revoke all on function sigav.fc_listar_ciclos_lideranca_adm() from public, anon;
grant execute on function sigav.fc_listar_ciclos_lideranca_adm() to authenticated;

-- origem: 20260826120000_corrigir_ciclo_pesquisa_clonada.sql
revoke all on function sigav.fc_clonar_pesquisa_estrutura(uuid, text, text)
  from public, anon, authenticated;

-- origem: 20260826180000_migrar_schema_sigav.sql
alter default privileges for role postgres in schema sigav
  grant select, insert, update, delete, truncate, references, trigger
  on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema sigav
  grant usage, select, update on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema sigav
  grant execute on functions to anon, authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 6. Camada institucional de leitura ("DB_PESQUISAS") — ausente no clone
-- ----------------------------------------------------------------------------
-- Réplica integral de 20260805184500_institutional_naming_views.sql: são só
-- views (security_invoker = true, herdam RLS das tabelas de sigav) e não têm
-- dado próprio, então é seguro reaplicar o arquivo inteiro em vez de tentar
-- extrair fragmentos.

-- Camada institucional de leitura conforme o Padrão de Nomenclatura AgSUS.
-- As tabelas operacionais existentes permanecem inalteradas para preservar
-- compatibilidade com funções, políticas RLS e aplicação em produção.

create schema if not exists "DB_PESQUISAS";
comment on schema "DB_PESQUISAS" is
  'Camada institucional de leitura do AgSUS Pesquisas, com objetos e colunas conforme o padrão semântico corporativo.';

grant usage on schema "DB_PESQUISAS" to authenticated, service_role;

create or replace view "DB_PESQUISAS"."VW_PESSOA"
with (security_invoker = true)
as
select
  p.id as "SQ_PESSOA",
  p.auth_user_id as "SQ_USUARIO_AUTENTICACAO",
  p.employee_number as "NU_MATRICULA",
  p.full_name as "NO_PESSOA",
  p.institutional_email as "DS_EMAIL_INSTITUCIONAL",
  p.job_title as "DS_CARGO",
  p.cost_center as "DS_CENTRO_CUSTO",
  p.organizational_unit_id as "SQ_UNIDADE_ORGANIZACIONAL",
  p.workplace as "DS_LOCAL_TRABALHO",
  p.employment_status as "ST_VINCULO",
  case when p.active then 'S' else 'N' end as "ST_REGISTRO_ATIVO",
  p.source_system as "CO_SISTEMA_ORIGEM",
  p.source_key as "CO_CHAVE_ORIGEM",
  p.metadata as "DS_METADADO",
  p.created_at as "DT_INCLUSAO",
  p.updated_at as "DT_ATUALIZACAO"
from public.people p;

create or replace view "DB_PESQUISAS"."VW_PESQUISA"
with (security_invoker = true)
as
select
  s.id as "SQ_PESQUISA",
  s.code as "CO_PESQUISA",
  s.name as "NO_PESQUISA",
  s.description as "DS_PESQUISA",
  s.owner_unit_id as "SQ_UNIDADE_RESPONSAVEL",
  s.status as "ST_PESQUISA",
  s.settings as "DS_CONFIGURACAO",
  s.created_by as "SQ_USUARIO_INCLUSAO",
  s.created_at as "DT_INCLUSAO",
  s.updated_at as "DT_ATUALIZACAO"
from public.surveys s;

create or replace view "DB_PESQUISAS"."VW_APLICACAO_PESQUISA"
with (security_invoker = true)
as
select
  a.id as "SQ_APLICACAO",
  a.survey_version_id as "SQ_VERSAO_PESQUISA",
  a.code as "CO_APLICACAO",
  a.name as "NO_APLICACAO",
  a.opens_at as "DT_ABERTURA",
  a.closes_at as "DT_ENCERRAMENTO",
  a.status as "ST_APLICACAO",
  case when a.allow_drafts then 'S' else 'N' end as "ST_PERMITE_RASCUNHO",
  case when a.allow_resubmission then 'S' else 'N' end as "ST_PERMITE_REENVIO",
  case when a.anonymous then 'S' else 'N' end as "ST_ANONIMA",
  a.access_mode as "TP_ACESSO",
  a.settings as "DS_CONFIGURACAO",
  a.created_by as "SQ_USUARIO_INCLUSAO",
  a.created_at as "DT_INCLUSAO",
  a.updated_at as "DT_ATUALIZACAO"
from public.survey_applications a;

create or replace view "DB_PESQUISAS"."VW_SUBMISSAO"
with (security_invoker = true)
as
select
  s.id as "SQ_SUBMISSAO",
  s.application_id as "SQ_APLICACAO",
  s.participant_id as "SQ_PARTICIPANTE",
  s.respondent_person_id as "SQ_PESSOA_RESPONDENTE",
  s.subject_person_id as "SQ_PESSOA_AVALIADA",
  s.submission_type as "TP_SUBMISSAO",
  s.status as "ST_SUBMISSAO",
  s.started_at as "DT_INICIO",
  s.submitted_at as "DT_ENVIO",
  s.version as "NU_VERSAO",
  s.calculated_result as "VL_RESULTADO",
  s.metadata as "DS_METADADO",
  s.created_at as "DT_INCLUSAO",
  s.updated_at as "DT_ATUALIZACAO"
from public.submissions s;

create or replace view "DB_PESQUISAS"."VW_RESPOSTA"
with (security_invoker = true)
as
select
  a.id as "SQ_RESPOSTA",
  a.submission_id as "SQ_SUBMISSAO",
  a.question_id as "SQ_PERGUNTA",
  a.answer_text as "DS_RESPOSTA",
  a.answer_number as "VL_RESPOSTA",
  a.answer_boolean as "ST_RESPOSTA_LOGICA",
  a.answer_date as "DT_RESPOSTA",
  a.answer_datetime as "DT_HR_RESPOSTA",
  a.answer_json as "DS_RESPOSTA_ESTRUTURADA",
  a.score as "VL_PONTUACAO",
  a.created_at as "DT_INCLUSAO",
  a.updated_at as "DT_ATUALIZACAO"
from public.answers a;

create or replace view "DB_PESQUISAS"."VW_RESPOSTA_OPCAO"
with (security_invoker = true)
as
select
  ao.answer_id as "SQ_RESPOSTA",
  ao.option_id as "SQ_OPCAO",
  ao.position as "NU_POSICAO",
  ao.created_at as "DT_INCLUSAO"
from public.answer_options ao;

create or replace view "DB_PESQUISAS"."VW_RESULTADO_COMPETENCIA"
with (security_invoker = true)
as
select
  r.id as "SQ_RESULTADO_COMPETENCIA",
  r.submission_id as "SQ_SUBMISSAO",
  r.competency_section_id as "SQ_SECAO_COMPETENCIA",
  r.behavior_average as "VL_MEDIA_COMPORTAMENTO",
  r.development_level as "VL_NIVEL_DESENVOLVIMENTO",
  r.result as "VL_RESULTADO",
  r.calculation_version as "CO_VERSAO_CALCULO",
  r.created_at as "DT_INCLUSAO",
  r.updated_at as "DT_ATUALIZACAO"
from public.cddi_competency_results r;

create or replace view "DB_PESQUISAS"."VW_RESULTADO_FINAL_CDDI"
with (security_invoker = true)
as
select
  r.id as "SQ_RESULTADO_FINAL",
  r.application_id as "SQ_APLICACAO",
  r.subject_person_id as "SQ_PESSOA_AVALIADA",
  r.auto_submission_id as "SQ_SUBMISSAO_AUTO",
  r.leader_submission_id as "SQ_SUBMISSAO_CHEFIA",
  r.auto_score as "VL_NOTA_AUTO",
  r.leader_score as "VL_NOTA_CHEFIA",
  r.final_score as "VL_NOTA_FINAL",
  r.status as "ST_RESULTADO",
  r.calculation_version as "CO_VERSAO_CALCULO",
  r.calculated_at as "DT_CALCULO",
  r.published_at as "DT_PUBLICACAO",
  r.metadata as "DS_METADADO",
  r.created_at as "DT_INCLUSAO",
  r.updated_at as "DT_ATUALIZACAO"
from public.cddi_final_results r;

comment on view "DB_PESQUISAS"."VW_PESSOA" is 'Visão institucional da base mestra de pessoas.';
comment on view "DB_PESQUISAS"."VW_PESQUISA" is 'Visão institucional do catálogo de pesquisas.';
comment on view "DB_PESQUISAS"."VW_APLICACAO_PESQUISA" is 'Visão institucional dos ciclos de aplicação.';
comment on view "DB_PESQUISAS"."VW_SUBMISSAO" is 'Visão institucional dos envios e rascunhos.';
comment on view "DB_PESQUISAS"."VW_RESPOSTA" is 'Visão institucional das respostas às perguntas.';
comment on view "DB_PESQUISAS"."VW_RESPOSTA_OPCAO" is 'Visão institucional das opções selecionadas.';
comment on view "DB_PESQUISAS"."VW_RESULTADO_COMPETENCIA" is 'Visão institucional dos resultados por competência CDDI.';
comment on view "DB_PESQUISAS"."VW_RESULTADO_FINAL_CDDI" is 'Visão institucional dos resultados finais CDDI.';

grant select on all tables in schema "DB_PESQUISAS" to authenticated, service_role;

-- ----------------------------------------------------------------------------
-- 7. Políticas de RLS
-- ----------------------------------------------------------------------------
-- 78 policies — a definição final de cada
-- (tabela, nome), depois de descartar da história qualquer versão
-- intermediária que uma migration posterior tenha substituído ou removido.
-- Cada uma vem precedida de "drop policy if exists" para o script poder ser
-- reexecutado com segurança.


-- origem: 20260730200000_initial_platform_schema.sql

drop policy if exists "organizational_units_read_authenticated" on sigav.organizational_units;
create policy organizational_units_read_authenticated on sigav.organizational_units for select to authenticated using (true);


-- origem: 20260803165000_harden_runtime_integrity_and_performance.sql

drop policy if exists "people_select_authorized" on sigav.people;
create policy people_select_authorized
on sigav.people
for select to authenticated
using (auth_user_id = (select auth.uid()) or (select sigav.can_audit_platform()));


-- origem: 20260730200000_initial_platform_schema.sql

drop policy if exists "roles_read_authenticated" on sigav.system_roles;
create policy roles_read_authenticated on sigav.system_roles for select to authenticated using (true);

drop policy if exists "role_assignments_read_self_or_privileged" on sigav.person_role_assignments;
create policy role_assignments_read_self_or_privileged on sigav.person_role_assignments for select to authenticated using (person_id = sigav.current_person_id() or sigav.can_audit_platform());

drop policy if exists "surveys_read_authorized" on sigav.surveys;
create policy surveys_read_authorized on sigav.surveys for select to authenticated using (sigav.can_manage_surveys() or exists (select 1 from sigav.survey_versions sv join sigav.survey_applications sa on sa.survey_version_id = sv.id where sv.survey_id = surveys.id and sigav.can_access_application(sa.id)));

drop policy if exists "survey_versions_read_authorized" on sigav.survey_versions;
create policy survey_versions_read_authorized on sigav.survey_versions for select to authenticated using (sigav.can_manage_surveys() or exists (select 1 from sigav.survey_applications sa where sa.survey_version_id = survey_versions.id and sigav.can_access_application(sa.id)));

drop policy if exists "applications_read_authorized" on sigav.survey_applications;
create policy applications_read_authorized on sigav.survey_applications for select to authenticated using (sigav.can_access_application(id));

drop policy if exists "sections_read_authorized" on sigav.survey_sections;
create policy sections_read_authorized on sigav.survey_sections for select to authenticated using (sigav.can_manage_surveys() or exists (select 1 from sigav.survey_applications sa where sa.survey_version_id = survey_sections.survey_version_id and sigav.can_access_application(sa.id)));

drop policy if exists "questions_read_authorized" on sigav.survey_questions;
create policy questions_read_authorized on sigav.survey_questions for select to authenticated using (sigav.can_manage_surveys() or exists (select 1 from sigav.survey_applications sa where sa.survey_version_id = survey_questions.survey_version_id and sigav.can_access_application(sa.id)));

drop policy if exists "options_read_authorized" on sigav.question_options;
create policy options_read_authorized on sigav.question_options for select to authenticated using (sigav.can_manage_surveys() or exists (select 1 from sigav.survey_questions sq join sigav.survey_applications sa on sa.survey_version_id = sq.survey_version_id where sq.id = question_options.question_id and sigav.can_access_application(sa.id)));

drop policy if exists "participants_read_authorized" on sigav.application_participants;
create policy participants_read_authorized on sigav.application_participants for select to authenticated using (person_id = sigav.current_person_id() or sigav.can_manage_surveys());

drop policy if exists "preferences_manage_self" on sigav.user_preferences;
create policy preferences_manage_self on sigav.user_preferences for all to authenticated using (person_id = sigav.current_person_id()) with check (person_id = sigav.current_person_id());


-- origem: 20260823201245_endurecer_auditoria_seguranca.sql

drop policy if exists "submissions_select_authorized" on sigav.submissions;
create policy submissions_select_authorized on sigav.submissions
  for select to authenticated
  using (
    respondent_person_id = sigav.current_person_id()
    or (select sigav.can_manage_surveys())
    or exists (
      select 1
      from sigav.tb_bilhete_anonimo b
      where b.sq_submissao = submissions.id
        and b.sq_pessoa = sigav.current_person_id()
    )
  );


-- origem: 20260731104000_cddi_authenticated_form_flow.sql

drop policy if exists "submissions_insert_own_draft" on sigav.submissions;
create policy submissions_insert_own_draft
on sigav.submissions
for insert
to authenticated
with check (
  sigav.can_manage_surveys()
  or (
    respondent_person_id = sigav.current_person_id()
    and status = 'DRAFT'
    and sigav.can_access_application(application_id)
    and sigav.application_accepts_responses(application_id)
  )
);


-- origem: 20260823201245_endurecer_auditoria_seguranca.sql

drop policy if exists "submissions_update_own_draft" on sigav.submissions;
create policy submissions_update_own_draft on sigav.submissions
  for update to authenticated
  using (
    sigav.can_manage_surveys()
    or (
      respondent_person_id = sigav.current_person_id()
      and status = 'DRAFT'
      and sigav.application_accepts_responses(application_id)
    )
    or (
      status = 'DRAFT'
      and exists (
        select 1
        from sigav.tb_bilhete_anonimo b
        where b.sq_submissao = submissions.id
          and b.sq_pessoa = sigav.current_person_id()
      )
    )
  )
  with check (
    sigav.can_manage_surveys()
    or (
      respondent_person_id = sigav.current_person_id()
      and status = any (array['DRAFT'::text, 'SUBMITTED'::text])
      and sigav.can_access_application(application_id)
      and sigav.application_accepts_responses(application_id)
    )
    or (
      status = 'DRAFT'
      and exists (
        select 1
        from sigav.tb_bilhete_anonimo b
        where b.sq_submissao = submissions.id
          and b.sq_pessoa = sigav.current_person_id()
      )
    )
  );


-- origem: 20260730200000_initial_platform_schema.sql

drop policy if exists "submissions_delete_own_draft" on sigav.submissions;
create policy submissions_delete_own_draft on sigav.submissions for delete to authenticated using (sigav.can_manage_surveys() or (respondent_person_id = sigav.current_person_id() and status = 'DRAFT'));


-- origem: 20260823201245_endurecer_auditoria_seguranca.sql

drop policy if exists "answers_select_authorized" on sigav.answers;
create policy answers_select_authorized on sigav.answers
  for select to authenticated
  using (
    exists (
      select 1
      from sigav.submissions s
      where s.id = answers.submission_id
        and (
          s.respondent_person_id = sigav.current_person_id()
          or (select sigav.can_manage_surveys())
        )
    )
    or exists (
      select 1
      from sigav.tb_bilhete_anonimo b
      where b.sq_submissao = answers.submission_id
        and b.sq_pessoa = sigav.current_person_id()
    )
  );


-- origem: 20260730200000_initial_platform_schema.sql

drop policy if exists "answers_insert_editable_submission" on sigav.answers;
create policy answers_insert_editable_submission on sigav.answers for insert to authenticated with check (sigav.can_edit_submission(submission_id));

drop policy if exists "answers_update_editable_submission" on sigav.answers;
create policy answers_update_editable_submission on sigav.answers for update to authenticated using (sigav.can_edit_submission(submission_id)) with check (sigav.can_edit_submission(submission_id));

drop policy if exists "answers_delete_editable_submission" on sigav.answers;
create policy answers_delete_editable_submission on sigav.answers for delete to authenticated using (sigav.can_edit_submission(submission_id));


-- origem: 20260807150000_simplificar_modelo_papeis.sql

drop policy if exists "answer_options_select_authorized" on sigav.answer_options;
create policy answer_options_select_authorized on sigav.answer_options
  for select to authenticated
  using (
    exists (
      select 1
      from sigav.answers a
      join sigav.submissions s on s.id = a.submission_id
      where a.id = answer_options.answer_id
        and (
          s.respondent_person_id = sigav.current_person_id()
          or (select sigav.can_manage_surveys())
        )
    )
  );


-- origem: 20260730200000_initial_platform_schema.sql

drop policy if exists "answer_options_insert_editable_submission" on sigav.answer_options;
create policy answer_options_insert_editable_submission on sigav.answer_options for insert to authenticated with check (exists (select 1 from sigav.answers a where a.id = answer_options.answer_id and sigav.can_edit_submission(a.submission_id)));

drop policy if exists "answer_options_update_editable_submission" on sigav.answer_options;
create policy answer_options_update_editable_submission on sigav.answer_options for update to authenticated using (exists (select 1 from sigav.answers a where a.id = answer_options.answer_id and sigav.can_edit_submission(a.submission_id))) with check (exists (select 1 from sigav.answers a where a.id = answer_options.answer_id and sigav.can_edit_submission(a.submission_id)));

drop policy if exists "answer_options_delete_editable_submission" on sigav.answer_options;
create policy answer_options_delete_editable_submission on sigav.answer_options for delete to authenticated using (exists (select 1 from sigav.answers a where a.id = answer_options.answer_id and sigav.can_edit_submission(a.submission_id)));

drop policy if exists "audit_events_read_auditor" on sigav.audit_events;
create policy audit_events_read_auditor on sigav.audit_events for select to authenticated using (sigav.can_audit_platform());


-- origem: 20260730203000_cddi_module.sql

drop policy if exists "cddi_link_correction_requests_read" on sigav.cddi_link_correction_requests;
create policy cddi_link_correction_requests_read on sigav.cddi_link_correction_requests for select to authenticated using (requester_person_id = sigav.current_person_id() or sigav.can_audit_platform());

drop policy if exists "cddi_link_correction_requests_insert" on sigav.cddi_link_correction_requests;
create policy cddi_link_correction_requests_insert on sigav.cddi_link_correction_requests for insert to authenticated with check (requester_person_id = sigav.current_person_id() and status = 'PENDING');

drop policy if exists "cddi_link_correction_requests_update" on sigav.cddi_link_correction_requests;
create policy cddi_link_correction_requests_update on sigav.cddi_link_correction_requests for update to authenticated using (sigav.can_manage_surveys()) with check (sigav.can_manage_surveys());


-- origem: 20260731104000_cddi_authenticated_form_flow.sql

drop policy if exists "submissions_insert_own_draft" on sigav.submissions;
create policy submissions_insert_own_draft
on sigav.submissions
for insert
to authenticated
with check (
  sigav.can_manage_surveys()
  or (
    respondent_person_id = sigav.current_person_id()
    and status = 'DRAFT'
    and sigav.can_access_application(application_id)
    and sigav.application_accepts_responses(application_id)
  )
);


-- origem: 20260823201245_endurecer_auditoria_seguranca.sql

drop policy if exists "submissions_update_own_draft" on sigav.submissions;
create policy submissions_update_own_draft on sigav.submissions
  for update to authenticated
  using (
    sigav.can_manage_surveys()
    or (
      respondent_person_id = sigav.current_person_id()
      and status = 'DRAFT'
      and sigav.application_accepts_responses(application_id)
    )
    or (
      status = 'DRAFT'
      and exists (
        select 1
        from sigav.tb_bilhete_anonimo b
        where b.sq_submissao = submissions.id
          and b.sq_pessoa = sigav.current_person_id()
      )
    )
  )
  with check (
    sigav.can_manage_surveys()
    or (
      respondent_person_id = sigav.current_person_id()
      and status = any (array['DRAFT'::text, 'SUBMITTED'::text])
      and sigav.can_access_application(application_id)
      and sigav.application_accepts_responses(application_id)
    )
    or (
      status = 'DRAFT'
      and exists (
        select 1
        from sigav.tb_bilhete_anonimo b
        where b.sq_submissao = submissions.id
          and b.sq_pessoa = sigav.current_person_id()
      )
    )
  );


-- origem: 20260731130000_technical_team_role_and_avatars.sql

drop policy if exists "avatar_owner_insert" on storage.objects;
create policy "avatar_owner_insert"
on storage.objects for insert
to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar_owner_update" on storage.objects;
create policy "avatar_owner_update"
on storage.objects for update
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatar_owner_delete" on storage.objects;
create policy "avatar_owner_delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);


-- origem: 20260803165000_harden_runtime_integrity_and_performance.sql

drop policy if exists "institutional_domains_privileged_read" on sigav.institutional_domains;
create policy institutional_domains_privileged_read
on sigav.institutional_domains
for select to authenticated
using ((select sigav.can_manage_surveys()) or (select sigav.can_audit_platform()));

drop policy if exists "people_select_authorized" on sigav.people;
create policy people_select_authorized
on sigav.people
for select to authenticated
using (auth_user_id = (select auth.uid()) or (select sigav.can_audit_platform()));

drop policy if exists "cddi_competency_results_select" on sigav.cddi_competency_results;
create policy cddi_competency_results_select on sigav.cddi_competency_results for select to authenticated
using ((select sigav.can_manage_surveys()) or (select sigav.can_audit_platform()) or exists (
  select 1 from sigav.submissions s where s.id=cddi_competency_results.submission_id
  and (s.respondent_person_id=(select sigav.current_person_id()) or s.subject_person_id=(select sigav.current_person_id()))
));

drop policy if exists "cddi_competency_results_insert" on sigav.cddi_competency_results;
create policy cddi_competency_results_insert on sigav.cddi_competency_results for insert to authenticated with check ((select sigav.can_manage_surveys()));

drop policy if exists "cddi_competency_results_update" on sigav.cddi_competency_results;
create policy cddi_competency_results_update on sigav.cddi_competency_results for update to authenticated using ((select sigav.can_manage_surveys())) with check ((select sigav.can_manage_surveys()));

drop policy if exists "cddi_competency_results_delete" on sigav.cddi_competency_results;
create policy cddi_competency_results_delete on sigav.cddi_competency_results for delete to authenticated using ((select sigav.can_manage_surveys()));

drop policy if exists "cddi_final_results_select" on sigav.cddi_final_results;
create policy cddi_final_results_select on sigav.cddi_final_results for select to authenticated
using ((select sigav.can_manage_surveys()) or (select sigav.can_audit_platform()) or (subject_person_id=(select sigav.current_person_id()) and status='PUBLISHED'));

drop policy if exists "cddi_final_results_insert" on sigav.cddi_final_results;
create policy cddi_final_results_insert on sigav.cddi_final_results for insert to authenticated with check ((select sigav.can_manage_surveys()));

drop policy if exists "cddi_final_results_update" on sigav.cddi_final_results;
create policy cddi_final_results_update on sigav.cddi_final_results for update to authenticated using ((select sigav.can_manage_surveys())) with check ((select sigav.can_manage_surveys()));

drop policy if exists "cddi_final_results_delete" on sigav.cddi_final_results;
create policy cddi_final_results_delete on sigav.cddi_final_results for delete to authenticated using ((select sigav.can_manage_surveys()));

drop policy if exists "cddi_leadership_links_select" on sigav.cddi_leadership_links;
create policy cddi_leadership_links_select on sigav.cddi_leadership_links for select to authenticated
using ((select sigav.can_manage_surveys()) or (select sigav.can_audit_platform()) or leader_person_id=(select sigav.current_person_id()) or subordinate_person_id=(select sigav.current_person_id()));

drop policy if exists "cddi_leadership_links_insert" on sigav.cddi_leadership_links;
create policy cddi_leadership_links_insert on sigav.cddi_leadership_links for insert to authenticated with check ((select sigav.can_manage_surveys()));

drop policy if exists "cddi_leadership_links_update" on sigav.cddi_leadership_links;
create policy cddi_leadership_links_update on sigav.cddi_leadership_links for update to authenticated using ((select sigav.can_manage_surveys())) with check ((select sigav.can_manage_surveys()));

drop policy if exists "cddi_leadership_links_delete" on sigav.cddi_leadership_links;
create policy cddi_leadership_links_delete on sigav.cddi_leadership_links for delete to authenticated using ((select sigav.can_manage_surveys()));

drop policy if exists "data_import_batches_select" on sigav.data_import_batches;
create policy data_import_batches_select on sigav.data_import_batches for select to authenticated using ((select sigav.can_manage_surveys()) or (select sigav.can_audit_platform()));

drop policy if exists "data_import_batches_insert" on sigav.data_import_batches;
create policy data_import_batches_insert on sigav.data_import_batches for insert to authenticated with check ((select sigav.can_manage_surveys()));

drop policy if exists "data_import_batches_update" on sigav.data_import_batches;
create policy data_import_batches_update on sigav.data_import_batches for update to authenticated using ((select sigav.can_manage_surveys())) with check ((select sigav.can_manage_surveys()));

drop policy if exists "data_import_batches_delete" on sigav.data_import_batches;
create policy data_import_batches_delete on sigav.data_import_batches for delete to authenticated using ((select sigav.can_manage_surveys()));

drop policy if exists "data_import_issues_select" on sigav.data_import_issues;
create policy data_import_issues_select on sigav.data_import_issues for select to authenticated using ((select sigav.can_manage_surveys()) or (select sigav.can_audit_platform()));

drop policy if exists "data_import_issues_insert" on sigav.data_import_issues;
create policy data_import_issues_insert on sigav.data_import_issues for insert to authenticated with check ((select sigav.can_manage_surveys()));

drop policy if exists "data_import_issues_update" on sigav.data_import_issues;
create policy data_import_issues_update on sigav.data_import_issues for update to authenticated using ((select sigav.can_manage_surveys())) with check ((select sigav.can_manage_surveys()));

drop policy if exists "data_import_issues_delete" on sigav.data_import_issues;
create policy data_import_issues_delete on sigav.data_import_issues for delete to authenticated using ((select sigav.can_manage_surveys()));

drop policy if exists "person_access_identities_select" on sigav.person_access_identities;
create policy person_access_identities_select on sigav.person_access_identities for select to authenticated
using ((select sigav.can_manage_surveys()) or (select sigav.can_audit_platform()) or person_id=(select sigav.current_person_id()));

drop policy if exists "person_access_identities_insert" on sigav.person_access_identities;
create policy person_access_identities_insert on sigav.person_access_identities for insert to authenticated with check ((select sigav.can_manage_surveys()));

drop policy if exists "person_access_identities_update" on sigav.person_access_identities;
create policy person_access_identities_update on sigav.person_access_identities for update to authenticated using ((select sigav.can_manage_surveys())) with check ((select sigav.can_manage_surveys()));

drop policy if exists "person_access_identities_delete" on sigav.person_access_identities;
create policy person_access_identities_delete on sigav.person_access_identities for delete to authenticated using ((select sigav.can_manage_surveys()));


-- origem: 20260804131000_application_visual_settings.sql

drop policy if exists "survey_assets_manage_insert" on storage.objects;
create policy survey_assets_manage_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'survey-assets'
  and sigav.can_manage_surveys()
);

drop policy if exists "survey_assets_manage_update" on storage.objects;
create policy survey_assets_manage_update
on storage.objects
for update
to authenticated
using (
  bucket_id = 'survey-assets'
  and sigav.can_manage_surveys()
)
with check (
  bucket_id = 'survey-assets'
  and sigav.can_manage_surveys()
);

drop policy if exists "survey_assets_manage_delete" on storage.objects;
create policy survey_assets_manage_delete
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'survey-assets'
  and sigav.can_manage_surveys()
);


-- origem: 20260804151807_fix_survey_assets_upsert_policy.sql

drop policy if exists "survey_assets_manage_select" on storage.objects;
create policy survey_assets_manage_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'survey-assets'
  and sigav.can_manage_surveys()
);


-- origem: 20260806123500_endurecer_governanca_banco.sql

drop policy if exists "pl_tb_catalogo_objeto_servico" on db_governanca.tb_catalogo_objeto;
create policy pl_tb_catalogo_objeto_servico
on db_governanca.tb_catalogo_objeto
for all
to service_role
using (true)
with check (true);


-- origem: 20260806140500_observabilidade_erros_aplicacao.sql

drop policy if exists "tl_erro_aplicacao_service_role" on sigav.tl_erro_aplicacao;
create policy tl_erro_aplicacao_service_role
on sigav.tl_erro_aplicacao
for all
to service_role
using (true)
with check (true);


-- origem: 20260807093000_platform_branding_settings.sql

drop policy if exists "platform_assets_manage_select" on storage.objects;
create policy platform_assets_manage_select
on storage.objects for select to authenticated
using (bucket_id = 'platform-assets' and sigav.can_manage_surveys());

drop policy if exists "platform_assets_manage_insert" on storage.objects;
create policy platform_assets_manage_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'platform-assets'
  and name like 'branding/%'
  and sigav.can_manage_surveys()
);

drop policy if exists "platform_assets_manage_update" on storage.objects;
create policy platform_assets_manage_update
on storage.objects for update to authenticated
using (bucket_id = 'platform-assets' and sigav.can_manage_surveys())
with check (
  bucket_id = 'platform-assets'
  and name like 'branding/%'
  and sigav.can_manage_surveys()
);

drop policy if exists "platform_assets_manage_delete" on storage.objects;
create policy platform_assets_manage_delete
on storage.objects for delete to authenticated
using (bucket_id = 'platform-assets' and sigav.can_manage_surveys());


-- origem: 20260823201245_endurecer_auditoria_seguranca.sql

drop policy if exists "submissions_select_authorized" on sigav.submissions;
create policy submissions_select_authorized on sigav.submissions
  for select to authenticated
  using (
    respondent_person_id = sigav.current_person_id()
    or (select sigav.can_manage_surveys())
    or exists (
      select 1
      from sigav.tb_bilhete_anonimo b
      where b.sq_submissao = submissions.id
        and b.sq_pessoa = sigav.current_person_id()
    )
  );

drop policy if exists "answers_select_authorized" on sigav.answers;
create policy answers_select_authorized on sigav.answers
  for select to authenticated
  using (
    exists (
      select 1
      from sigav.submissions s
      where s.id = answers.submission_id
        and (
          s.respondent_person_id = sigav.current_person_id()
          or (select sigav.can_manage_surveys())
        )
    )
    or exists (
      select 1
      from sigav.tb_bilhete_anonimo b
      where b.sq_submissao = answers.submission_id
        and b.sq_pessoa = sigav.current_person_id()
    )
  );


-- origem: 20260807150000_simplificar_modelo_papeis.sql

drop policy if exists "answer_options_select_authorized" on sigav.answer_options;
create policy answer_options_select_authorized on sigav.answer_options
  for select to authenticated
  using (
    exists (
      select 1
      from sigav.answers a
      join sigav.submissions s on s.id = a.submission_id
      where a.id = answer_options.answer_id
        and (
          s.respondent_person_id = sigav.current_person_id()
          or (select sigav.can_manage_surveys())
        )
    )
  );


-- origem: 20260813220000_anonimato_estrutural.sql

drop policy if exists "bilhete_anonimo_select_proprio" on sigav.tb_bilhete_anonimo;
create policy bilhete_anonimo_select_proprio on sigav.tb_bilhete_anonimo
  for select to authenticated
  using (sq_pessoa = sigav.current_person_id());


-- origem: 20260819135306_configurar_presenca_online.sql

drop policy if exists "configured profiles can read platform presence" on realtime.messages;
create policy "configured profiles can read platform presence"
on realtime.messages for select to authenticated
using (
  (select realtime.topic()) = 'platform-online'
  and realtime.messages.extension = 'presence'
  and (select private.can_view_platform_presence())
);

drop policy if exists "configured profiles can track platform presence" on realtime.messages;
create policy "configured profiles can track platform presence"
on realtime.messages for insert to authenticated
with check (
  (select realtime.topic()) = 'platform-online'
  and realtime.messages.extension = 'presence'
  and (select private.can_track_platform_presence())
);


-- origem: 20260823201245_endurecer_auditoria_seguranca.sql

drop policy if exists "answers_select_authorized" on sigav.answers;
create policy answers_select_authorized on sigav.answers
  for select to authenticated
  using (
    exists (
      select 1
      from sigav.submissions s
      where s.id = answers.submission_id
        and (
          s.respondent_person_id = sigav.current_person_id()
          or (select sigav.can_manage_surveys())
        )
    )
    or exists (
      select 1
      from sigav.tb_bilhete_anonimo b
      where b.sq_submissao = answers.submission_id
        and b.sq_pessoa = sigav.current_person_id()
    )
  );

drop policy if exists "submissions_select_authorized" on sigav.submissions;
create policy submissions_select_authorized on sigav.submissions
  for select to authenticated
  using (
    respondent_person_id = sigav.current_person_id()
    or (select sigav.can_manage_surveys())
    or exists (
      select 1
      from sigav.tb_bilhete_anonimo b
      where b.sq_submissao = submissions.id
        and b.sq_pessoa = sigav.current_person_id()
    )
  );

drop policy if exists "submissions_update_own_draft" on sigav.submissions;
create policy submissions_update_own_draft on sigav.submissions
  for update to authenticated
  using (
    sigav.can_manage_surveys()
    or (
      respondent_person_id = sigav.current_person_id()
      and status = 'DRAFT'
      and sigav.application_accepts_responses(application_id)
    )
    or (
      status = 'DRAFT'
      and exists (
        select 1
        from sigav.tb_bilhete_anonimo b
        where b.sq_submissao = submissions.id
          and b.sq_pessoa = sigav.current_person_id()
      )
    )
  )
  with check (
    sigav.can_manage_surveys()
    or (
      respondent_person_id = sigav.current_person_id()
      and status = any (array['DRAFT'::text, 'SUBMITTED'::text])
      and sigav.can_access_application(application_id)
      and sigav.application_accepts_responses(application_id)
    )
    or (
      status = 'DRAFT'
      and exists (
        select 1
        from sigav.tb_bilhete_anonimo b
        where b.sq_submissao = submissions.id
          and b.sq_pessoa = sigav.current_person_id()
      )
    )
  );

commit;

-- ============================================================================
-- APÊNDICE — statements do histórico descartados por não terem alvo vivo
-- ============================================================================
-- Não fazem parte da transação acima. Ficam aqui só para quem for revisar
-- confirmar que a exclusão foi consciente, não um esquecimento.
--
-- Funções genuinamente removidas/renomeadas ao longo da história (confirmado
-- contra supabase/CLAUDE.md e o catálogo ao vivo):
--   - can_audit_platform() / can_edit_submission(uuid): mudaram de "public"
--     para o schema "private" em 20260804172000 — os grants corretos para
--     private.can_audit_platform()/private.can_edit_submission(uuid) JÁ
--     estão na seção 5, vindos daquela mesma migration.
--   - get_my_platform_context(): removida em 20260807150000, substituída por
--     fc_obter_contexto_plataforma().
--   - search_cddi_leaders(...) / set_my_cddi_leader(...): seleção manual de
--     chefia foi removida em 20260807151000.
--   - fc_bloquear_aplicacao_anonima() / fc_definir_visual_acesso(...) /
--     fc_reivindicar_emails_lote(...) / fc_liberar_emails_travados():
--     substituídas por versões renomeadas em migrations posteriores
--     (ex.: fc_definir_fundo_acesso, fc_definir_cor_painel_acesso,
--     fc_srv_reivindicar_emails, fc_srv_expirar_rascunhos_anon) — os grants
--     das versões atuais já estão cobertos pela seção 4 (bulk) e pela
--     seção 5 onde havia statement explícito com o nome atual.
--
-- [grant] origem 20260730200000_initial_platform_schema.sql: grant execute on function sigav.can_audit_platform() to authenticated;
-- [grant] origem 20260730200000_initial_platform_schema.sql: grant execute on function sigav.can_edit_submission(uuid) to authenticated;
-- [grant] origem 20260731115500_platform_navigation_permissions.sql: grant execute on function sigav.get_my_platform_context() to authenticated;
-- [grant] origem 20260803123000_cddi_identity_and_leader_selection.sql: grant execute on function sigav.search_cddi_leaders(text, text) to authenticated;
-- [grant] origem 20260803123000_cddi_identity_and_leader_selection.sql: grant execute on function sigav.set_my_cddi_leader(text, uuid) to authenticated;
-- [grant] origem 20260805184500_institutional_naming_views.sql: grant usage on schema "DB_PESQUISAS" to authenticated, service_role;
-- [grant] origem 20260805184500_institutional_naming_views.sql: grant select on all tables in schema "DB_PESQUISAS" to authenticated, service_role;
-- [grant] origem 20260812151000_bloquear_aplicacao_anonima_ate_anonimato_estrutural.sql: revoke all on function sigav.fc_bloquear_aplicacao_anonima() from public, anon, authenticated, service_role;
-- [grant] origem 20260813230000_fundo_tela_acesso.sql: revoke all on function sigav.fc_definir_visual_acesso(text, text, text) from public, anon;
-- [grant] origem 20260813230000_fundo_tela_acesso.sql: grant execute on function sigav.fc_definir_visual_acesso(text, text, text) to authenticated;
-- [grant] origem 20260820120000_central_de_emails.sql: revoke all on function sigav.fc_reivindicar_emails_lote(integer) from public, anon;
-- [grant] origem 20260820120000_central_de_emails.sql: grant execute on function sigav.fc_reivindicar_emails_lote(integer) to authenticated;
-- [grant] origem 20260820180000_claim_de_email_expira.sql: revoke all on function sigav.fc_liberar_emails_travados() from public, anon, authenticated;
