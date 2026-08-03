"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock3, Download, Filter, RefreshCw, Search, ShieldCheck, Users2 } from "lucide-react";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
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
  workplace?: string | null;
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

function Metric({ label, value, hint, tone }: { label: string; value: string | number; hint: string; tone: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className={`mb-3 h-1.5 w-12 rounded-full ${tone}`} />
      <p className="text-[11px] font-bold text-slate-500">{label}</p>
      <strong className="mt-1 block text-3xl font-black tracking-tight text-slate-950">{value}</strong>
      <span className="mt-1 block text-[11px] text-slate-500">{hint}</span>
    </article>
  );
}

function LineChart({ events }: { events: EventRow[] }) {
  const points = useMemo(() => {
    const grouped = new Map<string, number>();
    events.forEach((event) => {
      const key = new Date(event.submittedAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      grouped.set(key, (grouped.get(key) || 0) + 1);
    });
    return Array.from(grouped.entries()).slice(-14);
  }, [events]);

  const max = Math.max(1, ...points.map(([, value]) => value));
  const path = points
    .map(([, value], index) => {
      const x = points.length <= 1 ? 50 : 30 + index * (540 / (points.length - 1));
      const y = 180 - (value / max) * 130;
      return `${index ? "L" : "M"}${x},${y}`;
    })
    .join(" ");

  return (
    <div className="h-60 w-full">
      {points.length ? (
        <svg viewBox="0 0 600 220" className="h-full w-full" role="img" aria-label="Respostas ao longo do tempo">
          {[0, 1, 2, 3, 4].map((tick) => (
            <line key={tick} x1="30" x2="580" y1={40 + tick * 35} y2={40 + tick * 35} stroke="#e2e8f0" />
          ))}
          <path d={path} fill="none" stroke="#0b6db7" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
          {points.map(([label, value], index) => {
            const x = points.length <= 1 ? 50 : 30 + index * (540 / (points.length - 1));
            const y = 180 - (value / max) * 130;
            return (
              <g key={label}>
                <circle cx={x} cy={y} r="5" fill="#0b6db7" />
                <text x={x} y="205" textAnchor="middle" fontSize="11" fill="#64748b">{label}</text>
              </g>
            );
          })}
        </svg>
      ) : (
        <div className="grid h-full place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
          Sem respostas no período.
        </div>
      )}
    </div>
  );
}

function RadarChart({ competencies, scores }: { competencies: Competency[]; scores: CompetencyScore[] }) {
  const center = 160;
  const radius = 110;
  const count = Math.max(1, competencies.length);
  const values = competencies.map(
    (competency) => avg(scores.filter((score) => score.competencyCode === competency.code).map((score) => score.finalScore)) || 0,
  );
  const polygon = values
    .map((value, index) => {
      const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
      const currentRadius = radius * Math.min(1, value / 5);
      return `${center + Math.cos(angle) * currentRadius},${center + Math.sin(angle) * currentRadius}`;
    })
    .join(" ");

  if (!competencies.length) {
    return <div className="grid h-[360px] place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">Competências não encontradas.</div>;
  }

  return (
    <div className="h-[360px] w-full">
      <svg viewBox="0 0 320 320" className="h-full w-full" role="img" aria-label="Radar de competências">
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
            stroke="#dbe4ee"
          />
        ))}
        {competencies.map((competency, index) => {
          const angle = -Math.PI / 2 + (index * Math.PI * 2) / count;
          const x = center + Math.cos(angle) * (radius + 24);
          const y = center + Math.sin(angle) * (radius + 24);
          return (
            <g key={competency.code}>
              <line x1={center} y1={center} x2={center + Math.cos(angle) * radius} y2={center + Math.sin(angle) * radius} stroke="#dbe4ee" />
              <text x={x} y={y} textAnchor="middle" dominantBaseline="middle" fontSize="9" fontWeight="700" fill="#475569">{competency.code}</text>
            </g>
          );
        })}
        <polygon points={polygon} fill="rgba(14,116,144,.18)" stroke="#0e7490" strokeWidth="3" />
      </svg>
    </div>
  );
}

export default function CddiMonitoringPage() {
  const { context, loading, error } = usePlatformContext();
  const [query, setQuery] = useState("");
  const [directorate, setDirectorate] = useState("");
  const [status, setStatus] = useState("");
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const modules = context ? deriveModules(context) : [];

  const dashboard = useQuery({
    queryKey: ["cddi-monitoring", context?.person?.id],
    enabled: Boolean(context?.person),
    queryFn: async () => {
      const { data, error: rpcError } = await supabase.rpc("get_cddi_monitoring_dashboard", {
        target_application_code: "CDDI-2026",
      });
      if (rpcError) throw rpcError;
      return data as DashboardPayload;
    },
  });

  if (loading) return <PlatformSkeleton title="Carregando monitoramento CDDI" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;
  if (dashboard.isLoading) return <PlatformSkeleton title="Montando painel analítico" />;
  if (dashboard.error || !dashboard.data) {
    return (
      <main className="p-10 text-red-700">
        Não foi possível carregar o painel: {dashboard.error instanceof Error ? dashboard.error.message : "erro desconhecido"}
      </main>
    );
  }

  const data = dashboard.data;
  const all = data.participants || [];
  const directorates = Array.from(new Set(all.map((item) => item.directorate))).sort();
  const filtered = all.filter((item) => {
    const term = query.trim().toLowerCase();
    const matchesTerm =
      !term ||
      [item.fullName, item.employeeNumber, item.institutionalEmail, item.managerName, item.unit, item.coordination].some(
        (value) => value?.toLowerCase().includes(term),
      );
    const matchesDirectorate = !directorate || item.directorate === directorate;
    const rowStatus = item.autoCompleted && item.leaderCompleted ? "COMPLETE" : "PENDING";
    const matchesStatus = !status || rowStatus === status;
    return matchesTerm && matchesDirectorate && matchesStatus;
  });

  const autoDone = filtered.filter((item) => item.autoCompleted).length;
  const leaderDone = filtered.filter((item) => item.leaderCompleted).length;
  const pairs = filtered.filter((item) => item.autoCompleted && item.leaderCompleted).length;
  const pending = filtered.length - pairs;
  const completion = filtered.length ? (pairs / filtered.length) * 100 : 0;
  const finalAverage = avg(filtered.map((item) => item.finalScore));
  const filteredIds = new Set(filtered.map((participant) => participant.personId));
  const scopedScores = data.competencyScores.filter((score) => filteredIds.has(score.personId));
  const scopedEvents = data.events.filter((event) => filteredIds.has(event.personId));

  const user = {
    fullName: context.person.fullName,
    institutionalEmail: context.person.institutionalEmail,
    employeeNumber: context.person.employeeNumber,
    profileLabel: profileLabel(context),
    roles: context.roles,
    modules,
  };

  function exportCsv() {
    const rows = [
      "Nome;Matricula;Diretoria;Unidade;Coordenacao;Chefia;Situacao;Auto;Chefia;Final",
      ...filtered.map((participant) =>
        [
          participant.fullName,
          participant.employeeNumber,
          participant.directorate,
          participant.unit,
          participant.coordination,
          participant.managerName || "",
          participant.autoCompleted && participant.leaderCompleted ? "Completo" : "Pendente",
          fmt(participant.autoScore),
          fmt(participant.leaderScore),
          fmt(participant.finalScore),
        ].join(";"),
      ),
    ];
    const blob = new Blob([`\ufeff${rows.join("\n")}`], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "cddi-monitoramento.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <PlatformShell user={user} eyebrow="Monitoramento institucional" title="AgSUS Monitora CDDI">
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-[#0b8f58]">Ciclo de Devolutivas e Desenvolvimento Individual</p>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-[#003b70]">Acompanhamento das respostas</h1>
          <p className="mt-2 text-sm text-slate-500">
            Recorte {data.scope === "INSTITUTIONAL" ? "institucional" : data.scope === "TEAM" ? "da equipe" : "individual"} · atualizado em {new Date(data.generatedAt).toLocaleString("pt-BR")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void dashboard.refetch()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-[#003b70]">
            <RefreshCw className="h-4 w-4" /> Atualizar
          </button>
          <button type="button" onClick={exportCsv} className="inline-flex items-center gap-2 rounded-xl bg-[#075ea8] px-4 py-2.5 text-sm font-bold text-white">
            <Download className="h-4 w-4" /> Exportar
          </button>
        </div>
      </header>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
        <Metric label="Participantes" value={filtered.length} hint="Pessoas no recorte" tone="bg-blue-500" />
        <Metric label="Autoavaliações" value={autoDone} hint="Concluídas" tone="bg-sky-500" />
        <Metric label="Avaliações da chefia" value={leaderDone} hint="Concluídas" tone="bg-violet-500" />
        <Metric label="Pares completos" value={pairs} hint="Auto + chefia" tone="bg-emerald-500" />
        <Metric label="Pendências" value={pending} hint="Pares incompletos" tone="bg-amber-500" />
        <Metric label="Conclusão" value={pct(completion)} hint="Percentual do recorte" tone="bg-teal-500" />
        <Metric label="Média final" value={fmt(finalAverage)} hint="40% auto + 60% chefia" tone="bg-[#003b70]" />
        <Metric label="Escopo" value={data.scope === "INSTITUTIONAL" ? "Geral" : data.scope === "TEAM" ? "Equipe" : "Individual"} hint="Conforme permissões" tone="bg-rose-500" />
      </section>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-sm font-black text-[#003b70]"><Filter className="h-4 w-4" /> Refinar resultados</div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="relative">
            <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nome, matrícula, e-mail ou chefia" className="h-10 w-full rounded-xl border border-slate-200 pl-10 pr-3 text-sm outline-none focus:border-blue-400" />
          </label>
          <select value={directorate} onChange={(event) => setDirectorate(event.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
            <option value="">Todas as diretorias</option>
            {directorates.map((item) => <option key={item}>{item}</option>)}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-slate-200 px-3 text-sm">
            <option value="">Todas as situações</option>
            <option value="COMPLETE">Pares completos</option>
            <option value="PENDING">Pendências</option>
          </select>
        </div>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.45fr_.75fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div><p className="text-xs font-black uppercase tracking-[.12em] text-blue-600">Fluxo das avaliações</p><h2 className="mt-1 text-xl font-black text-slate-950">Respostas ao longo do tempo</h2></div>
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">{scopedEvents.length} respostas</span>
          </div>
          <LineChart events={scopedEvents} />
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[.12em] text-emerald-600">Situação geral</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Conclusão do recorte</h2>
          <div className="mt-8 grid place-items-center">
            <div className="grid h-48 w-48 place-items-center rounded-full" style={{ background: `conic-gradient(#0b8f58 ${completion * 3.6}deg, #e2e8f0 0deg)` }}>
              <div className="grid h-36 w-36 place-items-center rounded-full bg-white text-center">
                <div><strong className="block text-4xl font-black text-[#003b70]">{pct(completion)}</strong><span className="text-xs font-bold uppercase text-slate-400">conclusão</span></div>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section className="mt-5 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[.12em] text-blue-600">Competências</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Radar de competências</h2>
          <RadarChart competencies={data.competencies} scores={scopedScores} />
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[.12em] text-amber-600">Gestão operacional</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Ações prioritárias</h2>
          <div className="mt-4 space-y-3">
            {pending ? (
              <>
                <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3"><Clock3 className="h-5 w-5 text-amber-700" /><div><strong className="block text-sm text-amber-950">{pending} pares incompletos</strong><span className="text-xs text-amber-700">Exigem acompanhamento.</span></div></div>
                <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3"><Users2 className="h-5 w-5 text-blue-700" /><div><strong className="block text-sm text-blue-950">{filtered.filter((participant) => !participant.managerName).length} sem chefia informada</strong><span className="text-xs text-blue-700">Revisar vínculos de liderança.</span></div></div>
              </>
            ) : (
              <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3"><CheckCircle2 className="h-5 w-5 text-emerald-700" /><div><strong className="block text-sm text-emerald-950">Nenhuma ação prioritária</strong><span className="text-xs text-emerald-700">Todos os pares do recorte estão completos.</span></div></div>
            )}
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3"><ShieldCheck className="h-5 w-5 text-slate-600" /><div><strong className="block text-sm text-slate-900">Recorte protegido</strong><span className="text-xs text-slate-500">Dados exibidos conforme seu papel.</span></div></div>
          </div>
        </article>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-5 md:flex-row md:items-center md:justify-between">
          <div><p className="text-xs font-black uppercase tracking-[.12em] text-blue-600">Acompanhamento</p><h2 className="mt-1 text-xl font-black text-slate-950">Visão operacional por participante</h2></div>
          <span className="text-sm font-bold text-slate-500">{filtered.length} participantes</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] text-left text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
              <tr>{["Participante", "Matrícula", "Estrutura", "Coordenação", "Chefia", "Situação", "Auto", "Chefia", "CDDI final"].map((heading) => <th key={heading} className="px-4 py-3">{heading}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((participant) => (
                <tr key={participant.personId} className="border-t border-slate-100 hover:bg-blue-50/40">
                  <td className="px-4 py-3"><strong className="block text-slate-900">{participant.fullName}</strong><span className="text-xs text-slate-500">{participant.institutionalEmail}</span></td>
                  <td className="px-4 py-3">{participant.employeeNumber}</td>
                  <td className="px-4 py-3"><strong className="block">{participant.directorate}</strong><span className="text-xs text-slate-500">{participant.unit}</span></td>
                  <td className="px-4 py-3">{participant.coordination}</td>
                  <td className="px-4 py-3">{participant.managerName || "Não informada"}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${participant.autoCompleted && participant.leaderCompleted ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>{participant.autoCompleted && participant.leaderCompleted ? "Completo" : "Pendente"}</span></td>
                  <td className="px-4 py-3 font-bold">{fmt(participant.autoScore)}</td>
                  <td className="px-4 py-3 font-bold">{fmt(participant.leaderScore)}</td>
                  <td className="px-4 py-3 font-black text-[#003b70]">{fmt(participant.finalScore)}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={9} className="px-4 py-14 text-center text-sm text-slate-500">Nenhum participante encontrado neste recorte.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </PlatformShell>
  );
}
