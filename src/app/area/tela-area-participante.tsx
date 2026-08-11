"use client";

import { ArrowRight, BarChart3, CheckCircle2, CircleAlert, Clock3, FileText, ListChecks, Users2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";
import { FullPageState } from "@/components/full-page-state";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { ProgressMeter } from "@/components/platform-charts";
import { useSurveyCatalog } from "@/hooks/use-survey-catalog";
import { deadlineLabel, deadlineStatus } from "@/lib/deadline";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { selectPrioritySurvey, summarizeSurveyCatalog, surveyApplicationHref as applicationHref, surveyItemState as itemState } from "@/lib/survey-catalog";

function stateLabel(state: string) {
  if (state === "COMPLETED") return "Concluída";
  if (state === "IN_PROGRESS") return "Em andamento";
  if (state === "CLOSED") return "Encerrada";
  if (state === "SCHEDULED") return "Agendada";
  return "Pendente";
}

function dateLabel(value: string | null) {
  if (!value) return "Sem data definida";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

export default function ParticipantAreaPage() {
  // Sem módulo exigido: o Participante não tem Visão Geral, mas /area é o destino
  // padrão pós-login — a resposta correta é redirecionar para Avaliações.
  const guard = usePlatformGuard();
  const granted = guard.state === "granted";
  const router = useRouter();
  const catalogQuery = useSurveyCatalog(granted);
  const catalog = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const catalogLoading = catalogQuery.isLoading;

  const hasHomeModule = granted ? guard.modules.includes(PLATFORM_MODULE.HOME) : true;
  useEffect(() => {
    if (granted && !hasHomeModule) router.replace("/pesquisas");
  }, [granted, hasHomeModule, router]);

  const metrics = useMemo(() => summarizeSurveyCatalog(catalog), [catalog]);
  const priorityItem = useMemo(() => selectPrioritySurvey(catalog), [catalog]);

  if (guard.state !== "granted") {
    return <PlatformGuardState guard={guard} title="painel institucional" unidentifiedTitle="Não foi possível abrir seu painel" />;
  }

  const { context, modules, user } = guard;
  if (context.status !== "OK") {
    return <FullPageState title="Não foi possível abrir seu painel" description={context.message || "Cadastro institucional não localizado."} actionHref="/acesso" actionLabel="Voltar ao acesso" />;
  }
  if (!hasHomeModule) return <PlatformSkeleton title="Redirecionando para Avaliações" />;

  const isLeader = modules.includes(PLATFORM_MODULE.TEAM);
  const actions = [
    { href: "/pesquisas", title: "Avaliações", text: "Iniciar, continuar ou consultar", icon: FileText },
    ...(isLeader ? [{ href: "/equipe", title: "Minha equipe", text: "Acompanhar integrantes e avaliações", icon: Users2 }] : []),
    ...(modules.includes(PLATFORM_MODULE.RESULTS) ? [{ href: "/resultados", title: "Resultados", text: "Consultar devolutivas e indicadores", icon: BarChart3 }] : []),
  ];

  const priorityDeadline = priorityItem ? deadlineStatus(priorityItem.closesAt, new Date()) : null;
  const priorityDeadlineLabel = priorityDeadline && (priorityDeadline.state === "counting" || priorityDeadline.state === "today") ? deadlineLabel(priorityDeadline) : null;
  const completionPercentage = metrics.total ? Math.round((metrics.completed / metrics.total) * 100) : 0;

  const indicators = [
    { label: "Pendentes", value: metrics.pending, icon: ListChecks, tone: "brand", iconTone: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]" },
    { label: "Em andamento", value: metrics.inProgress, icon: Clock3, tone: "warning", iconTone: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]" },
    { label: "Concluídas", value: metrics.completed, icon: CheckCircle2, tone: "success", iconTone: "bg-[var(--status-success-bg)] text-[var(--status-success-text)]" },
    { label: "Disponíveis", value: metrics.total, icon: FileText, tone: "cyan", iconTone: "bg-[var(--surface-muted)] text-[var(--brand-primary)]" },
  ];

  return (
    <PlatformShell user={user} eyebrow="Ambiente institucional" title="Visão geral">
      <div className="tech-workspace w-full space-y-4">
        <section className="area-overview-header enterprise-panel">
          <div className="min-w-0">
            <p className="section-eyebrow">Visão geral</p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-[var(--text-primary)] sm:text-2xl">Acompanhamento das avaliações</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Situação atual dos instrumentos disponíveis para o seu perfil.</p>
          </div>
          <div className="area-overview-progress flex items-center gap-3">
              <div className="relative grid h-12 w-12 shrink-0 place-items-center text-[var(--brand-primary)]" role="img" aria-label={`${completionPercentage}% das avaliações concluídas`}>
                <svg viewBox="0 0 44 44" className="h-full w-full -rotate-90" aria-hidden="true">
                  <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="4" className="text-[var(--border-strong)]" />
                  <circle cx="22" cy="22" r="18" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" pathLength="100" strokeDasharray={`${completionPercentage} 100`} />
                </svg>
                <strong className="absolute text-[11px] font-black tabular-nums text-[var(--text-primary)]">{catalogLoading ? "—" : `${completionPercentage}%`}</strong>
              </div>
              <div className="min-w-0">
                <span className="block text-[10px] font-black uppercase tracking-[.12em] text-[var(--text-muted)]">Progresso do catálogo</span>
                <strong className="mt-0.5 block text-sm text-[var(--text-primary)]">{catalogLoading ? "Carregando" : `${metrics.completed} de ${metrics.total} concluídas`}</strong>
                <span className="mt-0.5 block text-[11px] text-[var(--text-secondary)]">Atualizado automaticamente</span>
              </div>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo das suas avaliações">
          {indicators.map(({ label, value, icon: Icon, tone, iconTone }) => (
            <article key={label} data-tone={tone} className="area-kpi flex items-center gap-3 p-4">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${iconTone}`}><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-xs font-bold text-[var(--text-secondary)]">{label}</span>
                <strong className="mt-0.5 block text-2xl font-black tabular-nums tracking-tight text-[var(--text-primary)]">{catalogLoading ? "—" : value}</strong>
              </span>
            </article>
          ))}
        </section>

        <div className="flex flex-wrap items-end justify-between gap-3 pt-1">
          <div>
            <p className="section-eyebrow">Rotinas diárias</p>
            <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">O que precisa da sua atenção</h2>
          </div>
          <Link href="/pesquisas" className="inline-flex items-center gap-2 text-sm font-black text-[var(--brand-primary)] hover:underline">Ver todas as avaliações <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-12 lg:items-stretch">
          <div className="contents">
            {catalogLoading ? (
              <div className="h-48 animate-pulse rounded-2xl bg-[var(--surface-card)] ring-1 ring-[var(--border-subtle)] lg:order-1 lg:col-span-8" aria-hidden="true" />
            ) : priorityItem ? (
              <section className="tech-panel enterprise-panel lg:order-1 lg:col-span-8">
                <div className="h-1 bg-[var(--brand-solid)]" aria-hidden="true" />
                <div className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <p className="section-eyebrow">Rotina prioritária</p>
                  {priorityDeadlineLabel ? <span className="inline-flex items-center rounded-full bg-[var(--status-warning-bg)] px-2.5 py-1 text-[11px] font-black text-[var(--status-warning-text)]">{priorityDeadlineLabel}</span> : null}
                </div>
                <h3 className="mt-2 break-words text-2xl font-black leading-snug text-[var(--text-primary)]">{priorityItem.applicationName}</h3>
                <p className="mt-2 line-clamp-2 break-words text-sm leading-6 text-[var(--text-secondary)]">{priorityItem.description || priorityItem.surveyName}</p>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-subtle)] pt-4">
                  <span className="text-xs text-[var(--text-secondary)]">Prazo · <strong className="text-[var(--text-primary)]">{dateLabel(priorityItem.closesAt)}</strong></span>
                  <Link href={applicationHref(priorityItem)} className="primary-button">{itemState(priorityItem) === "IN_PROGRESS" ? "Continuar" : "Abrir avaliação"}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
                </div>
                </div>
              </section>
            ) : (
              <section className="tech-panel enterprise-panel p-5 lg:order-1 lg:col-span-8">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success-text)]"><CheckCircle2 className="h-5 w-5" aria-hidden="true" /></span>
                <h3 className="mt-3 text-xl font-black text-[var(--text-primary)]">Tudo em dia</h3>
                <p className="mt-1 max-w-md text-sm leading-6 text-[var(--text-secondary)]">Você não tem ações pendentes. Novos instrumentos aparecerão aqui quando forem liberados.</p>
              </section>
            )}

            <section className="tech-panel enterprise-panel lg:order-3 lg:col-span-8">
              <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] p-5">
                <div><p className="section-eyebrow">Sua jornada</p><h3 className="mt-1 text-lg font-black text-[var(--text-primary)]">Instrumentos recentes</h3></div>
                <Link href="/pesquisas" className="shrink-0 text-sm font-black text-[var(--brand-primary)] hover:underline">Ver catálogo →</Link>
              </div>
              {catalogLoading ? (
                <div className="space-y-3 p-5">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="h-16 animate-pulse rounded-xl bg-[var(--surface-muted)]" />)}</div>
              ) : catalog.length ? (
                <ul className="divide-y divide-[var(--border-subtle)]">
                  {catalog.slice(0, 4).map((item) => {
                    const state = itemState(item);
                    const done = state === "COMPLETED";
                    return (
                      <li key={item.applicationId}>
                        <Link href={applicationHref(item)} className="flex items-center gap-4 p-4 transition hover:bg-[var(--surface-muted)]">
                          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${done ? "bg-[var(--status-success-bg)] text-[var(--status-success-text)]" : "bg-[var(--surface-muted)] text-[var(--brand-primary)]"}`}>{done ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <FileText className="h-5 w-5" aria-hidden="true" />}</span>
                          <span className="min-w-0 flex-1"><strong className="block truncate text-sm text-[var(--text-primary)]">{item.applicationName}</strong><small className="block truncate text-xs text-[var(--text-secondary)]">{item.surveyName} · {item.questions} perguntas</small></span>
                          <span className="hidden shrink-0 rounded-full border border-[var(--border-subtle)] px-3 py-1 text-[11px] font-black text-[var(--text-secondary)] sm:inline">{stateLabel(state)}</span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="p-10 text-center text-[var(--text-secondary)]"><CircleAlert className="mx-auto h-9 w-9 text-[var(--text-muted)]" aria-hidden="true" /><p className="mt-3 font-bold">Nenhuma avaliação disponível no momento.</p></div>
              )}
            </section>
          </div>

          <div className="contents">
            <section className="tech-panel enterprise-panel p-4 lg:order-2 lg:col-span-4">
              <div className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--status-info-bg)] text-[var(--status-info-text)]"><BarChart3 className="h-5 w-5" aria-hidden="true" /></span><div><p className="section-eyebrow">Desempenho</p><h3 className="text-lg font-black text-[var(--text-primary)]">Sua jornada</h3></div></div>
              <div className="mt-5"><ProgressMeter label="Avaliações concluídas" value={metrics.completed} total={metrics.total} description="Progresso no catálogo disponível" /></div>
              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[var(--border-subtle)] pt-4 text-sm">
                <div><span className="block text-xs text-[var(--text-muted)]">Em aberto</span><strong className="mt-1 block text-lg tabular-nums text-[var(--text-primary)]">{catalogLoading ? "—" : metrics.pending + metrics.inProgress}</strong></div>
                <div><span className="block text-xs text-[var(--text-muted)]">Próximo prazo</span><strong className="mt-1 block text-xs leading-6 text-[var(--text-primary)]">{priorityItem ? dateLabel(priorityItem.closesAt) : "Sem prazo"}</strong></div>
              </div>
            </section>

            <section className="tech-panel enterprise-panel p-4 lg:order-4 lg:col-span-4">
              <p className="section-eyebrow">Acessos</p>
              <h3 className="mt-1 text-lg font-black text-[var(--text-primary)]">Ações rápidas</h3>
              <div className="mt-4 grid gap-2.5">
                {actions.map(({ href, title, text, icon: Icon }) => (
                  <Link key={href} href={href} className="flex items-center gap-3 rounded-xl border border-[var(--border-subtle)] p-3.5 transition hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--surface-muted)] text-[var(--brand-primary)]"><Icon className="h-5 w-5" aria-hidden="true" /></span>
                    <span className="min-w-0"><strong className="block text-sm text-[var(--text-primary)]">{title}</strong><small className="block text-xs text-[var(--text-secondary)]">{text}</small></span>
                    <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-[var(--text-muted)]" aria-hidden="true" />
                  </Link>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </PlatformShell>
  );
}
