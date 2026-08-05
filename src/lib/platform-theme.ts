export const PLATFORM_THEME_STORAGE_KEY = "agsus-theme";
export const PLATFORM_THEME_ATTRIBUTE = "data-agsus-theme";

export type PlatformTheme = "light" | "dark" | "system";

export function normalizePlatformTheme(value: string | null | undefined): PlatformTheme {
  return value === "light" || value === "dark" ? value : "system";
}

export function resolvePlatformTheme(theme: PlatformTheme, prefersDark: boolean) {
  return theme === "system" ? (prefersDark ? "dark" : "light") : theme;
}

export function platformThemeBootstrapScript() {
  const storageKey = JSON.stringify(PLATFORM_THEME_STORAGE_KEY);
  const attribute = JSON.stringify(PLATFORM_THEME_ATTRIBUTE);

  return `(function(){try{var saved=window.localStorage.getItem(${storageKey});var theme=saved==="light"||saved==="dark"?saved:"system";var resolved=theme==="system"?(window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):theme;document.documentElement.setAttribute(${attribute},resolved);document.documentElement.style.colorScheme=resolved;}catch(error){document.documentElement.setAttribute(${attribute},"light");document.documentElement.style.colorScheme="light";}})();`;
}
