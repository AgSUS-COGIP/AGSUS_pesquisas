-- Reconciliação do histórico de migrations.
--
-- CONTEXTO: 48 migrations do repositório não constam em
-- `supabase_migrations.schema_migrations`, embora os objetos que elas criam
-- EXISTAM no banco (verificado objeto a objeto em 12/08/2026: tabelas, funções,
-- índices e triggers). O SQL foi aplicado sem passar pelo CLI, então o registro
-- ficou com timestamps próprios em vez do nome do arquivo.
--
-- EFEITO PRÁTICO DA DIVERGÊNCIA: `supabase db push` tentaria reaplicar as 48,
-- todas com objetos já existentes — cascata de erros e risco de banco
-- meio-aplicado. Este script registra as migrations como já aplicadas, SEM
-- executar o SQL delas, alinhando histórico e realidade.
--
-- ORDEM OBRIGATÓRIA: aplique ANTES a migration
-- 20260810141000_usar_foto_google_automaticamente.sql, que é a única com lacuna
-- real (o banco ainda tem `prevent_uploaded_profile_photos` em vez de
-- `fc_validar_foto_google`). Registrá-la aqui sem aplicar tornaria a lacuna
-- permanente e invisível.
--
-- `on conflict do nothing` torna a execução repetível sem efeito colateral.

begin;

insert into supabase_migrations.schema_migrations (version, name) values
  ('20260730200000', 'initial_platform_schema'),
  ('20260730203000', 'cddi_module'),
  ('20260730203500', 'seed_cddi_2026'),
  ('20260730211500', 'public_form_definition'),
  ('20260730211600', 'authenticated_participant_access'),
  ('20260731104000', 'cddi_authenticated_form_flow'),
  ('20260731115500', 'platform_navigation_permissions'),
  ('20260731130000', 'technical_team_role_and_avatars'),
  ('20260731131500', 'create_survey_draft_rpc'),
  ('20260731180000', 'team_and_survey_builder'),
  ('20260731190000', 'platform_administrator_access'),
  ('20260731190500', 'normalize_platform_administrator'),
  ('20260803104000', 'restore_platform_context_and_team_search'),
  ('20260803105500', 'generic_survey_runtime_and_catalog'),
  ('20260803120000', 'cddi_monitoring_dashboard_rpc'),
  ('20260803120500', 'improve_survey_cycle_state_machine'),
  ('20260803123000', 'cddi_identity_and_leader_selection'),
  ('20260803133000', 'institutional_access_schema'),
  ('20260803133100', 'fix_generic_survey_runtime'),
  ('20260803133200', 'fix_survey_cycle_reopening'),
  ('20260803133300', 'harden_rpc_permissions'),
  ('20260803165000', 'harden_runtime_integrity_and_performance'),
  ('20260803180500', 'people_base_avatar_policy'),
  ('20260804131000', 'application_visual_settings'),
  ('20260804143000', 'harden_application_visual_settings'),
  ('20260804151807', 'fix_survey_assets_upsert_policy'),
  ('20260805114500', 'bulk_assign_application_participants'),
  ('20260805133500', 'admin_people_teams_foundation'),
  ('20260805184500', 'institutional_naming_views'),
  ('20260805194500', 'block_uploaded_profile_photos'),
  ('20260805194600', 'assign_all_available_participants'),
  ('20260805200500', 'sync_google_avatar_from_auth'),
  ('20260806100500', 'fix_cddi_leader_submission_requirement'),
  ('20260806121000', 'catalogo_conformidade_nomenclatura'),
  ('20260806123000', 'integrate_manager_import_and_survey_dashboards'),
  ('20260806123500', 'endurecer_governanca_banco'),
  ('20260806133000', 'harden_survey_runtime_for_concurrency'),
  ('20260806140500', 'observabilidade_erros_aplicacao'),
  ('20260807093000', 'platform_branding_settings'),
  ('20260807101500', 'team_avatar_contracts'),
  ('20260807113000', 'fix_cddi_leader_submission_contract'),
  ('20260807150000', 'simplificar_modelo_papeis'),
  ('20260807150500', 'renomear_modulo_avaliacoes'),
  ('20260807151000', 'remover_selecao_manual_chefia'),
  ('20260807151500', 'listar_ciclos_lideranca'),
  ('20260810130000', 'restaurar_catalogo_modulos_plataforma'),
  ('20260810141000', 'usar_foto_google_automaticamente'),
  ('20260810150000', 'habilitar_rls_dominios_institucionais')
on conflict (version) do nothing;

commit;

-- Conferência (deve devolver 63, igual ao número de arquivos do repositório):
-- select count(*) from supabase_migrations.schema_migrations
-- where version in (select version from supabase_migrations.schema_migrations);
--
-- Rollback (desfaz apenas o registro, nunca o esquema):
-- begin;
--   delete from supabase_migrations.schema_migrations
--   where version in ('20260730200000', '20260730203000' /* … as 48 … */);
-- commit;
