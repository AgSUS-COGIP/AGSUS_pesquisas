export const ACCESS_PAGE_SIZE = 100;
const ACCESS_MAX_OFFSET = 1_000_000;

function parseInteger(value: string | null, fallback: number) {
  if (!value || !/^\d+$/.test(value)) return fallback;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) ? parsed : fallback;
}

export function parseAccessPagination(searchParams: URLSearchParams) {
  const requestedLimit = parseInteger(searchParams.get("limite"), ACCESS_PAGE_SIZE);
  const requestedOffset = parseInteger(searchParams.get("offset"), 0);

  return {
    search: searchParams.get("busca")?.trim() ?? "",
    limit: Math.max(1, Math.min(requestedLimit, ACCESS_PAGE_SIZE)),
    offset: Math.max(0, Math.min(requestedOffset, ACCESS_MAX_OFFSET)),
  };
}

export function accessPageRange(offset: number, count: number, total: number) {
  if (total === 0 || count === 0) return "0 pessoas";
  return `${offset + 1}–${Math.min(offset + count, total)} de ${total} pessoas`;
}

export function previousAccessOffset(offset: number, limit: number) {
  return Math.max(0, offset - limit);
}

export function nextAccessOffset(offset: number, limit: number) {
  return offset + limit;
}
