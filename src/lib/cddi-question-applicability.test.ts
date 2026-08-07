import { describe, expect, it } from "vitest";
import { isCddiQuestionVisible, visibleCddiSections } from "./cddi-question-applicability";

describe("CDDI question applicability", () => {
  it("does not expose technical person questions as manual fields", () => {
    expect(isCddiQuestionVisible({ type: "PERSON", validation: { allowed_submission_types: ["AUTO"] } }, "AUTO")).toBe(false);
    expect(isCddiQuestionVisible({ type: "PERSON", validation: { allowed_submission_types: ["AUTO"] } }, "CHEFIA")).toBe(false);
  });

  it("respects the allowed submission types contract", () => {
    const autoOnly = { type: "LONG_TEXT", validation: { allowed_submission_types: ["AUTO"] } };
    expect(isCddiQuestionVisible(autoOnly, "AUTO")).toBe(true);
    expect(isCddiQuestionVisible(autoOnly, "CHEFIA")).toBe(false);
    expect(isCddiQuestionVisible({ type: "SCALE" }, "CHEFIA")).toBe(true);
  });

  it("removes sections that have no visible questions", () => {
    const sections = [{ code: "TECHNICAL", questions: [{ type: "PERSON" }] }, { code: "C01", questions: [{ type: "SCALE" }] }];
    expect(visibleCddiSections(sections, "CHEFIA").map((section) => section.code)).toEqual(["C01"]);
  });
});
