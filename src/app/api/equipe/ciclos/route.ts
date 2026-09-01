import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro } from "@/lib/api/resposta-http";
import type { CicloDeLideranca } from "@/lib/api/contratos-pessoas";

/**
 * Ciclos em que a pessoa lidera equipe, do mais recente para o mais antigo.
 *
 * A tela depende dessa ordem: sem escolha explícita, o primeiro item é o ciclo
 * carregado. Reordenar aqui mudaria em silêncio qual equipe abre por padrão.
 */
export async function GET() {
  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_LISTAR_CICLOS_LIDERANCA");

  if (error) return respostaDeErro(error, "GET /api/equipe/ciclos");

  const ciclos = Array.isArray(data) ? data as CicloDeLideranca[] : [];
  return NextResponse.json(ciclos);
}
