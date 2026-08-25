/**
 * Grupo selecionado para a avaliação múltipla da chefia.
 *
 * A fila guarda somente o ciclo e os IDs das pessoas. Cada pessoa abre ou
 * retoma a própria submissão e mantém respostas independentes na matriz — nada
 * é replicado entre integrantes.
 *
 * O grupo viaja por `sessionStorage`, e não pela URL, por um motivo concreto:
 * dezenas de UUIDs numa query string estouram o limite de cabeçalho do
 * servidor (HTTP 431) — a navegação do App Router repete a URL inteira em
 * cabeçalhos da requisição (`Next-Router-State-Tree`, `Referer`), que somados
 * aos cookies de sessão passam do teto de 16 KB do Node.
 *
 * `sessionStorage` também é o escopo certo: o grupo pertence à sessão de quem
 * está avaliando, não é um link compartilhável — outra pessoa não teria os
 * mesmos vínculos de liderança.
 */

export const CDDI_BATCH_QUEUE_STORAGE_KEY = "agsus-cddi-fila-lote-v1";

export type CddiBatchQueue = {
  cycleCode: string | null;
  personIds: string[];
};

/**
 * Interpreta o valor bruto guardado. Valor ausente, JSON inválido ou formato
 * inesperado degradam para `null` — fila corrompida nunca quebra a tela, no
 * máximo desliga o modo lote.
 */
export function parseCddiBatchQueue(raw: string | null): CddiBatchQueue | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const candidate = parsed as { cycleCode?: unknown; personIds?: unknown };
    if (!Array.isArray(candidate.personIds)) return null;
    const personIds = candidate.personIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0);
    if (!personIds.length) return null;
    const cycleCode = typeof candidate.cycleCode === "string" && candidate.cycleCode.trim() ? candidate.cycleCode : null;
    return { cycleCode, personIds };
  } catch {
    return null;
  }
}

/** Grava a fila. Devolve `false` se o storage estiver indisponível (ex.: bloqueado pelo navegador). */
export function saveCddiBatchQueue(queue: CddiBatchQueue): boolean {
  try {
    window.sessionStorage.setItem(CDDI_BATCH_QUEUE_STORAGE_KEY, JSON.stringify(queue));
    return true;
  } catch {
    return false;
  }
}

/** Lê a fila gravada, se houver uma válida. */
export function readCddiBatchQueue(): CddiBatchQueue | null {
  try {
    return parseCddiBatchQueue(window.sessionStorage.getItem(CDDI_BATCH_QUEUE_STORAGE_KEY));
  } catch {
    return null;
  }
}

/** Encerra a fila. Falha de storage degrada em silêncio — sem fila para limpar, nada a fazer. */
export function clearCddiBatchQueue(): void {
  try {
    window.sessionStorage.removeItem(CDDI_BATCH_QUEUE_STORAGE_KEY);
  } catch {
    // storage indisponível: não havia fila persistida para remover
  }
}
