"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarClock, CheckCircle2, ClipboardList, FileText, Filter, Loader2, RefreshCw, Search, Settings2 } from "lucide-react";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformWelcome, useWelcomeState } from "@/components/platform-welcome";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader, Surface } from "@/components/ui/surface";
import { useSurveyCatalog } from "@/hooks/use-survey-catalog";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { cn } from "@/lib/utils";
import { summarizeSurveyCatalog, surveyApplicationHref, surveyItemState, type SurveyCatalogItem } from "@/lib/survey-catalog";
import { deadlineLabel, deadlineStatus } from "@/lib/deadline";

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
  const guard = usePlatformGuard(PLATFORM_MODULE.SURVEYS);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const catalogQuery = useSurveyCatalog(guard.state === "granted");
  const items = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const catalogLoading = catalogQuery.isLoading;
  // Matrícula: é como este projeto identifica a pessoa, e é a chave que faz a
  // recepção ser dispensada uma vez só, valendo para as duas telas de entrada.
  const welcome = useWelcomeState(guard.state === "granted" ? guard.person.employeeNumber : "");
  const firstName = guard.state === "granted"
    ? guard.person.fullName.split(/\s+/).filter(Boolean)[0] ?? guard.person.fullName
    : "";

  const counts = useMemo(() => {
    const result: Record<FilterKey, number> = { ALL: items.length, OPEN: 0, DRAFT: 0, COMPLETED: 0, SCHEDULED: 0, CLOSED: 0 };
    items.forEach((item) => { result[itemFilterState(item)] += 1; });
    return result;
  }, [items]);

  const metrics = useMemo(() => summarizeSurveyCatalog(items), [items]);

  // Rótulos e legendas vieram da #19; aqui eles só deixaram de ser quatro
  // `StatCard` para virar uma faixa. `alert` liga o realce de urgência sem que a
  // cor seja o único indicador — a legenda continua dizendo quantas vencem.
  const metricTiles = [
    { label: "Disponíveis", value: metrics.total, description: "total destinado ao seu perfil", alert: false },
    {
      label: "Pendentes",
      // `metrics.pending`, não `metrics.actionable`. `actionable` é
      // `pending + inProgress`, então uma avaliação já iniciada era contada aqui
      // **e** no indicador ao lado: a mesma avaliação aparecia como "ainda não
      // iniciada" e "em andamento" ao mesmo tempo, e a soma dos dois passava do
      // total de "Disponíveis". `/area` sempre usou `pending` — as duas telas
      // discordavam sobre o mesmo catálogo.
      value: metrics.pending,
      description: metrics.urgent > 0
        ? `${metrics.urgent} ${metrics.urgent === 1 ? "vence" : "vencem"} em até 7 dias`
        : "ainda não iniciadas",
      alert: !catalogLoading && metrics.urgent > 0,
    },
    { label: "Em andamento", value: metrics.inProgress, description: "iniciadas e ainda não enviadas", alert: false },
    {
      label: "Finalizadas",
      value: metrics.completed,
      description: metrics.total ? `${metrics.completionRate}% do total` : "respondidas e enviadas",
      alert: false,
    },
  ];

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesTerm = !term || `${item.surveyCode} ${item.surveyName} ${item.applicationCode} ${item.applicationName}`.toLowerCase().includes(term);
      const matchesFilter = filter === "ALL" || itemFilterState(item) === filter;
      return matchesTerm && matchesFilter;
    });
  }, [items, search, filter]);

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="avaliações"
      restrictedTitle="Módulo indisponível"
      restrictedDescription="Seu perfil não possui acesso ao módulo de avaliações. Fale com a administração se acredita que isso é um engano."
    />;
  }

  return (
    <PlatformShell
      user={guard.user}
      eyebrow="Catálogo institucional"
      title="Avaliações"
    >
      <div className="space-y-5">
        {/*
          A recepção mora aqui **e** na Visão geral porque as duas são "primeira
          tela" para públicos diferentes. O Participante não tem o módulo `HOME`:
          `/area` o redireciona para cá. Colocar as boas-vindas só lá deixava a
          mensagem invisível justamente para quem ela foi escrita — quem abre um
          formulário de 52 perguntas pela primeira vez.

          Dispensar numa tela dispensa na outra: a chave é a matrícula, não a
          rota.
        */}
        <PlatformWelcome visible={welcome.visible} onDismiss={welcome.dismiss} firstName={firstName} />
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

          {/*
            Resolução de conflito com a #19, que reescreveu os rótulos destes
            indicadores. Os textos de lá foram mantidos na íntegra — "Pendentes",
            "Finalizadas" e as legendas novas —, e daqui veio só o tratamento
            visual: sem moldura de cartão, porque eram caixas dentro da caixa do
            cabeçalho. É o mesmo padrão da Visão geral, com régua fina separando
            os números.
          */}
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-[var(--border-subtle)] pt-5 sm:grid-cols-4 sm:divide-x sm:divide-[var(--border-subtle)]">
            {metricTiles.map((tile, index) => (
              <div key={tile.label} className={index > 0 ? "sm:pl-6" : undefined}>
                <dt className="text-xs font-semibold uppercase tracking-[.1em] text-[var(--text-secondary)]">{tile.label}</dt>
                <dd>
                  <strong className={`mt-1.5 block text-[1.75rem] font-semibold leading-none tabular-nums ${tile.alert ? "text-[var(--status-warning-text)]" : "text-[var(--brand-primary)]"}`}>
                    {catalogLoading ? "—" : tile.value}
                  </strong>
                  <span className={`mt-2 block text-xs leading-4 ${tile.alert ? "font-semibold text-[var(--status-warning-text)]" : "text-[var(--text-muted)]"}`}>
                    {catalogLoading ? "carregando" : tile.description}
                  </span>
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)] pt-4" role="tablist" aria-label="Filtrar avaliações por situação">
            <Filter className="mr-1 h-4 w-4 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
            {filters.map((item) => (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={filter === item.key}
                onClick={() => setFilter(item.key)}
                className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-xs font-semibold transition ${filter === item.key ? "bg-[var(--brand-solid)] text-[var(--text-on-brand)] shadow-sm" : "bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"}`}
              >
                {item.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${filter === item.key ? "bg-white/20" : "bg-[var(--surface-card)]"}`}>{counts[item.key]}</span>
              </button>
            ))}
          </div>
        </Surface>

        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between" aria-live="polite">
          <p className="text-sm font-semibold text-[var(--text-primary)]">{catalogLoading ? "Atualizando catálogo..." : `${filtered.length} de ${items.length} ciclo(s) exibido(s)`}</p>
          {/* O aviso de urgência que eu tinha posto aqui saiu: com os
              indicadores de volta, ele repetiria a legenda de "Pendentes". */}
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
              const deadline = deadlineStatus(item.closesAt, new Date());
              const showCountdown = item.applicationStatus === "OPEN" && (deadline.state === "counting" || deadline.state === "today");
              return (
                /*
                  Cartão enxugado. Saíram a faixa de gradiente (repetida em todo
                  cartão, virava ruído em vez de marca), os dois selos de código
                  no topo — que competiam com o selo de situação, o único que
                  informa algo acionável — e as caixas cinza em volta dos metadados.
                  Os códigos continuam visíveis, como texto secundário.
                */
                <Surface key={item.applicationId} className="group flex min-h-56 flex-col overflow-hidden transition hover:-translate-y-0.5 hover:border-[var(--brand-secondary)]/50 hover:shadow-lg">
  {/* ↓ min-w-0 é obrigatório aqui para que o flex respeite a largura do card */}
  <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
    <div className="flex items-start justify-between gap-3">
      {/* ↓ min-w-0 + overflow-hidden evita que o título empurre o badge para fora */}
      <p className="min-w-0 break-words text-xs font-semibold uppercase tracking-[.12em] text-[var(--brand-secondary)]">
        {item.surveyName}
      </p>
      <Badge variant={stateBadgeVariant[state === "ALL" ? "OPEN" : state]} className="shrink-0">
        {completed ? "Concluída" : state === "DRAFT" ? "Em andamento" : statusLabel(item.applicationStatus)}
      </Badge>
    </div>

    <h3 className="mt-1.5 line-clamp-2 break-words text-lg font-semibold leading-snug tracking-tight text-[var(--text-primary)]">
      {item.applicationName}
    </h3>

    <p className="mt-1 truncate text-xs text-[var(--text-muted)]" title={`${item.surveyCode} · ${item.applicationCode}`}>
      {item.surveyCode} · {item.applicationCode}
    </p>

    {/* ↓ overflow-hidden reforça o line-clamp; break-all pega strings sem espaços */}
    <p className="mt-3 line-clamp-2 overflow-hidden break-words text-sm leading-6 text-[var(--text-secondary)]">
      {item.description || "Instrumento institucional disponível conforme seu perfil."}
    </p>

    {/* ↓ min-w-0 aqui também, para os metadados não estourarem */}
    <div className="mt-4 flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[var(--text-secondary)]">
      <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
        <ClipboardList className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{item.sections} seções · {item.questions} perguntas</span>
      </span>
      <span className="inline-flex min-w-0 items-center gap-1.5 break-words">
        <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">Prazo: {dateLabel(item.closesAt)}</span>
      </span>
      {showCountdown ? (
        <span className="inline-flex min-w-0 items-center gap-1.5 break-words font-semibold text-[var(--status-warning-text)]" aria-label={`Prazo: ${deadlineLabel(deadline)}`}>
          <CalendarClock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{deadlineLabel(deadline)}</span>
        </span>
      ) : null}
    </div>

    <div className="mt-auto flex min-w-0 items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
      <span className="inline-flex min-w-0 items-center gap-2 truncate text-xs font-semibold text-[var(--text-secondary)]">
        {completed ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-[var(--status-success-text)]" aria-hidden="true" />
        ) : (
          <FileText className="h-4 w-4 shrink-0 text-[var(--brand-secondary)]" aria-hidden="true" />
        )}
        <span className="truncate">
          {completed ? "Envio concluído" : item.submissionStatus === "DRAFT" ? "Rascunho salvo" : "Não iniciada"}
        </span>
      </span>
      <div className="flex shrink-0 gap-2">
        {item.canManage ? (
          <Link href={`/admin/pesquisas/${item.surveyId}`} aria-label={`Configurar ${item.surveyName}`} className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "h-10 w-10 px-0")}>
            <Settings2 className="h-4 w-4" aria-hidden="true" />
          </Link>
        ) : null}
        <Link href={surveyApplicationHref(item)} className={buttonVariants({ variant: "primary", size: "sm" })}>
          {actionLabel(item)}
        </Link>
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
