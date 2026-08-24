import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness: o processo está de pé e servindo.
 *
 * ## Por que deixou de checar configuração
 *
 * Antes esta rota respondia `503` quando faltava alguma variável — e isso
 * confunde as duas perguntas que um monitor faz. "Está viva?" e "está pronta
 * para receber tráfego?" têm respostas e consequências diferentes: um
 * orquestrador **reinicia** o que não está vivo, e apenas **tira do balanço** o
 * que não está pronto. Devolver 503 por variável ausente pedia reinício para um
 * problema que reinício não resolve.
 *
 * Pior: com todas as variáveis presentes ela respondia `ok` mesmo com o banco
 * incompatível — que é exatamente o estado que produziu `PGRST202` em produção
 * duas vezes. O check dizia "ok" enquanto a plataforma quebrava.
 *
 * A pergunta de prontidão passou para `/api/health/readiness`, que fala com o
 * banco. Esta aqui não toca em rede: se o processo consegue responder, está
 * viva, e é só isso que ela afirma.
 */
export function GET() {
  return NextResponse.json(
    { status: "ok", service: "agsus-pesquisas" },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
