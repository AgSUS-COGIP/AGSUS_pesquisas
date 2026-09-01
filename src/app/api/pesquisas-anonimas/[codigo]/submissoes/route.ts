import { NextResponse } from "next/server";
import { createAdminRpcClient } from "@/lib/db/rpc-adapter";
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

  const banco = createAdminRpcClient();
  const { data, error } = await banco.rpc("FC_SRV_INICIAR_RESP_ANON", { target_application_code: codigo });
  if (error) return respostaDeErro(error, "POST /api/pesquisas-anonimas/[codigo]/submissoes");
  return NextResponse.json(data);
}
