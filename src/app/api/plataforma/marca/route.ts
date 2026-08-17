import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import type { AtualizarMarcaEntrada } from "@/lib/api/contratos-pessoas";

/**
 * Marca institucional da plataforma.
 *
 * Alimenta `PlatformBrandingProvider`, montado em toda página. Sem sessão o
 * middleware devolve 401 antes de a rota executar e o provider degrada para
 * `DEFAULT_PLATFORM_BRANDING` — sem prejuízo, porque a única tela anônima
 * (`/acesso`) é Server Component e lê a marca com cliente próprio.
 */
export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("fc_obter_marca_plataforma");

  if (error) return respostaDeErro(error, "GET /api/plataforma/marca");

  return NextResponse.json(data);
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
