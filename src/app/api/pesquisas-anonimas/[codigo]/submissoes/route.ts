import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";

export async function POST(_request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const codigo = decodeURIComponent((await params).codigo).trim();
  if (!codigo) return respostaDeEntradaInvalida("Informe o código da avaliação.");
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("fc_iniciar_resp_anon", { target_application_code: codigo });
  if (error) return respostaDeErro(error, "POST /api/pesquisas-anonimas/[codigo]/submissoes");
  return NextResponse.json(data);
}
