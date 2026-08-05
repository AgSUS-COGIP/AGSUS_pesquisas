export const PLATFORM_SIDEBAR_STORAGE_KEY = "agsus-sidebar-compact";
export const PLATFORM_SIDEBAR_ATTRIBUTE = "data-agsus-sidebar-compact";

export function isPlatformSidebarCompact(value: string | null | undefined) {
  return value === "true";
}

export function platformSidebarBootstrapScript() {
  const storageKey = JSON.stringify(PLATFORM_SIDEBAR_STORAGE_KEY);
  const attribute = JSON.stringify(PLATFORM_SIDEBAR_ATTRIBUTE);

  return `(function(){try{var compact=window.localStorage.getItem(${storageKey})==="true";document.documentElement.setAttribute(${attribute},String(compact));}catch(error){document.documentElement.setAttribute(${attribute},"false");}})();`;
}
