import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeEntradaInvalida, respostaDeErro } from "@/lib/api/resposta-http";

/**
 * Bootstrap da autoavaliação do CDDI em uma única ida do navegador ao servidor.
 *
 * Antes, a tela resolvia o ciclo e depois abria três requests paralelos para
 * formulário, submissão e identidade. Cada request atravessava o proxy de Auth,
 * multiplicando validação de sessão e overhead HTTP. Aqui o ciclo é resolvido
 * uma vez e as três RPCs independentes rodam em paralelo no servidor.
 */
export async function POST(request: Request) {
  let corpo: { applicationCode?: unknown };
  try {
    corpo = await request.json() as { applicationCode?: unknown };
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  const requestedCode = typeof corpo.applicationCode === "string"
    ? corpo.applicationCode.trim()
    : "";

  const banco = await createServerRpcClient();
  let applicationCode = requestedCode;

  if (!applicationCode) {
    const { data: cycleData, error: cycleError } = await banco.rpc("FC_OBTER_CICLO_CDDI_VIGENTE");
    if (cycleError) return respostaDeErro(cycleError, "POST /api/cddi/bootstrap [ciclo]");

    const cycle = cycleData as { code?: string } | null;
    if (!cycle?.code) {
      return NextResponse.json(
        { mensagem: "Você ainda não faz parte de um ciclo do CDDI. Procure a administração se acredita que isso é um engano." },
        { status: 404 },
      );
    }
    applicationCode = cycle.code;
  }

  const [formResult, submissionResult, identityResult] = await Promise.all([
    banco.rpc("FC_OBTER_FORMULARIO_PUBLICO", {
      target_application_code: applicationCode,
    }),
    banco.rpc("FC_INICIAR_OU_RETOMAR_CDDI", {
      target_application_code: applicationCode,
      target_submission_type: "AUTO",
      target_subject_person_id: null,
    }),
    banco.rpc("FC_OBTER_IDENTIDADE_CDDI", {
      target_application_code: applicationCode,
    }),
  ]);

  if (formResult.error) return respostaDeErro(formResult.error, "POST /api/cddi/bootstrap [formulário]");
  if (submissionResult.error) return respostaDeErro(submissionResult.error, "POST /api/cddi/bootstrap [submissão]");
  if (identityResult.error) return respostaDeErro(identityResult.error, "POST /api/cddi/bootstrap [identidade]");

  if (!formResult.data) {
    return NextResponse.json(
      { mensagem: "A avaliação ainda não está publicada." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    applicationCode,
    form: formResult.data,
    submission: submissionResult.data,
    identity: identityResult.data,
  });
}
