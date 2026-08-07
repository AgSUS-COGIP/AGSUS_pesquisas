import { describe, expect, it } from "vitest";
import { buildSurveyAnswerPayload, isSurveyAnswerComplete, restoreSurveyAnswer } from "./survey-runtime";

describe("generic survey runtime", () => {
  it("restores every supported scalar answer", () => {
    const restored = restoreSurveyAnswer({
      answerText: "Resposta",
      answerNumber: 12.5,
      answerBoolean: false,
      answerDate: "2026-08-07",
      answerDatetime: "2026-08-07T13:30:00.000Z",
      optionIds: ["option-1"],
    });

    expect(restored).toMatchObject({ text: "Resposta", number: 12.5, boolean: false, date: "2026-08-07", optionIds: ["option-1"] });
    expect(restored.datetime).toMatch(/^2026-08-07T\d{2}:30$/);
  });

  it("recognizes required numeric, date and datetime answers", () => {
    expect(isSurveyAnswerComplete("INTEGER", { number: 0 })).toBe(true);
    expect(isSurveyAnswerComplete("DECIMAL", { number: Number.NaN })).toBe(false);
    expect(isSurveyAnswerComplete("DATE", { date: "2026-08-07" })).toBe(true);
    expect(isSurveyAnswerComplete("DATETIME", { datetime: "" })).toBe(false);
  });

  it("builds a type-safe database payload without leaking fields from another type", () => {
    const numeric = buildSurveyAnswerPayload("DECIMAL", { number: 9.75, text: "ignorar" });
    expect(numeric).toMatchObject({ target_number: 9.75, target_text: null, target_date: null, target_datetime: null });

    const date = buildSurveyAnswerPayload("DATE", { date: "2026-08-07", number: 10 });
    expect(date).toMatchObject({ target_date: "2026-08-07", target_number: null });

    const datetime = buildSurveyAnswerPayload("DATETIME", { datetime: "2026-08-07T10:30" });
    expect(datetime.target_datetime).toBe(new Date("2026-08-07T10:30").toISOString());
  });
});
