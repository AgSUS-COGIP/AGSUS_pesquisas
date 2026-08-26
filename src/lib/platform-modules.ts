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

/**
 * Piso seguro mantido apenas para chamadas legadas de `PlatformShell` que ainda
 * não informam `user.modules`. Não é usado por `resolvePlatformGuard()` e não
 * representa mais o mapa de permissões do perfil no frontend.
 */
export const PARTICIPANT_ROLE_MODULES = Object.freeze([
  PLATFORM_MODULE.SURVEYS,
]) as readonly PlatformModule[];

export function isPlatformModule(value: unknown): value is PlatformModule {
  return typeof value === "string" && PLATFORM_MODULES.includes(value as PlatformModule);
}

/**
 * Descarta módulos desconhecidos e duplicados, preservando a ordem retornada
 * pelo contexto institucional.
 *
 * O catálogo e as permissões efetivas vivem no PostgreSQL. O frontend mantém
 * apenas esta lista de códigos conhecidos para não renderizar um módulo criado
 * por uma versão de backend que o bundle atual ainda não sabe apresentar.
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
 * O papel continua sendo usado para rótulo e compatibilidade do perfil. Ele não
 * define mais os módulos da interface: essa decisão chega pronta em
 * `fc_obter_contexto_plataforma().modules`.
 */
export function resolvePlatformRole(roles?: readonly string[] | null): PlatformRoleCode {
  const roleSet = new Set(roles ?? []);
  if (roleSet.has(PLATFORM_ROLE.SUPER_ADMIN)) return PLATFORM_ROLE.SUPER_ADMIN;
  if (roleSet.has(PLATFORM_ROLE.ADMIN)) return PLATFORM_ROLE.ADMIN;
  if (roleSet.has(PLATFORM_ROLE.EVALUATOR)) return PLATFORM_ROLE.EVALUATOR;
  return PLATFORM_ROLE.PARTICIPANT;
}
