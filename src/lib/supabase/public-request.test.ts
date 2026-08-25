import { describe, expect, it } from "vitest";
import { isPublicRequest } from "./public-request";

describe("proxy public routes", () => {
  it.each([
    "/api/health",
    "/api/health/readiness",
  ])("mantém o health check %s acessível sem sessão", (pathname) => {
    expect(isPublicRequest("GET", pathname)).toBe(true);
  });

  it("mantém pública somente a leitura da marca", () => {
    expect(isPublicRequest("GET", "/api/plataforma/marca")).toBe(true);
    expect(isPublicRequest("PUT", "/api/plataforma/marca")).toBe(false);
  });

  it("continua protegendo APIs de domínio", () => {
    expect(isPublicRequest("GET", "/api/avaliacoes")).toBe(false);
  });
});
