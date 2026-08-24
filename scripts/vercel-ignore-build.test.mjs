import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";

/*
  Estes testes existem por duas razões, e as duas são armadilhas silenciosas.

  A primeira: no Ignored Build Step da Vercel, `exit 0` cancela o build e
  `exit 1` deixa seguir — o contrário da convenção Unix. Quem ler o script sem
  saber disso vai enxergar "exit 0 no caminho de sucesso" como defeito e
  inverter os dois. A inversão não quebra nada visivelmente: o portão passa a
  promover exatamente quando deveria barrar, e o sintoma só aparece em produção.
  Por isso o que se afirma aqui é o **código de saída**, não a mensagem.

  A segunda: o portão avalia o estado **acumulado** do banco, não o conteúdo do
  commit. Um teste que só cobrisse "commit com migration" deixaria passar
  justamente a regressão que motivou a mudança — migration antiga nunca
  aplicada, commit atual sem tocar no banco.
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
      // não credenciais na máquina de quem roda.
      { env: { PATH: process.env.PATH ?? "", ...env }, timeout: 30_000 },
      (erro, stdout) => resolve({ code: erro?.code ?? 0, stdout }),
    );
  });
}

/** Produção com identidade de commit, mas sem credencial nenhuma. */
const PRODUCAO = {
  VERCEL_ENV: "production",
  VERCEL_GIT_COMMIT_SHA: "0".repeat(40),
  VERCEL_GIT_REPO_OWNER: "AgSUS-COGIP",
  VERCEL_GIT_REPO_SLUG: "AGSUS_pesquisas",
};

describe("portão de ordem de deploy", () => {
  it("deixa preview seguir: não promove produção", async () => {
    expect((await executar({ VERCEL_ENV: "preview" })).code).toBe(SEGUE);
  });

  it("deixa desenvolvimento seguir", async () => {
    expect((await executar({ VERCEL_ENV: "development" })).code).toBe(SEGUE);
  });

  it("barra produção sem saber qual é o commit", async () => {
    expect((await executar({ VERCEL_ENV: "production" })).code).toBe(BARRA);
  });

  it("barra produção sem o token do GitHub: falha fechada", async () => {
    const { code, stdout } = await executar(PRODUCAO);
    expect(code).toBe(BARRA);
    expect(stdout).toContain("GITHUB_DEPLOY_GATE_TOKEN");
  });

  it("barra quando o GitHub não responde, em vez de promover no escuro", async () => {
    const { code } = await executar({
      ...PRODUCAO,
      VERCEL_GIT_REPO_SLUG: "repositorio-que-nao-existe-para-o-token",
      GITHUB_DEPLOY_GATE_TOKEN: "token-invalido-de-teste",
    });
    expect(code).toBe(BARRA);
  });

  it("barra quando não consegue perguntar ao banco, mesmo com o GitHub respondendo", async () => {
    /*
      O caso que a versão anterior deixava passar: sem conseguir avaliar o
      estado acumulado do banco, o portão não tem base para liberar. Aqui o
      Supabase aponta para um host que não existe, e a resposta correta é
      barrar — não "o commit não mexe em migration, então pode ir".
    */
    const { code } = await executar({
      ...PRODUCAO,
      GITHUB_DEPLOY_GATE_TOKEN: "token-invalido-de-teste",
      SUPABASE_URL: "https://banco-que-nao-existe.invalid",
      SUPABASE_SERVICE_ROLE_KEY: "chave-de-teste",
    });
    expect(code).toBe(BARRA);
  });
});
