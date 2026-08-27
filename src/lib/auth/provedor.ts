/**
 * Qual provedor de identidade está ativo.
 *
 * A migração do Supabase Auth para o Auth.js acontece sob bandeira: os dois
 * caminhos coexistem no código e a variável decide qual vale. Isso permite
 * testar o login novo contra o banco réplica local sem derrubar o que está no
 * ar, e voltar atrás trocando uma linha em vez de revertendo um deploy.
 *
 * É `NEXT_PUBLIC_` porque as telas de login e o cabeçalho (componentes de
 * cliente) precisam saber qual fluxo disparar — não só o servidor.
 *
 * O padrão é `supabase`: enquanto ninguém configurar a variável, nada muda.
 */
export type ProvedorAuth = "supabase" | "authjs";

export function provedorAuth(): ProvedorAuth {
  return process.env.NEXT_PUBLIC_AUTH_PROVIDER === "authjs" ? "authjs" : "supabase";
}

export function usaAuthJs() {
  return provedorAuth() === "authjs";
}
