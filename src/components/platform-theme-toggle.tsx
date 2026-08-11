"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  normalizePlatformTheme,
  PLATFORM_THEME_ATTRIBUTE,
  PLATFORM_THEME_STORAGE_KEY,
  type PlatformTheme,
} from "@/lib/platform-theme";

function readStoredTheme(): PlatformTheme {
  try {
    return normalizePlatformTheme(window.localStorage.getItem(PLATFORM_THEME_STORAGE_KEY));
  } catch {
    return "light";
  }
}

function applyDocumentTheme(theme: PlatformTheme) {
  document.documentElement.setAttribute(PLATFORM_THEME_ATTRIBUTE, theme);
  document.documentElement.style.colorScheme = theme;
}

/**
 * Alterna entre tema claro (Sol) e escuro (Lua) — dois estados, padrão claro.
 *
 * Grava a escolha em `localStorage` e sincroniza entre abas pelo evento `storage`.
 * `localStorage` indisponível degrada silenciosamente: o tema ainda vale para a
 * aba atual. O padrão é aplicado antes da primeira pintura pelo script do layout.
 */
export function PlatformThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<PlatformTheme>("light");

  useEffect(() => {
    function syncFromStorage() {
      const stored = readStoredTheme();
      setTheme(stored);
      applyDocumentTheme(stored);
    }

    function handleStorage(event: StorageEvent) {
      if (!event.key || event.key === PLATFORM_THEME_STORAGE_KEY) syncFromStorage();
    }

    syncFromStorage();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  function toggleTheme() {
    const nextTheme: PlatformTheme = theme === "dark" ? "light" : "dark";
    try {
      window.localStorage.setItem(PLATFORM_THEME_STORAGE_KEY, nextTheme);
    } catch {
      // A preferência visual ainda vale para a aba atual.
    }
    applyDocumentTheme(nextTheme);
    setTheme(nextTheme);
  }

  const isDark = theme === "dark";
  const Icon = isDark ? Moon : Sun;
  const stateLabel = isDark ? "escuro" : "claro";
  const nextLabel = isDark ? "claro" : "escuro";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="theme-toggle text-xs font-black"
      data-theme={theme}
      aria-label={`Tema ${stateLabel} ativo. Alternar para tema ${nextLabel}.`}
      title={`Tema ${stateLabel}`}
      aria-pressed={isDark}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      <span className={compact ? "sr-only" : "hidden xl:inline"}>
        {isDark ? "Escuro" : "Claro"}
      </span>
    </button>
  );
}
