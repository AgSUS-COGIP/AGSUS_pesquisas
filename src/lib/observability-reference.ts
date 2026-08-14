/**
 * Validação da referência técnica de erro.
 *
 * Vive aqui, e não dentro do Route Handler, porque é a parte testável — e
 * porque foi um descuido silencioso: a referência passava pelo mesmo
 * sanitizador do texto livre, cuja regra `\d{5,20}` transformava um UUID com
 * cinco dígitos seguidos em `[numero removido]-81fd-…`. O código gravado
 * deixava de ser o que o usuário lia na tela, e o suporte procurava por algo
 * que não existia.
 *
 * A referência é gerada pela plataforma, não digitada por ninguém: não carrega
 * dado pessoal e não há o que remover dela. O que cabe é conferir a forma.
 */
export function isValidErrorReference(value: string) {
  return /^[A-Za-z0-9-]{8,80}$/.test(value);
}

export function normalizeErrorReference(value: unknown): string {
  if (typeof value !== "string") return "";
  const candidate = value.trim().slice(0, 80);
  return isValidErrorReference(candidate) ? candidate : "";
}
