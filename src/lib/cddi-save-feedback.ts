export type CddiSaveFeedbackKind = "submitted" | "saving" | "error" | "draft-saved" | "autosave" | "readonly";

export type CddiSaveFeedback = {
  kind: CddiSaveFeedbackKind;
  text: string;
};

type CddiSaveFeedbackInput = {
  submissionStatus: string | null | undefined;
  submittedAt: string | null | undefined;
  pending: number;
  saveStatus: "IDLE" | "SAVING" | "ERROR";
  savedAt: string | null;
  canEdit: boolean;
};

export function resolveCddiSaveFeedback(
  input: CddiSaveFeedbackInput,
  formatDate: (value: string) => string,
): CddiSaveFeedback {
  if (input.submissionStatus === "SUBMITTED" || input.submissionStatus === "VALIDATED") {
    return {
      kind: "submitted",
      text: input.submittedAt
        ? `Autoavaliação enviada em ${formatDate(input.submittedAt)}`
        : "Autoavaliação enviada",
    };
  }

  if (input.pending > 0) return { kind: "saving", text: "Salvando rascunho..." };
  if (input.saveStatus === "ERROR") return { kind: "error", text: "Falha ao salvar" };
  if (input.savedAt) return { kind: "draft-saved", text: `Rascunho salvo em ${formatDate(input.savedAt)}` };
  if (input.canEdit) return { kind: "autosave", text: "Salvamento automático ativo" };
  return { kind: "readonly", text: "Somente leitura" };
}
