import { describe, expect, it } from "vitest";
import {
  ANONYMITY_ADMIN_EFFECTS,
  ANONYMITY_GUARANTEES,
  ANONYMITY_LIMITS,
  ANONYMITY_SUMMARY,
  identificationLabel,
} from "./anonymity";

describe("identificationLabel", () => {
  it("nomeia os dois modos em português, sem devolver código do banco", () => {
    expect(identificationLabel(true)).toBe("Anônima");
    expect(identificationLabel(false)).toBe("Nominal");
  });
});

describe("texto do anonimato", () => {
  it("nunca promete anonimato absoluto", () => {
    // "Ninguém nunca saberá" seria falso enquanto o rascunho existe. Se alguém
    // acrescentar uma frase assim, este teste é o que impede a promessa de
    // chegar à tela de quem responde.
    const tudo = [...ANONYMITY_GUARANTEES, ...ANONYMITY_LIMITS, ANONYMITY_SUMMARY]
      .join(" ")
      .toLocaleLowerCase("pt-BR");

    for (const absoluto of ["ninguém nunca", "jamais será", "impossível saber", "totalmente anônim"]) {
      expect(tudo).not.toContain(absoluto);
    }
  });

  it("declara as duas ressalvas que a migration exige", () => {
    const ressalvas = ANONYMITY_LIMITS.join(" ").toLocaleLowerCase("pt-BR");

    // O bilhete existe enquanto o rascunho existe (20260813220000).
    expect(ressalvas).toContain("rascunho");
    // `application_participants` continua registrando a participação.
    expect(ressalvas).toContain("participou");
  });

  it("o resumo de uma linha carrega a ressalva junto", () => {
    // Um resumo que só promete é lido como promessa integral, mesmo quando a
    // lista completa está logo abaixo.
    expect(ANONYMITY_SUMMARY).toMatch(/participou/i);
  });

  it("avisa quem administra que a escolha é irreversível", () => {
    // O gatilho `tba_ciclo_anonimo` recusa ligar ou desligar depois da primeira
    // resposta. Quem não lê isso antes não tem correção dentro do ciclo.
    const efeitos = ANONYMITY_ADMIN_EFFECTS.join(" ").toLocaleLowerCase("pt-BR");
    expect(efeitos).toContain("depois da primeira resposta");
  });

  it("não deixa nenhuma lista vazia", () => {
    // Esvaziar uma delas apagaria a promessa ou a ressalva da tela sem que
    // nenhum outro teste percebesse.
    expect(ANONYMITY_GUARANTEES.length).toBeGreaterThan(0);
    expect(ANONYMITY_LIMITS.length).toBeGreaterThan(0);
    expect(ANONYMITY_ADMIN_EFFECTS.length).toBeGreaterThan(0);
  });
});
