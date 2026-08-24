import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { isPublicRequest } from "./proxy";

describe("proxy public routes", () => {
  it.each([
    "/api/health",
    "/api/health/readiness",
  ])("mantém o health check %s acessível sem sessão", (pathname) => {
    const request = new NextRequest(`https://pesquisas.example${pathname}`);

    expect(isPublicRequest(request)).toBe(true);
  });

  it("continua protegendo APIs de domínio", () => {
    const request = new NextRequest("https://pesquisas.example/api/avaliacoes");

    expect(isPublicRequest(request)).toBe(false);
  });
});
