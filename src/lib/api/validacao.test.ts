import { describe, expect, it } from "vitest";
import { ehEntradaDeResposta, ehObjeto, erroNaEntradaDeResposta } from "./validacao";

const UUID = "123e4567-e89b-42d3-a456-426614174000";

describe("validação de respostas da API", () => {
  it("distingue objetos JSON de valores escalares, arrays e null", () => {
    expect(ehObjeto({})).toBe(true);
    expect(ehObjeto(null)).toBe(false);
    expect(ehObjeto([])).toBe(false);
    expect(ehObjeto("texto")).toBe(false);
  });

  it("aceita uma resposta bem formada e campos nulos para limpar o valor", () => {
    expect(ehEntradaDeResposta({
      questionId: UUID,
      optionIds: null,
      text: null,
      number: 0,
      boolean: false,
      date: null,
      datetime: null,
    })).toBe(true);
  });

  it("recusa JSON válido que não seja um objeto", () => {
    expect(erroNaEntradaDeResposta(null)).toMatch(/objeto JSON/);
    expect(erroNaEntradaDeResposta([])).toMatch(/objeto JSON/);
    expect(erroNaEntradaDeResposta("resposta")).toMatch(/objeto JSON/);
  });

  it("recusa identificadores inválidos de pergunta e alternativas", () => {
    expect(erroNaEntradaDeResposta({ questionId: "inválido" })).toMatch(/pergunta/);
    expect(erroNaEntradaDeResposta({ questionId: UUID, optionIds: ["inválido"] })).toMatch(/alternativas/);
    expect(erroNaEntradaDeResposta({ questionId: UUID, optionIds: UUID })).toMatch(/alternativas/);
  });

  it("recusa tipos incompatíveis e texto acima do limite do banco", () => {
    expect(erroNaEntradaDeResposta({ questionId: UUID, number: "1" })).toMatch(/numérica/);
    expect(erroNaEntradaDeResposta({ questionId: UUID, boolean: 1 })).toMatch(/lógica/);
    expect(erroNaEntradaDeResposta({ questionId: UUID, text: "x".repeat(12_001) })).toMatch(/12.000/);
  });
});
