import { describe, expect, it } from "vitest";
import {
  normalizePlatformTheme,
  PLATFORM_THEME_ATTRIBUTE,
  PLATFORM_THEME_STORAGE_KEY,
  platformThemeBootstrapScript,
  resolvePlatformTheme,
} from "./platform-theme";

describe("platform theme", () => {
  it("normalizes persisted values", () => {
    expect(normalizePlatformTheme("light")).toBe("light");
    expect(normalizePlatformTheme("dark")).toBe("dark");
    expect(normalizePlatformTheme("invalid")).toBe("system");
    expect(normalizePlatformTheme(null)).toBe("system");
  });

  it("resolves system preference", () => {
    expect(resolvePlatformTheme("system", true)).toBe("dark");
    expect(resolvePlatformTheme("system", false)).toBe("light");
    expect(resolvePlatformTheme("light", true)).toBe("light");
  });

  it("bootstraps the shared storage key and attribute", () => {
    const script = platformThemeBootstrapScript();
    expect(script).toContain(PLATFORM_THEME_STORAGE_KEY);
    expect(script).toContain(PLATFORM_THEME_ATTRIBUTE);
    expect(script).toContain("prefers-color-scheme: dark");
  });
});
