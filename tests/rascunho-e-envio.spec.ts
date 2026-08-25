// Rascunho, bloqueio do envio e irreversibilidade — as três garantias que o
// runtime genérico faz a quem responde. Todas dependem do banco (autossave por
// `save_my_survey_answer`, retomada por `start_or_resume_my_survey_submission`,
// `canEdit` derivado de `application_accepts_responses`), então só um teste de
// ponta a ponta as cobre de verdade.

import { test, expect } from "./support/fixtures";
import { campoDaPergunta, responderTexto, urlDoCiclo } from "./support/helpers";

test.describe("Rascunho e envio de uma avaliação", () => {
  test("o rascunho gravado sobrevive ao recarregamento da página", async ({ page, surveyFixture }) => {
    await page.goto(urlDoCiclo(surveyFixture.applicationCode));

    await responderTexto(page, surveyFixture.questionTitle, "Resposta que precisa sobreviver.");
    await page.reload();

    await expect(campoDaPergunta(page, surveyFixture.questionTitle))
      .toHaveValue("Resposta que precisa sobreviver.");
  });

  test("obrigatória sem resposta mantém o envio bloqueado e explica o que falta", async ({ page, surveyFixture }) => {
    await page.goto(urlDoCiclo(surveyFixture.applicationCode));

    const enviar = page.getByRole("button", { name: "Enviar avaliação" });
    await expect(enviar).toBeDisabled();
    await expect(page.getByText("Faltam 1 pergunta obrigatória para liberar o envio.")).toBeVisible();

    // O botão só libera quando a obrigatória é respondida — e a contagem de
    // progresso acompanha, porque é dela que o bloqueio deriva.
    await responderTexto(page, surveyFixture.questionTitle, "Agora respondida.");

    await expect(enviar).toBeEnabled();
    await expect(page.getByText("1 de 1 obrigatórias respondidas")).toBeVisible();
  });

  test("depois do envio a avaliação fica somente leitura, mesmo recarregando", async ({ page, surveyFixture }) => {
    await page.goto(urlDoCiclo(surveyFixture.applicationCode));
    await responderTexto(page, surveyFixture.questionTitle, "Resposta definitiva.");

    await page.getByRole("button", { name: "Enviar avaliação" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Enviar avaliação" }).click();
    await expect(page.getByText("Parabéns, você concluiu!")).toBeVisible();

    // Recarregar é o que prova que o estado veio do banco, e não da tela: o
    // envio é irreversível, então nem o campo nem o botão voltam.
    await page.reload();

    await expect(page.getByRole("status").filter({ hasText: "Avaliação enviada." })).toBeVisible();
    await expect(campoDaPergunta(page, surveyFixture.questionTitle)).toBeDisabled();
    await expect(page.getByRole("button", { name: "Enviar avaliação" })).toHaveCount(0);
  });
});
