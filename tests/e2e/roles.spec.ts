import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { encode } from "@auth/core/jwt";
import pg from "pg";

const PRESETS = {
  ADMINISTRATOR: {
    modules: ["HOME", "SURVEYS", "DASHBOARDS", "TEAM", "ONLINE_PRESENCE", "ADMIN_SURVEYS", "ADMIN_PARTICIPANTS", "ADMIN_TEAMS", "ADMIN_ACCESS", "ADMIN_IMPORT"],
    navigation: ["Visão geral", "Avaliações", "Painéis", "Minha equipe", "Gerenciar avaliações", "Participantes", "E-mails", "Equipes", "Respostas", "Configurações"],
    allowedRoute: "/admin/configuracoes",
  },
  SURVEY_MANAGER: {
    modules: ["HOME", "SURVEYS", "DASHBOARDS", "ONLINE_PRESENCE", "ADMIN_SURVEYS", "ADMIN_PARTICIPANTS"],
    navigation: ["Visão geral", "Avaliações", "Painéis", "Gerenciar avaliações", "Participantes", "E-mails"],
    allowedRoute: "/admin/pesquisas",
    deniedRoute: "/equipe",
  },
  MANAGER: {
    modules: ["HOME", "SURVEYS", "DASHBOARDS", "TEAM"],
    navigation: ["Visão geral", "Avaliações", "Painéis", "Minha equipe"],
    allowedRoute: "/paineis",
    deniedRoute: "/admin/pesquisas",
  },
  LEADER: {
    modules: ["HOME", "SURVEYS", "TEAM"],
    navigation: ["Visão geral", "Avaliações", "Minha equipe"],
    allowedRoute: "/equipe",
    deniedRoute: "/paineis",
  },
  RESPONDENT: {
    modules: ["HOME", "SURVEYS"],
    navigation: ["Visão geral", "Avaliações"],
    allowedRoute: "/pesquisas",
    deniedRoute: "/equipe",
  },
} as const;

type PessoaDeTeste = {
  id: string;
  email: string;
  fullName: string;
  employeeNumber: string;
};

let pessoa: PessoaDeTeste;
let sessionToken: string;

function databaseConfig() {
  const raw = process.env.EMPRESA_DATABASE_URL?.trim();
  if (!raw) throw new Error("EMPRESA_DATABASE_URL não está configurada para o E2E");
  const url = new URL(raw.startsWith("jdbc:") ? raw.slice(5) : raw);
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.replace(/^\//, ""),
    user: process.env.USERNAME_DATABASE_URL?.trim() || url.username,
    password: process.env.PASSWORD_DATABASE_URL?.trim() || url.password,
  };
}

test.beforeAll(async () => {
  const client = new pg.Client(databaseConfig());
  await client.connect();
  try {
    const { rows } = await client.query<PessoaDeTeste>(`
      select u."SQ_USUARIO"::text as id,
             u."DS_EMAIL" as email,
             p."NO_PESSOA" as "fullName",
             p."CO_MATRICULA" as "employeeNumber"
        from sigav."TB_USUARIO_IDENTIDADE" u
        join sigav."TB_PESSOA" p
          on p."SQ_USUARIO_IDENTIDADE" = u."SQ_USUARIO"
         and p."ST_ATIVO"
       order by case when exists (
         select 1
           from sigav."RL_PESSOA_MODULO" pmp
          where pmp."SQ_PESSOA" = p."SQ_PESSOA"
            and pmp."CO_MODULO" = 'ADMIN_ACCESS'
            and pmp."ST_PERMITIDO"
       ) then 0 else 1 end,
       u."DT_INCLUSAO" nulls last
       limit 1
    `);
    if (!rows[0]) throw new Error("nenhuma identidade institucional ativa para o E2E");
    pessoa = rows[0];
  } finally {
    await client.end();
  }

  const cookieName = "authjs.session-token";
  if (!process.env.AUTH_SECRET) throw new Error("AUTH_SECRET não está configurado para o E2E");
  sessionToken = await encode({
    token: { sub: pessoa.id, email: pessoa.email, name: pessoa.fullName },
    secret: process.env.AUTH_SECRET,
    salt: cookieName,
    maxAge: 60 * 60,
  });
});

async function autenticar(context: BrowserContext, baseURL: string) {
  const url = new URL(baseURL);
  await context.addCookies([{
    name: "authjs.session-token",
    value: sessionToken,
    domain: url.hostname,
    path: "/",
    httpOnly: true,
    sameSite: "Lax",
    secure: url.protocol === "https:",
  }]);
}

async function evitarEscritasDeFundo(page: Page) {
  await page.route("**/api/**", async (route) => {
    if (route.request().method() === "GET") return route.fallback();
    return route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

async function simularContexto(page: Page, preset: keyof typeof PRESETS) {
  const profile = PRESETS[preset];
  await page.route("**/api/meu/contexto", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      status: "OK",
      technicalRole: "authenticated",
      roles: ["AUTHENTICATED"],
      modules: profile.modules,
      person: {
        id: pessoa.id,
        employeeNumber: pessoa.employeeNumber,
        fullName: pessoa.fullName,
        institutionalEmail: pessoa.email,
        jobTitle: "Pessoa de teste",
        costCenter: null,
        workplace: null,
        metadata: {},
        avatarUrl: null,
      },
      participant: null,
      application: null,
      canManageSurveys: (profile.modules as readonly string[]).includes("ADMIN_SURVEYS"),
    }),
  }));
}

test("sessão assinada atravessa o proxy e a API consulta o banco com a credencial única", async ({ request, baseURL }) => {
  if (!baseURL) throw new Error("baseURL ausente");
  const response = await request.get(`${baseURL}/api/meu/contexto`, {
    headers: { cookie: `authjs.session-token=${sessionToken}` },
  });
  expect(response.status()).toBe(200);
  const context = await response.json();
  expect(context.status).toBe("OK");
  expect(context.person.id).toBeTruthy();
  expect(context.roles).toHaveLength(1);
  expect(context.modules.length).toBeGreaterThan(0);
});

for (const [preset, profile] of Object.entries(PRESETS) as [keyof typeof PRESETS, (typeof PRESETS)[keyof typeof PRESETS]][]) {
  test(`preset ${preset} vê somente a navegação autorizada`, async ({ page, context, baseURL }) => {
    if (!baseURL) throw new Error("baseURL ausente");
    await autenticar(context, baseURL);
    await evitarEscritasDeFundo(page);
    await simularContexto(page, preset);

    await page.goto(profile.allowedRoute);
    // Em desenvolvimento o Next pode entregar o HTML de carregamento enquanto
    // termina de compilar a rota. Esperar a navegação observável evita confundir
    // esse intervalo legítimo com uma lista de permissões vazia.
    await expect.poll(async () => {
      const labels = await page.locator("aside nav a").allTextContents();
      return labels.map((label) => label.trim()).filter(Boolean);
    }).toEqual(profile.navigation);
    await expect(page.getByText("Acesso restrito", { exact: true })).toHaveCount(0);
  });

  if ("deniedRoute" in profile) {
    test(`preset ${preset} não abre rota fora das suas permissões`, async ({ page, context, baseURL }) => {
      if (!baseURL) throw new Error("baseURL ausente");
      await autenticar(context, baseURL);
      await evitarEscritasDeFundo(page);
      await simularContexto(page, preset);

      await page.goto(profile.deniedRoute);
      await expect(page.getByText(/Acesso restrito|não possui permissão/i).first()).toBeVisible();
    });
  }
}

test("configurações exibem uma role técnica e permissões editáveis", async ({ page, context, baseURL }) => {
  if (!baseURL) throw new Error("baseURL ausente");
  await autenticar(context, baseURL);
  await evitarEscritasDeFundo(page);
  await simularContexto(page, "ADMINISTRATOR");

  const permissions = PRESETS.ADMINISTRATOR.modules.map((code, position) => ({
    code,
    name: code === "ONLINE_PRESENCE" ? "Visualizar presença online" : code,
    description: null,
    category: code.startsWith("ADMIN_") ? "ADMIN" : "MAIN",
    position,
    required: code === "HOME" || code === "SURVEYS",
  }));

  await page.route("**/api/plataforma/acessos**", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      status: "OK",
      technicalRole: "authenticated",
      permissions,
      people: [{
        personId: pessoa.id,
        fullName: pessoa.fullName,
        employeeNumber: pessoa.employeeNumber,
        institutionalEmail: pessoa.email,
        jobTitle: "Pessoa de teste",
        unit: null,
        active: true,
        permissions: [...PRESETS.ADMINISTRATOR.modules],
      }],
      total: 1,
      limit: 50,
      offset: 0,
      hasMore: false,
    }),
  }));

  await page.goto("/admin/configuracoes");
  await page.getByRole("tab", { name: "Acessos" }).click();
  await expect(page.getByText("Todos usam a role técnica")).toBeVisible();
  await expect(page.getByLabel("Preset funcional")).toBeVisible();
  await expect(page.getByRole("columnheader", { name: "Visualizar presença online" })).toBeVisible();
});
