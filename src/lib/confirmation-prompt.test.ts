import { describe, expect, it } from "vitest";
import { confirmationReasonError, confirmationReasonValue } from "./confirmation-prompt";

describe("confirmationReasonError", () => {
  it("aceita motivo com o tamanho exigido", () => {
    expect(confirmationReasonError("respondeu no lugar de outra pessoa", 10)).toBeNull();
  });

  it("aceita exatamente no limite", () => {
    expect(confirmationReasonError("1234567890", 10)).toBeNull();
  });

  it("recusa texto curto e diz quantos caracteres faltam", () => {
    expect(confirmationReasonError("engano", 10)).toBe(
      "Descreva o motivo com pelo menos 10 caracteres. Faltam 4 caracteres.",
    );
  });

  it("concorda o singular quando falta um só caractere", () => {
    expect(confirmationReasonError("123456789", 10)).toBe(
      "Descreva o motivo com pelo menos 10 caracteres. Falta 1 caractere.",
    );
  });

  it("não conta espaço em volta como motivo", () => {
    // Sem isto, dez espaços passariam pela tela e o banco recusaria depois da
    // confirmação — que é o caso que esta validação existe para evitar.
    expect(confirmationReasonError("          ", 10)).toBe(
      "Descreva o motivo com pelo menos 10 caracteres. Faltam 10 caracteres.",
    );
  });

  it("recusa texto vazio", () => {
    expect(confirmationReasonError("", 10)).not.toBeNull();
  });

  it("exige ao menos um caractere quando o mínimo é zero ou negativo", () => {
    expect(confirmationReasonError("", 0)).not.toBeNull();
    expect(confirmationReasonError("x", 0)).toBeNull();
    expect(confirmationReasonError("x", -5)).toBeNull();
  });
});

describe("confirmationReasonValue", () => {
  it("apara o valor que segue para a RPC", () => {
    expect(confirmationReasonValue("  motivo com espaco  ")).toBe("motivo com espaco");
  });
});
