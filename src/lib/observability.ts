export type ApplicationErrorReport = {
  reference: string;
  route: string;
  type: "CLIENTE" | "SERVIDOR" | "REDE" | "BANCO" | "DESCONHECIDO";
  message: string;
  context?: Record<string, string | number | boolean | null>;
  httpStatus?: number | null;
};

// Um erro em laço de render dispararia centenas de relatórios idênticos; a janela
// de deduplicação protege a rota de coleta e o banco.
const REPORT_DEDUPLICATION_WINDOW = 30_000;
const recentReports = new Map<string, number>();

/**
 * Remove dado pessoal e credencial de um texto antes de enviá-lo à observabilidade.
 *
 * Elimina e-mails, sequências de 5 ou mais dígitos (matrícula, CPF) e tokens
 * `Bearer`. A mesma sanitização é repetida no servidor
 * (`src/app/api/observability/errors/route.ts`) de propósito: o cliente pode ser
 * contornado, o servidor não.
 */
export function sanitizeObservabilityText(value: string, maxLength: number) {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email removido]")
    .replace(/\b\d{5,}\b/g, "[numero removido]")
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [token removido]")
    .slice(0, maxLength);
}

export function errorMessageFromUnknown(value: unknown) {
  if (value instanceof Error) return value.message || value.name;
  if (typeof value === "string") return value;
  if (value && typeof value === "object") {
    const candidate = value as { message?: unknown; details?: unknown; hint?: unknown };
    for (const detail of [candidate.message, candidate.details, candidate.hint]) {
      if (typeof detail === "string" && detail.trim()) return detail.trim();
    }
    try {
      return JSON.stringify(value);
    } catch {
      return "Erro não serializável.";
    }
  }
  return String(value ?? "Erro desconhecido.");
}

/**
 * Gera o código opaco exibido ao usuário e usado para localizar o registro em
 * `tl_erro_aplicacao`. O fallback cobre navegadores sem `crypto.randomUUID`.
 */
export function createErrorReference() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `err-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function reportFingerprint(report: ApplicationErrorReport) {
  return [
    report.type,
    sanitizeObservabilityText(report.route, 200),
    sanitizeObservabilityText(report.message, 300),
    report.httpStatus ?? "",
  ].join("|");
}

function shouldSendReport(report: ApplicationErrorReport) {
  const fingerprint = reportFingerprint(report);
  const now = Date.now();
  const lastReport = recentReports.get(fingerprint);

  for (const [key, timestamp] of recentReports) {
    if (now - timestamp > REPORT_DEDUPLICATION_WINDOW) recentReports.delete(key);
  }

  if (lastReport && now - lastReport < REPORT_DEDUPLICATION_WINDOW) return false;
  recentReports.set(fingerprint, now);
  return true;
}

/**
 * Envia um relatório de erro sanitizado para a rota de observabilidade.
 *
 * Nunca lança: falha de rede devolve `false`. Observabilidade não pode ser causa
 * de erro — um `throw` aqui apareceria como novo erro não tratado.
 *
 * @returns `true` se enviado ou deduplicado; `false` se a requisição falhou.
 */
export async function reportApplicationError(report: ApplicationErrorReport) {
  if (!shouldSendReport(report)) return true;

  try {
    const response = await fetch("/api/observability/errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Mantém a requisição viva durante o descarregamento da página, para não
      // perder justamente o erro que causou a navegação ou o fechamento.
      keepalive: true,
      body: JSON.stringify({
        ...report,
        route: sanitizeObservabilityText(report.route, 200),
        message: sanitizeObservabilityText(report.message, 1000),
        context: Object.fromEntries(
          Object.entries(report.context ?? {}).slice(0, 12).map(([key, value]) => [
            sanitizeObservabilityText(key, 60),
            typeof value === "string" ? sanitizeObservabilityText(value, 200) : value,
          ]),
        ),
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
