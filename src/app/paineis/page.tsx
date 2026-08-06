"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Activity, BarChart3, FileText } from "lucide-react";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader, Surface } from "@/components/ui/surface";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
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

export default function DashboardsPage() {
  const { context, loading: contextLoading, error: contextError } = usePlatformContext();
  const [surveys, setSurveys] = useState<ManagedSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!context?.person) return;
    let active = true;

    async function loadSurveys() {
      const supabase = createBrowserSupabaseClient();
      const { data, error: surveysError } = await supabase.rpc("list_managed_surveys");
      if (!active) return;
      if (surveysError) {
        setError(surveysError.message);
        setSurveys([]);
      } else {
        setSurveys((data ?? []) as ManagedSurvey[]);
      }
      setLoading(false);
    }

    void loadSurveys();
    return () => { active = false; };
  }, [context?.person]);

  const modules = useMemo(() => context ? deriveModules(context) : [], [context]);

  if (contextLoading || loading) return <PlatformSkeleton title="Carregando painéis" />;
  if (!context?.person) return <main className="p-10 text-red-700">{contextError || "Acesso não identificado."}</main>;

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

  return (
    <PlatformShell user={user} eyebrow="Visualizações autorizadas" title="Painéis">
      <PageHeader
        eyebrow="Indicadores e análises"
        title="Painéis de dados"
        description="Esta área reúne somente visualizações analíticas. Para responder, continuar ou consultar um formulário, use a área Formulários."
      />

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
          <Surface className="flex flex-col p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Activity className="h-5 w-5" /></div>
              <Badge variant="info">Painel analítico</Badge>
            </div>
            <h3 className="mt-4 text-lg font-black text-[var(--text-primary)]">AgSUS Monitora CDDI</h3>
            <p className="mt-2 flex-1 text-sm leading-6 text-[var(--text-secondary)]">Competências, evolução das respostas, situação dos participantes e acompanhamento operacional do ciclo.</p>
            <Link href="/paineis/cddi" className="primary-button mt-5 w-full justify-center">Ver indicadores do CDDI</Link>
          </Surface>
        </div>
      </section>

      <section className="mt-8" aria-labelledby="survey-dashboard-title">
        <div className="mb-4">
          <p className="section-eyebrow">Resultados por instrumento</p>
          <h2 id="survey-dashboard-title" className="mt-1 text-xl font-black text-[var(--text-primary)]">Painéis por pesquisa</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Cada cartão abaixo abre dados e resultados. Nenhum deles inicia ou continua o preenchimento.</p>
        </div>

        {dashboardSurveys.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {dashboardSurveys.map((survey) => (
              <Surface key={survey.applicationId} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-violet-50 text-violet-700"><BarChart3 className="h-5 w-5" /></div>
                  <Badge variant={survey.applicationStatus === "OPEN" ? "success" : "neutral"}>
                    {survey.applicationStatus === "OPEN" ? "Recebendo respostas" : "Ciclo encerrado"}
                  </Badge>
                </div>
                <p className="mt-4 text-xs font-black uppercase tracking-[.14em] text-[var(--brand-secondary)]">Painel analítico · {survey.code}</p>
                <h3 className="mt-1 text-lg font-black text-[var(--text-primary)]">{survey.applicationName || survey.name}</h3>
                <p className="mt-2 flex-1 text-sm leading-6 text-[var(--text-secondary)]">{survey.description || "Resultados consolidados da pesquisa institucional."}</p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text-secondary)]">
                  <span>{survey.sections} seção(ões)</span>
                  <span>·</span>
                  <span>{survey.questions} pergunta(s)</span>
                  <span>·</span>
                  <span>ciclo até {formatDate(survey.closesAt)}</span>
                </div>
                <Link href={`/paineis/${encodeURIComponent(survey.applicationCode!)}`} className="primary-button mt-5 w-full justify-center">
                  Ver indicadores
                </Link>
              </Surface>
            ))}
          </div>
        ) : (
          <Surface className="p-5">
            <EmptyState
              icon={<FileText className="h-6 w-6" aria-hidden="true" />}
              title="Nenhum painel adicional disponível"
              description={error || "Os formulários publicados continuam na área Formulários. Um cartão só aparecerá aqui quando houver uma visualização analítica correspondente."}
              action={<Link href="/pesquisas" className="secondary-button">Abrir formulários</Link>}
            />
          </Surface>
        )}
      </section>
    </PlatformShell>
  );
}
