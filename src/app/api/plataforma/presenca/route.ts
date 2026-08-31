import { NextResponse } from "next/server";
import { respostaDeEntradaInvalida, respostaDeErro } from "@/lib/api/resposta-http";
import type { DefinirPresencaOnlineEntrada } from "@/lib/api/contratos-pessoas";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";

export async function PUT(request: Request) {
  let body: DefinirPresencaOnlineEntrada;
  try {
    body = await request.json() as DefinirPresencaOnlineEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (typeof body.ativa !== "boolean") {
    return respostaDeEntradaInvalida("Informe o estado do recurso.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("fc_definir_presenca_plataforma", {
    fl_ativa_param: body.ativa,
  });
  if (error) return respostaDeErro(error, "PUT /api/plataforma/presenca");
  return NextResponse.json(data);
}
