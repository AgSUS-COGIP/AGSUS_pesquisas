"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarDays, FilePlus2, FileQuestion, Loader2, Search, Settings2, SlidersHorizontal, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { FullPageState } from "@/components/full-page-state";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type ManagedSurvey = {
  surveyId: string; code: string; name: string; description: string | null; status: string;
  versionNumber: number; versionStatus: string; applicationName: string | null;
  applicationStatus: string | null; opensAt: string | null; closesAt: string | null;
  sections: number; questions: number;
};

function dateLabel(value: string | null) {
  if (!value) return "Sem data definida";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function statusClass(status: string | null) {
  if (["OPEN", "ACTIVE", "PUBLISHED"].includes(status ?? "")) return "bg-emerald-100 text-emerald-800";
  if (["CLOSED", "ARCHIVED", "RETIRED", "CANCELLED"].includes(status ?? "")) return "bg-slate-200 text-slate-700";
  if (status === "SCHEDULED") return "bg-blue-100 text-blue-800";
  return "bg-amber-100 text-amber-800";
}

export default function AdminSurveysPage() {
  const { context, loading, error } = usePlatformContext();
  const [surveys, setSurveys] = useState<ManagedSurvey[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!context?.person) return;
    const load = async () => {
      setDataLoading(true);
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error: listError } = await supabase.rpc("list_managed_surveys");
        if (listError) throw listError;
        setSurveys(Array.isArray(data) ? data as ManagedSurvey[] : []);
      } catch (loadError) {
        toast.error(loadError instanceof Error ? loadError.message : "Não foi possível carregar as pesquisas.");
      } finally { setDataLoading(false); }
    };
    void load();
  }, [context?.person]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return surveys;
    return surveys.filter((item) => `${item.code} ${item.name} ${item.applicationName ?? ""}`.toLowerCase().includes(term));
  }, [search, surveys]);

  if (loading) return <PlatformSkeleton title="Carregando pesquisas" />;
  if (!context?.person) return <FullPageState title="Não foi possível abrir as pesquisas" description={error || "Seu acesso institucional não foi identificado."} actionHref="/acesso" actionLabel="Voltar ao acesso" />;
  const modules = deriveModules(context);
  if (!modules.includes("ADMIN_SURVEYS")) return <FullPageState tone="restricted" title="Gestão de pesquisas restrita" description="Seu perfil não possui permissão para construir ou operar pesquisas." />;

  const user = {
    fullName: context.person.fullName,
    institutionalEmail: context.person.institutionalEmail,
    employeeNumber: context.person.employeeNumber,
    profileLabel: profileLabel(context),
    avatarUrl: context.person.avatarUrl,
    roles: context.roles,
    modules,
  };

  const activeCycles = surveys.filter((item) => ["OPEN", "SCHEDULED"].includes(item.applicationStatus ?? "")).length;
  const totalQuestions = surveys.reduce((sum, item) => sum + Number(item.questions || 0), 0);

  return <PlatformShell user={user} eyebrow="Administração" title="Pesquisas e ciclos" actions={<Link href="/admin/pesquisas/nova" className="inline-flex items-center gap-2 rounded-xl bg-[#003b70] px-4 py-2.5 text-sm font-black text-white"><FilePlus2 className="h-4 w-4" />Nova pesquisa</Link>}>
    <section className="overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_80%_0%,rgba(45,212,191,.25),transparent_28%),linear-gradient(125deg,#062f54,#007f8f)] p-7 text-white shadow-xl sm:p-9">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between"><div className="max-w-3xl"><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-cyan-100"><Sparkles className="h-4 w-4" />Estúdio e operação</span><h2 className="mt-5 text-3xl font-black sm:text-4xl">Da construção à abertura do ciclo</h2><p className="mt-3 leading-7 text-cyan-50/85">Edite o instrumento, valide a prontidão, configure o período e controle a publicação em um fluxo auditável.</p></div><Link href="/admin/pesquisas/nova" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3.5 font-black text-[#003b70] shadow-lg"><FilePlus2 className="h-5 w-5" />Criar pesquisa</Link></div>
    </section>

    <section className="mt-6 grid gap-4 sm:grid-cols-3">
      {[["Pesquisas", surveys.length], ["Perguntas cadastradas", totalQuestions], ["Ciclos ativos", activeCycles]].map(([label, value]) => <article key={String(label)} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-[.14em] text-slate-400">{label}</p><strong className="mt-2 block text-3xl font-black text-[#003b70]">{value}</strong></article>)}
    </section>

    <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-xl font-black text-[#003b70]">Catálogo administrativo</h3><p className="mt-1 text-sm text-slate-500">Construa o formulário ou gerencie o ciclo de cada pesquisa.</p></div><label className="relative block w-full max-w-sm"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por código, nome ou ciclo" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 font-semibold outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" /></label></div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        {dataLoading ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-72 animate-pulse rounded-3xl bg-slate-100" />) : filtered.length ? filtered.map((survey) => <article key={survey.surveyId} className="rounded-3xl border border-slate-200 p-5 transition hover:border-blue-200 hover:shadow-lg">
          <div className="flex items-start justify-between gap-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-black text-[#003b70]">{survey.code}</span><span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(survey.applicationStatus ?? survey.status)}`}>{survey.applicationStatus ?? survey.status}</span></div><h4 className="mt-4 text-xl font-black text-[#003b70]">{survey.name}</h4><p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{survey.description || "Sem descrição cadastrada."}</p></div><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-slate-100 text-[#003b70]"><FileQuestion className="h-6 w-6" /></div></div>
          <div className="mt-5 grid grid-cols-3 gap-3">{[["Versão", survey.versionNumber], ["Seções", survey.sections], ["Perguntas", survey.questions]].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-slate-50 p-3 text-center"><span className="block text-[10px] font-black uppercase tracking-[.12em] text-slate-400">{label}</span><strong className="mt-1 block text-lg text-[#003b70]">{value}</strong></div>)}</div>
          <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-sm"><div className="flex items-center gap-2 text-slate-500"><CalendarDays className="h-4 w-4" /><span>{survey.applicationName ?? "Ciclo não configurado"}</span></div><p className="mt-2 text-xs text-slate-400">{dateLabel(survey.opensAt)} → {dateLabel(survey.closesAt)}</p></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2"><Link href={`/admin/pesquisas/${survey.surveyId}`} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-[#003b70] hover:bg-slate-50"><Settings2 className="h-4 w-4" />Construir formulário</Link><Link href={`/admin/pesquisas/${survey.surveyId}/operacao`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#003b70] px-4 py-3 text-sm font-black text-white hover:bg-[#075ea8]"><SlidersHorizontal className="h-4 w-4" />Operar ciclo</Link></div>
        </article>) : <div className="col-span-full rounded-3xl border border-dashed border-slate-300 p-12 text-center"><FileQuestion className="mx-auto h-10 w-10 text-slate-300" /><strong className="mt-4 block text-[#003b70]">Nenhuma pesquisa encontrada</strong><p className="mt-2 text-sm text-slate-500">Crie o primeiro instrumento da plataforma.</p></div>}
      </div>
      {dataLoading && <p className="mt-4 flex items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Carregando catálogo...</p>}
    </section>
  </PlatformShell>;
}
