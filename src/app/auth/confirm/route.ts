import { NextRequest, NextResponse } from "next/server";
import { pkceExchangeOptions, safeAuthNext } from "@/lib/auth-callback";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// A restrição de domínio é reaplicada aqui porque o parâmetro `hd` enviado ao
// Google é uma sugestão de interface, não uma garantia: uma conta de outro domínio
// pode concluir o OAuth e precisa ser recusada no callback.
//
// A camada SQL valida contra a lista de `institutional_domains`
// (ALLOWED_INSTITUTIONAL_DOMAINS); esta constante é mais restritiva.
// Ver "Observações e Melhorias Sugeridas" no README.
const ALLOWED_DOMAIN = "agenciasus.org.br";

function redirectToAccess(url: URL, errorCode: string, next?: string) {
  const destination = new URL("/acesso", url.origin);
  destination.searchParams.set("erro", errorCode);
  if (next) destination.searchParams.set("next", next);
  return NextResponse.redirect(destination);
}

/**
 * Callback OAuth: troca o código de autorização por uma sessão e valida o domínio.
 *
 * Conta de domínio não autorizado é desconectada antes do redirecionamento, para
 * não deixar sessão parcial ativa. Todo erro volta para `/acesso` com um código em
 * `erro`, traduzido para mensagem legível pela própria tela de acesso.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeAuthNext(url.searchParams.get("next"));
  const code = url.searchParams.get("code");

  if (!code) {
    return redirectToAccess(url, "oauth-invalido", next);
  }

  const supabase = await createServerSupabaseClient();
  const flowId = url.searchParams.get("sb_flow_id");
  const { error } = await supabase.auth.exchangeCodeForSession(
    code,
    pkceExchangeOptions(flowId),
  );

  if (error) {
    return redirectToAccess(url, "oauth-invalido", next);
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  const email = userData.user?.email?.trim().toLowerCase() ?? "";
  const domain = email.split("@")[1] ?? "";

  if (userError || domain !== ALLOWED_DOMAIN) {
    await supabase.auth.signOut();
    return redirectToAccess(url, "dominio-nao-autorizado");
  }

  /*
   * `entrando=1` marca a primeira tela depois do login para que ela diga
   * "Entrando no sistema" em vez de "Carregando {tela}".
   *
   * Quem volta do Google não sabe se a autenticação deu certo: o contexto ainda
   * está sendo resolvido e o esqueleto genérico não distingue "entrando agora"
   * de "recarregando uma página". A marca vive só nesta navegação — a tela a
   * remove da URL assim que a lê.
   */
  const destination = new URL(next, url.origin);
  destination.searchParams.set("entrando", "1");
  return NextResponse.redirect(destination);
}
