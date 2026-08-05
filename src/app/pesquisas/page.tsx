"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, FilePlus2, FileText, Filter, Loader2, Search, Settings2 } from "lucide-react";
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

type FilterKey = "ALL" | "OPEN" | "DRAFT" | "COMPLETED" | "SCHEDULED" | "CLOSED";

function statusLabel(status: string) {
  if (status === "OPEN") return "Aberta";
  if (status === "CLOSED") return "Encerrada";
  if (status === "SCHEDULED") return "Agendada";
  return "Rascunho";
}

function itemFilterState(item: CatalogItem): FilterKey {
  if (["SUBMITTED", "VALIDATED"].includes(item.submissionStatus ?? "") || item.completedAt) return "COMPLETED";
  if (item.submissionStatus === "DRAFT") return "DRAFT";
  if (item.applicationStatus === "OPEN") return "OPEN";
  if (item.applicationStatus === "SCHEDULED") return "SCHEDULED";
  if (item.applicationStatus === "CLOSED") return "CLOSED";
  return "DRAFT";
}

function dateLabel(value: string | null) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function actionLabel(item: CatalogItem) {
  if (["SUBMITTED", "VALIDATED"].includes(item.submissionStatus ?? "")) return "Consultar";
  if (item.submissionStatus === "DRAFT") return "Continuar";
  if (item.applicationStatus === "OPEN") return "Responder";
  return "Visualizar";
}

const filters: Array<{ key: FilterKey; label: string }> = [
  { key: "ALL", label: "Todas" },
  { key: "OPEN", label: "Abertas" },
  { key: "DRAFT", label: "Em andamento" },
  { key: "COMPLETED", label: "Concluídas" },
  { key: "SCHEDULED", label: "Agendadas" },
  { key: "CLOSED", label: "Encerradas" },
];

export default function SurveysPage() {
  const { context, loading, error } = usePlatformContext();
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("ALL");

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
      } finally {
        setCatalogLoading(false);
      }
    };
    void load();
  }, [context?.person]);

  const counts = useMemo(() => {
    const result: Record<FilterKey, number> = { ALL: items.length, OPEN: 0, DRAFT: 0, COMPLETED: 0, SCHEDULED: 0, CLOSED: 0 };
    items.forEach((item) => { result[itemFilterState(item)] += 1; });
    return result;
  }, [items]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesTerm = !term || `${item.surveyCode} ${item.surveyName} ${item.applicationCode} ${item.applicationName}`.toLowerCase().includes(term);
      const matchesFilter = filter === "ALL" || itemFilterState(item) === filter;
      return matchesTerm && matchesFilter;
    });
  }, [items, search, filter]);

  if (loading) return <PlatformSkeleton title="Carregando pesquisas" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;

  const modules = deriveModules(context);
  const user = { fullName: context.person.fullName, institutionalEmail: context.person.institutionalEmail, employeeNumber: context.person.employeeNumber, profileLabel: profileLabel(context), roles: context.roles, modules };
  const isAdmin = modules.includes("ADMIN_SURVEYS");

  return <PlatformShell user={user} eyebrow="Catálogo institucional" title="Pesquisas" actions={isAdmin ? <Link href="/admin/pesquisas/nova" className="hidden items-center gap-2 rounded-xl bg-[#0b4f82] px-4 py-2.5 text-sm font-black text-white sm:inline-flex"><FilePlus2 className="h-4 w-4"/>Nova pesquisa</Link> : undefined}>
    <section className="surface-card overflow-hidden">
      <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-center lg:justify-between sm:p-6">
        <div>
          <p className="section-eyebrow">Instrumentos disponíveis</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-brand-primary">Encontre e acompanhe suas pesquisas</h2>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">Filtre por situação, pesquise pelo nome e continue de onde parou.</p>
        </div>
        <label className="relative block w-full lg:max-w-md">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar pesquisa, código ou ciclo" className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] pl-11 pr-4 text-sm font-semibold text-[var(--text-primary)] outline-none focus:bg-[var(--surface-card)] focus:ring-4 focus:ring-sky-300/20" />
        </label>
      </div>
      <div className="border-t border-[var(--border-subtle)] px-5 py-3 sm:px-6">
        <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar pesquisas por situação">
          <Filter className="mr-1 h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
          {filters.map((item) => <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} onClick={() => setFilter(item.key)} className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-xs font-black transition ${filter === item.key ? "bg-[var(--brand-primary)] text-white shadow-sm" : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}>{item.label}<span className={`rounded-full px-1.5 py-0.5 text-[10px] ${filter === item.key ? "bg-white/15" : "bg-[var(--surface-card)]"}`}>{counts[item.key]}</span></button>)}
        </div>
      </div>
    </section>

    <section className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
      {catalogLoading ? Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-64 animate-pulse rounded-2xl bg-[var(--surface-card)] ring-1 ring-[var(--border-subtle)]" />) : filtered.length ? filtered.map((item) => {
        const href = item.surveyCode === "CDDI" ? "/cddi" : `/pesquisas/${encodeURIComponent(item.applicationCode)}`;
        const state = itemFilterState(item);
        const completed = state === "COMPLETED";
        const stateStyle = state === "OPEN" ? "bg-emerald-500/15 text-emerald-500" : state === "DRAFT" ? "bg-amber-500/15 text-amber-500" : state === "COMPLETED" ? "bg-sky-500/15 text-sky-500" : state === "SCHEDULED" ? "bg-violet-500/15 text-violet-500" : "bg-slate-500/15 text-[var(--text-secondary)]";
        return <article key={item.applicationId} className="group flex min-h-[250px] flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:border-sky-400/50 hover:shadow-lg">
          <div className="h-1 bg-[linear-gradient(90deg,#0b4f82,#1388b8,#087a55)]" />
          <div className="flex flex-1 flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 flex-wrap gap-2"><span className="rounded-lg bg-sky-500/10 px-2.5 py-1 text-[11px] font-black text-brand-primary">{item.surveyCode}</span><span className="rounded-lg bg-[var(--surface-muted)] px-2.5 py-1 text-[11px] font-bold text-[var(--text-secondary)]">{item.applicationCode}</span></div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black ${stateStyle}`}>{completed ? "Concluída" : state === "DRAFT" ? "Em andamento" : statusLabel(item.applicationStatus)}</span>
            </div>
            <h3 className="mt-4 line-clamp-2 text-lg font-black leading-snug text-brand-primary">{item.surveyName}</h3>
            <p className="mt-1 truncate text-xs font-bold text-[var(--text-secondary)]">{item.applicationName}</p>
            <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">{item.description || "Instrumento institucional disponível conforme seu perfil."}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-[var(--text-secondary)]"><span className="rounded-lg bg-[var(--surface-muted)] px-2.5 py-1.5">{item.sections} seções</span><span className="rounded-lg bg-[var(--surface-muted)] px-2.5 py-1.5">{item.questions} perguntas</span><span className="inline-flex items-center gap-1 rounded-lg bg-[var(--surface-muted)] px-2.5 py-1.5"><CalendarClock className="h-3.5 w-3.5" />até {dateLabel(item.closesAt)}</span></div>
            <div className="mt-auto flex items-center justify-between gap-3 pt-5">
              <span className="inline-flex min-w-0 items-center gap-2 truncate text-xs font-bold text-[var(--text-secondary)]">{completed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" /> : <FileText className="h-4 w-4 shrink-0 text-sky-500" />}{completed ? "Envio concluído" : item.submissionStatus === "DRAFT" ? "Rascunho salvo" : "Não iniciada"}</span>
              <div className="flex shrink-0 gap-2">{item.canManage ? <Link href={`/admin/pesquisas/${item.surveyId}`} aria-label={`Configurar ${item.surveyName}`} className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"><Settings2 className="h-4 w-4" /></Link> : null}<Link href={href} className="inline-flex min-h-10 items-center rounded-xl bg-[#0b4f82] px-4 text-xs font-black text-white transition hover:bg-[#073b62]">{actionLabel(item)}</Link></div>
            </div>
          </div>
        </article>;
      }) : <div className="col-span-full rounded-2xl border border-dashed border-[var(--border-subtle)] bg-[var(--surface-card)] p-10 text-center"><FileText className="mx-auto h-9 w-9 text-[var(--text-secondary)]" /><h3 className="mt-4 text-lg font-black text-brand-primary">Nenhuma pesquisa encontrada</h3><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">Ajuste a busca ou escolha outro filtro.</p></div>}
    </section>
    {catalogLoading ? <p className="mt-5 flex items-center justify-center text-sm text-[var(--text-secondary)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Atualizando catálogo...</p> : null}
  </PlatformShell>;
}
