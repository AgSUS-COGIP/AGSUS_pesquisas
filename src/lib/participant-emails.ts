import { surveyApplicationHref } from "./survey-catalog";

/**
 * Conteúdo dos e-mails automáticos aos participantes de um ciclo.
 *
 * Funções puras: recebem o payload que `fc_reivindicar_emails`
 * devolve e produzem assunto, HTML e texto. Quem envia é o despachador da
 * rota de tarefa — este módulo não conhece rede nem banco, e por isso é
 * testável como o resto de `src/lib`.
 *
 * Os três tipos espelham os valores aceitos por `ck_email_participante_tipo`
 * no banco; um quarto tipo exige migration antes de existir aqui.
 *
 * `manual_reminder` é o único disparado por alguém, e não pelo relógio: a
 * central de e-mails enfileira um por pessoa escolhida. Ele não tem janela de
 * tempo própria e pode se repetir — por isso o índice único do banco é parcial
 * e não o alcança.
 *
 * ## De onde vem cada texto
 *
 * O conteúdo tem três origens, e nenhuma delas é este arquivo por acaso:
 *
 * - **Nome, prazo e link** — do ciclo, automático.
 * - **`surveyDescription`** — `surveys.description`, editada no construtor.
 *   Explica o que a avaliação é. Não existe campo próprio de e-mail para isso:
 *   duplicar a frase daria dois lugares para configurar e a certeza de
 *   divergirem.
 * - **`emailInstruction` e `emailFooter`** — institucionais, configurados em
 *   /admin/configuracoes (`20260820120000`). Repetem-se em todo ciclo.
 *
 * Todos os campos configuráveis são opcionais no payload: ausentes, caem nos
 * padrões abaixo. **Nenhum e-mail sai sem instrução de acesso nem sem
 * assinatura** — configuração em branco degrada para o texto do código, jamais
 * para vazio.
 */

export const PARTICIPANT_EMAIL_KINDS = ["research_opened", "research_expiring_24h", "manual_reminder"] as const;
export type ParticipantEmailKind = (typeof PARTICIPANT_EMAIL_KINDS)[number];

export type ParticipantEmailPayload = {
  kind: ParticipantEmailKind;
  personName: string;
  applicationName: string;
  applicationCode: string;
  surveyCode: string;
  closesAt: string | null;
  /** Textos configuráveis. Ausentes ou vazios caem nos padrões deste arquivo. */
  surveyDescription?: string | null;
  organizationName?: string | null;
  productName?: string | null;
  emailInstruction?: string | null;
  emailFooter?: string | null;
};

export type ParticipantEmailContent = {
  subject: string;
  html: string;
  text: string;
};

/** Barra institucional das cinco cores — marca, não cor de interface. */
const BRAND_BAR_COLORS = ["#003b70", "#0b8f58", "#f2b705", "#d92d3a", "#00a8d6"];

const DEFAULT_ORGANIZATION = "AgSUS";
const DEFAULT_PRODUCT = "SIGAV";

/**
 * A instrução de acesso é o texto que mais muda o resultado do e-mail.
 *
 * Quem recebe não sabe que existe uma plataforma, e a barreira concreta não é
 * falta de vontade: é não saber que a entrada é a própria conta do trabalho,
 * sem cadastro e sem senha nova. Dizer isso explicitamente é o que separa um
 * link ignorado de um acesso.
 */
export const DEFAULT_PARTICIPANT_EMAIL_INSTRUCTION =
  "Para entrar, use a sua conta institucional do Google — a mesma do seu e-mail @agenciasus.org.br. Não é preciso criar cadastro nem senha.";

/**
 * Exportados para a tela de configuração usar como texto de exemplo no campo
 * vazio. Ela **não** reimplementa o layout: a prévia chama
 * `participantEmailContent()` com os valores do formulário, então o que o
 * operador vê é literalmente o que será enviado, inclusive nos padrões.
 */
export function defaultParticipantEmailFooter(organization: string, product: string) {
  return `Este é um aviso automático do ${product}, sistema de pesquisas e avaliações da ${organization}. Você recebeu esta mensagem porque está vinculado(a) a esta avaliação.`;
}

/** Texto configurável em branco significa "usar o padrão", nunca "deixar vazio". */
function textOr(value: string | null | undefined, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function optionalText(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

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

/** Cabeçalho SMTP não pode herdar quebras de linha de texto administrável. */
function emailSubject(prefix: string, applicationName: string) {
  const normalizedName = applicationName.replace(/[\r\n]+/g, " ").trim();
  return `${prefix}: ${normalizedName}`;
}

/**
 * E-mail é HTML de 2005: estilos inline, tabela nenhuma dispensável e nada de
 * CSS externo — clientes de e-mail não carregam folha de estilo.
 *
 * A tarja com "PRODUTO · ORGANIZAÇÃO" abre o corpo de propósito: é a primeira
 * coisa visível na pré-visualização da caixa de entrada, e é o que faz a
 * mensagem ser reconhecida como institucional antes de ser aberta.
 */
function layout(eyebrow: string, title: string, bodyHtml: string, footer: string) {
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
            <p style="margin:0 0 4px;font-size:12px;line-height:18px;letter-spacing:1px;text-transform:uppercase;color:#64748b;">${escapeHtml(eyebrow)}</p>
            <h1 style="margin:0 0 16px;font-size:20px;line-height:28px;color:#003b70;">${title}</h1>
            ${bodyHtml}
            <p style="margin:24px 0 0;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;line-height:18px;color:#64748b;">
              ${escapeHtml(footer)}
            </p>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/** Bloco destacado com a explicação da avaliação, quando o ciclo tem uma. */
function aboutBlock(description: string) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;">
    <tr><td style="background-color:#f8fafc;border-left:4px solid #003b70;padding:12px 16px;">
      <p style="margin:0 0 4px;font-size:12px;line-height:18px;font-weight:bold;color:#003b70;">Sobre esta avaliação</p>
      <p style="margin:0;font-size:14px;line-height:22px;color:#334155;">${escapeHtml(description)}</p>
    </td></tr>
  </table>`;
}

/** Como acessar. Fica logo acima do botão — é a dúvida imediatamente anterior a clicar. */
function instructionBlock(instruction: string) {
  return `<p style="margin:16px 0 0;font-size:14px;line-height:22px;">${escapeHtml(instruction)}</p>`;
}

function actionButton(url: string) {
  const safeUrl = escapeHtml(url);
  return `<p style="margin:24px 0;">
    <a href="${safeUrl}" style="display:inline-block;background-color:#003b70;color:#ffffff;text-decoration:none;font-weight:bold;font-size:14px;padding:12px 24px;border-radius:8px;">Responder agora</a>
  </p>
  <p style="margin:0 0 8px;font-size:12px;line-height:18px;color:#64748b;">Se o botão não funcionar, copie e cole este endereço no navegador:<br />${safeUrl}</p>`;
}

export function participantEmailContent(payload: ParticipantEmailPayload, responseUrl: string): ParticipantEmailContent {
  const name = escapeHtml(payload.personName);
  const application = escapeHtml(payload.applicationName);
  const deadline = deadlineLabel(payload.closesAt);

  const organization = textOr(payload.organizationName, DEFAULT_ORGANIZATION);
  const product = textOr(payload.productName, DEFAULT_PRODUCT);
  const instruction = textOr(payload.emailInstruction, DEFAULT_PARTICIPANT_EMAIL_INSTRUCTION);
  const footer = textOr(payload.emailFooter, defaultParticipantEmailFooter(organization, product));
  const about = optionalText(payload.surveyDescription);
  const eyebrow = `${product} · ${organization}`;

  if (payload.kind === "research_expiring_24h") {
    const subject = emailSubject("Últimas 24 horas para responder", payload.applicationName);
    const deadlineHtml = deadline
      ? `<p style="margin:0 0 8px;font-size:14px;line-height:22px;">O prazo termina em <strong>${escapeHtml(deadline)}</strong>.</p>`
      : "";
    // O lembrete não repete a descrição da avaliação: aqui o assunto é o
    // prazo, e o texto precisa caber numa leitura de dez segundos. A instrução
    // de acesso fica, porque quem ainda não respondeu é justamente quem pode
    // não ter descoberto como entrar.
    const html = layout(
      eyebrow,
      "O prazo está acabando",
      `<p style="margin:0 0 8px;font-size:14px;line-height:22px;">Olá, ${name}.</p>
       <p style="margin:0 0 8px;font-size:14px;line-height:22px;">A avaliação <strong>${application}</strong> será encerrada em aproximadamente 24 horas e a sua resposta ainda não foi registrada.</p>
       ${deadlineHtml}
       ${instructionBlock(instruction)}
       ${actionButton(responseUrl)}`,
      footer,
    );
    const text = [
      `${product} · ${organization}`,
      "",
      `Olá, ${payload.personName}.`,
      "",
      `A avaliação "${payload.applicationName}" será encerrada em aproximadamente 24 horas e a sua resposta ainda não foi registrada.`,
      deadline ? `O prazo termina em ${deadline}.` : null,
      "",
      instruction,
      "",
      `Responda em: ${responseUrl}`,
      "",
      footer,
    ].filter((line): line is string => line !== null).join("\n");
    return { subject, html, text };
  }

  if (payload.kind === "manual_reminder") {
    // O lembrete dirigido é enviado por alguém que olhou a lista e viu que esta
    // pessoa não respondeu. Ele repete o contexto inteiro — descrição, prazo e
    // como acessar — porque não há garantia de que ela tenha aberto, ou sequer
    // recebido, o e-mail de abertura.
    const subject = `Lembrete: ${payload.applicationName} está aberta para resposta`;
    const deadlineHtml = deadline
      ? `<p style="margin:0 0 8px;font-size:14px;line-height:22px;">O prazo vai até <strong>${escapeHtml(deadline)}</strong>.</p>`
      : "";
    const html = layout(
      eyebrow,
      "A sua resposta ainda é esperada",
      `<p style="margin:0 0 8px;font-size:14px;line-height:22px;">Olá, ${name}.</p>
       <p style="margin:0 0 8px;font-size:14px;line-height:22px;">A avaliação <strong>${application}</strong> está aberta e a sua resposta ainda não foi registrada.</p>
       ${about ? aboutBlock(about) : ""}
       ${deadlineHtml}
       ${instructionBlock(instruction)}
       ${actionButton(responseUrl)}`,
      footer,
    );
    const text = [
      `${product} · ${organization}`,
      "",
      `Olá, ${payload.personName}.`,
      "",
      `A avaliação "${payload.applicationName}" está aberta e a sua resposta ainda não foi registrada.`,
      about ? "" : null,
      about ? `Sobre esta avaliação: ${about}` : null,
      "",
      deadline ? `O prazo vai até ${deadline}.` : null,
      deadline ? "" : null,
      instruction,
      "",
      `Responda em: ${responseUrl}`,
      "",
      footer,
    ].filter((line): line is string => line !== null).join("\n");
    return { subject, html, text };
  }

  const subject = emailSubject("Avaliação aberta para resposta", payload.applicationName);
  const deadlineHtml = deadline
    ? `<p style="margin:0 0 8px;font-size:14px;line-height:22px;">Você pode responder até <strong>${escapeHtml(deadline)}</strong>.</p>`
    : "";
  const html = layout(
    eyebrow,
    "Sua participação começa agora",
    `<p style="margin:0 0 8px;font-size:14px;line-height:22px;">Olá, ${name}.</p>
     <p style="margin:0 0 8px;font-size:14px;line-height:22px;">A avaliação <strong>${application}</strong> está aberta e você está entre as pessoas convidadas a respondê-la.</p>
     ${about ? aboutBlock(about) : ""}
     ${deadlineHtml}
     ${instructionBlock(instruction)}
     ${actionButton(responseUrl)}`,
    footer,
  );
  const text = [
    `${product} · ${organization}`,
    "",
    `Olá, ${payload.personName}.`,
    "",
    `A avaliação "${payload.applicationName}" está aberta e você está entre as pessoas convidadas a respondê-la.`,
    about ? "" : null,
    about ? `Sobre esta avaliação: ${about}` : null,
    "",
    deadline ? `Você pode responder até ${deadline}.` : null,
    deadline ? "" : null,
    instruction,
    "",
    `Responda em: ${responseUrl}`,
    "",
    footer,
  ].filter((line): line is string => line !== null).join("\n");
  return { subject, html, text };
}
