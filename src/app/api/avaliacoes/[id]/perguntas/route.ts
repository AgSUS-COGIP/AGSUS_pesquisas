import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { PerguntaEntrada } from "@/lib/api/contratos-construtor";

/**
 * Cria uma pergunta dentro de uma seção do rascunho.
 *
 * A seção de destino vai no corpo, não no caminho: aninhar em
 * `/secoes/[secaoId]/perguntas` daria dois caminhos para o mesmo recurso — um
 * para criar, outro para editar e mover.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  let corpo: PerguntaEntrada;
  try {
    corpo = await request.json() as PerguntaEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (!ehUuid(corpo.sectionId)) {
    return respostaDeEntradaInvalida("Identificador de seção inválido.");
  }

  const title = typeof corpo.title === "string" ? corpo.title.trim() : "";
  const questionType = typeof corpo.questionType === "string" ? corpo.questionType.trim() : "";
  if (!title || !questionType) {
    return respostaDeEntradaInvalida("Informe o enunciado e o tipo da pergunta.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("add_survey_question", {
    target_survey_id: id,
    target_section_id: corpo.sectionId,
    question_title: title,
    question_description: typeof corpo.description === "string" ? corpo.description : "",
    question_type: questionType,
    is_required: corpo.required ?? true,
    question_options: Array.isArray(corpo.options) ? corpo.options : [],
  });

  if (error) return respostaDeErro(error, "POST /api/avaliacoes/[id]/perguntas");

  return NextResponse.json(data, { status: 201 });
}
