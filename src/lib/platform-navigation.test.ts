import { describe, expect, it } from "vitest";
import {
  isPlatformNavItemActive,
  navigationGroupsForModules,
  platformNavigationGroups,
} from "./platform-navigation";
import { resolvePlatformModules } from "./platform-modules";
import { PLATFORM_ROLE } from "./platform-roles";

function menuFor(role: string) {
  return navigationGroupsForModules(resolvePlatformModules({ roles: [role] }))
    .flatMap((group) => group.items.map((item) => item.href));
}

describe("platform navigation", () => {
  it("shows only modules granted to the user", () => {
    const groups = navigationGroupsForModules(["HOME", "RESULTS"]);
    expect(groups.flatMap((group) => group.items.map((item) => item.href))).toEqual([
      "/area",
      "/resultados",
    ]);
  });

  it("removes empty groups", () => {
    const groups = navigationGroupsForModules(["ADMIN_TEAMS"]);
    expect(groups).toHaveLength(1);
    expect(groups[0].title).toBe("Administração");
    expect(groups[0].items[0].href).toBe("/admin/equipes");
  });

  it("keeps exact overview routes from activating nested pages", () => {
    const overview = platformNavigationGroups[0].items[0];
    const admin = platformNavigationGroups[2].items[0];
    expect(isPlatformNavItemActive("/area", overview)).toBe(true);
    expect(isPlatformNavItemActive("/area/detalhe", overview)).toBe(false);
    expect(isPlatformNavItemActive("/admin/participantes", admin)).toBe(false);
  });

  it("activates nested routes for module entries", () => {
    const surveys = platformNavigationGroups[0].items[1];
    expect(isPlatformNavItemActive("/pesquisas/CDDI", surveys)).toBe(true);
  });

  it("shows the participant only the surveys module", () => {
    expect(menuFor(PLATFORM_ROLE.PARTICIPANT)).toEqual(["/pesquisas"]);
  });

  it("shows the evaluator the overview, surveys and team modules", () => {
    expect(menuFor(PLATFORM_ROLE.EVALUATOR)).toEqual(["/area", "/pesquisas", "/equipe"]);
  });

  it("shows the admin the survey operation modules, without global administration", () => {
    expect(menuFor(PLATFORM_ROLE.ADMIN)).toEqual([
      "/area",
      "/pesquisas",
      "/paineis",
      "/equipe",
      "/resultados",
      "/admin",
      "/admin/pesquisas",
      "/admin/participantes",
    ]);
  });

  it("shows the super admin every entry of the menu", () => {
    const everyHref = platformNavigationGroups.flatMap((group) => group.items.map((item) => item.href));
    expect(menuFor(PLATFORM_ROLE.SUPER_ADMIN)).toEqual(everyHref);
  });
});
