import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { publicRateLimitResponse } from "@/lib/public-rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const codigo = (await params).codigo.trim();
  if (!codigo || codigo.length > 120) return respostaDeEntradaInvalida("Informe um código de avaliação válido.");

  const limitResponse = await publicRateLimitResponse(request, {
    scope: "anon-submission-start",
    limit: 120,
    windowSeconds: 600,
    discriminator: codigo,
  });
  if (limitResponse) return limitResponse;

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("fc_srv_iniciar_resp_anon", { target_application_code: codigo });
  if (error) return respostaDeErro(error, "POST /api/pesquisas-anonimas/[codigo]/submissoes");
  return NextResponse.json(data);
}
