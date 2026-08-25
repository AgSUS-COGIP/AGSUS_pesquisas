import { describe, expect, it } from "vitest";
import {
  EMAIL_AUDIENCE_PAGE_SIZE,
  audiencePage,
  resetAudienceView,
  selectAllEligibleAudience,
  selectedAudienceIds,
  toggleAudiencePerson,
} from "./email-audience-view";

const people = Array.from({ length: 160 }, (_, index) => ({
  personId: `pessoa-${index + 1}`,
  emailValido: index !== 4,
}));

describe("paginação da audiência de e-mails", () => {
  it("monta no máximo 75 linhas por página", () => {
    const page = audiencePage(people, 0);
    expect(page.items).toHaveLength(EMAIL_AUDIENCE_PAGE_SIZE);
    expect(page).toMatchObject({ page: 0, totalPages: 3, start: 1, end: 75, total: 160 });
  });

  it("limita uma página que deixou de existir após recarga", () => {
    expect(audiencePage(people.slice(0, 10), 8)).toMatchObject({ page: 0, start: 1, end: 10 });
  });
});

describe("seleção da audiência de e-mails", () => {
  it("seleciona e desmarca uma pessoa", () => {
    const selected = toggleAudiencePerson(new Set(), people[0], true);
    expect([...selected]).toEqual(["pessoa-1"]);
    expect(toggleAudiencePerson(selected, people[0], false).size).toBe(0);
  });

  it("não seleciona pessoa sem e-mail válido", () => {
    expect(toggleAudiencePerson(new Set(), people[4], true).size).toBe(0);
  });

  it("seleciona todas as elegíveis e exclui quem não tem e-mail", () => {
    const selected = selectAllEligibleAudience(people, true);
    expect(selected.size).toBe(159);
    expect(selected.has("pessoa-5")).toBe(false);
  });

  it("preserva seleções feitas em páginas diferentes", () => {
    const firstPagePerson = audiencePage(people, 0).items[0];
    const secondPagePerson = audiencePage(people, 1).items[0];
    const selected = toggleAudiencePerson(
      toggleAudiencePerson(new Set(), firstPagePerson, true),
      secondPagePerson,
      true,
    );
    expect([...selected]).toEqual(["pessoa-1", "pessoa-76"]);
  });

  it("troca de filtro, ciclo ou busca volta à primeira página sem seleção", () => {
    const reset = resetAudienceView();
    expect(reset.page).toBe(0);
    expect(reset.selected.size).toBe(0);
  });

  it("entrega ao envio exatamente os IDs selecionados", () => {
    expect(selectedAudienceIds(new Set(["pessoa-2", "pessoa-91"]))).toEqual(["pessoa-2", "pessoa-91"]);
  });
});
