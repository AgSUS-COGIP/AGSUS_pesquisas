import { describe, expect, it } from "vitest";
import {
  isPlatformSidebarCompact,
  PLATFORM_SIDEBAR_ATTRIBUTE,
  PLATFORM_SIDEBAR_STORAGE_KEY,
  platformSidebarBootstrapScript,
} from "./platform-sidebar";

describe("platform sidebar preference", () => {
  it("treats only the persisted true value as compact", () => {
    expect(isPlatformSidebarCompact("true")).toBe(true);
    expect(isPlatformSidebarCompact("false")).toBe(false);
    expect(isPlatformSidebarCompact(null)).toBe(false);
  });

  it("bootstraps the same storage key and document attribute used by the shell", () => {
    const script = platformSidebarBootstrapScript();
    expect(script).toContain(PLATFORM_SIDEBAR_STORAGE_KEY);
    expect(script).toContain(PLATFORM_SIDEBAR_ATTRIBUTE);
    expect(script).toContain("localStorage");
  });
});
