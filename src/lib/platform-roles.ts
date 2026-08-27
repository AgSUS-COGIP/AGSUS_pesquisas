/**
 * Perfis institucionais de acesso da plataforma.
 *
 * O modelo possui cinco perfis mutuamente exclusivos. O perfil define o pacote
 * padrão de módulos; exceções individuais continuam sendo resolvidas no banco.
 *
 * Os códigos internos são persistidos e podem ser referenciados por RLS e RPCs.
 * Todo o frontend deve usar estas constantes, nunca literais soltos.
 */
export const PLATFORM_ROLE = {
  SUPER_ADMIN: "ADMINISTRATOR",
  ADMIN: "SURVEY_MANAGER",
  MANAGER: "MANAGER",
  EVALUATOR: "LEADER",
  PARTICIPANT: "RESPONDENT",
} as const;

export type PlatformRoleCode = typeof PLATFORM_ROLE[keyof typeof PLATFORM_ROLE];

export const PLATFORM_ROLE_LABELS: Record<PlatformRoleCode, string> = {
  [PLATFORM_ROLE.SUPER_ADMIN]: "Superadmin",
  [PLATFORM_ROLE.ADMIN]: "Admin",
  [PLATFORM_ROLE.MANAGER]: "Gestor",
  [PLATFORM_ROLE.EVALUATOR]: "Avaliador",
  [PLATFORM_ROLE.PARTICIPANT]: "Participante",
};

/** Rótulo em português de um código de papel; código desconhecido volta como veio. */
export function platformRoleLabel(code: string) {
  return PLATFORM_ROLE_LABELS[code as PlatformRoleCode] ?? code;
}
