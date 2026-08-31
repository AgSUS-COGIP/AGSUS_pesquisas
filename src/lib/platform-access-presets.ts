import {
  PLATFORM_MODULE,
  PLATFORM_MODULES,
  normalizePlatformModules,
  type PlatformModule,
} from "./platform-modules";

/**
 * Atalhos funcionais da interface de acessos.
 *
 * Não são roles de autenticação e não participam de nenhuma decisão de
 * segurança. Aplicar um preset apenas preenche a lista de permissões da pessoa;
 * depois disso cada permissão pode ser alterada de forma independente.
 */
export type PlatformAccessPreset = {
  code: string;
  name: string;
  description: string;
  permissions: readonly PlatformModule[];
};

export const PLATFORM_ACCESS_PRESETS: readonly PlatformAccessPreset[] = [
  {
    code: "ADMINISTRATOR",
    name: "Superadmin",
    description: "Preenche todas as permissões disponíveis.",
    permissions: PLATFORM_MODULES,
  },
  {
    code: "SURVEY_MANAGER",
    name: "Admin",
    description: "Opera pesquisas, participantes, painéis e presença online.",
    permissions: [
      PLATFORM_MODULE.HOME,
      PLATFORM_MODULE.SURVEYS,
      PLATFORM_MODULE.DASHBOARDS,
      PLATFORM_MODULE.ONLINE_PRESENCE,
      PLATFORM_MODULE.ADMIN_SURVEYS,
      PLATFORM_MODULE.ADMIN_PARTICIPANTS,
    ],
  },
  {
    code: "MANAGER",
    name: "Gestor",
    description: "Acessa painéis e trabalha com a própria equipe.",
    permissions: [
      PLATFORM_MODULE.HOME,
      PLATFORM_MODULE.SURVEYS,
      PLATFORM_MODULE.DASHBOARDS,
      PLATFORM_MODULE.TEAM,
    ],
  },
  {
    code: "LEADER",
    name: "Avaliador",
    description: "Responde pesquisas e trabalha com a própria equipe.",
    permissions: [
      PLATFORM_MODULE.HOME,
      PLATFORM_MODULE.SURVEYS,
      PLATFORM_MODULE.TEAM,
    ],
  },
  {
    code: "RESPONDENT",
    name: "Participante",
    description: "Acessa a visão geral e responde pesquisas.",
    permissions: [PLATFORM_MODULE.HOME, PLATFORM_MODULE.SURVEYS],
  },
] as const;

export function matchingAccessPreset(permissions: readonly string[]) {
  const current = new Set(normalizePlatformModules(permissions));
  return PLATFORM_ACCESS_PRESETS.find((preset) => (
    preset.permissions.length === current.size
    && preset.permissions.every((permission) => current.has(permission))
  ));
}
