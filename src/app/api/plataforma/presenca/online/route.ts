import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro } from "@/lib/api/resposta-http";

export const dynamic = "force-dynamic";

/**
 * Quem está online agora.
 *
 * Restrita pelo banco à permissão `ONLINE_PRESENCE`. Quem não pode ver recebe
 * `403`, e não lista vazia: a tela precisa distinguir "ninguém online" de
 * "você não pode ver".
 */
export async function GET() {
  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_LISTAR_PRESENCA_ONLINE");

  if (error) return respostaDeErro(error, "GET /api/plataforma/presenca/online");

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
