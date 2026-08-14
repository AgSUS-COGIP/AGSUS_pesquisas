import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { PerguntaAtualizacaoEntrada } from "@/lib/api/contratos-construtor";

/**
 * Edita uma pergunta do rascunho — mover entre seções é `…/[perguntaId]/secao`.
 *
 * As alternativas vão inteiras a cada gravação, e não como diferença: é assim
 * que `update_survey_question` preserva `id` e `value` por posição, evitando
 * invalidar respostas já registradas quando só o rótulo mudou.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; perguntaId: string }> },
) {
  const { id, perguntaId } = await params;

  if (!ehUuid(id) || !ehUuid(perguntaId)) {
    return respostaDeEntradaInvalida("Identificador de avaliação ou de pergunta inválido.");
  }

  let corpo: PerguntaAtualizacaoEntrada;
  try {
    corpo = await request.json() as PerguntaAtualizacaoEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  const title = typeof corpo.title === "string" ? corpo.title.trim() : "";
  const questionType = typeof corpo.questionType === "string" ? corpo.questionType.trim() : "";
  if (!title || !questionType) {
    return respostaDeEntradaInvalida("Informe o enunciado e o tipo da pergunta.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("update_survey_question", {
    target_question_id: perguntaId,
    question_title: title,
    question_description: typeof corpo.description === "string" ? corpo.description : "",
    question_type: questionType,
    is_required: corpo.required ?? true,
    question_options: Array.isArray(corpo.options) ? corpo.options : [],
  });

  if (error) return respostaDeErro(error, "PATCH /api/avaliacoes/[id]/perguntas/[perguntaId]");

  return NextResponse.json(data);
}

/**
 * Exclui uma pergunta do rascunho.
 *
 * Versões já publicadas não são afetadas: o trigger de estrutura só permite a
 * operação enquanto a versão está em `DRAFT`.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; perguntaId: string }> },
) {
  const { id, perguntaId } = await params;

  if (!ehUuid(id) || !ehUuid(perguntaId)) {
    return respostaDeEntradaInvalida("Identificador de avaliação ou de pergunta inválido.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("delete_survey_question", {
    target_question_id: perguntaId,
  });

  if (error) return respostaDeErro(error, "DELETE /api/avaliacoes/[id]/perguntas/[perguntaId]");

  return NextResponse.json(data ?? { excluida: true });
}
