-- Nomenclatura institucional para FUNÇÕES, TRIGGERS e POLICIES de `sigav`.
--
-- Completa 20260831150000 (tabelas, constraints e índices) aplicando o mesmo
-- "Padrão Institucional de Nomenclatura" da AgSUS (UTIC, maio/2026, v1.0):
--   item 3 — MAIÚSCULAS, português, no máximo 30 caracteres;
--   item 9 — `FC_` para function; `TBI_/TAI_`, `TBU_/TAU_`, `TBD_/TAD_`,
--            `TBA_/TAA_` e `TIO_` para trigger, conforme momento e evento.
--
-- Como nas tabelas, o identificador é CITADO: `sigav."FC_PESSOA_SESSAO"()`.
-- O adaptador de RPC do app já cita nome de função e de argumento
-- (`quoteIdent` em src/lib/db/rpc-adapter.ts), então a chamada continua
-- funcionando — o que muda é a string do nome, atualizada no mesmo commit.
--
-- NÃO MUDAM, porque são contrato com o frontend:
--   - nomes de PARÂMETRO das funções (o adaptador resolve por nome);
--   - colunas declaradas em `returns table(...)` — viram chave JSON quando o
--     shape é "set" (`FC_REIVINDICAR_ACESSO`, `FC_ARQ_LISTAR` e outras 4);
--   - chaves de `jsonb_build_object` nos corpos.
--
-- As 36 funções da extensão pgcrypto ficam de fora: o nome pertence à extensão.
--
-- Corpo de função é texto resolvido em execução. Toda chamada entre funções
-- deste schema é qualificada (`sigav.<nome>(`) — 441 ocorrências verificadas,
-- e as 2 menções nuas restantes estão em comentário. A seção 4 reescreve as
-- afetadas trocando só essas chamadas qualificadas.

begin;

-- ---------------------------------------------------------------------------
-- 1. Funções (item 9)
-- ---------------------------------------------------------------------------

alter function sigav.add_person_to_my_team(target_application_id uuid, target_person_id uuid) rename to "FC_INCLUIR_PESSOA_EQUIPE";
alter function sigav.add_survey_question(target_survey_id uuid, target_section_id uuid, question_title text, question_description text, question_type text, is_required boolean, question_options jsonb) rename to "FC_INCLUIR_PERGUNTA";
alter function sigav.add_survey_section(target_survey_id uuid, section_title text, section_description text) rename to "FC_INCLUIR_SECAO";
alter function sigav.application_accepts_responses(target_application_id uuid) rename to "FC_CICLO_ACEITA_RESPOSTA";
alter function sigav.assign_admin_all_available_participants(target_application_id uuid, target_access_profile text) rename to "FC_ATRIB_TODOS_DISPONIVEIS";
alter function sigav.assign_admin_application_participant(target_application_id uuid, target_person_id uuid, target_access_profile text) rename to "FC_ATRIB_PARTICIPANTE";
alter function sigav.assign_admin_application_participants_bulk(target_application_id uuid, target_person_ids uuid[], target_access_profile text) rename to "FC_ATRIB_PARTICIPANTE_LOTE";
alter function sigav.can_access_application(target_application_id uuid) rename to "FC_PODE_ACESSAR_CICLO";
alter function sigav.can_audit_platform() rename to "FC_PODE_AUDITAR";
alter function sigav.can_edit_submission(target_submission_id uuid) rename to "FC_PODE_EDITAR_SUBMISSAO";
alter function sigav.can_manage_surveys() rename to "FC_PODE_GERIR_PESQUISA";
alter function sigav.can_track_platform_presence() rename to "FC_PODE_REGISTRAR_PRESENCA";
alter function sigav.can_view_platform_presence() rename to "FC_PODE_VER_PRESENCA";
alter function sigav.claim_my_access() rename to "FC_REIVINDICAR_ACESSO";
alter function sigav.create_and_assign_admin_participant(target_application_id uuid, target_employee_number text, target_full_name text, target_institutional_email text, target_job_title text, target_cost_center text, target_workplace text, target_access_profile text) rename to "FC_CRIAR_E_ATRIB_PARTIC";
alter function sigav.create_survey_draft(p_code text, p_name text, p_description text, p_application_name text, p_opens_at timestamp with time zone, p_closes_at timestamp with time zone, p_anonymous boolean, p_allow_drafts boolean) rename to "FC_CRIAR_RASCUNHO_PESQUISA";
alter function sigav.current_person_id() rename to "FC_PESSOA_SESSAO";
alter function sigav.delete_survey_question(target_question_id uuid) rename to "FC_EXCLUIR_PERGUNTA";
alter function sigav.duplicate_survey_builder_item(target_item_type text, target_item_id uuid) rename to "FC_DUPLICAR_ITEM_CONSTRUTOR";
alter function sigav.effective_platform_modules(target_person_id uuid) rename to "FC_MODULOS_EFETIVOS";
alter function sigav.enforce_draft_survey_structure() rename to "FC_EXIGIR_RASCUNHO_ESTRUT";
alter function sigav.fc_abrir_ciclos_agendados() rename to "FC_ABRIR_CICLOS_AGENDADOS";
alter function sigav.fc_agendar_envio_manual(p_aplicacao uuid, p_pessoas uuid[]) rename to "FC_AGENDAR_ENVIO_MANUAL";
alter function sigav.fc_alvo_visivel(p_submissao uuid, p_alvo uuid) rename to "FC_ALVO_VISIVEL";
alter function sigav.fc_aplicar_publico_avaliacao(p_aplicacao uuid, p_regra jsonb, p_perfil_acesso text) rename to "FC_APLICAR_PUBLICO_AVALIACAO";
alter function sigav.fc_arq_gravar(p_balde text, p_caminho text, p_tipo text, p_conteudo_base64 text) rename to "FC_ARQ_GRAVAR";
alter function sigav.fc_arq_listar(p_balde text, p_prefixo text) rename to "FC_ARQ_LISTAR";
alter function sigav.fc_arq_obter(p_balde text, p_caminho text) rename to "FC_ARQ_OBTER";
alter function sigav.fc_arq_remover(p_balde text, p_caminho text) rename to "FC_ARQ_REMOVER";
alter function sigav.fc_atualizar_marca_plataforma(no_organizacao_param text, no_produto_param text, tx_url_logotipo_param text, tx_caminho_param text, co_cor_principal_param text) rename to "FC_ATUALIZAR_MARCA_PLATAFORMA";
alter function sigav.fc_buscar_pessoas_publico(p_busca text, p_limite integer, p_regra jsonb) rename to "FC_BUSCAR_PESSOAS_PUBLICO";
alter function sigav.fc_cancela_ciclos_arq() rename to "FC_CANCELA_CICLOS_ARQ";
alter function sigav.fc_claims_sessao() rename to "FC_CLAIMS_SESSAO";
alter function sigav.fc_clonar_pesquisa(p_pesquisa uuid, p_nome text, p_codigo text) rename to "FC_CLONAR_PESQUISA";
alter function sigav.fc_clonar_pesquisa_estrutura(p_pesquisa uuid, p_nome text, p_codigo text) rename to "FC_CLONAR_PESQUISA_ESTRUTURA";
alter function sigav.fc_concluir_email_participante(target_email_id uuid, target_success boolean, target_error text) rename to "FC_CONCLUIR_EMAIL_PARTICIPANTE";
alter function sigav.fc_concluir_email_participante(target_email_id uuid, target_claim_token uuid, target_success boolean, target_error text) rename to "FC_CONCLUIR_EMAIL_PARTICIPANTE";
alter function sigav.fc_condicao_atendida(p_submissao uuid, p_condicao uuid) rename to "FC_CONDICAO_ATENDIDA";
alter function sigav.fc_criar_nova_versao_pesquisa(p_pesquisa uuid) rename to "FC_CRIAR_NOVA_VERSAO_PESQUISA";
alter function sigav.fc_definir_comunicado_inicio(p_ativo boolean, p_titulo text, p_mensagem text, p_link text, p_rotulo_link text) rename to "FC_DEFINIR_COMUNICADO_INICIO";
alter function sigav.fc_definir_cor_barra_lateral(p_cor text) rename to "FC_DEFINIR_COR_BARRA_LATERAL";
alter function sigav.fc_definir_cor_painel_acesso(p_cor text) rename to "FC_DEFINIR_COR_PAINEL_ACESSO";
alter function sigav.fc_definir_fundo_acesso(p_url text, p_caminho text) rename to "FC_DEFINIR_FUNDO_ACESSO";
alter function sigav.fc_definir_modelo_avaliacao(p_pesquisa uuid, p_modelo boolean, p_categoria text) rename to "FC_DEFINIR_MODELO_AVALIACAO";
alter function sigav.fc_definir_notificacao_email(target_survey_id uuid, target_enabled boolean) rename to "FC_DEFINIR_NOTIFICACAO_EMAIL";
alter function sigav.fc_definir_permissoes_pessoa(p_pessoa uuid, p_permissoes text[]) rename to "FC_DEFINIR_PERMISSOES_PESSOA";
alter function sigav.fc_definir_presenca_plataforma(fl_ativa_param boolean) rename to "FC_DEFINIR_PRESENCA_PLATAFORMA";
alter function sigav.fc_definir_retencao_anonima(p_dias integer) rename to "FC_DEFINIR_RETENCAO_ANONIMA";
alter function sigav.fc_definir_textos_email(p_instrucao text, p_rodape text) rename to "FC_DEFINIR_TEXTOS_EMAIL";
alter function sigav.fc_definir_textos_marca(p_expansao text, p_saudacao text, p_instrucao text) rename to "FC_DEFINIR_TEXTOS_MARCA";
alter function sigav.fc_dimensao_publico_atende(p_valor text, p_selecionados jsonb) rename to "FC_DIMENSAO_PUBLICO_ATENDE";
alter function sigav.fc_enviar_resp_anon(target_submission_id uuid, target_session_token text) rename to "FC_ENVIAR_RESP_ANON";
alter function sigav.fc_excluir_pesquisa_arquivada(p_pesquisa uuid) rename to "FC_EXCLUIR_PESQUISA_ARQUIVADA";
alter function sigav.fc_excluir_pesquisa_rascunho(p_pesquisa uuid) rename to "FC_EXCLUIR_PESQUISA_RASCUNHO";
alter function sigav.fc_excluir_regra_condicional(p_alvo uuid) rename to "FC_EXCLUIR_REGRA_CONDICIONAL";
alter function sigav.fc_expirar_pesquisas_arq() rename to "FC_EXPIRAR_PESQUISAS_ARQ";
alter function sigav.fc_expirar_rascunhos_anonimos() rename to "FC_EXPIRAR_RASCUNHOS_ANONIMOS";
alter function sigav.fc_gravar_resp_anon(target_submission_id uuid, target_session_token text, target_question_id uuid, target_option_ids uuid[], target_text text, target_number numeric, target_boolean boolean, target_date date, target_datetime timestamp with time zone, target_json jsonb) rename to "FC_GRAVAR_RESP_ANON";
alter function sigav.fc_iniciar_resp_anon(target_application_code text) rename to "FC_INICIAR_RESP_ANON";
alter function sigav.fc_listar_acessos_paginados(p_busca text, p_limite integer, p_offset integer) rename to "FC_LISTAR_ACESSOS_PAGINADOS";
alter function sigav.fc_listar_audiencia_email(p_aplicacao uuid, p_situacao text, p_busca text, p_limite integer) rename to "FC_LISTAR_AUDIENCIA_EMAIL";
alter function sigav.fc_listar_auditoria_pessoa(target_person_id uuid, target_limit integer) rename to "FC_LISTAR_AUDITORIA_PESSOA";
alter function sigav.fc_listar_ciclos_lideranca() rename to "FC_LISTAR_CICLOS_LIDERANCA";
alter function sigav.fc_listar_ciclos_lideranca_adm() rename to "FC_LISTAR_CICLOS_LIDERANCA_ADM";
alter function sigav.fc_listar_ciclos_pesquisa(p_codigo_pesquisa text) rename to "FC_LISTAR_CICLOS_PESQUISA";
alter function sigav.fc_listar_dimensoes_publico(p_regra jsonb) rename to "FC_LISTAR_DIMENSOES_PUBLICO";
alter function sigav.fc_listar_envios_email(p_aplicacao uuid, p_situacao text, p_limite integer) rename to "FC_LISTAR_ENVIOS_EMAIL";
alter function sigav.fc_listar_modelos_avaliacao() rename to "FC_LISTAR_MODELOS_AVALIACAO";
alter function sigav.fc_listar_pesquisas_arq() rename to "FC_LISTAR_PESQUISAS_ARQ";
alter function sigav.fc_listar_pessoas_sem_chefia(target_application_id uuid, target_search text, target_limit integer) rename to "FC_LISTAR_PESSOAS_SEM_CHEFIA";
alter function sigav.fc_listar_presenca_online() rename to "FC_LISTAR_PRESENCA_ONLINE";
alter function sigav.fc_listar_regras_condicionais(p_versao uuid) rename to "FC_LISTAR_REGRAS_CONDICIONAIS";
alter function sigav.fc_listar_respostas_ciclo(p_codigo_ciclo text, p_busca text, p_limite integer) rename to "FC_LISTAR_RESPOSTAS_CICLO";
alter function sigav.fc_normalizar_rotulo(p_valor text) rename to "FC_NORMALIZAR_ROTULO";
alter function sigav.fc_obter_ciclo_cddi_vigente() rename to "FC_OBTER_CICLO_CDDI_VIGENTE";
alter function sigav.fc_obter_contexto_plataforma() rename to "FC_OBTER_CONTEXTO_PLATAFORMA";
alter function sigav.fc_obter_form_anonimo(target_application_code text) rename to "FC_OBTER_FORM_ANONIMO";
alter function sigav.fc_obter_formulario_publico(target_application_code text) rename to "FC_OBTER_FORMULARIO_PUBLICO";
alter function sigav.fc_obter_marca_plataforma() rename to "FC_OBTER_MARCA_PLATAFORMA";
alter function sigav.fc_obter_marca_publica() rename to "FC_OBTER_MARCA_PUBLICA";
alter function sigav.fc_obter_minha_equipe(target_application_code text) rename to "FC_OBTER_MINHA_EQUIPE";
alter function sigav.fc_obter_painel_pesquisa(target_application_code text) rename to "FC_OBTER_PAINEL_PESQUISA";
alter function sigav.fc_obter_regras_do_ciclo(p_codigo_ciclo text) rename to "FC_OBTER_REGRAS_DO_CICLO";
alter function sigav.fc_origens_da_regra(p_alvo uuid) rename to "FC_ORIGENS_DA_REGRA";
alter function sigav.fc_papel_sessao() rename to "FC_PAPEL_SESSAO";
alter function sigav.fc_pergunta_visivel(p_submissao uuid, p_pergunta uuid) rename to "FC_PERGUNTA_VISIVEL";
alter function sigav.fc_pesquisar_equipe(target_application_id uuid, search_term text) rename to "FC_PESQUISAR_EQUIPE";
alter function sigav.fc_pesquisar_pessoa_admin(target_search text, target_limit integer) rename to "FC_PESQUISAR_PESSOA_ADMIN";
alter function sigav.fc_planejar_publico_avaliacao(p_aplicacao uuid, p_regra jsonb) rename to "FC_PLANEJAR_PUBLICO_AVALIACAO";
alter function sigav.fc_previsualizar_publico_avaliacao(p_aplicacao uuid, p_regra jsonb, p_limite_amostra integer) rename to "FC_PREVISUALIZAR_PUBLICO";
alter function sigav.fc_registrar_presenca() rename to "FC_REGISTRAR_PRESENCA";
alter function sigav.fc_regra_gera_ciclo(p_alvo uuid, p_origens uuid[]) rename to "FC_REGRA_GERA_CICLO";
alter function sigav.fc_reivindicar_emails() rename to "FC_REIVINDICAR_EMAILS";
alter function sigav.fc_remover_resposta_pessoa(p_submissao uuid, p_modo text, p_motivo text) rename to "FC_REMOVER_RESPOSTA_PESSOA";
alter function sigav.fc_resolver_publico_avaliacao(p_regra jsonb) rename to "FC_RESOLVER_PUBLICO_AVALIACAO";
alter function sigav.fc_salvar_regra_condicional(p_alvo_tipo text, p_alvo uuid, p_acao text, p_conector text, p_condicoes jsonb, p_descricao text) rename to "FC_SALVAR_REGRA_CONDICIONAL";
alter function sigav.fc_sincronizar_estado_ciclos() rename to "FC_SINCRONIZAR_ESTADO_CICLOS";
alter function sigav.fc_srv_concluir_email(target_email_id uuid, target_success boolean, target_error text) rename to "FC_SRV_CONCLUIR_EMAIL";
alter function sigav.fc_srv_concluir_email(target_email_id uuid, target_claim_token uuid, target_success boolean, target_error text) rename to "FC_SRV_CONCLUIR_EMAIL";
alter function sigav.fc_srv_consumir_limite_publico(target_scope text, target_key_hash text, target_limit integer, target_window_seconds integer) rename to "FC_SRV_CONSUMIR_LIMITE_PUBLICO";
alter function sigav.fc_srv_enviar_resp_anon(target_submission_id uuid, target_session_token text) rename to "FC_SRV_ENVIAR_RESP_ANON";
alter function sigav.fc_srv_expirar_rascunhos_anon() rename to "FC_SRV_EXPIRAR_RASCUNHOS_ANON";
alter function sigav.fc_srv_gravar_resp_anon(target_submission_id uuid, target_session_token text, target_question_id uuid, target_option_ids uuid[], target_text text, target_number numeric, target_boolean boolean, target_date date, target_datetime timestamp with time zone, target_json jsonb) rename to "FC_SRV_GRAVAR_RESP_ANON";
alter function sigav.fc_srv_iniciar_resp_anon(target_application_code text) rename to "FC_SRV_INICIAR_RESP_ANON";
alter function sigav.fc_srv_obter_form_anonimo(target_application_code text) rename to "FC_SRV_OBTER_FORM_ANONIMO";
alter function sigav.fc_srv_registrar_erro_aplicacao(p_co_referencia text, p_no_rota text, p_tp_erro text, p_ds_mensagem text, p_ds_contexto jsonb, p_st_ambiente text, p_nu_http_status integer) rename to "FC_SRV_REGISTRAR_ERRO";
alter function sigav.fc_srv_registrar_transporte(target_email_id uuid, target_claim_token uuid, target_message_id text) rename to "FC_SRV_REGISTRAR_TRANSPORTE";
alter function sigav.fc_srv_reivindicar_emails() rename to "FC_SRV_REIVINDICAR_EMAILS";
alter function sigav.fc_srv_resolver_identidade_oauth(p_provider text, p_provider_sub text, p_email text, p_nome text, p_avatar text) rename to "FC_SRV_RESOLVER_IDENT_OAUTH";
alter function sigav.fc_srv_verificar_contrato_rpc(p_nomes text[]) rename to "FC_SRV_VERIFICAR_CONTRATO_RPC";
alter function sigav.fc_srv_verificar_migrations(p_versoes text[]) rename to "FC_SRV_VERIFICAR_MIGRATIONS";
alter function sigav.fc_uid_sessao() rename to "FC_UID_SESSAO";
alter function sigav.fc_validar_ciclo_anonimo() rename to "FC_VALIDAR_CICLO_ANONIMO";
alter function sigav.fc_validar_foto_google() rename to "FC_VALIDAR_FOTO_GOOGLE";
alter function sigav.fc_validar_regra_publico(p_regra jsonb) rename to "FC_VALIDAR_REGRA_PUBLICO";
alter function sigav.get_admin_people_base_summary(target_application_id uuid) rename to "FC_RESUMO_BASE_PESSOAS";
alter function sigav.get_application_visual_settings(target_application_id uuid) rename to "FC_OBTER_VISUAL_CICLO";
alter function sigav.get_cddi_monitoring_dashboard(target_application_code text) rename to "FC_PAINEL_MONITOR_CDDI";
alter function sigav.get_cddi_monitoring_dashboard_internal(target_application_code text) rename to "FC_PAINEL_MONITOR_CDDI_INT";
alter function sigav.get_my_cddi_context() rename to "FC_OBTER_CONTEXTO_CDDI";
alter function sigav.get_my_cddi_identity(target_application_code text) rename to "FC_OBTER_IDENTIDADE_CDDI";
alter function sigav.get_my_team_workspace(target_application_code text) rename to "FC_OBTER_ESPACO_EQUIPE";
alter function sigav.get_platform_health() rename to "FC_SAUDE_PLATAFORMA";
alter function sigav.get_public_survey_form(target_application_code text) rename to "FC_OBTER_FORM_PUBLICO";
alter function sigav.get_survey_builder(target_survey_id uuid) rename to "FC_OBTER_CONSTRUTOR";
alter function sigav.get_survey_dashboard(target_application_code text) rename to "FC_OBTER_PAINEL_PESQ";
alter function sigav.get_survey_operations(target_survey_id uuid) rename to "FC_OBTER_OPERACOES_PESQUISA";
alter function sigav.handle_cddi_leadership_answer_sync() rename to "FC_SINCR_RESP_LIDERANCA";
alter function sigav.has_active_role(required_role text) rename to "FC_TEM_PAPEL_ATIVO";
alter function sigav.has_platform_module(target_module_code text) rename to "FC_TEM_MODULO";
alter function sigav.is_allowed_institutional_email(target_email text) rename to "FC_EMAIL_INSTITUC_PERMITIDO";
alter function sigav.is_platform_administrator() rename to "FC_E_ADMINISTRADOR";
alter function sigav.list_admin_application_participants(target_application_id uuid) rename to "FC_LISTAR_PARTIC_CICLO";
alter function sigav.list_admin_participant_applications() rename to "FC_LISTAR_CICLOS_PARTIC";
alter function sigav.list_managed_surveys() rename to "FC_LISTAR_PESQUISAS_GERIDAS";
alter function sigav.list_my_survey_catalog() rename to "FC_LISTAR_CATALOGO_PESQUISA";
alter function sigav.list_platform_admin_leadership_links(target_application_id uuid, target_search text, target_limit integer) rename to "FC_LISTAR_VINCULOS_LIDERANCA";
alter function sigav.manage_survey_cycle(target_survey_id uuid, target_action text, target_opens_at timestamp with time zone, target_closes_at timestamp with time zone) rename to "FC_GERIR_CICLO_PESQUISA";
alter function sigav.move_survey_question_to_section(target_question_id uuid, target_section_id uuid) rename to "FC_MOVER_PERGUNTA_SECAO";
alter function sigav.normalize_agsus_google_oauth_referrer() rename to "FC_NORMALIZAR_REFERRER_OAUTH";
alter function sigav.remove_person_from_my_team(target_link_id uuid) rename to "FC_REMOVER_PESSOA_EQUIPE";
alter function sigav.reorder_survey_builder_item(target_item_type text, target_item_id uuid, target_direction text) rename to "FC_REORDENAR_ITEM_CONSTRUTOR";
alter function sigav.resolve_authenticated_person(target_employee_number text) rename to "FC_RESOLVER_PESSOA_AUTENTIC";
alter function sigav.rls_auto_enable() rename to "FC_RLS_HABILITAR_AUTO";
alter function sigav.save_my_cddi_answer(target_submission_id uuid, target_question_id uuid, target_option_id uuid, target_text text) rename to "FC_SALVAR_RESPOSTA_CDDI";
alter function sigav.save_my_survey_answer(target_submission_id uuid, target_question_id uuid, target_option_ids uuid[], target_text text, target_number numeric, target_boolean boolean, target_date date, target_datetime timestamp with time zone, target_json jsonb) rename to "FC_SALVAR_RESPOSTA_PESQUISA";
alter function sigav.search_admin_people_for_application(target_application_id uuid, target_search text) rename to "FC_BUSCAR_PESSOAS_CICLO";
alter function sigav.search_platform_admin_people(target_search text, target_limit integer) rename to "FC_BUSCAR_PESSOAS_ADMIN";
alter function sigav.search_team_candidates(target_application_id uuid, search_term text) rename to "FC_BUSCAR_CANDIDATOS_EQUIPE";
alter function sigav.set_admin_application_participant_status(target_participant_id uuid, target_status text) rename to "FC_DEFINIR_SITUACAO_PARTIC";
alter function sigav.set_my_avatar_url(p_avatar_url text) rename to "FC_DEFINIR_AVATAR";
alter function sigav.set_platform_admin_leadership_link(target_application_id uuid, target_subordinate_person_id uuid, target_leader_person_id uuid, target_justification text) rename to "FC_DEFINIR_VINCULO_LIDERANCA";
alter function sigav.set_updated_at() rename to "FC_DEFINIR_DT_ALTERACAO";
alter function sigav.start_or_resume_my_cddi_submission(target_application_code text, target_submission_type text, target_subject_person_id uuid) rename to "FC_INICIAR_OU_RETOMAR_CDDI";
alter function sigav.start_or_resume_my_submission(target_application_code text) rename to "FC_INICIAR_OU_RETOMAR_SUBM";
alter function sigav.start_or_resume_my_survey_submission(target_application_code text) rename to "FC_INICIAR_OU_RETOMAR_PESQ";
alter function sigav.submit_my_cddi_submission(target_submission_id uuid) rename to "FC_ENVIAR_SUBMISSAO_CDDI";
alter function sigav.submit_my_survey_submission(target_submission_id uuid) rename to "FC_ENVIAR_SUBMISSAO_PESQUISA";
alter function sigav.sync_cddi_leader_technical_answer(target_application_id uuid, target_subordinate_person_id uuid, target_leader_person_id uuid) rename to "FC_SINCR_RESP_TECNICA_CDDI";
alter function sigav.sync_cddi_manager_rows(p_rows jsonb, p_batch_id uuid) rename to "FC_SINCR_LINHAS_GESTOR_CDDI";
alter function sigav.sync_my_google_avatar() rename to "FC_SINCR_AVATAR_GOOGLE";
alter function sigav.sync_new_cddi_submission_leader_answer() rename to "FC_SINCR_RESP_LIDER_NOVA";
alter function sigav.sync_people_base_rows(p_rows jsonb, p_batch_id uuid) rename to "FC_SINCR_LINHAS_BASE_PESSOA";
alter function sigav.unaccent_lower(input_text text) rename to "FC_SEM_ACENTO_MINUSCULA";
alter function sigav.update_application_visual_settings(target_application_id uuid, banner_url text, banner_path text, banner_alt text, hero_title text, hero_subtitle text, theme_variant text) rename to "FC_ATUALIZAR_VISUAL_CICLO";
alter function sigav.update_platform_admin_person(target_person_id uuid, target_full_name text, target_institutional_email text, target_job_title text, target_cost_center text, target_workplace text, target_directorate text, target_organizational_unit text, target_coordination text, target_employment_status text, target_active boolean, target_justification text) rename to "FC_ATUALIZAR_PESSOA_ADMIN";
alter function sigav.update_survey_question(target_question_id uuid, question_title text, question_description text, question_type text, is_required boolean, question_options jsonb) rename to "FC_ATUALIZAR_PERGUNTA";
alter function sigav.update_survey_section(target_section_id uuid, section_title text, section_description text) rename to "FC_ATUALIZAR_SECAO";
alter function sigav.validate_answer_option() rename to "FC_VALIDAR_OPCAO_RESPOSTA";
alter function sigav.validate_answer_question() rename to "FC_VALIDAR_PERGUNTA_RESPOSTA";
alter function sigav.validate_cddi_final_result() rename to "FC_VALIDAR_RESULT_FINAL_CDDI";
alter function sigav.validate_cddi_submission() rename to "FC_VALIDAR_SUBMISSAO_CDDI";
alter function sigav.validate_submission_participant() rename to "FC_VALIDAR_PARTIC_SUBMISSAO";
alter function sigav.validate_survey_version_integrity(target_survey_version_id uuid) rename to "FC_VALIDAR_INTEGRIDADE_VERSAO";

-- ---------------------------------------------------------------------------
-- 2. Triggers (item 9) — prefixo pelo momento e pelo evento
-- ---------------------------------------------------------------------------

alter trigger application_participants_set_updated_at on sigav."RL_APLICACAO_PESSOA" rename to "TBU_APLIC_PESSOA";
alter trigger answer_options_validate_question on sigav."RL_RESPOSTA_OPCAO" rename to "TBA_RESP_OPCAO_VALIDAR_PERG";
alter trigger cddi_leadership_answer_sync on sigav."RT_LIDERANCA_CDDI" rename to "TAA_LIDER_CDDI_SINCR_RESP";
alter trigger cddi_leadership_links_set_updated_at on sigav."RT_LIDERANCA_CDDI" rename to "TBU_LIDER_CDDI";
alter trigger survey_applications_set_updated_at on sigav."TB_APLICACAO_PESQUISA" rename to "TBU_APLIC_PESQ";
alter trigger tba_ciclo_anonimo on sigav."TB_APLICACAO_PESQUISA" rename to "TBU_APLIC_PESQ_CICLO_ANONIMO";
alter trigger cddi_link_correction_requests_set_updated_at on sigav."TB_CORRECAO_VINCULO_CDDI" rename to "TBU_CORR_VINC_CDDI";
alter trigger person_access_identities_set_updated_at on sigav."TB_IDENTIDADE_ACESSO" rename to "TBU_IDENT_ACESSO";
alter trigger enforce_draft_question_options on sigav."TB_OPCAO_PERGUNTA" rename to "TBA_OPCAO_PERG_EXIGIR_RASCUNHO";
alter trigger question_options_set_updated_at on sigav."TB_OPCAO_PERGUNTA" rename to "TBU_OPCAO_PERG";
alter trigger enforce_draft_survey_questions on sigav."TB_PERGUNTA_PESQUISA" rename to "TBA_PERG_PESQ_EXIGIR_RASCUNHO";
alter trigger survey_questions_set_updated_at on sigav."TB_PERGUNTA_PESQUISA" rename to "TBU_PERG_PESQ";
alter trigger surveys_set_updated_at on sigav."TB_PESQUISA" rename to "TBU_PESQ";
alter trigger tau_cancela_ciclos_arq on sigav."TB_PESQUISA" rename to "TAU_PESQ_CANCELA_CICLOS";
alter trigger people_set_updated_at on sigav."TB_PESSOA" rename to "TBU_PESSOA";
alter trigger tbu_people_foto_google on sigav."TB_PESSOA" rename to "TBU_PESSOA_FOTO_GOOGLE";
alter trigger user_preferences_set_updated_at on sigav."TB_PREFERENCIA_USUARIO" rename to "TBU_PREF_USU";
alter trigger answers_set_updated_at on sigav."TB_RESPOSTA" rename to "TBU_RESP";
alter trigger answers_validate_question on sigav."TB_RESPOSTA" rename to "TBA_RESP_VALIDAR_PERGUNTA";
alter trigger cddi_competency_results_set_updated_at on sigav."TB_RESULTADO_COMPET_CDDI" rename to "TBU_RES_COMP_CDDI";
alter trigger cddi_final_results_set_updated_at on sigav."TB_RESULTADO_FINAL_CDDI" rename to "TBU_RES_FINAL_CDDI";
alter trigger cddi_final_results_validate_submissions on sigav."TB_RESULTADO_FINAL_CDDI" rename to "TBA_RES_FINAL_CDDI_VALIDAR";
alter trigger enforce_draft_survey_sections on sigav."TB_SECAO_PESQUISA" rename to "TBA_SECAO_PESQ_EXIGIR_RASCUNHO";
alter trigger survey_sections_set_updated_at on sigav."TB_SECAO_PESQUISA" rename to "TBU_SECAO_PESQ";
alter trigger submissions_set_updated_at on sigav."TB_SUBMISSAO" rename to "TBU_SUBM";
alter trigger submissions_sync_cddi_leader_answer on sigav."TB_SUBMISSAO" rename to "TAI_SUBM_SINCR_RESP_LIDER";
alter trigger submissions_validate_cddi on sigav."TB_SUBMISSAO" rename to "TBA_SUBM_VALIDAR_CDDI";
alter trigger submissions_validate_participant on sigav."TB_SUBMISSAO" rename to "TBA_SUBM_VALIDAR_PARTIC";
alter trigger organizational_units_set_updated_at on sigav."TB_UNIDADE_ORGANIZACIONAL" rename to "TBU_UNID_ORG";
alter trigger survey_versions_set_updated_at on sigav."TH_VERSAO_PESQUISA" rename to "TBU_VERSAO_PESQ";

-- ---------------------------------------------------------------------------
-- 3. Policies
--
-- O padrão não define prefixo para policy. Fica o `PL_` que o schema já usava,
-- agora na caixa do item 3.
-- ---------------------------------------------------------------------------

alter policy pl_app_user_acesso_total on sigav."RL_APLICACAO_PESSOA" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."RL_PESSOA_MODULO" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."RL_RESPOSTA_OPCAO" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."RT_LIDERANCA_CDDI" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_APLICACAO_PESQUISA" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_ARQUIVO" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_BILHETE_ANONIMO" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_CATALOGO_OBJETO" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_CONDICAO_REGRA" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_CONFIG_PLATAFORMA" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_CORRECAO_VINCULO_CDDI" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_DOMINIO_INSTITUCIONAL" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_IDENTIDADE_ACESSO" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_IDENTIDADE_OAUTH" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_LIMITE_REQUISICAO_PUBLICA" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_LOTE_IMPORTACAO" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_MIGRACAO" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_MODULO_PLATAFORMA" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_OCORRENCIA_IMPORTACAO" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_OPCAO_PERGUNTA" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_PERGUNTA_PESQUISA" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_PESQUISA" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_PESSOA" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_PREFERENCIA_USUARIO" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_PRESENCA_ONLINE" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_REGRA_CONDICIONAL" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_RESPOSTA" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_RESULTADO_COMPET_CDDI" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_RESULTADO_FINAL_CDDI" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_SECAO_PESQUISA" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_SUBMISSAO" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_UNIDADE_ORGANIZACIONAL" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TB_USUARIO_IDENTIDADE" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TH_VERSAO_PESQUISA" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TL_EMAIL_PARTICIPANTE" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TL_ERRO_APLICACAO" rename to "PL_APP_USER_ACESSO_TOTAL";
alter policy pl_app_user_acesso_total on sigav."TL_EVENTO_AUDITORIA" rename to "PL_APP_USER_ACESSO_TOTAL";

-- ---------------------------------------------------------------------------
-- 4. Corpos que chamam outras funções do schema (174 de 174)
--
-- `CREATE OR REPLACE` já com o nome novo: a seção 1 renomeou, então a
-- definição abaixo substitui a função certa.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sigav."FC_INCLUIR_PESSOA_EQUIPE"(target_application_id uuid, target_person_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare v_leader_id uuid; v_link_id uuid; v_person_name text;
begin
  v_leader_id:=sigav."FC_PESSOA_SESSAO"();
  if v_leader_id is null then raise exception 'Cadastro institucional não identificado.'; end if;
  if not (sigav."FC_TEM_PAPEL_ATIVO"('LEADER') or sigav."FC_PODE_GERIR_PESQUISA"()) then raise exception 'Você não possui permissão para incluir integrantes.'; end if;
  if target_person_id=v_leader_id then raise exception 'Uma pessoa não pode ser vinculada a si própria.'; end if;
  if not exists (select 1 from sigav."RL_APLICACAO_PESSOA" ap where ap.application_id=target_application_id and ap.person_id=target_person_id and ap.status not in ('REMOVED','INELIGIBLE')) then raise exception 'A pessoa não participa deste ciclo.'; end if;
  if exists (select 1 from sigav."RT_LIDERANCA_CDDI" l where l.application_id=target_application_id and l.subordinate_person_id=target_person_id and l.status='ACTIVE' and l.valid_to is null) then raise exception 'A pessoa já possui uma liderança ativa neste ciclo.'; end if;
  insert into sigav."RT_LIDERANCA_CDDI"(application_id,leader_person_id,subordinate_person_id,status,valid_from,origin,metadata)
  values(target_application_id,v_leader_id,target_person_id,'ACTIVE',timezone('utc',now()),'SELF_SERVICE',jsonb_build_object('created_by_role',case when sigav."FC_PODE_GERIR_PESQUISA"() then 'TECHNICAL_TEAM' else 'LEADER' end)) returning id into v_link_id;
  select full_name into v_person_name from sigav."TB_PESSOA" where id=target_person_id;
  insert into sigav."TL_EVENTO_AUDITORIA"(actor_person_id,event_type,entity_type,entity_id,application_id,after_data,metadata)
  values(v_leader_id,'TEAM_MEMBER_ADDED','CDDI_LEADERSHIP_LINK',v_link_id::text,target_application_id,jsonb_build_object('leaderPersonId',v_leader_id,'subordinatePersonId',target_person_id),'{}'::jsonb);
  return jsonb_build_object('status','OK','linkId',v_link_id,'personName',v_person_name);
end;$function$;

CREATE OR REPLACE FUNCTION sigav."FC_INCLUIR_PERGUNTA"(target_survey_id uuid, target_section_id uuid, question_title text, question_description text, question_type text, is_required boolean DEFAULT true, question_options jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare v_version_id uuid; v_position integer; v_question_id uuid; v_option jsonb; v_ordinal bigint; v_type text;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then raise exception 'Acesso restrito à Equipe Técnica.'; end if;
  if nullif(btrim(question_title),'') is null then raise exception 'Informe o enunciado da pergunta.'; end if;
  v_type:=upper(btrim(question_type));
  if v_type not in ('SHORT_TEXT','LONG_TEXT','INTEGER','DECIMAL','DATE','DATETIME','BOOLEAN','SINGLE_CHOICE','MULTIPLE_CHOICE','SCALE') then raise exception 'Tipo de pergunta não suportado neste construtor.'; end if;
  select sv.id into v_version_id from sigav."TH_VERSAO_PESQUISA" sv join sigav."TB_SECAO_PESQUISA" sec on sec.survey_version_id=sv.id where sv.survey_id=target_survey_id and sv.status='DRAFT' and sec.id=target_section_id order by sv.version_number desc limit 1;
  if v_version_id is null then raise exception 'Seção ou versão em rascunho não encontrada.'; end if;
  if v_type in ('SINGLE_CHOICE','MULTIPLE_CHOICE','SCALE') and jsonb_array_length(coalesce(question_options,'[]'::jsonb))<2 then raise exception 'Informe pelo menos duas alternativas.'; end if;
  select coalesce(max(position),0)+1 into v_position from sigav."TB_PERGUNTA_PESQUISA" where section_id=target_section_id;
  insert into sigav."TB_PERGUNTA_PESQUISA"(survey_version_id,section_id,code,title,description,question_type,required,position,validation,display_logic,scoring,settings)
  values(v_version_id,target_section_id,'Q_'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),btrim(question_title),nullif(btrim(question_description),''),v_type,is_required,v_position,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb) returning id into v_question_id;
  if v_type in ('SINGLE_CHOICE','MULTIPLE_CHOICE','SCALE') then
    for v_option,v_ordinal in select value,ordinality from jsonb_array_elements(question_options) with ordinality loop
      insert into sigav."TB_OPCAO_PERGUNTA"(question_id,code,label,value,score,position,active,metadata)
      values(v_question_id,'O'||lpad(v_ordinal::text,2,'0'),coalesce(nullif(btrim(v_option->>'label'),''),'Opção '||v_ordinal),coalesce(nullif(btrim(v_option->>'value'),''),v_ordinal::text),case when nullif(v_option->>'score','') is null then null else (v_option->>'score')::numeric end,v_ordinal::integer,true,'{}'::jsonb);
    end loop;
  end if;
  return jsonb_build_object('status','OK','questionId',v_question_id);
end;$function$;

CREATE OR REPLACE FUNCTION sigav."FC_INCLUIR_SECAO"(target_survey_id uuid, section_title text, section_description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare v_version_id uuid; v_position integer; v_id uuid;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then raise exception 'Acesso restrito à Equipe Técnica.'; end if;
  if nullif(btrim(section_title),'') is null then raise exception 'Informe o título da seção.'; end if;
  select id into v_version_id from sigav."TH_VERSAO_PESQUISA" where survey_id=target_survey_id and status='DRAFT' order by version_number desc limit 1;
  if v_version_id is null then raise exception 'A pesquisa não possui uma versão em rascunho.'; end if;
  select coalesce(max(position),0)+1 into v_position from sigav."TB_SECAO_PESQUISA" where survey_version_id=v_version_id;
  insert into sigav."TB_SECAO_PESQUISA"(survey_version_id,code,title,description,position,settings)
  values(v_version_id,'S_'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),btrim(section_title),nullif(btrim(section_description),''),v_position,'{}'::jsonb) returning id into v_id;
  return jsonb_build_object('status','OK','sectionId',v_id);
end;$function$;

CREATE OR REPLACE FUNCTION sigav."FC_CICLO_ACEITA_RESPOSTA"(target_application_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select exists (
    select 1
    from sigav."TB_APLICACAO_PESQUISA" sa
    where sa.id = target_application_id
      and (
        sa.status = 'OPEN'
        or (
          sa.status = 'SCHEDULED'
          and sa.opens_at is not null
          and sa.opens_at <= now()
        )
      )
      and (sa.opens_at is null or sa.opens_at <= now())
      and (sa.closes_at is null or sa.closes_at > now())
  );
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ATRIB_TODOS_DISPONIVEIS"(target_application_id uuid, target_access_profile text DEFAULT 'PARTICIPANTE'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav', 'auth'
AS $function$
declare
  v_actor uuid := sigav."FC_PESSOA_SESSAO"();
  v_assigned integer := 0;
  v_reactivated integer := 0;
  v_skipped integer := 0;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Seu perfil não possui permissão para vincular participantes.';
  end if;
  if not exists(select 1 from sigav."TB_APLICACAO_PESQUISA" where id = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  with candidates as (
    select p.id, ap.status
    from sigav."TB_PESSOA" p
    left join sigav."RL_APLICACAO_PESSOA" ap
      on ap.application_id = target_application_id
     and ap.person_id = p.id
     and ap.participant_role = 'RESPONDENT'
    where p.active
      -- Sem `upper`/`btrim` e sem 'NORMAL': é o predicado que produção executa.
      and p.employment_status = 'ATIVO'
      and coalesce((p.metadata->>'evaluation_exempt')::boolean, false) = false
  ), upserted as (
    insert into sigav."RL_APLICACAO_PESSOA"(
      application_id, person_id, participant_role, status, access_profile, invited_at, metadata
    )
    select
      target_application_id,
      id,
      'RESPONDENT',
      'ELIGIBLE',
      nullif(btrim(target_access_profile), ''),
      timezone('utc', now()),
      jsonb_build_object('assigned_by', v_actor, 'assigned_at', timezone('utc', now()), 'source', 'ADMIN_ALL_AVAILABLE')
    from candidates
    where status is null or status in ('BLOCKED', 'EXCLUDED')
    on conflict(application_id, person_id, participant_role) do update
      set status = 'ELIGIBLE',
          access_profile = coalesce(nullif(btrim(excluded.access_profile), ''), sigav."RL_APLICACAO_PESSOA".access_profile),
          invited_at = coalesce(sigav."RL_APLICACAO_PESSOA".invited_at, excluded.invited_at),
          metadata = coalesce(sigav."RL_APLICACAO_PESSOA".metadata, '{}'::jsonb) || excluded.metadata,
          updated_at = timezone('utc', now())
    returning person_id
  )
  select
    count(*) filter(where c.status is null),
    count(*) filter(where c.status in ('BLOCKED', 'EXCLUDED')),
    count(*) filter(where c.status not in ('BLOCKED', 'EXCLUDED') and c.status is not null)
  into v_assigned, v_reactivated, v_skipped
  from candidates c;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    actor_person_id, event_type, entity_type, entity_id, application_id, after_data, metadata
  ) values (
    v_actor,
    'PARTICIPANT_ALL_AVAILABLE_ASSIGNMENT_COMPLETED',
    'SURVEY_APPLICATION',
    target_application_id::text,
    target_application_id,
    jsonb_build_object('assignedCount', v_assigned, 'reactivatedCount', v_reactivated, 'skippedCount', v_skipped),
    jsonb_build_object('source', 'ADMIN_ALL_AVAILABLE')
  );

  return jsonb_build_object(
    'status', 'OK',
    'assignedCount', v_assigned,
    'reactivatedCount', v_reactivated,
    'skippedCount', v_skipped
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ATRIB_PARTICIPANTE"(target_application_id uuid, target_person_id uuid, target_access_profile text DEFAULT 'PARTICIPANTE'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor uuid := sigav."FC_PESSOA_SESSAO"();
  v_participant sigav."RL_APLICACAO_PESSOA"%rowtype;
  v_before jsonb;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Seu perfil não possui permissão para vincular participantes.';
  end if;

  if not exists(select 1 from sigav."TB_APLICACAO_PESQUISA" where id = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;
  if not exists(select 1 from sigav."TB_PESSOA" where id = target_person_id and active) then
    raise exception 'Pessoa ativa não localizada.';
  end if;

  select to_jsonb(ap.*) into v_before
  from sigav."RL_APLICACAO_PESSOA" ap
  where ap.application_id = target_application_id
    and ap.person_id = target_person_id
    and ap.participant_role = 'RESPONDENT';

  insert into sigav."RL_APLICACAO_PESSOA"(
    application_id, person_id, participant_role, status, access_profile, invited_at, metadata
  ) values (
    target_application_id, target_person_id, 'RESPONDENT', 'ELIGIBLE',
    nullif(btrim(target_access_profile),''), timezone('utc',now()),
    jsonb_build_object('assigned_by',v_actor,'assigned_at',timezone('utc',now()))
  )
  on conflict(application_id, person_id, participant_role) do update
  set status = case
        when sigav."RL_APLICACAO_PESSOA".status in ('BLOCKED','EXCLUDED') then 'ELIGIBLE'
        else sigav."RL_APLICACAO_PESSOA".status
      end,
      access_profile = coalesce(nullif(btrim(excluded.access_profile),''), sigav."RL_APLICACAO_PESSOA".access_profile),
      invited_at = coalesce(sigav."RL_APLICACAO_PESSOA".invited_at, excluded.invited_at),
      metadata = coalesce(sigav."RL_APLICACAO_PESSOA".metadata,'{}'::jsonb)
        || jsonb_build_object('assigned_by',v_actor,'assigned_at',timezone('utc',now())),
      updated_at = timezone('utc',now())
  returning * into v_participant;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    actor_person_id,event_type,entity_type,entity_id,application_id,before_data,after_data,metadata
  ) values (
    v_actor,'PARTICIPANT_ASSIGNED','APPLICATION_PARTICIPANT',v_participant.id::text,
    target_application_id,v_before,to_jsonb(v_participant),jsonb_build_object('source','ADMIN_PARTICIPANTS')
  );

  return jsonb_build_object('status','OK','participantId',v_participant.id,'participantStatus',v_participant.status);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ATRIB_PARTICIPANTE_LOTE"(target_application_id uuid, target_person_ids uuid[], target_access_profile text DEFAULT 'PARTICIPANTE'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor uuid := sigav."FC_PESSOA_SESSAO"();
  v_requested_count integer := coalesce(cardinality(target_person_ids), 0);
  v_assigned_count integer := 0;
  v_reactivated_count integer := 0;
  v_skipped_count integer := 0;
  v_person_id uuid;
  v_before_status text;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Seu perfil não possui permissão para vincular participantes.';
  end if;

  if not exists (
    select 1
    from sigav."TB_APLICACAO_PESQUISA"
    where id = target_application_id
  ) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  if v_requested_count < 1 then
    raise exception 'Selecione pelo menos uma pessoa.';
  end if;

  if v_requested_count > 1000 then
    raise exception 'Cada operação pode vincular no máximo 1000 pessoas.';
  end if;

  for v_person_id in
    select distinct requested_person_id
    from unnest(target_person_ids) as requested(requested_person_id)
  loop
    if not exists (
      select 1
      from sigav."TB_PESSOA"
      where id = v_person_id
        and active
        and employment_status = 'ATIVO'
    ) then
      v_skipped_count := v_skipped_count + 1;
      continue;
    end if;

    select status
      into v_before_status
    from sigav."RL_APLICACAO_PESSOA"
    where application_id = target_application_id
      and person_id = v_person_id
      and participant_role = 'RESPONDENT';

    perform sigav."FC_ATRIB_PARTICIPANTE"(
      target_application_id,
      v_person_id,
      target_access_profile
    );

    if v_before_status in ('BLOCKED', 'EXCLUDED') then
      v_reactivated_count := v_reactivated_count + 1;
    elsif v_before_status is null then
      v_assigned_count := v_assigned_count + 1;
    else
      v_skipped_count := v_skipped_count + 1;
    end if;
  end loop;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    after_data,
    metadata
  ) values (
    v_actor,
    'PARTICIPANT_BULK_ASSIGNMENT_COMPLETED',
    'SURVEY_APPLICATION',
    target_application_id::text,
    target_application_id,
    jsonb_build_object(
      'requestedCount', v_requested_count,
      'assignedCount', v_assigned_count,
      'reactivatedCount', v_reactivated_count,
      'skippedCount', v_skipped_count
    ),
    jsonb_build_object('source', 'ADMIN_PARTICIPANTS_BULK')
  );

  return jsonb_build_object(
    'status', 'OK',
    'requestedCount', v_requested_count,
    'assignedCount', v_assigned_count,
    'reactivatedCount', v_reactivated_count,
    'skippedCount', v_skipped_count
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_PODE_ACESSAR_CICLO"(target_application_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
 select sigav."FC_PODE_GERIR_PESQUISA"()
 or exists(select 1 from sigav."TB_APLICACAO_PESQUISA" sa where sa.id=target_application_id and sa.access_mode='INSTITUTIONAL' and sigav."FC_PESSOA_SESSAO"() is not null)
 or exists(select 1 from sigav."RL_APLICACAO_PESSOA" ap where ap.application_id=target_application_id and ap.person_id=sigav."FC_PESSOA_SESSAO"() and ap.status not in ('BLOCKED','EXCLUDED'))
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_PODE_AUDITAR"()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select sigav."FC_TEM_MODULO"('ADMIN_SURVEYS');
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_PODE_EDITAR_SUBMISSAO"(target_submission_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select sigav."FC_PODE_GERIR_PESQUISA"() or exists (
    select 1
    from sigav."TB_SUBMISSAO" s
    where s.id = target_submission_id
      and s.respondent_person_id = sigav."FC_PESSOA_SESSAO"()
      and s.status = 'DRAFT'
      and sigav."FC_PODE_ACESSAR_CICLO"(s.application_id)
      and sigav."FC_CICLO_ACEITA_RESPOSTA"(s.application_id)
  );
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_PODE_GERIR_PESQUISA"()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select sigav."FC_TEM_MODULO"('ADMIN_SURVEYS');
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_PODE_REGISTRAR_PRESENCA"()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select coalesce((
    select c.fl_presenca_online_ativa
      and sigav."FC_PESSOA_SESSAO"() is not null
    from sigav."TB_CONFIG_PLATAFORMA" c
    where c.co_configuracao = 1
  ), false);
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_PODE_VER_PRESENCA"()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select coalesce((
    select configuracao.fl_presenca_online_ativa
      and sigav."FC_TEM_MODULO"('ONLINE_PRESENCE')
    from sigav."TB_CONFIG_PLATAFORMA" configuracao
    where configuracao.co_configuracao = 1
  ), false);
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_REIVINDICAR_ACESSO"()
 RETURNS TABLE(status text, person_id uuid, full_name text, employee_number text, access_profile text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := sigav."FC_UID_SESSAO"();
  v_email text := lower(btrim(coalesce(sigav."FC_CLAIMS_SESSAO"() ->> 'email', '')));
  v_person sigav."TB_PESSOA"%rowtype;
  v_identity sigav."TB_IDENTIDADE_ACESSO"%rowtype;
  v_access_profile text;
begin
  if v_uid is null then
    return query select 'UNAUTHENTICATED'::text, null::uuid, null::text, null::text, null::text;
    return;
  end if;

  if v_email = '' or right(v_email, length('@agenciasus.org.br')) <> '@agenciasus.org.br' then
    return query select 'DOMAIN_NOT_ALLOWED'::text, null::uuid, null::text, null::text, null::text;
    return;
  end if;

  select pai.*
    into v_identity
  from sigav."TB_IDENTIDADE_ACESSO" pai
  where lower(pai.email) = v_email
    and pai.identity_type = 'INSTITUTIONAL_EMAIL'
    and pai.status in ('PENDING', 'ACTIVE')
    and pai.revoked_at is null
  order by case when pai.status = 'ACTIVE' then 0 else 1 end, pai.created_at
  limit 1;

  if v_identity.id is null then
    return query select 'IDENTITY_NOT_FOUND'::text, null::uuid, null::text, null::text, null::text;
    return;
  end if;

  select p.*
    into v_person
  from sigav."TB_PESSOA" p
  where p.id = v_identity.person_id
    and p.active = true;

  if v_person.id is null then
    return query select 'PERSON_INACTIVE'::text, null::uuid, null::text, null::text, null::text;
    return;
  end if;

  if v_person.auth_user_id is not null and v_person.auth_user_id <> v_uid then
    return query select 'IDENTITY_CONFLICT'::text, null::uuid, null::text, null::text, null::text;
    return;
  end if;

  update sigav."TB_PESSOA"
     set auth_user_id = v_uid,
         updated_at = timezone('utc', now())
   where id = v_person.id;

  update sigav."TB_IDENTIDADE_ACESSO"
     set status = 'ACTIVE',
         verified_at = coalesce(verified_at, timezone('utc', now())),
         updated_at = timezone('utc', now())
   where id = v_identity.id;

  select ap.access_profile
    into v_access_profile
  from sigav."RL_APLICACAO_PESSOA" ap
  join sigav."TB_APLICACAO_PESQUISA" sa on sa.id = ap.application_id
  where ap.person_id = v_person.id
    and sa.code = 'CDDI-2026'
  order by ap.created_at desc
  limit 1;

  return query
  select
    'CLAIMED'::text,
    v_person.id,
    v_person.full_name,
    v_person.employee_number,
    coalesce(v_access_profile, 'USUARIO_COMUM');
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_CRIAR_E_ATRIB_PARTIC"(target_application_id uuid, target_employee_number text, target_full_name text, target_institutional_email text, target_job_title text DEFAULT NULL::text, target_cost_center text DEFAULT NULL::text, target_workplace text DEFAULT NULL::text, target_access_profile text DEFAULT 'PARTICIPANTE'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_employee text := btrim(coalesce(target_employee_number,''));
  v_name text := btrim(coalesce(target_full_name,''));
  v_email text := lower(btrim(coalesce(target_institutional_email,'')));
  v_person sigav."TB_PESSOA"%rowtype;
  v_result jsonb;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Seu perfil não possui permissão para cadastrar participantes.';
  end if;
  if v_employee = '' then raise exception 'Informe a matrícula da pessoa.'; end if;
  if v_name = '' then raise exception 'Informe o nome completo da pessoa.'; end if;
  if v_email = '' or not sigav."FC_EMAIL_INSTITUC_PERMITIDO"(v_email) then
    raise exception 'Informe um e-mail institucional AgSUS válido.';
  end if;

  select * into v_person
  from sigav."TB_PESSOA"
  where employee_number = v_employee
     or lower(coalesce(institutional_email,'')) = v_email
  order by employee_number = v_employee desc
  limit 1;

  if v_person.id is null then
    insert into sigav."TB_PESSOA"(
      employee_number,full_name,institutional_email,job_title,cost_center,workplace,
      employment_status,active,source_system,source_key,metadata
    ) values (
      v_employee,v_name,v_email,nullif(btrim(target_job_title),''),nullif(btrim(target_cost_center),''),
      nullif(btrim(target_workplace),''),'ATIVO',true,'ADMIN_MANUAL',v_employee,
      jsonb_build_object('created_by',sigav."FC_PESSOA_SESSAO"(),'created_at',timezone('utc',now()))
    ) returning * into v_person;
  else
    if v_person.employee_number <> v_employee
       and lower(coalesce(v_person.institutional_email,'')) = v_email then
      raise exception 'O e-mail informado já pertence a outra matrícula (%).', v_person.employee_number;
    end if;

    update sigav."TB_PESSOA"
    set full_name = v_name,
        institutional_email = v_email,
        job_title = coalesce(nullif(btrim(target_job_title),''),job_title),
        cost_center = coalesce(nullif(btrim(target_cost_center),''),cost_center),
        workplace = coalesce(nullif(btrim(target_workplace),''),workplace),
        active = true,
        employment_status = 'ATIVO',
        updated_at = timezone('utc',now())
    where id = v_person.id
    returning * into v_person;
  end if;

  v_result := sigav."FC_ATRIB_PARTICIPANTE"(
    target_application_id,
    v_person.id,
    target_access_profile
  );

  return v_result || jsonb_build_object('personId',v_person.id,'employeeNumber',v_person.employee_number);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_CRIAR_RASCUNHO_PESQUISA"(p_code text, p_name text, p_description text, p_application_name text, p_opens_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_closes_at timestamp with time zone DEFAULT NULL::timestamp with time zone, p_anonymous boolean DEFAULT false, p_allow_drafts boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid;
  v_survey_id uuid;
  v_version_id uuid;
  v_application_id uuid;
  v_code text;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Você não possui permissão para criar pesquisas.';
  end if;

  v_code := upper(regexp_replace(btrim(p_code), '[^A-Za-z0-9_-]+', '-', 'g'));
  if v_code = '' then raise exception 'Informe um código válido.'; end if;
  if btrim(p_name) = '' then raise exception 'Informe o nome da pesquisa.'; end if;
  if p_opens_at is not null and p_opens_at < now() - interval '1 minute' then
    raise exception 'A abertura não pode ser anterior à data e hora atuais.';
  end if;
  if p_closes_at is not null and p_opens_at is not null and p_closes_at <= p_opens_at then
    raise exception 'A data de encerramento deve ser posterior à abertura.';
  end if;
  if p_closes_at is not null and p_opens_at is null and p_closes_at <= now() then
    raise exception 'O encerramento não pode ser anterior à data e hora atuais.';
  end if;

  select id into v_person_id
  from sigav."TB_PESSOA"
  where auth_user_id = sigav."FC_UID_SESSAO"()
  limit 1;

  insert into sigav."TB_PESQUISA" (code, name, description, status, settings, created_by)
  values (v_code, btrim(p_name), nullif(btrim(p_description), ''), 'DRAFT', '{}'::jsonb, v_person_id)
  returning id into v_survey_id;

  insert into sigav."TH_VERSAO_PESQUISA" (
    survey_id, version_number, title, description, status, schema_version,
    settings, created_by
  )
  values (
    v_survey_id, 1, btrim(p_name), nullif(btrim(p_description), ''), 'DRAFT',
    1, '{}'::jsonb, v_person_id
  )
  returning id into v_version_id;

  insert into sigav."TB_APLICACAO_PESQUISA" (
    survey_version_id, code, name, opens_at, closes_at, status,
    allow_drafts, allow_resubmission, anonymous, settings, created_by
  )
  values (
    v_version_id,
    v_code || '-1',
    coalesce(nullif(btrim(p_application_name), ''), btrim(p_name)),
    p_opens_at,
    p_closes_at,
    'DRAFT',
    p_allow_drafts,
    false,
    p_anonymous,
    '{}'::jsonb,
    v_person_id
  )
  returning id into v_application_id;

  insert into sigav."TB_SECAO_PESQUISA" (
    survey_version_id, code, title, description, position, settings
  )
  values (
    v_version_id, 'INTRO', 'Introdução', 'Seção inicial da pesquisa.', 1,
    '{}'::jsonb
  );

  return jsonb_build_object(
    'status', 'OK',
    'surveyId', v_survey_id,
    'versionId', v_version_id,
    'applicationId', v_application_id,
    'code', v_code
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_PESSOA_SESSAO"()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select p.id from sigav."TB_PESSOA" p
  where p.auth_user_id = sigav."FC_UID_SESSAO"() and p.active = true
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_EXCLUIR_PERGUNTA"(target_question_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare v_title text;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then raise exception 'Acesso restrito à Equipe Técnica.'; end if;
  select q.title into v_title from sigav."TB_PERGUNTA_PESQUISA" q join sigav."TH_VERSAO_PESQUISA" sv on sv.id=q.survey_version_id where q.id=target_question_id and sv.status='DRAFT';
  if v_title is null then raise exception 'Pergunta em rascunho não encontrada.'; end if;
  delete from sigav."TB_PERGUNTA_PESQUISA" where id=target_question_id;
  return jsonb_build_object('status','OK','title',v_title);
end;$function$;

CREATE OR REPLACE FUNCTION sigav."FC_DUPLICAR_ITEM_CONSTRUTOR"(target_item_type text, target_item_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor_id uuid := sigav."FC_PESSOA_SESSAO"();
  v_item_type text := upper(btrim(coalesce(target_item_type, '')));
  v_version sigav."TH_VERSAO_PESQUISA"%rowtype;
  v_source_section sigav."TB_SECAO_PESQUISA"%rowtype;
  v_source_question sigav."TB_PERGUNTA_PESQUISA"%rowtype;
  v_question_row sigav."TB_PERGUNTA_PESQUISA"%rowtype;
  v_option_row sigav."TB_OPCAO_PERGUNTA"%rowtype;
  v_source_section_id uuid;
  v_new_section_id uuid;
  v_new_question_id uuid;
  v_new_item_id uuid;
  v_application_id uuid;
  v_position integer;
  v_copied_questions integer := 0;
  v_copied_options integer := 0;
  v_new_title text;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à Equipe Técnica.';
  end if;
  if v_item_type not in ('SECTION', 'QUESTION') then
    raise exception 'Tipo de item inválido para duplicação.';
  end if;

  if v_item_type = 'SECTION' then
    select sv.*
    into v_version
    from sigav."TH_VERSAO_PESQUISA" sv
    join sigav."TB_SECAO_PESQUISA" sec on sec.survey_version_id = sv.id
    where sec.id = target_item_id
      and sv.status = 'DRAFT'
    for update of sv;

    if v_version.id is null then
      raise exception 'Seção em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
    end if;

    perform sec.id
    from sigav."TB_SECAO_PESQUISA" sec
    where sec.survey_version_id = v_version.id
    order by sec.id
    for update;

    select *
    into v_source_section
    from sigav."TB_SECAO_PESQUISA"
    where id = target_item_id
      and survey_version_id = v_version.id;

    perform question.id
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question.section_id = target_item_id
    order by question.id
    for update;

    select coalesce(max(sec.position), 0) + 1
    into v_position
    from sigav."TB_SECAO_PESQUISA" sec
    where sec.survey_version_id = v_version.id;

    v_new_title := left(v_source_section.title, 152) || ' — cópia';

    insert into sigav."TB_SECAO_PESQUISA"(
      survey_version_id,
      parent_section_id,
      code,
      title,
      description,
      position,
      settings
    ) values (
      v_version.id,
      v_source_section.parent_section_id,
      'S_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      v_new_title,
      v_source_section.description,
      v_position,
      v_source_section.settings
    )
    returning id into v_new_section_id;

    for v_question_row in
      select *
      from sigav."TB_PERGUNTA_PESQUISA"
      where section_id = target_item_id
      order by position, id
    loop
      insert into sigav."TB_PERGUNTA_PESQUISA"(
        survey_version_id,
        section_id,
        code,
        title,
        description,
        question_type,
        required,
        position,
        validation,
        display_logic,
        scoring,
        settings
      ) values (
        v_version.id,
        v_new_section_id,
        'Q_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
        v_question_row.title,
        v_question_row.description,
        v_question_row.question_type,
        v_question_row.required,
        v_question_row.position,
        v_question_row.validation,
        v_question_row.display_logic,
        v_question_row.scoring,
        v_question_row.settings
      )
      returning id into v_new_question_id;

      v_copied_questions := v_copied_questions + 1;

      for v_option_row in
        select *
        from sigav."TB_OPCAO_PERGUNTA"
        where question_id = v_question_row.id
        order by position, id
      loop
        insert into sigav."TB_OPCAO_PERGUNTA"(
          question_id,
          code,
          label,
          value,
          score,
          position,
          active,
          metadata
        ) values (
          v_new_question_id,
          v_option_row.code,
          v_option_row.label,
          v_option_row.value,
          v_option_row.score,
          v_option_row.position,
          v_option_row.active,
          v_option_row.metadata
        );
        v_copied_options := v_copied_options + 1;
      end loop;
    end loop;

    v_new_item_id := v_new_section_id;
  else
    select sv.*
    into v_version
    from sigav."TH_VERSAO_PESQUISA" sv
    join sigav."TB_PERGUNTA_PESQUISA" question on question.survey_version_id = sv.id
    where question.id = target_item_id
      and sv.status = 'DRAFT'
    for update of sv;

    if v_version.id is null then
      raise exception 'Pergunta em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
    end if;

    select question.section_id
    into v_source_section_id
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question.id = target_item_id
      and question.survey_version_id = v_version.id;

    perform question.id
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question.section_id = v_source_section_id
    order by question.id
    for update;

    select *
    into v_source_question
    from sigav."TB_PERGUNTA_PESQUISA"
    where id = target_item_id
      and survey_version_id = v_version.id;

    if v_source_question.id is null then
      raise exception 'Pergunta em rascunho não encontrada.';
    end if;

    select coalesce(max(question.position), 0) + 1
    into v_position
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question.section_id = v_source_question.section_id;

    v_new_title := left(v_source_question.title, 492) || ' — cópia';

    insert into sigav."TB_PERGUNTA_PESQUISA"(
      survey_version_id,
      section_id,
      code,
      title,
      description,
      question_type,
      required,
      position,
      validation,
      display_logic,
      scoring,
      settings
    ) values (
      v_version.id,
      v_source_question.section_id,
      'Q_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      v_new_title,
      v_source_question.description,
      v_source_question.question_type,
      v_source_question.required,
      v_position,
      v_source_question.validation,
      v_source_question.display_logic,
      v_source_question.scoring,
      v_source_question.settings
    )
    returning id into v_new_question_id;

    for v_option_row in
      select *
      from sigav."TB_OPCAO_PERGUNTA"
      where question_id = target_item_id
      order by position, id
    loop
      insert into sigav."TB_OPCAO_PERGUNTA"(
        question_id,
        code,
        label,
        value,
        score,
        position,
        active,
        metadata
      ) values (
        v_new_question_id,
        v_option_row.code,
        v_option_row.label,
        v_option_row.value,
        v_option_row.score,
        v_option_row.position,
        v_option_row.active,
        v_option_row.metadata
      );
      v_copied_options := v_copied_options + 1;
    end loop;

    v_new_item_id := v_new_question_id;
  end if;

  select app.id
  into v_application_id
  from sigav."TB_APLICACAO_PESQUISA" app
  where app.survey_version_id = v_version.id
  order by app.created_at desc
  limit 1;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'SURVEY_' || v_item_type || '_DUPLICATED',
    'SURVEY_' || v_item_type,
    v_new_item_id::text,
    v_application_id,
    jsonb_build_object('sourceId', target_item_id),
    jsonb_build_object(
      'itemId', v_new_item_id,
      'title', v_new_title,
      'position', v_position,
      'copiedQuestions', v_copied_questions,
      'copiedOptions', v_copied_options
    ),
    jsonb_build_object('surveyId', v_version.survey_id, 'surveyVersionId', v_version.id)
  );

  return jsonb_build_object(
    'status', 'OK',
    'itemType', v_item_type,
    'itemId', v_new_item_id,
    'position', v_position,
    'copiedQuestions', v_copied_questions,
    'copiedOptions', v_copied_options
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_MODULOS_EFETIVOS"(target_person_id uuid)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select coalesce(
    array_agg(pm.code order by pm.position, pm.code)
      filter (where coalesce(
        pmp.allowed,
        pm.code in ('HOME', 'SURVEYS')
      )),
    array[]::text[]
  )
  from sigav."TB_PESSOA" p
  cross join sigav."TB_MODULO_PLATAFORMA" pm
  left join sigav."RL_PESSOA_MODULO" pmp
    on pmp.person_id = p.id
   and pmp.module_code = pm.code
  where p.id = target_person_id
    and p.active
    and pm.active;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_EXIGIR_RASCUNHO_ESTRUT"()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_version_ids uuid[];
  v_expected integer;
begin
  if tg_table_name = 'TB_SECAO_PESQUISA' then
    select array_agg(distinct version_id order by version_id)
    into v_version_ids
    from (
      select old.survey_version_id as version_id where tg_op in ('UPDATE', 'DELETE')
      union all
      select new.survey_version_id where tg_op in ('INSERT', 'UPDATE')
    ) versions;
  elsif tg_table_name = 'TB_PERGUNTA_PESQUISA' then
    select array_agg(distinct version_id order by version_id)
    into v_version_ids
    from (
      select old.survey_version_id as version_id where tg_op in ('UPDATE', 'DELETE')
      union all
      select new.survey_version_id where tg_op in ('INSERT', 'UPDATE')
    ) versions;
  elsif tg_table_name = 'TB_OPCAO_PERGUNTA' then
    select array_agg(distinct question.survey_version_id order by question.survey_version_id)
    into v_version_ids
    from sigav."TB_PERGUNTA_PESQUISA" question
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

  perform version.id from sigav."TH_VERSAO_PESQUISA" version
  where version.id = any(v_version_ids) order by version.id for update;

  if (select count(*) from sigav."TH_VERSAO_PESQUISA" version where version.id = any(v_version_ids)) <> v_expected then
    raise exception 'Versão da pesquisa não encontrada.';
  end if;

  if tg_op = 'DELETE'
    and current_setting('app.exclusao_arquivada', true) = 'on'
    and not exists (
      select 1
      from sigav."TH_VERSAO_PESQUISA" version
      join sigav."TB_PESQUISA" survey on survey.id = version.survey_id
      where version.id = any(v_version_ids)
        and survey.dt_arquivamento is null
    ) then
    return old;
  end if;

  if exists (
    select 1 from sigav."TH_VERSAO_PESQUISA" version
    where version.id = any(v_version_ids) and version.status <> 'DRAFT'
  ) then
    raise exception 'Versões publicadas não podem ser alteradas. Crie uma nova versão em rascunho.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ABRIR_CICLOS_AGENDADOS"()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav', 'auth'
AS $function$
begin
  perform sigav."FC_SINCRONIZAR_ESTADO_CICLOS"();
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_AGENDAR_ENVIO_MANUAL"(p_aplicacao uuid, p_pessoas uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor uuid := sigav."FC_PESSOA_SESSAO"();
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_pedidas integer := coalesce(array_length(p_pessoas, 1), 0);
  v_enfileiradas integer := 0;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  if p_aplicacao is null then
    raise exception 'Informe o ciclo.';
  end if;

  if v_pedidas = 0 then
    raise exception 'Selecione ao menos uma pessoa.';
  end if;

  -- Teto por disparo: proteção contra o clique acidental que atinge a base
  -- inteira. A cota diária da conta institucional do Google é finita, e
  -- estourá-la derruba também os e-mails de quem realmente precisa receber.
  if v_pedidas > 1500 then
    raise exception 'Selecione no máximo 1500 pessoas por disparo.';
  end if;

  select * into v_application
  from sigav."TB_APLICACAO_PESQUISA"
  where id = p_aplicacao;

  if v_application.id is null then
    raise exception 'Ciclo não encontrado.';
  end if;

  if v_application.status <> 'OPEN' then
    raise exception 'O ciclo precisa estar aberto para receber envios.';
  end if;

  with elegiveis as (
    select p.id
    from sigav."TB_PESSOA" p
    join sigav."RL_APLICACAO_PESSOA" ap
      on ap.person_id = p.id and ap.application_id = p_aplicacao
    where p.id = any(p_pessoas)
      and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
      and p.active
      and p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      -- Bloqueia o clique duplo sem bloquear para sempre.
      --
      -- PENDENTE sempre impede: o lembrete está na fila e vai sair.
      -- PROCESSANDO só impede enquanto o lease vale — passados 15 minutos sem
      -- desfecho, o claim é tratado como abandonado, e insistir é legítimo.
      and not exists (
        select 1 from sigav."TL_EMAIL_PARTICIPANTE" t
        where t.sq_aplicacao = p_aplicacao
          and t.sq_pessoa = p.id
          and t.tp_email = 'manual_reminder'
          and (
            t.st_envio = 'PENDENTE'
            or (t.st_envio = 'PROCESSANDO'
                and t.dt_atualizacao > timezone('utc', now()) - interval '15 minutes')
          )
      )
  )
  insert into sigav."TL_EMAIL_PARTICIPANTE" (sq_aplicacao, sq_pessoa, tp_email)
  select p_aplicacao, e.id, 'manual_reminder'
  from elegiveis e;

  get diagnostics v_enfileiradas = row_count;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    actor_person_id, event_type, entity_type, entity_id, application_id,
    before_data, after_data, metadata
  )
  values (
    v_actor, 'EMAIL_MANUAL_QUEUED', 'survey_application', p_aplicacao, p_aplicacao,
    null, null,
    jsonb_build_object('solicitadas', v_pedidas, 'enfileiradas', v_enfileiradas)
  );

  return jsonb_build_object(
    'status', 'OK',
    'solicitadas', v_pedidas,
    'enfileiradas', v_enfileiradas,
    'ignoradas', v_pedidas - v_enfileiradas
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ALVO_VISIVEL"(p_submissao uuid, p_alvo uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_regra sigav."TB_REGRA_CONDICIONAL"%rowtype;
  v_total integer;
  v_atendidas integer;
  v_satisfeita boolean;
begin
  select * into v_regra
  from sigav."TB_REGRA_CONDICIONAL"
  where sq_alvo = p_alvo and st_ativo;

  if v_regra.sq_regra is null then
    return true;
  end if;

  select count(*)::integer,
         count(*) filter (where sigav."FC_CONDICAO_ATENDIDA"(p_submissao, sq_condicao))::integer
  into v_total, v_atendidas
  from sigav."TB_CONDICAO_REGRA"
  where sq_regra = v_regra.sq_regra;

  -- Regra sem condição não decide nada; deixar visível é o padrão seguro.
  if v_total = 0 then
    return true;
  end if;

  v_satisfeita := case when v_regra.tp_conector = 'ALL' then v_atendidas = v_total else v_atendidas > 0 end;
  return case when v_regra.tp_acao = 'SHOW' then v_satisfeita else not v_satisfeita end;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_APLICAR_PUBLICO_AVALIACAO"(p_aplicacao uuid, p_regra jsonb, p_perfil_acesso text DEFAULT 'PARTICIPANTE'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav', 'auth'
AS $function$
declare
  v_ator uuid := sigav."FC_PESSOA_SESSAO"();
  v_novos integer := 0;
  v_reativados integer := 0;
  v_mantidos integer := 0;
  v_excluidos integer := 0;
  v_removidos integer := 0;
  v_preservados integer := 0;
  v_bloqueados integer := 0;
  v_efetivo integer := 0;
  v_regra_gravada jsonb;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Seu perfil não possui permissão para definir o público da avaliação.';
  end if;
  if not exists (select 1 from sigav."TB_APLICACAO_PESQUISA" where id = p_aplicacao) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  with plano as (
    select * from sigav."FC_PLANEJAR_PUBLICO_AVALIACAO"(p_aplicacao, p_regra)
  ),
  gravados as (
    insert into sigav."RL_APLICACAO_PESSOA"(
      application_id, person_id, participant_role, status, access_profile, invited_at, metadata
    )
    select
      p_aplicacao,
      pl.sq_pessoa,
      'RESPONDENT',
      pl.tp_situacao_nova,
      nullif(btrim(p_perfil_acesso), ''),
      -- Só quem entra no público ganha `invited_at`. Marcar a data em quem está
      -- saindo registraria um convite que não houve.
      case when pl.tp_situacao_nova = 'ELIGIBLE' then timezone('utc', now()) end,
      -- A razão fica no registro: "excluída de propósito" e "deixou de casar
      -- com a regra" produzem o mesmo estado e são decisões diferentes.
      case
        when pl.st_excluida then jsonb_build_object(
          'excluded_by', v_ator,
          'excluded_at', timezone('utc', now()),
          'source', 'ADMIN_AUDIENCE_BUILDER',
          'reason', 'explicit_exclusion'
        )
        when pl.tp_situacao_nova = 'EXCLUDED' then jsonb_build_object(
          'removed_by', v_ator,
          'removed_at', timezone('utc', now()),
          'source', 'ADMIN_AUDIENCE_BUILDER',
          'reason', 'rule_no_longer_matches'
        )
        else jsonb_build_object(
          'assigned_by', v_ator,
          'assigned_at', timezone('utc', now()),
          'source', 'ADMIN_AUDIENCE_BUILDER',
          'origin', pl.st_casa
        )
      end
    from plano pl
    -- Só o que muda é gravado. Sem este filtro, reaplicar a mesma regra
    -- carimbaria `updated_at` na tabela inteira sem nada ter mudado.
    where pl.tp_situacao is distinct from pl.tp_situacao_nova
    on conflict (application_id, person_id, participant_role) do update
      set status = excluded.status,
          -- O existente vem primeiro. `p_perfil_acesso` é o padrão para vínculo
          -- **novo**; usá-lo aqui reclassificaria quem já tem perfil próprio —
          -- reaplicar a regra rebaixaria a pessoa ao padrão sem ninguém pedir.
          access_profile = coalesce(sigav."RL_APLICACAO_PESSOA".access_profile, excluded.access_profile),
          invited_at = coalesce(sigav."RL_APLICACAO_PESSOA".invited_at, excluded.invited_at),
          metadata = coalesce(sigav."RL_APLICACAO_PESSOA".metadata, '{}'::jsonb) || excluded.metadata,
          updated_at = timezone('utc', now())
    returning 1
  )
  select
    count(*) filter (where tp_situacao is null and tp_situacao_nova = 'ELIGIBLE'),
    count(*) filter (where tp_situacao = 'EXCLUDED' and tp_situacao_nova = 'ELIGIBLE'),
    count(*) filter (where tp_situacao is not null
                       and tp_situacao = tp_situacao_nova
                       and tp_situacao_nova not in ('BLOCKED', 'EXCLUDED')),
    count(*) filter (where st_excluida and tp_situacao_nova = 'EXCLUDED'),
    count(*) filter (where not st_casa
                       and tp_situacao in ('ELIGIBLE', 'INVITED')
                       and tp_situacao_nova = 'EXCLUDED'),
    count(*) filter (where not st_casa and tp_situacao in ('IN_PROGRESS', 'COMPLETED')),
    count(*) filter (where st_casa and tp_situacao_nova = 'BLOCKED'),
    count(*) filter (where tp_situacao_nova not in ('BLOCKED', 'EXCLUDED'))
  into v_novos, v_reativados, v_mantidos, v_excluidos, v_removidos, v_preservados, v_bloqueados, v_efetivo
  from plano;

  -- Persiste a regra. Só a regra e o resumo — a lista de pessoas resolvidas
  -- vive em `RL_APLICACAO_PESSOA` e não é duplicada aqui.
  v_regra_gravada := jsonb_build_object(
    'version', 1,
    'filters', coalesce(p_regra -> 'filters', '{}'::jsonb),
    'allEligible', coalesce((p_regra ->> 'allEligible')::boolean, false),
    'includePersonIds', coalesce(p_regra -> 'includePersonIds', '[]'::jsonb),
    'excludePersonIds', coalesce(p_regra -> 'excludePersonIds', '[]'::jsonb),
    'appliedAt', timezone('utc', now()),
    'appliedBy', v_ator,
    'resultCount', v_efetivo
  );

  update sigav."TB_APLICACAO_PESQUISA"
  set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('audience', v_regra_gravada),
      updated_at = timezone('utc', now())
  where id = p_aplicacao;

  -- Auditoria pelo mecanismo existente. A regra inteira entra em `after_data`
  -- para que a decisão seja reconstruível depois, e os números da transição vão
  -- em `metadata` — inclusive os que descrevem o que **não** foi mexido.
  insert into sigav."TL_EVENTO_AUDITORIA"(
    actor_person_id, event_type, entity_type, entity_id, application_id, after_data, metadata
  ) values (
    v_ator,
    'APPLICATION_AUDIENCE_APPLIED',
    'SURVEY_APPLICATION',
    p_aplicacao::text,
    p_aplicacao,
    v_regra_gravada,
    jsonb_build_object(
      'source', 'ADMIN_AUDIENCE_BUILDER',
      'assignedCount', v_novos,
      'reactivatedCount', v_reativados,
      'keptCount', v_mantidos,
      'excludedCount', v_excluidos,
      'removedCount', v_removidos,
      'retainedWithProgressCount', v_preservados,
      'blockedKeptCount', v_bloqueados,
      'effectiveCount', v_efetivo
    )
  );

  return jsonb_build_object(
    'status', 'OK',
    'assignedCount', v_novos,
    'reactivatedCount', v_reativados,
    'keptCount', v_mantidos,
    'excludedCount', v_excluidos,
    'removedCount', v_removidos,
    'retainedWithProgressCount', v_preservados,
    'blockedKeptCount', v_bloqueados,
    'effectiveCount', v_efetivo,
    'audience', v_regra_gravada
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ARQ_GRAVAR"(p_balde text, p_caminho text, p_tipo text, p_conteudo_base64 text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_caminho text := btrim(coalesce(p_caminho, ''));
  v_conteudo bytea;
  v_tamanho integer;
  v_id uuid;
begin
  -- Mesma autoridade que decidia a escrita nas políticas dos dois buckets:
  -- quem administra pesquisas administra a marca e as capas.
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Sem permissão para gravar arquivos.' using errcode = '42501';
  end if;

  if v_caminho = '' then
    raise exception 'O caminho do arquivo é obrigatório.' using errcode = '22023';
  end if;

  -- Impede que um caminho escape do próprio balde ou monte um endereço que a
  -- rota de leitura interpretaria de outro modo.
  if v_caminho like '/%' or v_caminho like '%..%' then
    raise exception 'Caminho de arquivo inválido: %', v_caminho using errcode = '22023';
  end if;

  if coalesce(p_conteudo_base64, '') = '' then
    raise exception 'O conteúdo do arquivo é obrigatório.' using errcode = '22023';
  end if;

  v_conteudo := decode(p_conteudo_base64, 'base64');
  v_tamanho := octet_length(v_conteudo);

  insert into sigav."TB_ARQUIVO" (co_balde, ds_caminho, tp_conteudo, nu_tamanho, im_conteudo, co_autor)
  values (p_balde, v_caminho, p_tipo, v_tamanho, v_conteudo, sigav."FC_UID_SESSAO"())
  on conflict on constraint uk_tb_arquivo_caminho do update
    set tp_conteudo    = excluded.tp_conteudo,
        nu_tamanho     = excluded.nu_tamanho,
        im_conteudo    = excluded.im_conteudo,
        co_autor       = excluded.co_autor,
        dt_atualizacao = now()
  returning sq_arquivo into v_id;

  return jsonb_build_object(
    'sqArquivo', v_id,
    'balde', p_balde,
    'caminho', v_caminho,
    'tamanho', v_tamanho,
    'url', '/api/arquivos/' || p_balde || '/' || v_caminho
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ARQ_LISTAR"(p_balde text, p_prefixo text DEFAULT ''::text)
 RETURNS TABLE(caminho text, tipo text, tamanho integer, criado_em timestamp with time zone, url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Sem permissão para listar arquivos.' using errcode = '42501';
  end if;

  return query
    select a.ds_caminho,
           a.tp_conteudo,
           a.nu_tamanho,
           a.dt_criacao,
           '/api/arquivos/' || a.co_balde || '/' || a.ds_caminho
    from sigav."TB_ARQUIVO" a
    where a.co_balde = p_balde
      and a.ds_caminho like coalesce(nullif(btrim(p_prefixo), ''), '') || '%'
    order by a.dt_criacao desc
    limit 100;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ARQ_OBTER"(p_balde text, p_caminho text)
 RETURNS TABLE(conteudo bytea, tipo text, tamanho integer, atualizado_em timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select a.im_conteudo, a.tp_conteudo, a.nu_tamanho, a.dt_atualizacao
  from sigav."TB_ARQUIVO" a
  where a.co_balde = p_balde
    and a.ds_caminho = btrim(coalesce(p_caminho, ''));
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ARQ_REMOVER"(p_balde text, p_caminho text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_removidos integer;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Sem permissão para remover arquivos.' using errcode = '42501';
  end if;

  delete from sigav."TB_ARQUIVO"
  where co_balde = p_balde and ds_caminho = btrim(coalesce(p_caminho, ''));

  get diagnostics v_removidos = row_count;

  -- Remover o que já não existe não é erro: a tela chama isto em rotinas de
  -- faxina, e falhar ali produziria mensagem de erro para um estado que já é o
  -- desejado.
  return jsonb_build_object('removidos', v_removidos);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ATUALIZAR_MARCA_PLATAFORMA"(no_organizacao_param text, no_produto_param text, tx_url_logotipo_param text DEFAULT NULL::text, tx_caminho_param text DEFAULT NULL::text, co_cor_principal_param text DEFAULT '#0b4f82'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_organization_name text := nullif(btrim(no_organizacao_param), '');
  v_product_name text := nullif(btrim(no_produto_param), '');
  v_logo_url text := nullif(btrim(tx_url_logotipo_param), '');
  v_logo_path text := nullif(btrim(tx_caminho_param), '');
  v_primary_color text := lower(coalesce(nullif(btrim(co_cor_principal_param), ''), '#0b4f82'));
begin
  v_actor_id := sigav."FC_PESSOA_SESSAO"();
  if v_actor_id is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração da plataforma.';
  end if;

  if v_organization_name is null or length(v_organization_name) > 60 then
    raise exception 'O nome da organização deve possuir entre 1 e 60 caracteres.';
  end if;
  if v_product_name is null or length(v_product_name) > 60 then
    raise exception 'O nome do produto deve possuir entre 1 e 60 caracteres.';
  end if;
  if v_primary_color !~ '^#[0-9a-f]{6}$' then
    raise exception 'A cor principal deve utilizar o formato hexadecimal #RRGGBB.';
  end if;

  if (v_logo_url is null) <> (v_logo_path is null) then
    raise exception 'A URL e o caminho do logotipo devem ser informados em conjunto.';
  end if;
  if v_logo_url is not null then
    if v_logo_url !~ '^https://[^[:space:]]+$' then
      raise exception 'A URL do logotipo deve utilizar HTTPS.';
    end if;
    if position('/storage/v1/object/public/platform-assets/' in v_logo_url) = 0
       or position(v_logo_path in v_logo_url) = 0
       or v_logo_path !~ '^branding/[^/]+\.(jpg|jpeg|png|webp)$' then
      raise exception 'O logotipo deve pertencer ao armazenamento institucional.';
    end if;
  end if;

  select to_jsonb(settings) - 'co_configuracao'
  into v_before
  from sigav."TB_CONFIG_PLATAFORMA" settings
  where co_configuracao = 1
  for update;

  update sigav."TB_CONFIG_PLATAFORMA"
  set no_organizacao = v_organization_name,
      no_produto = v_product_name,
      tx_url_logotipo = v_logo_url,
      tx_caminho_logotipo = v_logo_path,
      co_cor_principal = v_primary_color,
      au_usuario_alteracao = v_actor_id,
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  select to_jsonb(settings) - 'co_configuracao'
  into v_after
  from sigav."TB_CONFIG_PLATAFORMA" settings
  where co_configuracao = 1;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'PLATFORM_BRANDING_UPDATED',
    'PLATFORM_SETTINGS',
    'branding',
    v_before,
    v_after,
    jsonb_build_object('source', 'ADMIN_SETTINGS')
  );

  return sigav."FC_OBTER_MARCA_PLATAFORMA"();
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_BUSCAR_PESSOAS_PUBLICO"(p_busca text DEFAULT NULL::text, p_limite integer DEFAULT 20, p_regra jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav', 'auth'
AS $function$
declare
  v_filtros jsonb;
  v_termo text;
  v_resultado jsonb;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    return jsonb_build_object('status', 'FORBIDDEN');
  end if;

  perform sigav."FC_VALIDAR_REGRA_PUBLICO"(p_regra);

  -- `allEligible` desliga o contexto: o público é toda a instituição, e a busca
  -- precisa alcançar toda a instituição — inclusive para excluir alguém.
  v_filtros := case
    when coalesce((p_regra ->> 'allEligible')::boolean, false) then '{}'::jsonb
    else coalesce(p_regra -> 'filters', '{}'::jsonb)
  end;
  v_termo := sigav."FC_NORMALIZAR_ROTULO"(p_busca);

  with encontradas as (
    select p.id, p.full_name, p.employee_number, p.job_title,
           p.metadata ->> 'unit' as unidade,
           p.metadata ->> 'directorate' as diretoria
    from sigav."TB_PESSOA" p
    where p.active
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p.metadata ->> 'directorate',  v_filtros -> 'directorate')
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p.metadata ->> 'unit',         v_filtros -> 'unit')
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p.metadata ->> 'coordination', v_filtros -> 'coordination')
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p.cost_center,                 v_filtros -> 'costCenter')
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p.job_title,                   v_filtros -> 'jobTitle')
      and (
        v_termo is null
        or sigav."FC_NORMALIZAR_ROTULO"(p.full_name) like '%' || v_termo || '%'
        or sigav."FC_NORMALIZAR_ROTULO"(p.employee_number) like '%' || v_termo || '%'
        or sigav."FC_NORMALIZAR_ROTULO"(p.institutional_email) like '%' || v_termo || '%'
        or sigav."FC_NORMALIZAR_ROTULO"(p.job_title) like '%' || v_termo || '%'
      )
    order by p.full_name
    limit least(greatest(coalesce(p_limite, 20), 1), 50)
  )
  select jsonb_build_object(
    'status', 'OK',
    -- Derivado de `v_filtros`, não da regra crua: com `allEligible` ligado a
    -- lista não está estreitada, e dizer o contrário faria a tela explicar uma
    -- ausência que não existe.
    'contextual', (select count(*) from jsonb_each(v_filtros) as f(chave, valores)
                   where jsonb_array_length(f.valores) > 0) > 0,
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'personId', id,
        'fullName', full_name,
        'employeeNumber', employee_number,
        'jobTitle', job_title,
        'unit', unidade,
        'directorate', diretoria
      ) order by full_name)
      from encontradas
    ), '[]'::jsonb)
  )
  into v_resultado;

  return v_resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_CANCELA_CICLOS_ARQ"()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if old.dt_arquivamento is null and new.dt_arquivamento is not null then
    update sigav."TB_APLICACAO_PESQUISA" application
    set status = 'CANCELLED', updated_at = now()
    from sigav."TH_VERSAO_PESQUISA" version
    where version.id = application.survey_version_id
      and version.survey_id = new.id
      and application.status <> 'CANCELLED';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_CLAIMS_SESSAO"()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_CLONAR_PESQUISA"(p_pesquisa uuid, p_nome text DEFAULT NULL::text, p_codigo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_resultado jsonb;
  v_pesquisa uuid;
  v_versao uuid;
  v_aplicacao uuid;
  v_codigo text;
  v_nome text;
begin
  -- A função interna mantém as validações de papel, origem e estrutura. Se a
  -- criação do ciclo falhar, a mesma transação desfaz também toda a cópia.
  v_resultado := sigav."FC_CLONAR_PESQUISA_ESTRUTURA"(p_pesquisa, p_nome, p_codigo);
  v_pesquisa := (v_resultado ->> 'surveyId')::uuid;
  v_codigo := v_resultado ->> 'code';
  v_nome := v_resultado ->> 'name';

  select id
  into v_versao
  from sigav."TH_VERSAO_PESQUISA"
  where survey_id = v_pesquisa
  order by version_number desc
  limit 1;

  insert into sigav."TB_APLICACAO_PESQUISA" (
    survey_version_id, code, name, opens_at, closes_at, status,
    allow_drafts, allow_resubmission, anonymous, access_mode,
    nu_limiar_anonimato, st_notificacao_email, settings, created_by
  ) values (
    v_versao, v_codigo || '-1', v_nome, null, null, 'DRAFT',
    true, false, false, 'RESTRICTED', 5, false, '{}'::jsonb,
    sigav."FC_PESSOA_SESSAO"()
  )
  returning id into v_aplicacao;

  return v_resultado || jsonb_build_object('applicationId', v_aplicacao);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_CLONAR_PESQUISA_ESTRUTURA"(p_pesquisa uuid, p_nome text DEFAULT NULL::text, p_codigo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_pessoa uuid := sigav."FC_PESSOA_SESSAO"();
  v_origem sigav."TB_PESQUISA"%rowtype;
  v_versao_origem uuid;
  v_nova_pesquisa uuid;
  v_nova_versao uuid;
  v_codigo text;
  v_nome text;
  v_sufixo integer := 1;
  v_mapa_secao jsonb := '{}'::jsonb;
  v_mapa_pergunta jsonb := '{}'::jsonb;
  v_mapa_opcao jsonb := '{}'::jsonb;
  v_secao record;
  v_pergunta record;
  v_opcao record;
  v_regra record;
  v_nova_regra uuid;
  v_alvo uuid;
  v_secoes integer := 0;
  v_perguntas integer := 0;
  v_regras integer := 0;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  select * into v_origem from sigav."TB_PESQUISA" where id = p_pesquisa;
  if v_origem.id is null then
    raise exception 'Avaliação não localizada.';
  end if;

  -- Prefere a versão publicada; sem ela, o rascunho mais recente.
  select id into v_versao_origem
  from sigav."TH_VERSAO_PESQUISA"
  where survey_id = p_pesquisa and status in ('PUBLISHED', 'DRAFT')
  order by case status when 'PUBLISHED' then 0 else 1 end, version_number desc
  limit 1;
  if v_versao_origem is null then
    raise exception 'Esta avaliação não tem versão com estrutura para copiar.';
  end if;

  v_nome := coalesce(nullif(btrim(coalesce(p_nome, '')), ''), v_origem.name || ' (cópia)');
  if length(v_nome) > 160 then
    raise exception 'O nome da cópia é longo demais.';
  end if;

  -- O código é único por constraint. Em vez de devolver erro de banco para quem
  -- clicou em "Duplicar", a função procura o primeiro sufixo livre.
  v_codigo := upper(btrim(coalesce(nullif(btrim(coalesce(p_codigo, '')), ''), v_origem.code || '-COPIA')));
  while exists (select 1 from sigav."TB_PESQUISA" where code = v_codigo) loop
    v_sufixo := v_sufixo + 1;
    v_codigo := upper(btrim(coalesce(nullif(btrim(coalesce(p_codigo, '')), ''), v_origem.code || '-COPIA'))) || '-' || v_sufixo::text;
    if v_sufixo > 50 then
      raise exception 'Não foi possível gerar um código livre para a cópia. Informe um código.';
    end if;
  end loop;

  insert into sigav."TB_PESQUISA" (code, name, description, owner_unit_id, status, settings, created_by)
  values (v_codigo, v_nome, v_origem.description, v_origem.owner_unit_id, 'DRAFT', v_origem.settings, v_pessoa)
  returning id into v_nova_pesquisa;

  insert into sigav."TH_VERSAO_PESQUISA" (survey_id, version_number, title, description, status, settings)
  select v_nova_pesquisa, 1, title, description, 'DRAFT', settings
  from sigav."TH_VERSAO_PESQUISA" where id = v_versao_origem
  returning id into v_nova_versao;

  -- Seções em duas passagens: primeiro todas sem pai, depois o vínculo, para
  -- que uma seção aninhada não precise que a pai já exista na hora da inserção.
  for v_secao in
    select * from sigav."TB_SECAO_PESQUISA" where survey_version_id = v_versao_origem order by position
  loop
    insert into sigav."TB_SECAO_PESQUISA" (survey_version_id, parent_section_id, code, title, description, position, settings)
    values (v_nova_versao, null, v_secao.code, v_secao.title, v_secao.description, v_secao.position, v_secao.settings)
    returning id into v_alvo;
    v_mapa_secao := v_mapa_secao || jsonb_build_object(v_secao.id::text, v_alvo::text);
    v_secoes := v_secoes + 1;
  end loop;

  for v_secao in
    select * from sigav."TB_SECAO_PESQUISA" where survey_version_id = v_versao_origem and parent_section_id is not null
  loop
    update sigav."TB_SECAO_PESQUISA"
    set parent_section_id = (v_mapa_secao->>v_secao.parent_section_id::text)::uuid
    where id = (v_mapa_secao->>v_secao.id::text)::uuid;
  end loop;

  for v_pergunta in
    select * from sigav."TB_PERGUNTA_PESQUISA" where survey_version_id = v_versao_origem order by position
  loop
    insert into sigav."TB_PERGUNTA_PESQUISA" (
      survey_version_id, section_id, code, title, description, question_type,
      required, position, validation, display_logic, scoring, settings
    ) values (
      v_nova_versao, (v_mapa_secao->>v_pergunta.section_id::text)::uuid, v_pergunta.code,
      v_pergunta.title, v_pergunta.description, v_pergunta.question_type,
      v_pergunta.required, v_pergunta.position, v_pergunta.validation,
      v_pergunta.display_logic, v_pergunta.scoring, v_pergunta.settings
    ) returning id into v_alvo;
    v_mapa_pergunta := v_mapa_pergunta || jsonb_build_object(v_pergunta.id::text, v_alvo::text);
    v_perguntas := v_perguntas + 1;

    for v_opcao in
      select * from sigav."TB_OPCAO_PERGUNTA" where question_id = v_pergunta.id order by position
    loop
      insert into sigav."TB_OPCAO_PERGUNTA" (question_id, code, label, value, score, position, active, metadata)
      values (v_alvo, v_opcao.code, v_opcao.label, v_opcao.value, v_opcao.score, v_opcao.position, v_opcao.active, v_opcao.metadata);
    end loop;
  end loop;

  -- O mapa de alternativas é montado numa passagem própria, pareando pelo par
  -- (pergunta, código) — que é único por constraint. Fazer isso dentro do laço
  -- acima exigiria alimentar o jsonb e o id na mesma instrução.
  for v_opcao in
    select antiga.id as id_antigo, nova.id as id_novo
    from sigav."TB_OPCAO_PERGUNTA" antiga
    join sigav."TB_PERGUNTA_PESQUISA" pergunta_antiga on pergunta_antiga.id = antiga.question_id
    join sigav."TB_OPCAO_PERGUNTA" nova
      on nova.question_id = (v_mapa_pergunta->>pergunta_antiga.id::text)::uuid
     and nova.code = antiga.code
    where pergunta_antiga.survey_version_id = v_versao_origem
  loop
    v_mapa_opcao := v_mapa_opcao || jsonb_build_object(v_opcao.id_antigo::text, v_opcao.id_novo::text);
  end loop;

  -- Regras condicionais, já apontando para os identificadores da cópia.
  for v_regra in
    select * from sigav."TB_REGRA_CONDICIONAL" where sq_versao_pesquisa = v_versao_origem and st_ativo
  loop
    v_alvo := case v_regra.tp_alvo
      when 'SECTION' then (v_mapa_secao->>v_regra.sq_alvo::text)::uuid
      else (v_mapa_pergunta->>v_regra.sq_alvo::text)::uuid
    end;
    if v_alvo is null then
      continue;
    end if;

    insert into sigav."TB_REGRA_CONDICIONAL" (
      sq_versao_pesquisa, tp_alvo, sq_alvo, tp_acao, tp_conector, ds_regra, au_usuario_inclusao
    ) values (
      v_nova_versao, v_regra.tp_alvo, v_alvo, v_regra.tp_acao, v_regra.tp_conector, v_regra.ds_regra, v_pessoa
    ) returning sq_regra into v_nova_regra;

    insert into sigav."TB_CONDICAO_REGRA" (sq_regra, sq_pergunta_origem, tp_operador, sq_opcao, tx_valor, nu_valor, nu_ordem)
    select
      v_nova_regra,
      (v_mapa_pergunta->>condicao.sq_pergunta_origem::text)::uuid,
      condicao.tp_operador,
      case when condicao.sq_opcao is null then null else (v_mapa_opcao->>condicao.sq_opcao::text)::uuid end,
      condicao.tx_valor, condicao.nu_valor, condicao.nu_ordem
    from sigav."TB_CONDICAO_REGRA" condicao
    where condicao.sq_regra = v_regra.sq_regra
      and (v_mapa_pergunta->>condicao.sq_pergunta_origem::text) is not null;

    v_regras := v_regras + 1;
  end loop;

  insert into sigav."TL_EVENTO_AUDITORIA" (actor_person_id, event_type, entity_type, entity_id, after_data, metadata)
  values (
    v_pessoa, 'SURVEY_CLONED', 'SURVEY', v_nova_pesquisa::text,
    jsonb_build_object('code', v_codigo, 'name', v_nome, 'sourceSurveyId', p_pesquisa),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'status', 'OK',
    'surveyId', v_nova_pesquisa,
    'code', v_codigo,
    'name', v_nome,
    'sections', v_secoes,
    'questions', v_perguntas,
    'rules', v_regras
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_CONCLUIR_EMAIL_PARTICIPANTE"(target_email_id uuid, target_success boolean, target_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  -- Mesma guarda de FC_REIVINDICAR_EMAILS: EXECUTE de authenticated existe
  -- pelo gate de contratos, mas só o processamento interno passa daqui.
  if coalesce(sigav."FC_PAPEL_SESSAO"(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  update sigav."TL_EMAIL_PARTICIPANTE"
  set st_envio = case when target_success then 'ENVIADO' else 'FALHOU' end,
      dt_envio = case when target_success then timezone('utc', now()) else dt_envio end,
      ds_erro = case when target_success then null else left(coalesce(target_error, 'Falha não detalhada.'), 500) end,
      dt_atualizacao = timezone('utc', now())
  where sq_email = target_email_id;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_CONCLUIR_EMAIL_PARTICIPANTE"(target_email_id uuid, target_claim_token uuid, target_success boolean, target_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if coalesce(sigav."FC_PAPEL_SESSAO"(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  update sigav."TL_EMAIL_PARTICIPANTE"
  set st_envio = case when target_success then 'ENVIADO' else 'FALHOU' end,
      dt_envio = case when target_success then timezone('utc', now()) else dt_envio end,
      ds_erro = case
        when target_success then null
        else left(coalesce(target_error, 'Falha não detalhada.'), 500)
      end,
      co_reivindicacao = null,
      dt_atualizacao = timezone('utc', now())
  where sq_email = target_email_id
    and st_envio = 'PROCESSANDO'
    and co_reivindicacao = target_claim_token;

  if not found then
    raise exception 'A reivindicação deste e-mail não está mais vigente.';
  end if;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_CONDICAO_ATENDIDA"(p_submissao uuid, p_condicao uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_condicao sigav."TB_CONDICAO_REGRA"%rowtype;
  v_resposta sigav."TB_RESPOSTA"%rowtype;
  v_respondida boolean;
  v_selecionada boolean;
begin
  select * into v_condicao from sigav."TB_CONDICAO_REGRA" where sq_condicao = p_condicao;
  if v_condicao.sq_condicao is null then
    return false;
  end if;

  if not sigav."FC_PERGUNTA_VISIVEL"(p_submissao, v_condicao.sq_pergunta_origem) then
    return v_condicao.tp_operador in ('NOT_ANSWERED', 'NOT_SELECTED');
  end if;

  select * into v_resposta
  from sigav."TB_RESPOSTA"
  where submission_id = p_submissao and question_id = v_condicao.sq_pergunta_origem;

  v_respondida := v_resposta.id is not null and (
    num_nonnulls(
      nullif(btrim(coalesce(v_resposta.answer_text, '')), ''),
      v_resposta.answer_number::text,
      v_resposta.answer_boolean::text,
      v_resposta.answer_date::text,
      v_resposta.answer_datetime::text
    ) > 0
    or exists (select 1 from sigav."RL_RESPOSTA_OPCAO" where answer_id = v_resposta.id)
  );

  if v_condicao.tp_operador = 'ANSWERED' then return v_respondida; end if;
  if v_condicao.tp_operador = 'NOT_ANSWERED' then return not v_respondida; end if;
  if not v_respondida then
    -- Nenhuma comparação de valor se sustenta sobre resposta ausente.
    return v_condicao.tp_operador = 'NOT_EQUALS' or v_condicao.tp_operador = 'NOT_SELECTED';
  end if;

  if v_condicao.tp_operador in ('SELECTED', 'NOT_SELECTED') then
    v_selecionada := exists (
      select 1 from sigav."RL_RESPOSTA_OPCAO"
      where answer_id = v_resposta.id and option_id = v_condicao.sq_opcao
    );
    return case when v_condicao.tp_operador = 'SELECTED' then v_selecionada else not v_selecionada end;
  end if;

  if v_condicao.tp_operador = 'GREATER_THAN' then
    return v_resposta.answer_number is not null and v_resposta.answer_number > v_condicao.nu_valor;
  end if;
  if v_condicao.tp_operador = 'LESS_THAN' then
    return v_resposta.answer_number is not null and v_resposta.answer_number < v_condicao.nu_valor;
  end if;
  if v_condicao.tp_operador = 'CONTAINS' then
    return position(lower(coalesce(v_condicao.tx_valor, '')) in lower(coalesce(v_resposta.answer_text, ''))) > 0;
  end if;

  -- EQUALS e NOT_EQUALS comparam a representação textual do valor gravado, para
  -- que a mesma regra sirva a texto, número, data e booleano sem multiplicar
  -- operadores por tipo.
  --
  -- `trim_scale` existe aqui por causa da paridade com o avaliador do frontend:
  -- a coluna é `numeric(18,6)`, então `5::text` sai como '5.000000' e nunca
  -- casaria com o '5' que o operador digitou nem com o `String(5)` do JavaScript.
  -- Divergência entre os dois avaliadores é pior que regra que não casa: a tela
  -- mostraria uma pergunta que o banco considera escondida.
  --
  -- DATETIME é a exceção conhecida: o banco serializa com fuso
  -- ('2026-08-13 12:00:00+00') e o input `datetime-local` não. Comparação de
  -- igualdade em DATETIME não é confiável nos dois lados — use ANSWERED,
  -- GREATER_THAN ou LESS_THAN.
  v_selecionada := lower(btrim(coalesce(
    v_resposta.answer_text,
    trim_scale(v_resposta.answer_number)::text,
    v_resposta.answer_boolean::text,
    v_resposta.answer_date::text,
    v_resposta.answer_datetime::text,
    ''
  ))) = lower(btrim(coalesce(v_condicao.tx_valor, '')));
  return case when v_condicao.tp_operador = 'EQUALS' then v_selecionada else not v_selecionada end;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_CRIAR_NOVA_VERSAO_PESQUISA"(p_pesquisa uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_pessoa uuid := sigav."FC_PESSOA_SESSAO"();
  v_pesquisa sigav."TB_PESQUISA"%rowtype;
  v_versao_origem sigav."TH_VERSAO_PESQUISA"%rowtype;
  v_aplicacao_origem sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_nova_versao uuid;
  v_novo_numero integer;
  v_nova_aplicacao uuid;
  v_novo_codigo_aplicacao text;
  v_mapa_secao jsonb := '{}'::jsonb;
  v_mapa_pergunta jsonb := '{}'::jsonb;
  v_mapa_opcao jsonb := '{}'::jsonb;
  v_secao record;
  v_pergunta record;
  v_opcao record;
  v_regra record;
  v_nova_regra uuid;
  v_alvo uuid;
  v_secoes integer := 0;
  v_perguntas integer := 0;
  v_regras integer := 0;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  select * into v_pesquisa from sigav."TB_PESQUISA" where id = p_pesquisa for update;
  if v_pesquisa.id is null then
    raise exception 'Avaliação não encontrada.';
  end if;

  if v_pesquisa.dt_arquivamento is not null then
    raise exception 'Esta avaliação está arquivada. Restaure-a antes de criar uma nova versão.';
  end if;

  select * into v_versao_origem
  from sigav."TH_VERSAO_PESQUISA"
  where survey_id = p_pesquisa
  order by version_number desc
  limit 1
  for update;
  if v_versao_origem.id is null then
    raise exception 'Versão da pesquisa não encontrada.';
  end if;

  -- Cobre, com a mesma mensagem, tanto "nunca foi publicada" quanto "já existe
  -- um rascunho mais novo aguardando conclusão": nos dois casos a versão mais
  -- recente está em DRAFT.
  if v_versao_origem.status = 'DRAFT' then
    raise exception 'A versão mais recente desta avaliação ainda está em rascunho. Publique-a (ou conclua as alterações pendentes) antes de criar uma nova versão.';
  elsif v_versao_origem.status = 'RETIRED' then
    -- Defensivo: esta é a única função que grava RETIRED, e sempre insere a
    -- versão seguinte na mesma transação — não deveria haver uma RETIRED sem
    -- sucessora mais nova.
    raise exception 'A versão mais recente desta avaliação já está descontinuada.';
  end if;

  select * into v_aplicacao_origem
  from sigav."TB_APLICACAO_PESQUISA"
  where survey_version_id = v_versao_origem.id
  order by created_at desc
  limit 1
  for update;

  if v_aplicacao_origem.id is not null
     and v_aplicacao_origem.status not in ('CLOSED', 'CANCELLED') then
    raise exception 'O ciclo desta versão ainda está %. Encerre-o (Pausar ou Finalizar, em Propriedades do ciclo) antes de criar uma nova versão.',
      case v_aplicacao_origem.status
        when 'DRAFT' then 'em rascunho'
        when 'SCHEDULED' then 'agendado'
        when 'OPEN' then 'aberto'
        else lower(v_aplicacao_origem.status)
      end;
  end if;

  -- Aposenta a versão atual antes de inserir a próxima, para que nenhuma
  -- leitura concorrente resolva "a versão" pelas duas ao mesmo tempo.
  update sigav."TH_VERSAO_PESQUISA"
  set status = 'RETIRED', updated_at = now()
  where id = v_versao_origem.id;

  v_novo_numero := v_versao_origem.version_number + 1;

  insert into sigav."TH_VERSAO_PESQUISA" (
    survey_id, version_number, title, description, status, schema_version, settings, created_by
  )
  values (
    p_pesquisa, v_novo_numero, v_versao_origem.title, v_versao_origem.description,
    'DRAFT', v_versao_origem.schema_version, v_versao_origem.settings, v_pessoa
  )
  returning id into v_nova_versao;

  -- Seções em duas passagens: primeiro todas sem pai, depois o vínculo, para
  -- que uma seção aninhada não precise que a pai já exista na hora da
  -- inserção (mesma técnica de FC_CLONAR_PESQUISA).
  for v_secao in
    select * from sigav."TB_SECAO_PESQUISA" where survey_version_id = v_versao_origem.id order by position
  loop
    insert into sigav."TB_SECAO_PESQUISA" (survey_version_id, parent_section_id, code, title, description, position, settings)
    values (v_nova_versao, null, v_secao.code, v_secao.title, v_secao.description, v_secao.position, v_secao.settings)
    returning id into v_alvo;
    v_mapa_secao := v_mapa_secao || jsonb_build_object(v_secao.id::text, v_alvo::text);
    v_secoes := v_secoes + 1;
  end loop;

  for v_secao in
    select * from sigav."TB_SECAO_PESQUISA" where survey_version_id = v_versao_origem.id and parent_section_id is not null
  loop
    update sigav."TB_SECAO_PESQUISA"
    set parent_section_id = (v_mapa_secao->>v_secao.parent_section_id::text)::uuid
    where id = (v_mapa_secao->>v_secao.id::text)::uuid;
  end loop;

  for v_pergunta in
    select * from sigav."TB_PERGUNTA_PESQUISA" where survey_version_id = v_versao_origem.id order by position
  loop
    insert into sigav."TB_PERGUNTA_PESQUISA" (
      survey_version_id, section_id, code, title, description, question_type,
      required, position, validation, display_logic, scoring, settings
    ) values (
      v_nova_versao, (v_mapa_secao->>v_pergunta.section_id::text)::uuid, v_pergunta.code,
      v_pergunta.title, v_pergunta.description, v_pergunta.question_type,
      v_pergunta.required, v_pergunta.position, v_pergunta.validation,
      v_pergunta.display_logic, v_pergunta.scoring, v_pergunta.settings
    ) returning id into v_alvo;
    v_mapa_pergunta := v_mapa_pergunta || jsonb_build_object(v_pergunta.id::text, v_alvo::text);
    v_perguntas := v_perguntas + 1;

    for v_opcao in
      select * from sigav."TB_OPCAO_PERGUNTA" where question_id = v_pergunta.id order by position
    loop
      insert into sigav."TB_OPCAO_PERGUNTA" (question_id, code, label, value, score, position, active, metadata)
      values (v_alvo, v_opcao.code, v_opcao.label, v_opcao.value, v_opcao.score, v_opcao.position, v_opcao.active, v_opcao.metadata);
    end loop;
  end loop;

  -- O mapa de alternativas é montado numa passagem própria, pareando pelo par
  -- (pergunta, código) — único por constraint — porque o id novo só existe
  -- depois do laço acima.
  for v_opcao in
    select antiga.id as id_antigo, nova.id as id_novo
    from sigav."TB_OPCAO_PERGUNTA" antiga
    join sigav."TB_PERGUNTA_PESQUISA" pergunta_antiga on pergunta_antiga.id = antiga.question_id
    join sigav."TB_OPCAO_PERGUNTA" nova
      on nova.question_id = (v_mapa_pergunta->>pergunta_antiga.id::text)::uuid
     and nova.code = antiga.code
    where pergunta_antiga.survey_version_id = v_versao_origem.id
  loop
    v_mapa_opcao := v_mapa_opcao || jsonb_build_object(v_opcao.id_antigo::text, v_opcao.id_novo::text);
  end loop;

  -- Regras condicionais, já apontando para os identificadores da versão nova.
  for v_regra in
    select * from sigav."TB_REGRA_CONDICIONAL" where sq_versao_pesquisa = v_versao_origem.id and st_ativo
  loop
    v_alvo := case v_regra.tp_alvo
      when 'SECTION' then (v_mapa_secao->>v_regra.sq_alvo::text)::uuid
      else (v_mapa_pergunta->>v_regra.sq_alvo::text)::uuid
    end;
    if v_alvo is null then
      continue;
    end if;

    insert into sigav."TB_REGRA_CONDICIONAL" (
      sq_versao_pesquisa, tp_alvo, sq_alvo, tp_acao, tp_conector, ds_regra, au_usuario_inclusao
    ) values (
      v_nova_versao, v_regra.tp_alvo, v_alvo, v_regra.tp_acao, v_regra.tp_conector, v_regra.ds_regra, v_pessoa
    ) returning sq_regra into v_nova_regra;

    insert into sigav."TB_CONDICAO_REGRA" (sq_regra, sq_pergunta_origem, tp_operador, sq_opcao, tx_valor, nu_valor, nu_ordem)
    select
      v_nova_regra,
      (v_mapa_pergunta->>condicao.sq_pergunta_origem::text)::uuid,
      condicao.tp_operador,
      case when condicao.sq_opcao is null then null else (v_mapa_opcao->>condicao.sq_opcao::text)::uuid end,
      condicao.tx_valor, condicao.nu_valor, condicao.nu_ordem
    from sigav."TB_CONDICAO_REGRA" condicao
    where condicao.sq_regra = v_regra.sq_regra
      and (v_mapa_pergunta->>condicao.sq_pergunta_origem::text) is not null;

    v_regras := v_regras + 1;
  end loop;

  -- Ciclo novo: mesmas preferências operacionais do ciclo anterior (visibilidade,
  -- reenvio, anonimato, limiar, aviso por e-mail), sem período e sem identidade
  -- visual própria — o código nunca colide porque é a primeira vez que este
  -- version_number existe para esta pesquisa.
  v_novo_codigo_aplicacao := upper(v_pesquisa.code) || '-' || v_novo_numero::text;

  insert into sigav."TB_APLICACAO_PESQUISA" (
    survey_version_id, code, name, opens_at, closes_at, status,
    allow_drafts, allow_resubmission, anonymous, access_mode,
    nu_limiar_anonimato, st_notificacao_email, settings, created_by
  ) values (
    v_nova_versao,
    v_novo_codigo_aplicacao,
    coalesce(v_aplicacao_origem.name, v_pesquisa.name),
    null, null, 'DRAFT',
    coalesce(v_aplicacao_origem.allow_drafts, true),
    coalesce(v_aplicacao_origem.allow_resubmission, false),
    coalesce(v_aplicacao_origem.anonymous, false),
    coalesce(v_aplicacao_origem.access_mode, 'RESTRICTED'),
    coalesce(v_aplicacao_origem.nu_limiar_anonimato, 5),
    coalesce(v_aplicacao_origem.st_notificacao_email, false),
    '{}'::jsonb,
    v_pessoa
  )
  returning id into v_nova_aplicacao;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    actor_person_id, event_type, entity_type, entity_id, application_id, before_data, after_data, metadata
  ) values (
    v_pessoa, 'SURVEY_VERSION_CREATED', 'SURVEY_VERSION', v_nova_versao::text, v_nova_aplicacao,
    jsonb_build_object('retiredVersionId', v_versao_origem.id, 'retiredVersionNumber', v_versao_origem.version_number),
    jsonb_build_object(
      'newVersionId', v_nova_versao, 'newVersionNumber', v_novo_numero,
      'newApplicationId', v_nova_aplicacao, 'newApplicationCode', v_novo_codigo_aplicacao
    ),
    jsonb_build_object('surveyId', p_pesquisa)
  );

  return jsonb_build_object(
    'status', 'OK',
    'surveyId', p_pesquisa,
    'versionId', v_nova_versao,
    'versionNumber', v_novo_numero,
    'applicationId', v_nova_aplicacao,
    'applicationCode', v_novo_codigo_aplicacao,
    'sections', v_secoes,
    'questions', v_perguntas,
    'rules', v_regras
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_DEFINIR_COMUNICADO_INICIO"(p_ativo boolean, p_titulo text, p_mensagem text, p_link text DEFAULT NULL::text, p_rotulo_link text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_ator uuid := sigav."FC_PESSOA_SESSAO"();
  v_titulo text := nullif(btrim(p_titulo), '');
  v_mensagem text := nullif(btrim(p_mensagem), '');
  v_link text := nullif(btrim(p_link), '');
  v_rotulo text := nullif(btrim(p_rotulo_link), '');
  v_anterior jsonb;
  v_novo jsonb;
begin
  if v_ator is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;
  if not sigav."FC_E_ADMINISTRADOR"() then
    raise exception 'Acesso restrito ao Superadmin da plataforma.';
  end if;

  if coalesce(p_ativo, false) and (v_titulo is null or v_mensagem is null) then
    raise exception 'Informe título e mensagem antes de ativar o comunicado.';
  end if;
  if length(coalesce(v_titulo, '')) > 120 then
    raise exception 'O título deve ter no máximo 120 caracteres.';
  end if;
  if length(coalesce(v_mensagem, '')) > 400 then
    raise exception 'A mensagem deve ter no máximo 400 caracteres.';
  end if;
  if length(coalesce(v_rotulo, '')) > 60 then
    raise exception 'O texto do link deve ter no máximo 60 caracteres.';
  end if;
  if v_link is not null
     and v_link !~* '^https://[^[:space:]]+$'
     and v_link !~ '^/[^/[:space:]][^[:space:]]*$' then
    raise exception 'O link deve ser uma rota interna ou um endereço HTTPS.';
  end if;
  if v_link is null then
    v_rotulo := null;
  end if;

  select jsonb_build_object(
    'enabled', fl_comunicado_inicio_ativo,
    'title', tx_comunicado_inicio_titulo,
    'message', tx_comunicado_inicio_mensagem,
    'link', tx_comunicado_inicio_link,
    'linkLabel', tx_comunicado_inicio_rotulo_link
  )
  into v_anterior
  from sigav."TB_CONFIG_PLATAFORMA"
  where co_configuracao = 1
  for update;

  update sigav."TB_CONFIG_PLATAFORMA"
  set fl_comunicado_inicio_ativo = coalesce(p_ativo, false),
      tx_comunicado_inicio_titulo = v_titulo,
      tx_comunicado_inicio_mensagem = v_mensagem,
      tx_comunicado_inicio_link = v_link,
      tx_comunicado_inicio_rotulo_link = v_rotulo,
      au_usuario_alteracao = v_ator,
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  select jsonb_build_object(
    'enabled', fl_comunicado_inicio_ativo,
    'title', tx_comunicado_inicio_titulo,
    'message', tx_comunicado_inicio_mensagem,
    'link', tx_comunicado_inicio_link,
    'linkLabel', tx_comunicado_inicio_rotulo_link
  )
  into v_novo
  from sigav."TB_CONFIG_PLATAFORMA"
  where co_configuracao = 1;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    actor_person_id, event_type, entity_type, entity_id,
    before_data, after_data, metadata
  ) values (
    v_ator, 'HOME_ANNOUNCEMENT_UPDATED', 'PLATFORM_SETTINGS', 'home-announcement',
    v_anterior, v_novo, jsonb_build_object('source', 'ADMIN_SETTINGS')
  );

  return sigav."FC_OBTER_MARCA_PLATAFORMA"();
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_DEFINIR_COR_BARRA_LATERAL"(p_cor text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_cor text := nullif(btrim(coalesce(p_cor, '')), '');
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  -- A constraint da coluna já recusaria formato inválido; validar aqui existe
  -- para a mensagem chegar em português a quem está configurando, e não como
  -- erro de restrição do banco.
  if v_cor is not null and v_cor !~* '^#[0-9a-f]{6}$' then
    raise exception 'Use uma cor no formato #RRGGBB.';
  end if;

  update sigav."TB_CONFIG_PLATAFORMA"
  set co_cor_barra_lateral = v_cor,
      au_usuario_alteracao = sigav."FC_PESSOA_SESSAO"(),
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  return jsonb_build_object('status', 'OK', 'sidebarColor', v_cor);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_DEFINIR_COR_PAINEL_ACESSO"(p_cor text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_cor text := lower(nullif(btrim(coalesce(p_cor, '')), ''));
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração da plataforma.';
  end if;

  -- A constraint da coluna já recusa formato inválido; validar aqui existe para
  -- a mensagem chegar em português a quem está configurando.
  if v_cor is not null and v_cor !~* '^#[0-9a-f]{6}$' then
    raise exception 'Use uma cor no formato #RRGGBB.';
  end if;

  -- Grava **apenas** a cor. A imagem de fundo não é tocada aqui.
  update sigav."TB_CONFIG_PLATAFORMA"
  set co_cor_painel_acesso = v_cor,
      au_usuario_alteracao = sigav."FC_PESSOA_SESSAO"(),
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  return jsonb_build_object('status', 'OK', 'accessPanelColor', v_cor);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_DEFINIR_FUNDO_ACESSO"(p_url text DEFAULT NULL::text, p_caminho text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_url text := nullif(btrim(coalesce(p_url, '')), '');
  v_caminho text := nullif(btrim(coalesce(p_caminho, '')), '');
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração da plataforma.';
  end if;

  -- URL e caminho andam juntos: guardar um sem o outro deixaria a imagem
  -- impossível de substituir ou de remover do storage depois.
  if (v_url is null) <> (v_caminho is null) then
    raise exception 'Informe a imagem e o caminho de armazenamento em conjunto.';
  end if;

  -- A tela de acesso é servida por HTTPS; imagem em HTTP causaria conteúdo
  -- misto e permitiria troca da arte em trânsito.
  if v_url is not null and v_url not like 'https://%' then
    raise exception 'A imagem de fundo precisa ser servida por HTTPS.';
  end if;

  -- Grava **apenas** os campos da imagem. A cor do painel não é tocada aqui.
  update sigav."TB_CONFIG_PLATAFORMA"
  set tx_url_fundo_acesso = v_url,
      tx_caminho_fundo_acesso = v_caminho,
      au_usuario_alteracao = sigav."FC_PESSOA_SESSAO"(),
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  return jsonb_build_object('status', 'OK', 'accessBackgroundUrl', v_url, 'accessBackgroundPath', v_caminho);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_DEFINIR_MODELO_AVALIACAO"(p_pesquisa uuid, p_modelo boolean, p_categoria text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_pesquisa sigav."TB_PESQUISA"%rowtype;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  select * into v_pesquisa from sigav."TB_PESQUISA" where id = p_pesquisa;
  if v_pesquisa.id is null then
    raise exception 'Avaliação não localizada.';
  end if;

  -- Instrumento com ciclo em operação não vira modelo: modelo é ponto de
  -- partida, e sair do catálogo administrativo esconderia um ciclo ativo de
  -- quem precisa operá-lo.
  if p_modelo and exists (
    select 1
    from sigav."TB_APLICACAO_PESQUISA" aplicacao
    join sigav."TH_VERSAO_PESQUISA" versao on versao.id = aplicacao.survey_version_id
    where versao.survey_id = p_pesquisa
      and aplicacao.status in ('OPEN', 'SCHEDULED')
  ) then
    raise exception 'Esta avaliação tem ciclo aberto ou agendado. Encerre o ciclo antes de transformá-la em modelo.';
  end if;

  update sigav."TB_PESQUISA"
  set st_modelo = p_modelo,
      tx_categoria_modelo = case when p_modelo then nullif(btrim(coalesce(p_categoria, '')), '') else null end,
      updated_at = now()
  where id = p_pesquisa;

  return jsonb_build_object('status', 'OK', 'surveyId', p_pesquisa, 'isTemplate', p_modelo);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_DEFINIR_NOTIFICACAO_EMAIL"(target_survey_id uuid, target_enabled boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor uuid := sigav."FC_PESSOA_SESSAO"();
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_before boolean;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração.';
  end if;

  if target_enabled is null then
    raise exception 'Informe se a notificação deve ficar ligada ou desligada.';
  end if;

  select a.*
  into v_application
  from sigav."TB_APLICACAO_PESQUISA" a
  join sigav."TH_VERSAO_PESQUISA" v on v.id = a.survey_version_id
  where v.survey_id = target_survey_id
  order by v.version_number desc, a.created_at desc
  limit 1;

  if v_application.id is null then
    raise exception 'O ciclo de aplicação ainda não foi criado.';
  end if;

  v_before := v_application.st_notificacao_email;

  update sigav."TB_APLICACAO_PESQUISA"
  set st_notificacao_email = target_enabled,
      updated_at = timezone('utc', now())
  where id = v_application.id;

  if v_before is distinct from target_enabled then
    insert into sigav."TL_EVENTO_AUDITORIA"(
      actor_person_id, event_type, entity_type, entity_id, application_id,
      before_data, after_data, metadata
    )
    values (
      v_actor,
      'SURVEY_EMAIL_NOTIFICATIONS_SET',
      'SURVEY_APPLICATION',
      v_application.id::text,
      v_application.id,
      jsonb_build_object('emailNotifications', v_before),
      jsonb_build_object('emailNotifications', target_enabled),
      jsonb_build_object('surveyId', target_survey_id)
    );
  end if;

  return jsonb_build_object(
    'status', 'OK',
    'applicationId', v_application.id,
    'emailNotifications', target_enabled
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_DEFINIR_PERMISSOES_PESSOA"(p_pessoa uuid, p_permissoes text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor_id uuid;
  v_person_name text;
  v_permissions text[];
  v_before text[];
  v_unknown text[];
  v_other_admins integer;
begin
  if sigav."FC_PAPEL_SESSAO"() is distinct from 'authenticated'
     or not sigav."FC_TEM_MODULO"('ADMIN_ACCESS') then
    raise exception 'Acesso restrito à administração de permissões.' using errcode = '42501';
  end if;

  v_actor_id := sigav."FC_PESSOA_SESSAO"();
  if v_actor_id is null then
    raise exception 'Sessão sem cadastro institucional vinculado.' using errcode = '42501';
  end if;

  select full_name
  into v_person_name
  from sigav."TB_PESSOA"
  where id = p_pessoa
    and active;

  if v_person_name is null then
    raise exception 'Pessoa ativa não encontrada.' using errcode = '22023';
  end if;

  select array_agg(distinct upper(btrim(item)) order by upper(btrim(item)))
  into v_unknown
  from unnest(coalesce(p_permissoes, array[]::text[])) item
  where btrim(item) <> ''
    and not exists (
      select 1
      from sigav."TB_MODULO_PLATAFORMA" pm
      where pm.code = upper(btrim(item))
        and pm.active
    );

  if coalesce(cardinality(v_unknown), 0) > 0 then
    raise exception 'Permissões desconhecidas: %', array_to_string(v_unknown, ', ')
      using errcode = '22023';
  end if;

  select coalesce(array_agg(pm.code order by pm.position, pm.code), array[]::text[])
  into v_permissions
  from sigav."TB_MODULO_PLATAFORMA" pm
  where pm.active
    and (
      pm.code in ('HOME', 'SURVEYS')
      or pm.code = any(array(
        select upper(btrim(item))
        from unnest(coalesce(p_permissoes, array[]::text[])) item
        where btrim(item) <> ''
      ))
    );

  v_before := sigav."FC_MODULOS_EFETIVOS"(p_pessoa);

  if p_pessoa = v_actor_id
     and not ('ADMIN_ACCESS' = any(v_permissions)) then
    raise exception 'Você não pode retirar sua própria permissão de administrar acessos.' using errcode = '42501';
  end if;

  if 'ADMIN_ACCESS' = any(v_before)
     and not ('ADMIN_ACCESS' = any(v_permissions)) then
    select count(*)::integer
    into v_other_admins
    from sigav."TB_PESSOA" p
    where p.active
      and p.id <> p_pessoa
      and 'ADMIN_ACCESS' = any(sigav."FC_MODULOS_EFETIVOS"(p.id));

    if v_other_admins = 0 then
      raise exception 'A plataforma precisa manter ao menos uma pessoa com administração de acessos.' using errcode = '42501';
    end if;
  end if;

  delete from sigav."RL_PESSOA_MODULO"
  where person_id = p_pessoa;

  insert into sigav."RL_PESSOA_MODULO" (
    person_id,
    module_code,
    allowed,
    granted_by,
    created_at,
    updated_at
  )
  select
    p_pessoa,
    pm.code,
    pm.code = any(v_permissions),
    v_actor_id,
    timezone('utc', now()),
    timezone('utc', now())
  from sigav."TB_MODULO_PLATAFORMA" pm
  where pm.active;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'PERSON_PERMISSIONS_SET',
    'PERSON_MODULE_PERMISSION',
    p_pessoa::text,
    jsonb_build_object('permissions', to_jsonb(v_before)),
    jsonb_build_object(
      'personId', p_pessoa,
      'personName', v_person_name,
      'permissions', to_jsonb(v_permissions)
    ),
    jsonb_build_object('technicalRole', 'authenticated')
  );

  return jsonb_build_object(
    'status', 'OK',
    'personId', p_pessoa,
    'technicalRole', 'authenticated',
    'permissions', to_jsonb(v_permissions)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_DEFINIR_PRESENCA_PLATAFORMA"(fl_ativa_param boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if sigav."FC_PAPEL_SESSAO"() is distinct from 'authenticated'
     or not sigav."FC_TEM_MODULO"('ADMIN_ACCESS') then
    raise exception 'Acesso restrito à administração da presença online.' using errcode = '42501';
  end if;

  update sigav."TB_CONFIG_PLATAFORMA"
  set fl_presenca_online_ativa = coalesce(fl_ativa_param, false),
      au_usuario_alteracao = sigav."FC_PESSOA_SESSAO"(),
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  return jsonb_build_object(
    'onlinePresenceEnabled', coalesce(fl_ativa_param, false)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_DEFINIR_RETENCAO_ANONIMA"(p_dias integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  -- A constraint já recusaria, mas a mensagem chegaria como erro de restrição.
  -- Aqui ela chega em português, para quem está configurando.
  if p_dias is null or p_dias < 7 or p_dias > 730 then
    raise exception 'O prazo deve ficar entre 7 e 730 dias.';
  end if;

  update sigav."TB_CONFIG_PLATAFORMA"
  set nu_dias_retencao_rascunho_anonimo = p_dias,
      au_usuario_alteracao = sigav."FC_PESSOA_SESSAO"(),
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  return jsonb_build_object('status', 'OK', 'dias', p_dias);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_DEFINIR_TEXTOS_EMAIL"(p_instrucao text DEFAULT NULL::text, p_rodape text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_instrucao text := nullif(btrim(coalesce(p_instrucao, '')), '');
  v_rodape text := nullif(btrim(coalesce(p_rodape, '')), '');
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  -- Os limites são maiores que os da tela de acesso porque aqui o texto ocupa
  -- um parágrafo de e-mail, e não uma linha de cartão. Ainda assim há limite:
  -- corpo longo demais é cortado pelo Gmail atrás de "mensagem truncada", e a
  -- parte escondida costuma ser justamente o rodapé que identifica o remetente.
  if v_instrucao is not null and length(v_instrucao) > 400 then
    raise exception 'A instrução de acesso deve ter no máximo 400 caracteres.';
  end if;
  if v_rodape is not null and length(v_rodape) > 400 then
    raise exception 'O rodapé deve ter no máximo 400 caracteres.';
  end if;

  update sigav."TB_CONFIG_PLATAFORMA"
  set tx_instrucao_email = v_instrucao,
      tx_rodape_email = v_rodape,
      au_usuario_alteracao = sigav."FC_PESSOA_SESSAO"(),
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  return jsonb_build_object(
    'status', 'OK',
    'emailInstruction', v_instrucao,
    'emailFooter', v_rodape
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_DEFINIR_TEXTOS_MARCA"(p_expansao text DEFAULT NULL::text, p_saudacao text DEFAULT NULL::text, p_instrucao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_expansao text := nullif(btrim(coalesce(p_expansao, '')), '');
  v_saudacao text := nullif(btrim(coalesce(p_saudacao, '')), '');
  v_instrucao text := nullif(btrim(coalesce(p_instrucao, '')), '');
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  -- Os limites existem porque estes textos aparecem num cartão estreito: a
  -- expansão ocupa duas linhas no celular, e a saudação é o título de maior
  -- destaque da tela. Texto longo demais não quebra nada, mas descaracteriza a
  -- tela de quem entra — e é mais honesto recusar do que truncar calado.
  if v_expansao is not null and length(v_expansao) > 120 then
    raise exception 'A expansão da sigla deve ter no máximo 120 caracteres.';
  end if;
  if v_saudacao is not null and length(v_saudacao) > 80 then
    raise exception 'A saudação deve ter no máximo 80 caracteres.';
  end if;
  if v_instrucao is not null and length(v_instrucao) > 120 then
    raise exception 'A instrução deve ter no máximo 120 caracteres.';
  end if;

  update sigav."TB_CONFIG_PLATAFORMA"
  set ds_produto = v_expansao,
      tx_saudacao_acesso = v_saudacao,
      tx_instrucao_acesso = v_instrucao,
      au_usuario_alteracao = sigav."FC_PESSOA_SESSAO"(),
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  return jsonb_build_object(
    'status', 'OK',
    'productDescription', v_expansao,
    'accessGreeting', v_saudacao,
    'accessInstruction', v_instrucao
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p_valor text, p_selecionados jsonb)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select case
    when p_selecionados is null
      or jsonb_typeof(p_selecionados) <> 'array'
      or jsonb_array_length(p_selecionados) = 0
      then true
    else sigav."FC_NORMALIZAR_ROTULO"(p_valor) in (
      select sigav."FC_NORMALIZAR_ROTULO"(valor)
      from jsonb_array_elements_text(p_selecionados) as escolhido(valor)
    )
  end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ENVIAR_RESP_ANON"(target_submission_id uuid, target_session_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_submission sigav."TB_SUBMISSAO"%rowtype;
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_missing integer;
  v_submitted_at timestamptz := now();
  v_token_hash text;
begin
  if target_session_token is null then raise exception 'A resposta anônima não está disponível para envio.'; end if;
  v_token_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(target_session_token, 'UTF8')), 'hex');
  select * into v_submission from sigav."TB_SUBMISSAO" where id=target_submission_id for update;
  if v_submission.id is null or v_submission.status <> 'DRAFT' or coalesce(v_submission.metadata ->> 'public_session_token_hash','') <> v_token_hash then
    raise exception 'A resposta anônima não está disponível para envio.';
  end if;
  select * into v_application from sigav."TB_APLICACAO_PESQUISA" where id=v_submission.application_id;
  if not v_application.anonymous or not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application.id) then raise exception 'O período de respostas está encerrado.'; end if;
  select count(*)::integer into v_missing
  from sigav."TB_PERGUNTA_PESQUISA" q
  where q.survey_version_id=v_application.survey_version_id
    and q.required
    and sigav."FC_PERGUNTA_VISIVEL"(v_submission.id,q.id)
    and not exists (
      select 1 from sigav."TB_RESPOSTA" a
      where a.submission_id=v_submission.id and a.question_id=q.id and (
        (q.question_type in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE') and exists(select 1 from sigav."RL_RESPOSTA_OPCAO" ao where ao.answer_id=a.id))
        or (q.question_type in ('SHORT_TEXT','LONG_TEXT') and nullif(btrim(a.answer_text),'') is not null)
        or (q.question_type in ('INTEGER','DECIMAL') and a.answer_number is not null)
        or (q.question_type='BOOLEAN' and a.answer_boolean is not null)
        or (q.question_type='DATE' and a.answer_date is not null)
        or (q.question_type='DATETIME' and a.answer_datetime is not null)
      )
    );
  if v_missing>0 then raise exception 'Existem % pergunta(s) obrigatória(s) sem resposta.',v_missing; end if;
  update sigav."TB_SUBMISSAO"
  set status='SUBMITTED',submitted_at=v_submitted_at,updated_at=v_submitted_at,
      metadata=(coalesce(metadata,'{}'::jsonb)-'public_session_token'-'public_session_token_hash')||jsonb_build_object('submitted_from','PUBLIC_ANONYMOUS_LINK')
  where id=v_submission.id;
  insert into sigav."TL_EVENTO_AUDITORIA"(actor_person_id,event_type,entity_type,entity_id,application_id,after_data,metadata)
  values(null,'ANONYMOUS_SUBMISSION_SUBMITTED','APPLICATION',v_application.id::text,v_application.id,jsonb_build_object('status','SUBMITTED'),jsonb_build_object('anonymous',true));
  return jsonb_build_object('status','OK','submissionStatus','SUBMITTED','submittedAt',v_submitted_at,'anonymous',true);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_EXCLUIR_PESQUISA_ARQUIVADA"(p_pesquisa uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor uuid := sigav."FC_PESSOA_SESSAO"();
  v_survey sigav."TB_PESQUISA"%rowtype;
  v_versoes uuid[];
  v_aplicacoes uuid[];
  v_aplicacoes_auditoria jsonb;
  v_submissoes integer;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração.';
  end if;

  select * into v_survey from sigav."TB_PESQUISA" where id = p_pesquisa for update;
  if v_survey.id is null then raise exception 'Avaliação não encontrada.'; end if;
  if v_survey.dt_arquivamento is null then
    raise exception 'Apenas avaliações arquivadas podem ser apagadas definitivamente.';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_versoes
  from sigav."TH_VERSAO_PESQUISA" where survey_id = p_pesquisa;
  select coalesce(array_agg(id), '{}'::uuid[]) into v_aplicacoes
  from sigav."TB_APLICACAO_PESQUISA" where survey_version_id = any(v_versoes);
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'code', code, 'status', status)), '[]'::jsonb)
  into v_aplicacoes_auditoria
  from sigav."TB_APLICACAO_PESQUISA" where id = any(v_aplicacoes);
  select count(*)::integer into v_submissoes
  from sigav."TB_SUBMISSAO" where application_id = any(v_aplicacoes);

  insert into sigav."TL_EVENTO_AUDITORIA"(
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
  delete from sigav."TB_RESULTADO_FINAL_CDDI" where application_id = any(v_aplicacoes);
  delete from sigav."TB_SUBMISSAO" where application_id = any(v_aplicacoes);
  delete from sigav."TB_REGRA_CONDICIONAL" where sq_versao_pesquisa = any(v_versoes);

  perform set_config('app.exclusao_arquivada', 'on', true);
  delete from sigav."TB_OPCAO_PERGUNTA"
  where question_id in (select id from sigav."TB_PERGUNTA_PESQUISA" where survey_version_id = any(v_versoes));
  delete from sigav."TB_PERGUNTA_PESQUISA" where survey_version_id = any(v_versoes);

  -- Sempre remove folhas antes das seções-pai: isso impede o cascade da FK
  -- recursiva de acionar o gatilho estrutural num estado intermediário.
  loop
    delete from sigav."TB_SECAO_PESQUISA" filha
    where filha.survey_version_id = any(v_versoes)
      and not exists (
        select 1 from sigav."TB_SECAO_PESQUISA" neta where neta.parent_section_id = filha.id
      );
    exit when not found;
  end loop;

  delete from sigav."TB_APLICACAO_PESQUISA" where id = any(v_aplicacoes);
  delete from sigav."TH_VERSAO_PESQUISA" where survey_id = p_pesquisa;
  delete from sigav."TB_PESQUISA" where id = p_pesquisa;

  return jsonb_build_object('status', 'OK', 'code', v_survey.code, 'name', v_survey.name);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_EXCLUIR_PESQUISA_RASCUNHO"(p_pesquisa uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor uuid := sigav."FC_PESSOA_SESSAO"();
  v_survey sigav."TB_PESQUISA"%rowtype;
  v_publicadas integer;
  v_submissoes integer;
  v_aplicacoes jsonb;
  v_versoes uuid[];
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração.';
  end if;

  select * into v_survey
  from sigav."TB_PESQUISA"
  where id = p_pesquisa
  for update;
  if v_survey.id is null then
    raise exception 'Avaliação não encontrada.';
  end if;

  -- Publicada uma única vez, a avaliação deixa de ser descartável: a estrutura
  -- vira referência histórica de quem respondeu, mesmo que o ciclo esteja
  -- encerrado ou cancelado. O trigger estrutural também barraria o delete.
  select count(*)::integer into v_publicadas
  from sigav."TH_VERSAO_PESQUISA"
  where survey_id = p_pesquisa
    and status <> 'DRAFT';
  if v_publicadas > 0 then
    raise exception 'Esta avaliação já foi publicada e não pode ser excluída. Cancele o ciclo para encerrá-la.';
  end if;

  select count(*)::integer into v_submissoes
  from sigav."TB_SUBMISSAO" s
  join sigav."TB_APLICACAO_PESQUISA" a on a.id = s.application_id
  join sigav."TH_VERSAO_PESQUISA" v on v.id = a.survey_version_id
  where v.survey_id = p_pesquisa;
  if v_submissoes > 0 then
    raise exception 'Esta avaliação já possui respostas registradas e não pode ser excluída.';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_versoes
  from sigav."TH_VERSAO_PESQUISA"
  where survey_id = p_pesquisa;

  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'code', a.code, 'status', a.status)), '[]'::jsonb)
  into v_aplicacoes
  from sigav."TB_APLICACAO_PESQUISA" a
  where a.survey_version_id = any(v_versoes);

  -- Auditoria antes do delete e com `application_id` nulo: a coluna referencia
  -- TB_APLICACAO_PESQUISA com `on delete set null`, e o identificador do ciclo
  -- fica preservado em `metadata`, que é jsonb e não tem chave estrangeira.
  insert into sigav."TL_EVENTO_AUDITORIA"(
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
  -- é o que satisfaz FC_EXIGIR_RASCUNHO_ESTRUT em cada linha removida.
  delete from sigav."TB_OPCAO_PERGUNTA"
  where question_id in (
    select id from sigav."TB_PERGUNTA_PESQUISA" where survey_version_id = any(v_versoes)
  );

  delete from sigav."TB_PERGUNTA_PESQUISA"
  where survey_version_id = any(v_versoes);

  -- Seções da folha para a raiz. `delete` sem filhas restantes nunca aciona o
  -- cascade de survey_sections_parent_same_version_fk, então o trigger avalia
  -- cada linha com a versão presente. Um `delete` direto pela versão removeria
  -- o pai antes da filha e traria de volta "Versão da pesquisa não encontrada.".
  loop
    delete from sigav."TB_SECAO_PESQUISA" filha
    where filha.survey_version_id = any(v_versoes)
      and not exists (
        select 1
        from sigav."TB_SECAO_PESQUISA" neta
        where neta.parent_section_id = filha.id
      );
    exit when not found;
  end loop;

  -- RL_APLICACAO_PESSOA e os vínculos do CDDI caem por cascade a partir do
  -- ciclo; TB_SUBMISSAO referencia com `restrict`, e a checagem acima é a
  -- garantia de que não há nenhuma para destruir.
  delete from sigav."TB_APLICACAO_PESQUISA"
  where survey_version_id = any(v_versoes);

  delete from sigav."TH_VERSAO_PESQUISA" where survey_id = p_pesquisa;
  delete from sigav."TB_PESQUISA" where id = p_pesquisa;

  return jsonb_build_object(
    'status', 'OK',
    'code', v_survey.code,
    'name', v_survey.name
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_EXCLUIR_REGRA_CONDICIONAL"(p_alvo uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_pessoa uuid := sigav."FC_PESSOA_SESSAO"();
  v_versao uuid;
  v_status text;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  select sq_versao_pesquisa into v_versao
  from sigav."TB_REGRA_CONDICIONAL" where sq_alvo = p_alvo;
  if v_versao is null then
    return jsonb_build_object('status', 'OK', 'removed', 0);
  end if;

  select status into v_status from sigav."TH_VERSAO_PESQUISA" where id = v_versao;
  if v_status <> 'DRAFT' then
    raise exception 'A lógica condicional só pode ser alterada enquanto a versão está em rascunho.';
  end if;

  delete from sigav."TB_REGRA_CONDICIONAL" where sq_alvo = p_alvo;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    actor_person_id, event_type, entity_type, entity_id, after_data, metadata
  ) values (
    v_pessoa, 'SURVEY_RULE_DELETED', 'CONDITIONAL_RULE', p_alvo::text, '{}'::jsonb, '{}'::jsonb
  );

  return jsonb_build_object('status', 'OK', 'removed', 1);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_EXPIRAR_PESQUISAS_ARQ"()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_pesquisa record;
  v_versao uuid;
begin
  for v_pesquisa in
    select s.id, s.code, s.name
    from sigav."TB_PESQUISA" s
    where s.dt_arquivamento is not null
      and s.dt_arquivamento < now() - interval '30 days'
      and not exists (
        select 1
        from sigav."TB_SUBMISSAO" sub
        join sigav."TB_APLICACAO_PESQUISA" a on a.id = sub.application_id
        join sigav."TH_VERSAO_PESQUISA" v on v.id = a.survey_version_id
        where v.survey_id = s.id
      )
      and not exists (
        select 1
        from sigav."TH_VERSAO_PESQUISA" v
        where v.survey_id = s.id
          and v.status <> 'DRAFT'
      )
    for update of s skip locked
  loop
    -- A auditoria é gravada antes do delete e com `application_id` nulo: a
    -- coluna referencia TB_APLICACAO_PESQUISA, que será apagada em seguida.
    insert into sigav."TL_EVENTO_AUDITORIA"(
      actor_person_id, event_type, entity_type, entity_id, application_id,
      before_data, after_data, metadata
    ) values (
      null, 'SURVEY_ARCHIVE_EXPIRED', 'SURVEY', v_pesquisa.id::text, null,
      jsonb_build_object('code', v_pesquisa.code, 'name', v_pesquisa.name),
      null,
      jsonb_build_object('surveyId', v_pesquisa.id, 'reason', 'archived_over_30_days')
    );

    -- TB_APLICACAO_PESQUISA referencia a versão com `on delete restrict`, então
    -- é apagada explicitamente antes dela.
    for v_versao in
      select id from sigav."TH_VERSAO_PESQUISA" where survey_id = v_pesquisa.id
    loop
      delete from sigav."TB_APLICACAO_PESQUISA" where survey_version_id = v_versao;
    end loop;

    delete from sigav."TH_VERSAO_PESQUISA" where survey_id = v_pesquisa.id;
    delete from sigav."TB_PESQUISA" where id = v_pesquisa.id;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_EXPIRAR_RASCUNHOS_ANONIMOS"()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_dias integer;
  v_apagados integer;
begin
  select nu_dias_retencao_rascunho_anonimo into v_dias
  from sigav."TB_CONFIG_PLATAFORMA"
  where co_configuracao = 1;

  if v_dias is null then
    return 0;
  end if;

  delete from sigav."TB_SUBMISSAO" s
  where s.status = 'DRAFT'
    and s.metadata->>'origin' = 'PUBLIC_ANONYMOUS_LINK'
    -- O marcador de origem descreve como a submissão nasceu; estas três
    -- condições garantem também o estado atual. Se algum vínculo institucional
    -- tiver sido associado depois, a retenção anônima não pode apagar a linha.
    and s.participant_id is null
    and s.respondent_person_id is null
    and s.subject_person_id is null
    and s.updated_at < timezone('utc', now()) - make_interval(days => v_dias);

  get diagnostics v_apagados = row_count;

  if v_apagados > 0 then
    insert into sigav."TL_EVENTO_AUDITORIA"(
      actor_person_id, event_type, entity_type, entity_id, application_id,
      before_data, after_data, metadata
    )
    values (
      null, 'ANONYMOUS_DRAFTS_EXPIRED', 'submissions', null, null, null, null,
      jsonb_build_object('apagados', v_apagados, 'diasRetencao', v_dias)
    );
  end if;

  return v_apagados;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_GRAVAR_RESP_ANON"(target_submission_id uuid, target_session_token text, target_question_id uuid, target_option_ids uuid[], target_text text, target_number numeric, target_boolean boolean, target_date date, target_datetime timestamp with time zone, target_json jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_submission sigav."TB_SUBMISSAO"%rowtype;
  v_version_id uuid;
  v_question sigav."TB_PERGUNTA_PESQUISA"%rowtype;
  v_answer_id uuid;
  v_option_ids uuid[];
  v_invalid_options integer;
  v_text text;
  v_token_hash text;
begin
  if target_session_token is null then
    raise exception 'O rascunho anônimo não está disponível para edição.';
  end if;
  v_token_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(target_session_token, 'UTF8')), 'hex');
  select * into v_submission from sigav."TB_SUBMISSAO" where id = target_submission_id for update;
  if v_submission.id is null or v_submission.status <> 'DRAFT' or coalesce(v_submission.metadata ->> 'public_session_token_hash', '') <> v_token_hash then
    raise exception 'O rascunho anônimo não está disponível para edição.';
  end if;
  if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_submission.application_id) then
    raise exception 'O período de respostas está encerrado.';
  end if;
  select survey_version_id into v_version_id from sigav."TB_APLICACAO_PESQUISA" where id = v_submission.application_id and anonymous;
  if v_version_id is null then raise exception 'A avaliação anônima não está disponível.'; end if;
  select * into v_question from sigav."TB_PERGUNTA_PESQUISA" where id = target_question_id and survey_version_id = v_version_id;
  if v_question.id is null then raise exception 'Pergunta inválida para esta pesquisa.'; end if;
  if v_question.question_type in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE') then
    select coalesce(array_agg(distinct option_id),'{}'::uuid[]) into v_option_ids from unnest(coalesce(target_option_ids,'{}'::uuid[])) option_id;
    if coalesce(array_length(v_option_ids,1),0)=0 then
      delete from sigav."TB_RESPOSTA" where submission_id=v_submission.id and question_id=v_question.id;
    else
      if v_question.question_type in ('SCALE','SINGLE_CHOICE') and array_length(v_option_ids,1)<>1 then raise exception 'Selecione apenas uma alternativa.'; end if;
      select count(*) into v_invalid_options from unnest(v_option_ids) selected_id left join sigav."TB_OPCAO_PERGUNTA" qo on qo.id=selected_id and qo.question_id=v_question.id and qo.active where qo.id is null;
      if v_invalid_options>0 then raise exception 'Uma ou mais alternativas são inválidas.'; end if;
      insert into sigav."TB_RESPOSTA"(submission_id,question_id) values(v_submission.id,v_question.id)
      on conflict(submission_id,question_id) do update set answer_text=null,answer_number=null,answer_boolean=null,answer_date=null,answer_datetime=null,answer_json=null,score=null,updated_at=now()
      returning id into v_answer_id;
      delete from sigav."RL_RESPOSTA_OPCAO" where answer_id=v_answer_id;
      insert into sigav."RL_RESPOSTA_OPCAO"(answer_id,option_id,position)
      select v_answer_id,option_id,row_number() over(order by option_id)::integer from unnest(v_option_ids) option_id;
    end if;
  elsif v_question.question_type in ('SHORT_TEXT','LONG_TEXT') then
    v_text:=nullif(btrim(coalesce(target_text,'')), '');
    if length(coalesce(v_text,''))>12000 then raise exception 'O texto excede o limite de 12.000 caracteres.'; end if;
    if v_text is null then
      delete from sigav."TB_RESPOSTA" where submission_id=v_submission.id and question_id=v_question.id;
    else
      insert into sigav."TB_RESPOSTA"(submission_id,question_id,answer_text) values(v_submission.id,v_question.id,v_text)
      on conflict(submission_id,question_id) do update set answer_text=excluded.answer_text,answer_number=null,answer_boolean=null,answer_date=null,answer_datetime=null,answer_json=null,score=null,updated_at=now();
    end if;
  elsif v_question.question_type in ('INTEGER','DECIMAL') then
    if target_number is null then delete from sigav."TB_RESPOSTA" where submission_id=v_submission.id and question_id=v_question.id;
    else
      if v_question.question_type='INTEGER' and target_number<>trunc(target_number) then raise exception 'Informe um número inteiro.'; end if;
      insert into sigav."TB_RESPOSTA"(submission_id,question_id,answer_number) values(v_submission.id,v_question.id,target_number)
      on conflict(submission_id,question_id) do update set answer_text=null,answer_number=excluded.answer_number,answer_boolean=null,answer_date=null,answer_datetime=null,answer_json=null,score=null,updated_at=now();
    end if;
  elsif v_question.question_type='BOOLEAN' then
    if target_boolean is null then delete from sigav."TB_RESPOSTA" where submission_id=v_submission.id and question_id=v_question.id;
    else
      insert into sigav."TB_RESPOSTA"(submission_id,question_id,answer_boolean) values(v_submission.id,v_question.id,target_boolean)
      on conflict(submission_id,question_id) do update set answer_text=null,answer_number=null,answer_boolean=excluded.answer_boolean,answer_date=null,answer_datetime=null,answer_json=null,score=null,updated_at=now();
    end if;
  elsif v_question.question_type='DATE' then
    if target_date is null then delete from sigav."TB_RESPOSTA" where submission_id=v_submission.id and question_id=v_question.id;
    else
      insert into sigav."TB_RESPOSTA"(submission_id,question_id,answer_date) values(v_submission.id,v_question.id,target_date)
      on conflict(submission_id,question_id) do update set answer_text=null,answer_number=null,answer_boolean=null,answer_date=excluded.answer_date,answer_datetime=null,answer_json=null,score=null,updated_at=now();
    end if;
  elsif v_question.question_type='DATETIME' then
    if target_datetime is null then delete from sigav."TB_RESPOSTA" where submission_id=v_submission.id and question_id=v_question.id;
    else
      insert into sigav."TB_RESPOSTA"(submission_id,question_id,answer_datetime) values(v_submission.id,v_question.id,target_datetime)
      on conflict(submission_id,question_id) do update set answer_text=null,answer_number=null,answer_boolean=null,answer_date=null,answer_datetime=excluded.answer_datetime,answer_json=null,score=null,updated_at=now();
    end if;
  else raise exception 'Tipo de pergunta ainda não suportado: %.',v_question.question_type; end if;
  update sigav."TB_SUBMISSAO" set updated_at=now() where id=v_submission.id;
  return jsonb_build_object('status','OK','savedAt',now());
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_INICIAR_RESP_ANON"(target_application_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_submission sigav."TB_SUBMISSAO"%rowtype;
  v_token text := gen_random_uuid()::text;
  v_token_hash text := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(v_token, 'UTF8')), 'hex');
begin
  select * into v_application
  from sigav."TB_APLICACAO_PESQUISA"
  where code = btrim(target_application_code)
  limit 1;
  if v_application.id is null or not v_application.anonymous then
    raise exception 'A avaliação anônima não foi encontrada.';
  end if;
  if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application.id) then
    raise exception 'O período de respostas está encerrado.';
  end if;
  insert into sigav."TB_SUBMISSAO"(application_id, participant_id, respondent_person_id, subject_person_id, submission_type, status, metadata)
  values (v_application.id, null, null, null, 'RESPONSE', 'DRAFT', jsonb_build_object('origin', 'PUBLIC_ANONYMOUS_LINK', 'public_session_token_hash', v_token_hash))
  returning * into v_submission;
  return jsonb_build_object('status','OK','anonymous',true,'canEdit',true,'sessionToken',v_token,
    'submission',jsonb_build_object('id',v_submission.id,'status',v_submission.status,'submittedAt',null),'answers','{}'::jsonb);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_ACESSOS_PAGINADOS"(p_busca text DEFAULT ''::text, p_limite integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_busca text := btrim(coalesce(p_busca, ''));
  v_limite integer := greatest(1, least(coalesce(p_limite, 100), 100));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_total bigint;
  v_people jsonb;
  v_permissions jsonb;
begin
  if sigav."FC_PAPEL_SESSAO"() is distinct from 'authenticated'
     or not sigav."FC_TEM_MODULO"('ADMIN_ACCESS') then
    raise exception 'Acesso restrito à administração de permissões.' using errcode = '42501';
  end if;

  select count(*)
  into v_total
  from sigav."TB_PESSOA" person
  where person.active
    and (
      v_busca = ''
      or sigav."FC_SEM_ACENTO_MINUSCULA"(person.full_name) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(v_busca) || '%'
      or coalesce(person.employee_number, '') ilike '%' || v_busca || '%'
      or coalesce(person.institutional_email, '') ilike '%' || v_busca || '%'
      or sigav."FC_SEM_ACENTO_MINUSCULA"(coalesce(person.job_title, '')) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(v_busca) || '%'
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', pm.code,
    'name', pm.name,
    'description', pm.description,
    'category', pm.category,
    'position', pm.position,
    'required', pm.code in ('HOME', 'SURVEYS')
  ) order by pm.position, pm.code), '[]'::jsonb)
  into v_permissions
  from sigav."TB_MODULO_PLATAFORMA" pm
  where pm.active;

  select coalesce(jsonb_agg(jsonb_build_object(
    'personId', person.id,
    'fullName', person.full_name,
    'employeeNumber', person.employee_number,
    'institutionalEmail', person.institutional_email,
    'jobTitle', person.job_title,
    'unit', coalesce(person.metadata->>'unit', person.cost_center),
    'active', person.active,
    'permissions', to_jsonb(sigav."FC_MODULOS_EFETIVOS"(person.id))
  ) order by person.full_name, person.id), '[]'::jsonb)
  into v_people
  from (
    select candidate.*
    from sigav."TB_PESSOA" candidate
    where candidate.active
      and (
        v_busca = ''
        or sigav."FC_SEM_ACENTO_MINUSCULA"(candidate.full_name) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(v_busca) || '%'
        or coalesce(candidate.employee_number, '') ilike '%' || v_busca || '%'
        or coalesce(candidate.institutional_email, '') ilike '%' || v_busca || '%'
        or sigav."FC_SEM_ACENTO_MINUSCULA"(coalesce(candidate.job_title, '')) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(v_busca) || '%'
      )
    order by candidate.full_name, candidate.id
    limit v_limite
    offset v_offset
  ) person;

  return jsonb_build_object(
    'status', 'OK',
    'technicalRole', 'authenticated',
    'permissions', v_permissions,
    'people', v_people,
    'total', v_total,
    'limit', v_limite,
    'offset', v_offset,
    'hasMore', v_offset + jsonb_array_length(v_people) < v_total
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_AUDIENCIA_EMAIL"(p_aplicacao uuid, p_situacao text DEFAULT 'ALL'::text, p_busca text DEFAULT NULL::text, p_limite integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_result jsonb;
  v_limite integer := greatest(1, least(coalesce(p_limite, 500), 2000));
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_situacao text := upper(coalesce(nullif(btrim(p_situacao), ''), 'ALL'));
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  if v_situacao not in ('ALL', 'PENDING', 'DRAFT', 'DONE') then
    raise exception 'Situação inválida. Use ALL, PENDING, DRAFT ou DONE.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(f) order by f."fullName"), '[]'::jsonb)
  into v_result
  from (
    select
      p.id as "personId",
      p.full_name as "fullName",
      p.employee_number as "employeeNumber",
      p.institutional_email as email,
      ap.status as "participantStatus",
      d.situacao as situation,
      d.ultimo_envio as "lastEmailAt",
      d.ultimo_tipo as "lastEmailKind",
      d.ultimo_estado as "lastEmailStatus",
      (p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') as "emailValido"
    from sigav."RL_APLICACAO_PESSOA" ap
    join sigav."TB_PESSOA" p on p.id = ap.person_id
    cross join lateral (
      select
        case
          when ap.completed_at is not null
            or exists (
              select 1
              from sigav."TB_SUBMISSAO" sb
              where sb.application_id = ap.application_id
                and sb.respondent_person_id = p.id
                and (sb.subject_person_id is null or sb.subject_person_id = p.id)
                and sb.status in ('SUBMITTED', 'VALIDATED')
            ) then 'DONE'
          when exists (
              select 1
              from sigav."TB_SUBMISSAO" sb
              where sb.application_id = ap.application_id
                and sb.respondent_person_id = p.id
                and (sb.subject_person_id is null or sb.subject_person_id = p.id)
                and sb.status = 'DRAFT'
            ) then 'DRAFT'
          else 'PENDING'
        end as situacao,
        (
          select t.dt_criacao
          from sigav."TL_EMAIL_PARTICIPANTE" t
          where t.sq_aplicacao = ap.application_id
            and t.sq_pessoa = p.id
          order by t.dt_criacao desc
          limit 1
        ) as ultimo_envio,
        (
          select t.tp_email
          from sigav."TL_EMAIL_PARTICIPANTE" t
          where t.sq_aplicacao = ap.application_id
            and t.sq_pessoa = p.id
          order by t.dt_criacao desc
          limit 1
        ) as ultimo_tipo,
        (
          select t.st_envio
          from sigav."TL_EMAIL_PARTICIPANTE" t
          where t.sq_aplicacao = ap.application_id
            and t.sq_pessoa = p.id
          order by t.dt_criacao desc
          limit 1
        ) as ultimo_estado
    ) d
    where ap.application_id = p_aplicacao
      and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS', 'COMPLETED')
      and p.active
      and (v_situacao = 'ALL' or d.situacao = v_situacao)
      and (
        v_busca is null
        or sigav."FC_SEM_ACENTO_MINUSCULA"(p.full_name) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(v_busca) || '%'
        or p.employee_number like '%' || v_busca || '%'
        or sigav."FC_SEM_ACENTO_MINUSCULA"(p.institutional_email) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(v_busca) || '%'
      )
    limit v_limite
  ) f;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_AUDITORIA_PESSOA"(target_person_id uuid, target_limit integer DEFAULT 30)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_limit integer := least(greatest(coalesce(target_limit, 30), 1), 100);
begin
  if not sigav."FC_TEM_MODULO"('ADMIN_TEAMS') then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;
  if target_person_id is null
     or not exists(select 1 from sigav."TB_PESSOA" where id = target_person_id) then
    raise exception 'Pessoa nao encontrada.';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'eventId', e.id,
          'eventType', e.event_type,
          'actorPersonId', e.actor_person_id,
          'actorName', actor.full_name,
          'beforeData', e.before_data,
          'afterData', e.after_data,
          'justification', nullif(btrim(coalesce(e.metadata->>'justification', '')), ''),
          'createdAt', e.created_at
        )
        order by e.created_at desc
      ),
      '[]'::jsonb
    )
    from (
      select event.*
      from sigav."TL_EVENTO_AUDITORIA" event
      where event.entity_type = 'PERSON'
        and event.entity_id = target_person_id::text
      order by event.created_at desc
      limit v_limit
    ) e
    left join sigav."TB_PESSOA" actor on actor.id = e.actor_person_id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_CICLOS_LIDERANCA"()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid;
  v_result jsonb;
begin
  v_person_id := sigav."FC_PESSOA_SESSAO"();
  if v_person_id is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;

  select coalesce(jsonb_agg(cycle order by cycle_sort desc), '[]'::jsonb)
  into v_result
  from (
    select
      jsonb_build_object(
        'id', sa.id,
        'code', sa.code,
        'name', sa.name,
        'status', sa.status,
        'opensAt', sa.opens_at,
        'closesAt', sa.closes_at
      ) as cycle,
      coalesce(sa.closes_at, sa.opens_at, sa.created_at) as cycle_sort
    from sigav."TB_APLICACAO_PESQUISA" sa
    join sigav."TH_VERSAO_PESQUISA" sv on sv.id = sa.survey_version_id
    join sigav."TB_PESQUISA" s on s.id = sv.survey_id
    where s.dt_arquivamento is null
      and sa.status <> 'CANCELLED'
      and exists (
        select 1
        from sigav."RT_LIDERANCA_CDDI" l
        where l.application_id = sa.id
          and l.leader_person_id = v_person_id
          and l.status = 'ACTIVE'
          and l.valid_to is null
      )
  ) cycles;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_CICLOS_LIDERANCA_ADM"()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if not sigav."FC_TEM_MODULO"('ADMIN_TEAMS') then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;

  return (
    select coalesce(jsonb_agg(item order by item->>'code'), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'id', application.id,
        'code', application.code,
        'name', application.name,
        'status', application.status,
        'accessMode', application.access_mode,
        'participantCount', count(participant.id),
        'completedCount', count(participant.id) filter (where participant.status = 'COMPLETED')
      ) as item
      from sigav."TB_APLICACAO_PESQUISA" application
      join sigav."TH_VERSAO_PESQUISA" version on version.id = application.survey_version_id
      join sigav."TB_PESQUISA" survey on survey.id = version.survey_id
      left join sigav."RL_APLICACAO_PESSOA" participant
        on participant.application_id = application.id
       and participant.participant_role = 'RESPONDENT'
       and participant.status <> 'EXCLUDED'
      where survey.code = 'CDDI'
        and survey.dt_arquivamento is null
        and application.status <> 'CANCELLED'
      group by application.id
    ) applications
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_CICLOS_PESQUISA"(p_codigo_pesquisa text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_resultado jsonb;
begin
  if not sigav."FC_TEM_MODULO"('DASHBOARDS') then
    raise exception 'Acesso restrito ao módulo de Painéis.';
  end if;

  select coalesce(jsonb_agg(item order by item->>'opensAt' desc nulls last), '[]'::jsonb)
  into v_resultado
  from (
    select jsonb_build_object(
      'applicationId', aplicacao.id,
      'code', aplicacao.code,
      'name', aplicacao.name,
      'status', aplicacao.status,
      'opensAt', aplicacao.opens_at,
      'closesAt', aplicacao.closes_at,
      'participants', (
        select count(*)
        from sigav."RL_APLICACAO_PESSOA" participante
        where participante.application_id = aplicacao.id
          and participante.status not in ('BLOCKED', 'EXCLUDED')
      )
    ) as item
    from sigav."TB_APLICACAO_PESQUISA" as aplicacao
    join sigav."TH_VERSAO_PESQUISA" as versao on versao.id = aplicacao.survey_version_id
    join sigav."TB_PESQUISA" as pesquisa on pesquisa.id = versao.survey_id
    where pesquisa.code = btrim(p_codigo_pesquisa)
      -- Rascunho não tem público nem período: não é ciclo para acompanhar.
      and aplicacao.status <> 'DRAFT'
  ) as ciclos;

  return v_resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_DIMENSOES_PUBLICO"(p_regra jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav', 'auth'
AS $function$
declare
  v_filtros jsonb;
  v_resultado jsonb;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    return jsonb_build_object('status', 'FORBIDDEN');
  end if;

  perform sigav."FC_VALIDAR_REGRA_PUBLICO"(p_regra);

  -- Com `allEligible`, os filtros não participam da regra — então também não
  -- restringem a oferta. `'{}'` faz cada `FC_DIMENSAO_PUBLICO_ATENDE` devolver
  -- verdadeiro, sem precisar de um caminho separado na consulta.
  v_filtros := case
    when coalesce((p_regra ->> 'allEligible')::boolean, false) then '{}'::jsonb
    else coalesce(p_regra -> 'filters', '{}'::jsonb)
  end;

  with pessoas as (
    select metadata ->> 'directorate' as diretoria,
           metadata ->> 'unit' as unidade,
           metadata ->> 'coordination' as coordenacao,
           cost_center as centro,
           job_title as cargo
    from sigav."TB_PESSOA"
    where active
  ),
  bruto as (
    select 'directorate' as dimensao, diretoria as valor
    from pessoas

    union all
    select 'unit', unidade
    from pessoas
    where sigav."FC_DIMENSAO_PUBLICO_ATENDE"(diretoria, v_filtros -> 'directorate')

    union all
    select 'coordination', coordenacao
    from pessoas
    where sigav."FC_DIMENSAO_PUBLICO_ATENDE"(diretoria, v_filtros -> 'directorate')
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(unidade, v_filtros -> 'unit')

    union all
    select 'costCenter', centro
    from pessoas
    where sigav."FC_DIMENSAO_PUBLICO_ATENDE"(diretoria, v_filtros -> 'directorate')
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(unidade, v_filtros -> 'unit')
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(coordenacao, v_filtros -> 'coordination')

    union all
    select 'jobTitle', cargo
    from pessoas
    where sigav."FC_DIMENSAO_PUBLICO_ATENDE"(diretoria, v_filtros -> 'directorate')
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(unidade, v_filtros -> 'unit')
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(coordenacao, v_filtros -> 'coordination')
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(centro, v_filtros -> 'costCenter')
  ),
  normalizado as (
    select dimensao, sigav."FC_NORMALIZAR_ROTULO"(valor) as chave, btrim(valor) as rotulo
    from bruto
    where sigav."FC_NORMALIZAR_ROTULO"(valor) is not null
  ),
  agrupado as (
    select dimensao, chave, count(*)::integer as total,
           mode() within group (order by rotulo) as rotulo
    from normalizado
    group by dimensao, chave
  ),
  por_dimensao as (
    select dimensao, jsonb_agg(
      jsonb_build_object('label', rotulo, 'count', total)
      order by rotulo
    ) as itens
    from agrupado
    group by dimensao
  ),
  escolhido as (
    select chave.dimensao, item.valor as rotulo, sigav."FC_NORMALIZAR_ROTULO"(item.valor) as chave
    from jsonb_each(v_filtros) as chave(dimensao, valores),
         jsonb_array_elements_text(chave.valores) as item(valor)
  ),
  incompativel as (
    select e.dimensao, jsonb_agg(e.rotulo order by e.rotulo) as itens
    from escolhido e
    where not exists (
      select 1 from agrupado a
      where a.dimensao = e.dimensao and a.chave = e.chave
    )
    group by e.dimensao
  )
  select jsonb_build_object(
    'status', 'OK',
    'dimensions', coalesce((select jsonb_object_agg(dimensao, itens) from por_dimensao), '{}'::jsonb),
    'incompatible', coalesce((select jsonb_object_agg(dimensao, itens) from incompativel), '{}'::jsonb)
  )
  into v_resultado;

  return v_resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_ENVIOS_EMAIL"(p_aplicacao uuid DEFAULT NULL::uuid, p_situacao text DEFAULT 'ALL'::text, p_limite integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_result jsonb;
  v_limite integer := greatest(1, least(coalesce(p_limite, 200), 1000));
  v_situacao text := upper(coalesce(nullif(btrim(p_situacao), ''), 'ALL'));
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  if v_situacao not in ('ALL', 'PENDENTE', 'PROCESSANDO', 'ENVIADO', 'FALHOU') then
    raise exception 'Situação inválida. Use ALL, PENDENTE, PROCESSANDO, ENVIADO ou FALHOU.';
  end if;

  select jsonb_build_object(
    'resumo', (
      select coalesce(jsonb_object_agg(x.st_envio, x.total), '{}'::jsonb)
      from (
        select t.st_envio, count(*) as total
        from sigav."TL_EMAIL_PARTICIPANTE" t
        where p_aplicacao is null or t.sq_aplicacao = p_aplicacao
        group by t.st_envio
      ) x
    ),
    'envios', (
      -- O apelido entre aspas, e não `f.dt_criacao`: é o nome que existe aqui.
      select coalesce(jsonb_agg(to_jsonb(f) order by f."createdAt" desc), '[]'::jsonb)
      from (
        select t.sq_email as id,
               t.tp_email as kind,
               t.st_envio as status,
               t.ds_erro as erro,
               t.dt_criacao as "createdAt",
               t.dt_envio as "sentAt",
               p.full_name as "personName",
               p.institutional_email as "personEmail",
               a.code as "applicationCode",
               a.name as "applicationName"
        from sigav."TL_EMAIL_PARTICIPANTE" t
        join sigav."TB_PESSOA" p on p.id = t.sq_pessoa
        join sigav."TB_APLICACAO_PESQUISA" a on a.id = t.sq_aplicacao
        where (p_aplicacao is null or t.sq_aplicacao = p_aplicacao)
          and (v_situacao = 'ALL' or t.st_envio = v_situacao)
        order by t.dt_criacao desc
        limit v_limite
      ) f
    )
  )
  into v_result;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_MODELOS_AVALIACAO"()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_resultado jsonb;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  select coalesce(jsonb_agg(item order by item->>'category', item->>'name'), '[]'::jsonb)
  into v_resultado
  from (
    select jsonb_build_object(
      'surveyId', pesquisa.id,
      'code', pesquisa.code,
      'name', pesquisa.name,
      'description', pesquisa.description,
      'category', coalesce(pesquisa.tx_categoria_modelo, 'Geral'),
      'sections', (select count(*) from sigav."TB_SECAO_PESQUISA" s where s.survey_version_id = versao.id),
      'questions', (select count(*) from sigav."TB_PERGUNTA_PESQUISA" q where q.survey_version_id = versao.id)
    ) as item
    from sigav."TB_PESQUISA" as pesquisa
    join lateral (
      select * from sigav."TH_VERSAO_PESQUISA" v
      where v.survey_id = pesquisa.id
      order by v.version_number desc limit 1
    ) as versao on true
    where pesquisa.st_modelo = true
  ) as modelos;

  return v_resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_PESQUISAS_ARQ"()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare v_result jsonb;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  perform sigav."FC_EXPIRAR_PESQUISAS_ARQ"();

  select coalesce(jsonb_agg(jsonb_build_object(
    'surveyId', s.id,
    'code', s.code,
    'name', s.name,
    'description', s.description,
    'status', s.status,
    'archivedAt', s.dt_arquivamento,
    'versionId', sv.id,
    'versionNumber', sv.version_number,
    'versionStatus', sv.status,
    'applicationId', sa.id,
    'applicationCode', sa.code,
    'applicationName', sa.name,
    'applicationStatus', sa.status,
    'opensAt', sa.opens_at,
    'closesAt', sa.closes_at,
    'sections', (select count(*) from sigav."TB_SECAO_PESQUISA" sec where sec.survey_version_id = sv.id),
    'questions', (select count(*) from sigav."TB_PERGUNTA_PESQUISA" q where q.survey_version_id = sv.id),
    'updatedAt', greatest(s.updated_at, sv.updated_at, coalesce(sa.updated_at, s.updated_at))
  ) order by s.dt_arquivamento desc), '[]'::jsonb)
  into v_result
  from sigav."TB_PESQUISA" s
  join lateral (
    select * from sigav."TH_VERSAO_PESQUISA" x where x.survey_id = s.id order by x.version_number desc limit 1
  ) sv on true
  left join lateral (
    select * from sigav."TB_APLICACAO_PESQUISA" a where a.survey_version_id = sv.id order by a.created_at desc limit 1
  ) sa on true
  where s.st_modelo = false
    and s.dt_arquivamento is not null;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_PESSOAS_SEM_CHEFIA"(target_application_id uuid, target_search text DEFAULT NULL::text, target_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_search text := lower(btrim(coalesce(target_search, '')));
  v_limit integer := least(greatest(coalesce(target_limit, 100), 1), 500);
  v_result jsonb;
begin
  if not sigav."FC_TEM_MODULO"('ADMIN_TEAMS') then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;
  if not exists (select 1 from sigav."TB_APLICACAO_PESQUISA" where id = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  select coalesce(jsonb_agg(item order by item->>'fullName'), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'personId', person.id,
      'fullName', person.full_name,
      'employeeNumber', person.employee_number,
      'institutionalEmail', person.institutional_email,
      'jobTitle', person.job_title,
      -- A unidade fica em `metadata->>'unit'`, como em FC_BUSCAR_PESSOAS_ADMIN:
      -- `organizational_unit_id` é a chave estrangeira, não o rótulo exibido.
      'organizationalUnit', nullif(btrim(coalesce(person.metadata->>'unit', '')), ''),
      'managerName', nullif(btrim(coalesce(person.metadata->>'manager_name', '')), ''),
      'managerEmail', nullif(btrim(coalesce(person.metadata->>'manager_email', '')), ''),
      'managerResolution', coalesce(nullif(btrim(coalesce(person.metadata->>'manager_resolution', '')), ''), 'SEM_DADO')
    ) as item
    from sigav."TB_PESSOA" as person
    where person.active
    -- Só quem participa do ciclo: a pendência de chefia só existe para quem
    -- precisa responder.
    and exists (
      select 1
      from sigav."RL_APLICACAO_PESSOA" as participant
      where participant.person_id = person.id
        and participant.application_id = target_application_id
    )
    and not exists (
      select 1
      from sigav."RT_LIDERANCA_CDDI" as link
      where link.subordinate_person_id = person.id
        and link.application_id = target_application_id
        and link.status = 'ACTIVE'
        and link.valid_to is null
    )
    and (
      v_search = ''
      or lower(person.full_name) like '%' || v_search || '%'
      or lower(coalesce(person.employee_number, '')) like '%' || v_search || '%'
      or lower(coalesce(person.institutional_email, '')) like '%' || v_search || '%'
      or lower(coalesce(person.metadata->>'manager_email', '')) like '%' || v_search || '%'
    )
    order by person.full_name
    limit v_limit
  ) as pendentes;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_PRESENCA_ONLINE"()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_result jsonb;
begin
  if sigav."FC_PAPEL_SESSAO"() is distinct from 'authenticated'
     or not sigav."FC_PODE_VER_PRESENCA"() then
    raise exception 'Acesso restrito à permissão de visualizar presença online.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(f) order by f."fullName", f."personId"), '[]'::jsonb)
  into v_result
  from (
    select
      p.id as "personId",
      p.full_name as "fullName",
      p.metadata->>'avatar_url' as "avatarUrl",
      'AUTHENTICATED'::text as "roleCode",
      pr.dt_visto_em as "onlineAt"
    from sigav."TB_PRESENCA_ONLINE" pr
    join sigav."TB_PESSOA" p on p.id = pr.sq_pessoa
    where pr.dt_visto_em > timezone('utc', now()) - interval '2 minutes'
      and p.active
    order by pr.dt_visto_em desc, p.full_name, p.id
    limit 200
  ) f;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_REGRAS_CONDICIONAIS"(p_versao uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_result jsonb;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  select coalesce(jsonb_agg(item order by item->>'targetId'), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'ruleId', regra.sq_regra,
      'targetType', regra.tp_alvo,
      'targetId', regra.sq_alvo,
      'action', regra.tp_acao,
      'connector', regra.tp_conector,
      'description', regra.ds_regra,
      'conditions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'conditionId', condicao.sq_condicao,
          'questionId', condicao.sq_pergunta_origem,
          'operator', condicao.tp_operador,
          'optionId', condicao.sq_opcao,
          'value', coalesce(condicao.tx_valor, condicao.nu_valor::text)
        ) order by condicao.nu_ordem)
        from sigav."TB_CONDICAO_REGRA" as condicao
        where condicao.sq_regra = regra.sq_regra
      ), '[]'::jsonb)
    ) as item
    from sigav."TB_REGRA_CONDICIONAL" as regra
    where regra.sq_versao_pesquisa = p_versao and regra.st_ativo
  ) as regras;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_RESPOSTAS_CICLO"(p_codigo_ciclo text, p_busca text DEFAULT NULL::text, p_limite integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_busca text := lower(btrim(coalesce(p_busca, '')));
  v_limite integer := least(greatest(coalesce(p_limite, 100), 1), 500);
  v_resultado jsonb;
begin
  if not sigav."FC_TEM_MODULO"('ADMIN_TEAMS') then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;

  select coalesce(jsonb_agg(item order by item->>'fullName'), '[]'::jsonb)
  into v_resultado
  from (
    select jsonb_build_object(
      'submissionId', submissao.id,
      'personId', pessoa.id,
      'fullName', pessoa.full_name,
      'employeeNumber', pessoa.employee_number,
      'institutionalEmail', pessoa.institutional_email,
      'submissionType', submissao.submission_type,
      'status', submissao.status,
      'submittedAt', submissao.submitted_at,
      'answers', (select count(*) from sigav."TB_RESPOSTA" resposta where resposta.submission_id = submissao.id),
      'subjectName', avaliado.full_name
    ) as item
    from sigav."TB_SUBMISSAO" as submissao
    join sigav."TB_APLICACAO_PESQUISA" as aplicacao on aplicacao.id = submissao.application_id
    left join sigav."TB_PESSOA" as pessoa on pessoa.id = submissao.respondent_person_id
    left join sigav."TB_PESSOA" as avaliado on avaliado.id = submissao.subject_person_id
    where aplicacao.code = btrim(p_codigo_ciclo)
      and (
        v_busca = ''
        or lower(coalesce(pessoa.full_name, '')) like '%' || v_busca || '%'
        or lower(coalesce(pessoa.employee_number, '')) like '%' || v_busca || '%'
        or lower(coalesce(pessoa.institutional_email, '')) like '%' || v_busca || '%'
      )
    order by pessoa.full_name
    limit v_limite
  ) as respostas;

  return v_resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_NORMALIZAR_ROTULO"(p_valor text)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select nullif(
    sigav."FC_SEM_ACENTO_MINUSCULA"(regexp_replace(btrim(coalesce(p_valor, '')), '\s+', ' ', 'g')),
    ''
  );
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_CICLO_CDDI_VIGENTE"()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_pessoa uuid := sigav."FC_PESSOA_SESSAO"();
  v_resultado jsonb;
begin
  if v_pessoa is null then
    raise exception 'Sessão não identificada.';
  end if;

  select jsonb_build_object(
    'applicationId', aplicacao.id,
    'code', aplicacao.code,
    'name', aplicacao.name,
    'status', aplicacao.status,
    'opensAt', aplicacao.opens_at,
    'closesAt', aplicacao.closes_at
  )
  into v_resultado
  from sigav."TB_APLICACAO_PESQUISA" as aplicacao
  join sigav."TH_VERSAO_PESQUISA" as versao on versao.id = aplicacao.survey_version_id
  join sigav."TB_PESQUISA" as pesquisa on pesquisa.id = versao.survey_id
  where pesquisa.code = 'CDDI'
    and pesquisa.dt_arquivamento is null
    -- Rascunho não tem público nem período; cancelado não é vigente. Sem esta
    -- segunda condição o `else 2` da ordenação abaixo elegia o cancelado
    -- quando não houvesse ciclo aberto nem agendado.
    and aplicacao.status not in ('DRAFT', 'CANCELLED')
    and exists (
      select 1
      from sigav."RL_APLICACAO_PESSOA" as participante
      where participante.application_id = aplicacao.id
        and participante.person_id = v_pessoa
        and participante.status not in ('BLOCKED', 'EXCLUDED')
    )
  order by
    case aplicacao.status when 'OPEN' then 0 when 'SCHEDULED' then 1 else 2 end,
    aplicacao.opens_at desc nulls last
  limit 1;

  return v_resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_CONTEXTO_PLATAFORMA"()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person sigav."TB_PESSOA"%rowtype;
  v_modules text[] := array[]::text[];
  v_participant sigav."RL_APLICACAO_PESSOA"%rowtype;
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_participant_id uuid;
begin
  if sigav."FC_UID_SESSAO"() is null then
    return jsonb_build_object('status', 'AUTH_REQUIRED');
  end if;

  select * into v_person
  from sigav."TB_PESSOA"
  where auth_user_id = sigav."FC_UID_SESSAO"()
    and active = true
  limit 1;

  if v_person.id is null then
    return jsonb_build_object(
      'status', 'UNLINKED',
      'message', 'Conta autenticada sem cadastro institucional ativo.'
    );
  end if;

  v_modules := sigav."FC_MODULOS_EFETIVOS"(v_person.id);

  select ap.id into v_participant_id
  from sigav."RL_APLICACAO_PESSOA" ap
  join sigav."TB_APLICACAO_PESQUISA" sa on sa.id = ap.application_id
  where ap.person_id = v_person.id
    and ap.status not in ('REMOVED', 'INELIGIBLE')
  order by
    case sa.status when 'OPEN' then 0 when 'SCHEDULED' then 1 when 'DRAFT' then 2 else 3 end,
    coalesce(sa.closes_at, sa.opens_at, sa.created_at) desc
  limit 1;

  if v_participant_id is not null then
    select * into v_participant
    from sigav."RL_APLICACAO_PESSOA"
    where id = v_participant_id;

    select * into v_application
    from sigav."TB_APLICACAO_PESQUISA"
    where id = v_participant.application_id;
  end if;

  return jsonb_build_object(
    'status', 'OK',
    'technicalRole', 'authenticated',
    'person', jsonb_build_object(
      'id', v_person.id,
      'employeeNumber', v_person.employee_number,
      'fullName', v_person.full_name,
      'institutionalEmail', v_person.institutional_email,
      'jobTitle', v_person.job_title,
      'costCenter', v_person.cost_center,
      'workplace', v_person.workplace,
      'metadata', coalesce(v_person.metadata, '{}'::jsonb),
      'avatarUrl', v_person.metadata->>'avatar_url'
    ),
    'participant', case when v_participant.id is null then null else jsonb_build_object(
      'id', v_participant.id,
      'status', v_participant.status,
      'accessProfile', v_participant.access_profile,
      'completedAt', v_participant.completed_at,
      'metadata', coalesce(v_participant.metadata, '{}'::jsonb)
    ) end,
    'application', case when v_application.id is null then null else jsonb_build_object(
      'id', v_application.id,
      'code', v_application.code,
      'name', v_application.name,
      'status', v_application.status,
      'opensAt', v_application.opens_at,
      'closesAt', v_application.closes_at
    ) end,
    'isLeader', ('TEAM' = any(v_modules)),
    'roles', jsonb_build_array('AUTHENTICATED'),
    'modules', to_jsonb(v_modules),
    'canManageSurveys', ('ADMIN_SURVEYS' = any(v_modules))
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_FORM_ANONIMO"(target_application_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
begin
  select *
  into v_application
  from sigav."TB_APLICACAO_PESQUISA"
  where code = btrim(target_application_code)
  limit 1;

  if v_application.id is null
     or not v_application.anonymous
     or not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application.id) then
    return null;
  end if;

  return sigav."FC_OBTER_FORMULARIO_PUBLICO"(target_application_code);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_FORMULARIO_PUBLICO"(target_application_code text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select sigav."FC_ABRIR_CICLOS_AGENDADOS"();

  select jsonb_build_object(
    'application', jsonb_build_object(
      'id', sa.id,
      'code', sa.code,
      'name', sa.name,
      'status', sa.status,
      'opensAt', sa.opens_at,
      'closesAt', sa.closes_at,
      'allowDrafts', sa.allow_drafts,
      'settings', sa.settings,
      'accessMode', sa.access_mode
    ),
    'survey', jsonb_build_object(
      'id', s.id,
      'code', s.code,
      'name', s.name,
      'description', s.description
    ),
    'version', jsonb_build_object(
      'id', sv.id,
      'number', sv.version_number,
      'title', sv.title,
      'description', sv.description,
      'settings', sv.settings
    ),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ss.id,
        'code', ss.code,
        'title', ss.title,
        'description', ss.description,
        'position', ss.position,
        'settings', ss.settings,
        'questions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', sq.id,
            'code', sq.code,
            'title', sq.title,
            'description', sq.description,
            'type', sq.question_type,
            'required', sq.required,
            'position', sq.position,
            'validation', sq.validation,
            'displayLogic', sq.display_logic,
            'settings', sq.settings,
            'options', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', qo.id,
                'code', qo.code,
                'label', qo.label,
                'value', qo.value,
                'position', qo.position
              ) order by qo.position)
              from sigav."TB_OPCAO_PERGUNTA" qo
              where qo.question_id = sq.id
                and qo.active = true
            ), '[]'::jsonb)
          ) order by sq.position)
          from sigav."TB_PERGUNTA_PESQUISA" sq
          where sq.section_id = ss.id
        ), '[]'::jsonb)
      ) order by ss.position)
      from sigav."TB_SECAO_PESQUISA" ss
      where ss.survey_version_id = sv.id
        and ss.parent_section_id is null
    ), '[]'::jsonb)
  )
  from sigav."TB_APLICACAO_PESQUISA" sa
  join sigav."TH_VERSAO_PESQUISA" sv on sv.id = sa.survey_version_id
  join sigav."TB_PESQUISA" s on s.id = sv.survey_id
  where sa.code = btrim(target_application_code)
    and sv.status in ('PUBLISHED', 'RETIRED')
    and sa.status in ('SCHEDULED', 'OPEN', 'CLOSED')
    and (sa.anonymous or sigav."FC_PODE_ACESSAR_CICLO"(sa.id))
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_MARCA_PLATAFORMA"()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select jsonb_build_object(
    'organizationName', no_organizacao,
    'productName', no_produto,
    'productDescription', ds_produto,
    'logoUrl', tx_url_logotipo,
    'logoPath', tx_caminho_logotipo,
    'primaryColor', co_cor_principal,
    'sidebarColor', co_cor_barra_lateral,
    'accessBackgroundUrl', tx_url_fundo_acesso,
    'accessBackgroundPath', tx_caminho_fundo_acesso,
    'accessPanelColor', co_cor_painel_acesso,
    'accessGreeting', tx_saudacao_acesso,
    'accessInstruction', tx_instrucao_acesso,
    'emailInstruction', tx_instrucao_email,
    'emailFooter', tx_rodape_email,
    'onlinePresenceEnabled', fl_presenca_online_ativa,
    'onlinePresenceViewerRoles', tx_perfis_visualizacao_presenca,
    'homeAnnouncementEnabled', fl_comunicado_inicio_ativo,
    'homeAnnouncementTitle', tx_comunicado_inicio_titulo,
    'homeAnnouncementMessage', tx_comunicado_inicio_mensagem,
    'homeAnnouncementLink', tx_comunicado_inicio_link,
    'homeAnnouncementLinkLabel', tx_comunicado_inicio_rotulo_link,
    'updatedAt', dt_alteracao
  )
  from sigav."TB_CONFIG_PLATAFORMA"
  where co_configuracao = 1;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_MARCA_PUBLICA"()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select jsonb_build_object(
    'organizationName', no_organizacao,
    'productName', no_produto,
    'productDescription', ds_produto,
    'logoUrl', tx_url_logotipo,
    'logoPath', tx_caminho_logotipo,
    'primaryColor', co_cor_principal,
    'sidebarColor', co_cor_barra_lateral,
    'accessBackgroundUrl', tx_url_fundo_acesso,
    'accessBackgroundPath', tx_caminho_fundo_acesso,
    'accessPanelColor', co_cor_painel_acesso,
    'accessGreeting', tx_saudacao_acesso,
    'accessInstruction', tx_instrucao_acesso
  )
  from sigav."TB_CONFIG_PLATAFORMA"
  where co_configuracao = 1;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_MINHA_EQUIPE"(target_application_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_workspace jsonb;
  v_members jsonb;
begin
  v_workspace := sigav."FC_OBTER_ESPACO_EQUIPE"(target_application_code);

  select coalesce(
    jsonb_agg(
      member || jsonb_build_object(
        'avatarUrl', nullif(btrim(coalesce(person.metadata->>'avatar_url', '')), '')
      )
      order by member->>'fullName'
    ),
    '[]'::jsonb
  )
  into v_members
  from jsonb_array_elements(coalesce(v_workspace->'members', '[]'::jsonb)) member
  left join sigav."TB_PESSOA" person on person.id = (member->>'personId')::uuid;

  return jsonb_set(v_workspace, '{members}', v_members, true);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_PAINEL_PESQUISA"(target_application_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_application_id uuid;
  v_anonimo boolean;
  v_limiar integer;
  v_payload jsonb;
begin
  if not sigav."FC_TEM_MODULO"('DASHBOARDS') then
    raise exception 'Acesso restrito ao módulo de Painéis.';
  end if;

  select id, coalesce(anonymous, false), coalesce(nu_limiar_anonimato, 5)
  into v_application_id, v_anonimo, v_limiar
  from sigav."TB_APLICACAO_PESQUISA"
  where code = btrim(target_application_code)
  limit 1;

  if v_application_id is null then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  -- Ciclo identificado não sofre supressão: limiar zero nunca é atingido.
  -- Assim a mudança é inerte para tudo que já existe.
  if not v_anonimo then
    v_limiar := 0;
  end if;

  with app as (
    select sa.*, sv.title version_title, sv.description version_description,
      sv.version_number, s.code survey_code, s.name survey_name,
      s.description survey_description
    from sigav."TB_APLICACAO_PESQUISA" sa
    join sigav."TH_VERSAO_PESQUISA" sv on sv.id = sa.survey_version_id
    join sigav."TB_PESQUISA" s on s.id = sv.survey_id
    where sa.id = v_application_id
  ), latest_submissions as (
    select distinct on (s.participant_id)
      s.id, s.participant_id, s.status, s.updated_at
    from sigav."TB_SUBMISSAO" s
    where s.application_id = v_application_id
      and s.participant_id is not null
    order by s.participant_id, s.updated_at desc
  ), participant_summary as (
    /*
      O acompanhamento tem duas fontes, porque as duas jornadas guardam o
      progresso em lugares diferentes.

      Em ciclo identificado, a submissão aponta para o participante e o estado
      dela é a fonte. Em ciclo **anônimo** a submissão não tem `participant_id`
      — é justamente isso que garante o anonimato —, então nada casaria no
      `join` e o painel diria que ninguém respondeu, mesmo com o ciclo inteiro
      concluído. Ali quem sabe do progresso é `application_participants`, que
      registra a participação sem registrar o conteúdo.

      Saber que alguém respondeu é diferente de saber o que respondeu: o
      acompanhamento continua possível sem quebrar o anonimato.
    */
    select
      count(*) total,
      count(*) filter (
        where case when v_anonimo then ap.status = 'IN_PROGRESS' else sub.status = 'DRAFT' end
      ) drafts,
      count(*) filter (
        where case when v_anonimo then ap.status = 'COMPLETED' else sub.status in ('SUBMITTED', 'VALIDATED') end
      ) submitted,
      count(*) filter (
        where case when v_anonimo then ap.status in ('ELIGIBLE', 'INVITED') else sub.id is null end
      ) not_started
    from sigav."RL_APLICACAO_PESSOA" ap
    left join latest_submissions sub on sub.participant_id = ap.id
    where ap.application_id = v_application_id
      -- Quem está bloqueado ou excluído não pode responder: manter no
      -- denominador faria a taxa de conclusão nunca chegar a 100%.
      and ap.status not in ('BLOCKED', 'EXCLUDED')
  ), question_rows as (
    select q.id, q.code, q.title, q.description, q.question_type, q.position,
      sec.id section_id, sec.title section_title, sec.position section_position
    from sigav."TB_PERGUNTA_PESQUISA" q
    join sigav."TB_SECAO_PESQUISA" sec on sec.id = q.section_id
    join app on app.survey_version_id = q.survey_version_id
  ), submitted_answers as (
    select a.*, s.submitted_at
    from sigav."TB_RESPOSTA" a
    join sigav."TB_SUBMISSAO" s on s.id = a.submission_id
    where s.application_id = v_application_id
      and s.status in ('SUBMITTED', 'VALIDATED')
  ), option_counts as (
    select a.question_id, ao.option_id, count(*) answer_count
    from sigav."RL_RESPOSTA_OPCAO" ao
    join submitted_answers a on a.id = ao.answer_id
    group by a.question_id, ao.option_id
  )
  select jsonb_build_object(
    'status', 'OK',
    'generatedAt', timezone('utc', now()),
    -- A tela precisa saber que o ciclo é anônimo e qual o limiar, para explicar
    -- a supressão em vez de mostrar um vazio inexplicado.
    'anonymous', v_anonimo,
    'threshold', v_limiar,
    'application', (
      select jsonb_build_object(
        'id', id,
        'code', code,
        'name', name,
        'status', status,
        'opensAt', opens_at,
        'closesAt', closes_at,
        'surveyCode', survey_code,
        'surveyName', survey_name,
        'surveyDescription', coalesce(survey_description, version_description),
        'versionTitle', version_title,
        'versionNumber', version_number
      ) from app
    ),
    'summary', (
      select jsonb_build_object(
        'totalParticipants', total,
        'drafts', drafts,
        'submitted', submitted,
        'notStarted', not_started,
        'completionRate', case when total = 0 then 0 else round(submitted::numeric * 100 / total, 1) end
      ) from participant_summary
    ),
    'questions', coalesce((
      select jsonb_agg(item order by ordem_secao, ordem)
      from (
        select
          qr.section_position as ordem_secao,
          qr.position as ordem,
          jsonb_build_object(
            'id', qr.id,
            'code', qr.code,
            'title', qr.title,
            'description', qr.description,
            'type', qr.question_type,
            'position', qr.position,
            'sectionId', qr.section_id,
            'sectionTitle', qr.section_title,
            'sectionPosition', qr.section_position,
            -- A contagem continua visível mesmo quando o conteúdo é suprimido:
            -- saber que houve poucas respostas é informação de acompanhamento,
            -- e é ela que justifica a supressão a quem lê.
            'responseCount', respostas.total,
            'suppressed', false,
            'options', case
              when false then '[]'::jsonb
              else coalesce((
                select jsonb_agg(jsonb_build_object(
                  'id', o.id,
                  'label', o.label,
                  'value', o.value,
                  'count', coalesce(oc.answer_count, 0)
                ) order by o.position)
                from sigav."TB_OPCAO_PERGUNTA" o
                left join option_counts oc on oc.question_id = qr.id and oc.option_id = o.id
                where o.question_id = qr.id and o.active
              ), '[]'::jsonb)
            end,
            'textResponses', case
              when false then '[]'::jsonb
              else coalesce((
                select jsonb_agg(jsonb_build_object(
                  'text', left(sample.answer_text, 1000),
                  -- Ciclo anônimo não devolve o horário: cruzado com a data de
                  -- conclusão de cada participante, ele reconstrói o nome.
                  'submittedAt', sample.submitted_at
                ) order by sample.ordenacao)
                from (
                  select
                    a.answer_text,
                    a.submitted_at,
                    -- Em ciclo anônimo a ordem não pode acompanhar o tempo, ou
                    -- entrega a sequência de quem respondeu. `md5` do texto é
                    -- estável entre chamadas e não guarda relação com o envio.
                    case when v_anonimo then md5(a.answer_text) else to_char(a.submitted_at, 'YYYYMMDDHH24MISS') end as ordenacao
                  from submitted_answers a
                  where a.question_id = qr.id
                    and nullif(btrim(a.answer_text), '') is not null
                  order by ordenacao desc
                  limit 100
                ) sample
              ), '[]'::jsonb)
            end
          ) as item
        from question_rows qr
        cross join lateral (
          select count(*)::integer as total
          from submitted_answers a
          where a.question_id = qr.id
        ) respostas
      ) perguntas
    ), '[]'::jsonb)
  ) into v_payload;

  if v_anonimo then
    v_payload := jsonb_set(v_payload, '{summary}', jsonb_build_object(
      'totalParticipants', (select count(*) from sigav."TB_SUBMISSAO" s where s.application_id = v_application_id and s.status in ('DRAFT', 'SUBMITTED', 'VALIDATED')),
      'drafts', (select count(*) from sigav."TB_SUBMISSAO" s where s.application_id = v_application_id and s.status = 'DRAFT'),
      'submitted', (select count(*) from sigav."TB_SUBMISSAO" s where s.application_id = v_application_id and s.status in ('SUBMITTED', 'VALIDATED')),
      'notStarted', 0,
      'completionRate', case when (select count(*) from sigav."TB_SUBMISSAO" s where s.application_id = v_application_id and s.status in ('DRAFT', 'SUBMITTED', 'VALIDATED')) = 0 then 0 else round((select count(*) from sigav."TB_SUBMISSAO" s where s.application_id = v_application_id and s.status in ('SUBMITTED', 'VALIDATED'))::numeric * 100 / (select count(*) from sigav."TB_SUBMISSAO" s where s.application_id = v_application_id and s.status in ('DRAFT', 'SUBMITTED', 'VALIDATED')), 1) end
    ));
  end if;
  return v_payload;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_REGRAS_DO_CICLO"(p_codigo_ciclo text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'targetType', regra.tp_alvo,
    'targetId', regra.sq_alvo,
    'action', regra.tp_acao,
    'connector', regra.tp_conector,
    'conditions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'questionId', condicao.sq_pergunta_origem,
        'operator', condicao.tp_operador,
        'optionId', condicao.sq_opcao,
        'value', coalesce(condicao.tx_valor, condicao.nu_valor::text)
      ) order by condicao.nu_ordem)
      from sigav."TB_CONDICAO_REGRA" as condicao
      where condicao.sq_regra = regra.sq_regra
    ), '[]'::jsonb)
  ) order by regra.sq_alvo), '[]'::jsonb)
  from sigav."TB_APLICACAO_PESQUISA" as aplicacao
  join sigav."TB_REGRA_CONDICIONAL" as regra on regra.sq_versao_pesquisa = aplicacao.survey_version_id
  where aplicacao.code = btrim(p_codigo_ciclo)
    and regra.st_ativo
    and sigav."FC_PODE_ACESSAR_CICLO"(aplicacao.id);
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ORIGENS_DA_REGRA"(p_alvo uuid)
 RETURNS TABLE(sq_origem uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select distinct condicao.sq_pergunta_origem
  from sigav."TB_REGRA_CONDICIONAL" as regra
  join sigav."TB_CONDICAO_REGRA" as condicao on condicao.sq_regra = regra.sq_regra
  where regra.st_ativo
    and (
      regra.sq_alvo = p_alvo
      or (
        regra.tp_alvo = 'SECTION'
        and exists (
          select 1
          from sigav."TB_PERGUNTA_PESQUISA" as pergunta
          where pergunta.id = p_alvo
            and pergunta.section_id = regra.sq_alvo
        )
      )
    );
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_PAPEL_SESSAO"()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_PERGUNTA_VISIVEL"(p_submissao uuid, p_pergunta uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_secao uuid;
begin
  select section_id into v_secao from sigav."TB_PERGUNTA_PESQUISA" where id = p_pergunta;
  if v_secao is null then
    return true;
  end if;
  if not sigav."FC_ALVO_VISIVEL"(p_submissao, v_secao) then
    return false;
  end if;
  return sigav."FC_ALVO_VISIVEL"(p_submissao, p_pergunta);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_PESQUISAR_EQUIPE"(target_application_id uuid, search_term text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_candidates jsonb;
  v_result jsonb;
begin
  v_candidates := sigav."FC_BUSCAR_CANDIDATOS_EQUIPE"(target_application_id, search_term);

  select coalesce(
    jsonb_agg(
      candidate || jsonb_build_object(
        'avatarUrl', nullif(btrim(coalesce(person.metadata->>'avatar_url', '')), '')
      )
      order by candidate->>'fullName'
    ),
    '[]'::jsonb
  )
  into v_result
  from jsonb_array_elements(coalesce(v_candidates, '[]'::jsonb)) candidate
  left join sigav."TB_PESSOA" person on person.id = (candidate->>'personId')::uuid;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_PESQUISAR_PESSOA_ADMIN"(target_search text DEFAULT NULL::text, target_limit integer DEFAULT 80)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_search text := lower(btrim(coalesce(target_search, '')));
  v_limit integer := least(greatest(coalesce(target_limit, 80), 1), 250);
begin
  if not sigav."FC_TEM_MODULO"('ADMIN_TEAMS') then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'personId', p.id,
          'employeeNumber', p.employee_number,
          'fullName', p.full_name,
          'institutionalEmail', p.institutional_email,
          'jobTitle', p.job_title,
          'costCenter', p.cost_center,
          'workplace', p.workplace,
          'directorate', nullif(btrim(coalesce(p.metadata->>'directorate', '')), ''),
          'organizationalUnit', nullif(btrim(coalesce(p.metadata->>'unit', '')), ''),
          'coordination', nullif(btrim(coalesce(p.metadata->>'coordination', '')), ''),
          'employmentStatus', p.employment_status,
          'active', p.active,
          'updatedAt', p.updated_at
        )
        order by p.active desc, p.full_name
      ),
      '[]'::jsonb
    )
    from (
      select candidate.*
      from sigav."TB_PESSOA" candidate
      where v_search = ''
        or lower(candidate.full_name) like '%' || v_search || '%'
        or lower(candidate.employee_number) like '%' || v_search || '%'
        or lower(coalesce(candidate.institutional_email, '')) like '%' || v_search || '%'
        or lower(coalesce(candidate.job_title, '')) like '%' || v_search || '%'
        or lower(coalesce(candidate.cost_center, '')) like '%' || v_search || '%'
        or lower(coalesce(candidate.workplace, '')) like '%' || v_search || '%'
        or lower(coalesce(candidate.metadata->>'directorate', '')) like '%' || v_search || '%'
        or lower(coalesce(candidate.metadata->>'unit', '')) like '%' || v_search || '%'
        or lower(coalesce(candidate.metadata->>'coordination', '')) like '%' || v_search || '%'
      order by candidate.active desc, candidate.full_name
      limit v_limit
    ) p
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_PLANEJAR_PUBLICO_AVALIACAO"(p_aplicacao uuid, p_regra jsonb)
 RETURNS TABLE(sq_pessoa uuid, st_casa boolean, st_excluida boolean, tp_situacao text, tp_situacao_nova text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav', 'auth'
AS $function$
  with resolvido as (
    select * from sigav."FC_RESOLVER_PUBLICO_AVALIACAO"(p_regra)
  ),
  vinculo_atual as (
    select person_id, status
    from sigav."RL_APLICACAO_PESSOA"
    where application_id = p_aplicacao
      and participant_role = 'RESPONDENT'
  ),
  -- `full outer join` porque as duas pontas importam: quem a regra alcança e
  -- ainda não está vinculado, e quem está vinculado e a regra deixou de
  -- alcançar. Um `left join` só enxergaria a primeira.
  combinado as (
    select
      coalesce(r.sq_pessoa, v.person_id) as pessoa,
      r.sq_pessoa is not null as casa,
      coalesce(r.st_excluida, false) as excluida,
      v.status as situacao
    from resolvido r
    full outer join vinculo_atual v on v.person_id = r.sq_pessoa
  )
  select
    pessoa,
    casa,
    excluida,
    situacao,
    case
      -- BLOCKED antes de tudo, **inclusive antes da exclusão explícita**.
      --
      -- Com a exclusão vindo primeiro, existia um caminho de dois passos que
      -- levantava o bloqueio sem ninguém pedir: bloquear a pessoa, excluí-la
      -- pela regra (BLOCKED -> EXCLUDED) e reaplicar sem a exclusão
      -- (EXCLUDED -> ELIGIBLE). O construtor de público desfazia uma sanção
      -- administrativa por um caminho que não se anuncia em lugar nenhum.
      --
      -- A exclusão continua registrada na regra e na auditoria; ela só não
      -- apaga o estado mais forte. Para liberar, usa-se a gestão do público
      -- vinculado, que é onde o bloqueio foi criado.
      when situacao = 'BLOCKED' then 'BLOCKED'
      -- Exclusão explícita vence o resto.
      when excluida then 'EXCLUDED'
      -- Progresso é intocável, casando ou não.
      when situacao in ('IN_PROGRESS', 'COMPLETED') then situacao
      when casa then
        case
          when situacao is null then 'ELIGIBLE'
          when situacao = 'EXCLUDED' then 'ELIGIBLE'
          else situacao
        end
      -- Deixou de casar e não tem progresso: sai do público.
      when situacao in ('ELIGIBLE', 'INVITED') then 'EXCLUDED'
      else situacao
    end
  from combinado;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_PREVISUALIZAR_PUBLICO"(p_aplicacao uuid, p_regra jsonb, p_limite_amostra integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav', 'auth'
AS $function$
declare
  v_resultado jsonb;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Seu perfil não possui permissão para definir o público da avaliação.';
  end if;
  if not exists (select 1 from sigav."TB_APLICACAO_PESQUISA" where id = p_aplicacao) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  with plano as (
    select * from sigav."FC_PLANEJAR_PUBLICO_AVALIACAO"(p_aplicacao, p_regra)
  ),
  inclusoes_pedidas as (
    select valor::uuid as id
    from jsonb_array_elements_text(coalesce(p_regra -> 'includePersonIds', '[]'::jsonb)) as item(valor)
  )
  select jsonb_build_object(
    'status', 'OK',
    'matchedCount', (select count(*) from plano where st_casa and not st_excluida),
    -- O total que o snapshot terá com acesso. É este que os testes comparam
    -- com a contagem real depois de aplicar.
    'effectiveCount', (select count(*) from plano where tp_situacao_nova not in ('BLOCKED', 'EXCLUDED')),
    'newLinkCount', (select count(*) from plano where tp_situacao is null and tp_situacao_nova = 'ELIGIBLE'),
    'reactivatedCount', (select count(*) from plano where tp_situacao = 'EXCLUDED' and tp_situacao_nova = 'ELIGIBLE'),
    'keptCount', (select count(*) from plano
                  where tp_situacao is not null
                    and tp_situacao = tp_situacao_nova
                    and tp_situacao_nova not in ('BLOCKED', 'EXCLUDED')),
    -- Exclusões que de fato tomaram efeito. Quem estava bloqueado e foi
    -- excluído continua bloqueado, então não conta como exclusão.
    'excludedCount', (select count(*) from plano where st_excluida and tp_situacao_nova = 'EXCLUDED'),
    -- Quem sai do público por ter deixado de casar com a regra. Sem este
    -- número, reduzir um público pareceria não fazer nada.
    'removedCount', (select count(*) from plano
                     where not st_casa
                       and tp_situacao in ('ELIGIBLE', 'INVITED')
                       and tp_situacao_nova = 'EXCLUDED'),
    -- Quem já começou ou concluiu e não casa mais: permanece, de propósito.
    'retainedWithProgressCount', (select count(*) from plano
                                  where not st_casa
                                    and tp_situacao in ('IN_PROGRESS', 'COMPLETED')),
    -- Casa com a regra mas segue bloqueado por decisão administrativa.
    'blockedKeptCount', (select count(*) from plano
                         where st_casa and tp_situacao_nova = 'BLOCKED'),
    'ineligibleIncludedCount', (select count(*) from inclusoes_pedidas i
                                where not exists (select 1 from sigav."TB_PESSOA" p where p.id = i.id and p.active)),
    'sample', coalesce((
      select jsonb_agg(item order by item ->> 'fullName')
      from (
        select jsonb_build_object(
          'personId', p.id,
          'fullName', p.full_name,
          'jobTitle', p.job_title,
          'unit', p.metadata ->> 'unit',
          'directorate', p.metadata ->> 'directorate',
          'currentStatus', pl.tp_situacao,
          'nextStatus', pl.tp_situacao_nova,
          'alreadyLinked', pl.tp_situacao is not null
        ) as item
        from plano pl
        join sigav."TB_PESSOA" p on p.id = pl.sq_pessoa
        where pl.tp_situacao_nova not in ('BLOCKED', 'EXCLUDED')
        order by p.full_name
        limit greatest(coalesce(p_limite_amostra, 50), 0)
      ) amostra
    ), '[]'::jsonb)
  )
  into v_resultado;

  return v_resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_REGISTRAR_PRESENCA"()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_pessoa uuid := sigav."FC_PESSOA_SESSAO"();
begin
  if v_pessoa is null then
    raise exception 'Sessao sem cadastro institucional vinculado.';
  end if;

  if not (select sigav."FC_PODE_REGISTRAR_PRESENCA"()) then
    return jsonb_build_object('status', 'DISABLED');
  end if;

  insert into sigav."TB_PRESENCA_ONLINE" (sq_pessoa, dt_visto_em)
  values (v_pessoa, timezone('utc', now()))
  on conflict (sq_pessoa) do update
    set dt_visto_em = timezone('utc', now());

  return jsonb_build_object('status', 'OK');
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_REGRA_GERA_CICLO"(p_alvo uuid, p_origens uuid[])
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  with recursive alcancavel(sq_no) as (
    select unnest(coalesce(p_origens, array[]::uuid[]))
    union
    select origem.sq_origem
    from alcancavel
    cross join lateral sigav."FC_ORIGENS_DA_REGRA"(alcancavel.sq_no) as origem
  )
  select exists (select 1 from alcancavel where sq_no = p_alvo);
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_REIVINDICAR_EMAILS"()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_claim_token uuid := gen_random_uuid();
  v_now timestamptz := timezone('utc', now());
  v_result jsonb;
begin
  if coalesce(sigav."FC_PAPEL_SESSAO"(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  perform sigav."FC_ABRIR_CICLOS_AGENDADOS"();

  /*
    Reivindicação expirada: reconciliar antes de reenfileirar.

    O caso perigoso é a entrega ambígua — o SMTP aceitou a mensagem e a
    confirmação no banco não chegou (queda da função, timeout, rede). A linha
    fica PROCESSANDO, o lease vence, e a versão anterior devolvia tudo para
    PENDENTE: a pessoa recebia o mesmo e-mail de novo.

    `co_message_id` é gravado **antes** do envio, por
    `fc_srv_registrar_transporte`. Sua presença significa "o transporte foi
    iniciado com este identificador". Quem tem identificador não volta para a
    fila: é marcado ENVIADO e sinalizado para conferência humana, porque
    reenviar às cegas é pior do que registrar a dúvida.

    Quem NÃO tem identificador nunca chegou ao SMTP — esse é o retry legítimo, e
    continua funcionando exatamente como antes.
  */
  update sigav."TL_EMAIL_PARTICIPANTE"
  set st_envio = 'ENVIADO',
      co_reivindicacao = null,
      ds_erro = 'Entrega ambígua: o transporte foi iniciado e a confirmação não chegou. Conferir na caixa de saída antes de reenviar.',
      dt_envio = coalesce(dt_envio, v_now),
      dt_atualizacao = v_now
  where st_envio = 'PROCESSANDO'
    and dt_atualizacao < v_now - interval '15 minutes'
    and co_message_id is not null;

  update sigav."TL_EMAIL_PARTICIPANTE"
  set st_envio = case when nu_tentativas >= 5 then 'FALHOU' else 'PENDENTE' end,
      co_reivindicacao = null,
      ds_erro = case
        when nu_tentativas >= 5 then 'Limite de tentativas atingido após expiração da reivindicação.'
        else 'A reivindicação anterior expirou antes da confirmação.'
      end,
      dt_atualizacao = v_now
  where st_envio = 'PROCESSANDO'
    and dt_atualizacao < v_now - interval '15 minutes'
    and co_message_id is null;

  insert into sigav."TL_EMAIL_PARTICIPANTE" (
    sq_aplicacao, sq_pessoa, tp_email, st_envio
  )
  select a.id, p.id, e.tp_email, 'PENDENTE'
  from sigav."TB_APLICACAO_PESQUISA" a
  join sigav."RL_APLICACAO_PESSOA" ap on ap.application_id = a.id
  join sigav."TB_PESSOA" p on p.id = ap.person_id
  cross join lateral (
    values ('research_opened'), ('research_expiring_24h')
  ) as e(tp_email)
  where a.st_notificacao_email
    and a.status = 'OPEN'
    and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
    and p.active
    and p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    and (
      (e.tp_email = 'research_opened'
        and (a.closes_at is null or a.closes_at > now()))
      or
      (e.tp_email = 'research_expiring_24h'
        and a.closes_at is not null
        and a.closes_at > now()
        and a.closes_at <= now() + interval '24 hours'
        and exists (
          select 1
          from sigav."TL_EMAIL_PARTICIPANTE" abertura
          where abertura.sq_aplicacao = a.id
            and abertura.sq_pessoa = p.id
            and abertura.tp_email = 'research_opened'
            and abertura.st_envio = 'ENVIADO'
            and abertura.dt_envio <= now() - interval '1 hour'
        ))
    )
  on conflict (sq_aplicacao, sq_pessoa, tp_email)
    where tp_email in ('research_opened', 'research_expiring_24h')
  do nothing;

  with candidates as (
    select t.sq_email
    from sigav."TL_EMAIL_PARTICIPANTE" t
    join sigav."TB_APLICACAO_PESQUISA" a on a.id = t.sq_aplicacao
    join sigav."RL_APLICACAO_PESSOA" ap
      on ap.application_id = t.sq_aplicacao
     and ap.person_id = t.sq_pessoa
    join sigav."TB_PESSOA" p on p.id = t.sq_pessoa
    where (
        t.st_envio = 'PENDENTE'
        or (
          t.st_envio = 'FALHOU'
          and t.dt_atualizacao <= v_now - interval '5 minutes'
        )
      )
      -- Envio dirigido nao exige o interruptor do ciclo: e ato explicito de
      -- quem opera, e exigi-lo impediria cobrar quem falta num ciclo sem
      -- aviso automatico ligado.
      and (t.tp_email = 'manual_reminder' or a.st_notificacao_email)
      and a.status = 'OPEN'
      and t.nu_tentativas < 5
      and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
      and p.active
      and p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      and (
        -- Sem janela propria: o lembrete dirigido vale enquanto o ciclo estiver
        -- aberto, porque quem o disparou decidiu o momento.
        t.tp_email = 'manual_reminder'
        or
        (t.tp_email = 'research_opened'
          and (a.closes_at is null or a.closes_at > now()))
        or
        (t.tp_email = 'research_expiring_24h'
          and a.closes_at is not null
          and a.closes_at > now()
          and a.closes_at <= now() + interval '24 hours'
          and exists (
            select 1
            from sigav."TL_EMAIL_PARTICIPANTE" abertura
            where abertura.sq_aplicacao = t.sq_aplicacao
              and abertura.sq_pessoa = t.sq_pessoa
              and abertura.tp_email = 'research_opened'
              and abertura.st_envio = 'ENVIADO'
              and abertura.dt_envio <= now() - interval '1 hour'
          ))
      )
    order by t.dt_criacao, t.sq_email
    for update of t skip locked
    limit 100
  )
  update sigav."TL_EMAIL_PARTICIPANTE" t
  set st_envio = 'PROCESSANDO',
      co_reivindicacao = v_claim_token,
      nu_tentativas = t.nu_tentativas + 1,
      ds_erro = null,
      dt_atualizacao = v_now
  from candidates c
  where t.sq_email = c.sq_email;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t.sq_email,
    'claimToken', t.co_reivindicacao,
    'applicationId', t.sq_aplicacao,
    'personId', t.sq_pessoa,
    'kind', t.tp_email,
    'personName', p.full_name,
    'personEmail', p.institutional_email,
    'applicationName', a.name,
    'applicationCode', a.code,
    'surveyCode', s.code,
    'closesAt', a.closes_at,
    'surveyDescription', s.description,
    'organizationName', cfg.no_organizacao,
    'productName', cfg.no_produto,
    'emailInstruction', cfg.tx_instrucao_email,
    'emailFooter', cfg.tx_rodape_email
  ) order by t.dt_criacao, t.sq_email), '[]'::jsonb)
  into v_result
  from sigav."TL_EMAIL_PARTICIPANTE" t
  join sigav."TB_APLICACAO_PESQUISA" a on a.id = t.sq_aplicacao
  join sigav."TH_VERSAO_PESQUISA" sv on sv.id = a.survey_version_id
  join sigav."TB_PESQUISA" s on s.id = sv.survey_id
  join sigav."TB_PESSOA" p on p.id = t.sq_pessoa
  -- LEFT de proposito: configuracao ausente faz o template cair no padrao do
  -- codigo, e nunca impede o envio.
  left join sigav."TB_CONFIG_PLATAFORMA" cfg on cfg.co_configuracao = 1
  where t.st_envio = 'PROCESSANDO'
    and t.co_reivindicacao = v_claim_token;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_REMOVER_RESPOSTA_PESSOA"(p_submissao uuid, p_modo text DEFAULT 'INVALIDATE'::text, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_pessoa uuid;
  v_submissao sigav."TB_SUBMISSAO"%rowtype;
  v_modo text;
  v_motivo text;
  v_respostas integer;
  v_retrato jsonb;
  v_resultados uuid[];
begin
  if not sigav."FC_TEM_MODULO"('ADMIN_TEAMS') then
    raise exception 'Apenas o Superadmin pode anular ou apagar a resposta de outra pessoa.';
  end if;

  v_pessoa := sigav."FC_PESSOA_SESSAO"();
  v_modo := upper(btrim(coalesce(p_modo, '')));
  v_motivo := btrim(coalesce(p_motivo, ''));

  if v_modo not in ('INVALIDATE', 'DELETE') then
    raise exception 'Modo inválido. Use INVALIDATE para anular ou DELETE para apagar.';
  end if;

  if length(v_motivo) < 10 then
    raise exception 'Descreva o motivo da operação com pelo menos 10 caracteres.';
  end if;

  select * into v_submissao from sigav."TB_SUBMISSAO" where id = p_submissao;
  if v_submissao.id is null then
    raise exception 'Resposta não localizada.';
  end if;

  select count(*)::integer into v_respostas from sigav."TB_RESPOSTA" where submission_id = p_submissao;

  -- Quais resultados consolidados dependem desta submissão. Levantado agora
  -- porque o `DELETE` anula os vínculos logo adiante, e depois disso a
  -- informação some.
  select coalesce(array_agg(id), '{}')
  into v_resultados
  from sigav."TB_RESULTADO_FINAL_CDDI"
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
  from sigav."TB_APLICACAO_PESQUISA" as aplicacao
  left join sigav."TB_PESSOA" as pessoa on pessoa.id = v_submissao.respondent_person_id
  where aplicacao.id = v_submissao.application_id;

  insert into sigav."TL_EVENTO_AUDITORIA" (
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
    update sigav."TB_RESULTADO_FINAL_CDDI"
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
  delete from sigav."TB_RESULTADO_COMPET_CDDI" where submission_id = p_submissao;

  if v_modo = 'INVALIDATE' then
    -- As respostas continuam gravadas; o que muda é o estado da submissão, e é
    -- ele que os painéis e o cálculo leem.
    update sigav."TB_SUBMISSAO"
    set status = 'INVALIDATED',
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'invalidatedBy', v_pessoa, 'invalidatedAt', now(), 'invalidationReason', v_motivo
        )
    where id = p_submissao;
  else
    -- De baixo para cima, como toda remoção neste banco. Os vínculos só são
    -- anulados aqui, depois de os resultados já terem sido marcados.
    update sigav."TB_RESULTADO_FINAL_CDDI" set auto_submission_id = null where auto_submission_id = p_submissao;
    update sigav."TB_RESULTADO_FINAL_CDDI" set leader_submission_id = null where leader_submission_id = p_submissao;
    delete from sigav."RL_RESPOSTA_OPCAO" where answer_id in (
      select id from sigav."TB_RESPOSTA" where submission_id = p_submissao
    );
    delete from sigav."TB_RESPOSTA" where submission_id = p_submissao;
    delete from sigav."TB_SUBMISSAO" where id = p_submissao;
  end if;

  -- A pessoa volta a constar como pendente no ciclo: sem isso, o painel
  -- continuaria contando como concluída uma resposta que não existe mais.
  update sigav."RL_APLICACAO_PESSOA"
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
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_RESOLVER_PUBLICO_AVALIACAO"(p_regra jsonb)
 RETURNS TABLE(sq_pessoa uuid, tp_origem text, st_excluida boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav', 'auth'
AS $function$
begin
  -- Antes de qualquer leitura. Regra malformada não deve produzir resultado
  -- nenhum — e muito menos um resultado grande, que é o modo de falhar que
  -- passa despercebido. Como prévia, plano e aplicação descem por aqui, validar
  -- neste ponto cobre os três de uma vez.
  perform sigav."FC_VALIDAR_REGRA_PUBLICO"(p_regra);

  return query
  with regra as (
    select
      coalesce(p_regra -> 'filters', '{}'::jsonb) as filtros,
      coalesce((p_regra ->> 'allEligible')::boolean, false) as todas,
      coalesce(p_regra -> 'includePersonIds', '[]'::jsonb) as incluidas,
      coalesce(p_regra -> 'excludePersonIds', '[]'::jsonb) as excluidas
  ),
  algum_filtro as (
    select exists (
      select 1
      from regra, jsonb_each(regra.filtros) as filtro(chave, valor)
      where jsonb_typeof(filtro.valor) = 'array'
        and jsonb_array_length(filtro.valor) > 0
    ) as ha
  ),
  ids_incluidos as (
    select valor::uuid as id
    from regra, jsonb_array_elements_text(regra.incluidas) as item(valor)
  ),
  ids_excluidos as (
    select valor::uuid as id
    from regra, jsonb_array_elements_text(regra.excluidas) as item(valor)
  ),
  por_filtro as (
    select p.id
    from sigav."TB_PESSOA" p, regra r, algum_filtro af
    where p.active
      and (
        r.todas
        or (
          af.ha
          and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p.metadata ->> 'directorate',  r.filtros -> 'directorate')
          and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p.metadata ->> 'unit',         r.filtros -> 'unit')
          and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p.metadata ->> 'coordination', r.filtros -> 'coordination')
          and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p.cost_center,                 r.filtros -> 'costCenter')
          and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p.job_title,                   r.filtros -> 'jobTitle')
        )
      )
  ),
  -- Inclusão individual é adicional ao filtro, mas não é passe livre: a
  -- elegibilidade é a mesma para todo mundo. Quem for incluído e não estiver
  -- ativo simplesmente não entra, e a prévia informa quantos foram nesse caso.
  por_inclusao as (
    select p.id
    from sigav."TB_PESSOA" p
    where p.active
      and p.id in (select id from ids_incluidos)
  ),
  reunidas as (
    select id, 'FILTRO' as origem from por_filtro
    union all
    select id, 'INCLUSAO' from por_inclusao
  )
  select
    r.id,
    -- 'FILTRO' < 'INCLUSAO' na ordenação de texto: quem casou com o filtro é
    -- reportado como tal mesmo que também tenha sido incluído à mão.
    min(r.origem),
    bool_or(r.id in (select id from ids_excluidos))
  from reunidas r
  group by r.id;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SALVAR_REGRA_CONDICIONAL"(p_alvo_tipo text, p_alvo uuid, p_acao text DEFAULT 'SHOW'::text, p_conector text DEFAULT 'ALL'::text, p_condicoes jsonb DEFAULT '[]'::jsonb, p_descricao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_pessoa uuid := sigav."FC_PESSOA_SESSAO"();
  v_tipo text := upper(btrim(coalesce(p_alvo_tipo, '')));
  v_acao text := upper(btrim(coalesce(p_acao, 'SHOW')));
  v_conector text := upper(btrim(coalesce(p_conector, 'ALL')));
  v_versao uuid;
  v_status text;
  v_regra uuid;
  v_condicao jsonb;
  v_origens uuid[] := array[]::uuid[];
  v_origem uuid;
  v_operador text;
  v_ordem integer := 0;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;
  if v_tipo not in ('QUESTION', 'SECTION') then
    raise exception 'Informe se a regra vale para uma pergunta ou para uma seção.';
  end if;
  if v_acao not in ('SHOW', 'HIDE') then
    raise exception 'A ação da regra precisa ser SHOW ou HIDE.';
  end if;
  if v_conector not in ('ALL', 'ANY') then
    raise exception 'O conector da regra precisa ser ALL ou ANY.';
  end if;

  if v_tipo = 'QUESTION' then
    select pergunta.survey_version_id into v_versao
    from sigav."TB_PERGUNTA_PESQUISA" as pergunta where pergunta.id = p_alvo;
  else
    select secao.survey_version_id into v_versao
    from sigav."TB_SECAO_PESQUISA" as secao where secao.id = p_alvo;
  end if;
  if v_versao is null then
    raise exception 'Pergunta ou seção não localizada.';
  end if;

  -- Regra é estrutura do instrumento: muda enquanto a versão é rascunho, como
  -- seção e pergunta. Depois de publicada, alterar a lógica mudaria o que já foi
  -- respondido por quem já respondeu.
  select status into v_status from sigav."TH_VERSAO_PESQUISA" where id = v_versao;
  if v_status <> 'DRAFT' then
    raise exception 'A lógica condicional só pode ser alterada enquanto a versão está em rascunho.';
  end if;

  -- Origens propostas, validadas antes de gravar: pergunta precisa existir, ser
  -- da mesma versão e não ser o próprio alvo.
  for v_condicao in select value from jsonb_array_elements(coalesce(p_condicoes, '[]'::jsonb)) loop
    v_origem := nullif(btrim(coalesce(v_condicao->>'questionId', '')), '')::uuid;
    v_operador := upper(btrim(coalesce(v_condicao->>'operator', '')));
    if v_origem is null then
      raise exception 'Toda condição precisa apontar uma pergunta de origem.';
    end if;
    if not exists (
      select 1 from sigav."TB_PERGUNTA_PESQUISA"
      where id = v_origem and survey_version_id = v_versao
    ) then
      raise exception 'A pergunta de origem não pertence a esta versão da avaliação.';
    end if;
    if v_origem = p_alvo then
      raise exception 'Uma pergunta não pode condicionar a si mesma.';
    end if;
    if v_operador in ('SELECTED', 'NOT_SELECTED') and not exists (
      select 1 from sigav."TB_OPCAO_PERGUNTA"
      where id = nullif(btrim(coalesce(v_condicao->>'optionId', '')), '')::uuid
        and question_id = v_origem
    ) then
      raise exception 'A alternativa comparada não pertence à pergunta de origem.';
    end if;
    v_origens := v_origens || v_origem;
  end loop;

  if sigav."FC_REGRA_GERA_CICLO"(p_alvo, v_origens) then
    raise exception 'Esta regra cria uma dependência circular entre as perguntas.';
  end if;

  -- Substituição em bloco: a regra vigente do alvo sai e a nova entra na mesma
  -- transação, o que mantém o índice de unicidade satisfeito sem exigir que a
  -- tela apague antes de salvar.
  delete from sigav."TB_REGRA_CONDICIONAL" where sq_alvo = p_alvo;

  insert into sigav."TB_REGRA_CONDICIONAL" (
    sq_versao_pesquisa, tp_alvo, sq_alvo, tp_acao, tp_conector, ds_regra, au_usuario_inclusao
  ) values (
    v_versao, v_tipo, p_alvo, v_acao, v_conector, nullif(btrim(coalesce(p_descricao, '')), ''), v_pessoa
  ) returning sq_regra into v_regra;

  for v_condicao in select value from jsonb_array_elements(coalesce(p_condicoes, '[]'::jsonb)) loop
    v_ordem := v_ordem + 1;
    v_operador := upper(btrim(coalesce(v_condicao->>'operator', '')));
    insert into sigav."TB_CONDICAO_REGRA" (
      sq_regra, sq_pergunta_origem, tp_operador, sq_opcao, tx_valor, nu_valor, nu_ordem
    ) values (
      v_regra,
      (v_condicao->>'questionId')::uuid,
      v_operador,
      nullif(btrim(coalesce(v_condicao->>'optionId', '')), '')::uuid,
      nullif(btrim(coalesce(v_condicao->>'value', '')), ''),
      case when v_operador in ('GREATER_THAN', 'LESS_THAN')
        then nullif(btrim(coalesce(v_condicao->>'value', '')), '')::numeric
      end,
      v_ordem
    );
  end loop;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    actor_person_id, event_type, entity_type, entity_id, after_data, metadata
  ) values (
    v_pessoa, 'SURVEY_RULE_SAVED', 'CONDITIONAL_RULE', v_regra::text,
    jsonb_build_object('target', p_alvo, 'action', v_acao, 'connector', v_conector),
    '{}'::jsonb
  );

  return jsonb_build_object('status', 'OK', 'ruleId', v_regra, 'conditions', v_ordem);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SINCRONIZAR_ESTADO_CICLOS"()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav', 'auth'
AS $function$
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
    from sigav."TB_APLICACAO_PESQUISA" sa
    where sa.closes_at is not null
      and sa.closes_at <= now()
      and sa.status in ('OPEN', 'SCHEDULED')
    for update skip locked
  ), fechados as (
    update sigav."TB_APLICACAO_PESQUISA" sa
    set status = 'CLOSED',
        updated_at = now()
    from alvos
    where sa.id = alvos.id
    returning sa.id, sa.code, alvos.status_anterior, sa.opens_at, sa.closes_at
  )
  insert into sigav."TL_EVENTO_AUDITORIA"(
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
  -- `FC_ABRIR_CICLOS_AGENDADOS()` sem alteração de comportamento.
  with abertos as (
    update sigav."TB_APLICACAO_PESQUISA" sa
    set status = 'OPEN',
        updated_at = now()
    where sa.status = 'SCHEDULED'
      and sa.opens_at is not null
      and sa.opens_at <= now()
      and sa.closes_at is not null
      and sa.closes_at > now()
      and exists (
        select 1
        from sigav."TH_VERSAO_PESQUISA" sv
        where sv.id = sa.survey_version_id
          and sv.status = 'PUBLISHED'
      )
    returning sa.id, sa.code, sa.survey_version_id, sa.opens_at, sa.closes_at
  )
  insert into sigav."TL_EVENTO_AUDITORIA"(
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
    delete from sigav."TB_BILHETE_ANONIMO" b
    using sigav."TB_APLICACAO_PESQUISA" sa
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
  insert into sigav."TL_EVENTO_AUDITORIA"(
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

CREATE OR REPLACE FUNCTION sigav."FC_SRV_CONCLUIR_EMAIL"(target_email_id uuid, target_success boolean, target_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  perform sigav."FC_CONCLUIR_EMAIL_PARTICIPANTE"(
    target_email_id,
    target_success,
    target_error
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SRV_CONCLUIR_EMAIL"(target_email_id uuid, target_claim_token uuid, target_success boolean, target_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  perform sigav."FC_CONCLUIR_EMAIL_PARTICIPANTE"(
    target_email_id,
    target_claim_token,
    target_success,
    target_error
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SRV_CONSUMIR_LIMITE_PUBLICO"(target_scope text, target_key_hash text, target_limit integer, target_window_seconds integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
  v_retry_after integer;
begin
  if target_scope is null or btrim(target_scope) = '' or length(target_scope) > 80 then
    raise exception 'Escopo de rate limit inválido.';
  end if;

  if target_key_hash is null or target_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Chave de rate limit inválida.';
  end if;

  if target_limit is null or target_limit < 1 or target_limit > 10000 then
    raise exception 'Limite de requisições inválido.';
  end if;

  if target_window_seconds is null or target_window_seconds < 1 or target_window_seconds > 86400 then
    raise exception 'Janela de rate limit inválida.';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / target_window_seconds) * target_window_seconds
  );

  insert into sigav."TB_LIMITE_REQUISICAO_PUBLICA" (
    no_escopo,
    co_chave,
    dt_janela,
    nu_requisicoes,
    dt_atualizacao
  ) values (
    btrim(target_scope),
    target_key_hash,
    v_window_start,
    1,
    v_now
  )
  on conflict (no_escopo, co_chave, dt_janela)
  do update set
    nu_requisicoes = sigav."TB_LIMITE_REQUISICAO_PUBLICA".nu_requisicoes + 1,
    dt_atualizacao = excluded.dt_atualizacao
  returning nu_requisicoes into v_count;

  -- Limpeza probabilística evita crescimento indefinido sem executar DELETE em
  -- toda requisição pública. O índice por janela mantém a coleta barata.
  if random() < 0.02 then
    delete from sigav."TB_LIMITE_REQUISICAO_PUBLICA"
    where dt_janela < v_now - interval '2 days';
  end if;

  v_retry_after := greatest(
    1,
    ceil(extract(epoch from (
      (v_window_start + make_interval(secs => target_window_seconds)) - v_now
    )))::integer
  );

  return jsonb_build_object(
    'allowed', v_count <= target_limit,
    'remaining', greatest(target_limit - v_count, 0),
    'retryAfter', v_retry_after
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SRV_ENVIAR_RESP_ANON"(target_submission_id uuid, target_session_token text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select sigav."FC_ENVIAR_RESP_ANON"(target_submission_id, target_session_token);
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SRV_EXPIRAR_RASCUNHOS_ANON"()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  -- A ACL abaixo é a barreira principal. A claim é defesa em profundidade:
  -- ausência de JWT/role é recusada, nunca promovida implicitamente a
  -- service_role.
  if coalesce(sigav."FC_CLAIMS_SESSAO"()->>'role', '') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  return sigav."FC_EXPIRAR_RASCUNHOS_ANONIMOS"();
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SRV_GRAVAR_RESP_ANON"(target_submission_id uuid, target_session_token text, target_question_id uuid, target_option_ids uuid[], target_text text, target_number numeric, target_boolean boolean, target_date date, target_datetime timestamp with time zone, target_json jsonb)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select sigav."FC_GRAVAR_RESP_ANON"(
    target_submission_id,
    target_session_token,
    target_question_id,
    target_option_ids,
    target_text,
    target_number,
    target_boolean,
    target_date,
    target_datetime,
    target_json
  );
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SRV_INICIAR_RESP_ANON"(target_application_code text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select sigav."FC_INICIAR_RESP_ANON"(target_application_code);
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SRV_OBTER_FORM_ANONIMO"(target_application_code text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select sigav."FC_OBTER_FORM_ANONIMO"(target_application_code);
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SRV_REGISTRAR_ERRO"(p_co_referencia text, p_no_rota text, p_tp_erro text, p_ds_mensagem text, p_ds_contexto jsonb, p_st_ambiente text, p_nu_http_status integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  insert into sigav."TL_ERRO_APLICACAO" (
    co_referencia, no_rota, tp_erro, ds_mensagem, ds_contexto, st_ambiente, nu_http_status
  ) values (
    p_co_referencia, p_no_rota, p_tp_erro, p_ds_mensagem,
    coalesce(p_ds_contexto, '{}'::jsonb), p_st_ambiente, p_nu_http_status
  )
  on conflict (co_referencia) do nothing;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SRV_REGISTRAR_TRANSPORTE"(target_email_id uuid, target_claim_token uuid, target_message_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_afetadas integer;
begin
  if coalesce(sigav."FC_PAPEL_SESSAO"(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  if target_email_id is null or target_claim_token is null then
    raise exception 'Informe o envio e o token da reivindicação.';
  end if;

  if coalesce(btrim(target_message_id), '') = '' then
    raise exception 'Informe o identificador da mensagem.';
  end if;

  update sigav."TL_EMAIL_PARTICIPANTE"
  set co_message_id = btrim(target_message_id),
      dt_transporte = timezone('utc', now()),
      dt_atualizacao = timezone('utc', now())
  where sq_email = target_email_id
    and co_reivindicacao = target_claim_token
    and st_envio = 'PROCESSANDO';

  get diagnostics v_afetadas = row_count;

  -- Zero linhas não é erro: o lease pode ter vencido entre reivindicar e
  -- enviar. Quem chamou precisa saber para **não** prosseguir com o envio.
  return jsonb_build_object('status', case when v_afetadas = 1 then 'OK' else 'EXPIRADO' end);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SRV_REIVINDICAR_EMAILS"()
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select sigav."FC_REIVINDICAR_EMAILS"();
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SRV_RESOLVER_IDENT_OAUTH"(p_provider text, p_provider_sub text, p_email text, p_nome text, p_avatar text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_provider text := lower(btrim(coalesce(p_provider, '')));
  v_sub text := btrim(coalesce(p_provider_sub, ''));
  v_user_id uuid;
  v_novo boolean := false;
  v_agora timestamptz := timezone('utc', now());
begin
  if v_email = '' or v_provider = '' or v_sub = '' then
    raise exception 'Provedor, identificador e e-mail são obrigatórios.';
  end if;

  -- O domínio institucional é decidido pelo banco (sigav."TB_DOMINIO_INSTITUCIONAL"),
  -- não por lista no código: é a mesma fonte que FC_RESOLVER_PESSOA_AUTENTIC
  -- consulta, então login e vinculação nunca discordam.
  if not sigav."FC_EMAIL_INSTITUC_PERMITIDO"(v_email) then
    return jsonb_build_object('status', 'DOMINIO_NAO_AUTORIZADO', 'email', v_email);
  end if;

  -- 1) identidade já registrada para este provedor
  select user_id into v_user_id
  from sigav."TB_IDENTIDADE_OAUTH"
  where provider = v_provider and provider_id = v_sub;

  -- 2) sem identidade: reaproveita a conta existente com o mesmo e-mail.
  --    Este é o passo que preserva o vínculo de quem já usava a plataforma.
  if v_user_id is null then
    select id into v_user_id
    from sigav."TB_USUARIO_IDENTIDADE"
    where lower(email) = v_email
    order by created_at nulls last
    limit 1;
  end if;

  -- 3) ninguém encontrado: conta nova de fato
  if v_user_id is null then
    v_user_id := gen_random_uuid();
    v_novo := true;

    insert into sigav."TB_USUARIO_IDENTIDADE"
      (id, email, raw_user_meta_data, raw_app_meta_data,
       email_confirmed_at, created_at, updated_at, last_sign_in_at)
    values (
      v_user_id, v_email,
      jsonb_build_object('email', v_email, 'name', p_nome, 'full_name', p_nome,
                         'avatar_url', p_avatar, 'picture', p_avatar,
                         'email_verified', true, 'provider_id', v_sub),
      jsonb_build_object('provider', v_provider, 'providers', jsonb_build_array(v_provider)),
      v_agora, v_agora, v_agora, v_agora
    );
  else
    -- Os metadados são reescritos a cada login para o avatar e o nome
    -- acompanharem a conta Google, que é como o GoTrue se comportava.
    update sigav."TB_USUARIO_IDENTIDADE"
    set email = coalesce(nullif(v_email, ''), email),
        raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object(
          'email', v_email, 'name', p_nome, 'full_name', p_nome,
          'avatar_url', p_avatar, 'picture', p_avatar, 'provider_id', v_sub),
        last_sign_in_at = v_agora,
        updated_at = v_agora
    where id = v_user_id;
  end if;

  -- A identidade guarda o que FC_SINCR_AVATAR_GOOGLE() vai ler. `picture` e
  -- `avatar_url` são gravados juntos porque a função aceita qualquer um dos
  -- dois, e assim ela não precisa mudar.
  --
  -- `email` NÃO entra na lista de colunas: é coluna gerada a partir de
  -- `identity_data->>'email'`, e o Postgres recusa insert que atribua valor a
  -- ela. `id` também fica de fora — tem default `gen_random_uuid()`.
  insert into sigav."TB_IDENTIDADE_OAUTH"
    (provider_id, provider, user_id, identity_data,
     last_sign_in_at, created_at, updated_at)
  values (
    v_sub, v_provider, v_user_id,
    jsonb_build_object('sub', v_sub, 'iss', 'https://accounts.google.com',
                       'email', v_email, 'email_verified', true,
                       'name', p_nome, 'full_name', p_nome,
                       'picture', p_avatar, 'avatar_url', p_avatar,
                       'provider_id', v_sub),
    v_agora, v_agora, v_agora
  )
  on conflict (provider_id, provider) do update
  set user_id = excluded.user_id,
      identity_data = excluded.identity_data,
      last_sign_in_at = excluded.last_sign_in_at,
      updated_at = excluded.updated_at;

  return jsonb_build_object(
    'status', 'OK',
    'userId', v_user_id,
    'email', v_email,
    'novo', v_novo
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SRV_VERIFICAR_CONTRATO_RPC"(p_nomes text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_ausentes text[];
begin
  if coalesce(sigav."FC_PAPEL_SESSAO"(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  if p_nomes is null or cardinality(p_nomes) = 0 then
    raise exception 'Informe ao menos um nome de função.';
  end if;

  -- Teto defensivo: a lista é um contrato curto por desenho, e receber milhares
  -- de nomes indicaria uso indevido, não verificação de contrato.
  if cardinality(p_nomes) > 200 then
    raise exception 'Verifique no máximo 200 funções por chamada.';
  end if;

  -- Compara só o **nome**, não a assinatura: é o nome que o PostgREST resolve
  -- e é a ausência dele que produz PGRST202. Divergência de assinatura é outro
  -- defeito, coberto por `npm run db:rpc` contra o banco reconstruído.
  select coalesce(array_agg(n order by n), array[]::text[])
  into v_ausentes
  from unnest(p_nomes) as n
  where not exists (
    select 1
    from pg_proc p
    join pg_namespace ns on ns.oid = p.pronamespace
    where ns.nspname = 'sigav' and p.proname = n
  );

  return jsonb_build_object(
    'checked', cardinality(p_nomes),
    'missing', to_jsonb(v_ausentes),
    'compatible', cardinality(v_ausentes) = 0
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SRV_VERIFICAR_MIGRATIONS"(p_versoes text[])
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  with esperadas as (
    select distinct versao
    from unnest(coalesce(p_versoes, array[]::text[])) as t(versao)
    where versao is not null and btrim(versao) <> ''
  ),
  ausentes as (
    select e.versao
    from esperadas e
    where not exists (
      select 1
      from sigav."TB_MIGRACAO" m
      where m.co_versao = e.versao
    )
  )
  select jsonb_build_object(
    'checked', (select count(*) from esperadas),
    'missing', coalesce((select jsonb_agg(versao order by versao) from ausentes), '[]'::jsonb),
    'compatible', not exists (select 1 from ausentes),
    'latestApplied', (select max(co_versao) from sigav."TB_MIGRACAO")
  );
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_UID_SESSAO"()
 RETURNS uuid
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog'
AS $function$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_VALIDAR_CICLO_ANONIMO"()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if new.anonymous is distinct from old.anonymous
     and exists (select 1 from sigav."TB_SUBMISSAO" s where s.application_id = new.id) then
    raise exception 'Este ciclo já tem respostas: o anonimato não pode ser ligado nem desligado agora.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_VALIDAR_FOTO_GOOGLE"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if new.metadata ? 'avatar_config'
     or coalesce(new.metadata->>'avatar_source', '') not in ('', 'GOOGLE')
     or nullif(btrim(coalesce(new.metadata->>'avatar_url', '')), '')
        is distinct from nullif(btrim(coalesce(new.metadata->>'google_avatar_url', '')), '') then
    raise exception 'A foto de perfil é sincronizada automaticamente com a conta Google.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_VALIDAR_REGRA_PUBLICO"(p_regra jsonb)
 RETURNS void
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_dimensoes constant text[] := array['directorate', 'unit', 'coordination', 'costCenter', 'jobTitle'];
  v_chave text;
  v_lista text;
begin
  if p_regra is null or jsonb_typeof(p_regra) <> 'object' then
    raise exception 'Regra de público inválida: era esperado um objeto.';
  end if;

  if p_regra ? 'filters' then
    if jsonb_typeof(p_regra -> 'filters') <> 'object' then
      raise exception 'Regra de público inválida: "filters" precisa ser um objeto de dimensões.';
    end if;

    for v_chave in select jsonb_object_keys(p_regra -> 'filters') loop
      if not (v_chave = any (v_dimensoes)) then
        raise exception 'Regra de público inválida: dimensão desconhecida "%". Dimensões aceitas: %.',
          v_chave, array_to_string(v_dimensoes, ', ');
      end if;
      if jsonb_typeof(p_regra -> 'filters' -> v_chave) <> 'array' then
        raise exception 'Regra de público inválida: a dimensão "%" precisa ser uma lista de valores.', v_chave;
      end if;
    end loop;
  end if;

  if p_regra ? 'allEligible' and jsonb_typeof(p_regra -> 'allEligible') <> 'boolean' then
    raise exception 'Regra de público inválida: "allEligible" precisa ser verdadeiro ou falso.';
  end if;

  -- Listas de pessoas: array de identificadores. Sem esta checagem, o `::uuid`
  -- lá adiante devolveria erro de conversão, que não diz a quem opera o que
  -- fazer a respeito.
  foreach v_lista in array array['includePersonIds', 'excludePersonIds'] loop
    if p_regra ? v_lista then
      if jsonb_typeof(p_regra -> v_lista) <> 'array' then
        raise exception 'Regra de público inválida: "%" precisa ser uma lista de identificadores.', v_lista;
      end if;
      if exists (
        select 1
        from jsonb_array_elements(p_regra -> v_lista) as item(valor)
        where jsonb_typeof(item.valor) <> 'string'
           or item.valor #>> '{}' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      ) then
        raise exception 'Regra de público inválida: "%" contém identificador que não é um UUID.', v_lista;
      end if;
    end if;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_RESUMO_BASE_PESSOAS"(target_application_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Seu perfil não possui permissão para consultar a base de pessoas.';
  end if;

  if target_application_id is not null
     and not exists(select 1 from sigav."TB_APLICACAO_PESQUISA" where id = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  return (
    select jsonb_build_object(
      'totalPeople', count(*),
      'activePeople', count(*) filter(where p.active and upper(btrim(coalesce(p.employment_status,''))) in ('ATIVO','NORMAL')),
      'inactivePeople', count(*) filter(where not p.active or upper(btrim(coalesce(p.employment_status,''))) not in ('ATIVO','NORMAL')),
      'withInstitutionalEmail', count(*) filter(where nullif(btrim(coalesce(p.institutional_email,'')),'') is not null),
      'withoutInstitutionalEmail', count(*) filter(where nullif(btrim(coalesce(p.institutional_email,'')),'') is null),
      'authenticatedPeople', count(*) filter(where p.auth_user_id is not null),
      'withChosenAvatar', count(*) filter(where coalesce(p.metadata->>'avatar_source','') in ('UPLOADED','GENERATED')),
      'linkedToApplication', count(*) filter(where ap.id is not null and ap.status <> 'EXCLUDED'),
      'availableToLink', count(*) filter(
        where p.active
          and upper(btrim(coalesce(p.employment_status,''))) in ('ATIVO','NORMAL')
          and (target_application_id is null or ap.id is null or ap.status = 'EXCLUDED')
      )
    )
    from sigav."TB_PESSOA" p
    left join sigav."RL_APLICACAO_PESSOA" ap
      on target_application_id is not null
     and ap.application_id = target_application_id
     and ap.person_id = p.id
     and ap.participant_role = 'RESPONDENT'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_VISUAL_CICLO"(target_application_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_visual jsonb;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à Equipe Técnica.';
  end if;

  select *
  into v_application
  from sigav."TB_APLICACAO_PESQUISA"
  where id = target_application_id;

  if v_application.id is null then
    raise exception 'Aplicação de pesquisa não encontrada.';
  end if;

  v_visual := coalesce(v_application.settings->'visualIdentity', '{}'::jsonb);

  return jsonb_build_object(
    'status', 'OK',
    'applicationId', v_application.id,
    'applicationCode', v_application.code,
    'applicationName', v_application.name,
    'visualIdentity', jsonb_build_object(
      'bannerUrl', nullif(btrim(v_visual->>'bannerUrl'), ''),
      'bannerPath', nullif(btrim(v_visual->>'bannerPath'), ''),
      'bannerAlt', nullif(btrim(v_visual->>'bannerAlt'), ''),
      'heroTitle', nullif(btrim(v_visual->>'heroTitle'), ''),
      'heroSubtitle', nullif(btrim(v_visual->>'heroSubtitle'), ''),
      'themeVariant', coalesce(nullif(btrim(v_visual->>'themeVariant'), ''), 'INSTITUTIONAL')
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_PAINEL_MONITOR_CDDI"(target_application_code text DEFAULT 'CDDI-2026'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid;
  v_application_id uuid;
begin
  v_person_id := sigav."FC_PESSOA_SESSAO"();
  if v_person_id is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;

  select sa.id
  into v_application_id
  from sigav."TB_APLICACAO_PESQUISA" sa
  where sa.code = btrim(target_application_code)
  limit 1;

  if v_application_id is null then
    raise exception 'Ciclo de pesquisa não encontrado.';
  end if;

  if not sigav."FC_TEM_MODULO"('DASHBOARDS') then
    raise exception 'Acesso não autorizado ao painel CDDI.' using errcode = '42501';
  end if;

  return sigav."FC_PAINEL_MONITOR_CDDI_INT"(target_application_code);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_PAINEL_MONITOR_CDDI_INT"(target_application_code text DEFAULT 'CDDI-2026'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid;
  v_application_id uuid;
  v_payload jsonb;
  v_scope text;
  -- Resolvidos UMA vez: usados dentro do filtro, eram avaliados por linha.
  v_pode_gerenciar boolean;
  v_e_lider boolean;
begin
  v_person_id := sigav."FC_PESSOA_SESSAO"();
  if v_person_id is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;

  select sa.id into v_application_id
  from sigav."TB_APLICACAO_PESQUISA" sa
  where sa.code = btrim(target_application_code)
  limit 1;

  if v_application_id is null then
    raise exception 'Ciclo de pesquisa não encontrado.';
  end if;

  v_pode_gerenciar := sigav."FC_PODE_GERIR_PESQUISA"();
  v_e_lider := sigav."FC_TEM_PAPEL_ATIVO"('LEADER');

  v_scope := case
    when v_pode_gerenciar then 'INSTITUTIONAL'
    when v_e_lider then 'TEAM'
    else 'INDIVIDUAL'
  end;

  with
  app as (
    select sa.*, sv.title as version_title, sv.version_number, s.name as survey_name
    from sigav."TB_APLICACAO_PESQUISA" sa
    join sigav."TH_VERSAO_PESQUISA" sv on sv.id = sa.survey_version_id
    join sigav."TB_PESQUISA" s on s.id = sv.survey_id
    where sa.id = v_application_id
  ),
  scoped_participants as (
    select
      ap.id as participant_id,
      ap.person_id,
      ap.status as participant_status,
      ap.started_at,
      ap.completed_at,
      p.employee_number,
      p.full_name,
      p.institutional_email,
      p.job_title,
      p.cost_center,
      p.workplace,
      p.metadata,
      coalesce(p.metadata->>'directorate', p.metadata->>'diretoria', 'SEM INFORMAÇÃO') as directorate,
      coalesce(p.metadata->>'unit', p.metadata->>'unidade', p.cost_center, 'SEM INFORMAÇÃO') as unit_name,
      coalesce(p.metadata->>'coordination', p.metadata->>'coordenacao', 'SEM INFORMAÇÃO') as coordination
    from sigav."RL_APLICACAO_PESSOA" ap
    join sigav."TB_PESSOA" p on p.id = ap.person_id
    where ap.application_id = v_application_id
      and ap.status not in ('BLOCKED', 'EXCLUDED')
      and (
        v_pode_gerenciar
        or ap.person_id = v_person_id
        or (
          v_e_lider and exists (
            select 1
            from sigav."RT_LIDERANCA_CDDI" l
            where l.application_id = v_application_id
              and l.leader_person_id = v_person_id
              and l.subordinate_person_id = ap.person_id
              and l.status = 'ACTIVE'
              and l.valid_to is null
          )
        )
      )
  ),
  active_leaders as (
    select distinct on (l.subordinate_person_id)
      l.subordinate_person_id,
      leader.full_name as manager_name,
      leader.institutional_email as manager_email
    from sigav."RT_LIDERANCA_CDDI" l
    join sigav."TB_PESSOA" leader on leader.id = l.leader_person_id
    where l.application_id = v_application_id
      and l.status = 'ACTIVE'
      and l.valid_to is null
    order by l.subordinate_person_id, l.valid_from desc
  ),
  latest_submissions as (
    select distinct on (coalesce(s.subject_person_id, s.respondent_person_id), upper(s.submission_type))
      s.*,
      coalesce(s.subject_person_id, s.respondent_person_id) as subject_id,
      upper(s.submission_type) as normalized_type
    from sigav."TB_SUBMISSAO" s
    join scoped_participants sp on sp.person_id = coalesce(s.subject_person_id, s.respondent_person_id)
    where s.application_id = v_application_id
      and upper(s.status) not in ('INVALIDATED', 'CANCELLED')
    order by coalesce(s.subject_person_id, s.respondent_person_id), upper(s.submission_type),
      (s.submitted_at is not null) desc, s.submitted_at desc nulls last, s.updated_at desc, s.version desc
  ),
  participant_rows as (
    select
      sp.*,
      al.manager_name,
      al.manager_email,
      auto.id as auto_submission_id,
      auto.status as auto_status,
      auto.submitted_at as auto_submitted_at,
      auto.calculated_result as auto_score,
      leader.id as leader_submission_id,
      leader.status as leader_status,
      leader.submitted_at as leader_submitted_at,
      leader.calculated_result as leader_score,
      fr.final_score,
      fr.status as final_status,
      fr.calculated_at,
      case when upper(coalesce(auto.status, '')) in ('SUBMITTED', 'VALIDATED') then true else false end as auto_completed,
      case when upper(coalesce(leader.status, '')) in ('SUBMITTED', 'VALIDATED') then true else false end as leader_completed
    from scoped_participants sp
    left join active_leaders al on al.subordinate_person_id = sp.person_id
    left join latest_submissions auto on auto.subject_id = sp.person_id and auto.normalized_type in ('AUTO', 'AUTOAVALIACAO', 'SELF')
    left join latest_submissions leader on leader.subject_id = sp.person_id and leader.normalized_type in ('CHEFIA', 'LEADER', 'MANAGER')
    left join lateral (
      select r.*
      from sigav."TB_RESULTADO_FINAL_CDDI" r
      where r.application_id = v_application_id and r.subject_person_id = sp.person_id
        and upper(r.status) <> 'INVALIDATED'
      order by r.calculated_at desc, r.updated_at desc
      limit 1
    ) fr on true
  ),
  competencies as (
    select sec.id, sec.code, sec.title, sec.position
    from sigav."TB_SECAO_PESQUISA" sec
    join app on app.survey_version_id = sec.survey_version_id
    where sec.code ~ '^C[0-9]{2}$'
    order by sec.position
  ),
  competency_values as (
    select
      ls.subject_id as person_id,
      c.code as competency_code,
      c.title as competency_name,
      c.position,
      max(cr.result) filter (where ls.normalized_type in ('AUTO', 'AUTOAVALIACAO', 'SELF')) as auto_score,
      max(cr.result) filter (where ls.normalized_type in ('CHEFIA', 'LEADER', 'MANAGER')) as leader_score
    from latest_submissions ls
    join sigav."TB_RESULTADO_COMPET_CDDI" cr on cr.submission_id = ls.id
    join competencies c on c.id = cr.competency_section_id
    group by ls.subject_id, c.code, c.title, c.position
  ),
  event_rows as (
    select
      coalesce(s.subject_person_id, s.respondent_person_id) as person_id,
      upper(s.submission_type) as submission_type,
      s.status,
      s.submitted_at,
      s.version,
      s.metadata
    from sigav."TB_SUBMISSAO" s
    join scoped_participants sp on sp.person_id = coalesce(s.subject_person_id, s.respondent_person_id)
    where s.application_id = v_application_id
      and s.submitted_at is not null
      and upper(s.status) not in ('INVALIDATED', 'CANCELLED')
  )
  select jsonb_build_object(
    'status', 'OK',
    'scope', v_scope,
    'generatedAt', timezone('utc', now()),
    'weights', jsonb_build_object('auto', 0.40, 'leader', 0.60),
    'application', (
      select jsonb_build_object(
        'id', id,
        'code', code,
        'name', name,
        'surveyName', survey_name,
        'versionTitle', version_title,
        'versionNumber', version_number,
        'status', status,
        'opensAt', opens_at,
        'closesAt', closes_at
      ) from app
    ),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'personId', pr.person_id,
        'participantId', pr.participant_id,
        'employeeNumber', pr.employee_number,
        'fullName', pr.full_name,
        'institutionalEmail', pr.institutional_email,
        'jobTitle', pr.job_title,
        'directorate', pr.directorate,
        'unit', pr.unit_name,
        'coordination', pr.coordination,
        'workplace', pr.workplace,
        'managerName', pr.manager_name,
        'managerEmail', pr.manager_email,
        'participantStatus', pr.participant_status,
        'startedAt', pr.started_at,
        'completedAt', pr.completed_at,
        'autoStatus', pr.auto_status,
        'autoSubmittedAt', pr.auto_submitted_at,
        'autoScore', pr.auto_score,
        'leaderStatus', pr.leader_status,
        'leaderSubmittedAt', pr.leader_submitted_at,
        'leaderScore', pr.leader_score,
        'finalScore', pr.final_score,
        'finalStatus', pr.final_status,
        'calculatedAt', pr.calculated_at,
        'autoCompleted', pr.auto_completed,
        'leaderCompleted', pr.leader_completed
      ) order by pr.full_name) from participant_rows pr
    ), '[]'::jsonb),
    'competencies', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'code', code, 'name', title, 'position', position) order by position)
      from competencies
    ), '[]'::jsonb),
    'competencyScores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'personId', person_id,
        'competencyCode', competency_code,
        'competencyName', competency_name,
        'position', position,
        'autoScore', auto_score,
        'leaderScore', leader_score,
        'finalScore', case when auto_score is not null and leader_score is not null then round((auto_score * 0.40 + leader_score * 0.60)::numeric, 2) else null end
      ) order by person_id, position)
      from competency_values
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'personId', person_id,
        'submissionType', submission_type,
        'status', status,
        'submittedAt', submitted_at,
        'version', version,
        'metadata', metadata
      ) order by submitted_at)
      from event_rows
    ), '[]'::jsonb)
  ) into v_payload;

  return v_payload;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_CONTEXTO_CDDI"()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select case
    when sigav."FC_UID_SESSAO"() is null then jsonb_build_object('status', 'AUTH_REQUIRED')
    when sigav."FC_PESSOA_SESSAO"() is null then jsonb_build_object('status', 'UNLINKED')
    else (
      select jsonb_build_object(
        'status', 'OK',
        'person', jsonb_build_object(
          'id', p.id,
          'employeeNumber', p.employee_number,
          'fullName', p.full_name,
          'institutionalEmail', p.institutional_email,
          'jobTitle', p.job_title,
          'costCenter', p.cost_center,
          'workplace', p.workplace,
          'metadata', p.metadata
        ),
        'participant', jsonb_build_object(
          'id', ap.id,
          'status', ap.status,
          'accessProfile', ap.access_profile,
          'completedAt', ap.completed_at,
          'metadata', ap.metadata
        ),
        'application', jsonb_build_object(
          'id', sa.id,
          'code', sa.code,
          'name', sa.name,
          'status', sa.status,
          'opensAt', sa.opens_at,
          'closesAt', sa.closes_at
        ),
        'isLeader', sigav."FC_TEM_PAPEL_ATIVO"('LEADER')
      )
      from sigav."TB_PESSOA" p
      left join sigav."RL_APLICACAO_PESSOA" ap on ap.person_id = p.id
      left join sigav."TB_APLICACAO_PESQUISA" sa on sa.id = ap.application_id and sa.code = 'CDDI-2026'
      where p.id = sigav."FC_PESSOA_SESSAO"()
      order by ap.created_at desc nulls last
      limit 1
    )
  end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_IDENTIDADE_CDDI"(target_application_code text DEFAULT 'CDDI-2026'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid;
  v_application_id uuid;
  v_result jsonb;
begin
  v_person_id := sigav."FC_PESSOA_SESSAO"();
  if v_person_id is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;

  select id into v_application_id
  from sigav."TB_APLICACAO_PESQUISA"
  where code = btrim(target_application_code)
  limit 1;

  if v_application_id is null then
    raise exception 'Ciclo de pesquisa não encontrado.';
  end if;

  select jsonb_build_object(
    'person', jsonb_build_object(
      'id', p.id,
      'employeeNumber', p.employee_number,
      'fullName', p.full_name,
      'institutionalEmail', p.institutional_email,
      'jobTitle', p.job_title,
      'directorate', coalesce(p.metadata->>'directorate', p.metadata->>'diretoria'),
      'unit', coalesce(p.metadata->>'unit', p.metadata->>'unidade', p.cost_center),
      'coordination', coalesce(p.metadata->>'coordination', p.metadata->>'coordenacao'),
      'workplace', p.workplace,
      'metadata', p.metadata
    ),
    'leader', case when leader.id is null then null else jsonb_build_object(
      'personId', leader.id,
      'fullName', leader.full_name,
      'institutionalEmail', leader.institutional_email,
      'employeeNumber', leader.employee_number,
      'jobTitle', leader.job_title,
      'unit', coalesce(leader.metadata->>'unit', leader.metadata->>'unidade', leader.cost_center),
      'coordination', coalesce(leader.metadata->>'coordination', leader.metadata->>'coordenacao')
    ) end,
    'canChangeLeader', (
      app.status = 'OPEN' or sigav."FC_PODE_GERIR_PESQUISA"()
    )
  ) into v_result
  from sigav."TB_PESSOA" p
  cross join sigav."TB_APLICACAO_PESQUISA" app
  left join lateral (
    select lp.*
    from sigav."RT_LIDERANCA_CDDI" l
    join sigav."TB_PESSOA" lp on lp.id = l.leader_person_id
    where l.application_id = v_application_id
      and l.subordinate_person_id = p.id
      and l.status = 'ACTIVE'
      and l.valid_to is null
    order by l.valid_from desc
    limit 1
  ) leader on true
  where p.id = v_person_id and app.id = v_application_id;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_ESPACO_EQUIPE"(target_application_code text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare v_person_id uuid; v_application sigav."TB_APLICACAO_PESQUISA"%rowtype; v_members jsonb;
begin
  v_person_id := sigav."FC_PESSOA_SESSAO"();
  if v_person_id is null then raise exception 'Cadastro institucional não identificado.'; end if;
  if not (sigav."FC_TEM_PAPEL_ATIVO"('LEADER') or sigav."FC_PODE_GERIR_PESQUISA"()) then raise exception 'Somente lideranças autorizadas podem gerenciar equipes.'; end if;
  if nullif(btrim(target_application_code), '') is not null then
    select * into v_application from sigav."TB_APLICACAO_PESQUISA" where code = btrim(target_application_code) limit 1;
  else
    select sa.* into v_application from sigav."TB_APLICACAO_PESQUISA" sa
    where exists (select 1 from sigav."RL_APLICACAO_PESSOA" ap where ap.application_id=sa.id and ap.person_id=v_person_id)
       or exists (select 1 from sigav."RT_LIDERANCA_CDDI" l where l.application_id=sa.id and l.leader_person_id=v_person_id)
    order by coalesce(sa.closes_at,sa.opens_at,sa.created_at) desc limit 1;
  end if;
  if v_application.id is null then select * into v_application from sigav."TB_APLICACAO_PESQUISA" order by coalesce(closes_at,opens_at,created_at) desc limit 1; end if;
  if v_application.id is null then raise exception 'Nenhum ciclo de pesquisa foi encontrado.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('linkId',l.id,'personId',p.id,'fullName',p.full_name,'employeeNumber',p.employee_number,'institutionalEmail',p.institutional_email,'jobTitle',p.job_title,'unit',coalesce(p.metadata->>'unit',p.cost_center),'workplace',p.workplace,'status',l.status,'validFrom',l.valid_from,'submissionStatus',s.status,'submissionUpdatedAt',s.updated_at) order by p.full_name),'[]'::jsonb)
  into v_members
  from sigav."RT_LIDERANCA_CDDI" l join sigav."TB_PESSOA" p on p.id=l.subordinate_person_id
  left join lateral (select sub.status,sub.updated_at from sigav."TB_SUBMISSAO" sub where sub.application_id=l.application_id and sub.respondent_person_id=v_person_id and sub.subject_person_id=l.subordinate_person_id and sub.submission_type='CHEFIA' order by sub.updated_at desc limit 1) s on true
  where l.application_id=v_application.id and l.leader_person_id=v_person_id and l.status='ACTIVE' and l.valid_to is null;
  return jsonb_build_object('status','OK','application',jsonb_build_object('id',v_application.id,'code',v_application.code,'name',v_application.name,'status',v_application.status,'opensAt',v_application.opens_at,'closesAt',v_application.closes_at),'members',v_members,'total',jsonb_array_length(v_members));
end;$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SAUDE_PLATAFORMA"()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_issues jsonb := '[]'::jsonb;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then raise exception 'Acesso restrito à administração.'; end if;

  if exists (
    select 1 from sigav."TB_APLICACAO_PESQUISA" sa
    join sigav."TH_VERSAO_PESQUISA" sv on sv.id=sa.survey_version_id
    where sa.status in ('OPEN','SCHEDULED') and sv.status <> 'PUBLISHED'
  ) then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object('severity','BLOCKING','message','Existe ciclo ativo com versão não publicada.'));
  end if;

  if exists (
    select 1 from sigav."TB_APLICACAO_PESQUISA"
    where status in ('OPEN','SCHEDULED') and (opens_at is null or closes_at is null or closes_at <= opens_at)
  ) then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object('severity','BLOCKING','message','Existe ciclo ativo com período inválido.'));
  end if;

  if exists (
    select 1 from sigav."TB_APLICACAO_PESQUISA" sa
    where sa.status='OPEN'
      and not exists (select 1 from sigav."RL_APLICACAO_PESSOA" ap where ap.application_id=sa.id and ap.status not in ('BLOCKED','EXCLUDED'))
  ) then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object('severity','WARNING','message','Existe ciclo aberto sem participantes elegíveis.'));
  end if;

  return jsonb_build_object(
    'status',case when jsonb_array_length(v_issues)=0 then 'HEALTHY' else 'ATTENTION' end,
    'checkedAt',now(),
    'people',(select count(*) from sigav."TB_PESSOA" where active=true),
    'surveys',(select count(*) from sigav."TB_PESQUISA"),
    'applications',(select count(*) from sigav."TB_APLICACAO_PESQUISA"),
    'openApplications',(select count(*) from sigav."TB_APLICACAO_PESQUISA" where status='OPEN'),
    'scheduledApplications',(select count(*) from sigav."TB_APLICACAO_PESQUISA" where status='SCHEDULED'),
    'participants',(select count(*) from sigav."RL_APLICACAO_PESSOA" where status not in ('BLOCKED','EXCLUDED')),
    'submissions',(select count(*) from sigav."TB_SUBMISSAO"),
    'draftSubmissions',(select count(*) from sigav."TB_SUBMISSAO" where status='DRAFT'),
    'submittedSubmissions',(select count(*) from sigav."TB_SUBMISSAO" where status in ('SUBMITTED','VALIDATED')),
    'activeLeaders',(select count(distinct leader_person_id) from sigav."RT_LIDERANCA_CDDI" where status='ACTIVE' and valid_to is null),
    'issues',v_issues
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_FORM_PUBLICO"(target_application_code text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select sigav."FC_ABRIR_CICLOS_AGENDADOS"();

  select jsonb_build_object(
    'application', jsonb_build_object(
      'id', sa.id,
      'code', sa.code,
      'name', sa.name,
      'status', sa.status,
      'opensAt', sa.opens_at,
      'closesAt', sa.closes_at,
      'allowDrafts', sa.allow_drafts,
      'settings', sa.settings,
      'accessMode', sa.access_mode
    ),
    'survey', jsonb_build_object(
      'id', s.id,
      'code', s.code,
      'name', s.name,
      'description', s.description
    ),
    'version', jsonb_build_object(
      'id', sv.id,
      'number', sv.version_number,
      'title', sv.title,
      'description', sv.description,
      'settings', sv.settings
    ),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ss.id,
        'code', ss.code,
        'title', ss.title,
        'description', ss.description,
        'position', ss.position,
        'settings', ss.settings,
        'questions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', sq.id,
            'code', sq.code,
            'title', sq.title,
            'description', sq.description,
            'type', sq.question_type,
            'required', sq.required,
            'position', sq.position,
            'validation', sq.validation,
            'displayLogic', sq.display_logic,
            'scoring', sq.scoring,
            'settings', sq.settings,
            'options', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', qo.id,
                'code', qo.code,
                'label', qo.label,
                'value', qo.value,
                'score', qo.score,
                'position', qo.position
              ) order by qo.position)
              from sigav."TB_OPCAO_PERGUNTA" qo
              where qo.question_id = sq.id and qo.active = true
            ), '[]'::jsonb)
          ) order by sq.position)
          from sigav."TB_PERGUNTA_PESQUISA" sq
          where sq.section_id = ss.id
        ), '[]'::jsonb)
      ) order by ss.position)
      from sigav."TB_SECAO_PESQUISA" ss
      where ss.survey_version_id = sv.id
        and ss.parent_section_id is null
    ), '[]'::jsonb)
  )
  from sigav."TB_APLICACAO_PESQUISA" sa
  join sigav."TH_VERSAO_PESQUISA" sv on sv.id = sa.survey_version_id
  join sigav."TB_PESQUISA" s on s.id = sv.survey_id
  where sa.code = btrim(target_application_code)
    and sv.status in ('PUBLISHED', 'RETIRED')
    and sa.status in ('SCHEDULED', 'OPEN', 'CLOSED')
    and (sa.anonymous or sigav."FC_PODE_ACESSAR_CICLO"(sa.id))
  limit 1;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_CONSTRUTOR"(target_survey_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare v_survey sigav."TB_PESQUISA"%rowtype; v_version sigav."TH_VERSAO_PESQUISA"%rowtype; v_application sigav."TB_APLICACAO_PESQUISA"%rowtype; v_sections jsonb;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then raise exception 'Acesso restrito à Equipe Técnica.'; end if;
  select * into v_survey from sigav."TB_PESQUISA" where id=target_survey_id;
  if v_survey.id is null then raise exception 'Pesquisa não encontrada.'; end if;
  select * into v_version from sigav."TH_VERSAO_PESQUISA" where survey_id=target_survey_id order by version_number desc limit 1;
  select * into v_application from sigav."TB_APLICACAO_PESQUISA" where survey_version_id=v_version.id order by created_at desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id',sec.id,'code',sec.code,'title',sec.title,'description',sec.description,'position',sec.position,'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q.id,'code',q.code,'title',q.title,'description',q.description,'questionType',q.question_type,'required',q.required,'position',q.position,'options',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'label',o.label,'value',o.value,'score',o.score,'position',o.position) order by o.position) from sigav."TB_OPCAO_PERGUNTA" o where o.question_id=q.id),'[]'::jsonb)) order by q.position) from sigav."TB_PERGUNTA_PESQUISA" q where q.section_id=sec.id),'[]'::jsonb)) order by sec.position),'[]'::jsonb)
  into v_sections from sigav."TB_SECAO_PESQUISA" sec where sec.survey_version_id=v_version.id;
  return jsonb_build_object('status','OK','survey',jsonb_build_object('id',v_survey.id,'code',v_survey.code,'name',v_survey.name,'description',v_survey.description,'status',v_survey.status),'version',jsonb_build_object('id',v_version.id,'number',v_version.version_number,'status',v_version.status),'application',jsonb_build_object('id',v_application.id,'code',v_application.code,'name',v_application.name,'status',v_application.status,'opensAt',v_application.opens_at,'closesAt',v_application.closes_at),'sections',v_sections);
end;$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_PAINEL_PESQ"(target_application_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_application_id uuid;
  v_payload jsonb;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à Equipe Técnica.';
  end if;

  select id into v_application_id
  from sigav."TB_APLICACAO_PESQUISA"
  where code = btrim(target_application_code)
  limit 1;

  if v_application_id is null then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  with app as (
    select sa.*, sv.title version_title, sv.description version_description,
      sv.version_number, s.code survey_code, s.name survey_name,
      s.description survey_description
    from sigav."TB_APLICACAO_PESQUISA" sa
    join sigav."TH_VERSAO_PESQUISA" sv on sv.id = sa.survey_version_id
    join sigav."TB_PESQUISA" s on s.id = sv.survey_id
    where sa.id = v_application_id
  ), latest_submissions as (
    select distinct on (s.participant_id)
      s.id, s.participant_id, s.status, s.updated_at
    from sigav."TB_SUBMISSAO" s
    where s.application_id = v_application_id
      and s.participant_id is not null
    order by s.participant_id, s.updated_at desc
  ), participant_summary as (
    select
      count(*) total,
      count(*) filter (where sub.status = 'DRAFT') drafts,
      count(*) filter (where sub.status in ('SUBMITTED', 'VALIDATED')) submitted,
      count(*) filter (where sub.id is null) not_started
    from sigav."RL_APLICACAO_PESSOA" ap
    left join latest_submissions sub on sub.participant_id = ap.id
    where ap.application_id = v_application_id
      and ap.status not in ('REMOVED', 'INELIGIBLE', 'EXCLUDED')
  ), question_rows as (
    select q.id, q.code, q.title, q.description, q.question_type, q.position,
      sec.id section_id, sec.title section_title, sec.position section_position
    from sigav."TB_PERGUNTA_PESQUISA" q
    join sigav."TB_SECAO_PESQUISA" sec on sec.id = q.section_id
    join app on app.survey_version_id = q.survey_version_id
  ), submitted_answers as (
    select a.*, s.submitted_at
    from sigav."TB_RESPOSTA" a
    join sigav."TB_SUBMISSAO" s on s.id = a.submission_id
    where s.application_id = v_application_id
      and s.status in ('SUBMITTED', 'VALIDATED')
  ), option_counts as (
    select a.question_id, ao.option_id, count(*) answer_count
    from sigav."RL_RESPOSTA_OPCAO" ao
    join submitted_answers a on a.id = ao.answer_id
    group by a.question_id, ao.option_id
  )
  select jsonb_build_object(
    'status', 'OK',
    'generatedAt', timezone('utc', now()),
    'application', (
      select jsonb_build_object(
        'id', id,
        'code', code,
        'name', name,
        'status', status,
        'opensAt', opens_at,
        'closesAt', closes_at,
        'surveyCode', survey_code,
        'surveyName', survey_name,
        'surveyDescription', coalesce(survey_description, version_description),
        'versionTitle', version_title,
        'versionNumber', version_number
      ) from app
    ),
    'summary', (
      select jsonb_build_object(
        'totalParticipants', total,
        'drafts', drafts,
        'submitted', submitted,
        'notStarted', not_started,
        'completionRate', case when total = 0 then 0 else round(submitted::numeric * 100 / total, 1) end
      ) from participant_summary
    ),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', qr.id,
        'code', qr.code,
        'title', qr.title,
        'description', qr.description,
        'type', qr.question_type,
        'position', qr.position,
        'sectionId', qr.section_id,
        'sectionTitle', qr.section_title,
        'sectionPosition', qr.section_position,
        'responseCount', (select count(*) from submitted_answers a where a.question_id = qr.id),
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', o.id,
            'label', o.label,
            'value', o.value,
            'count', coalesce(oc.answer_count, 0)
          ) order by o.position)
          from sigav."TB_OPCAO_PERGUNTA" o
          left join option_counts oc on oc.question_id = qr.id and oc.option_id = o.id
          where o.question_id = qr.id and o.active
        ), '[]'::jsonb),
        'textResponses', coalesce((
          select jsonb_agg(jsonb_build_object(
            'text', left(sample.answer_text, 1000),
            'submittedAt', sample.submitted_at
          ) order by sample.submitted_at desc)
          from (
            select a.answer_text, a.submitted_at
            from submitted_answers a
            where a.question_id = qr.id
              and nullif(btrim(a.answer_text), '') is not null
            order by a.submitted_at desc
            limit 100
          ) sample
        ), '[]'::jsonb)
      ) order by qr.section_position, qr.position)
      from question_rows qr
    ), '[]'::jsonb)
  ) into v_payload;

  return v_payload;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_OPERACOES_PESQUISA"(target_survey_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_survey sigav."TB_PESQUISA"%rowtype;
  v_version sigav."TH_VERSAO_PESQUISA"%rowtype;
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_sections integer := 0;
  v_questions integer := 0;
  v_required integer := 0;
  v_participants integer := 0;
  v_drafts integer := 0;
  v_submitted integer := 0;
  v_integrity jsonb;
  v_issues jsonb := '[]'::jsonb;
  v_ready_to_publish boolean := false;
  v_ready_to_open boolean := false;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração.';
  end if;

  perform sigav."FC_ABRIR_CICLOS_AGENDADOS"();

  select *
  into v_survey
  from sigav."TB_PESQUISA"
  where id = target_survey_id;

  if v_survey.id is null then
    raise exception 'Pesquisa não encontrada.';
  end if;

  select *
  into v_version
  from sigav."TH_VERSAO_PESQUISA"
  where survey_id = target_survey_id
  order by version_number desc
  limit 1;

  if v_version.id is null then
    raise exception 'Versão da pesquisa não encontrada.';
  end if;

  select *
  into v_application
  from sigav."TB_APLICACAO_PESQUISA"
  where survey_version_id = v_version.id
  order by created_at desc
  limit 1;

  v_integrity := sigav."FC_VALIDAR_INTEGRIDADE_VERSAO"(v_version.id);
  v_issues := coalesce(v_integrity -> 'issues', '[]'::jsonb);

  select count(*)::integer
  into v_sections
  from sigav."TB_SECAO_PESQUISA"
  where survey_version_id = v_version.id;

  select
    count(*)::integer,
    count(*) filter (where required)::integer
  into v_questions, v_required
  from sigav."TB_PERGUNTA_PESQUISA"
  where survey_version_id = v_version.id;

  if v_application.id is null then
    v_issues := v_issues || jsonb_build_array(
      jsonb_build_object(
        'id', 'NO_APPLICATION',
        'code', 'NO_APPLICATION',
        'severity', 'BLOCKING',
        'category', 'CYCLE',
        'entityType', 'VERSION',
        'entityId', v_version.id,
        'message', 'Configure um ciclo de aplicação.',
        'action', 'Crie o ciclo antes de publicar a versão.'
      )
    );
  else
    select count(*)::integer
    into v_participants
    from sigav."RL_APLICACAO_PESSOA"
    where application_id = v_application.id
      and status not in ('BLOCKED', 'EXCLUDED');

    select
      count(*) filter (where status = 'DRAFT')::integer,
      count(*) filter (where status in ('SUBMITTED', 'VALIDATED'))::integer
    into v_drafts, v_submitted
    from sigav."TB_SUBMISSAO"
    where application_id = v_application.id;

    if v_application.opens_at is null or v_application.closes_at is null then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'NO_PERIOD',
          'code', 'NO_PERIOD',
          'severity', 'BLOCKING',
          'category', 'PERIOD',
          'entityType', 'APPLICATION',
          'entityId', v_application.id,
          'message', 'Defina abertura e encerramento do ciclo.',
          'action', 'Preencha as duas datas e salve o período.'
        )
      );
    elsif v_application.closes_at <= v_application.opens_at then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'INVALID_PERIOD',
          'code', 'INVALID_PERIOD',
          'severity', 'BLOCKING',
          'category', 'PERIOD',
          'entityType', 'APPLICATION',
          'entityId', v_application.id,
          'message', 'O período do ciclo é inválido.',
          'action', 'Defina o encerramento depois da abertura.'
        )
      );
    elsif v_application.status in ('DRAFT', 'SCHEDULED')
      and v_application.closes_at <= now() then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'PERIOD_EXPIRED',
          'code', 'PERIOD_EXPIRED',
          'severity', 'BLOCKING',
          'category', 'PERIOD',
          'entityType', 'APPLICATION',
          'entityId', v_application.id,
          'message', 'O encerramento informado já passou.',
          'action', 'Atualize o período antes de abrir o ciclo.'
        )
      );
    elsif v_application.status = 'OPEN'
      and v_application.closes_at <= now() then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'OPEN_PERIOD_EXPIRED',
          'code', 'OPEN_PERIOD_EXPIRED',
          'severity', 'WARNING',
          'category', 'PERIOD',
          'entityType', 'APPLICATION',
          'entityId', v_application.id,
          'message', 'O prazo terminou, mas o ciclo ainda está aberto.',
          'action', 'Encerre o ciclo para consolidar o período.'
        )
      );
    end if;

    if v_application.status = 'CLOSED' then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'CYCLE_CLOSED',
          'code', 'CYCLE_CLOSED',
          'severity', 'WARNING',
          'category', 'CYCLE',
          'entityType', 'APPLICATION',
          'entityId', v_application.id,
          'message', 'Este ciclo está encerrado.',
          'action', 'Informe um novo período se precisar reabri-lo.'
        )
      );
    end if;

    if v_participants = 0 and not v_application.anonymous then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'NO_PARTICIPANTS',
          'code', 'NO_PARTICIPANTS',
          'severity', 'WARNING',
          'category', 'AUDIENCE',
          'entityType', 'APPLICATION',
          'entityId', v_application.id,
          'message', 'Nenhum participante foi vinculado ao ciclo.',
          'action', 'Revise o público antes da abertura.'
        )
      );
    end if;
  end if;

  v_ready_to_publish :=
    (v_integrity ->> 'valid')::boolean
    and v_application.id is not null
    and v_version.status = 'DRAFT';

  v_ready_to_open :=
    (v_integrity ->> 'valid')::boolean
    and v_version.status = 'PUBLISHED'
    and v_application.id is not null
    and v_application.opens_at is not null
    and v_application.closes_at is not null
    and v_application.closes_at > v_application.opens_at
    and v_application.closes_at > now();

  return jsonb_build_object(
    'status', 'OK',
    'survey', jsonb_build_object(
      'id', v_survey.id,
      'code', v_survey.code,
      'name', v_survey.name,
      'status', v_survey.status,
      'description', v_survey.description
    ),
    'version', jsonb_build_object(
      'id', v_version.id,
      'number', v_version.version_number,
      'status', v_version.status
    ),
    'application', case
      when v_application.id is null then null
      else jsonb_build_object(
        'id', v_application.id,
        'code', v_application.code,
        'name', v_application.name,
        'status', v_application.status,
        'opensAt', v_application.opens_at,
        'closesAt', v_application.closes_at,
        'allowDrafts', v_application.allow_drafts,
        'accessMode', v_application.access_mode,
        'emailNotifications', v_application.st_notificacao_email,
        'anonymous', v_application.anonymous
      )
    end,
    'metrics', jsonb_build_object(
      'sections', v_sections,
      'questions', v_questions,
      'requiredQuestions', v_required,
      'participants', v_participants,
      'draftSubmissions', v_drafts,
      'submittedSubmissions', v_submitted
    ),
    'integrity', v_integrity,
    'issues', v_issues,
    'readyToPublish', v_ready_to_publish,
    'readyToOpen', v_ready_to_open
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SINCR_RESP_LIDERANCA"()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if new.status = 'ACTIVE'
     and new.valid_from <= now()
     and (new.valid_to is null or new.valid_to > now()) then
    perform sigav."FC_SINCR_RESP_TECNICA_CDDI"(
      new.application_id,
      new.subordinate_person_id,
      new.leader_person_id
    );
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_TEM_PAPEL_ATIVO"(required_role text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select case upper(btrim(coalesce(required_role, '')))
    when 'ADMINISTRATOR' then sigav."FC_TEM_MODULO"('ADMIN_ACCESS')
    when 'SURVEY_MANAGER' then sigav."FC_TEM_MODULO"('ADMIN_SURVEYS')
    when 'TECHNICAL_TEAM' then sigav."FC_TEM_MODULO"('ADMIN_SURVEYS')
    when 'MANAGER' then sigav."FC_TEM_MODULO"('TEAM')
                          and sigav."FC_TEM_MODULO"('DASHBOARDS')
    when 'LEADER' then sigav."FC_TEM_MODULO"('TEAM')
    when 'AUDITOR' then sigav."FC_TEM_MODULO"('DASHBOARDS')
    when 'RESPONDENT' then sigav."FC_TEM_MODULO"('SURVEYS')
    when 'AUTHENTICATED' then sigav."FC_PESSOA_SESSAO"() is not null
    else false
  end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_TEM_MODULO"(target_module_code text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select coalesce(
    upper(btrim(coalesce(target_module_code, ''))) = any(
      sigav."FC_MODULOS_EFETIVOS"(sigav."FC_PESSOA_SESSAO"())
    ),
    false
  );
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_EMAIL_INSTITUC_PERMITIDO"(target_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
 select exists(select 1 from sigav."TB_DOMINIO_INSTITUCIONAL" d where d.active and split_part(lower(btrim(coalesce(target_email,''))),'@',2)=d.domain)
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_E_ADMINISTRADOR"()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select sigav."FC_TEM_MODULO"('ADMIN_ACCESS');
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_PARTIC_CICLO"(target_application_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Seu perfil não possui permissão para consultar participantes.';
  end if;

  if not exists(select 1 from sigav."TB_APLICACAO_PESQUISA" where id = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', ap.id,
      'personId', p.id,
      'employeeNumber', p.employee_number,
      'fullName', p.full_name,
      'institutionalEmail', p.institutional_email,
      'jobTitle', p.job_title,
      'costCenter', p.cost_center,
      'workplace', p.workplace,
      'avatarUrl', coalesce(p.metadata->>'avatar_url', p.metadata->>'picture', p.metadata->>'photo_url'),
      'participantRole', ap.participant_role,
      'accessProfile', ap.access_profile,
      'status', ap.status,
      'invitedAt', ap.invited_at,
      'startedAt', ap.started_at,
      'completedAt', ap.completed_at,
      'createdAt', ap.created_at,
      'hasSubmission', exists(
        select 1 from sigav."TB_SUBMISSAO" s where s.participant_id = ap.id
      )
    ) order by p.full_name), '[]'::jsonb)
    from sigav."RL_APLICACAO_PESSOA" ap
    join sigav."TB_PESSOA" p on p.id = ap.person_id
    where ap.application_id = target_application_id
      and ap.participant_role = 'RESPONDENT'
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_CICLOS_PARTIC"()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Seu perfil não possui permissão para gerenciar participantes.';
  end if;

  return (
    select coalesce(jsonb_agg(item order by item->>'code'), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'id', sa.id,
        'code', sa.code,
        'name', sa.name,
        'status', sa.status,
        'accessMode', sa.access_mode,
        'opensAt', sa.opens_at,
        'closesAt', sa.closes_at,
        'participantCount', count(ap.id),
        'completedCount', count(ap.id) filter (where ap.status = 'COMPLETED')
      ) as item
      from sigav."TB_APLICACAO_PESQUISA" sa
      -- O join existe para chegar em `TB_PESQUISA.dt_arquivamento`. Sem ele a
      -- função não tinha como saber que a avaliação foi arquivada.
      join sigav."TH_VERSAO_PESQUISA" sv on sv.id = sa.survey_version_id
      join sigav."TB_PESQUISA" s on s.id = sv.survey_id
      left join sigav."RL_APLICACAO_PESSOA" ap
        on ap.application_id = sa.id
       and ap.participant_role = 'RESPONDENT'
       and ap.status <> 'EXCLUDED'
      where s.dt_arquivamento is null
        and sa.status <> 'CANCELLED'
      -- Agrupar pela chave primária basta: as demais colunas de `sa` dependem
      -- funcionalmente dela, e os dois joins são 1:1 por chave estrangeira.
      group by sa.id
    ) q
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_PESQUISAS_GERIDAS"()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare v_result jsonb;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  perform sigav."FC_EXPIRAR_PESQUISAS_ARQ"();

  select coalesce(jsonb_agg(jsonb_build_object(
    'surveyId', s.id,
    'code', s.code,
    'name', s.name,
    'description', s.description,
    'status', s.status,
    'archivedAt', s.dt_arquivamento,
    'versionId', sv.id,
    'versionNumber', sv.version_number,
    'versionStatus', sv.status,
    'applicationId', sa.id,
    'applicationCode', sa.code,
    'applicationName', sa.name,
    'applicationStatus', sa.status,
    'opensAt', sa.opens_at,
    'closesAt', sa.closes_at, 'anonymous', sa.anonymous,
    'sections', (select count(*) from sigav."TB_SECAO_PESQUISA" sec where sec.survey_version_id = sv.id),
    'questions', (select count(*) from sigav."TB_PERGUNTA_PESQUISA" q where q.survey_version_id = sv.id),
    'updatedAt', greatest(s.updated_at, sv.updated_at, coalesce(sa.updated_at, s.updated_at))
  ) order by greatest(s.updated_at, sv.updated_at, coalesce(sa.updated_at, s.updated_at)) desc), '[]'::jsonb)
  into v_result
  from sigav."TB_PESQUISA" s
  join lateral (
    select * from sigav."TH_VERSAO_PESQUISA" x where x.survey_id = s.id order by x.version_number desc limit 1
  ) sv on true
  left join lateral (
    select * from sigav."TB_APLICACAO_PESQUISA" a where a.survey_version_id = sv.id order by a.created_at desc limit 1
  ) sa on true
  where s.st_modelo = false
    and s.dt_arquivamento is null;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_CATALOGO_PESQUISA"()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid := sigav."FC_PESSOA_SESSAO"();
  v_is_admin boolean := sigav."FC_PODE_GERIR_PESQUISA"();
  v_result jsonb;
begin
  if v_person_id is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;

  perform sigav."FC_ABRIR_CICLOS_AGENDADOS"();

  select coalesce(jsonb_agg(jsonb_build_object(
    'surveyId', s.id,
    'surveyCode', s.code,
    'surveyName', s.name,
    'description', s.description,
    'applicationId', sa.id,
    'applicationCode', sa.code,
    'applicationName', sa.name,
    'applicationStatus', sa.status,
    'opensAt', sa.opens_at,
    'closesAt', sa.closes_at,
    'anonymous', sa.anonymous,
    'allowDrafts', sa.allow_drafts,
    'accessMode', sa.access_mode,
    'participantStatus', ap.status,
    'accessProfile', ap.access_profile,
    'completedAt', ap.completed_at,
    'submissionId', sub.id,
    'submissionStatus', sub.status,
    'submissionUpdatedAt', sub.updated_at,
    'sections', (select count(*) from sigav."TB_SECAO_PESQUISA" sec where sec.survey_version_id = sa.survey_version_id),
    'questions', (select count(*) from sigav."TB_PERGUNTA_PESQUISA" q where q.survey_version_id = sa.survey_version_id),
    'canRespond', (sigav."FC_CICLO_ACEITA_RESPOSTA"(sa.id) and sigav."FC_PODE_ACESSAR_CICLO"(sa.id)),
    'canManage', v_is_admin
  ) order by
    case sa.status when 'OPEN' then 0 when 'SCHEDULED' then 1 when 'CLOSED' then 2 else 3 end,
    coalesce(sa.closes_at, sa.opens_at, sa.created_at) desc), '[]'::jsonb)
  into v_result
  from sigav."TB_APLICACAO_PESQUISA" sa
  join sigav."TH_VERSAO_PESQUISA" sv on sv.id = sa.survey_version_id
  join sigav."TB_PESQUISA" s on s.id = sv.survey_id
  left join sigav."RL_APLICACAO_PESSOA" ap
    on ap.application_id = sa.id
   and ap.person_id = v_person_id
   and ap.status not in ('BLOCKED', 'EXCLUDED')
  left join lateral (
    select x.id, x.status, x.updated_at
    from sigav."TB_SUBMISSAO" x
    where x.application_id = sa.id
      and x.respondent_person_id = v_person_id
      and x.submission_type in ('RESPONSE', 'AUTO')
    order by x.version desc, x.created_at desc
    limit 1
  ) sub on true
  where sigav."FC_PODE_ACESSAR_CICLO"(sa.id)
    and sa.status in ('SCHEDULED', 'OPEN', 'CLOSED')
    and (v_is_admin or sv.status in ('PUBLISHED', 'RETIRED'));

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_VINCULOS_LIDERANCA"(target_application_id uuid, target_search text DEFAULT NULL::text, target_limit integer DEFAULT 100)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_search text := lower(btrim(coalesce(target_search, '')));
  v_limit integer := least(greatest(coalesce(target_limit, 100), 1), 250);
begin
  if not sigav."FC_TEM_MODULO"('ADMIN_TEAMS') then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;

  if not exists (
    select 1
    from sigav."TB_APLICACAO_PESQUISA" application
    join sigav."TH_VERSAO_PESQUISA" version on version.id = application.survey_version_id
    join sigav."TB_PESQUISA" survey on survey.id = version.survey_id
    where application.id = target_application_id
      and survey.code = 'CDDI'
      and survey.dt_arquivamento is null
      and application.status <> 'CANCELLED'
  ) then
    raise exception 'Ciclo CDDI não localizado ou indisponível.';
  end if;

  return (
    with filtered as materialized (
      select
        link.id as link_id,
        link.application_id,
        link.leader_person_id,
        leader.full_name as leader_name,
        leader.employee_number as leader_employee_number,
        link.subordinate_person_id,
        subordinate.full_name as subordinate_name,
        subordinate.employee_number as subordinate_employee_number,
        link.status,
        link.valid_from,
        link.valid_to,
        link.origin,
        (link.status = 'ACTIVE' and link.valid_to is null) as is_active
      from sigav."RT_LIDERANCA_CDDI" link
      join sigav."TB_PESSOA" leader on leader.id = link.leader_person_id
      join sigav."TB_PESSOA" subordinate on subordinate.id = link.subordinate_person_id
      where link.application_id = target_application_id
        and (
          v_search = ''
          or lower(leader.full_name) like '%' || v_search || '%'
          or lower(leader.employee_number) like '%' || v_search || '%'
          or lower(subordinate.full_name) like '%' || v_search || '%'
          or lower(subordinate.employee_number) like '%' || v_search || '%'
        )
    ),
    page as (
      select *
      from filtered
      order by is_active desc, subordinate_name, valid_from desc
      limit v_limit
    )
    select jsonb_build_object(
      'links',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'linkId', item.link_id,
            'applicationId', item.application_id,
            'leaderPersonId', item.leader_person_id,
            'leaderName', item.leader_name,
            'leaderEmployeeNumber', item.leader_employee_number,
            'subordinatePersonId', item.subordinate_person_id,
            'subordinateName', item.subordinate_name,
            'subordinateEmployeeNumber', item.subordinate_employee_number,
            'status', item.status,
            'validFrom', item.valid_from,
            'validTo', item.valid_to,
            'origin', item.origin
          )
          order by item.is_active desc, item.subordinate_name, item.valid_from desc
        )
        from page item
      ), '[]'::jsonb),
      'totalActive',
      (
        select count(*)
        from sigav."RT_LIDERANCA_CDDI" active_link
        where active_link.application_id = target_application_id
          and active_link.status = 'ACTIVE'
          and active_link.valid_to is null
      ),
      'totalMatches', (select count(*) from filtered),
      'limit', v_limit
    )
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_GERIR_CICLO_PESQUISA"(target_survey_id uuid, target_action text, target_opens_at timestamp with time zone DEFAULT NULL::timestamp with time zone, target_closes_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor uuid := sigav."FC_PESSOA_SESSAO"();
  v_action text := upper(btrim(coalesce(target_action, '')));
  v_survey sigav."TB_PESQUISA"%rowtype;
  v_version sigav."TH_VERSAO_PESQUISA"%rowtype;
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_sections integer;
  v_questions integer;
  v_before jsonb;
  v_after jsonb;
  v_next_status text;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração.';
  end if;

  select * into v_survey
  from sigav."TB_PESQUISA"
  where id = target_survey_id
  for update;
  if v_survey.id is null then raise exception 'Pesquisa não encontrada.'; end if;

  select * into v_version
  from sigav."TH_VERSAO_PESQUISA"
  where survey_id = target_survey_id
  order by version_number desc
  limit 1
  for update;
  if v_version.id is null then raise exception 'Versão da pesquisa não encontrada.'; end if;

  select * into v_application
  from sigav."TB_APLICACAO_PESQUISA"
  where survey_version_id = v_version.id
  order by created_at desc
  limit 1
  for update;
  if v_application.id is null then raise exception 'Ciclo de aplicação não encontrado.'; end if;

  select count(*)::integer into v_sections
  from sigav."TB_SECAO_PESQUISA"
  where survey_version_id = v_version.id;

  select count(*)::integer into v_questions
  from sigav."TB_PERGUNTA_PESQUISA"
  where survey_version_id = v_version.id;

  v_before := jsonb_build_object(
    'surveyStatus', v_survey.status,
    'versionStatus', v_version.status,
    'applicationStatus', v_application.status,
    'opensAt', v_application.opens_at,
    'closesAt', v_application.closes_at,
    'archivedAt', v_survey.dt_arquivamento
  );

  if v_action = 'UPDATE_PERIOD' then
    if target_opens_at is null or target_closes_at is null then
      raise exception 'Informe abertura e encerramento.';
    end if;
    if target_opens_at < now() - interval '1 minute' then
      raise exception 'A abertura não pode ser anterior à data e hora atuais.';
    end if;
    if target_closes_at <= target_opens_at then
      raise exception 'O encerramento deve ocorrer após a abertura.';
    end if;
    if v_application.status not in ('DRAFT', 'SCHEDULED') then
      raise exception 'O período só pode ser alterado em ciclos em rascunho ou agendados.';
    end if;

    update sigav."TB_APLICACAO_PESQUISA"
    set opens_at = target_opens_at,
        closes_at = target_closes_at,
        updated_at = now()
    where id = v_application.id;

  elsif v_action = 'PUBLISH' then
    if v_sections = 0 or v_questions = 0 then
      raise exception 'Adicione seções e perguntas antes de publicar.';
    end if;

    update sigav."TH_VERSAO_PESQUISA"
    set status = 'PUBLISHED',
        published_at = coalesce(published_at, now()),
        updated_at = now()
    where id = v_version.id;

    update sigav."TB_PESQUISA"
    set status = 'ACTIVE', updated_at = now()
    where id = v_survey.id;

  elsif v_action = 'SCHEDULE' then
    if v_version.status <> 'PUBLISHED' then
      raise exception 'Publique a versão antes de agendar.';
    end if;
    if v_application.status not in ('DRAFT', 'SCHEDULED') then
      raise exception 'Somente ciclos em rascunho ou agendados podem ser agendados.';
    end if;

    -- Período recebido junto: grava antes de agendar, na mesma transação e sob
    -- as mesmas regras de UPDATE_PERIOD. Recebido pela metade é erro — gravar
    -- só uma das pontas deixaria o ciclo num período incoerente.
    if target_opens_at is not null or target_closes_at is not null then
      if target_opens_at is null or target_closes_at is null then
        raise exception 'Informe abertura e encerramento.';
      end if;
      if target_opens_at < now() - interval '1 minute' then
        raise exception 'A abertura não pode ser anterior à data e hora atuais.';
      end if;
      if target_closes_at <= target_opens_at then
        raise exception 'O encerramento deve ocorrer após a abertura.';
      end if;

      update sigav."TB_APLICACAO_PESQUISA"
      set opens_at = target_opens_at,
          closes_at = target_closes_at,
          updated_at = now()
      where id = v_application.id;

      -- As validações seguintes olham o período efetivo, não o que estava
      -- gravado quando a função começou.
      select * into v_application
      from sigav."TB_APLICACAO_PESQUISA"
      where id = v_application.id;
    end if;

    if v_application.opens_at is null
       or v_application.closes_at is null
       or v_application.closes_at <= v_application.opens_at then
      raise exception 'Defina um período válido antes de agendar.';
    end if;
    if v_application.closes_at <= now() then
      raise exception 'O período deste ciclo já venceu. Atualize a abertura e o encerramento antes de agendar.';
    end if;

    update sigav."TB_APLICACAO_PESQUISA"
    set status = 'SCHEDULED', updated_at = now()
    where id = v_application.id;

  elsif v_action = 'OPEN' then
    if v_version.status <> 'PUBLISHED' or v_sections = 0 or v_questions = 0 then
      raise exception 'O instrumento não está pronto para abertura.';
    end if;
    if v_application.status not in ('DRAFT', 'SCHEDULED') then
      raise exception 'Somente ciclos em rascunho ou agendados podem ser abertos.';
    end if;
    if v_application.closes_at is null or v_application.closes_at <= now() then
      raise exception 'O encerramento informado já passou.';
    end if;

    update sigav."TB_APLICACAO_PESQUISA"
    set status = 'OPEN',
        opens_at = least(coalesce(opens_at, now()), now()),
        updated_at = now()
    where id = v_application.id;

  elsif v_action = 'REOPEN' then
    if v_application.status <> 'CLOSED' then
      raise exception 'Somente ciclos encerrados podem ser reabertos.';
    end if;
    if target_opens_at is null or target_closes_at is null then
      raise exception 'Informe o novo período para reabrir o ciclo.';
    end if;
    if target_closes_at <= greatest(target_opens_at, now()) then
      raise exception 'O novo encerramento deve estar no futuro e após a abertura.';
    end if;
    if v_version.status <> 'PUBLISHED' then
      raise exception 'A versão precisa estar publicada para reabrir o ciclo.';
    end if;

    v_next_status := case
      when target_opens_at > now() then 'SCHEDULED'
      else 'OPEN'
    end;

    update sigav."TB_APLICACAO_PESQUISA"
    set status = v_next_status,
        opens_at = target_opens_at,
        closes_at = target_closes_at,
        updated_at = now()
    where id = v_application.id;

  elsif v_action = 'CLOSE' then
    if v_application.status <> 'OPEN' then
      raise exception 'Somente ciclos abertos podem ser encerrados. Para ciclos agendados, utilize Cancelar.';
    end if;

    update sigav."TB_APLICACAO_PESQUISA"
    set status = 'CLOSED',
        closes_at = least(coalesce(closes_at, now()), now()),
        updated_at = now()
    where id = v_application.id;

  elsif v_action = 'CANCEL' then
    if v_application.status not in ('DRAFT', 'SCHEDULED', 'OPEN') then
      raise exception 'Somente ciclos em rascunho, agendados ou abertos podem ser cancelados.';
    end if;

    update sigav."TB_APLICACAO_PESQUISA"
    set status = 'CANCELLED', updated_at = now()
    where id = v_application.id;

    -- Finalizar arquiva na mesma operação: some do catálogo padrão e entra na
    -- janela de 30 dias que antecede a exclusão automática.
    update sigav."TB_PESQUISA"
    set dt_arquivamento = now(), updated_at = now()
    where id = v_survey.id;

  elsif v_action = 'ARCHIVE' then
    if v_survey.dt_arquivamento is not null then
      raise exception 'Esta avaliação já está arquivada.';
    end if;
    if v_application.status in ('SCHEDULED', 'OPEN') then
      raise exception 'Interrompa o ciclo antes de arquivar — use Pausar ou Finalizar.';
    end if;

    update sigav."TB_PESQUISA"
    set dt_arquivamento = now(), updated_at = now()
    where id = v_survey.id;

  elsif v_action = 'UNARCHIVE' then
    if v_survey.dt_arquivamento is null then
      raise exception 'Esta avaliação não está arquivada.';
    end if;

    update sigav."TB_PESQUISA"
    set dt_arquivamento = null, updated_at = now()
    where id = v_survey.id;

  else
    raise exception 'Ação de ciclo inválida.';
  end if;

  select * into v_survey from sigav."TB_PESQUISA" where id = target_survey_id;
  select * into v_version from sigav."TH_VERSAO_PESQUISA" where id = v_version.id;
  select * into v_application from sigav."TB_APLICACAO_PESQUISA" where id = v_application.id;

  v_after := jsonb_build_object(
    'surveyStatus', v_survey.status,
    'versionStatus', v_version.status,
    'applicationStatus', v_application.status,
    'opensAt', v_application.opens_at,
    'closesAt', v_application.closes_at,
    'archivedAt', v_survey.dt_arquivamento
  );

  insert into sigav."TL_EVENTO_AUDITORIA"(
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
    'SURVEY_CYCLE_' || v_action,
    'SURVEY_APPLICATION',
    v_application.id::text,
    v_application.id,
    v_before,
    v_after,
    jsonb_build_object('surveyId', v_survey.id, 'versionId', v_version.id)
  );

  return jsonb_build_object(
    'status', 'OK',
    'action', v_action,
    'application', v_after
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_MOVER_PERGUNTA_SECAO"(target_question_id uuid, target_section_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor_id uuid := sigav."FC_PESSOA_SESSAO"();
  v_version sigav."TH_VERSAO_PESQUISA"%rowtype;
  v_question sigav."TB_PERGUNTA_PESQUISA"%rowtype;
  v_target_section sigav."TB_SECAO_PESQUISA"%rowtype;
  v_application_id uuid;
  v_target_position integer;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à Equipe Técnica.';
  end if;

  if target_question_id is null or target_section_id is null then
    raise exception 'Informe a pergunta e a seção de destino.';
  end if;

  select version.*
  into v_version
  from sigav."TH_VERSAO_PESQUISA" version
  join sigav."TB_PERGUNTA_PESQUISA" question
    on question.survey_version_id = version.id
  where question.id = target_question_id
    and version.status = 'DRAFT'
  for update of version;

  if v_version.id is null then
    raise exception 'Pergunta em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
  end if;

  select *
  into v_question
  from sigav."TB_PERGUNTA_PESQUISA"
  where id = target_question_id
    and survey_version_id = v_version.id;

  select *
  into v_target_section
  from sigav."TB_SECAO_PESQUISA"
  where id = target_section_id
    and survey_version_id = v_version.id;

  if v_target_section.id is null then
    raise exception 'A seção de destino precisa pertencer à mesma versão em rascunho.';
  end if;

  if v_question.section_id = v_target_section.id then
    return jsonb_build_object(
      'status', 'NO_CHANGE',
      'questionId', v_question.id,
      'sectionId', v_question.section_id,
      'position', v_question.position
    );
  end if;

  perform section.id
  from sigav."TB_SECAO_PESQUISA" section
  where section.id in (v_question.section_id, v_target_section.id)
  order by section.id
  for update;

  perform question.id
  from sigav."TB_PERGUNTA_PESQUISA" question
  where question.section_id in (v_question.section_id, v_target_section.id)
  order by question.id
  for update;

  select coalesce(max(question.position), 0) + 1
  into v_target_position
  from sigav."TB_PERGUNTA_PESQUISA" question
  where question.section_id = v_target_section.id;

  update sigav."TB_PERGUNTA_PESQUISA"
  set section_id = v_target_section.id,
      position = v_target_position,
      updated_at = timezone('utc', now())
  where id = v_question.id
    and survey_version_id = v_version.id;

  select application.id
  into v_application_id
  from sigav."TB_APLICACAO_PESQUISA" application
  where application.survey_version_id = v_version.id
  order by application.created_at desc
  limit 1;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'SURVEY_QUESTION_MOVED',
    'SURVEY_QUESTION',
    v_question.id::text,
    v_application_id,
    jsonb_build_object(
      'sectionId', v_question.section_id,
      'position', v_question.position
    ),
    jsonb_build_object(
      'sectionId', v_target_section.id,
      'position', v_target_position
    ),
    jsonb_build_object(
      'surveyId', v_version.survey_id,
      'surveyVersionId', v_version.id,
      'title', v_question.title
    )
  );

  return jsonb_build_object(
    'status', 'OK',
    'questionId', v_question.id,
    'previousSectionId', v_question.section_id,
    'sectionId', v_target_section.id,
    'previousPosition', v_question.position,
    'position', v_target_position
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_NORMALIZAR_REFERRER_OAUTH"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if new.provider_type = 'google'
     and new.authentication_method = 'oauth'
     and (
       new.referrer is null
       or btrim(new.referrer) = ''
       or btrim(new.referrer) = 'agsus-pesquisas-nu.vercel.app'
       or btrim(new.referrer) = 'http://agsus-pesquisas-nu.vercel.app'
       or btrim(new.referrer) = 'https://agsus-pesquisas-nu.vercel.app'
       or btrim(new.referrer) = '/agsus-pesquisas-nu.vercel.app'
     )
  then
    new.referrer := 'https://agsus-pesquisas-nu.vercel.app/auth/confirm?next=/area';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_REMOVER_PESSOA_EQUIPE"(target_link_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare v_actor_id uuid; v_link sigav."RT_LIDERANCA_CDDI"%rowtype; v_person_name text;
begin
  v_actor_id:=sigav."FC_PESSOA_SESSAO"();
  if v_actor_id is null then raise exception 'Cadastro institucional não identificado.'; end if;
  select * into v_link from sigav."RT_LIDERANCA_CDDI" where id=target_link_id for update;
  if v_link.id is null then raise exception 'Vínculo não encontrado.'; end if;
  if v_link.status<>'ACTIVE' or v_link.valid_to is not null then raise exception 'O vínculo já foi encerrado.'; end if;
  if v_link.leader_person_id<>v_actor_id and not sigav."FC_PODE_GERIR_PESQUISA"() then raise exception 'Você não possui permissão para retirar esta pessoa.'; end if;
  update sigav."RT_LIDERANCA_CDDI" set status='ENDED',valid_to=timezone('utc',now()),updated_at=timezone('utc',now()) where id=target_link_id;
  select full_name into v_person_name from sigav."TB_PESSOA" where id=v_link.subordinate_person_id;
  insert into sigav."TL_EVENTO_AUDITORIA"(actor_person_id,event_type,entity_type,entity_id,application_id,before_data,after_data,metadata)
  values(v_actor_id,'TEAM_MEMBER_REMOVED','CDDI_LEADERSHIP_LINK',target_link_id::text,v_link.application_id,to_jsonb(v_link),jsonb_build_object('status','ENDED','validTo',timezone('utc',now())),'{}'::jsonb);
  return jsonb_build_object('status','OK','personName',v_person_name);
end;$function$;

CREATE OR REPLACE FUNCTION sigav."FC_REORDENAR_ITEM_CONSTRUTOR"(target_item_type text, target_item_id uuid, target_direction text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor_id uuid := sigav."FC_PESSOA_SESSAO"();
  v_item_type text := upper(btrim(coalesce(target_item_type, '')));
  v_direction text := upper(btrim(coalesce(target_direction, '')));
  v_version sigav."TH_VERSAO_PESQUISA"%rowtype;
  v_section sigav."TB_SECAO_PESQUISA"%rowtype;
  v_neighbor_section sigav."TB_SECAO_PESQUISA"%rowtype;
  v_question sigav."TB_PERGUNTA_PESQUISA"%rowtype;
  v_neighbor_question sigav."TB_PERGUNTA_PESQUISA"%rowtype;
  v_source_section_id uuid;
  v_application_id uuid;
  v_from_position integer;
  v_to_position integer;
  v_temporary_position integer;
  v_title text;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à Equipe Técnica.';
  end if;
  if v_item_type not in ('SECTION', 'QUESTION') then
    raise exception 'Tipo de item inválido para reordenação.';
  end if;
  if v_direction not in ('UP', 'DOWN') then
    raise exception 'Direção inválida para reordenação.';
  end if;

  if v_item_type = 'SECTION' then
    select sv.*
    into v_version
    from sigav."TH_VERSAO_PESQUISA" sv
    join sigav."TB_SECAO_PESQUISA" sec on sec.survey_version_id = sv.id
    where sec.id = target_item_id
      and sv.status = 'DRAFT'
    for update of sv;

    if v_version.id is null then
      raise exception 'Seção em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
    end if;

    perform sec.id
    from sigav."TB_SECAO_PESQUISA" sec
    where sec.survey_version_id = v_version.id
    order by sec.id
    for update;

    select *
    into v_section
    from sigav."TB_SECAO_PESQUISA"
    where id = target_item_id
      and survey_version_id = v_version.id;

    if v_direction = 'UP' then
      select *
      into v_neighbor_section
      from sigav."TB_SECAO_PESQUISA"
      where survey_version_id = v_version.id
        and position < v_section.position
      order by position desc, id desc
      limit 1;
    else
      select *
      into v_neighbor_section
      from sigav."TB_SECAO_PESQUISA"
      where survey_version_id = v_version.id
        and position > v_section.position
      order by position, id
      limit 1;
    end if;

    if v_neighbor_section.id is null then
      return jsonb_build_object(
        'status', 'NO_CHANGE',
        'itemType', v_item_type,
        'itemId', target_item_id,
        'position', v_section.position
      );
    end if;

    select candidate
    into v_temporary_position
    from generate_series(0, (
      select coalesce(max(sec.position), 0) + 1
      from sigav."TB_SECAO_PESQUISA" sec
      where sec.survey_version_id = v_version.id
    )) as candidates(candidate)
    where not exists (
      select 1
      from sigav."TB_SECAO_PESQUISA" sec
      where sec.survey_version_id = v_version.id
        and sec.position = candidate
    )
    order by candidate
    limit 1;

    v_from_position := v_section.position;
    v_to_position := v_neighbor_section.position;
    v_title := v_section.title;

    update sigav."TB_SECAO_PESQUISA"
    set position = v_temporary_position,
        updated_at = timezone('utc', now())
    where id = v_section.id;

    update sigav."TB_SECAO_PESQUISA"
    set position = v_from_position,
        updated_at = timezone('utc', now())
    where id = v_neighbor_section.id;

    update sigav."TB_SECAO_PESQUISA"
    set position = v_to_position,
        updated_at = timezone('utc', now())
    where id = v_section.id;
  else
    select sv.*
    into v_version
    from sigav."TH_VERSAO_PESQUISA" sv
    join sigav."TB_PERGUNTA_PESQUISA" question on question.survey_version_id = sv.id
    where question.id = target_item_id
      and sv.status = 'DRAFT'
    for update of sv;

    if v_version.id is null then
      raise exception 'Pergunta em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
    end if;

    select question.section_id
    into v_source_section_id
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question.id = target_item_id
      and question.survey_version_id = v_version.id;

    perform question.id
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question.section_id = v_source_section_id
    order by question.id
    for update;

    select *
    into v_question
    from sigav."TB_PERGUNTA_PESQUISA"
    where id = target_item_id
      and survey_version_id = v_version.id;

    if v_direction = 'UP' then
      select *
      into v_neighbor_question
      from sigav."TB_PERGUNTA_PESQUISA"
      where section_id = v_question.section_id
        and position < v_question.position
      order by position desc, id desc
      limit 1;
    else
      select *
      into v_neighbor_question
      from sigav."TB_PERGUNTA_PESQUISA"
      where section_id = v_question.section_id
        and position > v_question.position
      order by position, id
      limit 1;
    end if;

    if v_neighbor_question.id is null then
      return jsonb_build_object(
        'status', 'NO_CHANGE',
        'itemType', v_item_type,
        'itemId', target_item_id,
        'position', v_question.position
      );
    end if;

    select candidate
    into v_temporary_position
    from generate_series(0, (
      select coalesce(max(question.position), 0) + 1
      from sigav."TB_PERGUNTA_PESQUISA" question
      where question.section_id = v_question.section_id
    )) as candidates(candidate)
    where not exists (
      select 1
      from sigav."TB_PERGUNTA_PESQUISA" question
      where question.section_id = v_question.section_id
        and question.position = candidate
    )
    order by candidate
    limit 1;

    v_from_position := v_question.position;
    v_to_position := v_neighbor_question.position;
    v_title := v_question.title;

    update sigav."TB_PERGUNTA_PESQUISA"
    set position = v_temporary_position,
        updated_at = timezone('utc', now())
    where id = v_question.id;

    update sigav."TB_PERGUNTA_PESQUISA"
    set position = v_from_position,
        updated_at = timezone('utc', now())
    where id = v_neighbor_question.id;

    update sigav."TB_PERGUNTA_PESQUISA"
    set position = v_to_position,
        updated_at = timezone('utc', now())
    where id = v_question.id;
  end if;

  select app.id
  into v_application_id
  from sigav."TB_APLICACAO_PESQUISA" app
  where app.survey_version_id = v_version.id
  order by app.created_at desc
  limit 1;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'SURVEY_' || v_item_type || '_REORDERED',
    'SURVEY_' || v_item_type,
    target_item_id::text,
    v_application_id,
    jsonb_build_object('position', v_from_position),
    jsonb_build_object('position', v_to_position, 'direction', v_direction),
    jsonb_build_object(
      'surveyId', v_version.survey_id,
      'surveyVersionId', v_version.id,
      'title', v_title
    )
  );

  return jsonb_build_object(
    'status', 'OK',
    'itemType', v_item_type,
    'itemId', target_item_id,
    'direction', v_direction,
    'previousPosition', v_from_position,
    'position', v_to_position
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_RESOLVER_PESSOA_AUTENTIC"(target_employee_number text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_auth uuid := sigav."FC_UID_SESSAO"();
  v_email text := lower(btrim(coalesce(sigav."FC_CLAIMS_SESSAO"()->>'email','')));
  v_name text := nullif(btrim(coalesce(
    sigav."FC_CLAIMS_SESSAO"()#>>'{user_metadata,full_name}',
    sigav."FC_CLAIMS_SESSAO"()#>>'{user_metadata,name}',
    split_part(v_email,'@',1)
  )), '');
  v_avatar text := nullif(btrim(coalesce(
    sigav."FC_CLAIMS_SESSAO"()#>>'{user_metadata,avatar_url}',
    sigav."FC_CLAIMS_SESSAO"()#>>'{user_metadata,picture}',
    sigav."FC_CLAIMS_SESSAO"()#>>'{user_metadata,photo_url}',
    ''
  )), '');
  v_person sigav."TB_PESSOA"%rowtype;
  v_count integer := 0;
  v_employee text;
begin
  if v_auth is null then
    return jsonb_build_object('status','AUTH_REQUIRED','message','Autenticação necessária.');
  end if;

  if not sigav."FC_EMAIL_INSTITUC_PERMITIDO"(v_email) then
    return jsonb_build_object('status','INVALID_DOMAIN','message','Utilize uma conta institucional AgSUS autorizada.');
  end if;

  select * into v_person
  from sigav."TB_PESSOA"
  where auth_user_id = v_auth and active
  limit 1;

  if v_person.id is null then
    select count(*) into v_count
    from sigav."TB_PESSOA"
    where active
      and lower(btrim(coalesce(institutional_email,''))) = v_email
      and (target_employee_number is null or employee_number = btrim(target_employee_number));

    if v_count > 1 and target_employee_number is null then
      return jsonb_build_object('status','NEEDS_EMPLOYEE_NUMBER','message','Há mais de um cadastro associado ao e-mail. Informe sua matrícula.');
    end if;

    select * into v_person
    from sigav."TB_PESSOA"
    where active
      and lower(btrim(coalesce(institutional_email,''))) = v_email
      and (target_employee_number is null or employee_number = btrim(target_employee_number))
    order by (auth_user_id is null) desc, created_at
    limit 1;
  end if;

  if v_person.id is null then
    select p.* into v_person
    from sigav."TB_IDENTIDADE_ACESSO" pai
    join sigav."TB_PESSOA" p on p.id = pai.person_id
    where lower(pai.email) = v_email
      and pai.status in ('PENDING','ACTIVE')
      and p.active
      and (target_employee_number is null or p.employee_number = btrim(target_employee_number))
    order by pai.status = 'ACTIVE' desc, pai.created_at
    limit 1;
  end if;

  if v_person.id is null then
    v_employee := 'AUTH-' || upper(substr(replace(v_auth::text,'-',''),1,20));
    insert into sigav."TB_PESSOA"(
      auth_user_id, employee_number, full_name, institutional_email,
      employment_status, active, source_system, source_key, metadata
    ) values (
      v_auth, v_employee, coalesce(v_name,v_email), v_email,
      'ATIVO', true, 'SUPABASE_AUTH', v_auth::text,
      jsonb_strip_nulls(jsonb_build_object(
        'provisioning','INSTITUTIONAL_DOMAIN',
        'provisioned_at',timezone('utc',now()),
        'avatar_url',v_avatar,
        'avatar_source',case when v_avatar is null then 'INITIALS' else 'GOOGLE' end,
        'google_avatar_url',v_avatar
      ))
    ) returning * into v_person;
  else
    if v_person.auth_user_id is not null and v_person.auth_user_id <> v_auth then
      return jsonb_build_object('status','ALREADY_LINKED','message','Este cadastro já está vinculado a outra conta autenticada.');
    end if;

    update sigav."TB_PESSOA"
    set auth_user_id = v_auth,
        institutional_email = coalesce(nullif(btrim(institutional_email),''),v_email),
        full_name = case
          when source_system = 'SUPABASE_AUTH' and v_name is not null then v_name
          else full_name
        end,
        metadata = coalesce(metadata,'{}'::jsonb)
          || case when v_avatar is null then '{}'::jsonb else jsonb_build_object('google_avatar_url',v_avatar) end
          || case
               when v_avatar is not null and coalesce(metadata->>'avatar_source','') not in ('UPLOADED','GENERATED')
                 then jsonb_build_object('avatar_url',v_avatar,'avatar_source','GOOGLE')
               else '{}'::jsonb
             end,
        updated_at = timezone('utc',now())
    where id = v_person.id
    returning * into v_person;
  end if;

  insert into sigav."TB_IDENTIDADE_ACESSO"(
    person_id, identity_type, email, status, source, verified_at, metadata
  ) values (
    v_person.id, 'INSTITUTIONAL_EMAIL', v_email, 'ACTIVE', 'SUPABASE_AUTH', timezone('utc',now()),
    jsonb_build_object('auth_user_id',v_auth)
  )
  on conflict(person_id,identity_type,email) do update
  set status='ACTIVE',
      verified_at=coalesce(sigav."TB_IDENTIDADE_ACESSO".verified_at,excluded.verified_at),
      revoked_at=null,
      updated_at=timezone('utc',now());

  return jsonb_build_object(
    'status','OK',
    'person',jsonb_build_object(
      'id',v_person.id,
      'employeeNumber',v_person.employee_number,
      'fullName',v_person.full_name,
      'institutionalEmail',v_person.institutional_email,
      'jobTitle',v_person.job_title,
      'costCenter',v_person.cost_center,
      'workplace',v_person.workplace,
      'metadata',v_person.metadata,
      'avatarUrl',coalesce(v_person.metadata->>'avatar_url',v_person.metadata->>'picture',v_person.metadata->>'photo_url')
    )
  );
end
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_RLS_HABILITAR_AUTO"()
 RETURNS event_trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog'
AS $function$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    -- O segundo rótulo é montado por concatenação de propósito: `npm run
    -- db:naming` lê a migration como texto e leria a string literal
    -- 'CREATE TABLE AS' como a criação de uma tabela chamada "as".
    where command_tag in ('CREATE TABLE', 'CREATE TABLE' || ' AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null
       and cmd.schema_name in ('sigav')
       and cmd.schema_name not in ('pg_catalog', 'information_schema')
       and cmd.schema_name not like 'pg_toast%'
       and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: RLS habilitada em %', cmd.object_identity;
      exception
        -- Falhar aqui abortaria o `create table` que disparou o gatilho. A
        -- tabela é criada mesmo assim, e o teste de RLS acusa a exposição.
        when others then
          raise log 'rls_auto_enable: não foi possível habilitar RLS em %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: ignorado % (schema % fora da lista aplicada)', cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SALVAR_RESPOSTA_CDDI"(target_submission_id uuid, target_question_id uuid, target_option_id uuid DEFAULT NULL::uuid, target_text text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid := sigav."FC_PESSOA_SESSAO"();
  v_submission sigav."TB_SUBMISSAO"%rowtype;
  v_survey_version_id uuid;
  v_question sigav."TB_PERGUNTA_PESQUISA"%rowtype;
  v_option sigav."TB_OPCAO_PERGUNTA"%rowtype;
  v_answer_id uuid;
  v_numeric numeric(18,6);
  v_text text;
begin
  if sigav."FC_UID_SESSAO"() is null or v_person_id is null then
    raise exception 'Usuário não identificado.';
  end if;

  select s.*
    into v_submission
  from sigav."TB_SUBMISSAO" s
  where s.id = target_submission_id
  for update;

  if not found
    or v_submission.respondent_person_id is distinct from v_person_id
    or v_submission.status <> 'DRAFT' then
    raise exception 'O rascunho não está disponível para edição.';
  end if;

  if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_submission.application_id) then
    raise exception 'O período de respostas está encerrado.';
  end if;

  select sa.survey_version_id
    into v_survey_version_id
  from sigav."TB_APLICACAO_PESQUISA" sa
  where sa.id = v_submission.application_id;

  select q.*
    into v_question
  from sigav."TB_PERGUNTA_PESQUISA" q
  where q.id = target_question_id
    and q.survey_version_id = v_survey_version_id;

  if not found then
    raise exception 'Pergunta inválida para esta aplicação.';
  end if;

  if v_question.question_type = 'SCALE' then
    if target_option_id is null then
      raise exception 'Selecione uma alternativa da escala.';
    end if;

    select qo.*
      into v_option
    from sigav."TB_OPCAO_PERGUNTA" qo
    where qo.id = target_option_id
      and qo.question_id = v_question.id
      and qo.active = true;

    if not found then
      raise exception 'Alternativa inválida para esta pergunta.';
    end if;

    v_numeric := coalesce(
      v_option.score,
      case
        when v_option.value ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$'
          then v_option.value::numeric
        else null
      end
    );

    insert into sigav."TB_RESPOSTA" (
      submission_id,
      question_id,
      answer_text,
      answer_number,
      answer_boolean,
      answer_date,
      answer_datetime,
      answer_json,
      score
    ) values (
      v_submission.id,
      v_question.id,
      null,
      v_numeric,
      null,
      null,
      null,
      null,
      v_numeric
    )
    on conflict (submission_id, question_id) do update
      set answer_text = null,
          answer_number = excluded.answer_number,
          answer_boolean = null,
          answer_date = null,
          answer_datetime = null,
          answer_json = null,
          score = excluded.score,
          updated_at = now()
    returning id into v_answer_id;

    delete from sigav."RL_RESPOSTA_OPCAO" where answer_id = v_answer_id;
    insert into sigav."RL_RESPOSTA_OPCAO" (answer_id, option_id, position)
    values (v_answer_id, v_option.id, 1);

  elsif v_question.question_type in ('SHORT_TEXT', 'LONG_TEXT') then
    v_text := nullif(btrim(coalesce(target_text, '')), '');

    if length(coalesce(v_text, '')) > 12000 then
      raise exception 'O texto excede o limite de 12.000 caracteres.';
    end if;

    if v_text is null then
      delete from sigav."TB_RESPOSTA"
      where submission_id = v_submission.id
        and question_id = v_question.id;
    else
      insert into sigav."TB_RESPOSTA" (
        submission_id,
        question_id,
        answer_text,
        answer_number,
        answer_boolean,
        answer_date,
        answer_datetime,
        answer_json,
        score
      ) values (
        v_submission.id,
        v_question.id,
        v_text,
        null,
        null,
        null,
        null,
        null,
        null
      )
      on conflict (submission_id, question_id) do update
        set answer_text = excluded.answer_text,
            answer_number = null,
            answer_boolean = null,
            answer_date = null,
            answer_datetime = null,
            answer_json = null,
            score = null,
            updated_at = now()
      returning id into v_answer_id;

      delete from sigav."RL_RESPOSTA_OPCAO" where answer_id = v_answer_id;
    end if;
  else
    raise exception 'Tipo de pergunta ainda não suportado pelo formulário CDDI.';
  end if;

  update sigav."TB_SUBMISSAO"
  set metadata = metadata || jsonb_build_object('last_saved_at', now())
  where id = v_submission.id;

  return jsonb_build_object(
    'status', 'OK',
    'savedAt', now()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SALVAR_RESPOSTA_PESQUISA"(target_submission_id uuid, target_question_id uuid, target_option_ids uuid[], target_text text, target_number numeric, target_boolean boolean, target_date date, target_datetime timestamp with time zone, target_json jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid := sigav."FC_PESSOA_SESSAO"();
  v_submission sigav."TB_SUBMISSAO"%rowtype;
  v_version_id uuid;
  v_question sigav."TB_PERGUNTA_PESQUISA"%rowtype;
  v_answer_id uuid;
  v_option_ids uuid[];
  v_invalid_options integer;
  v_text text;
begin
  if v_person_id is null then raise exception 'Usuário não identificado.'; end if;

  select * into v_submission
  from sigav."TB_SUBMISSAO"
  where id = target_submission_id
  for update;

  if v_submission.id is null
     or v_submission.respondent_person_id is distinct from v_person_id
     or v_submission.status <> 'DRAFT' then
    raise exception 'O rascunho não está disponível para edição.';
  end if;

  if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_submission.application_id) then
    raise exception 'O período de respostas está encerrado.';
  end if;

  select survey_version_id into v_version_id
  from sigav."TB_APLICACAO_PESQUISA"
  where id = v_submission.application_id;

  select * into v_question
  from sigav."TB_PERGUNTA_PESQUISA"
  where id = target_question_id
    and survey_version_id = v_version_id;

  if v_question.id is null then raise exception 'Pergunta inválida para esta pesquisa.'; end if;

  if v_question.question_type in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE') then
    select coalesce(array_agg(distinct option_id), '{}'::uuid[])
    into v_option_ids
    from unnest(coalesce(target_option_ids, '{}'::uuid[])) option_id;

    if coalesce(array_length(v_option_ids, 1), 0) = 0 then
      delete from sigav."TB_RESPOSTA" where submission_id = v_submission.id and question_id = v_question.id;
    else
      if v_question.question_type in ('SCALE','SINGLE_CHOICE') and array_length(v_option_ids, 1) <> 1 then
        raise exception 'Selecione apenas uma alternativa.';
      end if;

      select count(*) into v_invalid_options
      from unnest(v_option_ids) selected_id
      left join sigav."TB_OPCAO_PERGUNTA" qo
        on qo.id = selected_id
       and qo.question_id = v_question.id
       and qo.active = true
      where qo.id is null;

      if v_invalid_options > 0 then raise exception 'Uma ou mais alternativas são inválidas.'; end if;

      insert into sigav."TB_RESPOSTA"(submission_id, question_id)
      values(v_submission.id, v_question.id)
      on conflict(submission_id, question_id) do update set
        answer_text = null,
        answer_number = null,
        answer_boolean = null,
        answer_date = null,
        answer_datetime = null,
        answer_json = null,
        score = null,
        updated_at = now()
      returning id into v_answer_id;

      delete from sigav."RL_RESPOSTA_OPCAO" where answer_id = v_answer_id;
      insert into sigav."RL_RESPOSTA_OPCAO"(answer_id, option_id, position)
      select v_answer_id, option_id, row_number() over (order by option_id)::integer
      from unnest(v_option_ids) option_id;
    end if;
  elsif v_question.question_type in ('SHORT_TEXT','LONG_TEXT') then
    v_text := nullif(btrim(coalesce(target_text, '')), '');
    if length(coalesce(v_text, '')) > 12000 then raise exception 'O texto excede o limite de 12.000 caracteres.'; end if;
    if v_text is null then
      delete from sigav."TB_RESPOSTA" where submission_id = v_submission.id and question_id = v_question.id;
    else
      insert into sigav."TB_RESPOSTA"(submission_id, question_id, answer_text)
      values(v_submission.id, v_question.id, v_text)
      on conflict(submission_id, question_id) do update set
        answer_text = excluded.answer_text,
        answer_number = null,
        answer_boolean = null,
        answer_date = null,
        answer_datetime = null,
        answer_json = null,
        score = null,
        updated_at = now();
    end if;
  elsif v_question.question_type in ('INTEGER','DECIMAL') then
    if target_number is null then
      delete from sigav."TB_RESPOSTA" where submission_id = v_submission.id and question_id = v_question.id;
    else
      if v_question.question_type = 'INTEGER' and target_number <> trunc(target_number) then
        raise exception 'Informe um número inteiro.';
      end if;
      insert into sigav."TB_RESPOSTA"(submission_id, question_id, answer_number)
      values(v_submission.id, v_question.id, target_number)
      on conflict(submission_id, question_id) do update set
        answer_text = null,
        answer_number = excluded.answer_number,
        answer_boolean = null,
        answer_date = null,
        answer_datetime = null,
        answer_json = null,
        score = null,
        updated_at = now();
    end if;
  elsif v_question.question_type = 'BOOLEAN' then
    if target_boolean is null then
      delete from sigav."TB_RESPOSTA" where submission_id = v_submission.id and question_id = v_question.id;
    else
      insert into sigav."TB_RESPOSTA"(submission_id, question_id, answer_boolean)
      values(v_submission.id, v_question.id, target_boolean)
      on conflict(submission_id, question_id) do update set
        answer_text = null,
        answer_number = null,
        answer_boolean = excluded.answer_boolean,
        answer_date = null,
        answer_datetime = null,
        answer_json = null,
        score = null,
        updated_at = now();
    end if;
  elsif v_question.question_type = 'DATE' then
    if target_date is null then
      delete from sigav."TB_RESPOSTA" where submission_id = v_submission.id and question_id = v_question.id;
    else
      insert into sigav."TB_RESPOSTA"(submission_id, question_id, answer_date)
      values(v_submission.id, v_question.id, target_date)
      on conflict(submission_id, question_id) do update set
        answer_text = null,
        answer_number = null,
        answer_boolean = null,
        answer_date = excluded.answer_date,
        answer_datetime = null,
        answer_json = null,
        score = null,
        updated_at = now();
    end if;
  elsif v_question.question_type = 'DATETIME' then
    if target_datetime is null then
      delete from sigav."TB_RESPOSTA" where submission_id = v_submission.id and question_id = v_question.id;
    else
      insert into sigav."TB_RESPOSTA"(submission_id, question_id, answer_datetime)
      values(v_submission.id, v_question.id, target_datetime)
      on conflict(submission_id, question_id) do update set
        answer_text = null,
        answer_number = null,
        answer_boolean = null,
        answer_date = null,
        answer_datetime = excluded.answer_datetime,
        answer_json = null,
        score = null,
        updated_at = now();
    end if;
  else
    raise exception 'Tipo de pergunta ainda não suportado: %.', v_question.question_type;
  end if;

  update sigav."TB_SUBMISSAO"
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('last_saved_at', now()),
      updated_at = now()
  where id = v_submission.id;

  return jsonb_build_object('status', 'OK', 'savedAt', now());
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_BUSCAR_PESSOAS_CICLO"(target_application_id uuid, target_search text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_search text := lower(btrim(coalesce(target_search,'')));
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Seu perfil não possui permissão para consultar pessoas.';
  end if;

  if not exists(select 1 from sigav."TB_APLICACAO_PESQUISA" where id = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'personId', p.id,
      'employeeNumber', p.employee_number,
      'fullName', p.full_name,
      'institutionalEmail', p.institutional_email,
      'jobTitle', p.job_title,
      'costCenter', p.cost_center,
      'workplace', p.workplace,
      'avatarUrl', coalesce(p.metadata->>'avatar_url', p.metadata->>'picture', p.metadata->>'photo_url'),
      'participantId', ap.id,
      'participantStatus', ap.status
    ) order by p.full_name), '[]'::jsonb)
    from sigav."TB_PESSOA" p
    left join sigav."RL_APLICACAO_PESSOA" ap
      on ap.application_id = target_application_id
     and ap.person_id = p.id
     and ap.participant_role = 'RESPONDENT'
    where p.active
      and p.employment_status = 'ATIVO'
      and (
        v_search = ''
        or lower(p.full_name) like '%' || v_search || '%'
        or lower(coalesce(p.institutional_email,'')) like '%' || v_search || '%'
        or lower(p.employee_number) like '%' || v_search || '%'
        or lower(coalesce(p.job_title,'')) like '%' || v_search || '%'
      )
    limit 50
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_BUSCAR_PESSOAS_ADMIN"(target_search text DEFAULT NULL::text, target_limit integer DEFAULT 80)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare v_search text := lower(btrim(coalesce(target_search,''))); v_limit integer := least(greatest(coalesce(target_limit,80),1),250);
begin
  if not sigav."FC_TEM_MODULO"('ADMIN_TEAMS') then raise exception 'Acesso restrito ao Administrador da Plataforma.'; end if;
  return (select coalesce(jsonb_agg(jsonb_build_object(
    'personId',p.id,'employeeNumber',p.employee_number,'fullName',p.full_name,'institutionalEmail',p.institutional_email,
    'jobTitle',p.job_title,'costCenter',p.cost_center,'workplace',p.workplace,
    'directorate',nullif(btrim(coalesce(p.metadata->>'directorate','')),''),
    'organizationalUnit',nullif(btrim(coalesce(p.metadata->>'unit','')),''),
    'coordination',nullif(btrim(coalesce(p.metadata->>'coordination','')),''),
    'employmentStatus',p.employment_status,'active',p.active,'updatedAt',p.updated_at
  ) order by p.active desc,p.full_name),'[]'::jsonb)
  from sigav."TB_PESSOA" p where v_search='' or lower(p.full_name) like '%'||v_search||'%' or lower(p.employee_number) like '%'||v_search||'%' or lower(coalesce(p.institutional_email,'')) like '%'||v_search||'%' or lower(coalesce(p.job_title,'')) like '%'||v_search||'%' or lower(coalesce(p.cost_center,'')) like '%'||v_search||'%' or lower(coalesce(p.workplace,'')) like '%'||v_search||'%' or lower(coalesce(p.metadata->>'directorate','')) like '%'||v_search||'%' or lower(coalesce(p.metadata->>'unit','')) like '%'||v_search||'%' or lower(coalesce(p.metadata->>'coordination','')) like '%'||v_search||'%' limit v_limit);
end;$function$;

CREATE OR REPLACE FUNCTION sigav."FC_BUSCAR_CANDIDATOS_EQUIPE"(target_application_id uuid, search_term text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid;
  v_result jsonb;
begin
  v_person_id := sigav."FC_PESSOA_SESSAO"();
  if v_person_id is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;
  if not (sigav."FC_TEM_PAPEL_ATIVO"('LEADER') or sigav."FC_PODE_GERIR_PESQUISA"()) then
    raise exception 'Você não possui permissão para pesquisar integrantes.';
  end if;
  if not exists (select 1 from sigav."TB_APLICACAO_PESQUISA" where id = target_application_id) then
    raise exception 'O ciclo selecionado não foi encontrado.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'personId', p.id,
    'fullName', p.full_name,
    'employeeNumber', p.employee_number,
    'institutionalEmail', p.institutional_email,
    'jobTitle', p.job_title,
    'unit', coalesce(p.metadata->>'unit', p.metadata->>'unidade', p.cost_center),
    'workplace', p.workplace
  ) order by p.full_name), '[]'::jsonb)
  into v_result
  from (
    select p.*
    from sigav."RL_APLICACAO_PESSOA" ap
    join sigav."TB_PESSOA" p on p.id = ap.person_id
    where ap.application_id = target_application_id
      and p.id <> v_person_id
      and p.active = true
      and ap.status not in ('REMOVED','INELIGIBLE')
      and not exists (
        select 1
        from sigav."RT_LIDERANCA_CDDI" l
        where l.application_id = target_application_id
          and l.subordinate_person_id = p.id
          and l.status = 'ACTIVE'
          and l.valid_to is null
      )
      and (
        nullif(btrim(search_term), '') is null
        or sigav."FC_SEM_ACENTO_MINUSCULA"(p.full_name) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(btrim(search_term)) || '%'
        or sigav."FC_SEM_ACENTO_MINUSCULA"(coalesce(p.institutional_email, '')) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(btrim(search_term)) || '%'
        or sigav."FC_SEM_ACENTO_MINUSCULA"(coalesce(p.employee_number, '')) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(btrim(search_term)) || '%'
        or sigav."FC_SEM_ACENTO_MINUSCULA"(coalesce(p.metadata->>'unit', p.metadata->>'unidade', p.cost_center, '')) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(btrim(search_term)) || '%'
      )
    order by p.full_name
    limit 30
  ) p;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_DEFINIR_SITUACAO_PARTIC"(target_participant_id uuid, target_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor uuid := sigav."FC_PESSOA_SESSAO"();
  v_target text := upper(btrim(coalesce(target_status,'')));
  v_participant sigav."RL_APLICACAO_PESSOA"%rowtype;
  v_before jsonb;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Seu perfil não possui permissão para alterar participantes.';
  end if;
  if v_target not in ('ELIGIBLE','BLOCKED','EXCLUDED') then
    raise exception 'Situação de participante inválida.';
  end if;

  select * into v_participant
  from sigav."RL_APLICACAO_PESSOA"
  where id = target_participant_id
  for update;

  if v_participant.id is null then raise exception 'Participante não localizado.'; end if;
  if v_participant.completed_at is not null and v_target = 'ELIGIBLE' then
    raise exception 'Uma participação concluída não pode voltar para elegível.';
  end if;

  v_before := to_jsonb(v_participant);

  update sigav."RL_APLICACAO_PESSOA"
  set status = v_target,
      metadata = coalesce(metadata,'{}'::jsonb)
        || jsonb_build_object('status_changed_by',v_actor,'status_changed_at',timezone('utc',now())),
      updated_at = timezone('utc',now())
  where id = target_participant_id
  returning * into v_participant;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    actor_person_id,event_type,entity_type,entity_id,application_id,before_data,after_data,metadata
  ) values (
    v_actor,'PARTICIPANT_STATUS_CHANGED','APPLICATION_PARTICIPANT',v_participant.id::text,
    v_participant.application_id,v_before,to_jsonb(v_participant),jsonb_build_object('source','ADMIN_PARTICIPANTS')
  );

  return jsonb_build_object('status','OK','participantId',v_participant.id,'participantStatus',v_participant.status);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_DEFINIR_AVATAR"(p_avatar_url text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  return sigav."FC_SINCR_AVATAR_GOOGLE"();
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_DEFINIR_VINCULO_LIDERANCA"(target_application_id uuid, target_subordinate_person_id uuid, target_leader_person_id uuid, target_justification text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor_id uuid;
  v_justification text := btrim(coalesce(target_justification, ''));
  v_previous sigav."RT_LIDERANCA_CDDI"%rowtype;
  v_new_link sigav."RT_LIDERANCA_CDDI"%rowtype;
  v_leader_name text;
  v_subordinate_name text;
begin
  if not sigav."FC_TEM_MODULO"('ADMIN_TEAMS') then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;

  v_actor_id := sigav."FC_PESSOA_SESSAO"();
  if v_actor_id is null then
    raise exception 'Cadastro institucional do administrador não identificado.';
  end if;
  if length(v_justification) < 10 then
    raise exception 'Informe uma justificativa com pelo menos 10 caracteres.';
  end if;
  if target_leader_person_id = target_subordinate_person_id then
    raise exception 'Uma pessoa não pode ser liderança de si própria.';
  end if;
  if not exists (
    select 1
    from sigav."TB_APLICACAO_PESQUISA" application
    join sigav."TH_VERSAO_PESQUISA" version on version.id = application.survey_version_id
    join sigav."TB_PESQUISA" survey on survey.id = version.survey_id
    where application.id = target_application_id
      and survey.code = 'CDDI'
      and survey.dt_arquivamento is null
      and application.status <> 'CANCELLED'
  ) then
    raise exception 'Ciclo CDDI não localizado ou indisponível.';
  end if;
  if not exists (
    select 1
    from sigav."RL_APLICACAO_PESSOA" participant
    where participant.application_id = target_application_id
      and participant.person_id = target_subordinate_person_id
      and participant.participant_role = 'RESPONDENT'
      and participant.status not in ('BLOCKED', 'EXCLUDED')
  ) then
    raise exception 'O integrante não participa ativamente do ciclo CDDI selecionado.';
  end if;

  select full_name into v_leader_name
  from sigav."TB_PESSOA"
  where id = target_leader_person_id and active;
  if v_leader_name is null then
    raise exception 'Liderança ativa não encontrada.';
  end if;

  select full_name into v_subordinate_name
  from sigav."TB_PESSOA"
  where id = target_subordinate_person_id and active;
  if v_subordinate_name is null then
    raise exception 'Integrante ativo não encontrado.';
  end if;

  select * into v_previous
  from sigav."RT_LIDERANCA_CDDI"
  where application_id = target_application_id
    and subordinate_person_id = target_subordinate_person_id
    and status = 'ACTIVE'
    and valid_to is null
  order by valid_from desc
  limit 1
  for update;

  if v_previous.id is not null and v_previous.leader_person_id = target_leader_person_id then
    raise exception 'A pessoa já está vinculada a esta liderança no ciclo selecionado.';
  end if;

  if v_previous.id is not null then
    update sigav."RT_LIDERANCA_CDDI"
    set status = 'ENDED',
        valid_to = timezone('utc', now()),
        metadata = coalesce(metadata, '{}'::jsonb)
          || jsonb_build_object(
            'ended_by_admin', v_actor_id,
            'end_justification', v_justification
          ),
        updated_at = timezone('utc', now())
    where id = v_previous.id;
  end if;

  insert into sigav."RT_LIDERANCA_CDDI"(
    application_id,
    leader_person_id,
    subordinate_person_id,
    status,
    valid_from,
    origin,
    metadata
  ) values (
    target_application_id,
    target_leader_person_id,
    target_subordinate_person_id,
    'ACTIVE',
    timezone('utc', now()),
    'ADMIN_CORRECTION',
    jsonb_build_object(
      'created_by_admin', v_actor_id,
      'justification', v_justification,
      'replaces_link_id', v_previous.id
    )
  ) returning * into v_new_link;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'LEADERSHIP_LINK_CORRECTED',
    'CDDI_LEADERSHIP_LINK',
    v_new_link.id::text,
    target_application_id,
    case when v_previous.id is null then null else to_jsonb(v_previous) end,
    to_jsonb(v_new_link),
    jsonb_build_object(
      'justification', v_justification,
      'leaderName', v_leader_name,
      'subordinateName', v_subordinate_name
    )
  );

  return jsonb_build_object(
    'status', 'OK',
    'linkId', v_new_link.id,
    'leaderName', v_leader_name,
    'subordinateName', v_subordinate_name,
    'replacedLinkId', v_previous.id
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_DEFINIR_DT_ALTERACAO"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_INICIAR_OU_RETOMAR_CDDI"(target_application_code text DEFAULT 'CDDI-2026'::text, target_submission_type text DEFAULT 'AUTO'::text, target_subject_person_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid := sigav."FC_PESSOA_SESSAO"();
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_participant sigav."RL_APLICACAO_PESSOA"%rowtype;
  v_submission sigav."TB_SUBMISSAO"%rowtype;
  v_subject_person_id uuid;
  v_type text := upper(btrim(coalesce(target_submission_type, 'AUTO')));
  v_answers jsonb := '{}'::jsonb;
  v_can_edit boolean := false;
begin
  if sigav."FC_UID_SESSAO"() is null or v_person_id is null then
    raise exception 'Usuário autenticado sem cadastro institucional vinculado.';
  end if;

  select sa.*
    into v_application
  from sigav."TB_APLICACAO_PESQUISA" sa
  join sigav."TH_VERSAO_PESQUISA" sv on sv.id = sa.survey_version_id
  join sigav."TB_PESQUISA" s on s.id = sv.survey_id
  where sa.code = target_application_code
    and s.code = 'CDDI'
  limit 1;

  if not found then
    raise exception 'Aplicação CDDI não encontrada.';
  end if;

  select ap.*
    into v_participant
  from sigav."RL_APLICACAO_PESSOA" ap
  where ap.application_id = v_application.id
    and ap.person_id = v_person_id
    and ap.participant_role = 'RESPONDENT'
    and ap.status not in ('BLOCKED', 'EXCLUDED')
  order by ap.created_at desc
  limit 1;

  if not found then
    raise exception 'Seu cadastro não está elegível para esta aplicação.';
  end if;

  if v_type = 'AUTO' then
    v_subject_person_id := v_person_id;
  elsif v_type = 'CHEFIA' then
    v_subject_person_id := target_subject_person_id;
    if v_subject_person_id is null then
      raise exception 'A pessoa avaliada é obrigatória para a avaliação da chefia.';
    end if;

    if not exists (
      select 1
      from sigav."RT_LIDERANCA_CDDI" l
      where l.application_id = v_application.id
        and l.leader_person_id = v_person_id
        and l.subordinate_person_id = v_subject_person_id
        and l.status = 'ACTIVE'
        and l.valid_from <= now()
        and (l.valid_to is null or l.valid_to > now())
    ) then
      raise exception 'Não existe vínculo ativo com a pessoa avaliada.';
    end if;
  else
    raise exception 'Tipo de avaliação inválido.';
  end if;

  select s.*
    into v_submission
  from sigav."TB_SUBMISSAO" s
  where s.application_id = v_application.id
    and s.respondent_person_id = v_person_id
    and s.subject_person_id = v_subject_person_id
    and s.submission_type = v_type
    and s.status in ('DRAFT', 'SUBMITTED', 'VALIDATED')
  order by s.version desc, s.created_at desc
  limit 1;

  if not found then
    if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application.id) then
      return jsonb_build_object(
        'status', 'PERIOD_CLOSED',
        'applicationStatus', v_application.status,
        'canEdit', false,
        'submission', null,
        'answers', '{}'::jsonb
      );
    end if;

    insert into sigav."TB_SUBMISSAO" (
      application_id,
      participant_id,
      respondent_person_id,
      subject_person_id,
      submission_type,
      status,
      metadata
    ) values (
      v_application.id,
      v_participant.id,
      v_person_id,
      v_subject_person_id,
      v_type,
      'DRAFT',
      jsonb_build_object('origin', 'PLATFORM_WEB')
    )
    returning * into v_submission;

    if v_type = 'AUTO' then
      update sigav."RL_APLICACAO_PESSOA"
      set status = case when status in ('ELIGIBLE', 'INVITED') then 'IN_PROGRESS' else status end,
          started_at = coalesce(started_at, now())
      where id = v_participant.id;
    end if;
  end if;

  select coalesce(
    jsonb_object_agg(
      a.question_id::text,
      jsonb_build_object(
        'answerText', a.answer_text,
        'answerNumber', a.answer_number,
        'optionId', selected_option.option_id,
        'optionValue', qo.value
      )
    ),
    '{}'::jsonb
  )
  into v_answers
  from sigav."TB_RESPOSTA" a
  left join lateral (
    select ao.option_id
    from sigav."RL_RESPOSTA_OPCAO" ao
    where ao.answer_id = a.id
    order by ao.position nulls last, ao.created_at
    limit 1
  ) selected_option on true
  left join sigav."TB_OPCAO_PERGUNTA" qo on qo.id = selected_option.option_id
  where a.submission_id = v_submission.id;

  v_can_edit := v_submission.status = 'DRAFT'
    and sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application.id);

  return jsonb_build_object(
    'status', 'OK',
    'applicationStatus', v_application.status,
    'canEdit', v_can_edit,
    'submission', jsonb_build_object(
      'id', v_submission.id,
      'status', v_submission.status,
      'startedAt', v_submission.started_at,
      'submittedAt', v_submission.submitted_at,
      'updatedAt', v_submission.updated_at,
      'result', v_submission.calculated_result,
      'type', v_submission.submission_type
    ),
    'answers', v_answers
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_INICIAR_OU_RETOMAR_SUBM"(target_application_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid := sigav."FC_PESSOA_SESSAO"();
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_participant sigav."RL_APLICACAO_PESSOA"%rowtype;
  v_submission sigav."TB_SUBMISSAO"%rowtype;
  v_answers jsonb := '{}'::jsonb;
  v_can_edit boolean := false;
begin
  if sigav."FC_UID_SESSAO"() is null or v_person_id is null then raise exception 'Usuário autenticado sem cadastro institucional vinculado.'; end if;

  select * into v_application from sigav."TB_APLICACAO_PESQUISA" where code = btrim(target_application_code) limit 1;
  if v_application.id is null then raise exception 'Aplicação não encontrada.'; end if;

  select * into v_participant
  from sigav."RL_APLICACAO_PESSOA"
  where application_id = v_application.id
    and person_id = v_person_id
    and participant_role = 'RESPONDENT'
    and status not in ('REMOVED','INELIGIBLE','BLOCKED','EXCLUDED')
  order by created_at desc limit 1;

  if v_participant.id is null and not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Seu cadastro não está elegível para esta pesquisa.';
  end if;

  select * into v_submission
  from sigav."TB_SUBMISSAO"
  where application_id = v_application.id
    and respondent_person_id = v_person_id
    and subject_person_id = v_person_id
    and submission_type = 'AUTO'
    and status in ('DRAFT','SUBMITTED','VALIDATED')
  order by version desc, created_at desc limit 1;

  if v_submission.id is null then
    if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application.id) then
      return jsonb_build_object('status','PERIOD_CLOSED','applicationStatus',v_application.status,'canEdit',false,'submission',null,'answers','{}'::jsonb);
    end if;
    if v_participant.id is null then raise exception 'Administradores devem ser incluídos como participantes para responder esta pesquisa.'; end if;

    insert into sigav."TB_SUBMISSAO"(application_id,participant_id,respondent_person_id,subject_person_id,submission_type,status,metadata)
    values(v_application.id,v_participant.id,v_person_id,v_person_id,'AUTO','DRAFT',jsonb_build_object('origin','PLATFORM_WEB_GENERIC'))
    returning * into v_submission;

    update sigav."RL_APLICACAO_PESSOA"
    set status = case when status in ('ELIGIBLE','INVITED') then 'IN_PROGRESS' else status end,
        started_at = coalesce(started_at, now())
    where id = v_participant.id;
  end if;

  select coalesce(jsonb_object_agg(a.question_id::text,jsonb_build_object(
    'answerText',a.answer_text,'answerNumber',a.answer_number,'optionId',selected.option_id,'optionValue',qo.value
  )),'{}'::jsonb)
  into v_answers
  from sigav."TB_RESPOSTA" a
  left join lateral (
    select ao.option_id from sigav."RL_RESPOSTA_OPCAO" ao where ao.answer_id=a.id order by ao.position nulls last,ao.created_at limit 1
  ) selected on true
  left join sigav."TB_OPCAO_PERGUNTA" qo on qo.id=selected.option_id
  where a.submission_id=v_submission.id;

  v_can_edit := v_submission.status='DRAFT' and sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application.id);
  return jsonb_build_object(
    'status','OK','applicationStatus',v_application.status,'canEdit',v_can_edit,
    'submission',jsonb_build_object('id',v_submission.id,'status',v_submission.status,'startedAt',v_submission.started_at,'submittedAt',v_submission.submitted_at,'updatedAt',v_submission.updated_at,'type',v_submission.submission_type),
    'answers',v_answers
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_INICIAR_OU_RETOMAR_PESQ"(target_application_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person uuid := sigav."FC_PESSOA_SESSAO"();
  v_app sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_part sigav."RL_APLICACAO_PESSOA"%rowtype;
  v_sub sigav."TB_SUBMISSAO"%rowtype;
  v_answers jsonb := '{}'::jsonb;
  v_edit boolean := false;
begin
  if v_person is null then raise exception 'Cadastro institucional não identificado.'; end if;
  select * into v_app from sigav."TB_APLICACAO_PESQUISA" where code = btrim(target_application_code) limit 1;
  if v_app.id is null then raise exception 'Aplicação não encontrada.'; end if;
  if not sigav."FC_PODE_ACESSAR_CICLO"(v_app.id) then raise exception 'Seu cadastro não está autorizado para esta pesquisa.'; end if;

  select * into v_part from sigav."RL_APLICACAO_PESSOA"
  where application_id = v_app.id and person_id = v_person and participant_role = 'RESPONDENT'
    and status not in ('BLOCKED','EXCLUDED')
  order by created_at desc limit 1;

  if v_part.id is null and v_app.access_mode = 'INSTITUTIONAL' then
    insert into sigav."RL_APLICACAO_PESSOA"(application_id, person_id, participant_role, status, access_profile, metadata)
    values (v_app.id, v_person, 'RESPONDENT', 'ELIGIBLE', 'USUARIO_INSTITUCIONAL', jsonb_build_object('origin','INSTITUTIONAL_ACCESS'))
    on conflict (application_id, person_id, participant_role) do update
      set status = case when sigav."RL_APLICACAO_PESSOA".status in ('BLOCKED','EXCLUDED')
                        then sigav."RL_APLICACAO_PESSOA".status else 'ELIGIBLE' end,
          updated_at = timezone('utc', now())
    returning * into v_part;
  end if;
  if v_part.id is null and not sigav."FC_PODE_GERIR_PESQUISA"() then raise exception 'Seu cadastro não está elegível para esta pesquisa.'; end if;

  if v_app.anonymous then
    -- A submissão nunca recebe a identidade; quem sabe de quem é o rascunho é o
    -- bilhete, e só enquanto ele existir.
    select s.* into v_sub
    from sigav."TB_SUBMISSAO" s
    join sigav."TB_BILHETE_ANONIMO" b on b.sq_submissao = s.id
    where b.sq_aplicacao = v_app.id and b.sq_pessoa = v_person
    limit 1;

    -- Sem bilhete e com participação concluída, a pessoa já enviou: não há
    -- rascunho a retomar e um novo seria resposta em dobro.
    if v_sub.id is null and v_part.status = 'COMPLETED' then
      return jsonb_build_object(
        'status', 'ALREADY_SUBMITTED', 'applicationStatus', v_app.status,
        'anonymous', true, 'canEdit', false, 'submission', null, 'answers', '{}'::jsonb
      );
    end if;

    if v_sub.id is null and sigav."FC_CICLO_ACEITA_RESPOSTA"(v_app.id) then
      insert into sigav."TB_SUBMISSAO"(application_id, participant_id, respondent_person_id, subject_person_id, submission_type, status, metadata)
      values (v_app.id, null, null, null, 'RESPONSE', 'DRAFT', jsonb_build_object('origin','PLATFORM_WEB_ANONYMOUS'))
      returning * into v_sub;

      insert into sigav."TB_BILHETE_ANONIMO" (sq_aplicacao, sq_pessoa, sq_submissao)
      values (v_app.id, v_person, v_sub.id);

      update sigav."RL_APLICACAO_PESSOA"
      set status = 'IN_PROGRESS', started_at = coalesce(started_at, timezone('utc', now())), updated_at = timezone('utc', now())
      where id = v_part.id and status in ('ELIGIBLE','INVITED');
    end if;
  else
    select * into v_sub from sigav."TB_SUBMISSAO"
    where application_id = v_app.id and respondent_person_id = v_person and subject_person_id = v_person
      and submission_type in ('RESPONSE','AUTO') and status in ('DRAFT','SUBMITTED','VALIDATED')
    order by version desc, created_at desc limit 1;

    if v_sub.id is null and sigav."FC_CICLO_ACEITA_RESPOSTA"(v_app.id) then
      if v_part.id is null then raise exception 'Inclua seu cadastro como participante antes de responder.'; end if;
      insert into sigav."TB_SUBMISSAO"(application_id, participant_id, respondent_person_id, subject_person_id, submission_type, status, metadata)
      values (v_app.id, v_part.id, v_person, v_person, 'RESPONSE', 'DRAFT', jsonb_build_object('origin','PLATFORM_WEB_GENERIC'))
      returning * into v_sub;
      update sigav."RL_APLICACAO_PESSOA"
      set status = 'IN_PROGRESS', started_at = coalesce(started_at, timezone('utc', now())), updated_at = timezone('utc', now())
      where id = v_part.id and status in ('ELIGIBLE','INVITED');
    end if;
  end if;

  if v_sub.id is not null then
    select coalesce(jsonb_object_agg(a.question_id::text, jsonb_build_object(
      'answerText', a.answer_text, 'answerNumber', a.answer_number, 'answerBoolean', a.answer_boolean,
      'answerDate', a.answer_date, 'answerDatetime', a.answer_datetime, 'answerJson', a.answer_json,
      'optionIds', coalesce(o.ids, '[]'::jsonb))), '{}'::jsonb)
    into v_answers
    from sigav."TB_RESPOSTA" a
    left join lateral (
      select jsonb_agg(ao.option_id order by ao.position) ids
      from sigav."RL_RESPOSTA_OPCAO" ao where ao.answer_id = a.id
    ) o on true
    where a.submission_id = v_sub.id;
  end if;

  v_edit := v_sub.id is not null and v_sub.status = 'DRAFT' and sigav."FC_CICLO_ACEITA_RESPOSTA"(v_app.id);
  return jsonb_build_object(
    'status', case when sigav."FC_CICLO_ACEITA_RESPOSTA"(v_app.id) then 'OK' else 'PERIOD_CLOSED' end,
    'applicationStatus', v_app.status,
    'anonymous', v_app.anonymous,
    'canEdit', v_edit,
    'submission', case when v_sub.id is null then null else jsonb_build_object(
      'id', v_sub.id, 'status', v_sub.status, 'startedAt', v_sub.started_at,
      'submittedAt', v_sub.submitted_at, 'updatedAt', v_sub.updated_at) end,
    'answers', v_answers
  );
end $function$;

CREATE OR REPLACE FUNCTION sigav."FC_ENVIAR_SUBMISSAO_CDDI"(target_submission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid := sigav."FC_PESSOA_SESSAO"();
  v_submission sigav."TB_SUBMISSAO"%rowtype;
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_missing_count integer := 0;
  v_section record;
  v_behavior_average numeric(12,6);
  v_development_level numeric(12,6);
  v_section_result numeric(12,6);
  v_final_score numeric(12,6);
  v_submitted_at timestamptz := now();
begin
  if sigav."FC_UID_SESSAO"() is null or v_person_id is null then
    raise exception 'Usuário não identificado.';
  end if;

  select s.*
    into v_submission
  from sigav."TB_SUBMISSAO" s
  where s.id = target_submission_id
  for update;

  if not found
    or v_submission.respondent_person_id is distinct from v_person_id
    or v_submission.status <> 'DRAFT' then
    raise exception 'A avaliação não está disponível para envio.';
  end if;

  select sa.*
    into v_application
  from sigav."TB_APLICACAO_PESQUISA" sa
  where sa.id = v_submission.application_id;

  if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application.id) then
    raise exception 'O período de respostas está encerrado.';
  end if;

  select count(*)::integer
    into v_missing_count
  from sigav."TB_PERGUNTA_PESQUISA" q
  where q.survey_version_id = v_application.survey_version_id
    and q.required = true
    and not exists (
      select 1
      from sigav."TB_RESPOSTA" a
      where a.submission_id = v_submission.id
        and a.question_id = q.id
        and (
          (q.question_type = 'SCALE' and exists (
            select 1 from sigav."RL_RESPOSTA_OPCAO" ao where ao.answer_id = a.id
          ))
          or (q.question_type in ('SHORT_TEXT', 'LONG_TEXT') and nullif(btrim(a.answer_text), '') is not null)
          or (q.question_type not in ('SCALE', 'SHORT_TEXT', 'LONG_TEXT') and num_nonnulls(
            a.answer_text,
            a.answer_number,
            a.answer_boolean,
            a.answer_date,
            a.answer_datetime,
            a.answer_json
          ) > 0)
        )
    );

  if v_missing_count > 0 then
    raise exception 'Existem % pergunta(s) obrigatória(s) sem resposta.', v_missing_count;
  end if;

  for v_section in
    select ss.id
    from sigav."TB_SECAO_PESQUISA" ss
    where ss.survey_version_id = v_application.survey_version_id
      and coalesce(ss.code, '') <> 'FINAL'
    order by ss.position
  loop
    select
      avg(a.score) filter (where q.scoring ->> 'component' = 'BEHAVIOR'),
      max(a.score) filter (where q.scoring ->> 'component' = 'DEVELOPMENT_LEVEL')
      into v_behavior_average, v_development_level
    from sigav."TB_PERGUNTA_PESQUISA" q
    join sigav."TB_RESPOSTA" a
      on a.question_id = q.id
     and a.submission_id = v_submission.id
    where q.section_id = v_section.id;

    if v_behavior_average is null or v_development_level is null then
      raise exception 'Não foi possível calcular uma das competências.';
    end if;

    v_section_result := round((v_behavior_average * 0.70 + v_development_level * 0.30)::numeric, 4);

    insert into sigav."TB_RESULTADO_COMPET_CDDI" (
      submission_id,
      competency_section_id,
      behavior_average,
      development_level,
      result,
      calculation_version
    ) values (
      v_submission.id,
      v_section.id,
      round(v_behavior_average::numeric, 4),
      round(v_development_level::numeric, 4),
      v_section_result,
      'CDDI-2026-V1'
    )
    on conflict (submission_id, competency_section_id) do update
      set behavior_average = excluded.behavior_average,
          development_level = excluded.development_level,
          result = excluded.result,
          calculation_version = excluded.calculation_version,
          updated_at = now();
  end loop;

  select round(avg(cr.result)::numeric, 4)
    into v_final_score
  from sigav."TB_RESULTADO_COMPET_CDDI" cr
  where cr.submission_id = v_submission.id;

  update sigav."TB_SUBMISSAO"
  set status = 'SUBMITTED',
      submitted_at = v_submitted_at,
      calculated_result = v_final_score,
      metadata = metadata || jsonb_build_object('submitted_from', 'PLATFORM_WEB')
  where id = v_submission.id;

  if v_submission.submission_type = 'AUTO' then
    update sigav."RL_APLICACAO_PESSOA"
    set status = 'COMPLETED',
        completed_at = v_submitted_at
    where id = v_submission.participant_id;

    insert into sigav."TB_RESULTADO_FINAL_CDDI" (
      application_id,
      subject_person_id,
      auto_submission_id,
      auto_score,
      final_score,
      status,
      calculated_at
    ) values (
      v_submission.application_id,
      v_submission.subject_person_id,
      v_submission.id,
      v_final_score,
      null,
      'PARTIAL',
      null
    )
    on conflict (application_id, subject_person_id) do update
      set auto_submission_id = excluded.auto_submission_id,
          auto_score = excluded.auto_score,
          final_score = case
            when sigav."TB_RESULTADO_FINAL_CDDI".leader_score is null then null
            else round((excluded.auto_score * 0.40 + sigav."TB_RESULTADO_FINAL_CDDI".leader_score * 0.60)::numeric, 4)
          end,
          status = case
            when sigav."TB_RESULTADO_FINAL_CDDI".leader_score is null then 'PARTIAL'
            else 'CALCULATED'
          end,
          calculated_at = case
            when sigav."TB_RESULTADO_FINAL_CDDI".leader_score is null then null
            else v_submitted_at
          end,
          updated_at = now();
  else
    insert into sigav."TB_RESULTADO_FINAL_CDDI" (
      application_id,
      subject_person_id,
      leader_submission_id,
      leader_score,
      final_score,
      status,
      calculated_at
    ) values (
      v_submission.application_id,
      v_submission.subject_person_id,
      v_submission.id,
      v_final_score,
      null,
      'PARTIAL',
      null
    )
    on conflict (application_id, subject_person_id) do update
      set leader_submission_id = excluded.leader_submission_id,
          leader_score = excluded.leader_score,
          final_score = case
            when sigav."TB_RESULTADO_FINAL_CDDI".auto_score is null then null
            else round((sigav."TB_RESULTADO_FINAL_CDDI".auto_score * 0.40 + excluded.leader_score * 0.60)::numeric, 4)
          end,
          status = case
            when sigav."TB_RESULTADO_FINAL_CDDI".auto_score is null then 'PARTIAL'
            else 'CALCULATED'
          end,
          calculated_at = case
            when sigav."TB_RESULTADO_FINAL_CDDI".auto_score is null then null
            else v_submitted_at
          end,
          updated_at = now();
  end if;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    after_data,
    metadata
  ) values (
    v_person_id,
    'CDDI_SUBMISSION_SUBMITTED',
    'SUBMISSION',
    v_submission.id::text,
    v_submission.application_id,
    jsonb_build_object('status', 'SUBMITTED', 'result', v_final_score),
    jsonb_build_object('submission_type', v_submission.submission_type)
  );

  return jsonb_build_object(
    'status', 'OK',
    'submissionStatus', 'SUBMITTED',
    'submittedAt', v_submitted_at,
    'result', v_final_score
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ENVIAR_SUBMISSAO_PESQUISA"(target_submission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid := sigav."FC_PESSOA_SESSAO"();
  v_submission sigav."TB_SUBMISSAO"%rowtype;
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_bilhete sigav."TB_BILHETE_ANONIMO"%rowtype;
  v_participante uuid;
  v_missing integer;
  v_submitted_at timestamptz := now();
begin
  if v_person_id is null then raise exception 'Usuário não identificado.'; end if;
  select * into v_submission from sigav."TB_SUBMISSAO" where id = target_submission_id for update;
  if v_submission.id is null or v_submission.status <> 'DRAFT' then
    raise exception 'A resposta não está disponível para envio.';
  end if;
  select * into v_application from sigav."TB_APLICACAO_PESQUISA" where id = v_submission.application_id;

  -- A titularidade vem do bilhete quando o ciclo é anônimo, e da própria
  -- submissão quando não é.
  if v_application.anonymous then
    select * into v_bilhete from sigav."TB_BILHETE_ANONIMO"
    where sq_submissao = v_submission.id and sq_pessoa = v_person_id;
    if v_bilhete.sq_bilhete is null then raise exception 'A resposta não está disponível para envio.'; end if;
    select id into v_participante from sigav."RL_APLICACAO_PESSOA"
    where application_id = v_application.id and person_id = v_person_id and participant_role = 'RESPONDENT';
  else
    if v_submission.respondent_person_id is distinct from v_person_id then
      raise exception 'A resposta não está disponível para envio.';
    end if;
    v_participante := v_submission.participant_id;
  end if;

  if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application.id) then
    raise exception 'O período de respostas está encerrado.';
  end if;

  select count(*)::integer into v_missing
  from sigav."TB_PERGUNTA_PESQUISA" q
  where q.survey_version_id = v_application.survey_version_id and q.required
    and sigav."FC_PERGUNTA_VISIVEL"(v_submission.id, q.id)
    and not exists (
      select 1 from sigav."TB_RESPOSTA" a where a.submission_id = v_submission.id and a.question_id = q.id and (
        (q.question_type in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE') and exists(select 1 from sigav."RL_RESPOSTA_OPCAO" ao where ao.answer_id = a.id))
        or (q.question_type in ('SHORT_TEXT','LONG_TEXT') and nullif(btrim(a.answer_text),'') is not null)
        or (q.question_type in ('INTEGER','DECIMAL') and a.answer_number is not null)
        or (q.question_type = 'BOOLEAN' and a.answer_boolean is not null)
        or (q.question_type = 'DATE' and a.answer_date is not null)
        or (q.question_type = 'DATETIME' and a.answer_datetime is not null)
        or (q.question_type not in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE','SHORT_TEXT','LONG_TEXT','INTEGER','DECIMAL','BOOLEAN','DATE','DATETIME')
            and num_nonnulls(a.answer_text, a.answer_number, a.answer_boolean, a.answer_date, a.answer_datetime, a.answer_json) > 0)
      )
    );
  if v_missing > 0 then raise exception 'Existem % pergunta(s) obrigatória(s) sem resposta.', v_missing; end if;

  update sigav."TB_SUBMISSAO"
  set status = 'SUBMITTED', submitted_at = v_submitted_at, updated_at = v_submitted_at,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'submitted_from', case when v_application.anonymous then 'PLATFORM_WEB_ANONYMOUS' else 'PLATFORM_WEB_GENERIC' end)
  where id = v_submission.id;

  update sigav."RL_APLICACAO_PESSOA"
  set status = 'COMPLETED', completed_at = v_submitted_at, updated_at = v_submitted_at
  where id = v_participante;

  if v_application.anonymous then
    -- Os três atos que tornam o anonimato estrutural, nesta ordem.
    --
    -- 1. O bilhete é apagado: era a única linha ligando pessoa e submissão.
    delete from sigav."TB_BILHETE_ANONIMO" where sq_bilhete = v_bilhete.sq_bilhete;

    -- 2. A auditoria registra o envio **sem ator e sem a submissão**. Gravar
    --    `actor_person_id` com o id da submissão refaria o vínculo dentro da
    --    própria trilha de auditoria — seria anonimato desfeito pelo registro
    --    de que houve anonimato.
    insert into sigav."TL_EVENTO_AUDITORIA"(actor_person_id, event_type, entity_type, entity_id, application_id, after_data, metadata)
    values (null, 'ANONYMOUS_SUBMISSION_SUBMITTED', 'APPLICATION', v_application.id::text, v_application.id,
            jsonb_build_object('status','SUBMITTED'), jsonb_build_object('anonymous', true));
  else
    insert into sigav."TL_EVENTO_AUDITORIA"(actor_person_id, event_type, entity_type, entity_id, application_id, after_data, metadata)
    values (v_person_id, 'SURVEY_SUBMISSION_SUBMITTED', 'SUBMISSION', v_submission.id::text, v_submission.application_id,
            jsonb_build_object('status','SUBMITTED'), '{}'::jsonb);
  end if;

  return jsonb_build_object('status','OK','submissionStatus','SUBMITTED','submittedAt',v_submitted_at,'anonymous',v_application.anonymous);
end $function$;

CREATE OR REPLACE FUNCTION sigav."FC_SINCR_RESP_TECNICA_CDDI"(target_application_id uuid, target_subordinate_person_id uuid, target_leader_person_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_question_id uuid;
begin
  select question.id into v_question_id
  from sigav."TB_APLICACAO_PESQUISA" application
  join sigav."TB_PERGUNTA_PESQUISA" question on question.survey_version_id = application.survey_version_id
  where application.id = target_application_id
    and question.code = 'CHEFIA_RESPONSAVEL'
    and question.question_type = 'PERSON'
  order by question.position
  limit 1;

  if v_question_id is null then return; end if;

  insert into sigav."TB_RESPOSTA" (submission_id, question_id, answer_json, updated_at)
  select submission.id, v_question_id,
    jsonb_build_object('personId', target_leader_person_id, 'source', 'cddi_leadership_links'),
    timezone('utc', now())
  from sigav."TB_SUBMISSAO" submission
  where submission.application_id = target_application_id
    and submission.subject_person_id = target_subordinate_person_id
    and submission.submission_type in ('AUTO', 'CHEFIA')
    and submission.status = 'DRAFT'
  on conflict (submission_id, question_id) do update
    set answer_text = null,
        answer_number = null,
        answer_boolean = null,
        answer_date = null,
        answer_datetime = null,
        answer_json = excluded.answer_json,
        updated_at = excluded.updated_at;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SINCR_LINHAS_GESTOR_CDDI"(p_rows jsonb, p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_row jsonb;
  v_person sigav."TB_PESSOA"%rowtype;
  v_manager sigav."TB_PESSOA"%rowtype;
  v_application_id uuid;
  v_employee text;
  v_manager_name text;
  v_manager_email text;
  v_manager_matches integer;
  v_created integer := 0;
  v_updated integer := 0;
  v_preserved integer := 0;
  v_pending integer := 0;
begin
  if sigav."FC_PAPEL_SESSAO"() <> 'service_role' and not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Seu perfil não possui permissão para sincronizar chefias.';
  end if;
  if jsonb_typeof(p_rows) <> 'array' then
    raise exception 'O conteúdo da importação deve ser uma lista de pessoas.';
  end if;

  select id into v_application_id
  from sigav."TB_APLICACAO_PESQUISA"
  where code = 'CDDI-2026'
  order by created_at desc
  limit 1;

  if v_application_id is null then
    return jsonb_build_object('status', 'SKIPPED', 'reason', 'CDDI_APPLICATION_NOT_FOUND');
  end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_employee := btrim(coalesce(v_row->>'employeeNumber', ''));
    v_manager_name := nullif(btrim(coalesce(v_row->>'managerName', '')), '');
    v_manager_email := nullif(lower(btrim(coalesce(v_row->>'managerEmail', ''))), '');

    select * into v_person from sigav."TB_PESSOA" where employee_number = v_employee limit 1;
    if v_person.id is null then v_pending := v_pending + 1; continue; end if;

    update sigav."TB_PESSOA"
    set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'manager_name', v_manager_name,
      'manager_email', v_manager_email,
      'manager_resolution', case when v_manager_email is null then 'MISSING_EMAIL' else 'PENDING' end,
      'manager_import_batch_id', p_batch_id,
      'manager_imported_at', timezone('utc', now())
    )), updated_at = timezone('utc', now())
    where id = v_person.id;

    if v_manager_email is null then v_pending := v_pending + 1; continue; end if;

    select count(*) into v_manager_matches
    from sigav."TB_PESSOA" p
    where p.active = true and lower(btrim(coalesce(p.institutional_email, ''))) = v_manager_email;

    if v_manager_matches <> 1 then
      update sigav."TB_PESSOA"
      set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{manager_resolution}', to_jsonb(case when v_manager_matches = 0 then 'NOT_FOUND' else 'AMBIGUOUS' end::text), true)
      where id = v_person.id;
      v_pending := v_pending + 1;
      continue;
    end if;

    select * into v_manager
    from sigav."TB_PESSOA" p
    where p.active = true and lower(btrim(coalesce(p.institutional_email, ''))) = v_manager_email
    limit 1;

    if v_manager.id = v_person.id then
      update sigav."TB_PESSOA" set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{manager_resolution}', '"SELF_REFERENCE"'::jsonb, true) where id = v_person.id;
      v_pending := v_pending + 1;
      continue;
    end if;

    if exists (
      select 1 from sigav."RT_LIDERANCA_CDDI" l
      where l.application_id = v_application_id and l.subordinate_person_id = v_person.id
        and l.status = 'ACTIVE' and l.valid_to is null
        and l.origin in ('SELF_DECLARED', 'SELF_SERVICE', 'ADMIN_CORRECTION', 'ADMINISTRATIVE')
    ) then
      update sigav."TB_PESSOA" set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{manager_resolution}', '"PRESERVED_MANUAL_LINK"'::jsonb, true) where id = v_person.id;
      v_preserved := v_preserved + 1;
      continue;
    end if;

    if exists (
      select 1 from sigav."RT_LIDERANCA_CDDI" l
      where l.application_id = v_application_id and l.subordinate_person_id = v_person.id
        and l.status = 'ACTIVE' and l.valid_to is null
    ) then
      update sigav."RT_LIDERANCA_CDDI"
      set leader_person_id = v_manager.id,
          origin = 'PEOPLE_BASE_IMPORT',
          source_key = 'PEOPLE_BASE:' || v_person.employee_number,
          metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('manager_name', v_manager_name, 'manager_email', v_manager_email, 'import_batch_id', p_batch_id),
          updated_at = timezone('utc', now())
      where application_id = v_application_id and subordinate_person_id = v_person.id and status = 'ACTIVE' and valid_to is null;
      v_updated := v_updated + 1;
    else
      insert into sigav."RT_LIDERANCA_CDDI"(application_id, leader_person_id, subordinate_person_id, status, valid_from, origin, source_key, metadata)
      values(v_application_id, v_manager.id, v_person.id, 'ACTIVE', timezone('utc', now()), 'PEOPLE_BASE_IMPORT', 'PEOPLE_BASE:' || v_person.employee_number,
        jsonb_build_object('manager_name', v_manager_name, 'manager_email', v_manager_email, 'import_batch_id', p_batch_id));
      v_created := v_created + 1;
    end if;

    update sigav."TB_PESSOA" set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{manager_resolution}', '"RESOLVED"'::jsonb, true) where id = v_person.id;
  end loop;

  return jsonb_build_object('status', 'OK', 'created', v_created, 'updated', v_updated, 'preserved', v_preserved, 'pending', v_pending);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SINCR_AVATAR_GOOGLE"()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_user_id uuid := sigav."FC_UID_SESSAO"();
  v_picture text;
  v_person_id uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select coalesce(
    nullif(btrim(identity_data->>'picture'), ''),
    nullif(btrim(identity_data->>'avatar_url'), '')
  )
  into v_picture
  from sigav."TB_IDENTIDADE_OAUTH"
  where user_id = v_user_id
    and provider = 'google'
  order by last_sign_in_at desc nulls last
  limit 1;

  select id into v_person_id
  from sigav."TB_PESSOA"
  where auth_user_id = v_user_id
  limit 1;

  if v_person_id is null then
    return jsonb_build_object('status', 'UNLINKED', 'googleAvatarUrl', v_picture);
  end if;

  update sigav."TB_PESSOA"
  set metadata = (
        coalesce(metadata, '{}'::jsonb)
        - 'avatar_url'
        - 'avatar_source'
        - 'avatar_updated_at'
        - 'avatar_config'
        - 'google_avatar_url'
      ) || case
        when v_picture is null then '{}'::jsonb
        else jsonb_build_object(
          'google_avatar_url', v_picture,
          'avatar_url', v_picture,
          'avatar_source', 'GOOGLE',
          'avatar_updated_at', timezone('utc', now())
        )
      end,
      updated_at = timezone('utc', now())
  where id = v_person_id
    and (
      nullif(btrim(coalesce(metadata->>'avatar_url', '')), '') is distinct from v_picture
      or nullif(btrim(coalesce(metadata->>'google_avatar_url', '')), '') is distinct from v_picture
      or coalesce(metadata->>'avatar_source', '') is distinct from case when v_picture is null then '' else 'GOOGLE' end
      or metadata ? 'avatar_config'
    );

  return jsonb_build_object('status', 'OK', 'googleAvatarUrl', v_picture);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SINCR_RESP_LIDER_NOVA"()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_leader_person_id uuid;
begin
  if new.submission_type not in ('AUTO', 'CHEFIA') or new.status <> 'DRAFT' then return new; end if;

  select link.leader_person_id into v_leader_person_id
  from sigav."RT_LIDERANCA_CDDI" link
  where link.application_id = new.application_id
    and link.subordinate_person_id = new.subject_person_id
    and link.status = 'ACTIVE'
    and link.valid_from <= now()
    and (link.valid_to is null or link.valid_to > now())
  order by link.valid_from desc, link.created_at desc
  limit 1;

  if v_leader_person_id is not null then
    perform sigav."FC_SINCR_RESP_TECNICA_CDDI"(new.application_id, new.subject_person_id, v_leader_person_id);
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SINCR_LINHAS_BASE_PESSOA"(p_rows jsonb, p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_row jsonb;
  v_person sigav."TB_PESSOA"%rowtype;
  v_manager sigav."TB_PESSOA"%rowtype;
  v_employee text;
  v_email text;
  v_status text;
  v_active boolean;
  v_source_key text;
  v_manager_email text;
  v_manager_name text;
  v_admission_date text;
  v_import_metadata jsonb;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_identity_count integer := 0;
  v_link_count integer := 0;
  v_application_id uuid;
begin
  if sigav."FC_PAPEL_SESSAO"() <> 'service_role' and not sigav."FC_PODE_GERIR_PESQUISA"() then raise exception 'Seu perfil não possui permissão para atualizar a base de pessoas.'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'O conteúdo da importação deve ser uma lista de pessoas.'; end if;
  select id into v_application_id from sigav."TB_APLICACAO_PESQUISA" where code='CDDI-2026' limit 1;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_employee := btrim(coalesce(v_row->>'employeeNumber',''));
    v_email := lower(btrim(coalesce(v_row->>'institutionalEmail','')));
    v_status := upper(btrim(coalesce(v_row->>'status','ATIVO')));
    v_source_key := nullif(btrim(coalesce(v_row->>'participantKey',v_employee)),'');
    v_manager_email := lower(btrim(coalesce(v_row->>'managerEmail','')));
    v_manager_name := btrim(coalesce(v_row->>'managerName',''));
    v_admission_date := btrim(coalesce(v_row->>'admissionDate',''));
    if v_employee='' or btrim(coalesce(v_row->>'fullName',''))='' then raise exception 'Matrícula e nome são obrigatórios em todas as linhas.'; end if;
    v_active := v_status in ('ATIVO','NORMAL','ACTIVE','EM EXERCICIO','EM EXERCÍCIO');
    if v_status='' then v_active:=true; end if;

    select * into v_person from sigav."TB_PESSOA" p where p.employee_number=v_employee or (v_email<>'' and lower(btrim(coalesce(p.institutional_email,'')))=v_email) order by (p.employee_number=v_employee) desc,(p.auth_user_id is not null) desc,p.created_at limit 1 for update;
    v_import_metadata := jsonb_strip_nulls(jsonb_build_object(
      'detailed_status',nullif(btrim(coalesce(v_row->>'detailedStatus','')),''),
      'directorate',nullif(btrim(coalesce(v_row->>'directorate','')),''),
      'unit',nullif(btrim(coalesce(v_row->>'unit','')),''),
      'coordination',nullif(btrim(coalesce(v_row->>'coordination','')),''),
      'admission_date',nullif(v_admission_date,''),
      'manager_name',nullif(v_manager_name,''),
      'manager_email',nullif(v_manager_email,''),
      'source_row',nullif(v_row->>'rowNumber',''),
      'last_import_batch_id',p_batch_id,
      'last_imported_at',timezone('utc',now())
    ));

    if v_person.id is null then
      insert into sigav."TB_PESSOA"(employee_number,full_name,institutional_email,job_title,cost_center,workplace,employment_status,active,source_system,source_key,metadata)
      values(v_employee,btrim(v_row->>'fullName'),nullif(v_email,''),nullif(btrim(coalesce(v_row->>'jobTitle','')),''),nullif(btrim(coalesce(v_row->>'costCenter','')),''),nullif(btrim(coalesce(v_row->>'workplace','')),''),coalesce(nullif(v_status,''),'ATIVO'),v_active,'AGSUS_PEOPLE_BASE',coalesce(v_source_key,v_employee),v_import_metadata)
      returning * into v_person; v_inserted:=v_inserted+1;
    else
      update sigav."TB_PESSOA" set employee_number=v_employee,full_name=btrim(v_row->>'fullName'),institutional_email=coalesce(nullif(v_email,''),institutional_email),job_title=nullif(btrim(coalesce(v_row->>'jobTitle','')),''),cost_center=nullif(btrim(coalesce(v_row->>'costCenter','')),''),workplace=nullif(btrim(coalesce(v_row->>'workplace','')),''),employment_status=coalesce(nullif(v_status,''),employment_status,'ATIVO'),active=v_active,source_system=case when auth_user_id is null then 'AGSUS_PEOPLE_BASE' else source_system end,source_key=case when auth_user_id is null then coalesce(v_source_key,v_employee) else source_key end,metadata=coalesce(metadata,'{}'::jsonb)||v_import_metadata,updated_at=timezone('utc',now()) where id=v_person.id returning * into v_person; v_updated:=v_updated+1;
    end if;

    if v_email<>'' and coalesce((v_row->>'emailEligibleForAccess')::boolean,false) then
      insert into sigav."TB_IDENTIDADE_ACESSO"(person_id,identity_type,email,status,source,metadata)
      values(v_person.id,'INSTITUTIONAL_EMAIL',v_email,case when v_person.auth_user_id is null then 'PENDING' else 'ACTIVE' end,'AGSUS_PEOPLE_BASE',jsonb_build_object('import_batch_id',p_batch_id))
      on conflict(person_id,identity_type,email) do update set status=case when v_person.auth_user_id is null then sigav."TB_IDENTIDADE_ACESSO".status else 'ACTIVE' end,revoked_at=null,metadata=coalesce(sigav."TB_IDENTIDADE_ACESSO".metadata,'{}'::jsonb)||jsonb_build_object('import_batch_id',p_batch_id),updated_at=timezone('utc',now()); v_identity_count:=v_identity_count+1;
    end if;

    if v_application_id is not null and v_manager_email<>'' and v_manager_email<>v_email then
      select * into v_manager from sigav."TB_PESSOA" where lower(btrim(coalesce(institutional_email,'')))=v_manager_email order by (auth_user_id is not null) desc,created_at limit 1;
      if v_manager.id is null then
        insert into sigav."TB_PESSOA"(employee_number,full_name,institutional_email,employment_status,active,source_system,source_key,metadata)
        values('LIDER-'||upper(substr(md5(v_manager_email),1,16)),coalesce(nullif(v_manager_name,''),v_manager_email),v_manager_email,'ATIVO',true,'AGSUS_LEADERSHIP_REFERENCE',v_manager_email,jsonb_build_object('leadership_reference',true,'evaluation_exempt',true,'manager_email',v_manager_email,'created_from_import_batch',p_batch_id))
        returning * into v_manager;
      end if;
      if not coalesce((v_manager.metadata->>'evaluation_exempt')::boolean,false) and v_manager.source_system='AGSUS_LEADERSHIP_REFERENCE' then
        update sigav."TB_PESSOA" set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('leadership_reference',true,'evaluation_exempt',true),updated_at=timezone('utc',now()) where id=v_manager.id returning * into v_manager;
      end if;
      if not exists(select 1 from sigav."RT_LIDERANCA_CDDI" where application_id=v_application_id and subordinate_person_id=v_person.id and status='ACTIVE' and valid_to is null and origin='ADMIN_CORRECTION') then
        update sigav."RT_LIDERANCA_CDDI" set status='ENDED',valid_to=timezone('utc',now()),updated_at=timezone('utc',now()) where application_id=v_application_id and subordinate_person_id=v_person.id and status='ACTIVE' and valid_to is null and leader_person_id<>v_manager.id;
        insert into sigav."RT_LIDERANCA_CDDI"(application_id,leader_person_id,subordinate_person_id,status,valid_from,origin,source_key,metadata)
        values(v_application_id,v_manager.id,v_person.id,'ACTIVE',timezone('utc',now()),'PEOPLE_BASE_IMPORT',v_employee,jsonb_build_object('import_batch_id',p_batch_id,'manager_email',v_manager_email))
        on conflict(application_id,source_key) do update set leader_person_id=excluded.leader_person_id,subordinate_person_id=excluded.subordinate_person_id,status='ACTIVE',valid_to=null,origin='PEOPLE_BASE_IMPORT',metadata=coalesce(sigav."RT_LIDERANCA_CDDI".metadata,'{}'::jsonb)||excluded.metadata,updated_at=timezone('utc',now());
        v_link_count:=v_link_count+1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('status','OK','inserted',v_inserted,'updated',v_updated,'identitiesProcessed',v_identity_count,'leadershipLinksProcessed',v_link_count,'processed',v_inserted+v_updated);
end;$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SEM_ACENTO_MINUSCULA"(input_text text)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE PARALLEL SAFE
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select lower(translate(
    coalesce(input_text, ''),
    'ÁÀÂÃÄÅÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝŸáàâãäåéèêëíìîïóòôõöúùûüçñýÿ',
    'AAAAAAEEEEIIIIOOOOOUUUUCNYYaaaaaaeeeeiiiiooooouuuucnyy'
  ));
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ATUALIZAR_VISUAL_CICLO"(target_application_id uuid, banner_url text DEFAULT NULL::text, banner_path text DEFAULT NULL::text, banner_alt text DEFAULT NULL::text, hero_title text DEFAULT NULL::text, hero_subtitle text DEFAULT NULL::text, theme_variant text DEFAULT 'INSTITUTIONAL'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor_id uuid;
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_before jsonb;
  v_visual jsonb;
  v_theme text;
  v_banner_url text;
  v_banner_path text;
  v_banner_alt text;
  v_hero_title text;
  v_hero_subtitle text;
begin
  v_actor_id := sigav."FC_PESSOA_SESSAO"();
  if v_actor_id is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à Equipe Técnica.';
  end if;

  select *
  into v_application
  from sigav."TB_APLICACAO_PESQUISA"
  where id = target_application_id
  for update;

  if v_application.id is null then
    raise exception 'Aplicação de pesquisa não encontrada.';
  end if;

  v_theme := upper(coalesce(nullif(btrim(theme_variant), ''), 'INSTITUTIONAL'));
  if v_theme not in ('INSTITUTIONAL', 'CUSTOM') then
    raise exception 'Tema visual inválido.';
  end if;

  v_banner_url := nullif(btrim(banner_url), '');
  v_banner_path := nullif(btrim(banner_path), '');
  v_banner_alt := nullif(btrim(banner_alt), '');
  v_hero_title := nullif(btrim(hero_title), '');
  v_hero_subtitle := nullif(btrim(hero_subtitle), '');

  if length(coalesce(v_banner_alt, '')) > 180 then
    raise exception 'O texto alternativo deve ter no máximo 180 caracteres.';
  end if;
  if length(coalesce(v_hero_title, '')) > 160 then
    raise exception 'O título deve ter no máximo 160 caracteres.';
  end if;
  if length(coalesce(v_hero_subtitle, '')) > 500 then
    raise exception 'O subtítulo deve ter no máximo 500 caracteres.';
  end if;

  if v_theme = 'CUSTOM' then
    if v_banner_url is null or v_banner_path is null then
      raise exception 'Envie uma imagem antes de salvar o modo personalizado.';
    end if;
    if v_banner_alt is null then
      raise exception 'O texto alternativo é obrigatório para imagens personalizadas.';
    end if;
    if v_banner_url !~ '^https://[^[:space:]]+$' then
      raise exception 'A URL do banner deve utilizar HTTPS.';
    end if;
    if position('/storage/v1/object/public/survey-assets/' in v_banner_url) = 0
       or position(v_banner_path in v_banner_url) = 0 then
      raise exception 'A imagem personalizada deve pertencer ao armazenamento institucional.';
    end if;
    if v_banner_path !~ ('^' || target_application_id::text || '/[^/]+\.(jpg|jpeg|png|webp)$') then
      raise exception 'O caminho da imagem não pertence a esta aplicação.';
    end if;
  else
    v_banner_url := null;
    v_banner_path := null;
    v_banner_alt := null;
  end if;

  v_before := coalesce(v_application.settings->'visualIdentity', '{}'::jsonb);
  v_visual := jsonb_strip_nulls(jsonb_build_object(
    'bannerUrl', v_banner_url,
    'bannerPath', v_banner_path,
    'bannerAlt', v_banner_alt,
    'heroTitle', v_hero_title,
    'heroSubtitle', v_hero_subtitle,
    'themeVariant', v_theme
  ));

  update sigav."TB_APLICACAO_PESQUISA"
  set settings = jsonb_set(
        coalesce(settings, '{}'::jsonb),
        '{visualIdentity}',
        v_visual,
        true
      ),
      updated_at = timezone('utc', now())
  where id = target_application_id;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'APPLICATION_VISUAL_IDENTITY_UPDATED',
    'SURVEY_APPLICATION',
    target_application_id::text,
    target_application_id,
    v_before,
    v_visual,
    jsonb_build_object('applicationCode', v_application.code)
  );

  return jsonb_build_object(
    'status', 'OK',
    'applicationId', target_application_id,
    'visualIdentity', v_visual,
    'updatedAt', timezone('utc', now())
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ATUALIZAR_PESSOA_ADMIN"(target_person_id uuid, target_full_name text, target_institutional_email text DEFAULT NULL::text, target_job_title text DEFAULT NULL::text, target_cost_center text DEFAULT NULL::text, target_workplace text DEFAULT NULL::text, target_directorate text DEFAULT NULL::text, target_organizational_unit text DEFAULT NULL::text, target_coordination text DEFAULT NULL::text, target_employment_status text DEFAULT 'ATIVO'::text, target_active boolean DEFAULT true, target_justification text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor_id uuid;
  v_before sigav."TB_PESSOA"%rowtype;
  v_after sigav."TB_PESSOA"%rowtype;
  v_before_data jsonb;
  v_after_data jsonb;
  v_name text := btrim(coalesce(target_full_name, ''));
  v_email text := lower(btrim(coalesce(target_institutional_email, '')));
  v_status text := upper(btrim(coalesce(target_employment_status, 'ATIVO')));
  v_justification text := btrim(coalesce(target_justification, ''));
begin
  if not sigav."FC_TEM_MODULO"('ADMIN_TEAMS') then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;

  v_actor_id := sigav."FC_PESSOA_SESSAO"();
  if v_actor_id is null then
    raise exception 'Cadastro institucional do administrador não identificado.';
  end if;
  if length(v_justification) < 10 then
    raise exception 'Informe uma justificativa com pelo menos 10 caracteres.';
  end if;
  if v_name = '' then
    raise exception 'O nome completo é obrigatório.';
  end if;
  if v_status = '' then
    raise exception 'A situação funcional é obrigatória.';
  end if;
  if v_email <> '' and not sigav."FC_EMAIL_INSTITUC_PERMITIDO"(v_email) then
    raise exception 'Informe um e-mail institucional AgSUS válido.';
  end if;

  select * into v_before
  from sigav."TB_PESSOA"
  where id = target_person_id
  for update;

  if v_before.id is null then
    raise exception 'Pessoa não encontrada.';
  end if;

  if v_email <> '' and exists (
    select 1
    from sigav."TB_PESSOA" other
    where other.id <> target_person_id
      and lower(btrim(coalesce(other.institutional_email, ''))) = v_email
  ) then
    raise exception 'O e-mail informado já pertence a outra pessoa.';
  end if;

  v_before_data := jsonb_strip_nulls(jsonb_build_object(
    'personId', v_before.id,
    'employeeNumber', v_before.employee_number,
    'fullName', v_before.full_name,
    'institutionalEmail', v_before.institutional_email,
    'jobTitle', v_before.job_title,
    'costCenter', v_before.cost_center,
    'workplace', v_before.workplace,
    'directorate', nullif(btrim(coalesce(v_before.metadata->>'directorate', '')), ''),
    'organizationalUnit', nullif(btrim(coalesce(v_before.metadata->>'unit', '')), ''),
    'coordination', nullif(btrim(coalesce(v_before.metadata->>'coordination', '')), ''),
    'employmentStatus', v_before.employment_status,
    'active', v_before.active
  ));

  update sigav."TB_PESSOA"
  set full_name = v_name,
      institutional_email = nullif(v_email, ''),
      job_title = nullif(btrim(coalesce(target_job_title, '')), ''),
      cost_center = nullif(btrim(coalesce(target_cost_center, '')), ''),
      workplace = nullif(btrim(coalesce(target_workplace, '')), ''),
      employment_status = v_status,
      active = coalesce(target_active, true),
      metadata = (
        coalesce(metadata, '{}'::jsonb) - 'directorate' - 'unit' - 'coordination'
      ) || jsonb_strip_nulls(jsonb_build_object(
        'directorate', nullif(btrim(coalesce(target_directorate, '')), ''),
        'unit', nullif(btrim(coalesce(target_organizational_unit, '')), ''),
        'coordination', nullif(btrim(coalesce(target_coordination, '')), ''),
        'last_admin_update_by', v_actor_id,
        'last_admin_update_at', timezone('utc', now()),
        'last_admin_update_justification', v_justification
      )),
      updated_at = timezone('utc', now())
  where id = target_person_id
  returning * into v_after;

  v_after_data := jsonb_strip_nulls(jsonb_build_object(
    'personId', v_after.id,
    'employeeNumber', v_after.employee_number,
    'fullName', v_after.full_name,
    'institutionalEmail', v_after.institutional_email,
    'jobTitle', v_after.job_title,
    'costCenter', v_after.cost_center,
    'workplace', v_after.workplace,
    'directorate', nullif(btrim(coalesce(v_after.metadata->>'directorate', '')), ''),
    'organizationalUnit', nullif(btrim(coalesce(v_after.metadata->>'unit', '')), ''),
    'coordination', nullif(btrim(coalesce(v_after.metadata->>'coordination', '')), ''),
    'employmentStatus', v_after.employment_status,
    'active', v_after.active
  ));

  insert into sigav."TL_EVENTO_AUDITORIA"(
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'PERSON_FUNCTIONAL_DATA_UPDATED',
    'PERSON',
    target_person_id::text,
    v_before_data,
    v_after_data,
    jsonb_build_object('justification', v_justification)
  );

  return jsonb_build_object(
    'status', 'OK',
    'personId', v_after.id,
    'employeeNumber', v_after.employee_number,
    'fullName', v_after.full_name
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ATUALIZAR_PERGUNTA"(target_question_id uuid, question_title text, question_description text, question_type text, is_required boolean, question_options jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor_id uuid := sigav."FC_PESSOA_SESSAO"();
  v_version sigav."TH_VERSAO_PESQUISA"%rowtype;
  v_question sigav."TB_PERGUNTA_PESQUISA"%rowtype;
  v_application_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_options jsonb := coalesce(question_options, '[]'::jsonb);
  v_option jsonb;
  v_ordinal bigint;
  v_score numeric;
  v_title text := btrim(coalesce(question_title, ''));
  v_description text := nullif(btrim(question_description), '');
  v_type text := upper(btrim(coalesce(question_type, '')));
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à Equipe Técnica.';
  end if;
  if v_title = '' then
    raise exception 'Informe o enunciado da pergunta.';
  end if;
  if length(v_title) > 500 then
    raise exception 'O enunciado deve ter no máximo 500 caracteres.';
  end if;
  if length(coalesce(v_description, '')) > 2000 then
    raise exception 'A descrição deve ter no máximo 2.000 caracteres.';
  end if;
  if v_type not in (
    'SHORT_TEXT',
    'LONG_TEXT',
    'INTEGER',
    'DECIMAL',
    'DATE',
    'DATETIME',
    'BOOLEAN',
    'SINGLE_CHOICE',
    'MULTIPLE_CHOICE',
    'SCALE'
  ) then
    raise exception 'Tipo de pergunta não suportado neste construtor.';
  end if;
  if jsonb_typeof(v_options) <> 'array' then
    raise exception 'As alternativas devem ser enviadas em uma lista.';
  end if;
  if v_type in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE') then
    if jsonb_array_length(v_options) < 2 then
      raise exception 'Informe pelo menos duas alternativas.';
    end if;
    if jsonb_array_length(v_options) > 50 then
      raise exception 'Use no máximo 50 alternativas.';
    end if;

    for v_option, v_ordinal in
      select value, ordinality
      from jsonb_array_elements(v_options) with ordinality
    loop
      if jsonb_typeof(v_option) <> 'object' then
        raise exception 'A alternativa % possui um formato inválido.', v_ordinal;
      end if;
      if nullif(btrim(v_option->>'label'), '') is null then
        raise exception 'Informe o texto da alternativa %.', v_ordinal;
      end if;
      if length(btrim(v_option->>'label')) > 200 then
        raise exception 'A alternativa % deve ter no máximo 200 caracteres.', v_ordinal;
      end if;
      if length(coalesce(nullif(btrim(v_option->>'value'), ''), v_ordinal::text)) > 200 then
        raise exception 'O valor da alternativa % deve ter no máximo 200 caracteres.', v_ordinal;
      end if;
      if nullif(v_option->>'score', '') is not null then
        begin
          v_score := (v_option->>'score')::numeric;
        exception
          when invalid_text_representation or numeric_value_out_of_range then
            raise exception 'A pontuação da alternativa % é inválida.', v_ordinal;
        end;
      end if;
    end loop;

    if exists (
      select 1
      from (
        select lower(btrim(option_item->>'label')) as normalized_label
        from jsonb_array_elements(v_options) as option_rows(option_item)
        group by lower(btrim(option_item->>'label'))
        having count(*) > 1
      ) duplicate_options
    ) then
      raise exception 'As alternativas não podem ser repetidas.';
    end if;
  else
    v_options := '[]'::jsonb;
  end if;

  select sv.*
  into v_version
  from sigav."TH_VERSAO_PESQUISA" sv
  join sigav."TB_PERGUNTA_PESQUISA" question on question.survey_version_id = sv.id
  where question.id = target_question_id
    and sv.status = 'DRAFT'
  for update of sv;

  if v_version.id is null then
    raise exception 'Pergunta em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
  end if;

  select *
  into v_question
  from sigav."TB_PERGUNTA_PESQUISA"
  where id = target_question_id
    and survey_version_id = v_version.id
  for update;

  v_before := jsonb_build_object(
    'title', v_question.title,
    'description', v_question.description,
    'questionType', v_question.question_type,
    'required', v_question.required,
    'options', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', option_row.id,
          'label', option_row.label,
          'value', option_row.value,
          'score', option_row.score,
          'position', option_row.position
        ) order by option_row.position
      )
      from sigav."TB_OPCAO_PERGUNTA" option_row
      where option_row.question_id = target_question_id
    ), '[]'::jsonb)
  );

  update sigav."TB_PERGUNTA_PESQUISA"
  set title = v_title,
      description = v_description,
      question_type = v_type,
      required = coalesce(is_required, false),
      updated_at = timezone('utc', now())
  where id = target_question_id
  returning * into v_question;

  delete from sigav."TB_OPCAO_PERGUNTA"
  where question_id = target_question_id;

  if v_type in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE') then
    for v_option, v_ordinal in
      select value, ordinality
      from jsonb_array_elements(v_options) with ordinality
    loop
      insert into sigav."TB_OPCAO_PERGUNTA"(
        question_id,
        code,
        label,
        value,
        score,
        position,
        active,
        metadata
      ) values (
        target_question_id,
        'O' || lpad(v_ordinal::text, 2, '0'),
        btrim(v_option->>'label'),
        coalesce(nullif(btrim(v_option->>'value'), ''), v_ordinal::text),
        case when nullif(v_option->>'score', '') is null then null else (v_option->>'score')::numeric end,
        v_ordinal::integer,
        true,
        '{}'::jsonb
      );
    end loop;
  end if;

  v_after := jsonb_build_object(
    'title', v_question.title,
    'description', v_question.description,
    'questionType', v_question.question_type,
    'required', v_question.required,
    'options', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', option_row.id,
          'label', option_row.label,
          'value', option_row.value,
          'score', option_row.score,
          'position', option_row.position
        ) order by option_row.position
      )
      from sigav."TB_OPCAO_PERGUNTA" option_row
      where option_row.question_id = target_question_id
    ), '[]'::jsonb)
  );

  select app.id
  into v_application_id
  from sigav."TB_APLICACAO_PESQUISA" app
  where app.survey_version_id = v_version.id
  order by app.created_at desc
  limit 1;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'SURVEY_QUESTION_UPDATED',
    'SURVEY_QUESTION',
    target_question_id::text,
    v_application_id,
    v_before,
    v_after,
    jsonb_build_object('surveyId', v_version.survey_id, 'surveyVersionId', v_version.id)
  );

  return jsonb_build_object(
    'status', 'OK',
    'questionId', target_question_id,
    'updatedAt', timezone('utc', now())
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ATUALIZAR_SECAO"(target_section_id uuid, section_title text, section_description text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor_id uuid := sigav."FC_PESSOA_SESSAO"();
  v_version sigav."TH_VERSAO_PESQUISA"%rowtype;
  v_section sigav."TB_SECAO_PESQUISA"%rowtype;
  v_application_id uuid;
  v_before jsonb;
  v_after jsonb;
  v_title text := btrim(coalesce(section_title, ''));
  v_description text := nullif(btrim(section_description), '');
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à Equipe Técnica.';
  end if;
  if v_title = '' then
    raise exception 'Informe o título da seção.';
  end if;
  if length(v_title) > 160 then
    raise exception 'O título da seção deve ter no máximo 160 caracteres.';
  end if;
  if length(coalesce(v_description, '')) > 1000 then
    raise exception 'A descrição da seção deve ter no máximo 1.000 caracteres.';
  end if;

  select sv.*
  into v_version
  from sigav."TH_VERSAO_PESQUISA" sv
  join sigav."TB_SECAO_PESQUISA" sec on sec.survey_version_id = sv.id
  where sec.id = target_section_id
    and sv.status = 'DRAFT'
  for update of sv;

  if v_version.id is null then
    raise exception 'Seção em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
  end if;

  select *
  into v_section
  from sigav."TB_SECAO_PESQUISA"
  where id = target_section_id
    and survey_version_id = v_version.id
  for update;

  v_before := jsonb_build_object(
    'title', v_section.title,
    'description', v_section.description,
    'position', v_section.position
  );

  update sigav."TB_SECAO_PESQUISA"
  set title = v_title,
      description = v_description,
      updated_at = timezone('utc', now())
  where id = target_section_id
  returning * into v_section;

  v_after := jsonb_build_object(
    'title', v_section.title,
    'description', v_section.description,
    'position', v_section.position
  );

  select app.id
  into v_application_id
  from sigav."TB_APLICACAO_PESQUISA" app
  where app.survey_version_id = v_version.id
  order by app.created_at desc
  limit 1;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'SURVEY_SECTION_UPDATED',
    'SURVEY_SECTION',
    target_section_id::text,
    v_application_id,
    v_before,
    v_after,
    jsonb_build_object('surveyId', v_version.survey_id, 'surveyVersionId', v_version.id)
  );

  return jsonb_build_object(
    'status', 'OK',
    'sectionId', target_section_id,
    'updatedAt', timezone('utc', now())
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_VALIDAR_OPCAO_RESPOSTA"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  answer_question uuid;
  option_question uuid;
begin
  select question_id into answer_question from sigav."TB_RESPOSTA" where id = new.answer_id;
  select question_id into option_question from sigav."TB_OPCAO_PERGUNTA" where id = new.option_id;
  if answer_question is distinct from option_question then
    raise exception 'Alternativa não pertence à pergunta respondida.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_VALIDAR_PERGUNTA_RESPOSTA"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  app_version uuid;
  question_version uuid;
begin
  select sa.survey_version_id into app_version
  from sigav."TB_SUBMISSAO" s join sigav."TB_APLICACAO_PESQUISA" sa on sa.id = s.application_id
  where s.id = new.submission_id;
  select survey_version_id into question_version from sigav."TB_PERGUNTA_PESQUISA" where id = new.question_id;
  if app_version is distinct from question_version then
    raise exception 'Pergunta não pertence à versão aplicada.';
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_VALIDAR_RESULT_FINAL_CDDI"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  sid uuid;
  app uuid;
  subject uuid;
  stype text;
begin
  foreach sid in array array[new.auto_submission_id, new.leader_submission_id] loop
    if sid is null then continue; end if;
    select application_id, subject_person_id, submission_type into app, subject, stype
    from sigav."TB_SUBMISSAO" where id = sid;
    if app is distinct from new.application_id or subject is distinct from new.subject_person_id then
      raise exception 'A submissão não corresponde à aplicação e ao avaliado do resultado final.';
    end if;
    if sid = new.auto_submission_id and stype <> 'AUTO' then
      raise exception 'A submissão de autoavaliação deve ser do tipo AUTO.';
    end if;
    if sid = new.leader_submission_id and stype <> 'CHEFIA' then
      raise exception 'A submissão de chefia deve ser do tipo CHEFIA.';
    end if;
  end loop;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_VALIDAR_SUBMISSAO_CDDI"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  survey_code text;
begin
  select s.code into survey_code
  from sigav."TB_APLICACAO_PESQUISA" sa
  join sigav."TH_VERSAO_PESQUISA" sv on sv.id = sa.survey_version_id
  join sigav."TB_PESQUISA" s on s.id = sv.survey_id
  where sa.id = new.application_id;

  if survey_code <> 'CDDI' then
    return new;
  end if;

  if new.submission_type not in ('AUTO','CHEFIA') then
    raise exception 'O CDDI aceita somente submissões AUTO ou CHEFIA.';
  end if;

  if new.subject_person_id is null then
    raise exception 'A pessoa avaliada é obrigatória no CDDI.';
  end if;

  if new.submission_type = 'AUTO' and new.respondent_person_id is distinct from new.subject_person_id then
    raise exception 'Na autoavaliação, respondente e avaliado devem ser a mesma pessoa.';
  end if;

  if new.submission_type = 'CHEFIA' and not exists (
    select 1 from sigav."RT_LIDERANCA_CDDI" l
    where l.application_id = new.application_id
      and l.leader_person_id = new.respondent_person_id
      and l.subordinate_person_id = new.subject_person_id
      and l.status = 'ACTIVE'
      and l.valid_from <= timezone('utc', now())
      and (l.valid_to is null or l.valid_to > timezone('utc', now()))
  ) then
    raise exception 'Não existe vínculo ativo entre a liderança e a pessoa avaliada.';
  end if;

  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_VALIDAR_PARTIC_SUBMISSAO"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  app_anonymous boolean;
  participant_application uuid;
  participant_person uuid;
begin
  select anonymous into app_anonymous from sigav."TB_APLICACAO_PESQUISA" where id = new.application_id;
  if app_anonymous is null then raise exception 'Aplicação inexistente.'; end if;
  if not app_anonymous and (new.participant_id is null or new.respondent_person_id is null) then
    raise exception 'Aplicações identificadas exigem participante e respondente.';
  end if;
  if new.participant_id is not null then
    select application_id, person_id into participant_application, participant_person
    from sigav."RL_APLICACAO_PESSOA" where id = new.participant_id;
    if participant_application is distinct from new.application_id then
      raise exception 'Participante não pertence à aplicação.';
    end if;
    if participant_person is distinct from new.respondent_person_id then
      raise exception 'Respondente não corresponde ao participante.';
    end if;
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_VALIDAR_INTEGRIDADE_VERSAO"(target_survey_version_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_version sigav."TH_VERSAO_PESQUISA"%rowtype;
  v_issues jsonb := '[]'::jsonb;
  v_blocking_count integer := 0;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração.';
  end if;

  select *
  into v_version
  from sigav."TH_VERSAO_PESQUISA"
  where id = target_survey_version_id;

  if v_version.id is null then
    raise exception 'Versão da pesquisa não encontrada.';
  end if;

  with issue_rows as (
    select
      10 as priority,
      'NO_SECTIONS'::text as code,
      'NO_SECTIONS'::text as issue_id,
      'STRUCTURE'::text as category,
      'VERSION'::text as entity_type,
      v_version.id as entity_id,
      'Adicione pelo menos uma seção.'::text as message,
      'Crie a primeira seção no construtor.'::text as action
    where not exists (
      select 1
      from sigav."TB_SECAO_PESQUISA" section
      where section.survey_version_id = v_version.id
    )

    union all

    select
      20,
      'NO_QUESTIONS',
      'NO_QUESTIONS',
      'STRUCTURE',
      'VERSION',
      v_version.id,
      'Adicione pelo menos uma pergunta.',
      'Inclua uma pergunta em uma das seções.'
    where not exists (
      select 1
      from sigav."TB_PERGUNTA_PESQUISA" question
      where question.survey_version_id = v_version.id
    )

    union all

    select
      30,
      'BLANK_VERSION_TITLE',
      'BLANK_VERSION_TITLE',
      'STRUCTURE',
      'VERSION',
      v_version.id,
      'O título da versão está vazio.',
      'Informe um título para a versão antes de publicar.'
    where nullif(btrim(v_version.title), '') is null

    union all

    select
      40,
      'BLANK_SECTION_TITLE',
      'BLANK_SECTION_TITLE:' || section.id::text,
      'STRUCTURE',
      'SECTION',
      section.id,
      'Uma seção está sem título.',
      'Informe o título da seção no construtor.'
    from sigav."TB_SECAO_PESQUISA" section
    where section.survey_version_id = v_version.id
      and nullif(btrim(section.title), '') is null

    union all

    select
      50,
      'SECTION_TITLE_TOO_LONG',
      'SECTION_TITLE_TOO_LONG:' || section.id::text,
      'STRUCTURE',
      'SECTION',
      section.id,
      format('A seção "%s" ultrapassa 160 caracteres.', left(section.title, 80)),
      'Reduza o título da seção para até 160 caracteres.'
    from sigav."TB_SECAO_PESQUISA" section
    where section.survey_version_id = v_version.id
      and char_length(section.title) > 160

    union all

    select
      60,
      'EMPTY_SECTION',
      'EMPTY_SECTION:' || section.id::text,
      'STRUCTURE',
      'SECTION',
      section.id,
      format('A seção "%s" não possui perguntas.', left(section.title, 80)),
      'Adicione uma pergunta ou remova a seção vazia.'
    from sigav."TB_SECAO_PESQUISA" section
    where section.survey_version_id = v_version.id
      and not exists (
        select 1
        from sigav."TB_PERGUNTA_PESQUISA" question
        where question.section_id = section.id
      )

    union all

    select
      70,
      'BLANK_QUESTION_TITLE',
      'BLANK_QUESTION_TITLE:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      'Uma pergunta está sem enunciado.',
      'Informe o enunciado da pergunta no construtor.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question.survey_version_id = v_version.id
      and nullif(btrim(question.title), '') is null

    union all

    select
      80,
      'QUESTION_TITLE_TOO_LONG',
      'QUESTION_TITLE_TOO_LONG:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      format('A pergunta "%s" ultrapassa 500 caracteres.', left(question.title, 80)),
      'Reduza o enunciado para até 500 caracteres.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question.survey_version_id = v_version.id
      and char_length(question.title) > 500

    union all

    select
      90,
      'INSUFFICIENT_OPTIONS',
      'INSUFFICIENT_OPTIONS:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      format('A pergunta "%s" precisa de pelo menos duas alternativas ativas.', left(question.title, 80)),
      'Edite a pergunta e informe ao menos duas alternativas.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question.survey_version_id = v_version.id
      and question.question_type in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE')
      and (
        select count(*)
        from sigav."TB_OPCAO_PERGUNTA" option
        where option.question_id = question.id
          and option.active
      ) < 2

    union all

    select
      100,
      'BLANK_OPTION',
      'BLANK_OPTION:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      format('A pergunta "%s" possui alternativa sem rótulo ou valor.', left(question.title, 80)),
      'Preencha todas as alternativas e salve a pergunta novamente.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question.survey_version_id = v_version.id
      and exists (
        select 1
        from sigav."TB_OPCAO_PERGUNTA" option
        where option.question_id = question.id
          and option.active
          and (
            nullif(btrim(option.label), '') is null
            or nullif(btrim(option.value), '') is null
          )
      )

    union all

    select
      110,
      'OPTION_LABEL_TOO_LONG',
      'OPTION_LABEL_TOO_LONG:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      format('A pergunta "%s" possui alternativa com mais de 200 caracteres.', left(question.title, 80)),
      'Reduza cada alternativa para até 200 caracteres.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question.survey_version_id = v_version.id
      and exists (
        select 1
        from sigav."TB_OPCAO_PERGUNTA" option
        where option.question_id = question.id
          and option.active
          and char_length(option.label) > 200
      )

    union all

    select
      120,
      'DUPLICATE_OPTION_LABEL',
      'DUPLICATE_OPTION_LABEL:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      format('A pergunta "%s" possui alternativas repetidas.', left(question.title, 80)),
      'Use rótulos diferentes para cada alternativa.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question.survey_version_id = v_version.id
      and question.question_type in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE')
      and (
        select count(*)
        from sigav."TB_OPCAO_PERGUNTA" option
        where option.question_id = question.id
          and option.active
      ) <> (
        select count(distinct lower(btrim(option.label)))
        from sigav."TB_OPCAO_PERGUNTA" option
        where option.question_id = question.id
          and option.active
      )

    union all

    select
      130,
      'DUPLICATE_OPTION_VALUE',
      'DUPLICATE_OPTION_VALUE:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      format('A pergunta "%s" possui valores internos repetidos.', left(question.title, 80)),
      'Edite e salve novamente as alternativas para gerar valores únicos.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question.survey_version_id = v_version.id
      and question.question_type in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE')
      and (
        select count(*)
        from sigav."TB_OPCAO_PERGUNTA" option
        where option.question_id = question.id
          and option.active
      ) <> (
        select count(distinct lower(btrim(option.value)))
        from sigav."TB_OPCAO_PERGUNTA" option
        where option.question_id = question.id
          and option.active
      )

    union all

    select
      140,
      'SCALE_WITHOUT_SCORE',
      'SCALE_WITHOUT_SCORE:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      format('A escala "%s" possui alternativa sem pontuação.', left(question.title, 80)),
      'Edite e salve novamente a escala para preencher a pontuação.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question.survey_version_id = v_version.id
      and question.question_type = 'SCALE'
      and exists (
        select 1
        from sigav."TB_OPCAO_PERGUNTA" option
        where option.question_id = question.id
          and option.active
          and option.score is null
      )

    union all

    select
      150,
      'DUPLICATE_SCALE_SCORE',
      'DUPLICATE_SCALE_SCORE:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      format('A escala "%s" possui pontuações repetidas.', left(question.title, 80)),
      'Use uma pontuação diferente em cada alternativa da escala.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question.survey_version_id = v_version.id
      and question.question_type = 'SCALE'
      and (
        select count(*)
        from sigav."TB_OPCAO_PERGUNTA" option
        where option.question_id = question.id
          and option.active
          and option.score is not null
      ) <> (
        select count(distinct option.score)
        from sigav."TB_OPCAO_PERGUNTA" option
        where option.question_id = question.id
          and option.active
          and option.score is not null
      )

    union all

    select
      160,
      'UNEXPECTED_OPTIONS',
      'UNEXPECTED_OPTIONS:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      format('A pergunta "%s" possui alternativas incompatíveis com o tipo de resposta.', left(question.title, 80)),
      'Edite e salve novamente a pergunta para limpar as alternativas.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question.survey_version_id = v_version.id
      and question.question_type not in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE', 'MATRIX')
      and exists (
        select 1
        from sigav."TB_OPCAO_PERGUNTA" option
        where option.question_id = question.id
          and option.active
      )
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', issue_id,
          'code', code,
          'severity', 'BLOCKING',
          'category', category,
          'entityType', entity_type,
          'entityId', entity_id,
          'message', message,
          'action', action
        )
        order by priority, issue_id
      ),
      '[]'::jsonb
    ),
    count(*)::integer
  into v_issues, v_blocking_count
  from issue_rows;

  return jsonb_build_object(
    'status', 'OK',
    'versionId', v_version.id,
    'versionStatus', v_version.status,
    'valid', v_blocking_count = 0,
    'blockingCount', v_blocking_count,
    'issues', v_issues
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- 5. Autoverificação
-- ---------------------------------------------------------------------------

do $verificacao$
declare
  v_antigas text[] := array['add_person_to_my_team', 'add_survey_question', 'add_survey_section', 'application_accepts_responses', 'assign_admin_all_available_participants', 'assign_admin_application_participant', 'assign_admin_application_participants_bulk', 'can_access_application', 'can_audit_platform', 'can_edit_submission', 'can_manage_surveys', 'can_track_platform_presence', 'can_view_platform_presence', 'claim_my_access', 'create_and_assign_admin_participant', 'create_survey_draft', 'current_person_id', 'delete_survey_question', 'duplicate_survey_builder_item', 'effective_platform_modules', 'enforce_draft_survey_structure', 'fc_abrir_ciclos_agendados', 'fc_agendar_envio_manual', 'fc_alvo_visivel', 'fc_aplicar_publico_avaliacao', 'fc_arq_gravar', 'fc_arq_listar', 'fc_arq_obter', 'fc_arq_remover', 'fc_atualizar_marca_plataforma', 'fc_buscar_pessoas_publico', 'fc_cancela_ciclos_arq', 'fc_claims_sessao', 'fc_clonar_pesquisa', 'fc_clonar_pesquisa_estrutura', 'fc_concluir_email_participante', 'fc_condicao_atendida', 'fc_criar_nova_versao_pesquisa', 'fc_definir_comunicado_inicio', 'fc_definir_cor_barra_lateral', 'fc_definir_cor_painel_acesso', 'fc_definir_fundo_acesso', 'fc_definir_modelo_avaliacao', 'fc_definir_notificacao_email', 'fc_definir_permissoes_pessoa', 'fc_definir_presenca_plataforma', 'fc_definir_retencao_anonima', 'fc_definir_textos_email', 'fc_definir_textos_marca', 'fc_dimensao_publico_atende', 'fc_enviar_resp_anon', 'fc_excluir_pesquisa_arquivada', 'fc_excluir_pesquisa_rascunho', 'fc_excluir_regra_condicional', 'fc_expirar_pesquisas_arq', 'fc_expirar_rascunhos_anonimos', 'fc_gravar_resp_anon', 'fc_iniciar_resp_anon', 'fc_listar_acessos_paginados', 'fc_listar_audiencia_email', 'fc_listar_auditoria_pessoa', 'fc_listar_ciclos_lideranca', 'fc_listar_ciclos_lideranca_adm', 'fc_listar_ciclos_pesquisa', 'fc_listar_dimensoes_publico', 'fc_listar_envios_email', 'fc_listar_modelos_avaliacao', 'fc_listar_pesquisas_arq', 'fc_listar_pessoas_sem_chefia', 'fc_listar_presenca_online', 'fc_listar_regras_condicionais', 'fc_listar_respostas_ciclo', 'fc_normalizar_rotulo', 'fc_obter_ciclo_cddi_vigente', 'fc_obter_contexto_plataforma', 'fc_obter_form_anonimo', 'fc_obter_formulario_publico', 'fc_obter_marca_plataforma', 'fc_obter_marca_publica', 'fc_obter_minha_equipe', 'fc_obter_painel_pesquisa', 'fc_obter_regras_do_ciclo', 'fc_origens_da_regra', 'fc_papel_sessao', 'fc_pergunta_visivel', 'fc_pesquisar_equipe', 'fc_pesquisar_pessoa_admin', 'fc_planejar_publico_avaliacao', 'fc_previsualizar_publico_avaliacao', 'fc_registrar_presenca', 'fc_regra_gera_ciclo', 'fc_reivindicar_emails', 'fc_remover_resposta_pessoa', 'fc_resolver_publico_avaliacao', 'fc_salvar_regra_condicional', 'fc_sincronizar_estado_ciclos', 'fc_srv_concluir_email', 'fc_srv_consumir_limite_publico', 'fc_srv_enviar_resp_anon', 'fc_srv_expirar_rascunhos_anon', 'fc_srv_gravar_resp_anon', 'fc_srv_iniciar_resp_anon', 'fc_srv_obter_form_anonimo', 'fc_srv_registrar_erro_aplicacao', 'fc_srv_registrar_transporte', 'fc_srv_reivindicar_emails', 'fc_srv_resolver_identidade_oauth', 'fc_srv_verificar_contrato_rpc', 'fc_srv_verificar_migrations', 'fc_uid_sessao', 'fc_validar_ciclo_anonimo', 'fc_validar_foto_google', 'fc_validar_regra_publico', 'get_admin_people_base_summary', 'get_application_visual_settings', 'get_cddi_monitoring_dashboard', 'get_cddi_monitoring_dashboard_internal', 'get_my_cddi_context', 'get_my_cddi_identity', 'get_my_team_workspace', 'get_platform_health', 'get_public_survey_form', 'get_survey_builder', 'get_survey_dashboard', 'get_survey_operations', 'handle_cddi_leadership_answer_sync', 'has_active_role', 'has_platform_module', 'is_allowed_institutional_email', 'is_platform_administrator', 'list_admin_application_participants', 'list_admin_participant_applications', 'list_managed_surveys', 'list_my_survey_catalog', 'list_platform_admin_leadership_links', 'manage_survey_cycle', 'move_survey_question_to_section', 'normalize_agsus_google_oauth_referrer', 'remove_person_from_my_team', 'reorder_survey_builder_item', 'resolve_authenticated_person', 'rls_auto_enable', 'save_my_cddi_answer', 'save_my_survey_answer', 'search_admin_people_for_application', 'search_platform_admin_people', 'search_team_candidates', 'set_admin_application_participant_status', 'set_my_avatar_url', 'set_platform_admin_leadership_link', 'set_updated_at', 'start_or_resume_my_cddi_submission', 'start_or_resume_my_submission', 'start_or_resume_my_survey_submission', 'submit_my_cddi_submission', 'submit_my_survey_submission', 'sync_cddi_leader_technical_answer', 'sync_cddi_manager_rows', 'sync_my_google_avatar', 'sync_new_cddi_submission_leader_answer', 'sync_people_base_rows', 'unaccent_lower', 'update_application_visual_settings', 'update_platform_admin_person', 'update_survey_question', 'update_survey_section', 'validate_answer_option', 'validate_answer_question', 'validate_cddi_final_result', 'validate_cddi_submission', 'validate_submission_participant', 'validate_survey_version_integrity'];
  v_nome    text;
  v_restos  text;
begin
  foreach v_nome in array v_antigas loop
    select string_agg(p.proname, ', ' order by p.proname) into v_restos
      from pg_proc p
     where p.pronamespace = 'sigav'::regnamespace
       and pg_get_functiondef(p.oid) ~ ('sigav\.' || v_nome || '\s*\(');
    if v_restos is not null then
      raise exception 'Ainda chamam sigav.% sem aspas: %', v_nome, v_restos;
    end if;
  end loop;

  select string_agg(p.proname, ', ' order by p.proname) into v_restos
    from pg_proc p
   where p.pronamespace = 'sigav'::regnamespace
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and (p.proname <> upper(p.proname) or p.proname !~ '^FC_');
  if v_restos is not null then
    raise exception 'Funções fora do padrão FC_ MAIÚSCULO: %', v_restos;
  end if;

  select string_agg(t.tgname, ', ' order by t.tgname) into v_restos
    from pg_trigger t join pg_class c on c.oid = t.tgrelid
   where c.relnamespace = 'sigav'::regnamespace and not t.tgisinternal
     and (t.tgname <> upper(t.tgname) or t.tgname !~ '^(TBI|TAI|TBU|TAU|TBD|TAD|TBA|TAA|TIO|TRA)_');
  if v_restos is not null then
    raise exception 'Triggers fora do padrão: %', v_restos;
  end if;

  raise notice 'nomenclatura: 174 funções, 30 triggers e 37 policies em MAIÚSCULAS';
end
$verificacao$;

commit;
