type CddiQuestionContract = {
  type: string;
  validation?: Record<string, unknown>;
};

export function isCddiQuestionVisible(question: CddiQuestionContract, submissionType: "AUTO" | "CHEFIA") {
  // A chefia responsável é mantida como vínculo institucional, não como campo manual do formulário.
  if (question.type === "PERSON") return false;

  const allowed = question.validation?.allowed_submission_types;
  if (!Array.isArray(allowed) || allowed.length === 0) return true;
  return allowed.some((value) => typeof value === "string" && value.toUpperCase() === submissionType);
}

export function visibleCddiSections<
  Question extends CddiQuestionContract,
  Section extends { questions: Question[] },
>(sections: Section[], submissionType: "AUTO" | "CHEFIA") {
  return sections
    .map((section) => ({
      ...section,
      questions: section.questions.filter((question) => isCddiQuestionVisible(question, submissionType)),
    }))
    .filter((section) => section.questions.length > 0);
}
