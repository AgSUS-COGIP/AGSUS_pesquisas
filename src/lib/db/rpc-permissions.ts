// Gerado automaticamente: replay cronológico de TODOS os GRANT/REVOKE das 192
// migrations do projeto banco original, cruzado contra o catálogo real do
// banco (sigav/private). Não editar à mão — regenerar quando permissões mudarem.
//
// Substitui, em nível de aplicação, a distinção anon/authenticated/service_role
// que antes o PostgREST fazia via roles do Postgres. Como db_dataware usa uma
// única credencial de conexão (usr_sip_app, sem CREATEROLE), esta tabela é a
// ÚNICA linha de defesa que impede uma sessão autenticada comum de invocar uma
// função pensada para cron/serviço (ex.: fc_srv_reivindicar_emails) ou uma
// sessão anônima de invocar uma RPC administrativa.
//
// Duas classes de função ficam DE FORA de propósito:
//   - as que nunca aparecem num GRANT (triggers como validate_cddi_submission,
//     set_updated_at: o Postgres as chama internamente, nunca via API);
//   - as que o histórico revoga de todos (ex.: fc_abrir_ciclos_agendados, que
//     por decisão de projeto só é chamada de dentro de outra security definer).
//
// Exceções acrescentadas fora do histórico de migrations do banco original:
//   - fc_srv_registrar_erro_aplicacao  (scripts/bootstrap-db-dataware-usuario-unico.sql)
//   - fc_srv_resolver_identidade_oauth (hoje versionada, em
//     20260831140000_trazer_resolvedor_oauth_para_as_migrations.sql — o script
//     de bootstrap que a criava foi removido por ficar congelado no schema
//     pré-unificação e regredir o banco ao ser executado)
// Ambas são chamadas antes de existir sessão, por isso service_role.
//
// As quatro `fc_arq_*` (20260827160000_arquivos_no_banco.sql) substituem o
// Storage do banco. Só a leitura é aberta a `anon`, e isso reproduz o que os
// buckets públicos faziam: a arte de fundo aparece antes do login e a capa de
// pesquisa aparece em `/responder/[applicationCode]`, que é rota pública. As
// três de escrita exigem sessão, e o corpo de cada uma ainda checa
// `can_manage_surveys()`.
//
// ACRESCENTADAS NO MERGE DE 31/08/2026 (recurso de publico da avaliacao, vindo
// da main): as quatro `*_publico_*` e `FC_DEFINIR_COMUNICADO_INICIO`. As rotas
// que as chamam nasceram usando o cliente do Supabase e foram portadas para o
// adaptador; sem entrada aqui, o adaptador recusaria as cinco com 42501 e o
// recurso nao funcionaria em lugar nenhum.
export type RpcRole = "anon" | "authenticated" | "service_role";

export const RPC_PERMISSIONS: Readonly<Record<string, readonly RpcRole[]>> = {
  "FC_INCLUIR_PESSOA_EQUIPE": ["authenticated"],
  "FC_INCLUIR_PERGUNTA": ["authenticated"],
  "FC_INCLUIR_SECAO": ["authenticated"],
  "FC_CICLO_ACEITA_RESPOSTA": ["authenticated"],
  "FC_ATRIB_TODOS_DISPONIVEIS": ["authenticated"],
  "FC_ATRIB_PARTICIPANTE": ["authenticated"],
  "FC_ATRIB_PARTICIPANTE_LOTE": ["authenticated"],
  "FC_PODE_ACESSAR_CICLO": ["authenticated"],
  "FC_PODE_AUDITAR": ["authenticated"],
  "FC_PODE_EDITAR_SUBMISSAO": ["authenticated"],
  "FC_PODE_GERIR_PESQUISA": ["authenticated"],
  "FC_PODE_REGISTRAR_PRESENCA": ["authenticated"],
  "FC_PODE_VER_PRESENCA": ["authenticated"],
  "FC_REIVINDICAR_ACESSO": ["authenticated"],
  "FC_CRIAR_E_ATRIB_PARTIC": ["authenticated"],
  "FC_CRIAR_RASCUNHO_PESQUISA": ["authenticated"],
  "FC_PESSOA_SESSAO": ["authenticated"],
  "FC_EXCLUIR_PERGUNTA": ["authenticated"],
  "FC_DUPLICAR_ITEM_CONSTRUTOR": ["authenticated"],
  "FC_AGENDAR_ENVIO_MANUAL": ["authenticated"],
  "FC_APLICAR_PUBLICO_AVALIACAO": ["authenticated"],
  "FC_ARQ_GRAVAR": ["authenticated"],
  "FC_ARQ_LISTAR": ["authenticated"],
  "FC_ARQ_OBTER": ["anon", "authenticated", "service_role"],
  "FC_ARQ_REMOVER": ["authenticated"],
  "FC_ATUALIZAR_MARCA_PLATAFORMA": ["authenticated"],
  "FC_BUSCAR_PESSOAS_PUBLICO": ["authenticated"],
  "FC_CLONAR_PESQUISA": ["authenticated"],
  "FC_CONCLUIR_EMAIL_PARTICIPANTE": ["service_role"],
  "FC_CRIAR_NOVA_VERSAO_PESQUISA": ["authenticated"],
  "FC_DEFINIR_COMUNICADO_INICIO": ["authenticated"],
  "FC_DEFINIR_COR_BARRA_LATERAL": ["authenticated"],
  "FC_DEFINIR_COR_PAINEL_ACESSO": ["authenticated"],
  "FC_DEFINIR_FUNDO_ACESSO": ["authenticated"],
  "FC_DEFINIR_MODELO_AVALIACAO": ["authenticated"],
  "FC_DEFINIR_NOTIFICACAO_EMAIL": ["authenticated"],
  "FC_DEFINIR_PERMISSOES_PESSOA": ["authenticated"],
  "FC_DEFINIR_PRESENCA_PLATAFORMA": ["authenticated"],
  "FC_DEFINIR_RETENCAO_ANONIMA": ["authenticated"],
  "FC_DEFINIR_TEXTOS_EMAIL": ["authenticated"],
  "FC_DEFINIR_TEXTOS_MARCA": ["authenticated"],
  "FC_EXCLUIR_PESQUISA_ARQUIVADA": ["authenticated"],
  "FC_EXCLUIR_PESQUISA_RASCUNHO": ["authenticated"],
  "FC_EXCLUIR_REGRA_CONDICIONAL": ["authenticated"],
  "FC_LISTAR_ACESSOS_PAGINADOS": ["authenticated"],
  "FC_LISTAR_AUDIENCIA_EMAIL": ["authenticated"],
  "FC_LISTAR_AUDITORIA_PESSOA": ["authenticated"],
  "FC_LISTAR_CICLOS_LIDERANCA": ["authenticated"],
  "FC_LISTAR_CICLOS_LIDERANCA_ADM": ["authenticated"],
  "FC_LISTAR_CICLOS_PESQUISA": ["authenticated"],
  "FC_LISTAR_DIMENSOES_PUBLICO": ["authenticated"],
  "FC_LISTAR_ENVIOS_EMAIL": ["authenticated"],
  "FC_LISTAR_MODELOS_AVALIACAO": ["authenticated"],
  "FC_LISTAR_PESQUISAS_ARQ": ["authenticated"],
  "FC_LISTAR_PESSOAS_SEM_CHEFIA": ["authenticated"],
  "FC_LISTAR_PRESENCA_ONLINE": ["authenticated"],
  "FC_LISTAR_REGRAS_CONDICIONAIS": ["authenticated"],
  "FC_LISTAR_RESPOSTAS_CICLO": ["authenticated"],
  "FC_OBTER_CICLO_CDDI_VIGENTE": ["authenticated"],
  "FC_OBTER_CONTEXTO_PLATAFORMA": ["authenticated"],
  "FC_OBTER_FORMULARIO_PUBLICO": ["authenticated"],
  "FC_OBTER_MARCA_PLATAFORMA": ["authenticated"],
  "FC_OBTER_MARCA_PUBLICA": ["anon", "authenticated", "service_role"],
  "FC_OBTER_MINHA_EQUIPE": ["authenticated"],
  "FC_OBTER_PAINEL_PESQUISA": ["authenticated"],
  "FC_OBTER_REGRAS_DO_CICLO": ["authenticated"],
  "FC_ORIGENS_DA_REGRA": ["authenticated"],
  "FC_PESQUISAR_EQUIPE": ["authenticated"],
  "FC_PESQUISAR_PESSOA_ADMIN": ["authenticated"],
  "FC_PREVISUALIZAR_PUBLICO": ["authenticated"],
  "FC_REGISTRAR_PRESENCA": ["authenticated"],
  "FC_REGISTRAR_MANUT_AUDITORIA": ["authenticated"],
  "FC_REGRA_GERA_CICLO": ["authenticated"],
  "FC_REIVINDICAR_EMAILS": ["service_role"],
  "FC_REMOVER_RESPOSTA_PESSOA": ["authenticated"],
  "FC_SALVAR_REGRA_CONDICIONAL": ["authenticated"],
  "FC_SRV_CONCLUIR_EMAIL": ["service_role"],
  "FC_SRV_CONSUMIR_LIMITE_PUBLICO": ["service_role"],
  "FC_SRV_ENVIAR_RESP_ANON": ["service_role"],
  "FC_SRV_EXPIRAR_RASCUNHOS_ANON": ["service_role"],
  "FC_SRV_GRAVAR_RESP_ANON": ["service_role"],
  "FC_SRV_INICIAR_RESP_ANON": ["service_role"],
  "FC_SRV_OBTER_FORM_ANONIMO": ["service_role"],
  "FC_SRV_REGISTRAR_ERRO": ["service_role"],
  "FC_SRV_REGISTRAR_TRANSPORTE": ["service_role"],
  "FC_SRV_RESOLVER_IDENT_OAUTH": ["service_role"],
  "FC_SRV_REIVINDICAR_EMAILS": ["service_role"],
  "FC_SRV_VERIFICAR_CONTRATO_RPC": ["service_role"],
  "FC_SRV_VERIFICAR_MIGRATIONS": ["service_role"],
  "FC_RESUMO_BASE_PESSOAS": ["authenticated"],
  "FC_OBTER_VISUAL_CICLO": ["authenticated"],
  "FC_PAINEL_MONITOR_CDDI": ["authenticated"],
  "FC_OBTER_CONTEXTO_CDDI": ["authenticated"],
  "FC_OBTER_IDENTIDADE_CDDI": ["authenticated"],
  "FC_OBTER_ESPACO_EQUIPE": ["authenticated"],
  "FC_SAUDE_PLATAFORMA": ["authenticated"],
  "FC_OBTER_CONSTRUTOR": ["authenticated"],
  "FC_OBTER_PAINEL_PESQ": ["authenticated"],
  "FC_OBTER_OPERACOES_PESQUISA": ["authenticated"],
  "FC_TEM_PAPEL_ATIVO": ["authenticated"],
  "FC_TEM_MODULO": ["authenticated"],
  "FC_EMAIL_INSTITUC_PERMITIDO": ["authenticated"],
  "FC_E_ADMINISTRADOR": ["authenticated"],
  "FC_LISTAR_PARTIC_CICLO": ["authenticated"],
  "FC_LISTAR_CICLOS_PARTIC": ["authenticated"],
  "FC_LISTAR_PESQUISAS_GERIDAS": ["authenticated"],
  "FC_LISTAR_CATALOGO_PESQUISA": ["authenticated"],
  "FC_LISTAR_VINCULOS_LIDERANCA": ["authenticated"],
  "FC_GERIR_CICLO_PESQUISA": ["authenticated"],
  "FC_MOVER_PERGUNTA_SECAO": ["authenticated"],
  "FC_REMOVER_PESSOA_EQUIPE": ["authenticated"],
  "FC_REORDENAR_ITEM_CONSTRUTOR": ["authenticated"],
  "FC_RESOLVER_PESSOA_AUTENTIC": ["authenticated"],
  "FC_SALVAR_RESPOSTA_CDDI": ["authenticated"],
  "FC_SALVAR_RESPOSTA_PESQUISA": ["authenticated"],
  "FC_BUSCAR_PESSOAS_CICLO": ["authenticated"],
  "FC_BUSCAR_CANDIDATOS_EQUIPE": ["authenticated"],
  "FC_DEFINIR_SITUACAO_PARTIC": ["authenticated"],
  "FC_DEFINIR_AVATAR": ["authenticated"],
  "FC_DEFINIR_VINCULO_LIDERANCA": ["authenticated"],
  "FC_INICIAR_OU_RETOMAR_CDDI": ["authenticated"],
  "FC_INICIAR_OU_RETOMAR_SUBM": ["authenticated"],
  "FC_INICIAR_OU_RETOMAR_PESQ": ["authenticated"],
  "FC_ENVIAR_SUBMISSAO_CDDI": ["authenticated"],
  "FC_ENVIAR_SUBMISSAO_PESQUISA": ["authenticated"],
  "FC_SINCR_LINHAS_GESTOR_CDDI": ["service_role"],
  "FC_SINCR_AVATAR_GOOGLE": ["authenticated"],
  "FC_SINCR_LINHAS_BASE_PESSOA": ["service_role"],
  "FC_SEM_ACENTO_MINUSCULA": ["authenticated"],
  "FC_ATUALIZAR_VISUAL_CICLO": ["authenticated"],
  "FC_ATUALIZAR_PESSOA_ADMIN": ["authenticated"],
  "FC_ATUALIZAR_PERGUNTA": ["authenticated"],
  "FC_ATUALIZAR_SECAO": ["authenticated"],
};

export function isRpcAllowedForRole(functionName: string, role: RpcRole): boolean {
  const roles = RPC_PERMISSIONS[functionName];
  return Boolean(roles && roles.includes(role));
}
