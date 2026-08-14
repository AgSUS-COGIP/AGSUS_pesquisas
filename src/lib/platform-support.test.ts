import { describe, expect, it } from "vitest";
import { ADMIN_ROLE_MODULES } from "./platform-modules";
import {
  isSuperAdminOnlyRoute,
  PLATFORM_SUPPORT_EMAIL,
  SUPER_ADMIN_ONLY_MODULES,
  supportMailtoHref,
} from "./platform-support";

describe("supportMailtoHref", () => {
  it("aponta para o canal institucional com assunto preenchido", () => {
    expect(supportMailtoHref()).toBe(
      `mailto:${PLATFORM_SUPPORT_EMAIL}?subject=${encodeURIComponent("Suporte — AgSUS Avaliações")}`,
    );
  });

  it("codifica assunto personalizado", () => {
    expect(supportMailtoHref("Dúvida & acesso")).toBe(
      `mailto:${PLATFORM_SUPPORT_EMAIL}?subject=D%C3%BAvida%20%26%20acesso`,
    );
  });
});

describe("SUPER_ADMIN_ONLY_MODULES", () => {
  it("contém exatamente os módulos que o Admin não recebe", () => {
    const adminModules = new Set<string>(ADMIN_ROLE_MODULES);
    for (const moduleName of SUPER_ADMIN_ONLY_MODULES) {
      expect(adminModules.has(moduleName)).toBe(false);
    }
  });
});

describe("isSuperAdminOnlyRoute", () => {
  it("reconhece as rotas de administração global e suas subrotas", () => {
    expect(isSuperAdminOnlyRoute("/admin/equipes")).toBe(true);
    expect(isSuperAdminOnlyRoute("/admin/acessos")).toBe(true);
    expect(isSuperAdminOnlyRoute("/admin/configuracoes")).toBe(true);
    expect(isSuperAdminOnlyRoute("/admin/equipes/123")).toBe(true);
  });

  it("não reconhece a rota de importação, que deixou de existir", () => {
    expect(isSuperAdminOnlyRoute("/admin/importacao")).toBe(false);
  });

  it("não casa com prefixo parcial nem com as demais rotas", () => {
    expect(isSuperAdminOnlyRoute("/admin/equipes-antigas")).toBe(false);
    expect(isSuperAdminOnlyRoute("/admin")).toBe(false);
    expect(isSuperAdminOnlyRoute("/admin/pesquisas")).toBe(false);
    expect(isSuperAdminOnlyRoute("/admin/participantes")).toBe(false);
    expect(isSuperAdminOnlyRoute("/pesquisas")).toBe(false);
    expect(isSuperAdminOnlyRoute("/area")).toBe(false);
  });
});
