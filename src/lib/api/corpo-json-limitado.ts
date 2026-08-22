export class CorpoJsonInvalidoError extends Error {
  constructor() {
    super("O corpo do pedido não é um JSON válido.");
    this.name = "CorpoJsonInvalidoError";
  }
}

export class CorpoJsonExcedidoError extends Error {
  readonly limiteBytes: number;

  constructor(limiteBytes: number) {
    super("O corpo do pedido excede o limite permitido.");
    this.name = "CorpoJsonExcedidoError";
    this.limiteBytes = limiteBytes;
  }
}

/**
 * Lê JSON sem confiar apenas em `Content-Length`.
 *
 * Um cliente pode omitir esse cabeçalho e transmitir o corpo em chunks. Ler com
 * `request.json()` nesse caso só permite descobrir o tamanho depois de alocar o
 * payload inteiro. Aqui a stream é interrompida assim que ultrapassa o limite,
 * reduzindo a superfície de exaustão de memória das rotas públicas.
 */
export async function lerJsonLimitado<T>(request: Request, limiteBytes: number): Promise<T> {
  if (!Number.isSafeInteger(limiteBytes) || limiteBytes <= 0) {
    throw new RangeError("O limite de corpo deve ser um inteiro positivo.");
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const declarado = Number(contentLength);
    if (Number.isFinite(declarado) && declarado > limiteBytes) {
      throw new CorpoJsonExcedidoError(limiteBytes);
    }
  }

  if (!request.body) throw new CorpoJsonInvalidoError();

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value?.byteLength) continue;

      total += value.byteLength;
      if (total > limiteBytes) {
        await reader.cancel().catch(() => undefined);
        throw new CorpoJsonExcedidoError(limiteBytes);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  if (total === 0) throw new CorpoJsonInvalidoError();

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(bytes)) as T;
  } catch {
    throw new CorpoJsonInvalidoError();
  }
}
