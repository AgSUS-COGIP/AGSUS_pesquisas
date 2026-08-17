import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro } from "@/lib/api/resposta-http";
import type { SurveyCatalogItem } from "@/lib/survey-catalog";

/**
 * Catálogo de avaliações da pessoa autenticada.
 *
 * `/api/meu/…` nunca recebe identificador de pessoa no caminho: a identidade
 * vem da sessão, e não há parâmetro para forjar nem verificação a esquecer.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_my_survey_catalog");

  if (error) return respostaDeErro(error, "GET /api/meu/catalogo");

  return NextResponse.json(Array.isArray(data) ? data as SurveyCatalogItem[] : []);
}
