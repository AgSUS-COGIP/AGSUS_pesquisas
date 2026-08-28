import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import type { RespostaDoCiclo } from "@/lib/api/contratos-pessoas";

/**
 * Respostas registradas em um ciclo.
 *
 * `ciclo` é o código da aplicação, não o identificador.
 */
export async function GET(request: Request) {
  const parametros = new URL(request.url).searchParams;
  const ciclo = parametros.get("ciclo")?.trim();
  const busca = parametros.get("busca")?.trim() || null;

  if (!ciclo) {
    return respostaDeEntradaInvalida("Informe o ciclo cujas respostas devem ser listadas.");
  }

  const limiteBruto = Number(parametros.get("limite"));
  const limite = Number.isFinite(limiteBruto) && limiteBruto > 0 && limiteBruto <= 2000
    ? Math.trunc(limiteBruto)
    : 100;

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("fc_listar_respostas_ciclo", {
    p_codigo_ciclo: ciclo,
    p_busca: busca,
    p_limite: limite,
  });

  if (error) return respostaDeErro(error, "GET /api/respostas");

  const respostas = Array.isArray(data) ? data as RespostaDoCiclo[] : [];
  return NextResponse.json(respostas);
}
