import { describe, expect, it } from "vitest";
import { createErrorReference, sanitizeObservabilityText } from "./observability";
import { isValidErrorReference, normalizeErrorReference } from "./observability-reference";

describe("normalizeErrorReference", () => {
  it("preserva um UUID intacto", () => {
    expect(normalizeErrorReference("3f78f05a-81fd-4869-ad99-a3ee67b3c8a2"))
      .toBe("3f78f05a-81fd-4869-ad99-a3ee67b3c8a2");
  });

  it("preserva UUID com cinco digitos seguidos", () => {
    // O caso que o sanitizador de texto livre corrompia: `\d{5,20}` trocava o
    // bloco inteiro por "[numero removido]", e a referência gravada deixava de
    // ser a que o usuário viu na tela.
    const referencia = "12345678-81fd-4869-ad99-a3ee67b3c8a2";
    expect(sanitizeObservabilityText(referencia, 80)).not.toBe(referencia);
    expect(normalizeErrorReference(referencia)).toBe(referencia);
  });

  it("preserva a referência de contingência, usada sem crypto.randomUUID", () => {
    const referencia = "err-m1x2y3z4-ab12cd34";
    expect(normalizeErrorReference(referencia)).toBe(referencia);
  });

  it("aceita toda referência que a plataforma gera", () => {
    for (let i = 0; i < 200; i += 1) {
      const gerada = createErrorReference();
      expect(isValidErrorReference(gerada)).toBe(true);
      expect(normalizeErrorReference(gerada)).toBe(gerada);
    }
  });

  it("apara espaço em volta", () => {
    expect(normalizeErrorReference("  3f78f05a-81fd-4869  ")).toBe("3f78f05a-81fd-4869");
  });

  it("recusa o que não veio da plataforma", () => {
    expect(normalizeErrorReference("curta")).toBe("");
    expect(normalizeErrorReference("com espaço no meio")).toBe("");
    expect(normalizeErrorReference("<script>alert(1)</script>")).toBe("");
    expect(normalizeErrorReference("referência/com/barra")).toBe("");
    expect(normalizeErrorReference(null)).toBe("");
    expect(normalizeErrorReference(42)).toBe("");
    expect(normalizeErrorReference("")).toBe("");
  });

  it("recusa referência longa demais em vez de truncar para algo inválido", () => {
    // 80 caracteres válidos passam; o excedente é cortado e o que sobra ainda
    // precisa ser válido, senão não é aceito.
    expect(normalizeErrorReference("a".repeat(80))).toBe("a".repeat(80));
    expect(normalizeErrorReference("a".repeat(200))).toBe("a".repeat(80));
  });
});
