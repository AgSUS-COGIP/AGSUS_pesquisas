import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { usaAuthJs } from "@/lib/auth/provedor";

/**
 * Identidade da sessão, no formato de claims que o banco espera.
 *
 * Este é o único ponto do código que sabe de onde vem o login. O adaptador de
 * RPC injeta o que sai daqui em `request.jwt.claims`, e as 156 funções do banco
 * o leem por `auth.uid()` / `auth.role()` / `auth.jwt()` — exatamente como o
 * PostgREST fazia. Trocar o provedor de identidade é trocar esta função.
 *
 * O contrato de claims foi extraído das migrations e é pequeno:
 *   - `sub`   → vira `auth.uid()`, casa com `sigav.people.auth_user_id`;
 *   - `email` → lido por `auth.jwt() ->> 'email'` na vinculação institucional;
 *   - `role`  → lido por `auth.role()`, distingue serviço de sessão comum;
 *   - `user_metadata.full_name` / `.name` → nome de exibição no primeiro acesso.
 *
 * As claims são montadas aqui, e não gravadas dentro do cookie: o cookie do
 * Auth.js guarda o mínimo, e a forma que o banco exige é derivada no momento do
 * uso. Assim o formato do banco não vaza para o formato da sessão.
 */
export type ClaimsBanco = Record<string, unknown>;

function montarClaims(dados: {
  sub?: string | null;
  email?: string | null;
  nome?: string | null;
}): ClaimsBanco | null {
  if (!dados.sub) return null;

  return {
    sub: dados.sub,
    email: dados.email ?? undefined,
    role: "authenticated",
    user_metadata: {
      full_name: dados.nome ?? undefined,
      name: dados.nome ?? undefined,
    },
  };
}

/** Sessão do Auth.js (provedor novo). */
async function claimsDoAuthJs(): Promise<ClaimsBanco | null> {
  // Import dinâmico: `@/lib/auth` arrasta o adaptador de banco (`pg`), e este
  // módulo é alcançado por caminhos que não devem carregá-lo quando a bandeira
  // aponta para o Supabase.
  const { auth } = await import("@/lib/auth");
  const sessao = await auth();
  if (!sessao?.user) return null;

  return montarClaims({
    sub: sessao.user.id,
    email: sessao.user.email,
    nome: sessao.user.name,
  });
}

/** Sessão do Supabase Auth (provedor atual, padrão). */
async function claimsDoSupabase(): Promise<ClaimsBanco | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: () => {
        // Esta chamada só lê a sessão para extrair claims; renovar cookie é
        // responsabilidade do proxy.
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;

  // O GoTrue já entrega o formato que o banco espera — repassamos como está
  // para não perder claim que alguma função leia e que não esteja no contrato
  // mínimo documentado acima.
  return data.claims as ClaimsBanco;
}

export async function getCurrentAuthClaims(): Promise<ClaimsBanco | null> {
  return usaAuthJs() ? claimsDoAuthJs() : claimsDoSupabase();
}
