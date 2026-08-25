// Jornada do participante: entra, encontra a pesquisa no catálogo, responde
// a única pergunta obrigatória e envia. Cobre o caminho mais usado da
// plataforma — o runtime genérico de `/pesquisas/[applicationCode]`.

import { test, expect } from "./support/fixtures";

test.describe("Participante responde uma pesquisa institucional", () => {
  test("aparece no catálogo, é respondida e termina com a confirmação de envio", async ({
    page,
    surveyFixture,
  }) => {
    await page.goto("/pesquisas");
    await expect(page.getByText(surveyFixture.surveyName).first()).toBeVisible();

    await page
      .locator(`a[href*="${encodeURIComponent(surveyFixture.applicationCode)}"]`)
      .filter({ hasText: "Responder" })
      .click();

    await expect(page).toHaveURL(new RegExp(encodeURIComponent(surveyFixture.applicationCode)));

    await page
      .locator("fieldset", { has: page.locator("legend", { hasText: surveyFixture.questionTitle }) })
      .locator("input")
      .fill("Muito bom, sem filas de espera.");

    const submitButton = page.getByRole("button", { name: "Enviar avaliação" });
    await expect(submitButton).toBeEnabled();
    await submitButton.click();

    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Enviar avaliação" })
      .click();

    await expect(page.getByText("Parabéns, você concluiu!")).toBeVisible();
    await expect(page.getByText("Sua resposta foi enviada.")).toBeVisible();
  });
});
