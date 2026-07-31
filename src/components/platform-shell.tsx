"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const LOGO_AGSUS = "https://i.postimg.cc/7PztC6jq/79255fad-06f0-4963-81f5-1fa4a116475e.png";

type PlatformUser = {
  fullName: string;
  institutionalEmail?: string | null;
  employeeNumber?: string | null;
  profileLabel: string;
  roles?: string[];
  modules?: string[];
};

type NavItem = {
  href: string;
  label: string;
  icon: string;
  module?: string;
};

const mainItems: NavItem[] = [
  { href: "/area", label: "Início", icon: "⌂", module: "HOME" },
  { href: "/pesquisas", label: "Pesquisas", icon: "▣", module: "SURVEYS" },
  { href: "/paineis", label: "Painéis", icon: "◫", module: "DASHBOARDS" },
];

const workItems: NavItem[] = [
  { href: "/equipe", label: "Minha equipe", icon: "♟", module: "TEAM" },
  { href: "/resultados", label: "Meus resultados", icon: "◔", module: "RESULTS" },
];

const adminItems: NavItem[] = [
  { href: "/admin/pesquisas", label: "Pesquisas e ciclos", icon: "✎", module: "ADMIN_SURVEYS" },
  { href: "/admin/participantes", label: "Participantes", icon: "♙", module: "ADMIN_PARTICIPANTS" },
  { href: "/admin/equipes", label: "Equipes e lideranças", icon: "♜", module: "ADMIN_TEAMS" },
  { href: "/admin/acessos", label: "Acessos e permissões", icon: "⚙", module: "ADMIN_ACCESS" },
  { href: "/admin/importacao", label: "Importações", icon: "⇩", module: "ADMIN_IMPORT" },
];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase() || "--";
}

function NavGroup({ title, items, modules, compact }: { title: string; items: NavItem[]; modules: string[]; compact: boolean }) {
  const pathname = usePathname();
  const allowed = items.filter((item) => !item.module || modules.includes(item.module));
  if (!allowed.length) return null;

  return (
    <div className="mt-6">
      {!compact && <p className="px-3 text-[10px] font-black uppercase tracking-[0.18em] text-blue-300">{title}</p>}
      <nav className="mt-2 space-y-1.5">
        {allowed.map((item) => {
          const active = pathname === item.href || (item.href !== "/area" && pathname.startsWith(`${item.href}/`));
          return (
            <Link
              key={item.href}
              href={item.href}
              title={compact ? item.label : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-extrabold transition ${
                active ? "bg-white text-[#003b70] shadow-sm" : "text-blue-50 hover:bg-white/10"
              }`}
            >
              <span className="grid h-7 w-7 shrink-0 place-items-center text-base">{item.icon}</span>
              {!compact && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function PlatformShell({
  user,
  title,
  eyebrow,
  children,
  actions,
}: {
  user: PlatformUser;
  title: string;
  eyebrow?: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const [compact, setCompact] = useState(false);
  const modules = user.modules ?? ["HOME", "SURVEYS", "DASHBOARDS", "RESULTS"];

  async function signOut() {
    const supabase = createBrowserSupabaseClient();
    await supabase.auth.signOut();
    window.location.replace("/acesso");
  }

  return (
    <main className="min-h-screen bg-[#f2f6fa] text-[#10243e]">
      <aside className={`fixed inset-y-0 left-0 z-50 hidden flex-col bg-[#003b70] text-white shadow-xl transition-all lg:flex ${compact ? "w-20" : "w-64"}`}>
        <div className={`flex items-center gap-3 border-b border-white/10 px-4 py-5 ${compact ? "justify-center" : ""}`}>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white shadow-sm">
            <img src={LOGO_AGSUS} alt="AgSUS" className="h-9 w-9 object-contain" />
          </div>
          {!compact && (
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">AgSUS</p>
              <p className="truncate text-base font-black">Pesquisas e Avaliações</p>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => setCompact((value) => !value)}
          className="absolute -right-4 top-24 grid h-8 w-8 place-items-center rounded-full border border-blue-200 bg-white font-black text-[#003b70] shadow-md"
          aria-label={compact ? "Expandir menu" : "Recolher menu"}
        >
          {compact ? ">" : "<"}
        </button>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <NavGroup title="Principal" items={mainItems} modules={modules} compact={compact} />
          <NavGroup title="Atuação" items={workItems} modules={modules} compact={compact} />
          <NavGroup title="Administração" items={adminItems} modules={modules} compact={compact} />
        </div>

        <div className="border-t border-white/10 p-3">
          <div className={`rounded-2xl border border-white/15 bg-white/10 p-3 ${compact ? "text-center" : ""}`}>
            <div className={`flex items-center gap-3 ${compact ? "justify-center" : ""}`}>
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white font-black text-[#003b70]">
                {initials(user.fullName)}
              </div>
              {!compact && (
                <div className="min-w-0">
                  <strong className="block truncate text-sm">{user.fullName}</strong>
                  <span className="text-xs text-blue-200">{user.profileLabel}</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={signOut}
              title={compact ? "Sair" : undefined}
              className="mt-3 w-full rounded-xl border border-white/20 px-3 py-2 text-sm font-bold transition hover:bg-white/10"
            >
              {compact ? "↪" : "Sair do sistema"}
            </button>
          </div>
        </div>
      </aside>

      <div className={`transition-all ${compact ? "lg:pl-20" : "lg:pl-64"}`}>
        <header className="sticky top-0 z-40 border-b border-[#d7e5f2] bg-white/95 px-5 py-4 shadow-sm backdrop-blur lg:px-7">
          <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-5">
            <div className="min-w-0">
              {eyebrow && <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#0b8f58]">{eyebrow}</p>}
              <h1 className="truncate text-2xl font-black text-[#003b70]">{title}</h1>
            </div>
            <div className="flex items-center gap-3">
              {actions}
              <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-800 sm:inline-flex">
                ● Sessão ativa
              </span>
              <button type="button" onClick={signOut} className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-black text-slate-700 lg:hidden">
                Sair
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-[1500px] px-5 py-6 lg:px-7">{children}</div>
      </div>
    </main>
  );
}

export function PlatformSkeleton({ title = "Carregando" }: { title?: string }) {
  return (
    <main className="min-h-screen bg-[#f2f6fa] text-[#10243e]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 bg-[#003b70] lg:block">
        <div className="border-b border-white/10 p-5">
          <div className="h-12 w-44 animate-pulse rounded-2xl bg-white/15" />
        </div>
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-11 animate-pulse rounded-xl bg-white/10" />)}
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="h-[82px] border-b border-[#d7e5f2] bg-white px-7 py-5">
          <div className="h-7 w-72 animate-pulse rounded-lg bg-slate-200" />
        </header>
        <div className="mx-auto max-w-[1500px] px-5 py-7 lg:px-7">
          <p className="sr-only">{title}</p>
          <div className="h-40 animate-pulse rounded-3xl bg-gradient-to-r from-[#06487d] to-[#0a6d9b]" />
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="rounded-3xl border border-[#d7e5f2] bg-white p-6">
                <div className="h-5 w-28 animate-pulse rounded bg-slate-200" />
                <div className="mt-5 h-7 w-3/4 animate-pulse rounded bg-slate-200" />
                <div className="mt-4 h-4 w-full animate-pulse rounded bg-slate-100" />
                <div className="mt-2 h-4 w-5/6 animate-pulse rounded bg-slate-100" />
                <div className="mt-8 h-12 animate-pulse rounded-xl bg-slate-100" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
