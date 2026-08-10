import { describe, expect, it } from "vitest";
import { metadataObject, metadataText } from "./person-metadata";

describe("person metadata", () => {
  it("returns the first key that holds usable text", () => {
    const metadata = { unit: "   ", unidade: "DIGES", organizational_unit: "Outra" };
    expect(metadataText(metadata, "unit", "unidade", "organizational_unit")).toBe("DIGES");
  });

  it("trims the value and ignores non-string types", () => {
    expect(metadataText({ unit: "  DIGES  " }, "unit")).toBe("DIGES");
    expect(metadataText({ unit: 42 }, "unit")).toBeNull();
  });

  it("returns null when no key matches", () => {
    expect(metadataText({}, "unit", "unidade")).toBeNull();
  });

  it("reads a nested object but rejects arrays and primitives", () => {
    expect(metadataObject({ avatar_config: { seed: "abc" } }, "avatar_config")).toEqual({ seed: "abc" });
    expect(metadataObject({ avatar_config: ["abc"] }, "avatar_config")).toBeNull();
    expect(metadataObject({ avatar_config: "abc" }, "avatar_config")).toBeNull();
    expect(metadataObject({}, "avatar_config")).toBeNull();
  });
});
