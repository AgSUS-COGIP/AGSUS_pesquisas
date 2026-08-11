import { describe, expect, it } from "vitest";
import {
  DEFAULT_CDDI_VISUAL_IDENTITY,
  resolveSurveyVisualIdentity,
} from "./survey-visual-identity";

describe("resolveSurveyVisualIdentity", () => {
  it("usa o padrão institucional quando não há configuração", () => {
    expect(resolveSurveyVisualIdentity(null)).toEqual(DEFAULT_CDDI_VISUAL_IDENTITY);
  });

  it("aplica os textos configurados sem perder os fallbacks", () => {
    expect(resolveSurveyVisualIdentity({
      visualIdentity: {
        heroTitle: "Edital institucional",
      },
    })).toEqual({
      ...DEFAULT_CDDI_VISUAL_IDENTITY,
      heroTitle: "Edital institucional",
    });
  });

  it("normaliza espaços nos textos", () => {
    expect(resolveSurveyVisualIdentity({
      visualIdentity: {
        heroTitle: "  Ciclo personalizado  ",
        heroSubtitle: "  Apresentação personalizada.  ",
      },
    })).toEqual({
      ...DEFAULT_CDDI_VISUAL_IDENTITY,
      heroTitle: "Ciclo personalizado",
      heroSubtitle: "Apresentação personalizada.",
    });
  });

  // A capa é sempre a institucional. Ciclos configurados antes da mudança podem
  // ter `bannerUrl` e `themeVariant: CUSTOM` gravados; a resolução os descarta,
  // senão a capa antiga sobreviveria sem nenhum caminho de edição na interface.
  it("ignora banner personalizado gravado em ciclos antigos", () => {
    expect(resolveSurveyVisualIdentity({
      visualIdentity: {
        bannerUrl: "https://example.org/banner.webp",
        bannerAlt: "Capa antiga",
        themeVariant: "CUSTOM",
      },
    })).toEqual(DEFAULT_CDDI_VISUAL_IDENTITY);
  });

  it("ignora valores vazios e tipos inválidos nos textos", () => {
    expect(resolveSurveyVisualIdentity({
      visualIdentity: {
        heroTitle: [],
        heroSubtitle: null,
      },
    })).toEqual(DEFAULT_CDDI_VISUAL_IDENTITY);
  });
});
