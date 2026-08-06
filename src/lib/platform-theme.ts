export const PLATFORM_THEME_STORAGE_KEY = "agsus-theme";
export const PLATFORM_THEME_ATTRIBUTE = "data-agsus-theme";
export const PLATFORM_THEME_PREFERENCE_ATTRIBUTE = "data-agsus-theme-preference";

export type PlatformTheme = "light" | "dark" | "system";
export type PlatformResolvedTheme = Exclude<PlatformTheme, "system">;

export function normalizePlatformTheme(value: string | null | undefined): PlatformTheme {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolvePlatformTheme(
  theme: PlatformTheme,
  prefersDark: boolean,
): PlatformResolvedTheme {
  return theme === "system" ? (prefersDark ? "dark" : "light") : theme;
}

export function getPlatformThemeState(theme: PlatformTheme, prefersDark: boolean) {
  return {
    preference: theme,
    resolved: resolvePlatformTheme(theme, prefersDark),
  } as const;
}

export function platformThemeBootstrapScript() {
  const storageKey = JSON.stringify(PLATFORM_THEME_STORAGE_KEY);
  const attribute = JSON.stringify(PLATFORM_THEME_ATTRIBUTE);
  const preferenceAttribute = JSON.stringify(PLATFORM_THEME_PREFERENCE_ATTRIBUTE);

  return `(function(){try{var saved=window.localStorage.getItem(${storageKey});var preference=saved==="light"||saved==="dark"?saved:"system";var resolved=preference==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):preference;document.documentElement.setAttribute(${attribute},resolved);document.documentElement.setAttribute(${preferenceAttribute},preference);document.documentElement.style.colorScheme=resolved;}catch(error){document.documentElement.setAttribute(${attribute},"light");document.documentElement.setAttribute(${preferenceAttribute},"system");document.documentElement.style.colorScheme="light";}})();`;
}
