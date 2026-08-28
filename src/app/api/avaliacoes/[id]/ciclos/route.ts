import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import type { CicloDePesquisa } from "@/lib/api/contratos-pessoas";

/**
 * Ciclos de uma avaliação.
 *
 * Atenção: aqui o segmento `[id]` carrega o **código** da pesquisa (`CDDI`),
 * não o identificador — diferente das demais rotas de `/api/avaliacoes/[id]`.
 * O nome do segmento é imposto pelo App Router, que exige um só por nível.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!id.trim()) {
    return respostaDeEntradaInvalida("Informe o código da avaliação.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("fc_listar_ciclos_pesquisa", {
    p_codigo_pesquisa: id,
  });

  if (error) return respostaDeErro(error, "GET /api/avaliacoes/[id]/ciclos");

  const ciclos = Array.isArray(data) ? data as CicloDePesquisa[] : [];
  return NextResponse.json(ciclos);
}
