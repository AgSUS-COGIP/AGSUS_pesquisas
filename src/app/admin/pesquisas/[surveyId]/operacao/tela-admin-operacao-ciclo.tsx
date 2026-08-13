"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { AlertTriangle, ArrowLeft, Ban, CalendarCheck2, CheckCircle2, Clock3, Copy, Hourglass, Image as ImageIcon, Info, ListChecks, Lock, PauseCircle, PlayCircle, RotateCcw, Save, Send, ShieldCheck, SquarePen, StopCircle, Users2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { useConfirm } from "@/components/confirmation-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Dialog } from "@/components/ui/overlay-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Surface } from "@/components/ui/surface";
import { formatDateTimePtBr } from "@/lib/date-format";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { nowLocalInputValue, periodIssues, publishBlockedMessage, reopenIssue } from "@/lib/survey-cycle-period";
import { surveyStatusBadgeVariant, surveyStatusLabel } from "@/lib/survey-cycle-status";

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

/**
 * Cada ação carrega, além do rótulo, a frase que explica **o que ela faz** e a
 * que explica **por que está indisponível**. O módulo exige que o operador
 * nunca encontre só um botão apagado — ver `src/app/admin/CLAUDE.md`.
 */
type CycleAction = {
  action: string;
  label: string;
  icon: typeof Send;
  description: string;
  tone: "primary" | "secondary" | "danger";
  available: boolean;
  /** Motivo exibido quando `available` é falso. */
  blockedReason: string;
};

function toLocalInput(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

const dateLabel = (value: string | null | undefined) => formatDateTimePtBr(value, "Não definido");

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "object" && error) {
    const candidate = error as SupabaseLikeError;
    return candidate.message || candidate.details || candidate.hint || fallback;
  }
  return fallback;
}

/**
 * Os códigos do banco (`DRAFT`, `OPEN`, …) são vocabulário interno. A tela
 * mostra o rótulo em português (mapa canônico em `@/lib/survey-cycle-status`)
 * e guarda o código só como legenda técnica.
 */
const cycleStatusLabel = (status: string | undefined) => surveyStatusLabel(status);
const cycleStatusVariant = (status: string | undefined) => surveyStatusBadgeVariant(status);

function cycleExplanation(status: string | undefined) {
  switch (status) {
    case "DRAFT": return "O ciclo está em preparação. Ajuste o período antes de publicar ou abrir.";
    case "SCHEDULED": return "O ciclo está agendado. O período ainda pode ser ajustado antes da abertura.";
    case "OPEN": return "O ciclo está aberto para respostas. Para alterar o período, encerre-o primeiro.";
    case "CLOSED": return "O ciclo foi encerrado. Informe o novo encerramento e use Reabrir ciclo para receber novas respostas imediatamente.";
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
  const [stopDialogOpen, setStopDialogOpen] = useState(false);
  const periodSectionRef = useRef<HTMLDivElement>(null);
  const closesAtInputRef = useRef<HTMLInputElement>(null);

  // "Reabrir" só exige o novo encerramento (a abertura é sempre imediata) — o
  // atalho do grid de operações leva até esse campo em vez de duplicar o
  // formulário fora do card de período.
  const focusPeriodField = useCallback(() => {
    periodSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    closesAtInputRef.current?.focus();
  }, []);

  const loadOperations = useCallback(async () => {
    setDataLoading(true);
    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: operationError } = await supabase.rpc("get_survey_operations", { target_survey_id: surveyId });
      if (operationError) throw operationError;
      const next = data as Operations;
      setOperations(next);
      // Um ciclo encerrado sempre teve abertura no passado. O campo de
      // abertura nem é exibido para reabrir (a abertura passou a ser sempre
      // "agora", ver runAction) — mas o encerramento nasce vazio mesmo assim,
      // para que o operador informe um valor novo em vez do antigo.
      const isClosedCycle = next.application?.status === "CLOSED";
      setOpensAt(isClosedCycle ? "" : toLocalInput(next.application?.opensAt));
      setClosesAt(isClosedCycle ? "" : toLocalInput(next.application?.closesAt));
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

    // Um rascunho salvo semanas atrás pode chegar à publicação com o período já
    // vencido. O banco recusaria só depois, ao agendar ou abrir; aqui o operador
    // é avisado no momento em que ainda pode corrigir, com o campo já editável.
    if (action === "PUBLISH") {
      const blocked = publishBlockedMessage(opensAt, closesAt);
      if (blocked) return toast.error(blocked);
    }

    // UPDATE_PERIOD grava as duas datas; REOPEN passou a exigir só a nova
    // data de encerramento — a abertura é sempre "agora", calculada no envio.
    if (action === "UPDATE_PERIOD") {
      const issues = periodIssues(opensAt, closesAt);
      if (issues.length) return toast.error(issues[0].message);
    }
    if (action === "REOPEN") {
      const issue = reopenIssue(closesAt);
      if (issue) return toast.error(issue);
    }

    // CLOSE e CANCEL são confirmadas pelo diálogo próprio de "Parar
    // recebimento" (StopReceivingDialog), que já é a etapa de confirmação —
    // por isso não passam por `confirm()` aqui.
    const confirmations: Partial<Record<string, string>> = {
      PUBLISH: "Publicar esta versão? Depois de publicada, a estrutura não poderá ser alterada.",
      OPEN: "Abrir este ciclo agora para receber respostas?",
      REOPEN: "Reabrir este ciclo agora com o novo encerramento informado? A abertura será imediata.",
    };
    const confirmation = confirmations[action];
    if (confirmation && !(await confirm({ title: "Confirmar operação do ciclo?", description: confirmation, confirmLabel: "Continuar", tone: "primary" }))) return;

    const sendsPeriod = action === "UPDATE_PERIOD" || action === "REOPEN";
    setWorking(action);
    try {
      const supabase = createBrowserSupabaseClient();
      // REOPEN nunca usa o estado `opensAt` (não há mais campo de abertura
      // nesse fluxo): a tela envia `null` e o banco resolve a abertura como
      // `now()` do servidor — calcular "agora" aqui deixaria o resultado
      // refém do relógio da estação do operador (adiantado, gravaria
      // SCHEDULED em silêncio, e nada promove SCHEDULED a OPEN sozinho).
      const { error: actionError } = await supabase.rpc("manage_survey_cycle", {
        target_survey_id: surveyId,
        target_action: action,
        target_opens_at: action === "REOPEN"
          ? null
          : (sendsPeriod && opensAt ? new Date(opensAt).toISOString() : null),
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

  // STOP e REOPEN não rodam a RPC direto a partir do card: abrem, respectivamente,
  // o diálogo de escolha e o campo de período — daí ficarem fora de `runAction`.
  function activateCycleAction(action: string) {
    if (action === "STOP") return setStopDialogOpen(true);
    if (action === "REOPEN") return focusPeriodField();
    void runAction(action);
  }

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="propriedades do ciclo"
      restrictedTitle="Operação de ciclos restrita"
      restrictedDescription="Seu perfil não possui permissão para operar ciclos de avaliação."
    />;
  }

  const cycleStatus = operations?.application?.status;
  const versionStatus = operations?.version.status;
  const canEditPeriod = cycleStatus === "DRAFT" || cycleStatus === "SCHEDULED";
  const canReopen = cycleStatus === "CLOSED";
  const fieldsEnabled = canEditPeriod || canReopen;
  const minDateTime = nowLocalInputValue();
  const currentPeriodIssues = periodIssues(opensAt, closesAt);
  // REOPEN só pede o novo encerramento — a abertura é sempre "agora" (ver
  // runAction) — então sua validação é `reopenIssue`, não `periodIssues`.
  const reopenClosesIssue = canReopen ? reopenIssue(closesAt) : null;
  const opensAtIssue = canEditPeriod ? currentPeriodIssues.find((issue) => issue.field === "opensAt")?.message : undefined;
  const closesAtIssue = canReopen
    ? reopenClosesIssue ?? undefined
    : canEditPeriod ? currentPeriodIssues.find((issue) => issue.field === "closesAt")?.message : undefined;
  const blockingIssues = operations?.issues.filter((issue) => issue.severity === "BLOCKING") ?? [];
  // Campo vazio não conta como "alteração não salva" — é apenas ausência de
  // data ainda não informada, já coberta pelo aviso abaixo do botão. Em
  // REOPEN só o encerramento importa (não há mais campo de abertura).
  const periodDirty = canReopen
    ? Boolean(operations) && Boolean(closesAt) && closesAt !== toLocalInput(operations?.application?.closesAt)
    : Boolean(operations) && Boolean(opensAt) && Boolean(closesAt)
      && (opensAt !== toLocalInput(operations?.application?.opensAt) || closesAt !== toLocalInput(operations?.application?.closesAt));

  // O motivo de indisponibilidade é calculado uma vez por ação: a mesma frase
  // alimenta o `title`, o `aria-describedby` e a nota abaixo do botão.
  const cycleActions: CycleAction[] = operations ? [
    {
      action: "PUBLISH",
      label: "Publicar versão",
      icon: Send,
      description: "Congela a estrutura da versão e a torna a definitiva deste ciclo.",
      tone: "primary",
      available: operations.readyToPublish && versionStatus !== "PUBLISHED",
      blockedReason: versionStatus === "PUBLISHED"
        ? "Esta versão já está publicada."
        : `Resolva ${blockingIssues.length} ${blockingIssues.length === 1 ? "bloqueio" : "bloqueios"} do checklist antes de publicar.`,
    },
    {
      action: "SCHEDULE",
      label: "Agendar abertura",
      icon: CalendarCheck2,
      description: "Deixa o ciclo pronto para abrir sozinho na data de abertura informada.",
      tone: "secondary",
      available: operations.readyToOpen && ["DRAFT", "SCHEDULED"].includes(cycleStatus ?? ""),
      blockedReason: ["DRAFT", "SCHEDULED"].includes(cycleStatus ?? "")
        ? "O checklist ainda aponta pendências que impedem a abertura."
        : `Só é possível agendar um ciclo em rascunho ou já agendado — este está ${cycleStatusLabel(cycleStatus).toLocaleLowerCase("pt-BR")}.`,
    },
    {
      action: "OPEN",
      label: "Abrir para respostas",
      icon: PlayCircle,
      description: "Libera o formulário imediatamente para as pessoas vinculadas ao ciclo.",
      tone: "primary",
      available: operations.readyToOpen && ["DRAFT", "SCHEDULED"].includes(cycleStatus ?? ""),
      blockedReason: ["DRAFT", "SCHEDULED"].includes(cycleStatus ?? "")
        ? "O checklist ainda aponta pendências que impedem a abertura."
        : `Só é possível abrir um ciclo em rascunho ou agendado — este está ${cycleStatusLabel(cycleStatus).toLocaleLowerCase("pt-BR")}.`,
    },
    {
      action: "STOP",
      label: "Parar recebimento",
      icon: StopCircle,
      description: "Escolha entre encerrar (pode reabrir depois) ou cancelar em definitivo este ciclo.",
      tone: "danger",
      available: ["DRAFT", "SCHEDULED", "OPEN"].includes(cycleStatus ?? ""),
      blockedReason: cycleStatus === "CANCELLED"
        ? "Este ciclo já foi cancelado."
        : "Um ciclo encerrado não precisa parar de receber respostas.",
    },
    {
      action: "REOPEN",
      label: "Reabrir ciclo",
      icon: RotateCcw,
      description: "Informe o novo encerramento no card abaixo para reabrir o ciclo agora e voltar a receber respostas.",
      tone: "primary",
      available: cycleStatus === "CLOSED",
      blockedReason: "Só um ciclo encerrado pode ser reaberto.",
    },
  ] : [];

  // Link direto para responder: CDDI tem jornada própria; o restante usa o
  // runtime genérico por código de aplicação. Quem abrir o link entra pelo
  // login institucional e o banco (RLS) decide se pode responder.
  const responseLink = operations?.application
    ? operations.survey.code === "CDDI"
      ? "/cddi"
      : `/pesquisas/${encodeURIComponent(operations.application.code)}`
    : null;

  return <PlatformShell
    user={guard.user}
    eyebrow="Administração · Propriedades"
    title={operations?.survey.name ?? "Propriedades do ciclo"}
  >
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      {/* Navegação da rota no topo do conteúdo: as ações que levam para outra
          página ficam junto do que elas afetam, e não na barra da casca, que é
          da aplicação. Fica fora do bloco de carregamento para que a saída da
          tela exista antes dos dados. */}
      <nav aria-label="Ações da avaliação" className="flex flex-wrap items-center gap-2">
        <Link
          href="/admin/pesquisas"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
          title="Voltar ao catálogo de avaliações"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Voltar ao catálogo
        </Link>
        {responseLink && (
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}${responseLink}`;
              if (!navigator.clipboard) { toast.error(`Copie o link manualmente: ${url}`); return; }
              void navigator.clipboard.writeText(url).then(
                () => toast.success("Link de resposta copiado. Quem abrir entra pelo login institucional."),
                () => toast.error(`Não foi possível copiar. Link: ${url}`),
              );
            }}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
            title="Copiar o link direto para responder esta avaliação"
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            Copiar link
          </button>
        )}
        {operations?.application?.id && (
          <Link
            href={`/admin/pesquisas/${surveyId}/identidade`}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[var(--brand-solid)] px-4 text-sm font-semibold text-[var(--text-on-brand)] shadow-sm transition hover:bg-[var(--brand-solid-hover)]"
            title="Editar título e subtítulo da capa da avaliação"
          >
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            Editar identidade visual
          </Link>
        )}
      </nav>

      {dataLoading || !operations ? <OperationsSkeleton /> : <>
        <PageHeader
          eyebrow={`${operations.survey.code} · Ciclo ${operations.application?.code ?? "não configurado"}`}
          title="Propriedades do ciclo"
          description="Publique a versão, defina o período de resposta e controle a abertura e o encerramento. Toda operação é validada no banco e registrada em auditoria."
          actions={<>
            <Badge variant={cycleStatusVariant(cycleStatus)} title={`Código interno do ciclo: ${cycleStatus ?? "—"}`}>
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Ciclo {cycleStatusLabel(cycleStatus).toLocaleLowerCase("pt-BR")}
            </Badge>
          </>}
        />

        <section aria-label="Números do ciclo" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={ListChecks} label="Estrutura" value={`${operations.metrics.sections} / ${operations.metrics.questions}`} description={`${operations.metrics.sections === 1 ? "seção" : "seções"} e ${operations.metrics.questions === 1 ? "pergunta" : "perguntas"} · ${operations.metrics.requiredQuestions} ${operations.metrics.requiredQuestions === 1 ? "obrigatória" : "obrigatórias"}`} />
          <MetricCard icon={Users2} label="Participantes" value={operations.metrics.participants} description={operations.metrics.participants ? "pessoas vinculadas a este ciclo" : "nenhuma pessoa vinculada ainda"} href="/admin/participantes" hrefLabel="Gerenciar público" />
          <MetricCard icon={Clock3} label="Em preenchimento" value={operations.metrics.draftSubmissions} description="respostas iniciadas e ainda não enviadas" />
          <MetricCard icon={CheckCircle2} label="Respostas enviadas" value={operations.metrics.submittedSubmissions} description="submissões concluídas e registradas" tone="success" />
        </section>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.05fr]">
          <ReadinessChecklist issues={operations.issues} surveyId={surveyId} />

          <Surface className="p-6">
            <div ref={periodSectionRef} className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Período de resposta</p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">Quando o formulário fica disponível</h3>
              </div>
              {fieldsEnabled
                ? <Badge variant="info"><SquarePen className="h-3.5 w-3.5" aria-hidden="true" />Editável</Badge>
                : <Badge variant="neutral"><Lock className="h-3.5 w-3.5" aria-hidden="true" />Bloqueado</Badge>}
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{cycleExplanation(cycleStatus)}</p>

            <div className={`mt-5 grid gap-4 ${canReopen ? "" : "sm:grid-cols-2"}`}>
              {!canReopen && (
                <PeriodField
                  id="periodo-abertura"
                  label="Abertura"
                  hint="A partir deste momento o formulário aceita respostas."
                  value={opensAt}
                  min={minDateTime}
                  disabled={!fieldsEnabled}
                  error={opensAtIssue}
                  onChange={setOpensAt}
                />
              )}
              <PeriodField
                id="periodo-encerramento"
                inputRef={closesAtInputRef}
                label="Encerramento"
                hint={canReopen ? "A abertura é sempre imediata; depois deste momento nenhuma resposta nova é aceita." : "Depois deste momento nenhuma resposta nova é aceita."}
                value={closesAt}
                min={canReopen ? minDateTime : (opensAt || minDateTime)}
                disabled={!fieldsEnabled}
                error={closesAtIssue}
                onChange={setClosesAt}
              />
            </div>

            <dl className="mt-5 grid gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--text-secondary)]">Abertura registrada</dt>
                <dd className="mt-1 font-semibold text-[var(--text-primary)]">{dateLabel(operations.application?.opensAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--text-secondary)]">Encerramento registrado</dt>
                <dd className="mt-1 font-semibold text-[var(--text-primary)]">{dateLabel(operations.application?.closesAt)}</dd>
              </div>
            </dl>

            {fieldsEnabled ? <>
              {periodDirty && <p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-xs font-semibold leading-5 text-[var(--status-warning-text)]">
                <Info className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                Alterações ainda não salvas. {canReopen ? "Use Reabrir ciclo agora para aplicá-las." : "Salve o período para aplicá-las."}
              </p>}
              <Button
                fullWidth
                size="lg"
                className="mt-4"
                variant={canReopen ? "primary" : "secondary"}
                onClick={() => void runAction(canReopen ? "REOPEN" : "UPDATE_PERIOD")}
                disabled={working !== null || (canReopen ? (!closesAt || Boolean(reopenClosesIssue)) : (!opensAt || !closesAt || currentPeriodIssues.length > 0))}
                title={canReopen ? "Reabre o ciclo encerrado agora, com o novo encerramento" : "Grava o período sem alterar o estado do ciclo"}
              >
                {working === (canReopen ? "REOPEN" : "UPDATE_PERIOD")
                  ? <Hourglass className="h-5 w-5 animate-pulse" aria-hidden="true" />
                  : canReopen ? <RotateCcw className="h-5 w-5" aria-hidden="true" /> : <Save className="h-5 w-5" aria-hidden="true" />}
                {canReopen ? "Reabrir ciclo agora" : "Salvar período"}
              </Button>
              {canReopen
                ? (!closesAt && <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">Informe o novo encerramento para habilitar a reabertura.</p>)
                : ((!opensAt || !closesAt) && <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">Informe as duas datas para habilitar a gravação.</p>)}
            </> : <p className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {cycleStatus === "OPEN"
                ? "Com o ciclo aberto o período não pode mudar. Encerre o recebimento para editá-lo e reabrir com uma nova data."
                : "O período não pode ser alterado enquanto o ciclo estiver neste estado."}
            </p>}
          </Surface>
        </div>

        <Surface className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Ciclo de vida</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">Operações disponíveis</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Cada operação depende do estado atual. Quando estiver indisponível, o motivo aparece logo abaixo do botão.</p>
            </div>
          </div>

          {versionStatus === "DRAFT" && !operations.readyToPublish && <p role="status" className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-4 text-sm leading-6 text-[var(--status-danger-text)]">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
            <span><strong className="font-semibold">Publicação protegida.</strong> Corrija {blockingIssues.length} {blockingIssues.length === 1 ? "bloqueio indicado" : "bloqueios indicados"} no checklist antes de publicar esta versão.</span>
          </p>}

          <ul className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {cycleActions.map((item) => <li key={item.action}>
              <ActionCard item={item} working={working === item.action} busy={working !== null} onRun={() => activateCycleAction(item.action)} />
            </li>)}
          </ul>
        </Surface>
      </>}
    </div>

    <StopReceivingDialog
      open={stopDialogOpen}
      onOpenChange={setStopDialogOpen}
      canClose={cycleStatus === "OPEN"}
      canCancel={["DRAFT", "SCHEDULED", "OPEN"].includes(cycleStatus ?? "")}
      busy={working !== null}
      onClose={() => { setStopDialogOpen(false); void runAction("CLOSE"); }}
      onCancel={() => { setStopDialogOpen(false); void runAction("CANCEL"); }}
    />
  </PlatformShell>;
}

/**
 * Reúne "encerrar" (reversível, só com ciclo aberto) e "cancelar" (definitivo,
 * a partir de rascunho, agendado ou aberto) num único fluxo, para que o
 * operador escolha explicitamente entre as duas em vez de decifrar dois
 * botões com ícones quase idênticos.
 */
function StopReceivingDialog({ open, onOpenChange, canClose, canCancel, busy, onClose, onCancel }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canClose: boolean;
  canCancel: boolean;
  busy: boolean;
  onClose: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Parar recebimento de respostas"
      description="Escolha o que acontece com este ciclo. As duas opções impedem novos envios; a diferença é se o ciclo continua existindo."
    >
      <div className="space-y-3">
        <button
          type="button"
          disabled={!canClose || busy}
          onClick={onClose}
          className="flex w-full items-start gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-left transition hover:border-[var(--border-strong)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <PauseCircle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--text-secondary)]" aria-hidden="true" />
          <span>
            <strong className="block text-sm font-semibold text-[var(--text-primary)]">Encerrar recebimento</strong>
            <span className="mt-1 block text-sm leading-6 text-[var(--text-secondary)]">
              {canClose
                ? "Para novos envios agora. O ciclo continua existindo e pode ser reaberto depois com um novo período."
                : "Só um ciclo aberto pode ser encerrado."}
            </span>
          </span>
        </button>

        <button
          type="button"
          disabled={!canCancel || busy}
          onClick={onCancel}
          className="flex w-full items-start gap-3 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-4 text-left transition hover:border-[var(--status-danger-text)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Ban className="mt-0.5 h-5 w-5 shrink-0 text-[var(--status-danger-text)]" aria-hidden="true" />
          <span>
            <strong className="block text-sm font-semibold text-[var(--status-danger-text)]">Cancelar em definitivo</strong>
            <span className="mt-1 block text-sm leading-6 text-[var(--status-danger-text)]">
              {canCancel
                ? "Anula o ciclo por completo. Não há retomada — seria preciso criar outro ciclo."
                : "Este ciclo já foi encerrado ou cancelado; não há mais o que cancelar."}
            </span>
          </span>
        </button>
      </div>
    </Dialog>
  );
}

function OperationsSkeleton() {
  return (
    <div className="space-y-6" aria-live="polite" aria-busy="true">
      <span className="sr-only">Carregando as propriedades do ciclo.</span>
      <Skeleton className="h-24 w-full rounded-2xl" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-32 rounded-2xl" />)}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, description, tone = "neutral", href, hrefLabel }: {
  icon: typeof Users2;
  label: string;
  value: number | string;
  description: string;
  tone?: "neutral" | "success";
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <article className="flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-2">
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tone === "success" ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]" : "bg-[var(--surface-muted)] text-[var(--brand-primary)]"}`}>
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--text-secondary)]">{label}</p>
      </div>
      <strong className="mt-3 block text-3xl font-semibold tracking-tight text-[var(--brand-primary)]">{value}</strong>
      <p className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{description}</p>
      {href && hrefLabel && (
        <Link href={href} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-primary)] hover:underline">
          {hrefLabel}
          <ArrowLeft className="h-3.5 w-3.5 rotate-180" aria-hidden="true" />
        </Link>
      )}
    </article>
  );
}

function PeriodField({ id, label, hint, value, min, disabled, error, onChange, inputRef }: {
  id: string;
  label: string;
  hint: string;
  value: string;
  min: string;
  disabled: boolean;
  error?: string;
  onChange: (value: string) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-erro`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-[var(--text-primary)]">{label}</label>
      <p id={hintId} className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{hint}</p>
      <input
        id={id}
        ref={inputRef}
        type="datetime-local"
        value={value}
        min={min}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        onChange={(event) => onChange(event.target.value)}
        className={`mt-2 w-full rounded-xl border bg-[var(--control-bg)] px-3.5 py-3 text-sm font-medium text-[var(--text-primary)] shadow-sm outline-none transition hover:border-[var(--border-strong)] focus:border-[var(--focus-ring)] focus:ring-4 focus:ring-sky-300/15 disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] disabled:text-[var(--text-secondary)] ${error ? "border-red-500" : "border-[var(--border-subtle)]"}`}
      />
      {error && <p id={errorId} className="mt-2 flex items-start gap-1.5 text-xs font-semibold leading-5 text-red-700">
        <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        {error}
      </p>}
    </div>
  );
}

/**
 * Botão de operação com a explicação sempre visível — o que a ação faz quando
 * está disponível, por que não está quando indisponível.
 */
function ActionCard({ item, working, busy, onRun }: { item: CycleAction; working: boolean; busy: boolean; onRun: () => void }) {
  const Icon = item.icon;
  const noteId = `acao-${item.action}-nota`;
  const disabled = busy || !item.available;

  return (
    <div className={`flex h-full flex-col rounded-2xl border p-4 transition ${item.available ? "border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--border-strong)]" : "border-dashed border-[var(--border-subtle)] bg-[var(--surface-muted)]"}`}>
      <Button
        fullWidth
        variant={item.tone}
        onClick={onRun}
        disabled={disabled}
        aria-describedby={noteId}
        title={item.available ? item.description : item.blockedReason}
      >
        {working ? <Hourglass className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
        {working ? "Processando..." : item.label}
      </Button>
      <p id={noteId} className={`mt-3 flex items-start gap-1.5 text-xs leading-5 ${item.available ? "text-[var(--text-secondary)]" : "font-semibold text-[var(--text-secondary)]"}`}>
        {item.available
          ? <Info className="mt-px h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
          : <Lock className="mt-px h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />}
        {item.available ? item.description : item.blockedReason}
      </p>
    </div>
  );
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

/** Rota que resolve cada categoria de pendência, para o atalho "Corrigir". */
function issueFixHref(category: Issue["category"], surveyId: string) {
  switch (category) {
    case "STRUCTURE": return { href: `/admin/pesquisas/${surveyId}`, label: "Abrir construtor" };
    case "AUDIENCE": return { href: "/admin/participantes", label: "Gerenciar público" };
    default: return null;
  }
}

function ReadinessChecklist({ issues, surveyId }: { issues: Issue[]; surveyId: string }) {
  const blockingCount = issues.filter((issue) => issue.severity === "BLOCKING").length;
  const warningCount = issues.length - blockingCount;

  return (
    <Surface className="flex flex-col p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Prontidão</p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">Checklist antes de publicar</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            {issues.length === 0
              ? "Nenhuma pendência: a estrutura e o período estão consistentes."
              : `${blockingCount} ${blockingCount === 1 ? "bloqueio" : "bloqueios"} · ${warningCount} ${warningCount === 1 ? "aviso" : "avisos"}. Bloqueios impedem a publicação; avisos apenas alertam.`}
          </p>
        </div>
        {issues.length === 0
          ? <Badge variant="success"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />Tudo pronto</Badge>
          : <Badge variant={blockingCount > 0 ? "danger" : "warning"}>
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              {blockingCount > 0 ? "Publicação protegida" : "Requer atenção"}
            </Badge>}
      </div>

      <div className="mt-5 flex-1 space-y-3">
        {issues.length ? issues.map((issue, index) => {
          const blocking = issue.severity === "BLOCKING";
          const fix = issueFixHref(issue.category, surveyId);
          return (
            <article
              key={issue.id ?? `${issue.code}-${index}`}
              className={`rounded-xl border p-4 ${blocking
                ? "border-[var(--status-danger-border)] bg-[var(--status-danger-bg)]"
                : "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]"}`}
            >
              <div className="flex gap-3">
                <AlertTriangle className={`mt-0.5 h-5 w-5 shrink-0 ${blocking ? "text-[var(--status-danger-text)]" : "text-[var(--status-warning-text)]"}`} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className={`text-sm font-semibold ${blocking ? "text-[var(--status-danger-text)]" : "text-[var(--status-warning-text)]"}`}>
                      {blocking ? "Bloqueio" : "Atenção"}
                    </strong>
                    <Badge variant="outline">{issueCategoryLabel(issue.category)}</Badge>
                  </div>
                  <p className={`mt-2 text-sm leading-6 ${blocking ? "text-[var(--status-danger-text)]" : "text-[var(--status-warning-text)]"}`}>{issue.message}</p>
                  {issue.action && <p className="mt-1 text-xs font-semibold leading-5 text-[var(--text-secondary)]">Próximo passo: {issue.action}</p>}
                  {fix && (
                    <Link
                      href={fix.href}
                      className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-3 text-xs font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]"
                    >
                      <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                      {fix.label}
                    </Link>
                  )}
                </div>
              </div>
            </article>
          );
        }) : (
          <EmptyState
            className="border-[var(--status-success-border)] bg-[var(--status-success-bg)]"
            icon={<CheckCircle2 className="h-6 w-6 text-[var(--status-success-text)]" aria-hidden="true" />}
            title="Pronto para operar"
            description="A validação do banco não encontrou pendências de estrutura, período ou público neste ciclo."
          />
        )}
      </div>
    </Surface>
  );
}
