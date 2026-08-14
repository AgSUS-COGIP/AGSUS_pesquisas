import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { IncluirIntegranteEntrada } from "@/lib/api/contratos-pessoas";

/** Inclui uma pessoa na equipe da liderança neste ciclo. */
export async function POST(request: Request) {
  let corpo: IncluirIntegranteEntrada;
  try {
    corpo = await request.json() as IncluirIntegranteEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (!ehUuid(corpo.applicationId) || !ehUuid(corpo.personId)) {
    return respostaDeEntradaInvalida("Informe a avaliação e a pessoa a incluir.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("add_person_to_my_team", {
    target_application_id: corpo.applicationId,
    target_person_id: corpo.personId,
  });

  if (error) return respostaDeErro(error, "POST /api/equipe/membros");

  return NextResponse.json(data ?? { incluido: true }, { status: 201 });
}
