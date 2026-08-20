import { NextResponse } from "next/server";
import { getEmailConfigurationStatus } from "@/config/email";
import { getAdminSupabaseConfigurationStatus } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const publicConfigured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim(),
  );
  const adminConfiguration = getAdminSupabaseConfigurationStatus();
  const emailConfiguration = getEmailConfigurationStatus();
  const cronConfigured = Boolean(process.env.CRON_SECRET?.trim());
  const configured = publicConfigured && adminConfiguration.configured && emailConfiguration.configured && cronConfigured;
  const missingConfiguration = [
    ...(!publicConfigured ? ["NEXT_PUBLIC_SUPABASE_URL ou NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"] : []),
    ...adminConfiguration.missingVariables,
    ...emailConfiguration.missingVariables,
    ...(!cronConfigured ? ["CRON_SECRET"] : []),
  ];

  return NextResponse.json(
    {
      status: configured ? "ok" : "degraded",
      service: "agsus-pesquisas",
      timestamp: new Date().toISOString(),
      checks: {
        supabasePublicConfiguration: publicConfigured,
        supabaseAdminConfiguration: adminConfiguration.configured,
        emailDispatchConfiguration: emailConfiguration.configured,
        emailCronConfiguration: cronConfigured,
      },
      missingConfiguration,
    },
    {
      status: configured ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
