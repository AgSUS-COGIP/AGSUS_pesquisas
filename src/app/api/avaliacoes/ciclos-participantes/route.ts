import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro } from "@/lib/api/resposta-http";
import type { AvaliacaoComParticipantes } from "@/lib/api/contratos-pessoas";

/** Ciclos disponíveis para gestão de público, com as contagens de cada um. */
export async function GET() {
  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("list_admin_participant_applications");

  if (error) return respostaDeErro(error, "GET /api/avaliacoes/ciclos-participantes");

  const ciclos = Array.isArray(data) ? data as AvaliacaoComParticipantes[] : [];
  return NextResponse.json(ciclos);
}
