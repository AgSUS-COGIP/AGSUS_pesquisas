import { NextResponse } from "next/server";
import {
  CorpoJsonExcedidoError,
  CorpoJsonInvalidoError,
  lerJsonLimitado,
} from "@/lib/api/corpo-json-limitado";
import { createAdminRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehEntradaDeResposta, ehUuid, erroNaEntradaDeResposta } from "@/lib/api/validacao";
import { publicRateLimitResponse } from "@/lib/public-rate-limit";

// O maior campo textual aceito pelo banco tem 12 KiB. A folga acomoda JSON,
// arrays de opções e metadados sem permitir que uma rota pública aloque um corpo
// arbitrariamente grande antes de a RPC validar a resposta.
const MAX_ANONYMOUS_ANSWER_BYTES = 65_536;

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const token = request.headers.get("X-Anonymous-Session")?.trim() ?? "";
  if (!ehUuid(id) || !ehUuid(token)) return respostaDeEntradaInvalida("Sessão anônima inválida.");

  const limitResponse = await publicRateLimitResponse(request, {
    scope: "anon-answer-write",
    limit: 600,
    windowSeconds: 300,
    discriminator: id,
  });
  if (limitResponse) return limitResponse;

  let body: unknown;
  try {
    body = await lerJsonLimitado<unknown>(request, MAX_ANONYMOUS_ANSWER_BYTES);
  } catch (error) {
    if (error instanceof CorpoJsonExcedidoError) {
      return NextResponse.json({ mensagem: "A resposta excede o limite permitido." }, { status: 413 });
    }
    if (error instanceof CorpoJsonInvalidoError) {
      return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
    }
    throw error;
  }

  if (!ehEntradaDeResposta(body)) return respostaDeEntradaInvalida(erroNaEntradaDeResposta(body) ?? "Resposta inválida.");
  const supabase = createAdminRpcClient();
  const { data, error } = await supabase.rpc("fc_srv_gravar_resp_anon", {
    target_submission_id: id, target_session_token: token, target_question_id: body.questionId,
    target_option_ids: body.optionIds ?? null, target_text: body.text ?? null, target_number: body.number ?? null,
    target_boolean: body.boolean ?? null, target_date: body.date ?? null, target_datetime: body.datetime ?? null, target_json: body.json ?? null,
  });
  if (error) return respostaDeErro(error, "PUT /api/pesquisas-anonimas/submissoes/[id]/respostas");
  return NextResponse.json(data ?? { gravada: true });
}
