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
 * Traduz o mapa do Realtime Presence em uma lista de pessoas.
 *
 * Uma pessoa pode estar com várias abas abertas e, nesse caso, o Supabase
 * devolve mais de uma presença sob a mesma chave. A interface mostra a pessoa
 * uma vez, preservando o registro mais recente e descartando payload inválido.
 */
export function normalizeOnlinePresenceState(value: unknown): OnlinePresencePerson[] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];

  const people = new Map<string, OnlinePresencePerson>();
  for (const presences of Object.values(value as Record<string, unknown>)) {
    if (!Array.isArray(presences)) continue;
    for (const presence of presences) {
      if (!presence || typeof presence !== "object" || Array.isArray(presence)) continue;
      const source = presence as Record<string, unknown>;
      const personId = text(source.personId);
      const fullName = text(source.fullName);
      if (!personId || !fullName) continue;

      const candidate: OnlinePresencePerson = {
        personId,
        fullName,
        avatarUrl: text(source.avatarUrl),
        profileLabel: text(source.profileLabel) ?? "Usuário",
        onlineAt: text(source.onlineAt) ?? "",
      };
      const current = people.get(personId);
      if (!current || candidate.onlineAt >= current.onlineAt) people.set(personId, candidate);
    }
  }

  return [...people.values()].sort((first, second) => first.fullName.localeCompare(second.fullName, "pt-BR"));
}
