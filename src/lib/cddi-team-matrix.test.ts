import { describe, expect, it } from "vitest";
import {
  cddiMatrixMissingCount,
  cddiMatrixPersonPage,
  cddiMatrixProgress,
  isCddiMatrixQuestionPending,
  restoreCddiMatrixAnswers,
} from "./cddi-team-matrix";

describe("cddi-team-matrix", () => {
  it("restaura alternativas e textos sem inventar respostas vazias", () => {
    expect(restoreCddiMatrixAnswers({
      escala: { optionId: "opt-2", optionValue: "2" },
      texto: { answerText: "Observação" },
      vazio: { answerText: "" },
    })).toEqual({
      escala: { value: "2", optionId: "opt-2" },
      texto: { value: "Observação", optionId: undefined },
    });
  });

  it("calcula progresso e pendências por pessoa, não por resposta compartilhada", () => {
    const answers = {
      pessoaA: {
        q1: { value: "1", optionId: "a" },
        q2: { value: "texto" },
      },
      pessoaB: {
        q1: { value: "2", optionId: "b" },
      },
    };

    expect(cddiMatrixProgress(["pessoaA", "pessoaB"], ["q1", "q2"], answers)).toBe(75);
    expect(cddiMatrixMissingCount(["pessoaA", "pessoaB"], ["q1", "q2"], answers)).toBe(1);
    expect(isCddiMatrixQuestionPending("q1", ["pessoaA", "pessoaB"], answers)).toBe(false);
    expect(isCddiMatrixQuestionPending("q2", ["pessoaA", "pessoaB"], answers)).toBe(true);
  });

  it("pagina duas pessoas por vez e mantém limites válidos", () => {
    const people = ["a", "b", "c", "d", "e"];
    expect(cddiMatrixPersonPage(people, 0)).toEqual({
      page: 0,
      pageCount: 3,
      start: 0,
      end: 2,
      items: ["a", "b"],
    });
    expect(cddiMatrixPersonPage(people, 99)).toEqual({
      page: 2,
      pageCount: 3,
      start: 4,
      end: 5,
      items: ["e"],
    });
  });
});
