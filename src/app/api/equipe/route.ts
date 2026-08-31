import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro } from "@/lib/api/resposta-http";
import type { EquipeDaLideranca } from "@/lib/api/contratos-pessoas";

/**
 * Equipe da liderança no ciclo escolhido.
 *
 * O recurso é "minha equipe": `fc_obter_minha_equipe` resolve a liderança pela
 * sessão, e é assim que o banco impede uma pessoa de ler a equipe de outra.
 * `ciclo` ausente deixa o banco escolher o mais recente.
 */
export async function GET(request: Request) {
  const ciclo = new URL(request.url).searchParams.get("ciclo")?.trim() || null;

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("fc_obter_minha_equipe", {
    target_application_code: ciclo,
  });

  if (error) return respostaDeErro(error, "GET /api/equipe");

  return NextResponse.json(data as EquipeDaLideranca);
}
