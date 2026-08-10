"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, ArrowRight, FileText, Gauge, Radio } from "lucide-react";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { FullPageState } from "@/components/full-page-state";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader, Surface } from "@/components/ui/surface";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
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

function formatDate(value: string | null) {
  if (!value) return "Sem data definida";
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value));
}

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
  const { context, loading: contextLoading, error: contextError } = usePlatformContext();
  const surveysQuery = useQuery({
    queryKey: ["dashboards", "managed-surveys"],
    queryFn: fetchManagedSurveys,
    enabled: Boolean(context?.person),
    staleTime: 60_000,
  });
  const surveys = useMemo(() => surveysQuery.data ?? [], [surveysQuery.data]);

  const modules = useMemo(() => context ? deriveModules(context) : [], [context]);

  if (contextLoading || surveysQuery.isLoading) return <PlatformSkeleton title="Carregando painéis" />;
  if (!context?.person) return <main className="p-10 text-red-700">{contextError || "Acesso não identificado."}</main>;
  if (!modules.includes(PLATFORM_MODULE.DASHBOARDS)) {
    return <FullPageState tone="restricted" title="Painéis restritos" description="O módulo Painéis está disponível para a administração da plataforma." />;
  }

  const user = {
    fullName: context.person.fullName,
    institutionalEmail: context.person.institutionalEmail,
    employeeNumber: context.person.employeeNumber,
    avatarUrl: context.person.avatarUrl,
    profileLabel: profileLabel(context),
    roles: context.roles,
    modules,
  };

  const dashboardSurveys = surveys.filter((survey) => (
    survey.applicationCode
    && survey.applicationId
    && !isCddiSurvey(survey)
  ));
  const openDashboards = dashboardSurveys.filter((survey) => survey.applicationStatus === "OPEN").length;
  const closedDashboards = dashboardSurveys.filter((survey) => survey.applicationStatus === "CLOSED").length;

  return (
    <PlatformShell user={user} eyebrow="Visualizações autorizadas" title="Painéis">
      <PageHeader
        eyebrow="Indicadores e análises"
        title="Central de indicadores"
        description="Acompanhe participação, conclusão e distribuição das respostas. Esta área é exclusivamente analítica; para preencher instrumentos, acesse Avaliações."
      />

      <Surface className="mt-6 overflow-hidden">
        <div className="grid lg:grid-cols-[minmax(0,1.25fr)_minmax(420px,.75fr)]">
          <div className="p-6 sm:p-7"><p className="section-eyebrow">Visão executiva</p><h2 className="mt-2 max-w-2xl text-2xl font-black text-[var(--text-primary)]">Dados para decidir, não apenas números para consultar</h2><p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-secondary)]">Cada painel mostra o avanço do ciclo, as pendências operacionais e a distribuição das respostas com atualização controlada.</p></div>
          <div className="grid grid-cols-3 border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] lg:border-l lg:border-t-0">
            {[[dashboardSurveys.length, "Disponíveis"], [openDashboards, "Em andamento"], [closedDashboards, "Encerrados"]].map(([value, label]) => <div key={label} className="flex flex-col justify-center border-r border-[var(--border-subtle)] p-4 text-center last:border-r-0"><strong className="text-2xl font-black text-[var(--brand-primary)]">{value}</strong><span className="mt-1 text-[11px] font-bold text-[var(--text-secondary)]">{label}</span></div>)}
          </div>
        </div>
      </Surface>

      <section className="mt-6" aria-labelledby="institutional-dashboard-title">
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="section-eyebrow">Acompanhamento institucional</p>
            <h2 id="institutional-dashboard-title" className="mt-1 text-xl font-black text-[var(--text-primary)]">Painel CDDI</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Indicadores consolidados do ciclo, sem acesso ao formulário de resposta.</p>
          </div>
          <Link href="/pesquisas" className="secondary-button w-fit">Ir para formulários</Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Surface className="group flex flex-col overflow-hidden p-0 transition hover:-translate-y-0.5 hover:border-sky-400/50 hover:shadow-lg">
            <div className="h-1.5 bg-[linear-gradient(90deg,var(--brand-solid),var(--brand-secondary))]" />
            <div className="flex flex-1 flex-col p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Activity className="h-5 w-5" /></div>
              <Badge variant="info"><Radio className="h-3.5 w-3.5" />Painel institucional</Badge>
            </div>
            <h3 className="mt-4 text-lg font-black text-[var(--text-primary)]">AgSUS Monitora CDDI</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-[var(--text-secondary)]">Competências, evolução das respostas, situação dos participantes e acompanhamento operacional do ciclo.</p>
            <Link href="/paineis/cddi" className="primary-button mt-5 w-full justify-center">Abrir painel completo<ArrowRight className="h-4 w-4" /></Link>
            </div>
          </Surface>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="survey-dashboard-title">
        <div className="mb-4">
          <p className="section-eyebrow">Resultados por instrumento</p>
          <h2 id="survey-dashboard-title" className="mt-1 text-xl font-black text-[var(--text-primary)]">Painéis por avaliação</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Cada cartão abaixo abre dados e resultados. Nenhum deles inicia ou continua o preenchimento.</p>
        </div>

        {dashboardSurveys.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dashboardSurveys.map((survey) => (
              <Surface key={survey.applicationId} className="group flex flex-col p-5 transition hover:-translate-y-0.5 hover:border-sky-400/50 hover:shadow-lg">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-700"><Gauge className="h-5 w-5" /></div>
                  <Badge variant={survey.applicationStatus === "OPEN" ? "success" : "neutral"}>
                    {survey.applicationStatus === "OPEN" ? "Recebendo respostas" : "Ciclo encerrado"}
                  </Badge>
                </div>
                <p className="mt-4 text-xs font-black uppercase tracking-[.14em] text-[var(--brand-secondary)]">Painel analítico · {survey.code}</p>
                <h3 className="mt-1 text-lg font-black text-[var(--text-primary)]">{survey.applicationName || survey.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-[var(--text-secondary)]">{survey.description || "Resultados consolidados da avaliação institucional."}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                  <span>{survey.sections} seção(ões)</span>
                  <span>·</span>
                  <span>{survey.questions} pergunta(s)</span>
                  <span>·</span>
                  <span>ciclo até {formatDate(survey.closesAt)}</span>
                </div>
                <Link href={`/paineis/${encodeURIComponent(survey.applicationCode!)}`} className="primary-button mt-5 w-full justify-center">
                  Ver indicadores<ArrowRight className="h-4 w-4" />
                </Link>
              </Surface>
            ))}
          </div>
        ) : (
          <Surface className="p-5">
            <EmptyState
              icon={<FileText className="h-6 w-6" aria-hidden="true" />}
              title="Nenhum painel adicional disponível"
              description={surveysQuery.isError && surveysQuery.error instanceof Error ? surveysQuery.error.message : "Os formulários publicados continuam na área Avaliações. Um cartão só aparecerá aqui quando houver uma visualização analítica correspondente."}
              action={<Link href="/pesquisas" className="secondary-button">Abrir formulários</Link>}
            />
          </Surface>
        )}
      </section>
    </PlatformShell>
  );
}
