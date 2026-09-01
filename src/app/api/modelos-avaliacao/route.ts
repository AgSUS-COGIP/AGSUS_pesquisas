import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro } from "@/lib/api/resposta-http";

/**
 * Galeria de modelos de avaliação.
 *
 * Usar um modelo **é** duplicar: a criação a partir dele passa por
 * `POST /api/avaliacoes/[id]/copia`, não por uma rota própria.
 */
export async function GET() {
  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_LISTAR_MODELOS_AVALIACAO");

  if (error) return respostaDeErro(error, "GET /api/modelos-avaliacao");

  return NextResponse.json(Array.isArray(data) ? data : []);
}
