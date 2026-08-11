"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, CheckCircle2, CircleStop, Clock3, FileCheck2, Loader2, Play, RefreshCw, RotateCcw, Send, ShieldCheck, Users2 } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { useConfirm } from "@/components/confirmation-provider";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type Issue = {
  id?: string;
  code: string;
  severity: "BLOCKING" | "WARNING";
  category?: "STRUCTURE" | "CYCLE" | "PERIOD" | "AUDIENCE";
  entityType?: string;
  entityId?: string;
  message: string;
  action?: string;
};
type MetricCard = { label: string; value: number; icon: typeof FileCheck2 };
type Operations = {
  status: string;
  survey: { id: string; code: string; name: string; status: string; description: string | null };
  version: { id: string; number: number; status: string };
  application: { id: string; code: string; name: string; status: string; opensAt: string | null; closesAt: string | null; allowDrafts: boolean; accessMode?: string } | null;
  metrics: { sections: number; questions: number; requiredQuestions: number; participants: number; draftSubmissions: number; submittedSubmissions: number };
  issues: Issue[];
  readyToPublish: boolean;
  readyToOpen: boolean;
};

type SupabaseLikeError = { message?: string; details?: string; hint?: string };

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

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error) {
    const candidate = error as SupabaseLikeError;
    return candidate.message || candidate.details || candidate.hint || fallback;
  }
  return fallback;
}

function cycleExplanation(status: string | undefined) {
  switch (status) {
    case "DRAFT": return "O ciclo está em preparação. Ajuste o período antes de publicar ou abrir.";
    case "SCHEDULED": return "O ciclo está agendado. O período ainda pode ser ajustado antes da abertura.";
    case "OPEN": return "O ciclo está aberto para respostas. Para alterar o período, encerre-o primeiro.";
    case "CLOSED": return "O ciclo foi encerrado. Informe um novo período e use Reabrir ciclo para receber novas respostas.";
    case "CANCELLED": return "O ciclo foi cancelado e não pode ser retomado. Crie um novo ciclo para esta avaliação.";
    default: return "Configure o período e o estado operacional deste ciclo.";
  }
}

export default function SurveyOperationsPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const confirm = useConfirm();
  const { surveyId } = use(params);
  const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_SURVEYS);
  const granted = guard.state === "granted";
  const [operations, setOperations] = useState<Operations | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");

  const loadOperations = useCallback(async () => {
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
      toast.error(errorMessage(loadError, "Não foi possível carregar a operação do ciclo."));
    } finally {
      setDataLoading(false);
    }
  }, [surveyId]);

  useEffect(() => {
    if (granted) void loadOperations();
  }, [granted, loadOperations]);

  async function runAction(action: string) {
    if (!operations?.application) return toast.error("O ciclo de aplicação ainda não foi criado.");
    const confirmations: Partial<Record<string, string>> = {
      PUBLISH: "Publicar esta versão? Depois de publicada, a estrutura não poderá ser alterada.",
      OPEN: "Abrir este ciclo agora para receber respostas?",
      REOPEN: "Reabrir este ciclo com o novo período informado?",
      CLOSE: "Encerrar este ciclo agora?",
      CANCEL: "Cancelar este ciclo? Esta ação não poderá ser revertida.",
    };
    const confirmation = confirmations[action];
    if (confirmation && !(await confirm({ title: "Confirmar operação do ciclo?", description: confirmation, confirmLabel: action === "CANCEL" || action === "CLOSE" ? "Confirmar operação" : "Continuar", tone: action === "CANCEL" || action === "CLOSE" ? "danger" : "primary" }))) return;

    const sendsPeriod = action === "UPDATE_PERIOD" || action === "REOPEN";
    setWorking(action);
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: actionError } = await supabase.rpc("manage_survey_cycle", {
        target_survey_id: surveyId,
        target_action: action,
        target_opens_at: sendsPeriod && opensAt ? new Date(opensAt).toISOString() : null,
        target_closes_at: sendsPeriod && closesAt ? new Date(closesAt).toISOString() : null,
      });
      if (actionError) throw actionError;
      const successLabels: Record<string, string> = {
        UPDATE_PERIOD: "Período atualizado.", PUBLISH: "Versão publicada.", SCHEDULE: "Ciclo agendado.", OPEN: "Ciclo aberto.", REOPEN: "Ciclo reaberto.", CLOSE: "Ciclo encerrado.", CANCEL: "Ciclo cancelado.",
      };
      toast.success(successLabels[action] ?? "Operação concluída.");
      await loadOperations();
    } catch (actionError) {
      toast.error(errorMessage(actionError, "Não foi possível executar a operação."));
    } finally {
      setWorking(null);
    }
  }

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="operação do ciclo"
      restrictedTitle="Operação de ciclos restrita"
      restrictedDescription="Seu perfil não possui permissão para operar ciclos de avaliação."
    />;
  }

  const cycleStatus = operations?.application?.status;
  const canEditPeriod = cycleStatus === "DRAFT" || cycleStatus === "SCHEDULED";
  const canReopen = cycleStatus === "CLOSED";
  const fieldsEnabled = canEditPeriod || canReopen;
  const blockingIssues = operations?.issues.filter((issue) => issue.severity === "BLOCKING") ?? [];
  const metricCards: MetricCard[] = operations ? [
    { label: "Seções", value: operations.metrics.sections, icon: FileCheck2 },
    { label: "Perguntas", value: operations.metrics.questions, icon: FileCheck2 },
    { label: "Participantes", value: operations.metrics.participants, icon: Users2 },
    { label: "Rascunhos", value: operations.metrics.draftSubmissions, icon: Clock3 },
    { label: "Enviadas", value: operations.metrics.submittedSubmissions, icon: CheckCircle2 },
    { label: "Pendências", value: operations.issues.length, icon: AlertTriangle },
  ] : [];

  return <PlatformShell user={guard.user} eyebrow="Centro de operações" title={operations?.survey.name ?? "Operação do ciclo"} actions={<div className="flex gap-2"><button onClick={() => void loadOperations()} className="secondary-button"><RefreshCw className="h-4 w-4" />Atualizar</button><Link href={`/admin/pesquisas/${surveyId}`} className="primary-button">Abrir construtor</Link></div>}>
    {dataLoading || !operations ? <div className="grid min-h-[55vh] place-items-center"><Loader2 className="h-9 w-9 animate-spin text-[var(--brand-primary)]" /></div> : <>
      <section className="rounded-2xl border border-[var(--border-subtle)] border-t-[3px] border-t-[var(--brand-solid)] bg-[var(--surface-card)] p-5 shadow-sm sm:p-6"><div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between"><div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-[var(--border-subtle)] bg-[var(--surface-interactive)] px-3 py-1 text-[11px] font-black uppercase tracking-[.12em] text-[var(--brand-secondary)]"><ShieldCheck className="h-3.5 w-3.5" />Governança do ciclo</span><h2 className="mt-3 break-words text-2xl font-black tracking-tight text-[var(--text-primary)]">{operations.survey.name}</h2><p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Publique a versão, defina o período, abra o ciclo e acompanhe a execução sem ajustes manuais no banco.</p></div><div className="flex flex-wrap gap-2"><span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-interactive)] px-3 py-1.5 text-xs font-black text-[var(--text-secondary)]">Versão {operations.version.number} · {operations.version.status}</span><span className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-interactive)] px-3 py-1.5 text-xs font-black text-[var(--text-secondary)]">Ciclo · {cycleStatus ?? "Não configurado"}</span></div></div></section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">{metricCards.map(({ label, value, icon: Icon }) => <article key={label} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"><Icon className="h-5 w-5 text-[var(--brand-secondary)]" /><p className="mt-4 text-xs font-black uppercase tracking-[.12em] text-slate-400">{label}</p><strong className="mt-1 block text-3xl font-black text-[var(--brand-primary)]">{value}</strong></article>)}</section>

      <section className="mt-6 grid gap-5 xl:grid-cols-[.9fr_1.1fr]">
        <ReadinessChecklist issues={operations.issues} surveyId={surveyId} />

        <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[.14em] text-[var(--brand-secondary)]">Configuração temporal</p><h3 className="mt-1 text-2xl font-black text-[var(--brand-primary)]">Período do ciclo</h3><p className="mt-2 text-sm leading-6 text-slate-500">{cycleExplanation(cycleStatus)}</p><div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-black text-slate-700">Abertura<input type="datetime-local" value={opensAt} disabled={!fieldsEnabled} onChange={(event) => setOpensAt(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-55" /></label><label className="text-sm font-black text-slate-700">Encerramento<input type="datetime-local" value={closesAt} disabled={!fieldsEnabled} onChange={(event) => setClosesAt(event.target.value)} className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 outline-none focus:border-blue-400 disabled:cursor-not-allowed disabled:opacity-55" /></label></div><p className="mt-3 text-xs text-slate-500">Atual: {dateLabel(operations.application?.opensAt)} → {dateLabel(operations.application?.closesAt)}</p>{fieldsEnabled ? <button onClick={() => void runAction(canReopen ? "REOPEN" : "UPDATE_PERIOD")} disabled={working !== null || !opensAt || !closesAt} className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-5 py-3 font-black text-white disabled:opacity-40 ${canReopen ? "bg-[#0b8f58] hover:bg-emerald-700" : "bg-slate-900 hover:bg-slate-800"}`}>{working === (canReopen ? "REOPEN" : "UPDATE_PERIOD") ? <Loader2 className="h-4 w-4 animate-spin" /> : canReopen ? <RotateCcw className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}{canReopen ? "Reabrir ciclo com este período" : "Salvar período"}</button> : <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">O período está bloqueado no estado atual do ciclo.</div>}</article>
      </section>

      <section className="mt-6 rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"><p className="text-xs font-black uppercase tracking-[.14em] text-[var(--brand-secondary)]">Ações controladas</p><h3 className="mt-1 text-2xl font-black text-[var(--brand-primary)]">Ciclo de vida da avaliação</h3><p className="mt-2 text-sm text-slate-500">As ações são habilitadas conforme o estado do ciclo, validadas no banco e registradas na auditoria.</p>{operations.version.status === "DRAFT" && !operations.readyToPublish && <div className="mt-4 flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-900"><AlertTriangle className="h-5 w-5 shrink-0 text-red-600" /><p><strong>Publicação protegida.</strong> Corrija {blockingIssues.length} {blockingIssues.length === 1 ? "bloqueio" : "bloqueios"} indicado{blockingIssues.length === 1 ? "" : "s"} no checklist.</p></div>}<div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <ActionButton label="Publicar versão" icon={Send} working={working === "PUBLISH"} disabled={working !== null || !operations.readyToPublish || operations.version.status === "PUBLISHED"} onClick={() => void runAction("PUBLISH")} />
        <ActionButton label="Agendar ciclo" icon={CalendarClock} working={working === "SCHEDULE"} disabled={working !== null || !operations.readyToOpen || !["DRAFT", "SCHEDULED"].includes(cycleStatus ?? "")} onClick={() => void runAction("SCHEDULE")} />
        <ActionButton label="Abrir agora" icon={Play} working={working === "OPEN"} disabled={working !== null || !operations.readyToOpen || !["DRAFT", "SCHEDULED"].includes(cycleStatus ?? "")} onClick={() => void runAction("OPEN")} />
        <ActionButton label="Encerrar ciclo" icon={CircleStop} working={working === "CLOSE"} disabled={working !== null || cycleStatus !== "OPEN"} onClick={() => void runAction("CLOSE")} danger />
        <ActionButton label="Cancelar ciclo" icon={AlertTriangle} working={working === "CANCEL"} disabled={working !== null || !["DRAFT", "SCHEDULED", "OPEN"].includes(cycleStatus ?? "")} onClick={() => void runAction("CANCEL")} danger />
      </div></section>
    </>}
  </PlatformShell>;
}

function ActionButton({ label, icon: Icon, working, disabled, onClick, danger = false }: { label: string; icon: typeof Play; working: boolean; disabled: boolean; onClick: () => void; danger?: boolean }) {
  return <button type="button" onClick={onClick} disabled={disabled} className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 font-black text-white transition disabled:cursor-not-allowed disabled:opacity-35 ${danger ? "bg-red-700 hover:bg-red-800" : "bg-[#003b70] hover:bg-[#075ea8]"}`}>{working ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}{label}</button>;
}

function issueCategoryLabel(category: Issue["category"]) {
  switch (category) {
    case "STRUCTURE": return "Estrutura";
    case "PERIOD": return "Período";
    case "AUDIENCE": return "Público";
    case "CYCLE": return "Ciclo";
    default: return "Validação";
  }
}

function ReadinessChecklist({ issues, surveyId }: { issues: Issue[]; surveyId: string }) {
  const blockingCount = issues.filter((issue) => issue.severity === "BLOCKING").length;
  const warningCount = issues.length - blockingCount;
  const hasStructuralIssue = issues.some((issue) => issue.category === "STRUCTURE");

  return (
    <article className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.14em] text-[var(--brand-secondary)]">Prontidão</p>
          <h3 className="mt-1 text-2xl font-black text-[var(--brand-primary)]">Checklist do ciclo</h3>
          {issues.length > 0 && <p className="mt-2 text-sm text-slate-500">{blockingCount} {blockingCount === 1 ? "bloqueio" : "bloqueios"} · {warningCount} {warningCount === 1 ? "aviso" : "avisos"}</p>}
        </div>
        {issues.length === 0
          ? <span className="rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-black text-emerald-800">Tudo pronto</span>
          : <span className={`rounded-full px-3 py-1.5 text-xs font-black ${blockingCount > 0 ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{blockingCount > 0 ? "Publicação protegida" : "Requer atenção"}</span>}
      </div>

      <div className="mt-5 space-y-3">
        {issues.length ? issues.map((issue, index) => (
          <div key={issue.id ?? `${issue.code}-${index}`} className={`flex gap-3 rounded-2xl border p-4 ${issue.severity === "BLOCKING" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
            <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${issue.severity === "BLOCKING" ? "text-red-600" : "text-amber-600"}`} />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-slate-900">{issue.severity === "BLOCKING" ? "Bloqueio" : "Atenção"}</strong>
                <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] font-black uppercase tracking-[.1em] text-slate-500">{issueCategoryLabel(issue.category)}</span>
              </div>
              <p className="mt-1 text-sm text-slate-700">{issue.message}</p>
              {issue.action && <p className="mt-1 text-xs font-bold text-slate-500">Próximo passo: {issue.action}</p>}
            </div>
          </div>
        )) : (
          <div className="flex gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
            <p className="text-sm font-bold text-emerald-900">A estrutura e o período estão consistentes para operação.</p>
          </div>
        )}
      </div>

      {hasStructuralIssue && <Link href={`/admin/pesquisas/${surveyId}`} className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-[#003b70] px-4 py-3 text-sm font-black text-white hover:bg-[#075ea8]">Corrigir no construtor</Link>}
    </article>
  );
}
