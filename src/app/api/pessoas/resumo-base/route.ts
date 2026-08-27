import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { ResumoBasePessoas } from "@/lib/api/contratos-pessoas";

/**
 * Retrato da base mestra de pessoas.
 *
 * `avaliacao` recorta o retrato por ciclo. Fica exposto porque a RPC já o
 * aceita, mas a tela hoje sempre envia nulo.
 */
export async function GET(request: Request) {
  const avaliacao = new URL(request.url).searchParams.get("avaliacao");

  if (avaliacao && !ehUuid(avaliacao)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  const supabase = await createServerRpcClient();
  const { data, error } = await supabase.rpc("get_admin_people_base_summary", {
    target_application_id: avaliacao ?? null,
  });

  if (error) return respostaDeErro(error, "GET /api/pessoas/resumo-base");

  return NextResponse.json(data as ResumoBasePessoas);
}
