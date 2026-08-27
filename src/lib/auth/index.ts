import NextAuth from "next-auth";
import { configBase } from "./config-base";
import { createAdminRpcClient } from "@/lib/db/rpc-adapter";

type ResultadoIdentidade = {
  status?: string;
  userId?: string;
  email?: string;
  novo?: boolean;
};

/**
 * Auth.js completo — roda em Node, tem acesso ao banco.
 *
 * Só a rota `/api/auth/[...nextauth]` e os Server Components importam daqui.
 * O `proxy.ts` importa de `./config-base`, que é Edge-safe.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...configBase,
  callbacks: {
    ...configBase.callbacks,

    /**
     * Resolve a identidade no banco antes de emitir sessão.
     *
     * Duas responsabilidades, ambas decididas pelo banco e não por lista no
     * código:
     *
     * 1. **Domínio institucional** — `sigav.institutional_domains` é a mesma
     *    fonte que `resolve_authenticated_person` consulta, então login e
     *    vinculação nunca discordam.
     * 2. **Continuidade do vínculo** — a função procura `auth.users` pelo
     *    e-mail antes de criar alguém novo, reaproveitando o `id` de quem já
     *    usava a plataforma com o GoTrue. Sem isso, todo mundo entraria como
     *    usuário novo e perderia o próprio cadastro em `sigav.people`.
     *
     * Gravar em `user.id` é o que faz o callback `jwt` de `config-base`
     * encontrar o identificador certo para pôr em `token.sub`.
     */
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google") return false;

      const email = (profile?.email ?? user?.email ?? "").trim();
      const providerSub = account.providerAccountId ?? (profile?.sub as string | undefined) ?? "";
      if (!email || !providerSub) return false;

      const nome = (profile?.name ?? user?.name ?? "") || null;
      const avatar = (profile?.picture as string | undefined) ?? user?.image ?? null;

      const banco = createAdminRpcClient();
      const { data, error } = await banco.rpc("fc_srv_resolver_identidade_oauth", {
        p_provider: "google",
        p_provider_sub: providerSub,
        p_email: email,
        p_nome: nome,
        p_avatar: avatar,
      });

      if (error) {
        // Recusar é a única resposta correta aqui: emitir sessão sem identidade
        // resolvida produziria um JWT cujo `sub` não corresponde a ninguém, e a
        // pessoa entraria numa interface que falha em toda chamada.
        console.error("[auth] falha ao resolver identidade", error.code, error.message);
        return false;
      }

      const resultado = (data ?? {}) as ResultadoIdentidade;
      if (resultado.status !== "OK" || !resultado.userId) {
        console.warn("[auth] identidade recusada:", resultado.status);
        return false;
      }

      user.id = resultado.userId;
      return true;
    },
  },
});
