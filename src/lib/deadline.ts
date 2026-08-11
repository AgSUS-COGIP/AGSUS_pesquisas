/**
 * Contagem regressiva do prazo de uma avaliação/ciclo.
 *
 * Função pura (recebe o "agora" por parâmetro) para ser testável e determinística.
 * A granularidade é de **dias de calendário** — é o que a pessoa espera de um
 * aviso "faltam X dias", não a diferença exata em horas.
 */

const DAY_MS = 86_400_000;

export type DeadlineStatus =
  | { state: "none" }
  | { state: "expired" }
  | { state: "today" }
  | { state: "counting"; days: number };

/** Dia epoch (UTC) de uma data — usado para diferença por dia de calendário. */
function epochDay(time: number) {
  return Math.floor(time / DAY_MS);
}

export function deadlineStatus(closesAt: string | null | undefined, now: Date): DeadlineStatus {
  if (!closesAt) return { state: "none" };
  const end = new Date(closesAt);
  if (Number.isNaN(end.getTime())) return { state: "none" };

  // Já passou do instante exato de encerramento.
  if (end.getTime() < now.getTime()) return { state: "expired" };

  const days = epochDay(end.getTime()) - epochDay(now.getTime());
  if (days <= 0) return { state: "today" };
  return { state: "counting", days };
}

/** Rótulo curto para exibição; `null` quando não há prazo definido. */
export function deadlineLabel(status: DeadlineStatus): string | null {
  switch (status.state) {
    case "none":
      return null;
    case "expired":
      return "Encerrada";
    case "today":
      return "Encerra hoje";
    case "counting":
      return status.days === 1 ? "Falta 1 dia" : `Faltam ${status.days} dias`;
  }
}
