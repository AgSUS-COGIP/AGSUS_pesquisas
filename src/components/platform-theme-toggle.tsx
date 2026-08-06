"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import {
  getPlatformThemeState,
  normalizePlatformTheme,
  PLATFORM_THEME_ATTRIBUTE,
  PLATFORM_THEME_PREFERENCE_ATTRIBUTE,
  PLATFORM_THEME_STORAGE_KEY,
  type PlatformTheme,
} from "@/lib/platform-theme";

const THEME_LABELS: Record<PlatformTheme, string> = {
  system: "Automático",
  light: "Claro",
  dark: "Escuro",
};

const THEME_ICONS: Record<PlatformTheme, LucideIcon> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

const NEXT_THEME: Record<PlatformTheme, PlatformTheme> = {
  system: "light",
  light: "dark",
  dark: "system",
};

function readStoredTheme() {
  try {
    return normalizePlatformTheme(
      window.localStorage.getItem(PLATFORM_THEME_STORAGE_KEY),
    );
  } catch {
    return "system" as const;
  }
}

function updateDocumentTheme(theme: PlatformTheme, prefersDark: boolean) {
  const state = getPlatformThemeState(theme, prefersDark);
  document.documentElement.setAttribute(PLATFORM_THEME_ATTRIBUTE, state.resolved);
  document.documentElement.setAttribute(
    PLATFORM_THEME_PREFERENCE_ATTRIBUTE,
    state.preference,
  );
  document.documentElement.style.colorScheme = state.resolved;
}

export function PlatformThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<PlatformTheme>("system");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    function syncFromStorage() {
      const storedTheme = readStoredTheme();
      setTheme(storedTheme);
      updateDocumentTheme(storedTheme, mediaQuery.matches);
    }

    function handleSystemPreferenceChange() {
      const storedTheme = readStoredTheme();
      if (storedTheme === "system") {
        updateDocumentTheme(storedTheme, mediaQuery.matches);
      }
    }

    function handleStorage(event: StorageEvent) {
      if (!event.key || event.key === PLATFORM_THEME_STORAGE_KEY) {
        syncFromStorage();
      }
    }

    syncFromStorage();
    mediaQuery.addEventListener("change", handleSystemPreferenceChange);
    window.addEventListener("storage", handleStorage);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemPreferenceChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  function applyTheme(nextTheme: PlatformTheme) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    try {
      window.localStorage.setItem(PLATFORM_THEME_STORAGE_KEY, nextTheme);
    } catch {
      // The visual preference still applies for the current tab.
    }
    updateDocumentTheme(nextTheme, prefersDark);
    setTheme(nextTheme);
  }

  const nextTheme = NEXT_THEME[theme];
  const ThemeIcon = THEME_ICONS[theme];

  return (
    <button
      type="button"
      onClick={() => applyTheme(nextTheme)}
      className="theme-toggle text-xs font-black"
      data-theme={theme}
      aria-label={`Tema atual: ${THEME_LABELS[theme]}. Alterar para ${THEME_LABELS[nextTheme]}.`}
      title={`Tema: ${THEME_LABELS[theme]}`}
    >
      <ThemeIcon className="h-4 w-4" aria-hidden="true" />
      <span className={compact ? "sr-only" : "hidden xl:inline"}>
        {THEME_LABELS[theme]}
      </span>
    </button>
  );
}
