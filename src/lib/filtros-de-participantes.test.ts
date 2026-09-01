import { describe, expect, it } from "vitest";
import {
  FILTROS_VAZIOS,
  escreverFiltrosNaUrl,
  lerFiltrosDaUrl,
  paraPayloadDaRpc,
  temFiltroAtivo,
  type FiltrosDeParticipantes,
} from "./filtros-de-participantes";

/*
 * O que estes testes protegem.
 *
 * O recorte precisa sobreviver a ida e volta pela URL sem mudar de significado:
 * se ler e escrever não forem inversos, o link que alguém compartilha mostra
 * outra lista. E chave desconhecida precisa ser descartada, não repassada — foi
 * exatamente assim que a regra de público, um dia, selecionou a instituição
 * inteira a partir de `{"foo":["bar"]}`.
 */

function filtros(parcial: Partial<FiltrosDeParticipantes>): FiltrosDeParticipantes {
  return { ...FILTROS_VAZIOS, ...parcial };
}

describe("lerFiltrosDaUrl", () => {
  it("lê dimensões repetidas", () => {
    const lidos = lerFiltrosDaUrl(new URLSearchParams("unit=A&unit=B&jobTitle=Assessor"));

    expect(lidos.unit).toEqual(["A", "B"]);
    expect(lidos.jobTitle).toEqual(["Assessor"]);
  });

  it("descarta chave que não é dimensão conhecida", () => {
    const lidos = lerFiltrosDaUrl(new URLSearchParams("foo=bar&unit=A&drop%20table=x"));

    expect(paraPayloadDaRpc(lidos)).toEqual({ unit: ["A"] });
  });

  it("descarta situação fora do catálogo", () => {
    const lidos = lerFiltrosDaUrl(new URLSearchParams("situacao=COMPLETED&situacao=INVENTADA"));

    expect(lidos.situacao).toEqual(["COMPLETED"]);
  });

  it("remove vazio, espaço e repetição", () => {
    const lidos = lerFiltrosDaUrl(new URLSearchParams("unit=A&unit=&unit=%20%20&unit=A&unit=B"));

    expect(lidos.unit).toEqual(["A", "B"]);
  });

  it("apara a busca e trata ausência como vazio", () => {
    expect(lerFiltrosDaUrl(new URLSearchParams("busca=%20%20ana%20%20")).busca).toBe("ana");
    expect(lerFiltrosDaUrl(new URLSearchParams("")).busca).toBe("");
    expect(lerFiltrosDaUrl(new URLSearchParams("busca=%20%20")).busca).toBe("");
  });

  it("query string vazia devolve o conjunto vazio", () => {
    expect(lerFiltrosDaUrl(new URLSearchParams(""))).toEqual(FILTROS_VAZIOS);
  });
});

describe("escreverFiltrosNaUrl", () => {
  it("omite dimensão vazia", () => {
    expect(escreverFiltrosNaUrl(filtros({ unit: ["A"] })).toString()).toBe("unit=A");
  });

  it("omite busca em branco", () => {
    expect(escreverFiltrosNaUrl(filtros({ busca: "   " })).toString()).toBe("");
  });

  it("é o inverso da leitura", () => {
    // Sem isso, o link compartilhado mostra outra lista.
    const original = filtros({
      unit: ["Escritorio A", "Escritório B"],
      jobTitle: ["Assessor"],
      situacao: ["ELIGIBLE", "IN_PROGRESS"],
      busca: "ana",
    });

    expect(lerFiltrosDaUrl(escreverFiltrosNaUrl(original))).toEqual(original);
  });

  it("preserva valor com acento, vírgula e espaço", () => {
    // Uma unidade chamada "Coordenação, Geral" precisa voltar inteira. Enquanto
    // a leitura dividia por vírgula, ela voltava partida em duas e o filtro
    // procurava dois valores inexistentes, devolvendo lista vazia sem explicar.
    const original = filtros({ unit: ["Coordenação, Geral"], jobTitle: ["Analista de Gestão"] });

    expect(lerFiltrosDaUrl(new URLSearchParams(escreverFiltrosNaUrl(original).toString()))).toEqual(original);
  });
});

describe("paraPayloadDaRpc", () => {
  it("envia só o que está preenchido", () => {
    const payload = paraPayloadDaRpc(filtros({ unit: ["A"], situacao: ["COMPLETED"] }));

    expect(payload).toEqual({ unit: ["A"], situacao: ["COMPLETED"] });
    expect(payload).not.toHaveProperty("jobTitle");
    expect(payload).not.toHaveProperty("busca");
  });

  it("conjunto vazio vira payload vazio", () => {
    expect(paraPayloadDaRpc(FILTROS_VAZIOS)).toEqual({});
  });
});

describe("temFiltroAtivo", () => {
  it("distingue recorte de ausência de recorte", () => {
    expect(temFiltroAtivo(FILTROS_VAZIOS)).toBe(false);
    expect(temFiltroAtivo(filtros({ busca: "   " }))).toBe(false);
    expect(temFiltroAtivo(filtros({ unit: ["A"] }))).toBe(true);
    expect(temFiltroAtivo(filtros({ busca: "ana" }))).toBe(true);
  });
});
