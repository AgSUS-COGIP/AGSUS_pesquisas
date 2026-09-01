/**
 * As RPCs sem as quais a plataforma não funciona.
 *
 * ## Por que esta lista existe
 *
 * Em 10/08/2026 e de novo em 20/08/2026 a aplicação foi publicada antes das
 * migrations correspondentes, e o resultado foi `PGRST202 — Could not find the
 * function … in the schema cache` na frente de quem usava. O acoplamento entre
 * frontend e banco é por **nome**, e nenhuma ferramenta do build lê SQL: nem
 * `typecheck`, nem `lint`, nem `test` percebem uma RPC que deixou de existir.
 *
 * Esta lista é o contrato mínimo, usado em dois lugares:
 *
 * - **readiness** (`/api/health/readiness`) — o ambiente responde, mas o
 *   esquema está compatível com esta versão da aplicação?
 * - **smoke test do deploy** — o mesmo contrato conferido antes de promover.
 *
 * Ela é deliberadamente **curta**: contém apenas o conjunto cuja ausência
 * quebra uma jornada inteira. Listar tudo aqui transformaria a verificação
 * verificação num segundo inventário que envelheceria sozinho.
 *
 * **Ao criar RPC nova, só acrescente aqui se a plataforma parar sem ela.**
 */
export const RPCS_CRITICAS = [
  // Autorização e identidade — sem isto, nenhuma tela autenticada abre.
  "FC_OBTER_CONTEXTO_PLATAFORMA",
  "FC_RESOLVER_PESSOA_AUTENTIC",

  // Marca: a primeira é lida pela tela de acesso anônima, antes de qualquer login.
  "FC_OBTER_MARCA_PUBLICA",
  "FC_OBTER_MARCA_PLATAFORMA",

  // Catálogo e runtime genérico de resposta.
  "FC_LISTAR_CATALOGO_PESQUISA",
  /*
    O nome é `FC_OBTER_FORMULARIO_PUBLICO`, e não `FC_OBTER_FORM_PUBLICO`.

    `20260822150000_security_audit_followup.sql` criou a primeira e **revogou**
    a segunda de `authenticated`; as rotas (`/api/formularios/[codigo]` e o
    bootstrap do CDDI) chamam a nova. Listar a antiga aqui era pior do que não
    listar nada: a função continua existindo no banco, então o readiness
    passaria verde num ambiente onde a que a aplicação realmente usa não
    existisse — a verificação diria "compatível" no exato caso que ela foi
    escrita para pegar.

    Regra que isto impõe ao manifesto: o nome conferido tem de ser o nome que
    aparece num `banco.rpc(...)` do código, não o da migration que o criou.
  */
  "FC_OBTER_FORMULARIO_PUBLICO",
  "FC_INICIAR_OU_RETOMAR_PESQ",
  "FC_SALVAR_RESPOSTA_PESQUISA",
  "FC_ENVIAR_SUBMISSAO_PESQUISA",

  // Runtime do CDDI, que tem jornada própria.
  "FC_INICIAR_OU_RETOMAR_CDDI",
  "FC_SALVAR_RESPOSTA_CDDI",
  "FC_ENVIAR_SUBMISSAO_CDDI",
  "FC_PAINEL_MONITOR_CDDI",

  // Administração de ciclo — `FC_DEFINIR_NOTIFICACAO_EMAIL` é a que faltou em
  // 20/08/2026 e produziu seis erros em produção.
  "FC_LISTAR_PESQUISAS_GERIDAS",
  "FC_GERIR_CICLO_PESQUISA",
  "FC_DEFINIR_NOTIFICACAO_EMAIL",

  // Fila de e-mail: sem elas o cron falha em silêncio.
  "FC_SRV_REIVINDICAR_EMAILS",
  "FC_SRV_CONCLUIR_EMAIL",
] as const;

export type RpcCritica = (typeof RPCS_CRITICAS)[number];
