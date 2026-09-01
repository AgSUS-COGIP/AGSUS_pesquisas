import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehObjeto, ehUuid } from "@/lib/api/validacao";

/**
 * Grava a resposta de uma pergunta do CDDI.
 *
 * Diferente do runtime genérico, grava **uma** alternativa (`target_option_id`,
 * singular): as perguntas fechadas do CDDI são escalas de escolha única.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de submissão inválido.");
  }

  let corpo: { questionId?: unknown; optionId?: unknown; text?: unknown };
  try {
    corpo = await request.json() as typeof corpo;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (!ehObjeto(corpo)) return respostaDeEntradaInvalida("Informe os dados da resposta em um objeto JSON.");

  if (!ehUuid(corpo.questionId)) {
    return respostaDeEntradaInvalida("Identificador de pergunta inválido.");
  }

  const optionId = corpo.optionId ?? null;
  if (optionId !== null && !ehUuid(optionId)) {
    return respostaDeEntradaInvalida("Identificador de alternativa inválido.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_SALVAR_RESPOSTA_CDDI", {
    target_submission_id: id,
    target_question_id: corpo.questionId,
    target_option_id: optionId,
    target_text: typeof corpo.text === "string" ? corpo.text : null,
  });

  if (error) return respostaDeErro(error, "PUT /api/cddi/submissoes/[id]/respostas");

  return NextResponse.json(data ?? { gravada: true });
}
