/**
 * Reconciliação dos filtros do painel CDDI — função pura, sem React.
 *
 * ## O problema que isto resolve
 *
 * As opções de cada dimensão são facetadas: só aparece a unidade que existe
 * dentro da diretoria escolhida. Isso é bom até alguém trocar a diretoria — a
 * unidade antiga some da lista, mas continua no estado, **restringindo o
 * resultado sem aparecer em lugar nenhum**. O painel passa a mostrar números
 * que nenhum filtro visível explica.
 *
 * A correção é reconciliar a cada mudança: toda seleção que deixou de existir
 * no novo recorte sai do estado, não só da lista.
 *
 * ## Quem vence quando duas seleções antigas conflitam
 *
 * Reavaliar todas as dimensões simetricamente é instável: com Diretoria A e
 * Unidade X no estado, escolher Diretoria B cria um conflito que pode ser
 * resolvido dos dois lados — descartar a unidade nova ou a diretoria nova. Um
 * algoritmo simétrico escolheria conforme a ordem em que varreu as dimensões, e
 * a pessoa veria a própria escolha ser desfeita sem motivo aparente.
 *
 * Por isso a dimensão que acabou de mudar é **autoritativa**: ela fica fixa, e
 * as demais se reconciliam com ela. A intenção mais recente sempre vence.
 *
 * ## Por que precisa iterar
 *
 * Descartar uma unidade pode deixar uma chefia órfã, e descartar essa chefia
 * pode deixar um participante órfão. Uma passagem só não estabiliza. O laço
 * repete até nada mais mudar — no máximo uma vez por dimensão, porque cada
 * volta que altera algo remove pelo menos um valor de um conjunto finito.
 */

/** O mínimo que uma pessoa precisa ter para ser filtrada. */
export type PessoaFiltravel = {
  personId: string;
  directorate: string;
  unit: string;
  coordination: string;
  managerName?: string | null;
  autoCompleted: boolean;
  leaderCompleted: boolean;
};

export type DimensaoCddi = "participant" | "directorate" | "unit" | "coordination" | "manager" | "status";

export type FiltrosCddi = {
  participantIds: string[];
  directorates: string[];
  units: string[];
  coordinations: string[];
  managers: string[];
  statuses: string[];
};

export const FILTROS_CDDI_VAZIOS: FiltrosCddi = {
  participantIds: [],
  directorates: [],
  units: [],
  coordinations: [],
  managers: [],
  statuses: [],
};

/** Situação derivada das duas avaliações. Espelha `participantState` da tela. */
export function situacaoDaPessoa(pessoa: PessoaFiltravel) {
  if (pessoa.autoCompleted && pessoa.leaderCompleted) return "COMPLETE";
  if (pessoa.autoCompleted) return "AWAITING_LEADER";
  if (pessoa.leaderCompleted) return "AWAITING_AUTO";
  return "PENDING";
}

/**
 * `NO_MANAGER` não é uma situação de avaliação — é ausência de vínculo. Fica no
 * mesmo filtro porque, para quem opera, "sem chefia informada" é o mesmo tipo
 * de pendência que "aguardando chefia".
 */
export function atendeSituacao(pessoa: PessoaFiltravel, situacoes: readonly string[]) {
  if (!situacoes.length) return true;
  return situacoes.some(
    (situacao) => situacaoDaPessoa(pessoa) === situacao || (situacao === "NO_MANAGER" && !pessoa.managerName),
  );
}

/** O valor que a pessoa tem naquela dimensão, ou `null` quando não há. */
function valorDaDimensao(pessoa: PessoaFiltravel, dimensao: DimensaoCddi): string | null {
  switch (dimensao) {
    case "participant": return pessoa.personId;
    case "directorate": return pessoa.directorate || null;
    case "unit": return pessoa.unit || null;
    case "coordination": return pessoa.coordination || null;
    case "manager": return pessoa.managerName || null;
    case "status": return null;
  }
}

function selecaoDa(filtros: FiltrosCddi, dimensao: DimensaoCddi): string[] {
  switch (dimensao) {
    case "participant": return filtros.participantIds;
    case "directorate": return filtros.directorates;
    case "unit": return filtros.units;
    case "coordination": return filtros.coordinations;
    case "manager": return filtros.managers;
    case "status": return filtros.statuses;
  }
}

/** Substitui a seleção de uma dimensão, sem tocar nas demais. */
export function comDimensao(filtros: FiltrosCddi, dimensao: DimensaoCddi, valores: string[]): FiltrosCddi {
  return comSelecao(filtros, dimensao, valores);
}

function comSelecao(filtros: FiltrosCddi, dimensao: DimensaoCddi, valores: string[]): FiltrosCddi {
  switch (dimensao) {
    case "participant": return { ...filtros, participantIds: valores };
    case "directorate": return { ...filtros, directorates: valores };
    case "unit": return { ...filtros, units: valores };
    case "coordination": return { ...filtros, coordinations: valores };
    case "manager": return { ...filtros, managers: valores };
    case "status": return { ...filtros, statuses: valores };
  }
}

const TODAS_AS_DIMENSOES: DimensaoCddi[] = ["participant", "directorate", "unit", "coordination", "manager", "status"];

/**
 * A pessoa atende os filtros, ignorando opcionalmente uma dimensão.
 *
 * O `ignorar` é o que torna as listas facetadas úteis: as opções de Unidade
 * consideram diretoria, coordenação e chefia escolhidas, mas **não** a própria
 * unidade — senão, escolher uma unidade apagaria todas as outras da lista e
 * tornaria impossível marcar a segunda.
 */
export function atendeFiltros(
  pessoa: PessoaFiltravel,
  filtros: FiltrosCddi,
  ignorar?: DimensaoCddi,
): boolean {
  for (const dimensao of TODAS_AS_DIMENSOES) {
    if (dimensao === ignorar) continue;

    if (dimensao === "status") {
      if (!atendeSituacao(pessoa, filtros.statuses)) return false;
      continue;
    }

    const selecionados = selecaoDa(filtros, dimensao);
    if (!selecionados.length) continue;

    const valor = valorDaDimensao(pessoa, dimensao);
    // Sem valor na dimensão, a pessoa não atende um filtro que a exige — é o
    // caso de quem não tem chefia quando há chefia selecionada.
    if (valor === null || !selecionados.includes(valor)) return false;
  }
  return true;
}

/** Valores disponíveis numa dimensão, dado o recorte das demais. */
export function opcoesDaDimensao(
  pessoas: readonly PessoaFiltravel[],
  filtros: FiltrosCddi,
  dimensao: Exclude<DimensaoCddi, "status">,
): string[] {
  const encontrados = new Set<string>();

  for (const pessoa of pessoas) {
    if (!atendeFiltros(pessoa, filtros, dimensao)) continue;
    const valor = valorDaDimensao(pessoa, dimensao);
    if (valor) encontrados.add(valor);
  }

  return [...encontrados].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

/** Situações que ainda existem no recorte, incluindo a ausência de chefia. */
export function situacoesDisponiveis(
  pessoas: readonly PessoaFiltravel[],
  filtros: FiltrosCddi,
): Set<string> {
  const encontradas = new Set<string>();

  for (const pessoa of pessoas) {
    if (!atendeFiltros(pessoa, filtros, "status")) continue;
    encontradas.add(situacaoDaPessoa(pessoa));
    if (!pessoa.managerName) encontradas.add("NO_MANAGER");
  }

  return encontradas;
}

/**
 * Aplica a mudança de uma dimensão e reconcilia as demais.
 *
 * A dimensão de `dimensaoAlterada` é fixada como intenção e **nunca** é
 * reduzida aqui. As outras perdem os valores que deixaram de existir no novo
 * recorte, em laço, até estabilizar.
 */
export function reconciliarFiltros(
  pessoas: readonly PessoaFiltravel[],
  filtros: FiltrosCddi,
  dimensaoAlterada: DimensaoCddi,
): FiltrosCddi {
  let atual = filtros;

  // O teto é o número de dimensões reconciliáveis: cada volta que muda algo
  // remove ao menos um valor, e os conjuntos são finitos. O limite existe para
  // que um engano futuro vire laço encerrado, e não travamento da aba.
  for (let volta = 0; volta < TODAS_AS_DIMENSOES.length; volta += 1) {
    let mudou = false;

    for (const dimensao of TODAS_AS_DIMENSOES) {
      if (dimensao === dimensaoAlterada) continue;

      const selecionados = selecaoDa(atual, dimensao);
      if (!selecionados.length) continue;

      const disponiveis = dimensao === "status"
        ? situacoesDisponiveis(pessoas, atual)
        : new Set(opcoesDaDimensao(pessoas, atual, dimensao));

      const mantidos = selecionados.filter((valor) => disponiveis.has(valor));
      if (mantidos.length !== selecionados.length) {
        atual = comSelecao(atual, dimensao, mantidos);
        mudou = true;
      }
    }

    if (!mudou) break;
  }

  return atual;
}

/** Há algum recorte ativo? A busca textual entra separada, por ser outro campo. */
export function temRecorteAtivo(filtros: FiltrosCddi): boolean {
  return TODAS_AS_DIMENSOES.some((dimensao) => selecaoDa(filtros, dimensao).length > 0);
}
