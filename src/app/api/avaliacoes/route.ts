import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import type { AvaliacaoGerenciada, CriarAvaliacaoEntrada } from "@/lib/api/contratos";

/** Catálogo de avaliações administrativas — ativas ou arquivadas. */
export async function GET(request: Request) {
  const arquivadas = new URL(request.url).searchParams.get("arquivadas") === "true";

  const supabase = await createServerSupabaseClient();

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

/** Campo de texto obrigatório, já aparado. */
function textoObrigatorio(valor: unknown) {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

/** Cria uma avaliação em rascunho. */
export async function POST(request: Request) {
  let corpo: CriarAvaliacaoEntrada;
  try {
    corpo = await request.json() as CriarAvaliacaoEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  const code = textoObrigatorio(corpo.code);
  const name = textoObrigatorio(corpo.name);
  const applicationName = textoObrigatorio(corpo.applicationName);

  if (!code || !name || !applicationName) {
    return respostaDeEntradaInvalida("Informe código, nome e nome da aplicação da avaliação.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("create_survey_draft", {
    p_code: code,
    p_name: name,
    p_description: typeof corpo.description === "string" ? corpo.description.trim() : null,
    p_application_name: applicationName,
    p_opens_at: corpo.opensAt ?? null,
    p_closes_at: corpo.closesAt ?? null,
    p_anonymous: corpo.anonymous ?? false,
    p_allow_drafts: corpo.allowDrafts ?? true,
  });

  if (error) return respostaDeErro(error, "POST /api/avaliacoes");

  return NextResponse.json(data, { status: 201 });
}
