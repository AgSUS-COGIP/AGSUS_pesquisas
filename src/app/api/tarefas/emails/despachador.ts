import nodemailer from "nodemailer";
import { createAdminSupabaseClient, getAdminSupabaseConfigurationStatus } from "@/lib/supabase/admin";
import { EMAIL_SENDER, SMTP_CONFIG, smtpCredentials } from "@/config/email";
import {
  PARTICIPANT_EMAIL_KINDS,
  participantEmailContent,
  surveyResponseUrl,
  type ParticipantEmailKind,
} from "@/lib/participant-emails";

/**
 * Despacho dos e-mails automáticos aos participantes.
 *
 * Quem decide o que enviar é o banco: `fc_reivindicar_emails()`
 * aplica as regras de negócio (ciclo aberto, opção ligada, participante
 * elegível, janela de 24 horas) e reivindica cada envio com a chave única de
 * `tl_email_participante` — rodar este despacho quantas vezes for não duplica
 * mensagem. Aqui fica só o que não pode acontecer no banco: montar o e-mail e
 * falar com o servidor SMTP.
 *
 * O envio é por SMTP do Google Workspace institucional (ver
 * `@/config/email`), não por um provedor transacional de terceiro — decisão
 * deliberada para não depender de conta externa nova.
 *
 * Uma falha individual não interrompe o restante: o desfecho de cada envio é
 * registrado por `fc_concluir_email_participante`, e o que falhou volta à
 * fila na próxima execução, enquanto a janela do tipo continuar válida.
 */

type PendingEmail = {
  id: string;
  applicationId: string;
  personId: string;
  kind: ParticipantEmailKind;
  personName: string;
  personEmail: string;
  applicationName: string;
  applicationCode: string;
  surveyCode: string;
  closesAt: string | null;
};

export type ParticipantEmailDispatchResult =
  | { status: "skipped"; missingConfiguration: string[] }
  | { status: "ok"; claimed: number; sent: number; failed: number };

export function participantEmailMissingConfiguration(): string[] {
  const missing = [...getAdminSupabaseConfigurationStatus().missingVariables];
  if (!smtpCredentials().pass) missing.push("SMTP_APP_PASSWORD");
  if (!process.env.NEXT_PUBLIC_SITE_URL) missing.push("NEXT_PUBLIC_SITE_URL");
  return missing;
}

function isPendingEmail(value: unknown): value is PendingEmail {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    typeof row.personEmail === "string" &&
    typeof row.personName === "string" &&
    typeof row.applicationName === "string" &&
    typeof row.applicationCode === "string" &&
    typeof row.surveyCode === "string" &&
    PARTICIPANT_EMAIL_KINDS.includes(row.kind as ParticipantEmailKind)
  );
}

// Uma conexão SMTP autenticada por despacho, reaproveitada entre os envios do
// mesmo lote — abrir e autenticar uma conexão por participante seria lento e
// desnecessário para uma caixa de e-mail só.
let cachedTransport: ReturnType<typeof nodemailer.createTransport> | null = null;
function transport() {
  if (cachedTransport) return cachedTransport;
  cachedTransport = nodemailer.createTransport({
    host: SMTP_CONFIG.host,
    port: SMTP_CONFIG.port,
    secure: SMTP_CONFIG.secure,
    auth: smtpCredentials(),
  });
  return cachedTransport;
}

async function sendViaSmtp(to: string, subject: string, html: string, text: string) {
  await transport().sendMail({
    from: `"${EMAIL_SENDER.name}" <${EMAIL_SENDER.address}>`,
    to,
    subject,
    html,
    text,
  });
}

export async function dispatchParticipantEmails(): Promise<ParticipantEmailDispatchResult> {
  const missingConfiguration = participantEmailMissingConfiguration();
  if (missingConfiguration.length) {
    return { status: "skipped", missingConfiguration };
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase.rpc("fc_reivindicar_emails");
  if (error) {
    throw new Error(`Não foi possível reivindicar os e-mails pendentes: ${error.message}`);
  }

  const pending = (Array.isArray(data) ? data : []).filter(isPendingEmail);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL as string;
  let sent = 0;
  let failed = 0;

  for (const email of pending) {
    try {
      const url = surveyResponseUrl(siteUrl, email);
      const content = participantEmailContent(email, url);
      await sendViaSmtp(email.personEmail, content.subject, content.html, content.text);
      const { error: completeError } = await supabase.rpc("fc_concluir_email_participante", {
        target_email_id: email.id,
        target_success: true,
      });
      // Enviado mas não registrado: o pior desfecho possível, porque a
      // recuperação reenviaria. Fica gritado no log do servidor.
      if (completeError) {
        console.error("[emails] envio registrou falha ao concluir", email.id, completeError.message);
      }
      sent += 1;
    } catch (sendError) {
      failed += 1;
      const message = sendError instanceof Error ? sendError.message : "Falha desconhecida no envio.";
      console.error(`[emails] falha ao enviar ${email.kind} para a pessoa ${email.personId}:`, message);
      const { error: completeError } = await supabase.rpc("fc_concluir_email_participante", {
        target_email_id: email.id,
        target_success: false,
        target_error: message,
      });
      if (completeError) {
        console.error("[emails] falha ao registrar o erro de envio", email.id, completeError.message);
      }
    }
  }

  return { status: "ok", claimed: pending.length, sent, failed };
}
