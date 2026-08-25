// Mapa perfil → módulo, verificado de ponta a ponta.
//
// Uma pessoa sem papel algum cai no piso Participante, que só tem `SURVEYS`.
// O mapa vive em dois lugares que precisam concordar — o `case` de
// `fc_obter_contexto_plataforma()` (banco) e `ROLE_MODULES` (interface) —, e é
// exatamente essa concordância que este teste cobre: ele parte de uma pessoa
// real no banco e chega na tela que a guarda decidiu mostrar.

import { test, expect } from "./support/fixtures";

const ROTAS_RESTRITAS = [
  { rota: "/paineis", titulo: "Painéis restritos" },
  { rota: "/admin", titulo: "Central administrativa restrita" },
  { rota: "/admin/pesquisas", titulo: "Gestão de pesquisas restrita" },
  { rota: "/equipe", titulo: "Acesso restrito à liderança" },
];

test.describe("Guarda de módulos do participante", () => {
  for (const { rota, titulo } of ROTAS_RESTRITAS) {
    test(`participante recebe acesso restrito em ${rota}`, async ({ page, surveyFixture }) => {
      // `surveyFixture` serve aqui só para existir uma sessão autenticada — o
      // que está sob teste é o perfil, não a pesquisa.
      expect(surveyFixture.email).toContain("@agenciasus.org.br");

      await page.goto(rota);

      await expect(page.getByRole("heading", { name: titulo })).toBeVisible();
      // `exact` é necessário: sem ele, "Acesso restrito" também casa com o
      // título "Acesso restrito à liderança" e o localizador fica ambíguo.
      await expect(page.getByText("Acesso restrito", { exact: true })).toBeVisible();
    });
  }

  test("participante alcança o catálogo de avaliações", async ({ page, surveyFixture }) => {
    await page.goto("/pesquisas");

    // O contraponto necessário: sem ele, os testes acima passariam mesmo que a
    // guarda estivesse barrando tudo.
    await expect(page.getByText(surveyFixture.surveyName).first()).toBeVisible();
  });

  test("/area redireciona o participante para o catálogo em vez de barrá-lo", async ({ page, surveyFixture }) => {
    expect(surveyFixture.email).toContain("@agenciasus.org.br");

    await page.goto("/area");

    // `/area` exige o módulo HOME, mas trata a ausência redirecionando: barrar
    // a tela inicial de quem tem para onde ir seria um beco sem saída.
    await expect(page).toHaveURL(/\/pesquisas$/);
  });
});
