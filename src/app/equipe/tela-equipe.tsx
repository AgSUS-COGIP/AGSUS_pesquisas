"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownUp, CheckCircle2, ClipboardCheck, Clock3, Hourglass, Search, UserMinus, UserPlus, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { FullPageState } from "@/components/full-page-state";
import { PersonAvatar } from "@/components/person-avatar";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { useConfirm } from "@/components/confirmation-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/overlay-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, StatCard } from "@/components/ui/surface";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { errorMessageFromUnknown } from "@/lib/observability";
import { cycleStatusLabel } from "@/lib/survey-status-labels";
import {
  incluirIntegrante,
  listarCandidatosDaEquipe,
  listarCiclosDeLideranca,
  obterMinhaEquipe,
  retirarIntegrante,
} from "@/lib/api/cliente-pessoas";
import type { CandidatoDaEquipe, IntegranteDaEquipe } from "@/lib/api/contratos-pessoas";

// Formatos vindos do contrato da API, no lugar das declarações locais. A equipe
// e o ciclo não precisam de apelido: chegam tipados pelo retorno das funções do
// cliente, e as consultas do React Query os inferem.
type TeamMember = IntegranteDaEquipe;
type Candidate = CandidatoDaEquipe;
type StatusFilter = "ALL" | "NOT_STARTED" | "DRAFT" | "SUBMITTED";
type SortMode = "PRIORITY" | "NAME" | "UPDATED";

const teamCyclesKey = ["team", "cycles"] as const;

// As três consultas passaram a chamar as rotas REST. A tela deixou de conhecer
// nome de RPC e nome de parâmetro do banco: pede a equipe, os ciclos e os
// candidatos, e o formato vem do contrato.

function submissionLabel(status: string | null) {
  if (status === "SUBMITTED" || status === "VALIDATED") return "Avaliação enviada";
  if (status === "DRAFT") return "Em preenchimento";
  return "Não iniciada";
}
function actionLabel(status: string | null) {
  if (status === "SUBMITTED" || status === "VALIDATED") return "Consultar";
  if (status === "DRAFT") return "Continuar";
  return "Avaliar";
}
function normalizedStatus(status: string | null): Exclude<StatusFilter, "ALL"> {
  if (status === "SUBMITTED" || status === "VALIDATED") return "SUBMITTED";
  if (status === "DRAFT") return "DRAFT";
  return "NOT_STARTED";
}
function statusVariant(state: Exclude<StatusFilter, "ALL">) {
  if (state === "SUBMITTED") return "success" as const;
  if (state === "DRAFT") return "info" as const;
  return "warning" as const;
}
function dateTime(value: string | null) {
  if (!value) return "Sem atividade registrada";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}
// Equivalente do LIKE '%termo%' do banco: minúsculas e sem acentos nos dois
// lados, para "joao" encontrar "João" sem depender de nova consulta.
function normalizeSearchText(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function TeamPage() {
  const confirm = useConfirm();
  const guard = usePlatformGuard(PLATFORM_MODULE.TEAM);
  const granted = guard.state === "granted";
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortMode, setSortMode] = useState<SortMode>("PRIORITY");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [selectedCycleCode, setSelectedCycleCode] = useState<string | null>(null);
  const deferredCandidateSearch = useDeferredValue(candidateSearch);
  const cyclesQuery = useQuery({
    queryKey: teamCyclesKey,
    queryFn: listarCiclosDeLideranca,
    enabled: granted,
    staleTime: 60_000,
  });
  const cycles = useMemo(() => cyclesQuery.data ?? [], [cyclesQuery.data]);
  // A lista vem ordenada da mais recente para a mais antiga; sem escolha
  // explícita, a mais recente é carregada. Lista vazia (ex.: administração sem
  // equipe própria) mantém a resolução automática do banco.
  const activeCycleCode = selectedCycleCode ?? cycles[0]?.code ?? null;
  const cyclesReady = cyclesQuery.isSuccess || cyclesQuery.isError;
  const teamQuery = useQuery({
    queryKey: ["team", "workspace", activeCycleCode],
    queryFn: () => obterMinhaEquipe(activeCycleCode),
    enabled: granted && cyclesReady,
  });
  const workspace = teamQuery.data ?? null;
  const applicationId = workspace?.application.id ?? "";
  const candidateQuery = useQuery({
    queryKey: ["team", "candidates", applicationId, deferredCandidateSearch],
    queryFn: () => listarCandidatosDaEquipe(applicationId, deferredCandidateSearch),
    enabled: dialogOpen && Boolean(applicationId),
    staleTime: 30_000,
  });
  const candidates = candidateQuery.data ?? [];

  const filtered = useMemo(() => {
    const term = normalizeSearchText(search.trim());
    const priority = { NOT_STARTED: 0, DRAFT: 1, SUBMITTED: 2 } as const;
    return [...(workspace?.members ?? [])]
      .filter((member) => {
        const haystack = normalizeSearchText(`${member.fullName} ${member.employeeNumber} ${member.jobTitle ?? ""} ${member.unit ?? ""} ${member.institutionalEmail ?? ""}`);
        const matchesText = !term || haystack.includes(term);
        const state = normalizedStatus(member.submissionStatus);
        return matchesText && (statusFilter === "ALL" || state === statusFilter);
      })
      .sort((a, b) => {
        if (sortMode === "NAME") return a.fullName.localeCompare(b.fullName, "pt-BR");
        if (sortMode === "UPDATED") return new Date(b.submissionUpdatedAt ?? 0).getTime() - new Date(a.submissionUpdatedAt ?? 0).getTime();
        const byPriority = priority[normalizedStatus(a.submissionStatus)] - priority[normalizedStatus(b.submissionStatus)];
        return byPriority || a.fullName.localeCompare(b.fullName, "pt-BR");
      });
  }, [search, sortMode, statusFilter, workspace?.members]);

  async function addMember(candidate: Candidate) {
    if (!workspace?.application.id) return;
    setWorkingId(candidate.personId);
    try {
      await incluirIntegrante(workspace.application.id, candidate.personId);
      toast.success(`${candidate.fullName} foi incluído(a) na equipe.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["team", "workspace"] }),
        queryClient.invalidateQueries({ queryKey: ["team", "candidates"] }),
      ]);
    } catch (addError) { toast.error(errorMessageFromUnknown(addError) || "Não foi possível incluir a pessoa."); }
    finally { setWorkingId(null); }
  }

  async function removeMember(member: TeamMember) {
    if (!(await confirm({ title: "Retirar integrante da equipe?", description: `${member.fullName} deixará de aparecer na sua equipe neste ciclo. O histórico será preservado.`, confirmLabel: "Retirar integrante", tone: "danger" }))) return;
    setWorkingId(member.linkId);
    try {
      await retirarIntegrante(member.linkId);
      toast.success(`${member.fullName} foi retirado(a) da equipe.`);
      await queryClient.invalidateQueries({ queryKey: ["team", "workspace"] });
    } catch (removeError) { toast.error(errorMessageFromUnknown(removeError) || "Não foi possível retirar a pessoa."); }
    finally { setWorkingId(null); }
  }

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="equipe"
      restrictedTitle="Acesso restrito à liderança"
      restrictedDescription="O módulo Minha equipe está disponível para avaliadores e para a administração das avaliações."
    />;
  }
  if (teamQuery.isError) return <FullPageState title="Não foi possível carregar sua equipe" description={teamQuery.error instanceof Error ? teamQuery.error.message : "Tente novamente em alguns instantes."} />;
  const user = guard.user;
  const sent = workspace?.members.filter((member) => normalizedStatus(member.submissionStatus) === "SUBMITTED").length ?? 0;
  const drafts = workspace?.members.filter((member) => normalizedStatus(member.submissionStatus) === "DRAFT").length ?? 0;
  const notStarted = workspace?.members.filter((member) => normalizedStatus(member.submissionStatus) === "NOT_STARTED").length ?? 0;
  const pendingTotal = notStarted + drafts;
  const memberEvaluationHref = (member: TeamMember) => workspace?.application ? `/cddi/chefia/${member.personId}?ciclo=${encodeURIComponent(workspace.application.code)}` : `/cddi/chefia/${member.personId}`;
  const loadingTeam = teamQuery.isLoading || !cyclesReady;
  const filtering = search.trim().length > 0 || statusFilter !== "ALL";
  const cycleStatus = workspace?.application.status;

  return <PlatformShell
    user={user}
    eyebrow="Gestão da liderança"
    title="Minha equipe"
  >
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <PageHeader
        eyebrow={workspace?.application ? workspace.application.name : "Ciclo de avaliação"}
        title="Avaliações da minha equipe"
        description="As pendências aparecem primeiro. Inicie avaliações, continue rascunhos e consulte os envios concluídos."
        actions={<>
          {workspace?.application && (
            <Badge variant={cycleStatus === "OPEN" ? "success" : cycleStatus === "CLOSED" ? "neutral" : "info"} title={`Código interno: ${cycleStatus}`}>
              {workspace.application.code} · {cycleStatusLabel(cycleStatus)}
            </Badge>
          )}
          {cycles.length >= 2 && (
            <label className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)]">
              <span>Ciclo</span>
              <select
                value={activeCycleCode ?? ""}
                onChange={(event) => setSelectedCycleCode(event.target.value)}
                className="min-h-10 min-w-52 rounded-lg border border-[var(--border-subtle)] bg-[var(--control-bg)] px-3 text-sm font-medium text-[var(--text-primary)] shadow-sm outline-none transition hover:border-[var(--border-strong)] focus:border-[var(--focus-ring)] focus:ring-4 focus:ring-sky-300/15"
              >
                {cycles.map((cycle) => <option key={cycle.id} value={cycle.code}>{cycle.name}</option>)}
              </select>
            </label>
          )}
        </>}
      />

      <section aria-label="Resumo da equipe" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Integrantes" value={loadingTeam ? "—" : workspace?.total ?? 0} description="pessoas na sua equipe neste ciclo" />
        <StatCard label="Não iniciadas" value={loadingTeam ? "—" : notStarted} description="ainda sem nenhuma resposta" />
        <StatCard label="Em preenchimento" value={loadingTeam ? "—" : drafts} description="começadas, faltam enviar" />
        <StatCard label="Enviadas" value={loadingTeam ? "—" : sent} description="concluídas e registradas" />
      </section>

      {!loadingTeam && pendingTotal > 0 && (
        <p role="status" className="flex items-start gap-3 rounded-2xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-4 text-sm leading-6 text-[var(--status-warning-text)]">
          <Clock3 className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <span>
            <strong className="font-semibold">{pendingTotal} {pendingTotal === 1 ? "avaliação exige" : "avaliações exigem"} sua atenção.</strong>{" "}
            {notStarted} {notStarted === 1 ? "não iniciada" : "não iniciadas"} e {drafts} em preenchimento.
          </span>
        </p>
      )}

      <section aria-label="Integrantes vinculados" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)] sm:p-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <h3 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">Integrantes vinculados</h3>
            <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
              {loadingTeam
                ? "Carregando a equipe..."
                : filtering
                  ? `${filtered.length} de ${workspace?.total ?? 0} ${(workspace?.total ?? 0) === 1 ? "integrante corresponde" : "integrantes correspondem"} aos filtros.`
                  : "Ordenados por prioridade: não iniciadas primeiro."}
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-[minmax(220px,1fr)_auto_auto]">
            <form role="search" onSubmit={(event) => event.preventDefault()} className="contents">
              <div className="relative">
                <label htmlFor="busca-integrante" className="sr-only">Buscar integrante por nome, matrícula ou unidade</label>
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
                <input
                  id="busca-integrante"
                  type="search"
                  enterKeyHint="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar nome, matrícula ou unidade"
                  className="min-h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--control-bg)] py-2 pl-10 pr-3 text-sm font-medium text-[var(--text-primary)] shadow-sm outline-none transition placeholder:text-[var(--text-muted)] hover:border-[var(--border-strong)] focus:border-[var(--focus-ring)] focus:ring-4 focus:ring-sky-300/15"
                />
              </div>
            </form>
            <div>
              <label htmlFor="filtro-situacao" className="sr-only">Filtrar por situação</label>
              <select
                id="filtro-situacao"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="min-h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--control-bg)] px-3 text-sm font-medium text-[var(--text-primary)] shadow-sm outline-none transition hover:border-[var(--border-strong)] focus:border-[var(--focus-ring)] focus:ring-4 focus:ring-sky-300/15"
              >
                <option value="ALL">Todas as situações</option>
                <option value="NOT_STARTED">Não iniciadas</option>
                <option value="DRAFT">Em preenchimento</option>
                <option value="SUBMITTED">Enviadas</option>
              </select>
            </div>
            <div className="relative">
              <label htmlFor="ordenacao-equipe" className="sr-only">Ordenar a lista</label>
              <ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
              <select
                id="ordenacao-equipe"
                value={sortMode}
                onChange={(event) => setSortMode(event.target.value as SortMode)}
                className="min-h-10 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--control-bg)] py-2 pl-9 pr-3 text-sm font-medium text-[var(--text-primary)] shadow-sm outline-none transition hover:border-[var(--border-strong)] focus:border-[var(--focus-ring)] focus:ring-4 focus:ring-sky-300/15"
              >
                <option value="PRIORITY">Prioridade</option>
                <option value="NAME">Nome A-Z</option>
                <option value="UPDATED">Última atividade</option>
              </select>
            </div>
          </div>
        </div>

        <div className="mt-5">
          {loadingTeam ? (
            <div className="grid gap-3" aria-busy="true">
              <span className="sr-only">Carregando os integrantes da equipe.</span>
              {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-xl" />)}
            </div>
          ) : filtered.length ? (
            <ul className="grid gap-3">
              {filtered.map((member) => {
                const state = normalizedStatus(member.submissionStatus);
                return (
                  <li key={member.linkId}>
                    <article className="grid gap-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 transition hover:border-[var(--border-strong)] lg:grid-cols-[auto_1fr_auto_auto] lg:items-center">
                      <PersonAvatar fullName={member.fullName} avatarUrl={member.avatarUrl} className="h-12 w-12 rounded-xl" fallbackClassName="text-sm" />
                      <div className="min-w-0">
                        <strong className="block truncate text-sm font-semibold text-[var(--text-primary)]">{member.fullName}</strong>
                        <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">Matrícula {member.employeeNumber} · {member.jobTitle ?? "Cargo não informado"}</p>
                        <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{member.unit ?? "Unidade não informada"}</p>
                      </div>
                      <div className="min-w-[160px]">
                        <Badge variant={statusVariant(state)}>{submissionLabel(member.submissionStatus)}</Badge>
                        <p className="mt-2 text-xs text-[var(--text-secondary)]">{dateTime(member.submissionUpdatedAt)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          href={memberEvaluationHref(member)}
                          title={`${actionLabel(member.submissionStatus)} a avaliação de ${member.fullName}`}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--brand-solid)] px-4 text-sm font-semibold text-[var(--text-on-brand)] shadow-sm transition hover:bg-[var(--brand-solid-hover)]"
                        >
                          <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
                          {actionLabel(member.submissionStatus)}
                        </Link>
                        <Button
                          variant="secondary"
                          disabled={workingId === member.linkId}
                          onClick={() => removeMember(member)}
                          title={`Retirar ${member.fullName} da equipe neste ciclo — o histórico é preservado`}
                          className="text-red-700 hover:bg-[var(--status-danger-bg)]"
                        >
                          {workingId === member.linkId ? <Hourglass className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <UserMinus className="h-4 w-4" aria-hidden="true" />}
                          Retirar
                        </Button>
                      </div>
                    </article>
                  </li>
                );
              })}
            </ul>
          ) : filtering ? (
            <EmptyState
              icon={<Search className="h-6 w-6" aria-hidden="true" />}
              title="Nenhum integrante corresponde aos filtros"
              description="Ajuste o termo buscado ou volte a exibir todas as situações."
              action={<Button variant="secondary" onClick={() => { setSearch(""); setStatusFilter("ALL"); }}><X className="h-4 w-4" aria-hidden="true" />Limpar filtros</Button>}
            />
          ) : (
            <EmptyState
              icon={<UsersRound className="h-6 w-6" aria-hidden="true" />}
              title="Nenhuma pessoa na sua equipe"
              description="Use “Incluir pessoa” para vincular quem você avalia neste ciclo. Só aparecem pessoas sem liderança ativa."
              action={<Button onClick={() => setDialogOpen(true)} disabled={!applicationId}><UserPlus className="h-4 w-4" aria-hidden="true" />Incluir pessoa</Button>}
            />
          )}
        </div>
      </section>
    </div>

    <Dialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      title="Incluir pessoa na equipe"
      description="Só aparecem participantes que ainda não têm liderança ativa neste ciclo."
      className="max-w-3xl"
      contentClassName="overflow-hidden"
    >
      <div className="relative">
        <label htmlFor="busca-candidato" className="sr-only">Buscar participante por nome, matrícula ou e-mail</label>
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)]" aria-hidden="true" />
        <input
          id="busca-candidato"
          autoFocus
          type="search"
          value={candidateSearch}
          onChange={(event) => setCandidateSearch(event.target.value)}
          placeholder="Digite nome, matrícula ou e-mail"
          className="min-h-12 w-full rounded-xl border border-[var(--border-subtle)] bg-[var(--control-bg)] py-3 pl-12 pr-4 text-sm font-medium text-[var(--text-primary)] shadow-sm outline-none transition placeholder:text-[var(--text-muted)] hover:border-[var(--border-strong)] focus:border-[var(--focus-ring)] focus:ring-4 focus:ring-sky-300/15"
        />
      </div>
      <div className="mt-5 max-h-[55vh] space-y-3 overflow-y-auto pr-1" aria-live="polite" aria-busy={candidateQuery.isFetching}>
        {candidateQuery.isFetching ? (
          <div className="space-y-3">
            <span className="sr-only">Pesquisando participantes.</span>
            {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)}
          </div>
        ) : candidateQuery.isError ? (
          <p role="alert" className="rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-6 text-center text-sm leading-6 text-[var(--status-danger-text)]">
            Não foi possível pesquisar pessoas. Feche a janela e tente novamente.
          </p>
        ) : candidates.length ? candidates.map((candidate) => (
          <article key={candidate.personId} className="flex flex-col gap-3 rounded-xl border border-[var(--border-subtle)] p-4 sm:flex-row sm:items-center">
            <PersonAvatar fullName={candidate.fullName} avatarUrl={candidate.avatarUrl} className="h-11 w-11 rounded-xl" fallbackClassName="text-sm" />
            <div className="min-w-0 flex-1">
              <strong className="block truncate text-sm font-semibold text-[var(--text-primary)]">{candidate.fullName}</strong>
              <p className="mt-1 truncate text-sm text-[var(--text-secondary)]">{candidate.employeeNumber} · {candidate.jobTitle ?? "Cargo não informado"}</p>
              <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{candidate.unit ?? candidate.institutionalEmail ?? "Sem unidade informada"}</p>
            </div>
            <Button disabled={workingId === candidate.personId} onClick={() => addMember(candidate)} title={`Incluir ${candidate.fullName} na sua equipe`}>
              {workingId === candidate.personId ? <Hourglass className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
              Incluir
            </Button>
          </article>
        )) : (
          <EmptyState
            icon={<UsersRound className="h-6 w-6" aria-hidden="true" />}
            title="Nenhuma pessoa elegível"
            description={candidateSearch.trim()
              ? `Nada corresponde a "${candidateSearch.trim()}" entre as pessoas sem liderança ativa.`
              : "Todas as pessoas deste ciclo já têm liderança definida."}
          />
        )}
      </div>
    </Dialog>
  </PlatformShell>;
}
