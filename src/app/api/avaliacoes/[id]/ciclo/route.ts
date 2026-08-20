import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import { scheduleParticipantEmailDispatch } from "@/app/api/tarefas/emails/agendamento";
import type { AcaoCicloEntrada, OperacaoCiclo } from "@/lib/api/contratos-construtor";

export const maxDuration = 300;

/**
 * Estado do ciclo: métricas, checklist de integridade e sinais de prontidão.
 *
 * `get_survey_operations` **grava** antes de responder — materializa a abertura
 * de ciclo agendado cuja data já passou —, daí o `no-store`: cachear esta
 * leitura mostraria fechado um ciclo que no banco já abriu.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("get_survey_operations", {
    target_survey_id: id,
  });

  if (error) return respostaDeErro(error, "GET /api/avaliacoes/[id]/ciclo");

  return NextResponse.json(data as OperacaoCiclo, {
    headers: { "Cache-Control": "no-store" },
  });
}

/**
 * Executa uma transição do ciclo (`PUBLISH`, `OPEN`, `CLOSE`, `ARCHIVE`, …).
 *
 * A rota não conhece a lista de ações nem a matriz de transições válidas: uma
 * segunda tabela de estados aqui divergiria de `manage_survey_cycle` na
 * primeira transição nova.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  let corpo: AcaoCicloEntrada;
  try {
    corpo = await request.json() as AcaoCicloEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  const action = typeof corpo.action === "string" ? corpo.action.trim().toUpperCase() : "";
  if (!action) {
    return respostaDeEntradaInvalida("Informe a operação do ciclo.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("manage_survey_cycle", {
    target_survey_id: id,
    target_action: action,
    target_opens_at: corpo.opensAt ?? null,
    target_closes_at: corpo.closesAt ?? null,
  });

  if (error) return respostaDeErro(error, "POST /api/avaliacoes/[id]/ciclo");

  // Abertura pela mão do operador despacha os e-mails de abertura na hora,
  // sem esperar o cron. `after()` roda depois da resposta; a decisão de quem
  // recebe continua toda no banco, então disparar sem necessidade é inócuo —
  // e com a configuração de e-mail ausente o despacho apenas se declara
  // pulado. Ciclo agendado abre preguiçosamente e fica a cargo do cron.
  if (action === "OPEN" || action === "REOPEN") {
    scheduleParticipantEmailDispatch("abertura");
  }

  return NextResponse.json(data);
}
