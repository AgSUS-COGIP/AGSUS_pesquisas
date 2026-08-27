import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import { calculatePreSampleStatistics, type PreSampleMatrix } from "@/lib/pre-sample-statistics";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_obter_matriz_pre_amostra", { target_survey_id: id });
  if (error) return respostaDeErro(error, "GET /api/avaliacoes/[id]/resultados-pre-amostra");
  return NextResponse.json(calculatePreSampleStatistics(data as PreSampleMatrix), {
    headers: { "Cache-Control": "no-store" },
  });
}
