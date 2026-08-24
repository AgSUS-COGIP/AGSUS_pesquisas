import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/*
  O estado da renovação é de módulo — uma promise compartilhada e a marca de
  sessão já reiniciada. Sem `resetModules` entre os casos, o primeiro teste que
  reinicia a sessão deixaria os seguintes sem nunca reiniciar, e o resultado
  dependeria da ordem de execução.
*/
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

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  refreshSession.mockReset();
  signOut.mockReset();
  signOut.mockResolvedValue({ error: null });
  vi.stubGlobal("fetch", fetchMock);
  // O transporte só renova sessão no navegador, e a suíte roda em Node. Sem
  // este `window`, todo caso de renovação passaria por não fazer nada.
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
  it("renova uma vez e repete a chamada quando o 401 é de token", async () => {
    const { chamar } = await carregarTransporte();
    fetchMock
      .mockImplementationOnce(() => Promise.resolve(resposta(401, { mensagem: "A sua sessão expirou." })))
      .mockImplementationOnce(() => Promise.resolve(resposta(200, { ok: true })));
    refreshSession.mockResolvedValue({ data: { session: { access_token: "x" } }, error: null });

    await expect(chamar("/api/exemplo")).resolves.toEqual({ ok: true });
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(signOut).not.toHaveBeenCalled();
  });

  it("não repete indefinidamente: o segundo 401 sobe como erro", async () => {
    const { chamar, ErroDeApi } = await carregarTransporte();
    fetchMock.mockResolvedValue(resposta(401, { mensagem: "A sua sessão expirou." }));
    refreshSession.mockResolvedValue({ data: { session: { access_token: "x" } }, error: null });

    await expect(chamar("/api/exemplo")).rejects.toBeInstanceOf(ErroDeApi);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    // Zera a sessão local uma vez, para /acesso não devolver a pessoa à
    // aplicação com a sessão morta ainda gravada.
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("não repete quando a renovação falha", async () => {
    const { chamar } = await carregarTransporte();
    fetchMock.mockResolvedValue(resposta(401, { mensagem: "A sua sessão expirou." }));
    refreshSession.mockResolvedValue({ data: { session: null }, error: { message: "sem refresh token" } });

    await expect(chamar("/api/exemplo")).rejects.toMatchObject({ status: 401 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("chamadas paralelas compartilham uma única renovação", async () => {
    const { chamar } = await carregarTransporte();
    fetchMock.mockImplementation(() =>
      Promise.resolve(refreshSession.mock.calls.length ? resposta(200, { ok: true }) : resposta(401, { mensagem: "expirou" })),
    );
    refreshSession.mockResolvedValue({ data: { session: { access_token: "x" } }, error: null });

    await Promise.all([chamar("/api/a"), chamar("/api/b"), chamar("/api/c")]);
    expect(refreshSession).toHaveBeenCalledTimes(1);
  });

  it("não tenta renovar quando o corpo não pode ser reenviado", async () => {
    const { chamar } = await carregarTransporte();
    fetchMock.mockResolvedValue(resposta(401, { mensagem: "expirou" }));

    await expect(chamar("/api/exemplo", { method: "POST", body: new FormData() })).rejects.toMatchObject({ status: 401 });
    expect(refreshSession).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("403 não aciona renovação", async () => {
    const { chamar } = await carregarTransporte();
    fetchMock.mockResolvedValue(resposta(403, { mensagem: "Sem permissão." }));

    await expect(chamar("/api/exemplo")).rejects.toMatchObject({ status: 403 });
    expect(refreshSession).not.toHaveBeenCalled();
  });
});
