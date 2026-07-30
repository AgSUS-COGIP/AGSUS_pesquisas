import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "agsus-pesquisas",
    timestamp: new Date().toISOString(),
  });
}
