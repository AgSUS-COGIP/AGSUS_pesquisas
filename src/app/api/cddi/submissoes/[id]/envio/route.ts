import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";

/**
 * Envia uma submissão do CDDI definitivamente.
 *
 * É aqui que o anonimato estrutural se materializa: `submit_my_cddi_submission`
 * apaga o bilhete que liga pessoa e resposta quando o ciclo é anônimo. Trazer
 * essa regra para o TypeScript manteria o vínculo em memória do servidor no
 * exato momento em que o banco promete que ele deixou de existir.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de submissão inválido.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("submit_my_cddi_submission", {
    target_submission_id: id,
  });

  if (error) return respostaDeErro(error, "POST /api/cddi/submissoes/[id]/envio");

  return NextResponse.json(data);
}
