import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  needsLightForeground,
  relativeLuminance,
  WCAG_AA_NORMAL_TEXT,
} from "./color-contrast";

describe("relativeLuminance", () => {
  it("ancora nos extremos conhecidos", () => {
    expect(relativeLuminance("#000000")).toBe(0);
    expect(relativeLuminance("#ffffff")).toBe(1);
  });

  it("aceita com e sem cerquilha, em qualquer caixa", () => {
    expect(relativeLuminance("FFFFFF")).toBe(1);
    expect(relativeLuminance("#FfFfFf")).toBe(1);
  });

  it("devolve nulo para entrada inválida em vez de lançar", () => {
    expect(relativeLuminance("azul")).toBeNull();
    expect(relativeLuminance("#fff")).toBeNull();
    expect(relativeLuminance("")).toBeNull();
  });

  it("pesa o verde acima do vermelho e do azul, como manda a WCAG", () => {
    const verde = relativeLuminance("#00ff00") ?? 0;
    const vermelho = relativeLuminance("#ff0000") ?? 0;
    const azul = relativeLuminance("#0000ff") ?? 0;
    expect(verde).toBeGreaterThan(vermelho);
    expect(vermelho).toBeGreaterThan(azul);
  });
});

describe("needsLightForeground", () => {
  it("pede texto claro sobre fundo escuro", () => {
    expect(needsLightForeground("#003b70")).toBe(true);
    expect(needsLightForeground("#000000")).toBe(true);
  });

  it("mantém texto escuro sobre fundo claro", () => {
    expect(needsLightForeground("#ffffff")).toBe(false);
    expect(needsLightForeground("#d8b4fe")).toBe(false);
  });

  /*
   * O estado seguro é o painel branco com texto escuro. Cor ausente ou
   * malformada não pode virar texto branco sobre fundo branco — seria uma tela
   * de acesso em branco, sem nada legível.
   */
  it("degrada para texto escuro quando a cor é inválida ou ausente", () => {
    expect(needsLightForeground(null)).toBe(false);
    expect(needsLightForeground(undefined)).toBe(false);
    expect(needsLightForeground("roxo")).toBe(false);
  });
});

describe("contrastRatio", () => {
  it("reporta os extremos da escala", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(contrastRatio("#123456", "#123456")).toBeCloseTo(1, 5);
  });

  it("é simétrica: a ordem dos argumentos não altera o resultado", () => {
    const ida = contrastRatio("#003b70", "#ffffff");
    const volta = contrastRatio("#ffffff", "#003b70");
    expect(ida).toBeCloseTo(volta ?? 0, 10);
  });

  /*
   * O caso que motivou o módulo: o azul institucional do botão sobre um painel
   * escuro reprova na WCAG AA — é exatamente a combinação que deixaria o botão
   * invisível se a cor fosse aceita sem tratamento.
   */
  it("reprova o azul institucional sobre painel escuro", () => {
    expect(contrastRatio("#003b70", "#0d2a45") ?? 0).toBeLessThan(WCAG_AA_NORMAL_TEXT);
  });

  it("aprova o azul institucional sobre painel claro", () => {
    expect(contrastRatio("#003b70", "#ffffff") ?? 0).toBeGreaterThan(WCAG_AA_NORMAL_TEXT);
  });

  it("devolve nulo quando qualquer das cores é inválida", () => {
    expect(contrastRatio("#000000", "verde")).toBeNull();
  });
});
