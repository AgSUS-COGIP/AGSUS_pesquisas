"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, BarChart3, CheckCircle2, FlaskConical, Grid3X3, Sigma } from "lucide-react";
import { toast } from "sonner";
import { PlatformShell } from "@/components/platform-shell";
import { PlatformGuardState } from "@/components/platform-guard-state";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader, StatCard, Surface } from "@/components/ui/surface";
import { obterPreAmostra, obterResultadosPreAmostra } from "@/lib/api/cliente-construtor";
import type { EstadoPreAmostra } from "@/lib/api/contratos-construtor";
import { errorMessageFromUnknown } from "@/lib/observability";
import { usePlatformGuard } from "@/lib/platform-context";
import { PLATFORM_MODULE } from "@/lib/platform-modules";
import type { PreSampleStatistics } from "@/lib/pre-sample-statistics";

const decimal = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 3 });

function valueLabel(value: number | null) { return value === null ? "—" : decimal.format(value); }
function quality(value: number | null, good: number, acceptable: number) {
  if (value === null) return "Dados insuficientes";
  if (value >= good) return "Bom";
  if (value >= acceptable) return "Aceitável";
  return "Requer revisão";
}

export default function PreSampleResultsPage({ params }: { params: Promise<{ surveyId: string }> }) {
  const { surveyId } = use(params);
  const guard = usePlatformGuard(PLATFORM_MODULE.ADMIN_SURVEYS);
  const granted = guard.state === "granted";
  const [state, setState] = useState<EstadoPreAmostra | null>(null);
  const [results, setResults] = useState<PreSampleStatistics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nextState, nextResults] = await Promise.all([obterPreAmostra(surveyId), obterResultadosPreAmostra(surveyId)]);
      setState(nextState); setResults(nextResults);
    } catch (error) { toast.error(errorMessageFromUnknown(error)); } finally { setLoading(false); }
  }, [surveyId]);

  useEffect(() => { if (granted) void load(); }, [granted, load]);

  if (guard.state !== "granted") return <PlatformGuardState guard={guard} title="resultados da pré-amostra" restrictedTitle="Resultados restritos" restrictedDescription="Seu perfil não possui permissão para analisar a pré-amostra." />;

  return <PlatformShell user={guard.user} eyebrow="Administração · Validação" title="Resultados da pré-amostra">
    <div className="mx-auto w-full max-w-[1400px] space-y-5">
      <nav aria-label="Ações da pré-amostra"><Link href={`/admin/pesquisas/${surveyId}/operacao`} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-card)] px-4 text-sm font-semibold text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"><ArrowLeft className="h-4 w-4" aria-hidden="true" />Voltar às propriedades</Link></nav>
      {loading || !state || !results ? <ResultsSkeleton /> : <>
        <PageHeader eyebrow="Qualidade psicométrica" title="Resultados da pré-amostra" description="Indicadores calculados somente com respostas concluídas da pré-amostra e itens quantitativos com escore." actions={<Badge variant={state.phase === "PRE_SAMPLE" ? "info" : state.phase === "POPULATION" ? "success" : "neutral"}><FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />{state.submitted} de {state.size} respostas</Badge>} />

        <section aria-label="Base de cálculo" className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Respondentes" value={results.respondents} description="respostas enviadas da pré-amostra" />
          <StatCard label="Casos completos" value={results.completeCases} description="respostas usadas em todos os cálculos" />
          <StatCard label="Itens analisados" value={results.items} description="itens quantitativos com escore" />
        </section>

        <section aria-label="Indicadores psicométricos" className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <IndicatorCard icon={Sigma} label="Alfa de Cronbach" value={valueLabel(results.cronbachAlpha)} interpretation={quality(results.cronbachAlpha, .8, .7)} description="Consistência interna pela variância dos itens e do escore total." />
          <IndicatorCard icon={CheckCircle2} label="Ômega total" value={valueLabel(results.omegaTotal)} interpretation={quality(results.omegaTotal, .8, .7)} description="Modelo unifatorial padronizado estimado pela primeira componente." />
          <IndicatorCard icon={Grid3X3} label="KMO" value={valueLabel(results.kmo)} interpretation={quality(results.kmo, .8, .6)} description="Adequação da matriz de correlações para análise fatorial." />
          <IndicatorCard icon={BarChart3} label="Teste de Bartlett" value={results.bartlett ? `p ${results.bartlett.pValue < .001 ? "< 0,001" : `= ${decimal.format(results.bartlett.pValue)}`}` : "—"} interpretation={results.bartlett ? (results.bartlett.pValue < .05 ? "Significativo" : "Não significativo") : "Dados insuficientes"} description={results.bartlett ? `χ²(${results.bartlett.degreesOfFreedom}) = ${decimal.format(results.bartlett.chiSquare)}` : "A matriz não permitiu o cálculo."} />
        </section>

        <Surface className="p-6">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[var(--brand-secondary)]">Análise fatorial</p><h3 className="mt-1 text-xl font-semibold text-[var(--text-primary)]">Gráfico de sedimentação</h3><p className="mt-2 text-sm text-[var(--text-secondary)]">Autovalores da matriz de correlação. A linha tracejada marca o critério de Kaiser (autovalor 1).</p></div><Badge variant="outline">{results.scree.length} componentes</Badge></div>
          <ScreeChart points={results.scree} />
        </Surface>

        {results.warnings.length > 0 && <Surface className="border-[var(--status-warning-border)] bg-[var(--status-warning-bg)] p-5"><div className="flex gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--status-warning-text)]" aria-hidden="true" /><div><h3 className="font-semibold text-[var(--status-warning-text)]">Cuidados na interpretação</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-6 text-[var(--status-warning-text)]">{results.warnings.map((warning) => <li key={warning}>{warning}</li>)}</ul></div></div></Surface>}

        <Surface className="p-5 text-sm leading-6 text-[var(--text-secondary)]"><strong className="text-[var(--text-primary)]">Nota metodológica.</strong> Os cálculos usam casos completos. O ômega é uma estimativa padronizada unifatorial; estes indicadores apoiam a decisão técnica, mas não substituem a análise do conteúdo dos itens e do desenho amostral.</Surface>
      </>}
    </div>
  </PlatformShell>;
}

function IndicatorCard({ icon: Icon, label, value, interpretation, description }: { icon: typeof Sigma; label: string; value: string; interpretation: string; description: string }) {
  return <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-5 shadow-[var(--shadow-card)]"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--surface-muted)] text-[var(--brand-primary)]"><Icon className="h-5 w-5" aria-hidden="true" /></span><p className="mt-4 text-xs font-semibold uppercase tracking-[.12em] text-[var(--text-secondary)]">{label}</p><strong className="mt-1 block text-3xl font-semibold text-[var(--text-primary)]">{value}</strong><Badge variant="outline" className="mt-3">{interpretation}</Badge><p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">{description}</p></article>;
}

function ScreeChart({ points }: { points: PreSampleStatistics["scree"] }) {
  if (!points.length) return <div className="mt-5 grid min-h-56 place-items-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-muted)] p-6 text-center text-sm text-[var(--text-secondary)]">Ainda não há dados suficientes para gerar o gráfico.</div>;
  const width = Math.max(680, points.length * 74); const height = 280; const pad = { left: 48, right: 24, top: 24, bottom: 48 };
  const max = Math.max(1.2, ...points.map((point) => point.eigenvalue));
  const x = (index: number) => pad.left + (points.length === 1 ? (width - pad.left - pad.right) / 2 : index / (points.length - 1) * (width - pad.left - pad.right));
  const y = (value: number) => pad.top + (max - value) / max * (height - pad.top - pad.bottom);
  const path = points.map((point, index) => `${index ? "L" : "M"} ${x(index)} ${y(point.eigenvalue)}`).join(" ");
  return <div className="mt-5 overflow-x-auto" role="img" aria-label="Gráfico de sedimentação dos autovalores"><svg viewBox={`0 0 ${width} ${height}`} className="h-[280px] min-w-[680px] w-full" aria-hidden="true"><line x1={pad.left} x2={width - pad.right} y1={y(1)} y2={y(1)} stroke="var(--status-warning-text)" strokeDasharray="6 6" /><text x={pad.left + 4} y={y(1) - 7} fontSize="10" fill="var(--status-warning-text)">Autovalor 1</text><line x1={pad.left} x2={pad.left} y1={pad.top} y2={height - pad.bottom} stroke="var(--border-strong)" /><line x1={pad.left} x2={width - pad.right} y1={height - pad.bottom} y2={height - pad.bottom} stroke="var(--border-strong)" /><path d={path} fill="none" stroke="var(--brand-solid)" strokeWidth="3" />{points.map((point, index) => <g key={point.component}><circle cx={x(index)} cy={y(point.eigenvalue)} r="5" fill="var(--surface-card)" stroke="var(--brand-solid)" strokeWidth="3" /><text x={x(index)} y={height - 20} textAnchor="middle" fontSize="10" fill="var(--text-muted)">{point.component}</text><title>{`Componente ${point.component}: autovalor ${decimal.format(point.eigenvalue)}; ${decimal.format(point.explainedPercent)}% explicado`}</title></g>)}</svg></div>;
}

function ResultsSkeleton() { return <div className="space-y-5" aria-busy="true"><Skeleton className="h-24 rounded-2xl" /><div className="grid gap-4 sm:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-28 rounded-2xl" />)}</div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-52 rounded-2xl" />)}</div><Skeleton className="h-96 rounded-2xl" /></div>; }
