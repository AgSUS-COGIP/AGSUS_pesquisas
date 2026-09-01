import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { SecaoEntrada } from "@/lib/api/contratos-construtor";

/**
 * Cria uma seção no rascunho da avaliação.
 *
 * A posição não vem no corpo: `FC_INCLUIR_SECAO` calcula o próximo lugar, e
 * deixar a tela propor a posição criaria corrida entre dois operadores no mesmo
 * formulário. Só rascunho é editável — o trigger `FC_EXIGIR_RASCUNHO_ESTRUT`
 * recusa versão publicada, e a recusa chega à tela como 409.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  let corpo: SecaoEntrada;
  try {
    corpo = await request.json() as SecaoEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  const title = typeof corpo.title === "string" ? corpo.title.trim() : "";
  if (!title) {
    return respostaDeEntradaInvalida("Informe o título da seção.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_INCLUIR_SECAO", {
    target_survey_id: id,
    section_title: title,
    section_description: typeof corpo.description === "string" ? corpo.description.trim() || null : null,
  });

  if (error) return respostaDeErro(error, "POST /api/avaliacoes/[id]/secoes");

  return NextResponse.json(data, { status: 201 });
}
