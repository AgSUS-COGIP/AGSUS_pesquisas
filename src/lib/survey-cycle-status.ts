/**
 * Tradução canônica dos códigos de status de ciclo/versão/pesquisa do banco
 * (`DRAFT`, `OPEN`, …) para rótulo em português e variante de `Badge`.
 *
 * Os códigos do banco são vocabulário interno, não rótulo de interface (ver a
 * convenção em `src/app/CLAUDE.md`): a tela exibe o rótulo daqui e preserva o
 * código no `title` do selo. Antes deste módulo, cada tela mantinha o próprio
 * mapa e as cópias já tinham divergido — o mesmo ciclo aparecia com selo
 * diferente conforme a tela. É apresentação pura; a máquina de estados real
 * vive em `manage_survey_cycle`, no banco.
 */

export const SURVEY_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  OPEN: "Aberto",
  CLOSED: "Encerrado",
  CANCELLED: "Cancelado",
  ACTIVE: "Ativo",
  PUBLISHED: "Publicado",
  ARCHIVED: "Arquivado",
  RETIRED: "Descontinuado",
};

export type SurveyStatusBadgeVariant = "success" | "info" | "neutral" | "danger" | "warning" | "outline";

/** Rótulo em português; código desconhecido é exibido como veio (anomalia visível, não escondida). */
export function surveyStatusLabel(status: string | null | undefined, fallback = "Não configurado"): string {
  if (!status) return fallback;
  return SURVEY_STATUS_LABELS[status] ?? status;
}

/** Variante de `Badge` por status. Desconhecido ou ausente cai em `outline` (neutro). */
export function surveyStatusBadgeVariant(status: string | null | undefined): SurveyStatusBadgeVariant {
  if (["OPEN", "ACTIVE", "PUBLISHED"].includes(status ?? "")) return "success";
  if (["CLOSED", "ARCHIVED", "RETIRED"].includes(status ?? "")) return "neutral";
  if (status === "CANCELLED") return "danger";
  if (status === "SCHEDULED") return "info";
  if (status === "DRAFT") return "warning";
  return "outline";
}
