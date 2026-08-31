const INTERNAL_AUTH_ORIGIN = "https://agsus.invalid";
export const DEFAULT_AUTH_DESTINATION = "/area";

/** Retorna somente destinos internos seguros para o redirecionamento pós-login. */
export function safeAuthNext(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return DEFAULT_AUTH_DESTINATION;
  }

  try {
    const destination = new URL(value, INTERNAL_AUTH_ORIGIN);
    return destination.origin === INTERNAL_AUTH_ORIGIN
      ? `${destination.pathname}${destination.search}${destination.hash}`
      : DEFAULT_AUTH_DESTINATION;
  } catch {
    return DEFAULT_AUTH_DESTINATION;
  }
}

export function accessErrorMessage(code: string | null) {
  if (code === "dominio-nao-autorizado") {
    return "O acesso é exclusivo para contas @agenciasus.org.br. Selecione sua conta institucional.";
  }
  if (code === "oauth-invalido") {
    return "A autenticação não foi concluída. Selecione novamente sua conta institucional.";
  }
  return "";
}

/** Acrescenta o sinal visual de entrada somente a um destino interno validado. */
export function authDestinationWithEntering(value: string | null) {
  const destination = new URL(safeAuthNext(value), INTERNAL_AUTH_ORIGIN);
  destination.searchParams.set("entrando", "1");
  return `${destination.pathname}${destination.search}${destination.hash}`;
}

