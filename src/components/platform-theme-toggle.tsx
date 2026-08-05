"use client";

import { useEffect, useState } from "react";
import {
  normalizePlatformTheme,
  PLATFORM_THEME_ATTRIBUTE,
  PLATFORM_THEME_STORAGE_KEY,
  resolvePlatformTheme,
  type PlatformTheme,
} from "@/lib/platform-theme";

const THEME_LABELS: Record<PlatformTheme, string> = {
  system: "Automático",
  light: "Claro",
  dark: "Escuro",
};

const NEXT_THEME: Record<PlatformTheme, PlatformTheme> = {
  system: "light",
  light: "dark",
  dark: "system",
};

export function PlatformThemeToggle({ compact = false }: { compact?: boolean }) {
  const [theme, setTheme] = useState<PlatformTheme>("system");

  useEffect(() => {
    setTheme(normalizePlatformTheme(window.localStorage.getItem(PLATFORM_THEME_STORAGE_KEY)));
  }, []);

  function applyTheme(nextTheme: PlatformTheme) {
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved = resolvePlatformTheme(nextTheme, prefersDark);
    window.localStorage.setItem(PLATFORM_THEME_STORAGE_KEY, nextTheme);
    document.documentElement.setAttribute(PLATFORM_THEME_ATTRIBUTE, resolved);
    document.documentElement.style.colorScheme = resolved;
    setTheme(nextTheme);
  }

  const nextTheme = NEXT_THEME[theme];

  return (
    <button
      type="button"
      onClick={() => applyTheme(nextTheme)}
      className={`theme-toggle inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/[.06] text-xs font-black text-blue-50 transition hover:bg-white/[.12] hover:text-white ${compact ? "px-2" : "px-3"}`}
      aria-label={`Tema atual: ${THEME_LABELS[theme]}. Alterar para ${THEME_LABELS[nextTheme]}.`}
      title={`Tema: ${THEME_LABELS[theme]}`}
    >
      <span className="text-base" aria-hidden="true">{theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐"}</span>
      <span className={compact ? "sr-only" : "inline"}>{THEME_LABELS[theme]}</span>
    </button>
  );
}
