/**
 * Estatísticas descritivas das respostas — funções puras, sem banco e sem React.
 *
 * ## Por que a entrada é uma tabela de frequências
 *
 * O painel já recebe, para cada pergunta de alternativa, a lista de opções com
 * rótulo, valor e contagem. Isso **é** uma tabela de frequências: dizer que a
 * opção "4" apareceu 137 vezes carrega a mesma informação que 137 respostas
 * iguais a 4, ocupando três números em vez de cento e trinta e sete.
 *
 * Trabalhar sobre a frequência, e não sobre a lista de respostas, tem duas
 * consequências boas. A primeira é que nada precisa mudar no banco: o dado já
 * chega pronto, e esta PR não redefine nenhuma RPC. A segunda é que o custo
 * deixa de crescer com o número de respostas — 1.030 pessoas e 52 perguntas
 * continuam sendo poucas dezenas de números por pergunta.
 *
 * Quem tiver respostas soltas usa {@link tabelaDeFrequencias} para chegar à
 * mesma forma. O cálculo é um só.
 *
 * ## O que estas funções não fazem
 *
 * Não decidem quais estatísticas cabem a cada tipo de pergunta — isso é
 * {@link estatisticasDaPergunta}, que aplica a regra do produto. E não inferem
 * significado: uma escala de 1 a 5 tratada como número é uma decisão do
 * instrumento, não desta camada.
 */

/** Uma classe da distribuição: o valor observado e quantas vezes apareceu. */
export type ClasseDeFrequencia = {
  valor: number;
  frequencia: number;
};

/** Resumo numérico de uma distribuição. */
export type ResumoNumerico = {
  /** Respostas efetivamente consideradas — soma das frequências. */
  respostasValidas: number;
  media: number;
  mediana: number;
  /** Variância populacional: descreve quem respondeu, não uma amostra maior. */
  variancia: number;
  desvioPadrao: number;
  minimo: number;
  maximo: number;
};

/** Uma linha da distribuição exibida, com percentual já calculado. */
export type ClasseDaDistribuicao = {
  rotulo: string;
  valor: number | null;
  frequenciaAbsoluta: number;
  /** Percentual sobre o total de respostas da pergunta, de 0 a 100. */
  frequenciaRelativa: number;
};

/**
 * Converte respostas soltas em tabela de frequências, descartando o que não é
 * número finito.
 *
 * `null`, `undefined`, texto não numérico, `NaN` e infinito são **descartados**,
 * não convertidos em zero. Zero é uma resposta legítima numa escala que começa
 * em zero, e transformar ausência em zero deslocaria a média para baixo sem que
 * ninguém tivesse respondido isso.
 */
export function tabelaDeFrequencias(valores: readonly unknown[]): ClasseDeFrequencia[] {
  const contagem = new Map<number, number>();

  for (const bruto of valores) {
    const numero = paraNumeroFinito(bruto);
    if (numero === null) continue;
    contagem.set(numero, (contagem.get(numero) ?? 0) + 1);
  }

  return [...contagem.entries()]
    .map(([valor, frequencia]) => ({ valor, frequencia }))
    .sort((a, b) => a.valor - b.valor);
}

/**
 * Número finito, ou `null` quando o valor não representa um.
 *
 * Aceita string porque `question_options.value` é `text` no banco — uma escala
 * de 1 a 5 chega como `"1"`..`"5"`. String vazia e espaços em branco viram
 * `null` em vez de zero, que é o que `Number("")` devolveria.
 */
export function paraNumeroFinito(bruto: unknown): number | null {
  if (typeof bruto === "number") return Number.isFinite(bruto) ? bruto : null;
  if (typeof bruto === "string") {
    const texto = bruto.trim();
    if (!texto) return null;
    const numero = Number(texto);
    return Number.isFinite(numero) ? numero : null;
  }
  return null;
}

/**
 * Resumo numérico de uma tabela de frequências.
 *
 * Devolve `null` quando não há resposta válida — e isso é diferente de devolver
 * zeros. Média zero afirma que as pessoas responderam zero; ausência de resumo
 * afirma que ninguém respondeu, que é o caso. A tela precisa distinguir os dois
 * para não inventar um dado que não existe.
 *
 * Classes com frequência não positiva ou valor não finito são ignoradas: uma
 * opção que ninguém escolheu não desloca mínimo nem máximo.
 */
export function resumoNumerico(classes: readonly ClasseDeFrequencia[]): ResumoNumerico | null {
  const validas = classes
    .filter((classe) => Number.isFinite(classe.valor) && Number.isFinite(classe.frequencia) && classe.frequencia > 0)
    .sort((a, b) => a.valor - b.valor);

  const total = validas.reduce((soma, classe) => soma + classe.frequencia, 0);
  if (total === 0) return null;

  let somaPonderada = 0;
  for (const classe of validas) somaPonderada += classe.valor * classe.frequencia;
  const media = somaPonderada / total;

  /*
    Variância em duas passagens, e não pela forma `E[x²] - E[x]²`.

    A forma abreviada subtrai dois números grandes e próximos quando os valores
    são altos e a dispersão é pequena, e o resultado pode sair negativo por erro
    de ponto flutuante — o que faz a raiz quadrada devolver `NaN` no desvio
    padrão. Somar o quadrado do desvio em relação à média já calculada nunca
    produz soma negativa.
  */
  let somaDosQuadrados = 0;
  for (const classe of validas) {
    const desvio = classe.valor - media;
    somaDosQuadrados += desvio * desvio * classe.frequencia;
  }
  const variancia = somaDosQuadrados / total;

  return {
    respostasValidas: total,
    media,
    mediana: medianaDaTabela(validas, total),
    variancia,
    // `Math.max(0, …)` protege contra um -0 vindo de arredondamento; a raiz de
    // um negativo minúsculo seria `NaN` e contaminaria a tela inteira.
    desvioPadrao: Math.sqrt(Math.max(0, variancia)),
    minimo: validas[0].valor,
    maximo: validas[validas.length - 1].valor,
  };
}

/**
 * Mediana sobre a tabela ordenada, sem expandir as frequências.
 *
 * Com total par, é a média dos dois valores centrais — que podem cair na mesma
 * classe, e aí a média deles é o próprio valor.
 */
function medianaDaTabela(ordenadas: readonly ClasseDeFrequencia[], total: number): number {
  const posicaoInferior = Math.floor((total - 1) / 2);
  const posicaoSuperior = Math.floor(total / 2);

  let acumulado = 0;
  let valorInferior: number | null = null;
  let valorSuperior: number | null = null;

  for (const classe of ordenadas) {
    acumulado += classe.frequencia;
    if (valorInferior === null && acumulado > posicaoInferior) valorInferior = classe.valor;
    if (valorSuperior === null && acumulado > posicaoSuperior) {
      valorSuperior = classe.valor;
      break;
    }
  }

  // Os dois só ficariam nulos com total zero, que o chamador já descartou.
  return ((valorInferior ?? 0) + (valorSuperior ?? 0)) / 2;
}

/**
 * Distribuição exibível a partir das alternativas de uma pergunta.
 *
 * ## Qual percentual, e por quê
 *
 * Há duas leituras possíveis, e elas divergem **apenas em múltipla escolha**:
 *
 * ```text
 * percentual de respondentes   quantas pessoas marcaram esta alternativa
 *                              denominador = respostas da pergunta
 *                              em múltipla escolha, a soma passa de 100%
 *
 * participação nas marcações   que fatia do total de marcações é esta
 *                              denominador = soma das contagens
 *                              sempre soma 100%
 * ```
 *
 * Onde cada pessoa escolhe uma alternativa só — escala, escolha única, sim/não
 * — os dois denominadores são o mesmo número e o resultado é idêntico.
 *
 * `respondentes` seleciona a primeira leitura, que é a preferida no painel
 * institucional: ela responde "quantas pessoas marcaram esta opção?", que é a
 * pergunta que quem opera realmente faz. Sem esse argumento, cai na segunda —
 * que é exatamente o que `toDistributionBars` já faz hoje, e é o que mantém
 * esta função compatível com o comportamento vigente da tela.
 */
export function distribuicao(
  alternativas: readonly { label: string; value?: string | null; count: number }[],
  respondentes?: number,
): ClasseDaDistribuicao[] {
  const marcacoes = alternativas.reduce((soma, item) => soma + Math.max(0, item.count), 0);
  const denominador = typeof respondentes === "number" && respondentes > 0 ? respondentes : marcacoes;

  return alternativas.map((item) => ({
    rotulo: item.label,
    valor: paraNumeroFinito(item.value),
    frequenciaAbsoluta: item.count,
    frequenciaRelativa: denominador === 0 ? 0 : (item.count / denominador) * 100,
  }));
}

/** Tipos de pergunta cujas alternativas carregam ordem numérica. */
const TIPOS_NUMERICOS = new Set(["SCALE", "INTEGER", "DECIMAL"]);

/** Tipos de pergunta que se descrevem por frequência de alternativa. */
const TIPOS_DE_ALTERNATIVA = new Set(["SCALE", "SINGLE_CHOICE", "MULTIPLE_CHOICE", "BOOLEAN"]);

export type EstatisticasDaPergunta = {
  /** Presente apenas quando o tipo é numérico e há alternativa com valor numérico. */
  resumo: ResumoNumerico | null;
  /** Presente para tipos de alternativa; vazio nos demais. */
  distribuicao: ClasseDaDistribuicao[];
};

export type OpcoesDaPergunta = {
  /** Respostas da pergunta. Muda o denominador do percentual — ver {@link distribuicao}. */
  respondentes?: number;
  /**
   * Valores numéricos que **não** vêm das alternativas.
   *
   * `INTEGER` e `DECIMAL` gravam em `answers.answer_number` e não têm
   * alternativa nenhuma: para eles, a tabela de frequências não pode ser
   * derivada de `options`, e sem ela não há resumo. Este parâmetro é a porta de
   * entrada desse dado quando ele existir.
   *
   * Hoje ninguém o preenche, porque a RPC do painel não devolve
   * `answer_number` — e trazer isso exige alterar a RPC, o que está fora desta
   * PR. O parâmetro existe para que ativar esses tipos depois seja passar um
   * argumento, e não reabrir a regra.
   */
  frequenciasNumericas?: readonly ClasseDeFrequencia[];
};

/**
 * A regra do produto: quais estatísticas cabem a cada tipo de pergunta.
 *
 * Média de "Sim/Não" não significa nada, e média de texto livre menos ainda. Só
 * escala e número recebem resumo numérico; alternativa recebe distribuição;
 * texto não recebe nenhum dos dois — a contagem de respostas que a tela já
 * mostra basta, e o resto é análise qualitativa, fora deste escopo.
 *
 * O resumo também some quando a pergunta é numérica mas as alternativas não têm
 * valor numérico — uma escala rotulada só por texto, por exemplo. Melhor não
 * mostrar média do que mostrar a média das posições, que ninguém respondeu.
 *
 * ## Cobertura efetiva hoje
 *
 * Na prática, o resumo numérico sai para **`SCALE`**, e só. `INTEGER` e
 * `DECIMAL` constam como numéricos e continuam sem resumo, porque a origem dos
 * valores deles — `answers.answer_number` — não chega até aqui: eles não têm
 * alternativas, e é de `options` que a tabela de frequências é derivada.
 *
 * Isso é limitação de dado, não de regra. Quem passar `frequenciasNumericas`
 * recebe o resumo imediatamente, sem tocar nesta função. Os testes fixam os dois
 * comportamentos para que a mudança seja deliberada quando acontecer.
 */
export function estatisticasDaPergunta(
  questionType: string,
  alternativas: readonly { label: string; value?: string | null; count: number }[],
  opcoes: OpcoesDaPergunta = {},
): EstatisticasDaPergunta {
  const ehDeAlternativa = TIPOS_DE_ALTERNATIVA.has(questionType);
  const linhas = ehDeAlternativa ? distribuicao(alternativas, opcoes.respondentes) : [];

  if (!TIPOS_NUMERICOS.has(questionType)) {
    return { resumo: null, distribuicao: linhas };
  }

  // Valores vindos de fora têm precedência: quem os forneceu tem a origem certa
  // do número, enquanto as alternativas são apenas a origem possível para escala.
  const classes: ClasseDeFrequencia[] = opcoes.frequenciasNumericas
    ? [...opcoes.frequenciasNumericas]
    : linhas
        .filter((linha): linha is ClasseDaDistribuicao & { valor: number } => linha.valor !== null)
        .map((linha) => ({ valor: linha.valor, frequencia: linha.frequenciaAbsoluta }));

  return { resumo: resumoNumerico(classes), distribuicao: linhas };
}

/**
 * Arredondamento para exibição, com casas fixas.
 *
 * Fica aqui, e não na tela, para que média e desvio de uma mesma pergunta nunca
 * apareçam com precisões diferentes conforme quem chamou.
 */
export function formatarNumero(valor: number, casas = 2): string {
  return valor.toLocaleString("pt-BR", {
    minimumFractionDigits: casas,
    maximumFractionDigits: casas,
  });
}
