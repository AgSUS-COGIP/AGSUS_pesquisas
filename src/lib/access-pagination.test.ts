import { describe, expect, it } from "vitest";
import {
  ACCESS_PAGE_SIZE,
  accessPageRange,
  nextAccessOffset,
  parseAccessPagination,
  previousAccessOffset,
} from "./access-pagination";

describe("parseAccessPagination", () => {
  it("usa a primeira página como padrão", () => {
    expect(parseAccessPagination(new URLSearchParams())).toEqual({
      search: "",
      limit: ACCESS_PAGE_SIZE,
      offset: 0,
    });
  });

  it("normaliza busca, limite e offset", () => {
    expect(parseAccessPagination(new URLSearchParams("busca=%20Ana%20&limite=25&offset=50"))).toEqual({
      search: "Ana",
      limit: 25,
      offset: 50,
    });
  });

  it("recusa números inválidos e limita o tamanho máximo", () => {
    expect(parseAccessPagination(new URLSearchParams("limite=999&offset=-2"))).toEqual({
      search: "",
      limit: ACCESS_PAGE_SIZE,
      offset: 0,
    });
  });
});

describe("navegação da matriz de acessos", () => {
  it("calcula os deslocamentos anterior e seguinte", () => {
    expect(previousAccessOffset(100, 100)).toBe(0);
    expect(previousAccessOffset(20, 100)).toBe(0);
    expect(nextAccessOffset(100, 100)).toBe(200);
  });

  it("apresenta a faixa real da página", () => {
    expect(accessPageRange(100, 100, 1_030)).toBe("101–200 de 1030 pessoas");
    expect(accessPageRange(1_000, 30, 1_030)).toBe("1001–1030 de 1030 pessoas");
    expect(accessPageRange(0, 0, 0)).toBe("0 pessoas");
  });
});
