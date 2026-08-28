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

/**
 * Pessoa na amostra da prévia.
 *
 * `currentStatus` é o vínculo de hoje — nulo para quem ainda não está no ciclo —
 * e `nextStatus` é o que a aplicação gravaria. Ver os dois lado a lado é o que
 * permite conferir a transição antes de confirmá-la.
 *
 * Substituíram `origin` (`FILTRO`/`INCLUSAO`), que dizia como a pessoa entrou na
 * regra. Era informação sobre o critério, não sobre o efeito, e a prévia deixou
 * de devolvê-la quando passou a descrever a transição.
 */
export type PessoaDaPrevia = {
  personId: string;
  fullName: string;
  jobTitle: string | null;
  unit: string | null;
  directorate: string | null;
  currentStatus: string | null;
  nextStatus: string;
  alreadyLinked: boolean;
};

/**
 * Resultado da prévia. Leitura pura — nada aqui altera o público.
 *
 * Dois totais, porque descrevem coisas diferentes:
 *
 * - `matchedCount` é o alcance do critério;
 * - `effectiveCount` é quantas pessoas ficam com acesso depois de aplicar.
 *
 * Eles divergem quando há bloqueio administrativo (a pessoa casa com a regra mas
 * segue barrada) ou progresso preservado (não casa mais, mas já começou e
 * permanece). O número que descreve a operação é o segundo.
 */
export type PreviaDoPublico = {
  status: "OK";
  matchedCount: number;
  effectiveCount: number;
  newLinkCount: number;
  reactivatedCount: number;
  keptCount: number;
  excludedCount: number;
  /** Deixaram de casar com a regra e saem do público. */
  removedCount: number;
  /** Deixaram de casar, mas já começaram ou concluíram: permanecem. */
  retainedWithProgressCount: number;
  /** Casam com a regra e seguem bloqueadas por decisão administrativa. */
  blockedKeptCount: number;
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
  removedCount: number;
  retainedWithProgressCount: number;
  blockedKeptCount: number;
  effectiveCount: number;
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

/** Pessoa devolvida pela busca do seletor individual. */
export type PessoaEncontrada = {
  personId: string;
  fullName: string;
  employeeNumber: string;
  jobTitle: string | null;
  unit: string | null;
  directorate: string | null;
};

export type PessoasEncontradas = {
  status: "OK" | "FORBIDDEN";
  people: PessoaEncontrada[];
};
