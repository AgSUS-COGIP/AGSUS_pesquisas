export type PlatformBranding = {
  organizationName: string;
  productName: string;
  logoUrl: string;
  logoPath: string | null;
  primaryColor: string;
  updatedAt: string | null;
};

export const DEFAULT_PLATFORM_BRANDING: PlatformBranding = {
  organizationName: "AgSUS",
  productName: "Avaliações",
  logoUrl: "/agsus-logo.png",
  logoPath: null,
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
    primaryColor,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
  };
}

export function platformBrandingTitle(branding: PlatformBranding) {
  return `${branding.organizationName} ${branding.productName}`.trim();
}
