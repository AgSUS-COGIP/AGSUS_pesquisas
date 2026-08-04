export type SurveyVisualIdentity = {
  bannerUrl: string;
  bannerAlt: string;
  heroTitle: string;
  heroSubtitle: string;
  themeVariant: "INSTITUTIONAL" | "CUSTOM";
};

type UnknownRecord = Record<string, unknown>;

export const DEFAULT_CDDI_VISUAL_IDENTITY: SurveyVisualIdentity = {
  bannerUrl: "https://i.postimg.cc/fTtNN9PM/Automatizacao-de-instrumento.png",
  bannerAlt: "Ciclo de Devolutivas e Desenvolvimento Individual",
  heroTitle: "Ciclo de Devolutivas e Desenvolvimento Individual (CDDI)",
  heroSubtitle: "Instrumento sistematizado para promover avaliação por competências, devolutivas e alinhamentos entre trabalhadores e suas lideranças.",
  themeVariant: "INSTITUTIONAL",
};

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function httpsUrl(value: unknown): string | null {
  const candidate = text(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function resolveSurveyVisualIdentity(
  settings: unknown,
  fallback: SurveyVisualIdentity = DEFAULT_CDDI_VISUAL_IDENTITY,
): SurveyVisualIdentity {
  const visualIdentity = record(record(settings).visualIdentity);
  const themeVariant = text(visualIdentity.themeVariant)?.toUpperCase() === "CUSTOM"
    ? "CUSTOM"
    : "INSTITUTIONAL";
  const customBannerUrl = themeVariant === "CUSTOM"
    ? httpsUrl(visualIdentity.bannerUrl)
    : null;

  return {
    bannerUrl: customBannerUrl ?? fallback.bannerUrl,
    bannerAlt: customBannerUrl
      ? text(visualIdentity.bannerAlt) ?? fallback.bannerAlt
      : fallback.bannerAlt,
    heroTitle: text(visualIdentity.heroTitle) ?? fallback.heroTitle,
    heroSubtitle: text(visualIdentity.heroSubtitle) ?? fallback.heroSubtitle,
    themeVariant,
  };
}
