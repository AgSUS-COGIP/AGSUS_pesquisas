/**
 * Tradução dos códigos de estado do banco para linguagem de interface.
 *
 * A regra do projeto é que `DRAFT`, `OPEN` e `PUBLISHED` são vocabulário
 * interno e não podem aparecer como rótulo. O mapa existia duas vezes — em
 * `/operacao` e em `/equipe` — e o construtor não tinha nenhum, então exibia
 * "CICLO · OPEN" enquanto as outras telas mostravam "Aberto" para o mesmo
 * estado. Duplicar um mapa é assim que ele se perde na terceira tela.
 *
 * Código desconhecido é devolvido como veio, de propósito: um estado novo no
 * banco aparece cru na tela — o que é feio, e é justamente o sinal de que falta
 * traduzi-lo aqui — em vez de virar um "—" que esconde a novidade.
 */
const CYCLE_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  SCHEDULED: "Agendado",
  OPEN: "Aberto",
  CLOSED: "Encerrado",
  CANCELLED: "Cancelado",
};

const VERSION_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
  ARCHIVED: "Arquivada",
  RETIRED: "Descontinuada",
};

/** Rótulo do estado do ciclo. Sem ciclo configurado, diz isso. */
export function cycleStatusLabel(status: string | null | undefined) {
  if (!status) return "Não configurado";
  return CYCLE_STATUS_LABELS[status] ?? status;
}

/** Rótulo do estado da versão do instrumento. */
export function versionStatusLabel(status: string | null | undefined) {
  if (!status) return "Não configurada";
  return VERSION_STATUS_LABELS[status] ?? status;
}
