import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { IntencaoPreAmostra } from "@/lib/api/contratos-construtor";

export const dynamic = "force-dynamic";

/**
 * Intenção de validar o ciclo por pré-amostra.
 *
 * Rota separada de `../pre-amostra` de propósito: a intenção é decidida no
 * cadastro da avaliação, quando o ciclo ainda não tem público e nenhuma das
 * operações daquela rota é possível. O recurso é outro, e a autorização é a
 * mesma — `can_manage_surveys()` dentro das duas RPCs.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) return respostaDeEntradaInvalida("Identificador de avaliação inválido.");

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_obter_intencao_pre_amostra", { target_survey_id: id });
  if (error) return respostaDeErro(error, "GET /api/avaliacoes/[id]/pre-amostra/intencao");

  return NextResponse.json(data as IntencaoPreAmostra, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) return respostaDeEntradaInvalida("Identificador de avaliação inválido.");

  let corpo: { intended?: unknown };
  try {
    corpo = await request.json() as typeof corpo;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  // O banco recusa nulo, mas a mensagem daqui nomeia o campo do contrato HTTP.
  if (typeof corpo.intended !== "boolean") {
    return respostaDeEntradaInvalida("Informe se este ciclo terá pré-amostra.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_definir_intencao_pre_amostra", {
    target_survey_id: id,
    target_intended: corpo.intended,
  });
  if (error) return respostaDeErro(error, "PUT /api/avaliacoes/[id]/pre-amostra/intencao");

  return NextResponse.json(data as IntencaoPreAmostra, { headers: { "Cache-Control": "no-store" } });
}
