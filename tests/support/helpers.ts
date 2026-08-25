import type { Page } from "@playwright/test";
import { SAVE_ANSWER_URL } from "./fixtures";

/** Endereço do runtime genérico de resposta, com o código escapado como as telas fazem. */
export function urlDoCiclo(applicationCode: string) {
  return `/pesquisas/${encodeURIComponent(applicationCode)}`;
}

/**
 * Campo de uma pergunta, localizado pelo texto da `legend`.
 *
 * Cada pergunta é um `fieldset` com `legend` própria — é o que permite achar o
 * campo pelo enunciado, sem depender de `id` gerado nem da ordem na tela.
 */
export function campoDaPergunta(page: Page, titulo: string) {
  return page
    .locator("fieldset", { has: page.locator("legend", { hasText: titulo }) })
    .locator("input, textarea");
}

/**
 * Preenche uma pergunta de texto e **espera a gravação chegar ao banco**.
 *
 * O campo salva com debounce de 700 ms; sem esperar a resposta do `PUT`, um
 * `reload()` logo depois corre contra o autossave e o teste falha por corrida,
 * não por defeito. Esperar a requisição em vez de dormir um tempo fixo mantém
 * o teste determinístico.
 */
export async function responderTexto(page: Page, titulo: string, texto: string) {
  const gravou = page.waitForResponse(
    (response) => SAVE_ANSWER_URL.test(response.url()) && response.request().method() === "PUT" && response.ok(),
  );
  await campoDaPergunta(page, titulo).fill(texto);
  await gravou;
}
