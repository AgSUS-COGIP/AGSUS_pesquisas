import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import { scheduleParticipantEmailDispatch } from "@/app/api/tarefas/emails/agendamento";
import type { NotificacaoEmailEntrada } from "@/lib/api/contratos-construtor";

export const maxDuration = 300;

/**
 * Liga ou desliga o envio de e-mails aos participantes do ciclo.
 *
 * É `PUT`, não `POST` em `/ciclo`: a opção não é uma transição da máquina de
 * estados do ciclo — é uma propriedade que vale em qualquer estado e sempre
 * substitui o valor anterior.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  let corpo: NotificacaoEmailEntrada;
  try {
    corpo = await request.json() as NotificacaoEmailEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (typeof corpo.enabled !== "boolean") {
    return respostaDeEntradaInvalida("Informe se a notificação deve ficar ligada ou desligada.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("fc_definir_notificacao_email", {
    target_survey_id: id,
    target_enabled: corpo.enabled,
  });

  if (error) return respostaDeErro(error, "PUT /api/avaliacoes/[id]/notificacoes");

  // Ligar a opção num ciclo que já está OPEN não pode esperar o cron do dia
  // seguinte — sem isto, o despacho só rodaria de novo na próxima abertura de
  // ciclo (que já passou) ou no cron. `after()` roda depois da resposta; se o
  // ciclo não estiver OPEN, fc_reivindicar_emails() simplesmente não reivindica
  // nada; só ligar a opção agenda o trabalho.
  if (corpo.enabled) {
    scheduleParticipantEmailDispatch("notificacao");
  }

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  });
}
