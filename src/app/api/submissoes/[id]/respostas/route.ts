import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehEntradaDeResposta, ehUuid, erroNaEntradaDeResposta } from "@/lib/api/validacao";

/**
 * Grava a resposta de uma pergunta.
 *
 * A RPC faz upsert por (submissão, pergunta), e a idempotência importa: a tela
 * salva com debounce dentro de uma fila serializada, e uma retransmissão de
 * rede não pode duplicar resposta.
 *
 * O corpo carrega **todos** os campos de valor, inclusive os nulos. A tela os
 * monta com `buildSurveyAnswerPayload()`, que zera o que não pertence ao tipo
 * da pergunta — texto em pergunta numérica vai como `null`, não como string.
 * Repassar o objeto inteiro preserva essa decisão em vez de a rota adivinhar.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de submissão inválido.");
  }

  let corpo: unknown;
  try {
    corpo = await request.json();
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (!ehEntradaDeResposta(corpo)) {
    return respostaDeEntradaInvalida(erroNaEntradaDeResposta(corpo) ?? "Resposta inválida.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("save_my_survey_answer", {
    target_submission_id: id,
    target_question_id: corpo.questionId,
    target_option_ids: corpo.optionIds ?? null,
    target_text: corpo.text ?? null,
    target_number: corpo.number ?? null,
    target_boolean: corpo.boolean ?? null,
    target_date: corpo.date ?? null,
    target_datetime: corpo.datetime ?? null,
    target_json: corpo.json ?? null,
  });

  if (error) return respostaDeErro(error, "PUT /api/submissoes/[id]/respostas");

  return NextResponse.json(data ?? { gravada: true });
}
