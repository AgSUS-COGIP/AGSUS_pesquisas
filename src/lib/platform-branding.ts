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
   * **Não vem do banco, e é dívida conhecida.** `productName` é configurável e
   * esta linha não, então trocar a sigla em `/admin/configuracoes` deixa a
   * expansão desatualizada. Levá-la para `tb_config_plataforma` exige um
   * parâmetro novo em `fc_atualizar_marca_plataforma`, o que cria sobrecarga e
   * pede a ordem de publicação descrita no CLAUDE.md da raiz.
   */
  productDescription: string;
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
  primaryColor: string;
  updatedAt: string | null;
};

export const DEFAULT_PLATFORM_BRANDING: PlatformBranding = {
  organizationName: "AgSUS",
  productName: "SIGAV",
  productDescription: "Sistema Integrado de Gestão de Avaliações",
  logoUrl: "/agsus-logo.png",
  logoPath: null,
  accessBackgroundUrl: null,
  accessBackgroundPath: null,
  accessPanelColor: null,
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
    // A expansão ainda não existe no banco; `source` nunca a traz. Passa pelo
    // normalizador mesmo assim para que o dia em que a coluna existir não exija
    // caçar o ponto onde ela deveria ter entrado.
    productDescription: text(source.productDescription, DEFAULT_PLATFORM_BRANDING.productDescription).slice(0, 120),
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
    primaryColor,
    updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : null,
  };
}

export function platformBrandingTitle(branding: PlatformBranding) {
  return `${branding.organizationName} ${branding.productName}`.trim();
}
