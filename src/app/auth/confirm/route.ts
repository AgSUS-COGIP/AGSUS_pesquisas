import { NextRequest, NextResponse } from "next/server";
import { pkceExchangeOptions, safeAuthNext } from "@/lib/auth-callback";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const ALLOWED_DOMAIN = "agenciasus.org.br";

function redirectToAccess(url: URL, errorCode: string, next?: string) {
  const destination = new URL("/acesso", url.origin);
  destination.searchParams.set("erro", errorCode);
  if (next) destination.searchParams.set("next", next);
  return NextResponse.redirect(destination);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeAuthNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");

  if (!code) {
    return redirectToAccess(url, "oauth-invalido", next);
  }

  const supabase = await createServerSupabaseClient();
  const flowId = url.searchParams.get("sb_flow_id");
  const { error } = await supabase.auth.exchangeCodeForSession(
    code,
    pkceExchangeOptions(flowId),
  );

  if (error) {
    return redirectToAccess(url, "oauth-invalido", next);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const email = userData.user?.email?.trim().toLowerCase() ?? "";
  const domain = email.split("@")[1] ?? "";

  if (userError || domain !== ALLOWED_DOMAIN) {
    await supabase.auth.signOut();
    return redirectToAccess(url, "dominio-nao-autorizado");
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
