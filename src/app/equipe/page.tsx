"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, Plus, Search, UserMinus, UsersRound, X } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type TeamMember = { linkId: string; personId: string; fullName: string; employeeNumber: string; institutionalEmail: string | null; jobTitle: string | null; unit: string | null; workplace: string | null; status: string; validFrom: string; submissionStatus: string | null; submissionUpdatedAt: string | null };
type Candidate = { personId: string; fullName: string; employeeNumber: string; institutionalEmail: string | null; jobTitle: string | null; unit: string | null; workplace: string | null };
type TeamWorkspace = { status: string; application: { id: string; code: string; name: string; status: string; opensAt: string | null; closesAt: string | null }; members: TeamMember[]; total: number };

function initials(name: string) { const parts = name.trim().split(/\s+/).filter(Boolean); return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase(); }
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

export default function TeamPage() {
  const { context, loading, error } = usePlatformContext();
  const [workspace, setWorkspace] = useState<TeamWorkspace | null>(null);
  const [teamLoading, setTeamLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candidateLoading, setCandidateLoading] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);

  async function loadTeam() {
    setTeamLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: teamError } = await supabase.rpc("get_my_team_workspace", { target_application_code: null });
      if (teamError) throw teamError;
      setWorkspace(data as TeamWorkspace);
    } catch (loadError) { toast.error(loadError instanceof Error ? loadError.message : "Não foi possível carregar a equipe."); }
    finally { setTeamLoading(false); }
  }

  useEffect(() => { if (context?.person) void loadTeam(); }, [context?.person]);
  useEffect(() => {
    if (!dialogOpen || !workspace?.application.id) return;
    const timer = window.setTimeout(async () => {
      setCandidateLoading(true);
      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error: searchError } = await supabase.rpc("search_team_candidates", { target_application_id: workspace.application.id, search_term: candidateSearch });
        if (searchError) throw searchError;
        setCandidates(Array.isArray(data) ? data as Candidate[] : []);
      } catch (searchError) { toast.error(searchError instanceof Error ? searchError.message : "Não foi possível pesquisar pessoas."); }
      finally { setCandidateLoading(false); }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [dialogOpen, candidateSearch, workspace?.application.id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return workspace?.members ?? [];
    return (workspace?.members ?? []).filter((member) => `${member.fullName} ${member.employeeNumber} ${member.jobTitle ?? ""} ${member.unit ?? ""}`.toLowerCase().includes(term));
  }, [search, workspace?.members]);

  async function addMember(candidate: Candidate) {
    if (!workspace?.application.id) return;
    setWorkingId(candidate.personId);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: addError } = await supabase.rpc("add_person_to_my_team", { target_application_id: workspace.application.id, target_person_id: candidate.personId });
      if (addError) throw addError;
      toast.success(`${candidate.fullName} foi incluído(a) na equipe.`);
      setCandidates((current) => current.filter((item) => item.personId !== candidate.personId));
      await loadTeam();
    } catch (addError) { toast.error(addError instanceof Error ? addError.message : "Não foi possível incluir a pessoa."); }
    finally { setWorkingId(null); }
  }

  async function removeMember(member: TeamMember) {
    if (!window.confirm(`Retirar ${member.fullName} da sua equipe neste ciclo?`)) return;
    setWorkingId(member.linkId);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: removeError } = await supabase.rpc("remove_person_from_my_team", { target_link_id: member.linkId });
      if (removeError) throw removeError;
      toast.success(`${member.fullName} foi retirado(a) da equipe.`);
      await loadTeam();
    } catch (removeError) { toast.error(removeError instanceof Error ? removeError.message : "Não foi possível retirar a pessoa."); }
    finally { setWorkingId(null); }
  }

  if (loading) return <PlatformSkeleton title="Carregando equipe" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;
  const modules = deriveModules(context);
  const person = context.person;
  const user = { fullName: person.fullName, institutionalEmail: person.institutionalEmail, employeeNumber: person.employeeNumber, profileLabel: profileLabel(context), roles: context.roles, modules };
  const sent = workspace?.members.filter((member) => ["SUBMITTED", "VALIDATED"].includes(member.submissionStatus ?? "")).length ?? 0;
  const drafts = workspace?.members.filter((member) => member.submissionStatus === "DRAFT").length ?? 0;
  const pending = (workspace?.total ?? 0) - sent;

  return <PlatformShell user={user} eyebrow="Gestão da liderança" title="Minha equipe">
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">CDDI 2026</p><h2 className="mt-1 text-3xl font-black text-[#003b70]">Avaliações da minha equipe</h2><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Acompanhe cada integrante, inicie a avaliação pela chefia, continue rascunhos e consulte avaliações enviadas.</p></div>
        <button type="button" onClick={() => setDialogOpen(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#086ab6] px-5 py-3 font-black text-white"><Plus className="h-5 w-5" /> Inserir pessoa</button>
      </div>
      {workspace?.application && <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold"><span className="rounded-full bg-blue-50 px-3 py-1.5 text-blue-700">{workspace.application.name}</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-600">{workspace.application.code}</span><span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-800">{workspace.application.status}</span></div>}
    </section>

    <section className="mt-5 grid gap-3 sm:grid-cols-4">
      {[["Integrantes", workspace?.total ?? 0], ["Enviadas", sent], ["Rascunhos", drafts], ["Pendências", pending]].map(([label, value]) => <article key={String(label)} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-black uppercase tracking-[.12em] text-slate-400">{label}</p><strong className="mt-2 block text-3xl font-black text-[#003b70]">{value}</strong></article>)}
    </section>

    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h3 className="text-xl font-black text-[#003b70]">Integrantes vinculados</h3><p className="mt-1 text-sm text-slate-500">O botão principal muda conforme o andamento da avaliação.</p></div><label className="relative block w-full max-w-sm"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar nome, matrícula ou unidade" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 font-semibold outline-none focus:border-blue-400 focus:bg-white" /></label></div>
      <div className="mt-5 grid gap-3">
        {teamLoading ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-xl bg-slate-100" />) : filtered.length ? filtered.map((member) => <article key={member.linkId} className="grid gap-4 rounded-xl border border-slate-200 p-4 transition hover:border-blue-200 lg:grid-cols-[auto_1fr_auto_auto] lg:items-center"><div className="grid h-12 w-12 place-items-center rounded-xl bg-blue-50 font-black text-[#003b70]">{initials(member.fullName)}</div><div className="min-w-0"><strong className="block truncate text-[#003b70]">{member.fullName}</strong><p className="mt-1 truncate text-sm text-slate-500">Matrícula {member.employeeNumber} · {member.jobTitle ?? "Cargo não informado"}</p><p className="mt-1 truncate text-xs text-slate-400">{member.unit ?? member.workplace ?? "Unidade não informada"}</p></div><div><span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${["SUBMITTED", "VALIDATED"].includes(member.submissionStatus ?? "") ? "bg-emerald-100 text-emerald-800" : member.submissionStatus === "DRAFT" ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>{submissionLabel(member.submissionStatus)}</span>{member.submissionUpdatedAt && <p className="mt-1 text-right text-[10px] text-slate-400">Atualizada em {new Date(member.submissionUpdatedAt).toLocaleDateString("pt-BR")}</p>}</div><div className="flex flex-wrap gap-2"><Link href={`/cddi/chefia/${member.personId}`} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#086ab6] px-4 py-2.5 text-sm font-black text-white"><ClipboardCheck className="h-4 w-4" />{actionLabel(member.submissionStatus)}</Link><button type="button" disabled={workingId === member.linkId} onClick={() => removeMember(member)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-black text-red-700 disabled:opacity-50">{workingId === member.linkId ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}Retirar</button></div></article>) : <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center"><UsersRound className="mx-auto h-9 w-9 text-slate-300" /><strong className="mt-4 block text-[#003b70]">Nenhuma pessoa encontrada</strong><p className="mt-2 text-sm text-slate-500">Use “Inserir pessoa” para montar a equipe deste ciclo.</p></div>}
      </div>
    </section>

    {dialogOpen && <><button type="button" aria-label="Fechar janela" onClick={() => setDialogOpen(false)} className="fixed inset-0 z-[90] bg-slate-950/50 backdrop-blur-sm" /><section role="dialog" aria-modal="true" className="fixed inset-x-4 top-[8vh] z-[100] mx-auto max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"><header className="flex items-start justify-between border-b border-slate-200 p-6"><div><p className="text-xs font-black uppercase tracking-[.15em] text-emerald-700">Novo vínculo</p><h2 className="mt-1 text-2xl font-black text-[#003b70]">Inserir pessoa na equipe</h2><p className="mt-2 text-sm text-slate-500">Pesquise participantes que ainda não possuem liderança ativa.</p></div><button type="button" onClick={() => setDialogOpen(false)} className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-500"><X className="h-5 w-5" /></button></header><div className="p-6"><label className="relative block"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input autoFocus value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Digite nome, matrícula ou e-mail" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-4 pl-12 pr-4 font-semibold outline-none focus:border-blue-400 focus:bg-white" /></label><div className="mt-5 max-h-[55vh] space-y-3 overflow-y-auto">{candidateLoading ? <div className="flex items-center justify-center py-16 text-slate-500"><Loader2 className="mr-3 h-5 w-5 animate-spin" />Pesquisando participantes...</div> : candidates.length ? candidates.map((candidate) => <article key={candidate.personId} className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center"><div className="grid h-11 w-11 place-items-center rounded-xl bg-slate-100 font-black text-[#003b70]">{initials(candidate.fullName)}</div><div className="min-w-0 flex-1"><strong className="block truncate text-[#003b70]">{candidate.fullName}</strong><p className="mt-1 truncate text-sm text-slate-500">{candidate.employeeNumber} · {candidate.jobTitle ?? "Cargo não informado"}</p><p className="mt-1 truncate text-xs text-slate-400">{candidate.unit ?? candidate.institutionalEmail ?? "Sem unidade informada"}</p></div><button type="button" disabled={workingId === candidate.personId} onClick={() => addMember(candidate)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#003b70] px-4 py-2.5 text-sm font-black text-white disabled:opacity-50">{workingId === candidate.personId ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Adicionar</button></article>) : <div className="rounded-xl bg-slate-50 p-10 text-center text-sm text-slate-500">Nenhuma pessoa elegível encontrada.</div>}</div></div></section></>}
  </PlatformShell>;
}
