import { NextResponse } from "next/server";
import { getEmailConfigurationStatus } from "@/config/email";
import { getAdminSupabaseConfigurationStatus } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * Health check público deliberadamente mínimo.
 *
 * O endpoint precisa indicar disponibilidade para monitores externos, mas não
 * deve revelar quais integrações, credenciais ou variáveis estão ausentes. O
 * diagnóstico detalhado permanece nos logs e nas ferramentas operacionais.
 */
export async function GET() {
  const publicConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
  const adminConfigured = getAdminSupabaseConfigurationStatus().configured;
  const emailConfigured = getEmailConfigurationStatus().configured;
  const cronConfigured = Boolean(process.env.CRON_SECRET?.trim());
  const configured = publicConfigured && adminConfigured && emailConfigured && cronConfigured;

  return NextResponse.json(
    {
      status: configured ? "ok" : "degraded",
      service: "agsus-pesquisas",
    },
    {
      status: configured ? 200 : 503,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
