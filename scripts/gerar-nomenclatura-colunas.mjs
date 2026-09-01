// Gera a migration que põe COLUNAS de um lote de tabelas de `sigav` no padrão
// institucional da AgSUS — item 7 (prefixo semântico) e item 3 (MAIÚSCULAS,
// português, no máximo 30 caracteres).
//
// Feito por LOTE, e não de uma vez, porque corpo de PL/pgSQL resolve
// identificador em execução: referência errada a coluna não falha na criação da
// função, falha em produção. A suíte cobre 24 das 174 funções, e
// `plpgsql_check` não existe neste cluster. Então cada lote é aplicado e
// validado antes do seguinte, começando pelas tabelas que nenhuma função toca.
//
// Uso: node --env-file=.env.local <este arquivo> <lote> > saida.sql

import pg from "pg";
import { readFile, writeFile } from "node:fs/promises";

// Marca a função cuja reescrita é feita por TOKEN, e não por trecho escrito à
// mão. Ver POR_TOKEN, mais abaixo, para as duas provas que o gerador exige
// antes de aceitar.
const AUTO = "AUTO_POR_TOKEN";
const AUTO_ESCOPO = "AUTO_POR_ESCOPO";
const autoPorToken = (tabelas, excluir = [], edicoes = []) => ({
  modo: AUTO,
  tabelas,
  excluir,
  edicoes,
});

// Vocabulário extraído das 108 colunas que o projeto já havia nomeado no
// padrão. `created_at`/`updated_at` viram DT_INCLUSAO/DT_ALTERACAO por
// formarem par com AU_USUARIO_INCLUSAO/AU_USUARIO_ALTERACAO, que é o exemplo
// do próprio manual (item 7, `AU_USUARIOINCLUSAO`). `jsonb` recebe DS_, como
// em `tl_erro_aplicacao.ds_contexto`.
const LOTES = {
  // Lote 1 — nenhuma função referencia estas tabelas.
  1: {
    TB_CATALOGO_OBJETO: {
      // Já estavam prefixadas: aqui muda só a caixa.
      sq_catalogo: "SQ_CATALOGO",
      sg_schema_atual: "SG_SCHEMA_ATUAL",
      no_objeto_atual: "NO_OBJETO_ATUAL",
      tp_objeto: "TP_OBJETO",
      no_objeto_proposto: "NO_OBJETO_PROPOSTO",
      st_conformidade: "ST_CONFORMIDADE",
      ds_justificativa: "DS_JUSTIFICATIVA",
      ds_estrategia_migracao: "DS_ESTRATEGIA_MIGRACAO",
      st_registro_ativo: "ST_REGISTRO_ATIVO",
      au_usuario_inclusao: "AU_USUARIO_INCLUSAO",
      dt_inclusao: "DT_INCLUSAO",
      au_usuario_alteracao: "AU_USUARIO_ALTERACAO",
      dt_alteracao: "DT_ALTERACAO",
    },
    TB_CORRECAO_VINCULO_CDDI: {
      id: "SQ_CORRECAO",
      application_id: "SQ_APLICACAO",
      requester_person_id: "SQ_PESSOA_SOLICITANTE",
      current_leader_person_id: "SQ_LIDER_ATUAL",
      proposed_leader_person_id: "SQ_LIDER_PROPOSTO",
      justification: "DS_JUSTIFICATIVA",
      status: "ST_SITUACAO",
      analyzed_by: "AU_USUARIO_ANALISE",
      analyzed_at: "DT_ANALISE",
      admin_notes: "DS_OBSERVACAO_ADMIN",
      source_key: "CO_ORIGEM",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
    },
    TB_LOTE_IMPORTACAO: {
      id: "SQ_LOTE",
      source_name: "NO_ORIGEM",
      source_file_id: "CO_ARQUIVO_ORIGEM",
      source_version: "CO_VERSAO_ORIGEM",
      entity_type: "TP_ENTIDADE",
      status: "ST_SITUACAO",
      received_rows: "QT_LINHA_RECEBIDA",
      accepted_rows: "QT_LINHA_ACEITA",
      rejected_rows: "QT_LINHA_REJEITADA",
      warning_rows: "QT_LINHA_ALERTA",
      checksum: "CO_VERIFICACAO",
      executed_by: "AU_USUARIO_EXECUCAO",
      started_at: "DT_INICIO",
      completed_at: "DT_CONCLUSAO",
      metadata: "DS_METADADO",
    },
    TB_OCORRENCIA_IMPORTACAO: {
      id: "SQ_OCORRENCIA",
      batch_id: "SQ_LOTE",
      row_number: "NU_LINHA",
      entity_key: "CO_ENTIDADE",
      severity: "TP_SEVERIDADE",
      issue_code: "CO_OCORRENCIA",
      message: "DS_MENSAGEM",
      payload: "DS_CONTEUDO",
      resolved_at: "DT_RESOLUCAO",
      resolved_by: "AU_USUARIO_RESOLUCAO",
      created_at: "DT_INCLUSAO",
    },
    TB_PREFERENCIA_USUARIO: {
      id: "SQ_PREFERENCIA",
      person_id: "SQ_PESSOA",
      preference_key: "CO_PREFERENCIA",
      preference_value: "DS_VALOR",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
    },
    TB_UNIDADE_ORGANIZACIONAL: {
      id: "SQ_UNIDADE",
      parent_id: "SQ_UNIDADE_PAI",
      code: "CO_UNIDADE",
      name: "NO_UNIDADE",
      unit_type: "TP_UNIDADE",
      active: "ST_ATIVO",
      metadata: "DS_METADADO",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
    },
  },
  // Lote 2 — 1 ou 2 funções por tabela, todas revisadas linha a linha.
  // O par do GoTrue (TB_IDENTIDADE_OAUTH e TB_USUARIO_IDENTIDADE) fica fora:
  // lá `email`, `provider` e `provider_id` são coluna E chave JSON dentro da
  // MESMA função, e as duas tabelas repetem os nomes de coluna entre si.
  2: {
    TB_LIMITE_REQUISICAO_PUBLICA: {
      no_escopo: "NO_ESCOPO",
      co_chave: "CO_CHAVE",
      dt_janela: "DT_JANELA",
      nu_requisicoes: "NU_REQUISICOES",
      dt_atualizacao: "DT_ATUALIZACAO",
    },
    TB_MIGRACAO: {
      co_versao: "CO_VERSAO",
      no_migracao: "NO_MIGRACAO",
      ds_hash: "DS_HASH",
      no_origem: "NO_ORIGEM",
      dt_aplicacao: "DT_APLICACAO",
    },
    TL_ERRO_APLICACAO: {
      sq_erro: "SQ_ERRO",
      co_referencia: "CO_REFERENCIA",
      no_rota: "NO_ROTA",
      tp_erro: "TP_ERRO",
      ds_mensagem: "DS_MENSAGEM",
      ds_contexto: "DS_CONTEXTO",
      st_ambiente: "ST_AMBIENTE",
      nu_http_status: "NU_HTTP_STATUS",
      dt_ocorrencia: "DT_OCORRENCIA",
    },
    TB_PRESENCA_ONLINE: {
      sq_pessoa: "SQ_PESSOA",
      dt_visto_em: "DT_VISTO_EM",
    },
    TB_DOMINIO_INSTITUCIONAL: {
      domain: "NO_DOMINIO",
      active: "ST_ATIVO",
      created_at: "DT_INCLUSAO",
    },
    RL_PESSOA_MODULO: {
      person_id: "SQ_PESSOA",
      module_code: "CO_MODULO",
      allowed: "ST_PERMITIDO",
      granted_by: "AU_USUARIO_CONCESSAO",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
    },
  },
  // Lote 3 — 3 funções por tabela, todas revisadas linha a linha.
  //
  // TB_BILHETE_ANONIMO já nasceu com prefixo semântico; aqui muda a caixa, e
  // `dt_criacao` passa a `DT_INCLUSAO` para não deixar duas palavras vivas para
  // o mesmo conceito (dez tabelas já usam DT_INCLUSAO). Nenhuma função cita
  // essa coluna.
  3: {
    TB_BILHETE_ANONIMO: {
      sq_bilhete: "SQ_BILHETE",
      sq_aplicacao: "SQ_APLICACAO",
      sq_pessoa: "SQ_PESSOA",
      sq_submissao: "SQ_SUBMISSAO",
      dt_criacao: "DT_INCLUSAO",
    },
    TB_IDENTIDADE_ACESSO: {
      id: "SQ_IDENTIDADE",
      person_id: "SQ_PESSOA",
      identity_type: "TP_IDENTIDADE",
      // NO_ para endereço de e-mail: é o identificador por extenso da
      // identidade, e é assim que a base de pessoas do SUS o nomeia. DS_ é
      // descrição livre, que um e-mail não é.
      email: "NO_EMAIL",
      status: "ST_SITUACAO",
      // Sistema de onde a identidade veio ('SUPABASE_AUTH',
      // 'AGSUS_PEOPLE_BASE') — mesmo sentido de TB_LOTE_IMPORTACAO.NO_ORIGEM.
      source: "NO_ORIGEM",
      verified_at: "DT_VERIFICACAO",
      revoked_at: "DT_REVOGACAO",
      metadata: "DS_METADADO",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
    },
    TB_MODULO_PLATAFORMA: {
      // CO_MODULO é o nome que RL_PESSOA_MODULO já usa para apontar para cá.
      code: "CO_MODULO",
      name: "NO_MODULO",
      description: "DS_MODULO",
      category: "TP_CATEGORIA",
      // Ordem de exibição, não coordenada: NU_ (número), como NU_LINHA.
      position: "NU_ORDEM",
      active: "ST_ATIVO",
      created_at: "DT_INCLUSAO",
    },
    TB_RESULTADO_COMPET_CDDI: {
      id: "SQ_RESULTADO",
      submission_id: "SQ_SUBMISSAO",
      competency_section_id: "SQ_SECAO_COMPETENCIA",
      // numeric(6,4): VL_ (valor numérico), item 7.
      behavior_average: "VL_MEDIA_COMPORTAMENTO",
      development_level: "VL_NIVEL_DESENVOLVIMENTO",
      result: "VL_RESULTADO",
      calculation_version: "CO_VERSAO_CALCULO",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
    },
  },
  // Lote 4 — duas tabelas já prefixadas (troca por token) e uma inteira em
  // inglês (trecho por trecho, à mão).
  //
  // `dt_criacao`/`dt_atualizacao` viram DT_INCLUSAO/DT_ALTERACAO: não é
  // exigência do padrão — as duas já conformavam —, é tirar da frente a segunda
  // grafia do mesmo conceito. Dez tabelas já usam DT_INCLUSAO, e o par com
  // AU_USUARIO_INCLUSAO/AU_USUARIO_ALTERACAO é o exemplo do manual (item 7).
  // Feito agora porque estas funções já estão sendo reescritas neste lote;
  // deixar para depois significaria reescrever as mesmas funções duas vezes.
  4: {
    TB_ARQUIVO: {
      sq_arquivo: "SQ_ARQUIVO",
      co_balde: "CO_BALDE",
      ds_caminho: "DS_CAMINHO",
      tp_conteudo: "TP_CONTEUDO",
      nu_tamanho: "NU_TAMANHO",
      im_conteudo: "IM_CONTEUDO",
      co_autor: "CO_AUTOR",
      dt_criacao: "DT_INCLUSAO",
      dt_atualizacao: "DT_ALTERACAO",
    },
    TL_EMAIL_PARTICIPANTE: {
      sq_email: "SQ_EMAIL",
      sq_aplicacao: "SQ_APLICACAO",
      sq_pessoa: "SQ_PESSOA",
      tp_email: "TP_EMAIL",
      st_envio: "ST_ENVIO",
      ds_erro: "DS_ERRO",
      dt_envio: "DT_ENVIO",
      dt_criacao: "DT_INCLUSAO",
      dt_atualizacao: "DT_ALTERACAO",
      co_reivindicacao: "CO_REIVINDICACAO",
      nu_tentativas: "NU_TENTATIVAS",
      // Único nome inglês que restava aqui. É o Message-ID do SMTP (RFC 5322),
      // e o sufixo SMTP preserva a referência ao cabeçalho.
      co_message_id: "CO_MENSAGEM_SMTP",
      dt_transporte: "DT_TRANSPORTE",
    },
    TB_RESULTADO_FINAL_CDDI: {
      id: "SQ_RESULTADO",
      application_id: "SQ_APLICACAO",
      subject_person_id: "SQ_PESSOA_AVALIADA",
      auto_submission_id: "SQ_SUBMISSAO_AUTO",
      leader_submission_id: "SQ_SUBMISSAO_LIDER",
      // numeric(6,4) de 1 a 5: VL_ (valor numérico), item 7.
      auto_score: "VL_NOTA_AUTO",
      leader_score: "VL_NOTA_LIDER",
      final_score: "VL_NOTA_FINAL",
      status: "ST_SITUACAO",
      calculation_version: "CO_VERSAO_CALCULO",
      calculated_at: "DT_CALCULO",
      published_at: "DT_PUBLICACAO",
      metadata: "DS_METADADO",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
    },
  },
  // Lote 5 — regras condicionais e as opções escolhidas em uma resposta.
  //
  // As colunas das duas tabelas de regra são exclusivas no schema, exceto
  // `dt_alteracao` (também presente em TB_CONFIG_PLATAFORMA); como nenhuma
  // função deste lote cita essa data, ela fica fora da troca por token. Na
  // relação de respostas, `position` e `created_at` aparecem em várias outras
  // tabelas, e `option_id` também é alias de UNNEST: as 14 funções dessa tabela
  // são, por isso, reescritas com trechos contextuais.
  5: {
    TB_CONDICAO_REGRA: {
      sq_condicao: "SQ_CONDICAO",
      sq_regra: "SQ_REGRA",
      sq_pergunta_origem: "SQ_PERGUNTA_ORIGEM",
      tp_operador: "TP_OPERADOR",
      sq_opcao: "SQ_OPCAO",
      // Texto livre, não taxa numérica (TX_ no item 7 do padrão).
      tx_valor: "DS_VALOR",
      nu_valor: "NU_VALOR",
      nu_ordem: "NU_ORDEM",
    },
    TB_REGRA_CONDICIONAL: {
      sq_regra: "SQ_REGRA",
      sq_versao_pesquisa: "SQ_VERSAO_PESQUISA",
      tp_alvo: "TP_ALVO",
      sq_alvo: "SQ_ALVO",
      tp_acao: "TP_ACAO",
      tp_conector: "TP_CONECTOR",
      ds_regra: "DS_REGRA",
      st_ativo: "ST_ATIVO",
      au_usuario_inclusao: "AU_USUARIO_INCLUSAO",
      dt_inclusao: "DT_INCLUSAO",
      dt_alteracao: "DT_ALTERACAO",
    },
    RL_RESPOSTA_OPCAO: {
      answer_id: "SQ_RESPOSTA",
      option_id: "SQ_OPCAO",
      position: "NU_ORDEM",
      created_at: "DT_INCLUSAO",
    },
  },
  // Lote 6 — fechamento: todas as 226 colunas ainda pendentes. Este lote é
  // atômico para que nenhuma função atravesse dois vocabulários intermediários.
  6: {
    TB_CONFIG_PLATAFORMA: {
      co_configuracao: "CO_CONFIGURACAO",
      no_organizacao: "NO_ORGANIZACAO",
      no_produto: "NO_PRODUTO",
      tx_url_logotipo: "DS_URL_LOGOTIPO",
      tx_caminho_logotipo: "DS_CAMINHO_LOGOTIPO",
      co_cor_principal: "CO_COR_PRINCIPAL",
      au_usuario_alteracao: "AU_USUARIO_ALTERACAO",
      dt_alteracao: "DT_ALTERACAO",
      tx_url_fundo_acesso: "DS_URL_FUNDO_ACESSO",
      tx_caminho_fundo_acesso: "DS_CAMINHO_FUNDO_ACESSO",
      co_cor_painel_acesso: "CO_COR_PAINEL_ACESSO",
      ds_produto: "DS_PRODUTO",
      tx_saudacao_acesso: "DS_SAUDACAO_ACESSO",
      tx_instrucao_acesso: "DS_INSTRUCAO_ACESSO",
      co_cor_barra_lateral: "CO_COR_BARRA_LATERAL",
      fl_presenca_online_ativa: "ST_PRESENCA_ONLINE_ATIVA",
      tx_perfis_visualizacao_presenca: "DS_PERFIS_VISUALIZACAO",
      tx_instrucao_email: "DS_INSTRUCAO_EMAIL",
      tx_rodape_email: "DS_RODAPE_EMAIL",
      nu_dias_retencao_rascunho_anonimo: "NU_DIAS_RETENCAO_RASC_ANON",
      fl_comunicado_inicio_ativo: "ST_COMUNICADO_INICIO_ATIVO",
      tx_comunicado_inicio_titulo: "NO_COMUNICADO_INICIO",
      tx_comunicado_inicio_mensagem: "DS_COMUNICADO_INICIO_MENSAGEM",
      tx_comunicado_inicio_link: "DS_COMUNICADO_INICIO_LINK",
      tx_comunicado_inicio_rotulo_link: "DS_COMUNICADO_INICIO_ROTULO",
    },
    RT_LIDERANCA_CDDI: {
      id: "SQ_LIDERANCA",
      application_id: "SQ_APLICACAO",
      leader_person_id: "SQ_PESSOA_LIDER",
      subordinate_person_id: "SQ_PESSOA_SUBORDINADA",
      status: "ST_SITUACAO",
      valid_from: "DT_INICIO_VIGENCIA",
      valid_to: "DT_FIM_VIGENCIA",
      origin: "TP_ORIGEM",
      source_key: "CO_CHAVE_ORIGEM",
      metadata: "DS_METADADO",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
    },
    TB_RESPOSTA: {
      id: "SQ_RESPOSTA",
      submission_id: "SQ_SUBMISSAO",
      question_id: "SQ_PERGUNTA",
      answer_text: "DS_RESPOSTA",
      answer_number: "NU_RESPOSTA",
      answer_boolean: "ST_RESPOSTA",
      answer_date: "DT_RESPOSTA",
      answer_datetime: "DT_HORA_RESPOSTA",
      answer_json: "DS_RESPOSTA_JSON",
      score: "VL_NOTA",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
    },
    TB_OPCAO_PERGUNTA: {
      id: "SQ_OPCAO",
      question_id: "SQ_PERGUNTA",
      code: "CO_OPCAO",
      label: "NO_OPCAO",
      value: "DS_VALOR",
      score: "VL_NOTA",
      position: "NU_ORDEM",
      active: "ST_ATIVO",
      metadata: "DS_METADADO",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
    },
    TB_SECAO_PESQUISA: {
      id: "SQ_SECAO",
      survey_version_id: "SQ_VERSAO_PESQUISA",
      parent_section_id: "SQ_SECAO_PAI",
      code: "CO_SECAO",
      title: "NO_SECAO",
      description: "DS_SECAO",
      position: "NU_ORDEM",
      settings: "DS_CONFIGURACAO",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
    },
    TB_PESQUISA: {
      id: "SQ_PESQUISA",
      code: "CO_PESQUISA",
      name: "NO_PESQUISA",
      description: "DS_PESQUISA",
      owner_unit_id: "SQ_UNIDADE_RESPONSAVEL",
      status: "ST_SITUACAO",
      settings: "DS_CONFIGURACAO",
      created_by: "AU_USUARIO_INCLUSAO",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
      st_modelo: "ST_MODELO",
      tx_categoria_modelo: "TP_CATEGORIA_MODELO",
      dt_arquivamento: "DT_ARQUIVAMENTO",
    },
    TB_SUBMISSAO: {
      id: "SQ_SUBMISSAO",
      application_id: "SQ_APLICACAO",
      participant_id: "SQ_PARTICIPANTE",
      respondent_person_id: "SQ_PESSOA_RESPONDENTE",
      subject_person_id: "SQ_PESSOA_AVALIADA",
      submission_type: "TP_SUBMISSAO",
      status: "ST_SITUACAO",
      started_at: "DT_INICIO",
      submitted_at: "DT_ENVIO",
      version: "NU_VERSAO",
      calculated_result: "VL_RESULTADO",
      metadata: "DS_METADADO",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
    },
    TB_PERGUNTA_PESQUISA: {
      id: "SQ_PERGUNTA",
      survey_version_id: "SQ_VERSAO_PESQUISA",
      section_id: "SQ_SECAO",
      code: "CO_PERGUNTA",
      title: "NO_PERGUNTA",
      description: "DS_PERGUNTA",
      question_type: "TP_PERGUNTA",
      required: "ST_OBRIGATORIA",
      position: "NU_ORDEM",
      validation: "DS_VALIDACAO",
      display_logic: "DS_LOGICA_EXIBICAO",
      scoring: "DS_PONTUACAO",
      settings: "DS_CONFIGURACAO",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
    },
    TL_EVENTO_AUDITORIA: {
      id: "SQ_EVENTO",
      actor_person_id: "SQ_PESSOA_ATOR",
      event_type: "TP_EVENTO",
      entity_type: "TP_ENTIDADE",
      entity_id: "CO_ENTIDADE",
      application_id: "SQ_APLICACAO",
      request_id: "CO_REQUISICAO",
      ip_address: "CO_ENDERECO_IP",
      user_agent: "DS_AGENTE_USUARIO",
      before_data: "DS_DADO_ANTERIOR",
      after_data: "DS_DADO_POSTERIOR",
      metadata: "DS_METADADO",
      created_at: "DT_INCLUSAO",
    },
    RL_APLICACAO_PESSOA: {
      id: "SQ_PARTICIPANTE",
      application_id: "SQ_APLICACAO",
      person_id: "SQ_PESSOA",
      participant_role: "TP_PARTICIPANTE",
      status: "ST_SITUACAO",
      access_profile: "TP_ACESSO",
      invited_at: "DT_CONVITE",
      started_at: "DT_INICIO",
      completed_at: "DT_CONCLUSAO",
      metadata: "DS_METADADO",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
    },
    TH_VERSAO_PESQUISA: {
      id: "SQ_VERSAO_PESQUISA",
      survey_id: "SQ_PESQUISA",
      version_number: "NU_VERSAO",
      title: "NO_VERSAO",
      description: "DS_VERSAO",
      status: "ST_SITUACAO",
      schema_version: "NU_VERSAO_SCHEMA",
      settings: "DS_CONFIGURACAO",
      published_at: "DT_PUBLICACAO",
      created_by: "AU_USUARIO_INCLUSAO",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
    },
    TB_PESSOA: {
      id: "SQ_PESSOA",
      auth_user_id: "SQ_USUARIO_IDENTIDADE",
      employee_number: "CO_MATRICULA",
      full_name: "NO_PESSOA",
      institutional_email: "DS_EMAIL_INSTITUCIONAL",
      job_title: "NO_CARGO",
      cost_center: "CO_CENTRO_CUSTO",
      organizational_unit_id: "SQ_UNIDADE_ORGANIZACIONAL",
      workplace: "NO_LOCAL_TRABALHO",
      employment_status: "ST_VINCULO",
      active: "ST_ATIVO",
      source_system: "CO_SISTEMA_ORIGEM",
      source_key: "CO_CHAVE_ORIGEM",
      metadata: "DS_METADADO",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
    },
    TB_APLICACAO_PESQUISA: {
      id: "SQ_APLICACAO",
      survey_version_id: "SQ_VERSAO_PESQUISA",
      code: "CO_APLICACAO",
      name: "NO_APLICACAO",
      opens_at: "DT_ABERTURA",
      closes_at: "DT_ENCERRAMENTO",
      status: "ST_SITUACAO",
      allow_drafts: "ST_PERMITE_RASCUNHO",
      allow_resubmission: "ST_PERMITE_REENVIO",
      anonymous: "ST_ANONIMA",
      settings: "DS_CONFIGURACAO",
      created_by: "AU_USUARIO_INCLUSAO",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
      access_mode: "TP_ACESSO",
      nu_limiar_anonimato: "NU_LIMIAR_ANONIMATO",
      st_notificacao_email: "ST_NOTIFICACAO_EMAIL",
    },
    TB_IDENTIDADE_OAUTH: {
      provider_id: "CO_IDENTIFICADOR_PROVEDOR",
      user_id: "SQ_USUARIO",
      identity_data: "DS_DADO_IDENTIDADE",
      provider: "NO_PROVEDOR",
      last_sign_in_at: "DT_ULTIMO_ACESSO",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
      email: "DS_EMAIL",
      id: "SQ_IDENTIDADE",
    },
    TB_USUARIO_IDENTIDADE: {
      instance_id: "SQ_INSTANCIA",
      id: "SQ_USUARIO",
      aud: "TP_AUDIENCIA",
      role: "TP_PAPEL",
      email: "DS_EMAIL",
      encrypted_password: "DS_SENHA_CRIPTOGRAFADA",
      email_confirmed_at: "DT_CONFIRMACAO_EMAIL",
      invited_at: "DT_CONVITE",
      confirmation_token: "CO_TOKEN_CONFIRMACAO",
      confirmation_sent_at: "DT_ENVIO_CONFIRMACAO",
      recovery_token: "CO_TOKEN_RECUPERACAO",
      recovery_sent_at: "DT_ENVIO_RECUPERACAO",
      email_change_token_new: "CO_TOKEN_NOVO_EMAIL",
      email_change: "DS_NOVO_EMAIL",
      email_change_sent_at: "DT_ENVIO_ALTERACAO_EMAIL",
      last_sign_in_at: "DT_ULTIMO_ACESSO",
      raw_app_meta_data: "DS_METADADO_APLICACAO",
      raw_user_meta_data: "DS_METADADO_USUARIO",
      is_super_admin: "ST_SUPERADMINISTRADOR",
      created_at: "DT_INCLUSAO",
      updated_at: "DT_ALTERACAO",
      phone: "NU_TELEFONE",
      phone_confirmed_at: "DT_CONFIRMACAO_TELEFONE",
      phone_change: "NU_NOVO_TELEFONE",
      phone_change_token: "CO_TOKEN_ALTERACAO_TELEFONE",
      phone_change_sent_at: "DT_ENVIO_ALTERACAO_TELEFONE",
      confirmed_at: "DT_CONFIRMACAO",
      email_change_token_current: "CO_TOKEN_EMAIL_ATUAL",
      email_change_confirm_status: "ST_CONFIRMACAO_ALTERACAO_EMAIL",
      banned_until: "DT_BLOQUEIO_ATE",
      reauthentication_token: "CO_TOKEN_REAUTENTICACAO",
      reauthentication_sent_at: "DT_ENVIO_REAUTENTICACAO",
      is_sso_user: "ST_USUARIO_SSO",
      deleted_at: "DT_EXCLUSAO",
      is_anonymous: "ST_ANONIMO",
    },
  },
};

// Forma curta por tabela, para constraint/índice dentro dos 30 caracteres.
const CODIGO = {
  TB_CATALOGO_OBJETO: "catalogo_obj",
  TB_CORRECAO_VINCULO_CDDI: "corr_vinc_cddi",
  TB_LOTE_IMPORTACAO: "lote_imp",
  TB_OCORRENCIA_IMPORTACAO: "ocorr_imp",
  TB_PREFERENCIA_USUARIO: "pref_usu",
  TB_UNIDADE_ORGANIZACIONAL: "unid_org",
  TB_PESSOA: "pessoa", TB_IDENTIDADE_ACESSO: "ident_acesso",
  TB_DOMINIO_INSTITUCIONAL: "dom_inst", TB_MODULO_PLATAFORMA: "mod_plat",
  RL_PESSOA_MODULO: "pessoa_mod", TB_PESQUISA: "pesq",
  TH_VERSAO_PESQUISA: "versao_pesq", TB_SECAO_PESQUISA: "secao_pesq",
  TB_PERGUNTA_PESQUISA: "perg_pesq", TB_OPCAO_PERGUNTA: "opcao_perg",
  TB_APLICACAO_PESQUISA: "aplic_pesq", RL_APLICACAO_PESSOA: "aplic_pessoa",
  TB_SUBMISSAO: "subm", TB_RESPOSTA: "resp", RL_RESPOSTA_OPCAO: "resp_opcao",
  RT_LIDERANCA_CDDI: "lider_cddi", TB_RESULTADO_COMPET_CDDI: "res_comp_cddi",
  TB_RESULTADO_FINAL_CDDI: "res_final_cddi", TL_EVENTO_AUDITORIA: "audit",
  TB_ARQUIVO: "arquivo", TB_BILHETE_ANONIMO: "bilhete_anon",
  TB_CONDICAO_REGRA: "cond_regra", TB_CONFIG_PLATAFORMA: "config_plat",
  TB_IDENTIDADE_OAUTH: "ident_oauth", TB_LIMITE_REQUISICAO_PUBLICA: "limite_req",
  TB_MIGRACAO: "migracao", TB_PRESENCA_ONLINE: "presenca",
  TB_REGRA_CONDICIONAL: "regra_cond", TB_USUARIO_IDENTIDADE: "usu_ident",
  TL_EMAIL_PARTICIPANTE: "email_part", TL_ERRO_APLICACAO: "erro_aplic",
};

const regrasLote5 = (edicoes = []) => autoPorToken(
  ["TB_CONDICAO_REGRA", "TB_REGRA_CONDICIONAL"],
  ["dt_alteracao"],
  edicoes,
);


// Reescrita de corpo, por função. Cada par foi conferido contra a linha real:
// onde o nome da coluna também é chave JSON ou pertence a OUTRA tabela, a troca
// é ancorada no alias ou não é feita.
// Reescrita de corpo, por função. Cada par foi conferido contra a linha real:
// onde o nome da coluna também é chave JSON ou pertence a OUTRA tabela, a troca
// é ancorada no alias — ou simplesmente não é feita.
const FUNCOES = {
  2: {
    FC_SRV_CONSUMIR_LIMITE_PUBLICO: [
      ["    no_escopo,\n    co_chave,\n    dt_janela,\n    nu_requisicoes,\n    dt_atualizacao\n",
       '    "NO_ESCOPO",\n    "CO_CHAVE",\n    "DT_JANELA",\n    "NU_REQUISICOES",\n    "DT_ATUALIZACAO"\n'],
      ["on conflict (no_escopo, co_chave, dt_janela)", 'on conflict ("NO_ESCOPO", "CO_CHAVE", "DT_JANELA")'],
      ['nu_requisicoes = sigav."TB_LIMITE_REQUISICAO_PUBLICA".nu_requisicoes + 1,',
       '"NU_REQUISICOES" = sigav."TB_LIMITE_REQUISICAO_PUBLICA"."NU_REQUISICOES" + 1,'],
      ["dt_atualizacao = excluded.dt_atualizacao", '"DT_ATUALIZACAO" = excluded."DT_ATUALIZACAO"'],
      ["returning nu_requisicoes into v_count;", 'returning "NU_REQUISICOES" into v_count;'],
      ["where dt_janela < v_now", 'where "DT_JANELA" < v_now'],
      // A chave JSON 'allowed' do retorno fica intacta: não é coluna desta tabela.
    ],
    FC_SRV_VERIFICAR_MIGRATIONS: [
      ["where m.co_versao = e.versao", 'where m."CO_VERSAO" = e.versao'],
      ['select max(co_versao) from sigav."TB_MIGRACAO"', 'select max("CO_VERSAO") from sigav."TB_MIGRACAO"'],
    ],
    FC_SRV_REGISTRAR_ERRO: [
      ["    co_referencia, no_rota, tp_erro, ds_mensagem, ds_contexto, st_ambiente, nu_http_status\n",
       '    "CO_REFERENCIA", "NO_ROTA", "TP_ERRO", "DS_MENSAGEM", "DS_CONTEXTO", "ST_AMBIENTE", "NU_HTTP_STATUS"\n'],
      ["on conflict (co_referencia) do nothing;", 'on conflict ("CO_REFERENCIA") do nothing;'],
    ],
    FC_LISTAR_PRESENCA_ONLINE: [
      // `p.active` é de TB_PESSOA e não entra neste lote.
      ['pr.dt_visto_em as "onlineAt"', 'pr."DT_VISTO_EM" as "onlineAt"'],
      ["p.id = pr.sq_pessoa", 'p.id = pr."SQ_PESSOA"'],
      ["where pr.dt_visto_em > timezone", 'where pr."DT_VISTO_EM" > timezone'],
      ["order by pr.dt_visto_em desc", 'order by pr."DT_VISTO_EM" desc'],
    ],
    FC_REGISTRAR_PRESENCA: [
      ['sigav."TB_PRESENCA_ONLINE" (sq_pessoa, dt_visto_em)', 'sigav."TB_PRESENCA_ONLINE" ("SQ_PESSOA", "DT_VISTO_EM")'],
      ["on conflict (sq_pessoa) do update", 'on conflict ("SQ_PESSOA") do update'],
      ["set dt_visto_em = timezone", 'set "DT_VISTO_EM" = timezone'],
    ],
    FC_EMAIL_INSTITUC_PERMITIDO: [
      // Ancorado no alias `d`: `active` existe também em TB_PESSOA e
      // TB_MODULO_PLATAFORMA, que não estão neste lote.
      ["d where d.active and", 'd where d."ST_ATIVO" and'],
      ["=d.domain)", '=d."NO_DOMINIO")'],
    ],
    FC_DEFINIR_PERMISSOES_PESSOA: [
      ["where person_id = p_pessoa;", 'where "SQ_PESSOA" = p_pessoa;'],
      ["    person_id,\n    module_code,\n    allowed,\n    granted_by,\n    created_at,\n    updated_at\n",
       '    "SQ_PESSOA",\n    "CO_MODULO",\n    "ST_PERMITIDO",\n    "AU_USUARIO_CONCESSAO",\n    "DT_INCLUSAO",\n    "DT_ALTERACAO"\n'],
      // `p.active` e `pm.active` são de outras tabelas e ficam como estão.
    ],
    FC_MODULOS_EFETIVOS: [
      ["        pmp.allowed,", '        pmp."ST_PERMITIDO",'],
      ["on pmp.person_id = p.id", 'on pmp."SQ_PESSOA" = p.id'],
      ["and pmp.module_code = pm.code", 'and pmp."CO_MODULO" = pm.code'],
    ],
  },
  // Lote 3. As chaves JSON de retorno ficam INTACTAS em toda parte: 'code',
  // 'name', 'description', 'category', 'position' e 'status' são contrato com a
  // tela, e a coluna ao lado delas é que muda. Em TB_IDENTIDADE_ACESSO o mesmo
  // vale para `status`, que é coluna aqui e chave JSON na mesma função.
  3: {
    // --- TB_BILHETE_ANONIMO --------------------------------------------------
    FC_ENVIAR_SUBMISSAO_PESQUISA: [
      ["    where sq_submissao = v_submission.id and sq_pessoa = v_person_id;",
       '    where "SQ_SUBMISSAO" = v_submission.id and "SQ_PESSOA" = v_person_id;'],
      // Campo de variável %rowtype: o nome segue a coluna, e vai citado aqui também.
      ["v_bilhete.sq_bilhete is null", 'v_bilhete."SQ_BILHETE" is null'],
      ["where sq_bilhete = v_bilhete.sq_bilhete;", 'where "SQ_BILHETE" = v_bilhete."SQ_BILHETE";'],
    ],
    FC_INICIAR_OU_RETOMAR_PESQ: [
      ['join sigav."TB_BILHETE_ANONIMO" b on b.sq_submissao = s.id',
       'join sigav."TB_BILHETE_ANONIMO" b on b."SQ_SUBMISSAO" = s.id'],
      ["    where b.sq_aplicacao = v_app.id and b.sq_pessoa = v_person",
       '    where b."SQ_APLICACAO" = v_app.id and b."SQ_PESSOA" = v_person'],
      ['sigav."TB_BILHETE_ANONIMO" (sq_aplicacao, sq_pessoa, sq_submissao)',
       'sigav."TB_BILHETE_ANONIMO" ("SQ_APLICACAO", "SQ_PESSOA", "SQ_SUBMISSAO")'],
    ],
    FC_SINCRONIZAR_ESTADO_CICLOS: [
      ["    where sa.id = b.sq_aplicacao", '    where sa.id = b."SQ_APLICACAO"'],
      ["    returning b.sq_aplicacao", '    returning b."SQ_APLICACAO"'],
      // A coluna de saída do CTE herda o nome da coluna: com o `returning`
      // citado, `purgados` passa a expor "SQ_APLICACAO", e ler `sq_aplicacao`
      // sem aspas passaria a procurar uma coluna minúscula que não existe.
      ["    select sq_aplicacao, count(*)::integer as quantidade\n    from purgados\n    group by sq_aplicacao",
       '    select "SQ_APLICACAO", count(*)::integer as quantidade\n    from purgados\n    group by "SQ_APLICACAO"'],
      ["    totais.sq_aplicacao::text,\n    totais.sq_aplicacao,",
       '    totais."SQ_APLICACAO"::text,\n    totais."SQ_APLICACAO",'],
    ],

    // --- TB_IDENTIDADE_ACESSO ------------------------------------------------
    FC_REIVINDICAR_ACESSO: [
      // `status` e `person_id` são também nomes das colunas de SAÍDA
      // (`returns table(status text, person_id uuid, ...)`), que o adaptador
      // entrega cru para a tela. Por isso cada troca vai ancorada no alias
      // `pai` ou no bloco exato do UPDATE — nunca pelo nome nu.
      ["  where lower(pai.email) = v_email\n    and pai.identity_type = 'INSTITUTIONAL_EMAIL'\n    and pai.status in ('PENDING', 'ACTIVE')\n    and pai.revoked_at is null\n  order by case when pai.status = 'ACTIVE' then 0 else 1 end, pai.created_at",
       "  where lower(pai.\"NO_EMAIL\") = v_email\n    and pai.\"TP_IDENTIDADE\" = 'INSTITUTIONAL_EMAIL'\n    and pai.\"ST_SITUACAO\" in ('PENDING', 'ACTIVE')\n    and pai.\"DT_REVOGACAO\" is null\n  order by case when pai.\"ST_SITUACAO\" = 'ACTIVE' then 0 else 1 end, pai.\"DT_INCLUSAO\""],
      ["  if v_identity.id is null then", '  if v_identity."SQ_IDENTIDADE" is null then'],
      ["  where p.id = v_identity.person_id", '  where p.id = v_identity."SQ_PESSOA"'],
      ["     set status = 'ACTIVE',\n         verified_at = coalesce(verified_at, timezone('utc', now())),\n         updated_at = timezone('utc', now())\n   where id = v_identity.id;",
       "     set \"ST_SITUACAO\" = 'ACTIVE',\n         \"DT_VERIFICACAO\" = coalesce(\"DT_VERIFICACAO\", timezone('utc', now())),\n         \"DT_ALTERACAO\" = timezone('utc', now())\n   where \"SQ_IDENTIDADE\" = v_identity.\"SQ_IDENTIDADE\";"],
    ],
    FC_RESOLVER_PESSOA_AUTENTIC: [
      ["    from sigav.\"TB_IDENTIDADE_ACESSO\" pai\n    join sigav.\"TB_PESSOA\" p on p.id = pai.person_id\n    where lower(pai.email) = v_email\n      and pai.status in ('PENDING','ACTIVE')",
       "    from sigav.\"TB_IDENTIDADE_ACESSO\" pai\n    join sigav.\"TB_PESSOA\" p on p.id = pai.\"SQ_PESSOA\"\n    where lower(pai.\"NO_EMAIL\") = v_email\n      and pai.\"ST_SITUACAO\" in ('PENDING','ACTIVE')"],
      ["    order by pai.status = 'ACTIVE' desc, pai.created_at",
       "    order by pai.\"ST_SITUACAO\" = 'ACTIVE' desc, pai.\"DT_INCLUSAO\""],
      ["    person_id, identity_type, email, status, source, verified_at, metadata\n  ) values (",
       '    "SQ_PESSOA", "TP_IDENTIDADE", "NO_EMAIL", "ST_SITUACAO", "NO_ORIGEM", "DT_VERIFICACAO", "DS_METADADO"\n  ) values ('],
      ["  on conflict(person_id,identity_type,email) do update\n  set status='ACTIVE',\n      verified_at=coalesce(sigav.\"TB_IDENTIDADE_ACESSO\".verified_at,excluded.verified_at),\n      revoked_at=null,\n      updated_at=timezone('utc',now());",
       "  on conflict(\"SQ_PESSOA\",\"TP_IDENTIDADE\",\"NO_EMAIL\") do update\n  set \"ST_SITUACAO\"='ACTIVE',\n      \"DT_VERIFICACAO\"=coalesce(sigav.\"TB_IDENTIDADE_ACESSO\".\"DT_VERIFICACAO\",excluded.\"DT_VERIFICACAO\"),\n      \"DT_REVOGACAO\"=null,\n      \"DT_ALTERACAO\"=timezone('utc',now());"],
    ],
    FC_SINCR_LINHAS_BASE_PESSOA: [
      ['sigav."TB_IDENTIDADE_ACESSO"(person_id,identity_type,email,status,source,metadata)',
       'sigav."TB_IDENTIDADE_ACESSO"("SQ_PESSOA","TP_IDENTIDADE","NO_EMAIL","ST_SITUACAO","NO_ORIGEM","DS_METADADO")'],
      // Uma linha só no original, e comprida: `metadata` aqui é da identidade,
      // mas o mesmo nome é coluna de TB_PESSOA logo acima. O trecho vai inteiro
      // para que a troca não possa escorregar para a outra tabela.
      ["      on conflict(person_id,identity_type,email) do update set status=case when v_person.auth_user_id is null then sigav.\"TB_IDENTIDADE_ACESSO\".status else 'ACTIVE' end,revoked_at=null,metadata=coalesce(sigav.\"TB_IDENTIDADE_ACESSO\".metadata,'{}'::jsonb)||jsonb_build_object('import_batch_id',p_batch_id),updated_at=timezone('utc',now());",
       "      on conflict(\"SQ_PESSOA\",\"TP_IDENTIDADE\",\"NO_EMAIL\") do update set \"ST_SITUACAO\"=case when v_person.auth_user_id is null then sigav.\"TB_IDENTIDADE_ACESSO\".\"ST_SITUACAO\" else 'ACTIVE' end,\"DT_REVOGACAO\"=null,\"DS_METADADO\"=coalesce(sigav.\"TB_IDENTIDADE_ACESSO\".\"DS_METADADO\",'{}'::jsonb)||jsonb_build_object('import_batch_id',p_batch_id),\"DT_ALTERACAO\"=timezone('utc',now());"],
    ],

    // --- TB_MODULO_PLATAFORMA ------------------------------------------------
    FC_MODULOS_EFETIVOS: [
      // `language sql`: o corpo é validado já na criação, então erro aqui
      // aparece ao aplicar a migration, não em produção.
      ["    array_agg(pm.code order by pm.position, pm.code)\n      filter (where coalesce(\n        pmp.\"ST_PERMITIDO\",\n        pm.code in ('HOME', 'SURVEYS')\n      )),",
       "    array_agg(pm.\"CO_MODULO\" order by pm.\"NU_ORDEM\", pm.\"CO_MODULO\")\n      filter (where coalesce(\n        pmp.\"ST_PERMITIDO\",\n        pm.\"CO_MODULO\" in ('HOME', 'SURVEYS')\n      )),"],
      ['   and pmp."CO_MODULO" = pm.code', '   and pmp."CO_MODULO" = pm."CO_MODULO"'],
      // `p.active` é de TB_PESSOA e fica como está; só a de `pm` muda.
      ["    and pm.active;", '    and pm."ST_ATIVO";'],
    ],
    FC_DEFINIR_PERMISSOES_PESSOA: [
      ["      from sigav.\"TB_MODULO_PLATAFORMA\" pm\n      where pm.code = upper(btrim(item))\n        and pm.active\n    );",
       '      from sigav."TB_MODULO_PLATAFORMA" pm\n      where pm."CO_MODULO" = upper(btrim(item))\n        and pm."ST_ATIVO"\n    );'],
      ["  select coalesce(array_agg(pm.code order by pm.position, pm.code), array[]::text[])\n  into v_permissions\n  from sigav.\"TB_MODULO_PLATAFORMA\" pm\n  where pm.active\n    and (\n      pm.code in ('HOME', 'SURVEYS')\n      or pm.code = any(array(",
       "  select coalesce(array_agg(pm.\"CO_MODULO\" order by pm.\"NU_ORDEM\", pm.\"CO_MODULO\"), array[]::text[])\n  into v_permissions\n  from sigav.\"TB_MODULO_PLATAFORMA\" pm\n  where pm.\"ST_ATIVO\"\n    and (\n      pm.\"CO_MODULO\" in ('HOME', 'SURVEYS')\n      or pm.\"CO_MODULO\" = any(array("],
      ["    pm.code,\n    pm.code = any(v_permissions),",
       '    pm."CO_MODULO",\n    pm."CO_MODULO" = any(v_permissions),'],
      ["  from sigav.\"TB_MODULO_PLATAFORMA\" pm\n  where pm.active;",
       '  from sigav."TB_MODULO_PLATAFORMA" pm\n  where pm."ST_ATIVO";'],
    ],
    FC_LISTAR_ACESSOS_PAGINADOS: [
      // O par chave-JSON/coluna lado a lado: a esquerda é contrato com a tela e
      // não se move; a direita é a coluna e vai citada.
      ["    'code', pm.code,\n    'name', pm.name,\n    'description', pm.description,\n    'category', pm.category,\n    'position', pm.position,\n    'required', pm.code in ('HOME', 'SURVEYS')\n  ) order by pm.position, pm.code), '[]'::jsonb)",
       "    'code', pm.\"CO_MODULO\",\n    'name', pm.\"NO_MODULO\",\n    'description', pm.\"DS_MODULO\",\n    'category', pm.\"TP_CATEGORIA\",\n    'position', pm.\"NU_ORDEM\",\n    'required', pm.\"CO_MODULO\" in ('HOME', 'SURVEYS')\n  ) order by pm.\"NU_ORDEM\", pm.\"CO_MODULO\"), '[]'::jsonb)"],
      ["  from sigav.\"TB_MODULO_PLATAFORMA\" pm\n  where pm.active;",
       '  from sigav."TB_MODULO_PLATAFORMA" pm\n  where pm."ST_ATIVO";'],
    ],

    // --- TB_RESULTADO_COMPET_CDDI --------------------------------------------
    FC_ENVIAR_SUBMISSAO_CDDI: [
      ["      submission_id,\n      competency_section_id,\n      behavior_average,\n      development_level,\n      result,\n      calculation_version\n    ) values (",
       '      "SQ_SUBMISSAO",\n      "SQ_SECAO_COMPETENCIA",\n      "VL_MEDIA_COMPORTAMENTO",\n      "VL_NIVEL_DESENVOLVIMENTO",\n      "VL_RESULTADO",\n      "CO_VERSAO_CALCULO"\n    ) values ('],
      ["    on conflict (submission_id, competency_section_id) do update\n      set behavior_average = excluded.behavior_average,\n          development_level = excluded.development_level,\n          result = excluded.result,\n          calculation_version = excluded.calculation_version,\n          updated_at = now();",
       '    on conflict ("SQ_SUBMISSAO", "SQ_SECAO_COMPETENCIA") do update\n      set "VL_MEDIA_COMPORTAMENTO" = excluded."VL_MEDIA_COMPORTAMENTO",\n          "VL_NIVEL_DESENVOLVIMENTO" = excluded."VL_NIVEL_DESENVOLVIMENTO",\n          "VL_RESULTADO" = excluded."VL_RESULTADO",\n          "CO_VERSAO_CALCULO" = excluded."CO_VERSAO_CALCULO",\n          "DT_ALTERACAO" = now();'],
      ["  select round(avg(cr.result)::numeric, 4)\n    into v_final_score\n  from sigav.\"TB_RESULTADO_COMPET_CDDI\" cr\n  where cr.submission_id = v_submission.id;",
       '  select round(avg(cr."VL_RESULTADO")::numeric, 4)\n    into v_final_score\n  from sigav."TB_RESULTADO_COMPET_CDDI" cr\n  where cr."SQ_SUBMISSAO" = v_submission.id;'],
    ],
    FC_PAINEL_MONITOR_CDDI_INT: [
      // `c.position` é da CTE de competências (TB_SECAO_PESQUISA) e não entra
      // neste lote: só o que vem de `cr` muda.
      ["      max(cr.result) filter (where ls.normalized_type in ('AUTO', 'AUTOAVALIACAO', 'SELF')) as auto_score,\n      max(cr.result) filter (where ls.normalized_type in ('CHEFIA', 'LEADER', 'MANAGER')) as leader_score\n    from latest_submissions ls\n    join sigav.\"TB_RESULTADO_COMPET_CDDI\" cr on cr.submission_id = ls.id\n    join competencies c on c.id = cr.competency_section_id",
       "      max(cr.\"VL_RESULTADO\") filter (where ls.normalized_type in ('AUTO', 'AUTOAVALIACAO', 'SELF')) as auto_score,\n      max(cr.\"VL_RESULTADO\") filter (where ls.normalized_type in ('CHEFIA', 'LEADER', 'MANAGER')) as leader_score\n    from latest_submissions ls\n    join sigav.\"TB_RESULTADO_COMPET_CDDI\" cr on cr.\"SQ_SUBMISSAO\" = ls.id\n    join competencies c on c.id = cr.\"SQ_SECAO_COMPETENCIA\""],
    ],
    FC_REMOVER_RESPOSTA_PESSOA: [
      ['delete from sigav."TB_RESULTADO_COMPET_CDDI" where submission_id = p_submissao;',
       'delete from sigav."TB_RESULTADO_COMPET_CDDI" where "SQ_SUBMISSAO" = p_submissao;'],
    ],
  },
  // Lote 4. As quatro funções de arquivo e as seis de e-mail vão por TOKEN: os
  // nomes de coluna dessas duas tabelas são exclusivos no schema (o gerador
  // prova antes de trocar), e o arquivo gerado registra quantas ocorrências
  // caíram em cada coluna, para conferência. TB_RESULTADO_FINAL_CDDI vai à mão:
  // `status`, `metadata` e `id` valem para meia dúzia de outras tabelas.
  4: {
    // --- TB_ARQUIVO ----------------------------------------------------------
    FC_ARQ_GRAVAR: AUTO,
    FC_ARQ_LISTAR: AUTO,
    FC_ARQ_OBTER: AUTO,
    FC_ARQ_REMOVER: AUTO,

    // --- TL_EMAIL_PARTICIPANTE -----------------------------------------------
    // As duas assinaturas de conclusão precisam de chave própria: a de 3
    // argumentos atualiza a fila sem checar nada e a de 4 exige reivindicação
    // vigente. São funções diferentes, e o gerador recusa tratar uma só.
    "FC_CONCLUIR_EMAIL_PARTICIPANTE(target_email_id uuid, target_success boolean, target_error text)": AUTO,
    "FC_CONCLUIR_EMAIL_PARTICIPANTE(target_email_id uuid, target_claim_token uuid, target_success boolean, target_error text)": AUTO,
    FC_AGENDAR_ENVIO_MANUAL: AUTO,
    FC_LISTAR_AUDIENCIA_EMAIL: AUTO,
    FC_LISTAR_ENVIOS_EMAIL: AUTO,
    FC_REIVINDICAR_EMAILS: AUTO,
    FC_SRV_REGISTRAR_TRANSPORTE: AUTO,

    // --- TB_RESULTADO_FINAL_CDDI ---------------------------------------------
    FC_ENVIAR_SUBMISSAO_CDDI: [
      // Dois blocos quase idênticos, distinguidos pela coluna da autoavaliação
      // e pela da chefia. Vão inteiros para não haver como trocar no bloco
      // errado.
      ["      application_id,\n      subject_person_id,\n      auto_submission_id,\n      auto_score,\n      final_score,\n      status,\n      calculated_at\n    ) values (",
       '      "SQ_APLICACAO",\n      "SQ_PESSOA_AVALIADA",\n      "SQ_SUBMISSAO_AUTO",\n      "VL_NOTA_AUTO",\n      "VL_NOTA_FINAL",\n      "ST_SITUACAO",\n      "DT_CALCULO"\n    ) values ('],
      ["    on conflict (application_id, subject_person_id) do update\n      set auto_submission_id = excluded.auto_submission_id,\n          auto_score = excluded.auto_score,\n          final_score = case\n            when sigav.\"TB_RESULTADO_FINAL_CDDI\".leader_score is null then null\n            else round((excluded.auto_score * 0.40 + sigav.\"TB_RESULTADO_FINAL_CDDI\".leader_score * 0.60)::numeric, 4)\n          end,\n          status = case\n            when sigav.\"TB_RESULTADO_FINAL_CDDI\".leader_score is null then 'PARTIAL'\n            else 'CALCULATED'\n          end,\n          calculated_at = case\n            when sigav.\"TB_RESULTADO_FINAL_CDDI\".leader_score is null then null\n            else v_submitted_at\n          end,\n          updated_at = now();",
       "    on conflict (\"SQ_APLICACAO\", \"SQ_PESSOA_AVALIADA\") do update\n      set \"SQ_SUBMISSAO_AUTO\" = excluded.\"SQ_SUBMISSAO_AUTO\",\n          \"VL_NOTA_AUTO\" = excluded.\"VL_NOTA_AUTO\",\n          \"VL_NOTA_FINAL\" = case\n            when sigav.\"TB_RESULTADO_FINAL_CDDI\".\"VL_NOTA_LIDER\" is null then null\n            else round((excluded.\"VL_NOTA_AUTO\" * 0.40 + sigav.\"TB_RESULTADO_FINAL_CDDI\".\"VL_NOTA_LIDER\" * 0.60)::numeric, 4)\n          end,\n          \"ST_SITUACAO\" = case\n            when sigav.\"TB_RESULTADO_FINAL_CDDI\".\"VL_NOTA_LIDER\" is null then 'PARTIAL'\n            else 'CALCULATED'\n          end,\n          \"DT_CALCULO\" = case\n            when sigav.\"TB_RESULTADO_FINAL_CDDI\".\"VL_NOTA_LIDER\" is null then null\n            else v_submitted_at\n          end,\n          \"DT_ALTERACAO\" = now();"],
      ["      application_id,\n      subject_person_id,\n      leader_submission_id,\n      leader_score,\n      final_score,\n      status,\n      calculated_at\n    ) values (",
       '      "SQ_APLICACAO",\n      "SQ_PESSOA_AVALIADA",\n      "SQ_SUBMISSAO_LIDER",\n      "VL_NOTA_LIDER",\n      "VL_NOTA_FINAL",\n      "ST_SITUACAO",\n      "DT_CALCULO"\n    ) values ('],
      ["    on conflict (application_id, subject_person_id) do update\n      set leader_submission_id = excluded.leader_submission_id,\n          leader_score = excluded.leader_score,\n          final_score = case\n            when sigav.\"TB_RESULTADO_FINAL_CDDI\".auto_score is null then null\n            else round((sigav.\"TB_RESULTADO_FINAL_CDDI\".auto_score * 0.40 + excluded.leader_score * 0.60)::numeric, 4)\n          end,\n          status = case\n            when sigav.\"TB_RESULTADO_FINAL_CDDI\".auto_score is null then 'PARTIAL'\n            else 'CALCULATED'\n          end,\n          calculated_at = case\n            when sigav.\"TB_RESULTADO_FINAL_CDDI\".auto_score is null then null\n            else v_submitted_at\n          end,\n          updated_at = now();",
       "    on conflict (\"SQ_APLICACAO\", \"SQ_PESSOA_AVALIADA\") do update\n      set \"SQ_SUBMISSAO_LIDER\" = excluded.\"SQ_SUBMISSAO_LIDER\",\n          \"VL_NOTA_LIDER\" = excluded.\"VL_NOTA_LIDER\",\n          \"VL_NOTA_FINAL\" = case\n            when sigav.\"TB_RESULTADO_FINAL_CDDI\".\"VL_NOTA_AUTO\" is null then null\n            else round((sigav.\"TB_RESULTADO_FINAL_CDDI\".\"VL_NOTA_AUTO\" * 0.40 + excluded.\"VL_NOTA_LIDER\" * 0.60)::numeric, 4)\n          end,\n          \"ST_SITUACAO\" = case\n            when sigav.\"TB_RESULTADO_FINAL_CDDI\".\"VL_NOTA_AUTO\" is null then 'PARTIAL'\n            else 'CALCULATED'\n          end,\n          \"DT_CALCULO\" = case\n            when sigav.\"TB_RESULTADO_FINAL_CDDI\".\"VL_NOTA_AUTO\" is null then null\n            else v_submitted_at\n          end,\n          \"DT_ALTERACAO\" = now();"],
    ],
    // Função de GATILHO (TBA_RES_FINAL_CDDI_VALIDAR). Ela valida a tabela
    // inteira por `new.<coluna>` e NUNCA escreve o nome da tabela — por isso a
    // busca por `sigav."TABELA"` não a encontrava, e ela quase ficou fora do
    // lote. Foi a varredura de sobra que a acusou; a rede de gatilho, agora no
    // bloco de autoverificação, passa a acusá-la antes.
    FC_VALIDAR_RESULT_FINAL_CDDI: [
      ["array[new.auto_submission_id, new.leader_submission_id]",
       'array[new."SQ_SUBMISSAO_AUTO", new."SQ_SUBMISSAO_LIDER"]'],
      // `application_id`, `subject_person_id` e `submission_type` no `select`
      // logo abaixo são de TB_SUBMISSAO e ficam como estão; só o que vem de
      // `new` pertence a TB_RESULTADO_FINAL_CDDI.
      ["if app is distinct from new.application_id or subject is distinct from new.subject_person_id then",
       'if app is distinct from new."SQ_APLICACAO" or subject is distinct from new."SQ_PESSOA_AVALIADA" then'],
      ["if sid = new.auto_submission_id and stype <> 'AUTO' then",
       "if sid = new.\"SQ_SUBMISSAO_AUTO\" and stype <> 'AUTO' then"],
      ["if sid = new.leader_submission_id and stype <> 'CHEFIA' then",
       "if sid = new.\"SQ_SUBMISSAO_LIDER\" and stype <> 'CHEFIA' then"],
    ],
    FC_EXCLUIR_PESQUISA_ARQUIVADA: [
      ['delete from sigav."TB_RESULTADO_FINAL_CDDI" where application_id = any(v_aplicacoes);',
       'delete from sigav."TB_RESULTADO_FINAL_CDDI" where "SQ_APLICACAO" = any(v_aplicacoes);'],
    ],
    FC_PAINEL_MONITOR_CDDI_INT: [
      // Apelido explícito: as colunas de saída da CTE `participant_rows` são
      // lidas adiante como `pr.final_score`, `pr.final_status` e
      // `pr.calculated_at`. Sem o `as`, passariam a se chamar VL_NOTA_FINAL e
      // DT_CALCULO, e a leitura lá embaixo quebraria. Nome interno de CTE não é
      // coluna de tabela e fica como está até a tabela de origem ser renomeada.
      ["      fr.final_score,\n      fr.status as final_status,\n      fr.calculated_at,",
       '      fr."VL_NOTA_FINAL" as final_score,\n      fr."ST_SITUACAO" as final_status,\n      fr."DT_CALCULO" as calculated_at,'],
      ["      from sigav.\"TB_RESULTADO_FINAL_CDDI\" r\n      where r.application_id = v_application_id and r.subject_person_id = sp.person_id\n        and upper(r.status) <> 'INVALIDATED'\n      order by r.calculated_at desc, r.updated_at desc",
       "      from sigav.\"TB_RESULTADO_FINAL_CDDI\" r\n      where r.\"SQ_APLICACAO\" = v_application_id and r.\"SQ_PESSOA_AVALIADA\" = sp.person_id\n        and upper(r.\"ST_SITUACAO\") <> 'INVALIDATED'\n      order by r.\"DT_CALCULO\" desc, r.\"DT_ALTERACAO\" desc"],
    ],
    FC_REMOVER_RESPOSTA_PESSOA: [
      ["  select coalesce(array_agg(id), '{}')\n  into v_resultados\n  from sigav.\"TB_RESULTADO_FINAL_CDDI\"\n  where auto_submission_id = p_submissao or leader_submission_id = p_submissao;",
       "  select coalesce(array_agg(\"SQ_RESULTADO\"), '{}')\n  into v_resultados\n  from sigav.\"TB_RESULTADO_FINAL_CDDI\"\n  where \"SQ_SUBMISSAO_AUTO\" = p_submissao or \"SQ_SUBMISSAO_LIDER\" = p_submissao;"],
      // As chaves do jsonb_build_object logo abaixo ('invalidatedBy' etc.) são
      // contrato de auditoria e não entram na troca.
      ["    set status = 'INVALIDATED',\n        auto_score = null,\n        leader_score = null,\n        final_score = null,\n        published_at = null,\n        updated_at = now(),\n        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(",
       "    set \"ST_SITUACAO\" = 'INVALIDATED',\n        \"VL_NOTA_AUTO\" = null,\n        \"VL_NOTA_LIDER\" = null,\n        \"VL_NOTA_FINAL\" = null,\n        \"DT_PUBLICACAO\" = null,\n        \"DT_ALTERACAO\" = now(),\n        \"DS_METADADO\" = coalesce(\"DS_METADADO\", '{}'::jsonb) || jsonb_build_object("],
      ["    where id = any(v_resultados);", '    where "SQ_RESULTADO" = any(v_resultados);'],
      ['update sigav."TB_RESULTADO_FINAL_CDDI" set auto_submission_id = null where auto_submission_id = p_submissao;',
       'update sigav."TB_RESULTADO_FINAL_CDDI" set "SQ_SUBMISSAO_AUTO" = null where "SQ_SUBMISSAO_AUTO" = p_submissao;'],
      ['update sigav."TB_RESULTADO_FINAL_CDDI" set leader_submission_id = null where leader_submission_id = p_submissao;',
       'update sigav."TB_RESULTADO_FINAL_CDDI" set "SQ_SUBMISSAO_LIDER" = null where "SQ_SUBMISSAO_LIDER" = p_submissao;'],
    ],
  },
  // Lote 5. As duas tabelas de regra usam troca por token: os nomes são
  // exclusivos no schema e o gerador ainda prova que não são parâmetros nem
  // variáveis. RL_RESPOSTA_OPCAO vai por trecho, porque `position`,
  // `created_at` e aliases `option_id` têm outros sentidos nas mesmas funções.
  5: {
    // --- TB_CONDICAO_REGRA / TB_REGRA_CONDICIONAL --------------------------
    FC_ALVO_VISIVEL: regrasLote5(),
    FC_CLONAR_PESQUISA_ESTRUTURA: regrasLote5(),
    FC_CONDICAO_ATENDIDA: regrasLote5([
      ['from sigav."RL_RESPOSTA_OPCAO" where answer_id = v_resposta.id)',
       'from sigav."RL_RESPOSTA_OPCAO" where "SQ_RESPOSTA" = v_resposta.id)'],
      ['where answer_id = v_resposta.id and option_id = v_condicao.sq_opcao',
       'where "SQ_RESPOSTA" = v_resposta.id and "SQ_OPCAO" = v_condicao.sq_opcao'],
    ]),
    FC_CRIAR_NOVA_VERSAO_PESQUISA: regrasLote5(),
    FC_EXCLUIR_PESQUISA_ARQUIVADA: regrasLote5(),
    FC_EXCLUIR_REGRA_CONDICIONAL: regrasLote5(),
    FC_LISTAR_REGRAS_CONDICIONAIS: regrasLote5(),
    FC_OBTER_REGRAS_DO_CICLO: regrasLote5(),
    FC_ORIGENS_DA_REGRA: regrasLote5(),
    FC_SALVAR_REGRA_CONDICIONAL: regrasLote5(),

    // --- RL_RESPOSTA_OPCAO -------------------------------------------------
    FC_ENVIAR_RESP_ANON: [
      ['from sigav."RL_RESPOSTA_OPCAO" ao where ao.answer_id=a.id',
       'from sigav."RL_RESPOSTA_OPCAO" ao where ao."SQ_RESPOSTA"=a.id'],
    ],
    FC_ENVIAR_SUBMISSAO_CDDI: [
      ['from sigav."RL_RESPOSTA_OPCAO" ao where ao.answer_id = a.id',
       'from sigav."RL_RESPOSTA_OPCAO" ao where ao."SQ_RESPOSTA" = a.id'],
    ],
    FC_ENVIAR_SUBMISSAO_PESQUISA: [
      ['from sigav."RL_RESPOSTA_OPCAO" ao where ao.answer_id = a.id',
       'from sigav."RL_RESPOSTA_OPCAO" ao where ao."SQ_RESPOSTA" = a.id'],
    ],
    FC_GRAVAR_RESP_ANON: [
      ['delete from sigav."RL_RESPOSTA_OPCAO" where answer_id=v_answer_id;',
       'delete from sigav."RL_RESPOSTA_OPCAO" where "SQ_RESPOSTA"=v_answer_id;'],
      ['insert into sigav."RL_RESPOSTA_OPCAO"(answer_id,option_id,position)',
       'insert into sigav."RL_RESPOSTA_OPCAO"("SQ_RESPOSTA","SQ_OPCAO","NU_ORDEM")'],
    ],
    FC_INICIAR_OU_RETOMAR_CDDI: [
      ['    select ao.option_id\n    from sigav."RL_RESPOSTA_OPCAO" ao\n    where ao.answer_id = a.id\n    order by ao.position nulls last, ao.created_at',
       '    select ao."SQ_OPCAO" as option_id\n    from sigav."RL_RESPOSTA_OPCAO" ao\n    where ao."SQ_RESPOSTA" = a.id\n    order by ao."NU_ORDEM" nulls last, ao."DT_INCLUSAO"'],
    ],
    FC_INICIAR_OU_RETOMAR_PESQ: [
      ['      select jsonb_agg(ao.option_id order by ao.position) ids\n      from sigav."RL_RESPOSTA_OPCAO" ao where ao.answer_id = a.id',
       '      select jsonb_agg(ao."SQ_OPCAO" order by ao."NU_ORDEM") ids\n      from sigav."RL_RESPOSTA_OPCAO" ao where ao."SQ_RESPOSTA" = a.id'],
    ],
    FC_INICIAR_OU_RETOMAR_SUBM: [
      ['select ao.option_id from sigav."RL_RESPOSTA_OPCAO" ao where ao.answer_id=a.id order by ao.position nulls last,ao.created_at limit 1',
       'select ao."SQ_OPCAO" as option_id from sigav."RL_RESPOSTA_OPCAO" ao where ao."SQ_RESPOSTA"=a.id order by ao."NU_ORDEM" nulls last,ao."DT_INCLUSAO" limit 1'],
    ],
    FC_OBTER_PAINEL_PESQ: [
      ['    select a.question_id, ao.option_id, count(*) answer_count\n    from sigav."RL_RESPOSTA_OPCAO" ao\n    join submitted_answers a on a.id = ao.answer_id\n    group by a.question_id, ao.option_id',
       '    select a.question_id, ao."SQ_OPCAO" as option_id, count(*) answer_count\n    from sigav."RL_RESPOSTA_OPCAO" ao\n    join submitted_answers a on a.id = ao."SQ_RESPOSTA"\n    group by a.question_id, ao."SQ_OPCAO"'],
    ],
    FC_OBTER_PAINEL_PESQUISA: [
      ['    select a.question_id, ao.option_id, count(*) answer_count\n    from sigav."RL_RESPOSTA_OPCAO" ao\n    join submitted_answers a on a.id = ao.answer_id\n    group by a.question_id, ao.option_id',
       '    select a.question_id, ao."SQ_OPCAO" as option_id, count(*) answer_count\n    from sigav."RL_RESPOSTA_OPCAO" ao\n    join submitted_answers a on a.id = ao."SQ_RESPOSTA"\n    group by a.question_id, ao."SQ_OPCAO"'],
    ],
    FC_REMOVER_RESPOSTA_PESSOA: [
      ['delete from sigav."RL_RESPOSTA_OPCAO" where answer_id in (',
       'delete from sigav."RL_RESPOSTA_OPCAO" where "SQ_RESPOSTA" in ('],
    ],
    FC_SALVAR_RESPOSTA_CDDI: [
      ['delete from sigav."RL_RESPOSTA_OPCAO" where answer_id = v_answer_id;',
       'delete from sigav."RL_RESPOSTA_OPCAO" where "SQ_RESPOSTA" = v_answer_id;'],
      ['insert into sigav."RL_RESPOSTA_OPCAO" (answer_id, option_id, position)',
       'insert into sigav."RL_RESPOSTA_OPCAO" ("SQ_RESPOSTA", "SQ_OPCAO", "NU_ORDEM")'],
    ],
    FC_SALVAR_RESPOSTA_PESQUISA: [
      ['delete from sigav."RL_RESPOSTA_OPCAO" where answer_id = v_answer_id;',
       'delete from sigav."RL_RESPOSTA_OPCAO" where "SQ_RESPOSTA" = v_answer_id;'],
      ['insert into sigav."RL_RESPOSTA_OPCAO"(answer_id, option_id, position)',
       'insert into sigav."RL_RESPOSTA_OPCAO"("SQ_RESPOSTA", "SQ_OPCAO", "NU_ORDEM")'],
    ],
    FC_VALIDAR_OPCAO_RESPOSTA: [
      ['where id = new.answer_id;', 'where id = new."SQ_RESPOSTA";'],
      ['where id = new.option_id;', 'where id = new."SQ_OPCAO";'],
    ],
  },
};

// Tabelas do lote cujos nomes de coluna são EXCLUSIVOS no schema. Para elas a
// função marcada com AUTO recebe substituição por TOKEN, fora de comentário e
// fora de literal, em vez de trecho escrito à mão: `FC_REIVINDICAR_EMAILS`
// sozinha cita 40 colunas, e transcrever 40 linhas erra de um jeito que a
// revisão não pega — falta uma, e o defeito espera a produção.
//
// O gerador só aceita AUTO depois de provar duas coisas:
//   1. o nome antigo não existe em nenhuma tabela fora do lote (senão a troca
//      atingiria a referência de outra tabela);
//   2. a função não declara parâmetro nem variável com esse nome (senão
//      renomearia a variável junto).
// Falhando qualquer das duas, para e diz qual.
// Menções ao nome antigo que a varredura de sobra encontra e que NÃO são
// referência a coluna. Cada uma foi lida antes de entrar aqui. Sem esta lista a
// varredura seria frouxa ou inútil; com ela, continua estrita.
const SOBRAS_ACEITAS = {
  4: {
    // Apelidos de CTE. `auto_score` e `leader_score` vêm de
    // TB_SUBMISSAO.calculated_result; `final_score`, `calculated_at` e os dois
    // `*_submission_id` são nomes de saída que a consulta de baixo lê como
    // `pr.final_score`. Nome interno de consulta não é objeto de banco.
    FC_PAINEL_MONITOR_CDDI_INT: [
      "auto_score", "leader_score", "final_score", "calculated_at",
      "auto_submission_id", "leader_submission_id",
    ],
    // `pl.sq_pessoa` é coluna de SAÍDA de FC_PLANEJAR_PUBLICO_AVALIACAO
    // (`returns table`), que é contrato de RPC com a tela e não se renomeia.
    FC_APLICAR_PUBLICO_AVALIACAO: ["sq_pessoa"],
    FC_PLANEJAR_PUBLICO_AVALIACAO: ["sq_pessoa"],
    FC_PREVISUALIZAR_PUBLICO: ["sq_pessoa"],
    FC_RESOLVER_PUBLICO_AVALIACAO: ["sq_pessoa"],
  },
  5: {
    // Alias produzido por UNNEST ou por CTE/lateral. A coluna física da relação
    // já é "SQ_OPCAO"; manter `option_id` aqui preserva o nome interno lido no
    // restante da consulta e, em dois casos, o contrato JSON da RPC.
    FC_GRAVAR_RESP_ANON: ["option_id"],
    FC_INICIAR_OU_RETOMAR_CDDI: ["option_id"],
    FC_INICIAR_OU_RETOMAR_SUBM: ["option_id"],
    FC_OBTER_PAINEL_PESQ: ["option_id"],
    FC_OBTER_PAINEL_PESQUISA: ["option_id"],
    FC_SALVAR_RESPOSTA_PESQUISA: ["option_id"],
  },
  6: {
    // Chamadas à função SQL `position`, parâmetro da RPC e alias de saída
    // interno. Nenhum deles referencia uma coluna física remanescente.
    FC_ATUALIZAR_MARCA_PLATAFORMA: ["position"],
    FC_ATUALIZAR_PERGUNTA: ["question_type"],
    FC_ATUALIZAR_VISUAL_CICLO: ["position"],
    FC_CONDICAO_ATENDIDA: ["position"],
    FC_LISTAR_ENVIOS_EMAIL: ["id"],
    FC_INCLUIR_PERGUNTA: ["value"],
    FC_SALVAR_REGRA_CONDICIONAL: ["value"],
    FC_SINCR_LINHAS_BASE_PESSOA: ["value"],
    FC_SINCR_LINHAS_GESTOR_CDDI: ["value"],
  },
};

const POR_TOKEN = {
  4: ["TB_ARQUIVO", "TL_EMAIL_PARTICIPANTE"],
};


/**
 * Percorre a definição da função marcando o que NÃO pode ser tocado:
 * comentário de linha, comentário de bloco, literal entre apóstrofos,
 * identificador entre aspas e a assinatura (nome de parâmetro não é coluna).
 *
 * Devolve a definição com os nomes trocados e a contagem por coluna, para o
 * humano conferir no arquivo gerado.
 */
function trocarPorToken(definicao, mapa) {
  const abre = definicao.indexOf("$function$");
  if (abre === -1) throw new Error("definição sem $function$");
  const fecha = definicao.lastIndexOf("$function$");
  if (fecha === abre) throw new Error("só um $function$ na definição");

  const cabeca = definicao.slice(0, abre + "$function$".length);
  const corpo = definicao.slice(abre + "$function$".length, fecha);
  const cauda = definicao.slice(fecha);

  if (corpo.includes("$$")) throw new Error("dollar-quote interno: troca por token não é segura aqui");

  const contagem = new Map();
  let saida = "";
  let i = 0;
  while (i < corpo.length) {
    const c = corpo[i];
    if (c === "'" ) {                                  // literal
      let j = i + 1;
      while (j < corpo.length) {
        if (corpo[j] === "'" && corpo[j + 1] === "'") { j += 2; continue; }
        if (corpo[j] === "'") { j += 1; break; }
        j += 1;
      }
      saida += corpo.slice(i, j); i = j; continue;
    }
    if (c === '"') {                                   // identificador já citado
      const j = corpo.indexOf('"', i + 1) + 1;
      saida += corpo.slice(i, j || corpo.length); i = j || corpo.length; continue;
    }
    if (c === "-" && corpo[i + 1] === "-") {            // comentário de linha
      const j = corpo.indexOf("\n", i);
      const fim = j === -1 ? corpo.length : j;
      saida += corpo.slice(i, fim); i = fim; continue;
    }
    if (c === "/" && corpo[i + 1] === "*") {            // comentário de bloco
      const j = corpo.indexOf("*/", i + 2);
      const fim = j === -1 ? corpo.length : j + 2;
      saida += corpo.slice(i, fim); i = fim; continue;
    }
    // Trecho comum: consome até o próximo delimitador e troca por token.
    let j = i;
    while (j < corpo.length) {
      const d = corpo[j];
      if (d === "'" || d === '"') break;
      if (d === "-" && corpo[j + 1] === "-") break;
      if (d === "/" && corpo[j + 1] === "*") break;
      j += 1;
    }
    let pedaco = corpo.slice(i, j);
    for (const [velho, novo] of Object.entries(mapa)) {
      const padrao = new RegExp(`\\b${velho}\\b`, "g");
      const quantas = (pedaco.match(padrao) ?? []).length;
      if (quantas) {
        contagem.set(velho, (contagem.get(velho) ?? 0) + quantas);
        pedaco = pedaco.replace(padrao, `"${novo}"`);
      }
    }
    saida += pedaco; i = j;
  }
  return { definicao: cabeca + saida + cauda, contagem };
}

const LIMITE = 30;

// Nome à mão, para onde o derivador não tem como acertar. Índice por EXPRESSÃO
// não expõe coluna em `pg_index.indkey` (o lugar dela vem zerado), então não há
// coluna nova para apontar e a derivação cai no nome antigo — que está em
// inglês. Aqui o nome é escrito, não derivado.
const NOMES_MANUAIS = {
  // unique (lower(email)) where status in ('PENDING','ACTIVE')
  UK_IDENT_ACESSO_ACTIVE_EMAIL: "UK_IDENT_ACESSO_NO_EMAIL_ATIVO",
  // Fica como está, e de propósito. O nome já conforma (item 8, forma reduzida
  // `UK_[TABELA]_[NOMEUK]`) e é semântico. Além disso `FC_ARQ_GRAVAR` o cita
  // por nome em `on conflict on constraint` — renomear aqui reintroduziria o
  // defeito que 20260831220000 acabou de reparar, e o corpo dessa função é
  // reescrito por TOKEN, que não mexe em nome de constraint.
  UK_ARQUIVO_CAMINHO: "UK_ARQUIVO_CAMINHO",
};
const quote = (s) => `'${String(s).replace(/'/g, "''")}'`;
const id = (s) => `"${s.toUpperCase()}"`;

const lote = process.argv[2];
const MAPA = LOTES[lote];
if (!MAPA) throw new Error(`Lote ${lote} não definido.`);
const TABELAS = Object.keys(MAPA);
const ARQUIVOS_CONSUMIDORES_SQL = [
  "database/tests/clonar_pesquisa.sql",
  "database/tests/definir_publico_avaliacao.sql",
  "database/tests/elegibilidade_assign_all_available.sql",
  "database/tests/publico_selecao_em_cascata.sql",
  "database/tests/reconciliar_publico_avaliacao.sql",
  "database/tests/sincronizar_estado_ciclos.sql",
  "scripts/manutencao-pre-pico.sql",
];

if (process.argv.includes("--atualizar-testes-sql")) {
  for (const arquivo of ARQUIVOS_CONSUMIDORES_SQL) {
    const original = await readFile(arquivo, "utf8");
    const envolvido = `create function sigav.__reescrever_consumidor() returns void language sql as $function$\n${original}\n$function$;`;
    const reescrito = reescreverPorEscopo(envolvido, MAPA);
    const inicio = reescrito.indexOf("$function$\n") + "$function$\n".length;
    const fim = reescrito.lastIndexOf("\n$function$");
    await writeFile(arquivo, reescrito.slice(inicio, fim), "utf8");
    console.error(`atualizado: ${arquivo}`);
  }
  process.exit(0);
}

if (process.argv.includes("--verificar-consumidores")) {
  const antigos = [...new Set(Object.values(MAPA).flatMap((mapa) => Object.keys(mapa)))];
  let total = 0;
  for (const arquivo of ARQUIVOS_CONSUMIDORES_SQL) {
    const original = await readFile(arquivo, "utf8");
    const codigo = original
      .replace(/\/[*][\s\S]*?[*]\//g, (trecho) => trecho.replace(/[^\n]/g, " "))
      .replace(/--[^\n]*/g, (trecho) => " ".repeat(trecho.length))
      .replace(/'(?:[^']|'')*'/g, (trecho) => trecho.replace(/[^\n]/g, " "))
      .replace(/"(?:[^"]|"")*"/g, (trecho) => " ".repeat(trecho.length));
    for (const antigo of antigos) {
      const re = new RegExp(`\\b${antigo}\\b`, "g");
      for (const achado of codigo.matchAll(re)) {
        const linha = codigo.slice(0, achado.index).split("\n").length;
        console.error(`${arquivo}:${linha}: ${antigo}`);
        total += 1;
      }
    }
  }
  console.error(`referências legadas encontradas: ${total}`);
  process.exit(total ? 1 : 0);
}

const cliente = new pg.Client({
  host: new URL(process.env.EMPRESA_DATABASE_URL).hostname,
  port: Number(new URL(process.env.EMPRESA_DATABASE_URL).port || 5432),
  database: new URL(process.env.EMPRESA_DATABASE_URL).pathname.replace(/^\//, ""),
  user: process.env.MIGRATION_USERNAME_DATABASE_URL,
  password: process.env.MIGRATION_PASSWORD_DATABASE_URL,
});
await cliente.connect();

// Confere que o mapa cobre exatamente as colunas existentes. Coluna esquecida
// ficaria minúscula sem ninguém notar; coluna inventada faria o rename falhar.
for (const tabela of TABELAS) {
  const { rows } = await cliente.query(
    `select a.attname from pg_attribute a
      where a.attrelid = ('sigav.' || quote_ident($1))::regclass
        and a.attnum > 0 and not a.attisdropped
      order by a.attnum`,
    [tabela],
  );
  const reais = rows.map((r) => r.attname);
  const mapeadas = Object.keys(MAPA[tabela]);
  const faltando = reais.filter((c) => !mapeadas.includes(c));
  const sobrando = mapeadas.filter((c) => !reais.includes(c));
  if (faltando.length) throw new Error(`${tabela}: colunas sem mapa -> ${faltando.join(", ")}`);
  if (sobrando.length) throw new Error(`${tabela}: colunas inexistentes no mapa -> ${sobrando.join(", ")}`);
  for (const novo of Object.values(MAPA[tabela])) {
    if (novo.length > LIMITE) throw new Error(`${tabela}.${novo} tem ${novo.length} caracteres`);
    if (!/^(CO|SQ|DT|HR|DS|NO|NU|QT|VL|TX|SG|ST|TP|IM|CG|AU)_[A-Z0-9_]+$/.test(novo)) {
      throw new Error(`${tabela}.${novo} sem prefixo semântico do item 7`);
    }
  }
}

// --- Nomes de constraint e índice, recalculados a partir da coluna NOVA ------
const RUIDO = new Set(["fkey", "pkey", "key", "idx", "unique", "uniq", "fk", "pk", "index"]);
const PREFIXO = new Set(["in", "uk", "ck", "pk", "fk", "ib", "itm"]);
const usados = new Set();

/** Termo do nome antigo, quando não há coluna para apontar. */
function termoDoNome(tabela, nomeAtual) {
  let tokens = nomeAtual.toLowerCase().split("_");
  while (tokens.length > 1 && (RUIDO.has(tokens[0]) || PREFIXO.has(tokens[0]))) tokens = tokens.slice(1);
  // Tanto o nome cheio quanto a forma curta: `UK_IDENT_ACESSO_...` sobre
  // TB_IDENTIDADE_ACESSO precisa perder `ident` e `acesso`, e `ident` só casa
  // com a forma curta (`ident_acesso`), não com a palavra `identidade`.
  const daTabela = new Set([
    ...tabela.toLowerCase().split("_"),
    ...(CODIGO[tabela] ?? "").split("_"),
  ]);
  while (tokens.length > 1 && daTabela.has(tokens[0])) tokens = tokens.slice(1);
  while (tokens.length > 1 && RUIDO.has(tokens[tokens.length - 1])) tokens = tokens.slice(0, -1);
  return [tokens];
}

/**
 * Candidatos de termo, do mais informativo ao menos, para o objeto que aponta
 * `colunasNovas`.
 *
 * O prefixo semântico da coluna FICA no nome: sem ele, `CO_UNIDADE` e
 * `NO_UNIDADE` produzem o mesmo termo, e o check do código e o do nome viram
 * `CK_UNID_ORG_UNIDADE` e `CK_UNID_ORG_UNIDAD` — indistinguíveis na prática.
 *
 * Em objeto multi-coluna, a redução tira coluna da DIREITA: a primeira é a que
 * mais identifica o objeto. O padrão prevê essa forma reduzida — item 8,
 * `UK_[TABELA]_[NOMEUK]` para chave múltipla.
 */
function termoDaColuna(colunasNovas) {
  const tokens = colunasNovas.map((c) => c.toLowerCase().split("_"));
  const candidatos = [];
  for (let quantas = tokens.length; quantas >= 1; quantas -= 1) {
    candidatos.push(tokens.slice(0, quantas).flat());
  }
  return candidatos;
}

/** Escolhe a fonte do termo: a coluna nova quando existe, senão o nome antigo. */
const termoPara = (tabela, nome, colunasNovas) =>
  colunasNovas.length ? termoDaColuna(colunasNovas) : termoDoNome(tabela, nome);

const encurtar = (t, n) => t.map((x) => (n && x.length > n ? x.slice(0, n) : x)).join("_");

function nomear(prefixo, codigo, candidatos) {
  const listas = candidatos.length ? candidatos : [["ref"]];
  // Termo mais completo primeiro; abreviar antes de reduzir o termo.
  for (const tokens of listas) {
    for (const nCod of [null, 6, 4, 3]) {
      for (const nTermo of [null, 8, 6, 5, 4]) {
        const nome = `${prefixo}_${encurtar(codigo.split("_"), nCod)}_${encurtar(tokens, nTermo)}`;
        if (nome.length <= LIMITE && !usados.has(nome)) { usados.add(nome); return nome; }
      }
    }
  }
  throw new Error(`Não foi possível nomear ${prefixo}_${codigo}`);
}

/** O nome à mão tem precedência; no resto, deriva. */
function nomearOu(velho, prefixo, codigo, candidatos) {
  const manual = NOMES_MANUAIS[velho];
  if (manual) {
    if (manual.length > LIMITE) throw new Error(`${manual} tem ${manual.length} caracteres`);
    if (usados.has(manual)) throw new Error(`${manual} repetido`);
    usados.add(manual);
    return manual;
  }
  return nomear(prefixo, codigo, candidatos);
}

const { rows: constraints } = await cliente.query(
  `select rel.relname as tabela, c.conname as nome, c.contype as tipo, pai.relname as tabela_pai,
          coalesce((select array_agg(a.attname order by k.ord)
                    from unnest(c.conkey) with ordinality k(att, ord)
                    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.att)::text[], '{}'::text[]) as colunas
   from pg_constraint c
   join pg_class rel on rel.oid = c.conrelid
   left join pg_class pai on pai.oid = c.confrelid
   where rel.relnamespace = 'sigav'::regnamespace and rel.relname = any($1)
   order by rel.relname, c.contype, c.conname`,
  [TABELAS],
);
const { rows: indices } = await cliente.query(
  `select rel.relname as tabela, idx.relname as nome, i.indisunique as unico,
          (select array_agg(a.attname order by k.ord)
           from unnest(i.indkey::int[]) with ordinality k(att, ord)
           join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.att)::text[] as colunas
   from pg_index i
   join pg_class idx on idx.oid = i.indexrelid
   join pg_class rel on rel.oid = i.indrelid
   where rel.relnamespace = 'sigav'::regnamespace and rel.relname = any($1)
     and not exists (select 1 from pg_constraint c where c.conindid = i.indexrelid)
   order by rel.relname, idx.relname`,
  [TABELAS],
);

const novasDe = (tabela, colunas) => (colunas || []).map((c) => MAPA[tabela][c]).filter(Boolean);

// Nomes antigos que existiam SÓ nas tabelas deste lote. Depois do rename,
// qualquer menção a um deles em corpo de função é sobra — referência a coluna
// que não existe mais, que o PostgreSQL só descobre em execução. Para os nomes
// ambíguos (`status`, `id`, `metadata`) a varredura não serve, e o que vale é a
// revisão trecho a trecho.
const velhosDoLote = [...new Set(TABELAS.flatMap((t) => Object.keys(MAPA[t])))];
const { rows: repetidos } = await cliente.query(
  `select distinct a.attname
     from pg_attribute a
     join pg_class cl on cl.oid = a.attrelid
    where cl.relnamespace = 'sigav'::regnamespace and cl.relkind = 'r'
      and a.attnum > 0 and not a.attisdropped
      and a.attname = any($1)
      and not (cl.relname = any($2))`,
  [velhosDoLote, TABELAS],
);
const ambiguos = new Set(repetidos.map((r) => r.attname));
const EXCLUSIVOS = velhosDoLote.filter((c) => !ambiguos.has(c));
const SOBRAS = Object.entries(SOBRAS_ACEITAS[lote] ?? {})
  .flatMap(([funcao, colunas]) => colunas.map((c) => `${funcao}|${c}`));

const partes = [];
const emitir = (s) => partes.push(s);

let edicoes = FUNCOES[lote] ?? {};
if (lote === "6") {
  const { rows: afetadas } = await cliente.query(
    `select p.proname, pg_get_function_identity_arguments(p.oid) as args,
            coalesce(
              array_agg(distinct cl.relname::text) filter (where cl.relname is not null),
              '{}'::text[]
            ) as gatilhos
       from pg_proc p
       left join pg_trigger tg on tg.tgfoid = p.oid and not tg.tgisinternal
       left join pg_class cl on cl.oid = tg.tgrelid
      where p.pronamespace = 'sigav'::regnamespace
        and (
          exists (
            select 1 from unnest($1::text[]) t(tabela)
             where pg_get_functiondef(p.oid) like ('%sigav."' || t.tabela || '"%')
          )
          or cl.relname = any($1)
        )
      group by p.oid, p.proname
      order by p.proname, p.oid`,
    [TABELAS],
  );
  edicoes = Object.fromEntries(afetadas.map((f) => [
    `${f.proname}(${f.args})`,
    { modo: AUTO_ESCOPO, gatilhos: f.gatilhos },
  ]));
}

const totalColunas = TABELAS.reduce((n, t) => n + Object.keys(MAPA[t]).length, 0);

// O cabeçalho da migration precisa dizer a verdade sobre o risco DESTE lote: o
// lote 1 podia se dar ao luxo de nenhuma função referenciar as tabelas, e os
// seguintes não. A frase é montada aqui porque o cabeçalho é emitido antes de a
// seção de funções ser lida.
const QUANTAS_FUNCOES = Object.keys(edicoes).length;
const RISCO = QUANTAS_FUNCOES === 0
  ? `Este lote é o mais seguro que existe: NENHUMA função de \`sigav\` referencia\n-- estas ${TABELAS.length} tabelas.`
  : `RISCO DESTE LOTE: ${QUANTAS_FUNCOES} função(ões) referenciam estas ${TABELAS.length} tabelas, e cada\n-- substituição de corpo abaixo foi conferida contra a linha real. A rede está no\n-- gerador (o trecho tem de casar exatamente, senão a geração falha) e no bloco de\n-- autoverificação ao final, que acusa função que toque estas tabelas e não conste\n-- da lista revisada.`;

emitir(`-- Colunas no padrão institucional — LOTE ${lote}.
--
--   item 7 — prefixo semântico por natureza do dado (CO_, SQ_, DT_, DS_, NO_,
--            NU_, QT_, ST_, TP_, AU_ …);
--   item 3 — MAIÚSCULAS, português, no máximo 30 caracteres.
--
-- POR QUE EM LOTES: corpo de PL/pgSQL resolve identificador em execução, então
-- referência errada a coluna não falha ao criar a função — falha em produção,
-- no caminho que ninguém exercitou. A suíte cobre 24 das 174 funções e
-- \`plpgsql_check\` não está disponível neste cluster.
--
-- ${RISCO}
--
-- VOCABULÁRIO, herdado das 108 colunas que o projeto já havia padronizado:
--   \`id\` e FK uuid    -> SQ_<entidade>      (como \`sq_pessoa\`, \`sq_aplicacao\`)
--   \`created_at\`      -> DT_INCLUSAO        \\ par com AU_USUARIO_INCLUSAO e
--   \`updated_at\`      -> DT_ALTERACAO       / AU_USUARIO_ALTERACAO (item 7)
--   \`*_by\` (autoria)  -> AU_USUARIO_<ato>
--   \`jsonb\`           -> DS_                (como \`tl_erro_aplicacao.ds_contexto\`)
--
-- As constraints e os índices são renomeados junto: o nome deles aponta a
-- coluna, e \`CK_OCORR_IMP_ROW_NUMBER\` sobre uma coluna hoje chamada
-- \`NU_LINHA\` seria a mesma incoerência que este trabalho vem eliminar.
--
-- ${totalColunas} colunas, ${constraints.length} constraints, ${indices.length} índices.

begin;

-- ---------------------------------------------------------------------------
-- 1. Colunas (item 7)
-- ---------------------------------------------------------------------------
`);

for (const tabela of TABELAS) {
  emitir(`-- ${tabela}`);
  for (const [velho, novo] of Object.entries(MAPA[tabela])) {
    emitir(`alter table sigav.${id(tabela)} rename column ${velho} to ${id(novo)};`);
  }
  emitir("");
}

emitir(`-- ---------------------------------------------------------------------------
-- 2. Constraints e índices, realinhados à coluna nova (item 8)
-- ---------------------------------------------------------------------------
`);

const destino = new Map();
if (lote === "6") {
  // Constraints e índices já foram postos no padrão pelo lote de objetos. No
  // fechamento das colunas, conservá-los evita fabricar abreviações novas e
  // preserva referências nominais de ON CONFLICT.
  for (const c of constraints) destino.set(c.nome, c.nome);
} else {
  for (const c of constraints.filter((c) => c.tipo === "p")) {
    const cheio = `pk_${c.tabela.toLowerCase()}`;
    const nome = cheio.length <= LIMITE ? cheio : `pk_${CODIGO[c.tabela]}`;
    usados.add(nome);
    destino.set(c.nome, nome);
  }
  for (const c of constraints.filter((c) => c.tipo === "u")) {
    destino.set(c.nome, nomearOu(c.nome, "uk", CODIGO[c.tabela], termoPara(c.tabela, c.nome, novasDe(c.tabela, c.colunas))));
  }
  for (const c of constraints.filter((c) => c.tipo === "f")) {
    const pai = CODIGO[c.tabela_pai] ?? (c.tabela_pai || "ext").toLowerCase().replace(/^(tb|tl|rl|rt|th)_/, "");
    const simples = `fk_${pai}_${CODIGO[c.tabela]}`;
    if (simples.length <= LIMITE && !usados.has(simples)) { usados.add(simples); destino.set(c.nome, simples); }
    else {
      // Num FK o prefixo `SQ_` da coluna não distingue nada — todas as quatro
      // ligações de TB_CORRECAO_VINCULO_CDDI para TB_PESSOA começariam por
      // `SQ_`. O discriminador é o resto do nome da coluna.
      const coluna = novasDe(c.tabela, [c.colunas[0]])[0];
      const disc = coluna
        ? [coluna.toLowerCase().replace(/^(co|sq|dt|hr|ds|no|nu|qt|vl|tx|sg|st|tp|im|cg|au)_/, "").split("_")]
        : termoDoNome(c.tabela, c.nome);
      destino.set(c.nome, nomearOu(c.nome, "fk", `${pai}_${CODIGO[c.tabela]}`, disc));
    }
  }
  for (const c of constraints.filter((c) => c.tipo === "c")) {
    destino.set(c.nome, nomearOu(c.nome, "ck", CODIGO[c.tabela], termoPara(c.tabela, c.nome, novasDe(c.tabela, c.colunas))));
  }
}

/**
 * Reescreve o lote final usando o escopo SQL que revela a tabela de cada
 * identificador: alias de FROM/JOIN, variável %rowtype, NEW/OLD de gatilho e
 * alvo de INSERT/UPDATE/DELETE. Nomes cujo destino é igual em todas as tabelas
 * (`created_at` -> DT_INCLUSAO, por exemplo) podem ser trocados por token.
 */
function reescreverPorEscopo(definicao, mapaTabelas, tabelasGatilho = []) {
  const porNome = new Map();
  for (const mapa of Object.values(mapaTabelas)) {
    for (const [velho, novo] of Object.entries(mapa)) {
      if (!porNome.has(velho)) porNome.set(velho, new Set());
      porNome.get(velho).add(novo);
    }
  }
  const comuns = Object.fromEntries(
    [...porNome].filter(([, novos]) => novos.size === 1)
      .map(([velho, novos]) => [velho, [...novos][0]]),
  );

  const abre = definicao.indexOf("$function$");
  const fecha = definicao.lastIndexOf("$function$");
  if (abre === -1 || fecha === abre) throw new Error("definição sem corpo delimitado");
  const cabeca = definicao.slice(0, abre + "$function$".length);
  let corpo = definicao.slice(abre + "$function$".length, fecha);
  const cauda = definicao.slice(fecha);

  // Variável declarada exatamente com nome de coluna não pode sofrer troca
  // global. Referências qualificadas continuam sendo tratadas mais abaixo.
  const declaracoes = (corpo.match(/^[ \t]*declare[\s\S]*?\bbegin\b/im) ?? [""])[0];
  for (const velho of Object.keys(comuns)) {
    if (new RegExp(`\\b${velho}\\b`, "i").test(declaracoes)) delete comuns[velho];
  }

  const escopos = new Map();
  const palavrasSql = new Set([
    "where", "set", "on", "values", "returning", "order", "group", "limit",
    "offset", "join", "left", "right", "inner", "outer", "cross", "full",
    "union", "intersect", "except", "for", "loop", "using",
  ]);
  const tabelas = Object.keys(mapaTabelas).join("|");
  const aliasesDeclarados = new Set();
  const reTabela = new RegExp(`sigav[.]"(${tabelas})"(?:\\s+(?:as\\s+)?([a-zA-Z_][a-zA-Z0-9_]*))?`, "gi");
  for (const m of corpo.matchAll(reTabela)) {
    if (m[2] && !palavrasSql.has(m[2].toLowerCase())) aliasesDeclarados.add(m[2]);
    escopos.set(`sigav."${m[1]}"`, mapaTabelas[m[1]]);
  }
  const reRowtype = new RegExp(`\\b([a-zA-Z_][a-zA-Z0-9_]*)\\s+sigav[.]"(${tabelas})"%rowtype`, "gi");
  for (const m of corpo.matchAll(reRowtype)) escopos.set(m[1], mapaTabelas[m[2]]);
  const reForRecord = new RegExp(
    `\\bfor\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s+in[^;]{0,2500}?\\bfrom\\s+sigav[.]"(${tabelas})"`,
    "gi",
  );
  for (const m of corpo.matchAll(reForRecord)) escopos.set(m[1], mapaTabelas[m[2]]);
  const reIntoRecord = new RegExp(
    `\\binto\\s+([a-zA-Z_][a-zA-Z0-9_]*)\\s+from\\s+sigav[.]"(${tabelas})"`,
    "gi",
  );
  for (const m of corpo.matchAll(reIntoRecord)) escopos.set(m[1], mapaTabelas[m[2]]);

  // Um nome comum também pode ser alias SQL ou função nativa (`settings` foi
  // usado como alias; `position(...)` é função do PostgreSQL). Esses casos só
  // podem mudar quando qualificados ou dentro de uma lista de DML.
  for (const alias of escopos.keys()) delete comuns[alias];
  delete comuns.position;
  // `jsonb_array_elements` também expõe uma coluna interna chamada `value`.
  // A coluna física homônima de TB_OPCAO_PERGUNTA continua sendo resolvida
  // pelo alias ou pelo contexto da tabela.
  delete comuns.value;

  const mapasGatilho = tabelasGatilho.map((t) => mapaTabelas[t]).filter(Boolean);
  if (mapasGatilho.length) {
    const mapaNewOld = {};
    for (const velho of new Set(mapasGatilho.flatMap((m) => Object.keys(m)))) {
      const novos = new Set(mapasGatilho.map((m) => m[velho]).filter(Boolean));
      if (novos.size === 1) mapaNewOld[velho] = [...novos][0];
    }
    escopos.set("new", mapaNewOld);
    escopos.set("old", mapaNewOld);
  }

  const trocarLista = (texto, mapa) => {
    let saida = texto;
    for (const [velho, novo] of Object.entries(mapa)) {
      saida = saida.replace(new RegExp(`\\b${velho}\\b`, "g"), `"${novo}"`);
    }
    return saida;
  };

  // INSERT conhece o mapa da tabela inclusive para lista de colunas,
  // EXCLUDED, ON CONFLICT e RETURNING.
  for (const [tabela, mapa] of Object.entries(mapaTabelas)) {
    const reInsert = new RegExp(`insert\\s+into\\s+sigav[.]"${tabela}"[\\s\\S]*?;`, "gi");
    corpo = corpo.replace(reInsert, (stmt) => {
      let novoStmt = stmt.replace(
        new RegExp(`(insert\\s+into\\s+sigav[.]"${tabela}"\\s*[(])([^)]*)([)])`, "i"),
        (_, inicio, lista, fim) => inicio + trocarLista(lista, mapa) + fim,
      );
      novoStmt = novoStmt.replace(/excluded[.]([a-zA-Z_][a-zA-Z0-9_]*)/g, (todo, coluna) =>
        mapa[coluna] ? `excluded."${mapa[coluna]}"` : todo);
      novoStmt = novoStmt.replace(/on\s+conflict\s*[(]([^)]*)[)]/gi, (_, lista) =>
        `on conflict (${trocarLista(lista, mapa)})`);
      novoStmt = novoStmt.replace(/returning\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi, (todo, coluna) =>
        mapa[coluna] ? `returning "${mapa[coluna]}"` : todo);
      return novoStmt;
    });

    // SELECT simples sem alias (`select id from ...`) e colunas à esquerda de
    // SET/WHERE em UPDATE/DELETE conhecem inequivocamente a tabela-alvo.
    for (const [velho, novo] of Object.entries(mapa)) {
      corpo = corpo.replace(
        new RegExp(`(select\\s+)${velho}(\\s+from\\s+sigav[.]"${tabela}")`, "gi"),
        `$1"${novo}"$2`,
      );
    }
    const reMutacao = new RegExp(
      `(?:update\\s+sigav[.]"${tabela}"|delete\\s+from\\s+sigav[.]"${tabela}")[\\s\\S]*?;`,
      "gi",
    );
    corpo = corpo.replace(reMutacao, (stmt) => {
      let novoStmt = stmt;
      for (const [velho, novo] of Object.entries(mapa)) {
        novoStmt = novoStmt.replace(
          new RegExp(`(?<![.])\\b${velho}\\b(?=\\s*=)`, "g"),
          `"${novo}"`,
        );
      }
      return novoStmt;
    });
  }

  // Alias SQL pode ser reutilizado em CTEs diferentes da mesma função (`s`
  // costuma significar pesquisa em um bloco e submissão em outro). Resolve-se
  // cada alias no menor bloco de parênteses que contém sua declaração, em vez
  // de assumir um significado global para a função inteira.
  const codigo = new Uint8Array(corpo.length).fill(1);
  const pares = [];
  const pilha = [];
  const pontosVirgula = [-1];
  let estado = "codigo";
  for (let p = 0; p < corpo.length; p += 1) {
    const ch = corpo[p];
    const prox = corpo[p + 1];
    if (estado === "literal") {
      codigo[p] = 0;
      if (ch === "'" && prox === "'") { codigo[p + 1] = 0; p += 1; continue; }
      if (ch === "'") estado = "codigo";
      continue;
    }
    if (estado === "identificador") {
      codigo[p] = 0;
      if (ch === '"') estado = "codigo";
      continue;
    }
    if (estado === "comentario_linha") {
      codigo[p] = 0;
      if (ch === "\n") estado = "codigo";
      continue;
    }
    if (estado === "comentario_bloco") {
      codigo[p] = 0;
      if (ch === "*" && prox === "/") { codigo[p + 1] = 0; p += 1; estado = "codigo"; }
      continue;
    }
    if (ch === "'") { codigo[p] = 0; estado = "literal"; continue; }
    if (ch === '"') { codigo[p] = 0; estado = "identificador"; continue; }
    if (ch === "-" && prox === "-") { codigo[p] = codigo[p + 1] = 0; p += 1; estado = "comentario_linha"; continue; }
    if (ch === "/" && prox === "*") { codigo[p] = codigo[p + 1] = 0; p += 1; estado = "comentario_bloco"; continue; }
    if (ch === "(") pilha.push(p);
    else if (ch === ")" && pilha.length) pares.push([pilha.pop(), p]);
    else if (ch === ";") pontosVirgula.push(p);
  }
  pontosVirgula.push(corpo.length);
  const escopoDe = (pos) => {
    const dentro = pares.filter(([abrePar, fechaPar]) => abrePar < pos && pos < fechaPar)
      .sort((a, b) => (a[1] - a[0]) - (b[1] - b[0]));
    if (dentro.length) return dentro[0];
    let inicio = -1;
    let fim = corpo.length;
    for (const ponto of pontosVirgula) {
      if (ponto < pos) inicio = ponto;
      else { fim = ponto; break; }
    }
    return [inicio, fim];
  };
  const definicoesAlias = [];
  const mapasCte = new Map();
  const reAliasEscopado = new RegExp(`sigav[.]"(${tabelas})"(?:\\s+(?:as\\s+)?([a-zA-Z_][a-zA-Z0-9_]*))?`, "gi");
  for (const m of corpo.matchAll(reAliasEscopado)) {
    if (!codigo[m.index] || !m[2] || palavrasSql.has(m[2].toLowerCase())) continue;
    definicoesAlias.push({ alias: m[2], mapa: mapaTabelas[m[1]], escopo: escopoDe(m.index) });
  }
  for (const [abrePar, fechaPar] of [...pares].sort((a, b) => a[0] - b[0])) {
    const interior = corpo.slice(abrePar + 1, fechaPar);
    const primeiraTabela = interior.match(new RegExp(
      `\\b(?:from|update|into|delete\\s+from)\\s+sigav[.]"(${tabelas})"`,
      "i",
    ));
    let mapaDerivado = primeiraTabela ? mapaTabelas[primeiraTabela[1]] : null;
    if (!mapaDerivado) {
      const primeiraCte = interior.match(/\bfrom\s+([a-zA-Z_][a-zA-Z0-9_]*)/i)?.[1];
      mapaDerivado = primeiraCte ? mapasCte.get(primeiraCte) : null;
    }
    if (!mapaDerivado) {
      const projetado = {};
      for (const [velho, novos] of porNome) {
        const presentes = [...novos].filter((novo) => interior.includes(`"${novo}"`));
        if (presentes.length === 1) projetado[velho] = presentes[0];
      }
      if (Object.keys(projetado).length) mapaDerivado = projetado;
    }
    if (!mapaDerivado) continue;

    // Alias de subconsulta/lateral: `(select ... from TABELA) alias on ...`.
    const depois = corpo.slice(fechaPar + 1, fechaPar + 100);
    const aliasDepois = depois.match(/^\s*(?:as\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:on\b|where\b|join\b|left\b|right\b|inner\b|outer\b|full\b|cross\b|,|;|[)])/i);
    if (aliasDepois && !palavrasSql.has(aliasDepois[1].toLowerCase())) {
      const posAlias = fechaPar + 1 + depois.indexOf(aliasDepois[1]);
      definicoesAlias.push({ alias: aliasDepois[1], mapa: mapaDerivado, escopo: escopoDe(posAlias) });
    }

    // Alias de CTE: `nome as (select ... from TABELA)`; as colunas sem `AS`
    // conservam o nome da tabela de origem, agora já padronizado.
    const antes = corpo.slice(Math.max(0, abrePar - 100), abrePar);
    const aliasAntes = antes.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s+as\s*$/i);
    if (aliasAntes && !palavrasSql.has(aliasAntes[1].toLowerCase())) {
      const inicioStmt = pontosVirgula.filter((p) => p < abrePar).at(-1) ?? -1;
      const fimStmt = pontosVirgula.find((p) => p > fechaPar) ?? corpo.length;
      definicoesAlias.push({ alias: aliasAntes[1], mapa: mapaDerivado, escopo: [inicioStmt, fimStmt] });
      mapasCte.set(aliasAntes[1], mapaDerivado);
    }
  }
  // Alias usado ao consumir uma CTE: `from question_rows qr`. Ele herda os
  // nomes da tabela-base escolhida na definição da CTE.
  for (const [cte, mapaCte] of mapasCte) {
    const reUsoCte = new RegExp(
      `\\b(?:from|join)\\s+${cte}(?:\\s+(?:as\\s+)?([a-zA-Z_][a-zA-Z0-9_]*))?`,
      "gi",
    );
    for (const uso of corpo.matchAll(reUsoCte)) {
      const candidato = uso[1]?.toLowerCase();
      const alias = candidato && !palavrasSql.has(candidato) ? uso[1] : cte;
      definicoesAlias.push({ alias, mapa: mapaCte, escopo: escopoDe(uso.index) });
    }
  }
  const edicoesAlias = new Map();
  for (const definicao of definicoesAlias) {
    const aliasEsc = definicao.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const [velho, novo] of Object.entries(definicao.mapa)) {
      const reRef = new RegExp(`\\b${aliasEsc}[.]${velho}\\b`, "g");
      for (const ref of corpo.matchAll(reRef)) {
        if (!codigo[ref.index]) continue;
        if (ref.index < definicao.escopo[0] || ref.index > definicao.escopo[1]) continue;
        const largura = definicao.escopo[1] - definicao.escopo[0];
        const atual = edicoesAlias.get(ref.index);
        if (!atual || largura < atual.largura) {
          edicoesAlias.set(ref.index, {
            fim: ref.index + ref[0].length,
            texto: `${definicao.alias}."${novo}"`,
            largura,
          });
        }
      }
    }
  }
  // Subconsulta que consome a CTE sem alias (`select ... from app`): os nomes
  // não qualificados são as colunas projetadas pela tabela-base da CTE.
  for (const [cte, mapaCte] of mapasCte) {
    const reUsoSemAlias = new RegExp(
      `\\bfrom\\s+${cte}(?:\\s+(?:as\\s+)?([a-zA-Z_][a-zA-Z0-9_]*))?`,
      "gi",
    );
    for (const uso of corpo.matchAll(reUsoSemAlias)) {
      if (uso[1] && !palavrasSql.has(uso[1].toLowerCase())) continue;
      const escopo = escopoDe(uso.index);
      for (const [velho, novo] of Object.entries(mapaCte)) {
        const reToken = new RegExp(`\\b${velho}\\b`, "g");
        for (const ref of corpo.matchAll(reToken)) {
          if (!codigo[ref.index] || ref.index < escopo[0] || ref.index > escopo[1]) continue;
          const antes = corpo[ref.index - 1] ?? "";
          const depois = corpo.slice(ref.index + ref[0].length);
          if (antes === "." || depois.startsWith(".") || /^\s*[(]/.test(depois)) continue;
          const largura = escopo[1] - escopo[0];
          const atual = edicoesAlias.get(ref.index);
          if (!atual || largura < atual.largura) {
            edicoesAlias.set(ref.index, {
              fim: ref.index + ref[0].length,
              texto: `"${novo}"`,
              largura,
            });
          }
        }
      }
    }
  }
  for (const [inicio, edicao] of [...edicoesAlias].sort((a, b) => b[0] - a[0])) {
    corpo = corpo.slice(0, inicio) + edicao.texto + corpo.slice(edicao.fim);
  }

  // Em referência não qualificada, o próprio comando determina o escopo. Se
  // um trecho entre `;` menciona uma só tabela pendente, qualquer identificador
  // legado daquele mapa pertence a ela. Com várias tabelas, só entram nomes
  // cujo destino é igual em todas as tabelas que os possuem.
  const bloqueados = new Set([...escopos.keys(), ...aliasesDeclarados]);
  for (const m of declaracoes.matchAll(/^[ \t]*([a-zA-Z_][a-zA-Z0-9_]*)\s+/gm)) bloqueados.add(m[1]);
  for (const m of cabeca.matchAll(/(?:[(,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s+[a-zA-Z_]/g)) bloqueados.add(m[1]);
  for (const m of corpo.matchAll(/\bfor\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+in\b/gi)) bloqueados.add(m[1]);

  const trocarNaoQualificado = (texto, mapa) => texto.replace(
    /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g,
    (token, deslocamento, todo) => {
      const novo = mapa[token];
      if (!novo || bloqueados.has(token)) return token;
      const antes = todo[deslocamento - 1] ?? "";
      const depois = todo.slice(deslocamento + token.length);
      if (antes === "." || depois.startsWith(".")) return token;
      if (/^\s*[(]/.test(depois)) return token;
      return `"${novo}"`;
    },
  );
  const transformarCodigoSimples = (texto, mapa, qualificados = new Map()) => {
    let resultado = "";
    let pos = 0;
    while (pos < texto.length) {
      const ch = texto[pos];
      if (ch === "'") {
        let fim = pos + 1;
        while (fim < texto.length) {
          if (texto[fim] === "'" && texto[fim + 1] === "'") { fim += 2; continue; }
          if (texto[fim] === "'") { fim += 1; break; }
          fim += 1;
        }
        resultado += texto.slice(pos, fim); pos = fim; continue;
      }
      if (ch === '"') {
        const fim = texto.indexOf('"', pos + 1) + 1;
        resultado += texto.slice(pos, fim || texto.length); pos = fim || texto.length; continue;
      }
      if (ch === "-" && texto[pos + 1] === "-") {
        const quebra = texto.indexOf("\n", pos);
        const fim = quebra === -1 ? texto.length : quebra;
        resultado += texto.slice(pos, fim); pos = fim; continue;
      }
      if (ch === "/" && texto[pos + 1] === "*") {
        const fechaBloco = texto.indexOf("*/", pos + 2);
        const fim = fechaBloco === -1 ? texto.length : fechaBloco + 2;
        resultado += texto.slice(pos, fim); pos = fim; continue;
      }
      let fim = pos;
      while (fim < texto.length) {
        if (texto[fim] === "'" || texto[fim] === '"') break;
        if (texto[fim] === "-" && texto[fim + 1] === "-") break;
        if (texto[fim] === "/" && texto[fim + 1] === "*") break;
        fim += 1;
      }
      let codigo = texto.slice(pos, fim);
      for (const [alias, mapaAlias] of qualificados) {
        const aliasEsc = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        for (const [velho, novo] of Object.entries(mapaAlias)) {
          codigo = codigo.replace(
            new RegExp(`\\b${aliasEsc}[.]${velho}\\b`, "g"),
            `${alias}."${novo}"`,
          );
        }
      }
      resultado += trocarNaoQualificado(codigo, mapa);
      pos = fim;
    }
    return resultado;
  };
  const segmentos = [];
  let inicioSegmento = 0;
  let emLiteral = false;
  let emIdentificador = false;
  let emComentarioLinha = false;
  let emComentarioBloco = false;
  for (let p = 0; p < corpo.length; p += 1) {
    const ch = corpo[p];
    const prox = corpo[p + 1];
    if (emComentarioLinha) { if (ch === "\n") emComentarioLinha = false; continue; }
    if (emComentarioBloco) { if (ch === "*" && prox === "/") { emComentarioBloco = false; p += 1; } continue; }
    if (emLiteral) {
      if (ch === "'" && prox === "'") { p += 1; continue; }
      if (ch === "'") emLiteral = false;
      continue;
    }
    if (emIdentificador) { if (ch === '"') emIdentificador = false; continue; }
    if (ch === "-" && prox === "-") { emComentarioLinha = true; p += 1; continue; }
    if (ch === "/" && prox === "*") { emComentarioBloco = true; p += 1; continue; }
    if (ch === "'") { emLiteral = true; continue; }
    if (ch === '"') { emIdentificador = true; continue; }
    if (ch === ";") { segmentos.push(corpo.slice(inicioSegmento, p + 1)); inicioSegmento = p + 1; }
  }
  segmentos.push(corpo.slice(inicioSegmento));
  corpo = segmentos.map((segmento) => {
    const presentes = Object.keys(mapaTabelas).filter((t) => segmento.includes(`sigav."${t}"`));
    if (!presentes.length) return segmento;
    const mapaSegmento = {};
    const nomes = new Set(presentes.flatMap((t) => Object.keys(mapaTabelas[t])));
    for (const velho of nomes) {
      const novos = new Set(presentes.map((t) => mapaTabelas[t][velho]).filter(Boolean));
      if (presentes.length === 1 || novos.size === 1) mapaSegmento[velho] = [...novos][0];
    }
    return transformarCodigoSimples(segmento, mapaSegmento);
  }).join("");

  // Percorre apenas regiões de código, preservando literais, comentários e
  // identificadores já citados. Primeiro aplica alias/rowtype/NEW-OLD; depois
  // os nomes de destino comum a todas as tabelas do lote.
  let saida = "";
  let i = 0;
  const transformarCodigo = (pedaco) => {
    let novoPedaco = pedaco;
    for (const [alias, mapa] of escopos) {
      const aliasEsc = alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      for (const [velho, novo] of Object.entries(mapa)) {
        novoPedaco = novoPedaco.replace(
          new RegExp(`\\b${aliasEsc}[.]${velho}\\b`, "g"),
          `${alias}."${novo}"`,
        );
      }
    }
    for (const [velho, novo] of Object.entries(comuns)) {
      novoPedaco = novoPedaco.replace(new RegExp(`\\b${velho}\\b`, "g"), `"${novo}"`);
    }
    return novoPedaco;
  };
  while (i < corpo.length) {
    const c = corpo[i];
    if (c === "'") {
      let j = i + 1;
      while (j < corpo.length) {
        if (corpo[j] === "'" && corpo[j + 1] === "'") { j += 2; continue; }
        if (corpo[j] === "'") { j += 1; break; }
        j += 1;
      }
      saida += corpo.slice(i, j); i = j; continue;
    }
    if (c === '"') {
      const j = corpo.indexOf('"', i + 1) + 1;
      saida += corpo.slice(i, j || corpo.length); i = j || corpo.length; continue;
    }
    if (c === "-" && corpo[i + 1] === "-") {
      const j = corpo.indexOf("\n", i);
      const fim = j === -1 ? corpo.length : j;
      saida += corpo.slice(i, fim); i = fim; continue;
    }
    if (c === "/" && corpo[i + 1] === "*") {
      const j = corpo.indexOf("*/", i + 2);
      const fim = j === -1 ? corpo.length : j + 2;
      saida += corpo.slice(i, fim); i = fim; continue;
    }
    let j = i;
    while (j < corpo.length) {
      const d = corpo[j];
      if (d === "'" || d === '"') break;
      if (d === "-" && corpo[j + 1] === "-") break;
      if (d === "/" && corpo[j + 1] === "*") break;
      j += 1;
    }
    saida += transformarCodigo(corpo.slice(i, j));
    i = j;
  }
  let resultado = cabeca + saida + cauda;

  // A CTE `inclusoes_pedidas` projeta a identidade já com o nome definitivo;
  // como ela nasce de JSON (e não de uma relação), a inferência de alias não
  // consegue descobrir esse campo automaticamente.
  if (definicao.includes('sigav."FC_PREVISUALIZAR_PUBLICO"')) {
    resultado = resultado.replace(/\bi\.id\b/g, 'i."SQ_PESSOA"');
  }

  return resultado;
}

for (const c of constraints) {
  const novo = destino.get(c.nome);
  if (id(novo) === id(c.nome)) continue;
  emitir(`alter table sigav.${id(c.tabela)} rename constraint ${id(c.nome)} to ${id(novo)};`);
}
emitir("");

const colunasFk = new Set(constraints.filter((c) => c.tipo === "f").map((c) => `${c.tabela}|${c.colunas.join(",")}`));
for (const i of indices) {
  const cols = i.colunas || [];
  const prefixo = i.unico ? "uk" : (colunasFk.has(`${i.tabela}|${cols.join(",")}`) ? "in_fk" : "in");
  const novo = lote === "6"
    ? i.nome
    : nomearOu(i.nome, prefixo, CODIGO[i.tabela], termoPara(i.tabela, i.nome, novasDe(i.tabela, cols)));
  if (id(novo) === id(i.nome)) continue;
  emitir(`alter index sigav.${id(i.nome)} rename to ${id(novo)};`);
}
emitir("");


// --- Funções afetadas -------------------------------------------------------
// Chave pode vir com a assinatura, para distinguir sobrecarga:
//   "FC_CONCLUIR_EMAIL_PARTICIPANTE(target_email_id uuid, ...)"
// Sem assinatura, exige-se que só exista uma função com aquele nome — do
// contrário a troca cairia em uma das versões e a outra ficaria para trás, que
// foi como `tx_perfis_param` sobreviveu ao fim dos perfis.
const chaves = Object.keys(edicoes).map((k) => {
  const abre = k.indexOf("(");
  return abre === -1
    ? { chave: k, nome: k, args: null }
    : { chave: k, nome: k.slice(0, abre), args: k.slice(abre + 1, k.lastIndexOf(")")) };
});
const nomesFuncoes = [...new Set(chaves.map((c) => c.nome))];

const montarMapaToken = (tabelas, excluir = []) => {
  const mapa = {};
  const ignoradas = new Set(excluir);
  for (const tabela of tabelas) {
    for (const [velho, novo] of Object.entries(MAPA[tabela] ?? {})) {
      if (!ignoradas.has(velho)) mapa[velho] = novo;
    }
  }
  return mapa;
};

// Colunas elegíveis à troca por token no modo AUTO original, que cobre tabelas
// inteiras. Lotes posteriores também podem declarar um subconjunto por função.
const MAPA_TOKEN = montarMapaToken(POR_TOKEN[lote] ?? []);

// Prova 1: o nome antigo pertence exclusivamente às tabelas deste lote. Se
// outra tabela do schema tiver coluna com o mesmo nome, a troca por token
// poderia atingir a referência dela.
async function provarExclusividadeToken(mapaToken, tabelasToken) {
  if (!Object.keys(mapaToken).length) throw new Error("troca por token sem colunas");
  const { rows: colisoes } = await cliente.query(
    `select a.attname, string_agg(distinct cl.relname, ', ' order by cl.relname) as tabelas
       from pg_attribute a
       join pg_class cl on cl.oid = a.attrelid
      where cl.relnamespace = 'sigav'::regnamespace and cl.relkind = 'r'
        and a.attnum > 0 and not a.attisdropped
        and a.attname = any($1)
        and not (cl.relname = any($2))
      group by a.attname`,
    [Object.keys(mapaToken), tabelasToken],
  );
  if (colisoes.length) {
    throw new Error(
      "troca por token insegura — nome de coluna repetido fora do lote: " +
      colisoes.map((c) => `${c.attname} (${c.tabelas})`).join("; "),
    );
  }
}

if (Object.keys(MAPA_TOKEN).length) {
  await provarExclusividadeToken(MAPA_TOKEN, POR_TOKEN[lote] ?? []);
}

// Prova também as configurações AUTO parciais. O cache evita repetir a mesma
// consulta nas dez funções de regras condicionais do lote 5.
const autosParciaisProvados = new Set();
for (const instrucao of Object.values(edicoes)) {
  if (!instrucao || typeof instrucao !== "object" || instrucao.modo !== AUTO) continue;
  const chave = JSON.stringify([instrucao.tabelas, instrucao.excluir]);
  if (autosParciaisProvados.has(chave)) continue;
  await provarExclusividadeToken(
    montarMapaToken(instrucao.tabelas, instrucao.excluir),
    instrucao.tabelas,
  );
  autosParciaisProvados.add(chave);
}

if (chaves.length) {
  const { rows: funcoes } = await cliente.query(
    `select p.proname, pg_get_function_identity_arguments(p.oid) as args,
            pg_get_functiondef(p.oid) as definicao
       from pg_proc p
      where p.pronamespace = 'sigav'::regnamespace and p.proname = any($1)
      order by p.proname, p.oid`,
    [nomesFuncoes],
  );
  const alvos = chaves.map((c) => {
    const candidatas = funcoes.filter((f) => f.proname === c.nome);
    if (!candidatas.length) throw new Error(`Função não encontrada: ${c.nome}`);
    if (c.args === null) {
      if (candidatas.length > 1) {
        throw new Error(
          `${c.nome} tem ${candidatas.length} assinaturas; escreva a chave com a assinatura: ` +
          candidatas.map((f) => `"${c.nome}(${f.args})"`).join(" ou "),
        );
      }
      return { ...c, funcao: candidatas[0] };
    }
    const exata = candidatas.find((f) => f.args === c.args);
    if (!exata) {
      throw new Error(
        `${c.chave}: assinatura não confere. No banco: ` +
        candidatas.map((f) => `(${f.args})`).join(" | "),
      );
    }
    return { ...c, funcao: exata };
  });
  const funcoesSemChave = funcoes.filter(
    (f) => !alvos.some((a) => a.funcao.proname === f.proname && a.funcao.args === f.args),
  );
  if (funcoesSemChave.length) {
    throw new Error(
      "sobrecarga sem edição declarada: " +
      funcoesSemChave.map((f) => `${f.proname}(${f.args})`).join("; "),
    );
  }

  emitir(`-- ---------------------------------------------------------------------------
-- 4. Funções que tocam estas colunas (${chaves.length})
--
-- Cada substituição abaixo foi conferida contra a linha real da função. Onde o
-- nome da coluna é também chave JSON, ou pertence a outra tabela, a troca é
-- ancorada no alias — ou simplesmente não é feita.
-- ---------------------------------------------------------------------------
`);

  for (const alvo of alvos) {
    const f = alvo.funcao;
    // Parte das funções foi criada a partir de arquivo com quebra de linha do
    // Windows, e o corpo guarda CRLF. Normalizar aqui é o que faz os trechos
    // de várias linhas casarem; para o SQL a diferença é só espaço em branco.
    const original = f.definicao.split(String.fromCharCode(13, 10)).join(String.fromCharCode(10));
    let corpo = original;
    const instrucao = edicoes[alvo.chave];

    const configAuto = instrucao === AUTO
      ? { mapa: MAPA_TOKEN, edicoes: [] }
      : (instrucao?.modo === AUTO
          ? {
              mapa: montarMapaToken(instrucao.tabelas, instrucao.excluir),
              edicoes: instrucao.edicoes,
            }
          : null);

    if (instrucao?.modo === AUTO_ESCOPO) {
      corpo = reescreverPorEscopo(original, MAPA, instrucao.gatilhos);
      if (corpo === original) throw new Error(`${f.proname}: escopo não trocou nada`);
      emitir(`-- ${f.proname}(${f.args})\n-- troca pelo escopo SQL: alias, %rowtype, NEW/OLD e alvo de DML`);
    } else if (configAuto) {
      // Prova 2: nenhum parâmetro ou variável declarada tem o nome de uma das
      // colunas. Se tivesse, a troca por token renomearia a variável também.
      const assinatura = original.slice(0, original.indexOf("$function$"));
      const declaracoes = (original.match(/^[[:space:]]*declare[\s\S]*?\bbegin\b/im) ?? [""])[0];
      for (const velho of Object.keys(configAuto.mapa)) {
        const padrao = new RegExp(`\\b${velho}\\b`, "i");
        if (padrao.test(assinatura)) throw new Error(`${f.proname}: ${velho} é nome de parâmetro`);
        if (padrao.test(declaracoes)) throw new Error(`${f.proname}: ${velho} é variável declarada`);
      }
      // Edições contextuais são aplicadas antes da troca lexical. Isso permite
      // que uma função toque uma tabela AUTO e outra tabela ambígua no mesmo
      // corpo (FC_CONDICAO_ATENDIDA no lote 5).
      for (const [de, para] of configAuto.edicoes) {
        const ocorrencias = corpo.split(de).length - 1;
        if (ocorrencias === 0) {
          throw new Error(`${alvo.chave}: trecho não encontrado -> ${JSON.stringify(de.slice(0, 60))}`);
        }
        corpo = corpo.split(de).join(para);
      }
      const { definicao, contagem } = trocarPorToken(corpo, configAuto.mapa);
      if (!contagem.size) throw new Error(`${f.proname}: AUTO não trocou nada`);
      corpo = definicao;
      const resumo = [...contagem.entries()].sort()
        .map(([k, v]) => `${k}=${v}`).join(", ");
      emitir(`-- ${f.proname}(${f.args})\n-- troca por token, fora de comentário e de literal: ${resumo}`);
    } else {
      for (const [de, para] of instrucao) {
        const ocorrencias = corpo.split(de).length - 1;
        if (ocorrencias === 0) {
          throw new Error(`${alvo.chave}: trecho não encontrado -> ${JSON.stringify(de.slice(0, 60))}`);
        }
        corpo = corpo.split(de).join(para);
      }
    }
    if (corpo === original) throw new Error(`${alvo.chave}: nada mudou`);
    emitir(`${corpo.trim()};
`);
  }
}

emitir(`-- ---------------------------------------------------------------------------
-- 3. Autoverificação
-- ---------------------------------------------------------------------------

do $verificacao$
declare
  v_tabelas text[] := array[${TABELAS.map(quote).join(", ")}];
  v_revisadas text[] := array[${nomesFuncoes.length ? nomesFuncoes.map(quote).join(', ') : "''"}];
  v_velhos_exclusivos text[] := array[${EXCLUSIVOS.length ? EXCLUSIVOS.map(quote).join(', ') : ''}]::text[];
  v_sobras_aceitas text[] := array[${SOBRAS.length ? SOBRAS.map(quote).join(', ') : ''}]::text[];
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
         ~ ('\\m' || v.coluna || '\\M');
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
      'on[[:space:]]+constraint[[:space:]]+("?)([a-zA-Z_][a-zA-Z_0-9]*)\\1', 'gi') as m
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

  raise notice 'nomenclatura lote ${lote}: ${totalColunas} colunas em ${TABELAS.length} tabelas';
end
$verificacao$;

commit;`);

const arquivoSaida = process.argv.find((arg) => arg.startsWith("--saida="))?.slice("--saida=".length);
if (arquivoSaida) {
  await writeFile(arquivoSaida, partes.join("\n") + "\n", "utf8");
} else {
  console.log(partes.join("\n"));
}
console.error(`lote=${lote} tabelas=${TABELAS.length} colunas=${totalColunas} constraints=${constraints.length} indices=${indices.length}`);
await cliente.end();
