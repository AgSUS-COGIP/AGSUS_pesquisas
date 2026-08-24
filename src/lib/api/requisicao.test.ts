import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const refreshSession = vi.fn();
const signOut = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createBrowserSupabaseClient: () => ({ auth: { refreshSession, signOut } }),
}));

async function carregarTransporte() {
  vi.resetModules();
  return import("./requisicao");
}

function resposta(status: number, corpo: unknown = null) {
  return new Response(corpo === null ? "" : JSON.stringify(corpo), { status });
}

const SESSAO_RENOVAVEL = { mensagem: "A sua sessão expirou.", codigo: "SESSAO_RENOVAVEL" };
const SESSAO_NAO_RENOVAVEL = { mensagem: "A sua sessão expirou." };
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  refreshSession.mockReset();
  signOut.mockReset();
  signOut.mockResolvedValue({ error: null });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("window", {});
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("corpoPodeSerReenviado", () => {
  it("aceita ausência de corpo e JSON serializado", async () => {
    const { corpoPodeSerReenviado } = await carregarTransporte();
    expect(corpoPodeSerReenviado(undefined)).toBe(true);
    expect(corpoPodeSerReenviado(null)).toBe(true);
    expect(corpoPodeSerReenviado(JSON.stringify({ a: 1 }))).toBe(true);
  });

  it("recusa corpo que não se reenvia", async () => {
    const { corpoPodeSerReenviado } = await carregarTransporte();
    expect(corpoPodeSerReenviado(new FormData())).toBe(false);
    expect(corpoPodeSerReenviado(new Blob(["x"]))).toBe(false);
  });
});

describe("chamar — sessão expirada", () => {
  it("renova uma vez e repete a chamada quando o 401 é renovável", async () => {
    const { chamar } = await carregarTransporte();
    fetchMock
      .mockImplementationOnce(() => Promise.resolve(resposta(401, SESSAO_RENOVAVEL)))
      .mockImplementationOnce(() => Promise.resolve(resposta(200, { ok: true })));
    refreshSession.mockResolvedValue({ data: { session: { access_token: "x" } }, error: null });

    await expect(chamar("/api/exemplo")).resolves.toEqual({ ok: true });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("não repete indefinidamente: o segundo 401 sobe como erro", async () => {
    const { chamar, ErroDeApi } = await carregarTransporte();
    fetchMock.mockResolvedValue(resposta(401, SESSAO_RENOVAVEL));
    refreshSession.mockResolvedValue({ data: { session: { access_token: "x" } }, error: null });

    await expect(chamar("/api/exemplo")).rejects.toBeInstanceOf(ErroDeApi);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("uma ocorrência futura pode limpar a sessão local novamente", async () => {
    const { chamar } = await carregarTransporte();
    fetchMock.mockImplementation(() => Promise.resolve(resposta(401, SESSAO_RENOVAVEL)));
    refreshSession.mockResolvedValue({ data: { session: { access_token: "x" } }, error: null });

    await expect(chamar("/api/primeira")).rejects.toMatchObject({ status: 401 });
    await Promise.resolve();
    await expect(chamar("/api/segunda")).rejects.toMatchObject({ status: 401 });

    expect(signOut).toHaveBeenCalledTimes(2);
  });

  it("não repete quando a renovação falha", async () => {
    const { chamar } = await carregarTransporte();
    fetchMock.mockResolvedValue(resposta(401, SESSAO_RENOVAVEL));
    refreshSession.mockResolvedValue({ data: { session: null }, error: { message: "sem refresh token" } });

    await expect(chamar("/api/exemplo")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("chamadas paralelas compartilham uma única renovação", async () => {
    const { chamar } = await carregarTransporte();
    fetchMock.mockImplementation(() =>
      Promise.resolve(refreshSession.mock.calls.length ? resposta(200, { ok: true }) : resposta(401, SESSAO_RENOVAVEL)),
    );
    refreshSession.mockResolvedValue({ data: { session: { access_token: "x" } }, error: null });

    await Promise.all([chamar("/api/a"), chamar("/api/b"), chamar("/api/c")]);
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it("não tenta renovar quando o corpo não pode ser reenviado", async () => {
    const { chamar } = await carregarTransporte();
    fetchMock.mockResolvedValue(resposta(401, SESSAO_RENOVAVEL));

    await expect(chamar("/api/exemplo", { method: "POST", body: new FormData() })).rejects.toMatchObject({ status: 401 });
    expect(refreshSession).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("401 sem a marca de renovável não renova nem repete", async () => {
    const { chamar } = await carregarTransporte();
    fetchMock.mockImplementation(() => Promise.resolve(resposta(401, SESSAO_NAO_RENOVAVEL)));

    await expect(chamar("/api/exemplo")).rejects.toMatchObject({ status: 401 });
    expect(refreshSession).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("expõe sessaoRenovavel apenas no 401 marcado", async () => {
    const { chamar } = await carregarTransporte();
    fetchMock.mockImplementation(() => Promise.resolve(resposta(401, SESSAO_NAO_RENOVAVEL)));
    await expect(chamar("/api/exemplo")).rejects.toMatchObject({ sessaoRenovavel: false });

    fetchMock.mockImplementation(() => Promise.resolve(resposta(401, SESSAO_RENOVAVEL)));
    refreshSession.mockResolvedValue({ data: { session: null }, error: { message: "sem refresh token" } });
    await expect(chamar("/api/exemplo")).rejects.toMatchObject({ sessaoRenovavel: true });
  });

  it("403 não aciona renovação", async () => {
    const { chamar } = await carregarTransporte();
    fetchMock.mockResolvedValue(resposta(403, { mensagem: "Sem permissão." }));

    await expect(chamar("/api/exemplo")).rejects.toMatchObject({ status: 403 });
    expect(refreshSession).not.toHaveBeenCalled();
  });
});
