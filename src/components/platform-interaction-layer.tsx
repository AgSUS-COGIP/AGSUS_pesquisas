"use client";

import { ArrowUp } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

/**
 * Posição de rolagem efetiva da tela.
 *
 * No desktop a casca rola dentro de `.platform-shell-content` (html/body ficam
 * travados); no celular e nas telas sem casca, quem rola é a própria janela.
 * O maior dos dois valores representa "quanto a pessoa desceu".
 */
function currentScrollTop() {
  const shell = document.querySelector(".platform-shell-content");
  return Math.max(window.scrollY, shell instanceof HTMLElement ? shell.scrollTop : 0);
}

const shortcuts = [
  { key: "1", href: "/area", module: "HOME" },
  { key: "2", href: "/pesquisas", module: "SURVEYS" },
  { key: "3", href: "/equipe", module: "TEAM" },
  { key: "a", href: "/admin", module: "ADMIN_SURVEYS" },
] as const;

export function PlatformInteractionLayer({ children, modules = [] }: { children: ReactNode; modules?: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [showTop, setShowTop] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const previousPath = useRef(pathname);
  const allowedShortcuts = useMemo(() => shortcuts.filter((item) => modules.includes(item.module)), [modules]);

  useEffect(() => {
    const handleScroll = () => setShowTop(currentScrollTop() > 520);
    // Captura na fase de captura: o evento `scroll` não borbulha, mas assim o
    // listener enxerga tanto a janela quanto o container de rolagem da casca.
    document.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    handleScroll();
    return () => {
      document.removeEventListener("scroll", handleScroll, { capture: true });
    };
  }, []);

  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    setTransitioning(true);
    setPageVisible(false);
    const frame = window.requestAnimationFrame(() => setPageVisible(true));
    const timeout = window.setTimeout(() => setTransitioning(false), 360);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timeout);
    };
  }, [pathname]);

  useEffect(() => {
    if (!allowedShortcuts.length) return;
    const handleShortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const shortcut = allowedShortcuts.find((item) => item.key === event.key.toLowerCase());
      if (!shortcut) return;
      event.preventDefault();
      router.push(shortcut.href);
    };
    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [allowedShortcuts, router]);

  return (
    <>
      <div aria-hidden="true" className={`pointer-events-none fixed inset-x-0 top-0 z-[150] h-[3px] origin-left bg-gradient-to-r from-cyan-400 via-emerald-400 to-blue-500 transition-all duration-300 ${transitioning ? "scale-x-100 opacity-100" : "scale-x-0 opacity-0"}`} />

      {/* O aviso de offline é responsabilidade única do NetworkStatusBanner —
          antes os dois componentes exibiam banners simultâneos. */}
      <div className={`transition-opacity duration-300 motion-reduce:transition-none ${pageVisible ? "opacity-100" : "opacity-0"}`}>
        {children}
      </div>

      <button
        type="button"
        onClick={() => {
          const shell = document.querySelector(".platform-shell-content");
          if (shell instanceof HTMLElement) shell.scrollTo({ top: 0, behavior: "smooth" });
          window.scrollTo({ top: 0, behavior: "smooth" });
        }}
        aria-label="Voltar ao topo"
        className={`fixed bottom-5 right-5 z-50 grid h-11 w-11 place-items-center rounded-2xl border border-white/80 bg-slate-950/90 text-white shadow-[0_18px_45px_-20px_rgba(15,23,42,.9)] backdrop-blur transition duration-200 hover:-translate-y-1 hover:bg-[var(--brand-primary)] focus:outline-none focus:ring-4 focus:ring-cyan-200 motion-reduce:transition-none ${showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </>
  );
}
