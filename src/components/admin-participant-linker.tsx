"use client";

import Link from "next/link";
import { ArrowRight, CheckSquare2, Loader2, Search, Square, UserRoundPlus, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirmation-provider";
import { PersonAvatar } from "@/components/person-avatar";
import {
  listarCiclosDeParticipantes,
  listarPessoasDisponiveis,
  vincularParticipantes,
} from "@/lib/api/cliente-pessoas";
import { errorMessageFromUnknown } from "@/lib/observability";
import type {
  AvaliacaoComParticipantes,
  PessoaCandidataAoCiclo,
} from "@/lib/api/contratos-pessoas";

// Esta tela substitui `admin-participant-bulk-selector` e a metade de vínculo de
// `admin-participant-management`: as duas repetiam o mesmo par de campos
// (avaliação + busca) contra a mesma RPC, e quem usava precisava adivinhar qual
// dos dois seletores valia. Aqui existe um par só, e a lista dos já vinculados
// mora em /admin/participantes/todos. Vincula só quem já está na base
// institucional — cadastro de pessoa nova não faz parte desta tela.
type ApplicationItem = AvaliacaoComParticipantes;
type PersonSearchResult = PessoaCandidataAoCiclo;

const MIN_SEARCH_LENGTH = 2;

/** Já vinculada e ativa — só quem está fora, bloqueada ou removida pode entrar. */
function isLinked(person: PersonSearchResult) {
  return person.participantStatus !== null && !["BLOCKED", "EXCLUDED"].includes(person.participantStatus);
}

export function AdminParticipantLinker() {
  const confirm = useConfirm();
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState<PersonSearchResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [working, setWorking] = useState(false);
  const [assigningAll, setAssigningAll] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const rows = await listarCiclosDeParticipantes();
        setApplications(rows);
        setApplicationId(rows[0]?.id ?? "");
      } catch (error) {
        toast.error(errorMessageFromUnknown(error) || "Não foi possível carregar as avaliações.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  useEffect(() => {
    setSelected(new Set());
    if (!applicationId || search.trim().length < MIN_SEARCH_LENGTH) {
      setPeople([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const timeout = window.setTimeout(async () => {
      try {
        setPeople(await listarPessoasDisponiveis(applicationId, { busca: search.trim() }));
      } catch (searchError) {
        toast.error(errorMessageFromUnknown(searchError) || "Não foi possível pesquisar pessoas.");
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [applicationId, search]);

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === applicationId) ?? null,
    [applicationId, applications],
  );

  const eligiblePeople = useMemo(() => people.filter((person) => !isLinked(person)), [people]);
  const alreadyLinkedCount = people.length - eligiblePeople.length;
  const allVisibleSelected = eligiblePeople.length > 0 && eligiblePeople.every((person) => selected.has(person.personId));
  const busy = working || assigningAll;

  function togglePerson(personId: string) {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(personId)) next.delete(personId);
      else next.add(personId);
      return next;
    });
  }

  function toggleVisible() {
    setSelected((current) => {
      const next = new Set(current);
      if (allVisibleSelected) eligiblePeople.forEach((person) => next.delete(person.personId));
      else eligiblePeople.forEach((person) => next.add(person.personId));
      return next;
    });
  }

  function resetSearch() {
    setSelected(new Set());
    setSearch("");
    setPeople([]);
  }

  /** Recarrega os contadores do cabeçalho depois de mexer no público. */
  async function refreshApplications() {
    try {
      setApplications(await listarCiclosDeParticipantes());
    } catch {
      // O vínculo já foi gravado; contador desatualizado não merece um alerta.
    }
  }

  async function assignSelected() {
    if (!applicationId || selected.size === 0) return;
    setWorking(true);
    try {
      const result = await vincularParticipantes(applicationId, { pessoas: Array.from(selected) });
      toast.success(`${result.assignedCount ?? 0} vinculadas, ${result.reactivatedCount ?? 0} reativadas e ${result.skippedCount ?? 0} já existentes.`);
      resetSearch();
      await refreshApplications();
    } catch (error) {
      toast.error(errorMessageFromUnknown(error) || "Não foi possível vincular as pessoas selecionadas.");
    } finally {
      setWorking(false);
    }
  }

  async function assignAllAvailable() {
    if (!applicationId || !selectedApplication) return;
    const confirmed = await confirm({
      title: "Vincular todas as pessoas elegíveis?",
      description: `Todas as pessoas ativas e elegíveis serão vinculadas a “${selectedApplication.code} — ${selectedApplication.name}”. Lideranças marcadas como não avaliáveis serão excluídas automaticamente.`,
      confirmLabel: "Vincular todas",
    });
    if (!confirmed) return;

    setAssigningAll(true);
    try {
      const result = await vincularParticipantes(applicationId, { todosDisponiveis: true });
      toast.success(`${result.assignedCount ?? 0} vinculadas, ${result.reactivatedCount ?? 0} reativadas e ${result.skippedCount ?? 0} já vinculadas.`);
      resetSearch();
      await refreshApplications();
    } catch (error) {
      toast.error(errorMessageFromUnknown(error) || "Não foi possível vincular todo o público disponível.");
    } finally {
      setAssigningAll(false);
    }
  }

  return (
    <section className="surface-card p-5 sm:p-6" aria-labelledby="participant-linker-title">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="section-eyebrow">Vínculo de participantes</p>
          <h2 id="participant-linker-title" className="mt-1 text-xl font-black text-brand-primary">Vincular pessoas a uma avaliação</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">
            Escolha a avaliação, busque na base institucional e vincule uma ou várias pessoas de uma vez. Todas as operações registram auditoria.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={!applicationId || busy} onClick={() => void assignAllAvailable()} className="secondary-button min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-50">
            {assigningAll ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UserRoundPlus className="h-4 w-4" aria-hidden="true" />}
            Vincular todos os disponíveis
          </button>
          <button type="button" disabled={!selected.size || busy} onClick={() => void assignSelected()} className="primary-button min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-50">
            {working ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UsersRound className="h-4 w-4" aria-hidden="true" />}
            Vincular {selected.size || "selecionadas"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(240px,.75fr)_minmax(0,1.25fr)]">
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Avaliação ou ciclo</span>
          <select disabled={loading || busy} value={applicationId} onChange={(event) => setApplicationId(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 font-bold text-[var(--text-primary)] outline-none focus:ring-4 focus:ring-sky-200/20">
            {applications.length === 0 ? <option value="">{loading ? "Carregando avaliações…" : "Nenhuma avaliação disponível"}</option> : null}
            {applications.map((application) => <option key={application.id} value={application.id}>{application.code} — {application.name}</option>)}
          </select>
        </label>

        <label className="relative block">
          <span className="text-xs font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Buscar pessoa na base institucional</span>
          <Search className="absolute bottom-3.5 left-4 h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} disabled={!applicationId} placeholder="Nome, matrícula, e-mail, cargo ou coordenação" className="mt-2 h-12 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] pl-11 pr-4 font-semibold text-[var(--text-primary)] outline-none focus:bg-[var(--surface-card)] focus:ring-4 focus:ring-sky-200/20 disabled:opacity-60" />
        </label>
      </div>

      {selectedApplication ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="metric-card">
            <span className="text-xs text-[var(--text-secondary)]">Modo de acesso</span>
            <strong className="mt-1 block text-brand-primary">{selectedApplication.accessMode === "RESTRICTED" ? "Participantes vinculados" : "Institucional"}</strong>
          </div>
          <div className="metric-card">
            <span className="text-xs text-[var(--text-secondary)]">Participantes vinculados</span>
            <strong className="mt-1 block text-2xl text-brand-primary">{selectedApplication.participantCount}</strong>
          </div>
          <div className="metric-card">
            <span className="text-xs text-[var(--text-secondary)]">Concluídos</span>
            <strong className="mt-1 block text-2xl text-emerald-600">{selectedApplication.completedCount}</strong>
          </div>
        </div>
      ) : null}

      {eligiblePeople.length > 0 ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
          <button type="button" onClick={toggleVisible} className="flex min-h-12 w-full items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 text-left text-sm font-black text-[var(--text-primary)]">
            {allVisibleSelected ? <CheckSquare2 className="h-5 w-5 text-sky-500" aria-hidden="true" /> : <Square className="h-5 w-5 text-[var(--text-secondary)]" aria-hidden="true" />}
            {allVisibleSelected ? "Desmarcar resultados visíveis" : `Selecionar ${eligiblePeople.length} resultados visíveis`}
          </button>
          <div className="max-h-[28rem] divide-y divide-[var(--border-subtle)] overflow-y-auto overscroll-contain">
            {eligiblePeople.map((person) => {
              const checked = selected.has(person.personId);
              return (
                <button key={person.personId} type="button" aria-pressed={checked} onClick={() => togglePerson(person.personId)} className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition ${checked ? "bg-sky-500/10" : "bg-[var(--surface-card)] hover:bg-[var(--surface-muted)]"}`}>
                  {checked ? <CheckSquare2 className="h-5 w-5 shrink-0 text-sky-500" aria-hidden="true" /> : <Square className="h-5 w-5 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />}
                  <PersonAvatar fullName={person.fullName} avatarUrl={person.avatarUrl} className="h-10 w-10 shrink-0 rounded-xl" />
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-[var(--text-primary)]">{person.fullName}</strong>
                    <span className="mt-1 block truncate text-xs text-[var(--text-secondary)]">{person.employeeNumber} · {person.jobTitle || "Cargo não informado"} · {person.costCenter || "Sem coordenação"} · {person.institutionalEmail || "Sem e-mail"}</span>
                  </span>
                  {person.participantStatus ? <span className="shrink-0 rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-black text-amber-500">{person.participantStatus === "BLOCKED" ? "Reativar" : "Restaurar"}</span> : null}
                </button>
              );
            })}
          </div>
          {alreadyLinkedCount > 0 ? (
            <p className="border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-xs text-[var(--text-secondary)]">
              {alreadyLinkedCount === 1 ? "1 pessoa encontrada já está vinculada e foi omitida." : `${alreadyLinkedCount} pessoas encontradas já estão vinculadas e foram omitidas.`}
            </p>
          ) : null}
        </div>
      ) : searching ? (
        <div className="mt-5 grid place-items-center rounded-2xl border border-dashed border-[var(--border-subtle)] p-8 text-[var(--text-secondary)]">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      ) : search.trim().length >= MIN_SEARCH_LENGTH ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[var(--border-subtle)] p-6 text-center text-sm text-[var(--text-secondary)]">
          {alreadyLinkedCount > 0
            ? `${alreadyLinkedCount === 1 ? "A pessoa encontrada já está" : "As pessoas encontradas já estão"} vinculada${alreadyLinkedCount === 1 ? "" : "s"} a esta avaliação.`
            : "Nenhuma pessoa disponível para vínculo com essa busca."}
        </div>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed border-[var(--border-subtle)] p-6 text-center text-sm text-[var(--text-secondary)]">
          Digite pelo menos {MIN_SEARCH_LENGTH} caracteres para buscar na base institucional.
        </p>
      )}

      <div className="mt-6 flex flex-col gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-[var(--text-secondary)]">Para conferir, bloquear ou remover quem já está vinculado, abra a visualização completa.</p>
        <Link href={applicationId ? `/admin/participantes/todos?avaliacao=${encodeURIComponent(applicationId)}` : "/admin/participantes/todos"} className="primary-button justify-center">
          <UsersRound className="h-4 w-4" aria-hidden="true" />
          Ver todos os participantes
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
