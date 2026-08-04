"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { PersonAvatar } from "@/components/person-avatar";
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
  { href: "/admin", label: "Administração", icon: "admin", module: "ADMIN_SURVEYS" },
  { href: "/admin/pesquisas", label: "Pesquisas e ciclos", icon: "edit", module: "ADMIN_SURVEYS" },
  { href: "/admin/participantes", label: "Participantes", icon: "users", module: "ADMIN_PARTICIPANTS" },
  { href: "/admin/equipes", label: "Equipes", icon: "hierarchy", module: "ADMIN_TEAMS" },
  { href: "/admin/acessos", label: "Acessos", icon: "settings", module: "ADMIN_ACCESS" },
  { href: "/admin/importacao", label: "Importações", icon: "import", module: "ADMIN_IMPORT" },
];

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

function isItemActive(pathname: string, item: NavItem) {
  if (item.href === "/area" || item.href === "/admin") return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavGroup({ title, items, modules, compact, onNavigate }: { title: string; items: NavItem[]; modules: string[]; compact: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const allowed = items.filter((item) => !item.module || modules.includes(item.module));
  if (!allowed.length) return null;
  return <section className="mt-5" aria-label={title}>{!compact && <p className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{title}</p>}<nav className="mt-2 space-y-1">{allowed.map((item) => { const active = isItemActive(pathname, item); return <Link key={item.href} href={item.href} onClick={onNavigate} title={compact ? item.label : undefined} aria-current={active ? "page" : undefined} className={`group flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition ${active ? "bg-[#003b70] text-white shadow-sm" : "text-slate-600 hover:bg-slate-100 hover:text-[#003b70]"}`}><span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? "bg-white/12" : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-[#003b70]"}`}><PlatformIcon name={item.icon} className="h-4.5 w-4.5" /></span>{!compact && <span className="truncate">{item.label}</span>}</Link>; })}</nav></section>;
}

function Sidebar({ user, compact, modules, mobile, onNavigate, onToggle, onSignOut }: { user: PlatformUser; compact: boolean; modules: string[]; mobile?: boolean; onNavigate?: () => void; onToggle?: () => void; onSignOut: () => void }) {
  const width = compact && !mobile ? "w-[4.75rem]" : "w-[14.5rem]";
  return <aside className={`${mobile ? "fixed inset-y-0 left-0 z-[70] flex" : "fixed inset-y-0 left-0 z-50 hidden lg:flex"} ${width} flex-col border-r border-slate-200 bg-white text-slate-800 shadow-[12px_0_35px_-28px_rgba(15,23,42,.35)] transition-all duration-300`}><div className={`flex h-[72px] items-center gap-3 border-b border-slate-100 px-3 ${compact && !mobile ? "justify-center" : ""}`}><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white ring-1 ring-slate-200"><img src={LOGO_AGSUS} alt="AgSUS" className="h-8 w-8 object-contain" /></div>{(!compact || mobile) && <div className="min-w-0"><p className="text-[9px] font-black uppercase tracking-[.2em] text-emerald-700">AgSUS</p><p className="truncate text-sm font-black text-[#003b70]">Pesquisas</p></div>}</div>{!mobile && <button type="button" onClick={onToggle} className="absolute -right-3 top-[84px] z-10 grid h-7 w-7 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:text-[#003b70]" aria-label={compact ? "Expandir menu" : "Recolher menu"}><PlatformIcon name={compact ? "chevron-right" : "chevron-left"} className="h-4 w-4" /></button>}<div className="flex-1 overflow-y-auto px-2.5 pb-4"><NavGroup title="Principal" items={mainItems} modules={modules} compact={compact && !mobile} onNavigate={onNavigate} /><NavGroup title="Atuação" items={workItems} modules={modules} compact={compact && !mobile} onNavigate={onNavigate} /><NavGroup title="Administração" items={adminItems} modules={modules} compact={compact && !mobile} onNavigate={onNavigate} /></div><div className="border-t border-slate-100 p-2.5"><Link href="/perfil" onClick={onNavigate} className={`flex items-center gap-2 rounded-xl p-2 transition hover:bg-slate-50 ${compact && !mobile ? "justify-center" : ""}`}><Avatar user={user} compact />{(!compact || mobile) && <div className="min-w-0"><strong className="block truncate text-xs text-slate-800">{user.fullName}</strong><span className="block truncate text-[11px] text-slate-500">{user.profileLabel}</span></div>}</Link><button type="button" onClick={onSignOut} className={`mt-1 flex w-full items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 ${compact && !mobile ? "px-2" : ""}`}><PlatformIcon name="logout" className="h-4 w-4" />{(!compact || mobile) && "Sair"}</button></div></aside>;
}

export function PlatformShell({ user, title, eyebrow, children, actions }: { user: PlatformUser; title: string; eyebrow?: string; children: ReactNode; actions?: ReactNode }) {
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const modules = user.modules ?? ["HOME", "SURVEYS", "DASHBOARDS", "RESULTS"];

  useEffect(() => { setCompact(window.localStorage.getItem("agsus-sidebar-compact") === "true"); }, []);
  useEffect(() => { document.body.style.overflow = mobileOpen ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [mobileOpen]);

  function toggleCompact() { setCompact((current) => { const next = !current; window.localStorage.setItem("agsus-sidebar-compact", String(next)); return next; }); }
  async function signOut() { const supabase = createBrowserSupabaseClient(); await supabase.auth.signOut(); window.location.replace("/acesso"); }

  return <main className="min-h-screen bg-[#f6f8fb] text-[#17233a]"><a href="#conteudo-principal" className="fixed left-4 top-3 z-[100] -translate-y-20 rounded-lg bg-white px-4 py-2 font-bold text-[#003b70] shadow-lg transition focus:translate-y-0">Ir para o conteúdo</a><Sidebar user={user} compact={compact} modules={modules} onToggle={toggleCompact} onSignOut={signOut} />{mobileOpen && <><button aria-label="Fechar menu" className="fixed inset-0 z-[60] bg-slate-950/35 lg:hidden" onClick={() => setMobileOpen(false)} /><Sidebar user={user} compact={false} modules={modules} mobile onNavigate={() => setMobileOpen(false)} onSignOut={signOut} /></>}<div className={`transition-all duration-300 ${compact ? "lg:pl-[4.75rem]" : "lg:pl-[14.5rem]"}`}><header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/95 px-4 backdrop-blur lg:px-6"><div className="mx-auto flex h-[72px] max-w-[1380px] items-center justify-between gap-4"><div className="flex min-w-0 items-center gap-3"><button type="button" onClick={() => setMobileOpen(true)} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-[#003b70] lg:hidden" aria-label="Abrir menu"><PlatformIcon name="menu" /></button><div className="min-w-0">{eyebrow && <p className="text-[9px] font-black uppercase tracking-[.18em] text-emerald-700">{eyebrow}</p>}<h1 className="truncate text-xl font-black tracking-tight text-[#003b70]">{title}</h1></div></div><div className="flex items-center gap-2"><PlatformCommandMenu modules={modules} />{actions}<Link href="/perfil" className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-1.5 transition hover:border-sky-200 sm:flex"><Avatar user={user} compact /><div className="hidden max-w-40 text-left xl:block"><strong className="block truncate text-xs text-slate-800">{user.fullName}</strong><span className="block truncate text-[10px] text-slate-500">{user.profileLabel}</span></div></Link></div></div></header><div id="conteudo-principal" tabIndex={-1} className="mx-auto max-w-[1380px] px-4 py-5 outline-none sm:px-5 lg:px-6 lg:py-6">{children}</div></div></main>;
}

export { PlatformSkeleton } from "@/components/platform-skeleton";
