export const PLATFORM_SIDEBAR_STORAGE_KEY = "agsus-sidebar-compact";
export const PLATFORM_SIDEBAR_ATTRIBUTE = "data-agsus-sidebar-compact";

export function isPlatformSidebarCompact(value: string | null | undefined) {
  return value === "true";
}

/**
 * Script executado antes da primeira pintura, análogo ao do tema: aplica o estado
 * recolhido da barra lateral no `<html>` para que ela não apareça expandida e
 * "salte" para compacta quando o React assumir.
 */
export function platformSidebarBootstrapScript() {
  const storageKey = JSON.stringify(PLATFORM_SIDEBAR_STORAGE_KEY);
  const attribute = JSON.stringify(PLATFORM_SIDEBAR_ATTRIBUTE);

  return `(function(){try{var compact=window.localStorage.getItem(${storageKey})==="true";document.documentElement.setAttribute(${attribute},String(compact));}catch(error){document.documentElement.setAttribute(${attribute},"false");}})();`;
}
