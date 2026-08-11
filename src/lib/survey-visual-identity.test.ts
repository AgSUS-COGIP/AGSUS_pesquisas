import { describe, expect, it } from "vitest";
import {
  DEFAULT_CDDI_VISUAL_IDENTITY,
  resolveSurveyVisualIdentity,
} from "./survey-visual-identity";

describe("resolveSurveyVisualIdentity", () => {
  it("usa o padrão institucional quando não há configuração", () => {
    expect(resolveSurveyVisualIdentity(null)).toEqual(DEFAULT_CDDI_VISUAL_IDENTITY);
  });

  it("aplica a identidade personalizada sem perder os fallbacks", () => {
    expect(resolveSurveyVisualIdentity({
      visualIdentity: {
        bannerUrl: "https://example.org/banner.webp",
        bannerAlt: "Capa do edital",
        heroTitle: "Edital institucional",
        themeVariant: "custom",
      },
    })).toEqual({
      ...DEFAULT_CDDI_VISUAL_IDENTITY,
      bannerUrl: "https://example.org/banner.webp",
      bannerAlt: "Capa do edital",
      heroTitle: "Edital institucional",
      themeVariant: "CUSTOM",
    });
  });

  it("normaliza espaços nos textos e na URL configurada", () => {
    expect(resolveSurveyVisualIdentity({
      visualIdentity: {
        bannerUrl: "  https://example.org/banner.png  ",
        bannerAlt: "  Banner do ciclo  ",
        heroTitle: "  Ciclo personalizado  ",
        heroSubtitle: "  Apresentação personalizada.  ",
        themeVariant: " CUSTOM ",
      },
    })).toEqual({
      bannerUrl: "https://example.org/banner.png",
      bannerAlt: "Banner do ciclo",
      heroTitle: "Ciclo personalizado",
      heroSubtitle: "Apresentação personalizada.",
      themeVariant: "CUSTOM",
    });
  });

  it("mantém a capa padrão quando o modo institucional está ativo", () => {
    expect(resolveSurveyVisualIdentity({
      visualIdentity: {
        bannerUrl: "https://example.org/banner.png",
        bannerAlt: "Capa antiga",
        themeVariant: "INSTITUTIONAL",
      },
    })).toEqual(DEFAULT_CDDI_VISUAL_IDENTITY);
  });

  it("ignora valores vazios, tipos inválidos e URLs inseguras", () => {
    expect(resolveSurveyVisualIdentity({
      visualIdentity: {
        bannerUrl: "javascript:alert(1)",
        bannerAlt: 123,
        heroTitle: [],
        heroSubtitle: null,
        themeVariant: "CUSTOM",
      },
    })).toEqual({
      ...DEFAULT_CDDI_VISUAL_IDENTITY,
      themeVariant: "CUSTOM",
    });
  });
});
