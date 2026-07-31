"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, FilePlus2, FileQuestion, Loader2, Search, Settings2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type ManagedSurvey = {
  surveyId: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  versionId: string;
  versionNumber: number;
  versionStatus: string;
  applicationId: string | null;
  applicationCode: string | null;
  applicationName: string | null;
  applicationStatus: string | null;
  opensAt: string | null;
  closesAt: string | null;
  sections: number;
  questions: number;
  updatedAt: string;
};

function dateLabel(value: string | null) {
  if (!value) return "Sem data definida";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function statusClass(status: string | null) {
  if (status === "OPEN" || status === "ACTIVE" || status === "PUBLISHED") return "bg-emerald-100 text-emerald-800";
  if (status === "CLOSED" || status === "ARCHIVED" || status === "RETIRED") return "bg-slate-200 text-slate-700";
  if (status === "SCHEDULED") return "bg-blue-100 text-blue-800";
  return "bg-amber-100 text-amber-800";
}

export default function AdminSurveysPage() {
  const { context, loading, error } = usePlatformContext();
  const [surveys, setSurveys] = useState<ManagedSurvey[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function loadSurveys() {
    setDataLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: listError } = await supabase.rpc("list_managed_surveys");
      if (listError) throw listError;
      setSurveys(Array.isArray(data) ? data as ManagedSurvey[] : []);
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Não foi possível carregar as pesquisas.");
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    if (context?.person) void loadSurveys();
  }, [context?.person]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return surveys;
    return surveys.filter((item) => `${item.code} ${item.name} ${item.applicationName ?? ""}`.toLowerCase().includes(term));
  }, [search, surveys]);

  if (loading) return <PlatformSkeleton title="Carregando pesquisas" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;
  const modules = deriveModules(context);
  if (!modules.includes("ADMIN_SURVEYS")) return <main className="p-10 text-red-700">Acesso restrito à Equipe Técnica.</main>;
  const person = context.person;
  const user = { fullName: person.fullName, institutionalEmail: person.institutionalEmail, employeeNumber: person.employeeNumber, profileLabel: profileLabel(context), roles: context.roles, modules };

  return <PlatformShell user={user} eyebrow="Equipe Técnica" title="Pesquisas e ciclos" actions={<Link href="/admin/pesquisas/nova" className="hidden items-center gap-2 rounded-xl bg-[#003b70] px-4 py-2.5 text-sm font-black text-white sm:inline-flex"><FilePlus2 className="h-4 w-4" /> Nova pesquisa</Link>}>
    <section className="overflow-hidden rounded-[2rem] bg-[linear-gradient(125deg,#062f54,#007f8f)] p-7 text-white shadow-xl">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-3xl"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-cyan-100"><Sparkles className="h-4 w-4" /> Estúdio de pesquisas</span><h2 className="mt-5 text-3xl font-black sm:text-4xl">Crie, estruture e publique instrumentos</h2><p className="mt-3 leading-7 text-cyan-50/80">Cada pesquisa possui versões controladas, seções, perguntas, alternativas, ciclos de aplicação e público próprio.</p></div><Link href="/admin/pesquisas/nova" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 font-black text-[#003b70] shadow-lg"><FilePlus2 className="h-5 w-5" /> Criar nova pesquisa</Link></div>
    </section>

    <section className="mt-6 grid gap-4 sm:grid-cols-3">{[["Pesquisas", surveys.length],["Perguntas cadastradas", surveys.reduce((sum,item)=>sum+Number(item.questions||0),0)],["Ciclos ativos", surveys.filter((item)=>["OPEN","SCHEDULED"].includes(item.applicationStatus ?? "")).length]].map(([label,value])=><article key={String(label)} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">{label}</p><strong className="mt-2 block text-3xl font-black text-[#003b70]">{value}</strong></article>)}</section>

    <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-xl font-black text-[#003b70]">Catálogo de instrumentos</h3><p className="mt-1 text-sm text-slate-500">Abra o construtor para adicionar seções e perguntas.</p></div><label className="relative block w-full max-w-sm"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Buscar por código ou nome" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 font-semibold outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" /></label></div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {dataLoading ? Array.from({length:4}).map((_,index)=><div key={index} className="h-64 animate-pulse rounded-3xl bg-slate-100" />) : filtered.length ? filtered.map((survey)=><article key={survey.surveyId} className="group rounded-3xl border border-slate-200 p-5 transition hover:border-blue-200 hover:shadow-lg"><div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-black text-[#003b70]">{survey.code}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(survey.applicationStatus ?? survey.status)}`}>{survey.applicationStatus ?? survey.status}</span></div><h4 className="mt-4 truncate text-xl font-black text-[#003b70]">{survey.name}</h4><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{survey.description || "Sem descrição cadastrada."}</p></div><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-[#003b70] transition group-hover:bg-blue-50"><FileQuestion className="h-6 w-6" /></div></div><div className="mt-5 grid grid-cols-3 gap-3">{[["Versão",survey.versionNumber],["Seções",survey.sections],["Perguntas",survey.questions]].map(([label,value])=><div key={String(label)} className="rounded-2xl bg-slate-50 p-3 text-center"><span className="block text-[10px] font-black uppercase tracking-[.12em] text-slate-400">{label}</span><strong className="mt-1 block text-lg text-[#003b70]">{value}</strong></div>)}</div><div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-sm"><div className="flex items-center gap-2 text-slate-500"><CalendarDays className="h-4 w-4" /><span>{survey.applicationName ?? "Ciclo não configurado"}</span></div><p className="mt-2 text-xs text-slate-400">{dateLabel(survey.opensAt)} → {dateLabel(survey.closesAt)}</p></div><div className="mt-5 flex flex-wrap justify-end gap-3"><Link href={`/admin/pesquisas/${survey.surveyId}`} className="inline-flex items-center gap-2 rounded-xl bg-[#003b70] px-4 py-2.5 text-sm font-black text-white"><Settings2 className="h-4 w-4" /> Abrir construtor</Link></div></article>) : <div className="col-span-full rounded-3xl border border-dashed border-slate-300 p-12 text-center"><FileQuestion className="mx-auto h-10 w-10 text-slate-300" /><strong className="mt-4 block text-[#003b70]">Nenhuma pesquisa encontrada</strong><p className="mt-2 text-sm text-slate-500">Crie o primeiro instrumento da plataforma.</p></div>}
      </div>
      {dataLoading && <p className="mt-4 flex items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Carregando catálogo...</p>}
    </section>
  </PlatformShell>;
}
