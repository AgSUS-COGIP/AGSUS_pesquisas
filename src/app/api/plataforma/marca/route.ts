import { NextResponse } from "next/server";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { respostaDeErro, respostaDeEntradaInvalida } from "@/lib/api/resposta-http";
import type { AtualizarMarcaEntrada } from "@/lib/api/contratos-pessoas";
import { normalizePlatformBranding } from "@/lib/platform-branding";

function marcaPublica(value: unknown) {
  const source = normalizePlatformBranding(value);

  return {
    organizationName: source.organizationName,
    productName: source.productName,
    productDescription: source.productDescription,
    logoUrl: source.logoUrl,
    logoPath: source.logoPath,
    primaryColor: source.primaryColor,
    sidebarColor: source.sidebarColor,
    accessBackgroundUrl: source.accessBackgroundUrl,
    accessBackgroundPath: source.accessBackgroundPath,
    accessPanelColor: source.accessPanelColor,
    accessGreeting: source.accessGreeting,
    accessInstruction: source.accessInstruction,
  };
}

/**
 * Marca institucional da plataforma.
 *
 * O GET precisa existir antes do login, mas a RPC completa tambem carrega
 * configuracoes operacionais de e-mail e presenca. Uma sessao autenticada
 * preserva o contrato completo usado pelas telas administrativas.
 *
 * Quando não há uma sessão válida, a consulta pública usa um cliente Supabase
 * separado e sem cookies. Reutilizar o cliente de sessão nesse ramo fazia um
 * cookie antigo ou inválido ser enviado ao PostgREST; a chamada então recebia
 * 401 antes mesmo de a ACL `anon` de `fc_obter_marca_publica` ser considerada.
 */
export async function GET() {
  const sessionSupabase = await createServerSupabaseClient();
  const { data: claimsData, error: claimsError } = await sessionSupabase.auth.getClaims();
  const authenticated = Boolean(claimsData?.claims?.sub) && !claimsError;

  if (authenticated) {
    const { data, error } = await sessionSupabase.rpc("fc_obter_marca_plataforma");
    if (error) return respostaDeErro(error, "GET /api/plataforma/marca");
    return NextResponse.json(normalizePlatformBranding(data));
  }

  const publicSupabase = createPublicSupabaseClient();
  const { data: publicData, error: publicError } = await publicSupabase.rpc("fc_obter_marca_publica");
  if (!publicError) return NextResponse.json(marcaPublica(publicData));

  // PGRST202 = a migration que cria a RPC nova ainda nao chegou ao banco.
  // Qualquer outro erro e real e nao deve ser mascarado pelo fallback.
  if (publicError.code !== "PGRST202") {
    return respostaDeErro(publicError, "GET /api/plataforma/marca");
  }

  // Compatibilidade de rollout apenas. O cliente continua anônimo e sem cookies:
  // se `anon` já tiver sido revogado da RPC completa, a resposta correta é erro,
  // não a reutilização silenciosa de um JWT inválido.
  const { data, error } = await publicSupabase.rpc("fc_obter_marca_plataforma");
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
