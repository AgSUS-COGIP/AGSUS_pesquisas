import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";

/**
 * Identificação institucional da pessoa no ciclo, com a chefia vinculada.
 *
 * A chefia **não** é escolhida pelo participante: vem de `cddi_leadership_links`
 * e a etapa de identificação a mostra somente leitura.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const codigo = new URL(request.url).searchParams.get("ciclo")?.trim();

  if (!codigo) {
    return respostaDeEntradaInvalida("Informe o código do ciclo.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("get_my_cddi_identity", {
    target_application_code: codigo,
  });

  if (error) return respostaDeErro(error, "GET /api/cddi/identidade");

  return NextResponse.json(data);
}
