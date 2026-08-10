/**
 * Leitura tolerante do metadado da pessoa (`people.metadata`).
 *
 * O campo é um JSON livre alimentado pela importação da base institucional, que
 * varia de planilha para planilha: a mesma informação aparece como `unit`,
 * `unidade` ou `organizational_unit`. Por isso a busca aceita vários nomes e
 * devolve o primeiro que tiver conteúdo útil.
 *
 * Nada aqui lança: metadado ausente ou com tipo inesperado devolve `null`, e a
 * tela decide o texto de "não informado".
 */
export function metadataText(metadata: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Objeto aninhado do metadado (ex.: `avatar_config`); array não conta como objeto. */
export function metadataObject(metadata: Record<string, unknown>, key: string) {
  const value = metadata?.[key];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
