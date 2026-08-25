export const EMAIL_AUDIENCE_PAGE_SIZE = 75;

type AudienceSelectablePerson = {
  personId: string;
  emailValido: boolean;
};

export function audiencePage<T>(items: T[], requestedPage: number, pageSize = EMAIL_AUDIENCE_PAGE_SIZE) {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const page = Math.max(0, Math.min(requestedPage, totalPages - 1));
  const start = page * pageSize;
  const pageItems = items.slice(start, start + pageSize);

  return {
    items: pageItems,
    page,
    totalPages,
    start: items.length ? start + 1 : 0,
    end: start + pageItems.length,
    total: items.length,
  };
}

export function toggleAudiencePerson(
  current: Set<string>,
  person: AudienceSelectablePerson,
  checked: boolean,
) {
  if (!person.emailValido || current.has(person.personId) === checked) return current;
  const next = new Set(current);
  if (checked) next.add(person.personId);
  else next.delete(person.personId);
  return next;
}

export function selectAllEligibleAudience(people: AudienceSelectablePerson[], checked: boolean) {
  return checked
    ? new Set(people.filter((person) => person.emailValido).map((person) => person.personId))
    : new Set<string>();
}

export function selectedAudienceIds(selected: Set<string>) {
  return [...selected];
}

export function resetAudienceView() {
  return { page: 0, selected: new Set<string>() };
}
