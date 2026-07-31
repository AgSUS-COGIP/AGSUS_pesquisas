"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { PlatformCommandMenu } from "@/components/platform-command-menu";
import { PlatformIcon, PlatformIconName } from "@/components/platform-icons";
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

type NavItem = { href: string; label: string; icon: PlatformIconName; module?: string };

const mainItems: NavItem[] = [
  { href: "/area", label: "Visão geral", icon: "home", module: "HOME" },
  { href: "/pesquisas", label: "Pesquisas", icon: "surveys", module: "SURVEYS" },
  { href: "/paineis", label: "Painéis", icon: "dashboard", module: "DASHBOARDS" },
];
const workItems: NavItem[] = [
  { href: "/equipe", label: "Minha equipe", icon: "team", module: "TEAM" },
  { href: "/resultados", label: "Resultados", icon: "results", module: "RESULTS" },
];
const adminItems: NavItem[] = [
  { href: "/admin", label: "Central administrativa", icon: "admin", module: "ADMIN_SURVEYS" },
  { href: "/admin/pesquisas", label: "Pesquisas e ciclos", icon: "edit", module: "ADMIN_SURVEYS" },
  { href: "/admin/participantes", label: "Participantes", icon: "users", module: "ADMIN_PARTICIPANTS" },
  { href: "/admin/equipes", label: "Equipes e lideranças", icon: "hierarchy", module: "ADMIN_TEAMS" },
  { href: "/admin/acessos", label: "Acessos e permissões", icon: "settings", module: "ADMIN_ACCESS" },
  { href: "/admin/importacao", label: "Importações", icon: "import", module: "ADMIN_IMPORT" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase() || "--";
}

function Avatar({ user, size = "md" }: { user: PlatformUser; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  const dimensions = size === "sm" ? "h-10 w-10 rounded-2xl" : "h-12 w-12 rounded-[1.15rem]";
  const showImage = Boolean(user.avatarUrl && !failed);

  if (showImage) {
    return (
      <span className={`${dimensions} grid shrink-0 place-items-center overflow-hidden bg-white shadow-[0_10px_25px_-14px_rgba(15,23,42,.65)] ring-1 ring-white/70`}>
        <img src={user.avatarUrl ?? ""} onError={() => setFailed(true)} alt={`Avatar de ${user.fullName}`} className="h-full w-full object-contain" />
      </span>
    );
  }

  return (
    <div aria-label={`Avatar de ${user.fullName}`} className={`grid ${dimensions} shrink-0 place-items-center bg-[radial-gradient(circle_at_25%_20%,#ffffff,#dff4ff_65%,#bce7ff)] font-black text-[#003b70] shadow-[0_10px_25px_-14px_rgba(15,23,42,.65)] ring-1 ring-white/70`}>
      {initials(user.fullName)}
    </div>
  );
}

function isItemActive(pathname: string, item: NavItem) {
  if (item.href === "/area" || item.href === "/admin") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavGroup({ title, items, modules, compact, onNavigate }: { title: string; items: NavItem[]; modules: string[]; compact: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const allowed = items.filter((item) => !item.module || modules.includes(item.module));
  if (!allowed.length) return null;

  return (
    <section className="mt-6" aria-label={title}>
      {!compact && <p className="px-3 text-[10px] font-black uppercase tracking-[0.2em] text-cyan-200/70">{title}</p>}
      <nav className="mt-2 space-y-1.5">
        {allowed.map((item) => {
          const active = isItemActive(pathname, item);
          return (
            <Link key={item.href} href={item.href} onClick={onNavigate} title={compact ? item.label : undefined} aria-current={active ? "page" : undefined} className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl px-3 py-3 text-sm font-extrabold transition duration-200 ${active ? "bg-white text-[#003b70] shadow-[0_14px_30px_-20px_rgba(0,0,0,.8)]" : "text-blue-50/90 hover:bg-white/10 hover:text-white"}`}>
              {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-[linear-gradient(#2dd4bf,#38bdf8)]" />}
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl transition ${active ? "bg-[linear-gradient(145deg,#e6f7ff,#effdf8)] text-[#075e8f]" : "bg-white/[.06] group-hover:bg-white/10"}`}><PlatformIcon name={item.icon} className="h-5 w-5" /></span>
              {!compact && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

function Sidebar({ user, compact, modules, mobile, onNavigate, onToggle, onSignOut }: { user: PlatformUser; compact: boolean; modules: string[]; mobile?: boolean; onNavigate?: () => void; onToggle?: () => void; onSignOut: () => void }) {
  return (
    <aside className={`${mobile ? "fixed inset-y-0 left-0 z-[70] flex w-72" : `fixed inset-y-0 left-0 z-50 hidden lg:flex ${compact ? "w-[5.25rem]" : "w-[17rem]"}`} isolate flex-col overflow-hidden bg-[radial-gradient(circle_at_20%_0%,rgba(45,212,191,.18),transparent_32%),radial-gradient(circle_at_110%_70%,rgba(56,189,248,.16),transparent_34%),linear-gradient(180deg,#022d52,#001d38)] text-white shadow-[20px_0_70px_-45px_rgba(2,23,42,.95)] transition-all duration-300`}>
      <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-gradient-to-b from-white/20 via-cyan-300/20 to-transparent" />
      <div className={`flex items-center gap-3 border-b border-white/10 px-4 py-5 ${compact && !mobile ? "justify-center" : ""}`}>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[1.1rem] bg-white shadow-[0_14px_30px_-18px_rgba(0,0,0,.8)]"><img src={LOGO_AGSUS} alt="AgSUS" className="h-9 w-9 object-contain" /></div>
        {(!compact || mobile) && <div className="min-w-0"><p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">AgSUS</p><p className="truncate text-base font-black">Pesquisas e Avaliações</p></div>}
      </div>
      {!mobile && <button type="button" onClick={onToggle} className="absolute -right-4 top-24 z-10 grid h-8 w-8 place-items-center rounded-full border border-cyan-100 bg-white text-[#003b70] shadow-lg transition hover:scale-105" aria-label={compact ? "Expandir menu" : "Recolher menu"}><PlatformIcon name={compact ? "chevron-right" : "chevron-left"} className="h-4 w-4" /></button>}
      <div className="flex-1 overflow-y-auto px-3 pb-4">
        <NavGroup title="Principal" items={mainItems} modules={modules} compact={compact && !mobile} onNavigate={onNavigate} />
        <NavGroup title="Atuação" items={workItems} modules={modules} compact={compact && !mobile} onNavigate={onNavigate} />
        <NavGroup title="Equipe Técnica" items={adminItems} modules={modules} compact={compact && !mobile} onNavigate={onNavigate} />
      </div>
      <div className="border-t border-white/10 p-3"><div className={`rounded-[1.4rem] border border-white/10 bg-white/[.07] p-3 shadow-inner backdrop-blur ${compact && !mobile ? "text-center" : ""}`}>
        <Link href="/perfil" onClick={onNavigate} className={`flex items-center gap-3 rounded-xl ${compact && !mobile ? "justify-center" : ""}`}><Avatar user={user} size="sm" />{(!compact || mobile) && <div className="min-w-0"><strong className="block truncate text-sm">{user.fullName}</strong><span className="text-xs text-cyan-100/75">{user.profileLabel}</span></div>}</Link>
        <button type="button" onClick={onSignOut} className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 px-3 py-2 text-sm font-bold text-blue-50 transition hover:bg-white/10 ${compact && !mobile ? "px-2" : ""}`}><PlatformIcon name="logout" className="h-4 w-4" />{(!compact || mobile) && "Sair do sistema"}</button>
      </div></div>
    </aside>
  );
}

export function PlatformShell({ user, title, eyebrow, children, actions }: { user: PlatformUser; title: string; eyebrow?: string; children: ReactNode; actions?: ReactNode }) {
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const modules = user.modules ?? ["HOME", "SURVEYS", "DASHBOARDS", "RESULTS"];

  useEffect(() => { setCompact(window.localStorage.getItem("agsus-sidebar-compact") === "true"); }, []);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  function toggleCompact() {
    setCompact((current) => {
      const next = !current;
      window.localStorage.setItem("agsus-sidebar-compact", String(next));
      return next;
    });
  }

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    window.location.replace("/acesso");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_85%_5%,rgba(14,165,233,.08),transparent_24%),linear-gradient(180deg,#f7fafc,#eef4f8)] text-[#10243e]">
      <a href="#conteudo-principal" className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-xl bg-white px-4 py-3 font-black text-[#003b70] shadow-xl transition focus:translate-y-0">Ir para o conteúdo</a>
      <Sidebar user={user} compact={compact} modules={modules} onToggle={toggleCompact} onSignOut={signOut} />
      {mobileOpen && <><button aria-label="Fechar menu" className="fixed inset-0 z-[60] bg-slate-950/50 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} /><Sidebar user={user} compact={false} modules={modules} mobile onNavigate={() => setMobileOpen(false)} onSignOut={signOut} /></>}
      <div className={`transition-all duration-300 ${compact ? "lg:pl-[5.25rem]" : "lg:pl-[17rem]"}`}>
        <header className="sticky top-0 z-40 border-b border-white/70 bg-white/75 px-4 py-3 shadow-[0_12px_35px_-30px_rgba(15,23,42,.75)] backdrop-blur-xl lg:px-7 lg:py-4">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => setMobileOpen(true)} className="grid h-10 w-10 place-items-center rounded-2xl border border-slate-200 bg-white text-[#003b70] shadow-sm lg:hidden" aria-label="Abrir menu"><PlatformIcon name="menu" /></button><div className="min-w-0">{eyebrow && <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#0b8f58]">{eyebrow}</p>}<h1 className="truncate text-xl font-black tracking-tight text-[#003b70] sm:text-2xl">{title}</h1></div></div>
            <div className="flex items-center gap-3"><PlatformCommandMenu modules={modules} />{actions}<Link href="/perfil" className="hidden items-center gap-3 rounded-[1.2rem] border border-white bg-white/80 px-3 py-2 shadow-[0_12px_30px_-22px_rgba(15,23,42,.8)] ring-1 ring-slate-200/70 transition hover:-translate-y-0.5 hover:bg-white sm:flex"><Avatar user={user} size="sm" /><div className="hidden text-left xl:block"><strong className="block max-w-40 truncate text-xs text-slate-800">{user.fullName}</strong><span className="text-[11px] text-slate-500">{user.profileLabel}</span></div></Link></div>
          </div>
        </header>
        <div id="conteudo-principal" tabIndex={-1} className="mx-auto max-w-[1500px] px-4 py-5 outline-none sm:px-5 lg:px-7 lg:py-7">{children}</div>
      </div>
    </main>
  );
}

export function PlatformSkeleton({ title = "Carregando" }: { title?: string }) {
  return <main className="min-h-screen bg-slate-100"><aside className="fixed inset-y-0 left-0 hidden w-[17rem] bg-[#003b70] lg:block"><div className="border-b border-white/10 p-5"><div className="h-12 w-44 animate-pulse rounded-2xl bg-white/15" /></div><div className="space-y-3 p-4">{Array.from({ length: 7 }).map((_, i) => <div key={i} className="h-11 animate-pulse rounded-2xl bg-white/10" />)}</div></aside><div className="lg:pl-[17rem]"><header className="h-[78px] border-b border-white bg-white/80 px-7 py-5"><div className="h-7 w-72 animate-pulse rounded-lg bg-slate-200" /></header><div className="mx-auto max-w-[1500px] px-5 py-7"><p className="sr-only">{title}</p><div className="h-48 animate-pulse rounded-[2rem] bg-gradient-to-r from-[#06487d] to-[#0a6d9b]" /><div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-36 animate-pulse rounded-3xl bg-white ring-1 ring-slate-200" />)}</div></div></div></main>;
}
