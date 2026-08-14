/**
 * Validação do motivo exigido numa confirmação destrutiva.
 *
 * Vive aqui, e não dentro do diálogo, porque é a parte testável: o componente
 * cuida de foco, teclado e apresentação; a regra de quando o texto serve é
 * função pura, e é ela que impede o pior caso — confirmar o irreversível e só
 * então o banco recusar o motivo curto.
 *
 * O mínimo é sempre o mesmo do banco. Divergir seria pior que não validar: a
 * tela aprovaria um texto que a RPC recusa, e a mensagem de erro chegaria depois
 * da confirmação, exatamente o que esta validação existe para evitar.
 */
export function confirmationReasonError(value: string, minLength: number): string | null {
  const trimmed = value.trim();
  const required = Math.max(1, Math.trunc(minLength));

  if (trimmed.length >= required) return null;

  const missing = required - trimmed.length;
  return `Descreva o motivo com pelo menos ${required} caracteres. ${
    missing === 1 ? "Falta 1 caractere." : `Faltam ${missing} caracteres.`
  }`;
}

/** O texto que segue para a RPC — sempre aparado, nunca o valor bruto do campo. */
export function confirmationReasonValue(value: string) {
  return value.trim();
}
