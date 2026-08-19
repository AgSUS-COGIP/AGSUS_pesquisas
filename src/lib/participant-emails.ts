import { surveyApplicationHref } from "./survey-catalog";

/**
 * Conteúdo dos e-mails automáticos aos participantes de um ciclo.
 *
 * Funções puras: recebem o payload que `fc_reivindicar_emails`
 * devolve e produzem assunto, HTML e texto. Quem envia é o despachador da
 * rota de tarefa — este módulo não conhece rede nem banco, e por isso é
 * testável como o resto de `src/lib`.
 *
 * Os dois tipos espelham os valores aceitos por `ck_email_participante_tipo`
 * no banco; um terceiro tipo exige migration antes de existir aqui.
 */

export const PARTICIPANT_EMAIL_KINDS = ["research_opened", "research_expiring_24h"] as const;
export type ParticipantEmailKind = (typeof PARTICIPANT_EMAIL_KINDS)[number];

export type ParticipantEmailPayload = {
  kind: ParticipantEmailKind;
  personName: string;
  applicationName: string;
  applicationCode: string;
  surveyCode: string;
  closesAt: string | null;
};

export type ParticipantEmailContent = {
  subject: string;
  html: string;
  text: string;
};

/** Barra institucional das cinco cores — marca, não cor de interface. */
const BRAND_BAR_COLORS = ["#003b70", "#0b8f58", "#f2b705", "#d92d3a", "#00a8d6"];

function deadlineLabel(closesAt: string | null) {
  if (!closesAt) return null;
  const date = new Date(closesAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(date);
}

/** Link absoluto de resposta — a mesma regra de roteamento do catálogo. */
export function surveyResponseUrl(siteUrl: string, payload: Pick<ParticipantEmailPayload, "surveyCode" | "applicationCode">) {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}${surveyApplicationHref(payload)}`;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * E-mail é HTML de 2005: estilos inline, tabela nenhuma dispensável e nada de
 * CSS externo — clientes de e-mail não carregam folha de estilo.
 */
function layout(title: string, bodyHtml: string) {
  const bar = BRAND_BAR_COLORS
    .map((color) => `<td style="height:6px;background-color:${color};"></td>`)
    .join("");
  return `<!doctype html>
<html lang="pt-BR">
  <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background-color:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${bar}</tr></table></td></tr>
          <tr><td style="padding:32px;">
            <h1 style="margin:0 0 16px;font-size:20px;line-height:28px;color:#003b70;">${title}</h1>
            ${bodyHtml}
            <p style="margin:24px 0 0;font-size:12px;line-height:18px;color:#64748b;">
              Este é um aviso automático da plataforma de pesquisas e avaliações da AgSUS. O acesso é feito com a sua conta institucional.
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

function actionButton(url: string) {
  return `<p style="margin:24px 0;">
    <a href="${url}" style="display:inline-block;background-color:#003b70;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 24px;border-radius:8px;">Responder agora</a>
  </p>
  <p style="margin:0 0 8px;font-size:12px;line-height:18px;color:#64748b;">Se o botão não funcionar, copie e cole este endereço no navegador:<br />${url}</p>`;
}

export function participantEmailContent(payload: ParticipantEmailPayload, responseUrl: string): ParticipantEmailContent {
  const name = escapeHtml(payload.personName);
  const application = escapeHtml(payload.applicationName);
  const deadline = deadlineLabel(payload.closesAt);

  if (payload.kind === "research_expiring_24h") {
    const subject = `Últimas 24 horas para responder: ${payload.applicationName}`;
    const deadlineHtml = deadline
      ? `<p style="margin:0 0 8px;font-size:14px;line-height:22px;">O prazo termina em <strong>${escapeHtml(deadline)}</strong>.</p>`
      : "";
    const html = layout(
      "O prazo está acabando",
      `<p style="margin:0 0 8px;font-size:14px;line-height:22px;">Olá, ${name}.</p>
       <p style="margin:0 0 8px;font-size:14px;line-height:22px;">A avaliação <strong>${application}</strong> será encerrada em aproximadamente 24 horas e a sua resposta ainda não foi registrada.</p>
       ${deadlineHtml}
       ${actionButton(responseUrl)}`,
    );
    const text = [
      `Olá, ${payload.personName}.`,
      "",
      `A avaliação "${payload.applicationName}" será encerrada em aproximadamente 24 horas e a sua resposta ainda não foi registrada.`,
      deadline ? `O prazo termina em ${deadline}.` : null,
      "",
      `Responda em: ${responseUrl}`,
    ].filter((line): line is string => line !== null).join("\n");
    return { subject, html, text };
  }

  const subject = `Avaliação aberta para resposta: ${payload.applicationName}`;
  const deadlineHtml = deadline
    ? `<p style="margin:0 0 8px;font-size:14px;line-height:22px;">Você pode responder até <strong>${escapeHtml(deadline)}</strong>.</p>`
    : "";
  const html = layout(
    "Sua participação começa agora",
    `<p style="margin:0 0 8px;font-size:14px;line-height:22px;">Olá, ${name}.</p>
     <p style="margin:0 0 8px;font-size:14px;line-height:22px;">A avaliação <strong>${application}</strong> está aberta e você está entre as pessoas convidadas a respondê-la.</p>
     ${deadlineHtml}
     ${actionButton(responseUrl)}`,
  );
  const text = [
    `Olá, ${payload.personName}.`,
    "",
    `A avaliação "${payload.applicationName}" está aberta e você está entre as pessoas convidadas a respondê-la.`,
    deadline ? `Você pode responder até ${deadline}.` : null,
    "",
    `Responda em: ${responseUrl}`,
  ].filter((line): line is string => line !== null).join("\n");
  return { subject, html, text };
}
