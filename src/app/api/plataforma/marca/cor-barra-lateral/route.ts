import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import type { DefinirCorPainelEntrada } from "@/lib/api/contratos-pessoas";

/**
 * Cor de fundo da barra lateral da aplicação.
 *
 * Rota separada da cor principal e da cor do painel de acesso pelo mesmo motivo
 * das demais: cada função do banco grava só os campos que lhe dizem respeito, e
 * uma rota que gravasse tudo junto zeraria o que não recebesse.
 *
 * `cor` nula restaura a cor institucional definida no CSS.
 */
export async function PUT(request: Request) {
  let corpo: DefinirCorPainelEntrada;
  try {
    corpo = await request.json() as DefinirCorPainelEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  const cor = typeof corpo.cor === "string" && corpo.cor.trim() ? corpo.cor.trim() : null;

  const supabase = await createServerRpcClient();
  const { data, error } = await supabase.rpc("fc_definir_cor_barra_lateral", { p_cor: cor });

  if (error) return respostaDeErro(error, "PUT /api/plataforma/marca/cor-barra-lateral");

  return NextResponse.json(data);
}
