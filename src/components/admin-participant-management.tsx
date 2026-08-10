"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Ban, CheckCircle2, Loader2, Plus, RefreshCw, Search, UserPlus, UsersRound, XCircle } from "lucide-react";
import { toast } from "sonner";
import { ExternalImage } from "@/components/external-image";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type ApplicationItem = {
  id: string;
  code: string;
  name: string;
  status: string;
  accessMode: string;
  participantCount: number;
  completedCount: number;
};

type Participant = {
  id: string;
  personId: string;
  employeeNumber: string;
  fullName: string;
  institutionalEmail: string | null;
  jobTitle: string | null;
  costCenter: string | null;
  workplace: string | null;
  avatarUrl: string | null;
  accessProfile: string | null;
  status: string;
  completedAt: string | null;
  hasSubmission: boolean;
};

type PersonSearchResult = {
  personId: string;
  employeeNumber: string;
  fullName: string;
  institutionalEmail: string | null;
  jobTitle: string | null;
  costCenter: string | null;
  workplace: string | null;
  avatarUrl: string | null;
  participantId: string | null;
  participantStatus: string | null;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? ""}${parts.at(-1)?.[0] ?? ""}`.toUpperCase() || "--";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    ELIGIBLE: "Elegível",
    INVITED: "Convidado",
    IN_PROGRESS: "Em andamento",
    COMPLETED: "Concluído",
    BLOCKED: "Bloqueado",
    EXCLUDED: "Excluído",
  };
  return labels[status] ?? status;
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const [failed, setFailed] = useState(false);
  return url && !failed ? (
    <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
      <ExternalImage src={url} alt={`Avatar de ${name}`} width={40} height={40} onError={() => setFailed(true)} className="h-full w-full object-cover" />
    </span>
  ) : (
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-sky-50 text-xs font-black text-[#003b70] ring-1 ring-sky-100">{initials(name)}</span>
  );
}

export function AdminParticipantManagement() {
  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState<PersonSearchResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ employeeNumber: "", fullName: "", institutionalEmail: "", jobTitle: "", costCenter: "", workplace: "" });

  const selectedApplication = applications.find((item) => item.id === applicationId) ?? null;

  const loadApplications = useCallback(async () => {
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.rpc("list_admin_participant_applications");
    if (error) throw error;
    const rows = Array.isArray(data) ? data as ApplicationItem[] : [];
    setApplications(rows);
    setApplicationId((current) => current || rows[0]?.id || "");
  }, []);

  const loadParticipants = useCallback(async (targetId: string) => {
    if (!targetId) return;
    const supabase = createBrowserSupabaseClient();
    const { data, error } = await supabase.rpc("list_admin_application_participants", { target_application_id: targetId });
    if (error) throw error;
    setParticipants(Array.isArray(data) ? data as Participant[] : []);
  }, []);

  async function refreshAll() {
    setLoading(true);
    try {
      await loadApplications();
      if (applicationId) await loadParticipants(applicationId);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar os participantes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadApplications().catch((error) => toast.error(error.message)).finally(() => setLoading(false)); }, [loadApplications]);
  useEffect(() => {
    if (!applicationId) return;
    setLoading(true);
    void loadParticipants(applicationId).catch((error) => toast.error(error.message)).finally(() => setLoading(false));
  }, [applicationId, loadParticipants]);

  useEffect(() => {
    if (!applicationId || search.trim().length < 2) { setPeople([]); return; }
    const timeout = window.setTimeout(async () => {
      const supabase = createBrowserSupabaseClient();
      const { data, error } = await supabase.rpc("search_admin_people_for_application", {
        target_application_id: applicationId,
        target_search: search.trim(),
      });
      if (error) toast.error(error.message);
      else setPeople(Array.isArray(data) ? data as PersonSearchResult[] : []);
    }, 350);
    return () => window.clearTimeout(timeout);
  }, [applicationId, search]);

  const activeParticipants = useMemo(() => participants.filter((item) => item.status !== "EXCLUDED"), [participants]);

  async function assign(personId: string) {
    setWorking(personId);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("assign_admin_application_participant", {
        target_application_id: applicationId,
        target_person_id: personId,
        target_access_profile: "PARTICIPANTE",
      });
      if (error) throw error;
      toast.success("Pessoa vinculada à avaliação.");
      await Promise.all([loadParticipants(applicationId), loadApplications()]);
      setSearch("");
      setPeople([]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível vincular a pessoa.");
    } finally { setWorking(""); }
  }

  async function createAndAssign() {
    setWorking("CREATE");
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("create_and_assign_admin_participant", {
        target_application_id: applicationId,
        target_employee_number: form.employeeNumber,
        target_full_name: form.fullName,
        target_institutional_email: form.institutionalEmail,
        target_job_title: form.jobTitle || null,
        target_cost_center: form.costCenter || null,
        target_workplace: form.workplace || null,
        target_access_profile: "PARTICIPANTE",
      });
      if (error) throw error;
      toast.success("Pessoa cadastrada e vinculada à avaliação.");
      setForm({ employeeNumber: "", fullName: "", institutionalEmail: "", jobTitle: "", costCenter: "", workplace: "" });
      setShowCreate(false);
      await Promise.all([loadParticipants(applicationId), loadApplications()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível cadastrar a pessoa.");
    } finally { setWorking(""); }
  }

  async function changeStatus(participantId: string, status: "ELIGIBLE" | "BLOCKED" | "EXCLUDED") {
    setWorking(participantId);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.rpc("set_admin_application_participant_status", {
        target_participant_id: participantId,
        target_status: status,
      });
      if (error) throw error;
      toast.success(status === "ELIGIBLE" ? "Participante reativado." : status === "BLOCKED" ? "Participante bloqueado." : "Participante removido da avaliação.");
      await Promise.all([loadParticipants(applicationId), loadApplications()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível alterar o participante.");
    } finally { setWorking(""); }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
          <label className="block">
            <span className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Avaliação ou ciclo</span>
            <select value={applicationId} onChange={(event) => setApplicationId(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-bold text-slate-800 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">
              {applications.map((item) => <option key={item.id} value={item.id}>{item.code} — {item.name}</option>)}
            </select>
          </label>
          <button type="button" onClick={() => void refreshAll()} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 font-black text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4" />Atualizar</button>
        </div>
        {selectedApplication && <div className="mt-4 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-50 p-4"><span className="text-xs text-slate-500">Modo de acesso</span><strong className="mt-1 block text-[#003b70]">{selectedApplication.accessMode === "RESTRICTED" ? "Participantes vinculados" : "Institucional"}</strong></div><div className="rounded-2xl bg-slate-50 p-4"><span className="text-xs text-slate-500">Participantes ativos</span><strong className="mt-1 block text-2xl text-[#003b70]">{activeParticipants.length}</strong></div><div className="rounded-2xl bg-slate-50 p-4"><span className="text-xs text-slate-500">Concluídos</span><strong className="mt-1 block text-2xl text-emerald-700">{selectedApplication.completedCount}</strong></div></div>}
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <label className="relative block flex-1"><span className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Localizar pessoa</span><Search className="absolute bottom-3.5 left-4 h-4 w-4 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, matrícula, e-mail ou cargo" className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 font-semibold outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" /></label>
          <button type="button" onClick={() => setShowCreate((current) => !current)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-[#003b70] px-5 font-black text-white hover:bg-[#075ea8]"><UserPlus className="h-4 w-4" />Cadastrar nova pessoa</button>
        </div>

        {people.length > 0 && <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">{people.map((person) => <div key={person.personId} className="flex flex-col gap-3 border-b border-slate-100 p-4 last:border-0 sm:flex-row sm:items-center"><Avatar name={person.fullName} url={person.avatarUrl}/><div className="min-w-0 flex-1"><strong className="block truncate text-slate-900">{person.fullName}</strong><span className="block truncate text-xs text-slate-500">{person.employeeNumber} · {person.institutionalEmail || "Sem e-mail"} · {person.jobTitle || "Cargo não informado"}</span></div><button type="button" disabled={working === person.personId || (person.participantStatus !== null && person.participantStatus !== "BLOCKED" && person.participantStatus !== "EXCLUDED")} onClick={() => void assign(person.personId)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#003b70] px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">{working === person.personId ? <Loader2 className="h-4 w-4 animate-spin"/> : <Plus className="h-4 w-4"/>}{person.participantStatus && !["BLOCKED","EXCLUDED"].includes(person.participantStatus) ? "Já vinculado" : "Vincular"}</button></div>)}</div>}

        {showCreate && <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/40 p-5"><h3 className="font-black text-[#003b70]">Cadastrar e vincular participante</h3><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{[
          ["employeeNumber","Matrícula"],["fullName","Nome completo"],["institutionalEmail","E-mail institucional"],["jobTitle","Cargo"],["costCenter","Unidade/Centro de custo"],["workplace","Local de trabalho"]
        ].map(([key,label]) => <label key={key} className="block"><span className="text-xs font-bold text-slate-600">{label}</span><input value={form[key as keyof typeof form]} onChange={(event)=>setForm((current)=>({...current,[key]:event.target.value}))} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"/></label>)}</div><div className="mt-4 flex justify-end gap-2"><button type="button" onClick={()=>setShowCreate(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 font-black text-slate-600">Cancelar</button><button type="button" onClick={()=>void createAndAssign()} disabled={working === "CREATE"} className="inline-flex items-center gap-2 rounded-xl bg-[#003b70] px-4 py-2.5 font-black text-white disabled:opacity-50">{working === "CREATE" && <Loader2 className="h-4 w-4 animate-spin"/>}Salvar e vincular</button></div></div>}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-200 p-5"><div><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">Público definido</p><h2 className="mt-1 text-xl font-black text-[#003b70]">Participantes da avaliação</h2></div><span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm font-black text-[#003b70]"><UsersRound className="h-4 w-4"/>{activeParticipants.length}</span></div>
        {loading ? <div className="grid place-items-center p-12 text-slate-500"><Loader2 className="h-6 w-6 animate-spin"/></div> : participants.length ? <div className="divide-y divide-slate-100">{participants.map((participant) => <div key={participant.id} className={`flex flex-col gap-4 p-5 lg:flex-row lg:items-center ${participant.status === "EXCLUDED" ? "bg-slate-50 opacity-65" : ""}`}><Avatar name={participant.fullName} url={participant.avatarUrl}/><div className="min-w-0 flex-1"><strong className="block truncate text-slate-900">{participant.fullName}</strong><span className="mt-1 block truncate text-xs text-slate-500">{participant.employeeNumber} · {participant.institutionalEmail || "Sem e-mail"} · {participant.jobTitle || participant.costCenter || "Sem dados funcionais"}</span></div><span className={`rounded-full px-3 py-1 text-xs font-black ${participant.status === "COMPLETED" ? "bg-emerald-50 text-emerald-800" : participant.status === "BLOCKED" ? "bg-red-50 text-red-800" : participant.status === "EXCLUDED" ? "bg-slate-200 text-slate-700" : "bg-blue-50 text-blue-800"}`}>{statusLabel(participant.status)}</span><div className="flex flex-wrap gap-2">{["BLOCKED","EXCLUDED"].includes(participant.status) && !participant.completedAt && <button type="button" disabled={working === participant.id} onClick={()=>void changeStatus(participant.id,"ELIGIBLE")} className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 px-3 py-2 text-xs font-black text-emerald-700"><CheckCircle2 className="h-4 w-4"/>Reativar</button>}{!["BLOCKED","EXCLUDED","COMPLETED"].includes(participant.status) && <button type="button" disabled={working === participant.id} onClick={()=>void changeStatus(participant.id,"BLOCKED")} className="inline-flex items-center gap-2 rounded-xl border border-amber-200 px-3 py-2 text-xs font-black text-amber-700"><Ban className="h-4 w-4"/>Bloquear</button>}{participant.status !== "EXCLUDED" && <button type="button" disabled={working === participant.id} onClick={()=>void changeStatus(participant.id,"EXCLUDED")} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-black text-red-700"><XCircle className="h-4 w-4"/>Remover</button>}</div></div>)}</div> : <div className="p-12 text-center text-slate-500"><UsersRound className="mx-auto h-10 w-10 text-slate-300"/><p className="mt-3 font-bold">Nenhum participante vinculado a esta avaliação.</p></div>}
      </section>
    </div>
  );
}
