/**
 * Contratos de "Definir público da avaliação" (Fase 1).
 *
 * Arquivo próprio em vez de crescer `contratos-pessoas.ts`: o público é um
 * assunto fechado, com vocabulário próprio, e mantê-lo separado deixa claro o
 * que pertence a esta experiência.
 *
 * As chaves das dimensões usam o nome do campo institucional na origem
 * (`directorate`, `unit`, `coordination`, `costCenter`, `jobTitle`) porque é
 * assim que o banco as devolve e as recebe. O rótulo em português vive só na
 * apresentação — traduzir a chave no meio do caminho criaria dois vocabulários
 * para a mesma coisa.
 */

export const CHAVES_DE_DIMENSAO = [
  "directorate",
  "unit",
  "coordination",
  "costCenter",
  "jobTitle",
] as const;

export type ChaveDeDimensao = (typeof CHAVES_DE_DIMENSAO)[number];

/** Rótulo de cada dimensão na interface. */
export const ROTULO_DA_DIMENSAO: Record<ChaveDeDimensao, string> = {
  directorate: "Diretoria",
  unit: "Unidade",
  coordination: "Coordenação",
  costCenter: "Centro de custo",
  jobTitle: "Cargo",
};

/**
 * Opção disponível numa dimensão.
 *
 * `label` é a grafia institucional mais frequente do grupo — o banco agrupa
 * pelo valor normalizado e devolve a forma real mais comum, para que variações
 * de espaço, caixa e acento não virem opções distintas na tela.
 */
export type OpcaoDeDimensao = {
  label: string;
  count: number;
};

export type DimensoesDoPublico = {
  status: "OK" | "FORBIDDEN";
  dimensions: Partial<Record<ChaveDeDimensao, OpcaoDeDimensao[]>>;
};

/**
 * A regra que origina o público.
 *
 * Semântica: `OR` entre os valores de uma mesma dimensão, `AND` entre dimensões
 * diferentes, `includePersonIds` somam ao resultado e `excludePersonIds` sempre
 * vencem.
 *
 * `allEligible` existe para que "toda a instituição" seja escolha explícita.
 * Sem ele, regra em branco significaria a instituição inteira — e um formulário
 * ainda não preenchido viraria mil vínculos.
 */
export type RegraDePublico = {
  filters: Partial<Record<ChaveDeDimensao, string[]>>;
  allEligible?: boolean;
  includePersonIds?: string[];
  excludePersonIds?: string[];
};

export type PessoaDaPrevia = {
  personId: string;
  fullName: string;
  jobTitle: string | null;
  unit: string | null;
  directorate: string | null;
  origin: "FILTRO" | "INCLUSAO";
  alreadyLinked: boolean;
};

/** Resultado da prévia. Leitura pura — nada aqui altera o público. */
export type PreviaDoPublico = {
  status: "OK";
  /** Público efetivo, já sem as pessoas excluídas. */
  matchedCount: number;
  alreadyLinkedCount: number;
  newLinkCount: number;
  excludedCount: number;
  /** Pessoas incluídas à mão que não passam na elegibilidade. */
  ineligibleIncludedCount: number;
  sample: PessoaDaPrevia[];
};

export type ResultadoDaAplicacao = {
  status: "OK";
  assignedCount: number;
  reactivatedCount: number;
  keptCount: number;
  excludedCount: number;
};

/** Regra vazia — ponto de partida da tela. */
export function regraVazia(): RegraDePublico {
  return { filters: {}, allEligible: false, includePersonIds: [], excludePersonIds: [] };
}

/** Alguma coisa foi escolhida? Serve para habilitar a prévia e o botão de aplicar. */
export function regraTemCriterio(regra: RegraDePublico) {
  if (regra.allEligible) return true;
  if ((regra.includePersonIds ?? []).length > 0) return true;
  return CHAVES_DE_DIMENSAO.some((chave) => (regra.filters[chave] ?? []).length > 0);
}
