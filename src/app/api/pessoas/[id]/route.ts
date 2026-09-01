import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { AtualizarPessoaEntrada } from "@/lib/api/contratos-pessoas";

/**
 * Corrige a ficha funcional de uma pessoa.
 *
 * A matrícula não entra: ela identifica a pessoa neste projeto e é imutável,
 * como a justificativa obrigatória e o registro em auditoria, tudo dentro de
 * `FC_ATUALIZAR_PESSOA_ADMIN`.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de pessoa inválido.");
  }

  let corpo: AtualizarPessoaEntrada;
  try {
    corpo = await request.json() as AtualizarPessoaEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  const fullName = typeof corpo.fullName === "string" ? corpo.fullName.trim() : "";
  if (!fullName) {
    return respostaDeEntradaInvalida("Informe o nome completo da pessoa.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_ATUALIZAR_PESSOA_ADMIN", {
    target_person_id: id,
    target_full_name: fullName,
    target_institutional_email: corpo.institutionalEmail ?? null,
    target_job_title: corpo.jobTitle ?? null,
    target_cost_center: corpo.costCenter ?? null,
    target_workplace: corpo.workplace ?? null,
    target_directorate: corpo.directorate ?? null,
    target_organizational_unit: corpo.organizationalUnit ?? null,
    target_coordination: corpo.coordination ?? null,
    target_employment_status: corpo.employmentStatus,
    target_active: corpo.active,
    target_justification: corpo.justification,
  });

  if (error) return respostaDeErro(error, "PATCH /api/pessoas/[id]");

  return NextResponse.json(data ?? { atualizada: true });
}
