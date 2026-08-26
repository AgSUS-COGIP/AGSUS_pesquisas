import type {
  AreaVinculosLideranca,
  PessoaAdministrativa,
  PessoaSemChefia,
} from "./api/contratos-pessoas";

export type LeadershipPersonChoice = Pick<
  PessoaAdministrativa,
  "personId" | "fullName" | "employeeNumber"
>;
type LeadershipPersonSearchSource = LeadershipPersonChoice & Pick<PessoaAdministrativa, "active">;

export function shouldSearchLeadershipPeople(term: string, selectedPersonId: string | null) {
  return !selectedPersonId && term.trim().length >= 2;
}

export function leadershipPersonOptions(
  rows: LeadershipPersonSearchSource[],
  excludedPersonId: string | null,
): LeadershipPersonChoice[] {
  return rows
    .filter((person) => person.active && person.personId !== excludedPersonId)
    .map(({ personId, fullName, employeeNumber }) => ({ personId, fullName, employeeNumber }));
}

export function leadershipChoiceFromPending(
  person: Pick<PessoaSemChefia, "personId" | "fullName" | "employeeNumber">,
): LeadershipPersonChoice {
  return {
    personId: person.personId,
    fullName: person.fullName,
    employeeNumber: person.employeeNumber ?? "",
  };
}

export function normalizeLeadershipArea(
  value: unknown,
  fallbackLimit: number,
): AreaVinculosLideranca {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { links: [], totalActive: 0, totalMatches: 0, limit: fallbackLimit };
  }

  const source = value as Partial<AreaVinculosLideranca>;
  return {
    links: Array.isArray(source.links) ? source.links : [],
    totalActive: Number.isFinite(source.totalActive) ? Math.max(0, Number(source.totalActive)) : 0,
    totalMatches: Number.isFinite(source.totalMatches) ? Math.max(0, Number(source.totalMatches)) : 0,
    limit: Number.isFinite(source.limit) ? Math.max(1, Number(source.limit)) : fallbackLimit,
  };
}
