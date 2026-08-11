/**
 * Camada de dados pura dos gráficos dos painéis.
 *
 * Sem React, DOM ou rede: transforma os dados brutos das RPCs (`get_survey_dashboard`,
 * `get_cddi_monitoring_dashboard`) nas estruturas que os componentes de gráfico
 * consomem. Isolar aqui mantém os cálculos testáveis e os componentes reutilizáveis
 * entre avaliações diferentes — os gráficos só recebem `label`/`value`, nunca a regra.
 */

export type SeriesPoint = { label: string; value: number };
export type DistributionItem = { id: string; label: string; count: number };
export type DistributionBar = DistributionItem & { percentage: number };

/** Média das entradas numéricas; ignora `null`/`undefined`. Sem valores válidos → `null`. */
export function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === "number");
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

/**
 * Agrupa eventos por dia (`YYYY-MM-DD`) e devolve os últimos `limit` dias **com
 * atividade**, em ordem cronológica. Datas inválidas são descartadas.
 */
export function groupEventsByDay(
  events: ReadonlyArray<{ submittedAt: string }>,
  { locale = "pt-BR", limit = 14 }: { locale?: string; limit?: number } = {},
): SeriesPoint[] {
  const grouped = new Map<string, number>();
  for (const event of events) {
    const date = new Date(event.submittedAt);
    if (Number.isNaN(date.getTime())) continue;
    const key = date.toISOString().slice(0, 10);
    grouped.set(key, (grouped.get(key) ?? 0) + 1);
  }
  return Array.from(grouped.entries())
    .sort(([first], [second]) => first.localeCompare(second))
    .slice(-limit)
    .map(([key, value]) => ({
      label: new Date(`${key}T00:00:00`).toLocaleDateString(locale, { day: "2-digit", month: "2-digit" }),
      value,
    }));
}

/**
 * Converte contagens em barras com percentual (0–100), preservando a ordem de
 * entrada. Total zero resolve todos os percentuais para 0 (sem divisão por zero).
 */
export function toDistributionBars(items: ReadonlyArray<DistributionItem>): DistributionBar[] {
  const counts = items.map((item) => Math.max(0, Number(item.count) || 0));
  const total = counts.reduce((sum, count) => sum + count, 0);
  return items.map((item, index) => ({
    ...item,
    count: counts[index],
    percentage: total ? Math.round((counts[index] / total) * 100) : 0,
  }));
}

/** Vértice `(x, y)` do eixo `index` de um radar de `count` eixos, a `magnitude` do centro. */
export function radarVertex(index: number, count: number, magnitude: number, center: number) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / Math.max(1, count);
  return { x: center + Math.cos(angle) * magnitude, y: center + Math.sin(angle) * magnitude };
}

/**
 * Pontos do polígono de dados de um radar, com os valores normalizados por `max`
 * (fixado em `[0, radius]`). Serve para qualquer escala — não presume 0–5.
 */
export function radarPolygon(
  values: ReadonlyArray<number>,
  { max, radius, center }: { max: number; radius: number; center: number },
): string {
  const safeMax = max > 0 ? max : 1;
  return values
    .map((value, index) => {
      const magnitude = radius * Math.min(1, Math.max(0, (value || 0) / safeMax));
      const { x, y } = radarVertex(index, values.length, magnitude, center);
      return `${x},${y}`;
    })
    .join(" ");
}
