import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro } from "@/lib/api/resposta-http";

/**
 * Contexto institucional de quem chamou: pessoa, papéis, módulos e participação.
 *
 * É a rota mais sensível da plataforma — `fc_obter_contexto_plataforma()` é a
 * chamada única de autorização, e uma falha aqui tranca todo mundo para fora,
 * inclusive quem administraria a correção. Por isso ela não interpreta `status`
 * nem deriva módulo: quem traduz `UNLINKED` em provisionamento e `AUTH_REQUIRED`
 * em redirecionamento é o cliente, único lugar com essa lógica.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("fc_obter_contexto_plataforma");

  if (error) return respostaDeErro(error, "GET /api/meu/contexto");

  return NextResponse.json(data);
}
