import { describe, expect, it } from "vitest";
import {
  selectPrioritySurvey,
  summarizeSurveyCatalog,
  surveyApplicationHref,
  surveyItemState,
  type SurveyCatalogItem,
} from "./survey-catalog";

function item(overrides: Partial<SurveyCatalogItem> = {}): SurveyCatalogItem {
  return {
    surveyId: "survey-1",
    surveyCode: "PESQ",
    surveyName: "Pesquisa",
    description: null,
    applicationId: "app-1",
    applicationCode: "PESQ-2026",
    applicationName: "Pesquisa 2026",
    applicationStatus: "OPEN",
    opensAt: "2026-08-01T12:00:00Z",
    closesAt: "2026-08-20T12:00:00Z",
    completedAt: null,
    submissionStatus: null,
    sections: 2,
    questions: 10,
    canRespond: true,
    ...overrides,
  };
}

describe("surveyItemState", () => {
  it("prioriza conclusão sobre qualquer outro estado", () => {
    expect(surveyItemState(item({ submissionStatus: "SUBMITTED", applicationStatus: "OPEN" }))).toBe("COMPLETED");
    expect(surveyItemState(item({ completedAt: "2026-08-03T10:00:00Z", submissionStatus: "DRAFT" }))).toBe("COMPLETED");
  });

  it("identifica rascunho como em andamento", () => {
    expect(surveyItemState(item({ submissionStatus: "DRAFT" }))).toBe("IN_PROGRESS");
  });

  it("distingue agendada, encerrada e pendente", () => {
    expect(surveyItemState(item({ applicationStatus: "SCHEDULED" }))).toBe("SCHEDULED");
    expect(surveyItemState(item({ applicationStatus: "CLOSED" }))).toBe("CLOSED");
    expect(surveyItemState(item({ applicationStatus: "OPEN" }))).toBe("PENDING");
  });
});

describe("selectPrioritySurvey", () => {
  it("escolhe rascunho antes de pesquisa pendente", () => {
    const priority = selectPrioritySurvey([
      item({ applicationId: "pending" }),
      item({ applicationId: "draft", submissionStatus: "DRAFT" }),
    ]);
    expect(priority?.applicationId).toBe("draft");
  });

  it("usa o prazo mais próximo como desempate", () => {
    const priority = selectPrioritySurvey([
      item({ applicationId: "later", closesAt: "2026-08-30T12:00:00Z" }),
      item({ applicationId: "sooner", closesAt: "2026-08-10T12:00:00Z" }),
    ]);
    expect(priority?.applicationId).toBe("sooner");
  });

  it("não falha com data inválida ou ausente", () => {
    const priority = selectPrioritySurvey([
      item({ applicationId: "without-date", opensAt: null, closesAt: null }),
      item({ applicationId: "valid", closesAt: "2026-08-10T12:00:00Z" }),
    ]);
    expect(priority?.applicationId).toBe("valid");
  });

  it("não transforma pesquisas concluídas ou encerradas em próxima ação", () => {
    expect(selectPrioritySurvey([
      item({ applicationId: "done", submissionStatus: "SUBMITTED" }),
      item({ applicationId: "closed", applicationStatus: "CLOSED" }),
    ])).toBeNull();
  });
});

describe("summarizeSurveyCatalog", () => {
  const now = new Date("2026-08-10T12:00:00Z");

  it("contabiliza apenas os estados exibidos nas métricas", () => {
    expect(summarizeSurveyCatalog([
      item(),
      item({ applicationId: "draft", submissionStatus: "DRAFT" }),
      item({ applicationId: "done", submissionStatus: "VALIDATED" }),
      item({ applicationId: "closed", applicationStatus: "CLOSED" }),
    ], now)).toMatchObject({ pending: 1, inProgress: 1, completed: 1, total: 4 });
  });

  it("deriva o que exige ação e o percentual de conclusão", () => {
    expect(summarizeSurveyCatalog([
      item({ applicationId: "pending" }),
      item({ applicationId: "draft", submissionStatus: "DRAFT" }),
      item({ applicationId: "done", submissionStatus: "SUBMITTED" }),
      item({ applicationId: "other-done", submissionStatus: "SUBMITTED" }),
    ], now)).toMatchObject({ actionable: 2, completionRate: 50 });
  });

  it("catálogo vazio não divide por zero", () => {
    expect(summarizeSurveyCatalog([], now)).toMatchObject({ total: 0, completionRate: 0, actionable: 0, urgent: 0, nextDeadlineDays: null });
  });

  it("conta como urgente só o que vence dentro da janela e ainda depende da pessoa", () => {
    const summary = summarizeSurveyCatalog([
      item({ applicationId: "urgente", closesAt: "2026-08-13T12:00:00Z" }),
      item({ applicationId: "folgado", closesAt: "2026-09-30T12:00:00Z" }),
      // Concluída no prazo apertado não gera cobrança.
      item({ applicationId: "concluida", closesAt: "2026-08-11T12:00:00Z", submissionStatus: "SUBMITTED" }),
    ], now);
    expect(summary.urgent).toBe(1);
  });

  it("reporta o prazo mais próximo entre as pendentes", () => {
    const summary = summarizeSurveyCatalog([
      item({ applicationId: "longe", closesAt: "2026-08-30T12:00:00Z" }),
      item({ applicationId: "perto", closesAt: "2026-08-12T12:00:00Z" }),
    ], now);
    expect(summary.nextDeadlineDays).toBe(2);
  });
});

describe("surveyApplicationHref", () => {
  it("mantém a jornada especializada do CDDI", () => {
    expect(surveyApplicationHref(item({ surveyCode: "CDDI" }))).toBe("/cddi");
  });

  it("codifica códigos genéricos na URL", () => {
    expect(surveyApplicationHref(item({ applicationCode: "PESQUISA 2026/A" }))).toBe("/pesquisas/PESQUISA%202026%2FA");
  });
});
