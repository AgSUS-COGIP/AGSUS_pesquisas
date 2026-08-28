import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro } from "@/lib/api/resposta-http";
import type { AvaliacaoComParticipantes } from "@/lib/api/contratos-pessoas";

/** Somente ciclos CDDI podem receber vínculos de liderança. */
export async function GET() {
  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("fc_listar_ciclos_lideranca_adm");

  if (error) {
    return respostaDeErro(error, "GET /api/pessoas/vinculos-lideranca/ciclos");
  }

  const ciclos = Array.isArray(data) ? data as AvaliacaoComParticipantes[] : [];
  return NextResponse.json(ciclos);
}
