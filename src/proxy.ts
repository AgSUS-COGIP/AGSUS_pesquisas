import type { NextRequest } from "next/server";
import { updateSessionAuthJs } from "@/lib/auth/proxy-authjs";

// `proxy` é o nome que o Next 16 deu ao antigo middleware (mesma função, nome
// novo — ver node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).
// Roda no runtime Edge: nenhum dos dois caminhos abaixo pode alcançar `pg`.
export async function proxy(request: NextRequest) {
  return updateSessionAuthJs(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    // A primeira regra existe para poupar o proxy nos arquivos estáticos de
    // `/public`, e exclui todo caminho terminado em extensão de imagem. Isso
    // passou a alcançar rotas de verdade quando as imagens saíram do bucket:
    // `/api/arquivos/platform-assets/branding/arte.png` termina em `.png`, e
    // com apenas a primeira regra o proxy não rodava nela — nem para negar o
    // PUT sem sessão, nem para aplicar os cabeçalhos de segurança. Rota de API
    // nunca é arquivo estático, então entra sempre, qualquer que seja o final
    // do caminho. Quem decide o que é público continua sendo `isPublicRequest`.
    "/api/:path*",
  ],
};
