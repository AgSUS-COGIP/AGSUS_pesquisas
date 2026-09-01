import type { SurveyAnswerValue } from "./survey-runtime";

/**
 * Avaliador de lógica condicional no cliente.
 *
 * É o par do motor que vive no banco (`20260813120000_motor_logica_condicional.sql`).
 * Os dois avaliam as mesmas regras sobre as mesmas respostas e **precisam
 * concordar**: o banco decide o que bloqueia o envio, este decide o que a pessoa
 * vê. Se divergirem, a tela esconde uma pergunta que o banco ainda cobra — e o
 * envio falha sem que exista campo visível para corrigir.
 *
 * Por isso cada regra de decisão aqui espelha literalmente a função SQL
 * correspondente, e os casos de borda estão nos testes dos dois lados.
 */

export type SurveyRuleOperator =
  | "SELECTED"
  | "NOT_SELECTED"
  | "ANSWERED"
  | "NOT_ANSWERED"
  | "EQUALS"
  | "NOT_EQUALS"
  | "GREATER_THAN"
  | "LESS_THAN"
  | "CONTAINS";

export type SurveyRuleCondition = {
  questionId: string;
  operator: SurveyRuleOperator;
  optionId?: string | null;
  value?: string | null;
};

export type SurveyRule = {
  targetType: "QUESTION" | "SECTION";
  targetId: string;
  action: "SHOW" | "HIDE";
  connector: "ALL" | "ANY";
  conditions: SurveyRuleCondition[];
};

export type SurveyRuleContext = {
  /** Regra vigente por alvo — o banco garante no máximo uma por alvo. */
  rulesByTarget: Map<string, SurveyRule>;
  /** Seção de cada pergunta: esconder a seção esconde o que está dentro. */
  sectionByQuestion: Map<string, string>;
  answers: Record<string, SurveyAnswerValue | undefined>;
};

type MinimalQuestion = { id: string };
type MinimalSection<Q extends MinimalQuestion> = { id: string; questions: Q[] };

/**
 * Normaliza o retorno de `FC_OBTER_REGRAS_DO_CICLO`, que chega como JSON solto.
 * Regra malformada é descartada em vez de derrubar o formulário: sem regra, a
 * pergunta aparece — o padrão seguro é mostrar, nunca esconder por engano.
 */
export function normalizeSurveyRules(input: unknown): SurveyRule[] {
  if (!Array.isArray(input)) return [];
  const rules: SurveyRule[] = [];

  for (const raw of input) {
    if (!raw || typeof raw !== "object") continue;
    const candidate = raw as Record<string, unknown>;
    const targetId = typeof candidate.targetId === "string" ? candidate.targetId : null;
    const targetType = candidate.targetType === "SECTION" ? "SECTION" : "QUESTION";
    if (!targetId) continue;

    const conditions: SurveyRuleCondition[] = [];
    if (Array.isArray(candidate.conditions)) {
      for (const rawCondition of candidate.conditions) {
        if (!rawCondition || typeof rawCondition !== "object") continue;
        const condition = rawCondition as Record<string, unknown>;
        const questionId = typeof condition.questionId === "string" ? condition.questionId : null;
        const operator = condition.operator as SurveyRuleOperator;
        if (!questionId || !isSupportedOperator(operator)) continue;
        conditions.push({
          questionId,
          operator,
          optionId: typeof condition.optionId === "string" ? condition.optionId : null,
          value: typeof condition.value === "string" ? condition.value : null,
        });
      }
    }

    rules.push({
      targetType,
      targetId,
      action: candidate.action === "HIDE" ? "HIDE" : "SHOW",
      connector: candidate.connector === "ANY" ? "ANY" : "ALL",
      conditions,
    });
  }

  return rules;
}

function isSupportedOperator(value: unknown): value is SurveyRuleOperator {
  return typeof value === "string" && [
    "SELECTED", "NOT_SELECTED", "ANSWERED", "NOT_ANSWERED",
    "EQUALS", "NOT_EQUALS", "GREATER_THAN", "LESS_THAN", "CONTAINS",
  ].includes(value);
}

export function buildSurveyRuleContext<Q extends MinimalQuestion, S extends MinimalSection<Q>>(
  sections: S[],
  rules: SurveyRule[],
  answers: Record<string, SurveyAnswerValue | undefined>,
): SurveyRuleContext {
  const rulesByTarget = new Map<string, SurveyRule>();
  for (const rule of rules) rulesByTarget.set(rule.targetId, rule);

  const sectionByQuestion = new Map<string, string>();
  for (const section of sections) {
    for (const question of section.questions) sectionByQuestion.set(question.id, section.id);
  }

  return { rulesByTarget, sectionByQuestion, answers };
}

/** Espelha `FC_CONDICAO_ATENDIDA` — inclusive no tratamento de resposta ausente. */
function isConditionMet(condition: SurveyRuleCondition, context: SurveyRuleContext, visiting: Set<string>) {
  // Origem escondida conta como não respondida: a resposta que ela porventura
  // tenha é resíduo de um caminho abandonado, e aceitá-la ressuscitaria o ramo.
  if (!isQuestionVisible(condition.questionId, context, visiting)) {
    return condition.operator === "NOT_ANSWERED" || condition.operator === "NOT_SELECTED";
  }

  const answer = context.answers[condition.questionId];
  const answered = isAnswered(answer);

  if (condition.operator === "ANSWERED") return answered;
  if (condition.operator === "NOT_ANSWERED") return !answered;
  if (!answered) {
    // Nenhuma comparação de valor se sustenta sobre resposta ausente.
    return condition.operator === "NOT_EQUALS" || condition.operator === "NOT_SELECTED";
  }

  if (condition.operator === "SELECTED" || condition.operator === "NOT_SELECTED") {
    const selected = Boolean(condition.optionId && answer?.optionIds?.includes(condition.optionId));
    return condition.operator === "SELECTED" ? selected : !selected;
  }

  if (condition.operator === "GREATER_THAN" || condition.operator === "LESS_THAN") {
    const expected = Number(condition.value);
    if (typeof answer?.number !== "number" || !Number.isFinite(answer.number) || !Number.isFinite(expected)) return false;
    return condition.operator === "GREATER_THAN" ? answer.number > expected : answer.number < expected;
  }

  if (condition.operator === "CONTAINS") {
    return (answer?.text ?? "").toLowerCase().includes((condition.value ?? "").toLowerCase());
  }

  const equal = comparableText(answer) === (condition.value ?? "").trim().toLowerCase();
  return condition.operator === "EQUALS" ? equal : !equal;
}

function isAnswered(answer?: SurveyAnswerValue) {
  if (!answer) return false;
  if (answer.optionIds?.length) return true;
  if (typeof answer.number === "number" && Number.isFinite(answer.number)) return true;
  if (typeof answer.boolean === "boolean") return true;
  return Boolean(answer.text?.trim() || answer.date || answer.datetime);
}

/**
 * Representação textual usada por EQUALS/NOT_EQUALS, na mesma ordem de
 * precedência do `coalesce` do banco. O número entra por `String(...)`, que
 * corresponde ao `trim_scale(...)::text` do lado SQL — sem isso, `numeric(18,6)`
 * viraria '5.000000' lá e '5' aqui.
 */
function comparableText(answer?: SurveyAnswerValue) {
  const raw = answer?.text
    ?? (typeof answer?.number === "number" ? String(answer.number) : undefined)
    ?? (typeof answer?.boolean === "boolean" ? String(answer.boolean) : undefined)
    ?? answer?.date
    ?? answer?.datetime
    ?? "";
  return raw.trim().toLowerCase();
}

function isTargetVisible(targetId: string, context: SurveyRuleContext, visiting: Set<string>) {
  const rule = context.rulesByTarget.get(targetId);
  if (!rule || rule.conditions.length === 0) return true;

  const met = rule.conditions.filter((condition) => isConditionMet(condition, context, visiting)).length;
  const satisfied = rule.connector === "ALL" ? met === rule.conditions.length : met > 0;
  return rule.action === "SHOW" ? satisfied : !satisfied;
}

/**
 * Visibilidade de uma pergunta: seção visível **e** regra própria satisfeita.
 *
 * O conjunto `visiting` é defesa em profundidade. O banco recusa gravar regra que
 * feche um ciclo, mas um bundle antigo pode receber regras novas: sem a guarda,
 * um ciclo vindo do servidor congelaria a aba do participante. Alvo já em
 * avaliação é tratado como visível, que é o padrão seguro.
 */
export function isQuestionVisible(questionId: string, context: SurveyRuleContext, visiting = new Set<string>()): boolean {
  if (visiting.has(questionId)) return true;
  visiting.add(questionId);
  try {
    const sectionId = context.sectionByQuestion.get(questionId);
    if (sectionId && !isTargetVisible(sectionId, context, visiting)) return false;
    return isTargetVisible(questionId, context, visiting);
  } finally {
    visiting.delete(questionId);
  }
}

export function isSectionVisible(sectionId: string, context: SurveyRuleContext) {
  return isTargetVisible(sectionId, context, new Set<string>());
}

/**
 * Aplica as regras à definição do formulário.
 *
 * Seção que fica sem pergunta visível desaparece — caso contrário o participante
 * enfrentaria uma etapa vazia, e a numeração de etapas contaria um passo que não
 * existe. Sem regra alguma, devolve as seções inalteradas.
 */
export function visibleSurveySections<Q extends MinimalQuestion, S extends MinimalSection<Q>>(
  sections: S[],
  context: SurveyRuleContext,
): S[] {
  if (context.rulesByTarget.size === 0) return sections;

  return sections
    .filter((section) => isSectionVisible(section.id, context))
    .map((section) => ({
      ...section,
      questions: section.questions.filter((question) => isQuestionVisible(question.id, context)),
    }))
    .filter((section) => section.questions.length > 0);
}
