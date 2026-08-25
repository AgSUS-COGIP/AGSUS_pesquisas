import { test as base, expect, type Page } from "@playwright/test";
import {
  seedParticipantSurveyFixture,
  teardownParticipantSurveyFixture,
  type SeedOptions,
  type SurveyFixture,
} from "./db-fixtures";

/** Rota de gravação de resposta — usada para esperar o autossave sem `waitForTimeout`. */
export const SAVE_ANSWER_URL = /\/api\/submissoes\/[^/]+\/respostas/;

type Fixtures = {
  /**
   * Semeia uma pesquisa (com as opções pedidas) e autentica a pessoa criada.
   * Pode ser chamada mais de uma vez no mesmo teste; tudo o que for criado é
   * removido no fim, na ordem inversa.
   */
  seedSurvey: (options?: SeedOptions) => Promise<SurveyFixture>;
  /** Atalho para o caso simples: uma seção, uma pergunta obrigatória, ciclo aberto. */
  surveyFixture: SurveyFixture;
};

/** Troca um e-mail de teste por uma sessão, sem passar pelo Google OAuth. */
async function loginAsTestUser(page: Page, email: string) {
  const response = await page.request.post("/api/teste-e2e/login", { data: { email } });
  if (response.status() !== 200) {
    // O corpo carrega a mensagem da rota; sem ele o diagnóstico vira adivinhação
    // (rota desligada? chave sem permissão? sessão não estabelecida?).
    const corpo = await response.text().catch(() => "<sem corpo>");
    expect(
      response.status(),
      `Falha ao autenticar ${email} — resposta: ${corpo}`,
    ).toBe(200);
  }
}

export const test = base.extend<Fixtures>({
  seedSurvey: async ({ page }, use) => {
    const criadas: SurveyFixture[] = [];

    await use(async (options?: SeedOptions) => {
      const fixture = await seedParticipantSurveyFixture(options);
      criadas.push(fixture);
      await loginAsTestUser(page, fixture.email);
      return fixture;
    });

    // Roda contra um Supabase real e persistente — sem isto, cada execução
    // deixaria pessoa, pesquisa e submissão órfãs para trás. A ordem inversa
    // desfaz primeiro o que foi criado por último.
    for (const fixture of criadas.reverse()) {
      await teardownParticipantSurveyFixture(fixture.ids);
    }
  },

  surveyFixture: async ({ seedSurvey }, use) => {
    await use(await seedSurvey());
  },
});

export { expect };
