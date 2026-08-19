import { describe, expect, it } from "vitest";
import { normalizeOnlinePresenceState } from "./online-presence";

describe("normalizeOnlinePresenceState", () => {
  it("remove abas duplicadas da mesma pessoa e mantém a presença mais recente", () => {
    expect(normalizeOnlinePresenceState({
      pessoaA: [
        { personId: "a", fullName: "Ana", profileLabel: "Participante", onlineAt: "2026-08-19T10:00:00Z" },
        { personId: "a", fullName: "Ana Atualizada", profileLabel: "Participante", onlineAt: "2026-08-19T10:01:00Z" },
      ],
    })).toEqual([{
      personId: "a",
      fullName: "Ana Atualizada",
      avatarUrl: null,
      profileLabel: "Participante",
      onlineAt: "2026-08-19T10:01:00Z",
    }]);
  });

  it("descarta payload inválido e ordena as pessoas pelo nome", () => {
    expect(normalizeOnlinePresenceState({
      z: [{ personId: "z", fullName: "Zélia", avatarUrl: "https://example.com/z.png" }],
      invalido: [{ personId: "sem-nome" }, null],
      a: [{ personId: "a", fullName: "Álvaro" }],
    }).map((person) => person.fullName)).toEqual(["Álvaro", "Zélia"]);
  });

  it("devolve lista vazia para um estado inesperado", () => {
    expect(normalizeOnlinePresenceState(null)).toEqual([]);
    expect(normalizeOnlinePresenceState([])).toEqual([]);
  });
});
