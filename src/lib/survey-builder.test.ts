import { describe, expect, it } from "vitest";
import {
  buildQuestionOptions,
  moveAvailability,
  needsQuestionOptions,
  questionDraftErrors,
  questionOptionsToText,
  sectionDraftErrors,
} from "./survey-builder";

describe("Survey Studio drafts", () => {
  it("validates section limits and required titles", () => {
    expect(sectionDraftErrors("   ", "")).toContain(
      "Informe o título da seção.",
    );
    expect(sectionDraftErrors("A".repeat(161), "")).toContain(
      "O título da seção deve ter no máximo 160 caracteres.",
    );
  });

  it("requires unique alternatives for choice questions", () => {
    const errors = questionDraftErrors({
      title: "Escolha uma opção",
      description: "",
      questionType: "SINGLE_CHOICE",
      optionsText: "Concordo\nconcordo",
    });

    expect(errors).toContain("As alternativas não podem ser repetidas.");
  });

  it("does not require alternatives for free-text questions", () => {
    expect(needsQuestionOptions("SHORT_TEXT")).toBe(false);
    expect(
      questionDraftErrors({
        title: "Conte sua experiência",
        description: "",
        questionType: "SHORT_TEXT",
        optionsText: "",
      }),
    ).toEqual([]);
  });

  it("preserves existing values and scores while editing labels", () => {
    const options = buildQuestionOptions("Baixo\nAlto", "SINGLE_CHOICE", [
      { id: "one", label: "Ruim", value: "LOW", score: 2 },
      { id: "two", label: "Ótimo", value: "HIGH", score: 9 },
    ]);

    expect(options).toEqual([
      { id: "one", label: "Baixo", value: "LOW", score: 2 },
      { id: "two", label: "Alto", value: "HIGH", score: 9 },
    ]);
    expect(questionOptionsToText(options)).toBe("Baixo\nAlto");
  });

  it("creates predictable scores for a new scale", () => {
    expect(buildQuestionOptions("1\n2\n3", "SCALE")).toEqual([
      { label: "1", value: "1", score: 1 },
      { label: "2", value: "2", score: 2 },
      { label: "3", value: "3", score: 3 },
    ]);
  });

  it("enables only valid ordering directions", () => {
    expect(moveAvailability(0, 3)).toEqual({ up: false, down: true });
    expect(moveAvailability(1, 3)).toEqual({ up: true, down: true });
    expect(moveAvailability(2, 3)).toEqual({ up: true, down: false });
    expect(moveAvailability(0, 1)).toEqual({ up: false, down: false });
  });
});
