export const QUESTION_TYPES = [
  { value: "SHORT_TEXT", label: "Texto curto" },
  { value: "LONG_TEXT", label: "Texto longo" },
  { value: "INTEGER", label: "Número inteiro" },
  { value: "DECIMAL", label: "Número decimal" },
  { value: "DATE", label: "Data" },
  { value: "DATETIME", label: "Data e hora" },
  { value: "BOOLEAN", label: "Sim ou não" },
  { value: "SINGLE_CHOICE", label: "Escolha única" },
  { value: "MULTIPLE_CHOICE", label: "Múltipla escolha" },
  { value: "SCALE", label: "Escala" },
] as const;

export type SupportedQuestionType = (typeof QUESTION_TYPES)[number]["value"];

export type SurveyOption = {
  id?: string;
  label: string;
  value: string;
  score?: number | null;
  position?: number;
};

export type QuestionDraft = {
  title: string;
  description: string;
  questionType: string;
  optionsText: string;
};

const OPTION_TYPES = new Set<SupportedQuestionType>([
  "SINGLE_CHOICE",
  "MULTIPLE_CHOICE",
  "SCALE",
]);

export function isSupportedQuestionType(value: string): value is SupportedQuestionType {
  return QUESTION_TYPES.some((type) => type.value === value);
}

export function questionTypeLabel(value: string) {
  return QUESTION_TYPES.find((type) => type.value === value)?.label ?? value;
}

export function needsQuestionOptions(value: string) {
  return isSupportedQuestionType(value) && OPTION_TYPES.has(value);
}

export function sectionDraftErrors(title: string, description: string) {
  const errors: string[] = [];
  const normalizedTitle = title.trim();
  const normalizedDescription = description.trim();

  if (!normalizedTitle) errors.push("Informe o título da seção.");
  if (normalizedTitle.length > 160) errors.push("O título da seção deve ter no máximo 160 caracteres.");
  if (normalizedDescription.length > 1_000) errors.push("A descrição da seção deve ter no máximo 1.000 caracteres.");

  return errors;
}

export function optionLines(optionsText: string) {
  return optionsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

export function questionDraftErrors(draft: QuestionDraft) {
  const errors: string[] = [];
  const normalizedTitle = draft.title.trim();
  const normalizedDescription = draft.description.trim();

  if (!normalizedTitle) errors.push("Informe o enunciado da pergunta.");
  if (normalizedTitle.length > 500) errors.push("O enunciado deve ter no máximo 500 caracteres.");
  if (normalizedDescription.length > 2_000) errors.push("A descrição deve ter no máximo 2.000 caracteres.");
  if (!isSupportedQuestionType(draft.questionType)) errors.push("Selecione um tipo de resposta válido.");

  if (needsQuestionOptions(draft.questionType)) {
    const lines = optionLines(draft.optionsText);
    if (lines.length < 2) errors.push("Informe pelo menos duas alternativas.");
    if (lines.length > 50) errors.push("Use no máximo 50 alternativas.");
    if (lines.some((line) => line.length > 200)) errors.push("Cada alternativa deve ter no máximo 200 caracteres.");

    const normalizedLines = lines.map((line) => line.toLocaleLowerCase("pt-BR"));
    if (new Set(normalizedLines).size !== normalizedLines.length) errors.push("As alternativas não podem ser repetidas.");
  }

  return errors;
}

export function questionOptionsToText(options: SurveyOption[]) {
  return options.map((option) => option.label).join("\n");
}

export function buildQuestionOptions(
  optionsText: string,
  questionType: string,
  currentOptions: SurveyOption[] = [],
): SurveyOption[] {
  if (!needsQuestionOptions(questionType)) return [];

  return optionLines(optionsText).map((label, index) => {
    const current = currentOptions[index];
    return {
      ...(current?.id ? { id: current.id } : {}),
      label,
      value: current?.value?.trim() || String(index + 1),
      score: current?.score ?? (questionType === "SCALE" ? index + 1 : null),
    };
  });
}
