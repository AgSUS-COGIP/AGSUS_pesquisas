import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";

/**
 * Exclui uma avaliação em rascunho.
 *
 * Só rascunho sem resposta pode ser excluído; a recusa da RPC chega como 409,
 * distinto do 403 de quem não é administrador.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_excluir_pesquisa_rascunho", {
    p_pesquisa: id,
  });

  if (error) return respostaDeErro(error, "DELETE /api/avaliacoes/[id]");

  return NextResponse.json(data ?? { excluida: true });
}
