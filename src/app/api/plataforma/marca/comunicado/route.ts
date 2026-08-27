import { NextResponse } from "next/server";
import type { DefinirComunicadoInicioEntrada } from "@/lib/api/contratos-pessoas";
import { respostaDeEntradaInvalida, respostaDeErro } from "@/lib/api/resposta-http";
import { normalizePlatformBranding } from "@/lib/platform-branding";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const INTERNAL_OR_HTTPS_LINK = /^(?:https:\/\/\S+|\/(?!\/)\S+)$/i;

export async function PUT(request: Request) {
  let body: DefinirComunicadoInicioEntrada;
  try {
    body = await request.json() as DefinirComunicadoInicioEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  if (typeof body.ativo !== "boolean") {
    return respostaDeEntradaInvalida("Informe se o comunicado deve ficar ativo.");
  }

  const titulo = typeof body.titulo === "string" ? body.titulo.trim() : "";
  const mensagem = typeof body.mensagem === "string" ? body.mensagem.trim() : "";
  const link = typeof body.link === "string" && body.link.trim() ? body.link.trim() : null;
  const rotuloLink = typeof body.rotuloLink === "string" && body.rotuloLink.trim()
    ? body.rotuloLink.trim()
    : null;

  if (body.ativo && (!titulo || !mensagem)) {
    return respostaDeEntradaInvalida("Informe título e mensagem antes de ativar o comunicado.");
  }
  if (titulo.length > 120 || mensagem.length > 400 || (link?.length ?? 0) > 500 || (rotuloLink?.length ?? 0) > 60) {
    return respostaDeEntradaInvalida("Revise os limites de tamanho dos campos do comunicado.");
  }
  if (link && !INTERNAL_OR_HTTPS_LINK.test(link)) {
    return respostaDeEntradaInvalida("O link deve ser uma rota interna ou um endereço HTTPS.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_definir_comunicado_inicio", {
    p_ativo: body.ativo,
    p_titulo: titulo || null,
    p_mensagem: mensagem || null,
    p_link: link,
    p_rotulo_link: link ? rotuloLink : null,
  });

  if (error) return respostaDeErro(error, "PUT /api/plataforma/marca/comunicado");
  return NextResponse.json(normalizePlatformBranding(data));
}
