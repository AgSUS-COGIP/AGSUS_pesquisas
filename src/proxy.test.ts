import { describe, expect, it } from "vitest";
import {
  deveBloquearManutencaoGlobal,
  interpretarDesvioAdministrativo,
} from "./lib/manutencao-proxy";

describe("proxy de manutenção global", () => {
  it("bloqueia quem não administra a plataforma quando a manutenção global está ativa", () => {
    expect(deveBloquearManutencaoGlobal(true, false)).toBe(true);
  });

  it("não bloqueia quem administra a plataforma quando a manutenção global está ativa", () => {
    expect(deveBloquearManutencaoGlobal(true, true)).toBe(false);
  });

  it("não bloqueia ninguém quando a manutenção global está desativada", () => {
    expect(deveBloquearManutencaoGlobal(false, false)).toBe(false);
    expect(deveBloquearManutencaoGlobal(false, true)).toBe(false);
  });
});

describe("leitura do desvio administrativo", () => {
  it("concede quando a rota afirma o desvio", () => {
    expect(interpretarDesvioAdministrativo(200, { desvio: true })).toBe(true);
  });

  it("recusa quando a rota nega o desvio", () => {
    expect(interpretarDesvioAdministrativo(200, { desvio: false })).toBe(false);
  });

  /*
    Os casos abaixo são o motivo de a função existir separada do `fetch`. Cada
    um deles é uma forma diferente de "não deu para conferir", e todas precisam
    terminar no mesmo lugar — senão a manutenção global vira uma porta que abre
    sozinha quando algo quebra.
  */
  it("recusa quando a sessão não está autenticada", () => {
    expect(interpretarDesvioAdministrativo(401, { mensagem: "Sua sessão expirou." })).toBe(false);
  });

  it("recusa quando a rota respondeu erro, mesmo afirmando o desvio no corpo", () => {
    expect(interpretarDesvioAdministrativo(503, { desvio: true })).toBe(false);
  });

  it("recusa quando o corpo não pôde ser lido", () => {
    expect(interpretarDesvioAdministrativo(200, null)).toBe(false);
  });

  it("recusa quando o campo está ausente", () => {
    expect(interpretarDesvioAdministrativo(200, {})).toBe(false);
  });

  it("recusa valor apenas truthy, sem coerção de tipo", () => {
    expect(interpretarDesvioAdministrativo(200, { desvio: "true" })).toBe(false);
    expect(interpretarDesvioAdministrativo(200, { desvio: 1 })).toBe(false);
    expect(interpretarDesvioAdministrativo(200, { desvio: {} })).toBe(false);
  });

  it("recusa corpo que não é objeto", () => {
    expect(interpretarDesvioAdministrativo(200, "desvio")).toBe(false);
    expect(interpretarDesvioAdministrativo(200, true)).toBe(false);
  });
});
