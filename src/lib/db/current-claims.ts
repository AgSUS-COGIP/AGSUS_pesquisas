import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Ponte temporária: a migração de dados para db_dataware é independente da
 * migração de autenticação (ainda não decidida quando construir — Auth.js foi
 * escolhido como destino, mas não está implementado). Enquanto isso, a
 * identidade de quem está logado continua vindo da sessão Supabase Auth via
 * cookie, exatamente como `src/lib/supabase/proxy.ts` já faz — só o destino
 * das consultas de dados mudou, não o login.
 *
 * Quando o Auth.js substituir o Supabase Auth, troque só esta função (ler a
 * sessão do NextAuth e devolver claims equivalentes) — nada em rpc-adapter.ts
 * precisa mudar, ele só consome o formato de claims abaixo.
 */
export async function getCurrentAuthClaims(): Promise<Record<string, unknown> | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {
        // Esta chamada só lê a sessão para extrair claims; não deve renovar
        // cookies fora do fluxo do middleware.
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;
  return data.claims as Record<string, unknown>;
}
