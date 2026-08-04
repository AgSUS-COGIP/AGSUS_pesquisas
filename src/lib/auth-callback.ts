const AUTH_REDIRECT_ORIGIN = "https://agsus.invalid";

export const DEFAULT_AUTH_DESTINATION = "/area";

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

export function pkceExchangeOptions(flowId: string | null) {
  return flowId === null ? undefined : { flowId };
}
