import { describe, expect, it } from "vitest";
import { cycleStatusLabel, versionStatusLabel } from "./survey-status-labels";

describe("cycleStatusLabel", () => {
  it("traduz os cinco estados do ciclo", () => {
    expect(cycleStatusLabel("DRAFT")).toBe("Rascunho");
    expect(cycleStatusLabel("SCHEDULED")).toBe("Agendado");
    expect(cycleStatusLabel("OPEN")).toBe("Aberto");
    expect(cycleStatusLabel("CLOSED")).toBe("Encerrado");
    expect(cycleStatusLabel("CANCELLED")).toBe("Cancelado");
  });

  it("diz que não há ciclo quando o estado falta", () => {
    expect(cycleStatusLabel(null)).toBe("Não configurado");
    expect(cycleStatusLabel(undefined)).toBe("Não configurado");
    expect(cycleStatusLabel("")).toBe("Não configurado");
  });

  it("devolve código desconhecido como veio", () => {
    // Deliberado: um estado novo no banco aparece cru — sinal de que falta
    // traduzi-lo — em vez de virar um traço que esconde a novidade.
    expect(cycleStatusLabel("SUSPENDED")).toBe("SUSPENDED");
  });
});

describe("versionStatusLabel", () => {
  it("traduz os quatro estados da versão", () => {
    expect(versionStatusLabel("DRAFT")).toBe("Rascunho");
    expect(versionStatusLabel("PUBLISHED")).toBe("Publicada");
    expect(versionStatusLabel("ARCHIVED")).toBe("Arquivada");
    expect(versionStatusLabel("RETIRED")).toBe("Descontinuada");
  });

  it("diz que não há versão quando o estado falta", () => {
    expect(versionStatusLabel(null)).toBe("Não configurada");
  });
});
