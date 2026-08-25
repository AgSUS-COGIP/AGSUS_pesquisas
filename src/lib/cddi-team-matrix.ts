export type CddiMatrixOption = {
  id: string;
  label: string;
  value: string;
  position: number;
};

export type CddiMatrixQuestion = {
  id: string;
  title: string;
  description: string | null;
  type: string;
  required: boolean;
  validation?: Record<string, unknown>;
  options: CddiMatrixOption[];
};

export type CddiMatrixSection = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  questions: CddiMatrixQuestion[];
};

export type CddiMatrixDefinition = {
  application: {
    status: string;
    opensAt: string | null;
    closesAt: string | null;
  };
  sections: CddiMatrixSection[];
};

export type CddiStoredAnswer = {
  answerText?: string | null;
  answerNumber?: number | null;
  optionId?: string | null;
  optionValue?: string | null;
};

export type CddiSubmissionContext = {
  canEdit: boolean;
  submission: {
    id: string;
    status: string;
    submittedAt: string | null;
    updatedAt: string;
    result: number | null;
  } | null;
  answers: Record<string, CddiStoredAnswer>;
};

export type CddiMatrixMember = {
  personId: string;
  fullName: string;
  employeeNumber: string;
  institutionalEmail: string | null;
  jobTitle: string | null;
  unit: string | null;
  avatarUrl: string | null;
};

export type CddiMatrixAnswer = {
  value: string;
  optionId?: string;
};

export type CddiMatrixAnswers = Record<string, CddiMatrixAnswer>;
export type CddiAnswersByPerson = Record<string, CddiMatrixAnswers>;

export type CddiMatrixEvaluation = {
  member: CddiMatrixMember;
  context: CddiSubmissionContext;
  answers: CddiMatrixAnswers;
};

/** Reidrata uma submissão no formato usado pelos controles da matriz. */
export function restoreCddiMatrixAnswers(
  stored: Record<string, CddiStoredAnswer> | null | undefined,
): CddiMatrixAnswers {
  const restored: CddiMatrixAnswers = {};
  Object.entries(stored ?? {}).forEach(([questionId, answer]) => {
    const value = answer.answerText
      ?? answer.optionValue
      ?? (answer.answerNumber != null ? String(answer.answerNumber) : "");
    if (value === "") return;
    restored[questionId] = {
      value,
      optionId: answer.optionId ?? undefined,
    };
  });
  return restored;
}

export function isCddiMatrixAnswered(
  answers: CddiMatrixAnswers | null | undefined,
  questionId: string,
) {
  return Boolean(answers?.[questionId]?.value?.trim());
}

/** Progresso global: cada pergunta obrigatória conta uma vez para cada pessoa. */
export function cddiMatrixProgress(
  personIds: readonly string[],
  requiredQuestionIds: readonly string[],
  answersByPerson: CddiAnswersByPerson,
) {
  const total = personIds.length * requiredQuestionIds.length;
  if (!total) return 0;

  let answered = 0;
  for (const personId of personIds) {
    for (const questionId of requiredQuestionIds) {
      if (isCddiMatrixAnswered(answersByPerson[personId], questionId)) answered += 1;
    }
  }
  return Math.round((answered / total) * 100);
}

export function cddiMatrixMissingCount(
  personIds: readonly string[],
  requiredQuestionIds: readonly string[],
  answersByPerson: CddiAnswersByPerson,
) {
  let missing = 0;
  for (const personId of personIds) {
    for (const questionId of requiredQuestionIds) {
      if (!isCddiMatrixAnswered(answersByPerson[personId], questionId)) missing += 1;
    }
  }
  return missing;
}

/** Uma pergunta é pendente quando ao menos uma das pessoas visíveis ainda não respondeu. */
export function isCddiMatrixQuestionPending(
  questionId: string,
  visiblePersonIds: readonly string[],
  answersByPerson: CddiAnswersByPerson,
) {
  return visiblePersonIds.some((personId) => !isCddiMatrixAnswered(answersByPerson[personId], questionId));
}

/** Mantém no máximo duas pessoas lado a lado, como a referência de avaliação múltipla. */
export function cddiMatrixPersonPage<T>(items: readonly T[], page: number, pageSize = 2) {
  const safeSize = Math.max(1, Math.floor(pageSize));
  const pageCount = Math.max(1, Math.ceil(items.length / safeSize));
  const safePage = Math.max(0, Math.min(Math.floor(page), pageCount - 1));
  const start = safePage * safeSize;
  return {
    page: safePage,
    pageCount,
    start,
    end: Math.min(items.length, start + safeSize),
    items: items.slice(start, start + safeSize),
  };
}
