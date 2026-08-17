import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type {
  DefinirVinculoLiderancaEntrada,
  VinculoLideranca,
} from "@/lib/api/contratos-pessoas";

/**
 * Vínculos de chefia de um ciclo — a via de correção do que veio da importação.
 *
 * Definir a liderança substitui o vínculo anterior encerrando a vigência dele,
 * sem apagar histórico.
 */
export async function GET(request: Request) {
  const parametros = new URL(request.url).searchParams;
  const avaliacao = parametros.get("avaliacao");
  const busca = parametros.get("busca")?.trim() ?? "";

  if (!ehUuid(avaliacao)) {
    return respostaDeEntradaInvalida("Informe a avaliação cujos vínculos devem ser listados.");
  }

  const limiteBruto = Number(parametros.get("limite"));
  const limite = Number.isFinite(limiteBruto) && limiteBruto > 0 && limiteBruto <= 1000
    ? Math.trunc(limiteBruto)
    : 100;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("list_platform_admin_leadership_links", {
    target_application_id: avaliacao,
    target_search: busca,
    target_limit: limite,
  });

  if (error) return respostaDeErro(error, "GET /api/pessoas/vinculos-lideranca");

  const vinculos = Array.isArray(data) ? data as VinculoLideranca[] : [];
  return NextResponse.json(vinculos);
}

export async function PUT(request: Request) {
  let corpo: DefinirVinculoLiderancaEntrada;
  try {
    corpo = await request.json() as DefinirVinculoLiderancaEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (!ehUuid(corpo.applicationId) || !ehUuid(corpo.subordinatePersonId) || !ehUuid(corpo.leaderPersonId)) {
    return respostaDeEntradaInvalida("Informe a avaliação, o integrante e a liderança do vínculo.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("set_platform_admin_leadership_link", {
    target_application_id: corpo.applicationId,
    target_subordinate_person_id: corpo.subordinatePersonId,
    target_leader_person_id: corpo.leaderPersonId,
    target_justification: corpo.justification,
  });

  if (error) return respostaDeErro(error, "PUT /api/pessoas/vinculos-lideranca");

  return NextResponse.json(data ?? { definido: true });
}
