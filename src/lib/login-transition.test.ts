import { describe, expect, it } from "vitest";
import {
  accessErrorMessage,
  authDestinationWithEntering,
  loginPopupDecision,
} from "./login-transition";

describe("mensagens da tela de acesso", () => {
  it("mantém os erros de domínio e OAuth", () => {
    expect(accessErrorMessage("dominio-nao-autorizado")).toContain("@agenciasus.org.br");
    expect(accessErrorMessage("oauth-invalido")).toContain("não foi concluída");
  });
});

describe("conclusão do popup", () => {
  it("volta ao estado normal quando a janela fecha sem sessão", () => {
    expect(loginPopupDecision({
      hasSession: false,
      popupClosed: true,
      currentOrigin: "https://app.local",
    })).toEqual({ state: "cancelled" });
  });

  it("conclui somente depois que a sessão está disponível", () => {
    expect(loginPopupDecision({
      hasSession: true,
      popupClosed: true,
      currentOrigin: "https://app.local",
    })).toEqual({ state: "complete" });
  });

  it("propaga o erro institucional devolvido pelo callback na mesma origem", () => {
    expect(loginPopupDecision({
      hasSession: false,
      popupClosed: false,
      popupHref: "https://app.local/acesso?erro=dominio-nao-autorizado",
      currentOrigin: "https://app.local",
    })).toMatchObject({ state: "error", message: expect.stringContaining("@agenciasus.org.br") });
  });
});

describe("destino pós-login", () => {
  it("preserva destino interno e marca o progresso de entrada", () => {
    expect(authDestinationWithEntering("/equipe?ciclo=CDDI-2026#pessoas")).toBe(
      "/equipe?ciclo=CDDI-2026&entrando=1#pessoas",
    );
  });

  it.each([
    "https://example.com/roubo",
    "javascript:alert(1)",
    "//example.com/roubo",
  ])("bloqueia destino inseguro antes de navegar: %s", (destination) => {
    expect(authDestinationWithEntering(destination)).toBe("/area?entrando=1");
  });
});
