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

export function PlatformThemeToggle() {
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
      className="theme-toggle inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 text-xs font-black text-[var(--text-primary)] shadow-sm transition hover:-translate-y-px hover:border-sky-300"
      aria-label={`Tema atual: ${THEME_LABELS[theme]}. Alterar para ${THEME_LABELS[nextTheme]}.`}
      title={`Tema: ${THEME_LABELS[theme]}`}
    >
      <span aria-hidden="true">{theme === "dark" ? "☾" : theme === "light" ? "☀" : "◐"}</span>
      <span className="hidden xl:inline">{THEME_LABELS[theme]}</span>
    </button>
  );
}
