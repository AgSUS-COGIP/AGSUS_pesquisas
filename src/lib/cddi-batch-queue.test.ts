import { describe, expect, it } from "vitest";
import { parseCddiBatchQueue } from "./cddi-batch-queue";

describe("parseCddiBatchQueue", () => {
  it("devolve a fila gravada intacta", () => {
    const raw = JSON.stringify({ cycleCode: "CDDI-2026", personIds: ["a", "b", "c"] });
    expect(parseCddiBatchQueue(raw)).toEqual({ cycleCode: "CDDI-2026", personIds: ["a", "b", "c"] });
  });

  it("aceita fila sem ciclo, resolvendo para null", () => {
    const raw = JSON.stringify({ cycleCode: null, personIds: ["a"] });
    expect(parseCddiBatchQueue(raw)).toEqual({ cycleCode: null, personIds: ["a"] });
  });

  it("descarta entradas que não são identificadores", () => {
    // Storage é dado externo à execução atual: pode ter sido gravado por uma
    // versão anterior do código ou editado à mão. Só as strings sobrevivem.
    const raw = JSON.stringify({ cycleCode: "CDDI-2026", personIds: ["a", 7, null, "", "  ", "b"] });
    expect(parseCddiBatchQueue(raw)).toEqual({ cycleCode: "CDDI-2026", personIds: ["a", "b"] });
  });

  it("degrada para null quando nenhuma pessoa sobra na fila", () => {
    expect(parseCddiBatchQueue(JSON.stringify({ cycleCode: "CDDI-2026", personIds: [] }))).toBeNull();
    expect(parseCddiBatchQueue(JSON.stringify({ cycleCode: "CDDI-2026", personIds: [1, 2] }))).toBeNull();
  });

  it("degrada para null com valor ausente, JSON inválido ou formato inesperado", () => {
    expect(parseCddiBatchQueue(null)).toBeNull();
    expect(parseCddiBatchQueue("")).toBeNull();
    expect(parseCddiBatchQueue("{corrompido")).toBeNull();
    expect(parseCddiBatchQueue(JSON.stringify("uma string"))).toBeNull();
    expect(parseCddiBatchQueue(JSON.stringify({ outraCoisa: true }))).toBeNull();
  });

  it("resolve ciclo em branco para null em vez de propagar string vazia", () => {
    const raw = JSON.stringify({ cycleCode: "  ", personIds: ["a"] });
    expect(parseCddiBatchQueue(raw)).toEqual({ cycleCode: null, personIds: ["a"] });
  });
});
