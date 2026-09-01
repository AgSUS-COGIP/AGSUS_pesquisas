-- Colunas no padrão institucional — LOTE 6.
--
--   item 7 — prefixo semântico por natureza do dado (CO_, SQ_, DT_, DS_, NO_,
--            NU_, QT_, ST_, TP_, AU_ …);
--   item 3 — MAIÚSCULAS, português, no máximo 30 caracteres.
--
-- POR QUE EM LOTES: corpo de PL/pgSQL resolve identificador em execução, então
-- referência errada a coluna não falha ao criar a função — falha em produção,
-- no caminho que ninguém exercitou. A suíte cobre 24 das 174 funções e
-- `plpgsql_check` não está disponível neste cluster.
--
-- RISCO DESTE LOTE: 134 função(ões) referenciam estas 15 tabelas, e cada
-- substituição de corpo abaixo foi conferida contra a linha real. A rede está no
-- gerador (o trecho tem de casar exatamente, senão a geração falha) e no bloco de
-- autoverificação ao final, que acusa função que toque estas tabelas e não conste
-- da lista revisada.
--
-- VOCABULÁRIO, herdado das 108 colunas que o projeto já havia padronizado:
--   `id` e FK uuid    -> SQ_<entidade>      (como `sq_pessoa`, `sq_aplicacao`)
--   `created_at`      -> DT_INCLUSAO        \ par com AU_USUARIO_INCLUSAO e
--   `updated_at`      -> DT_ALTERACAO       / AU_USUARIO_ALTERACAO (item 7)
--   `*_by` (autoria)  -> AU_USUARIO_<ato>
--   `jsonb`           -> DS_                (como `tl_erro_aplicacao.ds_contexto`)
--
-- As constraints e os índices são renomeados junto: o nome deles aponta a
-- coluna, e `CK_OCORR_IMP_ROW_NUMBER` sobre uma coluna hoje chamada
-- `NU_LINHA` seria a mesma incoerência que este trabalho vem eliminar.
--
-- 226 colunas, 91 constraints, 51 índices.

begin;

-- ---------------------------------------------------------------------------
-- 1. Colunas (item 7)
-- ---------------------------------------------------------------------------

-- TB_CONFIG_PLATAFORMA
alter table sigav."TB_CONFIG_PLATAFORMA" rename column co_configuracao to "CO_CONFIGURACAO";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column no_organizacao to "NO_ORGANIZACAO";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column no_produto to "NO_PRODUTO";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column tx_url_logotipo to "DS_URL_LOGOTIPO";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column tx_caminho_logotipo to "DS_CAMINHO_LOGOTIPO";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column co_cor_principal to "CO_COR_PRINCIPAL";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column au_usuario_alteracao to "AU_USUARIO_ALTERACAO";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column dt_alteracao to "DT_ALTERACAO";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column tx_url_fundo_acesso to "DS_URL_FUNDO_ACESSO";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column tx_caminho_fundo_acesso to "DS_CAMINHO_FUNDO_ACESSO";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column co_cor_painel_acesso to "CO_COR_PAINEL_ACESSO";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column ds_produto to "DS_PRODUTO";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column tx_saudacao_acesso to "DS_SAUDACAO_ACESSO";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column tx_instrucao_acesso to "DS_INSTRUCAO_ACESSO";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column co_cor_barra_lateral to "CO_COR_BARRA_LATERAL";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column fl_presenca_online_ativa to "ST_PRESENCA_ONLINE_ATIVA";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column tx_perfis_visualizacao_presenca to "DS_PERFIS_VISUALIZACAO";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column tx_instrucao_email to "DS_INSTRUCAO_EMAIL";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column tx_rodape_email to "DS_RODAPE_EMAIL";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column nu_dias_retencao_rascunho_anonimo to "NU_DIAS_RETENCAO_RASC_ANON";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column fl_comunicado_inicio_ativo to "ST_COMUNICADO_INICIO_ATIVO";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column tx_comunicado_inicio_titulo to "NO_COMUNICADO_INICIO";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column tx_comunicado_inicio_mensagem to "DS_COMUNICADO_INICIO_MENSAGEM";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column tx_comunicado_inicio_link to "DS_COMUNICADO_INICIO_LINK";
alter table sigav."TB_CONFIG_PLATAFORMA" rename column tx_comunicado_inicio_rotulo_link to "DS_COMUNICADO_INICIO_ROTULO";

-- RT_LIDERANCA_CDDI
alter table sigav."RT_LIDERANCA_CDDI" rename column id to "SQ_LIDERANCA";
alter table sigav."RT_LIDERANCA_CDDI" rename column application_id to "SQ_APLICACAO";
alter table sigav."RT_LIDERANCA_CDDI" rename column leader_person_id to "SQ_PESSOA_LIDER";
alter table sigav."RT_LIDERANCA_CDDI" rename column subordinate_person_id to "SQ_PESSOA_SUBORDINADA";
alter table sigav."RT_LIDERANCA_CDDI" rename column status to "ST_SITUACAO";
alter table sigav."RT_LIDERANCA_CDDI" rename column valid_from to "DT_INICIO_VIGENCIA";
alter table sigav."RT_LIDERANCA_CDDI" rename column valid_to to "DT_FIM_VIGENCIA";
alter table sigav."RT_LIDERANCA_CDDI" rename column origin to "TP_ORIGEM";
alter table sigav."RT_LIDERANCA_CDDI" rename column source_key to "CO_CHAVE_ORIGEM";
alter table sigav."RT_LIDERANCA_CDDI" rename column metadata to "DS_METADADO";
alter table sigav."RT_LIDERANCA_CDDI" rename column created_at to "DT_INCLUSAO";
alter table sigav."RT_LIDERANCA_CDDI" rename column updated_at to "DT_ALTERACAO";

-- TB_RESPOSTA
alter table sigav."TB_RESPOSTA" rename column id to "SQ_RESPOSTA";
alter table sigav."TB_RESPOSTA" rename column submission_id to "SQ_SUBMISSAO";
alter table sigav."TB_RESPOSTA" rename column question_id to "SQ_PERGUNTA";
alter table sigav."TB_RESPOSTA" rename column answer_text to "DS_RESPOSTA";
alter table sigav."TB_RESPOSTA" rename column answer_number to "NU_RESPOSTA";
alter table sigav."TB_RESPOSTA" rename column answer_boolean to "ST_RESPOSTA";
alter table sigav."TB_RESPOSTA" rename column answer_date to "DT_RESPOSTA";
alter table sigav."TB_RESPOSTA" rename column answer_datetime to "DT_HORA_RESPOSTA";
alter table sigav."TB_RESPOSTA" rename column answer_json to "DS_RESPOSTA_JSON";
alter table sigav."TB_RESPOSTA" rename column score to "VL_NOTA";
alter table sigav."TB_RESPOSTA" rename column created_at to "DT_INCLUSAO";
alter table sigav."TB_RESPOSTA" rename column updated_at to "DT_ALTERACAO";

-- TB_OPCAO_PERGUNTA
alter table sigav."TB_OPCAO_PERGUNTA" rename column id to "SQ_OPCAO";
alter table sigav."TB_OPCAO_PERGUNTA" rename column question_id to "SQ_PERGUNTA";
alter table sigav."TB_OPCAO_PERGUNTA" rename column code to "CO_OPCAO";
alter table sigav."TB_OPCAO_PERGUNTA" rename column label to "NO_OPCAO";
alter table sigav."TB_OPCAO_PERGUNTA" rename column value to "DS_VALOR";
alter table sigav."TB_OPCAO_PERGUNTA" rename column score to "VL_NOTA";
alter table sigav."TB_OPCAO_PERGUNTA" rename column position to "NU_ORDEM";
alter table sigav."TB_OPCAO_PERGUNTA" rename column active to "ST_ATIVO";
alter table sigav."TB_OPCAO_PERGUNTA" rename column metadata to "DS_METADADO";
alter table sigav."TB_OPCAO_PERGUNTA" rename column created_at to "DT_INCLUSAO";
alter table sigav."TB_OPCAO_PERGUNTA" rename column updated_at to "DT_ALTERACAO";

-- TB_SECAO_PESQUISA
alter table sigav."TB_SECAO_PESQUISA" rename column id to "SQ_SECAO";
alter table sigav."TB_SECAO_PESQUISA" rename column survey_version_id to "SQ_VERSAO_PESQUISA";
alter table sigav."TB_SECAO_PESQUISA" rename column parent_section_id to "SQ_SECAO_PAI";
alter table sigav."TB_SECAO_PESQUISA" rename column code to "CO_SECAO";
alter table sigav."TB_SECAO_PESQUISA" rename column title to "NO_SECAO";
alter table sigav."TB_SECAO_PESQUISA" rename column description to "DS_SECAO";
alter table sigav."TB_SECAO_PESQUISA" rename column position to "NU_ORDEM";
alter table sigav."TB_SECAO_PESQUISA" rename column settings to "DS_CONFIGURACAO";
alter table sigav."TB_SECAO_PESQUISA" rename column created_at to "DT_INCLUSAO";
alter table sigav."TB_SECAO_PESQUISA" rename column updated_at to "DT_ALTERACAO";

-- TB_PESQUISA
alter table sigav."TB_PESQUISA" rename column id to "SQ_PESQUISA";
alter table sigav."TB_PESQUISA" rename column code to "CO_PESQUISA";
alter table sigav."TB_PESQUISA" rename column name to "NO_PESQUISA";
alter table sigav."TB_PESQUISA" rename column description to "DS_PESQUISA";
alter table sigav."TB_PESQUISA" rename column owner_unit_id to "SQ_UNIDADE_RESPONSAVEL";
alter table sigav."TB_PESQUISA" rename column status to "ST_SITUACAO";
alter table sigav."TB_PESQUISA" rename column settings to "DS_CONFIGURACAO";
alter table sigav."TB_PESQUISA" rename column created_by to "AU_USUARIO_INCLUSAO";
alter table sigav."TB_PESQUISA" rename column created_at to "DT_INCLUSAO";
alter table sigav."TB_PESQUISA" rename column updated_at to "DT_ALTERACAO";
alter table sigav."TB_PESQUISA" rename column st_modelo to "ST_MODELO";
alter table sigav."TB_PESQUISA" rename column tx_categoria_modelo to "TP_CATEGORIA_MODELO";
alter table sigav."TB_PESQUISA" rename column dt_arquivamento to "DT_ARQUIVAMENTO";

-- TB_SUBMISSAO
alter table sigav."TB_SUBMISSAO" rename column id to "SQ_SUBMISSAO";
alter table sigav."TB_SUBMISSAO" rename column application_id to "SQ_APLICACAO";
alter table sigav."TB_SUBMISSAO" rename column participant_id to "SQ_PARTICIPANTE";
alter table sigav."TB_SUBMISSAO" rename column respondent_person_id to "SQ_PESSOA_RESPONDENTE";
alter table sigav."TB_SUBMISSAO" rename column subject_person_id to "SQ_PESSOA_AVALIADA";
alter table sigav."TB_SUBMISSAO" rename column submission_type to "TP_SUBMISSAO";
alter table sigav."TB_SUBMISSAO" rename column status to "ST_SITUACAO";
alter table sigav."TB_SUBMISSAO" rename column started_at to "DT_INICIO";
alter table sigav."TB_SUBMISSAO" rename column submitted_at to "DT_ENVIO";
alter table sigav."TB_SUBMISSAO" rename column version to "NU_VERSAO";
alter table sigav."TB_SUBMISSAO" rename column calculated_result to "VL_RESULTADO";
alter table sigav."TB_SUBMISSAO" rename column metadata to "DS_METADADO";
alter table sigav."TB_SUBMISSAO" rename column created_at to "DT_INCLUSAO";
alter table sigav."TB_SUBMISSAO" rename column updated_at to "DT_ALTERACAO";

-- TB_PERGUNTA_PESQUISA
alter table sigav."TB_PERGUNTA_PESQUISA" rename column id to "SQ_PERGUNTA";
alter table sigav."TB_PERGUNTA_PESQUISA" rename column survey_version_id to "SQ_VERSAO_PESQUISA";
alter table sigav."TB_PERGUNTA_PESQUISA" rename column section_id to "SQ_SECAO";
alter table sigav."TB_PERGUNTA_PESQUISA" rename column code to "CO_PERGUNTA";
alter table sigav."TB_PERGUNTA_PESQUISA" rename column title to "NO_PERGUNTA";
alter table sigav."TB_PERGUNTA_PESQUISA" rename column description to "DS_PERGUNTA";
alter table sigav."TB_PERGUNTA_PESQUISA" rename column question_type to "TP_PERGUNTA";
alter table sigav."TB_PERGUNTA_PESQUISA" rename column required to "ST_OBRIGATORIA";
alter table sigav."TB_PERGUNTA_PESQUISA" rename column position to "NU_ORDEM";
alter table sigav."TB_PERGUNTA_PESQUISA" rename column validation to "DS_VALIDACAO";
alter table sigav."TB_PERGUNTA_PESQUISA" rename column display_logic to "DS_LOGICA_EXIBICAO";
alter table sigav."TB_PERGUNTA_PESQUISA" rename column scoring to "DS_PONTUACAO";
alter table sigav."TB_PERGUNTA_PESQUISA" rename column settings to "DS_CONFIGURACAO";
alter table sigav."TB_PERGUNTA_PESQUISA" rename column created_at to "DT_INCLUSAO";
alter table sigav."TB_PERGUNTA_PESQUISA" rename column updated_at to "DT_ALTERACAO";

-- TL_EVENTO_AUDITORIA
alter table sigav."TL_EVENTO_AUDITORIA" rename column id to "SQ_EVENTO";
alter table sigav."TL_EVENTO_AUDITORIA" rename column actor_person_id to "SQ_PESSOA_ATOR";
alter table sigav."TL_EVENTO_AUDITORIA" rename column event_type to "TP_EVENTO";
alter table sigav."TL_EVENTO_AUDITORIA" rename column entity_type to "TP_ENTIDADE";
alter table sigav."TL_EVENTO_AUDITORIA" rename column entity_id to "CO_ENTIDADE";
alter table sigav."TL_EVENTO_AUDITORIA" rename column application_id to "SQ_APLICACAO";
alter table sigav."TL_EVENTO_AUDITORIA" rename column request_id to "CO_REQUISICAO";
alter table sigav."TL_EVENTO_AUDITORIA" rename column ip_address to "CO_ENDERECO_IP";
alter table sigav."TL_EVENTO_AUDITORIA" rename column user_agent to "DS_AGENTE_USUARIO";
alter table sigav."TL_EVENTO_AUDITORIA" rename column before_data to "DS_DADO_ANTERIOR";
alter table sigav."TL_EVENTO_AUDITORIA" rename column after_data to "DS_DADO_POSTERIOR";
alter table sigav."TL_EVENTO_AUDITORIA" rename column metadata to "DS_METADADO";
alter table sigav."TL_EVENTO_AUDITORIA" rename column created_at to "DT_INCLUSAO";

-- RL_APLICACAO_PESSOA
alter table sigav."RL_APLICACAO_PESSOA" rename column id to "SQ_PARTICIPANTE";
alter table sigav."RL_APLICACAO_PESSOA" rename column application_id to "SQ_APLICACAO";
alter table sigav."RL_APLICACAO_PESSOA" rename column person_id to "SQ_PESSOA";
alter table sigav."RL_APLICACAO_PESSOA" rename column participant_role to "TP_PARTICIPANTE";
alter table sigav."RL_APLICACAO_PESSOA" rename column status to "ST_SITUACAO";
alter table sigav."RL_APLICACAO_PESSOA" rename column access_profile to "TP_ACESSO";
alter table sigav."RL_APLICACAO_PESSOA" rename column invited_at to "DT_CONVITE";
alter table sigav."RL_APLICACAO_PESSOA" rename column started_at to "DT_INICIO";
alter table sigav."RL_APLICACAO_PESSOA" rename column completed_at to "DT_CONCLUSAO";
alter table sigav."RL_APLICACAO_PESSOA" rename column metadata to "DS_METADADO";
alter table sigav."RL_APLICACAO_PESSOA" rename column created_at to "DT_INCLUSAO";
alter table sigav."RL_APLICACAO_PESSOA" rename column updated_at to "DT_ALTERACAO";

-- TH_VERSAO_PESQUISA
alter table sigav."TH_VERSAO_PESQUISA" rename column id to "SQ_VERSAO_PESQUISA";
alter table sigav."TH_VERSAO_PESQUISA" rename column survey_id to "SQ_PESQUISA";
alter table sigav."TH_VERSAO_PESQUISA" rename column version_number to "NU_VERSAO";
alter table sigav."TH_VERSAO_PESQUISA" rename column title to "NO_VERSAO";
alter table sigav."TH_VERSAO_PESQUISA" rename column description to "DS_VERSAO";
alter table sigav."TH_VERSAO_PESQUISA" rename column status to "ST_SITUACAO";
alter table sigav."TH_VERSAO_PESQUISA" rename column schema_version to "NU_VERSAO_SCHEMA";
alter table sigav."TH_VERSAO_PESQUISA" rename column settings to "DS_CONFIGURACAO";
alter table sigav."TH_VERSAO_PESQUISA" rename column published_at to "DT_PUBLICACAO";
alter table sigav."TH_VERSAO_PESQUISA" rename column created_by to "AU_USUARIO_INCLUSAO";
alter table sigav."TH_VERSAO_PESQUISA" rename column created_at to "DT_INCLUSAO";
alter table sigav."TH_VERSAO_PESQUISA" rename column updated_at to "DT_ALTERACAO";

-- TB_PESSOA
alter table sigav."TB_PESSOA" rename column id to "SQ_PESSOA";
alter table sigav."TB_PESSOA" rename column auth_user_id to "SQ_USUARIO_IDENTIDADE";
alter table sigav."TB_PESSOA" rename column employee_number to "CO_MATRICULA";
alter table sigav."TB_PESSOA" rename column full_name to "NO_PESSOA";
alter table sigav."TB_PESSOA" rename column institutional_email to "DS_EMAIL_INSTITUCIONAL";
alter table sigav."TB_PESSOA" rename column job_title to "NO_CARGO";
alter table sigav."TB_PESSOA" rename column cost_center to "CO_CENTRO_CUSTO";
alter table sigav."TB_PESSOA" rename column organizational_unit_id to "SQ_UNIDADE_ORGANIZACIONAL";
alter table sigav."TB_PESSOA" rename column workplace to "NO_LOCAL_TRABALHO";
alter table sigav."TB_PESSOA" rename column employment_status to "ST_VINCULO";
alter table sigav."TB_PESSOA" rename column active to "ST_ATIVO";
alter table sigav."TB_PESSOA" rename column source_system to "CO_SISTEMA_ORIGEM";
alter table sigav."TB_PESSOA" rename column source_key to "CO_CHAVE_ORIGEM";
alter table sigav."TB_PESSOA" rename column metadata to "DS_METADADO";
alter table sigav."TB_PESSOA" rename column created_at to "DT_INCLUSAO";
alter table sigav."TB_PESSOA" rename column updated_at to "DT_ALTERACAO";

-- TB_APLICACAO_PESQUISA
alter table sigav."TB_APLICACAO_PESQUISA" rename column id to "SQ_APLICACAO";
alter table sigav."TB_APLICACAO_PESQUISA" rename column survey_version_id to "SQ_VERSAO_PESQUISA";
alter table sigav."TB_APLICACAO_PESQUISA" rename column code to "CO_APLICACAO";
alter table sigav."TB_APLICACAO_PESQUISA" rename column name to "NO_APLICACAO";
alter table sigav."TB_APLICACAO_PESQUISA" rename column opens_at to "DT_ABERTURA";
alter table sigav."TB_APLICACAO_PESQUISA" rename column closes_at to "DT_ENCERRAMENTO";
alter table sigav."TB_APLICACAO_PESQUISA" rename column status to "ST_SITUACAO";
alter table sigav."TB_APLICACAO_PESQUISA" rename column allow_drafts to "ST_PERMITE_RASCUNHO";
alter table sigav."TB_APLICACAO_PESQUISA" rename column allow_resubmission to "ST_PERMITE_REENVIO";
alter table sigav."TB_APLICACAO_PESQUISA" rename column anonymous to "ST_ANONIMA";
alter table sigav."TB_APLICACAO_PESQUISA" rename column settings to "DS_CONFIGURACAO";
alter table sigav."TB_APLICACAO_PESQUISA" rename column created_by to "AU_USUARIO_INCLUSAO";
alter table sigav."TB_APLICACAO_PESQUISA" rename column created_at to "DT_INCLUSAO";
alter table sigav."TB_APLICACAO_PESQUISA" rename column updated_at to "DT_ALTERACAO";
alter table sigav."TB_APLICACAO_PESQUISA" rename column access_mode to "TP_ACESSO";
alter table sigav."TB_APLICACAO_PESQUISA" rename column nu_limiar_anonimato to "NU_LIMIAR_ANONIMATO";
alter table sigav."TB_APLICACAO_PESQUISA" rename column st_notificacao_email to "ST_NOTIFICACAO_EMAIL";

-- TB_IDENTIDADE_OAUTH
alter table sigav."TB_IDENTIDADE_OAUTH" rename column provider_id to "CO_IDENTIFICADOR_PROVEDOR";
alter table sigav."TB_IDENTIDADE_OAUTH" rename column user_id to "SQ_USUARIO";
alter table sigav."TB_IDENTIDADE_OAUTH" rename column identity_data to "DS_DADO_IDENTIDADE";
alter table sigav."TB_IDENTIDADE_OAUTH" rename column provider to "NO_PROVEDOR";
alter table sigav."TB_IDENTIDADE_OAUTH" rename column last_sign_in_at to "DT_ULTIMO_ACESSO";
alter table sigav."TB_IDENTIDADE_OAUTH" rename column created_at to "DT_INCLUSAO";
alter table sigav."TB_IDENTIDADE_OAUTH" rename column updated_at to "DT_ALTERACAO";
alter table sigav."TB_IDENTIDADE_OAUTH" rename column email to "DS_EMAIL";
alter table sigav."TB_IDENTIDADE_OAUTH" rename column id to "SQ_IDENTIDADE";

-- TB_USUARIO_IDENTIDADE
alter table sigav."TB_USUARIO_IDENTIDADE" rename column instance_id to "SQ_INSTANCIA";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column id to "SQ_USUARIO";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column aud to "TP_AUDIENCIA";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column role to "TP_PAPEL";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column email to "DS_EMAIL";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column encrypted_password to "DS_SENHA_CRIPTOGRAFADA";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column email_confirmed_at to "DT_CONFIRMACAO_EMAIL";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column invited_at to "DT_CONVITE";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column confirmation_token to "CO_TOKEN_CONFIRMACAO";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column confirmation_sent_at to "DT_ENVIO_CONFIRMACAO";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column recovery_token to "CO_TOKEN_RECUPERACAO";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column recovery_sent_at to "DT_ENVIO_RECUPERACAO";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column email_change_token_new to "CO_TOKEN_NOVO_EMAIL";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column email_change to "DS_NOVO_EMAIL";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column email_change_sent_at to "DT_ENVIO_ALTERACAO_EMAIL";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column last_sign_in_at to "DT_ULTIMO_ACESSO";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column raw_app_meta_data to "DS_METADADO_APLICACAO";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column raw_user_meta_data to "DS_METADADO_USUARIO";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column is_super_admin to "ST_SUPERADMINISTRADOR";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column created_at to "DT_INCLUSAO";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column updated_at to "DT_ALTERACAO";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column phone to "NU_TELEFONE";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column phone_confirmed_at to "DT_CONFIRMACAO_TELEFONE";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column phone_change to "NU_NOVO_TELEFONE";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column phone_change_token to "CO_TOKEN_ALTERACAO_TELEFONE";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column phone_change_sent_at to "DT_ENVIO_ALTERACAO_TELEFONE";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column confirmed_at to "DT_CONFIRMACAO";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column email_change_token_current to "CO_TOKEN_EMAIL_ATUAL";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column email_change_confirm_status to "ST_CONFIRMACAO_ALTERACAO_EMAIL";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column banned_until to "DT_BLOQUEIO_ATE";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column reauthentication_token to "CO_TOKEN_REAUTENTICACAO";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column reauthentication_sent_at to "DT_ENVIO_REAUTENTICACAO";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column is_sso_user to "ST_USUARIO_SSO";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column deleted_at to "DT_EXCLUSAO";
alter table sigav."TB_USUARIO_IDENTIDADE" rename column is_anonymous to "ST_ANONIMO";

-- ---------------------------------------------------------------------------
-- 2. Constraints e índices, realinhados à coluna nova (item 8)
-- ---------------------------------------------------------------------------



-- ---------------------------------------------------------------------------
-- 4. Funções que tocam estas colunas (134)
--
-- Cada substituição abaixo foi conferida contra a linha real da função. Onde o
-- nome da coluna é também chave JSON, ou pertence a outra tabela, a troca é
-- ancorada no alias — ou simplesmente não é feita.
-- ---------------------------------------------------------------------------

-- FC_AGENDAR_ENVIO_MANUAL(p_aplicacao uuid, p_pessoas uuid[])
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where "SQ_APLICACAO" = p_aplicacao;

  if v_application."SQ_APLICACAO" is null then
    raise exception 'Ciclo não encontrado.';
  end if;

  if v_application."ST_SITUACAO" <> 'OPEN' then
    raise exception 'O ciclo precisa estar aberto para receber envios.';
  end if;

  with elegiveis as (
    select p."SQ_PESSOA"
    from sigav."TB_PESSOA" p
    join sigav."RL_APLICACAO_PESSOA" ap
      on ap."SQ_PESSOA" = p."SQ_PESSOA" and ap."SQ_APLICACAO" = p_aplicacao
    where p."SQ_PESSOA" = any(p_pessoas)
      and ap."ST_SITUACAO" in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
      and p."ST_ATIVO"
      and p."DS_EMAIL_INSTITUCIONAL" ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      -- Bloqueia o clique duplo sem bloquear para sempre.
      --
      -- PENDENTE sempre impede: o lembrete está na fila e vai sair.
      -- PROCESSANDO só impede enquanto o lease vale — passados 15 minutos sem
      -- desfecho, o claim é tratado como abandonado, e insistir é legítimo.
      and not exists (
        select 1 from sigav."TL_EMAIL_PARTICIPANTE" t
        where t."SQ_APLICACAO" = p_aplicacao
          and t."SQ_PESSOA" = p."SQ_PESSOA"
          and t."TP_EMAIL" = 'manual_reminder'
          and (
            t."ST_ENVIO" = 'PENDENTE'
            or (t."ST_ENVIO" = 'PROCESSANDO'
                and t."DT_ALTERACAO" > timezone('utc', now()) - interval '15 minutes')
          )
      )
  )
  insert into sigav."TL_EMAIL_PARTICIPANTE" ("SQ_APLICACAO", "SQ_PESSOA", "TP_EMAIL")
  select p_aplicacao, e."SQ_PESSOA", 'manual_reminder'
  from elegiveis e;

  get diagnostics v_enfileiradas = row_count;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR", "TP_EVENTO", "TP_ENTIDADE", "CO_ENTIDADE", "SQ_APLICACAO",
    "DS_DADO_ANTERIOR", "DS_DADO_POSTERIOR", "DS_METADADO"
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

-- FC_APLICAR_PUBLICO_AVALIACAO(p_aplicacao uuid, p_regra jsonb, p_perfil_acesso text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  if not exists (select 1 from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = p_aplicacao) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  with plano as (
    select * from sigav."FC_PLANEJAR_PUBLICO_AVALIACAO"(p_aplicacao, p_regra)
  ),
  gravados as (
    insert into sigav."RL_APLICACAO_PESSOA"(
      "SQ_APLICACAO", "SQ_PESSOA", "TP_PARTICIPANTE", "ST_SITUACAO", "TP_ACESSO", "DT_CONVITE", "DS_METADADO"
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
    on conflict ("SQ_APLICACAO", "SQ_PESSOA", "TP_PARTICIPANTE") do update
      set "ST_SITUACAO" = excluded."ST_SITUACAO",
          -- O existente vem primeiro. `p_perfil_acesso` é o padrão para vínculo
          -- **novo**; usá-lo aqui reclassificaria quem já tem perfil próprio —
          -- reaplicar a regra rebaixaria a pessoa ao padrão sem ninguém pedir.
          "TP_ACESSO" = coalesce(sigav."RL_APLICACAO_PESSOA"."TP_ACESSO", excluded."TP_ACESSO"),
          "DT_CONVITE" = coalesce(sigav."RL_APLICACAO_PESSOA"."DT_CONVITE", excluded."DT_CONVITE"),
          "DS_METADADO" = coalesce(sigav."RL_APLICACAO_PESSOA"."DS_METADADO", '{}'::jsonb) || excluded."DS_METADADO",
          "DT_ALTERACAO" = timezone('utc', now())
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
  set "DS_CONFIGURACAO" = coalesce("DS_CONFIGURACAO", '{}'::jsonb) || jsonb_build_object('audience', v_regra_gravada),
      "DT_ALTERACAO" = timezone('utc', now())
  where "SQ_APLICACAO" = p_aplicacao;

  -- Auditoria pelo mecanismo existente. A regra inteira entra em `after_data`
  -- para que a decisão seja reconstruível depois, e os números da transição vão
  -- em `metadata` — inclusive os que descrevem o que **não** foi mexido.
  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR", "TP_EVENTO", "TP_ENTIDADE", "CO_ENTIDADE", "SQ_APLICACAO", "DS_DADO_POSTERIOR", "DS_METADADO"
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

-- FC_ATRIB_PARTICIPANTE(target_application_id uuid, target_person_id uuid, target_access_profile text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  if not exists(select 1 from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;
  if not exists(select 1 from sigav."TB_PESSOA" where "SQ_PESSOA" = target_person_id and "ST_ATIVO") then
    raise exception 'Pessoa ativa não localizada.';
  end if;

  select to_jsonb(ap.*) into v_before
  from sigav."RL_APLICACAO_PESSOA" ap
  where ap."SQ_APLICACAO" = target_application_id
    and ap."SQ_PESSOA" = target_person_id
    and ap."TP_PARTICIPANTE" = 'RESPONDENT';

  insert into sigav."RL_APLICACAO_PESSOA"(
    "SQ_APLICACAO", "SQ_PESSOA", "TP_PARTICIPANTE", "ST_SITUACAO", "TP_ACESSO", "DT_CONVITE", "DS_METADADO"
  ) values (
    target_application_id, target_person_id, 'RESPONDENT', 'ELIGIBLE',
    nullif(btrim(target_access_profile),''), timezone('utc',now()),
    jsonb_build_object('assigned_by',v_actor,'assigned_at',timezone('utc',now()))
  )
  on conflict ("SQ_APLICACAO", "SQ_PESSOA", "TP_PARTICIPANTE") do update
  set "ST_SITUACAO" = case
        when sigav."RL_APLICACAO_PESSOA"."ST_SITUACAO" in ('BLOCKED','EXCLUDED') then 'ELIGIBLE'
        else sigav."RL_APLICACAO_PESSOA"."ST_SITUACAO"
      end,
      "TP_ACESSO" = coalesce(nullif(btrim(excluded."TP_ACESSO"),''), sigav."RL_APLICACAO_PESSOA"."TP_ACESSO"),
      "DT_CONVITE" = coalesce(sigav."RL_APLICACAO_PESSOA"."DT_CONVITE", excluded."DT_CONVITE"),
      "DS_METADADO" = coalesce(sigav."RL_APLICACAO_PESSOA"."DS_METADADO",'{}'::jsonb)
        || jsonb_build_object('assigned_by',v_actor,'assigned_at',timezone('utc',now())),
      "DT_ALTERACAO" = timezone('utc',now())
  returning * into v_participant;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR","TP_EVENTO","TP_ENTIDADE","CO_ENTIDADE","SQ_APLICACAO","DS_DADO_ANTERIOR","DS_DADO_POSTERIOR","DS_METADADO"
  ) values (
    v_actor,'PARTICIPANT_ASSIGNED','APPLICATION_PARTICIPANT',v_participant."SQ_PARTICIPANTE"::text,
    target_application_id,v_before,to_jsonb(v_participant),jsonb_build_object('source','ADMIN_PARTICIPANTS')
  );

  return jsonb_build_object('status','OK','participantId',v_participant."SQ_PARTICIPANTE",'participantStatus',v_participant."ST_SITUACAO");
end;
$function$;

-- FC_ATRIB_PARTICIPANTE_LOTE(target_application_id uuid, target_person_ids uuid[], target_access_profile text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    where "SQ_APLICACAO" = target_application_id
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
      where "SQ_PESSOA" = v_person_id
        and "ST_ATIVO"
        and "ST_VINCULO" = 'ATIVO'
    ) then
      v_skipped_count := v_skipped_count + 1;
      continue;
    end if;

    select "ST_SITUACAO"
      into v_before_status
    from sigav."RL_APLICACAO_PESSOA"
    where "SQ_APLICACAO" = target_application_id
      and "SQ_PESSOA" = v_person_id
      and "TP_PARTICIPANTE" = 'RESPONDENT';

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
    "SQ_PESSOA_ATOR",
    "TP_EVENTO",
    "TP_ENTIDADE",
    "CO_ENTIDADE",
    "SQ_APLICACAO",
    "DS_DADO_POSTERIOR",
    "DS_METADADO"
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

-- FC_ATRIB_TODOS_DISPONIVEIS(target_application_id uuid, target_access_profile text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  if not exists(select 1 from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  with candidates as (
    select p."SQ_PESSOA", ap."ST_SITUACAO"
    from sigav."TB_PESSOA" p
    left join sigav."RL_APLICACAO_PESSOA" ap
      on ap."SQ_APLICACAO" = target_application_id
     and ap."SQ_PESSOA" = p."SQ_PESSOA"
     and ap."TP_PARTICIPANTE" = 'RESPONDENT'
    where p."ST_ATIVO"
      -- Sem `upper`/`btrim` e sem 'NORMAL': é o predicado que produção executa.
      and p."ST_VINCULO" = 'ATIVO'
      and coalesce((p."DS_METADADO"->>'evaluation_exempt')::boolean, false) = false
  ), upserted as (
    insert into sigav."RL_APLICACAO_PESSOA"(
      "SQ_APLICACAO", "SQ_PESSOA", "TP_PARTICIPANTE", "ST_SITUACAO", "TP_ACESSO", "DT_CONVITE", "DS_METADADO"
    )
    select
      target_application_id,
      "SQ_PESSOA",
      'RESPONDENT',
      'ELIGIBLE',
      nullif(btrim(target_access_profile), ''),
      timezone('utc', now()),
      jsonb_build_object('assigned_by', v_actor, 'assigned_at', timezone('utc', now()), 'source', 'ADMIN_ALL_AVAILABLE')
    from candidates
    where "ST_SITUACAO" is null or "ST_SITUACAO" in ('BLOCKED', 'EXCLUDED')
    on conflict ("SQ_APLICACAO", "SQ_PESSOA", "TP_PARTICIPANTE") do update
      set "ST_SITUACAO" = 'ELIGIBLE',
          "TP_ACESSO" = coalesce(nullif(btrim(excluded."TP_ACESSO"), ''), sigav."RL_APLICACAO_PESSOA"."TP_ACESSO"),
          "DT_CONVITE" = coalesce(sigav."RL_APLICACAO_PESSOA"."DT_CONVITE", excluded."DT_CONVITE"),
          "DS_METADADO" = coalesce(sigav."RL_APLICACAO_PESSOA"."DS_METADADO", '{}'::jsonb) || excluded."DS_METADADO",
          "DT_ALTERACAO" = timezone('utc', now())
    returning "SQ_PESSOA"
  )
  select
    count(*) filter(where c."ST_SITUACAO" is null),
    count(*) filter(where c."ST_SITUACAO" in ('BLOCKED', 'EXCLUDED')),
    count(*) filter(where c."ST_SITUACAO" not in ('BLOCKED', 'EXCLUDED') and c."ST_SITUACAO" is not null)
  into v_assigned, v_reactivated, v_skipped
  from candidates c;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR", "TP_EVENTO", "TP_ENTIDADE", "CO_ENTIDADE", "SQ_APLICACAO", "DS_DADO_POSTERIOR", "DS_METADADO"
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

-- FC_ATUALIZAR_MARCA_PLATAFORMA(no_organizacao_param text, no_produto_param text, tx_url_logotipo_param text, tx_caminho_param text, co_cor_principal_param text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  select to_jsonb("DS_CONFIGURACAO") - 'co_configuracao'
  into v_before
  from sigav."TB_CONFIG_PLATAFORMA" "DS_CONFIGURACAO"
  where "CO_CONFIGURACAO" = 1
  for update;

  update sigav."TB_CONFIG_PLATAFORMA"
  set "NO_ORGANIZACAO" = v_organization_name,
      "NO_PRODUTO" = v_product_name,
      "DS_URL_LOGOTIPO" = v_logo_url,
      "DS_CAMINHO_LOGOTIPO" = v_logo_path,
      "CO_COR_PRINCIPAL" = v_primary_color,
      "AU_USUARIO_ALTERACAO" = v_actor_id,
      "DT_ALTERACAO" = timezone('utc', now())
  where "CO_CONFIGURACAO" = 1;

  select to_jsonb("DS_CONFIGURACAO") - 'co_configuracao'
  into v_after
  from sigav."TB_CONFIG_PLATAFORMA" "DS_CONFIGURACAO"
  where "CO_CONFIGURACAO" = 1;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    "SQ_PESSOA_ATOR",
    "TP_EVENTO",
    "TP_ENTIDADE",
    "CO_ENTIDADE",
    "DS_DADO_ANTERIOR",
    "DS_DADO_POSTERIOR",
    "DS_METADADO"
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

-- FC_ATUALIZAR_PERGUNTA(target_question_id uuid, question_title text, question_description text, question_type text, is_required boolean, question_options jsonb)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
      select "DS_VALOR", ordinality
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
  join sigav."TB_PERGUNTA_PESQUISA" question on question."SQ_VERSAO_PESQUISA" = sv."SQ_VERSAO_PESQUISA"
  where question."SQ_PERGUNTA" = target_question_id
    and sv."ST_SITUACAO" = 'DRAFT'
  for update of sv;

  if v_version."SQ_VERSAO_PESQUISA" is null then
    raise exception 'Pergunta em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
  end if;

  select *
  into v_question
  from sigav."TB_PERGUNTA_PESQUISA"
  where "SQ_PERGUNTA" = target_question_id
    and "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
  for update;

  v_before := jsonb_build_object(
    'title', v_question."NO_PERGUNTA",
    'description', v_question."DS_PERGUNTA",
    'questionType', v_question."TP_PERGUNTA",
    'required', v_question."ST_OBRIGATORIA",
    'options', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', option_row."SQ_OPCAO",
          'label', option_row."NO_OPCAO",
          'value', option_row."DS_VALOR",
          'score', option_row."VL_NOTA",
          'position', option_row."NU_ORDEM"
        ) order by option_row."NU_ORDEM"
      )
      from sigav."TB_OPCAO_PERGUNTA" option_row
      where option_row."SQ_PERGUNTA" = target_question_id
    ), '[]'::jsonb)
  );

  update sigav."TB_PERGUNTA_PESQUISA"
  set "NO_PERGUNTA" = v_title,
      "DS_PERGUNTA" = v_description,
      "TP_PERGUNTA" = v_type,
      "ST_OBRIGATORIA" = coalesce(is_required, false),
      "DT_ALTERACAO" = timezone('utc', now())
  where "SQ_PERGUNTA" = target_question_id
  returning * into v_question;

  delete from sigav."TB_OPCAO_PERGUNTA"
  where "SQ_PERGUNTA" = target_question_id;

  if v_type in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE') then
    for v_option, v_ordinal in
      select "DS_VALOR", ordinality
      from jsonb_array_elements(v_options) with ordinality
    loop
      insert into sigav."TB_OPCAO_PERGUNTA"(
        "SQ_PERGUNTA",
        "CO_OPCAO",
        "NO_OPCAO",
        "DS_VALOR",
        "VL_NOTA",
        "NU_ORDEM",
        "ST_ATIVO",
        "DS_METADADO"
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
    'title', v_question."NO_PERGUNTA",
    'description', v_question."DS_PERGUNTA",
    'questionType', v_question."TP_PERGUNTA",
    'required', v_question."ST_OBRIGATORIA",
    'options', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', option_row."SQ_OPCAO",
          'label', option_row."NO_OPCAO",
          'value', option_row."DS_VALOR",
          'score', option_row."VL_NOTA",
          'position', option_row."NU_ORDEM"
        ) order by option_row."NU_ORDEM"
      )
      from sigav."TB_OPCAO_PERGUNTA" option_row
      where option_row."SQ_PERGUNTA" = target_question_id
    ), '[]'::jsonb)
  );

  select app."SQ_APLICACAO"
  into v_application_id
  from sigav."TB_APLICACAO_PESQUISA" app
  where app."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
  order by app."DT_INCLUSAO" desc
  limit 1;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR",
    "TP_EVENTO",
    "TP_ENTIDADE",
    "CO_ENTIDADE",
    "SQ_APLICACAO",
    "DS_DADO_ANTERIOR",
    "DS_DADO_POSTERIOR",
    "DS_METADADO"
  ) values (
    v_actor_id,
    'SURVEY_QUESTION_UPDATED',
    'SURVEY_QUESTION',
    target_question_id::text,
    v_application_id,
    v_before,
    v_after,
    jsonb_build_object('surveyId', v_version."SQ_PESQUISA", 'surveyVersionId', v_version."SQ_VERSAO_PESQUISA")
  );

  return jsonb_build_object(
    'status', 'OK',
    'questionId', target_question_id,
    'updatedAt', timezone('utc', now())
  );
end;
$function$;

-- FC_ATUALIZAR_PESSOA_ADMIN(target_person_id uuid, target_full_name text, target_institutional_email text, target_job_title text, target_cost_center text, target_workplace text, target_directorate text, target_organizational_unit text, target_coordination text, target_employment_status text, target_active boolean, target_justification text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where "SQ_PESSOA" = target_person_id
  for update;

  if v_before."SQ_PESSOA" is null then
    raise exception 'Pessoa não encontrada.';
  end if;

  if v_email <> '' and exists (
    select 1
    from sigav."TB_PESSOA" other
    where other."SQ_PESSOA" <> target_person_id
      and lower(btrim(coalesce(other."DS_EMAIL_INSTITUCIONAL", ''))) = v_email
  ) then
    raise exception 'O e-mail informado já pertence a outra pessoa.';
  end if;

  v_before_data := jsonb_strip_nulls(jsonb_build_object(
    'personId', v_before."SQ_PESSOA",
    'employeeNumber', v_before."CO_MATRICULA",
    'fullName', v_before."NO_PESSOA",
    'institutionalEmail', v_before."DS_EMAIL_INSTITUCIONAL",
    'jobTitle', v_before."NO_CARGO",
    'costCenter', v_before."CO_CENTRO_CUSTO",
    'workplace', v_before."NO_LOCAL_TRABALHO",
    'directorate', nullif(btrim(coalesce(v_before."DS_METADADO"->>'directorate', '')), ''),
    'organizationalUnit', nullif(btrim(coalesce(v_before."DS_METADADO"->>'unit', '')), ''),
    'coordination', nullif(btrim(coalesce(v_before."DS_METADADO"->>'coordination', '')), ''),
    'employmentStatus', v_before."ST_VINCULO",
    'active', v_before."ST_ATIVO"
  ));

  update sigav."TB_PESSOA"
  set "NO_PESSOA" = v_name,
      "DS_EMAIL_INSTITUCIONAL" = nullif(v_email, ''),
      "NO_CARGO" = nullif(btrim(coalesce(target_job_title, '')), ''),
      "CO_CENTRO_CUSTO" = nullif(btrim(coalesce(target_cost_center, '')), ''),
      "NO_LOCAL_TRABALHO" = nullif(btrim(coalesce(target_workplace, '')), ''),
      "ST_VINCULO" = v_status,
      "ST_ATIVO" = coalesce(target_active, true),
      "DS_METADADO" = (
        coalesce("DS_METADADO", '{}'::jsonb) - 'directorate' - 'unit' - 'coordination'
      ) || jsonb_strip_nulls(jsonb_build_object(
        'directorate', nullif(btrim(coalesce(target_directorate, '')), ''),
        'unit', nullif(btrim(coalesce(target_organizational_unit, '')), ''),
        'coordination', nullif(btrim(coalesce(target_coordination, '')), ''),
        'last_admin_update_by', v_actor_id,
        'last_admin_update_at', timezone('utc', now()),
        'last_admin_update_justification', v_justification
      )),
      "DT_ALTERACAO" = timezone('utc', now())
  where "SQ_PESSOA" = target_person_id
  returning * into v_after;

  v_after_data := jsonb_strip_nulls(jsonb_build_object(
    'personId', v_after."SQ_PESSOA",
    'employeeNumber', v_after."CO_MATRICULA",
    'fullName', v_after."NO_PESSOA",
    'institutionalEmail', v_after."DS_EMAIL_INSTITUCIONAL",
    'jobTitle', v_after."NO_CARGO",
    'costCenter', v_after."CO_CENTRO_CUSTO",
    'workplace', v_after."NO_LOCAL_TRABALHO",
    'directorate', nullif(btrim(coalesce(v_after."DS_METADADO"->>'directorate', '')), ''),
    'organizationalUnit', nullif(btrim(coalesce(v_after."DS_METADADO"->>'unit', '')), ''),
    'coordination', nullif(btrim(coalesce(v_after."DS_METADADO"->>'coordination', '')), ''),
    'employmentStatus', v_after."ST_VINCULO",
    'active', v_after."ST_ATIVO"
  ));

  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR",
    "TP_EVENTO",
    "TP_ENTIDADE",
    "CO_ENTIDADE",
    "DS_DADO_ANTERIOR",
    "DS_DADO_POSTERIOR",
    "DS_METADADO"
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
    'personId', v_after."SQ_PESSOA",
    'employeeNumber', v_after."CO_MATRICULA",
    'fullName', v_after."NO_PESSOA"
  );
end;
$function$;

-- FC_ATUALIZAR_SECAO(target_section_id uuid, section_title text, section_description text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  join sigav."TB_SECAO_PESQUISA" sec on sec."SQ_VERSAO_PESQUISA" = sv."SQ_VERSAO_PESQUISA"
  where sec."SQ_SECAO" = target_section_id
    and sv."ST_SITUACAO" = 'DRAFT'
  for update of sv;

  if v_version."SQ_VERSAO_PESQUISA" is null then
    raise exception 'Seção em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
  end if;

  select *
  into v_section
  from sigav."TB_SECAO_PESQUISA"
  where "SQ_SECAO" = target_section_id
    and "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
  for update;

  v_before := jsonb_build_object(
    'title', v_section."NO_SECAO",
    'description', v_section."DS_SECAO",
    'position', v_section."NU_ORDEM"
  );

  update sigav."TB_SECAO_PESQUISA"
  set "NO_SECAO" = v_title,
      "DS_SECAO" = v_description,
      "DT_ALTERACAO" = timezone('utc', now())
  where "SQ_SECAO" = target_section_id
  returning * into v_section;

  v_after := jsonb_build_object(
    'title', v_section."NO_SECAO",
    'description', v_section."DS_SECAO",
    'position', v_section."NU_ORDEM"
  );

  select app."SQ_APLICACAO"
  into v_application_id
  from sigav."TB_APLICACAO_PESQUISA" app
  where app."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
  order by app."DT_INCLUSAO" desc
  limit 1;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR",
    "TP_EVENTO",
    "TP_ENTIDADE",
    "CO_ENTIDADE",
    "SQ_APLICACAO",
    "DS_DADO_ANTERIOR",
    "DS_DADO_POSTERIOR",
    "DS_METADADO"
  ) values (
    v_actor_id,
    'SURVEY_SECTION_UPDATED',
    'SURVEY_SECTION',
    target_section_id::text,
    v_application_id,
    v_before,
    v_after,
    jsonb_build_object('surveyId', v_version."SQ_PESQUISA", 'surveyVersionId', v_version."SQ_VERSAO_PESQUISA")
  );

  return jsonb_build_object(
    'status', 'OK',
    'sectionId', target_section_id,
    'updatedAt', timezone('utc', now())
  );
end;
$function$;

-- FC_ATUALIZAR_VISUAL_CICLO(target_application_id uuid, banner_url text, banner_path text, banner_alt text, hero_title text, hero_subtitle text, theme_variant text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where "SQ_APLICACAO" = target_application_id
  for update;

  if v_application."SQ_APLICACAO" is null then
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

  v_before := coalesce(v_application."DS_CONFIGURACAO"->'visualIdentity', '{}'::jsonb);
  v_visual := jsonb_strip_nulls(jsonb_build_object(
    'bannerUrl', v_banner_url,
    'bannerPath', v_banner_path,
    'bannerAlt', v_banner_alt,
    'heroTitle', v_hero_title,
    'heroSubtitle', v_hero_subtitle,
    'themeVariant', v_theme
  ));

  update sigav."TB_APLICACAO_PESQUISA"
  set "DS_CONFIGURACAO" = jsonb_set(
        coalesce("DS_CONFIGURACAO", '{}'::jsonb),
        '{visualIdentity}',
        v_visual,
        true
      ),
      "DT_ALTERACAO" = timezone('utc', now())
  where "SQ_APLICACAO" = target_application_id;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    "SQ_PESSOA_ATOR",
    "TP_EVENTO",
    "TP_ENTIDADE",
    "CO_ENTIDADE",
    "SQ_APLICACAO",
    "DS_DADO_ANTERIOR",
    "DS_DADO_POSTERIOR",
    "DS_METADADO"
  ) values (
    v_actor_id,
    'APPLICATION_VISUAL_IDENTITY_UPDATED',
    'SURVEY_APPLICATION',
    target_application_id::text,
    target_application_id,
    v_before,
    v_visual,
    jsonb_build_object('applicationCode', v_application."CO_APLICACAO")
  );

  return jsonb_build_object(
    'status', 'OK',
    'applicationId', target_application_id,
    'visualIdentity', v_visual,
    'updatedAt', timezone('utc', now())
  );
end;
$function$;

-- FC_BUSCAR_CANDIDATOS_EQUIPE(target_application_id uuid, search_term text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  if not exists (select 1 from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = target_application_id) then
    raise exception 'O ciclo selecionado não foi encontrado.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'personId', p."SQ_PARTICIPANTE",
    'fullName', p."NO_PESSOA",
    'employeeNumber', p."CO_MATRICULA",
    'institutionalEmail', p."DS_EMAIL_INSTITUCIONAL",
    'jobTitle', p."NO_CARGO",
    'unit', coalesce(p."DS_METADADO"->>'unit', p."DS_METADADO"->>'unidade', p."CO_CENTRO_CUSTO"),
    'workplace', p."NO_LOCAL_TRABALHO"
  ) order by p."NO_PESSOA"), '[]'::jsonb)
  into v_result
  from (
    select p.*
    from sigav."RL_APLICACAO_PESSOA" ap
    join sigav."TB_PESSOA" p on p."SQ_PESSOA" = ap."SQ_PESSOA"
    where ap."SQ_APLICACAO" = target_application_id
      and p."SQ_PESSOA" <> v_person_id
      and p."ST_ATIVO" = true
      and ap."ST_SITUACAO" not in ('REMOVED','INELIGIBLE')
      and not exists (
        select 1
        from sigav."RT_LIDERANCA_CDDI" l
        where l."SQ_APLICACAO" = target_application_id
          and l."SQ_PESSOA_SUBORDINADA" = p."SQ_PESSOA"
          and l."ST_SITUACAO" = 'ACTIVE'
          and l."DT_FIM_VIGENCIA" is null
      )
      and (
        nullif(btrim(search_term), '') is null
        or sigav."FC_SEM_ACENTO_MINUSCULA"(p."NO_PESSOA") like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(btrim(search_term)) || '%'
        or sigav."FC_SEM_ACENTO_MINUSCULA"(coalesce(p."DS_EMAIL_INSTITUCIONAL", '')) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(btrim(search_term)) || '%'
        or sigav."FC_SEM_ACENTO_MINUSCULA"(coalesce(p."CO_MATRICULA", '')) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(btrim(search_term)) || '%'
        or sigav."FC_SEM_ACENTO_MINUSCULA"(coalesce(p."DS_METADADO"->>'unit', p."DS_METADADO"->>'unidade', p."CO_CENTRO_CUSTO", '')) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(btrim(search_term)) || '%'
      )
    order by p."NO_PESSOA"
    limit 30
  ) p;

  return v_result;
end;
$function$;

-- FC_BUSCAR_PESSOAS_ADMIN(target_search text, target_limit integer)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    'personId',p."SQ_PESSOA",'employeeNumber',p."CO_MATRICULA",'fullName',p."NO_PESSOA",'institutionalEmail',p."DS_EMAIL_INSTITUCIONAL",
    'jobTitle',p."NO_CARGO",'costCenter',p."CO_CENTRO_CUSTO",'workplace',p."NO_LOCAL_TRABALHO",
    'directorate',nullif(btrim(coalesce(p."DS_METADADO"->>'directorate','')),''),
    'organizationalUnit',nullif(btrim(coalesce(p."DS_METADADO"->>'unit','')),''),
    'coordination',nullif(btrim(coalesce(p."DS_METADADO"->>'coordination','')),''),
    'employmentStatus',p."ST_VINCULO",'active',p."ST_ATIVO",'updatedAt',p."DT_ALTERACAO"
  ) order by p."ST_ATIVO" desc,p."NO_PESSOA"),'[]'::jsonb)
  from sigav."TB_PESSOA" p where v_search='' or lower(p."NO_PESSOA") like '%'||v_search||'%' or lower(p."CO_MATRICULA") like '%'||v_search||'%' or lower(coalesce(p."DS_EMAIL_INSTITUCIONAL",'')) like '%'||v_search||'%' or lower(coalesce(p."NO_CARGO",'')) like '%'||v_search||'%' or lower(coalesce(p."CO_CENTRO_CUSTO",'')) like '%'||v_search||'%' or lower(coalesce(p."NO_LOCAL_TRABALHO",'')) like '%'||v_search||'%' or lower(coalesce(p."DS_METADADO"->>'directorate','')) like '%'||v_search||'%' or lower(coalesce(p."DS_METADADO"->>'unit','')) like '%'||v_search||'%' or lower(coalesce(p."DS_METADADO"->>'coordination','')) like '%'||v_search||'%' limit v_limit);
end;$function$;

-- FC_BUSCAR_PESSOAS_CICLO(target_application_id uuid, target_search text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  if not exists(select 1 from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'personId', p."SQ_PESSOA",
      'employeeNumber', p."CO_MATRICULA",
      'fullName', p."NO_PESSOA",
      'institutionalEmail', p."DS_EMAIL_INSTITUCIONAL",
      'jobTitle', p."NO_CARGO",
      'costCenter', p."CO_CENTRO_CUSTO",
      'workplace', p."NO_LOCAL_TRABALHO",
      'avatarUrl', coalesce(p."DS_METADADO"->>'avatar_url', p."DS_METADADO"->>'picture', p."DS_METADADO"->>'photo_url'),
      'participantId', ap."SQ_PARTICIPANTE",
      'participantStatus', ap."ST_SITUACAO"
    ) order by p."NO_PESSOA"), '[]'::jsonb)
    from sigav."TB_PESSOA" p
    left join sigav."RL_APLICACAO_PESSOA" ap
      on ap."SQ_APLICACAO" = target_application_id
     and ap."SQ_PESSOA" = p."SQ_PESSOA"
     and ap."TP_PARTICIPANTE" = 'RESPONDENT'
    where p."ST_ATIVO"
      and p."ST_VINCULO" = 'ATIVO'
      and (
        v_search = ''
        or lower(p."NO_PESSOA") like '%' || v_search || '%'
        or lower(coalesce(p."DS_EMAIL_INSTITUCIONAL",'')) like '%' || v_search || '%'
        or lower(p."CO_MATRICULA") like '%' || v_search || '%'
        or lower(coalesce(p."NO_CARGO",'')) like '%' || v_search || '%'
      )
    limit 50
  );
end;
$function$;

-- FC_BUSCAR_PESSOAS_PUBLICO(p_busca text, p_limite integer, p_regra jsonb)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    select p."SQ_PESSOA", p."NO_PESSOA", p."CO_MATRICULA", p."NO_CARGO",
           p."DS_METADADO" ->> 'unit' as unidade,
           p."DS_METADADO" ->> 'directorate' as diretoria
    from sigav."TB_PESSOA" p
    where p."ST_ATIVO"
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p."DS_METADADO" ->> 'directorate',  v_filtros -> 'directorate')
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p."DS_METADADO" ->> 'unit',         v_filtros -> 'unit')
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p."DS_METADADO" ->> 'coordination', v_filtros -> 'coordination')
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p."CO_CENTRO_CUSTO",                 v_filtros -> 'costCenter')
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p."NO_CARGO",                   v_filtros -> 'jobTitle')
      and (
        v_termo is null
        or sigav."FC_NORMALIZAR_ROTULO"(p."NO_PESSOA") like '%' || v_termo || '%'
        or sigav."FC_NORMALIZAR_ROTULO"(p."CO_MATRICULA") like '%' || v_termo || '%'
        or sigav."FC_NORMALIZAR_ROTULO"(p."DS_EMAIL_INSTITUCIONAL") like '%' || v_termo || '%'
        or sigav."FC_NORMALIZAR_ROTULO"(p."NO_CARGO") like '%' || v_termo || '%'
      )
    order by p."NO_PESSOA"
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
        'personId', "SQ_PESSOA",
        'fullName', "NO_PESSOA",
        'employeeNumber', "CO_MATRICULA",
        'jobTitle', "NO_CARGO",
        'unit', unidade,
        'directorate', diretoria
      ) order by "NO_PESSOA")
      from encontradas
    ), '[]'::jsonb)
  )
  into v_resultado;

  return v_resultado;
end;
$function$;

-- FC_CANCELA_CICLOS_ARQ()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_CANCELA_CICLOS_ARQ"()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if old."DT_ARQUIVAMENTO" is null and new."DT_ARQUIVAMENTO" is not null then
    update sigav."TB_APLICACAO_PESQUISA" application
    set "ST_SITUACAO" = 'CANCELLED', "DT_ALTERACAO" = now()
    from sigav."TH_VERSAO_PESQUISA" "NU_VERSAO"
    where "NU_VERSAO"."SQ_VERSAO_PESQUISA" = application."SQ_VERSAO_PESQUISA"
      and "NU_VERSAO"."SQ_PESQUISA" = new."SQ_PESQUISA"
      and application."ST_SITUACAO" <> 'CANCELLED';
  end if;
  return new;
end;
$function$;

-- FC_CICLO_ACEITA_RESPOSTA(target_application_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_CICLO_ACEITA_RESPOSTA"(target_application_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select exists (
    select 1
    from sigav."TB_APLICACAO_PESQUISA" sa
    where sa."SQ_APLICACAO" = target_application_id
      and (
        sa."ST_SITUACAO" = 'OPEN'
        or (
          sa."ST_SITUACAO" = 'SCHEDULED'
          and sa."DT_ABERTURA" is not null
          and sa."DT_ABERTURA" <= now()
        )
      )
      and (sa."DT_ABERTURA" is null or sa."DT_ABERTURA" <= now())
      and (sa."DT_ENCERRAMENTO" is null or sa."DT_ENCERRAMENTO" > now())
  );
$function$;

-- FC_CLONAR_PESQUISA(p_pesquisa uuid, p_nome text, p_codigo text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  select "SQ_VERSAO_PESQUISA"
  into v_versao
  from sigav."TH_VERSAO_PESQUISA"
  where "SQ_PESQUISA" = v_pesquisa
  order by "NU_VERSAO" desc
  limit 1;

  insert into sigav."TB_APLICACAO_PESQUISA" (
    "SQ_VERSAO_PESQUISA", "CO_APLICACAO", "NO_APLICACAO", "DT_ABERTURA", "DT_ENCERRAMENTO", "ST_SITUACAO",
    "ST_PERMITE_RASCUNHO", "ST_PERMITE_REENVIO", "ST_ANONIMA", "TP_ACESSO",
    "NU_LIMIAR_ANONIMATO", "ST_NOTIFICACAO_EMAIL", "DS_CONFIGURACAO", "AU_USUARIO_INCLUSAO"
  ) values (
    v_versao, v_codigo || '-1', v_nome, null, null, 'DRAFT',
    true, false, false, 'RESTRICTED', 5, false, '{}'::jsonb,
    sigav."FC_PESSOA_SESSAO"()
  )
  returning "SQ_APLICACAO" into v_aplicacao;

  return v_resultado || jsonb_build_object('applicationId', v_aplicacao);
end;
$function$;

-- FC_CLONAR_PESQUISA_ESTRUTURA(p_pesquisa uuid, p_nome text, p_codigo text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  select * into v_origem from sigav."TB_PESQUISA" where "SQ_PESQUISA" = p_pesquisa;
  if v_origem."SQ_PESQUISA" is null then
    raise exception 'Avaliação não localizada.';
  end if;

  -- Prefere a versão publicada; sem ela, o rascunho mais recente.
  select "SQ_VERSAO_PESQUISA" into v_versao_origem
  from sigav."TH_VERSAO_PESQUISA"
  where "SQ_PESQUISA" = p_pesquisa and "ST_SITUACAO" in ('PUBLISHED', 'DRAFT')
  order by case "ST_SITUACAO" when 'PUBLISHED' then 0 else 1 end, "NU_VERSAO" desc
  limit 1;
  if v_versao_origem is null then
    raise exception 'Esta avaliação não tem versão com estrutura para copiar.';
  end if;

  v_nome := coalesce(nullif(btrim(coalesce(p_nome, '')), ''), v_origem."NO_PESQUISA" || ' (cópia)');
  if length(v_nome) > 160 then
    raise exception 'O nome da cópia é longo demais.';
  end if;

  -- O código é único por constraint. Em vez de devolver erro de banco para quem
  -- clicou em "Duplicar", a função procura o primeiro sufixo livre.
  v_codigo := upper(btrim(coalesce(nullif(btrim(coalesce(p_codigo, '')), ''), v_origem."CO_PESQUISA" || '-COPIA')));
  while exists (select 1 from sigav."TB_PESQUISA" where "CO_PESQUISA" = v_codigo) loop
    v_sufixo := v_sufixo + 1;
    v_codigo := upper(btrim(coalesce(nullif(btrim(coalesce(p_codigo, '')), ''), v_origem."CO_PESQUISA" || '-COPIA'))) || '-' || v_sufixo::text;
    if v_sufixo > 50 then
      raise exception 'Não foi possível gerar um código livre para a cópia. Informe um código.';
    end if;
  end loop;

  insert into sigav."TB_PESQUISA" ("CO_PESQUISA", "NO_PESQUISA", "DS_PESQUISA", "SQ_UNIDADE_RESPONSAVEL", "ST_SITUACAO", "DS_CONFIGURACAO", "AU_USUARIO_INCLUSAO")
  values (v_codigo, v_nome, v_origem."DS_PESQUISA", v_origem."SQ_UNIDADE_RESPONSAVEL", 'DRAFT', v_origem."DS_CONFIGURACAO", v_pessoa)
  returning "SQ_PESQUISA" into v_nova_pesquisa;

  insert into sigav."TH_VERSAO_PESQUISA" ("SQ_PESQUISA", "NU_VERSAO", "NO_VERSAO", "DS_VERSAO", "ST_SITUACAO", "DS_CONFIGURACAO")
  select v_nova_pesquisa, 1, "NO_VERSAO", "DS_VERSAO", 'DRAFT', "DS_CONFIGURACAO"
  from sigav."TH_VERSAO_PESQUISA" where "SQ_VERSAO_PESQUISA" = v_versao_origem
  returning "SQ_VERSAO_PESQUISA" into v_nova_versao;

  -- Seções em duas passagens: primeiro todas sem pai, depois o vínculo, para
  -- que uma seção aninhada não precise que a pai já exista na hora da inserção.
  for v_secao in
    select * from sigav."TB_SECAO_PESQUISA" where "SQ_VERSAO_PESQUISA" = v_versao_origem order by "NU_ORDEM"
  loop
    insert into sigav."TB_SECAO_PESQUISA" ("SQ_VERSAO_PESQUISA", "SQ_SECAO_PAI", "CO_SECAO", "NO_SECAO", "DS_SECAO", "NU_ORDEM", "DS_CONFIGURACAO")
    values (v_nova_versao, null, v_secao."CO_SECAO", v_secao."NO_SECAO", v_secao."DS_SECAO", v_secao."NU_ORDEM", v_secao."DS_CONFIGURACAO")
    returning "SQ_SECAO" into v_alvo;
    v_mapa_secao := v_mapa_secao || jsonb_build_object(v_secao."SQ_SECAO"::text, v_alvo::text);
    v_secoes := v_secoes + 1;
  end loop;

  for v_secao in
    select * from sigav."TB_SECAO_PESQUISA" where "SQ_VERSAO_PESQUISA" = v_versao_origem and "SQ_SECAO_PAI" is not null
  loop
    update sigav."TB_SECAO_PESQUISA"
    set "SQ_SECAO_PAI" = (v_mapa_secao->>v_secao."SQ_SECAO_PAI"::text)::uuid
    where "SQ_SECAO" = (v_mapa_secao->>v_secao."SQ_SECAO"::text)::uuid;
  end loop;

  for v_pergunta in
    select * from sigav."TB_PERGUNTA_PESQUISA" where "SQ_VERSAO_PESQUISA" = v_versao_origem order by "NU_ORDEM"
  loop
    insert into sigav."TB_PERGUNTA_PESQUISA" (
      "SQ_VERSAO_PESQUISA", "SQ_SECAO", "CO_PERGUNTA", "NO_PERGUNTA", "DS_PERGUNTA", "TP_PERGUNTA",
      "ST_OBRIGATORIA", "NU_ORDEM", "DS_VALIDACAO", "DS_LOGICA_EXIBICAO", "DS_PONTUACAO", "DS_CONFIGURACAO"
    ) values (
      v_nova_versao, (v_mapa_secao->>v_pergunta."SQ_SECAO"::text)::uuid, v_pergunta."CO_PERGUNTA",
      v_pergunta."NO_PERGUNTA", v_pergunta."DS_PERGUNTA", v_pergunta."TP_PERGUNTA",
      v_pergunta."ST_OBRIGATORIA", v_pergunta."NU_ORDEM", v_pergunta."DS_VALIDACAO",
      v_pergunta."DS_LOGICA_EXIBICAO", v_pergunta."DS_PONTUACAO", v_pergunta."DS_CONFIGURACAO"
    ) returning "SQ_PERGUNTA" into v_alvo;
    v_mapa_pergunta := v_mapa_pergunta || jsonb_build_object(v_pergunta."SQ_PERGUNTA"::text, v_alvo::text);
    v_perguntas := v_perguntas + 1;

    for v_opcao in
      select * from sigav."TB_OPCAO_PERGUNTA" where "SQ_PERGUNTA" = v_pergunta."SQ_PERGUNTA" order by "NU_ORDEM"
    loop
      insert into sigav."TB_OPCAO_PERGUNTA" ("SQ_PERGUNTA", "CO_OPCAO", "NO_OPCAO", "DS_VALOR", "VL_NOTA", "NU_ORDEM", "ST_ATIVO", "DS_METADADO")
      values (v_alvo, v_opcao."CO_OPCAO", v_opcao."NO_OPCAO", v_opcao."DS_VALOR", v_opcao."VL_NOTA", v_opcao."NU_ORDEM", v_opcao."ST_ATIVO", v_opcao."DS_METADADO");
    end loop;
  end loop;

  -- O mapa de alternativas é montado numa passagem própria, pareando pelo par
  -- (pergunta, código) — que é único por constraint. Fazer isso dentro do laço
  -- acima exigiria alimentar o jsonb e o id na mesma instrução.
  for v_opcao in
    select antiga."SQ_OPCAO" as id_antigo, nova."SQ_OPCAO" as id_novo
    from sigav."TB_OPCAO_PERGUNTA" antiga
    join sigav."TB_PERGUNTA_PESQUISA" pergunta_antiga on pergunta_antiga."SQ_PERGUNTA" = antiga."SQ_PERGUNTA"
    join sigav."TB_OPCAO_PERGUNTA" nova
      on nova."SQ_PERGUNTA" = (v_mapa_pergunta->>pergunta_antiga."SQ_PERGUNTA"::text)::uuid
     and nova."CO_OPCAO" = antiga."CO_OPCAO"
    where pergunta_antiga."SQ_VERSAO_PESQUISA" = v_versao_origem
  loop
    v_mapa_opcao := v_mapa_opcao || jsonb_build_object(v_opcao.id_antigo::text, v_opcao.id_novo::text);
  end loop;

  -- Regras condicionais, já apontando para os identificadores da cópia.
  for v_regra in
    select * from sigav."TB_REGRA_CONDICIONAL" where "SQ_VERSAO_PESQUISA" = v_versao_origem and "ST_ATIVO"
  loop
    v_alvo := case v_regra."TP_ALVO"
      when 'SECTION' then (v_mapa_secao->>v_regra."SQ_ALVO"::text)::uuid
      else (v_mapa_pergunta->>v_regra."SQ_ALVO"::text)::uuid
    end;
    if v_alvo is null then
      continue;
    end if;

    insert into sigav."TB_REGRA_CONDICIONAL" (
      "SQ_VERSAO_PESQUISA", "TP_ALVO", "SQ_ALVO", "TP_ACAO", "TP_CONECTOR", "DS_REGRA", "AU_USUARIO_INCLUSAO"
    ) values (
      v_nova_versao, v_regra."TP_ALVO", v_alvo, v_regra."TP_ACAO", v_regra."TP_CONECTOR", v_regra."DS_REGRA", v_pessoa
    ) returning "SQ_REGRA" into v_nova_regra;

    insert into sigav."TB_CONDICAO_REGRA" ("SQ_REGRA", "SQ_PERGUNTA_ORIGEM", "TP_OPERADOR", "SQ_OPCAO", "DS_VALOR", "NU_VALOR", "NU_ORDEM")
    select
      v_nova_regra,
      (v_mapa_pergunta->>condicao."SQ_PERGUNTA_ORIGEM"::text)::uuid,
      condicao."TP_OPERADOR",
      case when condicao."SQ_OPCAO" is null then null else (v_mapa_opcao->>condicao."SQ_OPCAO"::text)::uuid end,
      condicao."DS_VALOR", condicao."NU_VALOR", condicao."NU_ORDEM"
    from sigav."TB_CONDICAO_REGRA" condicao
    where condicao."SQ_REGRA" = v_regra."SQ_REGRA"
      and (v_mapa_pergunta->>condicao."SQ_PERGUNTA_ORIGEM"::text) is not null;

    v_regras := v_regras + 1;
  end loop;

  insert into sigav."TL_EVENTO_AUDITORIA" ("SQ_PESSOA_ATOR", "TP_EVENTO", "TP_ENTIDADE", "CO_ENTIDADE", "DS_DADO_POSTERIOR", "DS_METADADO")
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

-- FC_CONDICAO_ATENDIDA(p_submissao uuid, p_condicao uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  select * into v_condicao from sigav."TB_CONDICAO_REGRA" where "SQ_CONDICAO" = p_condicao;
  if v_condicao."SQ_CONDICAO" is null then
    return false;
  end if;

  if not sigav."FC_PERGUNTA_VISIVEL"(p_submissao, v_condicao."SQ_PERGUNTA_ORIGEM") then
    return v_condicao."TP_OPERADOR" in ('NOT_ANSWERED', 'NOT_SELECTED');
  end if;

  select * into v_resposta
  from sigav."TB_RESPOSTA"
  where "SQ_SUBMISSAO" = p_submissao and "SQ_PERGUNTA" = v_condicao."SQ_PERGUNTA_ORIGEM";

  v_respondida := v_resposta."SQ_RESPOSTA" is not null and (
    num_nonnulls(
      nullif(btrim(coalesce(v_resposta."DS_RESPOSTA", '')), ''),
      v_resposta."NU_RESPOSTA"::text,
      v_resposta."ST_RESPOSTA"::text,
      v_resposta."DT_RESPOSTA"::text,
      v_resposta."DT_HORA_RESPOSTA"::text
    ) > 0
    or exists (select 1 from sigav."RL_RESPOSTA_OPCAO" where "SQ_RESPOSTA" = v_resposta."SQ_RESPOSTA")
  );

  if v_condicao."TP_OPERADOR" = 'ANSWERED' then return v_respondida; end if;
  if v_condicao."TP_OPERADOR" = 'NOT_ANSWERED' then return not v_respondida; end if;
  if not v_respondida then
    -- Nenhuma comparação de valor se sustenta sobre resposta ausente.
    return v_condicao."TP_OPERADOR" = 'NOT_EQUALS' or v_condicao."TP_OPERADOR" = 'NOT_SELECTED';
  end if;

  if v_condicao."TP_OPERADOR" in ('SELECTED', 'NOT_SELECTED') then
    v_selecionada := exists (
      select 1 from sigav."RL_RESPOSTA_OPCAO"
      where "SQ_RESPOSTA" = v_resposta."SQ_RESPOSTA" and "SQ_OPCAO" = v_condicao."SQ_OPCAO"
    );
    return case when v_condicao."TP_OPERADOR" = 'SELECTED' then v_selecionada else not v_selecionada end;
  end if;

  if v_condicao."TP_OPERADOR" = 'GREATER_THAN' then
    return v_resposta."NU_RESPOSTA" is not null and v_resposta."NU_RESPOSTA" > v_condicao."NU_VALOR";
  end if;
  if v_condicao."TP_OPERADOR" = 'LESS_THAN' then
    return v_resposta."NU_RESPOSTA" is not null and v_resposta."NU_RESPOSTA" < v_condicao."NU_VALOR";
  end if;
  if v_condicao."TP_OPERADOR" = 'CONTAINS' then
    return position(lower(coalesce(v_condicao."DS_VALOR", '')) in lower(coalesce(v_resposta."DS_RESPOSTA", ''))) > 0;
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
    v_resposta."DS_RESPOSTA",
    trim_scale(v_resposta."NU_RESPOSTA")::text,
    v_resposta."ST_RESPOSTA"::text,
    v_resposta."DT_RESPOSTA"::text,
    v_resposta."DT_HORA_RESPOSTA"::text,
    ''
  ))) = lower(btrim(coalesce(v_condicao."DS_VALOR", '')));
  return case when v_condicao."TP_OPERADOR" = 'EQUALS' then v_selecionada else not v_selecionada end;
end;
$function$;

-- FC_CRIAR_E_ATRIB_PARTIC(target_application_id uuid, target_employee_number text, target_full_name text, target_institutional_email text, target_job_title text, target_cost_center text, target_workplace text, target_access_profile text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where "CO_MATRICULA" = v_employee
     or lower(coalesce("DS_EMAIL_INSTITUCIONAL",'')) = v_email
  order by "CO_MATRICULA" = v_employee desc
  limit 1;

  if v_person."SQ_PESSOA" is null then
    insert into sigav."TB_PESSOA"(
      "CO_MATRICULA","NO_PESSOA","DS_EMAIL_INSTITUCIONAL","NO_CARGO","CO_CENTRO_CUSTO","NO_LOCAL_TRABALHO",
      "ST_VINCULO","ST_ATIVO","CO_SISTEMA_ORIGEM","CO_CHAVE_ORIGEM","DS_METADADO"
    ) values (
      v_employee,v_name,v_email,nullif(btrim(target_job_title),''),nullif(btrim(target_cost_center),''),
      nullif(btrim(target_workplace),''),'ATIVO',true,'ADMIN_MANUAL',v_employee,
      jsonb_build_object('created_by',sigav."FC_PESSOA_SESSAO"(),'created_at',timezone('utc',now()))
    ) returning * into v_person;
  else
    if v_person."CO_MATRICULA" <> v_employee
       and lower(coalesce(v_person."DS_EMAIL_INSTITUCIONAL",'')) = v_email then
      raise exception 'O e-mail informado já pertence a outra matrícula (%).', v_person."CO_MATRICULA";
    end if;

    update sigav."TB_PESSOA"
    set "NO_PESSOA" = v_name,
        "DS_EMAIL_INSTITUCIONAL" = v_email,
        "NO_CARGO" = coalesce(nullif(btrim(target_job_title),''),"NO_CARGO"),
        "CO_CENTRO_CUSTO" = coalesce(nullif(btrim(target_cost_center),''),"CO_CENTRO_CUSTO"),
        "NO_LOCAL_TRABALHO" = coalesce(nullif(btrim(target_workplace),''),"NO_LOCAL_TRABALHO"),
        "ST_ATIVO" = true,
        "ST_VINCULO" = 'ATIVO',
        "DT_ALTERACAO" = timezone('utc',now())
    where "SQ_PESSOA" = v_person."SQ_PESSOA"
    returning * into v_person;
  end if;

  v_result := sigav."FC_ATRIB_PARTICIPANTE"(
    target_application_id,
    v_person."SQ_PESSOA",
    target_access_profile
  );

  return v_result || jsonb_build_object('personId',v_person."SQ_PESSOA",'employeeNumber',v_person."CO_MATRICULA");
end;
$function$;

-- FC_CRIAR_NOVA_VERSAO_PESQUISA(p_pesquisa uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  select * into v_pesquisa from sigav."TB_PESQUISA" where "SQ_PESQUISA" = p_pesquisa for update;
  if v_pesquisa."SQ_PESQUISA" is null then
    raise exception 'Avaliação não encontrada.';
  end if;

  if v_pesquisa."DT_ARQUIVAMENTO" is not null then
    raise exception 'Esta avaliação está arquivada. Restaure-a antes de criar uma nova versão.';
  end if;

  select * into v_versao_origem
  from sigav."TH_VERSAO_PESQUISA"
  where "SQ_PESQUISA" = p_pesquisa
  order by "NU_VERSAO" desc
  limit 1
  for update;
  if v_versao_origem."SQ_VERSAO_PESQUISA" is null then
    raise exception 'Versão da pesquisa não encontrada.';
  end if;

  -- Cobre, com a mesma mensagem, tanto "nunca foi publicada" quanto "já existe
  -- um rascunho mais novo aguardando conclusão": nos dois casos a versão mais
  -- recente está em DRAFT.
  if v_versao_origem."ST_SITUACAO" = 'DRAFT' then
    raise exception 'A versão mais recente desta avaliação ainda está em rascunho. Publique-a (ou conclua as alterações pendentes) antes de criar uma nova versão.';
  elsif v_versao_origem."ST_SITUACAO" = 'RETIRED' then
    -- Defensivo: esta é a única função que grava RETIRED, e sempre insere a
    -- versão seguinte na mesma transação — não deveria haver uma RETIRED sem
    -- sucessora mais nova.
    raise exception 'A versão mais recente desta avaliação já está descontinuada.';
  end if;

  select * into v_aplicacao_origem
  from sigav."TB_APLICACAO_PESQUISA"
  where "SQ_VERSAO_PESQUISA" = v_versao_origem."SQ_VERSAO_PESQUISA"
  order by "DT_INCLUSAO" desc
  limit 1
  for update;

  if v_aplicacao_origem."SQ_APLICACAO" is not null
     and v_aplicacao_origem."ST_SITUACAO" not in ('CLOSED', 'CANCELLED') then
    raise exception 'O ciclo desta versão ainda está %. Encerre-o (Pausar ou Finalizar, em Propriedades do ciclo) antes de criar uma nova versão.',
      case v_aplicacao_origem."ST_SITUACAO"
        when 'DRAFT' then 'em rascunho'
        when 'SCHEDULED' then 'agendado'
        when 'OPEN' then 'aberto'
        else lower(v_aplicacao_origem."ST_SITUACAO")
      end;
  end if;

  -- Aposenta a versão atual antes de inserir a próxima, para que nenhuma
  -- leitura concorrente resolva "a versão" pelas duas ao mesmo tempo.
  update sigav."TH_VERSAO_PESQUISA"
  set "ST_SITUACAO" = 'RETIRED', "DT_ALTERACAO" = now()
  where "SQ_VERSAO_PESQUISA" = v_versao_origem."SQ_VERSAO_PESQUISA";

  v_novo_numero := v_versao_origem."NU_VERSAO" + 1;

  insert into sigav."TH_VERSAO_PESQUISA" (
    "SQ_PESQUISA", "NU_VERSAO", "NO_VERSAO", "DS_VERSAO", "ST_SITUACAO", "NU_VERSAO_SCHEMA", "DS_CONFIGURACAO", "AU_USUARIO_INCLUSAO"
  )
  values (
    p_pesquisa, v_novo_numero, v_versao_origem."NO_VERSAO", v_versao_origem."DS_VERSAO",
    'DRAFT', v_versao_origem."NU_VERSAO_SCHEMA", v_versao_origem."DS_CONFIGURACAO", v_pessoa
  )
  returning "SQ_VERSAO_PESQUISA" into v_nova_versao;

  -- Seções em duas passagens: primeiro todas sem pai, depois o vínculo, para
  -- que uma seção aninhada não precise que a pai já exista na hora da
  -- inserção (mesma técnica de FC_CLONAR_PESQUISA).
  for v_secao in
    select * from sigav."TB_SECAO_PESQUISA" where "SQ_VERSAO_PESQUISA" = v_versao_origem."SQ_VERSAO_PESQUISA" order by "NU_ORDEM"
  loop
    insert into sigav."TB_SECAO_PESQUISA" ("SQ_VERSAO_PESQUISA", "SQ_SECAO_PAI", "CO_SECAO", "NO_SECAO", "DS_SECAO", "NU_ORDEM", "DS_CONFIGURACAO")
    values (v_nova_versao, null, v_secao."CO_SECAO", v_secao."NO_SECAO", v_secao."DS_SECAO", v_secao."NU_ORDEM", v_secao."DS_CONFIGURACAO")
    returning "SQ_SECAO" into v_alvo;
    v_mapa_secao := v_mapa_secao || jsonb_build_object(v_secao."SQ_SECAO"::text, v_alvo::text);
    v_secoes := v_secoes + 1;
  end loop;

  for v_secao in
    select * from sigav."TB_SECAO_PESQUISA" where "SQ_VERSAO_PESQUISA" = v_versao_origem."SQ_VERSAO_PESQUISA" and "SQ_SECAO_PAI" is not null
  loop
    update sigav."TB_SECAO_PESQUISA"
    set "SQ_SECAO_PAI" = (v_mapa_secao->>v_secao."SQ_SECAO_PAI"::text)::uuid
    where "SQ_SECAO" = (v_mapa_secao->>v_secao."SQ_SECAO"::text)::uuid;
  end loop;

  for v_pergunta in
    select * from sigav."TB_PERGUNTA_PESQUISA" where "SQ_VERSAO_PESQUISA" = v_versao_origem."SQ_VERSAO_PESQUISA" order by "NU_ORDEM"
  loop
    insert into sigav."TB_PERGUNTA_PESQUISA" (
      "SQ_VERSAO_PESQUISA", "SQ_SECAO", "CO_PERGUNTA", "NO_PERGUNTA", "DS_PERGUNTA", "TP_PERGUNTA",
      "ST_OBRIGATORIA", "NU_ORDEM", "DS_VALIDACAO", "DS_LOGICA_EXIBICAO", "DS_PONTUACAO", "DS_CONFIGURACAO"
    ) values (
      v_nova_versao, (v_mapa_secao->>v_pergunta."SQ_SECAO"::text)::uuid, v_pergunta."CO_PERGUNTA",
      v_pergunta."NO_PERGUNTA", v_pergunta."DS_PERGUNTA", v_pergunta."TP_PERGUNTA",
      v_pergunta."ST_OBRIGATORIA", v_pergunta."NU_ORDEM", v_pergunta."DS_VALIDACAO",
      v_pergunta."DS_LOGICA_EXIBICAO", v_pergunta."DS_PONTUACAO", v_pergunta."DS_CONFIGURACAO"
    ) returning "SQ_PERGUNTA" into v_alvo;
    v_mapa_pergunta := v_mapa_pergunta || jsonb_build_object(v_pergunta."SQ_PERGUNTA"::text, v_alvo::text);
    v_perguntas := v_perguntas + 1;

    for v_opcao in
      select * from sigav."TB_OPCAO_PERGUNTA" where "SQ_PERGUNTA" = v_pergunta."SQ_PERGUNTA" order by "NU_ORDEM"
    loop
      insert into sigav."TB_OPCAO_PERGUNTA" ("SQ_PERGUNTA", "CO_OPCAO", "NO_OPCAO", "DS_VALOR", "VL_NOTA", "NU_ORDEM", "ST_ATIVO", "DS_METADADO")
      values (v_alvo, v_opcao."CO_OPCAO", v_opcao."NO_OPCAO", v_opcao."DS_VALOR", v_opcao."VL_NOTA", v_opcao."NU_ORDEM", v_opcao."ST_ATIVO", v_opcao."DS_METADADO");
    end loop;
  end loop;

  -- O mapa de alternativas é montado numa passagem própria, pareando pelo par
  -- (pergunta, código) — único por constraint — porque o id novo só existe
  -- depois do laço acima.
  for v_opcao in
    select antiga."SQ_OPCAO" as id_antigo, nova."SQ_OPCAO" as id_novo
    from sigav."TB_OPCAO_PERGUNTA" antiga
    join sigav."TB_PERGUNTA_PESQUISA" pergunta_antiga on pergunta_antiga."SQ_PERGUNTA" = antiga."SQ_PERGUNTA"
    join sigav."TB_OPCAO_PERGUNTA" nova
      on nova."SQ_PERGUNTA" = (v_mapa_pergunta->>pergunta_antiga."SQ_PERGUNTA"::text)::uuid
     and nova."CO_OPCAO" = antiga."CO_OPCAO"
    where pergunta_antiga."SQ_VERSAO_PESQUISA" = v_versao_origem."SQ_VERSAO_PESQUISA"
  loop
    v_mapa_opcao := v_mapa_opcao || jsonb_build_object(v_opcao.id_antigo::text, v_opcao.id_novo::text);
  end loop;

  -- Regras condicionais, já apontando para os identificadores da versão nova.
  for v_regra in
    select * from sigav."TB_REGRA_CONDICIONAL" where "SQ_VERSAO_PESQUISA" = v_versao_origem."SQ_VERSAO_PESQUISA" and "ST_ATIVO"
  loop
    v_alvo := case v_regra."TP_ALVO"
      when 'SECTION' then (v_mapa_secao->>v_regra."SQ_ALVO"::text)::uuid
      else (v_mapa_pergunta->>v_regra."SQ_ALVO"::text)::uuid
    end;
    if v_alvo is null then
      continue;
    end if;

    insert into sigav."TB_REGRA_CONDICIONAL" (
      "SQ_VERSAO_PESQUISA", "TP_ALVO", "SQ_ALVO", "TP_ACAO", "TP_CONECTOR", "DS_REGRA", "AU_USUARIO_INCLUSAO"
    ) values (
      v_nova_versao, v_regra."TP_ALVO", v_alvo, v_regra."TP_ACAO", v_regra."TP_CONECTOR", v_regra."DS_REGRA", v_pessoa
    ) returning "SQ_REGRA" into v_nova_regra;

    insert into sigav."TB_CONDICAO_REGRA" ("SQ_REGRA", "SQ_PERGUNTA_ORIGEM", "TP_OPERADOR", "SQ_OPCAO", "DS_VALOR", "NU_VALOR", "NU_ORDEM")
    select
      v_nova_regra,
      (v_mapa_pergunta->>condicao."SQ_PERGUNTA_ORIGEM"::text)::uuid,
      condicao."TP_OPERADOR",
      case when condicao."SQ_OPCAO" is null then null else (v_mapa_opcao->>condicao."SQ_OPCAO"::text)::uuid end,
      condicao."DS_VALOR", condicao."NU_VALOR", condicao."NU_ORDEM"
    from sigav."TB_CONDICAO_REGRA" condicao
    where condicao."SQ_REGRA" = v_regra."SQ_REGRA"
      and (v_mapa_pergunta->>condicao."SQ_PERGUNTA_ORIGEM"::text) is not null;

    v_regras := v_regras + 1;
  end loop;

  -- Ciclo novo: mesmas preferências operacionais do ciclo anterior (visibilidade,
  -- reenvio, anonimato, limiar, aviso por e-mail), sem período e sem identidade
  -- visual própria — o código nunca colide porque é a primeira vez que este
  -- version_number existe para esta pesquisa.
  v_novo_codigo_aplicacao := upper(v_pesquisa."CO_PESQUISA") || '-' || v_novo_numero::text;

  insert into sigav."TB_APLICACAO_PESQUISA" (
    "SQ_VERSAO_PESQUISA", "CO_APLICACAO", "NO_APLICACAO", "DT_ABERTURA", "DT_ENCERRAMENTO", "ST_SITUACAO",
    "ST_PERMITE_RASCUNHO", "ST_PERMITE_REENVIO", "ST_ANONIMA", "TP_ACESSO",
    "NU_LIMIAR_ANONIMATO", "ST_NOTIFICACAO_EMAIL", "DS_CONFIGURACAO", "AU_USUARIO_INCLUSAO"
  ) values (
    v_nova_versao,
    v_novo_codigo_aplicacao,
    coalesce(v_aplicacao_origem."NO_APLICACAO", v_pesquisa."NO_PESQUISA"),
    null, null, 'DRAFT',
    coalesce(v_aplicacao_origem."ST_PERMITE_RASCUNHO", true),
    coalesce(v_aplicacao_origem."ST_PERMITE_REENVIO", false),
    coalesce(v_aplicacao_origem."ST_ANONIMA", false),
    coalesce(v_aplicacao_origem."TP_ACESSO", 'RESTRICTED'),
    coalesce(v_aplicacao_origem."NU_LIMIAR_ANONIMATO", 5),
    coalesce(v_aplicacao_origem."ST_NOTIFICACAO_EMAIL", false),
    '{}'::jsonb,
    v_pessoa
  )
  returning "SQ_APLICACAO" into v_nova_aplicacao;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    "SQ_PESSOA_ATOR", "TP_EVENTO", "TP_ENTIDADE", "CO_ENTIDADE", "SQ_APLICACAO", "DS_DADO_ANTERIOR", "DS_DADO_POSTERIOR", "DS_METADADO"
  ) values (
    v_pessoa, 'SURVEY_VERSION_CREATED', 'SURVEY_VERSION', v_nova_versao::text, v_nova_aplicacao,
    jsonb_build_object('retiredVersionId', v_versao_origem."SQ_VERSAO_PESQUISA", 'retiredVersionNumber', v_versao_origem."NU_VERSAO"),
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

-- FC_CRIAR_RASCUNHO_PESQUISA(p_code text, p_name text, p_description text, p_application_name text, p_opens_at timestamp with time zone, p_closes_at timestamp with time zone, p_anonymous boolean, p_allow_drafts boolean)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  select "SQ_PESSOA" into v_person_id
  from sigav."TB_PESSOA"
  where "SQ_USUARIO_IDENTIDADE" = sigav."FC_UID_SESSAO"()
  limit 1;

  insert into sigav."TB_PESQUISA" ("CO_PESQUISA", "NO_PESQUISA", "DS_PESQUISA", "ST_SITUACAO", "DS_CONFIGURACAO", "AU_USUARIO_INCLUSAO")
  values (v_code, btrim(p_name), nullif(btrim(p_description), ''), 'DRAFT', '{}'::jsonb, v_person_id)
  returning "SQ_PESQUISA" into v_survey_id;

  insert into sigav."TH_VERSAO_PESQUISA" (
    "SQ_PESQUISA", "NU_VERSAO", "NO_VERSAO", "DS_VERSAO", "ST_SITUACAO", "NU_VERSAO_SCHEMA",
    "DS_CONFIGURACAO", "AU_USUARIO_INCLUSAO"
  )
  values (
    v_survey_id, 1, btrim(p_name), nullif(btrim(p_description), ''), 'DRAFT',
    1, '{}'::jsonb, v_person_id
  )
  returning "SQ_VERSAO_PESQUISA" into v_version_id;

  insert into sigav."TB_APLICACAO_PESQUISA" (
    "SQ_VERSAO_PESQUISA", "CO_APLICACAO", "NO_APLICACAO", "DT_ABERTURA", "DT_ENCERRAMENTO", "ST_SITUACAO",
    "ST_PERMITE_RASCUNHO", "ST_PERMITE_REENVIO", "ST_ANONIMA", "DS_CONFIGURACAO", "AU_USUARIO_INCLUSAO"
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
  returning "SQ_APLICACAO" into v_application_id;

  insert into sigav."TB_SECAO_PESQUISA" (
    "SQ_VERSAO_PESQUISA", "CO_SECAO", "NO_SECAO", "DS_SECAO", "NU_ORDEM", "DS_CONFIGURACAO"
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

-- FC_DEFINIR_COMUNICADO_INICIO(p_ativo boolean, p_titulo text, p_mensagem text, p_link text, p_rotulo_link text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    'enabled', "ST_COMUNICADO_INICIO_ATIVO",
    'title', "NO_COMUNICADO_INICIO",
    'message', "DS_COMUNICADO_INICIO_MENSAGEM",
    'link', "DS_COMUNICADO_INICIO_LINK",
    'linkLabel', "DS_COMUNICADO_INICIO_ROTULO"
  )
  into v_anterior
  from sigav."TB_CONFIG_PLATAFORMA"
  where "CO_CONFIGURACAO" = 1
  for update;

  update sigav."TB_CONFIG_PLATAFORMA"
  set "ST_COMUNICADO_INICIO_ATIVO" = coalesce(p_ativo, false),
      "NO_COMUNICADO_INICIO" = v_titulo,
      "DS_COMUNICADO_INICIO_MENSAGEM" = v_mensagem,
      "DS_COMUNICADO_INICIO_LINK" = v_link,
      "DS_COMUNICADO_INICIO_ROTULO" = v_rotulo,
      "AU_USUARIO_ALTERACAO" = v_ator,
      "DT_ALTERACAO" = timezone('utc', now())
  where "CO_CONFIGURACAO" = 1;

  select jsonb_build_object(
    'enabled', "ST_COMUNICADO_INICIO_ATIVO",
    'title', "NO_COMUNICADO_INICIO",
    'message', "DS_COMUNICADO_INICIO_MENSAGEM",
    'link', "DS_COMUNICADO_INICIO_LINK",
    'linkLabel', "DS_COMUNICADO_INICIO_ROTULO"
  )
  into v_novo
  from sigav."TB_CONFIG_PLATAFORMA"
  where "CO_CONFIGURACAO" = 1;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    "SQ_PESSOA_ATOR", "TP_EVENTO", "TP_ENTIDADE", "CO_ENTIDADE",
    "DS_DADO_ANTERIOR", "DS_DADO_POSTERIOR", "DS_METADADO"
  ) values (
    v_ator, 'HOME_ANNOUNCEMENT_UPDATED', 'PLATFORM_SETTINGS', 'home-announcement',
    v_anterior, v_novo, jsonb_build_object('source', 'ADMIN_SETTINGS')
  );

  return sigav."FC_OBTER_MARCA_PLATAFORMA"();
end;
$function$;

-- FC_DEFINIR_COR_BARRA_LATERAL(p_cor text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  set "CO_COR_BARRA_LATERAL" = v_cor,
      "AU_USUARIO_ALTERACAO" = sigav."FC_PESSOA_SESSAO"(),
      "DT_ALTERACAO" = timezone('utc', now())
  where "CO_CONFIGURACAO" = 1;

  return jsonb_build_object('status', 'OK', 'sidebarColor', v_cor);
end;
$function$;

-- FC_DEFINIR_COR_PAINEL_ACESSO(p_cor text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  set "CO_COR_PAINEL_ACESSO" = v_cor,
      "AU_USUARIO_ALTERACAO" = sigav."FC_PESSOA_SESSAO"(),
      "DT_ALTERACAO" = timezone('utc', now())
  where "CO_CONFIGURACAO" = 1;

  return jsonb_build_object('status', 'OK', 'accessPanelColor', v_cor);
end;
$function$;

-- FC_DEFINIR_DT_ALTERACAO()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_DEFINIR_DT_ALTERACAO"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if to_jsonb(new) ? 'DT_ALTERACAO' then
    new."DT_ALTERACAO" := timezone('utc', now());
  else
    -- Tabela ainda não padronizada. Ramo temporário: ver o cabeçalho.
    new."DT_ALTERACAO" := timezone('utc', now());
  end if;
  return new;
end;
$function$;

-- FC_DEFINIR_FUNDO_ACESSO(p_url text, p_caminho text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  set "DS_URL_FUNDO_ACESSO" = v_url,
      "DS_CAMINHO_FUNDO_ACESSO" = v_caminho,
      "AU_USUARIO_ALTERACAO" = sigav."FC_PESSOA_SESSAO"(),
      "DT_ALTERACAO" = timezone('utc', now())
  where "CO_CONFIGURACAO" = 1;

  return jsonb_build_object('status', 'OK', 'accessBackgroundUrl', v_url, 'accessBackgroundPath', v_caminho);
end;
$function$;

-- FC_DEFINIR_MODELO_AVALIACAO(p_pesquisa uuid, p_modelo boolean, p_categoria text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  select * into v_pesquisa from sigav."TB_PESQUISA" where "SQ_PESQUISA" = p_pesquisa;
  if v_pesquisa."SQ_PESQUISA" is null then
    raise exception 'Avaliação não localizada.';
  end if;

  -- Instrumento com ciclo em operação não vira modelo: modelo é ponto de
  -- partida, e sair do catálogo administrativo esconderia um ciclo ativo de
  -- quem precisa operá-lo.
  if p_modelo and exists (
    select 1
    from sigav."TB_APLICACAO_PESQUISA" aplicacao
    join sigav."TH_VERSAO_PESQUISA" versao on versao."SQ_VERSAO_PESQUISA" = aplicacao."SQ_VERSAO_PESQUISA"
    where versao."SQ_PESQUISA" = p_pesquisa
      and aplicacao."ST_SITUACAO" in ('OPEN', 'SCHEDULED')
  ) then
    raise exception 'Esta avaliação tem ciclo aberto ou agendado. Encerre o ciclo antes de transformá-la em modelo.';
  end if;

  update sigav."TB_PESQUISA"
  set "ST_MODELO" = p_modelo,
      "TP_CATEGORIA_MODELO" = case when p_modelo then nullif(btrim(coalesce(p_categoria, '')), '') else null end,
      "DT_ALTERACAO" = now()
  where "SQ_PESQUISA" = p_pesquisa;

  return jsonb_build_object('status', 'OK', 'surveyId', p_pesquisa, 'isTemplate', p_modelo);
end;
$function$;

-- FC_DEFINIR_NOTIFICACAO_EMAIL(target_survey_id uuid, target_enabled boolean)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  join sigav."TH_VERSAO_PESQUISA" v on v."SQ_VERSAO_PESQUISA" = a."SQ_VERSAO_PESQUISA"
  where v."SQ_PESQUISA" = target_survey_id
  order by v."NU_VERSAO" desc, a."DT_INCLUSAO" desc
  limit 1;

  if v_application."SQ_APLICACAO" is null then
    raise exception 'O ciclo de aplicação ainda não foi criado.';
  end if;

  v_before := v_application."ST_NOTIFICACAO_EMAIL";

  update sigav."TB_APLICACAO_PESQUISA"
  set "ST_NOTIFICACAO_EMAIL" = target_enabled,
      "DT_ALTERACAO" = timezone('utc', now())
  where "SQ_APLICACAO" = v_application."SQ_APLICACAO";

  if v_before is distinct from target_enabled then
    insert into sigav."TL_EVENTO_AUDITORIA"(
      "SQ_PESSOA_ATOR", "TP_EVENTO", "TP_ENTIDADE", "CO_ENTIDADE", "SQ_APLICACAO",
      "DS_DADO_ANTERIOR", "DS_DADO_POSTERIOR", "DS_METADADO"
    )
    values (
      v_actor,
      'SURVEY_EMAIL_NOTIFICATIONS_SET',
      'SURVEY_APPLICATION',
      v_application."SQ_APLICACAO"::text,
      v_application."SQ_APLICACAO",
      jsonb_build_object('emailNotifications', v_before),
      jsonb_build_object('emailNotifications', target_enabled),
      jsonb_build_object('surveyId', target_survey_id)
    );
  end if;

  return jsonb_build_object(
    'status', 'OK',
    'applicationId', v_application."SQ_APLICACAO",
    'emailNotifications', target_enabled
  );
end;
$function$;

-- FC_DEFINIR_PERMISSOES_PESSOA(p_pessoa uuid, p_permissoes text[])
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  select "NO_PESSOA"
  into v_person_name
  from sigav."TB_PESSOA"
  where "SQ_PESSOA" = p_pessoa
    and "ST_ATIVO";

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
      where pm."CO_MODULO" = upper(btrim(item))
        and pm."ST_ATIVO"
    );

  if coalesce(cardinality(v_unknown), 0) > 0 then
    raise exception 'Permissões desconhecidas: %', array_to_string(v_unknown, ', ')
      using errcode = '22023';
  end if;

  select coalesce(array_agg(pm."CO_MODULO" order by pm."NU_ORDEM", pm."CO_MODULO"), array[]::text[])
  into v_permissions
  from sigav."TB_MODULO_PLATAFORMA" pm
  where pm."ST_ATIVO"
    and (
      pm."CO_MODULO" in ('HOME', 'SURVEYS')
      or pm."CO_MODULO" = any(array(
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
    where p."ST_ATIVO"
      and p."SQ_PESSOA" <> p_pessoa
      and 'ADMIN_ACCESS' = any(sigav."FC_MODULOS_EFETIVOS"(p."SQ_PESSOA"));

    if v_other_admins = 0 then
      raise exception 'A plataforma precisa manter ao menos uma pessoa com administração de acessos.' using errcode = '42501';
    end if;
  end if;

  delete from sigav."RL_PESSOA_MODULO"
  where "SQ_PESSOA" = p_pessoa;

  insert into sigav."RL_PESSOA_MODULO" (
    "SQ_PESSOA",
    "CO_MODULO",
    "ST_PERMITIDO",
    "AU_USUARIO_CONCESSAO",
    "DT_INCLUSAO",
    "DT_ALTERACAO"
  )
  select
    p_pessoa,
    pm."CO_MODULO",
    pm."CO_MODULO" = any(v_permissions),
    v_actor_id,
    timezone('utc', now()),
    timezone('utc', now())
  from sigav."TB_MODULO_PLATAFORMA" pm
  where pm."ST_ATIVO";

  insert into sigav."TL_EVENTO_AUDITORIA" (
    "SQ_PESSOA_ATOR",
    "TP_EVENTO",
    "TP_ENTIDADE",
    "CO_ENTIDADE",
    "DS_DADO_ANTERIOR",
    "DS_DADO_POSTERIOR",
    "DS_METADADO"
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

-- FC_DEFINIR_PRESENCA_PLATAFORMA(fl_ativa_param boolean)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  set "ST_PRESENCA_ONLINE_ATIVA" = coalesce(fl_ativa_param, false),
      "AU_USUARIO_ALTERACAO" = sigav."FC_PESSOA_SESSAO"(),
      "DT_ALTERACAO" = timezone('utc', now())
  where "CO_CONFIGURACAO" = 1;

  return jsonb_build_object(
    'onlinePresenceEnabled', coalesce(fl_ativa_param, false)
  );
end;
$function$;

-- FC_DEFINIR_RETENCAO_ANONIMA(p_dias integer)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  set "NU_DIAS_RETENCAO_RASC_ANON" = p_dias,
      "AU_USUARIO_ALTERACAO" = sigav."FC_PESSOA_SESSAO"(),
      "DT_ALTERACAO" = timezone('utc', now())
  where "CO_CONFIGURACAO" = 1;

  return jsonb_build_object('status', 'OK', 'dias', p_dias);
end;
$function$;

-- FC_DEFINIR_SITUACAO_PARTIC(target_participant_id uuid, target_status text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where "SQ_PARTICIPANTE" = target_participant_id
  for update;

  if v_participant."SQ_PARTICIPANTE" is null then raise exception 'Participante não localizado.'; end if;
  if v_participant."DT_CONCLUSAO" is not null and v_target = 'ELIGIBLE' then
    raise exception 'Uma participação concluída não pode voltar para elegível.';
  end if;

  v_before := to_jsonb(v_participant);

  update sigav."RL_APLICACAO_PESSOA"
  set "ST_SITUACAO" = v_target,
      "DS_METADADO" = coalesce("DS_METADADO",'{}'::jsonb)
        || jsonb_build_object('status_changed_by',v_actor,'status_changed_at',timezone('utc',now())),
      "DT_ALTERACAO" = timezone('utc',now())
  where "SQ_PARTICIPANTE" = target_participant_id
  returning * into v_participant;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR","TP_EVENTO","TP_ENTIDADE","CO_ENTIDADE","SQ_APLICACAO","DS_DADO_ANTERIOR","DS_DADO_POSTERIOR","DS_METADADO"
  ) values (
    v_actor,'PARTICIPANT_STATUS_CHANGED','APPLICATION_PARTICIPANT',v_participant."SQ_PARTICIPANTE"::text,
    v_participant."SQ_APLICACAO",v_before,to_jsonb(v_participant),jsonb_build_object('source','ADMIN_PARTICIPANTS')
  );

  return jsonb_build_object('status','OK','participantId',v_participant."SQ_PARTICIPANTE",'participantStatus',v_participant."ST_SITUACAO");
end;
$function$;

-- FC_DEFINIR_TEXTOS_EMAIL(p_instrucao text, p_rodape text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  set "DS_INSTRUCAO_EMAIL" = v_instrucao,
      "DS_RODAPE_EMAIL" = v_rodape,
      "AU_USUARIO_ALTERACAO" = sigav."FC_PESSOA_SESSAO"(),
      "DT_ALTERACAO" = timezone('utc', now())
  where "CO_CONFIGURACAO" = 1;

  return jsonb_build_object(
    'status', 'OK',
    'emailInstruction', v_instrucao,
    'emailFooter', v_rodape
  );
end;
$function$;

-- FC_DEFINIR_TEXTOS_MARCA(p_expansao text, p_saudacao text, p_instrucao text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  set "DS_PRODUTO" = v_expansao,
      "DS_SAUDACAO_ACESSO" = v_saudacao,
      "DS_INSTRUCAO_ACESSO" = v_instrucao,
      "AU_USUARIO_ALTERACAO" = sigav."FC_PESSOA_SESSAO"(),
      "DT_ALTERACAO" = timezone('utc', now())
  where "CO_CONFIGURACAO" = 1;

  return jsonb_build_object(
    'status', 'OK',
    'productDescription', v_expansao,
    'accessGreeting', v_saudacao,
    'accessInstruction', v_instrucao
  );
end;
$function$;

-- FC_DEFINIR_VINCULO_LIDERANCA(target_application_id uuid, target_subordinate_person_id uuid, target_leader_person_id uuid, target_justification text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    join sigav."TH_VERSAO_PESQUISA" "NU_VERSAO" on "NU_VERSAO"."SQ_VERSAO_PESQUISA" = application."SQ_VERSAO_PESQUISA"
    join sigav."TB_PESQUISA" survey on survey."SQ_PESQUISA" = "NU_VERSAO"."SQ_PESQUISA"
    where application."SQ_APLICACAO" = target_application_id
      and survey."CO_PESQUISA" = 'CDDI'
      and survey."DT_ARQUIVAMENTO" is null
      and application."ST_SITUACAO" <> 'CANCELLED'
  ) then
    raise exception 'Ciclo CDDI não localizado ou indisponível.';
  end if;
  if not exists (
    select 1
    from sigav."RL_APLICACAO_PESSOA" participant
    where participant."SQ_APLICACAO" = target_application_id
      and participant."SQ_PESSOA" = target_subordinate_person_id
      and participant."TP_PARTICIPANTE" = 'RESPONDENT'
      and participant."ST_SITUACAO" not in ('BLOCKED', 'EXCLUDED')
  ) then
    raise exception 'O integrante não participa ativamente do ciclo CDDI selecionado.';
  end if;

  select "NO_PESSOA" into v_leader_name
  from sigav."TB_PESSOA"
  where "SQ_PESSOA" = target_leader_person_id and "ST_ATIVO";
  if v_leader_name is null then
    raise exception 'Liderança ativa não encontrada.';
  end if;

  select "NO_PESSOA" into v_subordinate_name
  from sigav."TB_PESSOA"
  where "SQ_PESSOA" = target_subordinate_person_id and "ST_ATIVO";
  if v_subordinate_name is null then
    raise exception 'Integrante ativo não encontrado.';
  end if;

  select * into v_previous
  from sigav."RT_LIDERANCA_CDDI"
  where "SQ_APLICACAO" = target_application_id
    and "SQ_PESSOA_SUBORDINADA" = target_subordinate_person_id
    and "ST_SITUACAO" = 'ACTIVE'
    and "DT_FIM_VIGENCIA" is null
  order by "DT_INICIO_VIGENCIA" desc
  limit 1
  for update;

  if v_previous."SQ_LIDERANCA" is not null and v_previous."SQ_PESSOA_LIDER" = target_leader_person_id then
    raise exception 'A pessoa já está vinculada a esta liderança no ciclo selecionado.';
  end if;

  if v_previous."SQ_LIDERANCA" is not null then
    update sigav."RT_LIDERANCA_CDDI"
    set "ST_SITUACAO" = 'ENDED',
        "DT_FIM_VIGENCIA" = timezone('utc', now()),
        "DS_METADADO" = coalesce("DS_METADADO", '{}'::jsonb)
          || jsonb_build_object(
            'ended_by_admin', v_actor_id,
            'end_justification', v_justification
          ),
        "DT_ALTERACAO" = timezone('utc', now())
    where "SQ_LIDERANCA" = v_previous."SQ_LIDERANCA";
  end if;

  insert into sigav."RT_LIDERANCA_CDDI"(
    "SQ_APLICACAO",
    "SQ_PESSOA_LIDER",
    "SQ_PESSOA_SUBORDINADA",
    "ST_SITUACAO",
    "DT_INICIO_VIGENCIA",
    "TP_ORIGEM",
    "DS_METADADO"
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
      'replaces_link_id', v_previous."SQ_LIDERANCA"
    )
  ) returning * into v_new_link;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR",
    "TP_EVENTO",
    "TP_ENTIDADE",
    "CO_ENTIDADE",
    "SQ_APLICACAO",
    "DS_DADO_ANTERIOR",
    "DS_DADO_POSTERIOR",
    "DS_METADADO"
  ) values (
    v_actor_id,
    'LEADERSHIP_LINK_CORRECTED',
    'CDDI_LEADERSHIP_LINK',
    v_new_link."SQ_LIDERANCA"::text,
    target_application_id,
    case when v_previous."SQ_LIDERANCA" is null then null else to_jsonb(v_previous) end,
    to_jsonb(v_new_link),
    jsonb_build_object(
      'justification', v_justification,
      'leaderName', v_leader_name,
      'subordinateName', v_subordinate_name
    )
  );

  return jsonb_build_object(
    'status', 'OK',
    'linkId', v_new_link."SQ_LIDERANCA",
    'leaderName', v_leader_name,
    'subordinateName', v_subordinate_name,
    'replacedLinkId', v_previous."SQ_LIDERANCA"
  );
end;
$function$;

-- FC_DUPLICAR_ITEM_CONSTRUTOR(target_item_type text, target_item_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    join sigav."TB_SECAO_PESQUISA" sec on sec."SQ_VERSAO_PESQUISA" = sv."SQ_VERSAO_PESQUISA"
    where sec."SQ_SECAO" = target_item_id
      and sv."ST_SITUACAO" = 'DRAFT'
    for update of sv;

    if v_version."SQ_VERSAO_PESQUISA" is null then
      raise exception 'Seção em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
    end if;

    perform sec."SQ_SECAO"
    from sigav."TB_SECAO_PESQUISA" sec
    where sec."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
    order by sec."SQ_SECAO"
    for update;

    select *
    into v_source_section
    from sigav."TB_SECAO_PESQUISA"
    where "SQ_SECAO" = target_item_id
      and "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA";

    perform question."SQ_PERGUNTA"
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question."SQ_SECAO" = target_item_id
    order by question."SQ_PERGUNTA"
    for update;

    select coalesce(max(sec."NU_ORDEM"), 0) + 1
    into v_position
    from sigav."TB_SECAO_PESQUISA" sec
    where sec."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA";

    v_new_title := left(v_source_section."NO_SECAO", 152) || ' — cópia';

    insert into sigav."TB_SECAO_PESQUISA"(
      "SQ_VERSAO_PESQUISA",
      "SQ_SECAO_PAI",
      "CO_SECAO",
      "NO_SECAO",
      "DS_SECAO",
      "NU_ORDEM",
      "DS_CONFIGURACAO"
    ) values (
      v_version."SQ_VERSAO_PESQUISA",
      v_source_section."SQ_SECAO_PAI",
      'S_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      v_new_title,
      v_source_section."DS_SECAO",
      v_position,
      v_source_section."DS_CONFIGURACAO"
    )
    returning "SQ_SECAO" into v_new_section_id;

    for v_question_row in
      select *
      from sigav."TB_PERGUNTA_PESQUISA"
      where "SQ_SECAO" = target_item_id
      order by "NU_ORDEM", "SQ_PERGUNTA"
    loop
      insert into sigav."TB_PERGUNTA_PESQUISA"(
        "SQ_VERSAO_PESQUISA",
        "SQ_SECAO",
        "CO_PERGUNTA",
        "NO_PERGUNTA",
        "DS_PERGUNTA",
        "TP_PERGUNTA",
        "ST_OBRIGATORIA",
        "NU_ORDEM",
        "DS_VALIDACAO",
        "DS_LOGICA_EXIBICAO",
        "DS_PONTUACAO",
        "DS_CONFIGURACAO"
      ) values (
        v_version."SQ_VERSAO_PESQUISA",
        v_new_section_id,
        'Q_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
        v_question_row."NO_PERGUNTA",
        v_question_row."DS_PERGUNTA",
        v_question_row."TP_PERGUNTA",
        v_question_row."ST_OBRIGATORIA",
        v_question_row."NU_ORDEM",
        v_question_row."DS_VALIDACAO",
        v_question_row."DS_LOGICA_EXIBICAO",
        v_question_row."DS_PONTUACAO",
        v_question_row."DS_CONFIGURACAO"
      )
      returning "SQ_PERGUNTA" into v_new_question_id;

      v_copied_questions := v_copied_questions + 1;

      for v_option_row in
        select *
        from sigav."TB_OPCAO_PERGUNTA"
        where "SQ_PERGUNTA" = v_question_row."SQ_PERGUNTA"
        order by "NU_ORDEM", "SQ_OPCAO"
      loop
        insert into sigav."TB_OPCAO_PERGUNTA"(
          "SQ_PERGUNTA",
          "CO_OPCAO",
          "NO_OPCAO",
          "DS_VALOR",
          "VL_NOTA",
          "NU_ORDEM",
          "ST_ATIVO",
          "DS_METADADO"
        ) values (
          v_new_question_id,
          v_option_row."CO_OPCAO",
          v_option_row."NO_OPCAO",
          v_option_row."DS_VALOR",
          v_option_row."VL_NOTA",
          v_option_row."NU_ORDEM",
          v_option_row."ST_ATIVO",
          v_option_row."DS_METADADO"
        );
        v_copied_options := v_copied_options + 1;
      end loop;
    end loop;

    v_new_item_id := v_new_section_id;
  else
    select sv.*
    into v_version
    from sigav."TH_VERSAO_PESQUISA" sv
    join sigav."TB_PERGUNTA_PESQUISA" question on question."SQ_VERSAO_PESQUISA" = sv."SQ_VERSAO_PESQUISA"
    where question."SQ_PERGUNTA" = target_item_id
      and sv."ST_SITUACAO" = 'DRAFT'
    for update of sv;

    if v_version."SQ_VERSAO_PESQUISA" is null then
      raise exception 'Pergunta em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
    end if;

    select question."SQ_SECAO"
    into v_source_section_id
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question."SQ_PERGUNTA" = target_item_id
      and question."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA";

    perform question."SQ_PERGUNTA"
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question."SQ_SECAO" = v_source_section_id
    order by question."SQ_PERGUNTA"
    for update;

    select *
    into v_source_question
    from sigav."TB_PERGUNTA_PESQUISA"
    where "SQ_PERGUNTA" = target_item_id
      and "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA";

    if v_source_question."SQ_PERGUNTA" is null then
      raise exception 'Pergunta em rascunho não encontrada.';
    end if;

    select coalesce(max(question."NU_ORDEM"), 0) + 1
    into v_position
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question."SQ_SECAO" = v_source_question."SQ_SECAO";

    v_new_title := left(v_source_question."NO_PERGUNTA", 492) || ' — cópia';

    insert into sigav."TB_PERGUNTA_PESQUISA"(
      "SQ_VERSAO_PESQUISA",
      "SQ_SECAO",
      "CO_PERGUNTA",
      "NO_PERGUNTA",
      "DS_PERGUNTA",
      "TP_PERGUNTA",
      "ST_OBRIGATORIA",
      "NU_ORDEM",
      "DS_VALIDACAO",
      "DS_LOGICA_EXIBICAO",
      "DS_PONTUACAO",
      "DS_CONFIGURACAO"
    ) values (
      v_version."SQ_VERSAO_PESQUISA",
      v_source_question."SQ_SECAO",
      'Q_' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
      v_new_title,
      v_source_question."DS_PERGUNTA",
      v_source_question."TP_PERGUNTA",
      v_source_question."ST_OBRIGATORIA",
      v_position,
      v_source_question."DS_VALIDACAO",
      v_source_question."DS_LOGICA_EXIBICAO",
      v_source_question."DS_PONTUACAO",
      v_source_question."DS_CONFIGURACAO"
    )
    returning "SQ_PERGUNTA" into v_new_question_id;

    for v_option_row in
      select *
      from sigav."TB_OPCAO_PERGUNTA"
      where "SQ_PERGUNTA" = target_item_id
      order by "NU_ORDEM", "SQ_OPCAO"
    loop
      insert into sigav."TB_OPCAO_PERGUNTA"(
        "SQ_PERGUNTA",
        "CO_OPCAO",
        "NO_OPCAO",
        "DS_VALOR",
        "VL_NOTA",
        "NU_ORDEM",
        "ST_ATIVO",
        "DS_METADADO"
      ) values (
        v_new_question_id,
        v_option_row."CO_OPCAO",
        v_option_row."NO_OPCAO",
        v_option_row."DS_VALOR",
        v_option_row."VL_NOTA",
        v_option_row."NU_ORDEM",
        v_option_row."ST_ATIVO",
        v_option_row."DS_METADADO"
      );
      v_copied_options := v_copied_options + 1;
    end loop;

    v_new_item_id := v_new_question_id;
  end if;

  select app."SQ_APLICACAO"
  into v_application_id
  from sigav."TB_APLICACAO_PESQUISA" app
  where app."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
  order by app."DT_INCLUSAO" desc
  limit 1;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR",
    "TP_EVENTO",
    "TP_ENTIDADE",
    "CO_ENTIDADE",
    "SQ_APLICACAO",
    "DS_DADO_ANTERIOR",
    "DS_DADO_POSTERIOR",
    "DS_METADADO"
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
    jsonb_build_object('surveyId', v_version."SQ_PESQUISA", 'surveyVersionId', v_version."SQ_VERSAO_PESQUISA")
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

-- FC_ENVIAR_RESP_ANON(target_submission_id uuid, target_session_token text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  select * into v_submission from sigav."TB_SUBMISSAO" where "SQ_SUBMISSAO"=target_submission_id for update;
  if v_submission."SQ_SUBMISSAO" is null or v_submission."ST_SITUACAO" <> 'DRAFT' or coalesce(v_submission."DS_METADADO" ->> 'public_session_token_hash','') <> v_token_hash then
    raise exception 'A resposta anônima não está disponível para envio.';
  end if;
  select * into v_application from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO"=v_submission."SQ_APLICACAO";
  if not v_application."ST_ANONIMA" or not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application."SQ_APLICACAO") then raise exception 'O período de respostas está encerrado.'; end if;
  select count(*)::integer into v_missing
  from sigav."TB_PERGUNTA_PESQUISA" q
  where q."SQ_VERSAO_PESQUISA"=v_application."SQ_VERSAO_PESQUISA"
    and q."ST_OBRIGATORIA"
    and sigav."FC_PERGUNTA_VISIVEL"(v_submission."SQ_SUBMISSAO",q."SQ_PERGUNTA")
    and not exists (
      select 1 from sigav."TB_RESPOSTA" a
      where a."SQ_SUBMISSAO"=v_submission."SQ_SUBMISSAO" and a."SQ_PERGUNTA"=q."SQ_PERGUNTA" and (
        (q."TP_PERGUNTA" in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE') and exists(select 1 from sigav."RL_RESPOSTA_OPCAO" ao where ao."SQ_RESPOSTA"=a."SQ_RESPOSTA"))
        or (q."TP_PERGUNTA" in ('SHORT_TEXT','LONG_TEXT') and nullif(btrim(a."DS_RESPOSTA"),'') is not null)
        or (q."TP_PERGUNTA" in ('INTEGER','DECIMAL') and a."NU_RESPOSTA" is not null)
        or (q."TP_PERGUNTA"='BOOLEAN' and a."ST_RESPOSTA" is not null)
        or (q."TP_PERGUNTA"='DATE' and a."DT_RESPOSTA" is not null)
        or (q."TP_PERGUNTA"='DATETIME' and a."DT_HORA_RESPOSTA" is not null)
      )
    );
  if v_missing>0 then raise exception 'Existem % pergunta(s) obrigatória(s) sem resposta.',v_missing; end if;
  update sigav."TB_SUBMISSAO"
  set "ST_SITUACAO"='SUBMITTED',"DT_ENVIO"=v_submitted_at,"DT_ALTERACAO"=v_submitted_at,
      "DS_METADADO"=(coalesce("DS_METADADO",'{}'::jsonb)-'public_session_token'-'public_session_token_hash')||jsonb_build_object('submitted_from','PUBLIC_ANONYMOUS_LINK')
  where "SQ_SUBMISSAO"=v_submission."SQ_SUBMISSAO";
  insert into sigav."TL_EVENTO_AUDITORIA"("SQ_PESSOA_ATOR","TP_EVENTO","TP_ENTIDADE","CO_ENTIDADE","SQ_APLICACAO","DS_DADO_POSTERIOR","DS_METADADO")
  values(null,'ANONYMOUS_SUBMISSION_SUBMITTED','APPLICATION',v_application."SQ_APLICACAO"::text,v_application."SQ_APLICACAO",jsonb_build_object('status','SUBMITTED'),jsonb_build_object('anonymous',true));
  return jsonb_build_object('status','OK','submissionStatus','SUBMITTED','submittedAt',v_submitted_at,'anonymous',true);
end;
$function$;

-- FC_ENVIAR_SUBMISSAO_CDDI(target_submission_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where s."SQ_SUBMISSAO" = target_submission_id
  for update;

  if not found
    or v_submission."SQ_PESSOA_RESPONDENTE" is distinct from v_person_id
    or v_submission."ST_SITUACAO" <> 'DRAFT' then
    raise exception 'A avaliação não está disponível para envio.';
  end if;

  select sa.*
    into v_application
  from sigav."TB_APLICACAO_PESQUISA" sa
  where sa."SQ_APLICACAO" = v_submission."SQ_APLICACAO";

  if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application."SQ_APLICACAO") then
    raise exception 'O período de respostas está encerrado.';
  end if;

  select count(*)::integer
    into v_missing_count
  from sigav."TB_PERGUNTA_PESQUISA" q
  where q."SQ_VERSAO_PESQUISA" = v_application."SQ_VERSAO_PESQUISA"
    and q."ST_OBRIGATORIA" = true
    and not exists (
      select 1
      from sigav."TB_RESPOSTA" a
      where a."SQ_SUBMISSAO" = v_submission."SQ_SUBMISSAO"
        and a."SQ_PERGUNTA" = q."SQ_PERGUNTA"
        and (
          (q."TP_PERGUNTA" = 'SCALE' and exists (
            select 1 from sigav."RL_RESPOSTA_OPCAO" ao where ao."SQ_RESPOSTA" = a."SQ_RESPOSTA"
          ))
          or (q."TP_PERGUNTA" in ('SHORT_TEXT', 'LONG_TEXT') and nullif(btrim(a."DS_RESPOSTA"), '') is not null)
          or (q."TP_PERGUNTA" not in ('SCALE', 'SHORT_TEXT', 'LONG_TEXT') and num_nonnulls(
            a."DS_RESPOSTA",
            a."NU_RESPOSTA",
            a."ST_RESPOSTA",
            a."DT_RESPOSTA",
            a."DT_HORA_RESPOSTA",
            a."DS_RESPOSTA_JSON"
          ) > 0)
        )
    );

  if v_missing_count > 0 then
    raise exception 'Existem % pergunta(s) obrigatória(s) sem resposta.', v_missing_count;
  end if;

  for v_section in
    select ss."SQ_SECAO"
    from sigav."TB_SECAO_PESQUISA" ss
    where ss."SQ_VERSAO_PESQUISA" = v_application."SQ_VERSAO_PESQUISA"
      and coalesce(ss."CO_SECAO", '') <> 'FINAL'
    order by ss."NU_ORDEM"
  loop
    select
      avg(a."VL_NOTA") filter (where q."DS_PONTUACAO" ->> 'component' = 'BEHAVIOR'),
      max(a."VL_NOTA") filter (where q."DS_PONTUACAO" ->> 'component' = 'DEVELOPMENT_LEVEL')
      into v_behavior_average, v_development_level
    from sigav."TB_PERGUNTA_PESQUISA" q
    join sigav."TB_RESPOSTA" a
      on a."SQ_PERGUNTA" = q."SQ_PERGUNTA"
     and a."SQ_SUBMISSAO" = v_submission."SQ_SUBMISSAO"
    where q."SQ_SECAO" = v_section."SQ_SECAO";

    if v_behavior_average is null or v_development_level is null then
      raise exception 'Não foi possível calcular uma das competências.';
    end if;

    v_section_result := round((v_behavior_average * 0.70 + v_development_level * 0.30)::numeric, 4);

    insert into sigav."TB_RESULTADO_COMPET_CDDI" (
      "SQ_SUBMISSAO",
      "SQ_SECAO_COMPETENCIA",
      "VL_MEDIA_COMPORTAMENTO",
      "VL_NIVEL_DESENVOLVIMENTO",
      "VL_RESULTADO",
      "CO_VERSAO_CALCULO"
    ) values (
      v_submission."SQ_SUBMISSAO",
      v_section."SQ_SECAO",
      round(v_behavior_average::numeric, 4),
      round(v_development_level::numeric, 4),
      v_section_result,
      'CDDI-2026-V1'
    )
    on conflict ("SQ_SUBMISSAO", "SQ_SECAO_COMPETENCIA") do update
      set "VL_MEDIA_COMPORTAMENTO" = excluded."VL_MEDIA_COMPORTAMENTO",
          "VL_NIVEL_DESENVOLVIMENTO" = excluded."VL_NIVEL_DESENVOLVIMENTO",
          "VL_RESULTADO" = excluded."VL_RESULTADO",
          "CO_VERSAO_CALCULO" = excluded."CO_VERSAO_CALCULO",
          "DT_ALTERACAO" = now();
  end loop;

  select round(avg(cr."VL_RESULTADO")::numeric, 4)
    into v_final_score
  from sigav."TB_RESULTADO_COMPET_CDDI" cr
  where cr."SQ_SUBMISSAO" = v_submission."SQ_SUBMISSAO";

  update sigav."TB_SUBMISSAO"
  set "ST_SITUACAO" = 'SUBMITTED',
      "DT_ENVIO" = v_submitted_at,
      "VL_RESULTADO" = v_final_score,
      "DS_METADADO" = "DS_METADADO" || jsonb_build_object('submitted_from', 'PLATFORM_WEB')
  where "SQ_SUBMISSAO" = v_submission."SQ_SUBMISSAO";

  if v_submission."TP_SUBMISSAO" = 'AUTO' then
    update sigav."RL_APLICACAO_PESSOA"
    set "ST_SITUACAO" = 'COMPLETED',
        "DT_CONCLUSAO" = v_submitted_at
    where "SQ_PARTICIPANTE" = v_submission."SQ_PARTICIPANTE";

    insert into sigav."TB_RESULTADO_FINAL_CDDI" (
      "SQ_APLICACAO",
      "SQ_PESSOA_AVALIADA",
      "SQ_SUBMISSAO_AUTO",
      "VL_NOTA_AUTO",
      "VL_NOTA_FINAL",
      "ST_SITUACAO",
      "DT_CALCULO"
    ) values (
      v_submission."SQ_APLICACAO",
      v_submission."SQ_PESSOA_AVALIADA",
      v_submission."SQ_SUBMISSAO",
      v_final_score,
      null,
      'PARTIAL',
      null
    )
    on conflict ("SQ_APLICACAO", "SQ_PESSOA_AVALIADA") do update
      set "SQ_SUBMISSAO_AUTO" = excluded."SQ_SUBMISSAO_AUTO",
          "VL_NOTA_AUTO" = excluded."VL_NOTA_AUTO",
          "VL_NOTA_FINAL" = case
            when sigav."TB_RESULTADO_FINAL_CDDI"."VL_NOTA_LIDER" is null then null
            else round((excluded."VL_NOTA_AUTO" * 0.40 + sigav."TB_RESULTADO_FINAL_CDDI"."VL_NOTA_LIDER" * 0.60)::numeric, 4)
          end,
          "ST_SITUACAO" = case
            when sigav."TB_RESULTADO_FINAL_CDDI"."VL_NOTA_LIDER" is null then 'PARTIAL'
            else 'CALCULATED'
          end,
          "DT_CALCULO" = case
            when sigav."TB_RESULTADO_FINAL_CDDI"."VL_NOTA_LIDER" is null then null
            else v_submitted_at
          end,
          "DT_ALTERACAO" = now();
  else
    insert into sigav."TB_RESULTADO_FINAL_CDDI" (
      "SQ_APLICACAO",
      "SQ_PESSOA_AVALIADA",
      "SQ_SUBMISSAO_LIDER",
      "VL_NOTA_LIDER",
      "VL_NOTA_FINAL",
      "ST_SITUACAO",
      "DT_CALCULO"
    ) values (
      v_submission."SQ_APLICACAO",
      v_submission."SQ_PESSOA_AVALIADA",
      v_submission."SQ_SUBMISSAO",
      v_final_score,
      null,
      'PARTIAL',
      null
    )
    on conflict ("SQ_APLICACAO", "SQ_PESSOA_AVALIADA") do update
      set "SQ_SUBMISSAO_LIDER" = excluded."SQ_SUBMISSAO_LIDER",
          "VL_NOTA_LIDER" = excluded."VL_NOTA_LIDER",
          "VL_NOTA_FINAL" = case
            when sigav."TB_RESULTADO_FINAL_CDDI"."VL_NOTA_AUTO" is null then null
            else round((sigav."TB_RESULTADO_FINAL_CDDI"."VL_NOTA_AUTO" * 0.40 + excluded."VL_NOTA_LIDER" * 0.60)::numeric, 4)
          end,
          "ST_SITUACAO" = case
            when sigav."TB_RESULTADO_FINAL_CDDI"."VL_NOTA_AUTO" is null then 'PARTIAL'
            else 'CALCULATED'
          end,
          "DT_CALCULO" = case
            when sigav."TB_RESULTADO_FINAL_CDDI"."VL_NOTA_AUTO" is null then null
            else v_submitted_at
          end,
          "DT_ALTERACAO" = now();
  end if;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    "SQ_PESSOA_ATOR",
    "TP_EVENTO",
    "TP_ENTIDADE",
    "CO_ENTIDADE",
    "SQ_APLICACAO",
    "DS_DADO_POSTERIOR",
    "DS_METADADO"
  ) values (
    v_person_id,
    'CDDI_SUBMISSION_SUBMITTED',
    'SUBMISSION',
    v_submission."SQ_SUBMISSAO"::text,
    v_submission."SQ_APLICACAO",
    jsonb_build_object('status', 'SUBMITTED', 'result', v_final_score),
    jsonb_build_object('submission_type', v_submission."TP_SUBMISSAO")
  );

  return jsonb_build_object(
    'status', 'OK',
    'submissionStatus', 'SUBMITTED',
    'submittedAt', v_submitted_at,
    'result', v_final_score
  );
end;
$function$;

-- FC_ENVIAR_SUBMISSAO_PESQUISA(target_submission_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  select * into v_submission from sigav."TB_SUBMISSAO" where "SQ_SUBMISSAO" = target_submission_id for update;
  if v_submission."SQ_SUBMISSAO" is null or v_submission."ST_SITUACAO" <> 'DRAFT' then
    raise exception 'A resposta não está disponível para envio.';
  end if;
  select * into v_application from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = v_submission."SQ_APLICACAO";

  -- A titularidade vem do bilhete quando o ciclo é anônimo, e da própria
  -- submissão quando não é.
  if v_application."ST_ANONIMA" then
    select * into v_bilhete from sigav."TB_BILHETE_ANONIMO"
    where "SQ_SUBMISSAO" = v_submission."SQ_SUBMISSAO" and "SQ_PESSOA" = v_person_id;
    if v_bilhete."SQ_BILHETE" is null then raise exception 'A resposta não está disponível para envio.'; end if;
    select "SQ_PARTICIPANTE" into v_participante from sigav."RL_APLICACAO_PESSOA"
    where "SQ_APLICACAO" = v_application."SQ_APLICACAO" and "SQ_PESSOA" = v_person_id and "TP_PARTICIPANTE" = 'RESPONDENT';
  else
    if v_submission."SQ_PESSOA_RESPONDENTE" is distinct from v_person_id then
      raise exception 'A resposta não está disponível para envio.';
    end if;
    v_participante := v_submission."SQ_PARTICIPANTE";
  end if;

  if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application."SQ_APLICACAO") then
    raise exception 'O período de respostas está encerrado.';
  end if;

  select count(*)::integer into v_missing
  from sigav."TB_PERGUNTA_PESQUISA" q
  where q."SQ_VERSAO_PESQUISA" = v_application."SQ_VERSAO_PESQUISA" and q."ST_OBRIGATORIA"
    and sigav."FC_PERGUNTA_VISIVEL"(v_submission."SQ_SUBMISSAO", q."SQ_PERGUNTA")
    and not exists (
      select 1 from sigav."TB_RESPOSTA" a where a."SQ_SUBMISSAO" = v_submission."SQ_SUBMISSAO" and a."SQ_PERGUNTA" = q."SQ_PERGUNTA" and (
        (q."TP_PERGUNTA" in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE') and exists(select 1 from sigav."RL_RESPOSTA_OPCAO" ao where ao."SQ_RESPOSTA" = a."SQ_RESPOSTA"))
        or (q."TP_PERGUNTA" in ('SHORT_TEXT','LONG_TEXT') and nullif(btrim(a."DS_RESPOSTA"),'') is not null)
        or (q."TP_PERGUNTA" in ('INTEGER','DECIMAL') and a."NU_RESPOSTA" is not null)
        or (q."TP_PERGUNTA" = 'BOOLEAN' and a."ST_RESPOSTA" is not null)
        or (q."TP_PERGUNTA" = 'DATE' and a."DT_RESPOSTA" is not null)
        or (q."TP_PERGUNTA" = 'DATETIME' and a."DT_HORA_RESPOSTA" is not null)
        or (q."TP_PERGUNTA" not in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE','SHORT_TEXT','LONG_TEXT','INTEGER','DECIMAL','BOOLEAN','DATE','DATETIME')
            and num_nonnulls(a."DS_RESPOSTA", a."NU_RESPOSTA", a."ST_RESPOSTA", a."DT_RESPOSTA", a."DT_HORA_RESPOSTA", a."DS_RESPOSTA_JSON") > 0)
      )
    );
  if v_missing > 0 then raise exception 'Existem % pergunta(s) obrigatória(s) sem resposta.', v_missing; end if;

  update sigav."TB_SUBMISSAO"
  set "ST_SITUACAO" = 'SUBMITTED', "DT_ENVIO" = v_submitted_at, "DT_ALTERACAO" = v_submitted_at,
      "DS_METADADO" = coalesce("DS_METADADO", '{}'::jsonb) || jsonb_build_object(
        'submitted_from', case when v_application."ST_ANONIMA" then 'PLATFORM_WEB_ANONYMOUS' else 'PLATFORM_WEB_GENERIC' end)
  where "SQ_SUBMISSAO" = v_submission."SQ_SUBMISSAO";

  update sigav."RL_APLICACAO_PESSOA"
  set "ST_SITUACAO" = 'COMPLETED', "DT_CONCLUSAO" = v_submitted_at, "DT_ALTERACAO" = v_submitted_at
  where "SQ_PARTICIPANTE" = v_participante;

  if v_application."ST_ANONIMA" then
    -- Os três atos que tornam o anonimato estrutural, nesta ordem.
    --
    -- 1. O bilhete é apagado: era a única linha ligando pessoa e submissão.
    delete from sigav."TB_BILHETE_ANONIMO" where "SQ_BILHETE" = v_bilhete."SQ_BILHETE";

    -- 2. A auditoria registra o envio **sem ator e sem a submissão**. Gravar
    --    `actor_person_id` com o id da submissão refaria o vínculo dentro da
    --    própria trilha de auditoria — seria anonimato desfeito pelo registro
    --    de que houve anonimato.
    insert into sigav."TL_EVENTO_AUDITORIA"("SQ_PESSOA_ATOR", "TP_EVENTO", "TP_ENTIDADE", "CO_ENTIDADE", "SQ_APLICACAO", "DS_DADO_POSTERIOR", "DS_METADADO")
    values (null, 'ANONYMOUS_SUBMISSION_SUBMITTED', 'APPLICATION', v_application."SQ_APLICACAO"::text, v_application."SQ_APLICACAO",
            jsonb_build_object('status','SUBMITTED'), jsonb_build_object('anonymous', true));
  else
    insert into sigav."TL_EVENTO_AUDITORIA"("SQ_PESSOA_ATOR", "TP_EVENTO", "TP_ENTIDADE", "CO_ENTIDADE", "SQ_APLICACAO", "DS_DADO_POSTERIOR", "DS_METADADO")
    values (v_person_id, 'SURVEY_SUBMISSION_SUBMITTED', 'SUBMISSION', v_submission."SQ_SUBMISSAO"::text, v_submission."SQ_APLICACAO",
            jsonb_build_object('status','SUBMITTED'), '{}'::jsonb);
  end if;

  return jsonb_build_object('status','OK','submissionStatus','SUBMITTED','submittedAt',v_submitted_at,'anonymous',v_application."ST_ANONIMA");
end $function$;

-- FC_EXCLUIR_PERGUNTA(target_question_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_EXCLUIR_PERGUNTA"(target_question_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare v_title text;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then raise exception 'Acesso restrito à Equipe Técnica.'; end if;
  select q."NO_PERGUNTA" into v_title from sigav."TB_PERGUNTA_PESQUISA" q join sigav."TH_VERSAO_PESQUISA" sv on sv."SQ_VERSAO_PESQUISA"=q."SQ_VERSAO_PESQUISA" where q."SQ_PERGUNTA"=target_question_id and sv."ST_SITUACAO"='DRAFT';
  if v_title is null then raise exception 'Pergunta em rascunho não encontrada.'; end if;
  delete from sigav."TB_PERGUNTA_PESQUISA" where "SQ_PERGUNTA"=target_question_id;
  return jsonb_build_object('status','OK','title',v_title);
end;$function$;

-- FC_EXCLUIR_PESQUISA_ARQUIVADA(p_pesquisa uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  select * into v_survey from sigav."TB_PESQUISA" where "SQ_PESQUISA" = p_pesquisa for update;
  if v_survey."SQ_PESQUISA" is null then raise exception 'Avaliação não encontrada.'; end if;
  if v_survey."DT_ARQUIVAMENTO" is null then
    raise exception 'Apenas avaliações arquivadas podem ser apagadas definitivamente.';
  end if;

  select coalesce(array_agg("SQ_VERSAO_PESQUISA"), '{}'::uuid[]) into v_versoes
  from sigav."TH_VERSAO_PESQUISA" where "SQ_PESQUISA" = p_pesquisa;
  select coalesce(array_agg("SQ_APLICACAO"), '{}'::uuid[]) into v_aplicacoes
  from sigav."TB_APLICACAO_PESQUISA" where "SQ_VERSAO_PESQUISA" = any(v_versoes);
  select coalesce(jsonb_agg(jsonb_build_object('id', "SQ_APLICACAO", 'code', "CO_APLICACAO", 'status', "ST_SITUACAO")), '[]'::jsonb)
  into v_aplicacoes_auditoria
  from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = any(v_aplicacoes);
  select count(*)::integer into v_submissoes
  from sigav."TB_SUBMISSAO" where "SQ_APLICACAO" = any(v_aplicacoes);

  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR", "TP_EVENTO", "TP_ENTIDADE", "CO_ENTIDADE", "SQ_APLICACAO",
    "DS_DADO_ANTERIOR", "DS_DADO_POSTERIOR", "DS_METADADO"
  ) values (
    v_actor, 'SURVEY_ARCHIVED_DELETED', 'SURVEY', v_survey."SQ_PESQUISA"::text, null,
    jsonb_build_object('code', v_survey."CO_PESQUISA", 'name', v_survey."NO_PESQUISA", 'applications', v_aplicacoes_auditoria),
    null,
    jsonb_build_object('surveyId', v_survey."SQ_PESQUISA", 'applications', v_aplicacoes_auditoria, 'submissionsDeleted', v_submissoes)
  );

  -- Resultado final aponta para submissões com RESTRICT; remove-o antes das
  -- submissões. As demais dependências de submissão e de aplicação usam cascade.
  delete from sigav."TB_RESULTADO_FINAL_CDDI" where "SQ_APLICACAO" = any(v_aplicacoes);
  delete from sigav."TB_SUBMISSAO" where "SQ_APLICACAO" = any(v_aplicacoes);
  delete from sigav."TB_REGRA_CONDICIONAL" where "SQ_VERSAO_PESQUISA" = any(v_versoes);

  perform set_config('app.exclusao_arquivada', 'on', true);
  delete from sigav."TB_OPCAO_PERGUNTA"
  where "SQ_PERGUNTA" in (select "SQ_PERGUNTA" from sigav."TB_PERGUNTA_PESQUISA" where "SQ_VERSAO_PESQUISA" = any(v_versoes));
  delete from sigav."TB_PERGUNTA_PESQUISA" where "SQ_VERSAO_PESQUISA" = any(v_versoes);

  -- Sempre remove folhas antes das seções-pai: isso impede o cascade da FK
  -- recursiva de acionar o gatilho estrutural num estado intermediário.
  loop
    delete from sigav."TB_SECAO_PESQUISA" filha
    where filha."SQ_VERSAO_PESQUISA" = any(v_versoes)
      and not exists (
        select 1 from sigav."TB_SECAO_PESQUISA" neta where neta."SQ_SECAO_PAI" = filha."SQ_SECAO"
      );
    exit when not found;
  end loop;

  delete from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = any(v_aplicacoes);
  delete from sigav."TH_VERSAO_PESQUISA" where "SQ_PESQUISA" = p_pesquisa;
  delete from sigav."TB_PESQUISA" where "SQ_PESQUISA" = p_pesquisa;

  return jsonb_build_object('status', 'OK', 'code', v_survey."CO_PESQUISA", 'name', v_survey."NO_PESQUISA");
end;
$function$;

-- FC_EXCLUIR_PESQUISA_RASCUNHO(p_pesquisa uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where "SQ_PESQUISA" = p_pesquisa
  for update;
  if v_survey."SQ_PESQUISA" is null then
    raise exception 'Avaliação não encontrada.';
  end if;

  -- Publicada uma única vez, a avaliação deixa de ser descartável: a estrutura
  -- vira referência histórica de quem respondeu, mesmo que o ciclo esteja
  -- encerrado ou cancelado. O trigger estrutural também barraria o delete.
  select count(*)::integer into v_publicadas
  from sigav."TH_VERSAO_PESQUISA"
  where "SQ_PESQUISA" = p_pesquisa
    and "ST_SITUACAO" <> 'DRAFT';
  if v_publicadas > 0 then
    raise exception 'Esta avaliação já foi publicada e não pode ser excluída. Cancele o ciclo para encerrá-la.';
  end if;

  select count(*)::integer into v_submissoes
  from sigav."TB_SUBMISSAO" s
  join sigav."TB_APLICACAO_PESQUISA" a on a."SQ_APLICACAO" = s."SQ_APLICACAO"
  join sigav."TH_VERSAO_PESQUISA" v on v."SQ_VERSAO_PESQUISA" = a."SQ_VERSAO_PESQUISA"
  where v."SQ_PESQUISA" = p_pesquisa;
  if v_submissoes > 0 then
    raise exception 'Esta avaliação já possui respostas registradas e não pode ser excluída.';
  end if;

  select coalesce(array_agg("SQ_VERSAO_PESQUISA"), '{}'::uuid[])
  into v_versoes
  from sigav."TH_VERSAO_PESQUISA"
  where "SQ_PESQUISA" = p_pesquisa;

  select coalesce(jsonb_agg(jsonb_build_object('id', a."SQ_APLICACAO", 'code', a."CO_APLICACAO", 'status', a."ST_SITUACAO")), '[]'::jsonb)
  into v_aplicacoes
  from sigav."TB_APLICACAO_PESQUISA" a
  where a."SQ_VERSAO_PESQUISA" = any(v_versoes);

  -- Auditoria antes do delete e com `application_id` nulo: a coluna referencia
  -- TB_APLICACAO_PESQUISA com `on delete set null`, e o identificador do ciclo
  -- fica preservado em `metadata`, que é jsonb e não tem chave estrangeira.
  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR",
    "TP_EVENTO",
    "TP_ENTIDADE",
    "CO_ENTIDADE",
    "SQ_APLICACAO",
    "DS_DADO_ANTERIOR",
    "DS_DADO_POSTERIOR",
    "DS_METADADO"
  ) values (
    v_actor,
    'SURVEY_DELETED',
    'SURVEY',
    v_survey."SQ_PESQUISA"::text,
    null,
    jsonb_build_object(
      'code', v_survey."CO_PESQUISA",
      'name', v_survey."NO_PESQUISA",
      'status', v_survey."ST_SITUACAO",
      'applications', v_aplicacoes
    ),
    null,
    jsonb_build_object('surveyId', v_survey."SQ_PESQUISA", 'applications', v_aplicacoes)
  );

  -- Estrutura de baixo para cima, com a versão ainda existente e em DRAFT —
  -- é o que satisfaz FC_EXIGIR_RASCUNHO_ESTRUT em cada linha removida.
  delete from sigav."TB_OPCAO_PERGUNTA"
  where "SQ_PERGUNTA" in (
    select "SQ_PERGUNTA" from sigav."TB_PERGUNTA_PESQUISA" where "SQ_VERSAO_PESQUISA" = any(v_versoes)
  );

  delete from sigav."TB_PERGUNTA_PESQUISA"
  where "SQ_VERSAO_PESQUISA" = any(v_versoes);

  -- Seções da folha para a raiz. `delete` sem filhas restantes nunca aciona o
  -- cascade de survey_sections_parent_same_version_fk, então o trigger avalia
  -- cada linha com a versão presente. Um `delete` direto pela versão removeria
  -- o pai antes da filha e traria de volta "Versão da pesquisa não encontrada.".
  loop
    delete from sigav."TB_SECAO_PESQUISA" filha
    where filha."SQ_VERSAO_PESQUISA" = any(v_versoes)
      and not exists (
        select 1
        from sigav."TB_SECAO_PESQUISA" neta
        where neta."SQ_SECAO_PAI" = filha."SQ_SECAO"
      );
    exit when not found;
  end loop;

  -- RL_APLICACAO_PESSOA e os vínculos do CDDI caem por cascade a partir do
  -- ciclo; TB_SUBMISSAO referencia com `restrict`, e a checagem acima é a
  -- garantia de que não há nenhuma para destruir.
  delete from sigav."TB_APLICACAO_PESQUISA"
  where "SQ_VERSAO_PESQUISA" = any(v_versoes);

  delete from sigav."TH_VERSAO_PESQUISA" where "SQ_PESQUISA" = p_pesquisa;
  delete from sigav."TB_PESQUISA" where "SQ_PESQUISA" = p_pesquisa;

  return jsonb_build_object(
    'status', 'OK',
    'code', v_survey."CO_PESQUISA",
    'name', v_survey."NO_PESQUISA"
  );
end;
$function$;

-- FC_EXCLUIR_REGRA_CONDICIONAL(p_alvo uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  select "SQ_VERSAO_PESQUISA" into v_versao
  from sigav."TB_REGRA_CONDICIONAL" where "SQ_ALVO" = p_alvo;
  if v_versao is null then
    return jsonb_build_object('status', 'OK', 'removed', 0);
  end if;

  select "ST_SITUACAO" into v_status from sigav."TH_VERSAO_PESQUISA" where "SQ_VERSAO_PESQUISA" = v_versao;
  if v_status <> 'DRAFT' then
    raise exception 'A lógica condicional só pode ser alterada enquanto a versão está em rascunho.';
  end if;

  delete from sigav."TB_REGRA_CONDICIONAL" where "SQ_ALVO" = p_alvo;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    "SQ_PESSOA_ATOR", "TP_EVENTO", "TP_ENTIDADE", "CO_ENTIDADE", "DS_DADO_POSTERIOR", "DS_METADADO"
  ) values (
    v_pessoa, 'SURVEY_RULE_DELETED', 'CONDITIONAL_RULE', p_alvo::text, '{}'::jsonb, '{}'::jsonb
  );

  return jsonb_build_object('status', 'OK', 'removed', 1);
end;
$function$;

-- FC_EXIGIR_RASCUNHO_ESTRUT()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
      select old."SQ_VERSAO_PESQUISA" as version_id where tg_op in ('UPDATE', 'DELETE')
      union all
      select new."SQ_VERSAO_PESQUISA" where tg_op in ('INSERT', 'UPDATE')
    ) versions;
  elsif tg_table_name = 'TB_PERGUNTA_PESQUISA' then
    select array_agg(distinct version_id order by version_id)
    into v_version_ids
    from (
      select old."SQ_VERSAO_PESQUISA" as version_id where tg_op in ('UPDATE', 'DELETE')
      union all
      select new."SQ_VERSAO_PESQUISA" where tg_op in ('INSERT', 'UPDATE')
    ) versions;
  elsif tg_table_name = 'TB_OPCAO_PERGUNTA' then
    select array_agg(distinct question."SQ_VERSAO_PESQUISA" order by question."SQ_VERSAO_PESQUISA")
    into v_version_ids
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question."SQ_PERGUNTA" in (
      select old."SQ_PERGUNTA" where tg_op in ('UPDATE', 'DELETE')
      union
      select new."SQ_PERGUNTA" where tg_op in ('INSERT', 'UPDATE')
    );
    if v_version_ids is null and tg_op = 'DELETE' then return old; end if;
  else
    raise exception 'Tabela estrutural não suportada: %.', tg_table_name;
  end if;

  if v_version_ids is null or cardinality(v_version_ids) = 0 then
    raise exception 'Não foi possível identificar a versão da pesquisa.';
  end if;
  v_expected := cardinality(v_version_ids);

  perform "NU_VERSAO"."SQ_VERSAO_PESQUISA" from sigav."TH_VERSAO_PESQUISA" "NU_VERSAO"
  where "NU_VERSAO"."SQ_VERSAO_PESQUISA" = any(v_version_ids) order by "NU_VERSAO"."SQ_VERSAO_PESQUISA" for update;

  if (select count(*) from sigav."TH_VERSAO_PESQUISA" "NU_VERSAO" where "NU_VERSAO"."SQ_VERSAO_PESQUISA" = any(v_version_ids)) <> v_expected then
    raise exception 'Versão da pesquisa não encontrada.';
  end if;

  if tg_op = 'DELETE'
    and current_setting('app.exclusao_arquivada', true) = 'on'
    and not exists (
      select 1
      from sigav."TH_VERSAO_PESQUISA" "NU_VERSAO"
      join sigav."TB_PESQUISA" survey on survey."SQ_PESQUISA" = "NU_VERSAO"."SQ_PESQUISA"
      where "NU_VERSAO"."SQ_VERSAO_PESQUISA" = any(v_version_ids)
        and survey."DT_ARQUIVAMENTO" is null
    ) then
    return old;
  end if;

  if exists (
    select 1 from sigav."TH_VERSAO_PESQUISA" "NU_VERSAO"
    where "NU_VERSAO"."SQ_VERSAO_PESQUISA" = any(v_version_ids) and "NU_VERSAO"."ST_SITUACAO" <> 'DRAFT'
  ) then
    raise exception 'Versões publicadas não podem ser alteradas. Crie uma nova versão em rascunho.';
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$function$;

-- FC_EXPIRAR_PESQUISAS_ARQ()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    select s."SQ_PESQUISA", s."CO_PESQUISA", s."NO_PESQUISA"
    from sigav."TB_PESQUISA" s
    where s."DT_ARQUIVAMENTO" is not null
      and s."DT_ARQUIVAMENTO" < now() - interval '30 days'
      and not exists (
        select 1
        from sigav."TB_SUBMISSAO" sub
        join sigav."TB_APLICACAO_PESQUISA" a on a."SQ_APLICACAO" = sub."SQ_APLICACAO"
        join sigav."TH_VERSAO_PESQUISA" v on v."SQ_VERSAO_PESQUISA" = a."SQ_VERSAO_PESQUISA"
        where v."SQ_PESQUISA" = s."SQ_PESQUISA"
      )
      and not exists (
        select 1
        from sigav."TH_VERSAO_PESQUISA" v
        where v."SQ_PESQUISA" = s."SQ_PESQUISA"
          and v."ST_SITUACAO" <> 'DRAFT'
      )
    for update of s skip locked
  loop
    -- A auditoria é gravada antes do delete e com `application_id` nulo: a
    -- coluna referencia TB_APLICACAO_PESQUISA, que será apagada em seguida.
    insert into sigav."TL_EVENTO_AUDITORIA"(
      "SQ_PESSOA_ATOR", "TP_EVENTO", "TP_ENTIDADE", "CO_ENTIDADE", "SQ_APLICACAO",
      "DS_DADO_ANTERIOR", "DS_DADO_POSTERIOR", "DS_METADADO"
    ) values (
      null, 'SURVEY_ARCHIVE_EXPIRED', 'SURVEY', v_pesquisa."SQ_PESQUISA"::text, null,
      jsonb_build_object('code', v_pesquisa."CO_PESQUISA", 'name', v_pesquisa."NO_PESQUISA"),
      null,
      jsonb_build_object('surveyId', v_pesquisa."SQ_PESQUISA", 'reason', 'archived_over_30_days')
    );

    -- TB_APLICACAO_PESQUISA referencia a versão com `on delete restrict`, então
    -- é apagada explicitamente antes dela.
    for v_versao in
      select "SQ_VERSAO_PESQUISA" from sigav."TH_VERSAO_PESQUISA" where "SQ_PESQUISA" = v_pesquisa."SQ_PESQUISA"
    loop
      delete from sigav."TB_APLICACAO_PESQUISA" where "SQ_VERSAO_PESQUISA" = v_versao;
    end loop;

    delete from sigav."TH_VERSAO_PESQUISA" where "SQ_PESQUISA" = v_pesquisa."SQ_PESQUISA";
    delete from sigav."TB_PESQUISA" where "SQ_PESQUISA" = v_pesquisa."SQ_PESQUISA";
  end loop;
end;
$function$;

-- FC_EXPIRAR_RASCUNHOS_ANONIMOS()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  select "NU_DIAS_RETENCAO_RASC_ANON" into v_dias
  from sigav."TB_CONFIG_PLATAFORMA"
  where "CO_CONFIGURACAO" = 1;

  if v_dias is null then
    return 0;
  end if;

  delete from sigav."TB_SUBMISSAO" s
  where s."ST_SITUACAO" = 'DRAFT'
    and s."DS_METADADO"->>'origin' = 'PUBLIC_ANONYMOUS_LINK'
    -- O marcador de origem descreve como a submissão nasceu; estas três
    -- condições garantem também o estado atual. Se algum vínculo institucional
    -- tiver sido associado depois, a retenção anônima não pode apagar a linha.
    and s."SQ_PARTICIPANTE" is null
    and s."SQ_PESSOA_RESPONDENTE" is null
    and s."SQ_PESSOA_AVALIADA" is null
    and s."DT_ALTERACAO" < timezone('utc', now()) - make_interval(days => v_dias);

  get diagnostics v_apagados = row_count;

  if v_apagados > 0 then
    insert into sigav."TL_EVENTO_AUDITORIA"(
      "SQ_PESSOA_ATOR", "TP_EVENTO", "TP_ENTIDADE", "CO_ENTIDADE", "SQ_APLICACAO",
      "DS_DADO_ANTERIOR", "DS_DADO_POSTERIOR", "DS_METADADO"
    )
    values (
      null, 'ANONYMOUS_DRAFTS_EXPIRED', 'submissions', null, null, null, null,
      jsonb_build_object('apagados', v_apagados, 'diasRetencao', v_dias)
    );
  end if;

  return v_apagados;
end;
$function$;

-- FC_GERIR_CICLO_PESQUISA(target_survey_id uuid, target_action text, target_opens_at timestamp with time zone, target_closes_at timestamp with time zone)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where "SQ_PESQUISA" = target_survey_id
  for update;
  if v_survey."SQ_PESQUISA" is null then raise exception 'Pesquisa não encontrada.'; end if;

  select * into v_version
  from sigav."TH_VERSAO_PESQUISA"
  where "SQ_PESQUISA" = target_survey_id
  order by "NU_VERSAO" desc
  limit 1
  for update;
  if v_version."SQ_VERSAO_PESQUISA" is null then raise exception 'Versão da pesquisa não encontrada.'; end if;

  select * into v_application
  from sigav."TB_APLICACAO_PESQUISA"
  where "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
  order by "DT_INCLUSAO" desc
  limit 1
  for update;
  if v_application."SQ_APLICACAO" is null then raise exception 'Ciclo de aplicação não encontrado.'; end if;

  select count(*)::integer into v_sections
  from sigav."TB_SECAO_PESQUISA"
  where "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA";

  select count(*)::integer into v_questions
  from sigav."TB_PERGUNTA_PESQUISA"
  where "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA";

  v_before := jsonb_build_object(
    'surveyStatus', v_survey."ST_SITUACAO",
    'versionStatus', v_version."ST_SITUACAO",
    'applicationStatus', v_application."ST_SITUACAO",
    'opensAt', v_application."DT_ABERTURA",
    'closesAt', v_application."DT_ENCERRAMENTO",
    'archivedAt', v_survey."DT_ARQUIVAMENTO"
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
    if v_application."ST_SITUACAO" not in ('DRAFT', 'SCHEDULED') then
      raise exception 'O período só pode ser alterado em ciclos em rascunho ou agendados.';
    end if;

    update sigav."TB_APLICACAO_PESQUISA"
    set "DT_ABERTURA" = target_opens_at,
        "DT_ENCERRAMENTO" = target_closes_at,
        "DT_ALTERACAO" = now()
    where "SQ_APLICACAO" = v_application."SQ_APLICACAO";

  elsif v_action = 'PUBLISH' then
    if v_sections = 0 or v_questions = 0 then
      raise exception 'Adicione seções e perguntas antes de publicar.';
    end if;

    update sigav."TH_VERSAO_PESQUISA"
    set "ST_SITUACAO" = 'PUBLISHED',
        "DT_PUBLICACAO" = coalesce("DT_PUBLICACAO", now()),
        "DT_ALTERACAO" = now()
    where "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA";

    update sigav."TB_PESQUISA"
    set "ST_SITUACAO" = 'ACTIVE', "DT_ALTERACAO" = now()
    where "SQ_PESQUISA" = v_survey."SQ_PESQUISA";

  elsif v_action = 'SCHEDULE' then
    if v_version."ST_SITUACAO" <> 'PUBLISHED' then
      raise exception 'Publique a versão antes de agendar.';
    end if;
    if v_application."ST_SITUACAO" not in ('DRAFT', 'SCHEDULED') then
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
      set "DT_ABERTURA" = target_opens_at,
          "DT_ENCERRAMENTO" = target_closes_at,
          "DT_ALTERACAO" = now()
      where "SQ_APLICACAO" = v_application."SQ_APLICACAO";

      -- As validações seguintes olham o período efetivo, não o que estava
      -- gravado quando a função começou.
      select * into v_application
      from sigav."TB_APLICACAO_PESQUISA"
      where "SQ_APLICACAO" = v_application."SQ_APLICACAO";
    end if;

    if v_application."DT_ABERTURA" is null
       or v_application."DT_ENCERRAMENTO" is null
       or v_application."DT_ENCERRAMENTO" <= v_application."DT_ABERTURA" then
      raise exception 'Defina um período válido antes de agendar.';
    end if;
    if v_application."DT_ENCERRAMENTO" <= now() then
      raise exception 'O período deste ciclo já venceu. Atualize a abertura e o encerramento antes de agendar.';
    end if;

    update sigav."TB_APLICACAO_PESQUISA"
    set "ST_SITUACAO" = 'SCHEDULED', "DT_ALTERACAO" = now()
    where "SQ_APLICACAO" = v_application."SQ_APLICACAO";

  elsif v_action = 'OPEN' then
    if v_version."ST_SITUACAO" <> 'PUBLISHED' or v_sections = 0 or v_questions = 0 then
      raise exception 'O instrumento não está pronto para abertura.';
    end if;
    if v_application."ST_SITUACAO" not in ('DRAFT', 'SCHEDULED') then
      raise exception 'Somente ciclos em rascunho ou agendados podem ser abertos.';
    end if;
    if v_application."DT_ENCERRAMENTO" is null or v_application."DT_ENCERRAMENTO" <= now() then
      raise exception 'O encerramento informado já passou.';
    end if;

    update sigav."TB_APLICACAO_PESQUISA"
    set "ST_SITUACAO" = 'OPEN',
        "DT_ABERTURA" = least(coalesce("DT_ABERTURA", now()), now()),
        "DT_ALTERACAO" = now()
    where "SQ_APLICACAO" = v_application."SQ_APLICACAO";

  elsif v_action = 'REOPEN' then
    if v_application."ST_SITUACAO" <> 'CLOSED' then
      raise exception 'Somente ciclos encerrados podem ser reabertos.';
    end if;
    if target_opens_at is null or target_closes_at is null then
      raise exception 'Informe o novo período para reabrir o ciclo.';
    end if;
    if target_closes_at <= greatest(target_opens_at, now()) then
      raise exception 'O novo encerramento deve estar no futuro e após a abertura.';
    end if;
    if v_version."ST_SITUACAO" <> 'PUBLISHED' then
      raise exception 'A versão precisa estar publicada para reabrir o ciclo.';
    end if;

    v_next_status := case
      when target_opens_at > now() then 'SCHEDULED'
      else 'OPEN'
    end;

    update sigav."TB_APLICACAO_PESQUISA"
    set "ST_SITUACAO" = v_next_status,
        "DT_ABERTURA" = target_opens_at,
        "DT_ENCERRAMENTO" = target_closes_at,
        "DT_ALTERACAO" = now()
    where "SQ_APLICACAO" = v_application."SQ_APLICACAO";

  elsif v_action = 'CLOSE' then
    if v_application."ST_SITUACAO" <> 'OPEN' then
      raise exception 'Somente ciclos abertos podem ser encerrados. Para ciclos agendados, utilize Cancelar.';
    end if;

    update sigav."TB_APLICACAO_PESQUISA"
    set "ST_SITUACAO" = 'CLOSED',
        "DT_ENCERRAMENTO" = least(coalesce("DT_ENCERRAMENTO", now()), now()),
        "DT_ALTERACAO" = now()
    where "SQ_APLICACAO" = v_application."SQ_APLICACAO";

  elsif v_action = 'CANCEL' then
    if v_application."ST_SITUACAO" not in ('DRAFT', 'SCHEDULED', 'OPEN') then
      raise exception 'Somente ciclos em rascunho, agendados ou abertos podem ser cancelados.';
    end if;

    update sigav."TB_APLICACAO_PESQUISA"
    set "ST_SITUACAO" = 'CANCELLED', "DT_ALTERACAO" = now()
    where "SQ_APLICACAO" = v_application."SQ_APLICACAO";

    -- Finalizar arquiva na mesma operação: some do catálogo padrão e entra na
    -- janela de 30 dias que antecede a exclusão automática.
    update sigav."TB_PESQUISA"
    set "DT_ARQUIVAMENTO" = now(), "DT_ALTERACAO" = now()
    where "SQ_PESQUISA" = v_survey."SQ_PESQUISA";

  elsif v_action = 'ARCHIVE' then
    if v_survey."DT_ARQUIVAMENTO" is not null then
      raise exception 'Esta avaliação já está arquivada.';
    end if;
    if v_application."ST_SITUACAO" in ('SCHEDULED', 'OPEN') then
      raise exception 'Interrompa o ciclo antes de arquivar — use Pausar ou Finalizar.';
    end if;

    update sigav."TB_PESQUISA"
    set "DT_ARQUIVAMENTO" = now(), "DT_ALTERACAO" = now()
    where "SQ_PESQUISA" = v_survey."SQ_PESQUISA";

  elsif v_action = 'UNARCHIVE' then
    if v_survey."DT_ARQUIVAMENTO" is null then
      raise exception 'Esta avaliação não está arquivada.';
    end if;

    update sigav."TB_PESQUISA"
    set "DT_ARQUIVAMENTO" = null, "DT_ALTERACAO" = now()
    where "SQ_PESQUISA" = v_survey."SQ_PESQUISA";

  else
    raise exception 'Ação de ciclo inválida.';
  end if;

  select * into v_survey from sigav."TB_PESQUISA" where "SQ_PESQUISA" = target_survey_id;
  select * into v_version from sigav."TH_VERSAO_PESQUISA" where "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA";
  select * into v_application from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = v_application."SQ_APLICACAO";

  v_after := jsonb_build_object(
    'surveyStatus', v_survey."ST_SITUACAO",
    'versionStatus', v_version."ST_SITUACAO",
    'applicationStatus', v_application."ST_SITUACAO",
    'opensAt', v_application."DT_ABERTURA",
    'closesAt', v_application."DT_ENCERRAMENTO",
    'archivedAt', v_survey."DT_ARQUIVAMENTO"
  );

  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR",
    "TP_EVENTO",
    "TP_ENTIDADE",
    "CO_ENTIDADE",
    "SQ_APLICACAO",
    "DS_DADO_ANTERIOR",
    "DS_DADO_POSTERIOR",
    "DS_METADADO"
  ) values (
    v_actor,
    'SURVEY_CYCLE_' || v_action,
    'SURVEY_APPLICATION',
    v_application."SQ_APLICACAO"::text,
    v_application."SQ_APLICACAO",
    v_before,
    v_after,
    jsonb_build_object('surveyId', v_survey."SQ_PESQUISA", 'versionId', v_version."SQ_VERSAO_PESQUISA")
  );

  return jsonb_build_object(
    'status', 'OK',
    'action', v_action,
    'application', v_after
  );
end;
$function$;

-- FC_GRAVAR_RESP_ANON(target_submission_id uuid, target_session_token text, target_question_id uuid, target_option_ids uuid[], target_text text, target_number numeric, target_boolean boolean, target_date date, target_datetime timestamp with time zone, target_json jsonb)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  select * into v_submission from sigav."TB_SUBMISSAO" where "SQ_SUBMISSAO" = target_submission_id for update;
  if v_submission."SQ_SUBMISSAO" is null or v_submission."ST_SITUACAO" <> 'DRAFT' or coalesce(v_submission."DS_METADADO" ->> 'public_session_token_hash', '') <> v_token_hash then
    raise exception 'O rascunho anônimo não está disponível para edição.';
  end if;
  if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_submission."SQ_APLICACAO") then
    raise exception 'O período de respostas está encerrado.';
  end if;
  select "SQ_VERSAO_PESQUISA" into v_version_id from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = v_submission."SQ_APLICACAO" and "ST_ANONIMA";
  if v_version_id is null then raise exception 'A avaliação anônima não está disponível.'; end if;
  select * into v_question from sigav."TB_PERGUNTA_PESQUISA" where "SQ_PERGUNTA" = target_question_id and "SQ_VERSAO_PESQUISA" = v_version_id;
  if v_question."SQ_PERGUNTA" is null then raise exception 'Pergunta inválida para esta pesquisa.'; end if;
  if v_question."TP_PERGUNTA" in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE') then
    select coalesce(array_agg(distinct option_id),'{}'::uuid[]) into v_option_ids from unnest(coalesce(target_option_ids,'{}'::uuid[])) option_id;
    if coalesce(array_length(v_option_ids,1),0)=0 then
      delete from sigav."TB_RESPOSTA" where "SQ_SUBMISSAO"=v_submission."SQ_SUBMISSAO" and "SQ_PERGUNTA"=v_question."SQ_PERGUNTA";
    else
      if v_question."TP_PERGUNTA" in ('SCALE','SINGLE_CHOICE') and array_length(v_option_ids,1)<>1 then raise exception 'Selecione apenas uma alternativa.'; end if;
      select count(*) into v_invalid_options from unnest(v_option_ids) selected_id left join sigav."TB_OPCAO_PERGUNTA" qo on qo."SQ_OPCAO"=selected_id and qo."SQ_PERGUNTA"=v_question."SQ_PERGUNTA" and qo."ST_ATIVO" where qo."SQ_OPCAO" is null;
      if v_invalid_options>0 then raise exception 'Uma ou mais alternativas são inválidas.'; end if;
      insert into sigav."TB_RESPOSTA"("SQ_SUBMISSAO","SQ_PERGUNTA") values(v_submission."SQ_SUBMISSAO",v_question."SQ_PERGUNTA")
      on conflict ("SQ_SUBMISSAO","SQ_PERGUNTA") do update set "DS_RESPOSTA"=null,"NU_RESPOSTA"=null,"ST_RESPOSTA"=null,"DT_RESPOSTA"=null,"DT_HORA_RESPOSTA"=null,"DS_RESPOSTA_JSON"=null,"VL_NOTA"=null,"DT_ALTERACAO"=now()
      returning "SQ_RESPOSTA" into v_answer_id;
      delete from sigav."RL_RESPOSTA_OPCAO" where "SQ_RESPOSTA"=v_answer_id;
      insert into sigav."RL_RESPOSTA_OPCAO"("SQ_RESPOSTA","SQ_OPCAO","NU_ORDEM")
      select v_answer_id,option_id,row_number() over(order by option_id)::integer from unnest(v_option_ids) option_id;
    end if;
  elsif v_question."TP_PERGUNTA" in ('SHORT_TEXT','LONG_TEXT') then
    v_text:=nullif(btrim(coalesce(target_text,'')), '');
    if length(coalesce(v_text,''))>12000 then raise exception 'O texto excede o limite de 12.000 caracteres.'; end if;
    if v_text is null then
      delete from sigav."TB_RESPOSTA" where "SQ_SUBMISSAO"=v_submission."SQ_SUBMISSAO" and "SQ_PERGUNTA"=v_question."SQ_PERGUNTA";
    else
      insert into sigav."TB_RESPOSTA"("SQ_SUBMISSAO","SQ_PERGUNTA","DS_RESPOSTA") values(v_submission."SQ_SUBMISSAO",v_question."SQ_PERGUNTA",v_text)
      on conflict ("SQ_SUBMISSAO","SQ_PERGUNTA") do update set "DS_RESPOSTA"=excluded."DS_RESPOSTA","NU_RESPOSTA"=null,"ST_RESPOSTA"=null,"DT_RESPOSTA"=null,"DT_HORA_RESPOSTA"=null,"DS_RESPOSTA_JSON"=null,"VL_NOTA"=null,"DT_ALTERACAO"=now();
    end if;
  elsif v_question."TP_PERGUNTA" in ('INTEGER','DECIMAL') then
    if target_number is null then delete from sigav."TB_RESPOSTA" where "SQ_SUBMISSAO"=v_submission."SQ_SUBMISSAO" and "SQ_PERGUNTA"=v_question."SQ_PERGUNTA";
    else
      if v_question."TP_PERGUNTA"='INTEGER' and target_number<>trunc(target_number) then raise exception 'Informe um número inteiro.'; end if;
      insert into sigav."TB_RESPOSTA"("SQ_SUBMISSAO","SQ_PERGUNTA","NU_RESPOSTA") values(v_submission."SQ_SUBMISSAO",v_question."SQ_PERGUNTA",target_number)
      on conflict ("SQ_SUBMISSAO","SQ_PERGUNTA") do update set "DS_RESPOSTA"=null,"NU_RESPOSTA"=excluded."NU_RESPOSTA","ST_RESPOSTA"=null,"DT_RESPOSTA"=null,"DT_HORA_RESPOSTA"=null,"DS_RESPOSTA_JSON"=null,"VL_NOTA"=null,"DT_ALTERACAO"=now();
    end if;
  elsif v_question."TP_PERGUNTA"='BOOLEAN' then
    if target_boolean is null then delete from sigav."TB_RESPOSTA" where "SQ_SUBMISSAO"=v_submission."SQ_SUBMISSAO" and "SQ_PERGUNTA"=v_question."SQ_PERGUNTA";
    else
      insert into sigav."TB_RESPOSTA"("SQ_SUBMISSAO","SQ_PERGUNTA","ST_RESPOSTA") values(v_submission."SQ_SUBMISSAO",v_question."SQ_PERGUNTA",target_boolean)
      on conflict ("SQ_SUBMISSAO","SQ_PERGUNTA") do update set "DS_RESPOSTA"=null,"NU_RESPOSTA"=null,"ST_RESPOSTA"=excluded."ST_RESPOSTA","DT_RESPOSTA"=null,"DT_HORA_RESPOSTA"=null,"DS_RESPOSTA_JSON"=null,"VL_NOTA"=null,"DT_ALTERACAO"=now();
    end if;
  elsif v_question."TP_PERGUNTA"='DATE' then
    if target_date is null then delete from sigav."TB_RESPOSTA" where "SQ_SUBMISSAO"=v_submission."SQ_SUBMISSAO" and "SQ_PERGUNTA"=v_question."SQ_PERGUNTA";
    else
      insert into sigav."TB_RESPOSTA"("SQ_SUBMISSAO","SQ_PERGUNTA","DT_RESPOSTA") values(v_submission."SQ_SUBMISSAO",v_question."SQ_PERGUNTA",target_date)
      on conflict ("SQ_SUBMISSAO","SQ_PERGUNTA") do update set "DS_RESPOSTA"=null,"NU_RESPOSTA"=null,"ST_RESPOSTA"=null,"DT_RESPOSTA"=excluded."DT_RESPOSTA","DT_HORA_RESPOSTA"=null,"DS_RESPOSTA_JSON"=null,"VL_NOTA"=null,"DT_ALTERACAO"=now();
    end if;
  elsif v_question."TP_PERGUNTA"='DATETIME' then
    if target_datetime is null then delete from sigav."TB_RESPOSTA" where "SQ_SUBMISSAO"=v_submission."SQ_SUBMISSAO" and "SQ_PERGUNTA"=v_question."SQ_PERGUNTA";
    else
      insert into sigav."TB_RESPOSTA"("SQ_SUBMISSAO","SQ_PERGUNTA","DT_HORA_RESPOSTA") values(v_submission."SQ_SUBMISSAO",v_question."SQ_PERGUNTA",target_datetime)
      on conflict ("SQ_SUBMISSAO","SQ_PERGUNTA") do update set "DS_RESPOSTA"=null,"NU_RESPOSTA"=null,"ST_RESPOSTA"=null,"DT_RESPOSTA"=null,"DT_HORA_RESPOSTA"=excluded."DT_HORA_RESPOSTA","DS_RESPOSTA_JSON"=null,"VL_NOTA"=null,"DT_ALTERACAO"=now();
    end if;
  else raise exception 'Tipo de pergunta ainda não suportado: %.',v_question."TP_PERGUNTA"; end if;
  update sigav."TB_SUBMISSAO" set "DT_ALTERACAO"=now() where "SQ_SUBMISSAO"=v_submission."SQ_SUBMISSAO";
  return jsonb_build_object('status','OK','savedAt',now());
end;
$function$;

-- FC_INCLUIR_PERGUNTA(target_survey_id uuid, target_section_id uuid, question_title text, question_description text, question_type text, is_required boolean, question_options jsonb)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  v_type:=upper(btrim("TP_PERGUNTA"));
  if v_type not in ('SHORT_TEXT','LONG_TEXT','INTEGER','DECIMAL','DATE','DATETIME','BOOLEAN','SINGLE_CHOICE','MULTIPLE_CHOICE','SCALE') then raise exception 'Tipo de pergunta não suportado neste construtor.'; end if;
  select sv."SQ_VERSAO_PESQUISA" into v_version_id from sigav."TH_VERSAO_PESQUISA" sv join sigav."TB_SECAO_PESQUISA" sec on sec."SQ_VERSAO_PESQUISA"=sv."SQ_VERSAO_PESQUISA" where sv."SQ_PESQUISA"=target_survey_id and sv."ST_SITUACAO"='DRAFT' and sec."SQ_SECAO"=target_section_id order by sv."NU_VERSAO" desc limit 1;
  if v_version_id is null then raise exception 'Seção ou versão em rascunho não encontrada.'; end if;
  if v_type in ('SINGLE_CHOICE','MULTIPLE_CHOICE','SCALE') and jsonb_array_length(coalesce(question_options,'[]'::jsonb))<2 then raise exception 'Informe pelo menos duas alternativas.'; end if;
  select coalesce(max("NU_ORDEM"),0)+1 into v_position from sigav."TB_PERGUNTA_PESQUISA" where "SQ_SECAO"=target_section_id;
  insert into sigav."TB_PERGUNTA_PESQUISA"("SQ_VERSAO_PESQUISA","SQ_SECAO","CO_PERGUNTA","NO_PERGUNTA","DS_PERGUNTA","TP_PERGUNTA","ST_OBRIGATORIA","NU_ORDEM","DS_VALIDACAO","DS_LOGICA_EXIBICAO","DS_PONTUACAO","DS_CONFIGURACAO")
  values(v_version_id,target_section_id,'Q_'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),btrim(question_title),nullif(btrim(question_description),''),v_type,is_required,v_position,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{}'::jsonb) returning "SQ_PERGUNTA" into v_question_id;
  if v_type in ('SINGLE_CHOICE','MULTIPLE_CHOICE','SCALE') then
    for v_option,v_ordinal in select "DS_VALOR",ordinality from jsonb_array_elements(question_options) with ordinality loop
      insert into sigav."TB_OPCAO_PERGUNTA"("SQ_PERGUNTA","CO_OPCAO","NO_OPCAO","DS_VALOR","VL_NOTA","NU_ORDEM","ST_ATIVO","DS_METADADO")
      values(v_question_id,'O'||lpad(v_ordinal::text,2,'0'),coalesce(nullif(btrim(v_option->>'label'),''),'Opção '||v_ordinal),coalesce(nullif(btrim(v_option->>'value'),''),v_ordinal::text),case when nullif(v_option->>'score','') is null then null else (v_option->>'score')::numeric end,v_ordinal::integer,true,'{}'::jsonb);
    end loop;
  end if;
  return jsonb_build_object('status','OK','questionId',v_question_id);
end;$function$;

-- FC_INCLUIR_PESSOA_EQUIPE(target_application_id uuid, target_person_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  if not exists (select 1 from sigav."RL_APLICACAO_PESSOA" ap where ap."SQ_APLICACAO"=target_application_id and ap."SQ_PESSOA"=target_person_id and ap."ST_SITUACAO" not in ('REMOVED','INELIGIBLE')) then raise exception 'A pessoa não participa deste ciclo.'; end if;
  if exists (select 1 from sigav."RT_LIDERANCA_CDDI" l where l."SQ_APLICACAO"=target_application_id and l."SQ_PESSOA_SUBORDINADA"=target_person_id and l."ST_SITUACAO"='ACTIVE' and l."DT_FIM_VIGENCIA" is null) then raise exception 'A pessoa já possui uma liderança ativa neste ciclo.'; end if;
  insert into sigav."RT_LIDERANCA_CDDI"("SQ_APLICACAO","SQ_PESSOA_LIDER","SQ_PESSOA_SUBORDINADA","ST_SITUACAO","DT_INICIO_VIGENCIA","TP_ORIGEM","DS_METADADO")
  values(target_application_id,v_leader_id,target_person_id,'ACTIVE',timezone('utc',now()),'SELF_SERVICE',jsonb_build_object('created_by_role',case when sigav."FC_PODE_GERIR_PESQUISA"() then 'TECHNICAL_TEAM' else 'LEADER' end)) returning "SQ_LIDERANCA" into v_link_id;
  select "NO_PESSOA" into v_person_name from sigav."TB_PESSOA" where "SQ_PESSOA"=target_person_id;
  insert into sigav."TL_EVENTO_AUDITORIA"("SQ_PESSOA_ATOR","TP_EVENTO","TP_ENTIDADE","CO_ENTIDADE","SQ_APLICACAO","DS_DADO_POSTERIOR","DS_METADADO")
  values(v_leader_id,'TEAM_MEMBER_ADDED','CDDI_LEADERSHIP_LINK',v_link_id::text,target_application_id,jsonb_build_object('leaderPersonId',v_leader_id,'subordinatePersonId',target_person_id),'{}'::jsonb);
  return jsonb_build_object('status','OK','linkId',v_link_id,'personName',v_person_name);
end;$function$;

-- FC_INCLUIR_SECAO(target_survey_id uuid, section_title text, section_description text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  select "SQ_VERSAO_PESQUISA" into v_version_id from sigav."TH_VERSAO_PESQUISA" where "SQ_PESQUISA"=target_survey_id and "ST_SITUACAO"='DRAFT' order by "NU_VERSAO" desc limit 1;
  if v_version_id is null then raise exception 'A pesquisa não possui uma versão em rascunho.'; end if;
  select coalesce(max("NU_ORDEM"),0)+1 into v_position from sigav."TB_SECAO_PESQUISA" where "SQ_VERSAO_PESQUISA"=v_version_id;
  insert into sigav."TB_SECAO_PESQUISA"("SQ_VERSAO_PESQUISA","CO_SECAO","NO_SECAO","DS_SECAO","NU_ORDEM","DS_CONFIGURACAO")
  values(v_version_id,'S_'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,8)),btrim(section_title),nullif(btrim(section_description),''),v_position,'{}'::jsonb) returning "SQ_SECAO" into v_id;
  return jsonb_build_object('status','OK','sectionId',v_id);
end;$function$;

-- FC_INICIAR_OU_RETOMAR_CDDI(target_application_code text, target_submission_type text, target_subject_person_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  join sigav."TH_VERSAO_PESQUISA" sv on sv."SQ_VERSAO_PESQUISA" = sa."SQ_VERSAO_PESQUISA"
  join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = sv."SQ_PESQUISA"
  where sa."CO_APLICACAO" = target_application_code
    and s."CO_PESQUISA" = 'CDDI'
  limit 1;

  if not found then
    raise exception 'Aplicação CDDI não encontrada.';
  end if;

  select ap.*
    into v_participant
  from sigav."RL_APLICACAO_PESSOA" ap
  where ap."SQ_APLICACAO" = v_application."SQ_APLICACAO"
    and ap."SQ_PESSOA" = v_person_id
    and ap."TP_PARTICIPANTE" = 'RESPONDENT'
    and ap."ST_SITUACAO" not in ('BLOCKED', 'EXCLUDED')
  order by ap."DT_INCLUSAO" desc
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
      where l."SQ_APLICACAO" = v_application."SQ_APLICACAO"
        and l."SQ_PESSOA_LIDER" = v_person_id
        and l."SQ_PESSOA_SUBORDINADA" = v_subject_person_id
        and l."ST_SITUACAO" = 'ACTIVE'
        and l."DT_INICIO_VIGENCIA" <= now()
        and (l."DT_FIM_VIGENCIA" is null or l."DT_FIM_VIGENCIA" > now())
    ) then
      raise exception 'Não existe vínculo ativo com a pessoa avaliada.';
    end if;
  else
    raise exception 'Tipo de avaliação inválido.';
  end if;

  select s.*
    into v_submission
  from sigav."TB_SUBMISSAO" s
  where s."SQ_APLICACAO" = v_application."SQ_APLICACAO"
    and s."SQ_PESSOA_RESPONDENTE" = v_person_id
    and s."SQ_PESSOA_AVALIADA" = v_subject_person_id
    and s."TP_SUBMISSAO" = v_type
    and s."ST_SITUACAO" in ('DRAFT', 'SUBMITTED', 'VALIDATED')
  order by s."NU_VERSAO" desc, s."DT_INCLUSAO" desc
  limit 1;

  if not found then
    if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application."SQ_APLICACAO") then
      return jsonb_build_object(
        'status', 'PERIOD_CLOSED',
        'applicationStatus', v_application."ST_SITUACAO",
        'canEdit', false,
        'submission', null,
        'answers', '{}'::jsonb
      );
    end if;

    insert into sigav."TB_SUBMISSAO" (
      "SQ_APLICACAO",
      "SQ_PARTICIPANTE",
      "SQ_PESSOA_RESPONDENTE",
      "SQ_PESSOA_AVALIADA",
      "TP_SUBMISSAO",
      "ST_SITUACAO",
      "DS_METADADO"
    ) values (
      v_application."SQ_APLICACAO",
      v_participant."SQ_PARTICIPANTE",
      v_person_id,
      v_subject_person_id,
      v_type,
      'DRAFT',
      jsonb_build_object('origin', 'PLATFORM_WEB')
    )
    returning * into v_submission;

    if v_type = 'AUTO' then
      update sigav."RL_APLICACAO_PESSOA"
      set "ST_SITUACAO" = case when "ST_SITUACAO" in ('ELIGIBLE', 'INVITED') then 'IN_PROGRESS' else "ST_SITUACAO" end,
          "DT_INICIO" = coalesce("DT_INICIO", now())
      where "SQ_PARTICIPANTE" = v_participant."SQ_PARTICIPANTE";
    end if;
  end if;

  select coalesce(
    jsonb_object_agg(
      a."SQ_PERGUNTA"::text,
      jsonb_build_object(
        'answerText', a."DS_RESPOSTA",
        'answerNumber', a."NU_RESPOSTA",
        'optionId', selected_option.option_id,
        'optionValue', qo."DS_VALOR"
      )
    ),
    '{}'::jsonb
  )
  into v_answers
  from sigav."TB_RESPOSTA" a
  left join lateral (
    select ao."SQ_OPCAO" as option_id
    from sigav."RL_RESPOSTA_OPCAO" ao
    where ao."SQ_RESPOSTA" = a."SQ_RESPOSTA"
    order by ao."NU_ORDEM" nulls last, ao."DT_INCLUSAO"
    limit 1
  ) selected_option on true
  left join sigav."TB_OPCAO_PERGUNTA" qo on qo."SQ_OPCAO" = selected_option.option_id
  where a."SQ_SUBMISSAO" = v_submission."SQ_SUBMISSAO";

  v_can_edit := v_submission."ST_SITUACAO" = 'DRAFT'
    and sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application."SQ_APLICACAO");

  return jsonb_build_object(
    'status', 'OK',
    'applicationStatus', v_application."ST_SITUACAO",
    'canEdit', v_can_edit,
    'submission', jsonb_build_object(
      'id', v_submission."SQ_SUBMISSAO",
      'status', v_submission."ST_SITUACAO",
      'startedAt', v_submission."DT_INICIO",
      'submittedAt', v_submission."DT_ENVIO",
      'updatedAt', v_submission."DT_ALTERACAO",
      'result', v_submission."VL_RESULTADO",
      'type', v_submission."TP_SUBMISSAO"
    ),
    'answers', v_answers
  );
end;
$function$;

-- FC_INICIAR_OU_RETOMAR_PESQ(target_application_code text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  select * into v_app from sigav."TB_APLICACAO_PESQUISA" where "CO_APLICACAO" = btrim(target_application_code) limit 1;
  if v_app."SQ_APLICACAO" is null then raise exception 'Aplicação não encontrada.'; end if;
  if not sigav."FC_PODE_ACESSAR_CICLO"(v_app."SQ_APLICACAO") then raise exception 'Seu cadastro não está autorizado para esta pesquisa.'; end if;

  select * into v_part from sigav."RL_APLICACAO_PESSOA"
  where "SQ_APLICACAO" = v_app."SQ_APLICACAO" and "SQ_PESSOA" = v_person and "TP_PARTICIPANTE" = 'RESPONDENT'
    and "ST_SITUACAO" not in ('BLOCKED','EXCLUDED')
  order by "DT_INCLUSAO" desc limit 1;

  if v_part."SQ_PARTICIPANTE" is null and v_app."TP_ACESSO" = 'INSTITUTIONAL' then
    insert into sigav."RL_APLICACAO_PESSOA"("SQ_APLICACAO", "SQ_PESSOA", "TP_PARTICIPANTE", "ST_SITUACAO", "TP_ACESSO", "DS_METADADO")
    values (v_app."SQ_APLICACAO", v_person, 'RESPONDENT', 'ELIGIBLE', 'USUARIO_INSTITUCIONAL', jsonb_build_object('origin','INSTITUTIONAL_ACCESS'))
    on conflict ("SQ_APLICACAO", "SQ_PESSOA", "TP_PARTICIPANTE") do update
      set "ST_SITUACAO" = case when sigav."RL_APLICACAO_PESSOA"."ST_SITUACAO" in ('BLOCKED','EXCLUDED')
                        then sigav."RL_APLICACAO_PESSOA"."ST_SITUACAO" else 'ELIGIBLE' end,
          "DT_ALTERACAO" = timezone('utc', now())
    returning * into v_part;
  end if;
  if v_part."SQ_PARTICIPANTE" is null and not sigav."FC_PODE_GERIR_PESQUISA"() then raise exception 'Seu cadastro não está elegível para esta pesquisa.'; end if;

  if v_app."ST_ANONIMA" then
    -- A submissão nunca recebe a identidade; quem sabe de quem é o rascunho é o
    -- bilhete, e só enquanto ele existir.
    select s.* into v_sub
    from sigav."TB_SUBMISSAO" s
    join sigav."TB_BILHETE_ANONIMO" b on b."SQ_SUBMISSAO" = s."SQ_SUBMISSAO"
    where b."SQ_APLICACAO" = v_app."SQ_APLICACAO" and b."SQ_PESSOA" = v_person
    limit 1;

    -- Sem bilhete e com participação concluída, a pessoa já enviou: não há
    -- rascunho a retomar e um novo seria resposta em dobro.
    if v_sub."SQ_SUBMISSAO" is null and v_part."ST_SITUACAO" = 'COMPLETED' then
      return jsonb_build_object(
        'status', 'ALREADY_SUBMITTED', 'applicationStatus', v_app."ST_SITUACAO",
        'anonymous', true, 'canEdit', false, 'submission', null, 'answers', '{}'::jsonb
      );
    end if;

    if v_sub."SQ_SUBMISSAO" is null and sigav."FC_CICLO_ACEITA_RESPOSTA"(v_app."SQ_APLICACAO") then
      insert into sigav."TB_SUBMISSAO"("SQ_APLICACAO", "SQ_PARTICIPANTE", "SQ_PESSOA_RESPONDENTE", "SQ_PESSOA_AVALIADA", "TP_SUBMISSAO", "ST_SITUACAO", "DS_METADADO")
      values (v_app."SQ_APLICACAO", null, null, null, 'RESPONSE', 'DRAFT', jsonb_build_object('origin','PLATFORM_WEB_ANONYMOUS'))
      returning * into v_sub;

      insert into sigav."TB_BILHETE_ANONIMO" ("SQ_APLICACAO", "SQ_PESSOA", "SQ_SUBMISSAO")
      values (v_app."SQ_APLICACAO", v_person, v_sub."SQ_SUBMISSAO");

      update sigav."RL_APLICACAO_PESSOA"
      set "ST_SITUACAO" = 'IN_PROGRESS', "DT_INICIO" = coalesce("DT_INICIO", timezone('utc', now())), "DT_ALTERACAO" = timezone('utc', now())
      where "SQ_PARTICIPANTE" = v_part."SQ_PARTICIPANTE" and "ST_SITUACAO" in ('ELIGIBLE','INVITED');
    end if;
  else
    select * into v_sub from sigav."TB_SUBMISSAO"
    where "SQ_APLICACAO" = v_app."SQ_APLICACAO" and "SQ_PESSOA_RESPONDENTE" = v_person and "SQ_PESSOA_AVALIADA" = v_person
      and "TP_SUBMISSAO" in ('RESPONSE','AUTO') and "ST_SITUACAO" in ('DRAFT','SUBMITTED','VALIDATED')
    order by "NU_VERSAO" desc, "DT_INCLUSAO" desc limit 1;

    if v_sub."SQ_SUBMISSAO" is null and sigav."FC_CICLO_ACEITA_RESPOSTA"(v_app."SQ_APLICACAO") then
      if v_part."SQ_PARTICIPANTE" is null then raise exception 'Inclua seu cadastro como participante antes de responder.'; end if;
      insert into sigav."TB_SUBMISSAO"("SQ_APLICACAO", "SQ_PARTICIPANTE", "SQ_PESSOA_RESPONDENTE", "SQ_PESSOA_AVALIADA", "TP_SUBMISSAO", "ST_SITUACAO", "DS_METADADO")
      values (v_app."SQ_APLICACAO", v_part."SQ_PARTICIPANTE", v_person, v_person, 'RESPONSE', 'DRAFT', jsonb_build_object('origin','PLATFORM_WEB_GENERIC'))
      returning * into v_sub;
      update sigav."RL_APLICACAO_PESSOA"
      set "ST_SITUACAO" = 'IN_PROGRESS', "DT_INICIO" = coalesce("DT_INICIO", timezone('utc', now())), "DT_ALTERACAO" = timezone('utc', now())
      where "SQ_PARTICIPANTE" = v_part."SQ_PARTICIPANTE" and "ST_SITUACAO" in ('ELIGIBLE','INVITED');
    end if;
  end if;

  if v_sub."SQ_SUBMISSAO" is not null then
    select coalesce(jsonb_object_agg(a."SQ_PERGUNTA"::text, jsonb_build_object(
      'answerText', a."DS_RESPOSTA", 'answerNumber', a."NU_RESPOSTA", 'answerBoolean', a."ST_RESPOSTA",
      'answerDate', a."DT_RESPOSTA", 'answerDatetime', a."DT_HORA_RESPOSTA", 'answerJson', a."DS_RESPOSTA_JSON",
      'optionIds', coalesce(o.ids, '[]'::jsonb))), '{}'::jsonb)
    into v_answers
    from sigav."TB_RESPOSTA" a
    left join lateral (
      select jsonb_agg(ao."SQ_OPCAO" order by ao."NU_ORDEM") ids
      from sigav."RL_RESPOSTA_OPCAO" ao where ao."SQ_RESPOSTA" = a."SQ_RESPOSTA"
    ) o on true
    where a."SQ_SUBMISSAO" = v_sub."SQ_SUBMISSAO";
  end if;

  v_edit := v_sub."SQ_SUBMISSAO" is not null and v_sub."ST_SITUACAO" = 'DRAFT' and sigav."FC_CICLO_ACEITA_RESPOSTA"(v_app."SQ_APLICACAO");
  return jsonb_build_object(
    'status', case when sigav."FC_CICLO_ACEITA_RESPOSTA"(v_app."SQ_APLICACAO") then 'OK' else 'PERIOD_CLOSED' end,
    'applicationStatus', v_app."ST_SITUACAO",
    'anonymous', v_app."ST_ANONIMA",
    'canEdit', v_edit,
    'submission', case when v_sub."SQ_SUBMISSAO" is null then null else jsonb_build_object(
      'id', v_sub."SQ_SUBMISSAO", 'status', v_sub."ST_SITUACAO", 'startedAt', v_sub."DT_INICIO",
      'submittedAt', v_sub."DT_ENVIO", 'updatedAt', v_sub."DT_ALTERACAO") end,
    'answers', v_answers
  );
end $function$;

-- FC_INICIAR_OU_RETOMAR_SUBM(target_application_code text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  select * into v_application from sigav."TB_APLICACAO_PESQUISA" where "CO_APLICACAO" = btrim(target_application_code) limit 1;
  if v_application."SQ_APLICACAO" is null then raise exception 'Aplicação não encontrada.'; end if;

  select * into v_participant
  from sigav."RL_APLICACAO_PESSOA"
  where "SQ_APLICACAO" = v_application."SQ_APLICACAO"
    and "SQ_PESSOA" = v_person_id
    and "TP_PARTICIPANTE" = 'RESPONDENT'
    and "ST_SITUACAO" not in ('REMOVED','INELIGIBLE','BLOCKED','EXCLUDED')
  order by "DT_INCLUSAO" desc limit 1;

  if v_participant."SQ_PARTICIPANTE" is null and not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Seu cadastro não está elegível para esta pesquisa.';
  end if;

  select * into v_submission
  from sigav."TB_SUBMISSAO"
  where "SQ_APLICACAO" = v_application."SQ_APLICACAO"
    and "SQ_PESSOA_RESPONDENTE" = v_person_id
    and "SQ_PESSOA_AVALIADA" = v_person_id
    and "TP_SUBMISSAO" = 'AUTO'
    and "ST_SITUACAO" in ('DRAFT','SUBMITTED','VALIDATED')
  order by "NU_VERSAO" desc, "DT_INCLUSAO" desc limit 1;

  if v_submission."SQ_SUBMISSAO" is null then
    if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application."SQ_APLICACAO") then
      return jsonb_build_object('status','PERIOD_CLOSED','applicationStatus',v_application."ST_SITUACAO",'canEdit',false,'submission',null,'answers','{}'::jsonb);
    end if;
    if v_participant."SQ_PARTICIPANTE" is null then raise exception 'Administradores devem ser incluídos como participantes para responder esta pesquisa.'; end if;

    insert into sigav."TB_SUBMISSAO"("SQ_APLICACAO","SQ_PARTICIPANTE","SQ_PESSOA_RESPONDENTE","SQ_PESSOA_AVALIADA","TP_SUBMISSAO","ST_SITUACAO","DS_METADADO")
    values(v_application."SQ_APLICACAO",v_participant."SQ_PARTICIPANTE",v_person_id,v_person_id,'AUTO','DRAFT',jsonb_build_object('origin','PLATFORM_WEB_GENERIC'))
    returning * into v_submission;

    update sigav."RL_APLICACAO_PESSOA"
    set "ST_SITUACAO" = case when "ST_SITUACAO" in ('ELIGIBLE','INVITED') then 'IN_PROGRESS' else "ST_SITUACAO" end,
        "DT_INICIO" = coalesce("DT_INICIO", now())
    where "SQ_PARTICIPANTE" = v_participant."SQ_PARTICIPANTE";
  end if;

  select coalesce(jsonb_object_agg(a."SQ_PERGUNTA"::text,jsonb_build_object(
    'answerText',a."DS_RESPOSTA",'answerNumber',a."NU_RESPOSTA",'optionId',selected.option_id,'optionValue',qo."DS_VALOR"
  )),'{}'::jsonb)
  into v_answers
  from sigav."TB_RESPOSTA" a
  left join lateral (
    select ao."SQ_OPCAO" as option_id from sigav."RL_RESPOSTA_OPCAO" ao where ao."SQ_RESPOSTA"=a."SQ_RESPOSTA" order by ao."NU_ORDEM" nulls last,ao."DT_INCLUSAO" limit 1
  ) selected on true
  left join sigav."TB_OPCAO_PERGUNTA" qo on qo."SQ_OPCAO"=selected.option_id
  where a."SQ_SUBMISSAO"=v_submission."SQ_SUBMISSAO";

  v_can_edit := v_submission."ST_SITUACAO"='DRAFT' and sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application."SQ_APLICACAO");
  return jsonb_build_object(
    'status','OK','applicationStatus',v_application."ST_SITUACAO",'canEdit',v_can_edit,
    'submission',jsonb_build_object('id',v_submission."SQ_SUBMISSAO",'status',v_submission."ST_SITUACAO",'startedAt',v_submission."DT_INICIO",'submittedAt',v_submission."DT_ENVIO",'updatedAt',v_submission."DT_ALTERACAO",'type',v_submission."TP_SUBMISSAO"),
    'answers',v_answers
  );
end;
$function$;

-- FC_INICIAR_RESP_ANON(target_application_code text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where "CO_APLICACAO" = btrim(target_application_code)
  limit 1;
  if v_application."SQ_APLICACAO" is null or not v_application."ST_ANONIMA" then
    raise exception 'A avaliação anônima não foi encontrada.';
  end if;
  if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application."SQ_APLICACAO") then
    raise exception 'O período de respostas está encerrado.';
  end if;
  insert into sigav."TB_SUBMISSAO"("SQ_APLICACAO", "SQ_PARTICIPANTE", "SQ_PESSOA_RESPONDENTE", "SQ_PESSOA_AVALIADA", "TP_SUBMISSAO", "ST_SITUACAO", "DS_METADADO")
  values (v_application."SQ_APLICACAO", null, null, null, 'RESPONSE', 'DRAFT', jsonb_build_object('origin', 'PUBLIC_ANONYMOUS_LINK', 'public_session_token_hash', v_token_hash))
  returning * into v_submission;
  return jsonb_build_object('status','OK','anonymous',true,'canEdit',true,'sessionToken',v_token,
    'submission',jsonb_build_object('id',v_submission."SQ_SUBMISSAO",'status',v_submission."ST_SITUACAO",'submittedAt',null),'answers','{}'::jsonb);
end;
$function$;

-- FC_LISTAR_ACESSOS_PAGINADOS(p_busca text, p_limite integer, p_offset integer)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where person."ST_ATIVO"
    and (
      v_busca = ''
      or sigav."FC_SEM_ACENTO_MINUSCULA"(person."NO_PESSOA") like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(v_busca) || '%'
      or coalesce(person."CO_MATRICULA", '') ilike '%' || v_busca || '%'
      or coalesce(person."DS_EMAIL_INSTITUCIONAL", '') ilike '%' || v_busca || '%'
      or sigav."FC_SEM_ACENTO_MINUSCULA"(coalesce(person."NO_CARGO", '')) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(v_busca) || '%'
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', pm."CO_MODULO",
    'name', pm."NO_MODULO",
    'description', pm."DS_MODULO",
    'category', pm."TP_CATEGORIA",
    'position', pm."NU_ORDEM",
    'required', pm."CO_MODULO" in ('HOME', 'SURVEYS')
  ) order by pm."NU_ORDEM", pm."CO_MODULO"), '[]'::jsonb)
  into v_permissions
  from sigav."TB_MODULO_PLATAFORMA" pm
  where pm."ST_ATIVO";

  select coalesce(jsonb_agg(jsonb_build_object(
    'personId', person."SQ_PESSOA",
    'fullName', person."NO_PESSOA",
    'employeeNumber', person."CO_MATRICULA",
    'institutionalEmail', person."DS_EMAIL_INSTITUCIONAL",
    'jobTitle', person."NO_CARGO",
    'unit', coalesce(person."DS_METADADO"->>'unit', person."CO_CENTRO_CUSTO"),
    'active', person."ST_ATIVO",
    'permissions', to_jsonb(sigav."FC_MODULOS_EFETIVOS"(person."SQ_PESSOA"))
  ) order by person."NO_PESSOA", person."SQ_PESSOA"), '[]'::jsonb)
  into v_people
  from (
    select candidate.*
    from sigav."TB_PESSOA" candidate
    where candidate."ST_ATIVO"
      and (
        v_busca = ''
        or sigav."FC_SEM_ACENTO_MINUSCULA"(candidate."NO_PESSOA") like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(v_busca) || '%'
        or coalesce(candidate."CO_MATRICULA", '') ilike '%' || v_busca || '%'
        or coalesce(candidate."DS_EMAIL_INSTITUCIONAL", '') ilike '%' || v_busca || '%'
        or sigav."FC_SEM_ACENTO_MINUSCULA"(coalesce(candidate."NO_CARGO", '')) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(v_busca) || '%'
      )
    order by candidate."NO_PESSOA", candidate."SQ_PESSOA"
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

-- FC_LISTAR_AUDIENCIA_EMAIL(p_aplicacao uuid, p_situacao text, p_busca text, p_limite integer)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
      p."SQ_PESSOA" as "personId",
      p."NO_PESSOA" as "fullName",
      p."CO_MATRICULA" as "employeeNumber",
      p."DS_EMAIL_INSTITUCIONAL" as "DS_EMAIL",
      ap."ST_SITUACAO" as "participantStatus",
      d.situacao as situation,
      d.ultimo_envio as "lastEmailAt",
      d.ultimo_tipo as "lastEmailKind",
      d.ultimo_estado as "lastEmailStatus",
      (p."DS_EMAIL_INSTITUCIONAL" ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') as "emailValido"
    from sigav."RL_APLICACAO_PESSOA" ap
    join sigav."TB_PESSOA" p on p."SQ_PESSOA" = ap."SQ_PESSOA"
    cross join lateral (
      select
        case
          when ap."DT_CONCLUSAO" is not null
            or exists (
              select 1
              from sigav."TB_SUBMISSAO" sb
              where sb."SQ_APLICACAO" = ap."SQ_APLICACAO"
                and sb."SQ_PESSOA_RESPONDENTE" = p."SQ_PESSOA"
                and (sb."SQ_PESSOA_AVALIADA" is null or sb."SQ_PESSOA_AVALIADA" = p."SQ_PESSOA")
                and sb."ST_SITUACAO" in ('SUBMITTED', 'VALIDATED')
            ) then 'DONE'
          when exists (
              select 1
              from sigav."TB_SUBMISSAO" sb
              where sb."SQ_APLICACAO" = ap."SQ_APLICACAO"
                and sb."SQ_PESSOA_RESPONDENTE" = p."SQ_PESSOA"
                and (sb."SQ_PESSOA_AVALIADA" is null or sb."SQ_PESSOA_AVALIADA" = p."SQ_PESSOA")
                and sb."ST_SITUACAO" = 'DRAFT'
            ) then 'DRAFT'
          else 'PENDING'
        end as situacao,
        (
          select t."DT_INCLUSAO"
          from sigav."TL_EMAIL_PARTICIPANTE" t
          where t."SQ_APLICACAO" = ap."SQ_APLICACAO"
            and t."SQ_PESSOA" = p."SQ_PESSOA"
          order by t."DT_INCLUSAO" desc
          limit 1
        ) as ultimo_envio,
        (
          select t."TP_EMAIL"
          from sigav."TL_EMAIL_PARTICIPANTE" t
          where t."SQ_APLICACAO" = ap."SQ_APLICACAO"
            and t."SQ_PESSOA" = p."SQ_PESSOA"
          order by t."DT_INCLUSAO" desc
          limit 1
        ) as ultimo_tipo,
        (
          select t."ST_ENVIO"
          from sigav."TL_EMAIL_PARTICIPANTE" t
          where t."SQ_APLICACAO" = ap."SQ_APLICACAO"
            and t."SQ_PESSOA" = p."SQ_PESSOA"
          order by t."DT_INCLUSAO" desc
          limit 1
        ) as ultimo_estado
    ) d
    where ap."SQ_APLICACAO" = p_aplicacao
      and ap."ST_SITUACAO" in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS', 'COMPLETED')
      and p."ST_ATIVO"
      and (v_situacao = 'ALL' or d.situacao = v_situacao)
      and (
        v_busca is null
        or sigav."FC_SEM_ACENTO_MINUSCULA"(p."NO_PESSOA") like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(v_busca) || '%'
        or p."CO_MATRICULA" like '%' || v_busca || '%'
        or sigav."FC_SEM_ACENTO_MINUSCULA"(p."DS_EMAIL_INSTITUCIONAL") like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(v_busca) || '%'
      )
    limit v_limite
  ) f;

  return v_result;
end;
$function$;

-- FC_LISTAR_AUDITORIA_PESSOA(target_person_id uuid, target_limit integer)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
     or not exists(select 1 from sigav."TB_PESSOA" where "SQ_PESSOA" = target_person_id) then
    raise exception 'Pessoa nao encontrada.';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'eventId', e."SQ_EVENTO",
          'eventType', e."TP_EVENTO",
          'actorPersonId', e."SQ_PESSOA_ATOR",
          'actorName', actor."NO_PESSOA",
          'beforeData', e."DS_DADO_ANTERIOR",
          'afterData', e."DS_DADO_POSTERIOR",
          'justification', nullif(btrim(coalesce(e."DS_METADADO"->>'justification', '')), ''),
          'createdAt', e."DT_INCLUSAO"
        )
        order by e."DT_INCLUSAO" desc
      ),
      '[]'::jsonb
    )
    from (
      select event.*
      from sigav."TL_EVENTO_AUDITORIA" event
      where event."TP_ENTIDADE" = 'PERSON'
        and event."CO_ENTIDADE" = target_person_id::text
      order by event."DT_INCLUSAO" desc
      limit v_limit
    ) e
    left join sigav."TB_PESSOA" actor on actor."SQ_PESSOA" = e."SQ_PESSOA_ATOR"
  );
end;
$function$;

-- FC_LISTAR_CATALOGO_PESQUISA()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    'surveyId', s."SQ_PESQUISA",
    'surveyCode', s."CO_PESQUISA",
    'surveyName', s."NO_PESQUISA",
    'description', s."DS_PESQUISA",
    'applicationId', sa."SQ_APLICACAO",
    'applicationCode', sa."CO_APLICACAO",
    'applicationName', sa."NO_APLICACAO",
    'applicationStatus', sa."ST_SITUACAO",
    'opensAt', sa."DT_ABERTURA",
    'closesAt', sa."DT_ENCERRAMENTO",
    'anonymous', sa."ST_ANONIMA",
    'allowDrafts', sa."ST_PERMITE_RASCUNHO",
    'accessMode', sa."TP_ACESSO",
    'participantStatus', ap."ST_SITUACAO",
    'accessProfile', ap."TP_ACESSO",
    'completedAt', ap."DT_CONCLUSAO",
    'submissionId', sub."SQ_SUBMISSAO",
    'submissionStatus', sub."ST_SITUACAO",
    'submissionUpdatedAt', sub."DT_ALTERACAO",
    'sections', (select count(*) from sigav."TB_SECAO_PESQUISA" sec where sec."SQ_VERSAO_PESQUISA" = sa."SQ_VERSAO_PESQUISA"),
    'questions', (select count(*) from sigav."TB_PERGUNTA_PESQUISA" q where q."SQ_VERSAO_PESQUISA" = sa."SQ_VERSAO_PESQUISA"),
    'canRespond', (sigav."FC_CICLO_ACEITA_RESPOSTA"(sa."SQ_APLICACAO") and sigav."FC_PODE_ACESSAR_CICLO"(sa."SQ_APLICACAO")),
    'canManage', v_is_admin
  ) order by
    case sa."ST_SITUACAO" when 'OPEN' then 0 when 'SCHEDULED' then 1 when 'CLOSED' then 2 else 3 end,
    coalesce(sa."DT_ENCERRAMENTO", sa."DT_ABERTURA", sa."DT_INCLUSAO") desc), '[]'::jsonb)
  into v_result
  from sigav."TB_APLICACAO_PESQUISA" sa
  join sigav."TH_VERSAO_PESQUISA" sv on sv."SQ_VERSAO_PESQUISA" = sa."SQ_VERSAO_PESQUISA"
  join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = sv."SQ_PESQUISA"
  left join sigav."RL_APLICACAO_PESSOA" ap
    on ap."SQ_APLICACAO" = sa."SQ_APLICACAO"
   and ap."SQ_PESSOA" = v_person_id
   and ap."ST_SITUACAO" not in ('BLOCKED', 'EXCLUDED')
  left join lateral (
    select x."SQ_SUBMISSAO", x."ST_SITUACAO", x."DT_ALTERACAO"
    from sigav."TB_SUBMISSAO" x
    where x."SQ_APLICACAO" = sa."SQ_APLICACAO"
      and x."SQ_PESSOA_RESPONDENTE" = v_person_id
      and x."TP_SUBMISSAO" in ('RESPONSE', 'AUTO')
    order by x."NU_VERSAO" desc, x."DT_INCLUSAO" desc
    limit 1
  ) sub on true
  where sigav."FC_PODE_ACESSAR_CICLO"(sa."SQ_APLICACAO")
    and sa."ST_SITUACAO" in ('SCHEDULED', 'OPEN', 'CLOSED')
    and (v_is_admin or sv."ST_SITUACAO" in ('PUBLISHED', 'RETIRED'));

  return v_result;
end;
$function$;

-- FC_LISTAR_CICLOS_LIDERANCA()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
        'id', sa."SQ_APLICACAO",
        'code', sa."CO_APLICACAO",
        'name', sa."NO_APLICACAO",
        'status', sa."ST_SITUACAO",
        'opensAt', sa."DT_ABERTURA",
        'closesAt', sa."DT_ENCERRAMENTO"
      ) as cycle,
      coalesce(sa."DT_ENCERRAMENTO", sa."DT_ABERTURA", sa."DT_INCLUSAO") as cycle_sort
    from sigav."TB_APLICACAO_PESQUISA" sa
    join sigav."TH_VERSAO_PESQUISA" sv on sv."SQ_VERSAO_PESQUISA" = sa."SQ_VERSAO_PESQUISA"
    join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = sv."SQ_PESQUISA"
    where s."DT_ARQUIVAMENTO" is null
      and sa."ST_SITUACAO" <> 'CANCELLED'
      and exists (
        select 1
        from sigav."RT_LIDERANCA_CDDI" l
        where l."SQ_APLICACAO" = sa."SQ_APLICACAO"
          and l."SQ_PESSOA_LIDER" = v_person_id
          and l."ST_SITUACAO" = 'ACTIVE'
          and l."DT_FIM_VIGENCIA" is null
      )
  ) cycles;

  return v_result;
end;
$function$;

-- FC_LISTAR_CICLOS_LIDERANCA_ADM()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
        'id', application."SQ_APLICACAO",
        'code', application."CO_APLICACAO",
        'name', application."NO_APLICACAO",
        'status', application."ST_SITUACAO",
        'accessMode', application."TP_ACESSO",
        'participantCount', count(participant."SQ_PARTICIPANTE"),
        'completedCount', count(participant."SQ_PARTICIPANTE") filter (where participant."ST_SITUACAO" = 'COMPLETED')
      ) as item
      from sigav."TB_APLICACAO_PESQUISA" application
      join sigav."TH_VERSAO_PESQUISA" "NU_VERSAO" on "NU_VERSAO"."SQ_VERSAO_PESQUISA" = application."SQ_VERSAO_PESQUISA"
      join sigav."TB_PESQUISA" survey on survey."SQ_PESQUISA" = "NU_VERSAO"."SQ_PESQUISA"
      left join sigav."RL_APLICACAO_PESSOA" participant
        on participant."SQ_APLICACAO" = application."SQ_APLICACAO"
       and participant."TP_PARTICIPANTE" = 'RESPONDENT'
       and participant."ST_SITUACAO" <> 'EXCLUDED'
      where survey."CO_PESQUISA" = 'CDDI'
        and survey."DT_ARQUIVAMENTO" is null
        and application."ST_SITUACAO" <> 'CANCELLED'
      group by application."SQ_APLICACAO"
    ) applications
  );
end;
$function$;

-- FC_LISTAR_CICLOS_PARTIC()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
        'id', sa."SQ_APLICACAO",
        'code', sa."CO_APLICACAO",
        'name', sa."NO_APLICACAO",
        'status', sa."ST_SITUACAO",
        'accessMode', sa."TP_ACESSO",
        'opensAt', sa."DT_ABERTURA",
        'closesAt', sa."DT_ENCERRAMENTO",
        'participantCount', count(ap."SQ_PARTICIPANTE"),
        'completedCount', count(ap."SQ_PARTICIPANTE") filter (where ap."ST_SITUACAO" = 'COMPLETED')
      ) as item
      from sigav."TB_APLICACAO_PESQUISA" sa
      -- O join existe para chegar em `TB_PESQUISA.dt_arquivamento`. Sem ele a
      -- função não tinha como saber que a avaliação foi arquivada.
      join sigav."TH_VERSAO_PESQUISA" sv on sv."SQ_VERSAO_PESQUISA" = sa."SQ_VERSAO_PESQUISA"
      join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = sv."SQ_PESQUISA"
      left join sigav."RL_APLICACAO_PESSOA" ap
        on ap."SQ_APLICACAO" = sa."SQ_APLICACAO"
       and ap."TP_PARTICIPANTE" = 'RESPONDENT'
       and ap."ST_SITUACAO" <> 'EXCLUDED'
      where s."DT_ARQUIVAMENTO" is null
        and sa."ST_SITUACAO" <> 'CANCELLED'
      -- Agrupar pela chave primária basta: as demais colunas de `sa` dependem
      -- funcionalmente dela, e os dois joins são 1:1 por chave estrangeira.
      group by sa."SQ_APLICACAO"
    ) q
  );
end;
$function$;

-- FC_LISTAR_CICLOS_PESQUISA(p_codigo_pesquisa text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
      'applicationId', aplicacao."SQ_APLICACAO",
      'code', aplicacao."CO_APLICACAO",
      'name', aplicacao."NO_APLICACAO",
      'status', aplicacao."ST_SITUACAO",
      'opensAt', aplicacao."DT_ABERTURA",
      'closesAt', aplicacao."DT_ENCERRAMENTO",
      'participants', (
        select count(*)
        from sigav."RL_APLICACAO_PESSOA" participante
        where participante."SQ_APLICACAO" = aplicacao."SQ_APLICACAO"
          and participante."ST_SITUACAO" not in ('BLOCKED', 'EXCLUDED')
      )
    ) as item
    from sigav."TB_APLICACAO_PESQUISA" as aplicacao
    join sigav."TH_VERSAO_PESQUISA" as versao on versao."SQ_VERSAO_PESQUISA" = aplicacao."SQ_VERSAO_PESQUISA"
    join sigav."TB_PESQUISA" as pesquisa on pesquisa."SQ_PESQUISA" = versao."SQ_PESQUISA"
    where pesquisa."CO_PESQUISA" = btrim(p_codigo_pesquisa)
      -- Rascunho não tem público nem período: não é ciclo para acompanhar.
      and aplicacao."ST_SITUACAO" <> 'DRAFT'
  ) as ciclos;

  return v_resultado;
end;
$function$;

-- FC_LISTAR_DIMENSOES_PUBLICO(p_regra jsonb)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    select "DS_METADADO" ->> 'directorate' as diretoria,
           "DS_METADADO" ->> 'unit' as unidade,
           "DS_METADADO" ->> 'coordination' as coordenacao,
           "CO_CENTRO_CUSTO" as centro,
           "NO_CARGO" as cargo
    from sigav."TB_PESSOA"
    where "ST_ATIVO"
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

-- FC_LISTAR_ENVIOS_EMAIL(p_aplicacao uuid, p_situacao text, p_limite integer)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
      select coalesce(jsonb_object_agg(x."ST_ENVIO", x.total), '{}'::jsonb)
      from (
        select t."ST_ENVIO", count(*) as total
        from sigav."TL_EMAIL_PARTICIPANTE" t
        where p_aplicacao is null or t."SQ_APLICACAO" = p_aplicacao
        group by t."ST_ENVIO"
      ) x
    ),
    'envios', (
      -- O apelido entre aspas, e não `f.dt_criacao`: é o nome que existe aqui.
      select coalesce(jsonb_agg(to_jsonb(f) order by f."createdAt" desc), '[]'::jsonb)
      from (
        select t."SQ_EMAIL" as id,
               t."TP_EMAIL" as kind,
               t."ST_ENVIO" as "ST_SITUACAO",
               t."DS_ERRO" as erro,
               t."DT_INCLUSAO" as "createdAt",
               t."DT_ENVIO" as "sentAt",
               p."NO_PESSOA" as "personName",
               p."DS_EMAIL_INSTITUCIONAL" as "personEmail",
               a."CO_APLICACAO" as "applicationCode",
               a."NO_APLICACAO" as "applicationName"
        from sigav."TL_EMAIL_PARTICIPANTE" t
        join sigav."TB_PESSOA" p on p."SQ_PESSOA" = t."SQ_PESSOA"
        join sigav."TB_APLICACAO_PESQUISA" a on a."SQ_APLICACAO" = t."SQ_APLICACAO"
        where (p_aplicacao is null or t."SQ_APLICACAO" = p_aplicacao)
          and (v_situacao = 'ALL' or t."ST_ENVIO" = v_situacao)
        order by t."DT_INCLUSAO" desc
        limit v_limite
      ) f
    )
  )
  into v_result;

  return v_result;
end;
$function$;

-- FC_LISTAR_MODELOS_AVALIACAO()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
      'surveyId', pesquisa."SQ_PESQUISA",
      'code', pesquisa."CO_PESQUISA",
      'name', pesquisa."NO_PESQUISA",
      'description', pesquisa."DS_PESQUISA",
      'category', coalesce(pesquisa."TP_CATEGORIA_MODELO", 'Geral'),
      'sections', (select count(*) from sigav."TB_SECAO_PESQUISA" s where s."SQ_VERSAO_PESQUISA" = versao."SQ_VERSAO_PESQUISA"),
      'questions', (select count(*) from sigav."TB_PERGUNTA_PESQUISA" q where q."SQ_VERSAO_PESQUISA" = versao."SQ_VERSAO_PESQUISA")
    ) as item
    from sigav."TB_PESQUISA" as pesquisa
    join lateral (
      select * from sigav."TH_VERSAO_PESQUISA" v
      where v."SQ_PESQUISA" = pesquisa."SQ_PESQUISA"
      order by v."NU_VERSAO" desc limit 1
    ) as versao on true
    where pesquisa."ST_MODELO" = true
  ) as modelos;

  return v_resultado;
end;
$function$;

-- FC_LISTAR_PARTIC_CICLO(target_application_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  if not exists(select 1 from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', ap."SQ_PARTICIPANTE",
      'personId', p."SQ_PESSOA",
      'employeeNumber', p."CO_MATRICULA",
      'fullName', p."NO_PESSOA",
      'institutionalEmail', p."DS_EMAIL_INSTITUCIONAL",
      'jobTitle', p."NO_CARGO",
      'costCenter', p."CO_CENTRO_CUSTO",
      'workplace', p."NO_LOCAL_TRABALHO",
      'avatarUrl', coalesce(p."DS_METADADO"->>'avatar_url', p."DS_METADADO"->>'picture', p."DS_METADADO"->>'photo_url'),
      'participantRole', ap."TP_PARTICIPANTE",
      'accessProfile', ap."TP_ACESSO",
      'status', ap."ST_SITUACAO",
      'invitedAt', ap."DT_CONVITE",
      'startedAt', ap."DT_INICIO",
      'completedAt', ap."DT_CONCLUSAO",
      'createdAt', ap."DT_INCLUSAO",
      'hasSubmission', exists(
        select 1 from sigav."TB_SUBMISSAO" s where s."SQ_PARTICIPANTE" = ap."SQ_PARTICIPANTE"
      )
    ) order by p."NO_PESSOA"), '[]'::jsonb)
    from sigav."RL_APLICACAO_PESSOA" ap
    join sigav."TB_PESSOA" p on p."SQ_PESSOA" = ap."SQ_PESSOA"
    where ap."SQ_APLICACAO" = target_application_id
      and ap."TP_PARTICIPANTE" = 'RESPONDENT'
  );
end;
$function$;

-- FC_LISTAR_PESQUISAS_ARQ()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    'surveyId', s."SQ_PESQUISA",
    'code', s."CO_PESQUISA",
    'name', s."NO_PESQUISA",
    'description', s."DS_PESQUISA",
    'status', s."ST_SITUACAO",
    'archivedAt', s."DT_ARQUIVAMENTO",
    'versionId', sv."SQ_VERSAO_PESQUISA",
    'versionNumber', sv."NU_VERSAO",
    'versionStatus', sv."ST_SITUACAO",
    'applicationId', sa."SQ_APLICACAO",
    'applicationCode', sa."CO_APLICACAO",
    'applicationName', sa."NO_APLICACAO",
    'applicationStatus', sa."ST_SITUACAO",
    'opensAt', sa."DT_ABERTURA",
    'closesAt', sa."DT_ENCERRAMENTO",
    'sections', (select count(*) from sigav."TB_SECAO_PESQUISA" sec where sec."SQ_VERSAO_PESQUISA" = sv."SQ_VERSAO_PESQUISA"),
    'questions', (select count(*) from sigav."TB_PERGUNTA_PESQUISA" q where q."SQ_VERSAO_PESQUISA" = sv."SQ_VERSAO_PESQUISA"),
    'updatedAt', greatest(s."DT_ALTERACAO", sv."DT_ALTERACAO", coalesce(sa."DT_ALTERACAO", s."DT_ALTERACAO"))
  ) order by s."DT_ARQUIVAMENTO" desc), '[]'::jsonb)
  into v_result
  from sigav."TB_PESQUISA" s
  join lateral (
    select * from sigav."TH_VERSAO_PESQUISA" x where x."SQ_PESQUISA" = s."SQ_PESQUISA" order by x."NU_VERSAO" desc limit 1
  ) sv on true
  left join lateral (
    select * from sigav."TB_APLICACAO_PESQUISA" a where a."SQ_VERSAO_PESQUISA" = sv."SQ_VERSAO_PESQUISA" order by a."DT_INCLUSAO" desc limit 1
  ) sa on true
  where s."ST_MODELO" = false
    and s."DT_ARQUIVAMENTO" is not null;

  return v_result;
end;
$function$;

-- FC_LISTAR_PESQUISAS_GERIDAS()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    'surveyId', s."SQ_PESQUISA",
    'code', s."CO_PESQUISA",
    'name', s."NO_PESQUISA",
    'description', s."DS_PESQUISA",
    'status', s."ST_SITUACAO",
    'archivedAt', s."DT_ARQUIVAMENTO",
    'versionId', sv."SQ_VERSAO_PESQUISA",
    'versionNumber', sv."NU_VERSAO",
    'versionStatus', sv."ST_SITUACAO",
    'applicationId', sa."SQ_APLICACAO",
    'applicationCode', sa."CO_APLICACAO",
    'applicationName', sa."NO_APLICACAO",
    'applicationStatus', sa."ST_SITUACAO",
    'opensAt', sa."DT_ABERTURA",
    'closesAt', sa."DT_ENCERRAMENTO", 'anonymous', sa."ST_ANONIMA",
    'sections', (select count(*) from sigav."TB_SECAO_PESQUISA" sec where sec."SQ_VERSAO_PESQUISA" = sv."SQ_VERSAO_PESQUISA"),
    'questions', (select count(*) from sigav."TB_PERGUNTA_PESQUISA" q where q."SQ_VERSAO_PESQUISA" = sv."SQ_VERSAO_PESQUISA"),
    'updatedAt', greatest(s."DT_ALTERACAO", sv."DT_ALTERACAO", coalesce(sa."DT_ALTERACAO", s."DT_ALTERACAO"))
  ) order by greatest(s."DT_ALTERACAO", sv."DT_ALTERACAO", coalesce(sa."DT_ALTERACAO", s."DT_ALTERACAO")) desc), '[]'::jsonb)
  into v_result
  from sigav."TB_PESQUISA" s
  join lateral (
    select * from sigav."TH_VERSAO_PESQUISA" x where x."SQ_PESQUISA" = s."SQ_PESQUISA" order by x."NU_VERSAO" desc limit 1
  ) sv on true
  left join lateral (
    select * from sigav."TB_APLICACAO_PESQUISA" a where a."SQ_VERSAO_PESQUISA" = sv."SQ_VERSAO_PESQUISA" order by a."DT_INCLUSAO" desc limit 1
  ) sa on true
  where s."ST_MODELO" = false
    and s."DT_ARQUIVAMENTO" is null;

  return v_result;
end;
$function$;

-- FC_LISTAR_PESSOAS_SEM_CHEFIA(target_application_id uuid, target_search text, target_limit integer)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  if not exists (select 1 from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  select coalesce(jsonb_agg(item order by item->>'fullName'), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'personId', person."SQ_PESSOA",
      'fullName', person."NO_PESSOA",
      'employeeNumber', person."CO_MATRICULA",
      'institutionalEmail', person."DS_EMAIL_INSTITUCIONAL",
      'jobTitle', person."NO_CARGO",
      -- A unidade fica em `metadata->>'unit'`, como em FC_BUSCAR_PESSOAS_ADMIN:
      -- `organizational_unit_id` é a chave estrangeira, não o rótulo exibido.
      'organizationalUnit', nullif(btrim(coalesce(person."DS_METADADO"->>'unit', '')), ''),
      'managerName', nullif(btrim(coalesce(person."DS_METADADO"->>'manager_name', '')), ''),
      'managerEmail', nullif(btrim(coalesce(person."DS_METADADO"->>'manager_email', '')), ''),
      'managerResolution', coalesce(nullif(btrim(coalesce(person."DS_METADADO"->>'manager_resolution', '')), ''), 'SEM_DADO')
    ) as item
    from sigav."TB_PESSOA" as person
    where person."ST_ATIVO"
    -- Só quem participa do ciclo: a pendência de chefia só existe para quem
    -- precisa responder.
    and exists (
      select 1
      from sigav."RL_APLICACAO_PESSOA" as participant
      where participant."SQ_PESSOA" = person."SQ_PESSOA"
        and participant."SQ_APLICACAO" = target_application_id
    )
    and not exists (
      select 1
      from sigav."RT_LIDERANCA_CDDI" as link
      where link."SQ_PESSOA_SUBORDINADA" = person."SQ_PESSOA"
        and link."SQ_APLICACAO" = target_application_id
        and link."ST_SITUACAO" = 'ACTIVE'
        and link."DT_FIM_VIGENCIA" is null
    )
    and (
      v_search = ''
      or lower(person."NO_PESSOA") like '%' || v_search || '%'
      or lower(coalesce(person."CO_MATRICULA", '')) like '%' || v_search || '%'
      or lower(coalesce(person."DS_EMAIL_INSTITUCIONAL", '')) like '%' || v_search || '%'
      or lower(coalesce(person."DS_METADADO"->>'manager_email', '')) like '%' || v_search || '%'
    )
    order by person."NO_PESSOA"
    limit v_limit
  ) as pendentes;

  return v_result;
end;
$function$;

-- FC_LISTAR_PRESENCA_ONLINE()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
      p."SQ_PESSOA" as "personId",
      p."NO_PESSOA" as "fullName",
      p."DS_METADADO"->>'avatar_url' as "avatarUrl",
      'AUTHENTICATED'::text as "roleCode",
      pr."DT_VISTO_EM" as "onlineAt"
    from sigav."TB_PRESENCA_ONLINE" pr
    join sigav."TB_PESSOA" p on p."SQ_PESSOA" = pr."SQ_PESSOA"
    where pr."DT_VISTO_EM" > timezone('utc', now()) - interval '2 minutes'
      and p."ST_ATIVO"
    order by pr."DT_VISTO_EM" desc, p."NO_PESSOA", p."SQ_PESSOA"
    limit 200
  ) f;

  return v_result;
end;
$function$;

-- FC_LISTAR_RESPOSTAS_CICLO(p_codigo_ciclo text, p_busca text, p_limite integer)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
      'submissionId', submissao."SQ_SUBMISSAO",
      'personId', pessoa."SQ_PESSOA",
      'fullName', pessoa."NO_PESSOA",
      'employeeNumber', pessoa."CO_MATRICULA",
      'institutionalEmail', pessoa."DS_EMAIL_INSTITUCIONAL",
      'submissionType', submissao."TP_SUBMISSAO",
      'status', submissao."ST_SITUACAO",
      'submittedAt', submissao."DT_ENVIO",
      'answers', (select count(*) from sigav."TB_RESPOSTA" resposta where resposta."SQ_SUBMISSAO" = submissao."SQ_SUBMISSAO"),
      'subjectName', avaliado."NO_PESSOA"
    ) as item
    from sigav."TB_SUBMISSAO" as submissao
    join sigav."TB_APLICACAO_PESQUISA" as aplicacao on aplicacao."SQ_APLICACAO" = submissao."SQ_APLICACAO"
    left join sigav."TB_PESSOA" as pessoa on pessoa."SQ_PESSOA" = submissao."SQ_PESSOA_RESPONDENTE"
    left join sigav."TB_PESSOA" as avaliado on avaliado."SQ_PESSOA" = submissao."SQ_PESSOA_AVALIADA"
    where aplicacao."CO_APLICACAO" = btrim(p_codigo_ciclo)
      and (
        v_busca = ''
        or lower(coalesce(pessoa."NO_PESSOA", '')) like '%' || v_busca || '%'
        or lower(coalesce(pessoa."CO_MATRICULA", '')) like '%' || v_busca || '%'
        or lower(coalesce(pessoa."DS_EMAIL_INSTITUCIONAL", '')) like '%' || v_busca || '%'
      )
    order by pessoa."NO_PESSOA"
    limit v_limite
  ) as respostas;

  return v_resultado;
end;
$function$;

-- FC_LISTAR_VINCULOS_LIDERANCA(target_application_id uuid, target_search text, target_limit integer)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    join sigav."TH_VERSAO_PESQUISA" "NU_VERSAO" on "NU_VERSAO"."SQ_VERSAO_PESQUISA" = application."SQ_VERSAO_PESQUISA"
    join sigav."TB_PESQUISA" survey on survey."SQ_PESQUISA" = "NU_VERSAO"."SQ_PESQUISA"
    where application."SQ_APLICACAO" = target_application_id
      and survey."CO_PESQUISA" = 'CDDI'
      and survey."DT_ARQUIVAMENTO" is null
      and application."ST_SITUACAO" <> 'CANCELLED'
  ) then
    raise exception 'Ciclo CDDI não localizado ou indisponível.';
  end if;

  return (
    with filtered as materialized (
      select
        link."SQ_LIDERANCA" as link_id,
        link."SQ_APLICACAO",
        link."SQ_PESSOA_LIDER",
        leader."NO_PESSOA" as leader_name,
        leader."CO_MATRICULA" as leader_employee_number,
        link."SQ_PESSOA_SUBORDINADA",
        subordinate."NO_PESSOA" as subordinate_name,
        subordinate."CO_MATRICULA" as subordinate_employee_number,
        link."ST_SITUACAO",
        link."DT_INICIO_VIGENCIA",
        link."DT_FIM_VIGENCIA",
        link."TP_ORIGEM",
        (link."ST_SITUACAO" = 'ACTIVE' and link."DT_FIM_VIGENCIA" is null) as is_active
      from sigav."RT_LIDERANCA_CDDI" link
      join sigav."TB_PESSOA" leader on leader."SQ_PESSOA" = link."SQ_PESSOA_LIDER"
      join sigav."TB_PESSOA" subordinate on subordinate."SQ_PESSOA" = link."SQ_PESSOA_SUBORDINADA"
      where link."SQ_APLICACAO" = target_application_id
        and (
          v_search = ''
          or lower(leader."NO_PESSOA") like '%' || v_search || '%'
          or lower(leader."CO_MATRICULA") like '%' || v_search || '%'
          or lower(subordinate."NO_PESSOA") like '%' || v_search || '%'
          or lower(subordinate."CO_MATRICULA") like '%' || v_search || '%'
        )
    ),
    page as (
      select *
      from filtered
      order by is_active desc, subordinate_name, "DT_INICIO_VIGENCIA" desc
      limit v_limit
    )
    select jsonb_build_object(
      'links',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'linkId', item.link_id,
            'applicationId', item."SQ_APLICACAO",
            'leaderPersonId', item."SQ_PESSOA_LIDER",
            'leaderName', item.leader_name,
            'leaderEmployeeNumber', item.leader_employee_number,
            'subordinatePersonId', item."SQ_PESSOA_SUBORDINADA",
            'subordinateName', item.subordinate_name,
            'subordinateEmployeeNumber', item.subordinate_employee_number,
            'status', item."ST_SITUACAO",
            'validFrom', item."DT_INICIO_VIGENCIA",
            'validTo', item."DT_FIM_VIGENCIA",
            'origin', item."TP_ORIGEM"
          )
          order by item.is_active desc, item.subordinate_name, item."DT_INICIO_VIGENCIA" desc
        )
        from page item
      ), '[]'::jsonb),
      'totalActive',
      (
        select count(*)
        from sigav."RT_LIDERANCA_CDDI" active_link
        where active_link."SQ_APLICACAO" = target_application_id
          and active_link."ST_SITUACAO" = 'ACTIVE'
          and active_link."DT_FIM_VIGENCIA" is null
      ),
      'totalMatches', (select count(*) from filtered),
      'limit', v_limit
    )
  );
end;
$function$;

-- FC_MODULOS_EFETIVOS(target_person_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_MODULOS_EFETIVOS"(target_person_id uuid)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select coalesce(
    array_agg(pm."CO_MODULO" order by pm."NU_ORDEM", pm."CO_MODULO")
      filter (where coalesce(
        pmp."ST_PERMITIDO",
        pm."CO_MODULO" in ('HOME', 'SURVEYS')
      )),
    array[]::text[]
  )
  from sigav."TB_PESSOA" p
  cross join sigav."TB_MODULO_PLATAFORMA" pm
  left join sigav."RL_PESSOA_MODULO" pmp
    on pmp."SQ_PESSOA" = p."SQ_PESSOA"
   and pmp."CO_MODULO" = pm."CO_MODULO"
  where p."SQ_PESSOA" = target_person_id
    and p."ST_ATIVO"
    and pm."ST_ATIVO";
$function$;

-- FC_MOVER_PERGUNTA_SECAO(target_question_id uuid, target_section_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  select "NU_VERSAO".*
  into v_version
  from sigav."TH_VERSAO_PESQUISA" "NU_VERSAO"
  join sigav."TB_PERGUNTA_PESQUISA" question
    on question."SQ_VERSAO_PESQUISA" = "NU_VERSAO"."SQ_VERSAO_PESQUISA"
  where question."SQ_PERGUNTA" = target_question_id
    and "NU_VERSAO"."ST_SITUACAO" = 'DRAFT'
  for update of "NU_VERSAO";

  if v_version."SQ_VERSAO_PESQUISA" is null then
    raise exception 'Pergunta em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
  end if;

  select *
  into v_question
  from sigav."TB_PERGUNTA_PESQUISA"
  where "SQ_PERGUNTA" = target_question_id
    and "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA";

  select *
  into v_target_section
  from sigav."TB_SECAO_PESQUISA"
  where "SQ_SECAO" = target_section_id
    and "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA";

  if v_target_section."SQ_SECAO" is null then
    raise exception 'A seção de destino precisa pertencer à mesma versão em rascunho.';
  end if;

  if v_question."SQ_SECAO" = v_target_section."SQ_SECAO" then
    return jsonb_build_object(
      'status', 'NO_CHANGE',
      'questionId', v_question."SQ_PERGUNTA",
      'sectionId', v_question."SQ_SECAO",
      'position', v_question."NU_ORDEM"
    );
  end if;

  perform section."SQ_SECAO"
  from sigav."TB_SECAO_PESQUISA" section
  where section."SQ_SECAO" in (v_question."SQ_SECAO", v_target_section."SQ_SECAO")
  order by section."SQ_SECAO"
  for update;

  perform question."SQ_PERGUNTA"
  from sigav."TB_PERGUNTA_PESQUISA" question
  where question."SQ_SECAO" in (v_question."SQ_SECAO", v_target_section."SQ_SECAO")
  order by question."SQ_PERGUNTA"
  for update;

  select coalesce(max(question."NU_ORDEM"), 0) + 1
  into v_target_position
  from sigav."TB_PERGUNTA_PESQUISA" question
  where question."SQ_SECAO" = v_target_section."SQ_SECAO";

  update sigav."TB_PERGUNTA_PESQUISA"
  set "SQ_SECAO" = v_target_section."SQ_SECAO",
      "NU_ORDEM" = v_target_position,
      "DT_ALTERACAO" = timezone('utc', now())
  where "SQ_PERGUNTA" = v_question."SQ_PERGUNTA"
    and "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA";

  select application."SQ_APLICACAO"
  into v_application_id
  from sigav."TB_APLICACAO_PESQUISA" application
  where application."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
  order by application."DT_INCLUSAO" desc
  limit 1;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR",
    "TP_EVENTO",
    "TP_ENTIDADE",
    "CO_ENTIDADE",
    "SQ_APLICACAO",
    "DS_DADO_ANTERIOR",
    "DS_DADO_POSTERIOR",
    "DS_METADADO"
  ) values (
    v_actor_id,
    'SURVEY_QUESTION_MOVED',
    'SURVEY_QUESTION',
    v_question."SQ_PERGUNTA"::text,
    v_application_id,
    jsonb_build_object(
      'sectionId', v_question."SQ_SECAO",
      'position', v_question."NU_ORDEM"
    ),
    jsonb_build_object(
      'sectionId', v_target_section."SQ_SECAO",
      'position', v_target_position
    ),
    jsonb_build_object(
      'surveyId', v_version."SQ_PESQUISA",
      'surveyVersionId', v_version."SQ_VERSAO_PESQUISA",
      'title', v_question."NO_PERGUNTA"
    )
  );

  return jsonb_build_object(
    'status', 'OK',
    'questionId', v_question."SQ_PERGUNTA",
    'previousSectionId', v_question."SQ_SECAO",
    'sectionId', v_target_section."SQ_SECAO",
    'previousPosition', v_question."NU_ORDEM",
    'position', v_target_position
  );
end;
$function$;

-- FC_OBTER_CICLO_CDDI_VIGENTE()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    'applicationId', aplicacao."SQ_APLICACAO",
    'code', aplicacao."CO_APLICACAO",
    'name', aplicacao."NO_APLICACAO",
    'status', aplicacao."ST_SITUACAO",
    'opensAt', aplicacao."DT_ABERTURA",
    'closesAt', aplicacao."DT_ENCERRAMENTO"
  )
  into v_resultado
  from sigav."TB_APLICACAO_PESQUISA" as aplicacao
  join sigav."TH_VERSAO_PESQUISA" as versao on versao."SQ_VERSAO_PESQUISA" = aplicacao."SQ_VERSAO_PESQUISA"
  join sigav."TB_PESQUISA" as pesquisa on pesquisa."SQ_PESQUISA" = versao."SQ_PESQUISA"
  where pesquisa."CO_PESQUISA" = 'CDDI'
    and pesquisa."DT_ARQUIVAMENTO" is null
    -- Rascunho não tem público nem período; cancelado não é vigente. Sem esta
    -- segunda condição o `else 2` da ordenação abaixo elegia o cancelado
    -- quando não houvesse ciclo aberto nem agendado.
    and aplicacao."ST_SITUACAO" not in ('DRAFT', 'CANCELLED')
    and exists (
      select 1
      from sigav."RL_APLICACAO_PESSOA" as participante
      where participante."SQ_APLICACAO" = aplicacao."SQ_APLICACAO"
        and participante."SQ_PESSOA" = v_pessoa
        and participante."ST_SITUACAO" not in ('BLOCKED', 'EXCLUDED')
    )
  order by
    case aplicacao."ST_SITUACAO" when 'OPEN' then 0 when 'SCHEDULED' then 1 else 2 end,
    aplicacao."DT_ABERTURA" desc nulls last
  limit 1;

  return v_resultado;
end;
$function$;

-- FC_OBTER_CONSTRUTOR(target_survey_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_OBTER_CONSTRUTOR"(target_survey_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare v_survey sigav."TB_PESQUISA"%rowtype; v_version sigav."TH_VERSAO_PESQUISA"%rowtype; v_application sigav."TB_APLICACAO_PESQUISA"%rowtype; v_sections jsonb;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then raise exception 'Acesso restrito à Equipe Técnica.'; end if;
  select * into v_survey from sigav."TB_PESQUISA" where "SQ_PESQUISA"=target_survey_id;
  if v_survey."SQ_PESQUISA" is null then raise exception 'Pesquisa não encontrada.'; end if;
  select * into v_version from sigav."TH_VERSAO_PESQUISA" where "SQ_PESQUISA"=target_survey_id order by "NU_VERSAO" desc limit 1;
  select * into v_application from sigav."TB_APLICACAO_PESQUISA" where "SQ_VERSAO_PESQUISA"=v_version."SQ_VERSAO_PESQUISA" order by "DT_INCLUSAO" desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('id',sec."SQ_SECAO",'code',sec."CO_SECAO",'title',sec."NO_SECAO",'description',sec."DS_SECAO",'position',sec."NU_ORDEM",'questions',coalesce((select jsonb_agg(jsonb_build_object('id',q."SQ_PERGUNTA",'code',q."CO_PERGUNTA",'title',q."NO_PERGUNTA",'description',q."DS_PERGUNTA",'questionType',q."TP_PERGUNTA",'required',q."ST_OBRIGATORIA",'position',q."NU_ORDEM",'options',coalesce((select jsonb_agg(jsonb_build_object('id',o."SQ_OPCAO",'label',o."NO_OPCAO",'value',o."DS_VALOR",'score',o."VL_NOTA",'position',o."NU_ORDEM") order by o."NU_ORDEM") from sigav."TB_OPCAO_PERGUNTA" o where o."SQ_PERGUNTA"=q."SQ_PERGUNTA"),'[]'::jsonb)) order by q."NU_ORDEM") from sigav."TB_PERGUNTA_PESQUISA" q where q."SQ_SECAO"=sec."SQ_SECAO"),'[]'::jsonb)) order by sec."NU_ORDEM"),'[]'::jsonb)
  into v_sections from sigav."TB_SECAO_PESQUISA" sec where sec."SQ_VERSAO_PESQUISA"=v_version."SQ_VERSAO_PESQUISA";
  return jsonb_build_object('status','OK','survey',jsonb_build_object('id',v_survey."SQ_PESQUISA",'code',v_survey."CO_PESQUISA",'name',v_survey."NO_PESQUISA",'description',v_survey."DS_PESQUISA",'status',v_survey."ST_SITUACAO"),'version',jsonb_build_object('id',v_version."SQ_VERSAO_PESQUISA",'number',v_version."NU_VERSAO",'status',v_version."ST_SITUACAO"),'application',jsonb_build_object('id',v_application."SQ_APLICACAO",'code',v_application."CO_APLICACAO",'name',v_application."NO_APLICACAO",'status',v_application."ST_SITUACAO",'opensAt',v_application."DT_ABERTURA",'closesAt',v_application."DT_ENCERRAMENTO"),'sections',v_sections);
end;$function$;

-- FC_OBTER_CONTEXTO_CDDI()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
          'id', p."SQ_PESSOA",
          'employeeNumber', p."CO_MATRICULA",
          'fullName', p."NO_PESSOA",
          'institutionalEmail', p."DS_EMAIL_INSTITUCIONAL",
          'jobTitle', p."NO_CARGO",
          'costCenter', p."CO_CENTRO_CUSTO",
          'workplace', p."NO_LOCAL_TRABALHO",
          'metadata', p."DS_METADADO"
        ),
        'participant', jsonb_build_object(
          'id', ap."SQ_PARTICIPANTE",
          'status', ap."ST_SITUACAO",
          'accessProfile', ap."TP_ACESSO",
          'completedAt', ap."DT_CONCLUSAO",
          'metadata', ap."DS_METADADO"
        ),
        'application', jsonb_build_object(
          'id', sa."SQ_APLICACAO",
          'code', sa."CO_APLICACAO",
          'name', sa."NO_APLICACAO",
          'status', sa."ST_SITUACAO",
          'opensAt', sa."DT_ABERTURA",
          'closesAt', sa."DT_ENCERRAMENTO"
        ),
        'isLeader', sigav."FC_TEM_PAPEL_ATIVO"('LEADER')
      )
      from sigav."TB_PESSOA" p
      left join sigav."RL_APLICACAO_PESSOA" ap on ap."SQ_PESSOA" = p."SQ_PESSOA"
      left join sigav."TB_APLICACAO_PESQUISA" sa on sa."SQ_APLICACAO" = ap."SQ_APLICACAO" and sa."CO_APLICACAO" = 'CDDI-2026'
      where p."SQ_PESSOA" = sigav."FC_PESSOA_SESSAO"()
      order by ap."DT_INCLUSAO" desc nulls last
      limit 1
    )
  end;
$function$;

-- FC_OBTER_CONTEXTO_PLATAFORMA()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where "SQ_USUARIO_IDENTIDADE" = sigav."FC_UID_SESSAO"()
    and "ST_ATIVO" = true
  limit 1;

  if v_person."SQ_PESSOA" is null then
    return jsonb_build_object(
      'status', 'UNLINKED',
      'message', 'Conta autenticada sem cadastro institucional ativo.'
    );
  end if;

  v_modules := sigav."FC_MODULOS_EFETIVOS"(v_person."SQ_PESSOA");

  select ap."SQ_PARTICIPANTE" into v_participant_id
  from sigav."RL_APLICACAO_PESSOA" ap
  join sigav."TB_APLICACAO_PESQUISA" sa on sa."SQ_APLICACAO" = ap."SQ_APLICACAO"
  where ap."SQ_PESSOA" = v_person."SQ_PESSOA"
    and ap."ST_SITUACAO" not in ('REMOVED', 'INELIGIBLE')
  order by
    case sa."ST_SITUACAO" when 'OPEN' then 0 when 'SCHEDULED' then 1 when 'DRAFT' then 2 else 3 end,
    coalesce(sa."DT_ENCERRAMENTO", sa."DT_ABERTURA", sa."DT_INCLUSAO") desc
  limit 1;

  if v_participant_id is not null then
    select * into v_participant
    from sigav."RL_APLICACAO_PESSOA"
    where "SQ_PARTICIPANTE" = v_participant_id;

    select * into v_application
    from sigav."TB_APLICACAO_PESQUISA"
    where "SQ_APLICACAO" = v_participant."SQ_APLICACAO";
  end if;

  return jsonb_build_object(
    'status', 'OK',
    'technicalRole', 'authenticated',
    'person', jsonb_build_object(
      'id', v_person."SQ_PESSOA",
      'employeeNumber', v_person."CO_MATRICULA",
      'fullName', v_person."NO_PESSOA",
      'institutionalEmail', v_person."DS_EMAIL_INSTITUCIONAL",
      'jobTitle', v_person."NO_CARGO",
      'costCenter', v_person."CO_CENTRO_CUSTO",
      'workplace', v_person."NO_LOCAL_TRABALHO",
      'metadata', coalesce(v_person."DS_METADADO", '{}'::jsonb),
      'avatarUrl', v_person."DS_METADADO"->>'avatar_url'
    ),
    'participant', case when v_participant."SQ_PARTICIPANTE" is null then null else jsonb_build_object(
      'id', v_participant."SQ_PARTICIPANTE",
      'status', v_participant."ST_SITUACAO",
      'accessProfile', v_participant."TP_ACESSO",
      'completedAt', v_participant."DT_CONCLUSAO",
      'metadata', coalesce(v_participant."DS_METADADO", '{}'::jsonb)
    ) end,
    'application', case when v_application."SQ_APLICACAO" is null then null else jsonb_build_object(
      'id', v_application."SQ_APLICACAO",
      'code', v_application."CO_APLICACAO",
      'name', v_application."NO_APLICACAO",
      'status', v_application."ST_SITUACAO",
      'opensAt', v_application."DT_ABERTURA",
      'closesAt', v_application."DT_ENCERRAMENTO"
    ) end,
    'isLeader', ('TEAM' = any(v_modules)),
    'roles', jsonb_build_array('AUTHENTICATED'),
    'modules', to_jsonb(v_modules),
    'canManageSurveys', ('ADMIN_SURVEYS' = any(v_modules))
  );
end;
$function$;

-- FC_OBTER_ESPACO_EQUIPE(target_application_code text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    select * into v_application from sigav."TB_APLICACAO_PESQUISA" where "CO_APLICACAO" = btrim(target_application_code) limit 1;
  else
    select sa.* into v_application from sigav."TB_APLICACAO_PESQUISA" sa
    where exists (select 1 from sigav."RL_APLICACAO_PESSOA" ap where ap."SQ_APLICACAO"=sa."SQ_APLICACAO" and ap."SQ_PESSOA"=v_person_id)
       or exists (select 1 from sigav."RT_LIDERANCA_CDDI" l where l."SQ_APLICACAO"=sa."SQ_APLICACAO" and l."SQ_PESSOA_LIDER"=v_person_id)
    order by coalesce(sa."DT_ENCERRAMENTO",sa."DT_ABERTURA",sa."DT_INCLUSAO") desc limit 1;
  end if;
  if v_application."SQ_APLICACAO" is null then select * into v_application from sigav."TB_APLICACAO_PESQUISA" order by coalesce("DT_ENCERRAMENTO","DT_ABERTURA","DT_INCLUSAO") desc limit 1; end if;
  if v_application."SQ_APLICACAO" is null then raise exception 'Nenhum ciclo de pesquisa foi encontrado.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('linkId',l."SQ_LIDERANCA",'personId',p."SQ_PESSOA",'fullName',p."NO_PESSOA",'employeeNumber',p."CO_MATRICULA",'institutionalEmail',p."DS_EMAIL_INSTITUCIONAL",'jobTitle',p."NO_CARGO",'unit',coalesce(p."DS_METADADO"->>'unit',p."CO_CENTRO_CUSTO"),'workplace',p."NO_LOCAL_TRABALHO",'status',l."ST_SITUACAO",'validFrom',l."DT_INICIO_VIGENCIA",'submissionStatus',s."ST_SITUACAO",'submissionUpdatedAt',s."DT_ALTERACAO") order by p."NO_PESSOA"),'[]'::jsonb)
  into v_members
  from sigav."RT_LIDERANCA_CDDI" l join sigav."TB_PESSOA" p on p."SQ_PESSOA"=l."SQ_PESSOA_SUBORDINADA"
  left join lateral (select sub."ST_SITUACAO",sub."DT_ALTERACAO" from sigav."TB_SUBMISSAO" sub where sub."SQ_APLICACAO"=l."SQ_APLICACAO" and sub."SQ_PESSOA_RESPONDENTE"=v_person_id and sub."SQ_PESSOA_AVALIADA"=l."SQ_PESSOA_SUBORDINADA" and sub."TP_SUBMISSAO"='CHEFIA' order by sub."DT_ALTERACAO" desc limit 1) s on true
  where l."SQ_APLICACAO"=v_application."SQ_APLICACAO" and l."SQ_PESSOA_LIDER"=v_person_id and l."ST_SITUACAO"='ACTIVE' and l."DT_FIM_VIGENCIA" is null;
  return jsonb_build_object('status','OK','application',jsonb_build_object('id',v_application."SQ_APLICACAO",'code',v_application."CO_APLICACAO",'name',v_application."NO_APLICACAO",'status',v_application."ST_SITUACAO",'opensAt',v_application."DT_ABERTURA",'closesAt',v_application."DT_ENCERRAMENTO"),'members',v_members,'total',jsonb_array_length(v_members));
end;$function$;

-- FC_OBTER_FORMULARIO_PUBLICO(target_application_code text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_OBTER_FORMULARIO_PUBLICO"(target_application_code text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select sigav."FC_ABRIR_CICLOS_AGENDADOS"();

  select jsonb_build_object(
    'application', jsonb_build_object(
      'id', sa."SQ_APLICACAO",
      'code', sa."CO_APLICACAO",
      'name', sa."NO_APLICACAO",
      'status', sa."ST_SITUACAO",
      'opensAt', sa."DT_ABERTURA",
      'closesAt', sa."DT_ENCERRAMENTO",
      'allowDrafts', sa."ST_PERMITE_RASCUNHO",
      'settings', sa."DS_CONFIGURACAO",
      'accessMode', sa."TP_ACESSO"
    ),
    'survey', jsonb_build_object(
      'id', s."SQ_PESQUISA",
      'code', s."CO_PESQUISA",
      'name', s."NO_PESQUISA",
      'description', s."DS_PESQUISA"
    ),
    'version', jsonb_build_object(
      'id', sv."SQ_VERSAO_PESQUISA",
      'number', sv."NU_VERSAO",
      'title', sv."NO_VERSAO",
      'description', sv."DS_VERSAO",
      'settings', sv."DS_CONFIGURACAO"
    ),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ss."SQ_SECAO",
        'code', ss."CO_SECAO",
        'title', ss."NO_SECAO",
        'description', ss."DS_SECAO",
        'position', ss."NU_ORDEM",
        'settings', ss."DS_CONFIGURACAO",
        'questions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', sq."SQ_PERGUNTA",
            'code', sq."CO_PERGUNTA",
            'title', sq."NO_PERGUNTA",
            'description', sq."DS_PERGUNTA",
            'type', sq."TP_PERGUNTA",
            'required', sq."ST_OBRIGATORIA",
            'position', sq."NU_ORDEM",
            'validation', sq."DS_VALIDACAO",
            'displayLogic', sq."DS_LOGICA_EXIBICAO",
            'settings', sq."DS_CONFIGURACAO",
            'options', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', qo."SQ_OPCAO",
                'code', qo."CO_OPCAO",
                'label', qo."NO_OPCAO",
                'value', qo."DS_VALOR",
                'position', qo."NU_ORDEM"
              ) order by qo."NU_ORDEM")
              from sigav."TB_OPCAO_PERGUNTA" qo
              where qo."SQ_PERGUNTA" = sq."SQ_PERGUNTA"
                and qo."ST_ATIVO" = true
            ), '[]'::jsonb)
          ) order by sq."NU_ORDEM")
          from sigav."TB_PERGUNTA_PESQUISA" sq
          where sq."SQ_SECAO" = ss."SQ_SECAO"
        ), '[]'::jsonb)
      ) order by ss."NU_ORDEM")
      from sigav."TB_SECAO_PESQUISA" ss
      where ss."SQ_VERSAO_PESQUISA" = sv."SQ_VERSAO_PESQUISA"
        and ss."SQ_SECAO_PAI" is null
    ), '[]'::jsonb)
  )
  from sigav."TB_APLICACAO_PESQUISA" sa
  join sigav."TH_VERSAO_PESQUISA" sv on sv."SQ_VERSAO_PESQUISA" = sa."SQ_VERSAO_PESQUISA"
  join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = sv."SQ_PESQUISA"
  where sa."CO_APLICACAO" = btrim(target_application_code)
    and sv."ST_SITUACAO" in ('PUBLISHED', 'RETIRED')
    and sa."ST_SITUACAO" in ('SCHEDULED', 'OPEN', 'CLOSED')
    and (sa."ST_ANONIMA" or sigav."FC_PODE_ACESSAR_CICLO"(sa."SQ_APLICACAO"))
  limit 1;
$function$;

-- FC_OBTER_FORM_ANONIMO(target_application_code text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where "CO_APLICACAO" = btrim(target_application_code)
  limit 1;

  if v_application."SQ_APLICACAO" is null
     or not v_application."ST_ANONIMA"
     or not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application."SQ_APLICACAO") then
    return null;
  end if;

  return sigav."FC_OBTER_FORMULARIO_PUBLICO"(target_application_code);
end;
$function$;

-- FC_OBTER_FORM_PUBLICO(target_application_code text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_OBTER_FORM_PUBLICO"(target_application_code text)
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select sigav."FC_ABRIR_CICLOS_AGENDADOS"();

  select jsonb_build_object(
    'application', jsonb_build_object(
      'id', sa."SQ_APLICACAO",
      'code', sa."CO_APLICACAO",
      'name', sa."NO_APLICACAO",
      'status', sa."ST_SITUACAO",
      'opensAt', sa."DT_ABERTURA",
      'closesAt', sa."DT_ENCERRAMENTO",
      'allowDrafts', sa."ST_PERMITE_RASCUNHO",
      'settings', sa."DS_CONFIGURACAO",
      'accessMode', sa."TP_ACESSO"
    ),
    'survey', jsonb_build_object(
      'id', s."SQ_PESQUISA",
      'code', s."CO_PESQUISA",
      'name', s."NO_PESQUISA",
      'description', s."DS_PESQUISA"
    ),
    'version', jsonb_build_object(
      'id', sv."SQ_VERSAO_PESQUISA",
      'number', sv."NU_VERSAO",
      'title', sv."NO_VERSAO",
      'description', sv."DS_VERSAO",
      'settings', sv."DS_CONFIGURACAO"
    ),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ss."SQ_SECAO",
        'code', ss."CO_SECAO",
        'title', ss."NO_SECAO",
        'description', ss."DS_SECAO",
        'position', ss."NU_ORDEM",
        'settings', ss."DS_CONFIGURACAO",
        'questions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', sq."SQ_PERGUNTA",
            'code', sq."CO_PERGUNTA",
            'title', sq."NO_PERGUNTA",
            'description', sq."DS_PERGUNTA",
            'type', sq."TP_PERGUNTA",
            'required', sq."ST_OBRIGATORIA",
            'position', sq."NU_ORDEM",
            'validation', sq."DS_VALIDACAO",
            'displayLogic', sq."DS_LOGICA_EXIBICAO",
            'scoring', sq."DS_PONTUACAO",
            'settings', sq."DS_CONFIGURACAO",
            'options', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', qo."SQ_OPCAO",
                'code', qo."CO_OPCAO",
                'label', qo."NO_OPCAO",
                'value', qo."DS_VALOR",
                'score', qo."VL_NOTA",
                'position', qo."NU_ORDEM"
              ) order by qo."NU_ORDEM")
              from sigav."TB_OPCAO_PERGUNTA" qo
              where qo."SQ_PERGUNTA" = sq."SQ_PERGUNTA" and qo."ST_ATIVO" = true
            ), '[]'::jsonb)
          ) order by sq."NU_ORDEM")
          from sigav."TB_PERGUNTA_PESQUISA" sq
          where sq."SQ_SECAO" = ss."SQ_SECAO"
        ), '[]'::jsonb)
      ) order by ss."NU_ORDEM")
      from sigav."TB_SECAO_PESQUISA" ss
      where ss."SQ_VERSAO_PESQUISA" = sv."SQ_VERSAO_PESQUISA"
        and ss."SQ_SECAO_PAI" is null
    ), '[]'::jsonb)
  )
  from sigav."TB_APLICACAO_PESQUISA" sa
  join sigav."TH_VERSAO_PESQUISA" sv on sv."SQ_VERSAO_PESQUISA" = sa."SQ_VERSAO_PESQUISA"
  join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = sv."SQ_PESQUISA"
  where sa."CO_APLICACAO" = btrim(target_application_code)
    and sv."ST_SITUACAO" in ('PUBLISHED', 'RETIRED')
    and sa."ST_SITUACAO" in ('SCHEDULED', 'OPEN', 'CLOSED')
    and (sa."ST_ANONIMA" or sigav."FC_PODE_ACESSAR_CICLO"(sa."SQ_APLICACAO"))
  limit 1;
$function$;

-- FC_OBTER_IDENTIDADE_CDDI(target_application_code text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  select "SQ_APLICACAO" into v_application_id
  from sigav."TB_APLICACAO_PESQUISA"
  where "CO_APLICACAO" = btrim(target_application_code)
  limit 1;

  if v_application_id is null then
    raise exception 'Ciclo de pesquisa não encontrado.';
  end if;

  select jsonb_build_object(
    'person', jsonb_build_object(
      'id', p."SQ_PESSOA",
      'employeeNumber', p."CO_MATRICULA",
      'fullName', p."NO_PESSOA",
      'institutionalEmail', p."DS_EMAIL_INSTITUCIONAL",
      'jobTitle', p."NO_CARGO",
      'directorate', coalesce(p."DS_METADADO"->>'directorate', p."DS_METADADO"->>'diretoria'),
      'unit', coalesce(p."DS_METADADO"->>'unit', p."DS_METADADO"->>'unidade', p."CO_CENTRO_CUSTO"),
      'coordination', coalesce(p."DS_METADADO"->>'coordination', p."DS_METADADO"->>'coordenacao'),
      'workplace', p."NO_LOCAL_TRABALHO",
      'metadata', p."DS_METADADO"
    ),
    'leader', case when leader."SQ_LIDERANCA" is null then null else jsonb_build_object(
      'personId', leader."SQ_LIDERANCA",
      'fullName', leader."NO_PESSOA",
      'institutionalEmail', leader."DS_EMAIL_INSTITUCIONAL",
      'employeeNumber', leader."CO_MATRICULA",
      'jobTitle', leader."NO_CARGO",
      'unit', coalesce(leader."DS_METADADO"->>'unit', leader."DS_METADADO"->>'unidade', leader."CO_CENTRO_CUSTO"),
      'coordination', coalesce(leader."DS_METADADO"->>'coordination', leader."DS_METADADO"->>'coordenacao')
    ) end,
    'canChangeLeader', (
      app."ST_SITUACAO" = 'OPEN' or sigav."FC_PODE_GERIR_PESQUISA"()
    )
  ) into v_result
  from sigav."TB_PESSOA" p
  cross join sigav."TB_APLICACAO_PESQUISA" app
  left join lateral (
    select lp.*
    from sigav."RT_LIDERANCA_CDDI" l
    join sigav."TB_PESSOA" lp on lp."SQ_PESSOA" = l."SQ_PESSOA_LIDER"
    where l."SQ_APLICACAO" = v_application_id
      and l."SQ_PESSOA_SUBORDINADA" = p."SQ_PESSOA"
      and l."ST_SITUACAO" = 'ACTIVE'
      and l."DT_FIM_VIGENCIA" is null
    order by l."DT_INICIO_VIGENCIA" desc
    limit 1
  ) leader on true
  where p."SQ_PESSOA" = v_person_id and app."SQ_APLICACAO" = v_application_id;

  return v_result;
end;
$function$;

-- FC_OBTER_MARCA_PLATAFORMA()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_OBTER_MARCA_PLATAFORMA"()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select jsonb_build_object(
    'organizationName', "NO_ORGANIZACAO",
    'productName', "NO_PRODUTO",
    'productDescription', "DS_PRODUTO",
    'logoUrl', "DS_URL_LOGOTIPO",
    'logoPath', "DS_CAMINHO_LOGOTIPO",
    'primaryColor', "CO_COR_PRINCIPAL",
    'sidebarColor', "CO_COR_BARRA_LATERAL",
    'accessBackgroundUrl', "DS_URL_FUNDO_ACESSO",
    'accessBackgroundPath', "DS_CAMINHO_FUNDO_ACESSO",
    'accessPanelColor', "CO_COR_PAINEL_ACESSO",
    'accessGreeting', "DS_SAUDACAO_ACESSO",
    'accessInstruction', "DS_INSTRUCAO_ACESSO",
    'emailInstruction', "DS_INSTRUCAO_EMAIL",
    'emailFooter', "DS_RODAPE_EMAIL",
    'onlinePresenceEnabled', "ST_PRESENCA_ONLINE_ATIVA",
    'onlinePresenceViewerRoles', "DS_PERFIS_VISUALIZACAO",
    'homeAnnouncementEnabled', "ST_COMUNICADO_INICIO_ATIVO",
    'homeAnnouncementTitle', "NO_COMUNICADO_INICIO",
    'homeAnnouncementMessage', "DS_COMUNICADO_INICIO_MENSAGEM",
    'homeAnnouncementLink', "DS_COMUNICADO_INICIO_LINK",
    'homeAnnouncementLinkLabel', "DS_COMUNICADO_INICIO_ROTULO",
    'updatedAt', "DT_ALTERACAO"
  )
  from sigav."TB_CONFIG_PLATAFORMA"
  where "CO_CONFIGURACAO" = 1;
$function$;

-- FC_OBTER_MARCA_PUBLICA()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_OBTER_MARCA_PUBLICA"()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select jsonb_build_object(
    'organizationName', "NO_ORGANIZACAO",
    'productName', "NO_PRODUTO",
    'productDescription', "DS_PRODUTO",
    'logoUrl', "DS_URL_LOGOTIPO",
    'logoPath', "DS_CAMINHO_LOGOTIPO",
    'primaryColor', "CO_COR_PRINCIPAL",
    'sidebarColor', "CO_COR_BARRA_LATERAL",
    'accessBackgroundUrl', "DS_URL_FUNDO_ACESSO",
    'accessBackgroundPath', "DS_CAMINHO_FUNDO_ACESSO",
    'accessPanelColor', "CO_COR_PAINEL_ACESSO",
    'accessGreeting', "DS_SAUDACAO_ACESSO",
    'accessInstruction', "DS_INSTRUCAO_ACESSO"
  )
  from sigav."TB_CONFIG_PLATAFORMA"
  where "CO_CONFIGURACAO" = 1;
$function$;

-- FC_OBTER_MINHA_EQUIPE(target_application_code text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
        'avatarUrl', nullif(btrim(coalesce(person."DS_METADADO"->>'avatar_url', '')), '')
      )
      order by member->>'fullName'
    ),
    '[]'::jsonb
  )
  into v_members
  from jsonb_array_elements(coalesce(v_workspace->'members', '[]'::jsonb)) member
  left join sigav."TB_PESSOA" person on person."SQ_PESSOA" = (member->>'personId')::uuid;

  return jsonb_set(v_workspace, '{members}', v_members, true);
end;
$function$;

-- FC_OBTER_OPERACOES_PESQUISA(target_survey_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where "SQ_PESQUISA" = target_survey_id;

  if v_survey."SQ_PESQUISA" is null then
    raise exception 'Pesquisa não encontrada.';
  end if;

  select *
  into v_version
  from sigav."TH_VERSAO_PESQUISA"
  where "SQ_PESQUISA" = target_survey_id
  order by "NU_VERSAO" desc
  limit 1;

  if v_version."SQ_VERSAO_PESQUISA" is null then
    raise exception 'Versão da pesquisa não encontrada.';
  end if;

  select *
  into v_application
  from sigav."TB_APLICACAO_PESQUISA"
  where "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
  order by "DT_INCLUSAO" desc
  limit 1;

  v_integrity := sigav."FC_VALIDAR_INTEGRIDADE_VERSAO"(v_version."SQ_VERSAO_PESQUISA");
  v_issues := coalesce(v_integrity -> 'issues', '[]'::jsonb);

  select count(*)::integer
  into v_sections
  from sigav."TB_SECAO_PESQUISA"
  where "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA";

  select
    count(*)::integer,
    count(*) filter (where "ST_OBRIGATORIA")::integer
  into v_questions, v_required
  from sigav."TB_PERGUNTA_PESQUISA"
  where "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA";

  if v_application."SQ_APLICACAO" is null then
    v_issues := v_issues || jsonb_build_array(
      jsonb_build_object(
        'id', 'NO_APPLICATION',
        'code', 'NO_APPLICATION',
        'severity', 'BLOCKING',
        'category', 'CYCLE',
        'entityType', 'VERSION',
        'entityId', v_version."SQ_VERSAO_PESQUISA",
        'message', 'Configure um ciclo de aplicação.',
        'action', 'Crie o ciclo antes de publicar a versão.'
      )
    );
  else
    select count(*)::integer
    into v_participants
    from sigav."RL_APLICACAO_PESSOA"
    where "SQ_APLICACAO" = v_application."SQ_APLICACAO"
      and "ST_SITUACAO" not in ('BLOCKED', 'EXCLUDED');

    select
      count(*) filter (where "ST_SITUACAO" = 'DRAFT')::integer,
      count(*) filter (where "ST_SITUACAO" in ('SUBMITTED', 'VALIDATED'))::integer
    into v_drafts, v_submitted
    from sigav."TB_SUBMISSAO"
    where "SQ_APLICACAO" = v_application."SQ_APLICACAO";

    if v_application."DT_ABERTURA" is null or v_application."DT_ENCERRAMENTO" is null then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'NO_PERIOD',
          'code', 'NO_PERIOD',
          'severity', 'BLOCKING',
          'category', 'PERIOD',
          'entityType', 'APPLICATION',
          'entityId', v_application."SQ_APLICACAO",
          'message', 'Defina abertura e encerramento do ciclo.',
          'action', 'Preencha as duas datas e salve o período.'
        )
      );
    elsif v_application."DT_ENCERRAMENTO" <= v_application."DT_ABERTURA" then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'INVALID_PERIOD',
          'code', 'INVALID_PERIOD',
          'severity', 'BLOCKING',
          'category', 'PERIOD',
          'entityType', 'APPLICATION',
          'entityId', v_application."SQ_APLICACAO",
          'message', 'O período do ciclo é inválido.',
          'action', 'Defina o encerramento depois da abertura.'
        )
      );
    elsif v_application."ST_SITUACAO" in ('DRAFT', 'SCHEDULED')
      and v_application."DT_ENCERRAMENTO" <= now() then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'PERIOD_EXPIRED',
          'code', 'PERIOD_EXPIRED',
          'severity', 'BLOCKING',
          'category', 'PERIOD',
          'entityType', 'APPLICATION',
          'entityId', v_application."SQ_APLICACAO",
          'message', 'O encerramento informado já passou.',
          'action', 'Atualize o período antes de abrir o ciclo.'
        )
      );
    elsif v_application."ST_SITUACAO" = 'OPEN'
      and v_application."DT_ENCERRAMENTO" <= now() then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'OPEN_PERIOD_EXPIRED',
          'code', 'OPEN_PERIOD_EXPIRED',
          'severity', 'WARNING',
          'category', 'PERIOD',
          'entityType', 'APPLICATION',
          'entityId', v_application."SQ_APLICACAO",
          'message', 'O prazo terminou, mas o ciclo ainda está aberto.',
          'action', 'Encerre o ciclo para consolidar o período.'
        )
      );
    end if;

    if v_application."ST_SITUACAO" = 'CLOSED' then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'CYCLE_CLOSED',
          'code', 'CYCLE_CLOSED',
          'severity', 'WARNING',
          'category', 'CYCLE',
          'entityType', 'APPLICATION',
          'entityId', v_application."SQ_APLICACAO",
          'message', 'Este ciclo está encerrado.',
          'action', 'Informe um novo período se precisar reabri-lo.'
        )
      );
    end if;

    if v_participants = 0 and not v_application."ST_ANONIMA" then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'NO_PARTICIPANTS',
          'code', 'NO_PARTICIPANTS',
          'severity', 'WARNING',
          'category', 'AUDIENCE',
          'entityType', 'APPLICATION',
          'entityId', v_application."SQ_APLICACAO",
          'message', 'Nenhum participante foi vinculado ao ciclo.',
          'action', 'Revise o público antes da abertura.'
        )
      );
    end if;
  end if;

  v_ready_to_publish :=
    (v_integrity ->> 'valid')::boolean
    and v_application."SQ_APLICACAO" is not null
    and v_version."ST_SITUACAO" = 'DRAFT';

  v_ready_to_open :=
    (v_integrity ->> 'valid')::boolean
    and v_version."ST_SITUACAO" = 'PUBLISHED'
    and v_application."SQ_APLICACAO" is not null
    and v_application."DT_ABERTURA" is not null
    and v_application."DT_ENCERRAMENTO" is not null
    and v_application."DT_ENCERRAMENTO" > v_application."DT_ABERTURA"
    and v_application."DT_ENCERRAMENTO" > now();

  return jsonb_build_object(
    'status', 'OK',
    'survey', jsonb_build_object(
      'id', v_survey."SQ_PESQUISA",
      'code', v_survey."CO_PESQUISA",
      'name', v_survey."NO_PESQUISA",
      'status', v_survey."ST_SITUACAO",
      'description', v_survey."DS_PESQUISA"
    ),
    'version', jsonb_build_object(
      'id', v_version."SQ_VERSAO_PESQUISA",
      'number', v_version."NU_VERSAO",
      'status', v_version."ST_SITUACAO"
    ),
    'application', case
      when v_application."SQ_APLICACAO" is null then null
      else jsonb_build_object(
        'id', v_application."SQ_APLICACAO",
        'code', v_application."CO_APLICACAO",
        'name', v_application."NO_APLICACAO",
        'status', v_application."ST_SITUACAO",
        'opensAt', v_application."DT_ABERTURA",
        'closesAt', v_application."DT_ENCERRAMENTO",
        'allowDrafts', v_application."ST_PERMITE_RASCUNHO",
        'accessMode', v_application."TP_ACESSO",
        'emailNotifications', v_application."ST_NOTIFICACAO_EMAIL",
        'anonymous', v_application."ST_ANONIMA"
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

-- FC_OBTER_PAINEL_PESQ(target_application_code text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  select "SQ_APLICACAO" into v_application_id
  from sigav."TB_APLICACAO_PESQUISA"
  where "CO_APLICACAO" = btrim(target_application_code)
  limit 1;

  if v_application_id is null then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  with app as (
    select sa.*, sv."NO_VERSAO" version_title, sv."DS_VERSAO" version_description,
      sv."NU_VERSAO", s."CO_PESQUISA" survey_code, s."NO_PESQUISA" survey_name,
      s."DS_PESQUISA" survey_description
    from sigav."TB_APLICACAO_PESQUISA" sa
    join sigav."TH_VERSAO_PESQUISA" sv on sv."SQ_VERSAO_PESQUISA" = sa."SQ_VERSAO_PESQUISA"
    join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = sv."SQ_PESQUISA"
    where sa."SQ_APLICACAO" = v_application_id
  ), latest_submissions as (
    select distinct on (s."SQ_PARTICIPANTE")
      s."SQ_SUBMISSAO", s."SQ_PARTICIPANTE", s."ST_SITUACAO", s."DT_ALTERACAO"
    from sigav."TB_SUBMISSAO" s
    where s."SQ_APLICACAO" = v_application_id
      and s."SQ_PARTICIPANTE" is not null
    order by s."SQ_PARTICIPANTE", s."DT_ALTERACAO" desc
  ), participant_summary as (
    select
      count(*) total,
      count(*) filter (where sub."ST_SITUACAO" = 'DRAFT') drafts,
      count(*) filter (where sub."ST_SITUACAO" in ('SUBMITTED', 'VALIDATED')) submitted,
      count(*) filter (where sub."SQ_SUBMISSAO" is null) not_started
    from sigav."RL_APLICACAO_PESSOA" ap
    left join latest_submissions sub on sub."SQ_PARTICIPANTE" = ap."SQ_PARTICIPANTE"
    where ap."SQ_APLICACAO" = v_application_id
      and ap."ST_SITUACAO" not in ('REMOVED', 'INELIGIBLE', 'EXCLUDED')
  ), question_rows as (
    select q."SQ_PERGUNTA", q."CO_PERGUNTA", q."NO_PERGUNTA", q."DS_PERGUNTA", q."TP_PERGUNTA", q."NU_ORDEM",
      sec."SQ_SECAO" "SQ_SECAO", sec."NO_SECAO" section_title, sec."NU_ORDEM" section_position
    from sigav."TB_PERGUNTA_PESQUISA" q
    join sigav."TB_SECAO_PESQUISA" sec on sec."SQ_SECAO" = q."SQ_SECAO"
    join app on app."SQ_VERSAO_PESQUISA" = q."SQ_VERSAO_PESQUISA"
  ), submitted_answers as (
    select a.*, s."DT_ENVIO"
    from sigav."TB_RESPOSTA" a
    join sigav."TB_SUBMISSAO" s on s."SQ_SUBMISSAO" = a."SQ_SUBMISSAO"
    where s."SQ_APLICACAO" = v_application_id
      and s."ST_SITUACAO" in ('SUBMITTED', 'VALIDATED')
  ), option_counts as (
    select a."SQ_PERGUNTA", ao."SQ_OPCAO" as option_id, count(*) answer_count
    from sigav."RL_RESPOSTA_OPCAO" ao
    join submitted_answers a on a."SQ_RESPOSTA" = ao."SQ_RESPOSTA"
    group by a."SQ_PERGUNTA", ao."SQ_OPCAO"
  )
  select jsonb_build_object(
    'status', 'OK',
    'generatedAt', timezone('utc', now()),
    'application', (
      select jsonb_build_object(
        'id', "SQ_APLICACAO",
        'code', "CO_APLICACAO",
        'name', "NO_APLICACAO",
        'status', "ST_SITUACAO",
        'opensAt', "DT_ABERTURA",
        'closesAt', "DT_ENCERRAMENTO",
        'surveyCode', survey_code,
        'surveyName', survey_name,
        'surveyDescription', coalesce(survey_description, version_description),
        'versionTitle', version_title,
        'versionNumber', "NU_VERSAO"
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
        'id', qr."SQ_PERGUNTA",
        'code', qr."CO_PERGUNTA",
        'title', qr."NO_PERGUNTA",
        'description', qr."DS_PERGUNTA",
        'type', qr."TP_PERGUNTA",
        'position', qr."NU_ORDEM",
        'sectionId', qr."SQ_SECAO",
        'sectionTitle', qr.section_title,
        'sectionPosition', qr.section_position,
        'responseCount', (select count(*) from submitted_answers a where a."SQ_PERGUNTA" = qr."SQ_PERGUNTA"),
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', o."SQ_OPCAO",
            'label', o."NO_OPCAO",
            'value', o."DS_VALOR",
            'count', coalesce(oc.answer_count, 0)
          ) order by o."NU_ORDEM")
          from sigav."TB_OPCAO_PERGUNTA" o
          left join option_counts oc on oc."SQ_PERGUNTA" = qr."SQ_PERGUNTA" and oc.option_id = o."SQ_OPCAO"
          where o."SQ_PERGUNTA" = qr."SQ_PERGUNTA" and o."ST_ATIVO"
        ), '[]'::jsonb),
        'textResponses', coalesce((
          select jsonb_agg(jsonb_build_object(
            'text', left(sample."DS_RESPOSTA", 1000),
            'submittedAt', sample."DT_ENVIO"
          ) order by sample."DT_ENVIO" desc)
          from (
            select a."DS_RESPOSTA", a."DT_ENVIO"
            from submitted_answers a
            where a."SQ_PERGUNTA" = qr."SQ_PERGUNTA"
              and nullif(btrim(a."DS_RESPOSTA"), '') is not null
            order by a."DT_ENVIO" desc
            limit 100
          ) sample
        ), '[]'::jsonb)
      ) order by qr.section_position, qr."NU_ORDEM")
      from question_rows qr
    ), '[]'::jsonb)
  ) into v_payload;

  return v_payload;
end;
$function$;

-- FC_OBTER_PAINEL_PESQUISA(target_application_code text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  select "SQ_APLICACAO", coalesce("ST_ANONIMA", false), coalesce("NU_LIMIAR_ANONIMATO", 5)
  into v_application_id, v_anonimo, v_limiar
  from sigav."TB_APLICACAO_PESQUISA"
  where "CO_APLICACAO" = btrim(target_application_code)
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
    select sa.*, sv."NO_VERSAO" version_title, sv."DS_VERSAO" version_description,
      sv."NU_VERSAO", s."CO_PESQUISA" survey_code, s."NO_PESQUISA" survey_name,
      s."DS_PESQUISA" survey_description
    from sigav."TB_APLICACAO_PESQUISA" sa
    join sigav."TH_VERSAO_PESQUISA" sv on sv."SQ_VERSAO_PESQUISA" = sa."SQ_VERSAO_PESQUISA"
    join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = sv."SQ_PESQUISA"
    where sa."SQ_APLICACAO" = v_application_id
  ), latest_submissions as (
    select distinct on (s."SQ_PARTICIPANTE")
      s."SQ_SUBMISSAO", s."SQ_PARTICIPANTE", s."ST_SITUACAO", s."DT_ALTERACAO"
    from sigav."TB_SUBMISSAO" s
    where s."SQ_APLICACAO" = v_application_id
      and s."SQ_PARTICIPANTE" is not null
    order by s."SQ_PARTICIPANTE", s."DT_ALTERACAO" desc
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
        where case when v_anonimo then ap."ST_SITUACAO" = 'IN_PROGRESS' else sub."ST_SITUACAO" = 'DRAFT' end
      ) drafts,
      count(*) filter (
        where case when v_anonimo then ap."ST_SITUACAO" = 'COMPLETED' else sub."ST_SITUACAO" in ('SUBMITTED', 'VALIDATED') end
      ) submitted,
      count(*) filter (
        where case when v_anonimo then ap."ST_SITUACAO" in ('ELIGIBLE', 'INVITED') else sub."SQ_SUBMISSAO" is null end
      ) not_started
    from sigav."RL_APLICACAO_PESSOA" ap
    left join latest_submissions sub on sub."SQ_PARTICIPANTE" = ap."SQ_PARTICIPANTE"
    where ap."SQ_APLICACAO" = v_application_id
      -- Quem está bloqueado ou excluído não pode responder: manter no
      -- denominador faria a taxa de conclusão nunca chegar a 100%.
      and ap."ST_SITUACAO" not in ('BLOCKED', 'EXCLUDED')
  ), question_rows as (
    select q."SQ_PERGUNTA", q."CO_PERGUNTA", q."NO_PERGUNTA", q."DS_PERGUNTA", q."TP_PERGUNTA", q."NU_ORDEM",
      sec."SQ_SECAO" "SQ_SECAO", sec."NO_SECAO" section_title, sec."NU_ORDEM" section_position
    from sigav."TB_PERGUNTA_PESQUISA" q
    join sigav."TB_SECAO_PESQUISA" sec on sec."SQ_SECAO" = q."SQ_SECAO"
    join app on app."SQ_VERSAO_PESQUISA" = q."SQ_VERSAO_PESQUISA"
  ), submitted_answers as (
    select a.*, s."DT_ENVIO"
    from sigav."TB_RESPOSTA" a
    join sigav."TB_SUBMISSAO" s on s."SQ_SUBMISSAO" = a."SQ_SUBMISSAO"
    where s."SQ_APLICACAO" = v_application_id
      and s."ST_SITUACAO" in ('SUBMITTED', 'VALIDATED')
  ), option_counts as (
    select a."SQ_PERGUNTA", ao."SQ_OPCAO" as option_id, count(*) answer_count
    from sigav."RL_RESPOSTA_OPCAO" ao
    join submitted_answers a on a."SQ_RESPOSTA" = ao."SQ_RESPOSTA"
    group by a."SQ_PERGUNTA", ao."SQ_OPCAO"
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
        'id', "SQ_APLICACAO",
        'code', "CO_APLICACAO",
        'name', "NO_APLICACAO",
        'status', "ST_SITUACAO",
        'opensAt', "DT_ABERTURA",
        'closesAt', "DT_ENCERRAMENTO",
        'surveyCode', survey_code,
        'surveyName', survey_name,
        'surveyDescription', coalesce(survey_description, version_description),
        'versionTitle', version_title,
        'versionNumber', "NU_VERSAO"
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
          qr."NU_ORDEM" as ordem,
          jsonb_build_object(
            'id', qr."SQ_PERGUNTA",
            'code', qr."CO_PERGUNTA",
            'title', qr."NO_PERGUNTA",
            'description', qr."DS_PERGUNTA",
            'type', qr."TP_PERGUNTA",
            'position', qr."NU_ORDEM",
            'sectionId', qr."SQ_SECAO",
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
                  'id', o."SQ_OPCAO",
                  'label', o."NO_OPCAO",
                  'value', o."DS_VALOR",
                  'count', coalesce(oc.answer_count, 0)
                ) order by o."NU_ORDEM")
                from sigav."TB_OPCAO_PERGUNTA" o
                left join option_counts oc on oc."SQ_PERGUNTA" = qr."SQ_PERGUNTA" and oc.option_id = o."SQ_OPCAO"
                where o."SQ_PERGUNTA" = qr."SQ_PERGUNTA" and o."ST_ATIVO"
              ), '[]'::jsonb)
            end,
            'textResponses', case
              when false then '[]'::jsonb
              else coalesce((
                select jsonb_agg(jsonb_build_object(
                  'text', left(sample."DS_RESPOSTA", 1000),
                  -- Ciclo anônimo não devolve o horário: cruzado com a data de
                  -- conclusão de cada participante, ele reconstrói o nome.
                  'submittedAt', sample."DT_ENVIO"
                ) order by sample.ordenacao)
                from (
                  select
                    a."DS_RESPOSTA",
                    a."DT_ENVIO",
                    -- Em ciclo anônimo a ordem não pode acompanhar o tempo, ou
                    -- entrega a sequência de quem respondeu. `md5` do texto é
                    -- estável entre chamadas e não guarda relação com o envio.
                    case when v_anonimo then md5(a."DS_RESPOSTA") else to_char(a."DT_ENVIO", 'YYYYMMDDHH24MISS') end as ordenacao
                  from submitted_answers a
                  where a."SQ_PERGUNTA" = qr."SQ_PERGUNTA"
                    and nullif(btrim(a."DS_RESPOSTA"), '') is not null
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
          where a."SQ_PERGUNTA" = qr."SQ_PERGUNTA"
        ) respostas
      ) perguntas
    ), '[]'::jsonb)
  ) into v_payload;

  if v_anonimo then
    v_payload := jsonb_set(v_payload, '{summary}', jsonb_build_object(
      'totalParticipants', (select count(*) from sigav."TB_SUBMISSAO" s where s."SQ_APLICACAO" = v_application_id and s."ST_SITUACAO" in ('DRAFT', 'SUBMITTED', 'VALIDATED')),
      'drafts', (select count(*) from sigav."TB_SUBMISSAO" s where s."SQ_APLICACAO" = v_application_id and s."ST_SITUACAO" = 'DRAFT'),
      'submitted', (select count(*) from sigav."TB_SUBMISSAO" s where s."SQ_APLICACAO" = v_application_id and s."ST_SITUACAO" in ('SUBMITTED', 'VALIDATED')),
      'notStarted', 0,
      'completionRate', case when (select count(*) from sigav."TB_SUBMISSAO" s where s."SQ_APLICACAO" = v_application_id and s."ST_SITUACAO" in ('DRAFT', 'SUBMITTED', 'VALIDATED')) = 0 then 0 else round((select count(*) from sigav."TB_SUBMISSAO" s where s."SQ_APLICACAO" = v_application_id and s."ST_SITUACAO" in ('SUBMITTED', 'VALIDATED'))::numeric * 100 / (select count(*) from sigav."TB_SUBMISSAO" s where s."SQ_APLICACAO" = v_application_id and s."ST_SITUACAO" in ('DRAFT', 'SUBMITTED', 'VALIDATED')), 1) end
    ));
  end if;
  return v_payload;
end;
$function$;

-- FC_OBTER_REGRAS_DO_CICLO(p_codigo_ciclo text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_OBTER_REGRAS_DO_CICLO"(p_codigo_ciclo text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'targetType', regra."TP_ALVO",
    'targetId', regra."SQ_ALVO",
    'action', regra."TP_ACAO",
    'connector', regra."TP_CONECTOR",
    'conditions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'questionId', condicao."SQ_PERGUNTA_ORIGEM",
        'operator', condicao."TP_OPERADOR",
        'optionId', condicao."SQ_OPCAO",
        'value', coalesce(condicao."DS_VALOR", condicao."NU_VALOR"::text)
      ) order by condicao."NU_ORDEM")
      from sigav."TB_CONDICAO_REGRA" as condicao
      where condicao."SQ_REGRA" = regra."SQ_REGRA"
    ), '[]'::jsonb)
  ) order by regra."SQ_ALVO"), '[]'::jsonb)
  from sigav."TB_APLICACAO_PESQUISA" as aplicacao
  join sigav."TB_REGRA_CONDICIONAL" as regra on regra."SQ_VERSAO_PESQUISA" = aplicacao."SQ_VERSAO_PESQUISA"
  where aplicacao."CO_APLICACAO" = btrim(p_codigo_ciclo)
    and regra."ST_ATIVO"
    and sigav."FC_PODE_ACESSAR_CICLO"(aplicacao."SQ_APLICACAO");
$function$;

-- FC_OBTER_VISUAL_CICLO(target_application_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where "SQ_APLICACAO" = target_application_id;

  if v_application."SQ_APLICACAO" is null then
    raise exception 'Aplicação de pesquisa não encontrada.';
  end if;

  v_visual := coalesce(v_application."DS_CONFIGURACAO"->'visualIdentity', '{}'::jsonb);

  return jsonb_build_object(
    'status', 'OK',
    'applicationId', v_application."SQ_APLICACAO",
    'applicationCode', v_application."CO_APLICACAO",
    'applicationName', v_application."NO_APLICACAO",
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

-- FC_ORIGENS_DA_REGRA(p_alvo uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_ORIGENS_DA_REGRA"(p_alvo uuid)
 RETURNS TABLE(sq_origem uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select distinct condicao."SQ_PERGUNTA_ORIGEM"
  from sigav."TB_REGRA_CONDICIONAL" as regra
  join sigav."TB_CONDICAO_REGRA" as condicao on condicao."SQ_REGRA" = regra."SQ_REGRA"
  where regra."ST_ATIVO"
    and (
      regra."SQ_ALVO" = p_alvo
      or (
        regra."TP_ALVO" = 'SECTION'
        and exists (
          select 1
          from sigav."TB_PERGUNTA_PESQUISA" as pergunta
          where pergunta."SQ_PERGUNTA" = p_alvo
            and pergunta."SQ_SECAO" = regra."SQ_ALVO"
        )
      )
    );
$function$;

-- FC_PAINEL_MONITOR_CDDI(target_application_code text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  select sa."SQ_APLICACAO"
  into v_application_id
  from sigav."TB_APLICACAO_PESQUISA" sa
  where sa."CO_APLICACAO" = btrim(target_application_code)
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

-- FC_PAINEL_MONITOR_CDDI_INT(target_application_code text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  select sa."SQ_APLICACAO" into v_application_id
  from sigav."TB_APLICACAO_PESQUISA" sa
  where sa."CO_APLICACAO" = btrim(target_application_code)
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
    select sa.*, sv."NO_VERSAO" as version_title, sv."NU_VERSAO", s."NO_PESQUISA" as survey_name
    from sigav."TB_APLICACAO_PESQUISA" sa
    join sigav."TH_VERSAO_PESQUISA" sv on sv."SQ_VERSAO_PESQUISA" = sa."SQ_VERSAO_PESQUISA"
    join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = sv."SQ_PESQUISA"
    where sa."SQ_APLICACAO" = v_application_id
  ),
  scoped_participants as (
    select
      ap."SQ_PARTICIPANTE" as "SQ_PARTICIPANTE",
      ap."SQ_PESSOA",
      ap."ST_SITUACAO" as participant_status,
      ap."DT_INICIO",
      ap."DT_CONCLUSAO",
      p."CO_MATRICULA",
      p."NO_PESSOA",
      p."DS_EMAIL_INSTITUCIONAL",
      p."NO_CARGO",
      p."CO_CENTRO_CUSTO",
      p."NO_LOCAL_TRABALHO",
      p."DS_METADADO",
      coalesce(p."DS_METADADO"->>'directorate', p."DS_METADADO"->>'diretoria', 'SEM INFORMAÇÃO') as directorate,
      coalesce(p."DS_METADADO"->>'unit', p."DS_METADADO"->>'unidade', p."CO_CENTRO_CUSTO", 'SEM INFORMAÇÃO') as unit_name,
      coalesce(p."DS_METADADO"->>'coordination', p."DS_METADADO"->>'coordenacao', 'SEM INFORMAÇÃO') as coordination
    from sigav."RL_APLICACAO_PESSOA" ap
    join sigav."TB_PESSOA" p on p."SQ_PESSOA" = ap."SQ_PESSOA"
    where ap."SQ_APLICACAO" = v_application_id
      and ap."ST_SITUACAO" not in ('BLOCKED', 'EXCLUDED')
      and (
        v_pode_gerenciar
        or ap."SQ_PESSOA" = v_person_id
        or (
          v_e_lider and exists (
            select 1
            from sigav."RT_LIDERANCA_CDDI" l
            where l."SQ_APLICACAO" = v_application_id
              and l."SQ_PESSOA_LIDER" = v_person_id
              and l."SQ_PESSOA_SUBORDINADA" = ap."SQ_PESSOA"
              and l."ST_SITUACAO" = 'ACTIVE'
              and l."DT_FIM_VIGENCIA" is null
          )
        )
      )
  ),
  active_leaders as (
    select distinct on (l."SQ_PESSOA_SUBORDINADA")
      l."SQ_PESSOA_SUBORDINADA",
      leader."NO_PESSOA" as manager_name,
      leader."DS_EMAIL_INSTITUCIONAL" as manager_email
    from sigav."RT_LIDERANCA_CDDI" l
    join sigav."TB_PESSOA" leader on leader."SQ_PESSOA" = l."SQ_PESSOA_LIDER"
    where l."SQ_APLICACAO" = v_application_id
      and l."ST_SITUACAO" = 'ACTIVE'
      and l."DT_FIM_VIGENCIA" is null
    order by l."SQ_PESSOA_SUBORDINADA", l."DT_INICIO_VIGENCIA" desc
  ),
  latest_submissions as (
    select distinct on (coalesce(s."SQ_PESSOA_AVALIADA", s."SQ_PESSOA_RESPONDENTE"), upper(s."TP_SUBMISSAO"))
      s.*,
      coalesce(s."SQ_PESSOA_AVALIADA", s."SQ_PESSOA_RESPONDENTE") as subject_id,
      upper(s."TP_SUBMISSAO") as normalized_type
    from sigav."TB_SUBMISSAO" s
    join scoped_participants sp on sp."SQ_PESSOA" = coalesce(s."SQ_PESSOA_AVALIADA", s."SQ_PESSOA_RESPONDENTE")
    where s."SQ_APLICACAO" = v_application_id
      and upper(s."ST_SITUACAO") not in ('INVALIDATED', 'CANCELLED')
    order by coalesce(s."SQ_PESSOA_AVALIADA", s."SQ_PESSOA_RESPONDENTE"), upper(s."TP_SUBMISSAO"),
      (s."DT_ENVIO" is not null) desc, s."DT_ENVIO" desc nulls last, s."DT_ALTERACAO" desc, s."NU_VERSAO" desc
  ),
  participant_rows as (
    select
      sp.*,
      al.manager_name,
      al.manager_email,
      auto."SQ_SUBMISSAO" as auto_submission_id,
      auto."ST_SITUACAO" as auto_status,
      auto."DT_ENVIO" as auto_submitted_at,
      auto."VL_RESULTADO" as auto_score,
      leader."SQ_SUBMISSAO" as leader_submission_id,
      leader."ST_SITUACAO" as leader_status,
      leader."DT_ENVIO" as leader_submitted_at,
      leader."VL_RESULTADO" as leader_score,
      fr."VL_NOTA_FINAL" as final_score,
      fr."ST_SITUACAO" as final_status,
      fr."DT_CALCULO" as calculated_at,
      case when upper(coalesce(auto."ST_SITUACAO", '')) in ('SUBMITTED', 'VALIDATED') then true else false end as auto_completed,
      case when upper(coalesce(leader."ST_SITUACAO", '')) in ('SUBMITTED', 'VALIDATED') then true else false end as leader_completed
    from scoped_participants sp
    left join active_leaders al on al."SQ_PESSOA_SUBORDINADA" = sp."SQ_PESSOA"
    left join latest_submissions auto on auto.subject_id = sp."SQ_PESSOA" and auto.normalized_type in ('AUTO', 'AUTOAVALIACAO', 'SELF')
    left join latest_submissions leader on leader.subject_id = sp."SQ_PESSOA" and leader.normalized_type in ('CHEFIA', 'LEADER', 'MANAGER')
    left join lateral (
      select r.*
      from sigav."TB_RESULTADO_FINAL_CDDI" r
      where r."SQ_APLICACAO" = v_application_id and r."SQ_PESSOA_AVALIADA" = sp."SQ_PESSOA"
        and upper(r."ST_SITUACAO") <> 'INVALIDATED'
      order by r."DT_CALCULO" desc, r."DT_ALTERACAO" desc
      limit 1
    ) fr on true
  ),
  competencies as (
    select sec."SQ_SECAO", sec."CO_SECAO", sec."NO_SECAO", sec."NU_ORDEM"
    from sigav."TB_SECAO_PESQUISA" sec
    join app on app."SQ_VERSAO_PESQUISA" = sec."SQ_VERSAO_PESQUISA"
    where sec."CO_SECAO" ~ '^C[0-9]{2}$'
    order by sec."NU_ORDEM"
  ),
  competency_values as (
    select
      ls.subject_id as "SQ_PESSOA",
      c."CO_SECAO" as competency_code,
      c."NO_SECAO" as competency_name,
      c."NU_ORDEM",
      max(cr."VL_RESULTADO") filter (where ls.normalized_type in ('AUTO', 'AUTOAVALIACAO', 'SELF')) as auto_score,
      max(cr."VL_RESULTADO") filter (where ls.normalized_type in ('CHEFIA', 'LEADER', 'MANAGER')) as leader_score
    from latest_submissions ls
    join sigav."TB_RESULTADO_COMPET_CDDI" cr on cr."SQ_SUBMISSAO" = ls."SQ_SUBMISSAO"
    join competencies c on c."SQ_SECAO" = cr."SQ_SECAO_COMPETENCIA"
    group by ls.subject_id, c."CO_SECAO", c."NO_SECAO", c."NU_ORDEM"
  ),
  event_rows as (
    select
      coalesce(s."SQ_PESSOA_AVALIADA", s."SQ_PESSOA_RESPONDENTE") as "SQ_PESSOA",
      upper(s."TP_SUBMISSAO") as "TP_SUBMISSAO",
      s."ST_SITUACAO",
      s."DT_ENVIO",
      s."NU_VERSAO",
      s."DS_METADADO"
    from sigav."TB_SUBMISSAO" s
    join scoped_participants sp on sp."SQ_PESSOA" = coalesce(s."SQ_PESSOA_AVALIADA", s."SQ_PESSOA_RESPONDENTE")
    where s."SQ_APLICACAO" = v_application_id
      and s."DT_ENVIO" is not null
      and upper(s."ST_SITUACAO") not in ('INVALIDATED', 'CANCELLED')
  )
  select jsonb_build_object(
    'status', 'OK',
    'scope', v_scope,
    'generatedAt', timezone('utc', now()),
    'weights', jsonb_build_object('auto', 0.40, 'leader', 0.60),
    'application', (
      select jsonb_build_object(
        'id', "SQ_APLICACAO",
        'code', "CO_APLICACAO",
        'name', "NO_APLICACAO",
        'surveyName', survey_name,
        'versionTitle', version_title,
        'versionNumber', "NU_VERSAO",
        'status', "ST_SITUACAO",
        'opensAt', "DT_ABERTURA",
        'closesAt', "DT_ENCERRAMENTO"
      ) from app
    ),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'personId', pr."SQ_PESSOA",
        'participantId', pr."SQ_PARTICIPANTE",
        'employeeNumber', pr."CO_MATRICULA",
        'fullName', pr."NO_PESSOA",
        'institutionalEmail', pr."DS_EMAIL_INSTITUCIONAL",
        'jobTitle', pr."NO_CARGO",
        'directorate', pr.directorate,
        'unit', pr.unit_name,
        'coordination', pr.coordination,
        'workplace', pr."NO_LOCAL_TRABALHO",
        'managerName', pr.manager_name,
        'managerEmail', pr.manager_email,
        'participantStatus', pr.participant_status,
        'startedAt', pr."DT_INICIO",
        'completedAt', pr."DT_CONCLUSAO",
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
      ) order by pr."NO_PESSOA") from participant_rows pr
    ), '[]'::jsonb),
    'competencies', coalesce((
      select jsonb_agg(jsonb_build_object('id', "SQ_SECAO", 'code', "CO_SECAO", 'name', "NO_SECAO", 'position', "NU_ORDEM") order by "NU_ORDEM")
      from competencies
    ), '[]'::jsonb),
    'competencyScores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'personId', "SQ_PESSOA",
        'competencyCode', competency_code,
        'competencyName', competency_name,
        'position', "NU_ORDEM",
        'autoScore', auto_score,
        'leaderScore', leader_score,
        'finalScore', case when auto_score is not null and leader_score is not null then round((auto_score * 0.40 + leader_score * 0.60)::numeric, 2) else null end
      ) order by "SQ_PESSOA", "NU_ORDEM")
      from competency_values
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'personId', "SQ_PESSOA",
        'submissionType', "TP_SUBMISSAO",
        'status', "ST_SITUACAO",
        'submittedAt', "DT_ENVIO",
        'version', "NU_VERSAO",
        'metadata', "DS_METADADO"
      ) order by "DT_ENVIO")
      from event_rows
    ), '[]'::jsonb)
  ) into v_payload;

  return v_payload;
end;
$function$;

-- FC_PERGUNTA_VISIVEL(p_submissao uuid, p_pergunta uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_PERGUNTA_VISIVEL"(p_submissao uuid, p_pergunta uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_secao uuid;
begin
  select "SQ_SECAO" into v_secao from sigav."TB_PERGUNTA_PESQUISA" where "SQ_PERGUNTA" = p_pergunta;
  if v_secao is null then
    return true;
  end if;
  if not sigav."FC_ALVO_VISIVEL"(p_submissao, v_secao) then
    return false;
  end if;
  return sigav."FC_ALVO_VISIVEL"(p_submissao, p_pergunta);
end;
$function$;

-- FC_PESQUISAR_EQUIPE(target_application_id uuid, search_term text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
        'avatarUrl', nullif(btrim(coalesce(person."DS_METADADO"->>'avatar_url', '')), '')
      )
      order by candidate->>'fullName'
    ),
    '[]'::jsonb
  )
  into v_result
  from jsonb_array_elements(coalesce(v_candidates, '[]'::jsonb)) candidate
  left join sigav."TB_PESSOA" person on person."SQ_PESSOA" = (candidate->>'personId')::uuid;

  return v_result;
end;
$function$;

-- FC_PESQUISAR_PESSOA_ADMIN(target_search text, target_limit integer)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
          'personId', p."SQ_PESSOA",
          'employeeNumber', p."CO_MATRICULA",
          'fullName', p."NO_PESSOA",
          'institutionalEmail', p."DS_EMAIL_INSTITUCIONAL",
          'jobTitle', p."NO_CARGO",
          'costCenter', p."CO_CENTRO_CUSTO",
          'workplace', p."NO_LOCAL_TRABALHO",
          'directorate', nullif(btrim(coalesce(p."DS_METADADO"->>'directorate', '')), ''),
          'organizationalUnit', nullif(btrim(coalesce(p."DS_METADADO"->>'unit', '')), ''),
          'coordination', nullif(btrim(coalesce(p."DS_METADADO"->>'coordination', '')), ''),
          'employmentStatus', p."ST_VINCULO",
          'active', p."ST_ATIVO",
          'updatedAt', p."DT_ALTERACAO"
        )
        order by p."ST_ATIVO" desc, p."NO_PESSOA"
      ),
      '[]'::jsonb
    )
    from (
      select candidate.*
      from sigav."TB_PESSOA" candidate
      where v_search = ''
        or lower(candidate."NO_PESSOA") like '%' || v_search || '%'
        or lower(candidate."CO_MATRICULA") like '%' || v_search || '%'
        or lower(coalesce(candidate."DS_EMAIL_INSTITUCIONAL", '')) like '%' || v_search || '%'
        or lower(coalesce(candidate."NO_CARGO", '')) like '%' || v_search || '%'
        or lower(coalesce(candidate."CO_CENTRO_CUSTO", '')) like '%' || v_search || '%'
        or lower(coalesce(candidate."NO_LOCAL_TRABALHO", '')) like '%' || v_search || '%'
        or lower(coalesce(candidate."DS_METADADO"->>'directorate', '')) like '%' || v_search || '%'
        or lower(coalesce(candidate."DS_METADADO"->>'unit', '')) like '%' || v_search || '%'
        or lower(coalesce(candidate."DS_METADADO"->>'coordination', '')) like '%' || v_search || '%'
      order by candidate."ST_ATIVO" desc, candidate."NO_PESSOA"
      limit v_limit
    ) p
  );
end;
$function$;

-- FC_PESSOA_SESSAO()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_PESSOA_SESSAO"()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select p."SQ_PESSOA" from sigav."TB_PESSOA" p
  where p."SQ_USUARIO_IDENTIDADE" = sigav."FC_UID_SESSAO"() and p."ST_ATIVO" = true
  limit 1;
$function$;

-- FC_PLANEJAR_PUBLICO_AVALIACAO(p_aplicacao uuid, p_regra jsonb)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    select "SQ_PESSOA", "ST_SITUACAO"
    from sigav."RL_APLICACAO_PESSOA"
    where "SQ_APLICACAO" = p_aplicacao
      and "TP_PARTICIPANTE" = 'RESPONDENT'
  ),
  -- `full outer join` porque as duas pontas importam: quem a regra alcança e
  -- ainda não está vinculado, e quem está vinculado e a regra deixou de
  -- alcançar. Um `left join` só enxergaria a primeira.
  combinado as (
    select
      coalesce(r.sq_pessoa, v."SQ_PESSOA") as pessoa,
      r.sq_pessoa is not null as casa,
      coalesce(r.st_excluida, false) as excluida,
      v."ST_SITUACAO" as situacao
    from resolvido r
    full outer join vinculo_atual v on v."SQ_PESSOA" = r.sq_pessoa
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

-- FC_PODE_ACESSAR_CICLO(target_application_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_PODE_ACESSAR_CICLO"(target_application_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
 select sigav."FC_PODE_GERIR_PESQUISA"()
 or exists(select 1 from sigav."TB_APLICACAO_PESQUISA" sa where sa."SQ_APLICACAO"=target_application_id and sa."TP_ACESSO"='INSTITUTIONAL' and sigav."FC_PESSOA_SESSAO"() is not null)
 or exists(select 1 from sigav."RL_APLICACAO_PESSOA" ap where ap."SQ_APLICACAO"=target_application_id and ap."SQ_PESSOA"=sigav."FC_PESSOA_SESSAO"() and ap."ST_SITUACAO" not in ('BLOCKED','EXCLUDED'))
$function$;

-- FC_PODE_EDITAR_SUBMISSAO(target_submission_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_PODE_EDITAR_SUBMISSAO"(target_submission_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select sigav."FC_PODE_GERIR_PESQUISA"() or exists (
    select 1
    from sigav."TB_SUBMISSAO" s
    where s."SQ_SUBMISSAO" = target_submission_id
      and s."SQ_PESSOA_RESPONDENTE" = sigav."FC_PESSOA_SESSAO"()
      and s."ST_SITUACAO" = 'DRAFT'
      and sigav."FC_PODE_ACESSAR_CICLO"(s."SQ_APLICACAO")
      and sigav."FC_CICLO_ACEITA_RESPOSTA"(s."SQ_APLICACAO")
  );
$function$;

-- FC_PODE_REGISTRAR_PRESENCA()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_PODE_REGISTRAR_PRESENCA"()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select coalesce((
    select c."ST_PRESENCA_ONLINE_ATIVA"
      and sigav."FC_PESSOA_SESSAO"() is not null
    from sigav."TB_CONFIG_PLATAFORMA" c
    where c."CO_CONFIGURACAO" = 1
  ), false);
$function$;

-- FC_PODE_VER_PRESENCA()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_PODE_VER_PRESENCA"()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select coalesce((
    select configuracao."ST_PRESENCA_ONLINE_ATIVA"
      and sigav."FC_TEM_MODULO"('ONLINE_PRESENCE')
    from sigav."TB_CONFIG_PLATAFORMA" configuracao
    where configuracao."CO_CONFIGURACAO" = 1
  ), false);
$function$;

-- FC_PREVISUALIZAR_PUBLICO(p_aplicacao uuid, p_regra jsonb, p_limite_amostra integer)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  if not exists (select 1 from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = p_aplicacao) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  with plano as (
    select * from sigav."FC_PLANEJAR_PUBLICO_AVALIACAO"(p_aplicacao, p_regra)
  ),
  inclusoes_pedidas as (
    select valor::uuid as "SQ_PESSOA"
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
                                where not exists (select 1 from sigav."TB_PESSOA" p where p."SQ_PESSOA" = i."SQ_PESSOA" and p."ST_ATIVO")),
    'sample', coalesce((
      select jsonb_agg(item order by item ->> 'fullName')
      from (
        select jsonb_build_object(
          'personId', p."SQ_PESSOA",
          'fullName', p."NO_PESSOA",
          'jobTitle', p."NO_CARGO",
          'unit', p."DS_METADADO" ->> 'unit',
          'directorate', p."DS_METADADO" ->> 'directorate',
          'currentStatus', pl.tp_situacao,
          'nextStatus', pl.tp_situacao_nova,
          'alreadyLinked', pl.tp_situacao is not null
        ) as item
        from plano pl
        join sigav."TB_PESSOA" p on p."SQ_PESSOA" = pl.sq_pessoa
        where pl.tp_situacao_nova not in ('BLOCKED', 'EXCLUDED')
        order by p."NO_PESSOA"
        limit greatest(coalesce(p_limite_amostra, 50), 0)
      ) amostra
    ), '[]'::jsonb)
  )
  into v_resultado;

  return v_resultado;
end;
$function$;

-- FC_REIVINDICAR_ACESSO()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where lower(pai."NO_EMAIL") = v_email
    and pai."TP_IDENTIDADE" = 'INSTITUTIONAL_EMAIL'
    and pai."ST_SITUACAO" in ('PENDING', 'ACTIVE')
    and pai."DT_REVOGACAO" is null
  order by case when pai."ST_SITUACAO" = 'ACTIVE' then 0 else 1 end, pai."DT_INCLUSAO"
  limit 1;

  if v_identity."SQ_IDENTIDADE" is null then
    return query select 'IDENTITY_NOT_FOUND'::text, null::uuid, null::text, null::text, null::text;
    return;
  end if;

  select p.*
    into v_person
  from sigav."TB_PESSOA" p
  where p."SQ_PESSOA" = v_identity."SQ_PESSOA"
    and p."ST_ATIVO" = true;

  if v_person."SQ_PESSOA" is null then
    return query select 'PERSON_INACTIVE'::text, null::uuid, null::text, null::text, null::text;
    return;
  end if;

  if v_person."SQ_USUARIO_IDENTIDADE" is not null and v_person."SQ_USUARIO_IDENTIDADE" <> v_uid then
    return query select 'IDENTITY_CONFLICT'::text, null::uuid, null::text, null::text, null::text;
    return;
  end if;

  update sigav."TB_PESSOA"
     set "SQ_USUARIO_IDENTIDADE" = v_uid,
         "DT_ALTERACAO" = timezone('utc', now())
   where "SQ_PESSOA" = v_person."SQ_PESSOA";

  update sigav."TB_IDENTIDADE_ACESSO"
     set "ST_SITUACAO" = 'ACTIVE',
         "DT_VERIFICACAO" = coalesce("DT_VERIFICACAO", timezone('utc', now())),
         "DT_ALTERACAO" = timezone('utc', now())
   where "SQ_IDENTIDADE" = v_identity."SQ_IDENTIDADE";

  select ap."TP_ACESSO"
    into v_access_profile
  from sigav."RL_APLICACAO_PESSOA" ap
  join sigav."TB_APLICACAO_PESQUISA" sa on sa."SQ_APLICACAO" = ap."SQ_APLICACAO"
  where ap."SQ_PESSOA" = v_person."SQ_PESSOA"
    and sa."CO_APLICACAO" = 'CDDI-2026'
  order by ap."DT_INCLUSAO" desc
  limit 1;

  return query
  select
    'CLAIMED'::text,
    v_person."SQ_PESSOA",
    v_person."NO_PESSOA",
    v_person."CO_MATRICULA",
    coalesce(v_access_profile, 'USUARIO_COMUM');
end;
$function$;

-- FC_REIVINDICAR_EMAILS()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  set "ST_ENVIO" = 'ENVIADO',
      "CO_REIVINDICACAO" = null,
      "DS_ERRO" = 'Entrega ambígua: o transporte foi iniciado e a confirmação não chegou. Conferir na caixa de saída antes de reenviar.',
      "DT_ENVIO" = coalesce("DT_ENVIO", v_now),
      "DT_ALTERACAO" = v_now
  where "ST_ENVIO" = 'PROCESSANDO'
    and "DT_ALTERACAO" < v_now - interval '15 minutes'
    and "CO_MENSAGEM_SMTP" is not null;

  update sigav."TL_EMAIL_PARTICIPANTE"
  set "ST_ENVIO" = case when "NU_TENTATIVAS" >= 5 then 'FALHOU' else 'PENDENTE' end,
      "CO_REIVINDICACAO" = null,
      "DS_ERRO" = case
        when "NU_TENTATIVAS" >= 5 then 'Limite de tentativas atingido após expiração da reivindicação.'
        else 'A reivindicação anterior expirou antes da confirmação.'
      end,
      "DT_ALTERACAO" = v_now
  where "ST_ENVIO" = 'PROCESSANDO'
    and "DT_ALTERACAO" < v_now - interval '15 minutes'
    and "CO_MENSAGEM_SMTP" is null;

  insert into sigav."TL_EMAIL_PARTICIPANTE" (
    "SQ_APLICACAO", "SQ_PESSOA", "TP_EMAIL", "ST_ENVIO"
  )
  select a."SQ_APLICACAO", p."SQ_PESSOA", e."TP_EMAIL", 'PENDENTE'
  from sigav."TB_APLICACAO_PESQUISA" a
  join sigav."RL_APLICACAO_PESSOA" ap on ap."SQ_APLICACAO" = a."SQ_APLICACAO"
  join sigav."TB_PESSOA" p on p."SQ_PESSOA" = ap."SQ_PESSOA"
  cross join lateral (
    values ('research_opened'), ('research_expiring_24h')
  ) as e("TP_EMAIL")
  where a."ST_NOTIFICACAO_EMAIL"
    and a."ST_SITUACAO" = 'OPEN'
    and ap."ST_SITUACAO" in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
    and p."ST_ATIVO"
    and p."DS_EMAIL_INSTITUCIONAL" ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    and (
      (e."TP_EMAIL" = 'research_opened'
        and (a."DT_ENCERRAMENTO" is null or a."DT_ENCERRAMENTO" > now()))
      or
      (e."TP_EMAIL" = 'research_expiring_24h'
        and a."DT_ENCERRAMENTO" is not null
        and a."DT_ENCERRAMENTO" > now()
        and a."DT_ENCERRAMENTO" <= now() + interval '24 hours'
        and exists (
          select 1
          from sigav."TL_EMAIL_PARTICIPANTE" abertura
          where abertura."SQ_APLICACAO" = a."SQ_APLICACAO"
            and abertura."SQ_PESSOA" = p."SQ_PESSOA"
            and abertura."TP_EMAIL" = 'research_opened'
            and abertura."ST_ENVIO" = 'ENVIADO'
            and abertura."DT_ENVIO" <= now() - interval '1 hour'
        ))
    )
  on conflict ("SQ_APLICACAO", "SQ_PESSOA", "TP_EMAIL")
    where "TP_EMAIL" in ('research_opened', 'research_expiring_24h')
  do nothing;

  with candidates as (
    select t."SQ_EMAIL"
    from sigav."TL_EMAIL_PARTICIPANTE" t
    join sigav."TB_APLICACAO_PESQUISA" a on a."SQ_APLICACAO" = t."SQ_APLICACAO"
    join sigav."RL_APLICACAO_PESSOA" ap
      on ap."SQ_APLICACAO" = t."SQ_APLICACAO"
     and ap."SQ_PESSOA" = t."SQ_PESSOA"
    join sigav."TB_PESSOA" p on p."SQ_PESSOA" = t."SQ_PESSOA"
    where (
        t."ST_ENVIO" = 'PENDENTE'
        or (
          t."ST_ENVIO" = 'FALHOU'
          and t."DT_ALTERACAO" <= v_now - interval '5 minutes'
        )
      )
      -- Envio dirigido nao exige o interruptor do ciclo: e ato explicito de
      -- quem opera, e exigi-lo impediria cobrar quem falta num ciclo sem
      -- aviso automatico ligado.
      and (t."TP_EMAIL" = 'manual_reminder' or a."ST_NOTIFICACAO_EMAIL")
      and a."ST_SITUACAO" = 'OPEN'
      and t."NU_TENTATIVAS" < 5
      and ap."ST_SITUACAO" in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
      and p."ST_ATIVO"
      and p."DS_EMAIL_INSTITUCIONAL" ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      and (
        -- Sem janela propria: o lembrete dirigido vale enquanto o ciclo estiver
        -- aberto, porque quem o disparou decidiu o momento.
        t."TP_EMAIL" = 'manual_reminder'
        or
        (t."TP_EMAIL" = 'research_opened'
          and (a."DT_ENCERRAMENTO" is null or a."DT_ENCERRAMENTO" > now()))
        or
        (t."TP_EMAIL" = 'research_expiring_24h'
          and a."DT_ENCERRAMENTO" is not null
          and a."DT_ENCERRAMENTO" > now()
          and a."DT_ENCERRAMENTO" <= now() + interval '24 hours'
          and exists (
            select 1
            from sigav."TL_EMAIL_PARTICIPANTE" abertura
            where abertura."SQ_APLICACAO" = t."SQ_APLICACAO"
              and abertura."SQ_PESSOA" = t."SQ_PESSOA"
              and abertura."TP_EMAIL" = 'research_opened'
              and abertura."ST_ENVIO" = 'ENVIADO'
              and abertura."DT_ENVIO" <= now() - interval '1 hour'
          ))
      )
    order by t."DT_INCLUSAO", t."SQ_EMAIL"
    for update of t skip locked
    limit 100
  )
  update sigav."TL_EMAIL_PARTICIPANTE" t
  set "ST_ENVIO" = 'PROCESSANDO',
      "CO_REIVINDICACAO" = v_claim_token,
      "NU_TENTATIVAS" = t."NU_TENTATIVAS" + 1,
      "DS_ERRO" = null,
      "DT_ALTERACAO" = v_now
  from candidates c
  where t."SQ_EMAIL" = c."SQ_EMAIL";

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t."SQ_EMAIL",
    'claimToken', t."CO_REIVINDICACAO",
    'applicationId', t."SQ_APLICACAO",
    'personId', t."SQ_PESSOA",
    'kind', t."TP_EMAIL",
    'personName', p."NO_PESSOA",
    'personEmail', p."DS_EMAIL_INSTITUCIONAL",
    'applicationName', a."NO_APLICACAO",
    'applicationCode', a."CO_APLICACAO",
    'surveyCode', s."CO_PESQUISA",
    'closesAt', a."DT_ENCERRAMENTO",
    'surveyDescription', s."DS_PESQUISA",
    'organizationName', cfg."NO_ORGANIZACAO",
    'productName', cfg."NO_PRODUTO",
    'emailInstruction', cfg."DS_INSTRUCAO_EMAIL",
    'emailFooter', cfg."DS_RODAPE_EMAIL"
  ) order by t."DT_INCLUSAO", t."SQ_EMAIL"), '[]'::jsonb)
  into v_result
  from sigav."TL_EMAIL_PARTICIPANTE" t
  join sigav."TB_APLICACAO_PESQUISA" a on a."SQ_APLICACAO" = t."SQ_APLICACAO"
  join sigav."TH_VERSAO_PESQUISA" sv on sv."SQ_VERSAO_PESQUISA" = a."SQ_VERSAO_PESQUISA"
  join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = sv."SQ_PESQUISA"
  join sigav."TB_PESSOA" p on p."SQ_PESSOA" = t."SQ_PESSOA"
  -- LEFT de proposito: configuracao ausente faz o template cair no padrao do
  -- codigo, e nunca impede o envio.
  left join sigav."TB_CONFIG_PLATAFORMA" cfg on cfg."CO_CONFIGURACAO" = 1
  where t."ST_ENVIO" = 'PROCESSANDO'
    and t."CO_REIVINDICACAO" = v_claim_token;

  return v_result;
end;
$function$;

-- FC_REMOVER_PESSOA_EQUIPE(target_link_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  select * into v_link from sigav."RT_LIDERANCA_CDDI" where "SQ_LIDERANCA"=target_link_id for update;
  if v_link."SQ_LIDERANCA" is null then raise exception 'Vínculo não encontrado.'; end if;
  if v_link."ST_SITUACAO"<>'ACTIVE' or v_link."DT_FIM_VIGENCIA" is not null then raise exception 'O vínculo já foi encerrado.'; end if;
  if v_link."SQ_PESSOA_LIDER"<>v_actor_id and not sigav."FC_PODE_GERIR_PESQUISA"() then raise exception 'Você não possui permissão para retirar esta pessoa.'; end if;
  update sigav."RT_LIDERANCA_CDDI" set "ST_SITUACAO"='ENDED',"DT_FIM_VIGENCIA"=timezone('utc',now()),"DT_ALTERACAO"=timezone('utc',now()) where "SQ_LIDERANCA"=target_link_id;
  select "NO_PESSOA" into v_person_name from sigav."TB_PESSOA" where "SQ_PESSOA"=v_link."SQ_PESSOA_SUBORDINADA";
  insert into sigav."TL_EVENTO_AUDITORIA"("SQ_PESSOA_ATOR","TP_EVENTO","TP_ENTIDADE","CO_ENTIDADE","SQ_APLICACAO","DS_DADO_ANTERIOR","DS_DADO_POSTERIOR","DS_METADADO")
  values(v_actor_id,'TEAM_MEMBER_REMOVED','CDDI_LEADERSHIP_LINK',target_link_id::text,v_link."SQ_APLICACAO",to_jsonb(v_link),jsonb_build_object('status','ENDED','validTo',timezone('utc',now())),'{}'::jsonb);
  return jsonb_build_object('status','OK','personName',v_person_name);
end;$function$;

-- FC_REMOVER_RESPOSTA_PESSOA(p_submissao uuid, p_modo text, p_motivo text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  select * into v_submissao from sigav."TB_SUBMISSAO" where "SQ_SUBMISSAO" = p_submissao;
  if v_submissao."SQ_SUBMISSAO" is null then
    raise exception 'Resposta não localizada.';
  end if;

  select count(*)::integer into v_respostas from sigav."TB_RESPOSTA" where "SQ_SUBMISSAO" = p_submissao;

  -- Quais resultados consolidados dependem desta submissão. Levantado agora
  -- porque o `DELETE` anula os vínculos logo adiante, e depois disso a
  -- informação some.
  select coalesce(array_agg("SQ_RESULTADO"), '{}')
  into v_resultados
  from sigav."TB_RESULTADO_FINAL_CDDI"
  where "SQ_SUBMISSAO_AUTO" = p_submissao or "SQ_SUBMISSAO_LIDER" = p_submissao;

  -- Retrato do que existia, gravado na auditoria antes de qualquer alteração.
  select jsonb_build_object(
    'submissionId', v_submissao."SQ_SUBMISSAO",
    'status', v_submissao."ST_SITUACAO",
    'submissionType', v_submissao."TP_SUBMISSAO",
    'submittedAt', v_submissao."DT_ENVIO",
    'answers', v_respostas,
    'consolidatedResults', coalesce(array_length(v_resultados, 1), 0),
    'respondent', jsonb_build_object(
      'personId', pessoa."SQ_PESSOA", 'employeeNumber', pessoa."CO_MATRICULA", 'fullName', pessoa."NO_PESSOA"
    ),
    'application', jsonb_build_object('id', aplicacao."SQ_APLICACAO", 'code', aplicacao."CO_APLICACAO", 'name', aplicacao."NO_APLICACAO")
  )
  into v_retrato
  from sigav."TB_APLICACAO_PESQUISA" as aplicacao
  left join sigav."TB_PESSOA" as pessoa on pessoa."SQ_PESSOA" = v_submissao."SQ_PESSOA_RESPONDENTE"
  where aplicacao."SQ_APLICACAO" = v_submissao."SQ_APLICACAO";

  insert into sigav."TL_EVENTO_AUDITORIA" (
    "SQ_PESSOA_ATOR", "TP_EVENTO", "TP_ENTIDADE", "CO_ENTIDADE", "SQ_APLICACAO", "DS_DADO_ANTERIOR", "DS_METADADO"
  ) values (
    v_pessoa,
    case when v_modo = 'DELETE' then 'SUBMISSION_DELETED' else 'SUBMISSION_INVALIDATED' end,
    'SUBMISSION', v_submissao."SQ_SUBMISSAO"::text, v_submissao."SQ_APLICACAO", v_retrato,
    jsonb_build_object('reason', v_motivo, 'mode', v_modo)
  );

  -- Vale para os dois modos: o cálculo derivado não sobrevive à resposta que o
  -- originou. A linha fica, como registro de que houve um cálculo; o número sai.
  if array_length(v_resultados, 1) > 0 then
    update sigav."TB_RESULTADO_FINAL_CDDI"
    set "ST_SITUACAO" = 'INVALIDATED',
        "VL_NOTA_AUTO" = null,
        "VL_NOTA_LIDER" = null,
        "VL_NOTA_FINAL" = null,
        "DT_PUBLICACAO" = null,
        "DT_ALTERACAO" = now(),
        "DS_METADADO" = coalesce("DS_METADADO", '{}'::jsonb) || jsonb_build_object(
          'invalidatedBy', v_pessoa,
          'invalidatedAt', now(),
          'invalidationReason', v_motivo,
          'invalidationSource', 'SUBMISSION_' || v_modo
        )
    where "SQ_RESULTADO" = any(v_resultados);
  end if;

  -- Detalhe por competência daquela submissão: sem estado próprio, some nos dois
  -- modos.
  delete from sigav."TB_RESULTADO_COMPET_CDDI" where "SQ_SUBMISSAO" = p_submissao;

  if v_modo = 'INVALIDATE' then
    -- As respostas continuam gravadas; o que muda é o estado da submissão, e é
    -- ele que os painéis e o cálculo leem.
    update sigav."TB_SUBMISSAO"
    set "ST_SITUACAO" = 'INVALIDATED',
        "DT_ALTERACAO" = now(),
        "DS_METADADO" = coalesce("DS_METADADO", '{}'::jsonb) || jsonb_build_object(
          'invalidatedBy', v_pessoa, 'invalidatedAt', now(), 'invalidationReason', v_motivo
        )
    where "SQ_SUBMISSAO" = p_submissao;
  else
    -- De baixo para cima, como toda remoção neste banco. Os vínculos só são
    -- anulados aqui, depois de os resultados já terem sido marcados.
    update sigav."TB_RESULTADO_FINAL_CDDI" set "SQ_SUBMISSAO_AUTO" = null where "SQ_SUBMISSAO_AUTO" = p_submissao;
    update sigav."TB_RESULTADO_FINAL_CDDI" set "SQ_SUBMISSAO_LIDER" = null where "SQ_SUBMISSAO_LIDER" = p_submissao;
    delete from sigav."RL_RESPOSTA_OPCAO" where "SQ_RESPOSTA" in (
      select "SQ_RESPOSTA" from sigav."TB_RESPOSTA" where "SQ_SUBMISSAO" = p_submissao
    );
    delete from sigav."TB_RESPOSTA" where "SQ_SUBMISSAO" = p_submissao;
    delete from sigav."TB_SUBMISSAO" where "SQ_SUBMISSAO" = p_submissao;
  end if;

  -- A pessoa volta a constar como pendente no ciclo: sem isso, o painel
  -- continuaria contando como concluída uma resposta que não existe mais.
  update sigav."RL_APLICACAO_PESSOA"
  set "ST_SITUACAO" = 'ELIGIBLE', "DT_CONCLUSAO" = null, "DT_ALTERACAO" = now()
  where "SQ_APLICACAO" = v_submissao."SQ_APLICACAO"
    and "SQ_PESSOA" = v_submissao."SQ_PESSOA_RESPONDENTE"
    and "ST_SITUACAO" = 'COMPLETED';

  return jsonb_build_object(
    'status', 'OK',
    'mode', v_modo,
    'submissionId', p_submissao,
    'answers', v_respostas,
    'invalidatedResults', coalesce(array_length(v_resultados, 1), 0)
  );
end;
$function$;

-- FC_REORDENAR_ITEM_CONSTRUTOR(target_item_type text, target_item_id uuid, target_direction text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    join sigav."TB_SECAO_PESQUISA" sec on sec."SQ_VERSAO_PESQUISA" = sv."SQ_VERSAO_PESQUISA"
    where sec."SQ_SECAO" = target_item_id
      and sv."ST_SITUACAO" = 'DRAFT'
    for update of sv;

    if v_version."SQ_VERSAO_PESQUISA" is null then
      raise exception 'Seção em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
    end if;

    perform sec."SQ_SECAO"
    from sigav."TB_SECAO_PESQUISA" sec
    where sec."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
    order by sec."SQ_SECAO"
    for update;

    select *
    into v_section
    from sigav."TB_SECAO_PESQUISA"
    where "SQ_SECAO" = target_item_id
      and "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA";

    if v_direction = 'UP' then
      select *
      into v_neighbor_section
      from sigav."TB_SECAO_PESQUISA"
      where "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
        and "NU_ORDEM" < v_section."NU_ORDEM"
      order by "NU_ORDEM" desc, "SQ_SECAO" desc
      limit 1;
    else
      select *
      into v_neighbor_section
      from sigav."TB_SECAO_PESQUISA"
      where "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
        and "NU_ORDEM" > v_section."NU_ORDEM"
      order by "NU_ORDEM", "SQ_SECAO"
      limit 1;
    end if;

    if v_neighbor_section."SQ_SECAO" is null then
      return jsonb_build_object(
        'status', 'NO_CHANGE',
        'itemType', v_item_type,
        'itemId', target_item_id,
        'position', v_section."NU_ORDEM"
      );
    end if;

    select candidate
    into v_temporary_position
    from generate_series(0, (
      select coalesce(max(sec."NU_ORDEM"), 0) + 1
      from sigav."TB_SECAO_PESQUISA" sec
      where sec."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
    )) as candidates(candidate)
    where not exists (
      select 1
      from sigav."TB_SECAO_PESQUISA" sec
      where sec."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
        and sec."NU_ORDEM" = candidate
    )
    order by candidate
    limit 1;

    v_from_position := v_section."NU_ORDEM";
    v_to_position := v_neighbor_section."NU_ORDEM";
    v_title := v_section."NO_SECAO";

    update sigav."TB_SECAO_PESQUISA"
    set "NU_ORDEM" = v_temporary_position,
        "DT_ALTERACAO" = timezone('utc', now())
    where "SQ_SECAO" = v_section."SQ_SECAO";

    update sigav."TB_SECAO_PESQUISA"
    set "NU_ORDEM" = v_from_position,
        "DT_ALTERACAO" = timezone('utc', now())
    where "SQ_SECAO" = v_neighbor_section."SQ_SECAO";

    update sigav."TB_SECAO_PESQUISA"
    set "NU_ORDEM" = v_to_position,
        "DT_ALTERACAO" = timezone('utc', now())
    where "SQ_SECAO" = v_section."SQ_SECAO";
  else
    select sv.*
    into v_version
    from sigav."TH_VERSAO_PESQUISA" sv
    join sigav."TB_PERGUNTA_PESQUISA" question on question."SQ_VERSAO_PESQUISA" = sv."SQ_VERSAO_PESQUISA"
    where question."SQ_PERGUNTA" = target_item_id
      and sv."ST_SITUACAO" = 'DRAFT'
    for update of sv;

    if v_version."SQ_VERSAO_PESQUISA" is null then
      raise exception 'Pergunta em rascunho não encontrada. Versões publicadas não podem ser alteradas.';
    end if;

    select question."SQ_SECAO"
    into v_source_section_id
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question."SQ_PERGUNTA" = target_item_id
      and question."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA";

    perform question."SQ_PERGUNTA"
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question."SQ_SECAO" = v_source_section_id
    order by question."SQ_PERGUNTA"
    for update;

    select *
    into v_question
    from sigav."TB_PERGUNTA_PESQUISA"
    where "SQ_PERGUNTA" = target_item_id
      and "SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA";

    if v_direction = 'UP' then
      select *
      into v_neighbor_question
      from sigav."TB_PERGUNTA_PESQUISA"
      where "SQ_SECAO" = v_question."SQ_SECAO"
        and "NU_ORDEM" < v_question."NU_ORDEM"
      order by "NU_ORDEM" desc, "SQ_PERGUNTA" desc
      limit 1;
    else
      select *
      into v_neighbor_question
      from sigav."TB_PERGUNTA_PESQUISA"
      where "SQ_SECAO" = v_question."SQ_SECAO"
        and "NU_ORDEM" > v_question."NU_ORDEM"
      order by "NU_ORDEM", "SQ_PERGUNTA"
      limit 1;
    end if;

    if v_neighbor_question."SQ_PERGUNTA" is null then
      return jsonb_build_object(
        'status', 'NO_CHANGE',
        'itemType', v_item_type,
        'itemId', target_item_id,
        'position', v_question."NU_ORDEM"
      );
    end if;

    select candidate
    into v_temporary_position
    from generate_series(0, (
      select coalesce(max(question."NU_ORDEM"), 0) + 1
      from sigav."TB_PERGUNTA_PESQUISA" question
      where question."SQ_SECAO" = v_question."SQ_SECAO"
    )) as candidates(candidate)
    where not exists (
      select 1
      from sigav."TB_PERGUNTA_PESQUISA" question
      where question."SQ_SECAO" = v_question."SQ_SECAO"
        and question."NU_ORDEM" = candidate
    )
    order by candidate
    limit 1;

    v_from_position := v_question."NU_ORDEM";
    v_to_position := v_neighbor_question."NU_ORDEM";
    v_title := v_question."NO_PERGUNTA";

    update sigav."TB_PERGUNTA_PESQUISA"
    set "NU_ORDEM" = v_temporary_position,
        "DT_ALTERACAO" = timezone('utc', now())
    where "SQ_PERGUNTA" = v_question."SQ_PERGUNTA";

    update sigav."TB_PERGUNTA_PESQUISA"
    set "NU_ORDEM" = v_from_position,
        "DT_ALTERACAO" = timezone('utc', now())
    where "SQ_PERGUNTA" = v_neighbor_question."SQ_PERGUNTA";

    update sigav."TB_PERGUNTA_PESQUISA"
    set "NU_ORDEM" = v_to_position,
        "DT_ALTERACAO" = timezone('utc', now())
    where "SQ_PERGUNTA" = v_question."SQ_PERGUNTA";
  end if;

  select app."SQ_APLICACAO"
  into v_application_id
  from sigav."TB_APLICACAO_PESQUISA" app
  where app."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
  order by app."DT_INCLUSAO" desc
  limit 1;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR",
    "TP_EVENTO",
    "TP_ENTIDADE",
    "CO_ENTIDADE",
    "SQ_APLICACAO",
    "DS_DADO_ANTERIOR",
    "DS_DADO_POSTERIOR",
    "DS_METADADO"
  ) values (
    v_actor_id,
    'SURVEY_' || v_item_type || '_REORDERED',
    'SURVEY_' || v_item_type,
    target_item_id::text,
    v_application_id,
    jsonb_build_object('position', v_from_position),
    jsonb_build_object('position', v_to_position, 'direction', v_direction),
    jsonb_build_object(
      'surveyId', v_version."SQ_PESQUISA",
      'surveyVersionId', v_version."SQ_VERSAO_PESQUISA",
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

-- FC_RESOLVER_PESSOA_AUTENTIC(target_employee_number text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where "SQ_USUARIO_IDENTIDADE" = v_auth and "ST_ATIVO"
  limit 1;

  if v_person."SQ_PESSOA" is null then
    select count(*) into v_count
    from sigav."TB_PESSOA"
    where "ST_ATIVO"
      and lower(btrim(coalesce("DS_EMAIL_INSTITUCIONAL",''))) = v_email
      and (target_employee_number is null or "CO_MATRICULA" = btrim(target_employee_number));

    if v_count > 1 and target_employee_number is null then
      return jsonb_build_object('status','NEEDS_EMPLOYEE_NUMBER','message','Há mais de um cadastro associado ao e-mail. Informe sua matrícula.');
    end if;

    select * into v_person
    from sigav."TB_PESSOA"
    where "ST_ATIVO"
      and lower(btrim(coalesce("DS_EMAIL_INSTITUCIONAL",''))) = v_email
      and (target_employee_number is null or "CO_MATRICULA" = btrim(target_employee_number))
    order by ("SQ_USUARIO_IDENTIDADE" is null) desc, "DT_INCLUSAO"
    limit 1;
  end if;

  if v_person."SQ_PESSOA" is null then
    select p.* into v_person
    from sigav."TB_IDENTIDADE_ACESSO" pai
    join sigav."TB_PESSOA" p on p."SQ_PESSOA" = pai."SQ_PESSOA"
    where lower(pai."NO_EMAIL") = v_email
      and pai."ST_SITUACAO" in ('PENDING','ACTIVE')
      and p."ST_ATIVO"
      and (target_employee_number is null or p."CO_MATRICULA" = btrim(target_employee_number))
    order by pai."ST_SITUACAO" = 'ACTIVE' desc, pai."DT_INCLUSAO"
    limit 1;
  end if;

  if v_person."SQ_PESSOA" is null then
    v_employee := 'AUTH-' || upper(substr(replace(v_auth::text,'-',''),1,20));
    insert into sigav."TB_PESSOA"(
      "SQ_USUARIO_IDENTIDADE", "CO_MATRICULA", "NO_PESSOA", "DS_EMAIL_INSTITUCIONAL",
      "ST_VINCULO", "ST_ATIVO", "CO_SISTEMA_ORIGEM", "CO_CHAVE_ORIGEM", "DS_METADADO"
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
    if v_person."SQ_USUARIO_IDENTIDADE" is not null and v_person."SQ_USUARIO_IDENTIDADE" <> v_auth then
      return jsonb_build_object('status','ALREADY_LINKED','message','Este cadastro já está vinculado a outra conta autenticada.');
    end if;

    update sigav."TB_PESSOA"
    set "SQ_USUARIO_IDENTIDADE" = v_auth,
        "DS_EMAIL_INSTITUCIONAL" = coalesce(nullif(btrim("DS_EMAIL_INSTITUCIONAL"),''),v_email),
        "NO_PESSOA" = case
          when "CO_SISTEMA_ORIGEM" = 'SUPABASE_AUTH' and v_name is not null then v_name
          else "NO_PESSOA"
        end,
        "DS_METADADO" = coalesce("DS_METADADO",'{}'::jsonb)
          || case when v_avatar is null then '{}'::jsonb else jsonb_build_object('google_avatar_url',v_avatar) end
          || case
               when v_avatar is not null and coalesce("DS_METADADO"->>'avatar_source','') not in ('UPLOADED','GENERATED')
                 then jsonb_build_object('avatar_url',v_avatar,'avatar_source','GOOGLE')
               else '{}'::jsonb
             end,
        "DT_ALTERACAO" = timezone('utc',now())
    where "SQ_PESSOA" = v_person."SQ_PESSOA"
    returning * into v_person;
  end if;

  insert into sigav."TB_IDENTIDADE_ACESSO"(
    "SQ_PESSOA", "TP_IDENTIDADE", "NO_EMAIL", "ST_SITUACAO", "NO_ORIGEM", "DT_VERIFICACAO", "DS_METADADO"
  ) values (
    v_person."SQ_PESSOA", 'INSTITUTIONAL_EMAIL', v_email, 'ACTIVE', 'SUPABASE_AUTH', timezone('utc',now()),
    jsonb_build_object('auth_user_id',v_auth)
  )
  on conflict("SQ_PESSOA","TP_IDENTIDADE","NO_EMAIL") do update
  set "ST_SITUACAO"='ACTIVE',
      "DT_VERIFICACAO"=coalesce(sigav."TB_IDENTIDADE_ACESSO"."DT_VERIFICACAO",excluded."DT_VERIFICACAO"),
      "DT_REVOGACAO"=null,
      "DT_ALTERACAO"=timezone('utc',now());

  return jsonb_build_object(
    'status','OK',
    'person',jsonb_build_object(
      'id',v_person."SQ_PESSOA",
      'employeeNumber',v_person."CO_MATRICULA",
      'fullName',v_person."NO_PESSOA",
      'institutionalEmail',v_person."DS_EMAIL_INSTITUCIONAL",
      'jobTitle',v_person."NO_CARGO",
      'costCenter',v_person."CO_CENTRO_CUSTO",
      'workplace',v_person."NO_LOCAL_TRABALHO",
      'metadata',v_person."DS_METADADO",
      'avatarUrl',coalesce(v_person."DS_METADADO"->>'avatar_url',v_person."DS_METADADO"->>'picture',v_person."DS_METADADO"->>'photo_url')
    )
  );
end
$function$;

-- FC_RESOLVER_PUBLICO_AVALIACAO(p_regra jsonb)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    select valor::uuid as "SQ_PESSOA"
    from regra, jsonb_array_elements_text(regra.incluidas) as item(valor)
  ),
  ids_excluidos as (
    select valor::uuid as "SQ_PESSOA"
    from regra, jsonb_array_elements_text(regra.excluidas) as item(valor)
  ),
  por_filtro as (
    select p."SQ_PESSOA"
    from sigav."TB_PESSOA" p, regra r, algum_filtro af
    where p."ST_ATIVO"
      and (
        r.todas
        or (
          af.ha
          and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p."DS_METADADO" ->> 'directorate',  r.filtros -> 'directorate')
          and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p."DS_METADADO" ->> 'unit',         r.filtros -> 'unit')
          and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p."DS_METADADO" ->> 'coordination', r.filtros -> 'coordination')
          and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p."CO_CENTRO_CUSTO",                 r.filtros -> 'costCenter')
          and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p."NO_CARGO",                   r.filtros -> 'jobTitle')
        )
      )
  ),
  -- Inclusão individual é adicional ao filtro, mas não é passe livre: a
  -- elegibilidade é a mesma para todo mundo. Quem for incluído e não estiver
  -- ativo simplesmente não entra, e a prévia informa quantos foram nesse caso.
  por_inclusao as (
    select p."SQ_PESSOA"
    from sigav."TB_PESSOA" p
    where p."ST_ATIVO"
      and p."SQ_PESSOA" in (select "SQ_PESSOA" from ids_incluidos)
  ),
  reunidas as (
    select "SQ_PESSOA", 'FILTRO' as origem from por_filtro
    union all
    select "SQ_PESSOA", 'INCLUSAO' from por_inclusao
  )
  select
    r."SQ_PESSOA",
    -- 'FILTRO' < 'INCLUSAO' na ordenação de texto: quem casou com o filtro é
    -- reportado como tal mesmo que também tenha sido incluído à mão.
    min(r.origem),
    bool_or(r."SQ_PESSOA" in (select "SQ_PESSOA" from ids_excluidos))
  from reunidas r
  group by r."SQ_PESSOA";
end;
$function$;

-- FC_RESUMO_BASE_PESSOAS(target_application_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
     and not exists(select 1 from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  return (
    select jsonb_build_object(
      'totalPeople', count(*),
      'activePeople', count(*) filter(where p."ST_ATIVO" and upper(btrim(coalesce(p."ST_VINCULO",''))) in ('ATIVO','NORMAL')),
      'inactivePeople', count(*) filter(where not p."ST_ATIVO" or upper(btrim(coalesce(p."ST_VINCULO",''))) not in ('ATIVO','NORMAL')),
      'withInstitutionalEmail', count(*) filter(where nullif(btrim(coalesce(p."DS_EMAIL_INSTITUCIONAL",'')),'') is not null),
      'withoutInstitutionalEmail', count(*) filter(where nullif(btrim(coalesce(p."DS_EMAIL_INSTITUCIONAL",'')),'') is null),
      'authenticatedPeople', count(*) filter(where p."SQ_USUARIO_IDENTIDADE" is not null),
      'withChosenAvatar', count(*) filter(where coalesce(p."DS_METADADO"->>'avatar_source','') in ('UPLOADED','GENERATED')),
      'linkedToApplication', count(*) filter(where ap."SQ_PARTICIPANTE" is not null and ap."ST_SITUACAO" <> 'EXCLUDED'),
      'availableToLink', count(*) filter(
        where p."ST_ATIVO"
          and upper(btrim(coalesce(p."ST_VINCULO",''))) in ('ATIVO','NORMAL')
          and (target_application_id is null or ap."SQ_PARTICIPANTE" is null or ap."ST_SITUACAO" = 'EXCLUDED')
      )
    )
    from sigav."TB_PESSOA" p
    left join sigav."RL_APLICACAO_PESSOA" ap
      on target_application_id is not null
     and ap."SQ_APLICACAO" = target_application_id
     and ap."SQ_PESSOA" = p."SQ_PESSOA"
     and ap."TP_PARTICIPANTE" = 'RESPONDENT'
  );
end;
$function$;

-- FC_SALVAR_REGRA_CONDICIONAL(p_alvo_tipo text, p_alvo uuid, p_acao text, p_conector text, p_condicoes jsonb, p_descricao text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    select pergunta."SQ_VERSAO_PESQUISA" into v_versao
    from sigav."TB_PERGUNTA_PESQUISA" as pergunta where pergunta."SQ_PERGUNTA" = p_alvo;
  else
    select secao."SQ_VERSAO_PESQUISA" into v_versao
    from sigav."TB_SECAO_PESQUISA" as secao where secao."SQ_SECAO" = p_alvo;
  end if;
  if v_versao is null then
    raise exception 'Pergunta ou seção não localizada.';
  end if;

  -- Regra é estrutura do instrumento: muda enquanto a versão é rascunho, como
  -- seção e pergunta. Depois de publicada, alterar a lógica mudaria o que já foi
  -- respondido por quem já respondeu.
  select "ST_SITUACAO" into v_status from sigav."TH_VERSAO_PESQUISA" where "SQ_VERSAO_PESQUISA" = v_versao;
  if v_status <> 'DRAFT' then
    raise exception 'A lógica condicional só pode ser alterada enquanto a versão está em rascunho.';
  end if;

  -- Origens propostas, validadas antes de gravar: pergunta precisa existir, ser
  -- da mesma versão e não ser o próprio alvo.
  for v_condicao in select "DS_VALOR" from jsonb_array_elements(coalesce(p_condicoes, '[]'::jsonb)) loop
    v_origem := nullif(btrim(coalesce(v_condicao->>'questionId', '')), '')::uuid;
    v_operador := upper(btrim(coalesce(v_condicao->>'operator', '')));
    if v_origem is null then
      raise exception 'Toda condição precisa apontar uma pergunta de origem.';
    end if;
    if not exists (
      select 1 from sigav."TB_PERGUNTA_PESQUISA"
      where "SQ_PERGUNTA" = v_origem and "SQ_VERSAO_PESQUISA" = v_versao
    ) then
      raise exception 'A pergunta de origem não pertence a esta versão da avaliação.';
    end if;
    if v_origem = p_alvo then
      raise exception 'Uma pergunta não pode condicionar a si mesma.';
    end if;
    if v_operador in ('SELECTED', 'NOT_SELECTED') and not exists (
      select 1 from sigav."TB_OPCAO_PERGUNTA"
      where "SQ_OPCAO" = nullif(btrim(coalesce(v_condicao->>'optionId', '')), '')::uuid
        and "SQ_PERGUNTA" = v_origem
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
  delete from sigav."TB_REGRA_CONDICIONAL" where "SQ_ALVO" = p_alvo;

  insert into sigav."TB_REGRA_CONDICIONAL" (
    "SQ_VERSAO_PESQUISA", "TP_ALVO", "SQ_ALVO", "TP_ACAO", "TP_CONECTOR", "DS_REGRA", "AU_USUARIO_INCLUSAO"
  ) values (
    v_versao, v_tipo, p_alvo, v_acao, v_conector, nullif(btrim(coalesce(p_descricao, '')), ''), v_pessoa
  ) returning "SQ_REGRA" into v_regra;

  for v_condicao in select "DS_VALOR" from jsonb_array_elements(coalesce(p_condicoes, '[]'::jsonb)) loop
    v_ordem := v_ordem + 1;
    v_operador := upper(btrim(coalesce(v_condicao->>'operator', '')));
    insert into sigav."TB_CONDICAO_REGRA" (
      "SQ_REGRA", "SQ_PERGUNTA_ORIGEM", "TP_OPERADOR", "SQ_OPCAO", "DS_VALOR", "NU_VALOR", "NU_ORDEM"
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
    "SQ_PESSOA_ATOR", "TP_EVENTO", "TP_ENTIDADE", "CO_ENTIDADE", "DS_DADO_POSTERIOR", "DS_METADADO"
  ) values (
    v_pessoa, 'SURVEY_RULE_SAVED', 'CONDITIONAL_RULE', v_regra::text,
    jsonb_build_object('target', p_alvo, 'action', v_acao, 'connector', v_conector),
    '{}'::jsonb
  );

  return jsonb_build_object('status', 'OK', 'ruleId', v_regra, 'conditions', v_ordem);
end;
$function$;

-- FC_SALVAR_RESPOSTA_CDDI(target_submission_id uuid, target_question_id uuid, target_option_id uuid, target_text text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where s."SQ_SUBMISSAO" = target_submission_id
  for update;

  if not found
    or v_submission."SQ_PESSOA_RESPONDENTE" is distinct from v_person_id
    or v_submission."ST_SITUACAO" <> 'DRAFT' then
    raise exception 'O rascunho não está disponível para edição.';
  end if;

  if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_submission."SQ_APLICACAO") then
    raise exception 'O período de respostas está encerrado.';
  end if;

  select sa."SQ_VERSAO_PESQUISA"
    into v_survey_version_id
  from sigav."TB_APLICACAO_PESQUISA" sa
  where sa."SQ_APLICACAO" = v_submission."SQ_APLICACAO";

  select q.*
    into v_question
  from sigav."TB_PERGUNTA_PESQUISA" q
  where q."SQ_PERGUNTA" = target_question_id
    and q."SQ_VERSAO_PESQUISA" = v_survey_version_id;

  if not found then
    raise exception 'Pergunta inválida para esta aplicação.';
  end if;

  if v_question."TP_PERGUNTA" = 'SCALE' then
    if target_option_id is null then
      raise exception 'Selecione uma alternativa da escala.';
    end if;

    select qo.*
      into v_option
    from sigav."TB_OPCAO_PERGUNTA" qo
    where qo."SQ_OPCAO" = target_option_id
      and qo."SQ_PERGUNTA" = v_question."SQ_PERGUNTA"
      and qo."ST_ATIVO" = true;

    if not found then
      raise exception 'Alternativa inválida para esta pergunta.';
    end if;

    v_numeric := coalesce(
      v_option."VL_NOTA",
      case
        when v_option."DS_VALOR" ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$'
          then v_option."DS_VALOR"::numeric
        else null
      end
    );

    insert into sigav."TB_RESPOSTA" (
      "SQ_SUBMISSAO",
      "SQ_PERGUNTA",
      "DS_RESPOSTA",
      "NU_RESPOSTA",
      "ST_RESPOSTA",
      "DT_RESPOSTA",
      "DT_HORA_RESPOSTA",
      "DS_RESPOSTA_JSON",
      "VL_NOTA"
    ) values (
      v_submission."SQ_SUBMISSAO",
      v_question."SQ_PERGUNTA",
      null,
      v_numeric,
      null,
      null,
      null,
      null,
      v_numeric
    )
    on conflict ("SQ_SUBMISSAO", "SQ_PERGUNTA") do update
      set "DS_RESPOSTA" = null,
          "NU_RESPOSTA" = excluded."NU_RESPOSTA",
          "ST_RESPOSTA" = null,
          "DT_RESPOSTA" = null,
          "DT_HORA_RESPOSTA" = null,
          "DS_RESPOSTA_JSON" = null,
          "VL_NOTA" = excluded."VL_NOTA",
          "DT_ALTERACAO" = now()
    returning "SQ_RESPOSTA" into v_answer_id;

    delete from sigav."RL_RESPOSTA_OPCAO" where "SQ_RESPOSTA" = v_answer_id;
    insert into sigav."RL_RESPOSTA_OPCAO" ("SQ_RESPOSTA", "SQ_OPCAO", "NU_ORDEM")
    values (v_answer_id, v_option."SQ_OPCAO", 1);

  elsif v_question."TP_PERGUNTA" in ('SHORT_TEXT', 'LONG_TEXT') then
    v_text := nullif(btrim(coalesce(target_text, '')), '');

    if length(coalesce(v_text, '')) > 12000 then
      raise exception 'O texto excede o limite de 12.000 caracteres.';
    end if;

    if v_text is null then
      delete from sigav."TB_RESPOSTA"
      where "SQ_SUBMISSAO" = v_submission."SQ_SUBMISSAO"
        and "SQ_PERGUNTA" = v_question."SQ_PERGUNTA";
    else
      insert into sigav."TB_RESPOSTA" (
        "SQ_SUBMISSAO",
        "SQ_PERGUNTA",
        "DS_RESPOSTA",
        "NU_RESPOSTA",
        "ST_RESPOSTA",
        "DT_RESPOSTA",
        "DT_HORA_RESPOSTA",
        "DS_RESPOSTA_JSON",
        "VL_NOTA"
      ) values (
        v_submission."SQ_SUBMISSAO",
        v_question."SQ_PERGUNTA",
        v_text,
        null,
        null,
        null,
        null,
        null,
        null
      )
      on conflict ("SQ_SUBMISSAO", "SQ_PERGUNTA") do update
        set "DS_RESPOSTA" = excluded."DS_RESPOSTA",
            "NU_RESPOSTA" = null,
            "ST_RESPOSTA" = null,
            "DT_RESPOSTA" = null,
            "DT_HORA_RESPOSTA" = null,
            "DS_RESPOSTA_JSON" = null,
            "VL_NOTA" = null,
            "DT_ALTERACAO" = now()
      returning "SQ_RESPOSTA" into v_answer_id;

      delete from sigav."RL_RESPOSTA_OPCAO" where "SQ_RESPOSTA" = v_answer_id;
    end if;
  else
    raise exception 'Tipo de pergunta ainda não suportado pelo formulário CDDI.';
  end if;

  update sigav."TB_SUBMISSAO"
  set "DS_METADADO" = "DS_METADADO" || jsonb_build_object('last_saved_at', now())
  where "SQ_SUBMISSAO" = v_submission."SQ_SUBMISSAO";

  return jsonb_build_object(
    'status', 'OK',
    'savedAt', now()
  );
end;
$function$;

-- FC_SALVAR_RESPOSTA_PESQUISA(target_submission_id uuid, target_question_id uuid, target_option_ids uuid[], target_text text, target_number numeric, target_boolean boolean, target_date date, target_datetime timestamp with time zone, target_json jsonb)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where "SQ_SUBMISSAO" = target_submission_id
  for update;

  if v_submission."SQ_SUBMISSAO" is null
     or v_submission."SQ_PESSOA_RESPONDENTE" is distinct from v_person_id
     or v_submission."ST_SITUACAO" <> 'DRAFT' then
    raise exception 'O rascunho não está disponível para edição.';
  end if;

  if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_submission."SQ_APLICACAO") then
    raise exception 'O período de respostas está encerrado.';
  end if;

  select "SQ_VERSAO_PESQUISA" into v_version_id
  from sigav."TB_APLICACAO_PESQUISA"
  where "SQ_APLICACAO" = v_submission."SQ_APLICACAO";

  select * into v_question
  from sigav."TB_PERGUNTA_PESQUISA"
  where "SQ_PERGUNTA" = target_question_id
    and "SQ_VERSAO_PESQUISA" = v_version_id;

  if v_question."SQ_PERGUNTA" is null then raise exception 'Pergunta inválida para esta pesquisa.'; end if;

  if v_question."TP_PERGUNTA" in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE') then
    select coalesce(array_agg(distinct option_id), '{}'::uuid[])
    into v_option_ids
    from unnest(coalesce(target_option_ids, '{}'::uuid[])) option_id;

    if coalesce(array_length(v_option_ids, 1), 0) = 0 then
      delete from sigav."TB_RESPOSTA" where "SQ_SUBMISSAO" = v_submission."SQ_SUBMISSAO" and "SQ_PERGUNTA" = v_question."SQ_PERGUNTA";
    else
      if v_question."TP_PERGUNTA" in ('SCALE','SINGLE_CHOICE') and array_length(v_option_ids, 1) <> 1 then
        raise exception 'Selecione apenas uma alternativa.';
      end if;

      select count(*) into v_invalid_options
      from unnest(v_option_ids) selected_id
      left join sigav."TB_OPCAO_PERGUNTA" qo
        on qo."SQ_OPCAO" = selected_id
       and qo."SQ_PERGUNTA" = v_question."SQ_PERGUNTA"
       and qo."ST_ATIVO" = true
      where qo."SQ_OPCAO" is null;

      if v_invalid_options > 0 then raise exception 'Uma ou mais alternativas são inválidas.'; end if;

      insert into sigav."TB_RESPOSTA"("SQ_SUBMISSAO", "SQ_PERGUNTA")
      values(v_submission."SQ_SUBMISSAO", v_question."SQ_PERGUNTA")
      on conflict ("SQ_SUBMISSAO", "SQ_PERGUNTA") do update set
        "DS_RESPOSTA" = null,
        "NU_RESPOSTA" = null,
        "ST_RESPOSTA" = null,
        "DT_RESPOSTA" = null,
        "DT_HORA_RESPOSTA" = null,
        "DS_RESPOSTA_JSON" = null,
        "VL_NOTA" = null,
        "DT_ALTERACAO" = now()
      returning "SQ_RESPOSTA" into v_answer_id;

      delete from sigav."RL_RESPOSTA_OPCAO" where "SQ_RESPOSTA" = v_answer_id;
      insert into sigav."RL_RESPOSTA_OPCAO"("SQ_RESPOSTA", "SQ_OPCAO", "NU_ORDEM")
      select v_answer_id, option_id, row_number() over (order by option_id)::integer
      from unnest(v_option_ids) option_id;
    end if;
  elsif v_question."TP_PERGUNTA" in ('SHORT_TEXT','LONG_TEXT') then
    v_text := nullif(btrim(coalesce(target_text, '')), '');
    if length(coalesce(v_text, '')) > 12000 then raise exception 'O texto excede o limite de 12.000 caracteres.'; end if;
    if v_text is null then
      delete from sigav."TB_RESPOSTA" where "SQ_SUBMISSAO" = v_submission."SQ_SUBMISSAO" and "SQ_PERGUNTA" = v_question."SQ_PERGUNTA";
    else
      insert into sigav."TB_RESPOSTA"("SQ_SUBMISSAO", "SQ_PERGUNTA", "DS_RESPOSTA")
      values(v_submission."SQ_SUBMISSAO", v_question."SQ_PERGUNTA", v_text)
      on conflict ("SQ_SUBMISSAO", "SQ_PERGUNTA") do update set
        "DS_RESPOSTA" = excluded."DS_RESPOSTA",
        "NU_RESPOSTA" = null,
        "ST_RESPOSTA" = null,
        "DT_RESPOSTA" = null,
        "DT_HORA_RESPOSTA" = null,
        "DS_RESPOSTA_JSON" = null,
        "VL_NOTA" = null,
        "DT_ALTERACAO" = now();
    end if;
  elsif v_question."TP_PERGUNTA" in ('INTEGER','DECIMAL') then
    if target_number is null then
      delete from sigav."TB_RESPOSTA" where "SQ_SUBMISSAO" = v_submission."SQ_SUBMISSAO" and "SQ_PERGUNTA" = v_question."SQ_PERGUNTA";
    else
      if v_question."TP_PERGUNTA" = 'INTEGER' and target_number <> trunc(target_number) then
        raise exception 'Informe um número inteiro.';
      end if;
      insert into sigav."TB_RESPOSTA"("SQ_SUBMISSAO", "SQ_PERGUNTA", "NU_RESPOSTA")
      values(v_submission."SQ_SUBMISSAO", v_question."SQ_PERGUNTA", target_number)
      on conflict ("SQ_SUBMISSAO", "SQ_PERGUNTA") do update set
        "DS_RESPOSTA" = null,
        "NU_RESPOSTA" = excluded."NU_RESPOSTA",
        "ST_RESPOSTA" = null,
        "DT_RESPOSTA" = null,
        "DT_HORA_RESPOSTA" = null,
        "DS_RESPOSTA_JSON" = null,
        "VL_NOTA" = null,
        "DT_ALTERACAO" = now();
    end if;
  elsif v_question."TP_PERGUNTA" = 'BOOLEAN' then
    if target_boolean is null then
      delete from sigav."TB_RESPOSTA" where "SQ_SUBMISSAO" = v_submission."SQ_SUBMISSAO" and "SQ_PERGUNTA" = v_question."SQ_PERGUNTA";
    else
      insert into sigav."TB_RESPOSTA"("SQ_SUBMISSAO", "SQ_PERGUNTA", "ST_RESPOSTA")
      values(v_submission."SQ_SUBMISSAO", v_question."SQ_PERGUNTA", target_boolean)
      on conflict ("SQ_SUBMISSAO", "SQ_PERGUNTA") do update set
        "DS_RESPOSTA" = null,
        "NU_RESPOSTA" = null,
        "ST_RESPOSTA" = excluded."ST_RESPOSTA",
        "DT_RESPOSTA" = null,
        "DT_HORA_RESPOSTA" = null,
        "DS_RESPOSTA_JSON" = null,
        "VL_NOTA" = null,
        "DT_ALTERACAO" = now();
    end if;
  elsif v_question."TP_PERGUNTA" = 'DATE' then
    if target_date is null then
      delete from sigav."TB_RESPOSTA" where "SQ_SUBMISSAO" = v_submission."SQ_SUBMISSAO" and "SQ_PERGUNTA" = v_question."SQ_PERGUNTA";
    else
      insert into sigav."TB_RESPOSTA"("SQ_SUBMISSAO", "SQ_PERGUNTA", "DT_RESPOSTA")
      values(v_submission."SQ_SUBMISSAO", v_question."SQ_PERGUNTA", target_date)
      on conflict ("SQ_SUBMISSAO", "SQ_PERGUNTA") do update set
        "DS_RESPOSTA" = null,
        "NU_RESPOSTA" = null,
        "ST_RESPOSTA" = null,
        "DT_RESPOSTA" = excluded."DT_RESPOSTA",
        "DT_HORA_RESPOSTA" = null,
        "DS_RESPOSTA_JSON" = null,
        "VL_NOTA" = null,
        "DT_ALTERACAO" = now();
    end if;
  elsif v_question."TP_PERGUNTA" = 'DATETIME' then
    if target_datetime is null then
      delete from sigav."TB_RESPOSTA" where "SQ_SUBMISSAO" = v_submission."SQ_SUBMISSAO" and "SQ_PERGUNTA" = v_question."SQ_PERGUNTA";
    else
      insert into sigav."TB_RESPOSTA"("SQ_SUBMISSAO", "SQ_PERGUNTA", "DT_HORA_RESPOSTA")
      values(v_submission."SQ_SUBMISSAO", v_question."SQ_PERGUNTA", target_datetime)
      on conflict ("SQ_SUBMISSAO", "SQ_PERGUNTA") do update set
        "DS_RESPOSTA" = null,
        "NU_RESPOSTA" = null,
        "ST_RESPOSTA" = null,
        "DT_RESPOSTA" = null,
        "DT_HORA_RESPOSTA" = excluded."DT_HORA_RESPOSTA",
        "DS_RESPOSTA_JSON" = null,
        "VL_NOTA" = null,
        "DT_ALTERACAO" = now();
    end if;
  else
    raise exception 'Tipo de pergunta ainda não suportado: %.', v_question."TP_PERGUNTA";
  end if;

  update sigav."TB_SUBMISSAO"
  set "DS_METADADO" = coalesce("DS_METADADO", '{}'::jsonb) || jsonb_build_object('last_saved_at', now()),
      "DT_ALTERACAO" = now()
  where "SQ_SUBMISSAO" = v_submission."SQ_SUBMISSAO";

  return jsonb_build_object('status', 'OK', 'savedAt', now());
end;
$function$;

-- FC_SAUDE_PLATAFORMA()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    join sigav."TH_VERSAO_PESQUISA" sv on sv."SQ_VERSAO_PESQUISA"=sa."SQ_VERSAO_PESQUISA"
    where sa."ST_SITUACAO" in ('OPEN','SCHEDULED') and sv."ST_SITUACAO" <> 'PUBLISHED'
  ) then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object('severity','BLOCKING','message','Existe ciclo ativo com versão não publicada.'));
  end if;

  if exists (
    select 1 from sigav."TB_APLICACAO_PESQUISA"
    where "ST_SITUACAO" in ('OPEN','SCHEDULED') and ("DT_ABERTURA" is null or "DT_ENCERRAMENTO" is null or "DT_ENCERRAMENTO" <= "DT_ABERTURA")
  ) then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object('severity','BLOCKING','message','Existe ciclo ativo com período inválido.'));
  end if;

  if exists (
    select 1 from sigav."TB_APLICACAO_PESQUISA" sa
    where sa."ST_SITUACAO"='OPEN'
      and not exists (select 1 from sigav."RL_APLICACAO_PESSOA" ap where ap."SQ_APLICACAO"=sa."SQ_APLICACAO" and ap."ST_SITUACAO" not in ('BLOCKED','EXCLUDED'))
  ) then
    v_issues := v_issues || jsonb_build_array(jsonb_build_object('severity','WARNING','message','Existe ciclo aberto sem participantes elegíveis.'));
  end if;

  return jsonb_build_object(
    'status',case when jsonb_array_length(v_issues)=0 then 'HEALTHY' else 'ATTENTION' end,
    'checkedAt',now(),
    'people',(select count(*) from sigav."TB_PESSOA" where "ST_ATIVO"=true),
    'surveys',(select count(*) from sigav."TB_PESQUISA"),
    'applications',(select count(*) from sigav."TB_APLICACAO_PESQUISA"),
    'openApplications',(select count(*) from sigav."TB_APLICACAO_PESQUISA" where "ST_SITUACAO"='OPEN'),
    'scheduledApplications',(select count(*) from sigav."TB_APLICACAO_PESQUISA" where "ST_SITUACAO"='SCHEDULED'),
    'participants',(select count(*) from sigav."RL_APLICACAO_PESSOA" where "ST_SITUACAO" not in ('BLOCKED','EXCLUDED')),
    'submissions',(select count(*) from sigav."TB_SUBMISSAO"),
    'draftSubmissions',(select count(*) from sigav."TB_SUBMISSAO" where "ST_SITUACAO"='DRAFT'),
    'submittedSubmissions',(select count(*) from sigav."TB_SUBMISSAO" where "ST_SITUACAO" in ('SUBMITTED','VALIDATED')),
    'activeLeaders',(select count(distinct "SQ_PESSOA_LIDER") from sigav."RT_LIDERANCA_CDDI" where "ST_SITUACAO"='ACTIVE' and "DT_FIM_VIGENCIA" is null),
    'issues',v_issues
  );
end;
$function$;

-- FC_SINCRONIZAR_ESTADO_CICLOS()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    select sa."SQ_APLICACAO", sa."CO_APLICACAO", sa."ST_SITUACAO" as status_anterior, sa."DT_ABERTURA", sa."DT_ENCERRAMENTO"
    from sigav."TB_APLICACAO_PESQUISA" sa
    where sa."DT_ENCERRAMENTO" is not null
      and sa."DT_ENCERRAMENTO" <= now()
      and sa."ST_SITUACAO" in ('OPEN', 'SCHEDULED')
    for update skip locked
  ), fechados as (
    update sigav."TB_APLICACAO_PESQUISA" sa
    set "ST_SITUACAO" = 'CLOSED',
        "DT_ALTERACAO" = now()
    from alvos
    where sa."SQ_APLICACAO" = alvos."SQ_APLICACAO"
    returning sa."SQ_APLICACAO", sa."CO_APLICACAO", alvos.status_anterior, sa."DT_ABERTURA", sa."DT_ENCERRAMENTO"
  )
  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR", "TP_EVENTO", "TP_ENTIDADE", "CO_ENTIDADE", "SQ_APLICACAO",
    "DS_DADO_ANTERIOR", "DS_DADO_POSTERIOR", "DS_METADADO"
  )
  select
    -- Não houve ator humano. Registrar um seria inventar responsável.
    null,
    'SURVEY_CYCLE_AUTO_CLOSE',
    'SURVEY_APPLICATION',
    fechados."SQ_APLICACAO"::text,
    fechados."SQ_APLICACAO",
    jsonb_build_object('applicationStatus', fechados.status_anterior),
    jsonb_build_object('applicationStatus', 'CLOSED'),
    jsonb_build_object(
      'applicationCode', fechados."CO_APLICACAO",
      'opensAt', fechados."DT_ABERTURA",
      'closesAt', fechados."DT_ENCERRAMENTO",
      'reason', 'closes_at_reached'
    )
  from fechados;

  -- 2. Abrir o que chegou a hora. Lógica preservada de
  -- `FC_ABRIR_CICLOS_AGENDADOS()` sem alteração de comportamento.
  with abertos as (
    update sigav."TB_APLICACAO_PESQUISA" sa
    set "ST_SITUACAO" = 'OPEN',
        "DT_ALTERACAO" = now()
    where sa."ST_SITUACAO" = 'SCHEDULED'
      and sa."DT_ABERTURA" is not null
      and sa."DT_ABERTURA" <= now()
      and sa."DT_ENCERRAMENTO" is not null
      and sa."DT_ENCERRAMENTO" > now()
      and exists (
        select 1
        from sigav."TH_VERSAO_PESQUISA" sv
        where sv."SQ_VERSAO_PESQUISA" = sa."SQ_VERSAO_PESQUISA"
          and sv."ST_SITUACAO" = 'PUBLISHED'
      )
    returning sa."SQ_APLICACAO", sa."CO_APLICACAO", sa."SQ_VERSAO_PESQUISA", sa."DT_ABERTURA", sa."DT_ENCERRAMENTO"
  )
  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR", "TP_EVENTO", "TP_ENTIDADE", "CO_ENTIDADE", "SQ_APLICACAO",
    "DS_DADO_ANTERIOR", "DS_DADO_POSTERIOR", "DS_METADADO"
  )
  select
    null,
    'SURVEY_CYCLE_AUTO_OPEN',
    'SURVEY_APPLICATION',
    abertos."SQ_APLICACAO"::text,
    abertos."SQ_APLICACAO",
    jsonb_build_object('applicationStatus', 'SCHEDULED'),
    jsonb_build_object('applicationStatus', 'OPEN'),
    jsonb_build_object(
      'applicationCode', abertos."CO_APLICACAO",
      'versionId', abertos."SQ_VERSAO_PESQUISA",
      'opensAt', abertos."DT_ABERTURA",
      'closesAt', abertos."DT_ENCERRAMENTO",
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
    where sa."SQ_APLICACAO" = b."SQ_APLICACAO"
      and (
        sa."ST_SITUACAO" in ('CLOSED', 'CANCELLED')
        or (sa."DT_ENCERRAMENTO" is not null and sa."DT_ENCERRAMENTO" <= now())
      )
    returning b."SQ_APLICACAO"
  ), totais as (
    select "SQ_APLICACAO", count(*)::integer as quantidade
    from purgados
    group by "SQ_APLICACAO"
  )
  insert into sigav."TL_EVENTO_AUDITORIA"(
    "SQ_PESSOA_ATOR", "TP_EVENTO", "TP_ENTIDADE", "CO_ENTIDADE", "SQ_APLICACAO",
    "DS_DADO_ANTERIOR", "DS_DADO_POSTERIOR", "DS_METADADO"
  )
  select
    null,
    'ANONYMOUS_TICKET_PURGED',
    'SURVEY_APPLICATION',
    totais."SQ_APLICACAO"::text,
    totais."SQ_APLICACAO",
    '{}'::jsonb,
    '{}'::jsonb,
    -- Só a contagem. Registrar a pessoa aqui desfaria a purga no próprio log.
    jsonb_build_object('ticketsPurged', totais.quantidade, 'reason', 'cycle_closed')
  from totais;
end;
$function$;

-- FC_SINCR_AVATAR_GOOGLE()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
    nullif(btrim("DS_DADO_IDENTIDADE"->>'picture'), ''),
    nullif(btrim("DS_DADO_IDENTIDADE"->>'avatar_url'), '')
  )
  into v_picture
  from sigav."TB_IDENTIDADE_OAUTH"
  where "SQ_USUARIO" = v_user_id
    and "NO_PROVEDOR" = 'google'
  order by "DT_ULTIMO_ACESSO" desc nulls last
  limit 1;

  select "SQ_PESSOA" into v_person_id
  from sigav."TB_PESSOA"
  where "SQ_USUARIO_IDENTIDADE" = v_user_id
  limit 1;

  if v_person_id is null then
    return jsonb_build_object('status', 'UNLINKED', 'googleAvatarUrl', v_picture);
  end if;

  update sigav."TB_PESSOA"
  set "DS_METADADO" = (
        coalesce("DS_METADADO", '{}'::jsonb)
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
      "DT_ALTERACAO" = timezone('utc', now())
  where "SQ_PESSOA" = v_person_id
    and (
      nullif(btrim(coalesce("DS_METADADO"->>'avatar_url', '')), '') is distinct from v_picture
      or nullif(btrim(coalesce("DS_METADADO"->>'google_avatar_url', '')), '') is distinct from v_picture
      or coalesce("DS_METADADO"->>'avatar_source', '') is distinct from case when v_picture is null then '' else 'GOOGLE' end
      or "DS_METADADO" ? 'avatar_config'
    );

  return jsonb_build_object('status', 'OK', 'googleAvatarUrl', v_picture);
end;
$function$;

-- FC_SINCR_LINHAS_BASE_PESSOA(p_rows jsonb, p_batch_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  select "SQ_APLICACAO" into v_application_id from sigav."TB_APLICACAO_PESQUISA" where "CO_APLICACAO"='CDDI-2026' limit 1;

  for v_row in select "DS_VALOR" from jsonb_array_elements(p_rows)
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

    select * into v_person from sigav."TB_PESSOA" p where p."CO_MATRICULA"=v_employee or (v_email<>'' and lower(btrim(coalesce(p."DS_EMAIL_INSTITUCIONAL",'')))=v_email) order by (p."CO_MATRICULA"=v_employee) desc,(p."SQ_USUARIO_IDENTIDADE" is not null) desc,p."DT_INCLUSAO" limit 1 for update;
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

    if v_person."SQ_PESSOA" is null then
      insert into sigav."TB_PESSOA"("CO_MATRICULA","NO_PESSOA","DS_EMAIL_INSTITUCIONAL","NO_CARGO","CO_CENTRO_CUSTO","NO_LOCAL_TRABALHO","ST_VINCULO","ST_ATIVO","CO_SISTEMA_ORIGEM","CO_CHAVE_ORIGEM","DS_METADADO")
      values(v_employee,btrim(v_row->>'fullName'),nullif(v_email,''),nullif(btrim(coalesce(v_row->>'jobTitle','')),''),nullif(btrim(coalesce(v_row->>'costCenter','')),''),nullif(btrim(coalesce(v_row->>'workplace','')),''),coalesce(nullif(v_status,''),'ATIVO'),v_active,'AGSUS_PEOPLE_BASE',coalesce(v_source_key,v_employee),v_import_metadata)
      returning * into v_person; v_inserted:=v_inserted+1;
    else
      update sigav."TB_PESSOA" set "CO_MATRICULA"=v_employee,"NO_PESSOA"=btrim(v_row->>'fullName'),"DS_EMAIL_INSTITUCIONAL"=coalesce(nullif(v_email,''),"DS_EMAIL_INSTITUCIONAL"),"NO_CARGO"=nullif(btrim(coalesce(v_row->>'jobTitle','')),''),"CO_CENTRO_CUSTO"=nullif(btrim(coalesce(v_row->>'costCenter','')),''),"NO_LOCAL_TRABALHO"=nullif(btrim(coalesce(v_row->>'workplace','')),''),"ST_VINCULO"=coalesce(nullif(v_status,''),"ST_VINCULO",'ATIVO'),"ST_ATIVO"=v_active,"CO_SISTEMA_ORIGEM"=case when "SQ_USUARIO_IDENTIDADE" is null then 'AGSUS_PEOPLE_BASE' else "CO_SISTEMA_ORIGEM" end,"CO_CHAVE_ORIGEM"=case when "SQ_USUARIO_IDENTIDADE" is null then coalesce(v_source_key,v_employee) else "CO_CHAVE_ORIGEM" end,"DS_METADADO"=coalesce("DS_METADADO",'{}'::jsonb)||v_import_metadata,"DT_ALTERACAO"=timezone('utc',now()) where "SQ_PESSOA"=v_person."SQ_PESSOA" returning * into v_person; v_updated:=v_updated+1;
    end if;

    if v_email<>'' and coalesce((v_row->>'emailEligibleForAccess')::boolean,false) then
      insert into sigav."TB_IDENTIDADE_ACESSO"("SQ_PESSOA","TP_IDENTIDADE","NO_EMAIL","ST_SITUACAO","NO_ORIGEM","DS_METADADO")
      values(v_person."SQ_PESSOA",'INSTITUTIONAL_EMAIL',v_email,case when v_person."SQ_USUARIO_IDENTIDADE" is null then 'PENDING' else 'ACTIVE' end,'AGSUS_PEOPLE_BASE',jsonb_build_object('import_batch_id',p_batch_id))
      on conflict("SQ_PESSOA","TP_IDENTIDADE","NO_EMAIL") do update set "ST_SITUACAO"=case when v_person."SQ_USUARIO_IDENTIDADE" is null then sigav."TB_IDENTIDADE_ACESSO"."ST_SITUACAO" else 'ACTIVE' end,"DT_REVOGACAO"=null,"DS_METADADO"=coalesce(sigav."TB_IDENTIDADE_ACESSO"."DS_METADADO",'{}'::jsonb)||jsonb_build_object('import_batch_id',p_batch_id),"DT_ALTERACAO"=timezone('utc',now()); v_identity_count:=v_identity_count+1;
    end if;

    if v_application_id is not null and v_manager_email<>'' and v_manager_email<>v_email then
      select * into v_manager from sigav."TB_PESSOA" where lower(btrim(coalesce("DS_EMAIL_INSTITUCIONAL",'')))=v_manager_email order by ("SQ_USUARIO_IDENTIDADE" is not null) desc,"DT_INCLUSAO" limit 1;
      if v_manager."SQ_PESSOA" is null then
        insert into sigav."TB_PESSOA"("CO_MATRICULA","NO_PESSOA","DS_EMAIL_INSTITUCIONAL","ST_VINCULO","ST_ATIVO","CO_SISTEMA_ORIGEM","CO_CHAVE_ORIGEM","DS_METADADO")
        values('LIDER-'||upper(substr(md5(v_manager_email),1,16)),coalesce(nullif(v_manager_name,''),v_manager_email),v_manager_email,'ATIVO',true,'AGSUS_LEADERSHIP_REFERENCE',v_manager_email,jsonb_build_object('leadership_reference',true,'evaluation_exempt',true,'manager_email',v_manager_email,'created_from_import_batch',p_batch_id))
        returning * into v_manager;
      end if;
      if not coalesce((v_manager."DS_METADADO"->>'evaluation_exempt')::boolean,false) and v_manager."CO_SISTEMA_ORIGEM"='AGSUS_LEADERSHIP_REFERENCE' then
        update sigav."TB_PESSOA" set "DS_METADADO"=coalesce("DS_METADADO",'{}'::jsonb)||jsonb_build_object('leadership_reference',true,'evaluation_exempt',true),"DT_ALTERACAO"=timezone('utc',now()) where "SQ_PESSOA"=v_manager."SQ_PESSOA" returning * into v_manager;
      end if;
      if not exists(select 1 from sigav."RT_LIDERANCA_CDDI" where "SQ_APLICACAO"=v_application_id and "SQ_PESSOA_SUBORDINADA"=v_person."SQ_PESSOA" and "ST_SITUACAO"='ACTIVE' and "DT_FIM_VIGENCIA" is null and "TP_ORIGEM"='ADMIN_CORRECTION') then
        update sigav."RT_LIDERANCA_CDDI" set "ST_SITUACAO"='ENDED',"DT_FIM_VIGENCIA"=timezone('utc',now()),"DT_ALTERACAO"=timezone('utc',now()) where "SQ_APLICACAO"=v_application_id and "SQ_PESSOA_SUBORDINADA"=v_person."SQ_PESSOA" and "ST_SITUACAO"='ACTIVE' and "DT_FIM_VIGENCIA" is null and "SQ_PESSOA_LIDER"<>v_manager."SQ_PESSOA";
        insert into sigav."RT_LIDERANCA_CDDI"("SQ_APLICACAO","SQ_PESSOA_LIDER","SQ_PESSOA_SUBORDINADA","ST_SITUACAO","DT_INICIO_VIGENCIA","TP_ORIGEM","CO_CHAVE_ORIGEM","DS_METADADO")
        values(v_application_id,v_manager."SQ_PESSOA",v_person."SQ_PESSOA",'ACTIVE',timezone('utc',now()),'PEOPLE_BASE_IMPORT',v_employee,jsonb_build_object('import_batch_id',p_batch_id,'manager_email',v_manager_email))
        on conflict ("SQ_APLICACAO","CO_CHAVE_ORIGEM") do update set "SQ_PESSOA_LIDER"=excluded."SQ_PESSOA_LIDER","SQ_PESSOA_SUBORDINADA"=excluded."SQ_PESSOA_SUBORDINADA","ST_SITUACAO"='ACTIVE',"DT_FIM_VIGENCIA"=null,"TP_ORIGEM"='PEOPLE_BASE_IMPORT',"DS_METADADO"=coalesce(sigav."RT_LIDERANCA_CDDI"."DS_METADADO",'{}'::jsonb)||excluded."DS_METADADO","DT_ALTERACAO"=timezone('utc',now());
        v_link_count:=v_link_count+1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('status','OK','inserted',v_inserted,'updated',v_updated,'identitiesProcessed',v_identity_count,'leadershipLinksProcessed',v_link_count,'processed',v_inserted+v_updated);
end;$function$;

-- FC_SINCR_LINHAS_GESTOR_CDDI(p_rows jsonb, p_batch_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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

  select "SQ_APLICACAO" into v_application_id
  from sigav."TB_APLICACAO_PESQUISA"
  where "CO_APLICACAO" = 'CDDI-2026'
  order by "DT_INCLUSAO" desc
  limit 1;

  if v_application_id is null then
    return jsonb_build_object('status', 'SKIPPED', 'reason', 'CDDI_APPLICATION_NOT_FOUND');
  end if;

  for v_row in select "DS_VALOR" from jsonb_array_elements(p_rows)
  loop
    v_employee := btrim(coalesce(v_row->>'employeeNumber', ''));
    v_manager_name := nullif(btrim(coalesce(v_row->>'managerName', '')), '');
    v_manager_email := nullif(lower(btrim(coalesce(v_row->>'managerEmail', ''))), '');

    select * into v_person from sigav."TB_PESSOA" where "CO_MATRICULA" = v_employee limit 1;
    if v_person."SQ_PESSOA" is null then v_pending := v_pending + 1; continue; end if;

    update sigav."TB_PESSOA"
    set "DS_METADADO" = coalesce("DS_METADADO", '{}'::jsonb) || jsonb_strip_nulls(jsonb_build_object(
      'manager_name', v_manager_name,
      'manager_email', v_manager_email,
      'manager_resolution', case when v_manager_email is null then 'MISSING_EMAIL' else 'PENDING' end,
      'manager_import_batch_id', p_batch_id,
      'manager_imported_at', timezone('utc', now())
    )), "DT_ALTERACAO" = timezone('utc', now())
    where "SQ_PESSOA" = v_person."SQ_PESSOA";

    if v_manager_email is null then v_pending := v_pending + 1; continue; end if;

    select count(*) into v_manager_matches
    from sigav."TB_PESSOA" p
    where p."ST_ATIVO" = true and lower(btrim(coalesce(p."DS_EMAIL_INSTITUCIONAL", ''))) = v_manager_email;

    if v_manager_matches <> 1 then
      update sigav."TB_PESSOA"
      set "DS_METADADO" = jsonb_set(coalesce("DS_METADADO", '{}'::jsonb), '{manager_resolution}', to_jsonb(case when v_manager_matches = 0 then 'NOT_FOUND' else 'AMBIGUOUS' end::text), true)
      where "SQ_PESSOA" = v_person."SQ_PESSOA";
      v_pending := v_pending + 1;
      continue;
    end if;

    select * into v_manager
    from sigav."TB_PESSOA" p
    where p."ST_ATIVO" = true and lower(btrim(coalesce(p."DS_EMAIL_INSTITUCIONAL", ''))) = v_manager_email
    limit 1;

    if v_manager."SQ_PESSOA" = v_person."SQ_PESSOA" then
      update sigav."TB_PESSOA" set "DS_METADADO" = jsonb_set(coalesce("DS_METADADO", '{}'::jsonb), '{manager_resolution}', '"SELF_REFERENCE"'::jsonb, true) where "SQ_PESSOA" = v_person."SQ_PESSOA";
      v_pending := v_pending + 1;
      continue;
    end if;

    if exists (
      select 1 from sigav."RT_LIDERANCA_CDDI" l
      where l."SQ_APLICACAO" = v_application_id and l."SQ_PESSOA_SUBORDINADA" = v_person."SQ_PESSOA"
        and l."ST_SITUACAO" = 'ACTIVE' and l."DT_FIM_VIGENCIA" is null
        and l."TP_ORIGEM" in ('SELF_DECLARED', 'SELF_SERVICE', 'ADMIN_CORRECTION', 'ADMINISTRATIVE')
    ) then
      update sigav."TB_PESSOA" set "DS_METADADO" = jsonb_set(coalesce("DS_METADADO", '{}'::jsonb), '{manager_resolution}', '"PRESERVED_MANUAL_LINK"'::jsonb, true) where "SQ_PESSOA" = v_person."SQ_PESSOA";
      v_preserved := v_preserved + 1;
      continue;
    end if;

    if exists (
      select 1 from sigav."RT_LIDERANCA_CDDI" l
      where l."SQ_APLICACAO" = v_application_id and l."SQ_PESSOA_SUBORDINADA" = v_person."SQ_PESSOA"
        and l."ST_SITUACAO" = 'ACTIVE' and l."DT_FIM_VIGENCIA" is null
    ) then
      update sigav."RT_LIDERANCA_CDDI"
      set "SQ_PESSOA_LIDER" = v_manager."SQ_PESSOA",
          "TP_ORIGEM" = 'PEOPLE_BASE_IMPORT',
          "CO_CHAVE_ORIGEM" = 'PEOPLE_BASE:' || v_person."CO_MATRICULA",
          "DS_METADADO" = coalesce("DS_METADADO", '{}'::jsonb) || jsonb_build_object('manager_name', v_manager_name, 'manager_email', v_manager_email, 'import_batch_id', p_batch_id),
          "DT_ALTERACAO" = timezone('utc', now())
      where "SQ_APLICACAO" = v_application_id and "SQ_PESSOA_SUBORDINADA" = v_person."SQ_PESSOA" and "ST_SITUACAO" = 'ACTIVE' and "DT_FIM_VIGENCIA" is null;
      v_updated := v_updated + 1;
    else
      insert into sigav."RT_LIDERANCA_CDDI"("SQ_APLICACAO", "SQ_PESSOA_LIDER", "SQ_PESSOA_SUBORDINADA", "ST_SITUACAO", "DT_INICIO_VIGENCIA", "TP_ORIGEM", "CO_CHAVE_ORIGEM", "DS_METADADO")
      values(v_application_id, v_manager."SQ_PESSOA", v_person."SQ_PESSOA", 'ACTIVE', timezone('utc', now()), 'PEOPLE_BASE_IMPORT', 'PEOPLE_BASE:' || v_person."CO_MATRICULA",
        jsonb_build_object('manager_name', v_manager_name, 'manager_email', v_manager_email, 'import_batch_id', p_batch_id));
      v_created := v_created + 1;
    end if;

    update sigav."TB_PESSOA" set "DS_METADADO" = jsonb_set(coalesce("DS_METADADO", '{}'::jsonb), '{manager_resolution}', '"RESOLVED"'::jsonb, true) where "SQ_PESSOA" = v_person."SQ_PESSOA";
  end loop;

  return jsonb_build_object('status', 'OK', 'created', v_created, 'updated', v_updated, 'preserved', v_preserved, 'pending', v_pending);
end;
$function$;

-- FC_SINCR_RESP_LIDERANCA()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_SINCR_RESP_LIDERANCA"()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if new."ST_SITUACAO" = 'ACTIVE'
     and new."DT_INICIO_VIGENCIA" <= now()
     and (new."DT_FIM_VIGENCIA" is null or new."DT_FIM_VIGENCIA" > now()) then
    perform sigav."FC_SINCR_RESP_TECNICA_CDDI"(
      new."SQ_APLICACAO",
      new."SQ_PESSOA_SUBORDINADA",
      new."SQ_PESSOA_LIDER"
    );
  end if;

  return new;
end;
$function$;

-- FC_SINCR_RESP_LIDER_NOVA()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_SINCR_RESP_LIDER_NOVA"()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_leader_person_id uuid;
begin
  if new."TP_SUBMISSAO" not in ('AUTO', 'CHEFIA') or new."ST_SITUACAO" <> 'DRAFT' then return new; end if;

  select link."SQ_PESSOA_LIDER" into v_leader_person_id
  from sigav."RT_LIDERANCA_CDDI" link
  where link."SQ_APLICACAO" = new."SQ_APLICACAO"
    and link."SQ_PESSOA_SUBORDINADA" = new."SQ_PESSOA_AVALIADA"
    and link."ST_SITUACAO" = 'ACTIVE'
    and link."DT_INICIO_VIGENCIA" <= now()
    and (link."DT_FIM_VIGENCIA" is null or link."DT_FIM_VIGENCIA" > now())
  order by link."DT_INICIO_VIGENCIA" desc, link."DT_INCLUSAO" desc
  limit 1;

  if v_leader_person_id is not null then
    perform sigav."FC_SINCR_RESP_TECNICA_CDDI"(new."SQ_APLICACAO", new."SQ_PESSOA_AVALIADA", v_leader_person_id);
  end if;
  return new;
end;
$function$;

-- FC_SINCR_RESP_TECNICA_CDDI(target_application_id uuid, target_subordinate_person_id uuid, target_leader_person_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_SINCR_RESP_TECNICA_CDDI"(target_application_id uuid, target_subordinate_person_id uuid, target_leader_person_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_question_id uuid;
begin
  select question."SQ_PERGUNTA" into v_question_id
  from sigav."TB_APLICACAO_PESQUISA" application
  join sigav."TB_PERGUNTA_PESQUISA" question on question."SQ_VERSAO_PESQUISA" = application."SQ_VERSAO_PESQUISA"
  where application."SQ_APLICACAO" = target_application_id
    and question."CO_PERGUNTA" = 'CHEFIA_RESPONSAVEL'
    and question."TP_PERGUNTA" = 'PERSON'
  order by question."NU_ORDEM"
  limit 1;

  if v_question_id is null then return; end if;

  insert into sigav."TB_RESPOSTA" ("SQ_SUBMISSAO", "SQ_PERGUNTA", "DS_RESPOSTA_JSON", "DT_ALTERACAO")
  select submission."SQ_SUBMISSAO", v_question_id,
    jsonb_build_object('personId', target_leader_person_id, 'source', 'cddi_leadership_links'),
    timezone('utc', now())
  from sigav."TB_SUBMISSAO" submission
  where submission."SQ_APLICACAO" = target_application_id
    and submission."SQ_PESSOA_AVALIADA" = target_subordinate_person_id
    and submission."TP_SUBMISSAO" in ('AUTO', 'CHEFIA')
    and submission."ST_SITUACAO" = 'DRAFT'
  on conflict ("SQ_SUBMISSAO", "SQ_PERGUNTA") do update
    set "DS_RESPOSTA" = null,
        "NU_RESPOSTA" = null,
        "ST_RESPOSTA" = null,
        "DT_RESPOSTA" = null,
        "DT_HORA_RESPOSTA" = null,
        "DS_RESPOSTA_JSON" = excluded."DS_RESPOSTA_JSON",
        "DT_ALTERACAO" = excluded."DT_ALTERACAO";
end;
$function$;

-- FC_SRV_RESOLVER_IDENT_OAUTH(p_provider text, p_provider_sub text, p_email text, p_nome text, p_avatar text)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  select "SQ_USUARIO" into v_user_id
  from sigav."TB_IDENTIDADE_OAUTH"
  where "NO_PROVEDOR" = v_provider and "CO_IDENTIFICADOR_PROVEDOR" = v_sub;

  -- 2) sem identidade: reaproveita a conta existente com o mesmo e-mail.
  --    Este é o passo que preserva o vínculo de quem já usava a plataforma.
  if v_user_id is null then
    select "SQ_USUARIO" into v_user_id
    from sigav."TB_USUARIO_IDENTIDADE"
    where lower("DS_EMAIL") = v_email
    order by "DT_INCLUSAO" nulls last
    limit 1;
  end if;

  -- 3) ninguém encontrado: conta nova de fato
  if v_user_id is null then
    v_user_id := gen_random_uuid();
    v_novo := true;

    insert into sigav."TB_USUARIO_IDENTIDADE"
      ("SQ_USUARIO", "DS_EMAIL", "DS_METADADO_USUARIO", "DS_METADADO_APLICACAO",
       "DT_CONFIRMACAO_EMAIL", "DT_INCLUSAO", "DT_ALTERACAO", "DT_ULTIMO_ACESSO")
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
    set "DS_EMAIL" = coalesce(nullif(v_email, ''), "DS_EMAIL"),
        "DS_METADADO_USUARIO" = coalesce("DS_METADADO_USUARIO", '{}'::jsonb) || jsonb_build_object(
          'email', v_email, 'name', p_nome, 'full_name', p_nome,
          'avatar_url', p_avatar, 'picture', p_avatar, 'provider_id', v_sub),
        "DT_ULTIMO_ACESSO" = v_agora,
        "DT_ALTERACAO" = v_agora
    where "SQ_USUARIO" = v_user_id;
  end if;

  -- A identidade guarda o que FC_SINCR_AVATAR_GOOGLE() vai ler. `picture` e
  -- `avatar_url` são gravados juntos porque a função aceita qualquer um dos
  -- dois, e assim ela não precisa mudar.
  --
  -- `email` NÃO entra na lista de colunas: é coluna gerada a partir de
  -- `identity_data->>'email'`, e o Postgres recusa insert que atribua valor a
  -- ela. `id` também fica de fora — tem default `gen_random_uuid()`.
  insert into sigav."TB_IDENTIDADE_OAUTH"
    ("CO_IDENTIFICADOR_PROVEDOR", "NO_PROVEDOR", "SQ_USUARIO", "DS_DADO_IDENTIDADE",
     "DT_ULTIMO_ACESSO", "DT_INCLUSAO", "DT_ALTERACAO")
  values (
    v_sub, v_provider, v_user_id,
    jsonb_build_object('sub', v_sub, 'iss', 'https://accounts.google.com',
                       'email', v_email, 'email_verified', true,
                       'name', p_nome, 'full_name', p_nome,
                       'picture', p_avatar, 'avatar_url', p_avatar,
                       'provider_id', v_sub),
    v_agora, v_agora, v_agora
  )
  on conflict ("CO_IDENTIFICADOR_PROVEDOR", "NO_PROVEDOR") do update
  set "SQ_USUARIO" = excluded."SQ_USUARIO",
      "DS_DADO_IDENTIDADE" = excluded."DS_DADO_IDENTIDADE",
      "DT_ULTIMO_ACESSO" = excluded."DT_ULTIMO_ACESSO",
      "DT_ALTERACAO" = excluded."DT_ALTERACAO";

  return jsonb_build_object(
    'status', 'OK',
    'userId', v_user_id,
    'email', v_email,
    'novo', v_novo
  );
end;
$function$;

-- FC_VALIDAR_CICLO_ANONIMO()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_VALIDAR_CICLO_ANONIMO"()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if new."ST_ANONIMA" is distinct from old."ST_ANONIMA"
     and exists (select 1 from sigav."TB_SUBMISSAO" s where s."SQ_APLICACAO" = new."SQ_APLICACAO") then
    raise exception 'Este ciclo já tem respostas: o anonimato não pode ser ligado nem desligado agora.';
  end if;
  return new;
end;
$function$;

-- FC_VALIDAR_FOTO_GOOGLE()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_VALIDAR_FOTO_GOOGLE"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if new."DS_METADADO" ? 'avatar_config'
     or coalesce(new."DS_METADADO"->>'avatar_source', '') not in ('', 'GOOGLE')
     or nullif(btrim(coalesce(new."DS_METADADO"->>'avatar_url', '')), '')
        is distinct from nullif(btrim(coalesce(new."DS_METADADO"->>'google_avatar_url', '')), '') then
    raise exception 'A foto de perfil é sincronizada automaticamente com a conta Google.';
  end if;
  return new;
end;
$function$;

-- FC_VALIDAR_INTEGRIDADE_VERSAO(target_survey_version_id uuid)
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  where "SQ_VERSAO_PESQUISA" = target_survey_version_id;

  if v_version."SQ_VERSAO_PESQUISA" is null then
    raise exception 'Versão da pesquisa não encontrada.';
  end if;

  with issue_rows as (
    select
      10 as priority,
      'NO_SECTIONS'::text as "CO_SECAO",
      'NO_SECTIONS'::text as issue_id,
      'STRUCTURE'::text as category,
      'VERSION'::text as "TP_ENTIDADE",
      v_version."SQ_VERSAO_PESQUISA" as "CO_ENTIDADE",
      'Adicione pelo menos uma seção.'::text as message,
      'Crie a primeira seção no construtor.'::text as action
    where not exists (
      select 1
      from sigav."TB_SECAO_PESQUISA" section
      where section."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
    )

    union all

    select
      20,
      'NO_QUESTIONS',
      'NO_QUESTIONS',
      'STRUCTURE',
      'VERSION',
      v_version."SQ_VERSAO_PESQUISA",
      'Adicione pelo menos uma pergunta.',
      'Inclua uma pergunta em uma das seções.'
    where not exists (
      select 1
      from sigav."TB_PERGUNTA_PESQUISA" question
      where question."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
    )

    union all

    select
      30,
      'BLANK_VERSION_TITLE',
      'BLANK_VERSION_TITLE',
      'STRUCTURE',
      'VERSION',
      v_version."SQ_VERSAO_PESQUISA",
      'O título da versão está vazio.',
      'Informe um título para a versão antes de publicar.'
    where nullif(btrim(v_version."NO_VERSAO"), '') is null

    union all

    select
      40,
      'BLANK_SECTION_TITLE',
      'BLANK_SECTION_TITLE:' || section."SQ_SECAO"::text,
      'STRUCTURE',
      'SECTION',
      section."SQ_SECAO",
      'Uma seção está sem título.',
      'Informe o título da seção no construtor.'
    from sigav."TB_SECAO_PESQUISA" section
    where section."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
      and nullif(btrim(section."NO_SECAO"), '') is null

    union all

    select
      50,
      'SECTION_TITLE_TOO_LONG',
      'SECTION_TITLE_TOO_LONG:' || section."SQ_SECAO"::text,
      'STRUCTURE',
      'SECTION',
      section."SQ_SECAO",
      format('A seção "%s" ultrapassa 160 caracteres.', left(section."NO_SECAO", 80)),
      'Reduza o título da seção para até 160 caracteres.'
    from sigav."TB_SECAO_PESQUISA" section
    where section."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
      and char_length(section."NO_SECAO") > 160

    union all

    select
      60,
      'EMPTY_SECTION',
      'EMPTY_SECTION:' || section."SQ_SECAO"::text,
      'STRUCTURE',
      'SECTION',
      section."SQ_SECAO",
      format('A seção "%s" não possui perguntas.', left(section."NO_SECAO", 80)),
      'Adicione uma pergunta ou remova a seção vazia.'
    from sigav."TB_SECAO_PESQUISA" section
    where section."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
      and not exists (
        select 1
        from sigav."TB_PERGUNTA_PESQUISA" question
        where question."SQ_SECAO" = section."SQ_SECAO"
      )

    union all

    select
      70,
      'BLANK_QUESTION_TITLE',
      'BLANK_QUESTION_TITLE:' || question."SQ_PERGUNTA"::text,
      'STRUCTURE',
      'QUESTION',
      question."SQ_PERGUNTA",
      'Uma pergunta está sem enunciado.',
      'Informe o enunciado da pergunta no construtor.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
      and nullif(btrim(question."NO_PERGUNTA"), '') is null

    union all

    select
      80,
      'QUESTION_TITLE_TOO_LONG',
      'QUESTION_TITLE_TOO_LONG:' || question."SQ_PERGUNTA"::text,
      'STRUCTURE',
      'QUESTION',
      question."SQ_PERGUNTA",
      format('A pergunta "%s" ultrapassa 500 caracteres.', left(question."NO_PERGUNTA", 80)),
      'Reduza o enunciado para até 500 caracteres.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
      and char_length(question."NO_PERGUNTA") > 500

    union all

    select
      90,
      'INSUFFICIENT_OPTIONS',
      'INSUFFICIENT_OPTIONS:' || question."SQ_PERGUNTA"::text,
      'STRUCTURE',
      'QUESTION',
      question."SQ_PERGUNTA",
      format('A pergunta "%s" precisa de pelo menos duas alternativas ativas.', left(question."NO_PERGUNTA", 80)),
      'Edite a pergunta e informe ao menos duas alternativas.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
      and question."TP_PERGUNTA" in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE')
      and (
        select count(*)
        from sigav."TB_OPCAO_PERGUNTA" option
        where option."SQ_PERGUNTA" = question."SQ_PERGUNTA"
          and option."ST_ATIVO"
      ) < 2

    union all

    select
      100,
      'BLANK_OPTION',
      'BLANK_OPTION:' || question."SQ_PERGUNTA"::text,
      'STRUCTURE',
      'QUESTION',
      question."SQ_PERGUNTA",
      format('A pergunta "%s" possui alternativa sem rótulo ou valor.', left(question."NO_PERGUNTA", 80)),
      'Preencha todas as alternativas e salve a pergunta novamente.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
      and exists (
        select 1
        from sigav."TB_OPCAO_PERGUNTA" option
        where option."SQ_PERGUNTA" = question."SQ_PERGUNTA"
          and option."ST_ATIVO"
          and (
            nullif(btrim(option."NO_OPCAO"), '') is null
            or nullif(btrim(option."DS_VALOR"), '') is null
          )
      )

    union all

    select
      110,
      'OPTION_LABEL_TOO_LONG',
      'OPTION_LABEL_TOO_LONG:' || question."SQ_PERGUNTA"::text,
      'STRUCTURE',
      'QUESTION',
      question."SQ_PERGUNTA",
      format('A pergunta "%s" possui alternativa com mais de 200 caracteres.', left(question."NO_PERGUNTA", 80)),
      'Reduza cada alternativa para até 200 caracteres.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
      and exists (
        select 1
        from sigav."TB_OPCAO_PERGUNTA" option
        where option."SQ_PERGUNTA" = question."SQ_PERGUNTA"
          and option."ST_ATIVO"
          and char_length(option."NO_OPCAO") > 200
      )

    union all

    select
      120,
      'DUPLICATE_OPTION_LABEL',
      'DUPLICATE_OPTION_LABEL:' || question."SQ_PERGUNTA"::text,
      'STRUCTURE',
      'QUESTION',
      question."SQ_PERGUNTA",
      format('A pergunta "%s" possui alternativas repetidas.', left(question."NO_PERGUNTA", 80)),
      'Use rótulos diferentes para cada alternativa.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
      and question."TP_PERGUNTA" in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE')
      and (
        select count(*)
        from sigav."TB_OPCAO_PERGUNTA" option
        where option."SQ_PERGUNTA" = question."SQ_PERGUNTA"
          and option."ST_ATIVO"
      ) <> (
        select count(distinct lower(btrim(option."NO_OPCAO")))
        from sigav."TB_OPCAO_PERGUNTA" option
        where option."SQ_PERGUNTA" = question."SQ_PERGUNTA"
          and option."ST_ATIVO"
      )

    union all

    select
      130,
      'DUPLICATE_OPTION_VALUE',
      'DUPLICATE_OPTION_VALUE:' || question."SQ_PERGUNTA"::text,
      'STRUCTURE',
      'QUESTION',
      question."SQ_PERGUNTA",
      format('A pergunta "%s" possui valores internos repetidos.', left(question."NO_PERGUNTA", 80)),
      'Edite e salve novamente as alternativas para gerar valores únicos.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
      and question."TP_PERGUNTA" in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE')
      and (
        select count(*)
        from sigav."TB_OPCAO_PERGUNTA" option
        where option."SQ_PERGUNTA" = question."SQ_PERGUNTA"
          and option."ST_ATIVO"
      ) <> (
        select count(distinct lower(btrim(option."DS_VALOR")))
        from sigav."TB_OPCAO_PERGUNTA" option
        where option."SQ_PERGUNTA" = question."SQ_PERGUNTA"
          and option."ST_ATIVO"
      )

    union all

    select
      140,
      'SCALE_WITHOUT_SCORE',
      'SCALE_WITHOUT_SCORE:' || question."SQ_PERGUNTA"::text,
      'STRUCTURE',
      'QUESTION',
      question."SQ_PERGUNTA",
      format('A escala "%s" possui alternativa sem pontuação.', left(question."NO_PERGUNTA", 80)),
      'Edite e salve novamente a escala para preencher a pontuação.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
      and question."TP_PERGUNTA" = 'SCALE'
      and exists (
        select 1
        from sigav."TB_OPCAO_PERGUNTA" option
        where option."SQ_PERGUNTA" = question."SQ_PERGUNTA"
          and option."ST_ATIVO"
          and option."VL_NOTA" is null
      )

    union all

    select
      150,
      'DUPLICATE_SCALE_SCORE',
      'DUPLICATE_SCALE_SCORE:' || question."SQ_PERGUNTA"::text,
      'STRUCTURE',
      'QUESTION',
      question."SQ_PERGUNTA",
      format('A escala "%s" possui pontuações repetidas.', left(question."NO_PERGUNTA", 80)),
      'Use uma pontuação diferente em cada alternativa da escala.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
      and question."TP_PERGUNTA" = 'SCALE'
      and (
        select count(*)
        from sigav."TB_OPCAO_PERGUNTA" option
        where option."SQ_PERGUNTA" = question."SQ_PERGUNTA"
          and option."ST_ATIVO"
          and option."VL_NOTA" is not null
      ) <> (
        select count(distinct option."VL_NOTA")
        from sigav."TB_OPCAO_PERGUNTA" option
        where option."SQ_PERGUNTA" = question."SQ_PERGUNTA"
          and option."ST_ATIVO"
          and option."VL_NOTA" is not null
      )

    union all

    select
      160,
      'UNEXPECTED_OPTIONS',
      'UNEXPECTED_OPTIONS:' || question."SQ_PERGUNTA"::text,
      'STRUCTURE',
      'QUESTION',
      question."SQ_PERGUNTA",
      format('A pergunta "%s" possui alternativas incompatíveis com o tipo de resposta.', left(question."NO_PERGUNTA", 80)),
      'Edite e salve novamente a pergunta para limpar as alternativas.'
    from sigav."TB_PERGUNTA_PESQUISA" question
    where question."SQ_VERSAO_PESQUISA" = v_version."SQ_VERSAO_PESQUISA"
      and question."TP_PERGUNTA" not in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE', 'MATRIX')
      and exists (
        select 1
        from sigav."TB_OPCAO_PERGUNTA" option
        where option."SQ_PERGUNTA" = question."SQ_PERGUNTA"
          and option."ST_ATIVO"
      )
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', issue_id,
          'code', "CO_SECAO",
          'severity', 'BLOCKING',
          'category', category,
          'entityType', "TP_ENTIDADE",
          'entityId', "CO_ENTIDADE",
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
    'versionId', v_version."SQ_VERSAO_PESQUISA",
    'versionStatus', v_version."ST_SITUACAO",
    'valid', v_blocking_count = 0,
    'blockingCount', v_blocking_count,
    'issues', v_issues
  );
end;
$function$;

-- FC_VALIDAR_OPCAO_RESPOSTA()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_VALIDAR_OPCAO_RESPOSTA"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  answer_question uuid;
  option_question uuid;
begin
  select "SQ_PERGUNTA" into answer_question from sigav."TB_RESPOSTA" where "SQ_RESPOSTA" = new."SQ_RESPOSTA";
  select "SQ_PERGUNTA" into option_question from sigav."TB_OPCAO_PERGUNTA" where "SQ_OPCAO" = new."SQ_OPCAO";
  if answer_question is distinct from option_question then
    raise exception 'Alternativa não pertence à pergunta respondida.';
  end if;
  return new;
end;
$function$;

-- FC_VALIDAR_PARTIC_SUBMISSAO()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  select "ST_ANONIMA" into app_anonymous from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = new."SQ_APLICACAO";
  if app_anonymous is null then raise exception 'Aplicação inexistente.'; end if;
  if not app_anonymous and (new."SQ_PARTICIPANTE" is null or new."SQ_PESSOA_RESPONDENTE" is null) then
    raise exception 'Aplicações identificadas exigem participante e respondente.';
  end if;
  if new."SQ_PARTICIPANTE" is not null then
    select "SQ_APLICACAO", "SQ_PESSOA" into participant_application, participant_person
    from sigav."RL_APLICACAO_PESSOA" where "SQ_PARTICIPANTE" = new."SQ_PARTICIPANTE";
    if participant_application is distinct from new."SQ_APLICACAO" then
      raise exception 'Participante não pertence à aplicação.';
    end if;
    if participant_person is distinct from new."SQ_PESSOA_RESPONDENTE" then
      raise exception 'Respondente não corresponde ao participante.';
    end if;
  end if;
  return new;
end;
$function$;

-- FC_VALIDAR_PERGUNTA_RESPOSTA()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_VALIDAR_PERGUNTA_RESPOSTA"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  app_version uuid;
  question_version uuid;
begin
  select sa."SQ_VERSAO_PESQUISA" into app_version
  from sigav."TB_SUBMISSAO" s join sigav."TB_APLICACAO_PESQUISA" sa on sa."SQ_APLICACAO" = s."SQ_APLICACAO"
  where s."SQ_SUBMISSAO" = new."SQ_SUBMISSAO";
  select "SQ_VERSAO_PESQUISA" into question_version from sigav."TB_PERGUNTA_PESQUISA" where "SQ_PERGUNTA" = new."SQ_PERGUNTA";
  if app_version is distinct from question_version then
    raise exception 'Pergunta não pertence à versão aplicada.';
  end if;
  return new;
end;
$function$;

-- FC_VALIDAR_RESULT_FINAL_CDDI()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
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
  foreach sid in array array[new."SQ_SUBMISSAO_AUTO", new."SQ_SUBMISSAO_LIDER"] loop
    if sid is null then continue; end if;
    select "SQ_APLICACAO", "SQ_PESSOA_AVALIADA", "TP_SUBMISSAO" into app, subject, stype
    from sigav."TB_SUBMISSAO" where "SQ_SUBMISSAO" = sid;
    if app is distinct from new."SQ_APLICACAO" or subject is distinct from new."SQ_PESSOA_AVALIADA" then
      raise exception 'A submissão não corresponde à aplicação e ao avaliado do resultado final.';
    end if;
    if sid = new."SQ_SUBMISSAO_AUTO" and stype <> 'AUTO' then
      raise exception 'A submissão de autoavaliação deve ser do tipo AUTO.';
    end if;
    if sid = new."SQ_SUBMISSAO_LIDER" and stype <> 'CHEFIA' then
      raise exception 'A submissão de chefia deve ser do tipo CHEFIA.';
    end if;
  end loop;
  return new;
end;
$function$;

-- FC_VALIDAR_SUBMISSAO_CDDI()
-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML
CREATE OR REPLACE FUNCTION sigav."FC_VALIDAR_SUBMISSAO_CDDI"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  survey_code text;
begin
  select s."CO_PESQUISA" into survey_code
  from sigav."TB_APLICACAO_PESQUISA" sa
  join sigav."TH_VERSAO_PESQUISA" sv on sv."SQ_VERSAO_PESQUISA" = sa."SQ_VERSAO_PESQUISA"
  join sigav."TB_PESQUISA" s on s."SQ_PESQUISA" = sv."SQ_PESQUISA"
  where sa."SQ_APLICACAO" = new."SQ_APLICACAO";

  if survey_code <> 'CDDI' then
    return new;
  end if;

  if new."TP_SUBMISSAO" not in ('AUTO','CHEFIA') then
    raise exception 'O CDDI aceita somente submissões AUTO ou CHEFIA.';
  end if;

  if new."SQ_PESSOA_AVALIADA" is null then
    raise exception 'A pessoa avaliada é obrigatória no CDDI.';
  end if;

  if new."TP_SUBMISSAO" = 'AUTO' and new."SQ_PESSOA_RESPONDENTE" is distinct from new."SQ_PESSOA_AVALIADA" then
    raise exception 'Na autoavaliação, respondente e avaliado devem ser a mesma pessoa.';
  end if;

  if new."TP_SUBMISSAO" = 'CHEFIA' and not exists (
    select 1 from sigav."RT_LIDERANCA_CDDI" l
    where l."SQ_APLICACAO" = new."SQ_APLICACAO"
      and l."SQ_PESSOA_LIDER" = new."SQ_PESSOA_RESPONDENTE"
      and l."SQ_PESSOA_SUBORDINADA" = new."SQ_PESSOA_AVALIADA"
      and l."ST_SITUACAO" = 'ACTIVE'
      and l."DT_INICIO_VIGENCIA" <= timezone('utc', now())
      and (l."DT_FIM_VIGENCIA" is null or l."DT_FIM_VIGENCIA" > timezone('utc', now()))
  ) then
    raise exception 'Não existe vínculo ativo entre a liderança e a pessoa avaliada.';
  end if;

  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Autoverificação
-- ---------------------------------------------------------------------------

do $verificacao$
declare
  v_tabelas text[] := array['TB_CONFIG_PLATAFORMA', 'RT_LIDERANCA_CDDI', 'TB_RESPOSTA', 'TB_OPCAO_PERGUNTA', 'TB_SECAO_PESQUISA', 'TB_PESQUISA', 'TB_SUBMISSAO', 'TB_PERGUNTA_PESQUISA', 'TL_EVENTO_AUDITORIA', 'RL_APLICACAO_PESSOA', 'TH_VERSAO_PESQUISA', 'TB_PESSOA', 'TB_APLICACAO_PESQUISA', 'TB_IDENTIDADE_OAUTH', 'TB_USUARIO_IDENTIDADE'];
  v_revisadas text[] := array['FC_AGENDAR_ENVIO_MANUAL', 'FC_APLICAR_PUBLICO_AVALIACAO', 'FC_ATRIB_PARTICIPANTE', 'FC_ATRIB_PARTICIPANTE_LOTE', 'FC_ATRIB_TODOS_DISPONIVEIS', 'FC_ATUALIZAR_MARCA_PLATAFORMA', 'FC_ATUALIZAR_PERGUNTA', 'FC_ATUALIZAR_PESSOA_ADMIN', 'FC_ATUALIZAR_SECAO', 'FC_ATUALIZAR_VISUAL_CICLO', 'FC_BUSCAR_CANDIDATOS_EQUIPE', 'FC_BUSCAR_PESSOAS_ADMIN', 'FC_BUSCAR_PESSOAS_CICLO', 'FC_BUSCAR_PESSOAS_PUBLICO', 'FC_CANCELA_CICLOS_ARQ', 'FC_CICLO_ACEITA_RESPOSTA', 'FC_CLONAR_PESQUISA', 'FC_CLONAR_PESQUISA_ESTRUTURA', 'FC_CONDICAO_ATENDIDA', 'FC_CRIAR_E_ATRIB_PARTIC', 'FC_CRIAR_NOVA_VERSAO_PESQUISA', 'FC_CRIAR_RASCUNHO_PESQUISA', 'FC_DEFINIR_COMUNICADO_INICIO', 'FC_DEFINIR_COR_BARRA_LATERAL', 'FC_DEFINIR_COR_PAINEL_ACESSO', 'FC_DEFINIR_DT_ALTERACAO', 'FC_DEFINIR_FUNDO_ACESSO', 'FC_DEFINIR_MODELO_AVALIACAO', 'FC_DEFINIR_NOTIFICACAO_EMAIL', 'FC_DEFINIR_PERMISSOES_PESSOA', 'FC_DEFINIR_PRESENCA_PLATAFORMA', 'FC_DEFINIR_RETENCAO_ANONIMA', 'FC_DEFINIR_SITUACAO_PARTIC', 'FC_DEFINIR_TEXTOS_EMAIL', 'FC_DEFINIR_TEXTOS_MARCA', 'FC_DEFINIR_VINCULO_LIDERANCA', 'FC_DUPLICAR_ITEM_CONSTRUTOR', 'FC_ENVIAR_RESP_ANON', 'FC_ENVIAR_SUBMISSAO_CDDI', 'FC_ENVIAR_SUBMISSAO_PESQUISA', 'FC_EXCLUIR_PERGUNTA', 'FC_EXCLUIR_PESQUISA_ARQUIVADA', 'FC_EXCLUIR_PESQUISA_RASCUNHO', 'FC_EXCLUIR_REGRA_CONDICIONAL', 'FC_EXIGIR_RASCUNHO_ESTRUT', 'FC_EXPIRAR_PESQUISAS_ARQ', 'FC_EXPIRAR_RASCUNHOS_ANONIMOS', 'FC_GERIR_CICLO_PESQUISA', 'FC_GRAVAR_RESP_ANON', 'FC_INCLUIR_PERGUNTA', 'FC_INCLUIR_PESSOA_EQUIPE', 'FC_INCLUIR_SECAO', 'FC_INICIAR_OU_RETOMAR_CDDI', 'FC_INICIAR_OU_RETOMAR_PESQ', 'FC_INICIAR_OU_RETOMAR_SUBM', 'FC_INICIAR_RESP_ANON', 'FC_LISTAR_ACESSOS_PAGINADOS', 'FC_LISTAR_AUDIENCIA_EMAIL', 'FC_LISTAR_AUDITORIA_PESSOA', 'FC_LISTAR_CATALOGO_PESQUISA', 'FC_LISTAR_CICLOS_LIDERANCA', 'FC_LISTAR_CICLOS_LIDERANCA_ADM', 'FC_LISTAR_CICLOS_PARTIC', 'FC_LISTAR_CICLOS_PESQUISA', 'FC_LISTAR_DIMENSOES_PUBLICO', 'FC_LISTAR_ENVIOS_EMAIL', 'FC_LISTAR_MODELOS_AVALIACAO', 'FC_LISTAR_PARTIC_CICLO', 'FC_LISTAR_PESQUISAS_ARQ', 'FC_LISTAR_PESQUISAS_GERIDAS', 'FC_LISTAR_PESSOAS_SEM_CHEFIA', 'FC_LISTAR_PRESENCA_ONLINE', 'FC_LISTAR_RESPOSTAS_CICLO', 'FC_LISTAR_VINCULOS_LIDERANCA', 'FC_MODULOS_EFETIVOS', 'FC_MOVER_PERGUNTA_SECAO', 'FC_OBTER_CICLO_CDDI_VIGENTE', 'FC_OBTER_CONSTRUTOR', 'FC_OBTER_CONTEXTO_CDDI', 'FC_OBTER_CONTEXTO_PLATAFORMA', 'FC_OBTER_ESPACO_EQUIPE', 'FC_OBTER_FORMULARIO_PUBLICO', 'FC_OBTER_FORM_ANONIMO', 'FC_OBTER_FORM_PUBLICO', 'FC_OBTER_IDENTIDADE_CDDI', 'FC_OBTER_MARCA_PLATAFORMA', 'FC_OBTER_MARCA_PUBLICA', 'FC_OBTER_MINHA_EQUIPE', 'FC_OBTER_OPERACOES_PESQUISA', 'FC_OBTER_PAINEL_PESQ', 'FC_OBTER_PAINEL_PESQUISA', 'FC_OBTER_REGRAS_DO_CICLO', 'FC_OBTER_VISUAL_CICLO', 'FC_ORIGENS_DA_REGRA', 'FC_PAINEL_MONITOR_CDDI', 'FC_PAINEL_MONITOR_CDDI_INT', 'FC_PERGUNTA_VISIVEL', 'FC_PESQUISAR_EQUIPE', 'FC_PESQUISAR_PESSOA_ADMIN', 'FC_PESSOA_SESSAO', 'FC_PLANEJAR_PUBLICO_AVALIACAO', 'FC_PODE_ACESSAR_CICLO', 'FC_PODE_EDITAR_SUBMISSAO', 'FC_PODE_REGISTRAR_PRESENCA', 'FC_PODE_VER_PRESENCA', 'FC_PREVISUALIZAR_PUBLICO', 'FC_REIVINDICAR_ACESSO', 'FC_REIVINDICAR_EMAILS', 'FC_REMOVER_PESSOA_EQUIPE', 'FC_REMOVER_RESPOSTA_PESSOA', 'FC_REORDENAR_ITEM_CONSTRUTOR', 'FC_RESOLVER_PESSOA_AUTENTIC', 'FC_RESOLVER_PUBLICO_AVALIACAO', 'FC_RESUMO_BASE_PESSOAS', 'FC_SALVAR_REGRA_CONDICIONAL', 'FC_SALVAR_RESPOSTA_CDDI', 'FC_SALVAR_RESPOSTA_PESQUISA', 'FC_SAUDE_PLATAFORMA', 'FC_SINCRONIZAR_ESTADO_CICLOS', 'FC_SINCR_AVATAR_GOOGLE', 'FC_SINCR_LINHAS_BASE_PESSOA', 'FC_SINCR_LINHAS_GESTOR_CDDI', 'FC_SINCR_RESP_LIDERANCA', 'FC_SINCR_RESP_LIDER_NOVA', 'FC_SINCR_RESP_TECNICA_CDDI', 'FC_SRV_RESOLVER_IDENT_OAUTH', 'FC_VALIDAR_CICLO_ANONIMO', 'FC_VALIDAR_FOTO_GOOGLE', 'FC_VALIDAR_INTEGRIDADE_VERSAO', 'FC_VALIDAR_OPCAO_RESPOSTA', 'FC_VALIDAR_PARTIC_SUBMISSAO', 'FC_VALIDAR_PERGUNTA_RESPOSTA', 'FC_VALIDAR_RESULT_FINAL_CDDI', 'FC_VALIDAR_SUBMISSAO_CDDI'];
  v_velhos_exclusivos text[] := array['co_configuracao', 'no_organizacao', 'no_produto', 'tx_url_logotipo', 'tx_caminho_logotipo', 'co_cor_principal', 'au_usuario_alteracao', 'dt_alteracao', 'tx_url_fundo_acesso', 'tx_caminho_fundo_acesso', 'co_cor_painel_acesso', 'ds_produto', 'tx_saudacao_acesso', 'tx_instrucao_acesso', 'co_cor_barra_lateral', 'fl_presenca_online_ativa', 'tx_perfis_visualizacao_presenca', 'tx_instrucao_email', 'tx_rodape_email', 'nu_dias_retencao_rascunho_anonimo', 'fl_comunicado_inicio_ativo', 'tx_comunicado_inicio_titulo', 'tx_comunicado_inicio_mensagem', 'tx_comunicado_inicio_link', 'tx_comunicado_inicio_rotulo_link', 'id', 'application_id', 'leader_person_id', 'subordinate_person_id', 'status', 'valid_from', 'valid_to', 'origin', 'source_key', 'metadata', 'created_at', 'updated_at', 'submission_id', 'question_id', 'answer_text', 'answer_number', 'answer_boolean', 'answer_date', 'answer_datetime', 'answer_json', 'score', 'code', 'label', 'value', 'position', 'active', 'survey_version_id', 'parent_section_id', 'title', 'description', 'settings', 'name', 'owner_unit_id', 'created_by', 'st_modelo', 'tx_categoria_modelo', 'dt_arquivamento', 'participant_id', 'respondent_person_id', 'subject_person_id', 'submission_type', 'started_at', 'submitted_at', 'version', 'calculated_result', 'section_id', 'question_type', 'required', 'validation', 'display_logic', 'scoring', 'actor_person_id', 'event_type', 'entity_type', 'entity_id', 'request_id', 'ip_address', 'user_agent', 'before_data', 'after_data', 'person_id', 'participant_role', 'access_profile', 'invited_at', 'completed_at', 'survey_id', 'version_number', 'schema_version', 'published_at', 'auth_user_id', 'employee_number', 'full_name', 'institutional_email', 'job_title', 'cost_center', 'organizational_unit_id', 'workplace', 'employment_status', 'source_system', 'opens_at', 'closes_at', 'allow_drafts', 'allow_resubmission', 'anonymous', 'access_mode', 'nu_limiar_anonimato', 'st_notificacao_email', 'provider_id', 'user_id', 'identity_data', 'provider', 'last_sign_in_at', 'email', 'instance_id', 'aud', 'role', 'encrypted_password', 'email_confirmed_at', 'confirmation_token', 'confirmation_sent_at', 'recovery_token', 'recovery_sent_at', 'email_change_token_new', 'email_change', 'email_change_sent_at', 'raw_app_meta_data', 'raw_user_meta_data', 'is_super_admin', 'phone', 'phone_confirmed_at', 'phone_change', 'phone_change_token', 'phone_change_sent_at', 'confirmed_at', 'email_change_token_current', 'email_change_confirm_status', 'banned_until', 'reauthentication_token', 'reauthentication_sent_at', 'is_sso_user', 'deleted_at', 'is_anonymous']::text[];
  v_sobras_aceitas text[] := array['FC_ATUALIZAR_MARCA_PLATAFORMA|position', 'FC_ATUALIZAR_PERGUNTA|question_type', 'FC_ATUALIZAR_VISUAL_CICLO|position', 'FC_CONDICAO_ATENDIDA|position', 'FC_LISTAR_ENVIOS_EMAIL|id']::text[];
  v_fora text;
begin
  select string_agg(c.relname || '.' || a.attname, ', ' order by c.relname, a.attname) into v_fora
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
   where c.relnamespace = 'sigav'::regnamespace
     and c.relname = any(v_tabelas)
     and a.attnum > 0 and not a.attisdropped
     and (
       a.attname <> upper(a.attname)
       or a.attname !~ '^(CO|SQ|DT|HR|DS|NO|NU|QT|VL|TX|SG|ST|TP|IM|CG|AU)_'
     );
  if v_fora is not null then
    raise exception 'Colunas fora do item 7: %', v_fora;
  end if;

  -- Rede contra o esquecimento: acusa funcao que toca as tabelas deste lote e
  -- NAO esta na lista revisada. Comentario nao conta: varias funcoes citam a
  -- tabela so em prosa, e isso nao e referencia a coluna.
  select string_agg(distinct nome, ', ' order by nome) into v_fora
    from (
      -- Quem escreve o nome da tabela.
      select p.proname as nome
        from pg_proc p, unnest(v_tabelas) t(tabela)
       where p.pronamespace = 'sigav'::regnamespace
         and regexp_replace(pg_get_functiondef(p.oid), '^[[:space:]]*--.*$', '', 'gn')
             ~ ('sigav[.]"' || t.tabela || '"')
      union
      -- E quem chega às colunas por new/old, sem nunca nomear a tabela.
      -- Foi assim que FC_VALIDAR_RESULT_FINAL_CDDI quase escapou deste lote.
      select p.proname
        from pg_trigger tg
        join pg_class cl on cl.oid = tg.tgrelid
        join pg_proc p on p.oid = tg.tgfoid
       where cl.relnamespace = 'sigav'::regnamespace
         and not tg.tgisinternal
         and cl.relname = any(v_tabelas)
         -- Fora quem atende os DOIS estados da nomenclatura testando o campo
         -- (FC_DEFINIR_DT_ALTERACAO, reparada em 20260831200000). Essa nao
         -- precisa de edicao por lote: e justamente o que ela resolve.
         and pg_get_functiondef(p.oid) !~ 'to_jsonb[(]new[)][[:space:]]*[?]'
    ) tocam
   where not (nome = any(v_revisadas));
  if v_fora is not null then
    raise exception 'Funcoes tocam tabelas deste lote e nao foram revisadas: %', v_fora;
  end if;

  -- Sobra: corpo de função que ainda menciona o nome ANTIGO de uma coluna
  -- deste lote. Vale só para os nomes exclusivos das tabelas do lote — nome
  -- que outra tabela também usa apareceria aqui por motivo legítimo.
  --
  -- Comentário e literal saem antes da conferência: o comentário cita o nome
  -- antigo para explicar a mudança, e literal é chave JSON, que é contrato com
  -- a tela e não se renomeia.
  select string_agg(distinct p.proname || ' -> ' || v.coluna, ', ' order by p.proname || ' -> ' || v.coluna)
    into v_fora
    from pg_proc p, unnest(v_velhos_exclusivos) v(coluna)
   where p.pronamespace = 'sigav'::regnamespace
     and not exists (
       select 1 from pg_depend dep
        where dep.classid = 'pg_proc'::regclass
          and dep.objid = p.oid
          and dep.deptype = 'e'
     )
     and cardinality(v_velhos_exclusivos) > 0
     and not (p.proname || '|' || v.coluna = any(v_sobras_aceitas))
     and regexp_replace(
           regexp_replace(
             regexp_replace(split_part(pg_get_functiondef(p.oid), '$function$', 2), '/[*].*?[*]/', '', 'gs'),
             '--[^' || chr(10) || ']*', '', 'g'),
           '''([^'']|'''''')*''', '''''', 'g')
         ~ ('\m' || v.coluna || '\M');
  if v_fora is not null then
    raise exception 'Sobrou referência ao nome antigo da coluna: %', v_fora;
  end if;

  -- Constraint citada por nome dentro de corpo de funcao. Renomear a
  -- constraint sem trocar a citacao quebra em execucao, e a reescrita por TOKEN
  -- so mexe em nome de COLUNA. Foi assim que FC_ARQ_GRAVAR ficou apontando para
  -- uma constraint inexistente entre 20260831150000 e 20260831220000.
  select string_agg(distinct p.proname || ' -> ' || m[2], ', ' order by p.proname || ' -> ' || m[2])
    into v_fora
    from pg_proc p
    cross join lateral regexp_matches(
      regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g'),
      'on[[:space:]]+constraint[[:space:]]+("?)([a-zA-Z_][a-zA-Z_0-9]*)\1', 'gi') as m
   where p.pronamespace = 'sigav'::regnamespace
     and p.prokind = 'f'
     and not exists (
       select 1 from pg_constraint con
         join pg_class rel on rel.oid = con.conrelid
        where rel.relnamespace = 'sigav'::regnamespace
          and con.conname = case when m[1] = '' then lower(m[2]) else m[2] end);
  if v_fora is not null then
    raise exception 'Funcao cita constraint que nao existe mais: %', v_fora;
  end if;

  raise notice 'nomenclatura lote 6: 226 colunas em 15 tabelas';
end
$verificacao$;

commit;
