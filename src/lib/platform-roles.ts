/**
 * Papéis do modelo simplificado de permissões da plataforma.
 *
 * O modelo possui quatro papéis: SuperAdmin, Admin, Avaliador e Participante.
 * Os códigos internos são os identificadores legados do banco — preservados
 * porque políticas de RLS, funções SECURITY DEFINER e metadados persistidos os
 * referenciam. Todo o frontend deve usar estas constantes, nunca o literal.
 */
export const PLATFORM_ROLE = {
  SUPER_ADMIN: "ADMINISTRATOR",
  ADMIN: "SURVEY_MANAGER",
  EVALUATOR: "LEADER",
  PARTICIPANT: "RESPONDENT",
} as const;

export type PlatformRoleCode = typeof PLATFORM_ROLE[keyof typeof PLATFORM_ROLE];

export const PLATFORM_ROLE_LABELS: Record<PlatformRoleCode, string> = {
  [PLATFORM_ROLE.SUPER_ADMIN]: "SuperAdmin",
  [PLATFORM_ROLE.ADMIN]: "Admin",
  [PLATFORM_ROLE.EVALUATOR]: "Avaliador",
  [PLATFORM_ROLE.PARTICIPANT]: "Participante",
};

/** Rótulo em português de um código de papel; código desconhecido volta como veio. */
export function platformRoleLabel(code: string) {
  return PLATFORM_ROLE_LABELS[code as PlatformRoleCode] ?? code;
}
