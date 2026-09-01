import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";

/**
 * Regras de lógica condicional do ciclo.
 *
 * Falha aqui **não** impede responder: o padrão seguro é mostrar o instrumento
 * inteiro, porque esconder pergunta por engano é pior do que mostrar demais.
 * Por isso a tela trata erro daqui como aviso, não como falha de carga.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const { codigo } = await params;
  const codigoCiclo = decodeURIComponent(codigo).trim();

  if (!codigoCiclo) {
    return respostaDeEntradaInvalida("Informe o código do ciclo.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_OBTER_REGRAS_DO_CICLO", {
    p_codigo_ciclo: codigoCiclo,
  });

  if (error) return respostaDeErro(error, "GET /api/ciclos/[codigo]/regras");

  return NextResponse.json(data ?? []);
}
