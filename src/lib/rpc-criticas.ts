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
  "fc_obter_contexto_plataforma",
  "resolve_authenticated_person",

  // Marca: a primeira é lida pela tela de acesso anônima, antes de qualquer login.
  "fc_obter_marca_publica",
  "fc_obter_marca_plataforma",

  // Catálogo e runtime genérico de resposta.
  "list_my_survey_catalog",
  /*
    O nome é `fc_obter_formulario_publico`, e não `get_public_survey_form`.

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
  "fc_obter_formulario_publico",
  "start_or_resume_my_survey_submission",
  "save_my_survey_answer",
  "submit_my_survey_submission",

  // Runtime do CDDI, que tem jornada própria.
  "start_or_resume_my_cddi_submission",
  "save_my_cddi_answer",
  "submit_my_cddi_submission",
  "get_cddi_monitoring_dashboard",

  // Administração de ciclo — `fc_definir_notificacao_email` é a que faltou em
  // 20/08/2026 e produziu seis erros em produção.
  "list_managed_surveys",
  "manage_survey_cycle",
  "fc_definir_notificacao_email",

  // Fila de e-mail: sem elas o cron falha em silêncio.
  "fc_srv_reivindicar_emails",
  "fc_srv_concluir_email",
] as const;

export type RpcCritica = (typeof RPCS_CRITICAS)[number];
