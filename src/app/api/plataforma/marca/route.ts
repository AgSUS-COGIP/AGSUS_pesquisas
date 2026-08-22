import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import type { AtualizarMarcaEntrada } from "@/lib/api/contratos-pessoas";

const COLUNAS_MARCA_PUBLICA = [
  "no_organizacao",
  "no_produto",
  "ds_produto",
  "tx_url_logotipo",
  "tx_caminho_logotipo",
  "co_cor_principal",
  "co_cor_barra_lateral",
  "tx_url_fundo_acesso",
  "tx_caminho_fundo_acesso",
  "co_cor_painel_acesso",
  "tx_saudacao_acesso",
  "tx_instrucao_acesso",
].join(",");

function marcaPublica(value: unknown) {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};

  return {
    organizationName: source.no_organizacao ?? null,
    productName: source.no_produto ?? null,
    productDescription: source.ds_produto ?? null,
    logoUrl: source.tx_url_logotipo ?? null,
    logoPath: source.tx_caminho_logotipo ?? null,
    primaryColor: source.co_cor_principal ?? null,
    sidebarColor: source.co_cor_barra_lateral ?? null,
    accessBackgroundUrl: source.tx_url_fundo_acesso ?? null,
    accessBackgroundPath: source.tx_caminho_fundo_acesso ?? null,
    accessPanelColor: source.co_cor_painel_acesso ?? null,
    accessGreeting: source.tx_saudacao_acesso ?? null,
    accessInstruction: source.tx_instrucao_acesso ?? null,
  };
}

/**
 * Marca institucional da plataforma.
 *
 * O GET precisa existir antes do login, mas a RPC completa tambem carrega
 * configuracoes operacionais de e-mail e presenca. Uma sessao autenticada
 * preserva o contrato completo usado pelas telas administrativas. Sem sessao
 * valida, a rota consulta apenas as colunas visuais pelo cliente interno do
 * servidor. Assim o rollout funciona antes e depois da migration que revoga a
 * RPC completa de `anon`, sem expor configuracoes operacionais no Data API.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims();
  const authenticated = Boolean(claimsData?.claims?.sub) && !claimsError;

  if (authenticated) {
    const { data, error } = await supabase.rpc("fc_obter_marca_plataforma");
    if (error) return respostaDeErro(error, "GET /api/plataforma/marca");
    return NextResponse.json(data);
  }

  const admin = createAdminSupabaseClient();
  const { data, error } = await admin
    .from("tb_config_plataforma")
    .select(COLUNAS_MARCA_PUBLICA)
    .eq("co_configuracao", 1)
    .maybeSingle();
  if (error) return respostaDeErro(error, "GET /api/plataforma/marca");

  return NextResponse.json(marcaPublica(data));
}

/**
 * Grava nomes institucionais e cor principal.
 *
 * `fc_atualizar_marca_plataforma` substitui a linha única inteira, e omitir um
 * campo o zeraria. O logotipo vai sempre nulo porque a marca é fixa — decisão
 * de produto mantida aqui para que nenhum chamador consiga sobrescrevê-la.
 */
export async function PUT(request: Request) {
  let corpo: AtualizarMarcaEntrada;
  try {
    corpo = await request.json() as AtualizarMarcaEntrada;
  } catch {
    return respostaDeEntradaInvalida("O corpo do pedido não é um JSON válido.");
  }

  const organizationName = typeof corpo.organizationName === "string" ? corpo.organizationName.trim() : "";
  const productName = typeof corpo.productName === "string" ? corpo.productName.trim() : "";
  const primaryColor = typeof corpo.primaryColor === "string" ? corpo.primaryColor.trim() : "";

  if (!organizationName || !productName || !primaryColor) {
    return respostaDeEntradaInvalida("Informe o nome da organização, o nome do sistema e a cor principal.");
  }

  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_atualizar_marca_plataforma", {
    no_organizacao_param: organizationName,
    no_produto_param: productName,
    tx_url_logotipo_param: null,
    tx_caminho_param: null,
    co_cor_principal_param: primaryColor,
  });

  if (error) return respostaDeErro(error, "PUT /api/plataforma/marca");

  return NextResponse.json(data);
}
