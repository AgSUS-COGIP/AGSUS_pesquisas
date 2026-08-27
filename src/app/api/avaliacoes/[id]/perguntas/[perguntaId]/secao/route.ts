import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { MoverPerguntaEntrada } from "@/lib/api/contratos-construtor";

/**
 * Move a pergunta para outra seção — ela vai para o fim da seção de destino.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string; perguntaId: string }> },
) {
  const { id, perguntaId } = await params;

  if (!ehUuid(id) || !ehUuid(perguntaId)) {
    return respostaDeEntradaInvalida("Identificador de avaliação ou de pergunta inválido.");
  }

  let corpo: MoverPerguntaEntrada;
  try {
    corpo = await request.json() as MoverPerguntaEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (!ehUuid(corpo.sectionId)) {
    return respostaDeEntradaInvalida("Informe a seção de destino.");
  }

  const supabase = await createServerRpcClient();
  const { data, error } = await supabase.rpc("move_survey_question_to_section", {
    target_question_id: perguntaId,
    target_section_id: corpo.sectionId,
  });

  if (error) return respostaDeErro(error, "PUT /api/avaliacoes/[id]/perguntas/[perguntaId]/secao");

  return NextResponse.json(data);
}
