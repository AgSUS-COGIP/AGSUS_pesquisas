import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { DuplicarItemEntrada, TipoItemConstrutor } from "@/lib/api/contratos-construtor";

/**
 * Duplica uma seção ou uma pergunta do rascunho.
 *
 * Fica sob `/itens`, e não em `/secoes/…/copia` e `/perguntas/…/copia`, porque
 * no banco a operação é **uma só**: `duplicate_survey_builder_item` recebe o
 * tipo e resolve o resto. Dois caminhos REST divergiriam na primeira correção.
 */

const TIPOS: TipoItemConstrutor[] = ["SECTION", "QUESTION"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  let corpo: DuplicarItemEntrada;
  try {
    corpo = await request.json() as DuplicarItemEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (!TIPOS.includes(corpo.itemType)) {
    return respostaDeEntradaInvalida("Informe se o item duplicado é uma seção ou uma pergunta.");
  }
  if (!ehUuid(corpo.itemId)) {
    return respostaDeEntradaInvalida("Identificador de item inválido.");
  }

  const supabase = await createServerRpcClient();
  const { data, error } = await supabase.rpc("duplicate_survey_builder_item", {
    target_item_type: corpo.itemType,
    target_item_id: corpo.itemId,
  });

  if (error) return respostaDeErro(error, "POST /api/avaliacoes/[id]/itens/copia");

  return NextResponse.json(data, { status: 201 });
}
