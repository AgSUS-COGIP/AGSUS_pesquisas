import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/*
 * Runner mínimo, de propósito.
 *
 * O projeto não tem suíte de testes, e isso foi decisão consciente. O que
 * justifica um runner agora é específico: a manutenção operacional decide se
 * alguém entra ou não na plataforma, e a precedência entre queda de backend,
 * manutenção global, manutenção de módulo e desvio de Superadmin é regra de
 * produto que não aparece em `typecheck` nem em `build`. Errar a ordem tranca a
 * plataforma ou deixa passar quem deveria estar bloqueado — e nenhum dos dois
 * dá sinal antes de acontecer em produção.
 *
 * Por isso o alvo é só a lógica pura de `src/lib`. Sem jsdom (nada aqui toca o
 * DOM), sem Testing Library, sem cobertura obrigatória e sem mocks de
 * infraestrutura: o que precisa de prova real — Edge Config, navegador, banco —
 * continua sendo provado de verdade, não simulado.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
