import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const DEFAULT_ALLOWED_DOMAINS = ["agenciasus.org.br", "agsus.org.br"];

function allowedDomains() {
  const configured = process.env.ALLOWED_INSTITUTIONAL_DOMAINS;
  if (!configured) return DEFAULT_ALLOWED_DOMAINS;

  const domains = configured
    .split(",")
    .map((domain) => domain.trim().toLowerCase())
    .filter(Boolean);

  return domains.length ? domains : DEFAULT_ALLOWED_DOMAINS;
}

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/area";
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");
  const supabase = await createServerSupabaseClient();

  if (!code) {
    const destination = new URL("/acesso", url.origin);
    destination.searchParams.set("erro", "oauth-invalido");
    return NextResponse.redirect(destination);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const destination = new URL("/acesso", url.origin);
    destination.searchParams.set("erro", "oauth-invalido");
    return NextResponse.redirect(destination);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const email = userData.user?.email?.trim().toLowerCase() ?? "";
  const domain = email.split("@")[1] ?? "";

  if (userError || !allowedDomains().includes(domain)) {
    await supabase.auth.signOut();
    const destination = new URL("/acesso", url.origin);
    destination.searchParams.set("erro", "dominio-nao-autorizado");
    return NextResponse.redirect(destination);
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
