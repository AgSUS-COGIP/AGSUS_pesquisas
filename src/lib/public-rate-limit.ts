import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

type PublicRateLimitOptions = {
  scope: string;
  limit: number;
  windowSeconds: number;
  discriminator?: string;
};

type RateLimitPayload = {
  allowed?: boolean;
  remaining?: number;
  retryAfter?: number;
};

function firstForwardedAddress(value: string | null) {
  if (!value) return "";
  return value.split(",", 1)[0]?.trim().slice(0, 120) ?? "";
}

/**
 * Produz uma chave pseudonimizada para controle de abuso sem persistir o IP.
 *
 * Em Vercel, `x-vercel-forwarded-for` representa o IP público do cliente e não
 * depende de um eventual proxy colocado à frente do deployment. Mantemos
 * `x-forwarded-for` e `x-real-ip` como fallbacks para desenvolvimento/outros
 * ambientes. A ausência de todos cai em uma chave comum, ainda sujeita ao
 * limite e portanto fail-safe contra clientes sem identificação de rede.
 */
export function publicRequestKey(request: Request, discriminator = "") {
  const address =
    firstForwardedAddress(request.headers.get("x-vercel-forwarded-for")) ||
    firstForwardedAddress(request.headers.get("x-forwarded-for")) ||
    firstForwardedAddress(request.headers.get("x-real-ip")) ||
    "unknown";

  const normalizedDiscriminator = discriminator.trim().slice(0, 180);
  return createHash("sha256")
    .update(`${address}\n${normalizedDiscriminator}`)
    .digest("hex");
}

/**
 * Retorna uma resposta HTTP somente quando a requisição deve ser interrompida.
 *
 * O fallback PGRST202 existe apenas para rollout app-before-db: durante alguns
 * segundos a nova função pode ainda não constar no schema cache. Qualquer outro
 * erro do limitador falha fechado com 503; não ignoramos falha operacional.
 */
export async function publicRateLimitResponse(
  request: Request,
  options: PublicRateLimitOptions,
): Promise<NextResponse | null> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("fc_srv_consumir_limite_publico", {
    target_scope: options.scope,
    target_key_hash: publicRequestKey(request, options.discriminator),
    target_limit: options.limit,
    target_window_seconds: options.windowSeconds,
  });

  if (error) {
    if (error.code === "PGRST202") return null;
    console.error("Falha no rate limit público", error.message);
    return NextResponse.json(
      { mensagem: "Serviço temporariamente indisponível." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const payload = (data ?? {}) as RateLimitPayload;
  if (payload.allowed !== false) return null;

  const retryAfter = Number.isFinite(payload.retryAfter)
    ? Math.max(1, Math.trunc(payload.retryAfter ?? 1))
    : options.windowSeconds;

  return NextResponse.json(
    { mensagem: "Muitas solicitações. Aguarde um pouco e tente novamente." },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": String(retryAfter),
      },
    },
  );
}
