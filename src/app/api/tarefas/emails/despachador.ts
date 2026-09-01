import nodemailer from "nodemailer";
import { createAdminRpcClient } from "@/lib/db/rpc-adapter";
import { getEmpresaDbConfigurationStatus } from "@/lib/db/pool";
import {
  EMAIL_SENDER,
  SMTP_CONFIG,
  getEmailConfigurationStatus,
  participantSiteUrl,
  smtpCredentials,
} from "@/config/email";
import {
  PARTICIPANT_EMAIL_KINDS,
  participantEmailContent,
  surveyResponseUrl,
  type ParticipantEmailKind,
} from "@/lib/participant-emails";

/**
 * Despacho dos e-mails automáticos aos participantes.
 *
 * Quem decide o que enviar é o banco: `fc_srv_reivindicar_emails()`
 * aplica as regras de negócio (ciclo aberto, opção ligada, participante
 * elegível, janela de 24 horas) e entrega um lote com token exclusivo. A chave
 * única impede criar o mesmo aviso duas vezes; o token impede duas execuções
 * de processarem a mesma linha ao mesmo tempo. Aqui ficam a composição e o
 * transporte SMTP.
 *
 * O envio é por SMTP do Google Workspace institucional (ver
 * `@/config/email`), não por um provedor transacional de terceiro — decisão
 * deliberada para não depender de conta externa nova.
 *
 * Uma falha individual não interrompe o restante: o desfecho de cada envio é
 * registrado por `FC_SRV_CONCLUIR_EMAIL`, e o que falhou volta à fila na
 * próxima execução, enquanto a janela do tipo continuar válida.
 */

type PendingEmail = {
  id: string;
  /** Ausente somente enquanto o frontend novo convive com a migration antiga. */
  claimToken?: string;
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
  | { status: "ok"; batches: number; claimed: number; sent: number; failed: number };

// O limite total mantém a execução abaixo do teto da função serverless sem
// deixar ciclos institucionais grandes presos a uma única execução do cron.
// O tamanho de cada lote pertence ao banco e não é repetido aqui.
const MAX_BATCHES_PER_DISPATCH = 20;
const SMTP_CONCURRENCY = 5;
const SMTP_MAX_MESSAGES_PER_CONNECTION = 100;
const DISPATCH_TIME_BUDGET_MS = 4 * 60_000;

export function participantEmailMissingConfiguration(): string[] {
  return [
    ...getEmpresaDbConfigurationStatus().missingVariables,
    ...getEmailConfigurationStatus().missingVariables,
  ];
}

function isPendingEmail(value: unknown): value is PendingEmail {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    (row.claimToken === undefined || typeof row.claimToken === "string") &&
    typeof row.applicationId === "string" &&
    typeof row.personId === "string" &&
    typeof row.personEmail === "string" &&
    typeof row.personName === "string" &&
    typeof row.applicationName === "string" &&
    typeof row.applicationCode === "string" &&
    typeof row.surveyCode === "string" &&
    (row.closesAt === null || typeof row.closesAt === "string") &&
    PARTICIPANT_EMAIL_KINDS.includes(row.kind as ParticipantEmailKind)
  );
}

function createSmtpTransport() {
  return nodemailer.createTransport({
    host: SMTP_CONFIG.host,
    port: SMTP_CONFIG.port,
    secure: SMTP_CONFIG.secure,
    auth: smtpCredentials(),
    pool: true,
    maxConnections: SMTP_CONCURRENCY,
    maxMessages: SMTP_MAX_MESSAGES_PER_CONNECTION,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });
}

type SmtpTransport = ReturnType<typeof createSmtpTransport>;

/**
 * Identificador determinístico da mensagem, derivado do id da linha.
 *
 * Determinístico é o ponto: se a mesma linha for despachada duas vezes, as duas
 * mensagens carregam o **mesmo** `Message-ID`, e servidores de e-mail
 * costumam descartar a repetição. É a única proteção contra duplicata que
 * continua valendo depois que a mensagem saiu daqui — dentro do banco a
 * proteção é o identificador gravado antes do envio.
 *
 * O domínio vem do remetente institucional, como manda a RFC 5322.
 */
function messageIdDe(emailId: string) {
  const dominio = EMAIL_SENDER.address.split("@")[1] ?? "agenciasus.org.br";
  return `<envio-${emailId}@${dominio}>`;
}

async function sendViaSmtp(
  smtp: SmtpTransport,
  to: string,
  subject: string,
  html: string,
  text: string,
  messageId: string,
) {
  await smtp.sendMail({
    from: `"${EMAIL_SENDER.name}" <${EMAIL_SENDER.address}>`,
    to,
    subject,
    html,
    text,
    messageId,
  });
}

async function forEachWithConcurrency<T>(
  items: readonly T[],
  concurrency: number,
  task: (item: T) => Promise<void>,
) {
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const item = items[nextIndex];
      nextIndex += 1;
      await task(item);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );
}

export async function dispatchParticipantEmails(): Promise<ParticipantEmailDispatchResult> {
  const missingConfiguration = participantEmailMissingConfiguration();
  if (missingConfiguration.length) {
    return { status: "skipped", missingConfiguration };
  }

  const banco = createAdminRpcClient();
  const siteUrl = participantSiteUrl()!;
  const smtp = createSmtpTransport();
  const startedAt = Date.now();
  let batches = 0;
  let claimed = 0;
  let sent = 0;
  let failed = 0;

  async function completeEmail(
    email: PendingEmail,
    success: boolean,
    errorMessage?: string,
  ) {
    // Compatibilidade de deploy: a migration do token deve entrar antes do
    // frontend, mas a assinatura anterior permanece funcional durante essa
    // janela. Depois da migration, todo payload traz claimToken e usa a
    // confirmação protegida contra execuções concorrentes.
    if (email.claimToken) {
      return banco.rpc("FC_SRV_CONCLUIR_EMAIL", {
        target_email_id: email.id,
        target_claim_token: email.claimToken,
        target_success: success,
        target_error: errorMessage,
      });
    }

    return banco.rpc("FC_SRV_CONCLUIR_EMAIL", {
      target_email_id: email.id,
      target_success: success,
      target_error: errorMessage,
    });
  }

  try {
    // Autentica antes de reivindicar a fila. Credencial inválida deixa os itens
    // pendentes, em vez de transformar todo o lote em falha individual.
    await smtp.verify();

    while (
      batches < MAX_BATCHES_PER_DISPATCH &&
      Date.now() - startedAt < DISPATCH_TIME_BUDGET_MS
    ) {
      const { data, error } = await banco.rpc("FC_SRV_REIVINDICAR_EMAILS");
      if (error) {
        throw new Error(`Não foi possível reivindicar os e-mails pendentes: ${error.message}`);
      }

      const rows = Array.isArray(data) ? data : [];
      const pending = rows.filter(isPendingEmail);
      if (pending.length !== rows.length) {
        throw new Error("A fila devolveu um payload de e-mail inválido.");
      }
      if (!pending.length) break;

      batches += 1;
      claimed += pending.length;

      await forEachWithConcurrency(pending, SMTP_CONCURRENCY, async (email) => {
        const url = surveyResponseUrl(siteUrl, email);
        const content = participantEmailContent(email, url);

        const messageId = messageIdDe(email.id);

        /*
          Carimba o identificador **antes** de enviar.

          É o que permite distinguir, depois, "o SMTP aceitou e a confirmação se
          perdeu" de "nunca chegou ao SMTP". Sem isso, a expiração do lease
          devolvia os dois casos para a fila e reenviava para quem já recebeu.

          `EXPIRADO` significa que o lease venceu entre reivindicar e enviar:
          outra execução já pode ter assumido esta linha, então enviar agora
          duplicaria. Aborta sem marcar falha — a linha segue seu curso normal.
        */
        if (email.claimToken) {
          const { data: transporte, error: erroTransporte } = await banco.rpc(
            "FC_SRV_REGISTRAR_TRANSPORTE",
            {
              target_email_id: email.id,
              target_claim_token: email.claimToken,
              target_message_id: messageId,
            },
          );

          if (erroTransporte) {
            failed += 1;
            console.error("[emails] falha ao registrar transporte", email.id, erroTransporte.message);
            return;
          }

          if ((transporte as { status?: string } | null)?.status !== "OK") {
            console.warn("[emails] lease expirou antes do envio; abortando", email.id);
            return;
          }
        }

        try {
          await sendViaSmtp(smtp, email.personEmail, content.subject, content.html, content.text, messageId);
        } catch (sendError) {
          failed += 1;
          const message = sendError instanceof Error ? sendError.message : "Falha desconhecida no envio.";
          console.error(`[emails] falha ao enviar ${email.kind} para a pessoa ${email.personId}:`, message);
          const { error: completeError } = await completeEmail(email, false, message);
          if (completeError) {
            console.error("[emails] falha ao registrar o erro de envio", email.id, completeError.message);
          }
          return;
        }

        const { error: completeError } = await completeEmail(email, true);
        if (completeError) {
          failed += 1;
          console.error("[emails] mensagem enviada, mas a confirmação falhou", email.id, completeError.message);
          return;
        }
        sent += 1;
      });
    }
  } finally {
    smtp.close();
  }

  return { status: "ok", batches, claimed, sent, failed };
}
