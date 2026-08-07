// Origem sentinela para resolver o destino relativo. O domínio `.invalid` é
// reservado por norma e nunca resolve, então uma URL absoluta injetada pelo
// atacante produz origem diferente e é descartada na comparação abaixo.
const AUTH_REDIRECT_ORIGIN = "https://agsus.invalid";

export const DEFAULT_AUTH_DESTINATION = "/area";

/**
 * Valida o parâmetro `next` do fluxo de login e devolve um destino interno seguro.
 *
 * Bloqueia redirecionamento aberto: exige caminho iniciado por `/`, rejeita `//`
 * (URL protocolo-relativa) e `\` (que alguns navegadores normalizam para `/`).
 * Qualquer entrada suspeita devolve {@link DEFAULT_AUTH_DESTINATION}.
 * `search` e `hash` são preservados.
 */
export function safeAuthNext(value: string | null) {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\")
  ) {
    return DEFAULT_AUTH_DESTINATION;
  }

  try {
    const destination = new URL(value, AUTH_REDIRECT_ORIGIN);
    if (destination.origin !== AUTH_REDIRECT_ORIGIN) {
      return DEFAULT_AUTH_DESTINATION;
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return DEFAULT_AUTH_DESTINATION;
  }
}

/**
 * Monta as opções de troca do código PKCE a partir do parâmetro `sb_flow_id`.
 *
 * Ausência do parâmetro devolve `undefined`, preservando compatibilidade com
 * callbacks emitidos antes de o Supabase passar a anexar o identificador.
 * Um `flowId` presente porém inválido é repassado de propósito: é melhor a troca
 * falhar do que recorrer silenciosamente ao verificador errado.
 */
export function pkceExchangeOptions(flowId: string | null) {
  return flowId === null ? undefined : { flowId };
}
