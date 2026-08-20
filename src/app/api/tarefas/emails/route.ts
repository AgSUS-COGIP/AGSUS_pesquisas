import { NextResponse } from "next/server";
import { dispatchParticipantEmails } from "./despachador";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Tarefa agendada: despacha os e-mails automáticos aos participantes.
 *
 * Rota de infraestrutura, fora das regras das rotas de domínio: não há sessão
 * de usuário — quem chama é o cron da Vercel, que envia
 * `Authorization: Bearer ${CRON_SECRET}` quando a variável existe no projeto.
 * Por isso ela consta de PUBLIC_PATHS no middleware e se defende pelo
 * segredo: sem `CRON_SECRET` configurado a rota responde 503 e não faz nada;
 * com o segredo errado, 401.
 *
 * A janela de execução é tolerante por desenho. A fila separa execuções
 * concorrentes por token, portanto cron e disparo imediato podem se sobrepor
 * sem processar o mesmo lote ao mesmo tempo.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json(
      { status: "degraded", missingConfiguration: ["CRON_SECRET"] },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json(
      { error: "Não autorizado." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await dispatchParticipantEmails();
    return NextResponse.json(result, {
      status: result.status === "skipped" ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (dispatchError) {
    console.error("GET /api/tarefas/emails:", dispatchError);
    return NextResponse.json(
      { error: "Falha ao processar os e-mails pendentes." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
