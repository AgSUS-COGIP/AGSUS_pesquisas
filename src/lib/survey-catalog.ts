import { deadlineStatus } from "./deadline";

export type SurveyCatalogItem = {
  surveyId: string;
  surveyCode: string;
  surveyName: string;
  description: string | null;
  applicationId: string;
  applicationCode: string;
  applicationName: string;
  applicationStatus: string;
  opensAt: string | null;
  closesAt: string | null;
  completedAt: string | null;
  submissionStatus: string | null;
  submissionUpdatedAt?: string | null;
  participantStatus?: string | null;
  sections: number;
  questions: number;
  canRespond: boolean;
  canManage?: boolean;
};

export type SurveyItemState = "COMPLETED" | "IN_PROGRESS" | "CLOSED" | "SCHEDULED" | "PENDING";

/**
 * Rota de resposta de um item do catálogo.
 *
 * O CDDI tem jornada própria porque exige seleção de chefia imediata e avaliação
 * de liderança; qualquer outro instrumento usa o runtime genérico.
 */
export function surveyApplicationHref(item: SurveyCatalogItem) {
  return item.surveyCode === "CDDI" ? "/cddi" : `/pesquisas/${encodeURIComponent(item.applicationCode)}`;
}

/**
 * Estado exibido para um item do catálogo, em ordem estrita de precedência:
 * concluída → em andamento → encerrada → agendada → pendente.
 *
 * A conclusão vem primeiro de propósito: uma pessoa que já enviou deve ver
 * "Concluída" mesmo que o ciclo tenha encerrado depois.
 */
export function surveyItemState(item: SurveyCatalogItem): SurveyItemState {
  if (["SUBMITTED", "VALIDATED"].includes(item.submissionStatus ?? "") || item.completedAt) return "COMPLETED";
  if (item.submissionStatus === "DRAFT") return "IN_PROGRESS";
  if (item.applicationStatus === "CLOSED") return "CLOSED";
  if (item.applicationStatus === "SCHEDULED") return "SCHEDULED";
  return "PENDING";
}

export function surveyStateRank(item: SurveyCatalogItem) {
  const ranks: Record<SurveyItemState, number> = {
    IN_PROGRESS: 0,
    PENDING: 1,
    SCHEDULED: 2,
    CLOSED: 3,
    COMPLETED: 4,
  };
  return ranks[surveyItemState(item)];
}

// Item sem prazo — ou com data corrompida — vai para o fim da fila em vez de
// gerar NaN e desestabilizar a ordenação.
function sortableDate(item: SurveyCatalogItem) {
  const value = item.closesAt ?? item.opensAt;
  if (!value) return Number.MAX_SAFE_INTEGER;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

/** Ordena por urgência operacional: primeiro o estado, depois o prazo mais próximo. */
export function compareSurveyPriority(a: SurveyCatalogItem, b: SurveyCatalogItem) {
  const rankDifference = surveyStateRank(a) - surveyStateRank(b);
  if (rankDifference !== 0) return rankDifference;
  return sortableDate(a) - sortableDate(b);
}

export function selectPrioritySurvey(items: SurveyCatalogItem[]) {
  return items
    .filter((item) => !["COMPLETED", "CLOSED"].includes(surveyItemState(item)))
    .toSorted(compareSurveyPriority)[0] ?? null;
}

/** Prazo a partir do qual uma avaliação pendente é tratada como urgente. */
export const URGENT_DEADLINE_DAYS = 7;

/**
 * Retrato do catálogo para os indicadores da visão geral.
 *
 * Além das contagens por estado, resume o que exige ação: quantas avaliações
 * ainda dependem da pessoa (`actionable`), quantas delas vencem dentro de
 * `URGENT_DEADLINE_DAYS` (`urgent`) e qual é o prazo mais próximo
 * (`nextDeadline`) — é o que transforma número em decisão.
 *
 * `now` é parâmetro para manter a função pura e determinística nos testes.
 */
export function summarizeSurveyCatalog(items: SurveyCatalogItem[], now: Date = new Date()) {
  const summary = items.reduce(
    (accumulator, item) => {
      const state = surveyItemState(item);
      accumulator.total += 1;
      if (state === "COMPLETED") accumulator.completed += 1;
      if (state === "IN_PROGRESS") accumulator.inProgress += 1;
      if (state === "PENDING") accumulator.pending += 1;

      // Só conta como urgente o que a pessoa ainda pode resolver: item
      // concluído, encerrado ou agendado não gera cobrança de prazo.
      if (state === "IN_PROGRESS" || state === "PENDING") {
        const deadline = deadlineStatus(item.closesAt, now);
        if (deadline.state === "today" || (deadline.state === "counting" && deadline.days <= URGENT_DEADLINE_DAYS)) {
          accumulator.urgent += 1;
        }
        if (deadline.state === "today" || deadline.state === "counting") {
          const days = deadline.state === "today" ? 0 : deadline.days;
          if (accumulator.nextDeadlineDays === null || days < accumulator.nextDeadlineDays) {
            accumulator.nextDeadlineDays = days;
          }
        }
      }
      return accumulator;
    },
    { completed: 0, inProgress: 0, pending: 0, total: 0, urgent: 0, nextDeadlineDays: null as number | null },
  );

  return {
    ...summary,
    actionable: summary.pending + summary.inProgress,
    // Percentual inteiro; catálogo vazio é 0, não divisão por zero.
    completionRate: summary.total ? Math.round((summary.completed / summary.total) * 100) : 0,
  };
}
