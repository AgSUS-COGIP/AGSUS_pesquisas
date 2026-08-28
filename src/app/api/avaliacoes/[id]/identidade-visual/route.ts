import { NextResponse } from "next/server";
import { createServerRpcClient } from "@/lib/db/rpc-adapter";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type {
  ConstrutorAvaliacao,
  IdentidadeVisual,
  IdentidadeVisualAplicacao,
} from "@/lib/api/contratos-construtor";

/**
 * Capa e textos de abertura do ciclo de uma avaliação.
 *
 * A rota é da avaliação embora as RPCs trabalhem por `application_id`: a
 * tradução acontece no servidor para que a estrutura inteira do formulário —
 * lida só para extrair esse identificador — não trafegue até o navegador.
 */

/** Resolve o ciclo vigente da avaliação, que é por onde as RPCs de capa operam. */
async function resolverAplicacao(
  banco: Awaited<ReturnType<typeof createServerRpcClient>>,
  surveyId: string,
) {
  const { data, error } = await banco.rpc("get_survey_builder", {
    target_survey_id: surveyId,
  });
  if (error) return { erro: error, construtor: null };
  return { erro: null, construtor: data as ConstrutorAvaliacao | null };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  const banco = await createServerRpcClient();
  const { erro, construtor } = await resolverAplicacao(banco, id);
  if (erro) return respostaDeErro(erro, "GET /api/avaliacoes/[id]/identidade-visual");

  const applicationId = construtor?.application?.id;
  if (!applicationId) {
    return NextResponse.json(
      { mensagem: "Esta avaliação ainda não tem ciclo configurado." },
      { status: 404 },
    );
  }

  const { data, error } = await banco.rpc("get_application_visual_settings", {
    target_application_id: applicationId,
  });

  if (error) return respostaDeErro(error, "GET /api/avaliacoes/[id]/identidade-visual");

  return NextResponse.json(data as IdentidadeVisualAplicacao);
}

/** Campo de texto opcional: string vazia e ausência valem o mesmo para a RPC. */
function textoOpcional(valor: unknown) {
  return typeof valor === "string" && valor.trim() ? valor.trim() : null;
}

/**
 * Grava a identidade visual do ciclo.
 *
 * O corpo descreve a capa **inteira**: a RPC substitui os seis campos de uma
 * vez e, em `INSTITUTIONAL`, zera os três de banner.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!ehUuid(id)) {
    return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  }

  let corpo: IdentidadeVisual;
  try {
    corpo = await request.json() as IdentidadeVisual;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (corpo.themeVariant !== "INSTITUTIONAL" && corpo.themeVariant !== "CUSTOM") {
    return respostaDeEntradaInvalida("Modo visual inválido.");
  }

  const banco = await createServerRpcClient();
  const { erro, construtor } = await resolverAplicacao(banco, id);
  if (erro) return respostaDeErro(erro, "PUT /api/avaliacoes/[id]/identidade-visual");

  const applicationId = construtor?.application?.id;
  if (!applicationId) {
    return NextResponse.json(
      { mensagem: "Esta avaliação ainda não tem ciclo configurado." },
      { status: 404 },
    );
  }

  const { data, error } = await banco.rpc("update_application_visual_settings", {
    target_application_id: applicationId,
    banner_url: textoOpcional(corpo.bannerUrl),
    banner_path: textoOpcional(corpo.bannerPath),
    banner_alt: textoOpcional(corpo.bannerAlt),
    hero_title: textoOpcional(corpo.heroTitle),
    hero_subtitle: textoOpcional(corpo.heroSubtitle),
    theme_variant: corpo.themeVariant,
  });

  if (error) return respostaDeErro(error, "PUT /api/avaliacoes/[id]/identidade-visual");

  return NextResponse.json(data);
}
