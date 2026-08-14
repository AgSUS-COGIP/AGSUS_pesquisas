import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { RemoverRespostaEntrada } from "@/lib/api/contratos-pessoas";

/**
 * Anula ou apaga a resposta de um participante.
 *
 * Os dois modos retiram a resposta do cálculo e dos painéis; o que muda é o que
 * sobra. `INVALIDATE` preserva o conteúdo para auditoria e é o caminho normal,
 * `DELETE` remove da base e não tem volta.
 *
 * O mínimo de 10 caracteres do motivo repete o da RPC de propósito, para
 * recusar antes da ida ao banco: divergir dele devolveria ao operador o erro
 * que a validação existe para evitar.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ submissaoId: string }> },
) {
  const { submissaoId } = await params;

  if (!ehUuid(submissaoId)) {
    return respostaDeEntradaInvalida("Identificador de resposta inválido.");
  }

  let corpo: RemoverRespostaEntrada;
  try {
    corpo = await request.json() as RemoverRespostaEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (corpo.modo !== "INVALIDATE" && corpo.modo !== "DELETE") {
    return respostaDeEntradaInvalida("Modo de remoção inválido.");
  }

  const motivo = typeof corpo.motivo === "string" ? corpo.motivo.trim() : "";
  if (motivo.length < 10) {
    return respostaDeEntradaInvalida("Descreva o motivo da operação com pelo menos 10 caracteres.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_remover_resposta_pessoa", {
    p_submissao: submissaoId,
    p_modo: corpo.modo,
    p_motivo: motivo,
  });

  if (error) return respostaDeErro(error, "DELETE /api/respostas/[submissaoId]");

  return NextResponse.json(data ?? { removida: true });
}
