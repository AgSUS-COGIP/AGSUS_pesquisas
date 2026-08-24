import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehObjeto } from "@/lib/api/validacao";

/**
 * Inicia ou retoma a submissão da pessoa autenticada numa avaliação.
 *
 * Repetir a chamada é seguro: quem decide criar ou retomar é o banco, e retomar
 * devolve a mesma linha.
 */
export async function POST(request: Request) {
  let corpo: { applicationCode?: unknown };
  try {
    corpo = await request.json() as { applicationCode?: unknown };
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (!ehObjeto(corpo)) return respostaDeEntradaInvalida("Informe os dados da submissão em um objeto JSON.");

  const applicationCode = typeof corpo.applicationCode === "string" ? corpo.applicationCode.trim() : "";
  if (!applicationCode) {
    return respostaDeEntradaInvalida("Informe o código da avaliação.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("start_or_resume_my_survey_submission", {
    target_application_code: applicationCode,
  });

  if (error) return respostaDeErro(error, "POST /api/submissoes");

  return NextResponse.json(data);
}
