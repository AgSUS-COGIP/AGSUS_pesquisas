"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BarChart3 } from "lucide-react";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader, StatCard, Surface } from "@/components/ui/surface";
import { deriveModules, profileLabel, usePlatformContext } from "@/lib/platform-context";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type DashboardOption = { id: string; label: string; value: string; count: number };
type TextResponse = { text: string; submittedAt: string | null };
type DashboardQuestion = {
  id: string;
  code: string;
  title: string;
  description: string | null;
  type: string;
  position: number;
  sectionTitle: string;
  responseCount: number;
  options: DashboardOption[];
  textResponses: TextResponse[];
};
type DashboardData = {
  generatedAt: string;
  application: {
    code: string;
    name: string;
    status: string;
    opensAt: string | null;
    closesAt: string | null;
    surveyCode: string;
    surveyName: string;
    surveyDescription: string | null;
    versionNumber: number;
  };
  summary: {
    totalParticipants: number;
    drafts: number;
    submitted: number;
    notStarted: number;
    completionRate: number;
  };
  questions: DashboardQuestion[];
};

function formatDate(value: string | null) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function OptionDistribution({ options }: { options: DashboardOption[] }) {
  const total = options.reduce((sum, option) => sum + Number(option.count || 0), 0);
  if (!options.length) return null;

  return (
    <div className="mt-5 space-y-3">
      {options.map((option) => {
        const count = Number(option.count || 0);
        const percentage = total ? Math.round((count / total) * 100) : 0;
        return (
          <div key={option.id}>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className="font-bold text-[var(--text-primary)]">{option.label}</span>
              <span className="shrink-0 text-[var(--text-secondary)]">{count} · {percentage}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
              <div className="h-full rounded-full bg-[var(--brand-primary)] transition-[width]" style={{ width: `${percentage}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function SurveyDashboardPage() {
  const params = useParams<{ applicationCode: string }>();
  const applicationCode = decodeURIComponent(params.applicationCode);
  const { context, loading: contextLoading, error: contextError } = usePlatformContext();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!context?.person) return;
    let active = true;

    async function loadDashboard() {
      setLoading(true);
      setError("");
      const supabase = createBrowserSupabaseClient();
      const { data, error: dashboardError } = await supabase.rpc("get_survey_dashboard", {
        target_application_code: applicationCode,
      });

      if (!active) return;
      if (dashboardError) {
        setError(dashboardError.message);
        setDashboard(null);
      } else {
        setDashboard(data as DashboardData);
      }
      setLoading(false);
    }

    void loadDashboard();
    return () => { active = false; };
  }, [applicationCode, context?.person]);

  const modules = useMemo(() => context ? deriveModules(context) : [], [context]);

  if (contextLoading || loading) return <PlatformSkeleton title="Carregando painel da pesquisa" />;
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

  if (!dashboard) {
    return (
      <PlatformShell user={user} eyebrow="Painéis" title="Pesquisa indisponível">
        <Surface className="p-6">
          <EmptyState
            icon={<BarChart3 className="h-6 w-6" aria-hidden="true" />}
            title="Não foi possível abrir este painel"
            description={error || "A pesquisa não possui dados disponíveis ou seu perfil não tem acesso."}
            action={<Link href="/paineis" className="secondary-button">Voltar aos painéis</Link>}
          />
        </Surface>
      </PlatformShell>
    );
  }

  const { application, summary, questions } = dashboard;

  return (
    <PlatformShell user={user} eyebrow={application.surveyCode} title={application.name}>
      <Link href="/paineis" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--brand-primary)]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Todos os painéis
      </Link>

      <PageHeader
        eyebrow="Acompanhamento em tempo real"
        title={application.surveyName}
        description={application.surveyDescription || "Indicadores operacionais e respostas consolidadas desta pesquisa."}
        actions={<Badge variant={application.status === "OPEN" ? "success" : "neutral"}>{application.status === "OPEN" ? "Período aberto" : application.status}</Badge>}
      />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Participantes" value={summary.totalParticipants} description="Público vinculado" />
        <StatCard label="Enviadas" value={summary.submitted} description={`${summary.completionRate}% de conclusão`} />
        <StatCard label="Rascunhos" value={summary.drafts} description="Preenchimentos iniciados" />
        <StatCard label="Não iniciadas" value={summary.notStarted} description="Ainda sem resposta" />
      </div>

      <Surface className="mt-6 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <p className="section-eyebrow">Ciclo e atualização</p>
            <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">{application.name}</h2>
          </div>
          <div className="text-sm text-[var(--text-secondary)] sm:text-right">
            <p>Abertura: {formatDate(application.opensAt)}</p>
            <p>Encerramento: {formatDate(application.closesAt)}</p>
            <p>Atualizado: {formatDate(dashboard.generatedAt)}</p>
          </div>
        </div>
      </Surface>

      <div className="mt-6 space-y-5">
        {questions.map((question, index) => (
          <Surface key={question.id} className="p-5 sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="section-eyebrow">{question.sectionTitle} · Pergunta {index + 1}</p>
                <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">{question.title}</h2>
                {question.description ? <p className="mt-2 text-sm text-[var(--text-secondary)]">{question.description}</p> : null}
              </div>
              <Badge variant="neutral">{question.responseCount} resposta(s)</Badge>
            </div>

            <OptionDistribution options={question.options ?? []} />

            {question.textResponses?.length ? (
              <div className="mt-5">
                <h3 className="text-sm font-black text-[var(--text-primary)]">Respostas abertas</h3>
                <div className="mt-3 divide-y divide-[var(--border-subtle)] overflow-hidden rounded-xl border border-[var(--border-subtle)]">
                  {question.textResponses.map((response, responseIndex) => (
                    <article key={`${question.id}-${responseIndex}`} className="bg-[var(--surface-card)] p-4">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-primary)]">{response.text}</p>
                      <p className="mt-2 text-xs text-[var(--text-secondary)]">Enviada em {formatDate(response.submittedAt)}</p>
                    </article>
                  ))}
                </div>
              </div>
            ) : null}

            {!question.options?.length && !question.textResponses?.length ? (
              <div className="mt-5 rounded-xl bg-[var(--surface-muted)] p-4 text-sm text-[var(--text-secondary)]">
                Ainda não há respostas enviadas para esta pergunta.
              </div>
            ) : null}
          </Surface>
        ))}
      </div>
    </PlatformShell>
  );
}
