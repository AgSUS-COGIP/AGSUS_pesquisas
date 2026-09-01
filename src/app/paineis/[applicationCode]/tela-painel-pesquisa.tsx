"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BarChart3, CircleCheckBig, Clock3, ShieldCheck, UsersRound } from "lucide-react";
import { PlatformShell, PlatformSkeleton } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { DistributionBars } from "@/components/platform-charts";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { PageHeader, Surface } from "@/components/ui/surface";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import { obterPainelDoCiclo } from "@/lib/api/cliente-paineis";
import { estatisticasDaPergunta, formatarNumero } from "@/lib/estatisticas";

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
  /** Ciclo anônimo: o painel agrega sem conseguir voltar à pessoa. */
  anonymous?: boolean;
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

/**
 * As descritivas de uma pergunta, quando elas significam alguma coisa.
 *
 * Não renderiza nada para texto livre, para escolha sem ordem numérica, nem
 * para pergunta sem resposta — quem decide é `estatisticasDaPergunta`, e esta
 * tela apenas obedece. Uma faixa vazia com seis traços diria "não há dado" com
 * muito mais peso visual do que não dizer nada.
 *
 * Os números saem das alternativas que a RPC **já devolvia**: `value` e `count`
 * formam a tabela de frequências. Nenhuma consulta nova, nenhuma RPC alterada.
 */
function ResumoEstatistico({ questionType, options }: { questionType: string; options?: DashboardOption[] }) {
  const { resumo } = estatisticasDaPergunta(questionType, options ?? []);
  if (!resumo) return null;

  const medidas = [
    { rotulo: "Média", valor: formatarNumero(resumo.media) },
    { rotulo: "Mediana", valor: formatarNumero(resumo.mediana) },
    { rotulo: "Desvio padrão", valor: formatarNumero(resumo.desvioPadrao) },
    { rotulo: "Variância", valor: formatarNumero(resumo.variancia) },
    { rotulo: "Mínimo", valor: formatarNumero(resumo.minimo, 0) },
    { rotulo: "Máximo", valor: formatarNumero(resumo.maximo, 0) },
  ];

  return (
    <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[var(--border-subtle)] pt-4 sm:grid-cols-3 lg:grid-cols-6">
      {medidas.map((medida) => (
        <div key={medida.rotulo}>
          <dt className="text-xs font-medium text-[var(--text-secondary)]">{medida.rotulo}</dt>
          <dd className="mt-1 text-lg font-semibold leading-none tabular-nums text-[var(--text-primary)]">{medida.valor}</dd>
        </div>
      ))}
      {/*
        O denominador fica visível junto das medidas. "Média 3,4" sobre 8
        respostas e sobre 800 são afirmações de força muito diferente, e quem lê
        o painel precisa dessa diferença antes de agir.
      */}
      <div className="col-span-2 sm:col-span-3 lg:col-span-6">
        <p className="text-xs text-[var(--text-secondary)]">
          Calculado sobre {resumo.respostasValidas} {resumo.respostasValidas === 1 ? "resposta válida" : "respostas válidas"}.
        </p>
      </div>
    </dl>
  );
}

async function fetchDashboard(applicationCode: string) {
  return await obterPainelDoCiclo(applicationCode) as DashboardData;
}

function formatDate(value: string | null) {
  if (!value) return "Não informado";
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export default function SurveyDashboardPage() {
  const params = useParams<{ applicationCode: string }>();
  const applicationCode = decodeURIComponent(params.applicationCode);
  const guard = usePlatformGuard(PLATFORM_MODULE.DASHBOARDS);
  const dashboardQuery = useQuery({
    queryKey: ["dashboards", applicationCode],
    queryFn: () => fetchDashboard(applicationCode),
    enabled: guard.state === "granted" && Boolean(applicationCode),
    staleTime: 30_000,
  });
  const dashboard = dashboardQuery.data ?? null;

  if (guard.state !== "granted") {
    return <PlatformGuardState
      guard={guard}
      title="painel da avaliação"
      restrictedTitle="Painéis restritos"
      restrictedDescription="O módulo Painéis está disponível para a administração da plataforma."
    />;
  }

  if (dashboardQuery.isLoading) return <PlatformSkeleton title="Carregando painel da avaliação" />;

  const user = guard.user;

  if (!dashboard) {
    return (
      <PlatformShell user={user} eyebrow="Painéis" title="Avaliação indisponível">
        <Surface className="p-6">
          <EmptyState
            icon={<BarChart3 className="h-6 w-6" aria-hidden="true" />}
            title="Não foi possível abrir este painel"
            description={dashboardQuery.error instanceof Error ? dashboardQuery.error.message : "A avaliação não possui dados disponíveis ou seu perfil não tem acesso."}
            action={<Link href="/paineis" className="secondary-button">Voltar aos painéis</Link>}
          />
        </Surface>
      </PlatformShell>
    );
  }

  const { application, summary, questions } = dashboard;
  const isAnonymous = dashboard.anonymous === true;

  return (
    <PlatformShell user={user} eyebrow={application.surveyCode} title={application.name}>
      <div className="monitor-dashboard">
      <Link href="/paineis" className="mb-4 inline-flex items-center gap-2 text-sm font-bold text-[var(--brand-primary)]">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Todos os painéis
      </Link>

      <div className="monitor-topbar p-5">
        <PageHeader
          eyebrow="Acompanhamento em tempo real"
          title={application.surveyName}
          description={application.surveyDescription || "Indicadores operacionais e respostas consolidadas desta avaliação."}
          actions={<Badge variant={application.status === "OPEN" ? "success" : "neutral"}>{application.status === "OPEN" ? "Período aberto" : application.status}</Badge>}
        />
      </div>

      {isAnonymous ? (
        <section className="monitor-panel mt-6 flex gap-3 border-y border-[var(--border-subtle)] bg-[var(--surface-card)] p-5">
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-[var(--brand-primary)]" aria-hidden="true" />
          <div className="text-sm text-[var(--text-secondary)]">
            <strong className="block text-[var(--text-primary)]">Avaliação anônima</strong>
            As respostas não estão ligadas a quem as enviou — nem no banco, nem aqui. O painel mostra os resultados
            agregados e as respostas abertas sem identificar a pessoa que as enviou.
          </div>
        </section>
      ) : null}

      <div className="monitor-kpi-grid mt-6" aria-label="Indicadores da avaliação">
        <div className="monitor-kpi" data-tone="brand"><span className="monitor-kpi-label">{isAnonymous ? "Respostas iniciadas" : "Participantes"}</span><strong className="monitor-kpi-value">{summary.totalParticipants}</strong></div>
        <div className="monitor-kpi" data-tone="success"><span className="monitor-kpi-label">Enviadas</span><strong className="monitor-kpi-value">{summary.submitted}</strong></div>
        <div className="monitor-kpi" data-tone="warning"><span className="monitor-kpi-label">Em andamento</span><strong className="monitor-kpi-value">{summary.drafts}</strong></div>
        {!isAnonymous && <div className="monitor-kpi" data-tone="danger"><span className="monitor-kpi-label">Não iniciadas</span><strong className="monitor-kpi-value">{summary.notStarted}</strong></div>}
        {!isAnonymous && <div className="monitor-kpi" data-tone="brand"><span className="monitor-kpi-label">Taxa de conclusão</span><strong className="monitor-kpi-value">{summary.completionRate}%</strong></div>}
      </div>

      <section className="monitor-panel mt-6 overflow-hidden border-y border-[var(--border-subtle)] bg-[var(--surface-card)]">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="p-5 sm:p-6"><div className="flex items-center justify-between gap-4"><div><p className="section-eyebrow">Progresso do ciclo</p><h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">{summary.completionRate}% concluído</h2></div><CircleCheckBig className="h-7 w-7 text-[var(--status-success-text)]" /></div><div className="mt-5 h-3 overflow-hidden rounded-full bg-[var(--surface-muted)]"><div className="h-full rounded-full bg-[linear-gradient(90deg,var(--brand-solid),var(--brand-secondary))]" style={{ width: `${Math.min(100, Math.max(0, summary.completionRate))}%` }} /></div><p className="mt-3 text-sm text-[var(--text-secondary)]">{summary.submitted} de {summary.totalParticipants} participantes enviaram respostas.</p></div>
          <div className={`grid border-t border-[var(--border-subtle)] bg-[var(--surface-muted)] lg:border-l lg:border-t-0 ${isAnonymous ? "grid-cols-1" : "grid-cols-2"}`}><div className="flex flex-col justify-center p-5"><Clock3 className="h-5 w-5 text-amber-500" /><strong className="mt-3 text-2xl text-[var(--text-primary)]">{summary.drafts}</strong><span className="text-xs text-[var(--text-secondary)]">em andamento</span></div>{!isAnonymous && <div className="flex flex-col justify-center border-l border-[var(--border-subtle)] p-5"><UsersRound className="h-5 w-5 text-slate-400" /><strong className="mt-3 text-2xl text-[var(--text-primary)]">{summary.notStarted}</strong><span className="text-xs text-[var(--text-secondary)]">sem iniciar</span></div>}</div>
        </div>
      </section>

      <section className="monitor-panel monitor-panel--neutral mt-6 border-y border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 sm:p-6">
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
      </section>

      <div className="mt-6 space-y-5">
        {questions.map((question, index) => (
          <Surface key={question.id} className="monitor-panel p-5 [content-visibility:auto] [contain-intrinsic-size:1px_320px] sm:p-6">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div>
                <p className="section-eyebrow">{question.sectionTitle} · Pergunta {index + 1}</p>
                <h2 className="mt-1 text-xl font-black text-[var(--text-primary)]">{question.title}</h2>
                {question.description ? <p className="mt-2 text-sm text-[var(--text-secondary)]">{question.description}</p> : null}
              </div>
              <Badge variant="neutral">{question.responseCount} resposta(s)</Badge>
            </div>

            <ResumoEstatistico questionType={question.type} options={question.options} />

            {question.options?.length ? <DistributionBars items={question.options} /> : null}

            {question.textResponses?.length ? (
              <div className="mt-5">
                <h3 className="text-sm font-black text-[var(--text-primary)]">Respostas abertas</h3>
                <div className="mt-3 divide-y divide-[var(--border-subtle)] overflow-hidden rounded-xl border border-[var(--border-subtle)]">
                  {question.textResponses.map((response, responseIndex) => (
                    <article key={`${question.id}-${responseIndex}`} className="flex flex-col gap-3 bg-[var(--surface-card)] p-4 sm:flex-row sm:items-start sm:justify-between">
                      <p className="whitespace-pre-wrap text-sm leading-6 text-[var(--text-primary)]">{response.text}</p>
                      {response.submittedAt ? (
                        <p className="shrink-0 text-xs text-[var(--text-secondary)] sm:text-right">Enviada em {formatDate(response.submittedAt)}</p>
                      ) : null}
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
      {/* Mesma duplicação do painel do CDDI: a casca já assina a instituição no
          rodapé. Fica só a hora da apuração, que é o que este painel sabe e ela
          não. */}
      <p className="monitor-footer">
        <span>Apurado em {formatDate(dashboard.generatedAt)}</span>
      </p>
      </div>
    </PlatformShell>
  );
}
