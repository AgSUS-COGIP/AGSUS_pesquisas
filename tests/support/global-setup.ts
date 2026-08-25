import type { FullConfig } from "@playwright/test";

/**
 * Aquece a rota de login antes de qualquer teste rodar.
 *
 * O `webServer` do Playwright só espera a URL raiz responder — nesse momento o
 * Turbopack ainda não compilou `/api/teste-e2e/login`. Com workers em paralelo,
 * vários testes batiam nessa rota durante a compilação e **todos** falhavam com
 * `Email link is invalid or has expired`: o handler chegava a gerar o link, mas
 * a verificação acontecia depois de o módulo ser recompilado, e o magiclink é
 * de uso único. Serial passava porque só havia uma requisição por vez.
 *
 * Uma requisição inválida basta: ela é recusada com 400 sem tocar no banco, e o
 * efeito colateral desejado — a rota compilada — é o mesmo.
 */
export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0]?.use?.baseURL ?? "http://localhost:3000";
  const alvo = new URL("/api/teste-e2e/login", baseURL).toString();

  for (let tentativa = 1; tentativa <= 20; tentativa += 1) {
    try {
      const resposta = await fetch(alvo, {
        method: "POST",
        headers: { "content-type": "application/json" },
        // Sem e-mail: a rota responde 400 antes de chamar o Supabase.
        body: JSON.stringify({}),
      });

      // 404 é a rota desligada (`E2E_TEST_LOGIN_ENABLED` ausente) — falhar aqui,
      // uma vez, é muito melhor do que quinze testes falharem na autenticação.
      if (resposta.status === 404) {
        throw new Error(
          "A rota /api/teste-e2e/login respondeu 404: defina E2E_TEST_LOGIN_ENABLED=true " +
          "no ambiente que roda o servidor de desenvolvimento.",
        );
      }
      if (resposta.status === 400) return;
    } catch (erro) {
      if (erro instanceof Error && erro.message.includes("404")) throw erro;
      if (tentativa === 20) throw erro;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error("A rota /api/teste-e2e/login não ficou pronta a tempo.");
}
