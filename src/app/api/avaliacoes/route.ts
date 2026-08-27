import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import type { AvaliacaoGerenciada, CriarAvaliacaoEntrada } from "@/lib/api/contratos";

/** Catálogo de avaliações administrativas — ativas ou arquivadas. */
export async function GET(request: Request) {
  const arquivadas = new URL(request.url).searchParams.get("arquivadas") === "true";

  const supabase = await createServerRpcClient();

  // Cada visão tem função própria no banco, e não um parâmetro na mesma função:
  // o PostgREST resolve a função pelo conjunto de argumentos, então uma
  // sobrecarga com argumento opcional tornaria ambígua a chamada sem argumento.
  const { data, error } = arquivadas
    ? await supabase.rpc("fc_listar_pesquisas_arq")
    : await supabase.rpc("list_managed_surveys");

  if (error) {
    return respostaDeErro(error, arquivadas ? "GET /api/avaliacoes?arquivadas" : "GET /api/avaliacoes");
  }

  const avaliacoes = Array.isArray(data) ? data as AvaliacaoGerenciada[] : [];
  return NextResponse.json(avaliacoes);
}

/** Campo de texto obrigatório, já aparado e limitado no contrato HTTP. */
function textoObrigatorio(valor: unknown, limite: number) {
  if (typeof valor !== "string") return null;
  const texto = valor.trim();
  return texto && texto.length <= limite ? texto : null;
}

function dataIsoOpcional(valor: unknown): { valid: boolean; value: string | null } {
  if (valor === null || valor === undefined || valor === "") {
    return { valid: true, value: null };
  }
  if (typeof valor !== "string") return { valid: false, value: null };
  const data = new Date(valor);
  return Number.isNaN(data.getTime())
    ? { valid: false, value: null }
    : { valid: true, value: data.toISOString() };
}

/** Cria uma avaliação em rascunho. */
export async function POST(request: Request) {
  let corpo: CriarAvaliacaoEntrada;
  try {
    corpo = await request.json() as CriarAvaliacaoEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  const code = textoObrigatorio(corpo.code, 30);
  const name = textoObrigatorio(corpo.name, 140);
  const applicationName = textoObrigatorio(corpo.applicationName, 160);
  const description = typeof corpo.description === "string" ? corpo.description.trim() : null;
  const opensAt = dataIsoOpcional(corpo.opensAt);
  const closesAt = dataIsoOpcional(corpo.closesAt);

  if (!code || !name || !applicationName) {
    return respostaDeEntradaInvalida("Informe código, nome e nome do ciclo dentro dos limites permitidos.");
  }
  if (description && description.length > 600) {
    return respostaDeEntradaInvalida("A descrição deve ter no máximo 600 caracteres.");
  }
  if (!opensAt.valid || !closesAt.valid) {
    return respostaDeEntradaInvalida("Informe datas válidas para abertura e encerramento.");
  }
  if (corpo.anonymous !== undefined && typeof corpo.anonymous !== "boolean") {
    return respostaDeEntradaInvalida("Informe corretamente se a avaliação é anônima.");
  }
  if (corpo.allowDrafts !== undefined && typeof corpo.allowDrafts !== "boolean") {
    return respostaDeEntradaInvalida("Informe corretamente se rascunhos são permitidos.");
  }

  const supabase = await createServerRpcClient();
  const { data, error } = await supabase.rpc("create_survey_draft", {
    p_code: code,
    p_name: name,
    p_description: description,
    p_application_name: applicationName,
    p_opens_at: opensAt.value,
    p_closes_at: closesAt.value,
    p_anonymous: corpo.anonymous ?? false,
    p_allow_drafts: corpo.allowDrafts ?? true,
  });

  if (error) return respostaDeErro(error, "POST /api/avaliacoes");

  return NextResponse.json(data, { status: 201 });
}
