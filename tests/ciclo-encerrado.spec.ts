// Ciclo encerrado. `get_public_survey_form` aceita `CLOSED` de propósito — quem
// respondeu precisa continuar vendo o que respondeu —, mas
// `application_accepts_responses()` recusa, então a tela abre somente leitura.
// O par "abre, mas não aceita" é justamente o que um teste de ponta a ponta
// consegue verificar e um teste de unidade não.

import { test, expect } from "./support/fixtures";
import { campoDaPergunta, urlDoCiclo } from "./support/helpers";

test.describe("Ciclo encerrado", () => {
  test("abre o instrumento em somente leitura, sem caminho para responder", async ({ page, seedSurvey }) => {
    const fixture = await seedSurvey({ cycleStatus: "CLOSED" });
    await page.goto(urlDoCiclo(fixture.applicationCode));

    await expect(page.getByText("Período encerrado")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Somente leitura." })).toBeVisible();

    // Nem campo editável nem botão de envio: o bloqueio não depende de a pessoa
    // reparar num aviso.
    await expect(campoDaPergunta(page, fixture.questionTitle)).toBeDisabled();
    await expect(page.getByRole("button", { name: "Enviar avaliação" })).toHaveCount(0);
  });
});
