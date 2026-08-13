import { PLATFORM_MODULE, type PlatformModule } from "./platform-modules";

/** Canal institucional de suporte da plataforma. */
export const PLATFORM_SUPPORT_EMAIL = "dados.recursoshumanos@agenciasus.org.br";

const SUPPORT_SUBJECT = "Suporte — AgSUS Avaliações";

/**
 * Link de e-mail para o canal de suporte, com assunto já preenchido.
 *
 * `mailto:` entrega a mensagem ao cliente de e-mail padrão do computador — não
 * há envio pela plataforma, portanto nenhum dado do usuário trafega aqui.
 */
export function supportMailtoHref(subject: string = SUPPORT_SUBJECT) {
  return `mailto:${PLATFORM_SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}`;
}

/**
 * Link de composição no Gmail.
 *
 * `mailto:` entrega a mensagem ao cliente de e-mail **padrão do sistema** — no
 * Windows, o Outlook —, e a AgSUS usa Gmail: quem clicava caía num programa que
 * não usa. Este link abre a janela de composição do Gmail no navegador, com
 * destinatário e assunto preenchidos.
 *
 * Continua sendo só um link: nenhuma mensagem passa pela plataforma.
 */
export function gmailComposeHref(subject: string = SUPPORT_SUBJECT) {
  const params = new URLSearchParams({
    view: "cm",
    fs: "1",
    to: PLATFORM_SUPPORT_EMAIL,
    su: subject,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

/**
 * Módulos exclusivos do Superadmin — administração global.
 *
 * Espelha a exclusão feita em `ADMIN_ROLE_MODULES` (`platform-modules.ts`): são
 * os três módulos que o Admin nunca recebe.
 */
export const SUPER_ADMIN_ONLY_MODULES = Object.freeze([
  PLATFORM_MODULE.ADMIN_TEAMS,
  PLATFORM_MODULE.ADMIN_ACCESS,
  PLATFORM_MODULE.ADMIN_IMPORT,
]) as readonly PlatformModule[];

/**
 * Rotas atendidas pelos módulos exclusivos do Superadmin.
 *
 * O rodapé de suporte não aparece nelas: são telas de administração global,
 * operadas por quem já é o canal de suporte.
 */
const SUPER_ADMIN_ONLY_ROUTES = Object.freeze([
  "/admin/equipes",
  "/admin/acessos",
  "/admin/configuracoes",
  "/admin/importacao",
]);

/**
 * Indica se a rota pertence à administração global (exclusiva do Superadmin).
 *
 * Compara por prefixo de segmento para cobrir subrotas (`/admin/equipes/…`) sem
 * casar com prefixo parcial de outra rota.
 */
export function isSuperAdminOnlyRoute(pathname: string) {
  return SUPER_ADMIN_ONLY_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}
