import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { PessoaSemChefia } from "@/lib/api/contratos-pessoas";

/**
 * Fila de correção: participantes do ciclo sem chefia vigente.
 *
 * Sem vínculo, a pessoa fica travada na etapa de identificação do CDDI — esta
 * lista é trabalho pendente, não relatório. Cada item traz o gestor que a base
 * indicava e o motivo da falha, para a correção não ser uma busca às cegas.
 */
export async function GET(request: Request) {
  const parametros = new URL(request.url).searchParams;
  const avaliacao = parametros.get("avaliacao");
  const busca = parametros.get("busca")?.trim() ?? "";

  if (!ehUuid(avaliacao)) {
    return respostaDeEntradaInvalida("Informe a avaliação cujas pendências devem ser listadas.");
  }

  const limiteBruto = Number(parametros.get("limite"));
  const limite = Number.isFinite(limiteBruto) && limiteBruto > 0 && limiteBruto <= 2000
    ? Math.trunc(limiteBruto)
    : 100;

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("fc_listar_pessoas_sem_chefia", {
    target_application_id: avaliacao,
    target_search: busca,
    target_limit: limite,
  });

  if (error) return respostaDeErro(error, "GET /api/pessoas/sem-chefia");

  const pendencias = Array.isArray(data) ? data as PessoaSemChefia[] : [];
  return NextResponse.json(pendencias);
}
