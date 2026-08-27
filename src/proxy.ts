import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";
import { updateSessionAuthJs } from "@/lib/auth/proxy-authjs";
import { usaAuthJs } from "@/lib/auth/provedor";

// `proxy` é o nome que o Next 16 deu ao antigo middleware (mesma função, nome
// novo — ver node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md).
// Roda no runtime Edge: nenhum dos dois caminhos abaixo pode alcançar `pg`.
export async function proxy(request: NextRequest) {
  return usaAuthJs() ? updateSessionAuthJs(request) : updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
