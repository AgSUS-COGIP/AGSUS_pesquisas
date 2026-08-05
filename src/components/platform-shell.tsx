"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { PersonAvatar } from "@/components/person-avatar";
import { PlatformCommandMenu } from "@/components/platform-command-menu";
import { PlatformIcon } from "@/components/platform-icons";
import { Drawer } from "@/components/ui/overlay-panel";
import {
  isPlatformNavItemActive,
  navigationGroupsForModules,
  type PlatformNavGroup,
} from "@/lib/platform-navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const LOGO_AGSUS = "https://i.postimg.cc/7PztC6jq/79255fad-06f0-4963-81f5-1fa4a116475e.png";
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

function Avatar({ user }: { user: PlatformUser }) {
  return (
    <PersonAvatar
      fullName={user.fullName}
      avatarUrl={user.avatarUrl}
      className="h-10 w-10 rounded-xl"
      fallbackClassName="text-sm"
    />
  );
}

function BrandLockup() {
  return (
    <Link
      href="/area"
      aria-label="AgSUS Pesquisas — ir para a visão geral"
      className="flex min-w-0 items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-200"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200/80 bg-white shadow-[0_8px_22px_-18px_rgba(7,59,98,.8)]">
        <Image src={LOGO_AGSUS} alt="" width={32} height={32} sizes="32px" className="h-8 w-8 object-contain" />
      </span>
      <span className="min-w-0 leading-none">
        <span className="block text-[9px] font-black uppercase tracking-[.2em] text-emerald-700">AgSUS</span>
        <span className="mt-1 block truncate text-sm font-black tracking-tight text-[var(--brand-primary)]">Pesquisas</span>
      </span>
    </Link>
  );
}

function NavGroup({ group, pathname, onNavigate }: { group: PlatformNavGroup; pathname: string; onNavigate?: () => void }) {
  return (
    <section className="mt-4" aria-labelledby={`nav-group-${group.title.toLowerCase()}`}>
      <p id={`nav-group-${group.title.toLowerCase()}`} className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{group.title}</p>
      <nav className="mt-2 space-y-1">
        {group.items.map((item) => {
          const active = isPlatformNavItemActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={`group relative flex min-h-11 items-center gap-3 rounded-xl px-2.5 text-sm font-bold transition-colors ${active ? "bg-[var(--brand-primary)] text-white shadow-[0_10px_24px_-18px_rgba(7,59,98,.95)]" : "text-slate-600 hover:bg-slate-100 hover:text-[var(--brand-primary)]"}`}
            >
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition-colors ${active ? "bg-white/10" : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-[var(--brand-primary)]"}`} aria-hidden="true">
                <PlatformIcon name={item.icon} className="h-[18px] w-[18px]" />
              </span>
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

function SidebarContent({ user, modules, onNavigate, onSignOut }: { user: PlatformUser; modules: string[]; onNavigate?: () => void; onSignOut: () => void }) {
  const pathname = usePathname();
  const groups = navigationGroupsForModules(modules);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-white text-slate-800">
      <div className="flex h-16 shrink-0 items-center border-b border-slate-100 px-3">
        <BrandLockup />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
        {groups.map((group) => <NavGroup key={group.title} group={group} pathname={pathname} onNavigate={onNavigate} />)}
      </div>
      <div className="shrink-0 border-t border-slate-100 p-2.5">
        <Link href="/perfil" onClick={onNavigate} className="flex min-h-11 items-center gap-2 rounded-xl p-2 transition hover:bg-slate-50" aria-label={`Abrir perfil de ${user.fullName}`}>
          <Avatar user={user} />
          <span className="min-w-0"><strong className="block truncate text-xs text-slate-800">{user.fullName}</strong><span className="block truncate text-[11px] text-slate-500">{user.profileLabel}</span></span>
        </Link>
        <button type="button" onClick={onSignOut} aria-label="Sair da sessão atual" className="mt-1 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800">
          <PlatformIcon name="logout" className="h-4 w-4" />
          Sair
        </button>
      </div>
    </div>
  );
}

function DesktopSidebar({ user, modules, onSignOut }: { user: PlatformUser; modules: string[]; onSignOut: () => void }) {
  return (
    <aside data-print-hidden="true" aria-label="Navegação principal" className="platform-desktop-sidebar fixed inset-y-0 left-0 z-50 hidden w-56 flex-col border-r border-slate-200 bg-white shadow-[12px_0_35px_-28px_rgba(15,23,42,.35)] lg:flex">
      <SidebarContent user={user} modules={modules} onSignOut={onSignOut} />
    </aside>
  );
}

export function PlatformShell({ user, title, eyebrow, children, actions }: { user: PlatformUser; title: string; eyebrow?: string; children: ReactNode; actions?: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const modules = user.modules ?? ["HOME", "SURVEYS", "DASHBOARDS", "RESULTS"];

  useEffect(() => { setMobileOpen(false); }, [pathname]);

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
    <div className="min-h-screen bg-[var(--surface-page)] text-[var(--text-primary)]">
      <a href="#conteudo-principal" className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-white px-4 py-2 font-bold text-[var(--brand-primary)] shadow-lg transition focus:translate-y-0">Ir para o conteúdo</a>
      <DesktopSidebar user={user} modules={modules} onSignOut={signOut} />
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
        <SidebarContent user={user} modules={modules} onNavigate={() => setMobileOpen(false)} onSignOut={signOut} />
      </Drawer>
      <div className="platform-shell-content lg:pl-56">
        <header data-print-hidden="true" className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/[.92] px-4 shadow-[0_8px_28px_-26px_rgba(15,23,42,.8)] backdrop-blur-xl sm:px-5 lg:px-6">
          <div className="mx-auto flex min-h-16 max-w-[1560px] items-center justify-between gap-3 py-2">
            <div className="flex min-w-0 items-center gap-3">
              <button type="button" onClick={() => setMobileOpen(true)} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white text-[var(--brand-primary)] shadow-sm lg:hidden" aria-label="Abrir menu" aria-expanded={mobileOpen} aria-controls={MOBILE_NAVIGATION_ID}>
                <PlatformIcon name="menu" />
              </button>
              <div className="min-w-0">
                {eyebrow && <p className="truncate text-[10px] font-black uppercase tracking-[.18em] text-[var(--brand-secondary)]">{eyebrow}</p>}
                <h1 className="truncate text-lg font-black tracking-tight text-[var(--brand-primary)] sm:text-xl">{title}</h1>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <PlatformCommandMenu modules={modules} />
              {actions}
              <Link href="/perfil" className="hidden min-h-11 items-center gap-2 rounded-xl border border-transparent px-1.5 py-1 transition hover:border-slate-200 hover:bg-slate-50 sm:flex" aria-label={`Abrir perfil de ${user.fullName}`}>
                <Avatar user={user} />
                <span className="hidden max-w-40 text-left xl:block"><strong className="block truncate text-xs text-slate-800">{user.fullName}</strong><span className="block truncate text-xs text-slate-500">{user.profileLabel}</span></span>
              </Link>
            </div>
          </div>
        </header>
        <main id="conteudo-principal" tabIndex={-1} className="mx-auto max-w-[1560px] px-4 py-5 outline-none sm:px-5 lg:px-6 lg:py-6">{children}</main>
      </div>
    </div>
  );
}

export { PlatformSkeleton } from "@/components/platform-skeleton";
