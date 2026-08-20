"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { AlertCircle, AlertTriangle, ArrowLeft, Ban, CalendarCheck2, CheckCircle2, CircleSlash, Clock3, Copy, FileStack, Hourglass, Image as ImageIcon, Info, ListChecks, Lock, Mail, PlayCircle, RotateCcw, Save, Send, ShieldCheck, SquarePen, Users2, Wrench } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { useConfirm } from "@/components/confirmation-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/form-controls";
import { Dialog } from "@/components/ui/overlay-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, Surface } from "@/components/ui/surface";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { errorMessageFromUnknown } from "@/lib/observability";
import { definirNotificacaoEmail, executarAcaoDoCiclo, obterOperacaoDoCiclo } from "@/lib/api/cliente-construtor";
import type { OperacaoCiclo, PendenciaCiclo } from "@/lib/api/contratos-construtor";
import { nowLocalInputValue, opensInFuture, periodIssues, publishBlockedMessage } from "@/lib/survey-cycle-period";
import { cycleStatusLabel, versionStatusLabel } from "@/lib/survey-status-labels";

// O formato do agregado passou a vir do contrato da API, e não de uma cópia
// local — é o mesmo retorno de `get_survey_operations` que a rota repassa.
type Issue = PendenciaCiclo;
type Operations = OperacaoCiclo;

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
  tone: "primary" | "secondary" | "danger" | "danger-soft";
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

function dateLabel(value: string | null | undefined) {
  if (!value) return "Não definido";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

/**
 * Os códigos do banco (`DRAFT`, `OPEN`, …) são vocabulário interno. A tela
 * mostra o rótulo em português e guarda o código só como legenda técnica.
 */

function cycleStatusVariant(status: string | undefined) {
  switch (status) {
    case "OPEN": return "success" as const;
    case "SCHEDULED": return "info" as const;
    case "CLOSED": return "neutral" as const;
    case "CANCELLED": return "danger" as const;
    case "DRAFT": return "warning" as const;
    default: return "outline" as const;
  }
}

function cycleExplanation(status: string | undefined) {
  switch (status) {
    case "DRAFT": return "O ciclo está em preparação. Ajuste o período antes de publicar ou abrir.";
    case "SCHEDULED": return "O ciclo está agendado e abre sozinho na data de abertura. O período ainda pode ser ajustado antes disso.";
    case "OPEN": return "O ciclo está aberto para respostas. Para alterar o período, encerre-o primeiro.";
    case "CLOSED": return "O ciclo foi encerrado. Informe um novo período e use Reabrir ciclo para receber novas respostas.";
    case "CANCELLED": return "O ciclo foi cancelado e não pode ser retomado. Crie um novo ciclo para esta avaliação.";
    default: return "Configure o período e o estado operacional deste ciclo.";
  }
}

/**
 * A consequência do período, em uma frase — o que o cartão de datas não dizia.
 *
 * O bloco de datas registradas repetia o valor dos campos logo acima. Com a
 * abertura automática, o que o operador precisa ler ali é o desfecho: se o
 * ciclo abre sozinho, se já está recebendo resposta, ou se ninguém vai abri-lo.
 */
function periodOutcome(
  status: string | undefined,
  versionStatus: string | undefined,
  opensAt: string | null | undefined,
  closesAt: string | null | undefined,
) {
  switch (status) {
    case "DRAFT":
      return versionStatus === "PUBLISHED"
        ? "Em rascunho, o ciclo não abre sozinho. Agende a abertura ou use Abrir agora."
        : "Enquanto a versão não for publicada, o ciclo não abre — nem sozinho, nem pela mão do operador.";
    case "SCHEDULED":
      return opensAt
        ? `Abre automaticamente em ${dateLabel(opensAt)} e encerra em ${dateLabel(closesAt)}.`
        : "Agendado sem data de abertura. Informe o período para que a abertura aconteça.";
    case "OPEN":
      return `Recebendo respostas desde ${dateLabel(opensAt)}. Encerra em ${dateLabel(closesAt)}.`;
    case "CLOSED":
      return "Encerrado: nenhuma resposta nova é aceita. Informe um novo período para reabrir.";
    case "CANCELLED":
      return "Finalizado. Este ciclo não volta a receber respostas.";
    default:
      return null;
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
  const [interruptDialogOpen, setInterruptDialogOpen] = useState(false);

  const loadOperations = useCallback(async () => {
    setDataLoading(true);
    try {
      const next = await obterOperacaoDoCiclo(surveyId);
      setOperations(next);
      setOpensAt(toLocalInput(next.application?.opensAt));
      setClosesAt(toLocalInput(next.application?.closesAt));
    } catch (loadError) {
      toast.error(errorMessageFromUnknown(loadError));
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

    // Período gravado passa pela mesma regra do banco antes de sair da tela.
    // SCHEDULE entrou nesta lista porque passou a gravar o período junto.
    if (action === "UPDATE_PERIOD" || action === "REOPEN" || action === "SCHEDULE") {
      const issues = periodIssues(opensAt, closesAt);
      if (issues.length) return toast.error(issues[0].message);
    }

    const confirmations: Partial<Record<string, string>> = {
      PUBLISH: "Publicar esta versão? Depois de publicada, a estrutura não poderá ser alterada.",
      OPEN: "Abrir este ciclo agora para receber respostas?",
      REOPEN: "Reabrir este ciclo com o novo período informado?",
      CLOSE: "Pausar esta avaliação agora? Ela pode ser reaberta depois com um novo período.",
      CANCEL: "Finalizar esta avaliação agora? O ciclo é encerrado e a avaliação vai para \"Avaliações arquivadas\", por até 30 dias.",
    };
    const confirmation = confirmations[action];
    if (confirmation && !(await confirm({ title: "Confirmar operação do ciclo?", description: confirmation, confirmLabel: action === "CANCEL" || action === "CLOSE" ? "Confirmar operação" : "Continuar", tone: action === "CANCEL" || action === "CLOSE" ? "danger" : "primary" }))) return;

    const sendsPeriod = action === "UPDATE_PERIOD" || action === "REOPEN" || action === "SCHEDULE";
    setWorking(action);
    try {
      await executarAcaoDoCiclo(surveyId, {
        action,
        // O período sai da tela já em ISO (UTC): o `datetime-local` é hora
        // local, e a conversão precisa acontecer onde o fuso do operador é
        // conhecido — no navegador. A rota repassa o valor sem reinterpretá-lo.
        opensAt: sendsPeriod && opensAt ? new Date(opensAt).toISOString() : null,
        closesAt: sendsPeriod && closesAt ? new Date(closesAt).toISOString() : null,
      });
      const successLabels: Record<string, string> = {
        UPDATE_PERIOD: "Período atualizado.", PUBLISH: "Versão publicada.", SCHEDULE: "Abertura agendada. O ciclo abre sozinho na data marcada.", OPEN: "Ciclo aberto.", REOPEN: "Ciclo reaberto.", CLOSE: "Avaliação pausada.", CANCEL: "Avaliação finalizada e arquivada.",
      };
      toast.success(successLabels[action] ?? "Operação concluída.");
      await loadOperations();
    } catch (actionError) {
      toast.error(errorMessageFromUnknown(actionError));
    } finally {
      setWorking(null);
    }
  }

  // "Interromper avaliação" abre um pop-up próprio porque, ao contrário das
  // demais operações, ela não tem uma única ação de banco: o operador escolhe
  // entre CLOSE (pausa, reversível) e CANCEL (finaliza, definitivo). A escolha
  // ainda passa pela confirmação binária de `runAction`, que é quem de fato
  // dispara a RPC.
  async function runInterruptChoice(action: "CLOSE" | "CANCEL") {
    setInterruptDialogOpen(false);
    await runAction(action);
  }

  async function toggleEmailNotifications(next: boolean) {
    setWorking("EMAIL_NOTIFICATIONS");
    try {
      await definirNotificacaoEmail(surveyId, next);
      const status = operations?.application?.status;
      toast.success(!next
        ? "Envio de e-mails desligado. Nenhum e-mail automático será enviado."
        : status === "OPEN"
          ? "Envio ligado. O aviso de abertura foi colocado em processamento."
          : status === "SCHEDULED"
            ? "Envio ligado. O ciclo ainda está agendado; nenhum e-mail é enviado antes da abertura."
            : "Envio ligado. Os avisos começarão quando o ciclo for aberto.");
      await loadOperations();
    } catch (toggleError) {
      toast.error(errorMessageFromUnknown(toggleError));
    } finally {
      setWorking(null);
    }
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
  const opensAtIssue = fieldsEnabled ? currentPeriodIssues.find((issue) => issue.field === "opensAt")?.message : undefined;
  const closesAtIssue = fieldsEnabled ? currentPeriodIssues.find((issue) => issue.field === "closesAt")?.message : undefined;
  const blockingIssues = operations?.issues.filter((issue) => issue.severity === "BLOCKING") ?? [];
  const periodDirty = Boolean(operations) && (opensAt !== toLocalInput(operations?.application?.opensAt) || closesAt !== toLocalInput(operations?.application?.closesAt));

  // O agendamento mora aqui, e não na grade de operações: ele não tem dado
  // próprio — toda a informação está nos campos de data logo acima. Gravar um
  // período futuro num ciclo pronto para abrir **é** agendar a abertura, numa
  // chamada só (`SCHEDULE` passou a aceitar as datas). Fora dessas condições o
  // botão continua apenas gravando o período.
  //
  // `readyToOpen` já implica versão publicada e encerramento no futuro, então
  // não há o que repetir aqui.
  const canSchedule = (operations?.readyToOpen ?? false)
    && ["DRAFT", "SCHEDULED"].includes(cycleStatus ?? "")
    && opensInFuture(opensAt);

  // O checkbox de e-mails segue a regra da administração: indisponível nunca é
  // só um controle apagado — o motivo aparece junto. Sem participantes ele não
  // liga (não haveria destinatário), mas continua podendo ser desligado.
  const emailNotificationsEnabled = operations?.application?.emailNotifications ?? false;
  const emailNotificationsBlockedReason = !operations?.application
    ? "O ciclo de aplicação ainda não foi criado."
    : operations.metrics.participants === 0 && !emailNotificationsEnabled
      ? "Vincule participantes ao ciclo para habilitar o envio — hoje não há destinatário."
      : null;
  const emailNotificationDescription = !emailNotificationsEnabled
    ? "Nenhum e-mail automático é enviado enquanto a opção estiver desmarcada."
    : cycleStatus === "OPEN"
      ? `${operations?.metrics.participants ?? 0} ${operations?.metrics.participants === 1 ? "participante vinculado receberá" : "participantes vinculados receberão"} os avisos deste ciclo no e-mail institucional.`
      : cycleStatus === "SCHEDULED"
        ? "O envio está habilitado, mas o aviso de abertura só entra na fila quando o ciclo abrir."
        : "O envio está habilitado, mas nenhum aviso é enviado enquanto o ciclo não estiver aberto.";
  const scheduledWindowMilliseconds = operations?.application?.opensAt && operations.application.closesAt
    ? new Date(operations.application.closesAt).getTime() - new Date(operations.application.opensAt).getTime()
    : null;
  const scheduledEmailWindowIsShort = cycleStatus === "SCHEDULED"
    && scheduledWindowMilliseconds !== null
    && scheduledWindowMilliseconds < 24 * 60 * 60 * 1000;

  const periodAction = canReopen ? "REOPEN" : canSchedule ? "SCHEDULE" : "UPDATE_PERIOD";
  const periodActionLabel = {
    REOPEN: "Reabrir ciclo com este período",
    SCHEDULE: "Salvar e agendar abertura",
    UPDATE_PERIOD: "Salvar período",
  }[periodAction];
  const periodActionTitle = {
    REOPEN: "Reabre o ciclo encerrado com o novo período",
    SCHEDULE: "Grava o período e deixa o ciclo pronto para abrir sozinho na data de abertura",
    UPDATE_PERIOD: "Grava o período sem alterar o estado do ciclo",
  }[periodAction];
  const PeriodActionIcon = { REOPEN: RotateCcw, SCHEDULE: CalendarCheck2, UPDATE_PERIOD: Save }[periodAction];
  const outcome = periodOutcome(cycleStatus, versionStatus, operations?.application?.opensAt, operations?.application?.closesAt);

  // O motivo de indisponibilidade é calculado uma vez por ação: a mesma frase
  // alimenta o `title`, o `aria-describedby` e a nota abaixo do botão.
  const cycleActions: CycleAction[] = operations ? [
    // Ver `runInterruptChoice` e o `<Dialog>` de escolha — "Interromper avaliação"
    // não roda direto: abre o pop-up entre Pausar e Finalizar.
    {
      action: "PUBLISH",
      label: "Publicar versão",
      icon: Send,
      description: "Congela a estrutura da versão e a torna a definitiva deste ciclo.",
      tone: "primary",
      available: operations.readyToPublish && versionStatus !== "PUBLISHED",
      blockedReason: versionStatus === "PUBLISHED"
        ? `A versão ${operations.version.number} já está publicada.`
        : `Resolva ${blockingIssues.length} ${blockingIssues.length === 1 ? "bloqueio" : "bloqueios"} do checklist antes de publicar.`,
    },
    // "Agendar abertura" saiu daqui: virou o desfecho do cartão de período, ao
    // lado da data que o alimenta. Ver `periodAction`.
    {
      action: "OPEN",
      label: "Abrir agora",
      icon: PlayCircle,
      description: "Antecipa a abertura: libera o formulário imediatamente, sem esperar a data agendada.",
      tone: "primary",
      available: operations.readyToOpen && ["DRAFT", "SCHEDULED"].includes(cycleStatus ?? ""),
      blockedReason: ["DRAFT", "SCHEDULED"].includes(cycleStatus ?? "")
        ? "O checklist ainda aponta pendências que impedem a abertura."
        : `Só é possível abrir um ciclo em rascunho ou agendado — este está ${cycleStatusLabel(cycleStatus).toLocaleLowerCase("pt-BR")}.`,
    },
    {
      action: "INTERRUPT",
      label: "Interromper avaliação",
      icon: AlertCircle,
      description: "Abre a escolha entre pausar (reversível) ou finalizar este ciclo, arquivando a avaliação.",
      tone: "danger-soft",
      available: ["DRAFT", "SCHEDULED", "OPEN"].includes(cycleStatus ?? ""),
      blockedReason: cycleStatus === "CANCELLED"
        ? "Este ciclo já foi cancelado."
        : "Um ciclo encerrado não precisa ser interrompido.",
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
            <Badge variant={versionStatus === "PUBLISHED" ? "success" : "warning"} title={`Código interno da versão: ${versionStatus ?? "—"}`}>
              <FileStack className="h-3.5 w-3.5" aria-hidden="true" />
              Versão {operations.version.number} · {versionStatusLabel(versionStatus).toLocaleLowerCase("pt-BR")}
            </Badge>
          </>}
        />

        <section aria-label="Números do ciclo" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/*
            Um número só, como nos outros três cartões. "13 / 52" com a legenda
            "seções e perguntas" lia como fração de progresso — 13 de 52 —
            quando são duas grandezas diferentes. O tamanho do instrumento é o
            número de perguntas; quantas seções o organizam é detalhe, e desce
            para a legenda.
          */}
          <MetricCard
            icon={ListChecks}
            label="Estrutura"
            value={operations.metrics.questions}
            description={`${operations.metrics.questions === 1 ? "pergunta" : "perguntas"} em ${operations.metrics.sections} ${operations.metrics.sections === 1 ? "seção" : "seções"} · ${operations.metrics.requiredQuestions} ${operations.metrics.requiredQuestions === 1 ? "obrigatória" : "obrigatórias"}`}
          />
          <MetricCard icon={Users2} label="Participantes" value={operations.metrics.participants} description={operations.metrics.participants ? "pessoas vinculadas a este ciclo" : "nenhuma pessoa vinculada ainda"} href="/admin/participantes" hrefLabel="Gerenciar público" />
          <MetricCard icon={Clock3} label="Em preenchimento" value={operations.metrics.draftSubmissions} description="respostas iniciadas e ainda não enviadas" />
          <MetricCard icon={CheckCircle2} label="Respostas enviadas" value={operations.metrics.submittedSubmissions} description="submissões concluídas e registradas" tone="success" />
        </section>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.05fr]">
          <ReadinessChecklist issues={operations.issues} surveyId={surveyId} />

          <Surface className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Período de resposta</p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">Quando o formulário fica disponível</h3>
              </div>
              {fieldsEnabled
                ? <Badge variant="info"><SquarePen className="h-3.5 w-3.5" aria-hidden="true" />Editável</Badge>
                : <Badge variant="neutral"><Lock className="h-3.5 w-3.5" aria-hidden="true" />Bloqueado</Badge>}
            </div>
            <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{cycleExplanation(cycleStatus)}</p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
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
              <PeriodField
                id="periodo-encerramento"
                label="Encerramento"
                hint="Depois deste momento nenhuma resposta nova é aceita."
                value={closesAt}
                min={opensAt || minDateTime}
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
              {outcome && <div className="border-t border-[var(--border-subtle)] pt-3 sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--text-secondary)]">O que acontece</dt>
                <dd className="mt-1 flex items-start gap-2 leading-6 text-[var(--text-primary)]">
                  <CalendarCheck2 className="mt-1 h-4 w-4 shrink-0 text-[var(--brand-primary)]" aria-hidden="true" />
                  {outcome}
                </dd>
              </div>}
            </dl>

            {fieldsEnabled ? <>
              {periodDirty && <p role="status" className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-3 text-xs font-semibold leading-5 text-[var(--status-warning-text)]">
                <Info className="mt-px h-4 w-4 shrink-0" aria-hidden="true" />
                Alterações ainda não salvas. Use &ldquo;{periodActionLabel}&rdquo; para aplicá-las.
              </p>}
              <Button
                fullWidth
                size="lg"
                className="mt-4"
                variant={periodAction === "UPDATE_PERIOD" ? "secondary" : "primary"}
                onClick={() => void runAction(periodAction)}
                disabled={working !== null || !opensAt || !closesAt || currentPeriodIssues.length > 0}
                title={periodActionTitle}
              >
                {working === periodAction
                  ? <Hourglass className="h-5 w-5 animate-pulse" aria-hidden="true" />
                  : <PeriodActionIcon className="h-5 w-5" aria-hidden="true" />}
                {periodActionLabel}
              </Button>
              {periodAction === "SCHEDULE" && <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">O ciclo abre sozinho na data de abertura, sem ninguém precisar voltar aqui.</p>}
              {(!opensAt || !closesAt) && <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">Informe as duas datas para habilitar a gravação.</p>}
            </> : <p className="mt-4 flex items-start gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 text-sm leading-6 text-[var(--text-secondary)]">
              <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {cycleStatus === "OPEN"
                ? "Com o ciclo aberto o período não pode mudar. Interrompa a avaliação para editá-lo e reabrir com novas datas."
                : "O período não pode ser alterado enquanto o ciclo estiver neste estado."}
            </p>}
          </Surface>
        </div>

        <Surface className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Notificações</p>
              <h3 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">Avisos por e-mail aos participantes</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Com a opção ligada, cada participante recebe dois avisos automáticos: um quando o ciclo abre e outro nas 24 horas
                finais antes do encerramento — cada um, no máximo uma vez. Quem já enviou a resposta não recebe o lembrete.
              </p>
            </div>
            {emailNotificationsEnabled
              ? <Badge variant="success"><Mail className="h-3.5 w-3.5" aria-hidden="true" />Envio ligado</Badge>
              : <Badge variant="neutral"><Mail className="h-3.5 w-3.5" aria-hidden="true" />Envio desligado</Badge>}
          </div>

          <div className="mt-5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4">
            <Checkbox
              label="Enviar e-mails aos participantes"
              description={emailNotificationDescription}
              checked={emailNotificationsEnabled}
              disabled={emailNotificationsBlockedReason !== null || working !== null}
              onChange={(event) => void toggleEmailNotifications(event.target.checked)}
            />
            {emailNotificationsBlockedReason && (
              <p className="mt-3 flex items-start gap-1.5 text-xs font-semibold leading-5 text-[var(--text-secondary)]">
                <Lock className="mt-px h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                {emailNotificationsBlockedReason}
              </p>
            )}
            {emailNotificationsEnabled && scheduledEmailWindowIsShort && (
              <p role="status" className="mt-3 text-xs font-semibold leading-5 text-amber-800">
                Este ciclo agendado fica aberto por menos de 24 horas. Com o processamento diário, ele pode encerrar antes do próximo despacho; para um teste imediato, use “Abrir agora”.
              </p>
            )}
          </div>
        </Surface>

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
            {cycleActions.map((item) => {
              const isInterrupt = item.action === "INTERRUPT";
              const isWorking = isInterrupt ? working === "CLOSE" || working === "CANCEL" : working === item.action;
              return (
                <li key={item.action}>
                  <ActionCard
                    item={item}
                    working={isWorking}
                    busy={working !== null}
                    onRun={() => (isInterrupt ? setInterruptDialogOpen(true) : void runAction(item.action))}
                  />
                </li>
              );
            })}
          </ul>
        </Surface>

        <Dialog
          open={interruptDialogOpen}
          onOpenChange={setInterruptDialogOpen}
          title="Interromper avaliação"
          description="Escolha o que fazer com este ciclo. As duas opções interrompem o recebimento de respostas agora."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void runInterruptChoice("CLOSE")}
              disabled={cycleStatus !== "OPEN"}
              title={cycleStatus === "OPEN" ? undefined : "Só um ciclo aberto pode ser pausado."}
              className="flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-[var(--border-subtle)] disabled:hover:bg-[var(--surface-card)]"
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
                <CircleSlash className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" aria-hidden="true" />
                Pausar avaliação
              </span>
              <span className="text-xs leading-5 text-[var(--text-secondary)]">
                {cycleStatus === "OPEN"
                  ? "Interrompe novos envios. O ciclo pode ser reaberto depois com um novo período."
                  : "Só um ciclo aberto pode ser pausado."}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void runInterruptChoice("CANCEL")}
              className="flex flex-col gap-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 text-left transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--status-danger-text)]">
                <Ban className="h-4 w-4 shrink-0" aria-hidden="true" />
                Finalizar avaliação
              </span>
              <span className="text-xs leading-5 text-[var(--text-secondary)]">Encerra o ciclo e arquiva a avaliação por até 30 dias. Ela pode ser restaurada nesse período; depois, se ninguém agir, é excluída.</span>
            </button>
          </div>
        </Dialog>
      </>}
    </div>
  </PlatformShell>;
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

function PeriodField({ id, label, hint, value, min, disabled, error, onChange }: {
  id: string;
  label: string;
  hint: string;
  value: string;
  min: string;
  disabled: boolean;
  error?: string;
  onChange: (value: string) => void;
}) {
  const hintId = `${id}-hint`;
  const errorId = `${id}-erro`;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-[var(--text-primary)]">{label}</label>
      <p id={hintId} className="mt-1 text-xs leading-5 text-[var(--text-secondary)]">{hint}</p>
      <input
        id={id}
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
  const isDangerSoft = item.tone === "danger-soft";

  return (
    <div className={`flex h-full flex-col rounded-2xl border p-4 transition ${item.available ? "border-[var(--border-subtle)] bg-[var(--surface-card)] hover:border-[var(--border-strong)]" : "border-dashed border-[var(--border-subtle)] bg-[var(--surface-muted)]"}`}>
      <Button
        fullWidth
        variant={isDangerSoft ? "danger-outline" : (item.tone as "primary" | "secondary" | "danger")}
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

      {/*
        Sem pendência, o corpo não existe. O cabeçalho já diz "Nenhuma
        pendência: a estrutura e o período estão consistentes" e o selo já diz
        "Tudo pronto" — um `EmptyState` de tela inteira repetindo isso pela
        terceira vez fazia a ausência de problema ocupar mais espaço que a
        presença deles.
      */}
      <div className={`space-y-3 ${issues.length ? "mt-5 flex-1" : ""}`}>
        {issues.map((issue, index) => {
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
        })}
      </div>
    </Surface>
  );
}
