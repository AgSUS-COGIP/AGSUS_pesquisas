import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { EnviarEmailsEntrada } from "@/lib/api/contratos-pessoas";

export const dynamic = "force-dynamic";

/**
 * Enfileira o lembrete dirigido para as pessoas escolhidas.
 *
 * **Não envia** — enfileira. Quem envia continua sendo o mesmo despachador dos
 * automáticos, com o mesmo registro de desfecho, para que exista uma fonte só
 * de verdade sobre o que saiu. A tela chama o despacho em seguida, em lotes,
 * mostrando o progresso.
 *
 * A rota valida só a forma; quem decide elegibilidade e recusa o ciclo fechado
 * é `fc_agendar_envio_manual`.
 */
export async function POST(request: Request) {
  let corpo: EnviarEmailsEntrada;
  try {
    corpo = await request.json() as EnviarEmailsEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (!corpo?.avaliacao || !ehUuid(corpo.avaliacao)) {
    return respostaDeEntradaInvalida("Informe o ciclo.");
  }
  if (!Array.isArray(corpo.pessoas) || corpo.pessoas.length === 0) {
    return respostaDeEntradaInvalida("Selecione ao menos uma pessoa.");
  }
  if (!corpo.pessoas.every((pessoa) => typeof pessoa === "string" && ehUuid(pessoa))) {
    return respostaDeEntradaInvalida("A seleção contém identificador inválido.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("fc_agendar_envio_manual", {
    p_aplicacao: corpo.avaliacao,
    p_pessoas: corpo.pessoas,
  });

  if (error) return respostaDeErro(error, "POST /api/plataforma/emails/enviar");

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
