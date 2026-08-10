import { describe, expect, it } from "vitest";
import { resolvePlatformGuard } from "./platform-guard";
import { PLATFORM_MODULE } from "./platform-modules";
import { PLATFORM_ROLE } from "./platform-roles";
import type { PlatformContext } from "./platform-context";

function contextWith(roles: string[]): PlatformContext {
  return {
    status: "OK",
    roles,
    person: {
      employeeNumber: "12345",
      fullName: "Maria Souza",
      institutionalEmail: "maria@agenciasus.org.br",
      jobTitle: null,
      costCenter: null,
      workplace: null,
      metadata: {},
      avatarUrl: null,
    },
  };
}

const idle = { loading: false, error: "" };

describe("platform guard", () => {
  it("reports loading before anything else, even without context", () => {
    expect(resolvePlatformGuard({ context: null, loading: true, error: "" })).toEqual({ state: "loading" });
  });

  it("reports unidentified when there is no person, surfacing the context error", () => {
    expect(resolvePlatformGuard({ context: null, ...idle, error: "Sessão expirada." })).toEqual({
      state: "unidentified",
      message: "Sessão expirada.",
    });
  });

  it("falls back to a generic message when the context failed silently", () => {
    const decision = resolvePlatformGuard({ context: null, ...idle });
    expect(decision).toEqual({ state: "unidentified", message: "Acesso não identificado." });
  });

  it("restricts a participant from an administrative module", () => {
    const decision = resolvePlatformGuard({
      context: contextWith([PLATFORM_ROLE.PARTICIPANT]),
      ...idle,
      requiredModule: PLATFORM_MODULE.ADMIN_SURVEYS,
    });
    expect(decision).toEqual({ state: "restricted", requiredModule: PLATFORM_MODULE.ADMIN_SURVEYS });
  });

  it("restricts an admin from the modules reserved to the super admin", () => {
    for (const restricted of [PLATFORM_MODULE.ADMIN_TEAMS, PLATFORM_MODULE.ADMIN_ACCESS, PLATFORM_MODULE.ADMIN_IMPORT]) {
      expect(resolvePlatformGuard({
        context: contextWith([PLATFORM_ROLE.ADMIN]),
        ...idle,
        requiredModule: restricted,
      }).state).toBe("restricted");
    }
  });

  it("grants access and builds the shell user when the module is allowed", () => {
    const decision = resolvePlatformGuard({
      context: contextWith([PLATFORM_ROLE.ADMIN]),
      ...idle,
      requiredModule: PLATFORM_MODULE.ADMIN_SURVEYS,
    });

    expect(decision.state).toBe("granted");
    if (decision.state !== "granted") return;
    expect(decision.user.fullName).toBe("Maria Souza");
    expect(decision.user.employeeNumber).toBe("12345");
    expect(decision.user.profileLabel).toBe("Admin");
    expect(decision.user.modules).toBe(decision.modules);
    expect(decision.modules).toContain(PLATFORM_MODULE.ADMIN_SURVEYS);
    expect(decision.person.fullName).toBe("Maria Souza");
  });

  it("grants an identified person when the page requires no module", () => {
    const decision = resolvePlatformGuard({ context: contextWith([]), ...idle });
    expect(decision.state).toBe("granted");
    if (decision.state !== "granted") return;
    // Sem papel reconhecido o piso é Participante — identidade basta para /perfil.
    expect(decision.user.profileLabel).toBe("Participante");
    expect(decision.modules).toEqual([PLATFORM_MODULE.SURVEYS]);
  });

  it("labels the super admin with the highest privilege among accumulated roles", () => {
    const decision = resolvePlatformGuard({
      context: contextWith([PLATFORM_ROLE.PARTICIPANT, PLATFORM_ROLE.SUPER_ADMIN]),
      ...idle,
      requiredModule: PLATFORM_MODULE.ADMIN_IMPORT,
    });
    expect(decision.state).toBe("granted");
    if (decision.state !== "granted") return;
    expect(decision.user.profileLabel).toBe("Superadmin");
  });
});
