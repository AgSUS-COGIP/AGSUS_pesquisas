import { describe, expect, it } from "vitest";
import {
  normalizePlatformTheme,
  PLATFORM_THEME_ATTRIBUTE,
  PLATFORM_THEME_STORAGE_KEY,
  platformThemeBootstrapScript,
} from "./platform-theme";

describe("platform theme", () => {
  it("mantém apenas 'dark' como escolha; qualquer outra coisa é claro (padrão)", () => {
    expect(normalizePlatformTheme("dark")).toBe("dark");
    expect(normalizePlatformTheme("light")).toBe("light");
  });

  it("usa tema claro como padrão para valor ausente ou inválido", () => {
    expect(normalizePlatformTheme(null)).toBe("light");
    expect(normalizePlatformTheme(undefined)).toBe("light");
    expect(normalizePlatformTheme("system")).toBe("light");
    expect(normalizePlatformTheme("invalid")).toBe("light");
  });

  it("faz bootstrap com a chave e o atributo compartilhados, com claro como padrão", () => {
    const script = platformThemeBootstrapScript();
    expect(script).toContain(PLATFORM_THEME_STORAGE_KEY);
    expect(script).toContain(PLATFORM_THEME_ATTRIBUTE);
    // Só "dark" liga o escuro; a ausência de preferência resolve para claro.
    expect(script).toContain('saved==="dark"?"dark":"light"');
    // Sem dependência de preferência do sistema — dois estados apenas.
    expect(script).not.toContain("prefers-color-scheme");
  });
});
