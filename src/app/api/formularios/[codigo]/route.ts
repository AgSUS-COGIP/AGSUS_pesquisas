import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";

/**
 * Definição publicada de um formulário, pelo código da aplicação.
 *
 * A rota exige sessão. A RPC institucional devolve somente os campos necessários
 * à resposta e mantém metadados de pontuação no servidor.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ codigo: string }> },
) {
  const { codigo } = await params;
  const codigoAplicacao = decodeURIComponent(codigo).trim();

  if (!codigoAplicacao) {
    return respostaDeEntradaInvalida("Informe o código da avaliação.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_obter_formulario_publico", {
    target_application_code: codigoAplicacao,
  });

  if (error) return respostaDeErro(error, "GET /api/formularios/[codigo]");

  if (!data) {
    return NextResponse.json(
      { mensagem: "A avaliação ainda não está publicada." },
      { status: 404 },
    );
  }

  return NextResponse.json(data);
}
