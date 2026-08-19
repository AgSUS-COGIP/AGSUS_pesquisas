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
  primaryColor: string;
  updatedAt: string | null;
};

export const DEFAULT_PLATFORM_BRANDING: PlatformBranding = {
  organizationName: "AgSUS",
  productName: "SIGAV",
  productDescription: "Sistema Integrado de Gestão de Avaliações",
  accessGreeting: "Seja bem-vindo(a) à AgSUS",
  accessInstruction: "Acesse com sua conta institucional.",
  sidebarColor: null,
  logoUrl: "/agsus-logo.png",
  logoPath: null,
  accessBackgroundUrl: null,
  accessBackgroundPath: null,
  accessPanelColor: null,
  onlinePresenceEnabled: true,
  onlinePresenceViewerRoles: ["ADMINISTRATOR", "SURVEY_MANAGER"],
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
    // Só HTTPS: a tela de acesso é servida por HTTPS, e imagem em HTTP daria
    // conteúdo misto além de permitir troca da arte em trânsito. Valor inválido
    // degrada para nulo, e a arte institucional padrão volta a valer.
    accessBackgroundUrl: typeof source.accessBackgroundUrl === "string" && source.accessBackgroundUrl.startsWith("https://")
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
    primaryColor,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
  };
}

export function platformBrandingTitle(branding: PlatformBranding) {
  return `${branding.organizationName} ${branding.productName}`.trim();
}
