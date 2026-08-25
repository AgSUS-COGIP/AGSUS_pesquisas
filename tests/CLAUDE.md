# Módulo `tests` — jornadas E2E com Playwright

## Objetivo

Validar pelo navegador as jornadas críticas que não cabem em teste unitário: autorização, catálogo, preenchimento, autossalvamento, envio e estados de ciclo.

**Playwright é o único runner desta pasta.** Vitest continua responsável pelos testes unitários em `src/` e `scripts/`; nenhum outro runner E2E deve ser introduzido.

## Estrutura

```text
tests/
├── *.spec.ts              cenários pelo ponto de vista da pessoa usuária
└── support/
    ├── fixtures.ts        extensão do test do Playwright e limpeza por cenário
    ├── db-fixtures.ts     seed isolada com chave de serviço
    ├── global-setup.ts    aquecimento da rota de login antes dos workers
    └── helpers.ts         ações e expectativas compartilhadas
```

[../playwright.config.ts](../playwright.config.ts) define Chromium, paralelismo, retries de CI, relatório HTML e o servidor Next.js. [../vitest.config.ts](../vitest.config.ts) inclui apenas `src/` e `scripts/`, impedindo coleta cruzada dos specs E2E.

## Ambiente obrigatório

Os testes escrevem diretamente no banco com `SUPABASE_SECRET_KEY` ou `SUPABASE_SERVICE_ROLE_KEY`. Execute-os somente contra um Supabase local descartável.

1. Rode `supabase start` e `supabase db reset`.
2. Crie `.env.test.local`, ignorado pelo Git, com URL, chave publicável e chave de serviço do Supabase local.
3. Defina `E2E_TEST_LOGIN_ENABLED=true` nesse ambiente.
4. Pare qualquer `next dev` na porta escolhida ou use `PLAYWRIGHT_PORT` para evitar que o Playwright reutilize um servidor iniciado com outro ambiente.

Nunca copie chaves para um spec, fixture, log, screenshot ou relatório. Nunca aponte `.env.test.local` para produção ou projeto compartilhado.

## Autenticação de teste

A fixture cria primeiro um usuário institucional único. Depois `POST /api/teste-e2e/login` gera e verifica um magic link pelo servidor, estabelecendo o cookie da página sem depender do Google OAuth.

A rota é deliberadamente estreita:

- exige `E2E_TEST_LOGIN_ENABLED=true`;
- devolve `404` sempre que `VERCEL_ENV` existe;
- aceita apenas domínio institucional;
- não cria usuário — autentica somente a identidade criada pela fixture.

O `global-setup.ts` aquece essa rota antes dos workers paralelos para que a compilação sob demanda do Turbopack não invalide links de uso único durante a primeira disputa.

## Convenções

- Importe `test` e `expect` de `./support/fixtures`, não diretamente de `@playwright/test`, quando o cenário precisar de banco ou sessão.
- Cada seed usa identificadores únicos e deve ser registrada para limpeza no teardown da fixture. Não deixe pessoa, pesquisa, ciclo, submissão ou usuário de Auth órfão.
- Se a seed falhar no meio, limpe também o estado parcial. A limpeza é de baixo para cima porque várias FKs são `RESTRICT`.
- Prefira seletores acessíveis (`getByRole`, `getByLabel`, `getByText`) e expectativas observáveis. Não use `waitForTimeout` para sincronização.
- Espere a resposta da API que materializa a ação, como o autossalvamento, em vez de inferir sucesso apenas pela aparência.
- Um spec descreve comportamento de negócio; detalhes repetidos de navegação e preenchimento pertencem a `support/helpers.ts`.
- Mantenha cenários independentes e seguros para `fullyParallel: true`. Um teste não pode depender de dados criados por outro.

## Comandos

```bash
npm run test:e2e          # Chromium headless
npm run test:e2e:ui       # interface do Playwright
npx playwright test tests/rascunho-e-envio.spec.ts
npx playwright test -g "obrigatória sem resposta"
```

Relatórios e traces são regeneráveis e ficam em `playwright-report/` e `test-results/`, ambos ignorados pelo Git.

## Limites

- O E2E não substitui Vitest: regras puras devem falhar rápido sem subir navegador, Next.js ou Supabase.
- O E2E não substitui pgTAP: RLS, ACLs e invariantes SQL precisam ser afirmadas dentro do banco.
- O workflow atual ainda não executa Playwright. Até existir um Supabase isolado no CI, rode a suíte localmente antes de entregar mudanças nas jornadas cobertas.
