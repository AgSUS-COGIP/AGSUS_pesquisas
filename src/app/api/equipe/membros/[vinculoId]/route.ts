import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";

/**
 * Retira um integrante da equipe neste ciclo.
 *
 * O que termina é o vínculo com a liderança; a pessoa continua no ciclo.
 * `FC_REMOVER_PESSOA_EQUIPE` encerra a vigência e registra o evento — nada é
 * apagado, e por isso a resposta traz o que o banco devolveu, não um 204 vazio.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ vinculoId: string }> },
) {
  const { vinculoId } = await params;

  if (!ehUuid(vinculoId)) {
    return respostaDeEntradaInvalida("Identificador de vínculo inválido.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_REMOVER_PESSOA_EQUIPE", {
    target_link_id: vinculoId,
  });

  if (error) return respostaDeErro(error, "DELETE /api/equipe/membros/[vinculoId]");

  return NextResponse.json(data ?? { removido: true });
}
