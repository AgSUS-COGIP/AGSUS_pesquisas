import { describe, expect, it } from "vitest";
import {
  ADMIN_ROLE_MODULES,
  EVALUATOR_ROLE_MODULES,
  PARTICIPANT_ROLE_MODULES,
  PLATFORM_MODULE,
  SUPER_ADMIN_MODULES,
  normalizePlatformModules,
  resolvePlatformModules,
  resolvePlatformRole,
} from "./platform-modules";
import { PLATFORM_ROLE } from "./platform-roles";

describe("platform modules", () => {
  it("filters unknown modules and removes duplicates", () => {
    expect(normalizePlatformModules([
      PLATFORM_MODULE.HOME,
      "UNKNOWN",
      PLATFORM_MODULE.HOME,
      PLATFORM_MODULE.RESULTS,
    ])).toEqual([
      PLATFORM_MODULE.HOME,
      PLATFORM_MODULE.RESULTS,
    ]);
  });

  it("keeps participants limited to the surveys module", () => {
    expect(resolvePlatformModules({ roles: [PLATFORM_ROLE.PARTICIPANT] })).toEqual([PLATFORM_MODULE.SURVEYS]);
  });

  it("treats a person without roles as a participant", () => {
    expect(resolvePlatformModules({ roles: [] })).toEqual([...PARTICIPANT_ROLE_MODULES]);
    expect(resolvePlatformModules({})).toEqual([...PARTICIPANT_ROLE_MODULES]);
    expect(resolvePlatformRole(null)).toBe(PLATFORM_ROLE.PARTICIPANT);
  });

  it("gives evaluators the overview, surveys and team modules only", () => {
    expect(resolvePlatformModules({ roles: [PLATFORM_ROLE.EVALUATOR] })).toEqual([
      PLATFORM_MODULE.HOME,
      PLATFORM_MODULE.SURVEYS,
      PLATFORM_MODULE.TEAM,
    ]);
  });

  it("gives admins the survey operation modules, without global administration", () => {
    const modules = resolvePlatformModules({ roles: [PLATFORM_ROLE.ADMIN] });
    expect(modules).toEqual([...ADMIN_ROLE_MODULES]);
    expect(modules).toContain(PLATFORM_MODULE.DASHBOARDS);
    expect(modules).toContain(PLATFORM_MODULE.RESULTS);
    expect(modules).toContain(PLATFORM_MODULE.ADMIN_SURVEYS);
    expect(modules).toContain(PLATFORM_MODULE.ADMIN_PARTICIPANTS);
    expect(modules).not.toContain(PLATFORM_MODULE.ADMIN_TEAMS);
    expect(modules).not.toContain(PLATFORM_MODULE.ADMIN_ACCESS);
    expect(modules).not.toContain(PLATFORM_MODULE.ADMIN_IMPORT);
  });

  it("gives the super admin the complete module catalog", () => {
    expect(resolvePlatformModules({ roles: [PLATFORM_ROLE.SUPER_ADMIN] })).toEqual([...SUPER_ADMIN_MODULES]);
  });

  it("resolves the highest privilege when a person accumulates roles", () => {
    expect(resolvePlatformRole([PLATFORM_ROLE.PARTICIPANT, PLATFORM_ROLE.ADMIN])).toBe(PLATFORM_ROLE.ADMIN);
    expect(resolvePlatformRole([PLATFORM_ROLE.EVALUATOR, PLATFORM_ROLE.SUPER_ADMIN])).toBe(PLATFORM_ROLE.SUPER_ADMIN);
    expect(resolvePlatformRole([PLATFORM_ROLE.PARTICIPANT, PLATFORM_ROLE.EVALUATOR])).toBe(PLATFORM_ROLE.EVALUATOR);
  });

  it("ignores unknown roles instead of granting access", () => {
    expect(resolvePlatformModules({ roles: ["TECHNICAL_TEAM", "AUDITOR"] })).toEqual([...PARTICIPANT_ROLE_MODULES]);
  });

  it("derives access only from roles, with no per-person exception", () => {
    // Sem `explicitModules` no contrato: o perfil é a única fonte de acesso.
    expect(resolvePlatformModules({ roles: [PLATFORM_ROLE.EVALUATOR] })).toEqual([...EVALUATOR_ROLE_MODULES]);
  });
});
