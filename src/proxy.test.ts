import { describe, expect, it } from "vitest";
import { deveBloquearManutencaoGlobal } from "./proxy";

describe("proxy de manutenção global", () => {
  it("bloqueia quem não é Superadmin quando a manutenção global está ativa", () => {
    expect(deveBloquearManutencaoGlobal(true, false)).toBe(true);
  });

  it("não bloqueia Superadmin quando a manutenção global está ativa", () => {
    expect(deveBloquearManutencaoGlobal(true, true)).toBe(false);
  });

  it("não bloqueia ninguém quando a manutenção global está desativada", () => {
    expect(deveBloquearManutencaoGlobal(false, false)).toBe(false);
    expect(deveBloquearManutencaoGlobal(false, true)).toBe(false);
  });
});
