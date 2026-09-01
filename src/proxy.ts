import { NextResponse, type NextRequest } from "next/server";
import { updateSessionAuthJs } from "@/lib/auth/proxy-authjs";
import { ehRotaSempreLiberada } from "@/lib/manutencao";
import { estadoParaDecisao } from "@/lib/manutencao-control-plane";
import { deveBloquearManutencaoGlobal, interpretarDesvioAdministrativo } from "@/lib/manutencao-proxy";

/** Depois disto, não conseguir conferir vale como não poder passar. */
const LIMITE_DA_CONSULTA_DE_DESVIO_MS = 2_000;

/**
 * Quem administra a plataforma atravessa a manutenção global; todo o resto não.
 *
 * O desvio existe para que a correção possa ser conferida **antes** de a
 * plataforma reabrir. Sem ele, a única forma de testar se está tudo certo é
 * desligar a manutenção — ou seja, expor a plataforma para descobrir se dá para
 * expor.
 *
 * ## Por que a consulta acontece aqui, e só às vezes
 *
 * O papel mora no PostgreSQL, e o proxy não fala com ele: `createServerRpcClient()`
 * lê a sessão por `next/headers`, que não existe neste contexto, e um pool de
 * `pg` no proxy teria ciclo de vida atrelado a algo que roda em toda
 * requisição. Por isso a pergunta vai por HTTP para
 * `/api/plataforma/manutencao/desvio`, que sabe responder.
 *
 * O custo é real, e por isso ele só é pago quando a bandeira global **já está
 * ligada** — estado excepcional, em que uma ida ao banco por requisição é
 * barata perto de ter a plataforma fechada. No caminho normal nada disso roda:
 * lê-se o Global Config e segue.
 *
 * A manutenção **por módulo** não é decidida aqui. Ela depende de qual módulo
 * atende a rota, e quem já sabe isso é a guarda da aplicação, em
 * `resolvePlatformGuard`, que concede o mesmo desvio a `ADMIN_ACCESS`.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!ehRotaSempreLiberada(pathname)) {
    const manutencao = await estadoParaDecisao();
    const globalAtiva = Boolean(manutencao?.global);
    const temDesvio = globalAtiva ? await consultarDesvioAdministrativo(request) : false;

    if (deveBloquearManutencaoGlobal(globalAtiva, temDesvio)) {
      console.warn("maintenance_global_active", { pathname });

      if (pathname.startsWith("/api/")) {
        return NextResponse.json(
          { mensagem: "A plataforma está em manutenção. Tente novamente mais tarde." },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      }

      const destino = request.nextUrl.clone();
      destino.pathname = "/manutencao";
      destino.search = "";
      const resposta = NextResponse.rewrite(destino);
      resposta.headers.set("Cache-Control", "no-store, must-revalidate");
      return resposta;
    }
  }

  return updateSessionAuthJs(request);
}

/**
 * Pergunta à aplicação se a sessão desta requisição administra a plataforma.
 *
 * O cookie é repassado porque é ele que identifica a sessão — sem ele a rota
 * responderia sobre ninguém. `redirect: "manual"` impede que um desvio de
 * autenticação seja seguido e interpretado como resposta; e o prazo existe
 * porque manutenção global costuma coincidir com banco lento, e uma consulta
 * pendurada transformaria cada requisição bloqueada numa espera de dois
 * minutos.
 *
 * Qualquer falha devolve `false`. É a direção segura: errar para o lado de
 * bloquear deixa a administração sem navegar, o que é incômodo; errar para o
 * outro abre a plataforma inteira durante a manutenção.
 */
async function consultarDesvioAdministrativo(request: NextRequest) {
  try {
    const destino = new URL("/api/plataforma/manutencao/desvio", request.nextUrl.origin);
    const resposta = await fetch(destino, {
      headers: { cookie: request.headers.get("cookie") ?? "" },
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(LIMITE_DA_CONSULTA_DE_DESVIO_MS),
    });
    const corpo = await resposta.json().catch(() => null);
    return interpretarDesvioAdministrativo(resposta.status, corpo);
  } catch (erro) {
    console.warn("maintenance_bypass_check_failed", {
      mensagem: erro instanceof Error ? erro.message : "erro-desconhecido",
    });
    return false;
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    "/api/:path*",
  ],
};
