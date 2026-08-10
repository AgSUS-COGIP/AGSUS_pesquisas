"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDownUp, CheckCircle2, ClipboardCheck, Clock3, Loader2, Plus, Search, UserMinus, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { FullPageState } from "@/components/full-page-state";
import { PersonAvatar } from "@/components/person-avatar";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { useConfirm } from "@/components/confirmation-provider";
import { Dialog } from "@/components/ui/overlay-panel";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type TeamMember = { linkId: string; personId: string; fullName: string; employeeNumber: string; institutionalEmail: string | null; jobTitle: string | null; unit: string | null; avatarUrl: string | null; status: string; validFrom: string; submissionStatus: string | null; submissionUpdatedAt: string | null };
type Candidate = { personId: string; fullName: string; employeeNumber: string; institutionalEmail: string | null; jobTitle: string | null; unit: string | null; avatarUrl: string | null };
type TeamWorkspace = { status: string; application: { id: string; code: string; name: string; status: string; opensAt: string | null; closesAt: string | null }; members: TeamMember[]; total: number };
type TeamCycle = { id: string; code: string; name: string; status: string; opensAt: string | null; closesAt: string | null };
type StatusFilter = "ALL" | "NOT_STARTED" | "DRAFT" | "SUBMITTED";
type SortMode = "PRIORITY" | "NAME" | "UPDATED";

const teamCyclesKey = ["team", "cycles"] as const;

async function fetchTeamCycles() {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fc_listar_ciclos_lideranca");
  if (error) throw error;
  return Array.isArray(data) ? data as TeamCycle[] : [];
}

async function fetchTeamWorkspace(applicationCode: string | null) {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fc_obter_minha_equipe", { target_application_code: applicationCode });
  if (error) throw error;
  return data as TeamWorkspace;
}

async function fetchTeamCandidates(applicationId: string, searchTerm: string) {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("fc_pesquisar_equipe", {
    target_application_id: applicationId,
    search_term: searchTerm,
  });
  if (error) throw error;
  return Array.isArray(data) ? data as Candidate[] : [];
}

function submissionLabel(status: string | null) {
  if (status === "SUBMITTED" || status === "VALIDATED") return "Avaliação enviada";
  if (status === "DRAFT") return "Em preenchimento";
  return "Não iniciada";
}
function actionLabel(status: string | null) {
  if (status === "SUBMITTED" || status === "VALIDATED") return "Consultar avaliação";
  if (status === "DRAFT") return "Continuar avaliação";
  return "Avaliar pessoa";
}
function normalizedStatus(status: string | null): Exclude<StatusFilter, "ALL"> {
  if (status === "SUBMITTED" || status === "VALIDATED") return "SUBMITTED";
  if (status === "DRAFT") return "DRAFT";
  return "NOT_STARTED";
}
function dateTime(value: string | null) {
  if (!value) return "Sem atividade";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
// Equivalente do LIKE '%termo%' do banco: minúsculas e sem acentos nos dois
// lados, para "joao" encontrar "João" sem depender de nova consulta.
function normalizeSearchText(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export default function TeamPage() {
  const confirm = useConfirm();
  const { context, loading, error } = usePlatformContext();
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
    queryFn: fetchTeamCycles,
    enabled: Boolean(context?.person),
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
    queryFn: () => fetchTeamWorkspace(activeCycleCode),
    enabled: Boolean(context?.person) && cyclesReady,
  });
  const workspace = teamQuery.data ?? null;
  const applicationId = workspace?.application.id ?? "";
  const candidateQuery = useQuery({
    queryKey: ["team", "candidates", applicationId, deferredCandidateSearch],
    queryFn: () => fetchTeamCandidates(applicationId, deferredCandidateSearch),
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
      const supabase = createBrowserSupabaseClient();
      const { error: addError } = await supabase.rpc("add_person_to_my_team", { target_application_id: workspace.application.id, target_person_id: candidate.personId });
      if (addError) throw addError;
      toast.success(`${candidate.fullName} foi incluído(a) na equipe.`);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["team", "workspace"] }),
        queryClient.invalidateQueries({ queryKey: ["team", "candidates"] }),
      ]);
    } catch (addError) { toast.error(addError instanceof Error ? addError.message : "Não foi possível incluir a pessoa."); }
    finally { setWorkingId(null); }
  }

  async function removeMember(member: TeamMember) {
    if (!(await confirm({ title: "Retirar integrante da equipe?", description: `${member.fullName} deixará de aparecer na sua equipe neste ciclo. O histórico será preservado.`, confirmLabel: "Retirar integrante", tone: "danger" }))) return;
    setWorkingId(member.linkId);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: removeError } = await supabase.rpc("remove_person_from_my_team", { target_link_id: member.linkId });
      if (removeError) throw removeError;
      toast.success(`${member.fullName} foi retirado(a) da equipe.`);
      await queryClient.invalidateQueries({ queryKey: ["team", "workspace"] });
    } catch (removeError) { toast.error(removeError instanceof Error ? removeError.message : "Não foi possível retirar a pessoa."); }
    finally { setWorkingId(null); }
  }

  if (loading) return <PlatformSkeleton title="Carregando equipe" />;
  if (!context?.person) return <FullPageState title="Acesso não identificado" description={error || "Não foi possível associar sua sessão a um cadastro ativo."} />;
  const modules = deriveModules(context);
  if (!modules.includes(PLATFORM_MODULE.TEAM)) return <FullPageState tone="restricted" title="Acesso restrito à liderança" description="O módulo Minha equipe está disponível para avaliadores e para a administração das avaliações." />;
  if (teamQuery.isError) return <FullPageState title="Não foi possível carregar sua equipe" description={teamQuery.error instanceof Error ? teamQuery.error.message : "Tente novamente em alguns instantes."} />;
  const person = context.person;
  const user = { fullName: person.fullName, institutionalEmail: person.institutionalEmail, employeeNumber: person.employeeNumber, profileLabel: profileLabel(context), avatarUrl: person.avatarUrl, roles: context.roles, modules };
  const sent = workspace?.members.filter((member) => normalizedStatus(member.submissionStatus) === "SUBMITTED").length ?? 0;
  const drafts = workspace?.members.filter((member) => normalizedStatus(member.submissionStatus) === "DRAFT").length ?? 0;
  const notStarted = workspace?.members.filter((member) => normalizedStatus(member.submissionStatus) === "NOT_STARTED").length ?? 0;
  const memberEvaluationHref = (member: TeamMember) => workspace?.application ? `/cddi/chefia/${member.personId}?ciclo=${encodeURIComponent(workspace.application.code)}` : `/cddi/chefia/${member.personId}`;

  return <PlatformShell user={user} eyebrow="Gestão da liderança" title="Minha equipe">
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">{workspace?.application ? workspace.application.name : "Ciclo de avaliação"}</p><h2 className="mt-1 text-3xl font-black text-[#003b70]">Avaliações da minha equipe</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Pendências aparecem primeiro. Inicie avaliações, continue rascunhos e consulte envios concluídos.</p></div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {cycles.length >= 2 && (
            <label className="block">
              <span className="mb-1 block text-xs font-black uppercase tracking-[.08em] text-slate-400">Avaliação</span>
              <select value={activeCycleCode ?? ""} onChange={(event) => setSelectedCycleCode(event.target.value)} className="w-full min-w-56 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 sm:w-auto">
                {cycles.map((cycle) => <option key={cycle.id} value={cycle.code}>{cycle.name}</option>)}
              </select>
            </label>
          )}
          <button type="button" onClick={() => setDialogOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#086ab6] px-5 py-3 font-black text-white"><Plus className="h-5 w-5" /> Inserir pessoa</button>
        </div>
      </div>
      {workspace?.application && <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">{workspace.application.name}</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">{workspace.application.code}</span><span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800">{workspace.application.status}</span></div>}
    </section>

    <section className="mt-5 grid gap-3 sm:grid-cols-4">
      {[["Integrantes", workspace?.total ?? 0], ["Não iniciadas", notStarted], ["Rascunhos", drafts], ["Enviadas", sent]].map(([label, value]) => <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[.12em] text-slate-400">{label}</p><strong className="mt-2 block text-3xl font-black text-[#003b70]">{value}</strong></article>)}
    </section>

    {(notStarted > 0 || drafts > 0) && <section className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4"><Clock3 className="mt-0.5 h-5 w-5 text-amber-700"/><div><strong className="text-amber-950">{notStarted + drafts} avaliação(ões) exigem atenção</strong><p className="mt-1 text-sm text-amber-800">{notStarted} não iniciada(s) e {drafts} rascunho(s) em andamento.</p></div></section>}

    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div><h3 className="text-xl font-black text-[#003b70]">Integrantes vinculados</h3><p className="mt-1 text-sm text-slate-500">Lista ordenada por prioridade operacional.</p></div>
        <div className="grid gap-2 sm:grid-cols-[minmax(240px,1fr)_auto_auto]">
          <form role="search" onSubmit={(event) => event.preventDefault()} className="contents">
            <label className="relative block"><span className="sr-only">Buscar integrante</span><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input type="search" enterKeyHint="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome, matrícula ou unidade" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 text-sm font-semibold outline-none focus:border-blue-400 focus:bg-white"/></label>
          </form>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)} className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700"><option value="ALL">Todas as situações</option><option value="NOT_STARTED">Não iniciadas</option><option value="DRAFT">Rascunhos</option><option value="SUBMITTED">Enviadas</option></select>
          <label className="relative"><ArrowDownUp className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><select value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)} className="rounded-xl border border-slate-200 bg-white py-3 pl-9 pr-3 text-sm font-bold text-slate-700"><option value="PRIORITY">Prioridade</option><option value="NAME">Nome A-Z</option><option value="UPDATED">Última atividade</option></select></label>
        </div>
      </div>

      <div className="mt-5 grid gap-3">
        {teamQuery.isLoading || !cyclesReady ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-28 animate-pulse rounded-xl bg-slate-100" />) : filtered.length ? filtered.map((member) => {
          const state = normalizedStatus(member.submissionStatus);
          return <article key={member.linkId} className={`grid gap-4 rounded-xl border p-4 transition lg:grid-cols-[auto_1fr_auto_auto] lg:items-center ${state === "NOT_STARTED" ? "border-amber-200 bg-amber-50/40" : state === "DRAFT" ? "border-blue-200 bg-blue-50/30" : "border-slate-200 hover:border-emerald-200"}`}>
            <PersonAvatar fullName={member.fullName} avatarUrl={member.avatarUrl} className="h-12 w-12 rounded-xl shadow-sm" fallbackClassName="text-sm" />
            <div className="min-w-0"><strong className="block truncate text-[#003b70]">{member.fullName}</strong><p className="mt-1 truncate text-sm text-slate-500">Matrícula {member.employeeNumber} · {member.jobTitle ?? "Cargo não informado"}</p><p className="mt-1 truncate text-xs text-slate-400">{member.unit ?? "Unidade não informada"}</p></div>
            <div className="min-w-[150px]"><span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${state === "SUBMITTED" ? "bg-emerald-100 text-emerald-800" : state === "DRAFT" ? "bg-blue-100 text-blue-800" : "bg-amber-100 text-amber-800"}`}>{submissionLabel(member.submissionStatus)}</span><p className="mt-2 text-xs text-slate-500">{dateTime(member.submissionUpdatedAt)}</p></div>
            <div className="flex flex-wrap gap-2"><Link href={memberEvaluationHref(member)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#086ab6] px-4 py-2.5 text-sm font-black text-white"><ClipboardCheck className="h-4 w-4"/>{actionLabel(member.submissionStatus)}</Link><button type="button" disabled={workingId === member.linkId} onClick={() => removeMember(member)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2.5 text-sm font-black text-red-700 disabled:opacity-50">{workingId === member.linkId ? <Loader2 className="h-4 w-4 animate-spin"/> : <UserMinus className="h-4 w-4"/>}Retirar</button></div>
          </article>;
        }) : <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center"><UsersRound className="mx-auto h-9 w-9 text-slate-300"/><strong className="mt-4 block text-[#003b70]">Nenhuma pessoa encontrada</strong><p className="mt-2 text-sm text-slate-500">Ajuste os filtros ou use “Inserir pessoa”.</p></div>}
      </div>
    </section>

    <Dialog
      open={dialogOpen}
      onOpenChange={setDialogOpen}
      title="Inserir pessoa na equipe"
      description="Pesquise participantes que ainda não possuem liderança ativa."
      className="max-w-3xl"
      contentClassName="overflow-hidden"
    >
      <label className="relative block">
        <span className="sr-only">Buscar participante</span>
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input autoFocus value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Digite nome, matrícula ou e-mail" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 font-semibold outline-none focus:border-blue-400 focus:bg-white" />
      </label>
      <div className="mt-5 max-h-[55vh] space-y-3 overflow-y-auto pr-1" aria-live="polite">
        {candidateQuery.isFetching ? <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="mr-3 h-5 w-5 animate-spin" />Pesquisando participantes...</div> : candidateQuery.isError ? <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center text-sm text-red-700">Não foi possível pesquisar pessoas. Feche a janela e tente novamente.</div> : candidates.length ? candidates.map((candidate) => <article key={candidate.personId} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center"><PersonAvatar fullName={candidate.fullName} avatarUrl={candidate.avatarUrl} className="h-11 w-11 rounded-xl" fallbackClassName="text-sm" /><div className="min-w-0 flex-1"><strong className="block truncate text-[#003b70]">{candidate.fullName}</strong><p className="mt-1 truncate text-sm text-slate-500">{candidate.employeeNumber} · {candidate.jobTitle ?? "Cargo não informado"}</p><p className="mt-1 truncate text-xs text-slate-400">{candidate.unit ?? candidate.institutionalEmail ?? "Sem unidade informada"}</p></div><button type="button" disabled={workingId === candidate.personId} onClick={() => addMember(candidate)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#003b70] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{workingId === candidate.personId ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Adicionar</button></article>) : <div className="rounded-xl bg-slate-50 p-10 text-center text-sm text-slate-500">Nenhuma pessoa elegível encontrada.</div>}
      </div>
    </Dialog>
  </PlatformShell>;
}
