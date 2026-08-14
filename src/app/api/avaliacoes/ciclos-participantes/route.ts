import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro } from "@/lib/api/resposta-http";
import type { AvaliacaoComParticipantes } from "@/lib/api/contratos-pessoas";

/** Ciclos disponíveis para gestão de público, com as contagens de cada um. */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_admin_participant_applications");

  if (error) return respostaDeErro(error, "GET /api/avaliacoes/ciclos-participantes");

  const ciclos = Array.isArray(data) ? data as AvaliacaoComParticipantes[] : [];
  return NextResponse.json(ciclos);
}
