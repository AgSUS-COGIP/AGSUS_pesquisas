import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { executeRpc } from "./rpc-adapter";

/*
 * O contrato do adaptador é devolver `{ data, error }` — SEMPRE. Uma rota faz
 * `const { data, error } = await banco.rpc(...)` e trata `error` com
 * `respostaDeErro`; ela não tem `try/catch`. Toda exceção que escapa daqui
 * atravessa o handler, vira um 500 do Next SEM corpo JSON, e a tela recebe o
 * texto de reserva do cliente — sem status útil, sem código, e sem registro no
 * log do servidor, porque `respostaDeErro` nunca é chamada.
 *
 * Foi exatamente o que aconteceu em 02/09/2026: a obtenção da conexão estava
 * fora do `try`, a VPN caiu, o `connectionTimeoutMillis` estourou e a
 * plataforma disse apenas "Não foi possível concluir a operação."
 *
 * Estes testes exercitam o caminho de falha SEM banco: o `vitest` roda sem
 * `--env-file`, então não há configuração de conexão e `getEmpresaDbPool()`
 * lança na leitura dela — que é o mesmo ponto onde um timeout de rede lançaria.
 */

const VARIAVEIS = [
  "EMPRESA_DATABASE_URL",
  "USERNAME_DATABASE_URL",
  "PASSWORD_DATABASE_URL",
] as const;

const original: Record<string, string | undefined> = {};

beforeEach(() => {
  // Explícito em vez de confiar no ambiente: se alguém rodar a suíte com
  // `--env-file=.env.local`, sem isto o teste abriria conexão de verdade e
  // passaria a medir outra coisa.
  for (const nome of VARIAVEIS) {
    original[nome] = process.env[nome];
    delete process.env[nome];
  }
});

afterEach(() => {
  for (const nome of VARIAVEIS) {
    if (original[nome] === undefined) delete process.env[nome];
    else process.env[nome] = original[nome];
  }
});

describe("falha ao obter a conexão", () => {
  it("volta como error, não como exceção", async () => {
    const resultado = await executeRpc("FC_OBTER_CONTEXTO_PLATAFORMA", {}, "authenticated");

    expect(resultado.data).toBeNull();
    expect(resultado.error).not.toBeNull();
  });

  it("a mensagem nomeia a causa, para o log do servidor servir de algo", async () => {
    // `respostaDeErro` registra `[api] <contexto> <código> <mensagem>`. Sem uma
    // mensagem real aqui, o log fica com a linha e nenhuma informação.
    const resultado = await executeRpc("FC_OBTER_CONTEXTO_PLATAFORMA", {}, "authenticated");

    expect(resultado.error?.message).toBeTruthy();
    expect(resultado.error?.message).toMatch(/EMPRESA_DATABASE_URL/);
  });

  it("vale para os três papéis, não só para a sessão comum", async () => {
    // O cron (`service_role`) e as rotas públicas (`anon`) passam pelo mesmo
    // caminho. Um deles estourando derruba a tarefa agendada em silêncio.
    for (const [nome, papel] of [
      ["FC_OBTER_MARCA_PUBLICA", "anon"],
      ["FC_SRV_REIVINDICAR_EMAILS", "service_role"],
    ] as const) {
      const resultado = await executeRpc(nome, {}, papel);
      expect(resultado.error, `${nome} como ${papel}`).not.toBeNull();
      expect(resultado.data).toBeNull();
    }
  });
});

describe("o portão de papel vem antes de tocar o banco", () => {
  /*
    A ordem é o que faz o allowlist ser barreira e não decoração: recusar antes
    de abrir conexão significa que uma sessão comum não consegue nem provocar
    uma ida ao banco com o nome de uma função de cron.
  */
  it("função de serviço pedida por sessão comum é recusada com 42501", async () => {
    const resultado = await executeRpc("FC_SRV_REIVINDICAR_EMAILS", {}, "authenticated");

    expect(resultado.error?.code).toBe("42501");
    expect(resultado.error?.message).toMatch(/não está liberada para o papel "authenticated"/);
  });

  it("função fora do allowlist é recusada com 42501", async () => {
    const resultado = await executeRpc("FC_FUNCAO_INVENTADA", {}, "service_role");
    expect(resultado.error?.code).toBe("42501");
  });

  it("chave herdada de Object.prototype é recusada, não lança", async () => {
    // O portão usa `Object.hasOwn`. Sem ele, `RPC_PERMISSIONS["toString"]`
    // devolvia a função herdada e `roles.includes` estourava `TypeError` —
    // dentro de `executeRpc`, ou seja, escapando como exceção não tratada.
    const resultado = await executeRpc("toString", {}, "anon");
    expect(resultado.error?.code).toBe("42501");
  });

  it("recusa de papel não depende de configuração de banco", async () => {
    // As variáveis estão apagadas por `beforeEach` e a recusa continua sendo a
    // de permissão: prova que o portão fecha antes de `getEmpresaDbPool()`.
    const resultado = await executeRpc("FC_SRV_REIVINDICAR_EMAILS", {}, "anon");
    expect(resultado.error?.code).toBe("42501");
    expect(resultado.error?.message).not.toMatch(/EMPRESA_DATABASE_URL/);
  });
});
