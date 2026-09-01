import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type {
  DirecaoItemConstrutor,
  ReordenarItemEntrada,
  TipoItemConstrutor,
} from "@/lib/api/contratos-construtor";

/**
 * Reordena uma seção ou uma pergunta, uma posição por vez.
 *
 * Fica sob `/itens` porque no banco a operação é uma só, e o corpo diz apenas
 * a direção: deixar a tela enviar a posição final abriria corrida entre dois
 * operadores no mesmo rascunho. Quem calcula o vizinho é a RPC.
 */

const TIPOS: TipoItemConstrutor[] = ["SECTION", "QUESTION"];
const DIRECOES: DirecaoItemConstrutor[] = ["UP", "DOWN"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  let corpo: ReordenarItemEntrada;
  try {
    corpo = await request.json() as ReordenarItemEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (!TIPOS.includes(corpo.itemType)) {
    return respostaDeEntradaInvalida("Informe se o item reordenado é uma seção ou uma pergunta.");
  }
  if (!ehUuid(corpo.itemId)) {
    return respostaDeEntradaInvalida("Identificador de item inválido.");
  }
  if (!DIRECOES.includes(corpo.direction)) {
    return respostaDeEntradaInvalida("Informe se o item sobe ou desce.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_REORDENAR_ITEM_CONSTRUTOR", {
    target_item_type: corpo.itemType,
    target_item_id: corpo.itemId,
    target_direction: corpo.direction,
  });

  if (error) return respostaDeErro(error, "POST /api/avaliacoes/[id]/itens/ordem");

  return NextResponse.json(data);
}
