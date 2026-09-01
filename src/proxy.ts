import { NextResponse, type NextRequest } from "next/server";
import { updateSessionAuthJs } from "@/lib/auth/proxy-authjs";
import { ehRotaSempreLiberada } from "@/lib/manutencao";
import { estadoParaDecisao } from "@/lib/manutencao-control-plane";
import { deveBloquearManutencaoGlobal } from "@/lib/manutencao-proxy";

/**
 * O proxy roda no Edge e não pode importar `pg`. Durante manutenção global,
 * todas as rotas que não pertencem à recuperação são bloqueadas antes de tocar
 * o banco. `/admin/configuracoes` e a API do control plane permanecem liberadas
 * por `ehRotaSempreLiberada`; nelas, Auth.js e ADMIN_ACCESS continuam sendo
 * validados normalmente.
 */
export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (!ehRotaSempreLiberada(pathname)) {
    const manutencao = await estadoParaDecisao();
    if (deveBloquearManutencaoGlobal(Boolean(manutencao?.global), false)) {
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

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    "/api/:path*",
  ],
};
