"use client";

import { Command } from "cmdk";
import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PlatformIcon } from "@/components/platform-icons";
import { navigationGroupsForModules } from "@/lib/platform-navigation";

export function PlatformCommandMenu({ modules }: { modules: string[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const availableGroups = useMemo(() => navigationGroupsForModules(modules), [modules]);

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
        className="flex h-10 w-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-600 transition hover:border-blue-200 hover:bg-white hover:text-[var(--brand-primary)] md:w-auto md:px-3"
        aria-label="Abrir busca rápida"
      >
        <Search className="h-4 w-4" />
        <span className="hidden lg:inline">Buscar</span>
        <kbd className="hidden rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-black text-slate-400 md:inline">Ctrl K</kbd>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Navegação rápida"
        className="fixed inset-x-3 top-[8vh] z-[120] mx-auto max-w-2xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:inset-x-4 sm:top-[12vh] sm:rounded-[1.5rem]"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 sm:px-5">
          <Search className="h-5 w-5 shrink-0 text-slate-400" />
          <Command.Input autoFocus placeholder="Digite uma página, módulo ou ação..." className="h-14 min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400 sm:h-16 sm:text-base" />
          <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Fechar busca">
            <X className="h-5 w-5" />
          </button>
        </div>

        <Command.List className="max-h-[68vh] overflow-y-auto p-3 sm:max-h-[62vh]">
          <Command.Empty className="px-4 py-12 text-center text-sm font-semibold text-slate-500">Nenhum módulo encontrado.</Command.Empty>
          {availableGroups.map((group) => (
            <Command.Group key={group.title} heading={group.title} className="mb-3 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-2 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-black [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[.18em] [&_[cmdk-group-heading]]:text-slate-400">
              {group.items.map((item) => (
                <Command.Item
                  key={item.href}
                  value={`${item.label} ${item.description}`}
                  onSelect={() => navigate(item.href)}
                  className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-3 text-slate-700 outline-none data-[selected=true]:bg-blue-50 data-[selected=true]:text-[var(--brand-primary)]"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-[var(--brand-primary)]">
                    <PlatformIcon name={item.icon} className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1"><strong className="block truncate text-sm">{item.label}</strong><small className="block truncate text-xs text-slate-500">{item.description}</small></span>
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
        <div className="hidden items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-bold text-slate-500 sm:flex">
          <span>Use ↑ ↓ para navegar</span>
          <span>Enter para abrir · Esc para fechar</span>
        </div>
      </Command.Dialog>
      {open && <button type="button" aria-label="Fechar busca" onClick={() => setOpen(false)} className="fixed inset-0 z-[110] bg-slate-950/45 backdrop-blur-sm" />}
    </>
  );
}
