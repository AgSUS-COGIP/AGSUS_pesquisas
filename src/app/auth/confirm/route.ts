import { NextRequest, NextResponse } from "next/server";
import { pkceExchangeOptions, safeAuthNext } from "../../../lib/auth-callback";
import { createServerSupabaseClient } from "../../../lib/supabase/server";

const ALLOWED_DOMAIN = "agenciasus.org.br";

/**
 * Retorna a origem pública da aplicação.
 *
 * Em produção usa NEXT_PUBLIC_SITE_URL.
 * No desenvolvimento via ngrok, essa variável deve apontar
 * temporariamente para o domínio público do túnel.
 */
function getPublicOrigin(request: NextRequest) {
  const configuredOrigin = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredOrigin) {
    try {
      return new URL(configuredOrigin).origin;
    } catch {
      // Se a variável estiver inválida, usa a origem da requisição.
    }
  }

  return request.nextUrl.origin;
}

function redirectToAccess(
  origin: string,
  errorCode: string,
  next?: string,
) {
  const destination = new URL("/acesso", origin);

  destination.searchParams.set("erro", errorCode);

  if (next) {
    destination.searchParams.set("next", next);
  }

  return NextResponse.redirect(destination);
}

/**
 * Callback OAuth: troca o código de autorização por uma sessão
 * e valida o domínio institucional.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const origin = getPublicOrigin(request);

  const next = safeAuthNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");

  if (!code) {
    return redirectToAccess(origin, "oauth-invalido", next);
  }

  const supabase = await createServerSupabaseClient();

  const flowId = url.searchParams.get("sb_flow_id");

  const { data, error } = await supabase.auth.exchangeCodeForSession(
    code,
    pkceExchangeOptions(flowId),
  );

  if (error) {
    return redirectToAccess(origin, "oauth-invalido", next);
  }

  const email =
    data.user?.email?.trim().toLowerCase() ?? "";

  const domain = email.split("@")[1] ?? "";

  if (domain !== ALLOWED_DOMAIN) {
    await supabase.auth.signOut({ scope: "local" });

    return redirectToAccess(
      origin,
      "dominio-nao-autorizado",
    );
  }

  const destination = new URL(next, origin);

  destination.searchParams.set("entrando", "1");

  return NextResponse.redirect(destination);
}
