import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";

/**
 * Envia a submissão definitivamente.
 *
 * O envio é irreversível e é quando o banco cobra as obrigatórias, pelo motor
 * de lógica condicional que decide quais perguntas estavam visíveis para aquela
 * pessoa.
 *
 * A tela descarrega as gravações pendentes antes de chamar esta rota: sem isso,
 * uma resposta ainda em debounce ficaria de fora e o envio seria recusado por
 * uma obrigatória que a pessoa acabou de preencher.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de submissão inválido.");
  }

  const supabase = await createServerRpcClient();
  const { data, error } = await supabase.rpc("submit_my_survey_submission", {
    target_submission_id: id,
  });

  if (error) return respostaDeErro(error, "POST /api/submissoes/[id]/envio");

  return NextResponse.json(data);
}
