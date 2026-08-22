import { describe, expect, it } from "vitest";
import {
  CorpoJsonExcedidoError,
  CorpoJsonInvalidoError,
  lerJsonLimitado,
} from "./corpo-json-limitado";

describe("lerJsonLimitado", () => {
  it("lê JSON válido abaixo do limite", async () => {
    const request = new Request("https://agsus.test/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mensagem: "ok" }),
    });

    await expect(lerJsonLimitado<{ mensagem: string }>(request, 1024))
      .resolves.toEqual({ mensagem: "ok" });
  });

  it("recusa imediatamente Content-Length declarado acima do limite", async () => {
    const request = new Request("https://agsus.test/api", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "2048",
      },
      body: JSON.stringify({ mensagem: "pequena" }),
    });

    await expect(lerJsonLimitado(request, 1024))
      .rejects.toBeInstanceOf(CorpoJsonExcedidoError);
  });

  it("interrompe corpo em streaming sem Content-Length quando excede o limite", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('{"texto":"'));
        controller.enqueue(encoder.encode("x".repeat(2048)));
        controller.enqueue(encoder.encode('"}'));
        controller.close();
      },
    });

    const request = new Request("https://agsus.test/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: stream,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    await expect(lerJsonLimitado(request, 1024))
      .rejects.toBeInstanceOf(CorpoJsonExcedidoError);
  });

  it("conta bytes UTF-8, e não apenas caracteres", async () => {
    const request = new Request("https://agsus.test/api", {
      method: "POST",
      body: JSON.stringify({ texto: "á".repeat(20) }),
    });

    await expect(lerJsonLimitado(request, 30))
      .rejects.toBeInstanceOf(CorpoJsonExcedidoError);
  });

  it("recusa JSON inválido", async () => {
    const request = new Request("https://agsus.test/api", {
      method: "POST",
      body: "{json quebrado",
    });

    await expect(lerJsonLimitado(request, 1024))
      .rejects.toBeInstanceOf(CorpoJsonInvalidoError);
  });
});
