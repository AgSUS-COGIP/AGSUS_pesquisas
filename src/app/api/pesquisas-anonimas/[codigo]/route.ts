import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { publicRateLimitResponse } from "@/lib/public-rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const codigo = decodeURIComponent((await params).codigo).trim();
  if (!codigo) return respostaDeEntradaInvalida("Informe o código da avaliação.");

  const limitResponse = await publicRateLimitResponse(request, {
    scope: "anon-form-read",
    limit: 600,
    windowSeconds: 300,
    discriminator: codigo,
  });
  if (limitResponse) return limitResponse;

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("fc_srv_obter_form_anonimo", { target_application_code: codigo });
  if (error) return respostaDeErro(error, "GET /api/pesquisas-anonimas/[codigo]");
  if (!data) return NextResponse.json({ mensagem: "A avaliação anônima não está disponível." }, { status: 404 });
  return NextResponse.json(data);
}
