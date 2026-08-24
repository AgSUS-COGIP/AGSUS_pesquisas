import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";

/**
 * Cria uma nova versão em rascunho de uma pesquisa já publicada, a partir do
 * ciclo já encerrado — sem corpo: tudo é herdado da versão e do ciclo atuais.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_criar_nova_versao_pesquisa", {
    p_pesquisa: id,
  });

  if (error) return respostaDeErro(error, "POST /api/avaliacoes/[id]/versoes");

  return NextResponse.json(data, { status: 201 });
}
