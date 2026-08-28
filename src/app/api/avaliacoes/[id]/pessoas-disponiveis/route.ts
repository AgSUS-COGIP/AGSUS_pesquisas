import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { PessoaCandidataAoCiclo } from "@/lib/api/contratos-pessoas";

/**
 * Pessoas da base, com a situação que cada uma já tem neste ciclo.
 *
 * Subrecurso da avaliação, e não de `/api/pessoas`: a mesma pessoa é
 * "disponível" num ciclo e "já vinculada" em outro, daí `participantId` e
 * `participantStatus` em cada item.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  const busca = new URL(request.url).searchParams.get("busca")?.trim() ?? "";

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("search_admin_people_for_application", {
    target_application_id: id,
    target_search: busca,
  });

  if (error) return respostaDeErro(error, "GET /api/avaliacoes/[id]/pessoas-disponiveis");

  const pessoas = Array.isArray(data) ? data as PessoaCandidataAoCiclo[] : [];
  return NextResponse.json(pessoas);
}
