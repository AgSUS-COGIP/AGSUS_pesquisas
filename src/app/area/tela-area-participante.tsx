"use client";

import { ArrowRight, BarChart3, CalendarClock, CheckCircle2, FileText, Inbox, LayoutDashboard, Users2 } from "lucide-react";
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
import { formatDateTimePtBr } from "@/lib/date-format";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { selectPrioritySurvey, summarizeSurveyCatalog, surveyApplicationHref as applicationHref, surveyItemState as itemState } from "@/lib/survey-catalog";

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

const dateLabel = (value: string | null) => formatDateTimePtBr(value, "Sem data definida");

/** Dias restantes até o prazo — o número que decide a urgência da próxima ação. */
function daysUntil(value: string | null) {
  if (!value) return null;
  const diff = new Date(value).getTime() - Date.now();
  if (Number.isNaN(diff) || diff < 0) return null;
  return Math.ceil(diff / 86_400_000);
}

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
    ...(modules.includes(PLATFORM_MODULE.RESULTS) ? [{ href: "/resultados", title: "Resultados", text: "Consultar devolutivas e indicadores", icon: BarChart3 }] : []),
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

  const priorityDeadline = priorityItem ? daysUntil(priorityItem.closesAt) : null;

  return (
    <PlatformShell user={user} eyebrow="Ambiente institucional" title="Visão geral">
      <div className="mx-auto w-full max-w-[1400px] space-y-5">
        <section className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(340px,.9fr)]">
          <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-card)]">
            <div className="flex items-start gap-4">
              <PersonAvatar fullName={person.fullName} avatarUrl={person.avatarUrl} className="h-14 w-14 rounded-2xl" fallbackClassName="text-lg" />
              <div className="min-w-0">
                <p className="text-sm text-[var(--text-secondary)]">{salutation},</p>
                <h2 className="mt-0.5 text-2xl font-semibold tracking-tight text-[var(--text-primary)] sm:text-3xl">{firstName}</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Veja o que precisa da sua atenção e acompanhe sua jornada em um só lugar.</p>
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {metricTiles.map((tile) => {
                // Urgência muda a cor do cartão, mas o texto continua dizendo o
                // motivo — cor nunca é o único indicador de estado.
                const highlight = !catalogLoading && tile.alert;
                return (
                  <div
                    key={tile.label}
                    className={`rounded-xl border p-3.5 ${highlight
                      ? "border-[var(--status-warning-border)] bg-[var(--status-warning-bg)]"
                      : "border-[var(--border-subtle)] bg-[var(--surface-muted)]"}`}
                  >
                    <dt className={`text-xs font-semibold uppercase tracking-[.1em] ${highlight ? "text-[var(--status-warning-text)]" : "text-[var(--text-secondary)]"}`}>{tile.label}</dt>
                    <dd>
                      <strong className={`mt-1.5 block text-2xl font-semibold tabular-nums ${highlight ? "text-[var(--status-warning-text)]" : "text-[var(--brand-primary)]"}`}>{catalogLoading ? "—" : tile.value}</strong>
                      <span className={`mt-0.5 block text-[11px] leading-4 ${highlight ? "text-[var(--status-warning-text)]" : "text-[var(--text-muted)]"}`}>{catalogLoading ? "carregando" : tile.description}</span>
                    </dd>
                  </div>
                );
              })}
            </dl>
          </article>

          <aside aria-label="Próxima ação" className="flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-6 shadow-[var(--shadow-card)]">
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

              <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-3">
                <p className="text-xs font-semibold uppercase tracking-[.1em] text-[var(--text-secondary)]">Prazo</p>
                <p className="mt-1 text-sm font-semibold text-[var(--text-primary)]">{dateLabel(priorityItem.closesAt)}</p>
                {priorityDeadline !== null && (
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">
                    {priorityDeadline === 0 ? "Encerra hoje." : `Faltam ${priorityDeadline} ${priorityDeadline === 1 ? "dia" : "dias"}.`}
                  </p>
                )}
              </div>

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

        <section className="grid items-start gap-5 xl:grid-cols-[minmax(320px,.8fr)_minmax(0,1.2fr)]">
          <aside aria-label="Acessos principais" className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)] sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Ações rápidas</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight text-[var(--text-primary)]">Acessos principais</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {actions.map(({ href, title, text, icon: Icon }) => (
                <li key={href}>
                  <Link href={href} className="group flex h-full flex-col rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] p-4 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]">
                    <div className="flex items-start justify-between gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-lg bg-[var(--surface-card)] text-[var(--brand-primary)]">
                        <Icon className="h-5 w-5" aria-hidden="true" />
                      </span>
                      <ArrowRight className="h-4 w-4 text-[var(--text-muted)] transition group-hover:translate-x-1 group-hover:text-[var(--brand-primary)]" aria-hidden="true" />
                    </div>
                    <strong className="mt-3 block text-sm font-semibold text-[var(--text-primary)]">{title}</strong>
                    <small className="mt-1 block text-xs leading-5 text-[var(--text-secondary)]">{text}</small>
                  </Link>
                </li>
              ))}
            </ul>
          </aside>

          <article className="overflow-hidden rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] shadow-[var(--shadow-card)]">
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
              <ul className="divide-y divide-[var(--border-subtle)]">
                {catalog.slice(0, 4).map((item) => {
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
        </section>
      </div>
    </PlatformShell>
  );
}
