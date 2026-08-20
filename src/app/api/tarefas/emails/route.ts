import { NextResponse } from "next/server";
import { dispatchParticipantEmails } from "./despachador";

export const dynamic = "force-dynamic";

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
 * A janela de execução é tolerante por desenho (ver a migration
 * 20260818130000): uma execução por dia já cai dentro de qualquer janela de
 * 24 horas, então a rota funciona em qualquer cadência de cron — e rodá-la
 * duas vezes não duplica envio.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
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
    // Drena o que couber no orçamento desta invocação, em vez de um lote só.
    //
    // O despacho passou a trabalhar em lotes curtos (ver `despachador.ts`), e
    // uma chamada única deixaria o cron entregando algumas dezenas de e-mails
    // por dia. O laço aqui aproveita a invocação inteira; o que sobrar fica
    // PROCESSANDO e volta amanhã.
    //
    // **O cron é a rede de segurança, não o caminho para volume.** Um ciclo com
    // mil participantes não se esgota numa invocação serverless, e a conta é do
    // SMTP sequencial, não deste laço. Volume se processa pela central de
    // e-mails, que chama o despacho em sequência mostrando o progresso.
    const startedAt = Date.now();
    let total = { claimed: 0, sent: 0, failed: 0 };
    let last = await dispatchParticipantEmails();
    if (last.status === "skipped") {
      return NextResponse.json(last, { status: 503, headers: { "Cache-Control": "no-store" } });
    }
    while (last.status === "ok") {
      total = {
        claimed: total.claimed + last.claimed,
        sent: total.sent + last.sent,
        failed: total.failed + last.failed,
      };
      if (!last.remaining || Date.now() - startedAt > 45_000) break;
      const next = await dispatchParticipantEmails();
      if (next.status !== "ok") break;
      last = next;
    }
    return NextResponse.json(
      { status: "ok", ...total, remaining: last.status === "ok" ? last.remaining : false },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (dispatchError) {
    console.error("GET /api/tarefas/emails:", dispatchError);
    return NextResponse.json(
      { error: "Falha ao processar os e-mails pendentes." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
