import { NextResponse, type NextRequest } from "next/server";
import { ehRotaSempreLiberada } from "@/lib/manutencao";
import { estadoParaDecisao } from "@/lib/manutencao-control-plane";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Manutenção global é decidida aqui, antes de qualquer leitura do banco.
 *
 * ## Por que no middleware
 *
 * Parar a plataforma precisa acontecer antes de a página tentar carregar
 * dados — senão cada rota bloqueada ainda paga uma ida ao PostgreSQL para
 * descobrir que não vai renderizar, e a manutenção deixa de aliviar justamente
 * o que ela deveria aliviar. A leitura do Edge Config não toca o banco e é
 * barata o bastante para acontecer em toda requisição.
 *
 * ## Por que este gate não conhece o papel da pessoa
 *
 * O papel institucional vem de `fc_obter_contexto_plataforma`, que é uma ida ao
 * banco — exatamente o que este ponto existe para evitar. Então aqui a
 * manutenção global bloqueia **todo mundo**, e quem administra continua
 * entrando pelas rotas sempre liberadas: `/admin/configuracoes` e
 * `/api/plataforma/manutencao`, que são a tela e a API por onde a manutenção é
 * desligada.
 *
 * Não é um desvio escondido: são rotas autenticadas, com papel conferido no
 * servidor, e a mesma decisão fina — com papel — é tomada dentro da aplicação
 * pela guarda de plataforma. Aqui é o gate grosso, que nunca tranca a saída.
 *
 * A manutenção **por módulo** não é decidida aqui de propósito: ela precisa
 * distinguir Superadmin de usuário comum, e essa informação só existe depois do
 * contexto institucional.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!ehRotaSempreLiberada(pathname)) {
    const manutencao = await estadoParaDecisao();
    if (manutencao?.global) {
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
