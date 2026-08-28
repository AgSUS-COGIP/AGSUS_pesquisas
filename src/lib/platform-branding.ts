export type PlatformBranding = {
  organizationName: string;
  productName: string;
  /**
   * O que a sigla do produto significa, por extenso.
   *
   * Sigla sozinha só comunica para quem já a conhece, e a tela de acesso é o
   * primeiro contato de quem chega — no celular ela é a única identificação do
   * sistema, porque a arte não é exibida ali.
   *
   * Configurável desde `20260817160000`, pela coluna `ds_produto`. Nulo no
   * banco cai no padrão abaixo — o texto nunca fica vazio na tela.
   */
  productDescription: string;
  /**
   * Saudação e instrução da tela de acesso.
   *
   * Ficavam soltas no JSX. Agora saem de `tb_config_plataforma`, com o mesmo
   * contrato dos demais textos: vazio no banco significa "usar o padrão", e não
   * "deixar em branco" — a tela de entrada não pode ficar sem título.
   */
  accessGreeting: string;
  accessInstruction: string;
  /**
   * Instrução de acesso e assinatura do e-mail aos participantes.
   *
   * Diferente dos textos da tela de acesso, estes **não** recebem padrão aqui:
   * string vazia significa "não configurado", e quem aplica o padrão é
   * `participantEmailContent()` no momento do envio. O motivo é evitar duas
   * cópias do mesmo texto — se o padrão morasse também neste arquivo, uma
   * alteração num lugar deixaria o outro mentindo, e o lugar que mente seria
   * justamente a prévia da tela de configuração.
   */
  emailInstruction: string;
  emailFooter: string;
  /**
   * Cor de fundo da barra lateral.
   *
   * Nula mantém a cor institucional definida no CSS. Diferente de
   * `accessPanelColor`, ela **não** deriva contraste: a barra lateral já é
   * escura por construção e seu texto é claro, então cor clara demais ali
   * quebraria a legibilidade sem que nada avisasse. A tela de configuração
   * mostra o contraste e recusa combinação ilegível.
   */
  sidebarColor: string | null;
  logoUrl: string;
  logoPath: string | null;
  /**
   * Arte de fundo da tela de acesso.
   *
   * Diferente do logotipo, **é** configurável: acompanha campanha institucional
   * e muda várias vezes por ano. Nulo devolve a arte institucional padrão.
   */
  accessBackgroundUrl: string | null;
  accessBackgroundPath: string | null;
  /**
   * Cor do painel do formulário de acesso. Nulo mantém o branco institucional.
   *
   * O contraste do texto e do botão **não** é configurado junto: é derivado
   * desta cor por `needsLightForeground()`. Cor livre com contraste manual
   * produziria tela ilegível na primeira combinação infeliz.
   */
  accessPanelColor: string | null;
  /** Liga o canal e define os perfis que podem participar e visualizar. */
  onlinePresenceEnabled: boolean;
  onlinePresenceViewerRoles: string[];
  /** Comunicado institucional opcional exibido no topo da página inicial. */
  homeAnnouncementEnabled: boolean;
  homeAnnouncementTitle: string;
  homeAnnouncementMessage: string;
  homeAnnouncementLink: string | null;
  homeAnnouncementLinkLabel: string;
  primaryColor: string;
  updatedAt: string | null;
};

// A versão invalida favicons e imagens institucionais que navegadores mantêm em
// cache por muito tempo, mesmo depois de o arquivo oficial ser atualizado.
export const OFFICIAL_PLATFORM_LOGO_URL = "/agsus-logo.png?v=20260825";

export const DEFAULT_PLATFORM_BRANDING: PlatformBranding = {
  organizationName: "AgSUS",
  productName: "SIGAV",
  productDescription: "Sistema Integrado de Gestão de Avaliações",
  accessGreeting: "Seja bem-vindo(a) à AgSUS",
  accessInstruction: "Acesse com sua conta institucional.",
  emailInstruction: "",
  emailFooter: "",
  sidebarColor: null,
  logoUrl: OFFICIAL_PLATFORM_LOGO_URL,
  logoPath: null,
  accessBackgroundUrl: null,
  accessBackgroundPath: null,
  accessPanelColor: null,
  onlinePresenceEnabled: true,
  onlinePresenceViewerRoles: ["ADMINISTRATOR", "SURVEY_MANAGER"],
  homeAnnouncementEnabled: false,
  homeAnnouncementTitle: "",
  homeAnnouncementMessage: "",
  homeAnnouncementLink: null,
  homeAnnouncementLinkLabel: "Saiba mais",
  primaryColor: "#0b4f82",
  updatedAt: null,
};

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

function text(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

export function normalizePlatformBranding(value: unknown): PlatformBranding {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const primaryColor = typeof source.primaryColor === "string" && HEX_COLOR.test(source.primaryColor.trim())
    ? source.primaryColor.trim().toLowerCase()
    : DEFAULT_PLATFORM_BRANDING.primaryColor;

  return {
    organizationName: text(source.organizationName, DEFAULT_PLATFORM_BRANDING.organizationName).slice(0, 60),
    productName: text(source.productName, DEFAULT_PLATFORM_BRANDING.productName).slice(0, 60),
    // Os três textos seguem a mesma regra: vazio ou ausente cai no padrão, e o
    // corte acompanha o limite que a RPC já cobra. A tela de entrada nunca fica
    // sem título por causa de um campo em branco no banco.
    productDescription: text(source.productDescription, DEFAULT_PLATFORM_BRANDING.productDescription).slice(0, 120),
    accessGreeting: text(source.accessGreeting, DEFAULT_PLATFORM_BRANDING.accessGreeting).slice(0, 80),
    accessInstruction: text(source.accessInstruction, DEFAULT_PLATFORM_BRANDING.accessInstruction).slice(0, 120),
    // Vazio permanece vazio, de propósito: aqui "não configurado" é um estado
    // real, e o padrão é aplicado no envio. Ver o comentário do tipo acima.
    emailInstruction: text(source.emailInstruction, "").slice(0, 400),
    emailFooter: text(source.emailFooter, "").slice(0, 400),
    // Cor malformada vira nula e a barra lateral mantém a cor institucional do
    // CSS — mesmo tratamento de `accessPanelColor`.
    sidebarColor: typeof source.sidebarColor === "string" && HEX_COLOR.test(source.sidebarColor)
      ? source.sidebarColor
      : null,
    // O logotipo é identidade institucional fixa: uploads antigos gravados no
    // banco são ignorados de propósito, para a marca oficial nunca ser
    // sobrescrita pela configuração.
    logoUrl: DEFAULT_PLATFORM_BRANDING.logoUrl,
    logoPath: null,
    // HTTPS absoluto ou caminho da própria aplicação. O HTTPS continua aceito
    // porque as artes enviadas ao bucket foram gravadas com a URL pública do
    // banco e seguem valendo enquanto não forem reenviadas; nada em HTTP
    // entra, para não haver conteúdo misto nem troca da arte em trânsito.
    // `/api/arquivos/...` é a origem nova, e sendo relativa herda o esquema da
    // página. Valor inválido degrada para nulo e a arte padrão volta a valer.
    accessBackgroundUrl: typeof source.accessBackgroundUrl === "string"
      && (source.accessBackgroundUrl.startsWith("https://")
        || source.accessBackgroundUrl.startsWith("/api/arquivos/"))
      ? source.accessBackgroundUrl
      : null,
    accessBackgroundPath: typeof source.accessBackgroundPath === "string" ? source.accessBackgroundPath : null,
    // Cor malformada vira nulo, não branco forçado: o painel volta ao padrão
    // institucional em vez de herdar uma cor que ninguém escolheu.
    accessPanelColor: typeof source.accessPanelColor === "string" && HEX_COLOR.test(source.accessPanelColor)
      ? source.accessPanelColor
      : null,
    onlinePresenceEnabled: typeof source.onlinePresenceEnabled === "boolean"
      ? source.onlinePresenceEnabled
      : DEFAULT_PLATFORM_BRANDING.onlinePresenceEnabled,
    onlinePresenceViewerRoles: Array.isArray(source.onlinePresenceViewerRoles)
      ? source.onlinePresenceViewerRoles.filter((role): role is string => typeof role === "string")
      : DEFAULT_PLATFORM_BRANDING.onlinePresenceViewerRoles,
    homeAnnouncementEnabled: source.homeAnnouncementEnabled === true,
    homeAnnouncementTitle: text(source.homeAnnouncementTitle, "").slice(0, 120),
    homeAnnouncementMessage: text(source.homeAnnouncementMessage, "").slice(0, 400),
    homeAnnouncementLink: safeAnnouncementLink(source.homeAnnouncementLink),
    homeAnnouncementLinkLabel: text(
      source.homeAnnouncementLinkLabel,
      DEFAULT_PLATFORM_BRANDING.homeAnnouncementLinkLabel,
    ).slice(0, 60),
    primaryColor,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
  };
}

function safeAnnouncementLink(value: unknown) {
  if (typeof value !== "string") return null;
  const link = value.trim();
  if (/^https:\/\/\S+$/i.test(link)) return link;
  if (/^\/(?!\/)\S+$/.test(link)) return link;
  return null;
}

export function platformBrandingTitle(branding: PlatformBranding) {
  return `${branding.organizationName} ${branding.productName}`.trim();
}
