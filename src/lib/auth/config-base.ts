import Google from "next-auth/providers/google";
import type { NextAuthConfig } from "next-auth";

/**
 * Configuração do Auth.js que pode rodar no Edge.
 *
 * O `proxy.ts` do Next 16 (o que antes se chamava middleware) executa no
 * runtime Edge, onde `pg` não existe. Importar a configuração completa ali
 * quebraria o build. Por isso o Auth.js é montado em duas partes:
 *
 *   - este arquivo: provedor, estratégia de sessão e o recorte do token —
 *     nada que toque o banco. É o que o proxy importa.
 *   - `./index.ts`: acrescenta o callback que resolve a identidade no Postgres.
 *     É o que a rota de API importa, e roda em Node.
 *
 * Com estratégia `jwt` a sessão vive no cookie assinado: verificar assinatura e
 * ler claims é operação de CPU, sem ida ao banco — exatamente o que o proxy
 * precisa para decidir redirecionamento em toda requisição privada.
 */
export const configBase = {
  providers: [
    Google({
      clientId: process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID,
      clientSecret: process.env.SUPABASE_AUTH_EXTERNAL_GOOGLE_SECRET,
      // `select_account` evita que quem tem duas contas Google no navegador
      // entre silenciosamente com a pessoal em vez da institucional.
      //
      // `hd` é apenas dica de interface — filtra a lista que o Google mostra,
      // mantendo a paridade com o fluxo antigo. Quem de fato decide o domínio é
      // `sigav.institutional_domains`, consultado por
      // `fc_srv_resolver_identidade_oauth`: um `hd` burlado não abre acesso.
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
          hd: process.env.AUTH_GOOGLE_HD || "agenciasus.org.br",
        },
      },
    }),
  ],

  session: { strategy: "jwt" },

  pages: {
    signIn: "/acesso",
    error: "/acesso",
  },

  callbacks: {
    /**
     * `token.sub` precisa ser o `auth.users.id`, não o identificador do Google.
     *
     * É esse valor que vira `auth.uid()` no banco e casa com
     * `sigav.people.auth_user_id`. Quem o resolve é o callback de `signIn` da
     * configuração completa, que grava `user.id` — aqui apenas transportamos.
     */
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },

    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
} satisfies NextAuthConfig;
