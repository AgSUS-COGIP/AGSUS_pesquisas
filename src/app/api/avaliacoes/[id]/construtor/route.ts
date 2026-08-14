import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { ConstrutorAvaliacao } from "@/lib/api/contratos-construtor";

/** Estrutura completa do formulário: pesquisa, versão, ciclo e seções. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_survey_builder", {
    target_survey_id: id,
  });

  if (error) return respostaDeErro(error, "GET /api/avaliacoes/[id]/construtor");

  return NextResponse.json(data as ConstrutorAvaliacao);
}
