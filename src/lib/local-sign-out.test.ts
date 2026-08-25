import { describe, expect, it, vi } from "vitest";
import { finishLocalSignOut } from "./local-sign-out";

describe("logout deste navegador", () => {
  it("aguarda o signOut local antes de ir para a tela de acesso", async () => {
    const order: string[] = [];
    const signOut = vi.fn(async () => {
      order.push("signOut");
      return { error: null };
    });
    const navigate = vi.fn(() => order.push("navigate"));

    await expect(finishLocalSignOut({ signOut, navigate })).resolves.toEqual({ ok: true });

    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(navigate).toHaveBeenCalledWith("/acesso");
    expect(order).toEqual(["signOut", "navigate"]);
  });

  it("não redireciona quando o logout falha", async () => {
    const error = new Error("auth indisponível");
    const navigate = vi.fn();

    await expect(finishLocalSignOut({
      signOut: vi.fn(async () => ({ error })),
      navigate,
    })).resolves.toEqual({ ok: false, error });

    expect(navigate).not.toHaveBeenCalled();
  });

  it("também transforma exceção em erro recuperável sem navegar", async () => {
    const error = new Error("rede indisponível");
    const navigate = vi.fn();

    await expect(finishLocalSignOut({
      signOut: vi.fn(async () => { throw error; }),
      navigate,
    })).resolves.toEqual({ ok: false, error });

    expect(navigate).not.toHaveBeenCalled();
  });
});
