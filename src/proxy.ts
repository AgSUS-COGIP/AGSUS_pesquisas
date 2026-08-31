import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { ehRotaSempreLiberada } from "@/lib/manutencao";
import { estadoParaDecisao } from "@/lib/manutencao-control-plane";
import { PLATFORM_ROLE } from "@/lib/platform-roles";
import { updateSession } from "@/lib/supabase/proxy";
import { SUPABASE_DB_SCHEMA } from "@/lib/supabase/schema";

/**
 * Durante manutenção global o proxy precisa tomar uma decisão que normalmente
 * pertence à aplicação: distinguir Superadmin de todo o restante.
 *
 * Fazer essa leitura em toda requisição normal anularia uma das vantagens do
 * gate no proxy. Por isso ela só acontece quando a bandeira global já está
 * ativa. Nesse estado, uma ida ao banco por requisição administrativa é um
 * custo deliberado para preservar o caminho de recuperação sem abrir a
 * plataforma para outras pessoas.
 */
async function ehSuperadminAutenticado(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return false;

  try {
    const supabase = createServerClient(url, publishableKey, {
      db: { schema: SUPABASE_DB_SCHEMA },
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // Esta leitura é só para decidir o bypass. Renovação e persistência de
        // sessão continuam centralizadas em `updateSession()` quando a
        // requisição é liberada.
        setAll() {},
      },
    });

    const { data: claims, error: erroDeClaims } = await supabase.auth.getClaims();
    if (!claims?.claims?.sub || erroDeClaims) return false;

    const { data, error } = await supabase.rpc("fc_obter_contexto_plataforma");
    if (error) {
      console.warn("maintenance_superadmin_check_failed", { codigo: error.code });
      return false;
    }

    const contexto = data as { roles?: string[] } | null;
    return Boolean(contexto?.roles?.includes(PLATFORM_ROLE.SUPER_ADMIN));
  } catch (error) {
    console.warn("maintenance_superadmin_check_failed", {
      mensagem: error instanceof Error ? error.message : "erro-desconhecido",
    });
    return false;
  }
}

export function deveBloquearManutencaoGlobal(globalAtiva: boolean, ehSuperadmin: boolean) {
  return globalAtiva && !ehSuperadmin;
}

/**
 * Manutenção global é decidida aqui antes de a página carregar seus dados.
 *
 * O caminho normal continua sem tocar o banco: lemos apenas o Global Config.
 * Quando `global=true`, fazemos uma exceção controlada e resolvemos o papel da
 * sessão. Superadmin segue para `updateSession()` e entra na plataforma em modo
 * administrativo; qualquer outra pessoa continua recebendo a tela/503 de
 * manutenção.
 *
 * Se a identificação administrativa falhar, o comportamento é conservador:
 * não concedemos bypass. As rotas de recuperação explicitamente liberadas
 * (`/admin/configuracoes` e `/api/plataforma/manutencao`) permanecem disponíveis
 * para que a manutenção possa ser desligada, e o painel da Vercel continua como
 * último recurso independente do banco.
 *
 * A manutenção por módulo não é decidida aqui: a guarda da aplicação já conhece
 * o papel e concede o mesmo desvio apenas ao Superadmin.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!ehRotaSempreLiberada(pathname)) {
    const manutencao = await estadoParaDecisao();
    if (manutencao?.global) {
      const superadmin = await ehSuperadminAutenticado(request);

      if (!deveBloquearManutencaoGlobal(true, superadmin)) {
        console.warn("maintenance_superadmin_bypass", { pathname });
        return updateSession(request);
      }

      console.warn("maintenance_global_active", { pathname });

      // Rota de API responde em JSON, inclusive quando recusa: um `fetch` que
      // recebesse HTML falharia com "Unexpected token '<'", mensagem que não
      // menciona manutenção em lugar nenhum.
      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { mensagem: "A plataforma está em manutenção. Tente novamente mais tarde." },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }

      // Rewrite, e não redirect: o endereço original permanece na barra, e
      // redirecionar entraria em laço porque o destino também seria bloqueado.
      const destino = request.nextUrl.clone();
      destino.pathname = "/manutencao";
      destino.search = "";
      const resposta = NextResponse.rewrite(destino);
      resposta.headers.set("Cache-Control", "no-store, must-revalidate");
      return resposta;
    }
  }

  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
