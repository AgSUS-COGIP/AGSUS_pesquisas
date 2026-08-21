import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { RespostaEntrada } from "@/lib/api/contratos-runtime";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const token = request.headers.get("X-Anonymous-Session")?.trim() ?? "";
  if (!ehUuid(id) || !token) return respostaDeEntradaInvalida("Sessão anônima inválida.");
  let body: RespostaEntrada;
  try { body = await request.json() as RespostaEntrada; } catch { return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido."); }
  if (!ehUuid(body.questionId)) return respostaDeEntradaInvalida("Identificador de pergunta inválido.");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_gravar_resp_anon", {
    target_submission_id: id, target_session_token: token, target_question_id: body.questionId,
    target_option_ids: body.optionIds ?? null, target_text: body.text ?? null, target_number: body.number ?? null,
    target_boolean: body.boolean ?? null, target_date: body.date ?? null, target_datetime: body.datetime ?? null, target_json: body.json ?? null,
  });
  if (error) return respostaDeErro(error, "PUT /api/pesquisas-anonimas/submissoes/[id]/respostas");
  return NextResponse.json(data ?? { gravada: true });
}
