"use client";

import { ArrowUp, WifiOff } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

const shortcuts = [
  { key: "1", href: "/area", module: "HOME" },
  { key: "2", href: "/pesquisas", module: "SURVEYS" },
  { key: "3", href: "/equipe", module: "TEAM" },
  { key: "4", href: "/resultados", module: "RESULTS" },
  { key: "a", href: "/admin", module: "ADMIN_SURVEYS" },
] as const;

export function PlatformInteractionLayer({ children, modules = [] }: { children: ReactNode; modules?: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [showTop, setShowTop] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  const previousPath = useRef(pathname);
  const allowedShortcuts = useMemo(() => shortcuts.filter((item) => modules.includes(item.module)), [modules]);

  useEffect(() => {
    setOnline(window.navigator.onLine);
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    const handleScroll = () => setShowTop(window.scrollY > 520);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("scroll", handleScroll);
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

      {!online && (
        <div role="status" className="fixed inset-x-3 top-3 z-[145] mx-auto flex max-w-xl items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm font-bold text-amber-900 shadow-xl backdrop-blur">
          <WifiOff className="h-4 w-4" />
          Você está offline. Alterações que dependem do servidor podem não ser salvas.
        </div>
      )}

      <div className={`transition-opacity duration-300 motion-reduce:transition-none ${pageVisible ? "opacity-100" : "opacity-0"}`}>
        {children}
      </div>

      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Voltar ao topo"
        className={`fixed bottom-5 right-5 z-50 grid h-11 w-11 place-items-center rounded-2xl border border-white/80 bg-slate-950/90 text-white shadow-[0_18px_45px_-20px_rgba(15,23,42,.9)] backdrop-blur transition duration-200 hover:-translate-y-1 hover:bg-[#003b70] focus:outline-none focus:ring-4 focus:ring-cyan-200 motion-reduce:transition-none ${showTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}
      >
        <ArrowUp className="h-5 w-5" />
      </button>
    </>
  );
}
