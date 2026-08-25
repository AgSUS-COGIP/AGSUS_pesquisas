import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Delimitado por inclusão, não por exclusão: os testes de unidade moram ao
    // lado do código, em `src/`. O glob padrão do Vitest varre o repositório
    // inteiro e capturava os specs do Playwright (`tests/`), que falham na
    // coleção — `test()` ali vem de `@playwright/test`, não do Vitest. Assim,
    // spec novo de E2E em qualquer pasta fora de `src/` já nasce ignorado aqui.
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      // Os quality gates de banco/CI também têm teste, em `.mjs` (são scripts
      // de Node, não módulos da aplicação).
      "scripts/**/*.{test,spec}.mjs",
    ],
  },
});
