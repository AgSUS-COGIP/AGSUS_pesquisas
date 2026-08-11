"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  Eye,
  EyeOff,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  TriangleAlert,
  UserRoundX,
} from "lucide-react";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { FullPageState } from "@/components/full-page-state";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { BarSeries, ProgressMeter, RadarChart } from "@/components/platform-charts";
import { average as avg, groupEventsByDay } from "@/lib/chart-data";

type Participant = {
  personId: string;
  employeeNumber: string;
  fullName: string;
  institutionalEmail?: string | null;
  jobTitle?: string | null;
  directorate: string;
  unit: string;
  coordination: string;
  managerName?: string | null;
  autoCompleted: boolean;
  leaderCompleted: boolean;
  autoScore?: number | null;
  leaderScore?: number | null;
  finalScore?: number | null;
  autoSubmittedAt?: string | null;
  leaderSubmittedAt?: string | null;
};

type Competency = { code: string; name: string; position: number };
type CompetencyScore = {
  personId: string;
  competencyCode: string;
  autoScore?: number | null;
  leaderScore?: number | null;
  finalScore?: number | null;
};
type EventRow = { personId: string; submissionType: string; submittedAt: string };
type DashboardPayload = {
  status: string;
  scope: string;
  generatedAt: string;
  application: {
    code: string;
    name: string;
    status: string;
    opensAt?: string | null;
    closesAt?: string | null;
  };
  participants: Participant[];
  competencies: Competency[];
  competencyScores: CompetencyScore[];
  events: EventRow[];
};

type ParticipantState = "COMPLETE" | "AWAITING_LEADER" | "AWAITING_AUTO" | "PENDING";

const PAGE_SIZES = [25, 50, 100];

function pct(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function fmt(value: number | null | undefined) {
  return typeof value === "number" ? value.toFixed(2).replace(".", ",") : "—";
}

function csvCell(value: unknown) {
  const text = String(value ?? "").replaceAll('"', '""');
  return `"${text}"`;
}

function participantState(participant: Participant): ParticipantState {
  if (participant.autoCompleted && participant.leaderCompleted) return "COMPLETE";
  if (participant.autoCompleted) return "AWAITING_LEADER";
  if (participant.leaderCompleted) return "AWAITING_AUTO";
  return "PENDING";
}

function participantStateLabel(state: ParticipantState) {
  if (state === "COMPLETE") return "Concluído";
  if (state === "AWAITING_LEADER") return "Aguardando chefia";
  if (state === "AWAITING_AUTO") return "Aguardando auto";
  return "Não concluído";
}

function participantStateClass(state: ParticipantState) {
  if (state === "COMPLETE") {
    return "border-[var(--status-success-border)] bg-[var(--status-success-bg)] text-[var(--status-success-text)]";
  }
  if (state === "AWAITING_LEADER") {
    return "border-[var(--status-info-border)] bg-[var(--status-info-bg)] text-[var(--status-info-text)]";
  }
  return "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]";
}

function scopeLabel(scope: string) {
  if (scope === "INSTITUTIONAL") return "Institucional";
  if (scope === "TEAM") return "Minha equipe";
  return "Individual";
}

function statusFilterLabel(value: string) {
  if (value === "COMPLETE") return "ciclo concluído";
  if (value === "AWAITING_LEADER") return "aguardando chefia";
  if (value === "AWAITING_AUTO") return "aguardando autoavaliação";
  if (value === "PENDING") return "nenhuma avaliação concluída";
  if (value === "NO_MANAGER") return "sem chefia informada";
  return "";
}

export default function CddiMonitoringPage() {
  const guard = usePlatformGuard(PLATFORM_MODULE.DASHBOARDS);
  const [showFilters, setShowFilters] = useState(false);
  const [query, setQuery] = useState("");
  const [directorate, setDirectorate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [directorateDraft, setDirectorateDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const granted = guard.state === "granted";

  const dashboard = useQuery({
    queryKey: ["cddi-monitoring", granted ? guard.person.id : null],
    enabled: granted,
    queryFn: async () => {
      const supabase = createBrowserSupabaseClient();
      const { data, error: rpcError } = await supabase.rpc("get_cddi_monitoring_dashboard", {
        target_application_code: "CDDI-2026",
      });
      if (rpcError) throw rpcError;
      return data as DashboardPayload;
    },
  });

  useEffect(() => {
    setPage(1);
  }, [query, directorate, statusFilter, pageSize]);

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="monitoramento CDDI"
      restrictedTitle="Painéis restritos"
      restrictedDescription="O módulo Painéis está disponível para a administração da plataforma."
    />;
  }
  if (dashboard.isLoading) return <PlatformSkeleton title="Montando painel analítico" />;
  if (dashboard.error || !dashboard.data) {
    return (
      <FullPageState
        title="Não foi possível carregar o painel"
        description={dashboard.error instanceof Error ? dashboard.error.message : "Tente novamente em alguns instantes."}
        actionHref="/paineis"
        actionLabel="Voltar aos painéis"
      />
    );
  }

  const data = dashboard.data;
  const all = data.participants || [];
  const directorates = Array.from(new Set(all.map((item) => item.directorate).filter(Boolean))).sort();
  const filtered = all.filter((item) => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    const matchesTerm =
      !term ||
      [item.fullName, item.employeeNumber, item.institutionalEmail, item.managerName, item.unit, item.coordination].some(
        (value) => value?.toLocaleLowerCase("pt-BR").includes(term),
      );
    const matchesDirectorate = !directorate || item.directorate === directorate;
    const state = participantState(item);
    const matchesStatus =
      !statusFilter ||
      state === statusFilter ||
      (statusFilter === "NO_MANAGER" && !item.managerName);
    return matchesTerm && matchesDirectorate && matchesStatus;
  });

  const autoDone = filtered.filter((item) => item.autoCompleted).length;
  const leaderDone = filtered.filter((item) => item.leaderCompleted).length;
  const pairs = filtered.filter((item) => item.autoCompleted && item.leaderCompleted).length;
  const pendingAuto = filtered.length - autoDone;
  const pendingLeader = filtered.length - leaderDone;
  const withoutManager = filtered.filter((participant) => !participant.managerName).length;
  const completion = filtered.length ? (pairs / filtered.length) * 100 : 0;
  const stateCounts = filtered.reduce<Record<ParticipantState, number>>(
    (acc, participant) => {
      const state = participantState(participant);
      acc[state] += 1;
      return acc;
    },
    { COMPLETE: 0, AWAITING_LEADER: 0, AWAITING_AUTO: 0, PENDING: 0 },
  );
  const finalAverage = avg(filtered.map((item) => item.finalScore));
  const filteredIds = new Set(filtered.map((participant) => participant.personId));
  const scopedScores = data.competencyScores.filter((score) => filteredIds.has(score.personId));
  const scopedEvents = data.events.filter((event) => filteredIds.has(event.personId));
  const activityPoints = groupEventsByDay(scopedEvents);
  const peakActivity = activityPoints.reduce<(typeof activityPoints)[number] | null>(
    (peak, point) => (!peak || point.value > peak.value ? point : peak),
    null,
  );
  const latestActivity = activityPoints.at(-1) ?? null;
  const dailyAverage = activityPoints.length ? scopedEvents.length / activityPoints.length : 0;
  const hasConsolidated = scopedScores.some((score) => typeof score.finalScore === "number");
  const radarAxes = hasConsolidated
    ? data.competencies.map((competency) => ({
        code: competency.code,
        label: competency.name,
        value: avg(scopedScores.filter((score) => score.competencyCode === competency.code).map((score) => score.finalScore)) ?? 0,
      }))
    : [];
  const finalScoreCount = filtered.filter((participant) => typeof participant.finalScore === "number").length;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const firstVisiblePage = Math.max(1, Math.min(safePage - 2, pageCount - 4));
  const visiblePages = Array.from({ length: Math.min(5, pageCount) }, (_, index) => firstVisiblePage + index);
  const firstRow = filtered.length ? (safePage - 1) * pageSize + 1 : 0;
  const lastRow = Math.min(safePage * pageSize, filtered.length);
  const paginated = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const competencySummary = data.competencies.map((competency) => {
    const competencyScores = scopedScores.filter((score) => score.competencyCode === competency.code);
    return {
      ...competency,
      auto: avg(competencyScores.map((score) => score.autoScore)),
      leader: avg(competencyScores.map((score) => score.leaderScore)),
      final: avg(competencyScores.map((score) => score.finalScore)),
      completed: competencyScores.filter((score) => typeof score.finalScore === "number").length,
    };
  });

  const user = guard.user;

  function exportCsv() {
    const rows = [
      ["Nome", "Matrícula", "Diretoria", "Unidade", "Coordenação", "Chefia", "Situação", "Auto", "Chefia", "Final"],
      ...filtered.map((participant) => [
        participant.fullName,
        participant.employeeNumber,
        participant.directorate,
        participant.unit,
        participant.coordination,
        participant.managerName || "",
        participantStateLabel(participantState(participant)),
        fmt(participant.autoScore),
        fmt(participant.leaderScore),
        fmt(participant.finalScore),
      ]),
    ];
    const content = rows.map((row) => row.map(csvCell).join(";")).join("\n");
    const blob = new Blob([`\ufeff${content}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cddi-monitoramento-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  function clearFilters() {
    setQuery("");
    setDirectorate("");
    setStatusFilter("");
    setDirectorateDraft("");
    setStatusDraft("");
  }

  function applyFilters() {
    setDirectorate(directorateDraft);
    setStatusFilter(statusDraft);
  }

  // Clicar num KPI aplica (ou remove, se já ativo) o recorte por situação —
  // como no AgSUS Monitora. O rascunho do filtro acompanha para o painel refletir.
  function selectKpi(key: string) {
    const next = statusFilter === key ? "" : key;
    setStatusFilter(next);
    setStatusDraft(next);
  }

  const kpis: Array<{ key: string; label: string; value: number | string; tone: "brand" | "success" | "warning" | "danger" | "review"; interactive: boolean }> = [
    { key: "", label: "Participantes", value: filtered.length, tone: "brand", interactive: true },
    { key: "COMPLETE", label: "Ciclo concluído", value: stateCounts.COMPLETE, tone: "success", interactive: true },
    { key: "AWAITING_LEADER", label: "Aguardando chefia", value: stateCounts.AWAITING_LEADER, tone: "warning", interactive: true },
    { key: "AWAITING_AUTO", label: "Aguardando autoavaliação", value: stateCounts.AWAITING_AUTO, tone: "warning", interactive: true },
    { key: "PENDING", label: "Nenhuma concluída", value: stateCounts.PENDING, tone: "danger", interactive: true },
    { key: "NO_MANAGER", label: "Sem chefia informada", value: withoutManager, tone: "review", interactive: true },
    { key: "__taxa", label: "Taxa de conclusão", value: pct(completion), tone: "brand", interactive: false },
  ];

  const contextLine = query || directorate || statusFilter
    ? `Recorte ativo: ${filtered.length} de ${all.length} participantes${directorate ? ` · ${directorate}` : ""}${statusFilter ? ` · ${statusFilterLabel(statusFilter)}` : ""}${query ? ` · busca "${query.trim()}"` : ""}.`
    : `Sem filtros aplicados. Recorte base: ${all.length} participantes do ciclo.`;

  return (
    <PlatformShell user={user} eyebrow="Monitoramento institucional" title="AgSUS Monitora CDDI">
      <div className="monitor-dashboard">
      <header className="monitor-topbar rounded-2xl border border-[var(--border-subtle)] border-t-[3px] border-t-[var(--brand-solid)] bg-[var(--surface-card)] px-5 py-4 shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-1 text-[11px] font-black uppercase tracking-[.1em] text-[var(--status-success-text)]">
              {data.application.status === "OPEN" ? "Ciclo aberto" : data.application.status}
            </span>
            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-interactive)] px-3 py-1 text-[11px] font-black uppercase tracking-[.1em] text-[var(--text-secondary)]">
              Escopo {scopeLabel(data.scope)}
            </span>
          </div>
          <h1 className="mt-3 text-xl font-black tracking-tight text-[var(--text-primary)]">AgSUS Monitora CDDI</h1>
          <p className="mt-1 max-w-3xl text-sm leading-5 text-[var(--text-secondary)]">
            Acompanhe adesão, pendências e resultados consolidados do Ciclo de Devolutivas e Desenvolvimento Individual.
          </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex h-10 items-center rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-interactive)] px-3 text-xs font-bold text-[var(--text-secondary)]">
            <span className="monitor-status-dot mr-2 h-2 w-2 rounded-full bg-[var(--status-success-text)]" />
            Atualizado em {new Date(data.generatedAt).toLocaleString("pt-BR")}
          </span>
          <button
            type="button"
            onClick={() => void dashboard.refetch()}
            disabled={dashboard.isFetching}
            className="secondary-button inline-flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${dashboard.isFetching ? "animate-spin" : ""}`} />
            {dashboard.isFetching ? "Atualizando" : "Atualizar"}
          </button>
          <button type="button" onClick={exportCsv} className="primary-button inline-flex h-10 items-center gap-2">
            <Download className="h-4 w-4" /> Exportar
          </button>
          </div>
        </div>
      </header>

      <section className="monitor-panel monitor-panel--neutral monitor-filter mt-4 rounded-2xl border border-[var(--border-subtle)] border-t-[3px] border-t-[var(--border-strong)] bg-[var(--surface-card)] p-5 shadow-sm" aria-labelledby="dashboard-filter-title">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="section-eyebrow">Filtros base</p>
            <h2 id="dashboard-filter-title" className="mt-1 text-base font-black text-[var(--text-primary)]">Refinar visualização</h2>
          </div>
          <div className="flex items-center gap-3">
            {(query || directorate || statusFilter || directorateDraft || statusDraft) ? (
              <button type="button" onClick={clearFilters} className="text-xs font-black text-[var(--brand-primary)] hover:underline">Limpar filtros</button>
            ) : null}
            <button type="button" onClick={() => setShowFilters((visible) => !visible)} className="secondary-button inline-flex h-9 items-center gap-2 px-3 text-xs" aria-expanded={showFilters} aria-controls="dashboard-filters">
              {showFilters ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showFilters ? "Ocultar filtros" : "Mostrar filtros"}
            </button>
          </div>
        </div>
        {showFilters ? <form id="dashboard-filters" className="mt-5 grid gap-4 border-t border-[var(--border-subtle)] pt-5 lg:grid-cols-12 lg:items-end" onSubmit={(event) => { event.preventDefault(); applyFilters(); }}>
          <label className="lg:col-span-3">
            <span className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">Nível</span>
            <select className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--control-bg)] px-3 text-sm text-[var(--text-primary)]" value="DIRECTORATE" disabled>
              <option value="DIRECTORATE">Diretoria</option>
            </select>
          </label>
          <label className="lg:col-span-3">
            <span className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">Opção</span>
            <select value={directorateDraft} onChange={(event) => setDirectorateDraft(event.target.value)} className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--control-bg)] px-3 text-sm text-[var(--text-primary)]">
              <option value="">Todas as diretorias</option>
              {directorates.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="lg:col-span-3">
            <span className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">Status</span>
            <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value)} className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--control-bg)] px-3 text-sm text-[var(--text-primary)]">
              <option value="">Todas as situações</option>
              <option value="COMPLETE">Ciclo concluído</option>
              <option value="AWAITING_LEADER">Aguardando avaliação da chefia</option>
              <option value="AWAITING_AUTO">Aguardando autoavaliação</option>
              <option value="PENDING">Nenhuma avaliação concluída</option>
              <option value="NO_MANAGER">Sem chefia informada</option>
            </select>
          </label>
          <label className="lg:col-span-2">
            <span className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">Ciclo avaliativo</span>
            <select className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--control-bg)] px-3 text-sm text-[var(--text-primary)]" value={data.application.code} disabled>
              <option value={data.application.code}>{data.application.name}</option>
            </select>
          </label>
          <button type="submit" className="primary-button h-11 justify-center lg:col-span-1" aria-label="Aplicar filtros ao relatório"><Filter className="h-4 w-4" />Filtrar</button>
        </form> : null}
      </section>

      <section className="mt-4 space-y-3" aria-label="Indicadores do recorte">
        <div className="monitor-kpi-grid">
          {kpis.map((kpi) => kpi.interactive ? (
            <button
              key={kpi.label}
              type="button"
              data-tone={kpi.tone}
              aria-pressed={statusFilter === kpi.key}
              onClick={() => selectKpi(kpi.key)}
              className={`monitor-kpi ${statusFilter === kpi.key ? "is-active" : ""}`}
            >
              <span className="monitor-kpi-label">{kpi.label}</span>
              <strong className="monitor-kpi-value">{kpi.value}</strong>
            </button>
          ) : (
            <div key={kpi.label} data-tone={kpi.tone} className="monitor-kpi">
              <span className="monitor-kpi-label">{kpi.label}</span>
              <strong className="monitor-kpi-value">{kpi.value}</strong>
            </div>
          ))}
        </div>
        <p className="monitor-context-line">{contextLine}</p>
      </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
            <article className="monitor-panel rounded-2xl border border-[var(--border-subtle)] border-t-[3px] border-t-[var(--brand-solid)] bg-[var(--surface-card)] p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[.12em] text-[var(--brand-primary)]">Andamento do ciclo</p>
              <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">Progresso por etapa</h2>
              <div className="mt-6 space-y-6">
                <ProgressMeter label="Autoavaliação" value={autoDone} total={filtered.length} description="Participantes que enviaram a própria avaliação" />
                <ProgressMeter label="Avaliação da chefia" value={leaderDone} total={filtered.length} description="Avaliações de liderança concluídas" />
                <ProgressMeter label="Ciclo completo" value={pairs} total={filtered.length} description="Pares com as duas avaliações finalizadas" />
              </div>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--border-subtle)] pt-4 text-sm">
                <span className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{fmt(finalAverage)}</strong> média final</span>
                <span className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{finalScoreCount}</strong> resultados consolidados</span>
              </div>
            </article>

            <article className="monitor-panel monitor-panel--red rounded-2xl border border-[var(--border-subtle)] border-t-[3px] border-t-[var(--status-danger-text)] bg-[var(--surface-card)] p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[.12em] text-[var(--status-warning-text)]">Atenção necessária</p>
              <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">Prioridades operacionais</h2>
              <div className="mt-4 space-y-3">
                <div className="flex items-start gap-3 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-[var(--status-warning-text)]">
                  <Clock3 className="mt-0.5 h-5 w-5 shrink-0" />
                  <div><strong className="block text-sm">{pendingAuto} autoavaliações pendentes</strong><span className="text-xs opacity-80">Participantes ainda sem envio concluído.</span></div>
                </div>
                <div className="flex items-start gap-3 rounded-xl border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-3 text-[var(--status-info-text)]">
                  <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0" />
                  <div><strong className="block text-sm">{pendingLeader} avaliações da chefia pendentes</strong><span className="text-xs opacity-80">Inclui participantes que ainda não concluíram a autoavaliação.</span></div>
                </div>
                <button type="button" onClick={() => selectKpi("NO_MANAGER")} aria-pressed={statusFilter === "NO_MANAGER"} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition hover:border-[var(--border-strong)] ${statusFilter === "NO_MANAGER" ? "border-[var(--brand-primary)] bg-[var(--status-info-bg)]" : "border-[var(--border-subtle)] bg-[var(--surface-interactive)]"}`}>
                  <UserRoundX className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-secondary)]" />
                  <span><strong className="block text-sm text-[var(--text-primary)]">{withoutManager} sem vínculo de chefia</strong><span className="text-xs text-[var(--text-muted)]">A chefia é automática; revise a associação cadastrada em Equipes.</span></span>
                </button>
              </div>
            </article>
          </section>

          <section className="monitor-panel monitor-chart-panel mt-4 rounded-2xl border border-[var(--border-subtle)] border-t-[3px] border-t-[var(--brand-solid)] bg-[var(--surface-card)] p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[.12em] text-[var(--brand-primary)]">Atividade recente</p>
                <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">Respostas enviadas ao longo do tempo</h2>
              </div>
              <span className="w-fit rounded-full bg-[var(--status-info-bg)] px-3 py-1 text-xs font-black text-[var(--status-info-text)]">{scopedEvents.length} envios</span>
            </div>
            <div className="monitor-chart-layout mt-4">
              <div className="min-w-0">
                <BarSeries
                  points={activityPoints}
                  ariaLabel="Respostas enviadas por dia com atividade"
                  emptyState={{ title: "Nenhuma resposta enviada neste recorte", description: "O histórico aparecerá conforme as avaliações forem concluídas." }}
                />
              </div>
              <aside className="monitor-chart-insight" aria-label="Leitura rápida da atividade">
                <div className="relative z-[1] flex items-center gap-2 text-xs font-black uppercase tracking-[.12em] text-cyan-200">
                  <Sparkles className="h-4 w-4" aria-hidden="true" /> Inteligência do período
                </div>
                <div className="monitor-chart-stat">
                  <span><TrendingUp className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> Pico de envios</span>
                  <strong>{peakActivity?.value ?? 0}</strong>
                  <small>{peakActivity ? `registrados em ${peakActivity.label}` : "Sem atividade no recorte"}</small>
                </div>
                <div className="monitor-chart-stat">
                  <span><CalendarDays className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" /> Média por dia ativo</span>
                  <strong>{dailyAverage.toFixed(1).replace(".", ",")}</strong>
                  <small>{activityPoints.length} dia(s) com envio</small>
                </div>
                <div className="monitor-chart-stat">
                  <span>Última movimentação</span>
                  <strong>{latestActivity?.value ?? 0}</strong>
                  <small>{latestActivity?.label ?? "Ainda sem registro"}</small>
                </div>
              </aside>
            </div>
          </section>

        <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_1.15fr]">
          <article className="monitor-panel monitor-panel--cyan rounded-2xl border border-[var(--border-subtle)] border-t-[3px] border-t-[var(--brand-solid)] bg-[var(--surface-card)] p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[.12em] text-[var(--brand-primary)]">Competências</p>
            <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">Radar das médias finais</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Exibe somente resultados consolidados com autoavaliação e avaliação da chefia concluídas.</p>
            <RadarChart
              axes={radarAxes}
              max={5}
              ariaLabel="Radar das médias finais por competência"
              emptyState={{ title: "Resultados consolidados ainda indisponíveis", description: "O radar será exibido quando existirem pares com autoavaliação e avaliação da chefia concluídas." }}
            />
          </article>

          <article className="monitor-panel monitor-panel--green overflow-hidden rounded-2xl border border-[var(--border-subtle)] border-t-[3px] border-t-[var(--status-success-text)] bg-[var(--surface-card)] shadow-sm">
            <div className="border-b border-[var(--border-subtle)] p-5">
              <p className="text-xs font-black uppercase tracking-[.12em] text-[var(--brand-primary)]">Comparativo</p>
              <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">Médias por competência</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-left text-sm">
                <thead className="bg-[var(--surface-interactive)] text-[11px] uppercase tracking-wide text-[var(--text-muted)]">
                  <tr>
                    <th className="px-4 py-3">Competência</th>
                    <th className="px-4 py-3 text-right">Auto</th>
                    <th className="px-4 py-3 text-right">Chefia</th>
                    <th className="px-4 py-3 text-right">Final</th>
                    <th className="px-4 py-3 text-right">Pares</th>
                  </tr>
                </thead>
                <tbody>
                  {competencySummary.map((competency) => (
                    <tr key={competency.code} className="border-t border-[var(--border-subtle)]">
                      <td className="px-4 py-3"><strong className="block text-[var(--text-primary)]">{competency.code}</strong><span className="text-xs text-[var(--text-muted)]">{competency.name}</span></td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--text-secondary)]">{fmt(competency.auto)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--text-secondary)]">{fmt(competency.leader)}</td>
                      <td className="px-4 py-3 text-right font-black text-[var(--brand-primary)]">{fmt(competency.final)}</td>
                      <td className="px-4 py-3 text-right text-[var(--text-secondary)]">{competency.completed}</td>
                    </tr>
                  ))}
                  {!competencySummary.length ? (
                    <tr><td colSpan={5} className="px-4 py-14 text-center text-sm text-[var(--text-muted)]">Nenhuma competência encontrada.</td></tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <section className="monitor-panel mt-4 overflow-hidden rounded-2xl border border-[var(--border-subtle)] border-t-[3px] border-t-[var(--brand-solid)] bg-[var(--surface-card)] shadow-sm">
          <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] p-5 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.12em] text-[var(--brand-primary)]">Acompanhamento individual</p>
              <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">Participantes do recorte</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">A situação diferencia quem aguarda autoavaliação, avaliação da chefia ou conclusão das duas etapas.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label className="relative min-w-64 flex-1">
                <span className="sr-only">Pesquisar no relatório</span>
                <Search className="absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar participante..." className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--control-bg)] pl-10 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-solid)]" />
              </label>
              <button type="button" onClick={exportCsv} className="secondary-button inline-flex h-10 items-center justify-center gap-2 px-3 text-xs"><Download className="h-4 w-4" />Exportar CSV</button>
              <label className="flex h-10 items-center gap-2 whitespace-nowrap text-xs font-bold text-[var(--text-secondary)]">
                Linhas
                <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-10 rounded-lg border border-[var(--border-subtle)] bg-[var(--control-bg)] px-2 text-sm text-[var(--text-primary)]">
                  {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
            </div>
          </div>
          <div className="max-h-[640px] overflow-auto">
            <table className="monitor-table-zebra w-full min-w-[1020px] text-left text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--surface-interactive)] text-[11px] uppercase tracking-wide text-[var(--text-muted)] shadow-sm">
                <tr>
                  <th className="px-4 py-3">Participante</th>
                  <th className="px-4 py-3">Estrutura</th>
                  <th className="px-4 py-3">Chefia</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3 text-right">Auto</th>
                  <th className="px-4 py-3 text-right">Chefia</th>
                  <th className="px-4 py-3 text-right">Final</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((participant) => {
                  const state = participantState(participant);
                  return (
                    <tr key={participant.personId} className="border-t border-[var(--border-subtle)] hover:bg-[var(--surface-interactive)]">
                      <td className="px-4 py-3">
                        <strong className="block text-[var(--text-primary)]">{participant.fullName}</strong>
                        <span className="text-xs text-[var(--text-muted)]">Matrícula {participant.employeeNumber}{participant.institutionalEmail ? ` · ${participant.institutionalEmail}` : ""}</span>
                      </td>
                      <td className="px-4 py-3">
                        <strong className="block text-[var(--text-primary)]">{participant.directorate || "Sem diretoria"}</strong>
                        <span className="block text-xs text-[var(--text-muted)]">{participant.unit || "Sem unidade"}</span>
                        <span className="block text-xs text-[var(--text-muted)]">{participant.coordination || "Sem coordenação"}</span>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{participant.managerName || <span className="font-bold text-[var(--status-danger-text)]">Vínculo não localizado</span>}</td>
                      <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${participantStateClass(state)}`}>{participantStateLabel(state)}</span></td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--text-secondary)]">{fmt(participant.autoScore)}</td>
                      <td className="px-4 py-3 text-right font-bold text-[var(--text-secondary)]">{fmt(participant.leaderScore)}</td>
                      <td className="px-4 py-3 text-right font-black text-[var(--brand-primary)]">{fmt(participant.finalScore)}</td>
                    </tr>
                  );
                })}
                {!paginated.length ? (
                  <tr><td colSpan={7} className="px-4 py-16 text-center text-sm text-[var(--text-muted)]">Nenhum participante encontrado neste recorte.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] p-4 sm:items-center">
            <p className="text-xs text-[var(--text-muted)]">Exibindo {firstRow}–{lastRow} de {filtered.length} participantes</p>
            <nav className="flex flex-wrap items-center justify-center gap-1.5" aria-label="Paginação dos participantes">
              <button type="button" onClick={() => setPage(1)} disabled={safePage <= 1} className="secondary-button inline-flex min-h-9 items-center px-3 py-1.5 text-xs">Primeira</button>
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1} className="secondary-button inline-flex min-h-9 items-center gap-1 px-3 py-1.5 text-xs">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              {firstVisiblePage > 1 ? <span className="px-1 text-xs text-[var(--text-muted)]">…</span> : null}
              {visiblePages.map((pageNumber) => (
                <button
                  key={pageNumber}
                  type="button"
                  onClick={() => setPage(pageNumber)}
                  aria-current={pageNumber === safePage ? "page" : undefined}
                  className={pageNumber === safePage ? "primary-button grid min-h-9 min-w-9 place-items-center px-2 py-1.5 text-xs" : "secondary-button grid min-h-9 min-w-9 place-items-center px-2 py-1.5 text-xs"}
                >
                  {pageNumber}
                </button>
              ))}
              {firstVisiblePage + visiblePages.length - 1 < pageCount ? <span className="px-1 text-xs text-[var(--text-muted)]">…</span> : null}
              <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={safePage >= pageCount} className="secondary-button inline-flex min-h-9 items-center gap-1 px-3 py-1.5 text-xs">
                Próxima <ChevronRight className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => setPage(pageCount)} disabled={safePage >= pageCount} className="secondary-button inline-flex min-h-9 items-center px-3 py-1.5 text-xs">Última</button>
            </nav>
            <p className="text-xs text-[var(--text-muted)]">Página {safePage} de {pageCount}</p>
          </div>
        </section>
        <footer className="monitor-footer">
          <span>Agência Brasileira de Apoio à Gestão do SUS · CDDI 2026</span>
          <span>Atualizado em {new Date(data.generatedAt).toLocaleString("pt-BR")} · <span className="monitor-footer-secure">SEGURO</span></span>
        </footer>
      </div>
    </PlatformShell>
  );
}
