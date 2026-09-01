import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type {
  ParticipanteDaAvaliacao,
  VincularParticipantesEntrada,
} from "@/lib/api/contratos-pessoas";

/** Público vinculado a um ciclo. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  const banco = await createServerRpcClient();
  const { data, error } = await banco.rpc("FC_LISTAR_PARTIC_CICLO", {
    target_application_id: id,
  });

  if (error) return respostaDeErro(error, "GET /api/avaliacoes/[id]/participantes");

  const participantes = Array.isArray(data) ? data as ParticipanteDaAvaliacao[] : [];
  return NextResponse.json(participantes);
}

/** Campo de texto obrigatório, já aparado. */
function textoObrigatorio(valor: unknown) {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

/**
 * Vincula pessoas ao público do ciclo.
 *
 * As três formas — lista de pessoas, todo o público elegível, ou alguém a
 * cadastrar — têm RPC própria no banco, mas produzem o mesmo efeito, então o
 * corpo escolhe entre elas em vez de haver três rotas.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  let corpo: VincularParticipantesEntrada;
  try {
    corpo = await request.json() as VincularParticipantesEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  const banco = await createServerRpcClient();

  if (corpo.criar) {
    const employeeNumber = textoObrigatorio(corpo.criar.employeeNumber);
    const fullName = textoObrigatorio(corpo.criar.fullName);
    const institutionalEmail = textoObrigatorio(corpo.criar.institutionalEmail);

    if (!employeeNumber || !fullName || !institutionalEmail) {
      return respostaDeEntradaInvalida("Informe matrícula, nome completo e e-mail institucional.");
    }

    const { data, error } = await banco.rpc("FC_CRIAR_E_ATRIB_PARTIC", {
      target_application_id: id,
      target_employee_number: employeeNumber,
      target_full_name: fullName,
      target_institutional_email: institutionalEmail,
      target_job_title: corpo.criar.jobTitle ?? null,
      target_cost_center: corpo.criar.costCenter ?? null,
      target_workplace: corpo.criar.workplace ?? null,
      target_access_profile: "PARTICIPANTE",
    });

    if (error) return respostaDeErro(error, "POST /api/avaliacoes/[id]/participantes (criar)");
    return NextResponse.json(data, { status: 201 });
  }

  if (corpo.todosDisponiveis) {
    const { data, error } = await banco.rpc("FC_ATRIB_TODOS_DISPONIVEIS", {
      target_application_id: id,
      target_access_profile: "PARTICIPANTE",
    });

    if (error) return respostaDeErro(error, "POST /api/avaliacoes/[id]/participantes (todos)");
    return NextResponse.json(data ?? {});
  }

  const pessoas = Array.isArray(corpo.pessoas) ? corpo.pessoas : [];
  if (!pessoas.length || !pessoas.every(ehUuid)) {
    return respostaDeEntradaInvalida("Informe ao menos uma pessoa válida para vincular.");
  }

  // Sempre a RPC de lote, mesmo para uma pessoa só: alternar de função conforme
  // o tamanho da lista faria o formato da resposta mudar sem o chamador ter
  // pedido nada diferente.
  const { data, error } = await banco.rpc("FC_ATRIB_PARTICIPANTE_LOTE", {
    target_application_id: id,
    target_person_ids: pessoas,
    target_access_profile: "PARTICIPANTE",
  });

  if (error) return respostaDeErro(error, "POST /api/avaliacoes/[id]/participantes (lote)");
  return NextResponse.json(data ?? {});
}
