"use client";

import { ArrowRight, CalendarClock, CheckCircle2, FileText, Inbox, LayoutDashboard, Users2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { FullPageState } from "@/components/full-page-state";
import { PersonAvatar } from "@/components/person-avatar";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { Skeleton } from "@/components/ui/skeleton";
import { useSurveyCatalog } from "@/hooks/use-survey-catalog";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { selectPrioritySurvey, summarizeSurveyCatalog, surveyApplicationHref as applicationHref, surveyItemState as itemState } from "@/lib/survey-catalog";
import { deadlineLabel, deadlineStatus } from "@/lib/deadline";

function greeting() {
  const hour = Number(new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date()).replace(/\D/g, ""));
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

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
  const granted = guard.state === "granted";
  const router = useRouter();
  const [salutation, setSalutation] = useState("Olá");
  const catalogQuery = useSurveyCatalog(granted);
  const catalog = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const catalogLoading = catalogQuery.isLoading;

  useEffect(() => setSalutation(greeting()), []);

  const hasHomeModule = granted ? guard.modules.includes(PLATFORM_MODULE.HOME) : true;
  useEffect(() => {
    if (granted && !hasHomeModule) router.replace("/pesquisas");
  }, [granted, hasHomeModule, router]);

  const metrics = useMemo(() => summarizeSurveyCatalog(catalog), [catalog]);
  const priorityItem = useMemo(() => selectPrioritySurvey(catalog), [catalog]);

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
  const firstName = person.fullName.split(/\s+/)[0];

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
    },
    {
      label: "Em andamento",
      value: metrics.inProgress,
      description: metrics.inProgress === 0 ? "nenhuma iniciada" : "já iniciadas, faltam enviar",
    },
    {
      label: "Concluídas",
      value: metrics.completed,
      description: metrics.total ? `${metrics.completionRate}% do que está disponível` : "enviadas e registradas",
    },
    {
      label: "Prazo mais próximo",
      value: metrics.nextDeadlineDays === null ? "—" : metrics.nextDeadlineDays === 0 ? "hoje" : `${metrics.nextDeadlineDays}d`,
      description: metrics.actionable === 0
        ? "sem prazos em aberto"
        : metrics.urgent > 0
          ? urgentLabel
          : `${metrics.actionable} ${metrics.actionable === 1 ? "avaliação aberta" : "avaliações abertas"}`,
      alert: metrics.urgent > 0,
    },
  ];

  // Mesma fonte que alimenta a métrica "Prazo mais próximo" e os cartões do
  // catálogo — por isso os números concordam.
  const priorityDeadline = priorityItem ? deadlineLabel(deadlineStatus(priorityItem.closesAt, new Date())) : null;

  return (
    <PlatformShell user={user} eyebrow="Ambiente institucional" title="Visão geral">
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
      <div className="flex w-full flex-col gap-5">
        {/*
          Identificação e métricas deixaram de ser cartões dentro de cartão. A
          faixa usa espaço e tipografia para separar — não borda —, e a régua
          vertical entre os números vem só a partir de `sm`, onde há largura
          para ela significar alguma coisa.
        */}
        <section className="grid items-stretch gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
          <article className="@container flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)] sm:p-6">
            <div className="flex items-center gap-4">
              <PersonAvatar fullName={person.fullName} avatarUrl={person.avatarUrl} className="h-12 w-12 rounded-xl" fallbackClassName="text-base" />
              <div className="min-w-0">
                <p className="text-sm text-[var(--text-secondary)]">{salutation},</p>
                <h2 className="text-xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-2xl">{firstName}</h2>
              </div>
            </div>

            {/*
              Quatro colunas dependem da largura do **cartão**, não da janela —
              daí o `@container` no elemento acima e o `@4xl` (56rem) aqui.

              A primeira tentativa usou `lg:`, que responde à janela: num
              notebook de 1359px a janela já passava de `lg`, mas o cartão tinha
              só ~700px, e "Prazo mais próximo" quebrava em duas linhas do mesmo
              jeito. O breakpoint estava medindo a coisa errada.
            */}
            <dl className="mt-auto grid grid-cols-2 gap-x-6 gap-y-5 pt-6 @4xl:grid-cols-4 @4xl:divide-x @4xl:divide-[var(--border-subtle)]">
              {metricTiles.map((tile, index) => {
                // Urgência muda a cor do número, mas o texto continua dizendo o
                // motivo — cor nunca é o único indicador de estado.
                const highlight = !catalogLoading && tile.alert;
                // O recuo acompanha a régua: só existe onde ela existe.
                return (
                  <div key={tile.label} className={index > 0 ? "@4xl:pl-6" : undefined}>
                    <dt className="text-xs font-semibold uppercase tracking-[.1em] text-[var(--text-secondary)]">{tile.label}</dt>
                    <dd>
                      <strong className={`mt-1.5 block text-[1.75rem] font-semibold leading-none tabular-nums ${highlight ? "text-[var(--status-warning-text)]" : "text-[var(--brand-primary)]"}`}>
                        {catalogLoading ? "—" : tile.value}
                      </strong>
                      <span className={`mt-2 block text-xs leading-4 ${highlight ? "font-semibold text-[var(--status-warning-text)]" : "text-[var(--text-muted)]"}`}>
                        {catalogLoading ? "carregando" : tile.description}
                      </span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </article>

          {/*
            A próxima ação é a única coisa acionável da tela, então é a única que
            recebe fundo de marca. Antes ela competia de igual para igual com
            quatro atalhos e uma lista.
          */}
          <aside aria-label="Próxima ação" className="flex flex-col rounded-2xl border border-[var(--brand-primary)]/15 bg-[var(--status-info-bg)] p-5 shadow-[var(--shadow-card)] sm:p-6">
            {catalogLoading ? (
              <div className="space-y-3" aria-busy="true">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-7 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="mt-auto h-11 w-40" />
              </div>
            ) : priorityItem ? <>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Próxima ação</p>
                  <h3 className="mt-1 text-xl font-semibold tracking-tight text-[var(--text-primary)]">{priorityItem.applicationName}</h3>
                </div>
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-[var(--brand-primary)]">
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
                className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--brand-solid)] px-5 text-sm font-semibold text-[var(--text-on-brand)] shadow-sm transition hover:bg-[var(--brand-solid-hover)]"
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
        */}
        <article className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-card)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-subtle)] p-5 sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Sua jornada</p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Avaliações recentes</h2>
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
            ) : catalog.length ? (
              // Passou de 4 para 6: com a coluna ocupando a altura inteira, o
              // corte em 4 deixaria espaço sobrando justamente para quem tem
              // avaliações a mostrar.
              <ul className="divide-y divide-[var(--border-subtle)]">
                {catalog.slice(0, 6).map((item) => {
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
                          <small className="mt-1 block truncate text-xs text-[var(--text-secondary)]">{item.surveyName} · {item.questions} {item.questions === 1 ? "pergunta" : "perguntas"}</small>
                        </span>
                        <Badge variant={stateVariant(state)} className="hidden sm:inline-flex">{stateLabel(state)}</Badge>
                        <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--brand-primary)]" aria-hidden="true" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState
                className="m-5 border-0 shadow-none"
                icon={<Inbox className="h-6 w-6" aria-hidden="true" />}
                title="Nenhuma avaliação disponível"
                description="Assim que uma avaliação for liberada para o seu perfil, ela aparece aqui."
              />
            )}
        </article>

        {/*
          Atalhos como faixa de links, não como cartões: eles repetem destinos que
          já existem no menu lateral, então servem de conveniência — não competem
          com a próxima ação nem com a jornada.
        */}
        <nav aria-label="Acessos principais" className="flex flex-wrap gap-2">
          {actions.map(({ href, title, text, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              title={text}
              className="group inline-flex min-h-11 flex-1 items-center gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 py-2.5 text-sm font-semibold text-[var(--text-primary)] shadow-[var(--shadow-card)] transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] sm:min-w-52 sm:flex-none"
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
