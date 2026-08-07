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
  productName: "Pesquisas",
  logoUrl: "/agsus-logo-oficial.jpg",
  logoPath: null,
  primaryColor: "#0b4f82",
  updatedAt: null,
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function safeLogoUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return DEFAULT_PLATFORM_BRANDING.logoUrl;
  const candidate = value.trim();
  if (candidate.startsWith("/")) return candidate;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? url.toString() : DEFAULT_PLATFORM_BRANDING.logoUrl;
  } catch {
    return DEFAULT_PLATFORM_BRANDING.logoUrl;
  }
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
    logoUrl: safeLogoUrl(source.logoUrl),
    logoPath: typeof source.logoPath === "string" && source.logoPath.trim() ? source.logoPath.trim() : null,
    primaryColor,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
  };
}

export function platformBrandingTitle(branding: PlatformBranding) {
  return `${branding.organizationName} ${branding.productName}`.trim();
}
