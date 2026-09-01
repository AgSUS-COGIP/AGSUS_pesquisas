/**
 * Os filtros da lista de participantes — leitura, escrita e normalização.
 *
 * ## Por que a URL é a fonte
 *
 * O recorte precisa sobreviver a recarregar a página, voltar do navegador e ser
 * colado num chat para outra pessoa ver a mesma coisa. Estado só em React perde
 * as três. E, quando a exportação chegar, ela precisa partir exatamente do
 * mesmo recorte da tela — ter um lugar só onde o recorte é lido evita que a
 * planilha e a tela discordem.
 *
 * ## Por que chave desconhecida é descartada
 *
 * A regra de público já aprendeu essa lição: aceitar qualquer chave em
 * `filters` fazia `{"foo":["bar"]}` ligar a busca por filtro sem restringir
 * nada, e o resultado era a instituição inteira. Aqui o conjunto de dimensões é
 * fechado, e o que não está nele não chega ao banco.
 */

/** Dimensões organizacionais, iguais às da regra de público — de propósito. */
export const DIMENSOES_DE_FILTRO = ["directorate", "unit", "coordination", "costCenter", "jobTitle"] as const;

export type DimensaoDeFiltro = typeof DIMENSOES_DE_FILTRO[number];

/** Situações que `application_participants.status` aceita. */
export const SITUACOES_DE_PARTICIPANTE = [
  "ELIGIBLE",
  "INVITED",
  "IN_PROGRESS",
  "COMPLETED",
  "BLOCKED",
  "EXCLUDED",
] as const;

export type SituacaoDeParticipante = typeof SITUACOES_DE_PARTICIPANTE[number];

export const ROTULO_DA_SITUACAO: Record<SituacaoDeParticipante, string> = {
  ELIGIBLE: "Não iniciada",
  INVITED: "Convidada",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Enviada",
  BLOCKED: "Bloqueada",
  EXCLUDED: "Removida",
};

export type FiltrosDeParticipantes = {
  directorate: string[];
  unit: string[];
  coordination: string[];
  costCenter: string[];
  jobTitle: string[];
  situacao: SituacaoDeParticipante[];
  busca: string;
};

export const FILTROS_VAZIOS: FiltrosDeParticipantes = {
  directorate: [],
  unit: [],
  coordination: [],
  costCenter: [],
  jobTitle: [],
  situacao: [],
  busca: "",
};

function ehSituacao(valor: string): valor is SituacaoDeParticipante {
  return (SITUACOES_DE_PARTICIPANTE as readonly string[]).includes(valor);
}

/**
 * Valores de uma dimensão, sem repetição e sem vazio.
 *
 * Apenas a forma repetida — `?unit=A&unit=B` —, que é a que o navegador produz
 * e a que {@link escreverFiltrosNaUrl} escreve.
 *
 * Cheguei a aceitar também `?unit=A,B`, por conveniência de quem digita o
 * endereço à mão. Custava um dado: uma unidade chamada "Coordenação, Geral"
 * voltava partida em duas, e o filtro passava a procurar dois valores que não
 * existem — em silêncio, devolvendo lista vazia sem dizer por quê. Conveniência
 * de digitação não paga esse preço.
 */
function valoresDe(parametros: URLSearchParams, chave: string): string[] {
  const vistos = new Set<string>();

  for (const bruto of parametros.getAll(chave)) {
    const texto = bruto.trim();
    if (texto) vistos.add(texto);
  }

  return [...vistos];
}

/** Lê os filtros de uma query string, descartando o que não é dimensão conhecida. */
export function lerFiltrosDaUrl(parametros: URLSearchParams): FiltrosDeParticipantes {
  const filtros: FiltrosDeParticipantes = { ...FILTROS_VAZIOS };

  for (const dimensao of DIMENSOES_DE_FILTRO) {
    filtros[dimensao] = valoresDe(parametros, dimensao);
  }

  filtros.situacao = valoresDe(parametros, "situacao").filter(ehSituacao);
  filtros.busca = (parametros.get("busca") ?? "").trim();

  return filtros;
}

/**
 * Escreve os filtros de volta na URL, omitindo o que está vazio.
 *
 * Endereço sem parâmetro inútil é endereço que se lê — e a ausência da chave
 * diz "sem filtro" com mais clareza que `unit=`.
 */
export function escreverFiltrosNaUrl(filtros: FiltrosDeParticipantes): URLSearchParams {
  const parametros = new URLSearchParams();

  for (const dimensao of DIMENSOES_DE_FILTRO) {
    for (const valor of filtros[dimensao]) parametros.append(dimensao, valor);
  }
  for (const situacao of filtros.situacao) parametros.append("situacao", situacao);
  if (filtros.busca.trim()) parametros.set("busca", filtros.busca.trim());

  return parametros;
}

/**
 * Forma que a RPC espera: só as chaves preenchidas.
 *
 * Mandar `{"unit": []}` seria equivalente a não mandar nada — a função trata
 * lista vazia como "não restringe" —, mas o payload menor deixa o log legível
 * quando alguém for descobrir por que um recorte devolveu o que devolveu.
 */
export function paraPayloadDaRpc(filtros: FiltrosDeParticipantes): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const dimensao of DIMENSOES_DE_FILTRO) {
    if (filtros[dimensao].length) payload[dimensao] = filtros[dimensao];
  }
  if (filtros.situacao.length) payload.situacao = filtros.situacao;
  if (filtros.busca.trim()) payload.busca = filtros.busca.trim();

  return payload;
}

/** Atalho do servidor: da query string direto ao payload da RPC. */
export function normalizarFiltrosDeParticipantes(parametros: URLSearchParams): Record<string, unknown> {
  return paraPayloadDaRpc(lerFiltrosDaUrl(parametros));
}

/** Há algum recorte ativo? Decide o aviso de "mostrando N de M". */
export function temFiltroAtivo(filtros: FiltrosDeParticipantes): boolean {
  return Object.keys(paraPayloadDaRpc(filtros)).length > 0;
}
