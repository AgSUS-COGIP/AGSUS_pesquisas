import { NextResponse } from "next/server";
import {
  CorpoJsonExcedidoError,
  CorpoJsonInvalidoError,
  lerJsonLimitado,
} from "@/lib/api/corpo-json-limitado";
import { normalizeErrorReference } from "@/lib/observability-reference";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { publicRateLimitResponse } from "@/lib/public-rate-limit";

const ALLOWED_TYPES = new Set(["CLIENTE", "SERVIDOR", "REDE", "BANCO", "DESCONHECIDO"]);
const MAX_REPORT_BYTES = 16_384;

// Requisição sem `Origin` é aceita de propósito: `fetch(keepalive)` disparado
// durante o descarregamento da página pode omitir o header. O rate limit abaixo
// cobre também clientes sem Origin para que esta compatibilidade não vire uma
// porta de spam contra a tabela de observabilidade.
function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return new URL(origin).host === new URL(request.url).host;
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== "string") return "";
  return value
    .slice(0, maxLength)
    .replace(/[\w.+-]{1,64}@[\w-]{1,255}(?:\.[\w-]{1,63}){1,10}/gi, "[email removido]")
    .replace(/\b\d{5,20}\b/g, "[numero removido]")
    .replace(/Bearer\s+[A-Za-z0-9._~-]{1,2048}/gi, "Bearer [token removido]");
}

function cleanContext(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .slice(0, 12)
      .map(([key, item]) => {
        const cleanKey = cleanText(key, 60);
        if (["string", "number", "boolean"].includes(typeof item) || item === null) {
          return [cleanKey, typeof item === "string" ? cleanText(item, 200) : item];
        }
        return [cleanKey, "[valor removido]"];
      }),
  );
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  }

  const limitResponse = await publicRateLimitResponse(request, {
    scope: "observability-error",
    limit: 120,
    windowSeconds: 300,
  });
  if (limitResponse) return limitResponse;

  try {
    const payload = await lerJsonLimitado<Record<string, unknown>>(request, MAX_REPORT_BYTES);
    const reference = normalizeErrorReference(payload.reference);
    const tipoRecebido = cleanText(payload.type, 40).toUpperCase();
    const httpStatus = typeof payload.httpStatus === "number" ? payload.httpStatus : null;

    if (!reference) {
      return NextResponse.json({ error: "Relatório inválido." }, { status: 400 });
    }

    const route = cleanText(payload.route, 200) || "(rota não informada)";
    const message = cleanText(payload.message, 1000) || "(erro sem mensagem)";
    const type = ALLOWED_TYPES.has(tipoRecebido) ? tipoRecebido : "DESCONHECIDO";

    const environment = process.env.VERCEL_ENV === "production"
      ? "PRODUCAO"
      : process.env.VERCEL_ENV === "preview"
        ? "HOMOLOGACAO"
        : "DESENVOLVIMENTO";

    const supabase = createAdminSupabaseClient();
    const { error } = await supabase.from("tl_erro_aplicacao").upsert({
      co_referencia: reference,
      no_rota: route,
      tp_erro: type,
      ds_mensagem: message,
      ds_contexto: cleanContext(payload.context),
      st_ambiente: environment,
      nu_http_status: httpStatus,
    }, { onConflict: "co_referencia", ignoreDuplicates: true });

    if (error) {
      console.error("Falha ao registrar observabilidade", error.message);
      return NextResponse.json({ error: "Falha ao registrar relatório." }, { status: 503 });
    }

    return NextResponse.json({ reference }, { status: 202 });
  } catch (error) {
    if (error instanceof CorpoJsonExcedidoError) {
      return NextResponse.json({ error: "Relatório excede o limite permitido." }, { status: 413 });
    }
    if (error instanceof CorpoJsonInvalidoError) {
      return NextResponse.json({ error: "Relatório inválido." }, { status: 400 });
    }

    console.error("Relatório de observabilidade inválido", error);
    return NextResponse.json({ error: "Relatório inválido." }, { status: 400 });
  }
}
