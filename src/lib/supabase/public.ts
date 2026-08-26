import { createClient } from "@supabase/supabase-js";
import { SUPABASE_DB_SCHEMA } from "./schema";

/**
 * Cliente Supabase deliberadamente anônimo e sem estado de sessão.
 *
 * Use somente para contratos liberados a `anon`. Ele não lê cookies, não
 * persiste sessão e não tenta renovar token. Isso evita que um cookie antigo ou
 * inválido transforme uma chamada pública em 401 ao enviar um JWT que a RPC
 * pública nunca precisou receber.
 */
export function createPublicSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("As variáveis públicas do Supabase ainda não foram configuradas.");
  }

  return createClient(url, publishableKey, {
    db: { schema: SUPABASE_DB_SCHEMA },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
