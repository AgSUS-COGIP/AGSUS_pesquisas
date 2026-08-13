import { describe, expect, it } from "vitest";
import {
  buildSurveyRuleContext,
  isQuestionVisible,
  normalizeSurveyRules,
  visibleSurveySections,
  type SurveyRule,
} from "./survey-conditional-logic";
import type { SurveyAnswerValue } from "./survey-runtime";

const SECOES = [
  { id: "sec-1", questions: [{ id: "q1" }, { id: "q2" }] },
  { id: "sec-2", questions: [{ id: "q3" }] },
];

const REGRA_Q2: SurveyRule = {
  targetType: "QUESTION",
  targetId: "q2",
  action: "SHOW",
  connector: "ALL",
  conditions: [{ questionId: "q1", operator: "SELECTED", optionId: "op-sim" }],
};

function contexto(regras: SurveyRule[], respostas: Record<string, SurveyAnswerValue>) {
  return buildSurveyRuleContext(SECOES, regras, respostas);
}

describe("visibilidade por regra", () => {
  it("mostra a pergunta quando nenhuma regra a alcança", () => {
    expect(isQuestionVisible("q3", contexto([REGRA_Q2], {}))).toBe(true);
  });

  it("esconde enquanto a pergunta de origem não foi respondida", () => {
    expect(isQuestionVisible("q2", contexto([REGRA_Q2], {}))).toBe(false);
  });

  it("esconde quando a alternativa escolhida não é a exigida", () => {
    expect(isQuestionVisible("q2", contexto([REGRA_Q2], { q1: { optionIds: ["op-nao"] } }))).toBe(false);
  });

  it("mostra quando a alternativa exigida está marcada", () => {
    expect(isQuestionVisible("q2", contexto([REGRA_Q2], { q1: { optionIds: ["op-sim"] } }))).toBe(true);
  });

  it("trata regra sem condição como visível — regra vazia não decide nada", () => {
    const regra: SurveyRule = { ...REGRA_Q2, conditions: [] };
    expect(isQuestionVisible("q2", contexto([regra], {}))).toBe(true);
  });

  it("inverte o resultado quando a ação é HIDE", () => {
    const regra: SurveyRule = { ...REGRA_Q2, action: "HIDE" };
    expect(isQuestionVisible("q2", contexto([regra], { q1: { optionIds: ["op-sim"] } }))).toBe(false);
    expect(isQuestionVisible("q2", contexto([regra], { q1: { optionIds: ["op-nao"] } }))).toBe(true);
  });
});

describe("conectores ALL e ANY", () => {
  const duasCondicoes: SurveyRule = {
    targetType: "QUESTION",
    targetId: "q2",
    action: "SHOW",
    connector: "ALL",
    conditions: [
      { questionId: "q1", operator: "ANSWERED" },
      { questionId: "q3", operator: "EQUALS", value: "sim" },
    ],
  };

  it("ALL exige todas as condições", () => {
    expect(isQuestionVisible("q2", contexto([duasCondicoes], { q1: { text: "x" } }))).toBe(false);
    expect(isQuestionVisible("q2", contexto([duasCondicoes], { q1: { text: "x" }, q3: { text: "sim" } }))).toBe(true);
  });

  it("ANY basta uma", () => {
    const regra: SurveyRule = { ...duasCondicoes, connector: "ANY" };
    expect(isQuestionVisible("q2", contexto([regra], { q1: { text: "x" } }))).toBe(true);
  });
});

describe("operadores", () => {
  function regraCom(operator: SurveyRule["conditions"][number]["operator"], value?: string): SurveyRule {
    return {
      targetType: "QUESTION",
      targetId: "q2",
      action: "SHOW",
      connector: "ALL",
      conditions: [{ questionId: "q1", operator, value: value ?? null }],
    };
  }

  it("GREATER_THAN e LESS_THAN comparam números", () => {
    expect(isQuestionVisible("q2", contexto([regraCom("GREATER_THAN", "10")], { q1: { number: 11 } }))).toBe(true);
    expect(isQuestionVisible("q2", contexto([regraCom("GREATER_THAN", "10")], { q1: { number: 10 } }))).toBe(false);
    expect(isQuestionVisible("q2", contexto([regraCom("LESS_THAN", "10")], { q1: { number: 9 } }))).toBe(true);
  });

  it("CONTAINS ignora caixa", () => {
    expect(isQuestionVisible("q2", contexto([regraCom("CONTAINS", "GESTÃO")], { q1: { text: "Área de gestão" } }))).toBe(true);
  });

  // Paridade com o banco: a coluna é numeric(18,6) e `5::text` sairia
  // '5.000000'. O SQL usa `trim_scale`; aqui, `String(5)`. Os dois precisam
  // resultar em '5' para que a mesma regra decida igual dos dois lados.
  it("EQUALS compara número sem casas decimais penduradas", () => {
    expect(isQuestionVisible("q2", contexto([regraCom("EQUALS", "5")], { q1: { number: 5 } }))).toBe(true);
  });

  it("EQUALS compara booleano pela representação textual", () => {
    expect(isQuestionVisible("q2", contexto([regraCom("EQUALS", "true")], { q1: { boolean: true } }))).toBe(true);
    expect(isQuestionVisible("q2", contexto([regraCom("EQUALS", "true")], { q1: { boolean: false } }))).toBe(false);
  });

  it("sobre resposta ausente, só os operadores negativos são atendidos", () => {
    expect(isQuestionVisible("q2", contexto([regraCom("EQUALS", "sim")], {}))).toBe(false);
    expect(isQuestionVisible("q2", contexto([regraCom("NOT_EQUALS", "sim")], {}))).toBe(true);
    expect(isQuestionVisible("q2", contexto([regraCom("NOT_ANSWERED")], {}))).toBe(true);
  });

  it("texto só com espaços não conta como respondido", () => {
    expect(isQuestionVisible("q2", contexto([regraCom("ANSWERED")], { q1: { text: "   " } }))).toBe(false);
  });
});

describe("dependência encadeada", () => {
  // q2 depende de q1; q3 depende de q2. Escondida a origem, a resposta que ela
  // porventura tenha não pode ressuscitar o ramo seguinte.
  const encadeadas: SurveyRule[] = [
    REGRA_Q2,
    {
      targetType: "QUESTION",
      targetId: "q3",
      action: "SHOW",
      connector: "ALL",
      conditions: [{ questionId: "q2", operator: "ANSWERED" }],
    },
  ];

  it("origem escondida conta como não respondida", () => {
    const respostas = { q1: { optionIds: ["op-nao"] }, q2: { text: "resíduo" } };
    expect(isQuestionVisible("q2", contexto(encadeadas, respostas))).toBe(false);
    expect(isQuestionVisible("q3", contexto(encadeadas, respostas))).toBe(false);
  });

  it("origem visível e respondida libera o encadeamento", () => {
    const respostas = { q1: { optionIds: ["op-sim"] }, q2: { text: "valor" } };
    expect(isQuestionVisible("q3", contexto(encadeadas, respostas))).toBe(true);
  });
});

describe("regra de seção", () => {
  const regraSecao: SurveyRule = {
    targetType: "SECTION",
    targetId: "sec-2",
    action: "SHOW",
    connector: "ALL",
    conditions: [{ questionId: "q1", operator: "SELECTED", optionId: "op-sim" }],
  };

  it("esconder a seção esconde a pergunta de dentro", () => {
    expect(isQuestionVisible("q3", contexto([regraSecao], { q1: { optionIds: ["op-nao"] } }))).toBe(false);
    expect(isQuestionVisible("q3", contexto([regraSecao], { q1: { optionIds: ["op-sim"] } }))).toBe(true);
  });

  it("seção sem pergunta visível sai da lista de etapas", () => {
    const resultado = visibleSurveySections(SECOES, contexto([regraSecao], {}));
    expect(resultado.map((secao) => secao.id)).toEqual(["sec-1"]);
  });

  it("sem regra alguma, a definição passa inalterada", () => {
    expect(visibleSurveySections(SECOES, contexto([], {}))).toBe(SECOES);
  });
});

describe("ciclo vindo do servidor", () => {
  // O banco recusa gravar isto, mas um bundle antigo pode receber regras novas.
  // O avaliador precisa terminar — travar a aba do participante é pior que
  // mostrar uma pergunta a mais.
  const ciclo: SurveyRule[] = [
    { targetType: "QUESTION", targetId: "q1", action: "SHOW", connector: "ALL", conditions: [{ questionId: "q2", operator: "ANSWERED" }] },
    { targetType: "QUESTION", targetId: "q2", action: "SHOW", connector: "ALL", conditions: [{ questionId: "q1", operator: "ANSWERED" }] },
  ];

  it("não entra em recursão infinita", () => {
    expect(() => isQuestionVisible("q1", contexto(ciclo, {}))).not.toThrow();
  });
});

describe("normalizeSurveyRules", () => {
  it("descarta entrada malformada em vez de derrubar o formulário", () => {
    expect(normalizeSurveyRules(null)).toEqual([]);
    expect(normalizeSurveyRules([{ targetId: 42 }, "texto", null])).toEqual([]);
  });

  it("descarta condição com operador desconhecido, preservando a regra", () => {
    const [regra] = normalizeSurveyRules([{
      targetType: "QUESTION",
      targetId: "q2",
      action: "SHOW",
      connector: "ALL",
      conditions: [
        { questionId: "q1", operator: "OPERADOR_INVENTADO" },
        { questionId: "q1", operator: "ANSWERED" },
      ],
    }]);
    expect(regra.conditions).toHaveLength(1);
    expect(regra.conditions[0].operator).toBe("ANSWERED");
  });

  it("assume os padrões seguros quando ação e conector faltam", () => {
    const [regra] = normalizeSurveyRules([{ targetId: "q2", conditions: [] }]);
    expect(regra).toMatchObject({ targetType: "QUESTION", action: "SHOW", connector: "ALL" });
  });
});
