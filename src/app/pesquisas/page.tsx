"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, ClipboardList, FilePlus2, FileText, Filter, Loader2, RefreshCw, Search, Settings2 } from "lucide-react";
import { FullPageState } from "@/components/full-page-state";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader, StatCard, Surface } from "@/components/ui/surface";
import { useSurveyCatalog } from "@/hooks/use-survey-catalog";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { cn } from "@/lib/utils";
import { summarizeSurveyCatalog, surveyApplicationHref, surveyItemState, type SurveyCatalogItem } from "@/lib/survey-catalog";

type FilterKey = "ALL" | "OPEN" | "DRAFT" | "COMPLETED" | "SCHEDULED" | "CLOSED";

function statusLabel(status: string) {
  if (status === "OPEN") return "Aberta";
  if (status === "CLOSED") return "Encerrada";
  if (status === "SCHEDULED") return "Agendada";
  return "Rascunho";
}

function itemFilterState(item: SurveyCatalogItem): FilterKey {
  const state = surveyItemState(item);
  if (state === "IN_PROGRESS") return "DRAFT";
  if (state === "PENDING") return "OPEN";
  return state;
}

function dateLabel(value: string | null) {
  if (!value) return "Sem data";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

function actionLabel(item: SurveyCatalogItem) {
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

const stateBadgeVariant: Record<Exclude<FilterKey, "ALL">, "success" | "warning" | "info" | "outline" | "neutral"> = {
  OPEN: "success",
  DRAFT: "warning",
  COMPLETED: "info",
  SCHEDULED: "outline",
  CLOSED: "neutral",
};

export default function SurveysPage() {
  const { context, loading, error } = usePlatformContext();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const catalogQuery = useSurveyCatalog(Boolean(context?.person));
  const items = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const catalogLoading = catalogQuery.isLoading;

  const counts = useMemo(() => {
    const result: Record<FilterKey, number> = { ALL: items.length, OPEN: 0, DRAFT: 0, COMPLETED: 0, SCHEDULED: 0, CLOSED: 0 };
    items.forEach((item) => { result[itemFilterState(item)] += 1; });
    return result;
  }, [items]);

  const metrics = useMemo(() => summarizeSurveyCatalog(items), [items]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesTerm = !term || `${item.surveyCode} ${item.surveyName} ${item.applicationCode} ${item.applicationName}`.toLowerCase().includes(term);
      const matchesFilter = filter === "ALL" || itemFilterState(item) === filter;
      return matchesTerm && matchesFilter;
    });
  }, [items, search, filter]);

  if (loading) return <PlatformSkeleton title="Carregando avaliações" />;
  if (!context?.person) return <FullPageState title="Acesso não identificado" description={error || "Não foi possível associar sua sessão a um cadastro ativo."} actionHref="/acesso" actionLabel="Voltar ao acesso" />;

  const modules = deriveModules(context);
  if (!modules.includes(PLATFORM_MODULE.SURVEYS)) {
    return <FullPageState tone="restricted" title="Módulo indisponível" description="Seu perfil não possui acesso ao módulo de avaliações. Fale com a administração se acredita que isso é um engano." />;
  }

  const user = { fullName: context.person.fullName, institutionalEmail: context.person.institutionalEmail, employeeNumber: context.person.employeeNumber, profileLabel: profileLabel(context), avatarUrl: context.person.avatarUrl, roles: context.roles, modules };
  const isAdmin = modules.includes(PLATFORM_MODULE.ADMIN_SURVEYS);

  return (
    <PlatformShell
      user={user}
      eyebrow="Catálogo institucional"
      title="Avaliações"
      actions={isAdmin ? <Link href="/admin/pesquisas/nova" className={cn(buttonVariants({ variant: "primary" }), "hidden sm:inline-flex")}><FilePlus2 className="h-4 w-4" aria-hidden="true" />Nova avaliação</Link> : undefined}
    >
      <div className="space-y-5">
        <Surface className="p-5 sm:p-6">
          <PageHeader
            eyebrow="Instrumentos disponíveis"
            title="Sua jornada de avaliações"
            description="Cada cartão representa um ciclo de avaliação disponível para você. Veja primeiro a situação, depois o prazo e a ação recomendada."
            actions={
              <label className="relative block w-full min-w-64 lg:min-w-80">
                <span className="sr-only">Buscar avaliação</span>
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" aria-hidden="true" />
                <input
                  type="search"
                  enterKeyHint="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar avaliação, código ou ciclo"
                  className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] pl-11 pr-4 text-sm font-semibold text-[var(--text-primary)] outline-none focus:bg-[var(--surface-card)] focus:ring-4 focus:ring-[var(--focus-ring)]/20"
                />
              </label>
            }
          />

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Disponíveis" value={catalogLoading ? "—" : metrics.total} className="p-4" />
            <StatCard label="Pendentes" value={catalogLoading ? "—" : metrics.pending} className="p-4" />
            <StatCard label="Em andamento" value={catalogLoading ? "—" : metrics.inProgress} className="p-4" />
            <StatCard label="Concluídas" value={catalogLoading ? "—" : metrics.completed} className="p-4" />
          </div>

          <div className="mt-5 border-t border-[var(--border-subtle)] pt-4">
            <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar avaliações por situação">
              <Filter className="mr-1 h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
              {filters.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.key}
                  onClick={() => setFilter(item.key)}
                  className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-xs font-black transition ${filter === item.key ? "bg-[var(--brand-primary)] text-white shadow-sm" : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"}`}
                >
                  {item.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${filter === item.key ? "bg-white/15" : "bg-[var(--surface-card)]"}`}>{counts[item.key]}</span>
                </button>
              ))}
            </div>
          </div>
        </Surface>

        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between" aria-live="polite">
          <p className="text-sm font-bold text-[var(--text-primary)]">{catalogLoading ? "Atualizando catálogo..." : `${filtered.length} de ${items.length} ciclo(s) exibido(s)`}</p>
          <p className="text-xs text-[var(--text-secondary)]">A situação combina o período do ciclo com o seu preenchimento.</p>
        </div>

        {catalogLoading ? (
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-64 animate-pulse rounded-2xl bg-[var(--surface-card)] ring-1 ring-[var(--border-subtle)]" />)}
          </section>
        ) : catalogQuery.isError ? (
          <EmptyState
            icon={<RefreshCw className="h-6 w-6" aria-hidden="true" />}
            title="Não foi possível carregar as avaliações"
            description={catalogQuery.error instanceof Error ? catalogQuery.error.message : "Tente novamente em alguns instantes."}
            action={<Button variant="secondary" onClick={() => void catalogQuery.refetch()}><RefreshCw className="h-4 w-4" aria-hidden="true" />Tentar novamente</Button>}
          />
        ) : filtered.length ? (
          <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {filtered.map((item) => {
              const state = itemFilterState(item);
              const completed = state === "COMPLETED";
              return (
                <Surface key={item.applicationId} className="group flex min-h-64 flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-[var(--brand-secondary)]/50 hover:shadow-lg">
                  <div className="h-1 bg-[linear-gradient(90deg,var(--brand-primary),var(--brand-accent),var(--brand-secondary))]" aria-hidden="true" />
                  <div className="flex flex-1 flex-col p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 flex-wrap gap-2">
                        <Badge variant="info">{item.surveyCode}</Badge>
                        <Badge variant="neutral">{item.applicationCode}</Badge>
                      </div>
                      <Badge variant={stateBadgeVariant[state === "ALL" ? "OPEN" : state]} className="shrink-0">{completed ? "Concluída" : state === "DRAFT" ? "Em andamento" : statusLabel(item.applicationStatus)}</Badge>
                    </div>
                    <p className="mt-4 break-words text-[11px] font-black uppercase tracking-[.12em] text-[var(--brand-secondary)]">{item.surveyName}</p>
                    <h3 className="mt-1 line-clamp-2 break-words text-lg font-black leading-snug text-[var(--text-primary)]">{item.applicationName}</h3>
                    <p className="mt-3 line-clamp-2 break-words text-sm leading-6 text-[var(--text-secondary)]">{item.description || "Instrumento institucional disponível conforme seu perfil."}</p>
                    <div className="mt-4 grid grid-cols-2 gap-2 text-[11px] font-bold text-[var(--text-secondary)]">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--surface-muted)] px-2.5 py-2"><ClipboardList className="h-3.5 w-3.5" aria-hidden="true" />{item.sections} seções · {item.questions} perguntas</span>
                      <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--surface-muted)] px-2.5 py-2"><CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />Prazo: {dateLabel(item.closesAt)}</span>
                    </div>
                    <div className="mt-auto flex items-center justify-between gap-3 pt-5">
                      <span className="inline-flex min-w-0 items-center gap-2 truncate text-xs font-bold text-[var(--text-secondary)]">
                        {completed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--status-success-text)]" aria-hidden="true" /> : <FileText className="h-4 w-4 shrink-0 text-[var(--brand-secondary)]" aria-hidden="true" />}
                        {completed ? "Envio concluído" : item.submissionStatus === "DRAFT" ? "Rascunho salvo" : "Não iniciada"}
                      </span>
                      <div className="flex shrink-0 gap-2">
                        {item.canManage ? <Link href={`/admin/pesquisas/${item.surveyId}`} aria-label={`Configurar ${item.surveyName}`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-10 w-10 px-0")}><Settings2 className="h-4 w-4" aria-hidden="true" /></Link> : null}
                        <Link href={surveyApplicationHref(item)} className={buttonVariants({ variant: "primary", size: "sm" })}>{actionLabel(item)}</Link>
                      </div>
                    </div>
                  </div>
                </Surface>
              );
            })}
          </section>
        ) : items.length ? (
          <EmptyState
            icon={<Search className="h-6 w-6" aria-hidden="true" />}
            title="Nenhuma avaliação corresponde aos critérios"
            description="Ajuste o texto da busca ou escolha outro filtro de situação para ver os ciclos disponíveis."
            action={<Button variant="secondary" onClick={() => { setSearch(""); setFilter("ALL"); }}>Limpar busca e filtros</Button>}
          />
        ) : (
          <EmptyState
            title="Nenhuma avaliação disponível no momento"
            description="Quando um novo ciclo for liberado para o seu perfil, ele aparecerá aqui automaticamente."
          />
        )}

        {catalogQuery.isFetching && !catalogLoading ? <p className="flex items-center justify-center text-sm text-[var(--text-secondary)]"><Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />Atualizando catálogo...</p> : null}
      </div>
    </PlatformShell>
  );
}
