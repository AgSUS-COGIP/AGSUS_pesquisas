import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { PessoasEncontradas } from "@/lib/api/contratos-publico";

/**
 * Busca de pessoa para inclusão e exclusão individual.
 *
 * Usa `fc_buscar_pessoas_publico` e não a busca administrativa existente: aquela
 * exige `employment_status = 'ATIVO'`, e a elegibilidade desta fase é
 * `people.active`. Com a busca antiga, alguém elegível pelo filtro ficaria
 * invisível no seletor — e não haveria como explicar a diferença a quem opera.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  const busca = new URL(request.url).searchParams.get("busca")?.trim() || null;

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_buscar_pessoas_publico", {
    p_busca: busca,
    p_limite: 20,
  });

  if (error) return respostaDeErro(error, "GET /api/avaliacoes/[id]/publico/pessoas");

  return NextResponse.json((data ?? { status: "OK", people: [] }) as PessoasEncontradas);
}
