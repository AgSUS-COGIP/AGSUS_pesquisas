// Ciclo anônimo. O que se testa aqui não é cosmético: a promessa de anonimato
// muda o que a pessoa se sente à vontade para escrever, então ela precisa ser
// lida **antes** das perguntas — e a confirmação de envio precisa dizer que o
// vínculo é destruído, que é a razão de não haver como reabrir.

import { test, expect } from "./support/fixtures";
import { campoDaPergunta, urlDoCiclo } from "./support/helpers";

test.describe("Ciclo anônimo", () => {
  test("anuncia o anonimato antes das perguntas, não junto ao botão de enviar", async ({ page, seedSurvey }) => {
    const fixture = await seedSurvey({ anonymous: true });
    await page.goto(urlDoCiclo(fixture.applicationCode));

    const aviso = page.getByRole("heading", { name: "Esta avaliação é anônima" });
    await expect(aviso).toBeVisible();
    await expect(page.getByText("Anônima", { exact: true })).toBeVisible();

    // A ordem é a regra. Comparar a posição vertical é o que distingue "o aviso
    // existe na página" de "o aviso é lido antes de começar a escrever".
    const primeiraPergunta = campoDaPergunta(page, fixture.questionTitle);
    const caixaAviso = await aviso.boundingBox();
    const caixaPergunta = await primeiraPergunta.boundingBox();
    expect(caixaAviso, "o aviso de anonimato precisa estar visível").not.toBeNull();
    expect(caixaPergunta, "a pergunta precisa estar visível").not.toBeNull();
    expect(caixaAviso!.y).toBeLessThan(caixaPergunta!.y);
  });

  test("a confirmação de envio avisa que o vínculo deixa de existir", async ({ page, seedSurvey }) => {
    const fixture = await seedSurvey({ anonymous: true });
    await page.goto(urlDoCiclo(fixture.applicationCode));

    await campoDaPergunta(page, fixture.questionTitle).fill("Poderia haver mais cadeiras na espera.");
    await page.getByRole("button", { name: "Enviar avaliação" }).click();

    // Num ciclo nominal o texto fala só em não poder alterar; aqui ele precisa
    // dizer também que nem a administração consegue reabrir.
    const dialogo = page.getByRole("dialog");
    await expect(dialogo).toContainText("o vínculo entre você e elas deixa de existir");
  });
});
