import { describe, expect, it } from "vitest";
import { resolvePlatformGuard } from "./platform-guard";
import { PLATFORM_MODULE } from "./platform-modules";
import { PLATFORM_ROLE } from "./platform-roles";
import type { PlatformContext } from "./platform-context";

/*
 * A guarda decide o que a pessoa vê quando um módulo está em manutenção, e a
 * distinção que ela precisa acertar é sutil: "você não tem acesso" e "isto está
 * fora agora" levam a reações opostas — pedir permissão ou esperar.
 */

function contexto(papel: string, modulos: string[]): PlatformContext {
  return {
    status: "OK",
    person: {
      id: "p1",
      employeeNumber: "1",
      fullName: "Pessoa",
      institutionalEmail: "p@agenciasus.org.br",
      jobTitle: null,
      costCenter: null,
      workplace: null,
      metadata: {},
    },
    roles: [papel],
    modules: modulos,
  };
}

const TODOS = [
  PLATFORM_MODULE.HOME,
  PLATFORM_MODULE.SURVEYS,
  PLATFORM_MODULE.DASHBOARDS,
  PLATFORM_MODULE.ADMIN_ACCESS,
];

function decidir(papel: string, modulosEmManutencao?: string[]) {
  return resolvePlatformGuard({
    context: contexto(papel, TODOS),
    loading: false,
    error: "",
    requiredModule: PLATFORM_MODULE.DASHBOARDS,
    modulosEmManutencao: modulosEmManutencao as never,
  });
}

describe("guarda com módulo em manutenção", () => {
  it("libera quando não há manutenção", () => {
    expect(decidir(PLATFORM_ROLE.PARTICIPANT).state).toBe("granted");
  });

  it("bloqueia o usuário comum com estado próprio, não com acesso restrito", () => {
    const decisao = decidir(PLATFORM_ROLE.PARTICIPANT, [PLATFORM_MODULE.DASHBOARDS]);
    expect(decisao).toEqual({ state: "manutencao", modulo: PLATFORM_MODULE.DASHBOARDS });
  });

  it.each([PLATFORM_ROLE.ADMIN, PLATFORM_ROLE.MANAGER, PLATFORM_ROLE.EVALUATOR, PLATFORM_ROLE.PARTICIPANT])(
    "%s não tem bypass",
    (papel) => {
      expect(decidir(papel, [PLATFORM_MODULE.DASHBOARDS]).state).toBe("manutencao");
    },
  );

  it("ADMINISTRATOR entra, e recebe o aviso de modo administrativo", () => {
    const decisao = decidir(PLATFORM_ROLE.SUPER_ADMIN, [PLATFORM_MODULE.DASHBOARDS]);
    expect(decisao.state).toBe("granted");
    if (decisao.state !== "granted") throw new Error("estado inesperado");
    expect(decisao.avisoDeManutencao).toBe(
      "Este módulo está em manutenção. Você está acessando em modo administrativo.",
    );
  });

  it("sem manutenção, o Superadmin entra sem aviso nenhum", () => {
    const decisao = decidir(PLATFORM_ROLE.SUPER_ADMIN);
    if (decisao.state !== "granted") throw new Error("estado inesperado");
    expect(decisao.avisoDeManutencao).toBeNull();
  });

  // Manutenção não é permissão: `modules` precisa continuar exatamente como o
  // banco respondeu, para que retirar a manutenção devolva o acesso na hora.
  it("não altera os módulos da pessoa", () => {
    const decisao = decidir(PLATFORM_ROLE.SUPER_ADMIN, [PLATFORM_MODULE.DASHBOARDS]);
    if (decisao.state !== "granted") throw new Error("estado inesperado");
    expect(decisao.modules).toEqual(TODOS);
    expect(decisao.user.modules).toEqual(TODOS);
  });

  it("quem não tem o módulo continua vendo acesso restrito, e não manutenção", () => {
    const decisao = resolvePlatformGuard({
      context: contexto(PLATFORM_ROLE.PARTICIPANT, [PLATFORM_MODULE.HOME]),
      loading: false,
      error: "",
      requiredModule: PLATFORM_MODULE.DASHBOARDS,
      modulosEmManutencao: [PLATFORM_MODULE.DASHBOARDS],
    });
    expect(decisao.state).toBe("restricted");
  });

  // Leitura ainda não chegou. Bloquear aqui transformaria latência em módulo fora.
  it("não bloqueia enquanto a leitura do control plane não chegou", () => {
    const decisao = resolvePlatformGuard({
      context: contexto(PLATFORM_ROLE.PARTICIPANT, TODOS),
      loading: false,
      error: "",
      requiredModule: PLATFORM_MODULE.DASHBOARDS,
      modulosEmManutencao: undefined,
    });
    expect(decisao.state).toBe("granted");
  });

  it("manutenção de outro módulo não afeta esta rota", () => {
    expect(decidir(PLATFORM_ROLE.PARTICIPANT, [PLATFORM_MODULE.SURVEYS]).state).toBe("granted");
  });
});
