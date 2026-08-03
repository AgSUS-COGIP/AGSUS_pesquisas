"use client";

import Link from "next/link";
import { use, useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, CircleStop, Clock3, FileCheck2, Loader2, Play, RefreshCw, Send, ShieldCheck, Users2 } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Issue = { code: string; severity: "BLOCKING" | "WARNING"; message: string };
type MetricCard = { label: string; value: number; icon: typeof FileCheck2 };
type Operations = {
  status: string;
  survey: { id: string; code: string; name: string; status: string; description: string | null };
  version: { id: string; number: number; status: string };
  application: { id: string; code: string; name: string; status: string; opensAt: string | null; closesAt: string | null; allowDrafts: boolean } | null;
  metrics: { sections: number; questions: number; requiredQuestions: number; participants: number; draftSubmissions: number; submittedSubmissions: number };
  issues: Issue[];
  readyToPublish: boolean;
  readyToOpen: boolean;
};

function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function dateLabel(value: string | null | undefined) {
  if (!value) return "Não definido";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

export default function SurveyOperationsPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = use(params);
  const { context, loading, error } = usePlatformContext();
  const [operations, setOperations] = useState<Operations | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");

  async function loadOperations() {
    setDataLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: operationError } = await supabase.rpc("get_survey_operations", { target_survey_id: surveyId });
      if (operationError) throw operationError;
      const next = data as Operations;
      setOperations(next);
      setOpensAt(toLocalInput(next.application?.opensAt));
      setClosesAt(toLocalInput(next.application?.closesAt));
    } catch (loadError) {
      toast.error(loadError instanceof Error ? loadError.message : "Não foi possível carregar a operação do ciclo.");
    } finally {
      setDataLoading(false);
    }
  }

  useEffect(() => {
    if (context?.person) void loadOperations();
  }, [context?.person, surveyId]);

  async function runAction(action: string) {
    if (!operations?.application) return toast.error("O ciclo de aplicação ainda não foi criado.");
    if (["CLOSE", "CANCEL"].includes(action) && !window.confirm(action === "CLOSE" ? "Encerrar este ciclo agora?" : "Cancelar este ciclo?")) return;
    setWorking(action);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: actionError } = await supabase.rpc("manage_survey_cycle", {
        target_survey_id: surveyId,
        target_action: action,
        target_opens_at: action === "UPDATE_PERIOD" && opensAt ? new Date(opensAt).toISOString() : null,
        target_closes_at: action === "UPDATE_PERIOD" && closesAt ? new Date(closesAt).toISOString() : null,
      });
      if (actionError) throw actionError;
      toast.success("Operação concluída com sucesso.");
      await loadOperations();
    } catch (actionError) {
      toast.error(actionError instanceof Error ? actionError.message : "Não foi possível executar a operação.");
    } finally {
      setWorking(null);
    }
  }

  if (loading) return <PlatformSkeleton title="Carregando operação do ciclo" />;
  if (!context?.person) return <main className="p-10 text-red-700">{error || "Acesso não identificado."}</main>;
  const modules = deriveModules(context);
  if (!modules.includes("ADMIN_SURVEYS")) return <main className="p-10 text-red-700">Acesso restrito à administração.</main>;

  const user = {
    fullName: context.person.fullName,
    institutionalEmail: context.person.institutionalEmail,
    employeeNumber: context.person.employeeNumber,
    profileLabel: profileLabel(context),
    roles: context.roles,
    modules,
  };

  const metricCards: MetricCard[] = operations ? [
    { label: "Seções", value: operations.metrics.sections, icon: FileCheck2 },
    { label: "Perguntas", value: operations.metrics.questions, icon: FileCheck2 },
    { label: "Participantes", value: operations.metrics.participants, icon: Users2 },
    { label: "Rascunhos", value: operations.metrics.draftSubmissions, icon: Clock3 },
    { label: "Enviadas", value: operations.metrics.submittedSubmissions, icon: CheckCircle2 },
    { label: "Pendências", value: operations.issues.length, icon: AlertTriangle },
  ] : [];

  return <PlatformShell user={user} eyebrow="Centro de operações" title={operations?.survey.name ?? "Operação do ciclo"} actions={<div className="flex gap-2"><button onClick={() => void loadOperations()} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-600"><RefreshCw className="h-4 w-4" />Atualizar</button><Link href={`/admin/pesquisas/${surveyId}`} className="inline-flex items-center rounded-xl bg-[#003b70] px-4 py-2.5 text-sm font-black text-white">Abrir construtor</Link></div>}>
    {dataLoading || !operations ? <div className="grid min-h-[55vh] place-items-center"><Loader2 className="h-9 w-9 animate-spin text-[#003b70]" /></div> : <>
      <section className="overflow-hidden rounded-[2rem] bg-[radial-gradient(circle_at_85%_10%,rgba(34,211,238,.22),transparent_28%),linear-gradient(125deg,#062f54,#075ea8)] p-7 text-white shadow-xl sm:p-9">
        <div className="grid gap-6 xl:grid-cols-[1fr_auto] xl:items-end"><div><span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-black text-cyan-100"><ShieldCheck className="h-4 w-4" />Governança do ciclo</span><h2 className="mt-5 text-3xl font-black sm:text-4xl">{operations.survey.name}</h2><p className="mt-3 max-w-3xl leading-7 text-blue-100">Publique a versão, defina o período, abra o ciclo e acompanhe a execução sem ajustes manuais no banco.</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full bg-white/10 px-4 py-2 text-xs font-black">Versão {operations.version.number} · {operations.version.status}</span><span className="rounded-full bg-white/10 px-4 py-2 text-xs font-black">Ciclo · {operations.application?.status ?? "Não configurado"}</span></div></div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {metricCards.map(({ label, value, icon: Icon }) => <article key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-[#0b8f58]" /><p className="mt-4 text-xs font-black uppercase tracking-[.12em] text-slate-400">{label}</p><strong className="mt-1 block text-3xl font-black text-[#003b70]">{value}</strong></article>)}
      </section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.14em] text-[#0b8f58]">Prontidão</p><h3 className="mt-1 text-2xl font-black text-[#003b70]">Checklist do ciclo</h3></div>{operations.issues.length === 0 ? <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800">Tudo pronto</span> : <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-black text-amber-800">Requer atenção</span>}</div><div className="mt-5 space-y-3">{operations.issues.length ? operations.issues.map((issue) => <div key={issue.code} className={`flex gap-3 rounded-2xl border p-4 ${issue.severity === "BLOCKING" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}><AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${issue.severity === "BLOCKING" ? "text-red-600" : "text-amber-600"}`} /><div><strong className="text-slate-900">{issue.severity === "BLOCKING" ? "Bloqueio" : "Atenção"}</strong><p className="mt-1 text-sm text-slate-600">{issue.message}</p></div></div>) : <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4"><CheckCircle2 className="h-5 w-5 text-emerald-600" /><p className="text-sm font-bold text-emerald-900">A estrutura e o período estão consistentes para operação.</p></div>}</div></article>

        <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[.14em] text-[#0b8f58]">Configuração temporal</p><h3 className="mt-1 text-2xl font-black text-[#003b70]">Período do ciclo</h3><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-black text-slate-700">Abertura<input type="datetime-local" value={opensAt} onChange={(event) => setOpensAt(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-400" /></label><label className="text-sm font-black text-slate-700">Encerramento<input type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-400" /></label></div><p className="mt-3 text-xs text-slate-500">Atual: {dateLabel(operations.application?.opensAt)} → {dateLabel(operations.application?.closesAt)}</p><button onClick={() => void runAction("UPDATE_PERIOD")} disabled={working !== null || !opensAt || !closesAt} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-black text-white disabled:opacity-40">{working === "UPDATE_PERIOD" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}Salvar período</button></article>
      </section>

      <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[.14em] text-[#0b8f58]">Ações controladas</p><h3 className="mt-1 text-2xl font-black text-[#003b70]">Ciclo de vida da pesquisa</h3><p className="mt-2 text-sm text-slate-500">As ações abaixo são validadas no banco e registradas na auditoria.</p><div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ActionButton label="Publicar versão" icon={Send} working={working === "PUBLISH"} disabled={working !== null || !operations.readyToPublish || operations.version.status === "PUBLISHED"} onClick={() => void runAction("PUBLISH")} />
        <ActionButton label="Agendar ciclo" icon={CalendarClock} working={working === "SCHEDULE"} disabled={working !== null || !operations.readyToOpen || operations.application?.status !== "DRAFT"} onClick={() => void runAction("SCHEDULE")} />
        <ActionButton label="Abrir agora" icon={Play} working={working === "OPEN"} disabled={working !== null || !operations.readyToOpen || operations.application?.status === "OPEN" || operations.application?.status === "CLOSED"} onClick={() => void runAction("OPEN")} />
        <ActionButton label="Encerrar ciclo" icon={CircleStop} working={working === "CLOSE"} disabled={working !== null || !["OPEN", "SCHEDULED"].includes(operations.application?.status ?? "")} onClick={() => void runAction("CLOSE")} danger />
        <ActionButton label="Cancelar ciclo" icon={AlertTriangle} working={working === "CANCEL"} disabled={working !== null || ["CLOSED", "CANCELLED"].includes(operations.application?.status ?? "")} onClick={() => void runAction("CANCEL")} danger />
      </div></section>
    </>}
  </PlatformShell>;
}

function ActionButton({ label, icon: Icon, working, disabled, onClick, danger = false }: { label: string; icon: typeof Play; working: boolean; disabled: boolean; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-black text-white transition disabled:cursor-not-allowed disabled:opacity-35 ${danger ? "bg-red-700 hover:bg-red-800" : "bg-[#003b70] hover:bg-[#075ea8]"}`}>{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}{label}</button>;
}
