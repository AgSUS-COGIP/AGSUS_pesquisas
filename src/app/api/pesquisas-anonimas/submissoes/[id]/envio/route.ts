import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const token = request.headers.get("X-Anonymous-Session")?.trim() ?? "";
  if (!ehUuid(id) || !token) return respostaDeEntradaInvalida("Sessão anônima inválida.");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_enviar_resp_anon", { target_submission_id: id, target_session_token: token });
  if (error) return respostaDeErro(error, "POST /api/pesquisas-anonimas/submissoes/[id]/envio");
  return NextResponse.json(data);
}
