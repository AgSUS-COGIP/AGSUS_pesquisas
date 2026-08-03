import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  return NextResponse.json(
    {
      status: configured ? "ok" : "degraded",
      service: "agsus-pesquisas",
      timestamp: new Date().toISOString(),
      checks: {
        supabasePublicConfiguration: configured,
      },
    },
    {
      status: configured ? 200 : 503,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
