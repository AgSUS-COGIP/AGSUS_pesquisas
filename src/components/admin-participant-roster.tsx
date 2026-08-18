"use client";

import { Ban, CheckCircle2, Loader2, RefreshCw, Search, UsersRound, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { PersonAvatar } from "@/components/person-avatar";
import {
  alterarStatusDoParticipante,
  listarCiclosDeParticipantes,
  listarParticipantes,
} from "@/lib/api/cliente-pessoas";
import { errorMessageFromUnknown } from "@/lib/observability";
import type {
  AvaliacaoComParticipantes,
  ParticipanteDaAvaliacao,
} from "@/lib/api/contratos-pessoas";

// Lista completa de quem já está vinculado a uma avaliação, com as ações de
// bloquear, remover e reativar. O vínculo de novas pessoas vive em
// `admin-participant-linker`; aqui não se adiciona ninguém.
type ApplicationItem = AvaliacaoComParticipantes;
type Participant = ParticipanteDaAvaliacao;

const STATUS_LABEL: Record<string, string> = {
  ELIGIBLE: "Elegível",
  INVITED: "Convidado",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  BLOCKED: "Bloqueado",
  EXCLUDED: "Removido",
};

const STATUS_FILTERS = [
  { value: "ACTIVE", label: "Ativos" },
  { value: "ALL", label: "Todos" },
  { value: "COMPLETED", label: "Concluídos" },
  { value: "BLOCKED", label: "Bloqueados" },
  { value: "EXCLUDED", label: "Removidos" },
] as const;

type StatusFilter = (typeof STATUS_FILTERS)[number]["value"];

function statusLabel(status: string) {
  return STATUS_LABEL[status] ?? status;
}

function statusTone(status: string) {
  if (status === "COMPLETED") return "bg-emerald-500/15 text-emerald-600";
  if (status === "BLOCKED") return "bg-red-500/15 text-red-600";
  if (status === "EXCLUDED") return "bg-[var(--surface-muted)] text-[var(--text-secondary)]";
  return "bg-sky-500/15 text-sky-600";
}

export function AdminParticipantRoster({ avaliacaoInicial }: { avaliacaoInicial?: string }) {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [applicationId, setApplicationId] = useState(avaliacaoInicial ?? "");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ACTIVE");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");

  const loadApplications = useCallback(async () => {
    const rows = await listarCiclosDeParticipantes();
    setApplications(rows);
    // A avaliação vinda da URL só vale se ainda existir na lista.
    setApplicationId((current) => (current && rows.some((row) => row.id === current) ? current : rows[0]?.id ?? ""));
  }, []);

  const loadParticipants = useCallback(async (targetId: string) => {
    if (!targetId) {
      setParticipants([]);
      return;
    }
    setParticipants(await listarParticipantes(targetId));
  }, []);

  useEffect(() => {
    void loadApplications()
      .catch((error) => toast.error(errorMessageFromUnknown(error) || "Não foi possível carregar as avaliações."))
      .finally(() => setLoading(false));
  }, [loadApplications]);

  useEffect(() => {
    if (!applicationId) return;
    setLoading(true);
    void loadParticipants(applicationId)
      .catch((error) => toast.error(errorMessageFromUnknown(error) || "Não foi possível carregar os participantes."))
      .finally(() => setLoading(false));
  }, [applicationId, loadParticipants]);

  async function refreshAll() {
    setLoading(true);
    try {
      await Promise.all([loadApplications(), loadParticipants(applicationId)]);
    } catch (error) {
      toast.error(errorMessageFromUnknown(error) || "Não foi possível atualizar os participantes.");
    } finally {
      setLoading(false);
    }
  }

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === applicationId) ?? null,
    [applicationId, applications],
  );

  const activeParticipants = useMemo(
    () => participants.filter((participant) => participant.status !== "EXCLUDED"),
    [participants],
  );

  const completedParticipants = useMemo(
    () => participants.filter((participant) => participant.status === "COMPLETED"),
    [participants],
  );

  const visibleParticipants = useMemo(() => {
    const term = search.trim().toLowerCase();
    return participants.filter((participant) => {
      if (statusFilter === "ACTIVE" && participant.status === "EXCLUDED") return false;
      if (statusFilter !== "ACTIVE" && statusFilter !== "ALL" && participant.status !== statusFilter) return false;
      if (!term) return true;
      return [
        participant.fullName,
        participant.employeeNumber,
        participant.institutionalEmail,
        participant.jobTitle,
        participant.costCenter,
      ].some((field) => field?.toLowerCase().includes(term));
    });
  }, [participants, search, statusFilter]);

  async function changeStatus(participantId: string, status: "ELIGIBLE" | "BLOCKED" | "EXCLUDED") {
    setWorking(participantId);
    try {
      await alterarStatusDoParticipante(applicationId, participantId, status);
      toast.success(
        status === "ELIGIBLE"
          ? "Participante reativado."
          : status === "BLOCKED"
            ? "Participante bloqueado."
            : "Participante removido da avaliação.",
      );
      await Promise.all([loadParticipants(applicationId), loadApplications()]);
    } catch (error) {
      toast.error(errorMessageFromUnknown(error) || "Não foi possível alterar o participante.");
    } finally {
      setWorking("");
    }
  }

  return (
    <div className="space-y-5">
      <section className="surface-card p-5 sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[minmax(240px,.75fr)_minmax(0,1.25fr)_auto] lg:items-end">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Avaliação ou ciclo</span>
            <select value={applicationId} onChange={(event) => setApplicationId(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 font-bold text-[var(--text-primary)] outline-none focus:ring-4 focus:ring-sky-200/20">
              {applications.length === 0 ? <option value="">{loading ? "Carregando avaliações…" : "Nenhuma avaliação disponível"}</option> : null}
              {applications.map((application) => <option key={application.id} value={application.id}>{application.code} — {application.name}</option>)}
            </select>
          </label>

          <label className="relative block">
            <span className="text-xs font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Filtrar participantes</span>
            <Search className="absolute bottom-3.5 left-4 h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, matrícula, e-mail, cargo ou coordenação" className="mt-2 h-12 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] pl-11 pr-4 font-semibold text-[var(--text-primary)] outline-none focus:bg-[var(--surface-card)] focus:ring-4 focus:ring-sky-200/20" />
          </label>

          <button type="button" onClick={() => void refreshAll()} disabled={loading} className="secondary-button min-h-12 justify-center disabled:opacity-50">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <RefreshCw className="h-4 w-4" aria-hidden="true" />}
            Atualizar
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">
          {STATUS_FILTERS.map((filter) => (
            <button key={filter.value} type="button" aria-pressed={statusFilter === filter.value} onClick={() => setStatusFilter(filter.value)} className={`rounded-full px-4 py-2 text-xs font-black transition ${statusFilter === filter.value ? "bg-[var(--brand-solid)] text-[var(--text-on-brand)]" : "border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"}`}>
              {filter.label}
            </button>
          ))}
        </div>

        {selectedApplication ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="metric-card">
              <span className="text-xs text-[var(--text-secondary)]">Modo de acesso</span>
              <strong className="mt-1 block text-brand-primary">{selectedApplication.accessMode === "RESTRICTED" ? "Participantes vinculados" : "Institucional"}</strong>
            </div>
            <div className="metric-card">
              <span className="text-xs text-[var(--text-secondary)]">Participantes ativos</span>
              <strong className="mt-1 block text-2xl text-brand-primary">{activeParticipants.length}</strong>
            </div>
            <div className="metric-card">
              <span className="text-xs text-[var(--text-secondary)]">Concluídos</span>
              <strong className="mt-1 block text-2xl text-emerald-600">{completedParticipants.length}</strong>
            </div>
          </div>
        ) : null}
      </section>

      <section className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] p-5">
          <div>
            <p className="section-eyebrow">Público definido</p>
            <h2 className="mt-1 text-xl font-black text-brand-primary">Participantes da avaliação</h2>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-sky-500/15 px-3 py-1.5 text-sm font-black text-brand-primary">
            <UsersRound className="h-4 w-4" aria-hidden="true" />
            {visibleParticipants.length} {visibleParticipants.length === participants.length ? "" : `de ${participants.length}`}
          </span>
        </div>

        {loading ? (
          <div className="grid place-items-center p-12 text-[var(--text-secondary)]">
            <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
          </div>
        ) : visibleParticipants.length ? (
          <div className="divide-y divide-[var(--border-subtle)]">
            {visibleParticipants.map((participant) => (
              <div key={participant.id} className={`flex flex-col gap-4 p-5 lg:flex-row lg:items-center ${participant.status === "EXCLUDED" ? "bg-[var(--surface-muted)] opacity-65" : ""}`}>
                <PersonAvatar fullName={participant.fullName} avatarUrl={participant.avatarUrl} className="h-10 w-10 shrink-0 rounded-xl" />
                <div className="min-w-0 flex-1">
                  <strong className="block truncate text-[var(--text-primary)]">{participant.fullName}</strong>
                  <span className="mt-1 block truncate text-xs text-[var(--text-secondary)]">
                    {participant.employeeNumber} · {participant.institutionalEmail || "Sem e-mail"} · {participant.jobTitle || "Cargo não informado"} · {participant.costCenter || "Sem coordenação"}
                  </span>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${statusTone(participant.status)}`}>{statusLabel(participant.status)}</span>
                <div className="flex flex-wrap gap-2">
                  {["BLOCKED", "EXCLUDED"].includes(participant.status) && !participant.completedAt ? (
                    <button type="button" disabled={working === participant.id} onClick={() => void changeStatus(participant.id, "ELIGIBLE")} className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/40 px-3 py-2 text-xs font-black text-emerald-600 disabled:opacity-50">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />Reativar
                    </button>
                  ) : null}
                  {!["BLOCKED", "EXCLUDED", "COMPLETED"].includes(participant.status) ? (
                    <button type="button" disabled={working === participant.id} onClick={() => void changeStatus(participant.id, "BLOCKED")} className="inline-flex items-center gap-2 rounded-xl border border-amber-500/40 px-3 py-2 text-xs font-black text-amber-600 disabled:opacity-50">
                      <Ban className="h-4 w-4" aria-hidden="true" />Bloquear
                    </button>
                  ) : null}
                  {participant.status !== "EXCLUDED" ? (
                    <button type="button" disabled={working === participant.id} onClick={() => void changeStatus(participant.id, "EXCLUDED")} className="inline-flex items-center gap-2 rounded-xl border border-red-500/40 px-3 py-2 text-xs font-black text-red-600 disabled:opacity-50">
                      <XCircle className="h-4 w-4" aria-hidden="true" />Remover
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-12 text-center text-[var(--text-secondary)]">
            <UsersRound className="mx-auto h-10 w-10 opacity-40" aria-hidden="true" />
            <p className="mt-3 font-bold">
              {participants.length === 0
                ? "Nenhum participante vinculado a esta avaliação."
                : "Nenhum participante corresponde a esse filtro."}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
