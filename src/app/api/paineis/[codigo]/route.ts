import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";

/**
 * Painel de resultados de um ciclo, pelo código da aplicação.
 *
 * Em ciclos anônimos, a RPC devolve apenas dados sem identidade de quem
 * respondeu; a rota repassa o agregado ao painel administrativo.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const { codigo } = await params;
  const codigoAplicacao = decodeURIComponent(codigo).trim();

  if (!codigoAplicacao) {
    return respostaDeEntradaInvalida("Informe o código do ciclo.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_OBTER_PAINEL_PESQUISA", {
    target_application_code: codigoAplicacao,
  });

  if (error) return respostaDeErro(error, "GET /api/paineis/[codigo]");

  if (!data) {
    return NextResponse.json(
      { mensagem: "Painel não disponível para este ciclo." },
      { status: 404 },
    );
  }

  return NextResponse.json(data);
}
