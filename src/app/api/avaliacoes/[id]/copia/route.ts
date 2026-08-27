import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { DuplicarAvaliacaoEntrada } from "@/lib/api/contratos";

/**
 * Duplica uma avaliação — a cópia nasce em rascunho.
 *
 * Usar um modelo da galeria é a mesma operação e passa por aqui: um segundo
 * caminho para duplicar divergiria deste na primeira correção.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  // Corpo é opcional: sem nome nem código, a RPC deriva os dois. JSON ausente
  // ou vazio não é erro.
  let corpo: DuplicarAvaliacaoEntrada = {};
  try {
    const texto = await request.text();
    if (texto.trim()) corpo = JSON.parse(texto) as DuplicarAvaliacaoEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  const supabase = await createServerRpcClient();
  const { data, error } = await supabase.rpc("fc_clonar_pesquisa", {
    p_pesquisa: id,
    p_nome: typeof corpo.name === "string" && corpo.name.trim() ? corpo.name.trim() : null,
    p_codigo: typeof corpo.code === "string" && corpo.code.trim() ? corpo.code.trim() : null,
  });

  if (error) return respostaDeErro(error, "POST /api/avaliacoes/[id]/copia");

  return NextResponse.json(data, { status: 201 });
}
