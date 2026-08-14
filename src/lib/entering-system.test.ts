import { beforeEach, describe, expect, it, vi } from "vitest";
import { captureEnteringFlag, consumeEnteringFlag, resetEnteringFlagForTests } from "./entering-system";

/** Simula a janela com um endereço, registrando o que for reescrito nele. */
function comEndereco(href: string) {
  const reescritas: string[] = [];
  vi.stubGlobal("window", {
    location: { href },
    history: { replaceState: (_s: unknown, _t: string, url: string) => reescritas.push(url) },
  });
  return reescritas;
}

beforeEach(() => {
  resetEnteringFlagForTests();
  vi.unstubAllGlobals();
});

describe("captureEnteringFlag", () => {
  it("reconhece a navegação vinda do login", () => {
    comEndereco("https://app.local/area?entrando=1");
    expect(captureEnteringFlag()).toBe(true);
  });

  it("limpa o parâmetro do endereço na primeira leitura", () => {
    const reescritas = comEndereco("https://app.local/area?entrando=1&ciclo=CDDI-2026");
    captureEnteringFlag();
    // O que não é do login sobrevive: só `entrando` sai.
    expect(reescritas).toEqual(["/area?ciclo=CDDI-2026"]);
  });

  it("não reescreve o endereço quando não veio do login", () => {
    const reescritas = comEndereco("https://app.local/area");
    expect(captureEnteringFlag()).toBe(false);
    expect(reescritas).toEqual([]);
  });

  it("lê uma vez só, ainda que vários componentes perguntem", () => {
    const reescritas = comEndereco("https://app.local/area?entrando=1");
    expect(captureEnteringFlag()).toBe(true);
    expect(captureEnteringFlag()).toBe(true);
    expect(captureEnteringFlag()).toBe(true);
    // Este é o ponto: quem lê depois recebe o valor guardado, e não um `false`
    // porque o primeiro já limpou o endereço.
    expect(reescritas).toHaveLength(1);
  });
});

describe("consumeEnteringFlag", () => {
  it("devolve verdadeiro uma única vez por entrada", () => {
    comEndereco("https://app.local/area?entrando=1");
    expect(consumeEnteringFlag()).toBe(true);
    expect(consumeEnteringFlag()).toBe(false);
  });

  it("não gasta o sinal para quem só consulta", () => {
    comEndereco("https://app.local/area?entrando=1");
    expect(captureEnteringFlag()).toBe(true);
    expect(captureEnteringFlag()).toBe(true);
    // O esqueleto consulta; a recepção é quem gasta.
    expect(consumeEnteringFlag()).toBe(true);
  });

  it("é falso quando não houve login nesta navegação", () => {
    comEndereco("https://app.local/pesquisas");
    expect(consumeEnteringFlag()).toBe(false);
  });

  it("ignora valor diferente de 1", () => {
    comEndereco("https://app.local/area?entrando=sim");
    expect(consumeEnteringFlag()).toBe(false);
  });
});
