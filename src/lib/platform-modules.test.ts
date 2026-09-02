import { describe, expect, it } from "vitest";
import {
  BASE_PLATFORM_MODULES,
  isPlatformModule,
  normalizePlatformModules,
  PLATFORM_MODULE,
  PLATFORM_MODULES,
} from "./platform-modules";

/*
 * Este arquivo é o degrau mais baixo da autorização de interface: tudo o que a
 * guarda decide parte de `normalizePlatformModules`, que recebe uma lista vinda
 * do banco por JSON — ou seja, texto arbitrário do ponto de vista do bundle.
 *
 * O que se prova aqui não é que a função "funciona", e sim que ela é a única
 * fronteira entre o catálogo do banco e o do frontend: código que este bundle
 * não conhece precisa ser DESCARTADO, não repassado. Um código repassado sem
 * validação chegaria a `modules.includes(requiredModule)` e a comparação de
 * strings decidiria acesso sozinha.
 */

describe("isPlatformModule", () => {
  it.each(PLATFORM_MODULES)("reconhece %s", (modulo) => {
    expect(isPlatformModule(modulo)).toBe(true);
  });

  it("recusa código fora do catálogo", () => {
    expect(isPlatformModule("ADMIN_TUDO")).toBe(false);
    expect(isPlatformModule("VOAR")).toBe(false);
    expect(isPlatformModule("")).toBe(false);
  });

  /*
    O banco normaliza para maiúscula em `FC_TEM_MODULO` e em
    `FC_DEFINIR_PERMISSOES_PESSOA` (ambas fazem `upper(btrim(...))`), mas o
    frontend NÃO normaliza. A assimetria é deliberada e precisa ficar registrada:
    se algum dia o contexto passar a devolver "home" em minúscula, o módulo é
    descartado silenciosamente e a pessoa perde a tela — e é melhor descobrir
    isso por um teste vermelho aqui do que por um "acesso restrito" em produção.
  */
  it("é sensível à caixa — o catálogo do banco é maiúsculo", () => {
    expect(isPlatformModule("home")).toBe(false);
    expect(isPlatformModule("Home")).toBe(false);
    expect(isPlatformModule(PLATFORM_MODULE.HOME)).toBe(true);
  });

  it("recusa o que não é string", () => {
    expect(isPlatformModule(null)).toBe(false);
    expect(isPlatformModule(undefined)).toBe(false);
    expect(isPlatformModule(1)).toBe(false);
    expect(isPlatformModule(["HOME"])).toBe(false);
    expect(isPlatformModule({ code: "HOME" })).toBe(false);
  });
});

describe("normalizePlatformModules", () => {
  it("preserva a ordem em que o banco respondeu", () => {
    // A ordem vem de `NU_ORDEM` no catálogo e é o que monta o menu lateral.
    // Ordenar aqui de novo seria uma segunda fonte de verdade sobre o menu.
    const doBanco = [
      PLATFORM_MODULE.SURVEYS,
      PLATFORM_MODULE.HOME,
      PLATFORM_MODULE.ADMIN_ACCESS,
    ];
    expect(normalizePlatformModules(doBanco)).toEqual(doBanco);
  });

  it("descarta código que este bundle não conhece", () => {
    expect(normalizePlatformModules(["HOME", "ADMIN_TUDO", "SURVEYS"])).toEqual([
      PLATFORM_MODULE.HOME,
      PLATFORM_MODULE.SURVEYS,
    ]);
  });

  it("elimina repetição mantendo a primeira ocorrência", () => {
    expect(normalizePlatformModules(["SURVEYS", "HOME", "SURVEYS"])).toEqual([
      PLATFORM_MODULE.SURVEYS,
      PLATFORM_MODULE.HOME,
    ]);
  });

  it("ausência de lista é lista vazia, não erro", () => {
    // `context.modules` é opcional no contrato: uma resposta sem o campo não
    // pode derrubar a guarda, tem de virar "nenhuma permissão".
    expect(normalizePlatformModules(undefined)).toEqual([]);
    expect(normalizePlatformModules(null)).toEqual([]);
    expect(normalizePlatformModules([])).toEqual([]);
  });

  it("lista inteiramente desconhecida não vira permissão nenhuma", () => {
    expect(normalizePlatformModules(["A", "B", "home", ""])).toEqual([]);
  });

  it("não devolve o array recebido, para ninguém mutar o contexto por acidente", () => {
    const entrada = [PLATFORM_MODULE.HOME];
    expect(normalizePlatformModules(entrada)).not.toBe(entrada);
  });
});

describe("piso institucional", () => {
  /*
    Estes dois códigos estão escritos à mão dentro de `FC_MODULOS_EFETIVOS`
    (`pm."CO_MODULO" in ('HOME', 'SURVEYS')`) e repetidos em
    `FC_DEFINIR_PERMISSOES_PESSOA`. A constante do frontend é a terceira cópia.
    Divergir das outras duas não dá erro em lugar nenhum — só faz a interface
    prometer um piso diferente do que o banco entrega.
  */
  it("é exatamente HOME e SURVEYS", () => {
    expect([...BASE_PLATFORM_MODULES]).toEqual([
      PLATFORM_MODULE.HOME,
      PLATFORM_MODULE.SURVEYS,
    ]);
  });

  it("o piso é feito de módulos do catálogo", () => {
    for (const modulo of BASE_PLATFORM_MODULES) {
      expect(isPlatformModule(modulo)).toBe(true);
    }
  });
});

describe("catálogo", () => {
  it("PLATFORM_MODULES espelha PLATFORM_MODULE sem sobra nem falta", () => {
    expect([...PLATFORM_MODULES]).toEqual(Object.values(PLATFORM_MODULE));
  });

  it("cada chave é igual ao seu código", () => {
    // O código é o que viaja para o banco; a chave é o que o TypeScript vê.
    // Deixá-las divergir cria um módulo que existe no tipo e não no catálogo.
    for (const [chave, codigo] of Object.entries(PLATFORM_MODULE)) {
      expect(codigo).toBe(chave);
    }
  });

  it("não há código repetido", () => {
    expect(new Set(PLATFORM_MODULES).size).toBe(PLATFORM_MODULES.length);
  });
});
