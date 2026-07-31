"use client";

import { Check, Loader2, Search, ShieldCheck, UserCog } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";

type Role = { id: string; code: string; name: string; description: string | null };
type PersonRole = { assignmentId: string; code: string; name: string };
type Person = {
  personId: string;
  fullName: string;
  employeeNumber: string | null;
  institutionalEmail: string | null;
  jobTitle: string | null;
  unit: string | null;
  active: boolean;
  roles: PersonRole[];
};
type Workspace = { status: string; roles: Role[]; people: Person[] };

const roleOrder = ["ADMINISTRATOR", "TECHNICAL_TEAM", "SURVEY_MANAGER", "AUDITOR", "LEADER", "PARTICIPANT"];

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase();
}

export default function AdminAccessPage() {
  const { context, loading, error } = usePlatformContext();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [query, setQuery] = useState("");
  const [fetching, setFetching] = useState(false);
  const [changing, setChanging] = useState("");

  async function load(term = "") {
    setFetching(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: rpcError } = await supabase.rpc("list_access_workspace", { search_term: term });
      if (rpcError) throw rpcError;
      setWorkspace(data as Workspace);
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Não foi possível carregar os acessos.");
    } finally {
      setFetching(false);
    }
  }

  useEffect(() => { if (context?.roles?.includes("ADMINISTRATOR")) void load(); }, [context]);

  const roles = useMemo(() => [...(workspace?.roles ?? [])].sort((a, b) => {
    const ai = roleOrder.indexOf(a.code); const bi = roleOrder.indexOf(b.code);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  }), [workspace]);

  async function toggleRole(person: Person, role: Role, enabled: boolean) {
    const key = `${person.personId}:${role.code}`;
    setChanging(key);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: rpcError } = await supabase.rpc("set_person_role", {
        target_person_id: person.personId,
        target_role_code: role.code,
        enabled,
      });
      if (rpcError) throw rpcError;
      toast.success(`${role.name} ${enabled ? "concedido" : "retirado"} para ${person.fullName}.`);
      await load(query);
    } catch (changeError) {
      toast.error(changeError instanceof Error ? changeError.message : "Não foi possível alterar o papel.");
    } finally {
      setChanging("");
    }
  }

  if (loading) return <PlatformSkeleton title="Carregando acessos" />;
  if (!context?.person) return <main className="p-8 text-red-700">{error || "Acesso não identificado."}</main>;
  const modules = deriveModules(context);
  const user = { fullName: context.person.fullName, institutionalEmail: context.person.institutionalEmail, employeeNumber: context.person.employeeNumber, profileLabel: profileLabel(context), roles: context.roles, modules };

  if (!context.roles?.includes("ADMINISTRATOR")) {
    return <PlatformShell user={user} eyebrow="Segurança" title="Acessos e permissões"><section className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm"><ShieldCheck className="mx-auto h-9 w-9 text-slate-400" /><h2 className="mt-4 text-2xl font-black text-slate-900">Acesso exclusivo</h2><p className="mt-2 text-slate-500">Somente o Administrador da Plataforma pode conceder ou retirar papéis.</p></section></PlatformShell>;
  }

  return <PlatformShell user={user} eyebrow="Administrador da Plataforma" title="Pessoas e permissões">
    <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_16px_50px_-36px_rgba(15,23,42,.55)] backdrop-blur-xl sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-950 text-white"><UserCog className="h-5 w-5" /></span><div><h2 className="text-xl font-black text-slate-950">Controle de acesso baseado em papéis</h2><p className="mt-1 text-sm text-slate-500">Pesquise uma pessoa e altere apenas os papéis necessários. Toda mudança é auditada.</p></div></div>
        <form onSubmit={(event) => { event.preventDefault(); void load(query); }} className="flex w-full max-w-xl gap-2">
          <label className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, matrícula ou e-mail" className="h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-slate-400 focus:bg-white" /></label>
          <button disabled={fetching} className="inline-flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-5 text-sm font-black text-white disabled:opacity-50">{fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}Buscar</button>
        </form>
      </div>
    </section>

    <section className="mt-5 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-45px_rgba(15,23,42,.6)]">
      <div className="grid grid-cols-[minmax(260px,1.2fr)_repeat(var(--roles),minmax(120px,.45fr))] border-b border-slate-100 bg-slate-50/80 px-5 py-3 text-[11px] font-black uppercase tracking-[.12em] text-slate-400" style={{ "--roles": roles.length } as React.CSSProperties}>
        <span>Pessoa</span>{roles.map((role) => <span key={role.code} className="text-center">{role.name}</span>)}
      </div>
      <div className="divide-y divide-slate-100">
        {(workspace?.people ?? []).map((person) => <article key={person.personId} className="grid grid-cols-[minmax(260px,1.2fr)_repeat(var(--roles),minmax(120px,.45fr))] items-center px-5 py-4 transition hover:bg-slate-50/70" style={{ "--roles": roles.length } as React.CSSProperties}>
          <div className="flex min-w-0 items-center gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-slate-900 to-slate-600 text-xs font-black text-white">{initials(person.fullName)}</span><div className="min-w-0"><strong className="block truncate text-sm text-slate-900">{person.fullName}</strong><span className="block truncate text-xs text-slate-500">{person.institutionalEmail ?? person.employeeNumber ?? "Sem identificação"}</span><span className="block truncate text-[11px] text-slate-400">{person.jobTitle ?? "Cargo não informado"}{person.unit ? ` · ${person.unit}` : ""}</span></div></div>
          {roles.map((role) => {
            const active = person.roles.some((item) => item.code === role.code);
            const key = `${person.personId}:${role.code}`;
            return <div key={role.code} className="flex justify-center"><button type="button" onClick={() => void toggleRole(person, role, !active)} disabled={changing === key} aria-pressed={active} className={`relative h-7 w-12 rounded-full transition ${active ? "bg-emerald-500 shadow-[0_8px_20px_-10px_rgba(16,185,129,.9)]" : "bg-slate-200"}`}>{changing === key ? <Loader2 className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 animate-spin text-white" /> : <span className={`absolute top-1 grid h-5 w-5 place-items-center rounded-full bg-white shadow-sm transition ${active ? "left-6" : "left-1"}`}>{active && <Check className="h-3 w-3 text-emerald-600" />}</span>}</button></div>;
          })}
        </article>)}
        {!fetching && !(workspace?.people?.length) && <div className="p-10 text-center text-sm text-slate-500">Nenhuma pessoa encontrada.</div>}
      </div>
    </section>
  </PlatformShell>;
}
