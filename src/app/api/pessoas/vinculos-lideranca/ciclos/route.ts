import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro } from "@/lib/api/resposta-http";
import type { AvaliacaoComParticipantes } from "@/lib/api/contratos-pessoas";

/** Somente ciclos CDDI podem receber vínculos de liderança. */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_listar_ciclos_lideranca_adm");

  if (error) {
    return respostaDeErro(error, "GET /api/pessoas/vinculos-lideranca/ciclos");
  }

  const ciclos = Array.isArray(data) ? data as AvaliacaoComParticipantes[] : [];
  return NextResponse.json(ciclos);
}
