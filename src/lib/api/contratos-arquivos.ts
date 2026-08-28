/**
 * Contrato dos arquivos de imagem da plataforma.
 *
 * Os nomes dos baldes são os dos buckets que existiam no Storage do Supabase, e
 * continuam assim porque os caminhos gravados em configuração (`accessBackgroundPath`,
 * `settings.visualIdentity.bannerPath`) os referenciam. Renomeá-los exigiria
 * reescrever dados já gravados sem ganho nenhum.
 */

export const BALDES = ["platform-assets", "survey-assets"] as const;
export type Balde = (typeof BALDES)[number];

/**
 * SVG fica de fora de propósito. No bucket, servido de um domínio do Supabase,
 * um SVG malicioso não alcançava a aplicação; agora os bytes saem da própria
 * origem, e um `<script>` dentro do SVG rodaria no contexto autenticado.
 * O mesmo allowlist está na constraint `ck_tb_arquivo_tipo`.
 */
export const TIPOS_DE_IMAGEM = ["image/png", "image/jpeg", "image/webp"] as const;
export type TipoDeImagem = (typeof TIPOS_DE_IMAGEM)[number];

/** Teto do banco (`ck_tb_arquivo_tamanho`). As telas podem exigir menos. */
export const TAMANHO_MAXIMO_ARQUIVO = 5 * 1024 * 1024;

export type ArquivoGravado = {
  sqArquivo: string;
  balde: Balde;
  caminho: string;
  tamanho: number;
  url: string;
};

export type ArquivoListado = {
  caminho: string;
  tipo: string;
  tamanho: number;
  criado_em: string;
  url: string;
};
