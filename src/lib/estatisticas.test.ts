import { describe, expect, it } from "vitest";
import {
  distribuicao,
  estatisticasDaPergunta,
  paraNumeroFinito,
  resumoNumerico,
  tabelaDeFrequencias,
  type ClasseDeFrequencia,
} from "./estatisticas";

/*
 * O que estes testes protegem.
 *
 * Estatística errada não quebra a tela: ela publica um número plausível. Uma
 * média deslocada por tratar ausência como zero, ou um desvio padrão `NaN`
 * vindo de variância negativa por erro de ponto flutuante, chegam à
 * administração com a mesma cara de um cálculo correto. Por isso os casos aqui
 * são conferidos à mão, e não contra a própria implementação.
 */

/** Tabela de frequências a partir de respostas repetidas, para leitura direta. */
function classes(...pares: Array<[valor: number, frequencia: number]>): ClasseDeFrequencia[] {
  return pares.map(([valor, frequencia]) => ({ valor, frequencia }));
}

describe("paraNumeroFinito", () => {
  it("aceita número e string numérica", () => {
    expect(paraNumeroFinito(4)).toBe(4);
    expect(paraNumeroFinito("4")).toBe(4);
    expect(paraNumeroFinito(" 4.5 ")).toBe(4.5);
    expect(paraNumeroFinito(0)).toBe(0);
    expect(paraNumeroFinito("-2")).toBe(-2);
  });

  it("recusa o que não representa número, sem virar zero", () => {
    // `Number("")` e `Number(" ")` devolvem 0 — o que transformaria ausência de
    // resposta em resposta "zero" e puxaria a média para baixo.
    expect(paraNumeroFinito("")).toBeNull();
    expect(paraNumeroFinito("   ")).toBeNull();
    expect(paraNumeroFinito(null)).toBeNull();
    expect(paraNumeroFinito(undefined)).toBeNull();
    expect(paraNumeroFinito("Sempre")).toBeNull();
    expect(paraNumeroFinito(Number.NaN)).toBeNull();
    expect(paraNumeroFinito(Number.POSITIVE_INFINITY)).toBeNull();
    expect(paraNumeroFinito({})).toBeNull();
    expect(paraNumeroFinito([])).toBeNull();
  });
});

describe("tabelaDeFrequencias", () => {
  it("agrupa repetições e ordena por valor", () => {
    expect(tabelaDeFrequencias([3, 1, 3, 2, 1, 3])).toEqual(
      classes([1, 2], [2, 1], [3, 3]),
    );
  });

  it("descarta o inválido em vez de contá-lo como zero", () => {
    expect(tabelaDeFrequencias([5, null, "", "abc", undefined, Number.NaN, 5])).toEqual(
      classes([5, 2]),
    );
  });

  it("devolve tabela vazia para entrada vazia", () => {
    expect(tabelaDeFrequencias([])).toEqual([]);
  });
});

describe("resumoNumerico — casos conferidos à mão", () => {
  it("calcula o conjunto 2,4,4,4,5,5,7,9", () => {
    // Exemplo clássico de desvio padrão populacional: média 5, variância 4,
    // desvio 2. Conferido manualmente.
    const resumo = resumoNumerico(classes([2, 1], [4, 3], [5, 2], [7, 1], [9, 1]));

    expect(resumo).not.toBeNull();
    expect(resumo!.respostasValidas).toBe(8);
    expect(resumo!.media).toBe(5);
    expect(resumo!.variancia).toBe(4);
    expect(resumo!.desvioPadrao).toBe(2);
    expect(resumo!.minimo).toBe(2);
    expect(resumo!.maximo).toBe(9);
  });

  it("usa a média dos dois centrais quando o total é par", () => {
    // 1,2,3,4 → mediana (2+3)/2 = 2.5
    expect(resumoNumerico(classes([1, 1], [2, 1], [3, 1], [4, 1]))!.mediana).toBe(2.5);
  });

  it("usa o valor central quando o total é ímpar", () => {
    // 1,2,3 → mediana 2
    expect(resumoNumerico(classes([1, 1], [2, 1], [3, 1]))!.mediana).toBe(2);
  });

  it("acerta a mediana quando os dois centrais caem na mesma classe", () => {
    // 1,3,3,3,3,5 → os dois centrais são 3 e 3
    expect(resumoNumerico(classes([1, 1], [3, 4], [5, 1]))!.mediana).toBe(3);
  });

  it("calcula uma escala Likert típica de 1 a 5", () => {
    // 10×1, 20×2, 40×3, 20×4, 10×5 = 100 respostas, simétrica em torno de 3.
    const resumo = resumoNumerico(classes([1, 10], [2, 20], [3, 40], [4, 20], [5, 10]))!;

    expect(resumo.respostasValidas).toBe(100);
    expect(resumo.media).toBe(3);
    expect(resumo.mediana).toBe(3);
    expect(resumo.variancia).toBeCloseTo(1.2, 10);
    expect(resumo.desvioPadrao).toBeCloseTo(Math.sqrt(1.2), 10);
  });
});

describe("resumoNumerico — limites", () => {
  it("devolve null quando não há resposta, em vez de zeros", () => {
    // Zeros afirmariam que as pessoas responderam zero. Ausência é outra coisa.
    expect(resumoNumerico([])).toBeNull();
    expect(resumoNumerico(classes([3, 0]))).toBeNull();
  });

  it("trata resposta única sem dispersão", () => {
    const resumo = resumoNumerico(classes([7, 1]))!;

    expect(resumo.respostasValidas).toBe(1);
    expect(resumo.media).toBe(7);
    expect(resumo.mediana).toBe(7);
    expect(resumo.variancia).toBe(0);
    expect(resumo.desvioPadrao).toBe(0);
    expect(resumo.minimo).toBe(7);
    expect(resumo.maximo).toBe(7);
  });

  it("trata todas as respostas iguais", () => {
    const resumo = resumoNumerico(classes([4, 250]))!;

    expect(resumo.variancia).toBe(0);
    expect(resumo.desvioPadrao).toBe(0);
    expect(resumo.minimo).toBe(4);
    expect(resumo.maximo).toBe(4);
  });

  it("nunca devolve desvio padrão NaN com valores altos e pouca dispersão", () => {
    // É onde a forma abreviada `E[x²] - E[x]²` produz variância negativa por
    // erro de ponto flutuante, e a raiz quadrada vira NaN.
    const resumo = resumoNumerico(classes([1_000_000_001, 500], [1_000_000_002, 500]))!;

    expect(Number.isNaN(resumo.desvioPadrao)).toBe(false);
    expect(resumo.variancia).toBeGreaterThanOrEqual(0);
    expect(resumo.desvioPadrao).toBeCloseTo(0.5, 6);
  });

  it("ignora classe com frequência negativa ou valor não finito", () => {
    const resumo = resumoNumerico([
      { valor: 2, frequencia: 1 },
      { valor: 8, frequencia: -5 },
      { valor: Number.NaN, frequencia: 3 },
      { valor: 4, frequencia: 1 },
    ])!;

    expect(resumo.respostasValidas).toBe(2);
    expect(resumo.media).toBe(3);
    expect(resumo.minimo).toBe(2);
    expect(resumo.maximo).toBe(4);
  });

  it("aceita classes fora de ordem e valores negativos", () => {
    const resumo = resumoNumerico(classes([5, 1], [-3, 1], [1, 1]))!;

    expect(resumo.minimo).toBe(-3);
    expect(resumo.maximo).toBe(5);
    expect(resumo.mediana).toBe(1);
    expect(resumo.media).toBe(1);
  });
});

describe("distribuicao", () => {
  it("calcula percentual sobre o total de respostas da pergunta", () => {
    const linhas = distribuicao([
      { label: "Sim", value: "1", count: 30 },
      { label: "Não", value: "0", count: 10 },
    ]);

    expect(linhas[0]).toEqual({ rotulo: "Sim", valor: 1, frequenciaAbsoluta: 30, frequenciaRelativa: 75 });
    expect(linhas[1].frequenciaRelativa).toBe(25);
  });

  it("não divide por zero quando ninguém respondeu", () => {
    const linhas = distribuicao([{ label: "Sim", value: "1", count: 0 }]);

    expect(linhas[0].frequenciaRelativa).toBe(0);
    expect(Number.isNaN(linhas[0].frequenciaRelativa)).toBe(false);
  });

  it("marca como null a alternativa sem valor numérico", () => {
    const linhas = distribuicao([{ label: "Concordo", value: "CONCORDO", count: 4 }]);

    expect(linhas[0].valor).toBeNull();
    expect(linhas[0].frequenciaAbsoluta).toBe(4);
  });

  it("passa de 100% em múltipla escolha, porque cada pessoa marca mais de uma", () => {
    const linhas = distribuicao([
      { label: "A", value: null, count: 8 },
      { label: "B", value: null, count: 7 },
    ]);

    const soma = linhas.reduce((total, linha) => total + linha.frequenciaRelativa, 0);
    expect(Math.round(soma)).toBe(100);
  });
});

describe("estatisticasDaPergunta — a regra por tipo", () => {
  const escala = [
    { label: "Nunca", value: "1", count: 2 },
    { label: "Sempre", value: "5", count: 2 },
  ];

  it("dá resumo e distribuição para SCALE", () => {
    const resultado = estatisticasDaPergunta("SCALE", escala);

    expect(resultado.resumo).not.toBeNull();
    expect(resultado.resumo!.media).toBe(3);
    expect(resultado.distribuicao).toHaveLength(2);
  });

  it("dá só distribuição para escolha, sem média sem sentido", () => {
    for (const tipo of ["SINGLE_CHOICE", "MULTIPLE_CHOICE", "BOOLEAN"]) {
      const resultado = estatisticasDaPergunta(tipo, escala);

      expect(resultado.resumo, `${tipo} não deve ter resumo numérico`).toBeNull();
      expect(resultado.distribuicao).toHaveLength(2);
    }
  });

  it("não dá resumo nem distribuição para texto", () => {
    for (const tipo of ["SHORT_TEXT", "LONG_TEXT"]) {
      const resultado = estatisticasDaPergunta(tipo, []);

      expect(resultado.resumo).toBeNull();
      expect(resultado.distribuicao).toEqual([]);
    }
  });

  it("omite o resumo quando a escala não tem valor numérico", () => {
    // Escala rotulada só por texto: exibir a média das posições seria inventar
    // um número que ninguém respondeu.
    const resultado = estatisticasDaPergunta("SCALE", [
      { label: "Ruim", value: "RUIM", count: 3 },
      { label: "Bom", value: "BOM", count: 5 },
    ]);

    expect(resultado.resumo).toBeNull();
    expect(resultado.distribuicao).toHaveLength(2);
  });

  it("omite o resumo quando a pergunta não teve resposta", () => {
    const resultado = estatisticasDaPergunta("SCALE", [
      { label: "Nunca", value: "1", count: 0 },
      { label: "Sempre", value: "5", count: 0 },
    ]);

    expect(resultado.resumo).toBeNull();
    expect(resultado.distribuicao).toHaveLength(2);
  });

  it("trata tipo desconhecido sem quebrar", () => {
    const resultado = estatisticasDaPergunta("TIPO_QUE_AINDA_NAO_EXISTE", escala);

    expect(resultado.resumo).toBeNull();
    expect(resultado.distribuicao).toEqual([]);
  });
});
