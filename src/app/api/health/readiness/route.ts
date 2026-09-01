import { NextResponse } from "next/server";
import { verificarProntidao } from "@/lib/readiness";

export const dynamic = "force-dynamic";

/** Readiness pública sem expor detalhes internos de configuração ou do banco. */
export async function GET() {
  const cabecalhos = {
    "Cache-Control": "no-store, max-age=0",
    "X-Content-Type-Options": "nosniff",
  };

  const prontidao = await verificarProntidao();
  if (prontidao.estado !== "pronta") {
    console.warn("[readiness] degradado:", prontidao.estado, prontidao.detalhe);
    return NextResponse.json({ status: "degraded" }, { status: 503, headers: cabecalhos });
  }

  return NextResponse.json({ status: "ready" }, { status: 200, headers: cabecalhos });
}
