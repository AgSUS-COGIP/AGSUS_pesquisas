import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import type { DefinirCorPainelEntrada } from "@/lib/api/contratos-pessoas";

/**
 * Cor do painel do formulário da tela de acesso.
 *
 * Rota separada da arte de fundo para que nenhuma zere o campo da outra — ver
 * `fundo-acesso/route.ts` para o incidente que originou a separação.
 * `cor` nula restaura o branco institucional.
 */
export async function PUT(request: Request) {
  let corpo: DefinirCorPainelEntrada;
  try {
    corpo = await request.json() as DefinirCorPainelEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  const cor = typeof corpo.cor === "string" && corpo.cor.trim() ? corpo.cor.trim() : null;

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("fc_definir_cor_painel_acesso", { p_cor: cor });

  if (error) return respostaDeErro(error, "PUT /api/plataforma/marca/cor-painel");

  return NextResponse.json(data);
}
