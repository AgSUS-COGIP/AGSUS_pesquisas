import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { SecaoEntrada } from "@/lib/api/contratos-construtor";

/**
 * Altera título e descrição de uma seção — código, posição e perguntas ficam.
 *
 * O identificador da avaliação está no caminho por coerência da hierarquia, mas
 * a RPC não o recebe: quem resolve a versão é ela, a partir da seção.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; secaoId: string }> },
) {
  const { id, secaoId } = await params;

  if (!ehUuid(id) || !ehUuid(secaoId)) {
    return respostaDeEntradaInvalida("Identificador de avaliação ou de seção inválido.");
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

  const supabase = await createServerRpcClient();
  const { data, error } = await supabase.rpc("update_survey_section", {
    target_section_id: secaoId,
    section_title: title,
    section_description: typeof corpo.description === "string" ? corpo.description.trim() || null : null,
  });

  if (error) return respostaDeErro(error, "PATCH /api/avaliacoes/[id]/secoes/[secaoId]");

  return NextResponse.json(data);
}
