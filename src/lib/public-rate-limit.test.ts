import { describe, expect, it } from "vitest";
import { publicRequestKey } from "./public-rate-limit";

describe("publicRequestKey", () => {
  it("prioriza o IP encaminhado pela Vercel sobre headers genéricos", () => {
    const comProxy = new Request("https://example.test/api", {
      headers: {
        "x-vercel-forwarded-for": "203.0.113.20",
        "x-forwarded-for": "198.51.100.99",
        "x-real-ip": "192.0.2.44",
      },
    });
    const somenteVercel = new Request("https://example.test/api", {
      headers: { "x-vercel-forwarded-for": "203.0.113.20" },
    });

    expect(publicRequestKey(comProxy, "pesquisa-1"))
      .toBe(publicRequestKey(somenteVercel, "pesquisa-1"));
  });

  it("gera somente hash e separa escopos lógicos pelo discriminador", () => {
    const request = new Request("https://example.test/api", {
      headers: { "x-vercel-forwarded-for": "203.0.113.20" },
    });

    const primeira = publicRequestKey(request, "pesquisa-1");
    const segunda = publicRequestKey(request, "pesquisa-2");

    expect(primeira).toMatch(/^[0-9a-f]{64}$/);
    expect(primeira).not.toContain("203.0.113.20");
    expect(primeira).not.toBe(segunda);
  });
});
