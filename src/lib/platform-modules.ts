export const PLATFORM_MODULE = {
  HOME: "HOME",
  SURVEYS: "SURVEYS",
  DASHBOARDS: "DASHBOARDS",
  TEAM: "TEAM",
  RESULTS: "RESULTS",
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

export const DEFAULT_PARTICIPANT_MODULES = Object.freeze([
  PLATFORM_MODULE.HOME,
  PLATFORM_MODULE.SURVEYS,
  PLATFORM_MODULE.DASHBOARDS,
  PLATFORM_MODULE.RESULTS,
]) as readonly PlatformModule[];

export const FULL_ADMIN_MODULES = PLATFORM_MODULES;

export const SURVEY_MANAGER_MODULES = Object.freeze(
  PLATFORM_MODULES.filter((moduleName) => moduleName !== PLATFORM_MODULE.ADMIN_ACCESS),
) as readonly PlatformModule[];

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
 * Resolve os módulos visíveis para uma pessoa, em ordem estrita de precedência:
 *
 * 1. `ADMINISTRATOR` recebe tudo e ignora qualquer outra fonte;
 * 2. módulos explícitos do banco (`person_module_permissions`) vencem os papéis,
 *    permitindo exceção individual sem criar papel novo;
 * 3. `TECHNICAL_TEAM` recebe tudo; `SURVEY_MANAGER` recebe tudo menos `ADMIN_ACCESS`
 *    (quem gerencia pesquisa não concede papéis);
 * 4. caso restante: módulos de participante, mais `TEAM` para liderança.
 *
 * O resultado governa apenas a interface. A autorização efetiva é a RLS do banco.
 */
export function resolvePlatformModules({
  roles,
  explicitModules,
  isLeader,
}: {
  roles?: readonly string[] | null;
  explicitModules?: readonly string[] | null;
  isLeader?: boolean;
}): PlatformModule[] {
  const roleSet = new Set(roles ?? []);

  if (roleSet.has("ADMINISTRATOR")) return [...FULL_ADMIN_MODULES];

  const normalizedExplicitModules = normalizePlatformModules(explicitModules);
  if (normalizedExplicitModules.length) return normalizedExplicitModules;

  if (roleSet.has("TECHNICAL_TEAM")) return [...FULL_ADMIN_MODULES];
  if (roleSet.has("SURVEY_MANAGER")) return [...SURVEY_MANAGER_MODULES];

  const resolvedModules = [...DEFAULT_PARTICIPANT_MODULES];
  if (isLeader || roleSet.has("LEADER")) resolvedModules.push(PLATFORM_MODULE.TEAM);
  return resolvedModules;
}
