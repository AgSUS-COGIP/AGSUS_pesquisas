import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehObjeto, ehUuid } from "@/lib/api/validacao";
import type { TipoSubmissaoCddi } from "@/lib/api/contratos-runtime";

/**
 * Inicia ou retoma uma submissão do CDDI.
 *
 * Rota própria, separada de `/api/submissoes`, porque a submissão carrega tipo
 * (autoavaliação ou avaliação de chefia) e, no segundo caso, a pessoa avaliada
 * — parâmetros que só o CDDI usa, e por isso as RPCs também são separadas.
 * Quem pode avaliar quem vem de `cddi_leadership_links`, que a RPC revalida.
 */
export async function POST(request: Request) {
  let corpo: {
    applicationCode?: unknown;
    submissionType?: unknown;
    subjectPersonId?: unknown;
  };
  try {
    corpo = await request.json() as typeof corpo;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (!ehObjeto(corpo)) return respostaDeEntradaInvalida("Informe os dados da submissão em um objeto JSON.");

  const applicationCode = typeof corpo.applicationCode === "string" ? corpo.applicationCode.trim() : "";
  if (!applicationCode) {
    return respostaDeEntradaInvalida("Informe o código do ciclo.");
  }

  const submissionType = corpo.submissionType === "CHEFIA" ? "CHEFIA" : "AUTO" satisfies TipoSubmissaoCddi;

  // `null` é legítimo — autoavaliação não tem sujeito. O que não pode é vir
  // algo que não seja identificador: o Postgres levantaria `22P02` e a tela
  // receberia um erro de sintaxe em vez de uma recusa compreensível.
  const subjectPersonId = corpo.subjectPersonId ?? null;
  if (subjectPersonId !== null && !ehUuid(subjectPersonId)) {
    return respostaDeEntradaInvalida("Identificador de pessoa avaliada inválido.");
  }

  const supabase = await createServerRpcClient();
  const { data, error } = await supabase.rpc("start_or_resume_my_cddi_submission", {
    target_application_code: applicationCode,
    target_submission_type: submissionType,
    target_subject_person_id: subjectPersonId,
  });

  if (error) return respostaDeErro(error, "POST /api/cddi/submissoes");

  return NextResponse.json(data);
}
