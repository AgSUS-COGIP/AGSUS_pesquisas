import { PLATFORM_ROLE, PLATFORM_ROLE_LABELS, platformRoleLabel } from "./platform-roles";

export type OnlinePresencePerson = {
  personId: string;
  fullName: string;
  avatarUrl: string | null;
  profileLabel: string;
  onlineAt: string;
};

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Traduz o retorno de `fc_listar_presenca_online()` na lista da interface.
 *
 * ## Por que não é mais o mapa do Realtime
 *
 * A presença deixou de usar canal Realtime privado em `20260821100000`. O
 * desenho pretendido — todos anunciam, só perfis configurados enxergam — não é
 * possível ali: o protocolo exige permissão de **leitura** para entrar no
 * canal, e sem entrar não se consegue anunciar. O resultado em produção era o
 * pior dos dois mundos: a lista mostrava apenas quem podia vê-la, e todos os
 * demais registravam erro de autorização a cada carregamento de página.
 *
 * Hoje a fonte é uma tabela com batida de presença, e a autorização é do banco.
 *
 * O banco devolve o **código** do perfil, não o rótulo — a tradução é de
 * `platformRoleLabel()`, a mesma do resto da interface. Perfil **ausente** cai
 * em "Participante", que é o piso do modelo de papéis (pessoa sem atribuição
 * vigente é participante). Código **desconhecido** aparece como veio, e não
 * traduzido para o piso: inventar um rótulo esconderia dado inesperado no banco.
 */
export function normalizeOnlinePresenceList(value: unknown): OnlinePresencePerson[] {
  if (!Array.isArray(value)) return [];

  const people = new Map<string, OnlinePresencePerson>();
  for (const row of value) {
    if (!row || typeof row !== "object" || Array.isArray(row)) continue;
    const source = row as Record<string, unknown>;
    const personId = text(source.personId);
    const fullName = text(source.fullName);
    if (!personId || !fullName) continue;

    const roleCode = text(source.roleCode);
    people.set(personId, {
      personId,
      fullName,
      avatarUrl: text(source.avatarUrl),
      profileLabel: roleCode
        ? platformRoleLabel(roleCode)
        : PLATFORM_ROLE_LABELS[PLATFORM_ROLE.PARTICIPANT],
      onlineAt: text(source.onlineAt) ?? "",
    });
  }

  return [...people.values()].sort((first, second) => first.fullName.localeCompare(second.fullName, "pt-BR"));
}
