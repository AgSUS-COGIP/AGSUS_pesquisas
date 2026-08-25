import { safeAuthNext } from "./auth-callback";

const INTERNAL_AUTH_ORIGIN = "https://agsus.invalid";

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

type LoginPopupDecisionInput = {
  hasSession: boolean;
  popupClosed: boolean;
  popupHref?: string | null;
  currentOrigin: string;
};

export type LoginPopupDecision =
  | { state: "complete" }
  | { state: "error"; message: string }
  | { state: "cancelled" }
  | { state: "waiting" };

/**
 * Traduz o estado observado da janela em uma única decisão testável.
 * A sessão tem precedência sobre o fechamento: o callback pode fechar a janela
 * no mesmo instante em que o cookie se torna visível para a página principal.
 */
export function loginPopupDecision({
  hasSession,
  popupClosed,
  popupHref,
  currentOrigin,
}: LoginPopupDecisionInput): LoginPopupDecision {
  if (hasSession) return { state: "complete" };

  if (popupHref) {
    try {
      const popupUrl = new URL(popupHref);
      const errorCode = popupUrl.searchParams.get("erro");
      if (popupUrl.origin === currentOrigin && popupUrl.pathname === "/acesso" && errorCode) {
        return { state: "error", message: accessErrorMessage(errorCode) };
      }
    } catch {
      // Endereço incompleto ou transitório mantém a espera; não autoriza navegação.
    }
  }

  if (popupClosed) return { state: "cancelled" };
  return { state: "waiting" };
}
