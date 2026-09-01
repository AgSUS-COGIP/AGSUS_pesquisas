import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";

/**
 * Painel de monitoramento do CDDI.
 *
 * Rota própria, e não `/api/paineis/[codigo]`, porque o agregado é outro: o
 * CDDI acompanha autoavaliação e avaliação de chefia lado a lado. Encaixar isso
 * na rota genérica faria a resposta mudar de formato conforme o código recebido.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const ciclo = new URL(request.url).searchParams.get("ciclo")?.trim();

  if (!ciclo) {
    return respostaDeEntradaInvalida("Informe o código do ciclo.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_PAINEL_MONITOR_CDDI", {
    target_application_code: ciclo,
  });

  if (error) return respostaDeErro(error, "GET /api/paineis/cddi");

  return NextResponse.json(data);
}
