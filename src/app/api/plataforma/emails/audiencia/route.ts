import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";

export const dynamic = "force-dynamic";

/**
 * Audiência de um ciclo: quem é elegível, quem já respondeu e quando cada
 * pessoa recebeu o último e-mail.
 *
 * É o que permite "cobrar quem falta" ser uma ação da plataforma em vez de uma
 * exportação para planilha. O filtro de situação (`PENDING`, `DRAFT`, `DONE`) é
 * validado pelo banco, não aqui.
 */
export async function GET(request: NextRequest) {
  const avaliacao = request.nextUrl.searchParams.get("avaliacao");
  if (!avaliacao || !ehUuid(avaliacao)) {
    return NextResponse.json({ error: "Informe o ciclo." }, { status: 400 });
  }

  const situacao = request.nextUrl.searchParams.get("situacao") ?? "ALL";
  const busca = request.nextUrl.searchParams.get("busca");
  const limite = Number(request.nextUrl.searchParams.get("limite") ?? 500);

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_listar_audiencia_email", {
    p_aplicacao: avaliacao,
    p_situacao: situacao,
    p_busca: busca || null,
    p_limite: Number.isFinite(limite) ? limite : 500,
  });

  if (error) return respostaDeErro(error, "GET /api/plataforma/emails/audiencia");

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
