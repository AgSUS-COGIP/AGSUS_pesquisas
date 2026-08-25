// Avanço entre etapas. A validação por etapa e o bloqueio dos atalhos numerados
// existem para a pessoa descobrir a pendência onde ela está, e não no fim: até
// `20260813`, os atalhos do topo não validavam nada e dava para pular uma etapa
// inteira deixando obrigatórias para trás.

import { test, expect } from "./support/fixtures";
import { responderTexto, urlDoCiclo } from "./support/helpers";

const DUAS_ETAPAS = [
  { title: "Atendimento", questions: [{ title: "Como foi o atendimento?" as const }] },
  { title: "Instalações", questions: [{ title: "Como estavam as instalações?" as const }] },
];

test.describe("Etapas e perguntas obrigatórias", () => {
  test("\"Próxima\" não avança com obrigatória pendente e diz quantas faltam", async ({ page, seedSurvey }) => {
    const fixture = await seedSurvey({ sections: DUAS_ETAPAS });
    await page.goto(urlDoCiclo(fixture.applicationCode));

    await expect(page.getByText("Etapa 1 de 2")).toBeVisible();

    await page.getByRole("button", { name: "Próxima" }).click();

    await expect(page.getByText("Preencha 1 pergunta obrigatória desta etapa.")).toBeVisible();
    await expect(page.getByText("Etapa 1 de 2")).toBeVisible();

    await responderTexto(page, "Como foi o atendimento?", "Rápido e cordial.");
    await page.getByRole("button", { name: "Próxima" }).click();

    await expect(page.getByText("Etapa 2 de 2")).toBeVisible();
  });

  test("o atalho de uma etapa adiante fica bloqueado até a atual ser respondida", async ({ page, seedSurvey }) => {
    const fixture = await seedSurvey({ sections: DUAS_ETAPAS });
    await page.goto(urlDoCiclo(fixture.applicationCode));

    const atalhoEtapa2 = page.getByRole("button", { name: "2. Instalações" });
    await expect(atalhoEtapa2).toBeDisabled();

    await responderTexto(page, "Como foi o atendimento?", "Sem filas.");

    // Responder a etapa 1 move `firstIncompleteStep` adiante e libera o atalho.
    await expect(atalhoEtapa2).toBeEnabled();
    await atalhoEtapa2.click();
    await expect(page.getByText("Etapa 2 de 2")).toBeVisible();
  });
});
