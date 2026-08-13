/**
 * Formatação de data/hora institucional: `pt-BR` fixado em `America/Sao_Paulo`.
 *
 * É a fonte única do padrão exigido pela convenção global do projeto. As telas
 * usavam cópias inline deste formatador e três delas já tinham divergido
 * (omitindo o fuso), exibindo horário errado para operador fora de São Paulo.
 * Cada tela mantém seu próprio texto de fallback, passado por parâmetro.
 */

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Sao_Paulo",
});

const SO_DATA = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeZone: "America/Sao_Paulo",
});

function parseValue(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Data e hora curtas ("12/08/2026 14:30"). Valor ausente ou inválido devolve o fallback. */
export function formatDateTimePtBr(value: string | null | undefined, fallback = "Não definido"): string {
  const parsed = parseValue(value);
  return parsed ? DATA_HORA.format(parsed) : fallback;
}

/** Somente a data curta ("12/08/2026"). Valor ausente ou inválido devolve o fallback. */
export function formatDatePtBr(value: string | null | undefined, fallback = "Não definido"): string {
  const parsed = parseValue(value);
  return parsed ? SO_DATA.format(parsed) : fallback;
}
