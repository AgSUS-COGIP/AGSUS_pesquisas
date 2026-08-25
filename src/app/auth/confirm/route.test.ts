import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "./route";

const authMocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock("../../../lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({ auth: authMocks })),
}));

function callbackRequest(search: string) {
  return new NextRequest(`https://app.local/auth/confirm?${search}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://app.local");
  authMocks.signOut.mockResolvedValue({ error: null });
});

describe("callback OAuth institucional", () => {
  it("aceita o usuário institucional devolvido pela própria troca PKCE", async () => {
    authMocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        session: { access_token: "token" },
        user: { email: " Pessoa@agenciasus.org.br " },
      },
      error: null,
    });

    const response = await GET(callbackRequest("code=valido&next=%2Fpesquisas&sb_flow_id=flow-1"));

    expect(authMocks.exchangeCodeForSession).toHaveBeenCalledWith("valido", { flowId: "flow-1" });
    expect(authMocks.getUser).not.toHaveBeenCalled();
    expect(authMocks.signOut).not.toHaveBeenCalled();
    expect(response.headers.get("location")).toBe("https://app.local/pesquisas?entrando=1");
  });

  it("recusa outro domínio e encerra somente a sessão local recém-criada", async () => {
    authMocks.exchangeCodeForSession.mockResolvedValue({
      data: {
        session: { access_token: "token" },
        user: { email: "pessoa@example.com" },
      },
      error: null,
    });

    const response = await GET(callbackRequest("code=valido"));

    expect(authMocks.getUser).not.toHaveBeenCalled();
    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.headers.get("location")).toBe(
      "https://app.local/acesso?erro=dominio-nao-autorizado",
    );
  });

  it("mantém oauth-invalido quando a troca PKCE falha", async () => {
    authMocks.exchangeCodeForSession.mockResolvedValue({
      data: { session: null, user: null },
      error: new Error("invalid code"),
    });

    const response = await GET(callbackRequest("code=invalido&next=%2Fequipe"));

    expect(response.headers.get("location")).toBe(
      "https://app.local/acesso?erro=oauth-invalido&next=%2Fequipe",
    );
    expect(authMocks.signOut).not.toHaveBeenCalled();
  });
});
