import { BarChart3 } from "lucide-react";
import type { ReactNode } from "react";
import {
  radarPolygon,
  radarVertex,
  toDistributionBars,
  type DistributionBar,
  type DistributionItem,
  type SeriesPoint,
} from "@/lib/chart-data";
import { cn } from "@/lib/utils";

/**
 * Componentes de gráfico reutilizáveis dos painéis.
 *
 * São **orientados a dados**: recebem apenas `label`/`value` já calculados (a regra
 * de negócio fica em `@/lib/chart-data`), então servem a qualquer avaliação — não
 * há premissa fixa de escala 0–5 nem vocabulário do CDDI. Todos tratam ausência de
 * dados, contraste e responsividade; nomes longos truncam ou quebram sem estourar
 * o layout. São puros (sem estado): estados de carregamento/erro ficam na página.
 */

const numberFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });

function formatPercent(value: number) {
  return `${numberFormatter.format(value)}%`;
}

/** Estado de "sem dados" padronizado para qualquer gráfico. */
export function ChartEmptyState({ title, description, icon }: { title: string; description?: string; icon?: ReactNode }) {
  return (
    <div className="grid min-h-56 place-items-center rounded-xl border border-dashed border-[var(--border-strong)] bg-[var(--surface-interactive)] px-6 py-8 text-center">
      <div>
        <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-[var(--surface-card)] text-[var(--text-muted)]" aria-hidden="true">
          {icon ?? <BarChart3 className="h-5 w-5" />}
        </span>
        <p className="mt-3 font-black text-[var(--text-primary)]">{title}</p>
        {description ? <p className="mt-1 max-w-md text-sm leading-6 text-[var(--text-muted)]">{description}</p> : null}
      </div>
    </div>
  );
}

/** Cartão de indicador (KPI). `eyebrow` é opcional — nada é fixado a uma avaliação. */
export function StatTile({ icon, label, value, hint, accent, eyebrow }: { icon?: ReactNode; label: string; value: ReactNode; hint?: string; accent?: string; eyebrow?: string }) {
  return (
    <article className="rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface-card)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        {icon ? <div className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-xl", accent)}>{icon}</div> : <span aria-hidden="true" />}
        {eyebrow ? <span className="truncate text-[10px] font-black uppercase tracking-[.12em] text-[var(--text-muted)]">{eyebrow}</span> : null}
      </div>
      <p className="mt-4 truncate text-xs font-bold text-[var(--text-secondary)]">{label}</p>
      <strong className="mt-1 block truncate text-3xl font-black tracking-tight text-[var(--text-primary)]">{value}</strong>
      {hint ? <span className="mt-1 block text-xs leading-5 text-[var(--text-muted)]">{hint}</span> : null}
    </article>
  );
}

export type MetricStripItem = {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: "brand" | "success" | "warning" | "neutral";
};

/** Indicadores contínuos, para evitar uma grade de cartões desconectados. */
export function MetricStrip({ items, ariaLabel }: { items: ReadonlyArray<MetricStripItem>; ariaLabel: string }) {
  const toneClass = {
    brand: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
    success: "bg-[var(--status-success-bg)] text-[var(--status-success-text)]",
    warning: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
    neutral: "bg-[var(--surface-interactive)] text-[var(--text-secondary)]",
  } as const;

  return (
    <section className="metric-strip overflow-hidden border-y border-[var(--border-subtle)] bg-[var(--surface-card)]" aria-label={ariaLabel}>
      <div className="metric-strip-grid grid sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <article key={item.label} data-tone={item.tone ?? "neutral"} className="metric-strip-item flex min-w-0 gap-3 border-b border-[var(--border-subtle)] px-4 py-4 last:border-b-0 sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0">
            {item.icon ? (
              <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", toneClass[item.tone ?? "neutral"])} aria-hidden="true">
                {item.icon}
              </span>
            ) : null}
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-[var(--text-secondary)]">{item.label}</p>
              <strong className="mt-0.5 block text-2xl font-black tabular-nums tracking-tight text-[var(--text-primary)]">{item.value}</strong>
              {item.hint ? <p className="mt-0.5 truncate text-xs text-[var(--text-muted)]">{item.hint}</p> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/** Barra de progresso rotulada (etapa concluída sobre total). */
export function ProgressMeter({ label, value, total, description }: { label: string; value: number; total: number; description?: string }) {
  const percentage = total ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-[var(--text-primary)]">{label}</p>
          {description ? <p className="mt-0.5 text-xs text-[var(--text-muted)]">{description}</p> : null}
        </div>
        <div className="shrink-0 text-right">
          <strong className="block text-sm tabular-nums text-[var(--text-primary)]">{value} de {total}</strong>
          <span className="text-xs font-bold text-[var(--brand-primary)]">{formatPercent(percentage)}</span>
        </div>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--surface-interactive)]" role="img" aria-label={`${label}: ${formatPercent(percentage)}`}>
        <div className="h-full rounded-full bg-[var(--brand-solid)] transition-[width] duration-300" style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }} />
      </div>
    </div>
  );
}

/** Distribuição de respostas em barras horizontais com percentual. */
export function DistributionBars({ items, emptyLabel = "Ainda não há respostas para exibir." }: { items: ReadonlyArray<DistributionItem | DistributionBar>; emptyLabel?: string }) {
  const bars = toDistributionBars(items);
  if (!bars.length) {
    return <p className="mt-4 rounded-xl bg-[var(--surface-muted)] p-4 text-sm text-[var(--text-secondary)]">{emptyLabel}</p>;
  }
  return (
    <ul className="mt-5 space-y-3">
      {bars.map((bar) => (
        <li key={bar.id}>
          <div className="flex items-start justify-between gap-4 text-sm">
            <span className="min-w-0 break-words font-bold text-[var(--text-primary)]">{bar.label}</span>
            <span className="shrink-0 tabular-nums text-[var(--text-secondary)]">{bar.count} · {bar.percentage}%</span>
          </div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]" role="img" aria-label={`${bar.label}: ${bar.percentage}%`}>
            <div className="h-full rounded-full bg-[var(--brand-primary)] transition-[width]" style={{ width: `${bar.percentage}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Série temporal contínua com área, pontos e referências de escala. */
export function BarSeries({ points, ariaLabel, emptyState }: { points: ReadonlyArray<SeriesPoint>; ariaLabel: string; emptyState: { title: string; description?: string } }) {
  if (!points.length) return <ChartEmptyState title={emptyState.title} description={emptyState.description} />;
  const maximum = Math.max(...points.map((point) => point.value), 1);
  const width = Math.max(720, points.length * 92);
  const height = 260;
  const padding = { top: 28, right: 24, bottom: 46, left: 38 };
  const plotWidth = width - padding.left - padding.right;
  const plotHeight = height - padding.top - padding.bottom;
  const xFor = (index: number) => padding.left + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);
  const yFor = (value: number) => padding.top + plotHeight - (value / maximum) * plotHeight;
  const coordinates = points.map((point, index) => ({ ...point, x: xFor(index), y: yFor(point.value) }));
  const linePath = coordinates.length === 1
    ? `M ${coordinates[0].x} ${coordinates[0].y}`
    : `M ${coordinates[0].x} ${coordinates[0].y} ${coordinates.slice(1).map((point, index) => {
        const previous = coordinates[index];
        const controlX = (previous.x + point.x) / 2;
        return `C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
      }).join(" ")}`;
  const areaPath = `${linePath} L ${coordinates.at(-1)!.x} ${padding.top + plotHeight} L ${coordinates[0].x} ${padding.top + plotHeight} Z`;
  const gridValues = [0, maximum * 0.25, maximum * 0.5, maximum * 0.75, maximum];

  return (
    <div className="mt-5 overflow-x-auto" role="img" aria-label={ariaLabel}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[260px] min-w-[720px] w-full" aria-hidden="true">
        <defs>
          <linearGradient id="activity-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--brand-accent)" stopOpacity="0.36" />
            <stop offset="55%" stopColor="var(--brand-solid)" stopOpacity="0.13" />
            <stop offset="100%" stopColor="var(--brand-solid)" stopOpacity="0.01" />
          </linearGradient>
          <linearGradient id="activity-line" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--brand-solid)" />
            <stop offset="55%" stopColor="var(--brand-accent)" />
            <stop offset="100%" stopColor="var(--status-info-text)" />
          </linearGradient>
          <filter id="activity-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" />
          </filter>
        </defs>
        {gridValues.map((value) => {
          const y = yFor(value);
          return (
            <g key={value}>
              <line x1={padding.left} y1={y} x2={width - padding.right} y2={y} stroke="var(--border-subtle)" strokeDasharray="4 7" />
              <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="10" fill="var(--text-muted)">{numberFormatter.format(value)}</text>
            </g>
          );
        })}
        {coordinates.map((point, index) => (
          <line key={`guide-${index}`} x1={point.x} y1={padding.top} x2={point.x} y2={padding.top + plotHeight} stroke="var(--border-subtle)" strokeOpacity=".45" strokeDasharray="2 8" />
        ))}
        <path d={areaPath} fill="url(#activity-area)" />
        <path d={linePath} fill="none" stroke="var(--brand-accent)" strokeWidth="10" strokeOpacity=".2" filter="url(#activity-glow)" />
        <path d={linePath} fill="none" stroke="url(#activity-line)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {coordinates.map((point, index) => (
          <g key={`${point.label}-${index}`}>
            <circle cx={point.x} cy={point.y} r="9" fill="var(--brand-accent)" fillOpacity=".12" />
            <circle cx={point.x} cy={point.y} r="5" fill="var(--surface-card)" stroke="var(--brand-accent)" strokeWidth="3" />
            <text x={point.x} y={Math.max(14, point.y - 12)} textAnchor="middle" fontSize="11" fontWeight="800" fill="var(--text-primary)">{point.value}</text>
            <text x={point.x} y={height - 16} textAnchor="middle" fontSize="10" fontWeight="700" fill="var(--text-muted)">{point.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export type RadarAxisDatum = { code: string; label: string; value: number };

/** Radar de médias. `max` parametriza a escala (padrão 5); rótulos longos vão no `code` + tooltip. */
export function RadarChart({ axes, max = 5, ariaLabel, emptyState }: { axes: ReadonlyArray<RadarAxisDatum>; max?: number; ariaLabel: string; emptyState: { title: string; description?: string } }) {
  if (!axes.length) return <ChartEmptyState title={emptyState.title} description={emptyState.description} />;
  const center = 160;
  const radius = 110;
  const count = Math.max(1, axes.length);
  const levels = [1, 2, 3, 4, 5];
  const dataPolygon = radarPolygon(axes.map((axis) => axis.value), { max, radius, center });

  return (
    <div className="mx-auto aspect-square w-full max-w-[420px]">
      <svg viewBox="0 0 320 320" className="h-full w-full" role="img" aria-label={ariaLabel}>
        {levels.map((level) => (
          <polygon
            key={level}
            points={axes.map((_, index) => { const { x, y } = radarVertex(index, count, (radius * level) / 5, center); return `${x},${y}`; }).join(" ")}
            fill="none"
            stroke="var(--border-subtle)"
          />
        ))}
        {axes.map((axis, index) => {
          const edge = radarVertex(index, count, radius, center);
          const labelPoint = radarVertex(index, count, radius + 22, center);
          return (
            <g key={axis.code}>
              <line x1={center} y1={center} x2={edge.x} y2={edge.y} stroke="var(--border-subtle)" />
              <text x={labelPoint.x} y={labelPoint.y} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontWeight="700" fill="var(--text-secondary)">
                <title>{axis.label}</title>
                {axis.code}
              </text>
            </g>
          );
        })}
        <polygon points={dataPolygon} fill="color-mix(in srgb, var(--brand-solid) 22%, transparent)" stroke="var(--brand-solid)" strokeWidth="3" />
      </svg>
    </div>
  );
}
