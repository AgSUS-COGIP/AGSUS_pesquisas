"use client";

import { CheckSquare2, Loader2, Search, Square, UserRoundPlus, UsersRound } from "lucide-react";
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

// Os formatos vêm do contrato da API. Antes, esta tela e a de gestão individual
// declaravam cada uma o seu `ApplicationItem` e o seu `PersonSearchResult`, a
// partir da mesma RPC — com campos diferentes, porque cada uma copiava só o que
// ia usar, e nenhuma sabia da outra.
type ApplicationItem = AvaliacaoComParticipantes;
type PersonSearchResult = PessoaCandidataAoCiclo;

export function AdminParticipantBulkSelector() {
  const confirm = useConfirm();
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState<PersonSearchResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
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
    if (!applicationId || search.trim().length < 2) {
      setPeople([]);
      return;
    }

    const timeout = window.setTimeout(async () => {
      try {
        setPeople(await listarPessoasDisponiveis(applicationId, { busca: search.trim() }));
      } catch (searchError) {
        toast.error(errorMessageFromUnknown(searchError) || "Não foi possível pesquisar pessoas.");
      }
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [applicationId, search]);

  const eligiblePeople = useMemo(
    () => people.filter((person) => !person.participantStatus || ["BLOCKED", "EXCLUDED"].includes(person.participantStatus)),
    [people],
  );

  const selectedApplication = useMemo(
    () => applications.find((application) => application.id === applicationId) ?? null,
    [applicationId, applications],
  );

  const allVisibleSelected = eligiblePeople.length > 0 && eligiblePeople.every((person) => selected.has(person.personId));

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

  async function assignSelected() {
    if (!applicationId || selected.size === 0) return;
    setWorking(true);
    try {
      const result = await vincularParticipantes(applicationId, { pessoas: Array.from(selected) });
      toast.success(`${result.assignedCount ?? 0} vinculadas, ${result.reactivatedCount ?? 0} reativadas e ${result.skippedCount ?? 0} já existentes.`);
      resetSearch();
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
    } catch (error) {
      toast.error(errorMessageFromUnknown(error) || "Não foi possível vincular todo o público disponível.");
    } finally {
      setAssigningAll(false);
    }
  }

  return (
    <section className="surface-card p-5 sm:p-6" aria-labelledby="bulk-participants-title">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="section-eyebrow">Seleção em lote</p>
          <h2 id="bulk-participants-title" className="mt-1 text-xl font-black text-brand-primary">Vincular pessoas a uma avaliação</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--text-secondary)]">Selecione pessoas pelos filtros ou vincule todo o público ativo e elegível de uma só vez. Todas as operações registram auditoria.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <button type="button" disabled={!applicationId || assigningAll || working} onClick={() => void assignAllAvailable()} className="secondary-button min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-50">
            {assigningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundPlus className="h-4 w-4" />}
            Vincular todos os disponíveis
          </button>
          <button type="button" disabled={!selected.size || working || assigningAll} onClick={() => void assignSelected()} className="primary-button min-h-11 justify-center disabled:cursor-not-allowed disabled:opacity-50">
            {working ? <Loader2 className="h-4 w-4 animate-spin" /> : <UsersRound className="h-4 w-4" />}
            Vincular {selected.size || "selecionadas"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(240px,.75fr)_minmax(0,1.25fr)]">
        <label className="block">
          <span className="text-xs font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Avaliação ou ciclo</span>
          <select disabled={loading || working || assigningAll} value={applicationId} onChange={(event) => setApplicationId(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 font-bold text-[var(--text-primary)] outline-none focus:ring-4 focus:ring-sky-200/20">
            {applications.map((application) => <option key={application.id} value={application.id}>{application.code} — {application.name}</option>)}
          </select>
        </label>

        <label className="relative block">
          <span className="text-xs font-black uppercase tracking-[.14em] text-[var(--text-secondary)]">Filtrar base institucional</span>
          <Search className="absolute bottom-3.5 left-4 h-4 w-4 text-[var(--text-secondary)]" aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Digite pelo menos 2 caracteres: nome, matrícula, e-mail ou cargo" className="mt-2 h-12 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] pl-11 pr-4 font-semibold text-[var(--text-primary)] outline-none focus:bg-[var(--surface-card)] focus:ring-4 focus:ring-sky-200/20" />
        </label>
      </div>

      {eligiblePeople.length > 0 ? (
        <div className="mt-5 overflow-hidden rounded-2xl border border-[var(--border-subtle)]">
          <button type="button" onClick={toggleVisible} className="flex min-h-12 w-full items-center gap-3 border-b border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 text-left text-sm font-black text-[var(--text-primary)]">
            {allVisibleSelected ? <CheckSquare2 className="h-5 w-5 text-sky-500" /> : <Square className="h-5 w-5 text-[var(--text-secondary)]" />}
            {allVisibleSelected ? "Desmarcar resultados visíveis" : `Selecionar ${eligiblePeople.length} resultados visíveis`}
          </button>
          <div className="max-h-[28rem] divide-y divide-[var(--border-subtle)] overflow-y-auto overscroll-contain">
            {eligiblePeople.map((person) => {
              const checked = selected.has(person.personId);
              return (
                <button key={person.personId} type="button" aria-pressed={checked} onClick={() => togglePerson(person.personId)} className={`flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left transition ${checked ? "bg-sky-500/10" : "bg-[var(--surface-card)] hover:bg-[var(--surface-muted)]"}`}>
                  {checked ? <CheckSquare2 className="h-5 w-5 shrink-0 text-sky-500" /> : <Square className="h-5 w-5 shrink-0 text-[var(--text-secondary)]" />}
                  <span className="min-w-0 flex-1">
                    <strong className="block truncate text-sm text-[var(--text-primary)]">{person.fullName}</strong>
                    <span className="mt-1 block truncate text-xs text-[var(--text-secondary)]">{person.employeeNumber} · {person.jobTitle || "Cargo não informado"} · {person.institutionalEmail || "Sem e-mail"}</span>
                  </span>
                  {person.participantStatus ? <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[11px] font-black text-amber-500">{person.participantStatus === "BLOCKED" ? "Reativar" : "Restaurar"}</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : search.trim().length >= 2 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-[var(--border-subtle)] p-6 text-center text-sm text-[var(--text-secondary)]">Nenhuma pessoa disponível para vínculo com esse filtro.</div>
      ) : null}
    </section>
  );
}
