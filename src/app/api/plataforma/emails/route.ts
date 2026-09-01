import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";

export const dynamic = "force-dynamic";

/**
 * Histórico de e-mails aos participantes, com resumo por situação.
 *
 * `tl_email_participante` não tem grant para `authenticated` e não vai ganhar:
 * a leitura passa por `FC_LISTAR_ENVIOS_EMAIL`, que exige papel administrativo.
 * Até esta rota existir, ninguém na plataforma conseguia ver o que havia sido
 * enviado — nem que nada havia.
 */
export async function GET(request: NextRequest) {
  const avaliacao = request.nextUrl.searchParams.get("avaliacao");
  const situacao = request.nextUrl.searchParams.get("situacao") ?? "ALL";
  const limite = Number(request.nextUrl.searchParams.get("limite") ?? 200);

  if (avaliacao && !ehUuid(avaliacao)) {
    return respostaDeEntradaInvalida("Ciclo inválido.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_LISTAR_ENVIOS_EMAIL", {
    p_aplicacao: avaliacao || null,
    p_situacao: situacao,
    p_limite: Number.isFinite(limite) ? limite : 200,
  });

  if (error) return respostaDeErro(error, "GET /api/plataforma/emails");

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
