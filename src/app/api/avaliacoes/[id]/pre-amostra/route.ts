import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import { ehUuid } from "@/lib/api/validacao";
import type { EstadoPreAmostra } from "@/lib/api/contratos-construtor";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_obter_pre_amostra", { target_survey_id: id });
  if (error) return respostaDeErro(error, "GET /api/avaliacoes/[id]/pre-amostra");
  return NextResponse.json(data as EstadoPreAmostra, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  let body: { mode?: unknown; size?: unknown; participantIds?: unknown };
  try { body = await request.json() as typeof body; } catch { return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido."); }
  const mode = typeof body.mode === "string" ? body.mode.toUpperCase() : "";
  if (mode !== "RANDOM" && mode !== "MANUAL") return respostaDeEntradaInvalida("Escolha seleção aleatória simples ou manual.");
  if (mode === "RANDOM" && (!Number.isInteger(body.size) || Number(body.size) < 3)) return respostaDeEntradaInvalida("Informe uma pré-amostra com ao menos 3 participantes.");
  const participantIds = Array.isArray(body.participantIds) ? body.participantIds : [];
  if (mode === "MANUAL" && (participantIds.length < 3 || !participantIds.every(ehUuid))) return respostaDeEntradaInvalida("Selecione ao menos 3 participantes válidos.");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_configurar_pre_amostra", {
    target_survey_id: id,
    target_mode: mode,
    target_size: mode === "RANDOM" ? Number(body.size) : null,
    target_participant_ids: mode === "MANUAL" ? participantIds : null,
  });
  if (error) return respostaDeErro(error, "PUT /api/avaliacoes/[id]/pre-amostra");
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ehUuid(id)) return respostaDeEntradaInvalida("Identificador de avaliação inválido.");
  let body: { action?: unknown };
  try { body = await request.json() as { action?: unknown }; } catch { return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido."); }
  const action = typeof body.action === "string" ? body.action.toUpperCase() : "";
  const rpc = action === "OPEN" ? "fc_abrir_pre_amostra" : action === "RELEASE_POPULATION" ? "fc_publicar_populacao" : null;
  if (!rpc) return respostaDeEntradaInvalida("Operação de pré-amostra inválida.");
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc(rpc, { target_survey_id: id });
  if (error) return respostaDeErro(error, "POST /api/avaliacoes/[id]/pre-amostra");
  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
