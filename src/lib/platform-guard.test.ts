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

/*
 * Os testes acima cobrem manutenção. O que segue cobre os outros quatro
 * desfechos de `PlatformGuardDecision` e a PRECEDÊNCIA entre eles, que é a
 * regra de produto de verdade: a mesma pessoa, no mesmo instante, pode se
 * encaixar em dois desfechos ao mesmo tempo (carregando e sem identidade; sem
 * permissão e em manutenção), e a ordem decide o que ela lê na tela.
 */

const TODOS_OS_MODULOS = Object.values(PLATFORM_MODULE);

type Modulo = (typeof TODOS_OS_MODULOS)[number];

function decidirPara(modulos: string[], exigido?: Modulo, manutencao?: Modulo[]) {
  return resolvePlatformGuard({
    context: contexto(modulos),
    loading: false,
    error: "",
    requiredModule: exigido,
    modulosEmManutencao: manutencao,
  });
}

describe("estado: carregando", () => {
  it("carregando vem antes de tudo, mesmo com contexto pronto", () => {
    // Sem esta precedência a tela pisca "acesso não identificado" no primeiro
    // quadro de cada navegação, quando ainda não houve resposta nenhuma.
    const decisao = resolvePlatformGuard({
      context: contexto(MODULOS_ADMIN),
      loading: true,
      error: "",
      requiredModule: PLATFORM_MODULE.DASHBOARDS,
    });
    expect(decisao).toEqual({ state: "loading" });
  });

  it("carregando vem antes do erro já registrado", () => {
    const decisao = resolvePlatformGuard({
      context: null,
      loading: true,
      error: "Falha ao carregar permissões da plataforma",
      requiredModule: PLATFORM_MODULE.DASHBOARDS,
    });
    expect(decisao).toEqual({ state: "loading" });
  });
});

describe("estado: sem identidade", () => {
  it("contexto ausente devolve a mensagem do erro real", () => {
    // A mensagem é o único fio que liga a tela à causa (banco fora, sessão
    // recusada). Trocá-la por texto fixo apagaria o diagnóstico.
    const decisao = resolvePlatformGuard({
      context: null,
      loading: false,
      error: "Falha ao carregar permissões da plataforma: tempo esgotado",
      requiredModule: PLATFORM_MODULE.DASHBOARDS,
    });
    expect(decisao).toEqual({
      state: "unidentified",
      message: "Falha ao carregar permissões da plataforma: tempo esgotado",
    });
  });

  it("sem contexto e sem erro cai no texto de reserva", () => {
    const decisao = resolvePlatformGuard({ context: null, loading: false, error: "" });
    expect(decisao).toEqual({ state: "unidentified", message: "Acesso não identificado." });
  });

  it("contexto sem pessoa é tão inválido quanto contexto ausente", () => {
    // `status: OK` sem `person` acontece de verdade: é a forma do UNLINKED
    // antes do provisionamento institucional.
    const decisao = resolvePlatformGuard({
      context: { status: "OK", modules: [PLATFORM_MODULE.HOME, PLATFORM_MODULE.ADMIN_ACCESS] },
      loading: false,
      error: "",
      requiredModule: PLATFORM_MODULE.HOME,
    });
    expect(decisao.state).toBe("unidentified");
  });

  it("falta de identidade vem antes de falta de permissão", () => {
    // Quem não tem cadastro não pode ler "acesso restrito": a frase sugere que
    // existe um perfil ao qual falta um módulo, e não existe perfil nenhum.
    const decisao = resolvePlatformGuard({
      context: null,
      loading: false,
      error: "",
      requiredModule: PLATFORM_MODULE.ADMIN_ACCESS,
      modulosEmManutencao: [PLATFORM_MODULE.ADMIN_ACCESS],
    });
    expect(decisao.state).toBe("unidentified");
  });
});

describe("estado: rota sem módulo exigido", () => {
  /*
    É o caso de `/perfil` e da moldura do CDDI: basta estar identificado. Sem
    cobertura, um `requiredModule` que chegasse `undefined` por acidente de
    tipagem abriria qualquer tela — e o teste que existe hoje não veria, porque
    todos passam um módulo.
  */
  it("basta ter cadastro, mesmo sem nenhuma permissão", () => {
    expect(decidirPara([]).state).toBe("granted");
  });

  it("nem manutenção fecha uma rota que não exige módulo", () => {
    const decisao = decidirPara(MODULOS_COMUNS, undefined, [PLATFORM_MODULE.DASHBOARDS]);
    expect(decisao.state).toBe("granted");
    if (decisao.state !== "granted") throw new Error("estado inesperado");
    expect(decisao.avisoDeManutencao).toBeNull();
  });
});

describe("estado: permissão por módulo, um a um", () => {
  /*
    Dez módulos, dois desfechos cada. A tabela existe porque a guarda é o único
    lugar que decide isso para TODAS as telas: um módulo tratado como especial
    (ou esquecido) não aparece em nenhum outro teste.
  */
  it.each(TODOS_OS_MODULOS)("%s é liberado para quem o possui", (modulo) => {
    expect(decidirPara([modulo], modulo).state).toBe("granted");
  });

  it.each(TODOS_OS_MODULOS)("%s é restrito para quem não o possui", (modulo) => {
    const outros = TODOS_OS_MODULOS.filter((item) => item !== modulo);
    expect(decidirPara(outros, modulo)).toEqual({ state: "restricted", requiredModule: modulo });
  });

  it("ter todos os módulos libera todos eles", () => {
    for (const modulo of TODOS_OS_MODULOS) {
      expect(decidirPara([...TODOS_OS_MODULOS], modulo).state).toBe("granted");
    }
  });

  /*
    ADMIN_ACCESS atravessa manutenção — mas só manutenção. Ele não é curinga de
    permissão: quem administra acessos e não tem ADMIN_IMPORT continua sem
    importar base. Confundir as duas coisas transformaria a administração de
    acessos em superusuário silencioso.
  */
  it("ADMIN_ACCESS não substitui os outros módulos", () => {
    const somenteAdmin: Modulo[] = [
      PLATFORM_MODULE.HOME,
      PLATFORM_MODULE.SURVEYS,
      PLATFORM_MODULE.ADMIN_ACCESS,
    ];
    for (const modulo of TODOS_OS_MODULOS.filter((item) => !somenteAdmin.includes(item))) {
      expect(decidirPara(somenteAdmin, modulo)).toEqual({
        state: "restricted",
        requiredModule: modulo,
      });
    }
  });

  it("ADMIN_ACCESS atravessa a manutenção de qualquer módulo que possua", () => {
    for (const modulo of TODOS_OS_MODULOS) {
      const decisao = decidirPara([modulo, PLATFORM_MODULE.ADMIN_ACCESS], modulo, [modulo]);
      expect(decisao.state).toBe("granted");
      if (decisao.state !== "granted") throw new Error("estado inesperado");
      expect(decisao.avisoDeManutencao).toContain("modo administrativo");
    }
  });
});

describe("a guarda não confia na lista que recebe", () => {
  it("código desconhecido não chega a decidir acesso", () => {
    // Um código que o bundle não conhece não pode virar permissão por
    // comparação de string. Aqui ele nem sobrevive à normalização.
    const decisao = decidirPara(["HOME", "ADMIN_TUDO", "SURVEYS"], PLATFORM_MODULE.HOME);
    expect(decisao.state).toBe("granted");
    if (decisao.state !== "granted") throw new Error("estado inesperado");
    expect(decisao.modules).toEqual([PLATFORM_MODULE.HOME, PLATFORM_MODULE.SURVEYS]);
  });

  it("repetição não duplica o menu", () => {
    const decisao = decidirPara(["HOME", "HOME", "SURVEYS"], PLATFORM_MODULE.HOME);
    if (decisao.state !== "granted") throw new Error("estado inesperado");
    expect(decisao.modules).toEqual([PLATFORM_MODULE.HOME, PLATFORM_MODULE.SURVEYS]);
  });

  it("lista ausente é ausência de permissão, não liberação", () => {
    const decisao = resolvePlatformGuard({
      context: { ...contexto([]), modules: undefined },
      loading: false,
      error: "",
      requiredModule: PLATFORM_MODULE.HOME,
    });
    expect(decisao).toEqual({ state: "restricted", requiredModule: PLATFORM_MODULE.HOME });
  });
});

describe("usuário entregue à casca", () => {
  it("carrega a identidade do contexto e a mesma lista de módulos", () => {
    const decisao = decidirPara(MODULOS_ADMIN, PLATFORM_MODULE.DASHBOARDS);
    if (decisao.state !== "granted") throw new Error("estado inesperado");
    expect(decisao.user).toEqual({
      id: "p1",
      fullName: "Pessoa",
      institutionalEmail: "p@agenciasus.org.br",
      employeeNumber: "1",
      // Não existe mais perfil nomeado no banco: todo mundo usa a mesma role
      // técnica, e o rótulo tem de dizer isso em vez de inventar um perfil.
      profileLabel: "Usuário autenticado",
      avatarUrl: undefined,
      modules: MODULOS_ADMIN,
    });
  });

  it("granted é o único desfecho que carrega pessoa", () => {
    // O tipo já impede a página de ler `person` fora de granted; este teste
    // impede que um desfecho negado passe a carregar dado por engano.
    const negados = [
      resolvePlatformGuard({ context: contexto(MODULOS_ADMIN), loading: true, error: "" }),
      resolvePlatformGuard({ context: null, loading: false, error: "" }),
      decidirPara([PLATFORM_MODULE.HOME], PLATFORM_MODULE.ADMIN_IMPORT),
      decidirPara(MODULOS_COMUNS, PLATFORM_MODULE.DASHBOARDS, [PLATFORM_MODULE.DASHBOARDS]),
    ];
    expect(negados.map((decisao) => decisao.state)).toEqual([
      "loading",
      "unidentified",
      "restricted",
      "manutencao",
    ]);
    for (const decisao of negados) {
      expect(decisao).not.toHaveProperty("person");
      expect(decisao).not.toHaveProperty("user");
    }
  });
});
