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
});

describe("summarizeSurveyCatalog", () => {
  it("contabiliza apenas os estados exibidos nas métricas", () => {
    expect(summarizeSurveyCatalog([
      item(),
      item({ applicationId: "draft", submissionStatus: "DRAFT" }),
      item({ applicationId: "done", submissionStatus: "VALIDATED" }),
      item({ applicationId: "closed", applicationStatus: "CLOSED" }),
    ])).toEqual({ pending: 1, inProgress: 1, completed: 1, total: 4 });
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
