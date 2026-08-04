import { describe, expect, it } from "vitest";
import {
  isPlatformNavItemActive,
  navigationGroupsForModules,
  platformNavigationGroups,
} from "./platform-navigation";

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
});
