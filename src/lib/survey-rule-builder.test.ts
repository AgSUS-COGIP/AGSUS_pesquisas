import { describe, expect, it } from "vitest";
import {
  RULE_OPERATORS,
  eligibleOriginQuestions,
  emptyRuleDraft,
  normalizeCondition,
  operatorRequirement,
  ruleDraftErrors,
  ruleSummary,
  type RuleQuestionRef,
} from "./survey-rule-builder";

const PERGUNTAS: RuleQuestionRef[] = [
  { id: "q1", title: "Você usa o sistema?", sectionId: "s1", options: [{ id: "o1", label: "Sim" }, { id: "o2", label: "Não" }] },
  { id: "q2", title: "Com que frequência?", sectionId: "s1", options: [] },
  { id: "q3", title: "Quantas horas por semana?", sectionId: "s2", options: [] },
];

function rascunho(overrides: Partial<ReturnType<typeof emptyRuleDraft>> = {}) {
  return { ...emptyRuleDraft("QUESTION", "q2"), ...overrides };
}

describe("operatorRequirement", () => {
  it("cobre todos os operadores do avaliador, sem sobra nem falta", () => {
    // Os nove operadores são os mesmos do `check` de tb_condicao_regra e do
    // avaliador do runtime. Uma lista menor esconderia um operador que o banco
    // aceita; uma maior ofereceria o que ele recusa.
    expect(RULE_OPERATORS).toHaveLength(9);
    expect(RULE_OPERATORS.map((o) => o.value)).toEqual([
      "SELECTED", "NOT_SELECTED", "ANSWERED", "NOT_ANSWERED",
      "EQUALS", "NOT_EQUALS", "CONTAINS", "GREATER_THAN", "LESS_THAN",
    ]);
  });

  it("espelha os check do banco sobre alternativa e número", () => {
    expect(operatorRequirement("SELECTED")).toBe("option");
    expect(operatorRequirement("NOT_SELECTED")).toBe("option");
    expect(operatorRequirement("GREATER_THAN")).toBe("number");
    expect(operatorRequirement("LESS_THAN")).toBe("number");
    expect(operatorRequirement("ANSWERED")).toBe("none");
  });
});

describe("eligibleOriginQuestions", () => {
  it("tira a própria pergunta quando o alvo é uma pergunta", () => {
    const elegiveis = eligibleOriginQuestions(PERGUNTAS, { targetType: "QUESTION", targetId: "q2" });
    expect(elegiveis.map((q) => q.id)).toEqual(["q1", "q3"]);
  });

  it("tira as perguntas de dentro da seção quando o alvo é a seção", () => {
    // A seção que depende de uma pergunta que mora nela nunca poderia ser
    // avaliada: esconder a seção esconde a pergunta.
    const elegiveis = eligibleOriginQuestions(PERGUNTAS, { targetType: "SECTION", targetId: "s1" });
    expect(elegiveis.map((q) => q.id)).toEqual(["q3"]);
  });
});

describe("ruleDraftErrors", () => {
  it("aceita uma regra completa", () => {
    const draft = rascunho({ conditions: [{ questionId: "q1", operator: "SELECTED", optionId: "o1", value: null }] });
    expect(ruleDraftErrors(draft, PERGUNTAS)).toEqual([]);
  });

  it("recusa regra sem condição", () => {
    expect(ruleDraftErrors(rascunho({ conditions: [] }), PERGUNTAS)).toEqual([
      "Uma regra precisa de pelo menos uma condição.",
    ]);
  });

  it("exige a alternativa quando o operador a compara", () => {
    const draft = rascunho({ conditions: [{ questionId: "q1", operator: "SELECTED", optionId: null, value: null }] });
    expect(ruleDraftErrors(draft, PERGUNTAS)).toEqual(["Condição 1: escolha a alternativa comparada."]);
  });

  it("recusa alternativa que é de outra pergunta", () => {
    // O banco recusa com 'A alternativa comparada não pertence à pergunta de
    // origem.' — aqui o erro aparece antes da ida ao servidor.
    // Alvo q2, origem q3 (que não tem alternativas), comparando `o1`, que é de q1.
    const draft = rascunho({ conditions: [{ questionId: "q3", operator: "SELECTED", optionId: "o1", value: null }] });
    expect(ruleDraftErrors(draft, PERGUNTAS)).toEqual(["Condição 1: a alternativa escolhida não é desta pergunta."]);
  });

  it("exige número em operador numérico, e recusa texto", () => {
    const semValor = rascunho({ conditions: [{ questionId: "q3", operator: "GREATER_THAN", optionId: null, value: "" }] });
    expect(ruleDraftErrors(semValor, PERGUNTAS)).toEqual(["Condição 1: informe o número comparado."]);

    const naoNumero = rascunho({ conditions: [{ questionId: "q3", operator: "GREATER_THAN", optionId: null, value: "muitas" }] });
    expect(ruleDraftErrors(naoNumero, PERGUNTAS)).toEqual(["Condição 1: o valor comparado precisa ser um número."]);
  });

  it("aceita número com vírgula decimal", () => {
    // Quem digita em português escreve 7,5 — recusar isso seria cobrar notação
    // que a interface nunca pediu.
    const draft = rascunho({ conditions: [{ questionId: "q3", operator: "LESS_THAN", optionId: null, value: "7,5" }] });
    expect(ruleDraftErrors(draft, PERGUNTAS)).toEqual([]);
  });

  it("impede a pergunta de condicionar a si mesma", () => {
    const draft = rascunho({ conditions: [{ questionId: "q2", operator: "ANSWERED", optionId: null, value: null }] });
    expect(ruleDraftErrors(draft, PERGUNTAS)).toEqual(["Condição 1: uma pergunta não pode condicionar a si mesma."]);
  });

  it("impede pergunta de dentro da seção condicionar a seção", () => {
    const draft = rascunho({ targetType: "SECTION", targetId: "s1", conditions: [{ questionId: "q1", operator: "ANSWERED", optionId: null, value: null }] });
    expect(ruleDraftErrors(draft, PERGUNTAS)).toEqual([
      "Condição 1: uma pergunta de dentro da seção não pode decidir se a seção aparece.",
    ]);
  });

  it("aponta a condição pelo número, na ordem da tela", () => {
    const draft = rascunho({
      conditions: [
        { questionId: "q1", operator: "SELECTED", optionId: "o1", value: null },
        { questionId: "", operator: "ANSWERED", optionId: null, value: null },
      ],
    });
    expect(ruleDraftErrors(draft, PERGUNTAS)).toEqual(["Condição 2: escolha a pergunta de origem."]);
  });

  it("reclama de condições repetidas", () => {
    const igual = { questionId: "q1", operator: "SELECTED" as const, optionId: "o1", value: null };
    expect(ruleDraftErrors(rascunho({ conditions: [igual, { ...igual }] }), PERGUNTAS)).toEqual([
      "Há condições repetidas: remova as duplicadas.",
    ]);
  });
});

describe("normalizeCondition", () => {
  it("limpa a alternativa ao trocar para operador que não a compara", () => {
    // `ck_tb_condicao_regra_opcao` recusa alternativa fora de SELECTED/
    // NOT_SELECTED. Sem esta limpeza, trocar o operador gravaria um resto que o
    // banco rejeita sem que a tela mostre nada de errado.
    const limpa = normalizeCondition({ questionId: "q1", operator: "ANSWERED", optionId: "o1", value: null });
    expect(limpa.optionId).toBeNull();
  });

  it("limpa o valor ao trocar para operador que compara alternativa", () => {
    const limpa = normalizeCondition({ questionId: "q1", operator: "SELECTED", optionId: "o1", value: "sobra" });
    expect(limpa.value).toBeNull();
    expect(limpa.optionId).toBe("o1");
  });

  it("apara o valor de texto e converte vazio em nulo", () => {
    expect(normalizeCondition({ questionId: "q1", operator: "EQUALS", optionId: null, value: "  sim  " }).value).toBe("sim");
    expect(normalizeCondition({ questionId: "q1", operator: "EQUALS", optionId: null, value: "   " }).value).toBeNull();
  });
});

describe("ruleSummary", () => {
  it("descreve a regra em português, com a alternativa pelo rótulo", () => {
    const resumo = ruleSummary(
      { action: "SHOW", connector: "ALL", conditions: [{ questionId: "q1", operator: "SELECTED", optionId: "o1", value: null }] },
      PERGUNTAS,
    );
    expect(resumo).toBe("Mostrar quando “Você usa o sistema?” selecionou a alternativa Sim");
  });

  it("junta condições por e / ou conforme o conector", () => {
    const condicoes = [
      { questionId: "q1", operator: "ANSWERED" as const, optionId: null, value: null },
      { questionId: "q3", operator: "GREATER_THAN" as const, optionId: null, value: "5" },
    ];
    expect(ruleSummary({ action: "SHOW", connector: "ALL", conditions: condicoes }, PERGUNTAS)).toContain(" e ");
    expect(ruleSummary({ action: "HIDE", connector: "ANY", conditions: condicoes }, PERGUNTAS)).toContain(" ou ");
  });

  it("não quebra quando a pergunta de origem foi removida", () => {
    const resumo = ruleSummary(
      { action: "SHOW", connector: "ALL", conditions: [{ questionId: "sumiu", operator: "ANSWERED", optionId: null, value: null }] },
      PERGUNTAS,
    );
    expect(resumo).toContain("pergunta removida");
  });
});
