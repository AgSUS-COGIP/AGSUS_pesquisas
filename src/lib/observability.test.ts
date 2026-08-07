import { describe, expect, it } from "vitest";
import { errorMessageFromUnknown } from "./observability";

describe("errorMessageFromUnknown", () => {
  it("extracts the message returned by Supabase/PostgREST", () => {
    expect(errorMessageFromUnknown({ code: "P0001", message: "Existem respostas pendentes.", details: null })).toBe("Existem respostas pendentes.");
  });

  it("keeps native error messages", () => {
    expect(errorMessageFromUnknown(new Error("Falha local"))).toBe("Falha local");
  });
});
