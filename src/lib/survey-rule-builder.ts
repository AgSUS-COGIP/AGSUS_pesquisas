import type { SurveyRuleCondition, SurveyRuleOperator } from "./survey-conditional-logic";

/**
 * Montagem e validação de uma regra condicional no construtor.
 *
 * É o par de escrita de `survey-conditional-logic.ts`, que só lê: lá o
 * formulário decide o que mostrar; aqui a administração decide o que gravar. Os
 * dois usam os **mesmos tipos** de propósito — declarar um segundo conjunto de
 * operadores seria criar duas listas que podem divergir em silêncio.
 *
 * O que esta camada valida
 * ------------------------
 * Só o que é local e inequívoco, espelhando os `check` de
 * `tb_condicao_regra`: operador que compara alternativa exige a alternativa,
 * operador que compara número exige número, e assim por diante. A vantagem de
 * repetir isso aqui não é segurança — o banco revalida tudo — e sim mostrar o
 * erro no campo certo antes de gastar uma ida ao servidor.
 *
 * O que ela **não** valida, deliberadamente
 * -----------------------------------------
 * **Dependência circular.** `fc_regra_gera_ciclo()` percorre o grafo no banco,
 * resolvendo seção → perguntas da seção. Reimplementar essa travessia aqui
 * criaria um segundo algoritmo para a mesma decisão, com o risco que o próprio
 * projeto já documenta em `survey-conditional-logic.ts`: dois avaliadores que
 * discordam. O banco recusa com mensagem clara, e a tela a exibe.
 */

/** Operadores oferecidos pelo construtor, na ordem em que aparecem na tela. */
export const RULE_OPERATORS: ReadonlyArray<{
  value: SurveyRuleOperator;
  label: string;
  /** O que a condição precisa além da pergunta de origem. */
  requires: "option" | "text" | "number" | "none";
}> = [
  { value: "SELECTED", label: "Selecionou a alternativa", requires: "option" },
  { value: "NOT_SELECTED", label: "Não selecionou a alternativa", requires: "option" },
  { value: "ANSWERED", label: "Foi respondida", requires: "none" },
  { value: "NOT_ANSWERED", label: "Não foi respondida", requires: "none" },
  { value: "EQUALS", label: "É igual a", requires: "text" },
  { value: "NOT_EQUALS", label: "É diferente de", requires: "text" },
  { value: "CONTAINS", label: "Contém o texto", requires: "text" },
  { value: "GREATER_THAN", label: "É maior que", requires: "number" },
  { value: "LESS_THAN", label: "É menor que", requires: "number" },
];

const REQUIREMENT_BY_OPERATOR = new Map(RULE_OPERATORS.map((item) => [item.value, item.requires]));

/** O que o operador exige além da pergunta de origem. */
export function operatorRequirement(operator: SurveyRuleOperator) {
  return REQUIREMENT_BY_OPERATOR.get(operator) ?? "none";
}

/** Rótulo em português de um operador, para leitura da regra já gravada. */
export function operatorLabel(operator: SurveyRuleOperator) {
  return RULE_OPERATORS.find((item) => item.value === operator)?.label ?? operator;
}

/** Uma pergunta candidata a origem de condição. */
export type RuleQuestionRef = {
  id: string;
  title: string;
  sectionId: string;
  options: ReadonlyArray<{ id?: string; label: string }>;
};

export type RuleDraft = {
  targetType: "QUESTION" | "SECTION";
  targetId: string;
  action: "SHOW" | "HIDE";
  connector: "ALL" | "ANY";
  description: string;
  conditions: SurveyRuleCondition[];
};

/** Condição nova, no estado em que ela entra na tela. */
export function emptyCondition(questionId = ""): SurveyRuleCondition {
  return { questionId, operator: "SELECTED", optionId: null, value: null };
}

/** Regra nova para um alvo, com uma condição em branco já pronta. */
export function emptyRuleDraft(
  targetType: "QUESTION" | "SECTION",
  targetId: string,
): RuleDraft {
  return {
    targetType,
    targetId,
    action: "SHOW",
    connector: "ALL",
    description: "",
    conditions: [emptyCondition()],
  };
}

/**
 * Perguntas que podem condicionar um alvo.
 *
 * Fora a própria pergunta-alvo, ficam de fora as perguntas **de dentro** da
 * seção-alvo: se a seção só aparece conforme uma pergunta que mora nela, a
 * pergunta some junto e a condição nunca é avaliável. O banco recusaria pelo
 * ciclo; retirar da lista evita oferecer a escolha que só existe para dar erro.
 */
export function eligibleOriginQuestions(
  questions: ReadonlyArray<RuleQuestionRef>,
  draft: Pick<RuleDraft, "targetType" | "targetId">,
) {
  if (draft.targetType === "SECTION") {
    return questions.filter((question) => question.sectionId !== draft.targetId);
  }
  return questions.filter((question) => question.id !== draft.targetId);
}

/**
 * Erros de uma regra antes de enviar ao banco.
 *
 * Devolve texto pronto para a tela, na ordem das condições, para que a lista
 * mostrada ao operador acompanhe o que ele está vendo.
 */
export function ruleDraftErrors(
  draft: RuleDraft,
  questions: ReadonlyArray<RuleQuestionRef>,
): string[] {
  const errors: string[] = [];

  if (!draft.conditions.length) {
    errors.push("Uma regra precisa de pelo menos uma condição.");
    return errors;
  }

  const permitidas = new Set(eligibleOriginQuestions(questions, draft).map((item) => item.id));
  const porId = new Map(questions.map((item) => [item.id, item]));

  draft.conditions.forEach((condition, indice) => {
    const posicao = `Condição ${indice + 1}`;
    const origem = porId.get(condition.questionId);

    if (!condition.questionId) {
      errors.push(`${posicao}: escolha a pergunta de origem.`);
      return;
    }
    if (!origem) {
      errors.push(`${posicao}: a pergunta de origem não está nesta versão da avaliação.`);
      return;
    }
    if (!permitidas.has(condition.questionId)) {
      errors.push(
        draft.targetType === "SECTION"
          ? `${posicao}: uma pergunta de dentro da seção não pode decidir se a seção aparece.`
          : `${posicao}: uma pergunta não pode condicionar a si mesma.`,
      );
      return;
    }

    switch (operatorRequirement(condition.operator)) {
      case "option":
        if (!condition.optionId) {
          errors.push(`${posicao}: escolha a alternativa comparada.`);
        } else if (!origem.options.some((option) => option.id === condition.optionId)) {
          errors.push(`${posicao}: a alternativa escolhida não é desta pergunta.`);
        }
        break;
      case "text":
        if (!condition.value?.trim()) {
          errors.push(`${posicao}: informe o texto comparado.`);
        }
        break;
      case "number":
        if (!condition.value?.trim()) {
          errors.push(`${posicao}: informe o número comparado.`);
        } else if (Number.isNaN(Number(condition.value.replace(",", ".")))) {
          errors.push(`${posicao}: o valor comparado precisa ser um número.`);
        }
        break;
      default:
        break;
    }
  });

  // Duas condições sobre a mesma pergunta com o mesmo operador não acrescentam
  // nada e confundem a leitura da regra. O banco aceitaria; a tela não precisa.
  const assinaturas = draft.conditions.map((c) => `${c.questionId}|${c.operator}|${c.optionId ?? ""}|${c.value ?? ""}`);
  if (new Set(assinaturas).size !== assinaturas.length) {
    errors.push("Há condições repetidas: remova as duplicadas.");
  }

  return errors;
}

/**
 * Deixa a condição coerente com o operador escolhido.
 *
 * Trocar de operador precisa limpar o que sobrou do anterior: `tb_condicao_regra`
 * tem um `check` que **recusa** alternativa em operador que não a compara, e uma
 * condição que trocou de "Selecionou" para "Foi respondida" carregando o
 * `optionId` antigo seria rejeitada pelo banco sem que a tela mostrasse nada de
 * errado.
 */
export function normalizeCondition(condition: SurveyRuleCondition): SurveyRuleCondition {
  const requirement = operatorRequirement(condition.operator);
  return {
    questionId: condition.questionId,
    operator: condition.operator,
    optionId: requirement === "option" ? condition.optionId ?? null : null,
    value: requirement === "text" || requirement === "number" ? condition.value?.trim() || null : null,
  };
}

/** Resumo legível de uma regra, para a lista do construtor. */
export function ruleSummary(
  rule: Pick<RuleDraft, "action" | "connector" | "conditions">,
  questions: ReadonlyArray<RuleQuestionRef>,
) {
  const porId = new Map(questions.map((item) => [item.id, item]));
  const acao = rule.action === "SHOW" ? "Mostrar" : "Ocultar";
  const juncao = rule.connector === "ALL" ? " e " : " ou ";

  const partes = rule.conditions.map((condition) => {
    const origem = porId.get(condition.questionId);
    const nome = origem?.title ?? "pergunta removida";
    const alternativa = origem?.options.find((option) => option.id === condition.optionId)?.label;
    const complemento = alternativa ?? condition.value ?? "";
    return `“${nome}” ${operatorLabel(condition.operator).toLocaleLowerCase("pt-BR")}${complemento ? ` ${complemento}` : ""}`;
  });

  return `${acao} quando ${partes.join(juncao)}`;
}
