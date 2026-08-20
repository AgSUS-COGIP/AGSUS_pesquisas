/**
 * Configuração do envio de e-mail via SMTP institucional (Google Workspace).
 *
 * Decisão deliberada, a pedido do time: em vez de um provedor transacional de
 * terceiro (que exigiria criar conta, verificar domínio e configurar chave de
 * API num painel externo), o envio usa a própria conta institucional do
 * Google Workspace da AgSUS — a mesma que já autentica o login da plataforma
 * (`@agenciasus.org.br`). Host, porta e remetente ficam fixos aqui, no
 * código, e não em variável de ambiente: são detalhes estruturais do SMTP do
 * Google, não segredo.
 *
 * A senha de aplicativo (`SMTP_APP_PASSWORD`) continua vindo de variável de
 * ambiente, e não deste arquivo. Diferente do host/porta/remetente, ela é uma
 * credencial de acesso real a uma caixa de e-mail em produção — colocá-la em
 * texto no código versionado significaria que qualquer pessoa com acesso ao
 * repositório (e o histórico do git, para sempre) passa a ter acesso de envio
 * pela conta institucional. Preencha o valor real em `.env` (nunca commitado).
 *
 * Pré-requisito na conta Google: verificação em duas etapas ativa e uma
 * "senha de app" gerada especificamente para isto (Conta Google → Segurança →
 * Verificação em duas etapas → Senhas de app). Login e senha normais da conta
 * não funcionam para SMTP quando a verificação em duas etapas está ativa.
 */

export const EMAIL_SENDER = {
  name: "AgSUS Pesquisas",
  address: "dados.recursoshumanos@agenciasus.org.br",
} as const;

export const SMTP_CONFIG = {
  host: "smtp.gmail.com",
  port: 465,
  /** Porta 465 é SSL implícito — nada de STARTTLS aqui. */
  secure: true,
} as const;

type Environment = Readonly<Record<string, string | undefined>>;

function configuredValue(environment: Environment, name: string) {
  const value = environment[name]?.trim();
  return value || undefined;
}

export function participantSiteUrl(environment: Environment = process.env) {
  const value = configuredValue(environment, "NEXT_PUBLIC_SITE_URL");
  if (!value) return undefined;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

/** Diagnóstico sem expor o valor da credencial nem a URL configurada. */
export function getEmailConfigurationStatus(environment: Environment = process.env) {
  const hasAppPassword = Boolean(configuredValue(environment, "SMTP_APP_PASSWORD"));
  const hasSiteUrl = Boolean(participantSiteUrl(environment));
  const missingVariables: string[] = [];

  if (!hasAppPassword) missingVariables.push("SMTP_APP_PASSWORD");
  if (!hasSiteUrl) missingVariables.push("NEXT_PUBLIC_SITE_URL");

  return {
    configured: hasAppPassword && hasSiteUrl,
    hasAppPassword,
    hasSiteUrl,
    missingVariables,
  };
}

/**
 * Credenciais de autenticação SMTP.
 *
 * `user` tem o remetente como padrão porque, na prática institucional, quem
 * autentica no SMTP é a mesma caixa que envia — mas fica configurável por
 * variável de ambiente para o dia em que isso deixar de valer (ex.: uma conta
 * de serviço dedicada ao envio, diferente do remetente exibido).
 */
export function smtpCredentials(environment: Environment = process.env) {
  // O Google exibe a senha de app em grupos separados por espaços. Removê-los
  // aqui evita uma falha de autenticação quando o valor é copiado como aparece
  // na tela; a credencial continua vindo exclusivamente do ambiente.
  const pass = configuredValue(environment, "SMTP_APP_PASSWORD")?.replace(/\s+/g, "");

  return {
    user: configuredValue(environment, "SMTP_USER") || EMAIL_SENDER.address,
    pass,
  };
}
