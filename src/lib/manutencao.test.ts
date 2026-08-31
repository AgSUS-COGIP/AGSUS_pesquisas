import { describe, expect, it } from "vitest";
import {
  MANUTENCAO_INATIVA,
  ehRotaSempreLiberada,
  moduleForPathname,
  normalizarEstadoDeManutencao,
  normalizarModulosDeManutencao,
  resolverEstadoOperacional,
  rotuloDoModulo,
  validarModulosDeManutencao,
  type EstadoDeManutencao,
} from "./manutencao";
import { PLATFORM_MODULE } from "./platform-modules";
import { PLATFORM_ROLE } from "./platform-roles";
import type { Prontidao } from "./readiness";

/*
 * A manutenção operacional decide quem entra na plataforma, e a ordem em que
 * seus estados se sobrepõem é regra de produto — invisível para `typecheck` e
 * para `build`. Trocar a precedência de dois `if` aqui tranca a plataforma
 * inteira ou libera quem deveria estar bloqueado, e nos dois casos o sinal só
 * apareceria em produção.
 */

const PRONTA: Prontidao = { estado: "pronta" };
const SEM_CONFIG: Prontidao = { estado: "configuracao-ausente", detalhe: "SMTP_APP_PASSWORD" };
const BACKEND_FORA: Prontidao = { estado: "backend-inacessivel", detalhe: "fetch failed" };
const ESQUEMA_ATRASADO: Prontidao = { estado: "esquema-incompativel", detalhe: "PGRST202" };

const GLOBAL: EstadoDeManutencao = { ...MANUTENCAO_INATIVA, global: true };
const SO_PAINEIS: EstadoDeManutencao = { ...MANUTENCAO_INATIVA, modules: [PLATFORM_MODULE.DASHBOARDS] };

function situacao(
  prontidao: Prontidao,
  manutencao: EstadoDeManutencao | null,
  pathname: string,
  papel: string | null,
) {
  return resolverEstadoOperacional({
    prontidao,
    manutencao,
    pathname,
    papel: papel as never,
  }).situacao;
}

describe("validação de módulos", () => {
  it("aceita apenas códigos do catálogo institucional", () => {
    expect(normalizarModulosDeManutencao(["DASHBOARDS", "SURVEYS"])).toEqual(["SURVEYS", "DASHBOARDS"]);
  });

  it("descarta módulo desconhecido, duplicado e valor que não é texto", () => {
    expect(normalizarModulosDeManutencao(["DASHBOARDS", "INVENTADO", 42, "DASHBOARDS", null])).toEqual([
      "DASHBOARDS",
    ]);
  });

  it("devolve lista vazia quando a entrada não é uma lista", () => {
    expect(normalizarModulosDeManutencao("DASHBOARDS")).toEqual([]);
    expect(normalizarModulosDeManutencao(undefined)).toEqual([]);
  });

  // Na escrita o valor acabou de ser digitado por quem opera: engolir o
  // desconhecido esconderia um engano. Por isso a API recusa em vez de filtrar.
  it("separa o que recusar, para a API poder dizer o que não aceitou", () => {
    const { validos, invalidos } = validarModulosDeManutencao(["DASHBOARDS", "PAINEIS", "TEAM"]);
    // A ordem é a canônica de `PLATFORM_MODULES`, não a da entrada: assim o
    // que o control plane guarda não depende da ordem em que foi clicado.
    expect(validos).toEqual(["DASHBOARDS", "TEAM"]);
    expect(invalidos).toEqual(["PAINEIS"]);
  });

  it("não confia em nada que venha do control plane", () => {
    expect(normalizarEstadoDeManutencao(null)).toEqual(MANUTENCAO_INATIVA);
    expect(normalizarEstadoDeManutencao("manutencao")).toEqual(MANUTENCAO_INATIVA);
    expect(normalizarEstadoDeManutencao({ global: "sim", modules: "tudo" })).toEqual({
      ...MANUTENCAO_INATIVA,
      global: false,
      modules: [],
    });
    expect(normalizarEstadoDeManutencao({ global: true, modules: ["DASHBOARDS", "X"] })).toMatchObject({
      global: true,
      modules: ["DASHBOARDS"],
    });
  });
});

describe("pathname → módulo", () => {
  it.each([
    ["/area", PLATFORM_MODULE.HOME],
    ["/pesquisas", PLATFORM_MODULE.SURVEYS],
    ["/pesquisas/CLIMA-2027", PLATFORM_MODULE.SURVEYS],
    ["/paineis", PLATFORM_MODULE.DASHBOARDS],
    ["/paineis/cddi", PLATFORM_MODULE.DASHBOARDS],
    ["/equipe", PLATFORM_MODULE.TEAM],
    ["/admin/pesquisas", PLATFORM_MODULE.ADMIN_SURVEYS],
    ["/admin/pesquisas/abc/operacao", PLATFORM_MODULE.ADMIN_SURVEYS],
    ["/admin/emails", PLATFORM_MODULE.ADMIN_SURVEYS],
    ["/admin/participantes", PLATFORM_MODULE.ADMIN_PARTICIPANTS],
    ["/admin/equipes", PLATFORM_MODULE.ADMIN_TEAMS],
    ["/admin/respostas", PLATFORM_MODULE.ADMIN_TEAMS],
    ["/admin/configuracoes", PLATFORM_MODULE.ADMIN_ACCESS],
  ])("%s resolve para %s", (pathname, esperado) => {
    expect(moduleForPathname(pathname)).toBe(esperado);
  });

  // `/admin/participantes` não pode cair em `/admin/pesquisas` por ser prefixo
  // parcial de nada: o casamento é por segmento, e o mais específico vence.
  it("prefere o item mais específico", () => {
    expect(moduleForPathname("/admin/participantes/todos")).toBe(PLATFORM_MODULE.ADMIN_PARTICIPANTS);
  });

  it("devolve null para rota sem módulo — ela não é bloqueável por módulo", () => {
    expect(moduleForPathname("/perfil")).toBeNull();
    expect(moduleForPathname("/responder/ABC")).toBeNull();
    expect(moduleForPathname("/acesso")).toBeNull();
  });

  it("usa o rótulo institucional do menu, sem redigitar nome", () => {
    expect(rotuloDoModulo(PLATFORM_MODULE.DASHBOARDS)).toBe("Painéis");
    expect(rotuloDoModulo(PLATFORM_MODULE.ADMIN_PARTICIPANTS)).toBe("Participantes");
  });
});

describe("rotas que a manutenção nunca derruba", () => {
  it.each([
    "/acesso",
    "/api/health",
    "/api/health/readiness",
    "/api/plataforma/manutencao",
    "/admin/configuracoes",
    "/auth/confirm",
    "/_next/static/chunk.js",
    "/logo.png",
  ])("%s continua acessível", (pathname) => {
    expect(ehRotaSempreLiberada(pathname)).toBe(true);
  });

  it.each(["/area", "/paineis", "/admin/pesquisas", "/equipe"])("%s é bloqueável", (pathname) => {
    expect(ehRotaSempreLiberada(pathname)).toBe(false);
  });

  // Sem isto a manutenção global fecharia a porta por onde se sai dela.
  it("mantém a tela institucional de pé mesmo com o backend fora", () => {
    expect(situacao(BACKEND_FORA, GLOBAL, "/acesso", null)).toBe("liberado");
  });
});

describe("manutenção global", () => {
  it("bloqueia usuário comum", () => {
    expect(situacao(PRONTA, GLOBAL, "/paineis", PLATFORM_ROLE.PARTICIPANT)).toBe("manutencao-global");
  });

  it.each([PLATFORM_ROLE.ADMIN, PLATFORM_ROLE.MANAGER, PLATFORM_ROLE.EVALUATOR, PLATFORM_ROLE.PARTICIPANT])(
    "não dá desvio para %s",
    (papel) => {
      expect(situacao(PRONTA, GLOBAL, "/paineis", papel)).toBe("manutencao-global");
    },
  );

  it("deixa o Superadmin entrar, em modo administrativo", () => {
    expect(situacao(PRONTA, GLOBAL, "/paineis", PLATFORM_ROLE.SUPER_ADMIN)).toBe("administrativo");
  });
});

describe("manutenção por módulo", () => {
  it("bloqueia o módulo marcado", () => {
    expect(situacao(PRONTA, SO_PAINEIS, "/paineis", PLATFORM_ROLE.PARTICIPANT)).toBe("manutencao-de-modulo");
  });

  it.each(["/area", "/pesquisas", "/equipe", "/admin/pesquisas"])(
    "%s continua funcionando com DASHBOARDS em manutenção",
    (pathname) => {
      expect(situacao(PRONTA, SO_PAINEIS, pathname, PLATFORM_ROLE.PARTICIPANT)).toBe("liberado");
    },
  );

  it("informa qual módulo, para a tela poder nomeá-lo", () => {
    const estado = resolverEstadoOperacional({
      prontidao: PRONTA,
      manutencao: SO_PAINEIS,
      pathname: "/paineis",
      papel: PLATFORM_ROLE.PARTICIPANT,
    });
    expect(estado).toEqual({ situacao: "manutencao-de-modulo", modulo: PLATFORM_MODULE.DASHBOARDS });
  });

  it("dá desvio ao Superadmin para ele conferir a correção antes de liberar", () => {
    expect(situacao(PRONTA, SO_PAINEIS, "/paineis", PLATFORM_ROLE.SUPER_ADMIN)).toBe("administrativo");
  });

  it.each([PLATFORM_ROLE.ADMIN, PLATFORM_ROLE.MANAGER, PLATFORM_ROLE.EVALUATOR, PLATFORM_ROLE.PARTICIPANT])(
    "%s não tem desvio",
    (papel) => {
      expect(situacao(PRONTA, SO_PAINEIS, "/paineis", papel)).toBe("manutencao-de-modulo");
    },
  );

  /*
    Marcar `ADMIN_ACCESS` em manutenção trancaria a própria tela onde a
    manutenção é desligada. Duas defesas independentes cobrem isso: a rota está
    entre as sempre liberadas, e o Superadmin tem desvio.
  */
  it("não tranca o Superadmin fora de Configurações", () => {
    const travaAcesso: EstadoDeManutencao = {
      ...MANUTENCAO_INATIVA,
      modules: [PLATFORM_MODULE.ADMIN_ACCESS],
    };
    expect(situacao(PRONTA, travaAcesso, "/admin/configuracoes", PLATFORM_ROLE.SUPER_ADMIN)).toBe("liberado");
    expect(situacao(PRONTA, travaAcesso, "/api/plataforma/manutencao", PLATFORM_ROLE.SUPER_ADMIN)).toBe(
      "liberado",
    );
  });
});

describe("precedência", () => {
  it("queda de backend vence manutenção planejada — incidente não se disfarça de decisão", () => {
    expect(situacao(BACKEND_FORA, GLOBAL, "/paineis", PLATFORM_ROLE.PARTICIPANT)).toBe("indisponivel");
    expect(situacao(ESQUEMA_ATRASADO, SO_PAINEIS, "/paineis", PLATFORM_ROLE.PARTICIPANT)).toBe("indisponivel");
  });

  it("queda de backend também alcança o Superadmin", () => {
    expect(situacao(BACKEND_FORA, MANUTENCAO_INATIVA, "/paineis", PLATFORM_ROLE.SUPER_ADMIN)).toBe(
      "indisponivel",
    );
  });

  // Faltar SMTP degrada o ambiente sem impedir ninguém de entrar. Fechar o
  // login por isso trocaria uma falha de envio por uma queda total.
  it("configuração ausente não é queda", () => {
    expect(situacao(SEM_CONFIG, MANUTENCAO_INATIVA, "/paineis", PLATFORM_ROLE.PARTICIPANT)).toBe("liberado");
  });

  it("manutenção global vence a de módulo — parar tudo já inclui a parte", () => {
    const ambas: EstadoDeManutencao = { ...GLOBAL, modules: [PLATFORM_MODULE.DASHBOARDS] };
    expect(situacao(PRONTA, ambas, "/paineis", PLATFORM_ROLE.PARTICIPANT)).toBe("manutencao-global");
  });
});

describe("control plane indisponível", () => {
  it("não derruba a plataforma quando a prontidão está saudável", () => {
    expect(situacao(PRONTA, null, "/paineis", PLATFORM_ROLE.PARTICIPANT)).toBe("liberado");
    expect(situacao(PRONTA, null, "/admin/pesquisas", PLATFORM_ROLE.ADMIN)).toBe("liberado");
  });

  it("não impede que a queda de backend continue fechando", () => {
    expect(situacao(BACKEND_FORA, null, "/paineis", PLATFORM_ROLE.PARTICIPANT)).toBe("indisponivel");
  });
});
