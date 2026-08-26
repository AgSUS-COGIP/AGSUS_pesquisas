import { normalizePlatformModules, resolvePlatformRole, type PlatformModule } from "./platform-modules";
import { PLATFORM_ROLE_LABELS } from "./platform-roles";
import type { PlatformContext } from "./platform-context";

/**
 * Usuário exibido pela casca (`PlatformShell`).
 *
 * Mantido estruturalmente compatível com a prop `user` de `PlatformShell` — é o
 * mesmo objeto que cada página montava à mão antes de `resolvePlatformGuard()`.
 */
export type PlatformShellUser = {
  id?: string;
  fullName: string;
  institutionalEmail: string | null;
  employeeNumber: string;
  profileLabel: string;
  avatarUrl?: string | null;
  roles?: string[];
  modules: PlatformModule[];
};

/**
 * Decisão da guarda de uma página autenticada, nos quatro desfechos possíveis.
 *
 * `granted` é o único que carrega dados: quando o acesso é negado não existe
 * pessoa nem módulo para renderizar, e o tipo impede a página de tentar ler.
 */
export type PlatformGuardDecision =
  | { state: "loading" }
  | { state: "unidentified"; message: string }
  | { state: "restricted"; requiredModule: PlatformModule }
  | { state: "granted"; context: PlatformContext; person: NonNullable<PlatformContext["person"]>; modules: PlatformModule[]; user: PlatformShellUser };

export type PlatformGuardInput = {
  context: PlatformContext | null;
  loading: boolean;
  error: string;
  /** Módulo exigido pela rota. Ausente = basta estar identificado (ex.: `/perfil`). */
  requiredModule?: PlatformModule;
};

const UNIDENTIFIED_FALLBACK = "Acesso não identificado.";

/**
 * Traduz o contexto institucional na decisão de acesso de uma página.
 *
 * Função pura: a ordem dos desfechos é a regra de guarda do produto e fica
 * testável sem React. Sequência — carregando → identidade → módulo → liberado.
 *
 * A lista de módulos é calculada no PostgreSQL e chega em `context.modules`.
 * Aqui apenas descartamos códigos que este bundle ainda não conhece. A guarda
 * não recalcula permissão a partir do perfil, evitando uma segunda fonte de
 * verdade no frontend.
 */
export function resolvePlatformGuard({ context, loading, error, requiredModule }: PlatformGuardInput): PlatformGuardDecision {
  if (loading) return { state: "loading" };

  const person = context?.person;
  if (!context || !person) return { state: "unidentified", message: error || UNIDENTIFIED_FALLBACK };

  const modules = normalizePlatformModules(context.modules);
  if (requiredModule && !modules.includes(requiredModule)) return { state: "restricted", requiredModule };

  return {
    state: "granted",
    context,
    person,
    modules,
    user: {
      id: person.id,
      fullName: person.fullName,
      institutionalEmail: person.institutionalEmail,
      employeeNumber: person.employeeNumber,
      profileLabel: PLATFORM_ROLE_LABELS[resolvePlatformRole(context.roles)],
      avatarUrl: person.avatarUrl,
      roles: context.roles,
      modules,
    },
  };
}
