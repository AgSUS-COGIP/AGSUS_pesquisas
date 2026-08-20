"use client";

import Link from "next/link";
import { ArrowRight, CheckSquare2, ChevronDown, Loader2, Search, Square, UsersRound, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useConfirm } from "@/components/confirmation-provider";
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
  const [selectedPeople, setSelectedPeople] = useState<Map<string, PersonSearchResult>>(() => new Map());
  const [allAvailableSelected, setAllAvailableSelected] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [working, setWorking] = useState(false);

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
    setSelectedPeople(new Map());
    setAllAvailableSelected(false);
    setSearch("");
    setPeople([]);
  }, [applicationId]);

  useEffect(() => {
    if (!applicationId || search.trim().length < MIN_SEARCH_LENGTH) {
      setPeople([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    let canceled = false;
    const timeout = window.setTimeout(async () => {
      try {
        const results = await listarPessoasDisponiveis(applicationId, { busca: search.trim() });
        if (!canceled) setPeople(results);
      } catch (searchError) {
        if (!canceled) toast.error(errorMessageFromUnknown(searchError) || "Não foi possível pesquisar pessoas.");
      } finally {
        if (!canceled) setSearching(false);
      }
    }, 300);

    return () => {
      canceled = true;
      window.clearTimeout(timeout);
    };
  }, [applicationId, search]);

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === applicationId) ?? null,
    [applicationId, applications],
  );

  const eligiblePeople = useMemo(() => people.filter((person) => !isLinked(person)), [people]);
  const selectedCount = selectedPeople.size;
  const hasSelection = allAvailableSelected || selectedCount > 0;
  const busy = working;

  function togglePerson(personId: string) {
    if (allAvailableSelected) return;
    const person = eligiblePeople.find((candidate) => candidate.personId === personId);
    if (!person) return;
    setSelectedPeople((current) => {
      const next = new Map(current);
      if (next.has(personId)) next.delete(personId);
      else next.set(personId, person);
      return next;
    });
  }

  function clearSelection() {
    setSelectedPeople(new Map());
    setAllAvailableSelected(false);
  }

  function removeSelectedPerson(personId: string) {
    setSelectedPeople((current) => {
      const next = new Map(current);
      next.delete(personId);
      return next;
    });
  }

  function resetSelector() {
    clearSelection();
    setSearch("");
    setPeople([]);
    setSelectorOpen(false);
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
    if (!applicationId || !hasSelection) return;
    setWorking(true);
    try {
      if (allAvailableSelected && selectedApplication) {
        const confirmed = await confirm({
          title: "Vincular todas as pessoas elegíveis?",
          description: `Todas as pessoas ativas e elegíveis serão vinculadas a “${selectedApplication.code} — ${selectedApplication.name}”. Lideranças marcadas como não avaliáveis serão excluídas automaticamente.`,
          confirmLabel: "Vincular todas",
        });
        if (!confirmed) return;
      }
      const result = await vincularParticipantes(applicationId, allAvailableSelected ? { todosDisponiveis: true } : { pessoas: Array.from(selectedPeople.keys()) });
      toast.success(`${result.assignedCount ?? 0} vinculadas, ${result.reactivatedCount ?? 0} reativadas e ${result.skippedCount ?? 0} já existentes.`);
      resetSelector();
      await refreshApplications();
    } catch (error) {
      toast.error(errorMessageFromUnknown(error) || "Não foi possível vincular as pessoas selecionadas.");
    } finally {
      setWorking(false);
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
          <button type="button" disabled={!hasSelection || busy} onClick={() => void assignSelected()} className="primary-button min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-50">
            {working ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <UsersRound className="h-4 w-4" aria-hidden="true" />}
            {allAvailableSelected ? "Vincular todos os disponíveis" : `Vincular ${selectedCount || "selecionadas"}`}
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

        <div className="relative">
          <span id="participant-selector-label" className="text-xs font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Participantes</span>
          <button type="button" aria-labelledby="participant-selector-label" aria-expanded={selectorOpen} aria-haspopup="listbox" disabled={!applicationId || busy} onClick={() => setSelectorOpen((open) => !open)} className="mt-2 flex h-12 w-full items-center justify-between rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 text-left font-semibold text-[var(--text-primary)] outline-none focus:bg-[var(--surface-card)] focus:ring-4 focus:ring-sky-200/20 disabled:opacity-60">
            <span className="truncate">{allAvailableSelected ? "Todos os participantes disponíveis" : selectedCount === 0 ? "Selecione participantes" : `${selectedCount} participante${selectedCount === 1 ? "" : "s"} selecionado${selectedCount === 1 ? "" : "s"}`}</span>
            <ChevronDown className={`h-4 w-4 shrink-0 transition ${selectorOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {selectorOpen ? (
            <div className="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-xl">
              <div className="border-b border-[var(--border-subtle)] p-3">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
                  <input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} disabled={allAvailableSelected} placeholder="Buscar novas pessoas" className="h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-muted)] pl-9 pr-3 text-sm font-medium text-[var(--text-primary)] outline-none focus:ring-4 focus:ring-sky-200/20 disabled:opacity-60" />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setAllAvailableSelected(true); setSelectedPeople(new Map()); }} disabled={allAvailableSelected} className="secondary-button min-h-9 text-xs disabled:cursor-not-allowed disabled:opacity-50">Selecionar todos os disponíveis</button>
                </div>
              </div>

              <div role="listbox" aria-label="Resultados da busca" aria-multiselectable="true" className="max-h-72 divide-y divide-[var(--border-subtle)] overflow-y-auto overscroll-contain">
                {allAvailableSelected ? <p className="p-4 text-sm text-[var(--text-secondary)]">Todos os participantes disponíveis estão selecionados.</p> : searching ? <div className="grid place-items-center p-6 text-[var(--text-secondary)]"><Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /></div> : eligiblePeople.length > 0 ? eligiblePeople.map((person) => {
                  const checked = selectedPeople.has(person.personId);
                  return <button key={person.personId} type="button" role="option" aria-selected={checked} onClick={() => togglePerson(person.personId)} className={`flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left transition ${checked ? "bg-sky-500/10" : "hover:bg-[var(--surface-muted)]"}`}>
                    {checked ? <CheckSquare2 className="h-5 w-5 shrink-0 text-sky-500" aria-hidden="true" /> : <Square className="h-5 w-5 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />}
                    <span className="min-w-0"><strong className="block truncate text-sm text-[var(--text-primary)]">{person.fullName}</strong><span className="block truncate text-xs text-[var(--text-secondary)]">{person.employeeNumber} · {person.jobTitle || "Cargo não informado"}</span></span>
                  </button>;
                }) : <p className="p-4 text-sm text-[var(--text-secondary)]">{search.trim().length >= MIN_SEARCH_LENGTH ? "Nenhuma pessoa disponível para essa busca." : `Digite pelo menos ${MIN_SEARCH_LENGTH} caracteres para buscar novas pessoas.`}</p>}
              </div>
            </div>
          ) : null}
        </div>
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

      {hasSelection ? (
        <div className="mt-5 rounded-2xl border border-sky-500/25 bg-sky-500/5 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-[var(--text-primary)]">Participantes selecionados</p>
              <p className="mt-1 text-sm text-[var(--text-secondary)]">{allAvailableSelected ? "Todos os participantes disponíveis serão vinculados." : `${selectedCount} participante${selectedCount === 1 ? "" : "s"} será${selectedCount === 1 ? "" : "ão"} vinculado${selectedCount === 1 ? "" : "s"}.`}</p>
            </div>
            <button type="button" onClick={clearSelection} disabled={busy} className="secondary-button min-h-10 justify-center text-sm disabled:cursor-not-allowed disabled:opacity-50"><X className="h-4 w-4" aria-hidden="true" />Remover todos os participantes selecionados</button>
          </div>
          {selectedCount > 0 ? (
            <div className="mt-3 flex max-h-32 flex-wrap gap-2 overflow-y-auto border-t border-sky-500/20 pt-3">
              {Array.from(selectedPeople.values()).map((person) => <button key={person.personId} type="button" onClick={() => removeSelectedPerson(person.personId)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/15 px-3 py-1.5 text-sm font-bold text-[var(--text-primary)] transition hover:bg-sky-500/25 disabled:cursor-not-allowed disabled:opacity-50"><span className="max-w-52 truncate">{person.fullName}</span><X className="h-3.5 w-3.5" aria-hidden="true" /></button>)}
            </div>
          ) : null}
        </div>
      ) : null}

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
