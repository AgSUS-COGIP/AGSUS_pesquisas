import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro } from "@/lib/api/resposta-http";

/**
 * Sincroniza a foto da conta Google no cadastro institucional.
 *
 * A foto é acessório: falha aqui não pode impedir o acesso, e quem chama trata
 * o erro como aviso. É o 401 que distingue sessão expirada de falha ao
 * sincronizar.
 */
export async function POST() {
  const banco = await createServerRpcClient();
  const { error } = await banco.rpc("sync_my_google_avatar");

  if (error) return respostaDeErro(error, "POST /api/meu/avatar-google");

  return NextResponse.json({ sincronizado: true });
}
