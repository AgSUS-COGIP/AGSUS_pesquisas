import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

const ALLOWED_TYPES = new Set(["CLIENTE", "SERVIDOR", "REDE", "BANCO", "DESCONHECIDO"]);

// Requisição sem `Origin` é aceita de propósito: `fetch(keepalive)` disparado
// durante o descarregamento da página pode omitir o header, e é justamente esse
// relatório — o do erro que derrubou a navegação — que mais interessa.
function isSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  return new URL(origin).host === new URL(request.url).host;
}

// Sanitização repetida no servidor, embora o cliente já a aplique: a rota é
// pública para a mesma origem e não pode confiar no que recebe.
//
// Truncar antes das regex (e não depois) limita o custo ao `maxLength`
// declarado; os padrões evitam classes de caracteres que se sobrepõem para não
// sofrer backtracking catastrófico (ReDoS) em entradas adversariais.
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

/**
 * Registra um relatório técnico de erro em `tl_erro_aplicacao`.
 *
 * Responde `202` com a referência exibida ao usuário, para correlação com o
 * suporte. O `upsert` por `co_referencia` com `ignoreDuplicates` torna o envio
 * idempotente: o mesmo erro reportado por mais de um boundary grava uma só linha.
 */
export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: "Origem não autorizada." }, { status: 403 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 16_384) {
    return NextResponse.json({ error: "Relatório excede o limite permitido." }, { status: 413 });
  }

  try {
    const payload = await request.json() as Record<string, unknown>;
    const reference = cleanText(payload.reference, 80);
    const route = cleanText(payload.route, 200);
    const message = cleanText(payload.message, 1000);
    const type = cleanText(payload.type, 40).toUpperCase();
    const httpStatus = typeof payload.httpStatus === "number" ? payload.httpStatus : null;

    if (!reference || !route || !message || !ALLOWED_TYPES.has(type)) {
      return NextResponse.json({ error: "Relatório inválido." }, { status: 400 });
    }

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
    console.error("Relatório de observabilidade inválido", error);
    return NextResponse.json({ error: "Relatório inválido." }, { status: 400 });
  }
}
