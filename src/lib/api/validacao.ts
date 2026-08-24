import type { RespostaEntrada } from "./contratos-runtime";

/**
 * Validação de forma para as rotas da API.
 *
 * Só verifica o que é barato e óbvio — formato de identificador, presença de
 * campo. Regra de negócio não mora aqui: ela está nas RPCs, que revalidam tudo
 * de qualquer maneira. O ganho é evitar uma ida ao banco por um pedido que já
 * se sabe malformado, e devolver 400 em vez de deixar o Postgres levantar
 * `22P02` para um identificador que nunca foi UUID.
 */

const PADRAO_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Verdadeiro para UUID nas versões 1 a 8, variante RFC 4122. */
export function ehUuid(valor: unknown): valor is string {
  return typeof valor === "string" && PADRAO_UUID.test(valor);
}

/** Verdadeiro apenas para um objeto JSON; exclui `null` e arrays. */
export function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor);
}

/**
 * Valida a forma completa de uma resposta antes de repassá-la ao PostgREST.
 *
 * O cast após `request.json()` não valida o valor em runtime. Sem esta guarda,
 * JSON válido como `null` causava uma exceção ao acessar `questionId`, e tipos
 * incompatíveis chegavam até uma RPC privilegiada. Regras ligadas ao tipo da
 * pergunta continuam no banco; aqui são verificadas apenas forma e dimensão.
 */
export function erroNaEntradaDeResposta(valor: unknown): string | null {
  if (!ehObjeto(valor)) {
    return "Informe os dados da resposta em um objeto JSON.";
  }

  const entrada = valor;
  if (!ehUuid(entrada.questionId)) return "Identificador de pergunta inválido.";

  const optionIds = entrada.optionIds;
  if (optionIds !== undefined && optionIds !== null) {
    if (!Array.isArray(optionIds) || !optionIds.every(ehUuid)) {
      return "Informe identificadores de alternativas válidos.";
    }
  }

  if (entrada.text !== undefined && entrada.text !== null) {
    if (typeof entrada.text !== "string") return "Informe uma resposta textual válida.";
    if (entrada.text.length > 12_000) return "O texto excede o limite de 12.000 caracteres.";
  }

  if (entrada.number !== undefined && entrada.number !== null
    && (typeof entrada.number !== "number" || !Number.isFinite(entrada.number))) {
    return "Informe uma resposta numérica válida.";
  }

  if (entrada.boolean !== undefined && entrada.boolean !== null && typeof entrada.boolean !== "boolean") {
    return "Informe uma resposta lógica válida.";
  }

  for (const campo of ["date", "datetime"] as const) {
    const conteudo = entrada[campo];
    if (conteudo !== undefined && conteudo !== null
      && (typeof conteudo !== "string" || conteudo.length > 64)) {
      return "Informe uma data válida.";
    }
  }

  return null;
}

export function ehEntradaDeResposta(valor: unknown): valor is RespostaEntrada {
  return erroNaEntradaDeResposta(valor) === null;
}
