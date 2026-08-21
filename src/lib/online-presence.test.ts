import { describe, expect, it } from "vitest";
import { normalizeOnlinePresenceList } from "./online-presence";

const linha = {
  personId: "11111111-1111-1111-1111-111111111111",
  fullName: "Maria da Silva",
  avatarUrl: "https://lh3.googleusercontent.com/foto",
  roleCode: "SURVEY_MANAGER",
  onlineAt: "2026-08-21T13:00:00.000Z",
};

describe("normalizeOnlinePresenceList", () => {
  it("traduz o código do perfil para o rótulo em português", () => {
    expect(normalizeOnlinePresenceList([linha])).toEqual([
      {
        personId: linha.personId,
        fullName: "Maria da Silva",
        avatarUrl: linha.avatarUrl,
        profileLabel: "Admin",
        onlineAt: linha.onlineAt,
      },
    ]);
  });

  it("perfil ausente cai no piso do modelo, que é Participante", () => {
    const [pessoa] = normalizeOnlinePresenceList([{ ...linha, roleCode: null }]);
    expect(pessoa.profileLabel).toBe("Participante");
  });

  it("código desconhecido aparece como veio, sem inventar rótulo", () => {
    // Traduzir para o piso esconderia dado inesperado no banco — é melhor a
    // interface mostrar algo estranho do que mentir sobre o perfil.
    const [pessoa] = normalizeOnlinePresenceList([{ ...linha, roleCode: "AUDITOR" }]);
    expect(pessoa.profileLabel).toBe("AUDITOR");
  });

  it("ordena por nome no padrão pt-BR", () => {
    const lista = normalizeOnlinePresenceList([
      { ...linha, personId: "a", fullName: "Ávila" },
      { ...linha, personId: "b", fullName: "Ana" },
      { ...linha, personId: "c", fullName: "Bruno" },
    ]);
    expect(lista.map((pessoa) => pessoa.fullName)).toEqual(["Ana", "Ávila", "Bruno"]);
  });

  it("descarta linha sem identificador ou sem nome", () => {
    expect(normalizeOnlinePresenceList([
      { ...linha, personId: null },
      { ...linha, fullName: "   " },
      linha,
    ])).toHaveLength(1);
  });

  it("mantém uma entrada por pessoa mesmo se o banco repetir", () => {
    expect(normalizeOnlinePresenceList([linha, linha])).toHaveLength(1);
  });

  it("degrada para lista vazia em qualquer entrada que não seja array", () => {
    for (const valor of [null, undefined, {}, "texto", 7, { pessoas: [linha] }]) {
      expect(normalizeOnlinePresenceList(valor)).toEqual([]);
    }
  });

  it("avatar ausente vira nulo, não string vazia", () => {
    const [pessoa] = normalizeOnlinePresenceList([{ ...linha, avatarUrl: "" }]);
    expect(pessoa.avatarUrl).toBeNull();
  });
});
