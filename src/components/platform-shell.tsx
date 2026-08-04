"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PersonAvatar } from "@/components/person-avatar";
import { PlatformCommandMenu } from "@/components/platform-command-menu";
import { PlatformIcon } from "@/components/platform-icons";
import {
  isPlatformNavItemActive,
  navigationGroupsForModules,
  type PlatformNavGroup,
} from "@/lib/platform-navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const LOGO_AGSUS = "https://i.postimg.cc/7PztC6jq/79255fad-06f0-4963-81f5-1fa4a116475e.png";

type PlatformUser = {
  fullName: string;
  institutionalEmail?: string | null;
  employeeNumber?: string | null;
  profileLabel: string;
  avatarUrl?: string | null;
  roles?: string[];
  modules?: string[];
};

function Avatar({ user, compact = false }: { user: PlatformUser; compact?: boolean }) {
  return (
    <PersonAvatar
      fullName={user.fullName}
      avatarUrl={user.avatarUrl}
      className={compact ? "h-9 w-9 rounded-xl" : "h-10 w-10 rounded-xl"}
      fallbackClassName="text-sm"
    />
  );
}

function BrandLockup({ compact, mobile = false }: { compact: boolean; mobile?: boolean }) {
  const showName = !compact || mobile;
  return (
    <Link
      href="/area"
      aria-label="AgSUS Pesquisas — ir para a visão geral"
      className={`flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${compact && !mobile ? "justify-center" : ""}`}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200/80 bg-white shadow-[0_8px_22px_-18px_rgba(7,59,98,.8)]">
        <Image src={LOGO_AGSUS} alt="" width={32} height={32} sizes="32px" className="h-8 w-8 object-contain" />
      </span>
      {showName && (
        <span className="min-w-0 leading-none">
          <span className="block text-[9px] font-black uppercase tracking-[.2em] text-emerald-700">AgSUS</span>
          <span className="mt-1 block truncate text-sm font-black tracking-tight text-[var(--brand-primary)]">Pesquisas</span>
        </span>
      )}
    </Link>
  );
}

function NavGroup({ group, pathname, compact, onNavigate }: { group: PlatformNavGroup; pathname: string; compact: boolean; onNavigate?: () => void }) {
  return (
    <section className="mt-4" aria-label={group.title}>
      {!compact && <p className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{group.title}</p>}
      <nav className="mt-2 space-y-1">
        {group.items.map((item) => {
          const active = isPlatformNavItemActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={compact ? item.label : undefined}
              aria-current={active ? "page" : undefined}
              className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-sm font-bold transition-colors ${active ? "bg-[var(--brand-primary)] text-white shadow-[0_10px_24px_-18px_rgba(7,59,98,.95)]" : "text-slate-600 hover:bg-slate-100 hover:text-[var(--brand-primary)]"} ${compact ? "justify-center" : ""}`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${active ? "bg-white/10" : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-[var(--brand-primary)]"}`}>
                <PlatformIcon name={item.icon} className="h-[18px] w-[18px]" />
              </span>
              {!compact && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

function Sidebar({ user, compact, modules, mobile, onNavigate, onToggle, onSignOut }: { user: PlatformUser; compact: boolean; modules: string[]; mobile?: boolean; onNavigate?: () => void; onToggle?: () => void; onSignOut: () => void }) {
  const pathname = usePathname();
  const groups = navigationGroupsForModules(modules);
  const width = compact && !mobile ? "w-[4.5rem]" : "w-56";

  return (
    <aside data-print-hidden="true" className={`${mobile ? "fixed inset-y-0 left-0 z-[70] flex" : "fixed inset-y-0 left-0 z-50 hidden lg:flex"} ${width} flex-col border-r border-slate-200 bg-white text-slate-800 shadow-[12px_0_35px_-28px_rgba(15,23,42,.35)] transition-[width] duration-300`}>
      <div className={`flex h-16 items-center border-b border-slate-100 px-3 ${compact && !mobile ? "justify-center" : ""}`}>
        <BrandLockup compact={compact} mobile={mobile} />
      </div>
      {!mobile && (
        <button
          type="button"
          onClick={onToggle}
          className="absolute -right-3 top-[76px] z-10 grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-sky-200 hover:text-[var(--brand-primary)]"
          aria-label={compact ? "Expandir menu" : "Recolher menu"}
          aria-expanded={!compact}
        >
          <PlatformIcon name={compact ? "chevron-right" : "chevron-left"} className="h-4 w-4" />
        </button>
      )}
      <div className="flex-1 overflow-y-auto px-2.5 pb-4">
        {groups.map((group) => <NavGroup key={group.title} group={group} pathname={pathname} compact={compact && !mobile} onNavigate={onNavigate} />)}
      </div>
      <div className="border-t border-slate-100 p-2.5">
        <Link href="/perfil" onClick={onNavigate} className={`flex items-center gap-2 rounded-xl p-2 transition hover:bg-slate-50 ${compact && !mobile ? "justify-center" : ""}`} aria-label="Abrir meu perfil">
          <Avatar user={user} compact />
          {(!compact || mobile) && <span className="min-w-0"><strong className="block truncate text-xs text-slate-800">{user.fullName}</strong><span className="block truncate text-[11px] text-slate-500">{user.profileLabel}</span></span>}
        </Link>
        <button type="button" onClick={onSignOut} className={`mt-1 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 ${compact && !mobile ? "px-2" : ""}`}>
          <PlatformIcon name="logout" className="h-4 w-4" />
          {(!compact || mobile) && "Sair"}
        </button>
      </div>
    </aside>
  );
}

export function PlatformShell({ user, title, eyebrow, children, actions }: { user: PlatformUser; title: string; eyebrow?: string; children: ReactNode; actions?: ReactNode }) {
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const modules = user.modules ?? ["HOME", "SURVEYS", "DASHBOARDS", "RESULTS"];

  useEffect(() => { setCompact(window.localStorage.getItem("agsus-sidebar-compact") === "true"); }, []);
  useEffect(() => { document.body.style.overflow = mobileOpen ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [mobileOpen]);

  function toggleCompact() {
    setCompact((current) => {
      const next = !current;
      window.localStorage.setItem("agsus-sidebar-compact", String(next));
      return next;
    });
  }

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) {
      toast.error("Não foi possível encerrar esta sessão. Tente novamente.");
      return;
    }
    window.location.replace("/acesso");
  }

  return (
    <main className="min-h-screen bg-[var(--surface-page)] text-[var(--text-primary)]">
      <a href="#conteudo-principal" className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-white px-4 py-2 font-bold text-[var(--brand-primary)] shadow-lg transition focus:translate-y-0">Ir para o conteúdo</a>
      <Sidebar user={user} compact={compact} modules={modules} onToggle={toggleCompact} onSignOut={signOut} />
      {mobileOpen && (
        <>
          <button aria-label="Fechar menu" className="fixed inset-0 z-[60] bg-slate-950/35 backdrop-blur-[2px] lg:hidden" onClick={() => setMobileOpen(false)} />
          <Sidebar user={user} compact={false} modules={modules} mobile onNavigate={() => setMobileOpen(false)} onSignOut={signOut} />
        </>
      )}
      <div className={`transition-[padding] duration-300 ${compact ? "lg:pl-[4.5rem]" : "lg:pl-56"}`}>
        <header data-print-hidden="true" className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/[.92] px-4 shadow-[0_8px_28px_-26px_rgba(15,23,42,.8)] backdrop-blur-xl sm:px-5 lg:px-6">
          <div className="mx-auto flex h-16 max-w-[1560px] items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => setMobileOpen(true)} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-[var(--brand-primary)] shadow-sm lg:hidden" aria-label="Abrir menu" aria-expanded={mobileOpen}>
                <PlatformIcon name="menu" />
              </button>
              <div className="min-w-0">
                {eyebrow && <p className="truncate text-[9px] font-black uppercase tracking-[.18em] text-[var(--brand-secondary)]">{eyebrow}</p>}
                <h1 className="truncate text-lg font-black tracking-tight text-[var(--brand-primary)] sm:text-xl">{title}</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <PlatformCommandMenu modules={modules} />
              {actions}
              <Link href="/perfil" className="hidden items-center gap-2 rounded-xl border border-transparent px-1.5 py-1 transition hover:border-slate-200 hover:bg-slate-50 sm:flex" aria-label={`Abrir perfil de ${user.fullName}`}>
                <Avatar user={user} compact />
                <span className="hidden max-w-40 text-left xl:block"><strong className="block truncate text-xs text-slate-800">{user.fullName}</strong><span className="block truncate text-[10px] text-slate-500">{user.profileLabel}</span></span>
              </Link>
            </div>
          </div>
        </header>
        <div id="conteudo-principal" tabIndex={-1} className="mx-auto max-w-[1560px] px-4 py-5 outline-none sm:px-5 lg:px-6 lg:py-6">{children}</div>
      </div>
    </main>
  );
}

export { PlatformSkeleton } from "@/components/platform-skeleton";
