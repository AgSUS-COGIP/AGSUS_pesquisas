import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro } from "@/lib/api/resposta-http";

/**
 * Ciclo do CDDI em que a pessoa autenticada participa.
 *
 * Resolve o código quando a URL não traz `?ciclo=`. Sem participação a RPC
 * devolve vazio, não erro — a tradução para 404 acontece aqui para a tela
 * distinguir "você não está num ciclo" de "não consegui carregar".
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_obter_ciclo_cddi_vigente");

  if (error) return respostaDeErro(error, "GET /api/cddi/ciclo-vigente");

  const ciclo = data as { code?: string } | null;
  if (!ciclo?.code) {
    return NextResponse.json(
      { mensagem: "Você ainda não faz parte de um ciclo do CDDI. Procure a administração se acredita que isso é um engano." },
      { status: 404 },
    );
  }

  return NextResponse.json(ciclo);
}
