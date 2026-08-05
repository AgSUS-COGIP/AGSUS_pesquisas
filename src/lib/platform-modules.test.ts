import { describe, expect, it } from "vitest";
import {
  FULL_ADMIN_MODULES,
  PLATFORM_MODULE,
  normalizePlatformModules,
  resolvePlatformModules,
} from "./platform-modules";

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

  it("gives administrators the complete module catalog", () => {
    expect(resolvePlatformModules({ roles: ["ADMINISTRATOR"] })).toEqual([...FULL_ADMIN_MODULES]);
  });

  it("uses explicit valid modules before role fallbacks", () => {
    expect(resolvePlatformModules({
      roles: ["LEADER"],
      explicitModules: [PLATFORM_MODULE.HOME, "UNKNOWN"],
      isLeader: true,
    })).toEqual([PLATFORM_MODULE.HOME]);
  });

  it("adds team access to leaders when no explicit modules are returned", () => {
    expect(resolvePlatformModules({ roles: ["LEADER"] })).toContain(PLATFORM_MODULE.TEAM);
  });

  it("does not grant access management to survey managers", () => {
    const modules = resolvePlatformModules({ roles: ["SURVEY_MANAGER"] });
    expect(modules).toContain(PLATFORM_MODULE.ADMIN_SURVEYS);
    expect(modules).not.toContain(PLATFORM_MODULE.ADMIN_ACCESS);
  });
});
