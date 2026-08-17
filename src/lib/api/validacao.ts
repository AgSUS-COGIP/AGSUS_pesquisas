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
