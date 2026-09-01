import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { BALDES, type Balde } from "@/lib/api/contratos-arquivos";

/**
 * Galeria de arquivos de um balde.
 *
 * Recurso separado do `[...caminho]` porque a listagem não é a leitura de um
 * arquivo: exige sessão e devolve só metadados, nunca bytes. O segmento
 * `listagem` não colide com nenhum endereço real — o primeiro segmento de um
 * arquivo é sempre um dos baldes, e a constraint do banco garante isso.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const parametros = new URL(request.url).searchParams;
  const balde = (parametros.get("balde") ?? "").trim();
  const prefixo = (parametros.get("prefixo") ?? "").trim();

  if (!BALDES.includes(balde as Balde)) {
    return respostaDeEntradaInvalida("Informe um balde válido.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_ARQ_LISTAR", {
    p_balde: balde,
    p_prefixo: prefixo,
  });

  if (error) return respostaDeErro(error, "GET /api/arquivos/listagem");

  return NextResponse.json(data ?? []);
}
