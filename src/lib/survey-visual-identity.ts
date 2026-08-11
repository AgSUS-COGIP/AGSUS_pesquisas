export type SurveyVisualIdentity = {
  bannerUrl: string;
  bannerAlt: string;
  heroTitle: string;
  heroSubtitle: string;
};

type UnknownRecord = Record<string, unknown>;

export const DEFAULT_CDDI_VISUAL_IDENTITY: SurveyVisualIdentity = {
  bannerUrl: "/evaluation-journey.svg",
  bannerAlt: "Ciclo de Devolutivas e Desenvolvimento Individual",
  heroTitle: "Ciclo de Devolutivas e Desenvolvimento Individual (CDDI)",
  heroSubtitle: "Instrumento sistematizado para promover avaliação por competências, devolutivas e alinhamentos entre trabalhadores e suas lideranças.",
};

function record(value: unknown): UnknownRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : {};
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Deriva a identidade visual de uma aplicação a partir de `survey_applications.settings`.
 *
 * **A capa é sempre a institucional.** Imagem personalizada deixou de existir: a
 * administração configura apenas título e subtítulo, e todo instrumento abre com
 * a arte da AgSUS. `bannerUrl`, `bannerAlt` e `themeVariant` podem continuar
 * gravados em `settings` de ciclos antigos — são **ignorados de propósito**, para
 * que nenhuma capa personalizada sobreviva à mudança sem caminho de edição.
 *
 * Recebe `unknown` porque o JSON vem do banco sem esquema garantido: qualquer
 * campo ausente, vazio ou de tipo inesperado cai no `fallback`.
 */
export function resolveSurveyVisualIdentity(
  settings: unknown,
  fallback: SurveyVisualIdentity = DEFAULT_CDDI_VISUAL_IDENTITY,
): SurveyVisualIdentity {
  const visualIdentity = record(record(settings).visualIdentity);

  return {
    bannerUrl: fallback.bannerUrl,
    bannerAlt: fallback.bannerAlt,
    heroTitle: text(visualIdentity.heroTitle) ?? fallback.heroTitle,
    heroSubtitle: text(visualIdentity.heroSubtitle) ?? fallback.heroSubtitle,
  };
}
