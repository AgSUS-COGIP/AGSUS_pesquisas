import { describe, expect, it } from "vitest";
import { resolvePlatformGuard } from "./platform-guard";
import { PLATFORM_MODULE } from "./platform-modules";
import type { PlatformContext } from "./platform-context";

function contexto(modulos: string[]): PlatformContext {
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
    technicalRole: "authenticated",
    roles: ["AUTHENTICATED"],
    modules: modulos,
  };
}

const MODULOS_COMUNS = [
  PLATFORM_MODULE.HOME,
  PLATFORM_MODULE.SURVEYS,
  PLATFORM_MODULE.DASHBOARDS,
];
const MODULOS_ADMIN = [...MODULOS_COMUNS, PLATFORM_MODULE.ADMIN_ACCESS];

function decidir(modulos: string[], modulosEmManutencao?: string[]) {
  return resolvePlatformGuard({
    context: contexto(modulos),
    loading: false,
    error: "",
    requiredModule: PLATFORM_MODULE.DASHBOARDS,
    modulosEmManutencao: modulosEmManutencao as never,
  });
}

describe("guarda com módulo em manutenção", () => {
  it("libera quando não há manutenção", () => {
    expect(decidir(MODULOS_COMUNS).state).toBe("granted");
  });

  it("bloqueia quem não possui ADMIN_ACCESS", () => {
    expect(decidir(MODULOS_COMUNS, [PLATFORM_MODULE.DASHBOARDS])).toEqual({
      state: "manutencao",
      modulo: PLATFORM_MODULE.DASHBOARDS,
    });
  });

  it("ADMIN_ACCESS entra em modo administrativo", () => {
    const decisao = decidir(MODULOS_ADMIN, [PLATFORM_MODULE.DASHBOARDS]);
    expect(decisao.state).toBe("granted");
    if (decisao.state !== "granted") throw new Error("estado inesperado");
    expect(decisao.avisoDeManutencao).toContain("modo administrativo");
  });

  /*
    O aviso é consequência da manutenção, não do perfil. Sem esta asserção, um
    `avisoDeManutencao` preso em texto fixo passaria despercebido: quem
    administra veria "modo administrativo" o tempo todo, e a frase deixaria de
    significar qualquer coisa justamente quando importasse.
  */
  it("sem manutenção, ADMIN_ACCESS entra sem aviso nenhum", () => {
    const decisao = decidir(MODULOS_ADMIN, []);
    expect(decisao.state).toBe("granted");
    if (decisao.state !== "granted") throw new Error("estado inesperado");
    expect(decisao.avisoDeManutencao).toBeNull();
  });

  it("não altera os módulos da pessoa", () => {
    const decisao = decidir(MODULOS_ADMIN, [PLATFORM_MODULE.DASHBOARDS]);
    if (decisao.state !== "granted") throw new Error("estado inesperado");
    expect(decisao.modules).toEqual(MODULOS_ADMIN);
    expect(decisao.user.modules).toEqual(MODULOS_ADMIN);
  });

  it("sem permissão continua mostrando acesso restrito", () => {
    const decisao = resolvePlatformGuard({
      context: contexto([PLATFORM_MODULE.HOME]),
      loading: false,
      error: "",
      requiredModule: PLATFORM_MODULE.DASHBOARDS,
      modulosEmManutencao: [PLATFORM_MODULE.DASHBOARDS],
    });
    expect(decisao.state).toBe("restricted");
  });

  it("não bloqueia enquanto o control plane não respondeu", () => {
    expect(decidir(MODULOS_COMUNS, undefined).state).toBe("granted");
  });

  it("manutenção de outro módulo não afeta a rota", () => {
    expect(decidir(MODULOS_COMUNS, [PLATFORM_MODULE.SURVEYS]).state).toBe("granted");
  });
});
