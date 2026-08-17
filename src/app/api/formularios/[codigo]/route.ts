import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";

/**
 * Definição publicada de um formulário, pelo código da aplicação.
 *
 * A rota **exige sessão**, embora `get_public_survey_form` tenha `execute` para
 * `anon`: as duas telas que a consomem já vivem atrás do middleware, e declarar
 * a rota em `PUBLIC_PATHS` ampliaria a superfície anônima sem consumidor que
 * peça. A RPC filtra por versão publicada, então rascunho não vaza por aqui.
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
  const { data, error } = await supabase.rpc("get_public_survey_form", {
    target_application_code: codigoAplicacao,
  });

  if (error) return respostaDeErro(error, "GET /api/formularios/[codigo]");

  // Formulário ausente não é erro do banco: a RPC devolve vazio quando nada
  // casa com os filtros. O 404 deixa a tela distinguir "não publicada" de
  // "falhou ao carregar".
  if (!data) {
    return NextResponse.json(
      { mensagem: "A avaliação ainda não está publicada." },
      { status: 404 },
    );
  }

  return NextResponse.json(data);
}
