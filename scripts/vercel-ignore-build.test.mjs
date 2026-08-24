import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

/*
  Estes testes existem por causa de **uma** decisão: no Ignored Build Step da
  Vercel, `exit 0` cancela o build e `exit 1` deixa seguir — o contrário da
  convenção de processo Unix.

  Quem ler o script sem saber disso vai enxergar "exit 0 no caminho de sucesso"
  como defeito e inverter os dois. A inversão não quebra nada visivelmente: o
  portão passa a promover a aplicação exatamente quando deveria barrá-la, e o
  sintoma só aparece em produção, como PGRST202 na frente de quem usa.

  Por isso o que se afirma aqui é o **código de saída**, não a mensagem.
*/

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "vercel-ignore-build.mjs");

const SEGUE = 1;
const BARRA = 0;

function executar(env) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      [SCRIPT],
      // `env` limpo: herdar o ambiente real faria o teste depender de haver ou
      // não um token na máquina de quem roda.
      { env: { PATH: process.env.PATH ?? "", ...env }, timeout: 30_000 },
      (erro, stdout) => resolve({ code: erro?.code ?? 0, stdout }),
    );
  });
}

describe("portão de ordem de deploy", () => {
  it("deixa preview seguir: não promove produção", async () => {
    const { code } = await executar({ VERCEL_ENV: "preview" });
    expect(code).toBe(SEGUE);
  });

  it("deixa desenvolvimento seguir", async () => {
    const { code } = await executar({ VERCEL_ENV: "development" });
    expect(code).toBe(SEGUE);
  });

  it("barra produção sem saber qual é o commit", async () => {
    const { code } = await executar({ VERCEL_ENV: "production" });
    expect(code).toBe(BARRA);
  });

  it("barra produção sem token: falha fechada", async () => {
    const { code, stdout } = await executar({
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_SHA: "0".repeat(40),
      VERCEL_GIT_REPO_OWNER: "AgSUS-COGIP",
      VERCEL_GIT_REPO_SLUG: "AGSUS_pesquisas",
    });
    expect(code).toBe(BARRA);
    expect(stdout).toContain("GITHUB_DEPLOY_GATE_TOKEN");
  });

  it("barra quando o GitHub não responde, em vez de promover no escuro", async () => {
    const { code } = await executar({
      VERCEL_ENV: "production",
      VERCEL_GIT_COMMIT_SHA: "0".repeat(40),
      VERCEL_GIT_REPO_OWNER: "AgSUS-COGIP",
      VERCEL_GIT_REPO_SLUG: "repositorio-que-nao-existe-para-o-token",
      GITHUB_DEPLOY_GATE_TOKEN: "token-invalido-de-teste",
    });
    expect(code).toBe(BARRA);
  });
});
