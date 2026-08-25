import { describe, expect, it } from "vitest";
import { DEFAULT_PLATFORM_BRANDING, OFFICIAL_PLATFORM_LOGO_URL, normalizePlatformBranding, platformBrandingTitle } from "./platform-branding";

describe("platform branding", () => {
  it("usa a identidade institucional quando a configuração está ausente", () => {
    expect(normalizePlatformBranding(null)).toEqual(DEFAULT_PLATFORM_BRANDING);
  });

  it("ignora logotipo gravado no banco e mantém a marca institucional", () => {
    expect(normalizePlatformBranding({ logoUrl: "javascript:alert(1)", primaryColor: "red" })).toEqual(DEFAULT_PLATFORM_BRANDING);
    expect(normalizePlatformBranding({ logoUrl: "https://example.org/logo.png", logoPath: "branding/logo-x.png", primaryColor: "#126B98" })).toMatchObject({
      logoUrl: DEFAULT_PLATFORM_BRANDING.logoUrl,
      logoPath: null,
      primaryColor: "#126b98",
    });
  });

  it("expõe a logo oficial com versão para invalidar caches antigos", () => {
    expect(normalizePlatformBranding({ logoUrl: null }).logoUrl).toBe(OFFICIAL_PLATFORM_LOGO_URL);
    expect(OFFICIAL_PLATFORM_LOGO_URL).toMatch(/^\/agsus-logo\.png\?v=\d+$/);
  });

  it("compõe o nome público da plataforma", () => {
    expect(platformBrandingTitle({ ...DEFAULT_PLATFORM_BRANDING, organizationName: "Instituição", productName: "Escuta" })).toBe("Instituição Escuta");
  });
});
