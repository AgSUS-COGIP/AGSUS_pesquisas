import { NextResponse } from "next/server";
import { createAdminRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import { publicRateLimitResponse } from "@/lib/public-rate-limit";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = (await params).id;
  const token = request.headers.get("X-Anonymous-Session")?.trim() ?? "";
  if (!ehUuid(id) || !ehUuid(token)) return respostaDeEntradaInvalida("Sessão anônima inválida.");

  const limitResponse = await publicRateLimitResponse(request, {
    scope: "anon-submission-send",
    limit: 120,
    windowSeconds: 600,
    discriminator: id,
  });
  if (limitResponse) return limitResponse;

  const banco = createAdminRpcClient();
  const { data, error } = await banco.rpc("FC_SRV_ENVIAR_RESP_ANON", { target_submission_id: id, target_session_token: token });
  if (error) return respostaDeErro(error, "POST /api/pesquisas-anonimas/submissoes/[id]/envio");
  return NextResponse.json(data);
}
