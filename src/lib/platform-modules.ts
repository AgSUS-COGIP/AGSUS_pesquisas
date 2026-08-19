import { PLATFORM_ROLE, type PlatformRoleCode } from "./platform-roles";

export const PLATFORM_MODULE = {
  HOME: "HOME",
  SURVEYS: "SURVEYS",
  DASHBOARDS: "DASHBOARDS",
  TEAM: "TEAM",
  ADMIN_SURVEYS: "ADMIN_SURVEYS",
  ADMIN_PARTICIPANTS: "ADMIN_PARTICIPANTS",
  ADMIN_TEAMS: "ADMIN_TEAMS",
  ADMIN_ACCESS: "ADMIN_ACCESS",
  ADMIN_IMPORT: "ADMIN_IMPORT",
} as const;

export type PlatformModule = typeof PLATFORM_MODULE[keyof typeof PLATFORM_MODULE];

export const PLATFORM_MODULES = Object.freeze(
  Object.values(PLATFORM_MODULE),
) as readonly PlatformModule[];

/** Participante: somente o módulo Pesquisas. */
export const PARTICIPANT_ROLE_MODULES = Object.freeze([
  PLATFORM_MODULE.SURVEYS,
]) as readonly PlatformModule[];

/** Avaliador: Visão Geral, Pesquisas e Minha Equipe. */
export const EVALUATOR_ROLE_MODULES = Object.freeze([
  PLATFORM_MODULE.HOME,
  PLATFORM_MODULE.SURVEYS,
  PLATFORM_MODULE.TEAM,
]) as readonly PlatformModule[];

/**
 * Admin: operação completa das avaliações.
 *
 * Fora da lista de propósito: `ADMIN_TEAMS` (dados funcionais e vínculos de
 * liderança), `ADMIN_ACCESS` (papéis e marca) e `ADMIN_IMPORT` (carga da base
 * institucional) — administração global, exclusiva do Superadmin.
 *
 * **`TEAM` também ficou de fora, desde 17/08/2026.** "Minha equipe" serve a
 * quem lidera pessoas: `/equipe` lista os ciclos em que a pessoa tem vínculo
 * ativo de chefia e permite avaliar quem está sob ela. Isso é atributo de
 * **dado** (`cddi_leadership_links`), não de perfil — e o perfil Admin descreve
 * quem opera as avaliações, não quem chefia alguém.
 *
 * Na base, nenhum dos Admins lidera equipe, então a tela só aparecia para
 * abrir vazia. Avaliador mantém o módulo (os 114 lideram) e Superadmin o mantém
 * por ter todos.
 *
 * A ressalva honesta: um Admin que **venha** a liderar uma equipe perde o
 * caminho para avaliá-la. Enquanto isso não acontecer, o custo é zero; se
 * acontecer, o certo não é devolver `TEAM` ao perfil, e sim conceder o módulo a
 * quem lidera — `fc_obter_contexto_plataforma()` já calcula `isLeader`.
 */
export const ADMIN_ROLE_MODULES = Object.freeze([
  PLATFORM_MODULE.HOME,
  PLATFORM_MODULE.SURVEYS,
  PLATFORM_MODULE.DASHBOARDS,
  PLATFORM_MODULE.ADMIN_SURVEYS,
  PLATFORM_MODULE.ADMIN_PARTICIPANTS,
]) as readonly PlatformModule[];

/** Superadmin: acesso irrestrito. */
export const SUPER_ADMIN_MODULES = PLATFORM_MODULES;

export const ROLE_MODULES: Record<PlatformRoleCode, readonly PlatformModule[]> = {
  [PLATFORM_ROLE.SUPER_ADMIN]: SUPER_ADMIN_MODULES,
  [PLATFORM_ROLE.ADMIN]: ADMIN_ROLE_MODULES,
  [PLATFORM_ROLE.EVALUATOR]: EVALUATOR_ROLE_MODULES,
  [PLATFORM_ROLE.PARTICIPANT]: PARTICIPANT_ROLE_MODULES,
};

export function isPlatformModule(value: unknown): value is PlatformModule {
  return typeof value === "string" && PLATFORM_MODULES.includes(value as PlatformModule);
}

/**
 * Descarta módulos desconhecidos e duplicados, preservando a ordem de entrada.
 *
 * O banco pode devolver módulos que esta versão do frontend ainda não conhece
 * (ou já removeu); ignorá-los evita renderizar navegação inválida.
 */
export function normalizePlatformModules(modules: readonly string[] | null | undefined) {
  const seen = new Set<PlatformModule>();
  const normalized: PlatformModule[] = [];

  for (const moduleName of modules ?? []) {
    if (!isPlatformModule(moduleName) || seen.has(moduleName)) continue;
    seen.add(moduleName);
    normalized.push(moduleName);
  }

  return normalized;
}

/**
 * Papel efetivo de uma pessoa: o de maior privilégio entre os que ela acumula.
 *
 * Sem papel reconhecido, o efetivo é Participante — o piso do modelo, nunca a
 * ausência de acesso.
 */
export function resolvePlatformRole(roles?: readonly string[] | null): PlatformRoleCode {
  const roleSet = new Set(roles ?? []);
  if (roleSet.has(PLATFORM_ROLE.SUPER_ADMIN)) return PLATFORM_ROLE.SUPER_ADMIN;
  if (roleSet.has(PLATFORM_ROLE.ADMIN)) return PLATFORM_ROLE.ADMIN;
  if (roleSet.has(PLATFORM_ROLE.EVALUATOR)) return PLATFORM_ROLE.EVALUATOR;
  return PLATFORM_ROLE.PARTICIPANT;
}

/**
 * Resolve os módulos visíveis a partir do papel efetivo da pessoa.
 *
 * O acesso é determinado **exclusivamente** pelos quatro perfis: não existe
 * exceção por pessoa nem módulo concedido fora do papel. O resultado governa
 * apenas a interface — a autorização efetiva é a RLS do banco.
 */
export function resolvePlatformModules({ roles }: { roles?: readonly string[] | null }): PlatformModule[] {
  return [...ROLE_MODULES[resolvePlatformRole(roles)]];
}
