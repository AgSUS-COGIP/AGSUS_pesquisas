"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, FileText, Gauge, Radio } from "lucide-react";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader, Surface } from "@/components/ui/surface";
import { formatDatePtBr } from "@/lib/date-format";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type ManagedSurvey = {
  surveyId: string;
  code: string;
  name: string;
  description: string | null;
  status: string;
  applicationId: string | null;
  applicationCode: string | null;
  applicationName: string | null;
  applicationStatus: string | null;
  opensAt: string | null;
  closesAt: string | null;
  sections: number;
  questions: number;
  updatedAt: string;
};

const formatDate = (value: string | null) => formatDatePtBr(value, "Sem data definida");

function isCddiSurvey(survey: ManagedSurvey) {
  return survey.code.trim().toUpperCase() === "CDDI"
    || survey.applicationCode?.trim().toUpperCase().startsWith("CDDI-") === true;
}

async function fetchManagedSurveys() {
  const supabase = createBrowserSupabaseClient();
  const { data, error } = await supabase.rpc("list_managed_surveys");
  if (error) throw error;
  return (data ?? []) as ManagedSurvey[];
}

export default function DashboardsPage() {
  const guard = usePlatformGuard(PLATFORM_MODULE.DASHBOARDS);
  // Consulta só depois da guarda: `list_managed_surveys` é restrita à
  // administração, e disparar antes renderia um erro de RLS numa tela que já
  // seria negada de qualquer forma.
  const surveysQuery = useQuery({
    queryKey: ["dashboards", "managed-surveys"],
    queryFn: fetchManagedSurveys,
    enabled: guard.state === "granted",
    staleTime: 60_000,
  });
  const surveys = useMemo(() => surveysQuery.data ?? [], [surveysQuery.data]);

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="painéis"
      restrictedTitle="Painéis restritos"
      restrictedDescription="O módulo Painéis está disponível para a administração da plataforma."
    />;
  }

  if (surveysQuery.isLoading) return <PlatformSkeleton title="Carregando painéis" />;

  const { user } = guard;

  const dashboardSurveys = surveys.filter((survey) => (
    survey.applicationCode
    && survey.applicationId
    && !isCddiSurvey(survey)
  ));
  const openDashboards = dashboardSurveys.filter((survey) => survey.applicationStatus === "OPEN").length;
  const closedDashboards = dashboardSurveys.filter((survey) => survey.applicationStatus === "CLOSED").length;

  return (
    <PlatformShell user={user} eyebrow="Visualizações autorizadas" title="Painéis">
      <div className="monitor-dashboard">
      <div className="monitor-topbar p-5">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <PageHeader
            eyebrow="Indicadores e análises"
            title="Central de indicadores"
            description="Acompanhe participação, conclusão e distribuição das respostas. Esta área é exclusivamente analítica; para preencher instrumentos, acesse Avaliações."
          />
          <div className="grid shrink-0 grid-cols-3 gap-2" aria-label="Resumo dos painéis">
            {[[dashboardSurveys.length, "Disponíveis"], [openDashboards, "Em andamento"], [closedDashboards, "Encerrados"]].map(([value, label]) => <div key={label} className="min-w-28 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-muted)] px-4 py-3 text-center"><strong className="block text-2xl font-black tabular-nums text-[var(--brand-primary)]">{value}</strong><span className="mt-0.5 block text-[11px] font-bold text-[var(--text-secondary)]">{label}</span></div>)}
          </div>
        </div>
      </div>

      <section className="mt-6" aria-labelledby="institutional-dashboard-title">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-eyebrow">Acompanhamento institucional</p>
            <h2 id="institutional-dashboard-title" className="mt-1 text-xl font-black text-[var(--text-primary)]">Painel CDDI</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Indicadores consolidados do ciclo, sem acesso ao formulário de resposta.</p>
          </div>
          <Link href="/pesquisas" className="secondary-button w-fit">Ir para formulários</Link>
        </div>

        <Surface className="monitor-panel overflow-hidden p-0">
          <Link href="/paineis/cddi" className="group flex flex-col gap-4 p-5 transition hover:bg-[var(--surface-interactive)] sm:flex-row sm:items-center">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--status-info-bg)] text-[var(--status-info-text)]"><Activity className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2"><strong className="text-lg text-[var(--text-primary)]">AgSUS Monitora CDDI</strong><Badge variant="info"><Radio className="h-3.5 w-3.5" />Institucional</Badge></span>
              <span className="mt-1 block text-sm leading-6 text-[var(--text-secondary)]">Competências, evolução das respostas, situação dos participantes e acompanhamento operacional do ciclo.</span>
            </span>
            <span className="inline-flex shrink-0 items-center gap-2 text-sm font-black text-[var(--brand-primary)]">Abrir painel <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></span>
          </Link>
        </Surface>
      </section>

      <section className="mt-6" aria-labelledby="survey-dashboard-title">
        <div className="mb-4">
          <p className="section-eyebrow">Resultados por instrumento</p>
          <h2 id="survey-dashboard-title" className="mt-1 text-xl font-black text-[var(--text-primary)]">Painéis por avaliação</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Cada cartão abaixo abre dados e resultados. Nenhum deles inicia ou continua o preenchimento.</p>
        </div>

        {dashboardSurveys.length ? (
          <Surface className="monitor-panel divide-y divide-[var(--border-subtle)] overflow-hidden p-0">
            {dashboardSurveys.map((survey) => (
              <Link key={survey.applicationId} href={`/paineis/${encodeURIComponent(survey.applicationCode!)}`} className="group flex flex-col gap-4 p-5 transition hover:bg-[var(--surface-interactive)] lg:flex-row lg:items-center">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--surface-interactive)] text-[var(--brand-primary)]"><Gauge className="h-5 w-5" /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <strong className="text-base text-[var(--text-primary)]">{survey.applicationName || survey.name}</strong>
                    <Badge variant={survey.applicationStatus === "OPEN" ? "success" : "neutral"}>
                    {survey.applicationStatus === "OPEN" ? "Recebendo respostas" : "Ciclo encerrado"}
                    </Badge>
                  </span>
                  <span className="mt-1 block text-sm leading-6 text-[var(--text-secondary)]">{survey.description || "Resultados consolidados da avaliação institucional."}</span>
                </span>
                <span className="flex shrink-0 flex-wrap gap-2 text-xs text-[var(--text-secondary)] lg:max-w-72 lg:justify-end">
                  <span>{survey.sections} seção(ões)</span>
                  <span>·</span>
                  <span>{survey.questions} pergunta(s)</span>
                  <span>·</span>
                  <span>ciclo até {formatDate(survey.closesAt)}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-[var(--brand-primary)] transition group-hover:translate-x-1" />
              </Link>
            ))}
          </Surface>
        ) : (
          <Surface className="monitor-panel p-5">
            <EmptyState
              icon={<FileText className="h-6 w-6" aria-hidden="true" />}
              title="Nenhum painel adicional disponível"
              description={surveysQuery.isError && surveysQuery.error instanceof Error ? surveysQuery.error.message : "Os formulários publicados continuam na área Avaliações. Um cartão só aparecerá aqui quando houver uma visualização analítica correspondente."}
              action={<Link href="/pesquisas" className="secondary-button">Abrir formulários</Link>}
            />
          </Surface>
        )}
      </section>
      </div>
    </PlatformShell>
  );
}
