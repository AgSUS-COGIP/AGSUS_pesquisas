export const PLATFORM_MODULE = {
  HOME: "HOME",
  SURVEYS: "SURVEYS",
  DASHBOARDS: "DASHBOARDS",
  TEAM: "TEAM",
  ONLINE_PRESENCE: "ONLINE_PRESENCE",
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
 * Piso seguro de toda pessoa institucional autenticada. A autorização não é
 * derivada de perfil: novos cadastros recebem essas duas capacidades mesmo
 * antes de existir uma configuração individual.
 */
export const BASE_PLATFORM_MODULES = Object.freeze([
  PLATFORM_MODULE.HOME,
  PLATFORM_MODULE.SURVEYS,
]) as readonly PlatformModule[];

export function isPlatformModule(value: unknown): value is PlatformModule {
  return typeof value === "string" && PLATFORM_MODULES.includes(value as PlatformModule);
}

/**
 * Descarta módulos desconhecidos e duplicados, preservando a ordem retornada
 * pelo contexto institucional.
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

