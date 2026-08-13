export const PLATFORM_THEME_STORAGE_KEY = "agsus-theme";
export const PLATFORM_THEME_ATTRIBUTE = "data-agsus-theme";

export type PlatformTheme = "light" | "dark";

const INLINE_SCRIPT_UNSAFE_CHAR_MAP: Record<string, string> = {
  "<": "\\u003C",
  ">": "\\u003E",
  "/": "\\u002F",
  "\\": "\\\\",
  "\b": "\\b",
  "\f": "\\f",
  "\n": "\\n",
  "\r": "\\r",
  "\t": "\\t",
  "\0": "\\0",
  "\u2028": "\\u2028",
  "\u2029": "\\u2029",
};

function escapeUnsafeInlineScriptChars(value: string): string {
  return value.replace(/[<>\/\\\b\f\n\r\t\0\u2028\u2029]/g, (char) => INLINE_SCRIPT_UNSAFE_CHAR_MAP[char]);
}

/**
 * Tema salvo pela pessoa. Sem escolha salva — ou valor inválido — o padrão
 * institucional é **claro**. Só "dark" liga o tema escuro; qualquer outra coisa
 * resolve para claro.
 */
export function normalizePlatformTheme(value: string | null | undefined): PlatformTheme {
  return value === "dark" ? "dark" : "light";
}

/**
 * Script executado antes da primeira pintura (`beforeInteractive` no layout raiz).
 *
 * Aplica o tema salvo direto no `<html>` para não piscar durante o carregamento.
 * Precisa ser string síncrona e independente do bundle React, que só carrega
 * depois. Sem preferência salva, o padrão é claro; falha de `localStorage`
 * também degrada para claro.
 */
export function platformThemeBootstrapScript() {
  const storageKey = escapeUnsafeInlineScriptChars(JSON.stringify(PLATFORM_THEME_STORAGE_KEY));
  const attribute = escapeUnsafeInlineScriptChars(JSON.stringify(PLATFORM_THEME_ATTRIBUTE));

  return `(function(){try{var saved=window.localStorage.getItem(${storageKey});var theme=saved==="dark"?"dark":"light";document.documentElement.setAttribute(${attribute},theme);document.documentElement.style.colorScheme=theme;}catch(error){document.documentElement.setAttribute(${attribute},"light");document.documentElement.style.colorScheme="light";}})();`;
}
