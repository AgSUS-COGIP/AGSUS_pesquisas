import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // A isenção por extensão vale só para arquivos na RAIZ (os assets de
  // `public/`, todos sem subpasta). Um `.*\.png$` genérico isentaria também
  // rotas dinâmicas (`/pesquisas/x.png`, `/admin/pesquisas/x.png`, …), que
  // seriam servidas sem verificação de sessão e sem cabeçalhos de segurança.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|[^/]+\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
