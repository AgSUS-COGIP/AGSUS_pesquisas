import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro } from "@/lib/api/resposta-http";

export const dynamic = "force-dynamic";

/**
 * Batida de presença de quem chamou.
 *
 * Não recebe identificador de pessoa — a identidade vem da sessão, como em
 * `/api/meu/…`. Uma rota com parâmetro exigiria verificar que o parâmetro é o
 * próprio chamador, verificação que se esquece.
 *
 * Presença desligada na configuração devolve `DISABLED` com `200`, e não erro:
 * para o cliente que bate a cada 45 segundos, "o recurso está desligado" é
 * resposta normal, não falha a ser reportada.
 */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_registrar_presenca");

  if (error) return respostaDeErro(error, "POST /api/plataforma/presenca/batida");

  return NextResponse.json(data, { headers: { "Cache-Control": "no-store" } });
}
