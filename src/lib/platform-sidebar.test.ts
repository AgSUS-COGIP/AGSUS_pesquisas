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

  it.each([
    ["true", "true"],
    ["false", "false"],
    [null, "false"],
  ])("applies persisted value %s before React starts", (storedValue, expectedAttribute) => {
    let appliedAttribute: string | null = null;
    const windowMock = {
      localStorage: {
        getItem: () => storedValue,
      },
    };
    const documentMock = {
      documentElement: {
        setAttribute: (name: string, value: string) => {
          expect(name).toBe(PLATFORM_SIDEBAR_ATTRIBUTE);
          appliedAttribute = value;
        },
      },
    };

    Function("window", "document", platformSidebarBootstrapScript())(windowMock, documentMock);

    expect(appliedAttribute).toBe(expectedAttribute);
  });

  it("falls back to expanded when localStorage is unavailable", () => {
    let appliedAttribute: string | null = null;
    const windowMock = {
      localStorage: {
        getItem: () => {
          throw new Error("storage unavailable");
        },
      },
    };
    const documentMock = {
      documentElement: {
        setAttribute: (_name: string, value: string) => {
          appliedAttribute = value;
        },
      },
    };

    Function("window", "document", platformSidebarBootstrapScript())(windowMock, documentMock);

    expect(appliedAttribute).toBe("false");
  });
});
