"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, AlertTriangle, ArrowLeft, Ban, CalendarCheck2, CheckCircle2, CircleSlash, Clock3, Copy, EyeOff, FilePlus2, FileStack, Hourglass, Image as ImageIcon, Info, ListChecks, Lock, Mail, PlayCircle, RotateCcw, Save, Send, ShieldCheck, SquarePen, Users2, Wrench } from "lucide-react";
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
import { BotaoProximaEtapa, CabecalhoDaConfiguracao, enderecoDaEtapa, type EtapaDaConfiguracao } from "@/components/configuracao-avaliacao";
import { InfoTooltip } from "@/components/ui/tooltip";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { errorMessageFromUnknown } from "@/lib/observability";
import { criarNovaVersaoPesquisa, definirNotificacaoEmail, executarAcaoDoCiclo, obterIdentidadeVisual, obterOperacaoDoCiclo } from "@/lib/api/cliente-construtor";
import type { OperacaoCiclo, PendenciaCiclo } from "@/lib/api/contratos-construtor";
import { nowLocalInputValue, opensInFuture, periodIssues, publishBlockedMessage } from "@/lib/survey-cycle-period";
import { cycleStatusLabel, versionStatusLabel } from "@/lib/survey-status-labels";

// O formato do agregado passou a vir do contrato da API, e não de uma cópia
// local — é o mesmo retorno de `get_survey_operations` que a rota repassa.
type Issue = PendenciaCiclo;
type Operations = OperacaoCiclo;

/**
 * Cada ação carrega, além do rótulo, a frase que explica **o que ela faz** e a
 * que explica **por que está indisponível**. O operador nunca deve encontrar
 * apenas um botão apagado sem contexto.
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
  /*
    "Ciclo" e "Revisar e publicar" são a mesma página com ênfases diferentes.

    O parâmetro só decide qual etapa a navegação destaca e o que aparece
    primeiro. As operações são as mesmas — e é isso que evita um segundo
    mecanismo de publicação, que seria a forma mais fácil de a plataforma passar
    a ter duas regras de quando um ciclo pode abrir.
  */
  const etapa: EtapaDaConfiguracao = useSearchParams().get("etapa") === "revisao" ? "revisao" : "ciclo";
  const granted = guard.state === "granted";
  const [operations, setOperations] = useState<Operations | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [interruptDialogOpen, setInterruptDialogOpen] = useState(false);
  /*
    Estado da capa, buscado só na etapa de revisão.

    `get_survey_operations` não devolve a identidade visual, e não vou ampliá-la
    por causa de uma linha de resumo: a rota de identidade já responde essa
    pergunta, e é uma chamada a mais apenas nesta etapa. Nulo enquanto carrega
    ou se falhar — a revisão não trava por causa da capa.
  */
  const [capaPersonalizada, setCapaPersonalizada] = useState<boolean | null>(null);

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

  useEffect(() => {
    if (!granted || etapa !== "revisao") return;
    let ativo = true;
    obterIdentidadeVisual(surveyId)
      .then((dados) => { if (ativo) setCapaPersonalizada(dados.visualIdentity?.themeVariant === "CUSTOM"); })
      .catch(() => { if (ativo) setCapaPersonalizada(null); });
    return () => { ativo = false; };
  }, [granted, etapa, surveyId]);

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

  // Não reaproveita runAction: a operação não passa por manage_survey_cycle,
  // e sim por fc_criar_nova_versao_pesquisa — outra RPC, outro contrato.
  async function runCreateNewVersion() {
    const confirmed = await confirm({
      title: "Criar nova versão?",
      description: `A versão ${operations?.version.number ?? ""} publicada será descontinuada, e um novo ciclo em rascunho nasce junto — configure período e público antes de publicá-lo.`,
      confirmLabel: "Criar nova versão",
      tone: "primary",
    });
    if (!confirmed) return;

    setWorking("NEW_VERSION");
    try {
      await criarNovaVersaoPesquisa(surveyId);
      toast.success("Nova versão criada em rascunho. Configure o período e o público antes de publicar.");
      await loadOperations();
    } catch (actionError) {
      toast.error(errorMessageFromUnknown(actionError));
    } finally {
      setWorking(null);
    }
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
      /*
        O motivo é derivado, não fixo.

        `readyToOpen` reúne três exigências — checklist válido, versão publicada
        e período coerente com encerramento no futuro. A mensagem culpava sempre
        o checklist, então uma versão ainda em rascunho aparecia como pendência
        de checklist logo abaixo do selo "Sem bloqueios", que lê a mesma
        validação e a declara limpa. Quem lesse os dois via a tela se
        contradizer e não ficava sabendo o que fazer.

        A ordem segue a da resolução: sem checklist válido nada mais adianta;
        depois vem publicar; o período fica por último porque é o único ajustável
        nesta mesma tela.
      */
      blockedReason: !["DRAFT", "SCHEDULED"].includes(cycleStatus ?? "")
        ? `Só é possível abrir um ciclo em rascunho ou agendado — este está ${cycleStatusLabel(cycleStatus).toLocaleLowerCase("pt-BR")}.`
        : blockingIssues.length > 0
          ? `Resolva ${blockingIssues.length} ${blockingIssues.length === 1 ? "bloqueio" : "bloqueios"} do checklist antes de abrir.`
          : versionStatus !== "PUBLISHED"
            ? "Publique a versão antes de abrir o ciclo."
            : "Defina um período com encerramento no futuro antes de abrir o ciclo.",
    },
    {
      action: "NEW_VERSION",
      label: "Criar nova versão",
      icon: FilePlus2,
      description: "Cria uma nova versão em rascunho com a mesma estrutura, e um novo ciclo em rascunho para configurar período e público.",
      tone: "secondary",
      available: versionStatus === "PUBLISHED"
        && (!operations.application || ["CLOSED", "CANCELLED"].includes(cycleStatus ?? "")),
      blockedReason: versionStatus !== "PUBLISHED"
        ? "Publique a versão atual antes de criar a próxima."
        : `Encerre o ciclo atual (está ${cycleStatusLabel(cycleStatus).toLocaleLowerCase("pt-BR")}) antes de criar uma nova versão.`,
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

  const blockedActions = cycleActions.filter((item) => !item.available);

  // Ciclos anônimos têm jornada pública: o link não identifica quem responde.
  // Os demais continuam passando pelo login institucional.
  const responseLink = operations?.application
    ? operations.survey.code === "CDDI"
      ? "/cddi"
      : operations.application.anonymous
        ? `/responder/${encodeURIComponent(operations.application.code)}`
        : `/pesquisas/${encodeURIComponent(operations.application.code)}`
    : null;

  /*
    O bloco de operações é definido uma vez e posicionado conforme a etapa.

    Em "Ciclo" ele fica ao fim, depois de período e avisos — é o desfecho de
    uma configuração. Em "Revisar e publicar" ele sobe para o topo, junto do
    resumo, porque ali publicar é o assunto, não a consequência.

    Definido, não duplicado: são os mesmos `cycleActions`, os mesmos handlers e
    a mesma `manage_survey_cycle`. Copiar a JSX criaria dois botões de publicar
    que divergiriam na primeira correção feita em um só deles.
  */
  const blocoDeAcoes = operations ? (
    <div>
      {versionStatus === "DRAFT" && !operations.readyToPublish && <p role="status" className="mb-4 flex items-start gap-3 rounded-xl border border-[var(--status-danger-border)] bg-[var(--status-danger-bg)] p-4 text-sm leading-6 text-[var(--status-danger-text)]">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
        <span><strong className="font-semibold">Publicação protegida.</strong> Corrija {blockingIssues.length} {blockingIssues.length === 1 ? "bloqueio indicado" : "bloqueios indicados"} no checklist antes de publicar esta versão.</span>
      </p>}

      <ul aria-label="Operações do ciclo" className="flex flex-wrap items-center gap-2">
        {cycleActions.map((item) => {
          const isInterrupt = item.action === "INTERRUPT";
          const isNewVersion = item.action === "NEW_VERSION";
          const isWorking = isInterrupt ? working === "CLOSE" || working === "CANCEL" : working === item.action;
          return (
            <li key={item.action} className="flex">
              <ActionButton
                item={item}
                working={isWorking}
                busy={working !== null}
                onRun={() => (isInterrupt
                  ? setInterruptDialogOpen(true)
                  : isNewVersion
                    ? void runCreateNewVersion()
                    : void runAction(item.action))}
              />
            </li>
          );
        })}
      </ul>

      {/* Os motivos de bloqueio saem de baixo de cada botão e viram uma lista
          só. Embaixo do botão, a frase era mais larga que ele, invadia o
          vizinho e deixava a fileira com alturas desiguais; aqui cada linha
          nomeia a ação a que se refere e continua ligada a ela por
          `aria-describedby`, sem exigir hover. */}
      {blockedActions.length > 0 && (
        <ul className="mt-4 space-y-1.5 border-t border-[var(--border-subtle)] pt-4">
          {blockedActions.map((item) => (
            <li
              key={item.action}
              id={`acao-${item.action}-nota`}
              className="flex items-start gap-2 text-xs leading-5 text-[var(--text-secondary)]"
            >
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
              <span><span className="font-semibold text-[var(--text-primary)]">{item.label}:</span> {item.blockedReason}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  ) : null;
  return <PlatformShell
    user={guard.user}
    eyebrow="Administração · Propriedades"
    // Rótulo fixo da rota, como nas outras etapas. O nome da avaliação é dito
    // uma vez, pelo cabeçalho da jornada.
    title={etapa === "revisao" ? "Revisar e publicar" : "Configuração do ciclo"}
  >
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      {/*
        Mesmo cabeçalho das outras etapas: a trilha substitui o botão isolado de
        voltar, e a navegação de etapas mostra onde esta tela fica na jornada.
        `Ciclo` e `Revisar e publicar` apontam para cá — são duas ênfases da
        mesma página, porque ela já concentra período, avisos, checklist e as
        ações de publicar e abrir. Duas rotas exigiriam um segundo mecanismo de
        publicação.
      */}
      <CabecalhoDaConfiguracao
        surveyId={surveyId}
        applicationId={operations?.application?.id}
        nome={operations?.survey.name}
        etapa={etapa}
        meta={[
          operations?.survey.code,
          operations?.application?.code ? `Ciclo ${operations.application.code}` : "Ciclo não configurado",
          operations ? `Versão ${operations.version.number} · ${versionStatusLabel(versionStatus).toLocaleLowerCase("pt-BR")}` : null,
          operations?.application?.anonymous ? "Anônima" : null,
        ]}
        acao={<BotaoProximaEtapa etapa={etapa} surveyId={surveyId} applicationId={operations?.application?.id} />}
      />

      <nav aria-label="Ações da avaliação" className="flex flex-wrap items-center gap-2">
        {responseLink && (
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}${responseLink}`;
              if (!navigator.clipboard) { toast.error(`Copie o link manualmente: ${url}`); return; }
              void navigator.clipboard.writeText(url).then(
                () => toast.success(operations?.application?.anonymous ? "Link anônimo copiado. O formulário abre sem login." : "Link de resposta copiado. Quem abrir entra pelo login institucional."),
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
        {/*
          A revisão é uma leitura, não um formulário.

          Trocar só a aba destacada não bastava: a pessoa chegava na última etapa
          e via a mesma tela de configurar período. Aqui ela encontra, em ordem,
          o que precisa conferir antes de publicar — e as operações logo abaixo,
          movidas para cá em vez de duplicadas.

          Os números saem de `operations.metrics`, que a página já carregava e
          não usava por inteiro.
        */}
        {etapa === "revisao" && (
          <>
            <Surface className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">Antes de publicar</h3>
                <Badge variant={operations.readyToPublish ? "success" : "warning"}>
                  {operations.readyToPublish
                    ? "Sem bloqueios"
                    : `${blockingIssues.length} ${blockingIssues.length === 1 ? "bloqueio" : "bloqueios"}`}
                </Badge>
              </div>

              <dl className="mt-4 divide-y divide-[var(--border-subtle)] text-sm">
                {[
                  {
                    rotulo: "Público definido",
                    valor: `${operations.metrics.participants} ${operations.metrics.participants === 1 ? "pessoa" : "pessoas"}`,
                    alerta: operations.metrics.participants === 0,
                    onde: enderecoDaEtapa("publico", surveyId, operations.application?.id),
                  },
                  {
                    rotulo: "Perguntas",
                    valor: `${operations.metrics.questions} no total · ${operations.metrics.requiredQuestions} ${operations.metrics.requiredQuestions === 1 ? "obrigatória" : "obrigatórias"}`,
                    alerta: operations.metrics.questions === 0,
                    onde: enderecoDaEtapa("estrutura", surveyId, operations.application?.id),
                  },
                  {
                    rotulo: "Período",
                    valor: operations.application?.opensAt || operations.application?.closesAt
                      ? `${dateLabel(operations.application?.opensAt)} até ${dateLabel(operations.application?.closesAt)}`
                      : "Não definido",
                    alerta: !operations.application?.opensAt && !operations.application?.closesAt,
                    onde: enderecoDaEtapa("ciclo", surveyId, operations.application?.id),
                  },
                  {
                    rotulo: "Identidade",
                    // Nulo é "ainda não sei", não "não tem" — dizer o segundo
                    // seria afirmar o que não foi lido.
                    valor: capaPersonalizada === null
                      ? "—"
                      : capaPersonalizada ? "Capa personalizada" : "Capa institucional padrão",
                    alerta: false,
                    onde: enderecoDaEtapa("identidade", surveyId, operations.application?.id),
                  },
                ].map((linha) => (
                  <div key={linha.rotulo} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
                    <dt className="text-[var(--text-secondary)]">{linha.rotulo}</dt>
                    <dd className="flex items-center gap-3">
                      <span className={linha.alerta ? "font-semibold text-[var(--status-warning-text)]" : "text-[var(--text-primary)]"}>
                        {linha.valor}
                      </span>
                      <Link href={linha.onde} className="text-xs font-semibold text-[var(--brand-primary)] underline underline-offset-4">
                        Ajustar
                      </Link>
                    </dd>
                  </div>
                ))}
              </dl>

              {operations.issues.length > 0 && (
                <ul className="mt-4 space-y-1.5 border-t border-[var(--border-subtle)] pt-4">
                  {operations.issues.map((issue, indice) => (
                    <li key={`${issue.severity}-${indice}`} className="flex items-start gap-2 text-xs leading-5">
                      {issue.severity === "BLOCKING"
                        ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--status-danger-text)]" aria-hidden="true" />
                        : <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />}
                      <span className="text-[var(--text-secondary)]">{issue.message}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Surface>

            {blocoDeAcoes}
          </>
        )}

        <PageHeader
          eyebrow={`${operations.survey.code} · Ciclo ${operations.application?.code ?? "não configurado"}`}
          title={etapa === "revisao" ? "Configuração do ciclo" : "Propriedades do ciclo"}
          description="Publique a versão, defina o período e controle abertura e encerramento."
          actions={<>
            <Badge variant={cycleStatusVariant(cycleStatus)} title={`Código interno do ciclo: ${cycleStatus ?? "—"}`}>
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Ciclo {cycleStatusLabel(cycleStatus).toLocaleLowerCase("pt-BR")}
            </Badge>
            <Badge variant={versionStatus === "PUBLISHED" ? "success" : "warning"} title={`Código interno da versão: ${versionStatus ?? "—"}`}>
              <FileStack className="h-3.5 w-3.5" aria-hidden="true" />
              Versão {operations.version.number} · {versionStatusLabel(versionStatus).toLocaleLowerCase("pt-BR")}
            </Badge>
            {operations.application?.anonymous && (
              <Badge variant="info" title="Quem responde não é identificado; o vínculo é destruído no envio.">
                <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
                Anônima
              </Badge>
            )}
          </>}
        />

        {/*
          Tira de números, não quatro cartões soltos: cada um só tinha um
          rótulo, um número e uma linha de legenda — pouca informação para o
          peso visual de borda + sombra + raio repetidos quatro vezes. O
          `gap-px` sobre fundo `--border-subtle` desenha os divisores finos
          sem precisar de borda em cada célula.
        */}
        <Surface aria-label="Números do ciclo" className="grid grid-cols-1 gap-px overflow-hidden bg-[var(--border-subtle)] p-0 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={ListChecks}
            label="Estrutura"
            value={operations.metrics.questions}
            description={`${operations.metrics.questions === 1 ? "pergunta" : "perguntas"} em ${operations.metrics.sections} ${operations.metrics.sections === 1 ? "seção" : "seções"} · ${operations.metrics.requiredQuestions} ${operations.metrics.requiredQuestions === 1 ? "obrigatória" : "obrigatórias"}`}
          />
          <MetricCard icon={Users2} label="Participantes" value={operations.metrics.participants} description={operations.metrics.participants ? "vinculadas a este ciclo" : "nenhuma vinculada ainda"} href="/admin/participantes" hrefLabel="Gerenciar" />
          <MetricCard icon={Clock3} label="Em preenchimento" value={operations.metrics.draftSubmissions} description="iniciadas, não enviadas" />
          <MetricCard icon={CheckCircle2} label="Respostas enviadas" value={operations.metrics.submittedSubmissions} description="concluídas e registradas" tone="success" />
        </Surface>

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

        {!operations.application?.anonymous && <Surface className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Notificações</p>
              <div className="mt-1 flex items-center gap-1.5">
                <h3 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">Avisos por e-mail aos participantes</h3>
                <InfoTooltip id="notificacoes-explicacao">
                  Com a opção ligada, cada participante recebe dois avisos automáticos: um quando o ciclo abre e outro nas 24 horas finais antes do encerramento — cada um, no máximo uma vez. Quem já enviou a resposta não recebe o lembrete.
                </InfoTooltip>
              </div>
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
        </Surface>}

        {etapa === "ciclo" ? blocoDeAcoes : null}

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
      <Skeleton className="h-20 w-full rounded-2xl" />
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
    <article className="flex flex-col gap-1.5 bg-[var(--surface-card)] p-4">
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${tone === "success" ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]" : "bg-[var(--surface-muted)] text-[var(--brand-primary)]"}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
        <p className="text-xs font-semibold uppercase tracking-[.12em] text-[var(--text-secondary)]">{label}</p>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <strong className="text-2xl font-semibold tracking-tight text-[var(--brand-primary)]">{value}</strong>
        <span className="text-xs leading-5 text-[var(--text-secondary)]">{description}</span>
      </div>
      {href && hrefLabel && (
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-primary)] hover:underline">
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
      <div className="flex items-center gap-1.5">
        <label htmlFor={id} className="block text-sm font-semibold text-[var(--text-primary)]">{label}</label>
        <InfoTooltip id={hintId}>{hint}</InfoTooltip>
      </div>
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
 * Botão de operação, sem cartão em volta — pensado para uma fileira compacta de
 * ações, no formato de barra de ferramentas. O que a ação faz vira tooltip no
 * hover/foco (como `InfoTooltip`, CSS puro por `group`/`group-hover`/
 * `group-focus-within`), e por isso o componente não renderiza texto nenhum
 * abaixo: manter alturas iguais é o que evita a fileira ficar irregular.
 *
 * O tooltip existe para **toda** ação, disponível ou não — ver o comentário
 * junto do balão para as duas armadilhas que isso envolve (recorte pela barra
 * lateral e hover em botão `disabled`).
 *
 * O motivo de estar indisponível **não** vem para cá — ele continua sempre
 * visível, sem exigir hover, mas na lista única
 * abaixo da fileira, montada por quem chama. Embaixo de cada botão a frase era
 * mais larga que ele e invadia o vizinho.
 */
function ActionButton({ item, working, busy, onRun }: { item: CycleAction; working: boolean; busy: boolean; onRun: () => void }) {
  const Icon = item.icon;
  const descriptionId = `acao-${item.action}-descricao`;
  const noteId = `acao-${item.action}-nota`;
  const disabled = busy || !item.available;
  const isDangerSoft = item.tone === "danger-soft";

  return (
    <span className="group relative inline-flex">
      <Button
        variant={isDangerSoft ? "danger-outline" : (item.tone as "primary" | "secondary" | "danger")}
        onClick={onRun}
        disabled={disabled}
        // A descrição descreve a ação sempre — inclusive bloqueada. Quando está
        // bloqueada, soma-se o motivo, que vive na lista abaixo da fileira.
        aria-describedby={item.available ? descriptionId : `${descriptionId} ${noteId}`}
        className="rounded-full shadow-[0_1px_2px_rgba(15,23,42,.06)]"
      >
        {working ? <Hourglass className="h-4 w-4 animate-pulse" aria-hidden="true" /> : <Icon className="h-4 w-4" aria-hidden="true" />}
        {working ? "Processando..." : item.label}
      </Button>

      {/*
        Ancorado pela borda **esquerda** do botão, não centralizado.

        `.platform-shell-content` é `position: fixed` com `overflow-x: hidden`
        (ver `src/app/sidebar-monitora.css`), e isso tem duas consequências: ele
        é um contexto de empilhamento próprio, então nenhum `z-index` daqui de
        dentro vence a barra lateral em `z-50`; e o que passa da borda é
        recortado. Centralizado (`left-1/2 -translate-x-1/2`), o balão de um
        botão à esquerda avançava para fora e aparecia cortado sob a barra.
        Alinhado à esquerda do botão, ele só cresce para a direita, onde há a
        largura do conteúdo inteira.

        O balão é renderizado **mesmo com o botão desativado**: saber o que a
        ação faz não deveria depender de ela estar disponível agora. Com o botão
        `disabled` o hover chega a este `span` (o botão tem
        `disabled:pointer-events-none`, então o teste de acerto sobe para o pai),
        e é por isso que `group-hover` continua funcionando. O foco, não —
        elemento `disabled` não é focável —, e é justamente por isso que o motivo
        do bloqueio nunca vive só aqui.
      */}
      <span
        id={descriptionId}
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-[60] mt-2 w-64 max-w-[calc(100vw-3rem)] rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-3 text-xs leading-5 text-[var(--text-secondary)] opacity-0 shadow-[0_18px_45px_-20px_rgba(15,23,42,.45)] transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        {item.description}
      </span>
    </span>
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
