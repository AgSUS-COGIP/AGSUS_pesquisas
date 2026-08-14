import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { CandidatoDaEquipe } from "@/lib/api/contratos-pessoas";

/**
 * Pessoas elegíveis a entrar na equipe.
 *
 * `fc_pesquisar_equipe` exclui quem já tem chefia vigente, e é isso que impede
 * uma liderança de puxar para a sua equipe alguém que responde a outra.
 */
export async function GET(request: Request) {
  const parametros = new URL(request.url).searchParams;
  const avaliacao = parametros.get("avaliacao");
  const busca = parametros.get("busca")?.trim() ?? "";

  if (!ehUuid(avaliacao)) {
    return respostaDeEntradaInvalida("Informe a avaliação em que a pessoa será incluída.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_pesquisar_equipe", {
    target_application_id: avaliacao,
    search_term: busca,
  });

  if (error) return respostaDeErro(error, "GET /api/equipe/candidatos");

  const candidatos = Array.isArray(data) ? data as CandidatoDaEquipe[] : [];
  return NextResponse.json(candidatos);
}
