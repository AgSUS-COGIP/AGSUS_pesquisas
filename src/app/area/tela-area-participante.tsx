"use client";

import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, ExternalLink, FileText, LayoutDashboard, Megaphone, RefreshCw, Users2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FullPageState } from "@/components/full-page-state";
import { PersonAvatar } from "@/components/person-avatar";
import { usePlatformBranding } from "@/components/platform-branding-provider";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { PlatformWelcome, useWelcomeState } from "@/components/platform-welcome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/skeleton";
import { useSurveyCatalog } from "@/hooks/use-survey-catalog";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { compareSurveyPriority, selectPrioritySurvey, summarizeSurveyCatalog, surveyApplicationHref as applicationHref, surveyItemState as itemState } from "@/lib/survey-catalog";
import { deadlineLabel, deadlineStatus } from "@/lib/deadline";
import { timeGreeting } from "@/lib/greeting";

// A regra de saudação vive em `@/lib/greeting`, testada e compartilhada com a
// recepção da primeira visita. Duas cópias divergiriam em silêncio — e a
// daqui não tratava a meia-noite, que o `hour12: false` devolve como "24".

function stateLabel(state: string) {
  if (state === "COMPLETED") return "Concluída";
  if (state === "IN_PROGRESS") return "Em andamento";
  if (state === "CLOSED") return "Encerrada";
  if (state === "SCHEDULED") return "Agendada";
  return "Pendente";
}

function stateVariant(state: string) {
  if (state === "COMPLETED") return "success" as const;
  if (state === "IN_PROGRESS") return "warning" as const;
  if (state === "CLOSED") return "neutral" as const;
  if (state === "SCHEDULED") return "info" as const;
  return "outline" as const;
}

function dateLabel(value: string | null) {
  if (!value) return "Sem data definida";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

/*
 * A contagem de dias vive em `@/lib/deadline` e é a única do sistema.
 *
 * Havia aqui uma segunda implementação, `daysUntil`, que arredondava a
 * diferença exata em horas para cima (`Math.ceil`). O restante da plataforma
 * conta **dias de calendário**, que é o que a pessoa espera de um "faltam X
 * dias". Para o mesmo encerramento — 29/08 às 17h09 — a faixa de métricas
 * mostrava "16d" e o cartão de próxima ação, logo ao lado, "faltam 17 dias".
 *
 * Dois números para o mesmo prazo, na mesma tela. Duplicar a regra foi o
 * defeito; a correção é não ter a segunda cópia.
 */

export default function ParticipantAreaPage() {
  // Sem módulo exigido no hook: o Participante não tem Visão Geral, mas /area é
  // o destino padrão pós-login — a resposta correta é redirecionar para
  // Pesquisas, não apresentar "acesso restrito".
  const guard = usePlatformGuard();
  const { branding } = usePlatformBranding();
  const granted = guard.state === "granted";
  const router = useRouter();
  const [salutation, setSalutation] = useState("Olá");
  const welcome = useWelcomeState();
  const catalogQuery = useSurveyCatalog(granted);
  const catalog = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const catalogLoading = catalogQuery.isLoading;
  /*
    Falha do catálogo não pode virar lista vazia. Sem esta distinção, `data`
    indefinido cai no mesmo `?? []` do caso legítimo e a tela afirma "Nenhuma
    avaliação disponível" e "Tudo em dia — você não tem ações pendentes" a quem
    talvez tenha prazo correndo. `/pesquisas` já separava os dois; aqui os três
    blocos alimentados pelo catálogo passam a separar também.
  */
  const catalogFailed = catalogQuery.isError;
  const catalogError = catalogQuery.error instanceof Error
    ? catalogQuery.error.message
    : "Não foi possível carregar suas avaliações agora.";

  useEffect(() => setSalutation(timeGreeting()), []);

  const hasHomeModule = granted ? guard.modules.includes(PLATFORM_MODULE.HOME) : true;
  useEffect(() => {
    if (granted && !hasHomeModule) router.replace("/pesquisas");
  }, [granted, hasHomeModule, router]);

  const metrics = useMemo(() => summarizeSurveyCatalog(catalog), [catalog]);
  const priorityItem = useMemo(() => selectPrioritySurvey(catalog), [catalog]);
  /*
    A lista mostra o que **não** está em destaque.

    Com a maioria dos participantes tendo uma avaliação só — o CDDI —, o mesmo
    item aparecia três vezes na tela: nos indicadores, no cartão "Próxima ação"
    e de novo aqui, repetindo prazo e situação. Não era caso raro: é o caso
    normal de 1.023 pessoas.

    Excluir o item em destaque resolve os dois extremos de uma vez. Com uma
    avaliação, o bloco desaparece e a tela diz uma coisa só; com várias, a lista
    volta a ter função — o que vem depois da próxima ação.
  */
  const otherItems = useMemo(
    () => catalog
      .filter((item) => item.applicationId !== priorityItem?.applicationId)
      .toSorted(compareSurveyPriority),
    [catalog, priorityItem],
  );
  const hasMoreActions = otherItems.some((item) => ["PENDING", "IN_PROGRESS"].includes(itemState(item)));

  /**
   * Data do prazo mais próximo entre o que a pessoa ainda pode resolver.
   *
   * O indicador mostrava só a contagem de dias; sem a data, "15 dias" não diz
   * até quando. Considera apenas pendente e em andamento — concluída, encerrada
   * ou agendada não gera prazo a cumprir, que é a mesma regra usada por
   * `summarizeSurveyCatalog` para contar os dias.
   */
  const nextDeadlineDate = useMemo(() => {
    const abertos = catalog
      .filter((item) => ["PENDING", "IN_PROGRESS"].includes(itemState(item)))
      .map((item) => item.closesAt)
      .filter((value): value is string => Boolean(value))
      .sort();
    const proximo = abertos[0];
    return proximo
      ? new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(proximo))
      : null;
  }, [catalog]);

  if (guard.state !== "granted") {
    return <PlatformGuardState guard={guard} title="painel institucional" unidentifiedTitle="Não foi possível abrir seu painel" />;
  }

  const { context, person, modules, user } = guard;
  // `status` fora de OK significa cadastro inativo ou pendente: o contexto veio,
  // mas não autoriza abrir o painel.
  if (context.status !== "OK") {
    return <FullPageState title="Não foi possível abrir seu painel" description={context.message || "Cadastro institucional não localizado."} actionHref="/acesso" actionLabel="Voltar ao acesso" />;
  }

  if (!hasHomeModule) return <PlatformSkeleton title="Redirecionando para Pesquisas" />;

  const isLeader = modules.includes(PLATFORM_MODULE.TEAM);
  // `?? fullName` porque `split` é tipado como podendo não ter o índice 0 —
  // nome com espaço no início devolveria vazio, e é melhor o nome inteiro que
  // uma saudação sem ninguém.
  const firstName = person.fullName.split(/\s+/).filter(Boolean)[0] ?? person.fullName;

  // A administração não tem atalho aqui: a central foi retirada da navegação e
  // cada módulo administrativo tem entrada própria no menu lateral.
  const actions = [
    { href: "/pesquisas", title: "Pesquisas", text: "Iniciar, continuar ou consultar avaliações", icon: FileText },
    ...(isLeader ? [{ href: "/equipe", title: "Minha equipe", text: "Acompanhar integrantes e avaliar", icon: Users2 }] : []),
    ...(modules.includes(PLATFORM_MODULE.DASHBOARDS) ? [{ href: "/paineis", title: "Painéis", text: "Indicadores e acompanhamento dos ciclos", icon: LayoutDashboard }] : []),
  ];

  // A legenda de cada indicador responde "e daí?": urgência quando há prazo
  // apertado, percentual quando o número sozinho não diz se está bem.
  const urgentLabel = metrics.urgent === 1 ? "1 vence em até 7 dias" : `${metrics.urgent} vencem em até 7 dias`;
  const metricTiles = [
    {
      label: "Pendentes",
      value: metrics.pending,
      description: metrics.pending === 0 ? "nada aguardando você" : "aguardando você começar",
      href: "/pesquisas?situacao=OPEN",
    },
    {
      label: "Em andamento",
      value: metrics.inProgress,
      description: metrics.inProgress === 0 ? "nenhuma iniciada" : "já iniciadas, faltam enviar",
      href: "/pesquisas?situacao=DRAFT",
    },
    {
      label: "Concluídas",
      value: metrics.completed,
      description: metrics.total ? `${metrics.completionRate}% do que está disponível` : "enviadas e registradas",
      href: "/pesquisas?situacao=COMPLETED",
    },
    {
      label: "Prazo mais próximo",
      /*
        Antes: "15d" com a legenda "1 avaliação aberta". Duas coisas erradas —
        "15d" é abreviação de painel, não linguagem de quem responde, e a
        legenda não dizia **até quando**. A pessoa lia "15 dias" e continuava
        sem saber a data, que estava no cartão ao lado.

        Agora o número fala por extenso e a legenda traz a data. "Hoje" e
        "amanhã" ganham texto próprio: dizer "1 dia" a quem tem até amanhã é
        pedir para alguém errar a conta.
      */
      value: metrics.nextDeadlineDays === null
        ? "—"
        : metrics.nextDeadlineDays === 0
          ? "hoje"
          : metrics.nextDeadlineDays === 1
            ? "amanhã"
            : `${metrics.nextDeadlineDays} dias`,
      description: metrics.actionable === 0
        ? "sem prazos em aberto"
        : metrics.nextDeadlineDays === 0
          ? "último dia para enviar"
          : nextDeadlineDate
            ? `até ${nextDeadlineDate}`
            : urgentLabel,
      alert: metrics.urgent > 0,
      href: "/pesquisas?situacao=OPEN",
    },
  ];

  // Mesma fonte que alimenta a métrica "Prazo mais próximo" e os cartões do
  // catálogo — por isso os números concordam.
  const priorityDeadline = priorityItem ? deadlineLabel(deadlineStatus(priorityItem.closesAt, new Date())) : null;
  const showAnnouncement = branding.homeAnnouncementEnabled
    && Boolean(branding.homeAnnouncementTitle)
    && Boolean(branding.homeAnnouncementMessage);
  const externalAnnouncementLink = branding.homeAnnouncementLink?.startsWith("https://") ?? false;

  return (
    <PlatformShell user={user} title="Visão geral">
      {/*
        Tentei antes forçar a página a ocupar a altura da janela, com
        `min-height` e a jornada crescendo para absorver a sobra. Em monitor
        grande o resultado foi pior: o cartão esticava e virava um bloco branco
        enorme com uma linha só dentro.

        Altura vazia é honesta quando não há o que mostrar; caixa vazia esticada
        não é. A coluna voltou a ter altura natural, e a escala desceu — em tela
        de 1080 os números de 2,5rem e o avatar maior ficavam grandes demais.
      */}
      {/*
        Sem `max-w` próprio: a `<main>` da casca já limita em 1760px, e o rodapé
        usa a mesma medida. O cap de 1400px daqui deixava o conteúdo mais estreito
        que o rodapé logo abaixo — visível em monitor grande, onde a linha da
        instituição começava à esquerda dos cartões — e ainda desperdiçava 360px
        de largura justamente na tela em que sobrava espaço.
      */}
      <div className="flex w-full flex-col gap-6">
        {/* Recepção da primeira visita. Some ao ser dispensada e não volta. */}
        <PlatformWelcome visible={welcome.visible} onDismiss={welcome.dismiss} firstName={firstName} />
        {showAnnouncement ? (
          <section
            aria-label="Comunicado institucional"
            className="flex flex-col gap-3 border-l-[3px] border-[var(--status-info-text)] bg-[var(--status-info-bg)] px-4 py-3 sm:flex-row sm:items-center"
          >
            <span className="shrink-0 text-[var(--status-info-text)]">
              <Megaphone className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-[var(--status-info-text)]">Comunicado institucional</p>
              <h2 className="mt-0.5 text-sm font-semibold text-[var(--text-primary)]">{branding.homeAnnouncementTitle}</h2>
              <p className="mt-0.5 text-xs leading-5 text-[var(--text-secondary)]">{branding.homeAnnouncementMessage}</p>
            </div>
            {branding.homeAnnouncementLink ? (
              externalAnnouncementLink ? (
                <a
                  href={branding.homeAnnouncementLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--surface-hover)]"
                >
                  {branding.homeAnnouncementLinkLabel}
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              ) : (
                <Link
                  href={branding.homeAnnouncementLink}
                  className="inline-flex min-h-9 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--surface-hover)]"
                >
                  {branding.homeAnnouncementLinkLabel}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              )
            ) : null}
          </section>
        ) : null}
        {/*
          Identificação e métricas deixaram de ser cartões dentro de cartão. A
          faixa usa espaço e tipografia para separar — não borda —, e a régua
          vertical entre os números vem só a partir de `sm`, onde há largura
          para ela significar alguma coisa.
        */}
        <section className="grid items-stretch gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
          <article className="@container flex flex-col rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 sm:p-6">
            {/*
              A saudação sai enquanto a recepção estiver no ar: a faixa acima já
              diz "Boas-vindas, {nome}", e repetir "Boa tarde, {nome}" logo
              abaixo é a mesma saudação duas vezes, uma sob a outra. Dispensada a
              faixa, ela volta — é ela que dá rosto à tela no uso do dia a dia.
            */}
            {!welcome.visible ? (
              <div className="flex items-center gap-4">
                <PersonAvatar fullName={person.fullName} avatarUrl={person.avatarUrl} className="h-12 w-12 rounded-xl" fallbackClassName="text-base" />
                <div className="min-w-0">
                  <p className="text-sm text-[var(--text-secondary)]">{salutation},</p>
                  <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">{firstName}</h2>
                </div>
              </div>
            ) : null}

            {/*
              Quatro colunas dependem da largura do **cartão**, não da janela —
              daí o `@container` no elemento acima e o `@4xl` (56rem) aqui.

              A primeira tentativa usou `lg:`, que responde à janela: num
              notebook de 1359px a janela já passava de `lg`, mas o cartão tinha
              só ~700px, e "Prazo mais próximo" quebrava em duas linhas do mesmo
              jeito. O breakpoint estava medindo a coisa errada.
            */}
            <nav aria-label="Atalhos por situação das avaliações" className="mt-auto grid grid-cols-2 gap-x-6 gap-y-5 pt-6 @4xl:grid-cols-4 @4xl:divide-x @4xl:divide-[var(--border-subtle)]">
              {metricTiles.map((tile, index) => {
                // Urgência muda a cor do número, mas o texto continua dizendo o
                // motivo — cor nunca é o único indicador de estado.
                const highlight = !catalogLoading && !catalogFailed && tile.alert;
                // Zero é uma afirmação. Sem catálogo, o número não é zero — é
                // desconhecido, e o traço diz isso.
                const unknown = catalogLoading || catalogFailed;
                // O recuo acompanha a régua: só existe onde ela existe.
                return (
                  <Link
                    key={tile.label}
                    href={tile.href}
                    aria-label={`Ver avaliações: ${tile.label}`}
                    className={`group rounded-md px-2 py-1 outline-none transition hover:bg-[var(--surface-hover)] focus-visible:ring-4 focus-visible:ring-[var(--focus-ring)]/20 ${index > 0 ? "@4xl:pl-6" : ""}`}
                  >
                    <span className="text-xs font-medium text-[var(--text-secondary)]">{tile.label}</span>
                    <span className="block">
                      <strong className={`mt-1.5 block text-[1.75rem] font-semibold leading-none tabular-nums ${highlight ? "text-[var(--status-warning-text)]" : "text-[var(--brand-primary)]"}`}>
                        {unknown ? "—" : tile.value}
                      </strong>
                      <span className={`mt-2 block text-xs leading-4 ${highlight ? "font-semibold text-[var(--status-warning-text)]" : "text-[var(--text-muted)]"}`}>
                        {catalogLoading ? "carregando" : catalogFailed ? "indisponível" : tile.description}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </nav>
          </article>

          {/*
            A próxima ação é a única coisa acionável da tela, então é a única que
            recebe fundo de marca. Antes ela competia de igual para igual com
            quatro atalhos e uma lista.
          */}
          <aside aria-label="Próxima ação" className="flex flex-col rounded-lg border border-[var(--status-info-border)] bg-[var(--status-info-bg)] p-5 sm:p-6">
            {catalogLoading ? (
              <div className="space-y-3" aria-busy="true">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="mt-auto h-11 w-40" />
              </div>
            ) : catalogFailed ? (
              <div className="flex flex-col">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]">
                  <AlertTriangle className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-xl font-semibold tracking-tight text-[var(--text-primary)]">Não foi possível verificar</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                  {catalogError} Você pode ter avaliações pendentes — tente novamente antes de considerar que não há nada a responder.
                </p>
                <Button variant="secondary" className="mt-4 self-start" onClick={() => void catalogQuery.refetch()}>
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  Tentar novamente
                </Button>
              </div>
            ) : priorityItem ? <>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[var(--status-info-text)]">Próxima ação</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">{priorityItem.applicationName}</h3>
                </div>
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--surface-card)] text-[var(--brand-primary)]">
                  <CalendarClock className="h-5 w-5" aria-hidden="true" />
                </span>
              </div>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-[var(--text-secondary)]">{priorityItem.description || priorityItem.surveyName}</p>

              {/* O prazo virou uma linha, não uma caixa: são dois dados curtos. */}
              <p className="mt-auto flex flex-wrap items-baseline gap-x-2 gap-y-1 pt-5 text-sm">
                <span className="text-[var(--text-secondary)]">Prazo</span>
                <strong className="font-semibold text-[var(--text-primary)]">{dateLabel(priorityItem.closesAt)}</strong>
                {priorityDeadline && (
                  <span className="text-[var(--text-secondary)]">· {priorityDeadline.toLocaleLowerCase("pt-BR")}</span>
                )}
              </p>

              <Link
                href={applicationHref(priorityItem)}
                className="institutional-action mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition"
              >
                {itemState(priorityItem) === "IN_PROGRESS" ? "Continuar de onde parei" : "Abrir avaliação"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </> : (
              <div className="flex flex-col">
                <span className="grid h-12 w-12 place-items-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success-text)]">
                  <CheckCircle2 className="h-6 w-6" aria-hidden="true" />
                </span>
                <h3 className="mt-4 text-xl font-semibold tracking-tight text-[var(--text-primary)]">Tudo em dia</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Você não tem ações pendentes. Novas avaliações aparecem aqui assim que forem liberadas para você.</p>
              </div>
            )}
          </aside>
        </section>

        {/*
          A jornada passou a ocupar a largura toda. Antes dividia a faixa com
          quatro atalhos que repetem o menu lateral — e era a lista, não os
          atalhos, que precisava de espaço para respirar.

          O bloco só existe quando há o que listar além do que já está em
          destaque, ou quando o catálogo falhou — nesse caso ele é o lugar que
          explica a falha e oferece nova tentativa.
        */}
        {catalogLoading || catalogFailed || otherItems.length ? (
        <article className="flex flex-col overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] p-5 sm:p-6">
              <div>
                <p className="text-xs font-medium text-[var(--text-secondary)]">Avaliações</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">{hasMoreActions ? "Próximas pendências" : "Acompanhe também"}</h2>
                <p className="mt-1 text-xs text-[var(--text-secondary)]">{hasMoreActions ? "Ordenadas primeiro pelo que já foi iniciado e depois pelo prazo." : "Histórico e ciclos que não exigem ação neste momento."}</p>
              </div>
              <Link href="/pesquisas" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-[var(--brand-primary)] transition hover:bg-[var(--surface-hover)]">
                Ver catálogo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
            {catalogLoading ? (
              <div className="space-y-3 p-5" aria-busy="true">
                <span className="sr-only">Carregando suas avaliações.</span>
                {Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-20 rounded-xl" />)}
              </div>
            ) : catalogFailed ? (
              <EmptyState
                className="m-5 border-0 shadow-none"
                icon={<AlertTriangle className="h-6 w-6" aria-hidden="true" />}
                title="Não foi possível carregar suas avaliações"
                description={`${catalogError} A lista abaixo não reflete o que existe — tente novamente.`}
                action={
                  <Button variant="secondary" onClick={() => void catalogQuery.refetch()}>
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Tentar novamente
                  </Button>
                }
              />
            ) : (
              // Passou de 4 para 6: com a coluna ocupando a altura inteira, o
              // corte em 4 deixaria espaço sobrando justamente para quem tem
              // avaliações a mostrar.
              <ul className="divide-y divide-[var(--border-subtle)]">
                {otherItems.slice(0, 6).map((item) => {
                  const state = itemState(item);
                  return (
                    <li key={item.applicationId}>
                      <Link href={applicationHref(item)} className="group flex items-center gap-4 p-5 transition hover:bg-[var(--surface-hover)]">
                        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${
                          state === "COMPLETED" ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]"
                            : state === "IN_PROGRESS" ? "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"
                            : "bg-[var(--surface-muted)] text-[var(--brand-primary)]"
                        }`}>
                          {state === "COMPLETED" ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <FileText className="h-5 w-5" aria-hidden="true" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-sm font-semibold text-[var(--text-primary)]">{item.applicationName}</strong>
                          <small className="mt-1 block truncate text-xs text-[var(--text-secondary)]">
                            {["PENDING", "IN_PROGRESS"].includes(state)
                              ? `${item.surveyName} · prazo ${dateLabel(item.closesAt)}`
                              : `${item.surveyName} · ${item.questions} ${item.questions === 1 ? "pergunta" : "perguntas"}`}
                          </small>
                        </span>
                        <Badge variant={stateVariant(state)} className="hidden sm:inline-flex">{stateLabel(state)}</Badge>
                        <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--brand-primary)]" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
        </article>
        ) : null}

        {/*
          Atalhos como faixa de links, não como cartões: eles repetem destinos que
          já existem no menu lateral, então servem de conveniência — não competem
          com a próxima ação nem com a jornada.
        */}
        <nav aria-label="Acessos principais" className="flex flex-wrap gap-1 border-t border-[var(--border-subtle)] pt-4">
          {actions.map(({ href, title, text, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={text}
              className="group inline-flex min-h-10 flex-1 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-[var(--text-secondary)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] sm:flex-none"
            >
              <Icon className="h-4 w-4 shrink-0 text-[var(--brand-primary)]" aria-hidden="true" />
              <span className="truncate">{title}</span>
              <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-[var(--text-muted)] transition group-hover:translate-x-0.5 group-hover:text-[var(--brand-primary)]" aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </div>
    </PlatformShell>
  );
}
