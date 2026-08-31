// Fumaça pelo HTTP: a aplicação de pé, respondendo contra o banco local.
//
// Os testes de banco provam que as funções respondem; estes provam que a
// aplicação as alcança — que o adaptador monta as claims, que a rota devolve o
// formato esperado e que as imagens saem da própria origem. É a camada onde
// apareceria, por exemplo, um `db.schema` apontando para o lugar errado.
//
// Se não houver servidor na porta, a suíte inteira é pulada em vez de falhar:
// `npm test` não deve exigir `npm run dev` aberto.

import { test, describe, after } from "node:test";
import assert from "node:assert/strict";
import { obterPool, encerrarPool } from "../apoio/banco.mjs";

const BASE = process.env.TEST_BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";

async function servidorDePe() {
  try {
    const resposta = await fetch(`${BASE}/api/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return resposta.ok;
  } catch {
    return false;
  }
}

const ativo = await servidorDePe();

describe(
  "aplicação respondendo em " + BASE,
  { skip: ativo ? false : `nenhum servidor em ${BASE} — rode "npm run dev" para incluir estes testes` },
  () => {
    after(encerrarPool);

    test("health responde ok", async () => {
      const resposta = await fetch(`${BASE}/api/health`);
      assert.equal(resposta.status, 200);
      const corpo = await resposta.json();
      assert.equal(corpo.status, "ok");
    });

    test("readiness confirma que o banco responde", async () => {
      // Diferente do health, esta rota vai ao banco — é o teste de que a
      // aplicação está falando com o Postgres certo.
      const resposta = await fetch(`${BASE}/api/health/readiness`);
      assert.equal(resposta.status, 200, `readiness devolveu ${resposta.status}`);
      const corpo = await resposta.json();
      assert.equal(corpo.status, "ready");
    });

    test("a marca pública chega pela API antes de qualquer login", async () => {
      const resposta = await fetch(`${BASE}/api/plataforma/marca`);
      assert.equal(resposta.status, 200);
      const marca = await resposta.json();
      assert.ok(marca.productName, "marca sem nome do produto");
      assert.ok(marca.organizationName, "marca sem nome da organização");
    });

    test("a marca não aponta mais para o Storage do PostgreSQL", async () => {
      const resposta = await fetch(`${BASE}/api/plataforma/marca`);
      const texto = await resposta.text();
      assert.ok(
        !texto.includes("/storage/v1/object/public/"),
        "a marca ainda devolve URL do Storage",
      );
    });

    test("as imagens são servidas pela própria aplicação", async () => {
      const { rows } = await obterPool().query(
        "select co_balde, ds_caminho, tp_conteudo, nu_tamanho from sigav.tb_arquivo order by ds_caminho",
      );
      assert.ok(rows.length > 0, "nenhuma imagem no banco para testar");

      for (const arquivo of rows) {
        const url = `${BASE}/api/arquivos/${arquivo.co_balde}/${arquivo.ds_caminho}`;
        const resposta = await fetch(url);

        assert.equal(resposta.status, 200, `${url} devolveu ${resposta.status}`);
        assert.equal(resposta.headers.get("content-type"), arquivo.tp_conteudo);
        assert.equal(
          Number(resposta.headers.get("content-length")),
          arquivo.nu_tamanho,
          `${url} devolveu tamanho diferente do gravado`,
        );
        // Servida da mesma origem da aplicação, o cabeçalho é o que impede o
        // navegador de reinterpretar o tipo declarado.
        assert.equal(resposta.headers.get("x-content-type-options"), "nosniff");
      }
    });

    test("arquivo inexistente responde 404, não erro de servidor", async () => {
      const resposta = await fetch(`${BASE}/api/arquivos/platform-assets/nao-existe.png`);
      assert.equal(resposta.status, 404);
    });

    test("rota privada sem sessão devolve 401, e em JSON", async () => {
      // O proxy barra antes de a rota tocar o banco. O status importa: um
      // redirecionamento faria o `fetch` do navegador seguir sozinho e a tela
      // receberia HTML de login onde espera JSON — o defeito que
      // `src/lib/auth/proxy-authjs.ts` documenta. E 404 aqui significaria que a
      // rota sumiu, não que a sessão foi recusada.
      const resposta = await fetch(`${BASE}/api/plataforma/contexto`, { redirect: "manual" });
      assert.equal(resposta.status, 401, `esperava 401 sem sessão, veio ${resposta.status}`);
      assert.match(resposta.headers.get("content-type") ?? "", /application\/json/);
    });
  },
);
