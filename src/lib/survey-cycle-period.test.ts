import { describe, expect, it } from "vitest";
import {
  nowLocalInputValue,
  periodIssues,
  publishBlockedMessage,
} from "./survey-cycle-period";

// Referência fixa para que os testes não dependam do relógio da máquina.
const AGORA = new Date("2026-08-11T14:00:00");

/** Constrói um valor de `datetime-local` deslocado em minutos da referência. */
function local(minutosDeDiferenca: number) {
  const instante = new Date(AGORA.getTime() + minutosDeDiferenca * 60_000);
  return nowLocalInputValue(instante);
}

describe("periodIssues", () => {
  it("aceita período inteiramente no futuro", () => {
    expect(periodIssues(local(60), local(120), AGORA)).toEqual([]);
  });

  it("recusa abertura anterior ao momento atual", () => {
    const issues = periodIssues(local(-120), local(120), AGORA);
    expect(issues).toEqual([
      { field: "opensAt", message: "A abertura não pode ser anterior à data e hora atuais." },
    ]);
  });

  it("recusa encerramento anterior ou igual à abertura", () => {
    const issues = periodIssues(local(120), local(60), AGORA);
    expect(issues).toEqual([
      { field: "closesAt", message: "O encerramento deve ocorrer após a abertura." },
    ]);
  });

  it("recusa encerramento igual à abertura", () => {
    const issues = periodIssues(local(60), local(60), AGORA);
    expect(issues.map((issue) => issue.field)).toEqual(["closesAt"]);
  });

  it("acumula os dois problemas quando abertura passou e encerramento antecede a abertura", () => {
    const issues = periodIssues(local(-60), local(-120), AGORA);
    expect(issues.map((issue) => issue.field)).toEqual(["opensAt", "closesAt"]);
  });

  it("cobra data atual do encerramento quando não há abertura informada", () => {
    const issues = periodIssues("", local(-60), AGORA);
    expect(issues).toEqual([
      { field: "closesAt", message: "O encerramento não pode ser anterior à data e hora atuais." },
    ]);
  });

  it("trata campo vazio como ausência de período, não como erro", () => {
    expect(periodIssues("", "", AGORA)).toEqual([]);
    expect(periodIssues(local(60), "", AGORA)).toEqual([]);
  });

  it("ignora valor não interpretável como data", () => {
    expect(periodIssues("não é data", "", AGORA)).toEqual([]);
  });

  it("tolera a abertura marcada para o instante corrente", () => {
    // Um minuto de tolerância espelha o `interval '1 minute'` do banco e evita
    // que escolher "agora" falhe pelos segundos gastos até a gravação.
    expect(periodIssues(local(0), local(60), AGORA)).toEqual([]);
    expect(periodIssues(local(-2), local(60), AGORA)).toHaveLength(1);
  });
});

describe("publishBlockedMessage", () => {
  it("libera a publicação com período válido", () => {
    expect(publishBlockedMessage(local(60), local(120), AGORA)).toBeNull();
  });

  it("pede a correção do período quando o rascunho envelheceu", () => {
    expect(publishBlockedMessage(local(-120), local(-60), AGORA)).toBe(
      "O período informado já passou. Atualize a abertura e o encerramento antes de publicar.",
    );
  });

  it("devolve o problema de ordenação quando as datas estão no futuro", () => {
    expect(publishBlockedMessage(local(120), local(60), AGORA)).toBe(
      "O encerramento deve ocorrer após a abertura.",
    );
  });
});

describe("nowLocalInputValue", () => {
  it("produz o formato aceito por datetime-local", () => {
    expect(nowLocalInputValue(AGORA)).toBe("2026-08-11T14:00");
  });
});
