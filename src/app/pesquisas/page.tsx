"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, FilePlus2, FileText, Loader2, Search, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type CatalogItem = {
  surveyId: string;
  surveyCode: string;
  surveyName: string;
  description: string | null;
  applicationId: string;
  applicationCode: string;
  applicationName: string;
  applicationStatus: string;
  opensAt: string | null;
  closesAt: string | null;
  participantStatus: string | null;
  completedAt: string | null;
  submissionStatus: string | null;
  submissionUpdatedAt: string | null;
  sections: number;
  questions: number;
  canRespond: boolean;
  canManage: boolean;
};

function statusLabel(status: string) {
  if (status === "OPEN") return "Aberta";
  if (status === "CLOSED") return "Encerrada";
  if (status === "SCHEDULED") return "Agendada";
  return "Rascunho";
}
function statusClass(status: string) {
  if (status === "OPEN") return "bg-emerald-100 text-emerald-800";
  if (status === "CLOSED") return "bg-slate-200 text-slate-700";
  if (status === "SCHEDULED") return "bg-blue-100 text-blue-800";
  return "bg-amber-100 text-amber-800";
}
function dateLabel(value: string | null) {
  if (!value) return "Sem data definida";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}
function actionLabel(item: CatalogItem) {
  if (item.submissionStatus === "SUBMITTED" || item.submissionStatus === "VALIDATED") return "Consultar envio";
  if (item.submissionStatus === "DRAFT") return "Continuar preenchimento";
  if (item.applicationStatus === "OPEN") return "Responder pesquisa";
  return "Consultar instrumento";
}

export default function SurveysPage() {
  const { context, loading, error } = usePlatformContext();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!context?.person) return;
    const load = async () => {
      setCatalogLoading(true);
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error: catalogError } = await supabase.rpc("list_my_survey_catalog");
        if (catalogError) throw catalogError;
        setItems(Array.isArray(data) ? data as CatalogItem[] : []);
      } catch (loadError) {
        toast.error(loadError instanceof Error ? loadError.message : "Não foi possível carregar o catálogo de pesquisas.");
      } finally { setCatalogLoading(false); }
    };
    void load();
  }, [context?.person]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return items;
    return items.filter((item) => `${item.surveyCode} ${item.surveyName} ${item.applicationCode} ${item.applicationName}`.toLowerCase().includes(term));
  }, [items, search]);

  if (loading) return <PlatformSkeleton title="Carregando pesquisas" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;

  const modules = deriveModules(context);
  const user = { fullName: context.person.fullName, institutionalEmail: context.person.institutionalEmail, employeeNumber: context.person.employeeNumber, profileLabel: profileLabel(context), roles: context.roles, modules };
  const isAdmin = modules.includes("ADMIN_SURVEYS");

  return <PlatformShell user={user} eyebrow="Catálogo institucional" title="Pesquisas" actions={isAdmin ? <Link href="/admin/pesquisas/nova" className="hidden items-center gap-2 rounded-xl bg-[#003b70] px-4 py-2.5 text-sm font-black text-white sm:inline-flex"><FilePlus2 className="h-4 w-4"/>Nova pesquisa</Link> : undefined}>
    <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_360px] lg:items-end lg:p-8">
        <div><p className="text-xs font-black uppercase tracking-[.16em] text-emerald-700">Instrumentos disponíveis</p><h2 className="mt-2 text-3xl font-black tracking-tight text-[#003b70]">Seu catálogo de pesquisas</h2><p className="mt-3 max-w-3xl leading-7 text-slate-600">Inicie, continue ou consulte instrumentos conforme o período, sua participação e suas permissões.</p></div>
        <label className="relative block"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"/><input value={search} onChange={(event)=>setSearch(event.target.value)} placeholder="Buscar pesquisa ou ciclo" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-12 pr-4 font-semibold outline-none transition focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100"/></label>
      </div>
      <div className="h-1 bg-[linear-gradient(90deg,#003b70,#0b8f58,#f2b705,#d92d3a,#00a8d6)]"/>
    </section>

    <section className="mt-6 grid gap-5 xl:grid-cols-2">
      {catalogLoading ? Array.from({length:4}).map((_,index)=><div key={index} className="h-80 animate-pulse rounded-3xl bg-white ring-1 ring-slate-200"/>) : filtered.length ? filtered.map((item)=>{
        const href = item.surveyCode === "CDDI" ? "/cddi" : `/pesquisas/${encodeURIComponent(item.applicationCode)}`;
        const submitted = item.submissionStatus === "SUBMITTED" || item.submissionStatus === "VALIDATED";
        return <article key={item.applicationId} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl">
          <div className="h-2 bg-[linear-gradient(90deg,#003b70,#0b8f58,#f2b705,#d92d3a,#00a8d6)]"/>
          <div className="p-6 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2"><span className="rounded-lg bg-blue-50 px-3 py-1 text-xs font-black text-[#003b70]">{item.surveyCode}</span><span className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{item.applicationCode}</span></div><span className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(item.applicationStatus)}`}>{statusLabel(item.applicationStatus)}</span></div>
            <h3 className="mt-5 text-2xl font-black text-[#003b70]">{item.surveyName}</h3><p className="mt-2 text-sm font-bold text-slate-500">{item.applicationName}</p><p className="mt-4 min-h-14 leading-7 text-slate-600">{item.description || "Instrumento institucional disponível conforme seu perfil."}</p>
            <div className="mt-5 grid grid-cols-3 gap-3">{[[String(item.sections),"seções"],[String(item.questions),"perguntas"],[submitted?"Sim":"Não","concluída"]].map(([value,label])=><div key={label} className="rounded-2xl bg-slate-50 p-3 text-center"><strong className="block text-xl text-[#003b70]">{value}</strong><span className="text-[11px] text-slate-500">{label}</span></div>)}</div>
            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50/60 p-4 text-sm text-slate-500"><CalendarClock className="h-4 w-4 shrink-0"/><span>{dateLabel(item.opensAt)} → {dateLabel(item.closesAt)}</span></div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3"><span className="inline-flex items-center gap-2 text-xs font-bold text-slate-500">{submitted ? <CheckCircle2 className="h-4 w-4 text-emerald-600"/> : <FileText className="h-4 w-4 text-blue-600"/>}{item.submissionStatus === "DRAFT" ? "Rascunho salvo" : submitted ? "Envio concluído" : "Ainda não iniciada"}</span><div className="flex gap-2">{item.canManage && <Link href={`/admin/pesquisas/${item.surveyId}`} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600"><Settings2 className="h-4 w-4"/>Configurar</Link>}<Link href={href} className="rounded-xl bg-[#003b70] px-5 py-2.5 text-sm font-black text-white transition hover:bg-[#075ea8]">{actionLabel(item)}</Link></div></div>
          </div>
        </article>;
      }) : <div className="col-span-full rounded-[2rem] border border-dashed border-slate-300 bg-white/70 p-12 text-center"><FileText className="mx-auto h-11 w-11 text-slate-300"/><h3 className="mt-5 text-xl font-black text-[#003b70]">Nenhuma pesquisa disponível</h3><p className="mx-auto mt-2 max-w-xl leading-7 text-slate-600">Quando uma pesquisa for publicada e seu perfil for incluído, ela aparecerá automaticamente aqui.</p>{isAdmin && <Link href="/admin/pesquisas/nova" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#003b70] px-5 py-3 font-black text-white"><FilePlus2 className="h-4 w-4"/>Criar primeira pesquisa</Link>}</div>}
    </section>
    {catalogLoading && <p className="mt-5 flex items-center justify-center text-sm text-slate-500"><Loader2 className="mr-2 h-4 w-4 animate-spin"/>Atualizando catálogo...</p>}
  </PlatformShell>;
}
