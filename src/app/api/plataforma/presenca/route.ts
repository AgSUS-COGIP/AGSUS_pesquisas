import { NextResponse } from "next/server";
import { respostaDeEntradaInvalida, respostaDeErro } from "@/lib/api/resposta-http";
import type { DefinirPresencaOnlineEntrada } from "@/lib/api/contratos-pessoas";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ALLOWED_ROLES = new Set(["ADMINISTRATOR", "SURVEY_MANAGER", "LEADER", "RESPONDENT"]);

export async function PUT(request: Request) {
  let body: DefinirPresencaOnlineEntrada;
  try {
    body = await request.json() as DefinirPresencaOnlineEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  const roles = Array.isArray(body.perfis)
    ? [...new Set(body.perfis.filter((role) => typeof role === "string" && ALLOWED_ROLES.has(role)))]
    : [];
  if (typeof body.ativa !== "boolean" || roles.length === 0) {
    return respostaDeEntradaInvalida("Informe o estado do recurso e selecione ao menos um perfil.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_definir_presenca_plataforma", {
    fl_ativa_param: body.ativa,
    tx_perfis_param: roles,
  });
  if (error) return respostaDeErro(error, "PUT /api/plataforma/presenca");
  return NextResponse.json(data);
}
