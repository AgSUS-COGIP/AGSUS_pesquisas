import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { EventoAuditoriaPessoa } from "@/lib/api/contratos-pessoas";

/** Histórico administrativo de uma pessoa, lido à parte da ficha. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de pessoa inválido.");
  }

  const limiteBruto = Number(new URL(request.url).searchParams.get("limite"));
  const limite = Number.isFinite(limiteBruto) && limiteBruto > 0 && limiteBruto <= 100
    ? Math.trunc(limiteBruto)
    : 30;

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_LISTAR_AUDITORIA_PESSOA", {
    target_person_id: id,
    target_limit: limite,
  });

  if (error) return respostaDeErro(error, "GET /api/pessoas/[id]/auditoria");

  const eventos = Array.isArray(data) ? data as EventoAuditoriaPessoa[] : [];
  return NextResponse.json(eventos);
}
