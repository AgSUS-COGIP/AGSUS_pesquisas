import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { AlterarStatusParticipanteEntrada } from "@/lib/api/contratos-pessoas";

/** Situações que a administração pode atribuir a um participante. */
const STATUS_ACEITOS = ["ELIGIBLE", "BLOCKED", "EXCLUDED"] as const;

/**
 * Bloqueia, reativa ou remove um participante do ciclo.
 *
 * Nem mesmo "remover" apaga: a RPC marca `EXCLUDED` e preserva o registro.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; participanteId: string }> },
) {
  const { id, participanteId } = await params;

  if (!ehUuid(id) || !ehUuid(participanteId)) {
    return respostaDeEntradaInvalida("Identificador de avaliação ou de participante inválido.");
  }

  let corpo: AlterarStatusParticipanteEntrada;
  try {
    corpo = await request.json() as AlterarStatusParticipanteEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (!STATUS_ACEITOS.includes(corpo.status)) {
    return respostaDeEntradaInvalida("Situação inválida para um participante.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("set_admin_application_participant_status", {
    target_participant_id: participanteId,
    target_status: corpo.status,
  });

  if (error) {
    return respostaDeErro(error, "PATCH /api/avaliacoes/[id]/participantes/[participanteId]");
  }

  return NextResponse.json(data ?? { atualizado: true });
}
