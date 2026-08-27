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
  const supabase = await createServerRpcClient();
  const { data, error } = await supabase.rpc("fc_listar_modelos_avaliacao");

  if (error) return respostaDeErro(error, "GET /api/modelos-avaliacao");

  return NextResponse.json(Array.isArray(data) ? data : []);
}
