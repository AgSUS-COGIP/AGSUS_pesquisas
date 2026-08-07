"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PersonAvatar } from "@/components/person-avatar";
import { ExternalImage } from "@/components/external-image";
import { usePlatformBranding } from "@/components/platform-branding-provider";
import { PlatformIcon } from "@/components/platform-icons";
import { PlatformThemeToggle } from "@/components/platform-theme-toggle";
import { PlatformCommandMenu } from "@/components/platform-command-menu";
import { Drawer } from "@/components/ui/overlay-panel";
import {
  isPlatformNavItemActive,
  navigationGroupsForModules,
  type PlatformNavGroup,
} from "@/lib/platform-navigation";
import {
  isPlatformSidebarCompact,
  PLATFORM_SIDEBAR_ATTRIBUTE,
  PLATFORM_SIDEBAR_STORAGE_KEY,
} from "@/lib/platform-sidebar";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import type { PlatformBranding } from "@/lib/platform-branding";
const MOBILE_NAVIGATION_ID = "platform-mobile-navigation";

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

function BrandLockup({ compact, branding, mobile = false }: { compact: boolean; branding: PlatformBranding; mobile?: boolean }) {
  const showName = !compact || mobile;
  return (
    <Link
      href="/area"
      aria-label="AgSUS Pesquisas — ir para a visão geral"
      className={`flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200 ${compact && !mobile ? "justify-center" : ""}`}
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200/80 bg-white shadow-[0_8px_22px_-18px_rgba(7,59,98,.8)]">
        <ExternalImage src={branding.logoUrl} alt="" width={32} height={32} sizes="32px" className="h-8 w-8 object-contain" />
      </span>
      {showName ? (
        <span className="min-w-0 leading-none">
          <span className="block truncate text-[9px] font-black uppercase tracking-[.2em] text-[var(--brand-secondary)]">{branding.organizationName}</span>
          <span className={`mt-1 block truncate text-sm font-black tracking-tight ${mobile ? "text-[var(--text-primary)]" : "text-[var(--sidebar-foreground)]"}`}>{branding.productName}</span>
        </span>
      ) : null}
    </Link>
  );
}

function NavGroup({ group, pathname, compact, onNavigate }: { group: PlatformNavGroup; pathname: string; compact: boolean; onNavigate?: () => void }) {
  return (
    <section className="mt-4" aria-labelledby={`nav-group-${group.title.toLowerCase()}`}>
      {!compact ? <p id={`nav-group-${group.title.toLowerCase()}`} className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{group.title}</p> : null}
      <nav className="mt-2 space-y-1" aria-label={compact ? `Navegação — ${group.title}` : undefined}>
        {group.items.map((item) => {
          const active = isPlatformNavItemActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              title={compact ? item.label : undefined}
              aria-label={compact ? `${item.label}: ${item.description}` : undefined}
              aria-current={active ? "page" : undefined}
              className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-sm font-bold transition-colors ${active ? "bg-[var(--brand-primary)] text-white shadow-[0_10px_24px_-18px_rgba(7,59,98,.95)]" : "text-slate-600 hover:bg-slate-100 hover:text-[var(--brand-primary)]"} ${compact ? "justify-center" : ""}`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${active ? "bg-white/10" : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-[var(--brand-primary)]"}`} aria-hidden="true">
                <PlatformIcon name={item.icon} className="h-[18px] w-[18px]" />
              </span>
              {!compact ? <span className="truncate">{item.label}</span> : null}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

function SidebarContent({ user, branding, compact, modules, mobile = false, onNavigate, onToggle, onSignOut }: { user: PlatformUser; branding: PlatformBranding; compact: boolean; modules: string[]; mobile?: boolean; onNavigate?: () => void; onToggle?: () => void; onSignOut: () => void }) {
  const pathname = usePathname();
  const groups = navigationGroupsForModules(modules);

  return (
    <div className={`relative flex h-full min-h-0 flex-col overflow-hidden ${mobile ? "bg-[var(--surface-card)] text-[var(--text-primary)]" : "bg-[var(--sidebar-background)] text-[var(--sidebar-foreground)]"}`}>
      <div className={`flex h-16 shrink-0 items-center border-b border-[var(--border-subtle)] px-3 ${compact && !mobile ? "justify-center" : ""}`}>
        <BrandLockup compact={compact} branding={branding} mobile={mobile} />
      </div>
      {!mobile ? (
        <button
          type="button"
          onClick={onToggle}
          className="absolute -right-3 top-[76px] z-10 grid h-8 w-8 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-sky-200 hover:text-[var(--brand-primary)]"
          aria-label={compact ? "Expandir menu lateral" : "Recolher menu lateral"}
          aria-expanded={!compact}
        >
          <PlatformIcon name={compact ? "chevron-right" : "chevron-left"} className="h-4 w-4" />
        </button>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2.5 pb-4">
        {groups.map((group) => <NavGroup key={group.title} group={group} pathname={pathname} compact={compact && !mobile} onNavigate={onNavigate} />)}
      </div>
      <div className={`shrink-0 border-t border-[var(--border-subtle)] p-2.5 ${mobile ? "bg-[var(--surface-card)]" : "bg-transparent"}`}>
        <div className={`mb-1 ${compact && !mobile ? "flex justify-center" : ""}`}>
          <PlatformThemeToggle compact={compact && !mobile} sidebar />
        </div>
        <Link href="/perfil" onClick={onNavigate} className={`flex min-h-11 items-center gap-2 rounded-xl p-2 transition hover:bg-[var(--surface-hover)] ${compact && !mobile ? "justify-center" : ""}`} aria-label={`Abrir perfil de ${user.fullName}`}>
          <Avatar user={user} compact />
          {(!compact || mobile) ? <span className="min-w-0"><strong className={`block truncate text-xs ${mobile ? "text-[var(--text-primary)]" : "text-[var(--sidebar-foreground)]"}`}>{user.fullName}</strong><span className={`block truncate text-[11px] ${mobile ? "text-[var(--text-secondary)]" : "text-[var(--sidebar-muted)]"}`}>{user.profileLabel}</span></span> : null}
        </Link>
        <button type="button" onClick={onSignOut} aria-label="Sair da sessão atual" className={`mt-1 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 ${compact && !mobile ? "px-2" : ""}`}>
          <PlatformIcon name="logout" className="h-4 w-4" />
          {(!compact || mobile) ? "Sair" : null}
        </button>
      </div>
    </div>
  );
}

function DesktopSidebar({ user, branding, compact, modules, onToggle, onSignOut }: { user: PlatformUser; branding: PlatformBranding; compact: boolean; modules: string[]; onToggle: () => void; onSignOut: () => void }) {
  return (
    <aside data-print-hidden="true" aria-label="Navegação principal" className="platform-desktop-sidebar fixed left-0 top-0 z-50 hidden h-dvh max-h-dvh flex-col overflow-hidden border-r border-slate-200 bg-white shadow-[12px_0_35px_-28px_rgba(15,23,42,.35)] transition-[width] duration-300 lg:flex">
      <SidebarContent user={user} branding={branding} compact={compact} modules={modules} onToggle={onToggle} onSignOut={onSignOut} />
    </aside>
  );
}

export function PlatformShell({ user, title, eyebrow, children, actions }: { user: PlatformUser; title: string; eyebrow?: string; children: ReactNode; actions?: ReactNode }) {
  const { branding } = usePlatformBranding();
  const pathname = usePathname();
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const modules = user.modules ?? ["HOME", "SURVEYS", "DASHBOARDS", "RESULTS"];

  useEffect(() => {
    setCompact(isPlatformSidebarCompact(document.documentElement.getAttribute(PLATFORM_SIDEBAR_ATTRIBUTE)));
  }, []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  function toggleCompact() {
    setCompact((current) => {
      const next = !current;
      window.localStorage.setItem(PLATFORM_SIDEBAR_STORAGE_KEY, String(next));
      document.documentElement.setAttribute(PLATFORM_SIDEBAR_ATTRIBUTE, String(next));
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
    <div className="min-h-screen overflow-x-clip bg-[var(--surface-page)] text-[var(--text-primary)]">
      <a href="#conteudo-principal" className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-[var(--surface-card)] px-4 py-2 font-bold text-[var(--brand-primary)] shadow-lg transition focus:translate-y-0">Ir para o conteúdo</a>
      <DesktopSidebar user={user} branding={branding} compact={compact} modules={modules} onToggle={toggleCompact} onSignOut={signOut} />
      <Drawer
        id={MOBILE_NAVIGATION_ID}
        open={mobileOpen}
        onOpenChange={setMobileOpen}
        title="Navegação principal"
        description="Acesse os módulos disponíveis para o seu perfil."
        side="left"
        className="max-w-[20rem]"
        contentClassName="flex p-0 sm:p-0"
        closeLabel="Fechar menu"
      >
        <SidebarContent user={user} branding={branding} compact={false} modules={modules} mobile onNavigate={() => setMobileOpen(false)} onSignOut={signOut} />
      </Drawer>
      <div className="platform-shell-content min-w-0 transition-[padding] duration-300">
        <header data-print-hidden="true" className="sticky top-0 z-40 border-b border-[var(--border-subtle)] bg-[var(--surface-overlay)] px-4 shadow-[0_8px_28px_-26px_rgba(15,23,42,.8)] backdrop-blur-xl sm:px-5 lg:px-6">
          <div className="mx-auto flex min-h-16 max-w-[1560px] items-center justify-between gap-3 py-2">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => setMobileOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-[var(--brand-primary)] shadow-sm lg:hidden" aria-label="Abrir menu" aria-expanded={mobileOpen} aria-controls={MOBILE_NAVIGATION_ID}>
                <PlatformIcon name="menu" />
              </button>
              <div className="min-w-0">
                {eyebrow ? <p className="truncate text-[10px] font-black uppercase tracking-[.18em] text-[var(--brand-secondary)]">{eyebrow}</p> : null}
                <h1 className="truncate text-lg font-black tracking-tight text-[var(--brand-primary)] sm:text-xl">{title}</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <PlatformCommandMenu modules={modules} />
              {actions}
              <Link href="/perfil" className="hidden min-h-11 items-center gap-2 rounded-xl border border-transparent px-1.5 py-1 transition hover:border-[var(--border-subtle)] hover:bg-[var(--surface-hover)] sm:flex" aria-label={`Abrir perfil de ${user.fullName}`}>
                <Avatar user={user} compact />
                <span className="hidden max-w-40 text-left xl:block"><strong className="block truncate text-xs text-[var(--text-primary)]">{user.fullName}</strong><span className="block truncate text-xs text-[var(--text-secondary)]">{user.profileLabel}</span></span>
              </Link>
            </div>
          </div>
        </header>
        <main id="conteudo-principal" tabIndex={-1} className="mx-auto min-w-0 max-w-[1560px] px-4 py-5 outline-none sm:px-5 lg:px-6 lg:py-6">{children}</main>
      </div>
    </div>
  );
}

export { PlatformSkeleton } from "@/components/platform-skeleton";
