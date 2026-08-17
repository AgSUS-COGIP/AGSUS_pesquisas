"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { History, Loader2, RefreshCw, Save, Search, UserRoundCog, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { errorMessageFromUnknown } from "@/lib/observability";
import {
  atualizarPessoa,
  buscarPessoas,
  definirVinculoDeLideranca,
  listarAuditoriaDaPessoa,
  listarCiclosDeParticipantes,
  listarPessoasSemChefia,
  listarVinculosDeLideranca,
} from "@/lib/api/cliente-pessoas";
import type {
  AvaliacaoComParticipantes,
  EventoAuditoriaPessoa,
  PessoaAdministrativa,
  PessoaSemChefia,
  VinculoLideranca,
} from "@/lib/api/contratos-pessoas";

// Formatos vindos do contrato da API, no lugar das cópias que esta tela mantinha.
type Person = PessoaAdministrativa;
type Application = AvaliacaoComParticipantes;
type LeadershipLink = VinculoLideranca;
/** Participante do ciclo sem chefia vigente — fila de correção da administração. */
type PendingPerson = PessoaSemChefia;

/** Traduz o motivo técnico da pendência para o que o operador precisa fazer. */
const PENDING_REASON: Record<string, { label: string; hint: string }> = {
  NOT_FOUND: { label: "Gestor fora da plataforma", hint: "A base indica um gestor que não está cadastrado como pessoa ativa na plataforma." },
  MISSING_EMAIL: { label: "Base não informou gestor", hint: "A carga da base institucional não trouxe e-mail de gestor para esta pessoa." },
  AMBIGUOUS: { label: "Gestor ambíguo", hint: "Mais de uma pessoa ativa responde pelo e-mail informado." },
  PENDING: { label: "Vínculo não concluído", hint: "A base trouxe o gestor, mas o vínculo não chegou a ser criado." },
  SEM_DADO: { label: "Fora da carga da base", hint: "Esta pessoa não constava da última importação da base institucional." },
};

type AuditEvent = EventoAuditoriaPessoa;

type PersonForm = {
  fullName: string;
  institutionalEmail: string;
  jobTitle: string;
  costCenter: string;
  directorate: string;
  organizationalUnit: string;
  coordination: string;
  employmentStatus: string;
  active: boolean;
  justification: string;
};

function personToForm(person: Person): PersonForm {
  return {
    fullName: person.fullName,
    institutionalEmail: person.institutionalEmail ?? "",
    jobTitle: person.jobTitle ?? "",
    costCenter: person.costCenter ?? "",
    directorate: person.directorate ?? "",
    organizationalUnit: person.organizationalUnit ?? "",
    coordination: person.coordination ?? "",
    employmentStatus: person.employmentStatus,
    active: person.active,
    justification: "",
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function Field({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className="block"><span className="text-xs font-bold text-slate-600">{label}</span><input disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-500" /></label>;
}

export function AdminPeopleTeamsManagement() {
  const [tab, setTab] = useState<"people" | "teams">("people");
  const [people, setPeople] = useState<Person[]>([]);
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null);
  const [form, setForm] = useState<PersonForm | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationId, setApplicationId] = useState("");
  const [links, setLinks] = useState<LeadershipLink[]>([]);
  const [pending, setPending] = useState<PendingPerson[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [teamSearch, setTeamSearch] = useState("");
  const [subordinateSearch, setSubordinateSearch] = useState("");
  const [leaderSearch, setLeaderSearch] = useState("");
  const [subordinate, setSubordinate] = useState<Person | null>(null);
  const [leader, setLeader] = useState<Person | null>(null);
  const [leadershipJustification, setLeadershipJustification] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const selectedPersonIdRef = useRef<string | null>(null);

  useEffect(() => {
    selectedPersonIdRef.current = selectedPerson?.personId ?? null;
  }, [selectedPerson?.personId]);

  const searchPeople = useCallback(async (term: string) => {
    const rows = await buscarPessoas({ busca: term.trim(), limite: 80 });
    setPeople(rows);
    if (selectedPersonIdRef.current) {
      const refreshed = rows.find((item) => item.personId === selectedPersonIdRef.current);
      if (refreshed) { setSelectedPerson(refreshed); setForm(personToForm(refreshed)); }
    }
  }, []);

  const loadApplications = useCallback(async () => {
    const rows = await listarCiclosDeParticipantes();
    setApplications(rows);
    setApplicationId((current) => current || rows[0]?.id || "");
  }, []);

  const loadLinks = useCallback(async (targetApplicationId: string, term = "") => {
    if (!targetApplicationId) return;
    setLinks(await listarVinculosDeLideranca(targetApplicationId, { busca: term.trim(), limite: 200 }));
  }, []);

  const loadPending = useCallback(async (targetApplicationId: string) => {
    if (!targetApplicationId) return;
    setPendingLoading(true);
    try {
      setPending(await listarPessoasSemChefia(targetApplicationId, { limite: 500 }));
    } finally {
      setPendingLoading(false);
    }
  }, []);

  async function loadAudit(personId: string) {
    setAudit(await listarAuditoriaDaPessoa(personId, { limite: 30 }));
  }

  useEffect(() => {
    void Promise.all([searchPeople(""), loadApplications()])
      .catch((error) => toast.error(errorMessageFromUnknown(error) || "Não foi possível carregar a gestão institucional."))
      .finally(() => setLoading(false));
  }, [loadApplications, searchPeople]);

  useEffect(() => {
    if (!applicationId) return;
    void loadLinks(applicationId).catch((error) => toast.error(errorMessageFromUnknown(error)));
    // A mensagem do banco vai inteira para o toast: erro genérico esconderia a
    // causa real (coluna inexistente, função ausente, permissão negada).
    void loadPending(applicationId).catch((error) => toast.error(errorMessageFromUnknown(error) || "Não foi possível carregar as pendências de chefia."));
  }, [applicationId, loadLinks, loadPending]);

  useEffect(() => {
    const timeout = window.setTimeout(() => { void searchPeople(search).catch((error) => toast.error(errorMessageFromUnknown(error))); }, 300);
    return () => window.clearTimeout(timeout);
  }, [search, searchPeople]);

  const activeLinks = useMemo(() => links.filter((item) => item.status === "ACTIVE" && !item.validTo), [links]);

  /**
   * Pendências agrupadas pelo gestor ausente.
   *
   * A lista crua repete a mesma causa dezenas de vezes: cadastrar um gestor
   * costuma destravar dezenas de pessoas de uma vez. O agrupamento mostra onde
   * está a alavanca, em vez de esconder o padrão numa lista longa.
   */
  const missingManagers = useMemo(() => {
    const grouped = new Map<string, { name: string; email: string; people: PendingPerson[] }>();
    for (const item of pending) {
      if (item.managerResolution !== "NOT_FOUND" || !item.managerEmail) continue;
      const current = grouped.get(item.managerEmail)
        ?? { name: item.managerName ?? item.managerEmail, email: item.managerEmail, people: [] };
      current.people.push(item);
      grouped.set(item.managerEmail, current);
    }
    return [...grouped.values()].sort((a, b) => b.people.length - a.people.length);
  }, [pending]);

  /** Pendências que não vêm de gestor ausente — tratadas pessoa a pessoa. */
  const individualPending = useMemo(
    () => pending.filter((item) => item.managerResolution !== "NOT_FOUND" || !item.managerEmail),
    [pending],
  );
  const subordinateOptions = useMemo(() => people.filter((item) => item.active && item.personId !== leader?.personId && (`${item.fullName} ${item.employeeNumber}`).toLowerCase().includes(subordinateSearch.toLowerCase())).slice(0, 8), [people, subordinateSearch, leader]);
  const leaderOptions = useMemo(() => people.filter((item) => item.active && item.personId !== subordinate?.personId && (`${item.fullName} ${item.employeeNumber}`).toLowerCase().includes(leaderSearch.toLowerCase())).slice(0, 8), [people, leaderSearch, subordinate]);

  async function savePerson() {
    if (!selectedPerson || !form) return;
    setWorking(true);
    try {
      await atualizarPessoa(selectedPerson.personId, {
        fullName: form.fullName,
        institutionalEmail: form.institutionalEmail || null,
        jobTitle: form.jobTitle || null,
        costCenter: form.costCenter || null,
        // A tela não tem campo de local de trabalho: ele acompanha a unidade e,
        // na falta dela, o centro de custo. Mantido como sempre foi.
        workplace: form.organizationalUnit || form.costCenter || null,
        directorate: form.directorate || null,
        organizationalUnit: form.organizationalUnit || null,
        coordination: form.coordination || null,
        employmentStatus: form.employmentStatus,
        active: form.active,
        justification: form.justification,
      });
      toast.success("Dados funcionais atualizados e auditados.");
      await Promise.all([searchPeople(search), loadAudit(selectedPerson.personId)]);
    } catch (error) {
      toast.error(errorMessageFromUnknown(error) || "Não foi possível atualizar a pessoa.");
    } finally { setWorking(false); }
  }

  async function saveLeadership() {
    if (!applicationId || !subordinate || !leader) return;
    setWorking(true);
    try {
      await definirVinculoDeLideranca({
        applicationId,
        subordinatePersonId: subordinate.personId,
        leaderPersonId: leader.personId,
        justification: leadershipJustification,
      });
      toast.success("Vínculo de liderança atualizado e auditado.");
      setSubordinate(null); setLeader(null); setSubordinateSearch(""); setLeaderSearch(""); setLeadershipJustification("");
      // A fila de pendências é recarregada junto: quem acabou de receber chefia
      // some da lista, e o contador reflete o trabalho que ainda resta.
      await Promise.all([loadLinks(applicationId), loadPending(applicationId)]);
    } catch (error) {
      toast.error(errorMessageFromUnknown(error) || "Não foi possível corrigir o vínculo.");
    } finally { setWorking(false); }
  }

  if (loading) return <div className="grid min-h-64 place-items-center rounded-3xl border border-slate-200 bg-white"><Loader2 className="h-7 w-7 animate-spin text-slate-500" /></div>;

  return <div className="space-y-5">
    <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-sm" role="tablist" aria-label="Gestão institucional">
      <button type="button" role="tab" aria-selected={tab === "people"} onClick={() => setTab("people")} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-black ${tab === "people" ? "bg-[var(--brand-solid)] text-white" : "text-slate-600 hover:bg-slate-50"}`}><UserRoundCog className="h-4 w-4" />Dados funcionais</button>
      <button type="button" role="tab" aria-selected={tab === "teams"} onClick={() => setTab("teams")} className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-black ${tab === "teams" ? "bg-[var(--brand-solid)] text-white" : "text-slate-600 hover:bg-slate-50"}`}><UsersRound className="h-4 w-4" />Equipes e lideranças</button>
    </div>

    {tab === "people" ? <div className="grid gap-5 xl:grid-cols-[22rem_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4"><label className="relative block"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, matrícula, e-mail ou unidade" className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" /></label></div>
        <div className="max-h-[42rem] divide-y divide-slate-100 overflow-y-auto">{people.map((person) => <button key={person.personId} type="button" onClick={() => { setSelectedPerson(person); setForm(personToForm(person)); void loadAudit(person.personId).catch((error) => toast.error(errorMessageFromUnknown(error))); }} className={`w-full p-4 text-left transition hover:bg-slate-50 ${selectedPerson?.personId === person.personId ? "bg-blue-50" : ""}`}><strong className="block truncate text-sm text-slate-900">{person.fullName}</strong><span className="mt-1 block truncate text-xs text-slate-500">{person.employeeNumber} · {person.jobTitle || "Cargo não informado"}</span><span className={`mt-2 inline-flex rounded-full px-2 py-1 text-[11px] font-black ${person.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{person.active ? "Ativo" : "Inativo"}</span></button>)}</div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        {!selectedPerson || !form ? <div className="grid min-h-80 place-items-center text-center text-slate-500"><div><UserRoundCog className="mx-auto h-9 w-9"/><p className="mt-3 font-bold">Selecione uma pessoa para consultar e editar a ficha funcional.</p></div></div> : <>
          <div className="flex flex-col gap-3 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">Ficha institucional</p><h2 className="mt-1 text-2xl font-black text-[var(--brand-primary)]">{selectedPerson.fullName}</h2><p className="mt-1 text-sm text-slate-500">Matrícula {selectedPerson.employeeNumber} · atualização {formatDate(selectedPerson.updatedAt)}</p></div><button type="button" onClick={() => void Promise.all([searchPeople(search), loadAudit(selectedPerson.personId)])} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-black text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4"/>Atualizar</button></div>
          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <Field label="Matrícula (não editável)" value={selectedPerson.employeeNumber} onChange={() => undefined} disabled />
            <Field label="Nome completo" value={form.fullName} onChange={(value) => setForm({ ...form, fullName: value })} />
            <Field label="E-mail institucional" value={form.institutionalEmail} onChange={(value) => setForm({ ...form, institutionalEmail: value })} />
            <Field label="Cargo" value={form.jobTitle} onChange={(value) => setForm({ ...form, jobTitle: value })} />
            <Field label="Diretoria" value={form.directorate} onChange={(value) => setForm({ ...form, directorate: value })} />
            <Field label="Unidade" value={form.organizationalUnit} onChange={(value) => setForm({ ...form, organizationalUnit: value })} />
            <Field label="Coordenação" value={form.coordination} onChange={(value) => setForm({ ...form, coordination: value })} />
            <Field label="Centro de custo" value={form.costCenter} onChange={(value) => setForm({ ...form, costCenter: value })} />
            <Field label="Situação funcional" value={form.employmentStatus} onChange={(value) => setForm({ ...form, employmentStatus: value })} />
            <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-200 px-3 md:mt-6"><input type="checkbox" checked={form.active} onChange={(event) => setForm({ ...form, active: event.target.checked })} className="h-4 w-4"/><span className="text-sm font-bold text-slate-700">Pessoa ativa no sistema</span></label>
          </div>
          <label className="mt-5 block"><span className="text-xs font-bold text-slate-600">Justificativa obrigatória</span><textarea value={form.justification} onChange={(event) => setForm({ ...form, justification: event.target.value })} rows={3} placeholder="Explique o motivo da correção funcional" className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100" /></label>
          <div className="mt-4 flex justify-end"><button type="button" disabled={working || form.justification.trim().length < 10} onClick={() => void savePerson()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand-solid)] px-5 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">{working ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}Salvar alteração</button></div>
          <div className="mt-7 border-t border-slate-200 pt-5"><div className="flex items-center gap-2"><History className="h-4 w-4 text-slate-500"/><h3 className="font-black text-[var(--brand-primary)]">Histórico recente</h3></div><div className="mt-3 space-y-3">{audit.length ? audit.map((event) => <article key={event.eventId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm text-slate-800">Alteração de dados funcionais</strong><time className="text-xs text-slate-500">{formatDate(event.createdAt)}</time></div><p className="mt-1 text-xs text-slate-500">Por {event.actorName || "Administrador não identificado"}</p>{event.justification && <p className="mt-2 text-sm text-slate-700">{event.justification}</p>}</article>) : <p className="text-sm text-slate-500">Nenhuma alteração administrativa registrada para esta pessoa.</p>}</div></div>
        </>}
      </section>
    </div> : <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><div className="grid gap-4 lg:grid-cols-[1fr_1fr_auto] lg:items-end"><label><span className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Avaliação ou ciclo</span><select value={applicationId} onChange={(event) => setApplicationId(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-white px-4 font-bold outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100">{applications.map((application) => <option key={application.id} value={application.id}>{application.code} — {application.name}</option>)}</select></label><label className="relative"><span className="text-xs font-black uppercase tracking-[.14em] text-slate-500">Buscar vínculo</span><Search className="absolute bottom-4 left-4 h-4 w-4 text-slate-400"/><input value={teamSearch} onChange={(event) => setTeamSearch(event.target.value)} className="mt-2 h-12 w-full rounded-xl border border-slate-200 bg-slate-50 pl-11 pr-4 outline-none focus:border-blue-400 focus:bg-white focus:ring-4 focus:ring-blue-100" placeholder="Liderança, integrante ou matrícula"/></label><button type="button" onClick={() => void loadLinks(applicationId, teamSearch)} className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 font-black text-slate-700 hover:bg-slate-50"><RefreshCw className="h-4 w-4"/>Atualizar</button></div><div className="mt-4 rounded-2xl bg-blue-50 p-4 text-sm text-[var(--brand-primary)]"><strong>{activeLinks.length}</strong> vínculos ativos no ciclo selecionado. Correções encerram o vínculo anterior sem apagar o histórico.</div></section>

      {/* Fila de trabalho: sem chefia vinculada, a pessoa fica bloqueada na
          etapa de identificação do CDDI. A lista traz o gestor que a base
          indicava e o motivo, para a correção não ser uma busca às cegas. */}
      <section aria-label="Pessoas sem chefia vinculada" className="overflow-hidden rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] p-5">
          <div>
            <p className="text-xs font-black uppercase tracking-[.14em] text-[var(--status-warning-text)]">Pendências do ciclo</p>
            <h2 className="mt-1 text-xl font-black text-[var(--brand-primary)]">
              {pendingLoading ? "Verificando pendências..." : `${pending.length} ${pending.length === 1 ? "pessoa sem chefia" : "pessoas sem chefia"}`}
            </h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Sem vínculo, elas não conseguem avançar da etapa de identificação.
              {!pendingLoading && missingManagers.length
                ? ` A maior parte vem de ${missingManagers.length} ${missingManagers.length === 1 ? "gestor ausente" : "gestores ausentes"} na plataforma.`
                : ""}
            </p>
          </div>
          <button type="button" onClick={() => void loadPending(applicationId).catch((error) => toast.error(errorMessageFromUnknown(error)))} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--border-subtle)] px-4 text-sm font-black text-[var(--text-primary)] hover:bg-[var(--surface-hover)]">
            <RefreshCw className="h-4 w-4" aria-hidden="true" />Atualizar
          </button>
        </div>
        {pendingLoading ? (
          <p className="p-8 text-center text-sm text-[var(--text-secondary)]">Carregando pendências...</p>
        ) : pending.length ? (
          <>
            {/* Causa concentrada: cadastrar um gestor ausente resolve o grupo
                inteiro. Vem primeiro porque é o maior ganho por ação. */}
            {missingManagers.length ? (
              <div className="border-b border-[var(--border-subtle)] p-5">
                <h3 className="text-sm font-black text-[var(--text-primary)]">
                  {missingManagers.length} {missingManagers.length === 1 ? "gestor não está" : "gestores não estão"} cadastrado{missingManagers.length === 1 ? "" : "s"} na plataforma
                </h3>
                <p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">
                  A base aponta essas pessoas como chefia, mas elas não existem como pessoa ativa aqui.
                  Cadastrá-las em <strong className="font-semibold text-[var(--text-primary)]">Dados funcionais</strong> destrava
                  {" "}{missingManagers.reduce((total, group) => total + group.people.length, 0)} pendências de uma vez.
                </p>
                <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                  {missingManagers.map((group) => (
                    <li key={group.email} className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3">
                      <span className="min-w-0">
                        <strong className="block truncate text-sm text-[var(--text-primary)]">{group.name}</strong>
                        <span className="block truncate text-xs text-[var(--text-secondary)]">{group.email}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-[var(--status-warning-bg)] px-2.5 py-1 text-[11px] font-black text-[var(--status-warning-text)]">
                        {group.people.length} {group.people.length === 1 ? "pessoa" : "pessoas"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {individualPending.length ? (
              <div className="p-5">
                <h3 className="text-sm font-black text-[var(--text-primary)]">
                  {individualPending.length} {individualPending.length === 1 ? "pessoa precisa" : "pessoas precisam"} de definição individual
                </h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">A base não informou gestor para elas — defina a chefia caso a caso.</p>
                <div className="mt-3 max-h-[22rem] divide-y divide-[var(--border-subtle)] overflow-y-auto rounded-xl border border-[var(--border-subtle)]">
                  {individualPending.map((item) => {
                    const reason = PENDING_REASON[item.managerResolution] ?? PENDING_REASON.SEM_DADO;
                    return (
                      <article key={item.personId} className="grid gap-3 p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
                        <div className="min-w-0">
                          <strong className="block truncate text-sm text-[var(--text-primary)]">{item.fullName}</strong>
                          <span className="block truncate text-xs text-[var(--text-secondary)]">
                            {item.employeeNumber ?? "sem matrícula"}{item.jobTitle ? ` · ${item.jobTitle}` : ""}
                            {item.organizationalUnit ? ` · ${item.organizationalUnit}` : ""}
                          </span>
                        </div>
                        <span className="inline-flex w-fit items-center rounded-full bg-[var(--status-warning-bg)] px-2.5 py-1 text-[11px] font-black text-[var(--status-warning-text)]" title={reason.hint}>
                          {reason.label}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            // Preenche o integrante no formulário abaixo e leva o foco
                            // até ele: a correção começa de onde a pendência foi vista.
                            const person = people.find((candidate) => candidate.personId === item.personId);
                            if (person) setSubordinate(person);
                            setSubordinateSearch(`${item.fullName} · ${item.employeeNumber ?? ""}`);
                            setLeader(null);
                            setLeaderSearch("");
                            document.getElementById("definir-lideranca")?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[var(--brand-solid)] px-4 text-sm font-black text-[var(--text-on-brand)] transition hover:bg-[var(--brand-solid-hover)] lg:justify-self-end"
                        >
                          Definir chefia
                        </button>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="p-8 text-center text-sm text-[var(--text-secondary)]">Todas as pessoas do ciclo têm chefia vinculada.</p>
        )}
      </section>

      <section id="definir-lideranca" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"><p className="text-xs font-black uppercase tracking-[.14em] text-emerald-700">Correção administrativa</p><h2 className="mt-1 text-2xl font-black text-[var(--brand-primary)]">Definir liderança da pessoa</h2><div className="mt-5 grid gap-4 lg:grid-cols-2">
        <div><label className="block text-xs font-bold text-slate-600">Integrante</label><input value={subordinateSearch} onChange={(event) => { setSubordinateSearch(event.target.value); setSubordinate(null); }} placeholder="Digite nome ou matrícula" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"/>{subordinateSearch && !subordinate && <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">{subordinateOptions.map((person) => <button key={person.personId} type="button" onClick={() => { setSubordinate(person); setSubordinateSearch(`${person.fullName} · ${person.employeeNumber}`); }} className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50"><strong>{person.fullName}</strong><span className="ml-2 text-slate-500">{person.employeeNumber}</span></button>)}</div>}</div>
        <div><label className="block text-xs font-bold text-slate-600">Nova liderança</label><input value={leaderSearch} onChange={(event) => { setLeaderSearch(event.target.value); setLeader(null); }} placeholder="Digite nome ou matrícula" className="mt-1.5 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"/>{leaderSearch && !leader && <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">{leaderOptions.map((person) => <button key={person.personId} type="button" onClick={() => { setLeader(person); setLeaderSearch(`${person.fullName} · ${person.employeeNumber}`); }} className="block w-full border-b border-slate-100 px-3 py-2 text-left text-sm last:border-0 hover:bg-slate-50"><strong>{person.fullName}</strong><span className="ml-2 text-slate-500">{person.employeeNumber}</span></button>)}</div>}</div>
      </div><label className="mt-4 block"><span className="text-xs font-bold text-slate-600">Justificativa obrigatória</span><textarea value={leadershipJustification} onChange={(event) => setLeadershipJustification(event.target.value)} rows={3} placeholder="Explique o motivo da inclusão ou troca de liderança" className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"/></label><div className="mt-4 flex justify-end"><button type="button" disabled={working || !subordinate || !leader || leadershipJustification.trim().length < 10} onClick={() => void saveLeadership()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--brand-solid)] px-5 font-black text-white disabled:cursor-not-allowed disabled:bg-slate-300">{working ? <Loader2 className="h-4 w-4 animate-spin"/> : <Save className="h-4 w-4"/>}Salvar vínculo</button></div></section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"><div className="border-b border-slate-200 p-5"><h2 className="text-xl font-black text-[var(--brand-primary)]">Vínculos do ciclo</h2></div><div className="divide-y divide-slate-100">{links.length ? links.map((link) => <article key={link.linkId} className={`grid gap-3 p-5 md:grid-cols-[1fr_auto_1fr_auto] md:items-center ${link.status !== "ACTIVE" || link.validTo ? "bg-slate-50 opacity-70" : ""}`}><div><span className="text-xs font-black uppercase tracking-[.12em] text-slate-400">Integrante</span><strong className="mt-1 block text-slate-900">{link.subordinateName}</strong><span className="text-xs text-slate-500">{link.subordinateEmployeeNumber}</span></div><span className="hidden text-slate-300 md:block">→</span><div><span className="text-xs font-black uppercase tracking-[.12em] text-slate-400">Liderança</span><strong className="mt-1 block text-slate-900">{link.leaderName}</strong><span className="text-xs text-slate-500">{link.leaderEmployeeNumber}</span></div><span className={`rounded-full px-3 py-1 text-xs font-black ${link.status === "ACTIVE" && !link.validTo ? "bg-emerald-50 text-emerald-700" : "bg-slate-200 text-slate-600"}`}>{link.status === "ACTIVE" && !link.validTo ? "Ativo" : "Encerrado"}</span></article>) : <p className="p-8 text-center text-sm text-slate-500">Nenhum vínculo encontrado para este ciclo.</p>}</div></section>
    </div>}
  </div>;
}
