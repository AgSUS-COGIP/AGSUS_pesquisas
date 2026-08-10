import { describe, expect, it } from "vitest";
import {
  DEFAULT_PARTICIPANT_MODULES,
  PLATFORM_MODULE,
  SUPER_ADMIN_MODULES,
  normalizePlatformModules,
  resolvePlatformModules,
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

  it("gives the super admin the complete module catalog", () => {
    expect(resolvePlatformModules({ roles: [PLATFORM_ROLE.SUPER_ADMIN] })).toEqual([...SUPER_ADMIN_MODULES]);
  });

  it("uses explicit valid modules before role fallbacks", () => {
    expect(resolvePlatformModules({
      roles: [PLATFORM_ROLE.EVALUATOR],
      explicitModules: [PLATFORM_MODULE.HOME, "UNKNOWN"],
      isLeader: true,
    })).toEqual([PLATFORM_MODULE.HOME]);
  });

  it("adds team access to evaluators when no explicit modules are returned", () => {
    expect(resolvePlatformModules({ roles: [PLATFORM_ROLE.EVALUATOR] })).toContain(PLATFORM_MODULE.TEAM);
  });

  it("does not grant global administration to admins", () => {
    const modules = resolvePlatformModules({ roles: [PLATFORM_ROLE.ADMIN] });
    expect(modules).toContain(PLATFORM_MODULE.ADMIN_SURVEYS);
    expect(modules).toContain(PLATFORM_MODULE.TEAM);
    expect(modules).not.toContain(PLATFORM_MODULE.ADMIN_ACCESS);
    expect(modules).not.toContain(PLATFORM_MODULE.ADMIN_TEAMS);
  });

  it("keeps participants limited to their own journey", () => {
    const modules = resolvePlatformModules({ roles: [PLATFORM_ROLE.PARTICIPANT] });
    expect(modules).toEqual([...DEFAULT_PARTICIPANT_MODULES]);
    expect(modules).not.toContain(PLATFORM_MODULE.TEAM);
    expect(modules).not.toContain(PLATFORM_MODULE.DASHBOARDS);
  });
});
