import { describe, expect, it } from "vitest";
import {
  DEFAULT_AUTH_DESTINATION,
  pkceExchangeOptions,
  safeAuthNext,
} from "./auth-callback";

describe("safeAuthNext", () => {
  it("preserva apenas destinos internos com query e fragmento", () => {
    expect(safeAuthNext("/pesquisas?status=aberta#recentes")).toBe(
      "/pesquisas?status=aberta#recentes",
    );
  });

  it.each([
    null,
    "",
    "https://example.com/roubo",
    "//example.com/roubo",
    "///example.com/roubo",
    "/\\example.com/roubo",
    "javascript:alert(1)",
    " /area",
    // Os dois ataques que o CodeQL apontou em `/auth/concluido`, onde o destino
    // era lido do endereço sem passar por aqui: execução de código na sessão de
    // quem acabou de entrar, e saída do domínio logo depois do login.
    "javascript:alert(document.cookie)",
    "https://exemplo-malicioso.test/roubo",
    "data:text/html,<script>alert(1)</script>",
  ])("bloqueia destino externo ou ambíguo: %s", (value) => {
    expect(safeAuthNext(value)).toBe(DEFAULT_AUTH_DESTINATION);
  });
});

describe("pkceExchangeOptions", () => {
  it("mantém compatibilidade quando callbacks antigos não têm flow id", () => {
    expect(pkceExchangeOptions(null)).toBeUndefined();
  });

  it("encaminha o identificador que seleciona o verificador correto", () => {
    expect(pkceExchangeOptions("a1b2c3d4e5f60708")).toEqual({
      flowId: "a1b2c3d4e5f60708",
    });
  });

  it("não converte um identificador explícito inválido em fallback inseguro", () => {
    expect(pkceExchangeOptions("")).toEqual({ flowId: "" });
  });
});
