
/**
 * Identidade da sessão, no formato de claims que o banco espera.
 *
 * Este é o único ponto do código que sabe de onde vem o login. O adaptador de
 * RPC injeta o que sai daqui em `request.jwt.claims`, e as funções do banco o
 * leem por `sigav."FC_UID_SESSAO"()` / `fc_papel_sessao()` / `fc_claims_sessao()`
 * — preservando o contrato de sessão esperado pelas funções do banco.
 *
 * O contrato de claims foi extraído das migrations e é pequeno:
 *   - `sub`   → vira `FC_UID_SESSAO()`, casa com `sigav."TB_PESSOA"."SQ_USUARIO_IDENTIDADE"`;
 *   - `email` → lido por `fc_claims_sessao() ->> 'email'` na vinculação institucional;
 *   - `role`  → lido por `fc_papel_sessao()`, distingue serviço de sessão comum;
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

/** Sessão autenticada, lida pelo Auth.js. */
async function claimsDaSessao(): Promise<ClaimsBanco | null> {
  const { auth } = await import("@/lib/auth");
  const sessao = await auth();
  if (!sessao?.user) return null;

  return montarClaims({
    sub: sessao.user.id,
    email: sessao.user.email,
    nome: sessao.user.name,
  });
}

export async function getCurrentAuthClaims(): Promise<ClaimsBanco | null> {
  return claimsDaSessao();
}
