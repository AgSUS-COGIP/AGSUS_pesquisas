import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeFalha } from "@/lib/api/resposta-http";
import { dispatchParticipantEmails } from "@/app/api/tarefas/emails/despachador";

export const dynamic = "force-dynamic";

/**
 * Processa **um lote** da fila de e-mails, sob a sessão de quem opera.
 *
 * Por que existe, se já há a rota de cron
 * A rota de cron se defende por `CRON_SECRET` e roda uma vez por dia. Volume
 * não cabe nisso: o SMTP é sequencial e mil mensagens não terminam dentro de
 * uma invocação serverless. Aqui a central de e-mails chama em sequência e
 * mostra o progresso — cada chamada é curta, a fila é retomável, e quem opera
 * vê a conta andar em vez de esperar no escuro.
 *
 * Por que a guarda é explícita
 * As rotas de domínio delegam autorização à RPC que chamam. Esta não chama RPC
 * de domínio: ela aciona o despachador, que usa **service role** e ignora RLS.
 * Sem a checagem abaixo, qualquer sessão autenticada dispararia e-mail
 * institucional para mil pessoas. `canManageSurveys` vem de
 * `fc_obter_contexto_plataforma()`, o mesmo contrato que governa a navegação —
 * e é avaliado pelo banco, sob a sessão de quem chamou, não por um `if` sobre
 * dado vindo do cliente.
 */
export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: contexto, error: contextoError } = await supabase.rpc("fc_obter_contexto_plataforma");

  if (contextoError) {
    console.error("POST /api/plataforma/emails/despachar:", contextoError.message);
    return respostaDeFalha(500, "Não foi possível verificar a sua permissão.");
  }

  const podeGerenciar = Boolean(
    contexto && typeof contexto === "object" && (contexto as Record<string, unknown>).canManageSurveys,
  );
  if (!podeGerenciar) {
    return respostaDeFalha(403, "Acesso restrito à administração de avaliações.");
  }

  try {
    const resultado = await dispatchParticipantEmails();
    return NextResponse.json(resultado, {
      status: resultado.status === "skipped" ? 503 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (dispatchError) {
    console.error("POST /api/plataforma/emails/despachar:", dispatchError);
    return respostaDeFalha(500, "Falha ao processar a fila de e-mails.");
  }
}
