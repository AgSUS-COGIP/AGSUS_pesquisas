"use client";

import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  Filter,
  LayoutDashboard,
  ListChecks,
  RefreshCw,
  Search,
  ShieldCheck,
  TriangleAlert,
  UserRoundX,
  Users2,
} from "lucide-react";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { FullPageState } from "@/components/full-page-state";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

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

type DashboardView = "OVERVIEW" | "COMPETENCIES" | "PARTICIPANTS";
type ParticipantState = "COMPLETE" | "AWAITING_LEADER" | "AWAITING_AUTO" | "PENDING";

const PAGE_SIZES = [25, 50, 100];

function pct(value: number) {
  return `${value.toFixed(1).replace(".", ",")}%`;
}

function avg(values: Array<number | null | undefined>) {
  const valid = values.filter((value): value is number => typeof value === "number");
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
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

function Metric({ icon, label, value, hint, accent }: { icon: ReactNode; label: string; value: string | number; hint: string; accent: string }) {
  return (
    <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`grid h-10 w-10 place-items-center rounded-xl ${accent}`}>{icon}</div>
        <span className="text-[10px] font-black uppercase tracking-[.12em] text-[var(--text-muted)]">CDDI</span>
      </div>
      <p className="mt-4 text-xs font-bold text-[var(--text-secondary)]">{label}</p>
      <strong className="mt-1 block text-3xl font-black tracking-tight text-[var(--text-primary)]">{value}</strong>
      <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{hint}</span>
    </article>
  );
}

function ProgressRow({ label, value, total, description }: { label: string; value: number; total: number; description: string }) {
  const percentage = total ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-sm font-black text-[var(--text-primary)]">{label}</p>
          <p className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</p>
        </div>
        <div className="text-right">
          <strong className="block text-sm text-[var(--text-primary)]">{value} de {total}</strong>
          <span className="text-xs font-bold text-[var(--brand-primary)]">{pct(percentage)}</span>
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-interactive)]">
        <div className="h-full rounded-full bg-[var(--brand-solid)] transition-[width] duration-300" style={{ width: `${Math.min(100, percentage)}%` }} />
      </div>
    </div>
  );
}

function TabButton({ active, icon, label, count, onClick }: { active: boolean; icon: ReactNode; label: string; count?: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 py-2 text-sm font-black transition ${
        active
          ? "border-[var(--brand-solid)] bg-[var(--brand-solid)] text-[var(--text-on-brand)]"
          : "border-[var(--border-subtle)] bg-[var(--surface-card)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-interactive)]"
      }`}
    >
      {icon}
      {label}
      {typeof count === "number" ? (
        <span className={`rounded-full px-2 py-0.5 text-[10px] ${active ? "bg-white/15 text-white" : "bg-[var(--surface-interactive)] text-[var(--text-muted)]"}`}>{count}</span>
      ) : null}
    </button>
  );
}

function ActivityChart({ events }: { events: EventRow[] }) {
  const points = useMemo(() => {
    const grouped = new Map<string, { label: string; value: number }>();
    events.forEach((event) => {
      const date = new Date(event.submittedAt);
      const key = date.toISOString().slice(0, 10);
      const label = date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const previous = grouped.get(key)?.value ?? 0;
      grouped.set(key, { label, value: previous + 1 });
    });
    return Array.from(grouped.entries())
      .sort(([first], [second]) => first.localeCompare(second))
      .slice(-14)
      .map(([, value]) => value);
  }, [events]);

  if (!points.length) {
    return (
      <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-interactive)] px-6 text-center">
        <div>
          <BarChart3 className="mx-auto h-8 w-8 text-[var(--text-muted)]" aria-hidden="true" />
          <p className="mt-3 font-black text-[var(--text-primary)]">Nenhuma resposta enviada neste recorte</p>
          <p className="mt-1 text-sm text-[var(--text-muted)]">O histórico aparecerá conforme as avaliações forem concluídas.</p>
        </div>
      </div>
    );
  }

  const maximum = Math.max(...points.map((point) => point.value), 1);

  return (
    <div className="mt-6 flex min-h-64 items-end gap-2 overflow-x-auto pb-2" role="img" aria-label="Respostas enviadas nos últimos dias com atividade">
      {points.map((point) => {
        const height = Math.max(16, Math.round((point.value / maximum) * 176));
        return (
          <div key={point.label} className="flex min-w-11 flex-1 flex-col items-center justify-end gap-2">
            <span className="text-xs font-black text-[var(--text-primary)]">{point.value}</span>
            <div className="w-full max-w-12 rounded-t-lg bg-[var(--brand-solid)]" style={{ height }} title={`${point.value} resposta(s) em ${point.label}`} />
            <span className="text-[10px] font-bold text-[var(--text-muted)]">{point.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function RadarChart({ competencies, scores }: { competencies: Competency[]; scores: CompetencyScore[] }) {
  const validScores = scores.filter((score) => typeof score.finalScore === "number");
  if (!competencies.length || !validScores.length) {
    return (
      <div className="grid min-h-[360px] place-items-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-interactive)] px-8 text-center">
        <div>
          <BarChart3 className="mx-auto h-9 w-9 text-[var(--text-muted)]" aria-hidden="true" />
          <p className="mt-3 font-black text-[var(--text-primary)]">Resultados consolidados ainda indisponíveis</p>
          <p className="mt-1 max-w-md text-sm leading-6 text-[var(--text-muted)]">O radar será exibido quando existirem pares com autoavaliação e avaliação da chefia concluídas.</p>
        </div>
      </div>
    );
  }

  const center = 160;
  const radius = 110;
  const count = Math.max(1, competencies.length);
  const values = competencies.map(
    (competency) => avg(validScores.filter((score) => score.competencyCode === competency.code).map((score) => score.finalScore)) || 0,
  );
  const polygon = values
    .map((value, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
      const currentRadius = radius * Math.min(1, value / 5);
      return `${center + Math.cos(angle) * currentRadius},${center + Math.sin(angle) * currentRadius}`;
    })
    .join(" ");

  return (
    <div className="h-[380px] w-full">
      <svg viewBox="0 0 320 320" className="h-full w-full" role="img" aria-label="Radar das médias finais por competência">
        {[1, 2, 3, 4, 5].map((level) => (
          <polygon
            key={level}
            points={competencies
              .map((_, index) => {
                const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
                const currentRadius = (radius * level) / 5;
                return `${center + Math.cos(angle) * currentRadius},${center + Math.sin(angle) * currentRadius}`;
              })
              .join(" ")}
            fill="none"
            stroke="var(--border-subtle)"
          />
        ))}
        {competencies.map((competency, index) => {
          const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
          const x = center + Math.cos(angle) * (radius + 24);
          const y = center + Math.sin(angle) * (radius + 24);
          return (
            <g key={competency.code}>
              <line x1={center} y1={center} x2={center + Math.cos(angle) * radius} y2={center + Math.sin(angle) * radius} stroke="var(--border-subtle)" />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="700" fill="var(--text-secondary)">{competency.code}</text>
            </g>
          );
        })}
        <polygon points={polygon} fill="color-mix(in srgb, var(--brand-solid) 22%, transparent)" stroke="var(--brand-solid)" strokeWidth="3" />
      </svg>
    </div>
  );
}

export default function CddiMonitoringPage() {
  const guard = usePlatformGuard(PLATFORM_MODULE.DASHBOARDS);
  const [view, setView] = useState<DashboardView>("OVERVIEW");
  const [query, setQuery] = useState("");
  const [directorate, setDirectorate] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
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
  const finalAverage = avg(filtered.map((item) => item.finalScore));
  const filteredIds = new Set(filtered.map((participant) => participant.personId));
  const scopedScores = data.competencyScores.filter((score) => filteredIds.has(score.personId));
  const scopedEvents = data.events.filter((event) => filteredIds.has(event.personId));
  const finalScoreCount = filtered.filter((participant) => typeof participant.finalScore === "number").length;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
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
  }

  return (
    <PlatformShell user={user} eyebrow="Monitoramento institucional" title="AgSUS Monitora CDDI">
      <header className="flex flex-col gap-5 border-b border-[var(--border-subtle)] pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-[var(--status-success-border)] bg-[var(--status-success-bg)] px-3 py-1 text-[11px] font-black uppercase tracking-[.1em] text-[var(--status-success-text)]">
              {data.application.status === "OPEN" ? "Ciclo aberto" : data.application.status}
            </span>
            <span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-interactive)] px-3 py-1 text-[11px] font-black uppercase tracking-[.1em] text-[var(--text-secondary)]">
              Escopo {scopeLabel(data.scope)}
            </span>
          </div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-[var(--text-primary)]">Painel CDDI 2026</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            Acompanhe adesão, pendências e resultados consolidados do Ciclo de Devolutivas e Desenvolvimento Individual.
          </p>
          <p className="mt-2 text-xs text-[var(--text-muted)]">Atualizado em {new Date(data.generatedAt).toLocaleString("pt-BR")}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void dashboard.refetch()}
            disabled={dashboard.isFetching}
            className="secondary-button inline-flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${dashboard.isFetching ? "animate-spin" : ""}`} />
            {dashboard.isFetching ? "Atualizando" : "Atualizar"}
          </button>
          <button type="button" onClick={exportCsv} className="primary-button inline-flex items-center gap-2">
            <Download className="h-4 w-4" /> Exportar recorte
          </button>
        </div>
      </header>

      <nav className="mt-5 flex flex-wrap gap-2" aria-label="Áreas do painel CDDI">
        <TabButton active={view === "OVERVIEW"} icon={<LayoutDashboard className="h-4 w-4" />} label="Resumo" onClick={() => setView("OVERVIEW")} />
        <TabButton active={view === "COMPETENCIES"} icon={<BarChart3 className="h-4 w-4" />} label="Competências" count={finalScoreCount} onClick={() => setView("COMPETENCIES")} />
        <TabButton active={view === "PARTICIPANTS"} icon={<ListChecks className="h-4 w-4" />} label="Participantes" count={filtered.length} onClick={() => setView("PARTICIPANTS")} />
      </nav>

      <section className="mt-4 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-2 text-sm font-black text-[var(--text-primary)]">
            <Filter className="h-4 w-4 text-[var(--brand-primary)]" /> Recorte do painel
            <span className="font-normal text-[var(--text-muted)]">{filtered.length} de {all.length} participantes</span>
          </div>
          {(query || directorate || statusFilter) ? (
            <button type="button" onClick={clearFilters} className="text-xs font-black text-[var(--brand-primary)] hover:underline">Limpar filtros</button>
          ) : null}
        </div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <label className="relative">
            <span className="sr-only">Pesquisar participante</span>
            <Search className="absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Nome, matrícula, e-mail ou chefia"
              className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--control-bg)] pl-10 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-solid)]"
            />
          </label>
          <label>
            <span className="sr-only">Filtrar por diretoria</span>
            <select value={directorate} onChange={(event) => setDirectorate(event.target.value)} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--control-bg)] px-3 text-sm text-[var(--text-primary)]">
              <option value="">Todas as diretorias</option>
              {directorates.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label>
            <span className="sr-only">Filtrar por situação</span>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--control-bg)] px-3 text-sm text-[var(--text-primary)]">
              <option value="">Todas as situações</option>
              <option value="COMPLETE">Ciclo concluído</option>
              <option value="AWAITING_LEADER">Aguardando avaliação da chefia</option>
              <option value="AWAITING_AUTO">Aguardando autoavaliação</option>
              <option value="PENDING">Nenhuma avaliação concluída</option>
              <option value="NO_MANAGER">Sem chefia informada</option>
            </select>
          </label>
        </div>
      </section>

      {view === "OVERVIEW" ? (
        <>
          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric icon={<Users2 className="h-5 w-5" />} label="Participantes" value={filtered.length} hint="Pessoas no recorte atual" accent="bg-blue-50 text-blue-700" />
            <Metric icon={<CheckCircle2 className="h-5 w-5" />} label="Autoavaliações concluídas" value={autoDone} hint={`${pct(filtered.length ? (autoDone / filtered.length) * 100 : 0)} do recorte`} accent="bg-cyan-50 text-cyan-700" />
            <Metric icon={<ShieldCheck className="h-5 w-5" />} label="Avaliações da chefia" value={leaderDone} hint={`${pct(filtered.length ? (leaderDone / filtered.length) * 100 : 0)} do recorte`} accent="bg-violet-50 text-violet-700" />
            <Metric icon={<ListChecks className="h-5 w-5" />} label="Ciclos completos" value={pairs} hint={`${pct(completion)} com auto + chefia`} accent="bg-emerald-50 text-emerald-700" />
          </section>

          <section className="mt-5 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
            <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-sm">
              <p className="text-xs font-black uppercase tracking-[.12em] text-[var(--brand-primary)]">Andamento do ciclo</p>
              <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">Progresso por etapa</h2>
              <div className="mt-6 space-y-6">
                <ProgressRow label="Autoavaliação" value={autoDone} total={filtered.length} description="Participantes que enviaram a própria avaliação" />
                <ProgressRow label="Avaliação da chefia" value={leaderDone} total={filtered.length} description="Avaliações de liderança concluídas" />
                <ProgressRow label="Ciclo completo" value={pairs} total={filtered.length} description="Pares com as duas avaliações finalizadas" />
              </div>
              <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--border-subtle)] pt-4 text-sm">
                <span className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{fmt(finalAverage)}</strong> média final</span>
                <span className="text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">{finalScoreCount}</strong> resultados consolidados</span>
              </div>
            </article>

            <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-sm">
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
                <div className="flex items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-interactive)] p-3 text-[var(--text-secondary)]">
                  <UserRoundX className="mt-0.5 h-5 w-5 shrink-0" />
                  <div><strong className="block text-sm text-[var(--text-primary)]">{withoutManager} sem chefia informada</strong><span className="text-xs text-[var(--text-muted)]">Revisar o vínculo antes da etapa da liderança.</span></div>
                </div>
              </div>
            </article>
          </section>

          <section className="mt-5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[.12em] text-[var(--brand-primary)]">Atividade recente</p>
                <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">Respostas enviadas ao longo do tempo</h2>
              </div>
              <span className="w-fit rounded-full bg-[var(--status-info-bg)] px-3 py-1 text-xs font-black text-[var(--status-info-text)]">{scopedEvents.length} envios</span>
            </div>
            <ActivityChart events={scopedEvents} />
          </section>
        </>
      ) : null}

      {view === "COMPETENCIES" ? (
        <section className="mt-5 grid gap-4 xl:grid-cols-[1fr_1.15fr]">
          <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[.12em] text-[var(--brand-primary)]">Competências</p>
            <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">Radar das médias finais</h2>
            <p className="mt-2 text-sm leading-6 text-[var(--text-muted)]">Exibe somente resultados consolidados com autoavaliação e avaliação da chefia concluídas.</p>
            <RadarChart competencies={data.competencies} scores={scopedScores} />
          </article>

          <article className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-sm">
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
      ) : null}

      {view === "PARTICIPANTS" ? (
        <section className="mt-5 overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[var(--border-subtle)] p-5 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[.12em] text-[var(--brand-primary)]">Acompanhamento individual</p>
              <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">Participantes do recorte</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">A situação diferencia quem aguarda autoavaliação, avaliação da chefia ou conclusão das duas etapas.</p>
            </div>
            <label className="flex items-center gap-2 text-xs font-bold text-[var(--text-secondary)]">
              Exibir
              <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="h-9 rounded-lg border border-[var(--border-subtle)] bg-[var(--control-bg)] px-2 text-sm text-[var(--text-primary)]">
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
              por página
            </label>
          </div>
          <div className="max-h-[640px] overflow-auto">
            <table className="w-full min-w-[1020px] text-left text-sm">
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
                      <td className="px-4 py-3 text-[var(--text-secondary)]">{participant.managerName || <span className="font-bold text-[var(--status-danger-text)]">Não informada</span>}</td>
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
          <div className="flex flex-col gap-3 border-t border-[var(--border-subtle)] p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--text-muted)]">Exibindo {firstRow}–{lastRow} de {filtered.length} participantes</p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={safePage <= 1} className="secondary-button inline-flex min-h-9 items-center gap-1 px-3 py-1.5 text-xs">
                <ChevronLeft className="h-4 w-4" /> Anterior
              </button>
              <span className="min-w-20 text-center text-xs font-black text-[var(--text-secondary)]">Página {safePage} de {pageCount}</span>
              <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={safePage >= pageCount} className="secondary-button inline-flex min-h-9 items-center gap-1 px-3 py-1.5 text-xs">
                Próxima <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
      ) : null}
    </PlatformShell>
  );
}
