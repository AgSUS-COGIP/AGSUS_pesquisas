export type PlatformBranding = {
  organizationName: string;
  productName: string;
  logoUrl: string;
  logoPath: string | null;
  /**
   * Arte de fundo da tela de acesso.
   *
   * Diferente do logotipo, **é** configurável: acompanha campanha institucional
   * e muda várias vezes por ano. Nulo devolve a arte institucional padrão.
   */
  accessBackgroundUrl: string | null;
  accessBackgroundPath: string | null;
  /**
   * Cor do painel do formulário de acesso. Nulo mantém o branco institucional.
   *
   * O contraste do texto e do botão **não** é configurado junto: é derivado
   * desta cor por `needsLightForeground()`. Cor livre com contraste manual
   * produziria tela ilegível na primeira combinação infeliz.
   */
  accessPanelColor: string | null;
  primaryColor: string;
  updatedAt: string | null;
};

export const DEFAULT_PLATFORM_BRANDING: PlatformBranding = {
  organizationName: "AgSUS",
  productName: "Avaliações",
  logoUrl: "/agsus-logo.png",
  logoPath: null,
  accessBackgroundUrl: null,
  accessBackgroundPath: null,
  accessPanelColor: null,
  primaryColor: "#0b4f82",
  updatedAt: null,
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function normalizePlatformBranding(value: unknown): PlatformBranding {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const primaryColor = typeof source.primaryColor === "string" && HEX_COLOR.test(source.primaryColor.trim())
    ? source.primaryColor.trim().toLowerCase()
    : DEFAULT_PLATFORM_BRANDING.primaryColor;

  return {
    organizationName: text(source.organizationName, DEFAULT_PLATFORM_BRANDING.organizationName).slice(0, 60),
    productName: text(source.productName, DEFAULT_PLATFORM_BRANDING.productName).slice(0, 60),
    // O logotipo é identidade institucional fixa: uploads antigos gravados no
    // banco são ignorados de propósito, para a marca oficial nunca ser
    // sobrescrita pela configuração.
    logoUrl: DEFAULT_PLATFORM_BRANDING.logoUrl,
    logoPath: null,
    // Só HTTPS: a tela de acesso é servida por HTTPS, e imagem em HTTP daria
    // conteúdo misto além de permitir troca da arte em trânsito. Valor inválido
    // degrada para nulo, e a arte institucional padrão volta a valer.
    accessBackgroundUrl: typeof source.accessBackgroundUrl === "string" && source.accessBackgroundUrl.startsWith("https://")
      ? source.accessBackgroundUrl
      : null,
    accessBackgroundPath: typeof source.accessBackgroundPath === "string" ? source.accessBackgroundPath : null,
    // Cor malformada vira nulo, não branco forçado: o painel volta ao padrão
    // institucional em vez de herdar uma cor que ninguém escolheu.
    accessPanelColor: typeof source.accessPanelColor === "string" && HEX_COLOR.test(source.accessPanelColor)
      ? source.accessPanelColor
      : null,
    primaryColor,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
  };
}

export function platformBrandingTitle(branding: PlatformBranding) {
  return `${branding.organizationName} ${branding.productName}`.trim();
}
