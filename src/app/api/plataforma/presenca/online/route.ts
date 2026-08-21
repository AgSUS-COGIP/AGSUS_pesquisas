import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro } from "@/lib/api/resposta-http";

export const dynamic = "force-dynamic";

/**
 * Quem está online agora.
 *
 * Restrita pelo banco aos perfis configurados em
 * `tx_perfis_visualizacao_presenca` — o mesmo portão que a política de leitura
 * do Realtime usava, reaproveitado em vez de reimplementado. Quem não pode ver
 * recebe `403`, e não lista vazia: a tela precisa distinguir "ninguém online"
 * de "você não pode ver".
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_listar_presenca_online");

  if (error) return respostaDeErro(error, "GET /api/plataforma/presenca/online");

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
