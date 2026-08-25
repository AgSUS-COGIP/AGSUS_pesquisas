import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

// O Playwright não lê `.env.local` por conta própria (diferente do `next dev`,
// que carrega isso internamente) — sem isto, as fixtures não têm como
// alcançar o Supabase com a chave de serviço.
loadEnv({ path: ".env.local" });
loadEnv();
// `.env.local` costuma apontar para o Supabase hospedado (uso normal do
// `npm run dev`). `.env.test.local`, se existir, sobrepõe só as chaves do
// Supabase LOCAL (`npx supabase start`) — sem isto, a fixture escreveria
// pessoa/pesquisa de teste no projeto real. Arquivo por máquina, fora do git.
loadEnv({ path: ".env.test.local", override: true });

// Configurável para quem já tem `next dev` rodando na 3000 por outro motivo
// — evita reusar (ou colidir com) um servidor que não está com o ambiente
// que este teste espera.
const port = process.env.PLAYWRIGHT_PORT ?? "3000";
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./tests",
  // Compila a rota de login antes do primeiro teste — ver o comentário em
  // `tests/support/global-setup.ts`.
  globalSetup: "./tests/support/global-setup.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: `npm run dev -- -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
});
