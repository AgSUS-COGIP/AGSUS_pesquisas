import { describe, expect, it } from "vitest";
import { resolveCddiSaveFeedback } from "./cddi-save-feedback";

const formatDate = (value: string) => `data:${value}`;
const base = {
  submissionStatus: "DRAFT",
  submittedAt: null,
  pending: 0,
  saveStatus: "IDLE" as const,
  savedAt: null,
  canEdit: true,
};

describe("feedback de salvamento do CDDI", () => {
  it("indica autosave para rascunho ainda não salvo", () => {
    expect(resolveCddiSaveFeedback(base, formatDate)).toEqual({
      kind: "autosave",
      text: "Salvamento automático ativo",
    });
  });

  it("prioriza salvamento pendente em rascunho", () => {
    expect(resolveCddiSaveFeedback({ ...base, pending: 1 }, formatDate).kind).toBe("saving");
  });

  it("mantém visível uma falha enquanto a submissão ainda é editável", () => {
    expect(resolveCddiSaveFeedback({ ...base, saveStatus: "ERROR" }, formatDate)).toEqual({
      kind: "error",
      text: "Falha ao salvar",
    });
  });

  it("informa quando o rascunho foi salvo", () => {
    expect(resolveCddiSaveFeedback({ ...base, savedAt: "2026-08-25T12:00:00Z" }, formatDate)).toEqual({
      kind: "draft-saved",
      text: "Rascunho salvo em data:2026-08-25T12:00:00Z",
    });
  });

  it.each(["SUBMITTED", "VALIDATED"])("nunca chama uma submissão %s de rascunho", (submissionStatus) => {
    const feedback = resolveCddiSaveFeedback({
      ...base,
      submissionStatus,
      submittedAt: "2026-08-25T13:00:00Z",
      pending: 1,
      saveStatus: "ERROR",
      savedAt: "2026-08-25T12:00:00Z",
      canEdit: false,
    }, formatDate);

    expect(feedback.kind).toBe("submitted");
    expect(feedback.text).toBe("Autoavaliação enviada em data:2026-08-25T13:00:00Z");
    expect(feedback.text).not.toContain("Rascunho");
  });

  it("usa mensagem de envio sem data como fallback", () => {
    expect(resolveCddiSaveFeedback({ ...base, submissionStatus: "SUBMITTED", canEdit: false }, formatDate).text)
      .toBe("Autoavaliação enviada");
  });
});
