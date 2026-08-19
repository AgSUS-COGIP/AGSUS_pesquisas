"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarDays,
  ChevronDown,
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
import { obterPainelCddi } from "@/lib/api/cliente-paineis";
import { listarCiclosDaPesquisa } from "@/lib/api/cliente-pessoas";
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

type FilterOption = { value: string; label: string };

const STATUS_FILTER_OPTIONS: FilterOption[] = [
  { value: "COMPLETE", label: "Ciclo concluído" },
  { value: "AWAITING_LEADER", label: "Aguardando avaliação da chefia" },
  { value: "AWAITING_AUTO", label: "Aguardando autoavaliação" },
  { value: "PENDING", label: "Nenhuma avaliação concluída" },
  { value: "NO_MANAGER", label: "Sem chefia informada" },
];

function normalizeFilterText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
}

function SearchableMultiSelect({
  label,
  options,
  values,
  onChange,
  emptyLabel,
}: {
  label: string;
  options: FilterOption[];
  values: string[];
  onChange: (values: string[]) => void;
  emptyLabel: string;
}) {
  const [search, setSearch] = useState("");
  const normalizedSearch = normalizeFilterText(search.trim());
  const visibleOptions = normalizedSearch
    ? options.filter((option) => normalizeFilterText(option.label).includes(normalizedSearch))
    : options;
  const selected = new Set(values);

  return (
    <div className="block lg:col-span-4">
      <span className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">{label}</span>
      <details name="cddi-filter-multiselect" className="group relative">
        <summary className="flex h-11 cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--control-bg)] px-3 text-sm text-[var(--text-primary)] [&::-webkit-details-marker]:hidden">
          <span className="truncate">{values.length ? `${values.length} selecionado${values.length === 1 ? "" : "s"}` : emptyLabel}</span>
          <ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="relative z-30 mt-2 w-full min-w-[320px] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 shadow-xl">
          <div className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-[var(--text-muted)]" aria-hidden="true" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar nas opções..."
              className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--control-bg)] pl-9 pr-3 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--brand-solid)]"
            />
          </div>
          {values.length ? (
            <button type="button" onClick={() => onChange([])} className="mt-2 text-xs font-black text-[var(--brand-primary)] hover:underline">
              Limpar seleção
            </button>
          ) : null}
          <div className="mt-2 max-h-64 overflow-y-auto rounded-lg border border-[var(--border-subtle)]">
            {visibleOptions.map((option) => (
              <label key={option.value} className="flex cursor-pointer items-start gap-2 border-b border-[var(--border-subtle)] px-3 py-2.5 text-sm last:border-b-0 hover:bg-[var(--surface-interactive)]">
                <input
                  type="checkbox"
                  checked={selected.has(option.value)}
                  onChange={() => onChange(selected.has(option.value) ? values.filter((value) => value !== option.value) : [...values, option.value])}
                  className="mt-0.5 h-4 w-4 accent-[var(--brand-solid)]"
                />
                <span className="leading-5 text-[var(--text-primary)]">{option.label}</span>
              </label>
            ))}
            {!visibleOptions.length ? <p className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">Nenhuma opção encontrada.</p> : null}
          </div>
        </div>
      </details>
    </div>
  );
}

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
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [selectedDirectorates, setSelectedDirectorates] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [participantDraft, setParticipantDraft] = useState<string[]>([]);
  const [directorateDraft, setDirectorateDraft] = useState<string[]>([]);
  const [statusDraft, setStatusDraft] = useState<string[]>([]);
  // Recortes que faltavam. A diretoria sozinha é grossa demais para quem
  // acompanha o ciclo no dia a dia: a pergunta real costuma ser "como está a
  // minha unidade" ou "quem ainda não foi avaliado pela chefia tal".
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedCoordinations, setSelectedCoordinations] = useState<string[]>([]);
  const [selectedManagers, setSelectedManagers] = useState<string[]>([]);
  const [unitDraft, setUnitDraft] = useState<string[]>([]);
  const [coordinationDraft, setCoordinationDraft] = useState<string[]>([]);
  const [managerDraft, setManagerDraft] = useState<string[]>([]);
  // Nenhum código de ciclo escrito aqui: vazio significa "ainda não escolhi", e
  // o painel assume o primeiro da lista — que a RPC já devolve do mais recente
  // para o mais antigo. Com `CDDI-2026` fixo, a segunda edição abriria sempre
  // no ciclo errado.
  const [cycleCode, setCycleCode] = useState<string>("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const granted = guard.state === "granted";

  // Ciclos disponíveis para o seletor. Falha aqui não derruba o painel: sem a
  // lista, resta o ciclo corrente, que é o comportamento anterior.
  const cycles = useQuery({
    queryKey: ["cddi-cycles", granted ? guard.person.id : null],
    enabled: granted,
    queryFn: () => listarCiclosDaPesquisa("CDDI"),
  });

  // Enquanto a lista não chega, `cycleCode` está vazio e o primeiro da lista
  // vale como escolha. Consultar o painel sem código nenhum falharia, então a
  // consulta espera a resolução em vez de disparar no vazio.
  const resolvedCycle = cycleCode || cycles.data?.[0]?.code || "";

  const dashboard = useQuery({
    queryKey: ["cddi-monitoring", granted ? guard.person.id : null, resolvedCycle],
    enabled: granted && Boolean(resolvedCycle),
    queryFn: async () => await obterPainelCddi(resolvedCycle) as DashboardPayload,
  });

  useEffect(() => {
    setPage(1);
  }, [query, participantIds, selectedDirectorates, selectedUnits, selectedCoordinations, selectedManagers, selectedStatuses, pageSize, resolvedCycle]);

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="monitoramento CDDI"
      restrictedTitle="Painéis restritos"
      restrictedDescription="O módulo Painéis está disponível para a administração da plataforma."
    />;
  }
  if (dashboard.isLoading || (cycles.isLoading && !resolvedCycle)) return <PlatformSkeleton title="Montando painel analítico" />;
  // Sem nenhum ciclo do CDDI cadastrado não há painel a montar — e dizer isso é
  // melhor do que deixar o esqueleto girando para sempre.
  if (!resolvedCycle) {
    return (
      <FullPageState
        title={cycles.error ? "Não foi possível listar os ciclos" : "Nenhum ciclo do CDDI cadastrado"}
        description={cycles.error instanceof Error ? cycles.error.message : "Assim que um ciclo for criado e publicado, o painel passa a acompanhá-lo."}
        actionHref="/paineis"
        actionLabel="Voltar aos painéis"
      />
    );
  }
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
  const cycleOptions = cycles.data ?? [];
  const all = data.participants || [];
  const selectedParticipants = all.filter((item) => participantIds.includes(item.personId));

  function matchesStatuses(item: Participant, statuses: string[]) {
    return !statuses.length || statuses.some((status) => participantState(item) === status || (status === "NO_MANAGER" && !item.managerName));
  }

  // Filtros facetados: cada lista considera todas as outras escolhas, menos a
  // própria dimensão. Assim só aparecem combinações que realmente existem.
  function matchesDraftFacets(item: Participant, omit?: "participant" | "directorate" | "unit" | "coordination" | "manager" | "status") {
    return (
      (omit === "participant" || !participantDraft.length || participantDraft.includes(item.personId)) &&
      (omit === "directorate" || !directorateDraft.length || directorateDraft.includes(item.directorate)) &&
      (omit === "unit" || !unitDraft.length || unitDraft.includes(item.unit)) &&
      (omit === "coordination" || !coordinationDraft.length || coordinationDraft.includes(item.coordination)) &&
      (omit === "manager" || !managerDraft.length || (item.managerName ? managerDraft.includes(item.managerName) : false)) &&
      (omit === "status" || matchesStatuses(item, statusDraft))
    );
  }

  const participantOptions = all
    .filter((item) => matchesDraftFacets(item, "participant"))
    .map((item) => ({ value: item.personId, label: `${item.fullName}${item.employeeNumber ? ` · ${item.employeeNumber}` : ""}` }))
    .sort((left, right) => left.label.localeCompare(right.label, "pt-BR"));
  const directorateOptions = Array.from(new Set(all.filter((item) => matchesDraftFacets(item, "directorate")).map((item) => item.directorate).filter(Boolean))).sort().map((value) => ({ value, label: value }));
  const unitOptions = Array.from(new Set(all.filter((item) => matchesDraftFacets(item, "unit")).map((item) => item.unit).filter(Boolean))).sort().map((value) => ({ value, label: value }));
  const coordinationOptions = Array.from(new Set(all.filter((item) => matchesDraftFacets(item, "coordination")).map((item) => item.coordination).filter(Boolean))).sort().map((value) => ({ value, label: value }));
  const managerOptions = Array.from(new Set(all.filter((item) => matchesDraftFacets(item, "manager")).map((item) => item.managerName).filter((value): value is string => Boolean(value)))).sort().map((value) => ({ value, label: value }));
  const statusPeople = all.filter((item) => matchesDraftFacets(item, "status"));
  const availableStatuses = new Set(statusPeople.flatMap((item) => [participantState(item), ...(!item.managerName ? ["NO_MANAGER"] : [])]));
  const statusOptions = STATUS_FILTER_OPTIONS.filter((option) => availableStatuses.has(option.value));

  function retainCompatibleParticipantDraft(overrides: Partial<{ directorate: string[]; unit: string[]; coordination: string[]; manager: string[]; status: string[] }>) {
    const nextDirectorate = overrides.directorate ?? directorateDraft;
    const nextUnit = overrides.unit ?? unitDraft;
    const nextCoordination = overrides.coordination ?? coordinationDraft;
    const nextManager = overrides.manager ?? managerDraft;
    const nextStatus = overrides.status ?? statusDraft;
    setParticipantDraft((current) => current.filter((personId) => {
      const person = all.find((item) => item.personId === personId);
      return Boolean(
        person &&
        (!nextDirectorate.length || nextDirectorate.includes(person.directorate)) &&
        (!nextUnit.length || nextUnit.includes(person.unit)) &&
        (!nextCoordination.length || nextCoordination.includes(person.coordination)) &&
        (!nextManager.length || (person.managerName ? nextManager.includes(person.managerName) : false)) &&
        matchesStatuses(person, nextStatus),
      );
    }));
  }
  const filtered = all.filter((item) => {
    const term = query.trim().toLocaleLowerCase("pt-BR");
    const matchesTerm =
      !term ||
      [item.fullName, item.employeeNumber, item.institutionalEmail, item.managerName, item.unit, item.coordination].some(
        (value) => value?.toLocaleLowerCase("pt-BR").includes(term),
      );
    const matchesDirectorate = !selectedDirectorates.length || selectedDirectorates.includes(item.directorate);
    const matchesParticipant = !participantIds.length || participantIds.includes(item.personId);
    const matchesUnit = !selectedUnits.length || selectedUnits.includes(item.unit);
    const matchesCoordination = !selectedCoordinations.length || selectedCoordinations.includes(item.coordination);
    const matchesManager = !selectedManagers.length || (item.managerName ? selectedManagers.includes(item.managerName) : false);
    const matchesStatus = matchesStatuses(item, selectedStatuses);
    return matchesTerm && matchesParticipant && matchesDirectorate && matchesUnit && matchesCoordination && matchesManager && matchesStatus;
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
    // O comparativo precisa usar a mesma população nas três colunas. Misturar
    // todas as autoavaliações com apenas as avaliações de chefia já pareadas
    // fazia o valor final parecer incompatível com os 40% / 60% exibidos.
    const pairedScores = competencyScores.filter(
      (score) => typeof score.autoScore === "number" && typeof score.leaderScore === "number" && typeof score.finalScore === "number",
    );
    return {
      ...competency,
      auto: avg(pairedScores.map((score) => score.autoScore)),
      leader: avg(pairedScores.map((score) => score.leaderScore)),
      final: avg(pairedScores.map((score) => score.finalScore)),
      completed: pairedScores.length,
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
    setParticipantIds([]); setSelectedDirectorates([]); setSelectedUnits([]); setSelectedCoordinations([]); setSelectedManagers([]); setSelectedStatuses([]);
    setParticipantDraft([]); setDirectorateDraft([]); setUnitDraft([]); setCoordinationDraft([]); setManagerDraft([]); setStatusDraft([]);
  }

  function applyFilters() {
    setParticipantIds(participantDraft);
    setSelectedDirectorates(directorateDraft);
    setSelectedUnits(unitDraft);
    setSelectedCoordinations(coordinationDraft);
    setSelectedManagers(managerDraft);
    setSelectedStatuses(statusDraft);
  }

  const hasActiveFilter = Boolean(query || participantIds.length || selectedDirectorates.length || selectedUnits.length || selectedCoordinations.length || selectedManagers.length || selectedStatuses.length);

  // Clicar num KPI aplica (ou remove, se já ativo) o recorte por situação —
  // como no AgSUS Monitora. O rascunho do filtro acompanha para o painel refletir.
  function selectKpi(key: string) {
    const next = !key ? [] : selectedStatuses.includes(key) ? selectedStatuses.filter((status) => status !== key) : [...selectedStatuses, key];
    setSelectedStatuses(next);
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

  // A linha precisa nomear **todos** os recortes ativos. Um filtro que encolhe o
  // número sem aparecer aqui faz o operador desconfiar do painel.
  const contextLine = hasActiveFilter
    ? `Recorte ativo: ${filtered.length} de ${all.length} participantes${[
        selectedParticipants.length === 1 ? `participante ${selectedParticipants[0].fullName}` : "",
        selectedParticipants.length > 1 ? `${selectedParticipants.length} participantes selecionados` : "",
        selectedDirectorates.length === 1 ? selectedDirectorates[0] : selectedDirectorates.length > 1 ? `${selectedDirectorates.length} diretorias` : "",
        selectedUnits.length === 1 ? selectedUnits[0] : selectedUnits.length > 1 ? `${selectedUnits.length} unidades` : "",
        selectedCoordinations.length === 1 ? selectedCoordinations[0] : selectedCoordinations.length > 1 ? `${selectedCoordinations.length} coordenações` : "",
        selectedManagers.length === 1 ? `chefia ${selectedManagers[0]}` : selectedManagers.length > 1 ? `${selectedManagers.length} chefias` : "",
        selectedStatuses.length === 1 ? statusFilterLabel(selectedStatuses[0]) : selectedStatuses.length > 1 ? `${selectedStatuses.length} situações` : "",
        query.trim() ? `busca "${query.trim()}"` : "",
      ].filter(Boolean).map((part) => ` · ${part}`).join("")}.`
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
          {/*
            O título saiu daqui: a casca recebe `title="AgSUS Monitora CDDI"` e
            já o exibe no cabeçalho, então a mesma frase aparecia duas vezes na
            tela — e, pior, como duas `h1`. Um documento tem um só título de
            primeiro nível; a segunda disputava com a da casca e o leitor de tela
            anunciava o nome do painel em dobro. Fica a frase que explica o que
            a tela faz, que é o que ali informa alguma coisa.
          */}
          <p className="mt-3 max-w-3xl text-sm leading-5 text-[var(--text-secondary)]">
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
            {(hasActiveFilter || participantDraft.length || directorateDraft.length || unitDraft.length || coordinationDraft.length || managerDraft.length || statusDraft.length) ? (
              <button type="button" onClick={clearFilters} className="text-xs font-black text-[var(--brand-primary)] hover:underline">Limpar filtros</button>
            ) : null}
            <button type="button" onClick={() => setShowFilters((visible) => !visible)} className="secondary-button inline-flex h-9 items-center gap-2 px-3 text-xs" aria-expanded={showFilters} aria-controls="dashboard-filters">
              {showFilters ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              {showFilters ? "Ocultar filtros" : "Mostrar filtros"}
            </button>
          </div>
        </div>
        {showFilters ? <form id="dashboard-filters" className="mt-5 grid gap-4 border-t border-[var(--border-subtle)] pt-5 lg:grid-cols-12 lg:items-end" onSubmit={(event) => { event.preventDefault(); applyFilters(); }}>
          {/*
            Saíram dois `select` desabilitados: um "Nível" com a única opção
            "Diretoria" e o "Ciclo avaliativo" travado no código fixo. Controle
            que não muda nada não é filtro — é ruído que faz o operador procurar
            por que não funciona. No lugar entraram os recortes que a operação
            usa de fato, e o seletor de ciclo virou real.
          */}
          <SearchableMultiSelect
            label="Participantes"
            options={participantOptions}
            values={participantDraft}
            onChange={setParticipantDraft}
            emptyLabel="Todas as pessoas"
          />
          <SearchableMultiSelect label="Diretorias" options={directorateOptions} values={directorateDraft} onChange={(values) => { setDirectorateDraft(values); retainCompatibleParticipantDraft({ directorate: values }); }} emptyLabel="Todas as diretorias" />
          <SearchableMultiSelect label="Unidades" options={unitOptions} values={unitDraft} onChange={(values) => { setUnitDraft(values); retainCompatibleParticipantDraft({ unit: values }); }} emptyLabel="Todas as unidades" />
          <SearchableMultiSelect label="Coordenações" options={coordinationOptions} values={coordinationDraft} onChange={(values) => { setCoordinationDraft(values); retainCompatibleParticipantDraft({ coordination: values }); }} emptyLabel="Todas as coordenações" />
          <SearchableMultiSelect label="Chefias" options={managerOptions} values={managerDraft} onChange={(values) => { setManagerDraft(values); retainCompatibleParticipantDraft({ manager: values }); }} emptyLabel="Todas as chefias" />
          <SearchableMultiSelect label="Status" options={statusOptions} values={statusDraft} onChange={(values) => { setStatusDraft(values); retainCompatibleParticipantDraft({ status: values }); }} emptyLabel="Todas as situações" />
          {/*
            O ciclo troca a consulta, não o recorte em memória, então aplica na
            hora — esperar o "Filtrar" faria a tela mostrar dados de um ciclo com
            o seletor exibindo outro. Com um único ciclo cadastrado o controle
            continua visível, mas fica desabilitado e diz por quê.
          */}
          <label className="lg:col-span-4">
            <span className="mb-1.5 block text-xs font-bold text-[var(--text-secondary)]">Ciclo avaliativo</span>
            <select
              value={resolvedCycle}
              onChange={(event) => setCycleCode(event.target.value)}
              disabled={cycleOptions.length < 2}
              title={cycleOptions.length < 2 ? "Só existe um ciclo do CDDI cadastrado" : "Trocar o ciclo recarrega o painel"}
              className="h-11 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--control-bg)] px-3 text-sm text-[var(--text-primary)] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {cycleOptions.length
                ? cycleOptions.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.name} ({item.participants} {item.participants === 1 ? "participante" : "participantes"})
                    </option>
                  ))
                : <option value={data.application.code}>{data.application.name}</option>}
            </select>
          </label>
          <button type="submit" className="primary-button h-11 justify-center lg:col-span-4 lg:col-start-9" aria-label="Aplicar filtros ao relatório"><Filter className="h-4 w-4" />Filtrar</button>
        </form> : null}
      </section>

      <section className="mt-4 space-y-3" aria-label="Indicadores do recorte">
        <div className="monitor-kpi-grid">
          {kpis.map((kpi) => kpi.interactive ? (
            <button
              key={kpi.label}
              type="button"
              data-tone={kpi.tone}
              aria-pressed={kpi.key ? selectedStatuses.includes(kpi.key) : !selectedStatuses.length}
              onClick={() => selectKpi(kpi.key)}
              className={`monitor-kpi ${(kpi.key ? selectedStatuses.includes(kpi.key) : !selectedStatuses.length) ? "is-active" : ""}`}
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
                <button type="button" onClick={() => selectKpi("NO_MANAGER")} aria-pressed={selectedStatuses.includes("NO_MANAGER")} className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition hover:border-[var(--border-strong)] ${selectedStatuses.includes("NO_MANAGER") ? "border-[var(--brand-primary)] bg-[var(--status-info-bg)]" : "border-[var(--border-subtle)] bg-[var(--surface-interactive)]"}`}>
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
              <p className="mt-2 text-sm text-[var(--text-muted)]">Auto, chefia e final usam a mesma base de pessoas com as duas avaliações concluídas.</p>
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
        {/*
          A identificação institucional saiu daqui: a casca já a exibe no rodapé,
          e as duas apareciam uma sobre a outra.

          O que fica é o que só este painel sabe — o instante da apuração. Num
          painel que não revalida sozinho, saber de quando é o número é o que
          separa dado atual de dado velho na tela.
        */}
        <p className="monitor-footer">
          <span>Apurado em {new Date(data.generatedAt).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
        </p>
      </div>
    </PlatformShell>
  );
}
