"use client";

import { Command } from "cmdk";
import {
  BarChart3,
  ClipboardList,
  FileSpreadsheet,
  Gauge,
  Search,
  Settings,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ComponentType } from "react";

type CommandItem = {
  label: string;
  description: string;
  href: string;
  module?: string;
  icon: ComponentType<{ className?: string }>;
  group: "Principal" | "Atuação" | "Administração";
};

const commands: CommandItem[] = [
  { label: "Visão geral", description: "Abrir o painel institucional", href: "/area", module: "HOME", icon: Gauge, group: "Principal" },
  { label: "Pesquisas", description: "Consultar formulários disponíveis", href: "/pesquisas", module: "SURVEYS", icon: ClipboardList, group: "Principal" },
  { label: "Painéis", description: "Abrir indicadores e análises", href: "/paineis", module: "DASHBOARDS", icon: BarChart3, group: "Principal" },
  { label: "Minha equipe", description: "Acompanhar pessoas e avaliações", href: "/equipe", module: "TEAM", icon: UsersRound, group: "Atuação" },
  { label: "Resultados", description: "Consultar resultados liberados", href: "/resultados", module: "RESULTS", icon: FileSpreadsheet, group: "Atuação" },
  { label: "Central administrativa", description: "Abrir a gestão da plataforma", href: "/admin", module: "ADMIN_SURVEYS", icon: ShieldCheck, group: "Administração" },
  { label: "Participantes", description: "Gerenciar público e elegibilidade", href: "/admin/participantes", module: "ADMIN_PARTICIPANTS", icon: UserRound, group: "Administração" },
  { label: "Importações", description: "Validar e processar planilhas", href: "/admin/importacao", module: "ADMIN_IMPORT", icon: FileSpreadsheet, group: "Administração" },
  { label: "Acessos e permissões", description: "Administrar papéis e módulos", href: "/admin/acessos", module: "ADMIN_ACCESS", icon: Settings, group: "Administração" },
];

export function PlatformCommandMenu({ modules }: { modules: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const available = useMemo(
    () => commands.filter((item) => !item.module || modules.includes(item.module)),
    [modules],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  function navigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-bold text-slate-600 transition hover:border-blue-200 hover:bg-white hover:text-[#003b70] md:flex"
        aria-label="Abrir busca rápida"
      >
        <Search className="h-4 w-4" />
        <span className="hidden lg:inline">Buscar</span>
        <kbd className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-black text-slate-400">Ctrl K</kbd>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Navegação rápida"
        className="fixed inset-x-4 top-[12vh] z-[120] mx-auto max-w-2xl overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-5">
          <Search className="h-5 w-5 text-slate-400" />
          <Command.Input
            autoFocus
            placeholder="Digite uma página, módulo ou ação..."
            className="h-16 flex-1 bg-transparent text-base font-semibold text-slate-900 outline-none placeholder:text-slate-400"
          />
          <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar busca">
            <X className="h-5 w-5" />
          </button>
        </div>

        <Command.List className="max-h-[62vh] overflow-y-auto p-3">
          <Command.Empty className="px-4 py-12 text-center text-sm font-semibold text-slate-500">Nenhum módulo encontrado.</Command.Empty>
          {(["Principal", "Atuação", "Administração"] as const).map((group) => {
            const items = available.filter((item) => item.group === group);
            if (!items.length) return null;
            return (
              <Command.Group key={group} heading={group} className="mb-3 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-black [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[.18em] [&_[cmdk-group-heading]]:text-slate-400">
                {items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Command.Item
                      key={item.href}
                      value={`${item.label} ${item.description}`}
                      onSelect={() => navigate(item.href)}
                      className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-3 text-slate-700 outline-none data-[selected=true]:bg-blue-50 data-[selected=true]:text-[#003b70]"
                    >
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-[#003b70]">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block truncate text-sm">{item.label}</strong>
                        <small className="block truncate text-xs text-slate-500">{item.description}</small>
                      </span>
                    </Command.Item>
                  );
                })}
              </Command.Group>
            );
          })}
        </Command.List>
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-bold text-slate-500">
          <span>Use ↑ ↓ para navegar</span>
          <span>Enter para abrir · Esc para fechar</span>
        </div>
      </Command.Dialog>
      {open && <button type="button" aria-label="Fechar busca" onClick={() => setOpen(false)} className="fixed inset-0 z-[110] bg-slate-950/45 backdrop-blur-sm" />}
    </>
  );
}
