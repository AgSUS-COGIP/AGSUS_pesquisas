export type ApplicationErrorReport = {
  reference: string;
  route: string;
  type: "CLIENTE" | "SERVIDOR" | "REDE" | "BANCO" | "DESCONHECIDO";
  message: string;
  context?: Record<string, string | number | boolean | null>;
  httpStatus?: number | null;
};

function sanitizeText(value: string, maxLength: number) {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi, "[email removido]")
    .replace(/\b\d{5,}\b/g, "[numero removido]")
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [token removido]")
    .slice(0, maxLength);
}

export function createErrorReference() {
  return crypto.randomUUID();
}

export async function reportApplicationError(report: ApplicationErrorReport) {
  try {
    const response = await fetch("/api/observability/errors", {
      method: "POST",
      headers: { "content-type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        ...report,
        route: sanitizeText(report.route, 200),
        message: sanitizeText(report.message, 1000),
        context: Object.fromEntries(
          Object.entries(report.context ?? {}).slice(0, 12).map(([key, value]) => [
            sanitizeText(key, 60),
            typeof value === "string" ? sanitizeText(value, 200) : value,
          ]),
        ),
      }),
    });

    return response.ok;
  } catch {
    return false;
  }
}
