import { NextResponse } from "next/server";
import { getAdminSupabaseConfigurationStatus } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const publicConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
  const adminConfiguration = getAdminSupabaseConfigurationStatus();
  const configured = publicConfigured && adminConfiguration.configured;

  return NextResponse.json(
    {
      status: configured ? "ok" : "degraded",
      service: "agsus-pesquisas",
      timestamp: new Date().toISOString(),
      checks: {
        supabasePublicConfiguration: publicConfigured,
        supabaseAdminConfiguration: adminConfiguration.configured,
      },
      missingConfiguration: adminConfiguration.missingVariables,
    },
    {
      status: configured ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
