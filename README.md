# AgSUS Pesquisas

Plataforma institucional de pesquisas, avaliações e formulários da **AgSUS** (Agência Brasileira de Apoio à Gestão do SUS).

O **CDDI 2026** (Ciclo de Devolutivas e Desenvolvimento Individual) é o primeiro módulo em produção. A arquitetura é genérica: novas pesquisas, ciclos, públicos e formulários são criados por configuração no banco, sem duplicar páginas ou regras.

---

## Sumário

- [Visão geral](#visão-geral)
- [Arquitetura do sistema](#arquitetura-do-sistema)
- [Estrutura de diretórios](#estrutura-de-diretórios)
- [Tecnologias utilizadas](#tecnologias-utilizadas)
- [Dependências](#dependências)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Instalação](#instalação)
- [Ambiente de desenvolvimento](#ambiente-de-desenvolvimento)
- [Build de produção](#build-de-produção)
- [Testes](#testes)
- [Depuração](#depuração)
- [Fluxo geral da aplicação](#fluxo-geral-da-aplicação)
- [Relações entre módulos](#relações-entre-módulos)
- [Convenções de código](#convenções-de-código)
- [Documentação complementar](#documentação-complementar)
- [Observações e Melhorias Sugeridas](#observações-e-melhorias-sugeridas)

---

## Visão geral

A plataforma entrega cinco capacidades integradas:

1. **Identidade e acesso institucional** — login Google restrito ao domínio corporativo, vinculação automática da conta a um cadastro em `people`.
2. **Gestão de pesquisas, versões e ciclos** — construtor de formulários, versionamento e máquina de estados do ciclo de aplicação.
3. **Definição de público, papéis e hierarquias** — participantes por aplicação, papéis globais, vínculos de liderança.
4. **Experiência segura de resposta** — formulários com autossalvamento, rascunho, validação por etapa e envio definitivo.
5. **Resultados, painéis e auditoria** — indicadores por instrumento, painel específico do CDDI, trilha de eventos.

Três decisões estruturantes explicam quase todo o código:

| Decisão | Consequência prática |
|---|---|
| **Toda lógica de negócio vive no PostgreSQL** | O frontend não faz `select`/`insert` direto em tabelas de negócio. Chama RPCs (`supabase.rpc(...)`) que validam identidade, papel, escopo e período antes de gravar. |
| **A matrícula é o identificador da pessoa, não o e-mail** | A base oficial contém e-mails repetidos entre matrículas distintas. Ver [docs/auditoria-base-cddi-2026.md](docs/auditoria-base-cddi-2026.md). |
| **Autorização é resolvida em uma única chamada** | `get_my_platform_context()` devolve pessoa, papéis, módulos e participação. O resultado governa navegação, permissões e telas. |

## Arquitetura do sistema

```text
┌─ Navegador ────────────────────────────────────────────────────────┐
│  Next.js App Router (React 19, componentes "use client")            │
│    · PlatformShell ....... casca visual, navegação por módulo       │
│    · usePlatformContext .. identidade e permissões (cache 2 min)    │
│    · @supabase/ssr ....... cliente autenticado por cookie          │
└───────────────┬─────────────────────────────────┬──────────────────┘
                │ supabase.rpc(...)                │ fetch /api/...
                │ (JWT do usuário, RLS ativa)      │ (rotas de servidor)
                ▼                                  ▼
┌─ Supabase / PostgreSQL ──────────┐   ┌─ Route Handlers (Node) ─────┐
│  Tabelas + RLS por pessoa/papel  │   │  /api/admin/import-…        │
│  RPCs SECURITY DEFINER           │   │    token + service role     │
│    · contexto e acesso            │   │  /api/observability/errors  │
│    · runtime de formulários       │   │    grava tl_erro_aplicacao  │
│    · construtor e ciclo           │   │  /api/health                │
│    · painéis e auditoria          │   │  /api/background/[id]       │
│  Auth (Google OAuth, PKCE)        │   │  /auth/confirm  (callback)  │
│  Views institucionais DB_PESQUISAS│   └─────────────────────────────┘
└──────────────────────────────────┘
                ▲
                │ proxy.ts (Next.js middleware) — sessão + guarda de rota
                └───────────────────────────────────────────────────────
```

**Camadas e responsabilidades**

| Camada | Localização | Responsabilidade |
|---|---|---|
| Proxy de borda | [proxy.ts](proxy.ts), [src/lib/supabase/proxy.ts](src/lib/supabase/proxy.ts) | Renova a sessão, redireciona anônimos para `/acesso`, aplica cabeçalhos de segurança. |
| Rotas e telas | [src/app/](src/app/) | Uma pasta por jornada. Componentes de cliente que orquestram RPCs. |
| Casca e design system | [src/components/](src/components/) | `PlatformShell`, primitivos acessíveis em `ui/`, blocos administrativos. |
| Domínio no cliente | [src/lib/](src/lib/) | Funções puras testáveis (validação, ordenação, normalização) e clientes Supabase. |
| Banco e regras | [supabase/migrations/](supabase/migrations/) | Esquema, RLS, RPCs, triggers, views institucionais. Fonte da verdade das regras. |
| Qualidade | [scripts/](scripts/), [.github/workflows/validate.yml](.github/workflows/validate.yml) | Quality gates de nomenclatura, migrations, testes, lint, build e RLS. |

## Estrutura de diretórios

```text
agsus-pesquisas/
├── CLAUDE.md                     # Visão geral para sessões de IA (índice de módulos)
├── README.md                     # Este documento
├── proxy.ts                      # Middleware do Next.js (nome exigido pelo Next 16)
├── next.config.ts                # React Strict Mode, hosts de imagem permitidos
├── vercel.json                   # Deploy automático apenas a partir de main
├── eslint.config.mjs             # next/core-web-vitals + next/typescript
├── tsconfig.json                 # strict, alias @/* → ./src/*
├── postcss.config.mjs            # Tailwind CSS v4 via @tailwindcss/postcss
├── .env.example                  # Contrato de variáveis de ambiente
│
├── docs/                         # Decisões de produto, dados e design
│
├── scripts/                      # Quality gates executáveis
│   ├── validate-db-naming.mjs    # Nomenclatura institucional em migrations alteradas
│   └── validate-migrations.mjs   # Formato e unicidade dos timestamps
│
├── supabase/
│   ├── CLAUDE.md
│   ├── migrations/               # SQL versionado — regras de negócio e RLS
│   └── tests/                    # pgTAP: RLS obrigatória em tabelas expostas
│
└── src/
    ├── app/                      # App Router
    │   ├── CLAUDE.md
    │   ├── layout.tsx            # Layout raiz, bootstrap de tema/sidebar
    │   ├── page.tsx              # Redireciona para /acesso
    │   ├── error.tsx  global-error.tsx  not-found.tsx  loading.tsx
    │   ├── *.css                 # Tokens e temas globais
    │   ├── acesso/               # Login Google institucional
    │   ├── auth/confirm/         # Callback OAuth (troca de código por sessão)
    │   ├── area/                 # Visão geral do participante
    │   ├── pesquisas/            # Catálogo e runtime genérico de formulários
    │   ├── cddi/                 # Jornada especializada do CDDI (auto e chefia)
    │   ├── equipe/               # Área da liderança
    │   ├── paineis/              # Painéis analíticos
    │   ├── resultados/           # Devolutivas individuais (placeholder)
    │   ├── perfil/               # Identidade visual e dados funcionais
    │   ├── admin/                # Central administrativa
    │   │   └── CLAUDE.md
    │   └── api/                  # Route Handlers
    │       └── CLAUDE.md
    ├── components/
    │   ├── CLAUDE.md
    │   └── ui/                   # Primitivos do design system
    └── lib/
        ├── CLAUDE.md
        └── supabase/             # Fábricas de cliente (browser, server, admin, proxy)
```

## Tecnologias utilizadas

| Camada | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js | `24.x` (fixado em `engines`) |
| Framework | Next.js (App Router) | `16.2.12` |
| UI | React / React DOM | `19.2.8` |
| Linguagem | TypeScript (modo `strict`) | `^6.0.0` |
| Estilo | Tailwind CSS v4 + CSS custom properties | `^4.3.3` |
| Backend | Supabase (PostgreSQL, Auth, RLS) | `@supabase/supabase-js 2.112.0`, `@supabase/ssr 0.12.4` |
| Estado de servidor | TanStack React Query | `^5.101.4` |
| Testes | Vitest | `^3.2.4` |
| Hospedagem | Vercel | — |

## Dependências

**Produção** — `@dicebear/core` e `@dicebear/styles` (avatares gerados), `@hookform/resolvers` + `react-hook-form` + `zod` (formulários e validação), `@tanstack/react-query`, `@tanstack/react-table`, `class-variance-authority` + `clsx` + `tailwind-merge` (variantes de classe), `cmdk` (paleta de comandos), `lucide-react` (ícones), `sonner` (toasts), `xlsx` (leitura de planilhas na importação).

**Desenvolvimento** — `eslint` + `eslint-config-next`, `tailwindcss` + `@tailwindcss/postcss`, `typescript`, `vitest`, tipos de Node e React.

> `@hookform/resolvers`, `react-hook-form`, `zod` e `@tanstack/react-table` estão declarados mas não são importados pelo código atual. Ver [Observações e Melhorias Sugeridas](#observações-e-melhorias-sugeridas).

## Variáveis de ambiente

Copie [.env.example](.env.example) para `.env.local` e preencha os valores.

| Variável | Escopo | Obrigatória | Finalidade |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Navegador + servidor | Sim | URL do projeto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Navegador + servidor | Sim | Chave pública. Toda leitura/escrita passa por RLS. |
| `SUPABASE_URL` | Servidor | Não | Alternativa à variável pública nas rotas administrativas. |
| `SUPABASE_SECRET_KEY` | **Servidor** | Sim (rotas admin) | Chave secreta moderna, usada por `createAdminSupabaseClient()`. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Servidor** | Sim (rotas admin) | Nome legado, aceito como alternativa à anterior. |
| `ADMIN_IMPORT_TOKEN` | **Servidor** | Sim (importação) | Token comparado em tempo constante em `/api/admin/import-participants`. |
| `NEXT_PUBLIC_SITE_URL` | Navegador | Não | URL canônica de produção. |
| `ALLOWED_INSTITUTIONAL_DOMAINS` | Banco de dados | Não | Lida pela função SQL de acesso institucional. Padrão: `agenciasus.org.br,agsus.org.br`. |

> **Segurança.** `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` e `ADMIN_IMPORT_TOKEN` **nunca** podem receber o prefixo `NEXT_PUBLIC_`, ser importados por componentes de cliente nem ser gravados no repositório. Sem essas chaves a aplicação sobe, mas `/api/health` responde `503 degraded` e a importação de base falha.

**Sem as variáveis públicas configuradas** o proxy devolve `503` em rotas privadas e permite apenas `/`, `/acesso`, `/auth/confirm` e `/api/health`.

## Instalação

Pré-requisitos: **Node.js 24.x**, **npm 11+** e um projeto Supabase acessível. Para trabalhar no banco localmente, também a [Supabase CLI](https://supabase.com/docs/guides/cli) (o CI usa a versão `2.109.1`).

```bash
git clone <url-do-repositorio>
cd agsus-pesquisas

npm ci                    # instala exatamente o que está em package-lock.json
cp .env.example .env.local
# preencha .env.local com as credenciais do Supabase
```

Use `npm ci` (não `npm install`) para reproduzir o lockfile — é o comando usado pelo CI.

## Ambiente de desenvolvimento

```bash
npm run dev
```

A aplicação fica disponível em `http://localhost:3000` e redireciona para `/acesso`.

Para autenticar em desenvolvimento, o provedor Google do projeto Supabase precisa aceitar `http://localhost:3000/auth/confirm` como URL de redirecionamento.

Comandos de verificação:

```bash
npm run lint              # ESLint
npm run typecheck         # tsc --noEmit
npm test                  # Vitest (execução única)
npm run test:watch        # Vitest em modo observação
npm run db:migrations     # formato e unicidade dos timestamps das migrations
npm run db:naming         # nomenclatura institucional nas migrations alteradas
```

Banco de dados local (opcional, requer Docker + Supabase CLI):

```bash
supabase init             # apenas se supabase/config.toml não existir
supabase start
supabase db reset         # reconstrói o banco a partir de supabase/migrations
supabase test db          # testes pgTAP de supabase/tests
supabase stop --no-backup
```

## Build de produção

```bash
npm run build             # compila para .next/
npm start                 # serve o build compilado
```

`npm run build` exige `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` definidas — o CI usa valores de placeholder porque nenhuma página consulta o Supabase em tempo de build.

**Deploy.** [vercel.json](vercel.json) habilita deploy automático **somente** para a branch `main`. Todas as variáveis de ambiente devem estar configuradas no projeto Vercel.

Fluxo de branches: `main` (estável) ← `develop` (integração) ← `feature/*`.

## Testes

Vitest sem arquivo de configuração próprio: os testes ficam ao lado do código em `src/**/*.test.ts` e cobrem apenas **funções puras** — nenhum teste toca rede, DOM ou banco.

```bash
npm test                  # todos os testes
npm run test:watch        # modo observação
npx vitest run src/lib/people-import.test.ts   # arquivo específico
```

| Arquivo | O que garante |
|---|---|
| [src/lib/auth-callback.test.ts](src/lib/auth-callback.test.ts) | Redirecionamento pós-login não aceita destinos externos; compatibilidade do fluxo PKCE. |
| [src/lib/avatar-config.test.ts](src/lib/avatar-config.test.ts) | Metadados de avatar inválidos degradam para padrões seguros. |
| [src/lib/people-import.test.ts](src/lib/people-import.test.ts) | Aliases de coluna, datas reinterpretadas pelo leitor de CSV, duplicidades e elegibilidade de acesso. |
| [src/lib/platform-modules.test.ts](src/lib/platform-modules.test.ts) | Precedência entre papéis, módulos explícitos e liderança. |
| [src/lib/platform-navigation.test.ts](src/lib/platform-navigation.test.ts) | Menu exibe só o permitido; rota exata não ativa páginas aninhadas. |
| [src/lib/platform-sidebar.test.ts](src/lib/platform-sidebar.test.ts) | Preferência de sidebar compartilha chave e atributo com a casca. |
| [src/lib/platform-theme.test.ts](src/lib/platform-theme.test.ts) | Normalização e resolução de tema claro/escuro/sistema. |
| [src/lib/reliable-save-queue.test.ts](src/lib/reliable-save-queue.test.ts) | Fila serializa operações e preserva o último erro. |
| [src/lib/survey-builder.test.ts](src/lib/survey-builder.test.ts) | Limites e validações de seções, perguntas e alternativas. |
| [src/lib/survey-catalog.test.ts](src/lib/survey-catalog.test.ts) | Estado, prioridade e roteamento dos itens do catálogo. |
| [src/lib/survey-visual-identity.test.ts](src/lib/survey-visual-identity.test.ts) | Identidade visual personalizada rejeita URLs não-HTTPS. |
| [src/lib/supabase/admin.test.ts](src/lib/supabase/admin.test.ts) | Detecção das variáveis administrativas modernas e legadas. |

**Testes de banco** ficam em [supabase/tests/](supabase/tests/) e rodam via `supabase test db` (pgTAP). O teste atual assegura que nenhuma tabela do schema `public` fique sem RLS.

**CI.** [.github/workflows/validate.yml](.github/workflows/validate.yml) executa dois jobs: *Application validation* (`db:migrations` → `db:naming` → `test` → `typecheck` → `lint` → `build`) e *Supabase migrations and RLS* (`supabase db reset` → `supabase test db`).

## Depuração

- **Erros de aplicação** são capturados por `ClientErrorReporter` (erros globais e promises rejeitadas), `error.tsx` (rota) e `global-error.tsx` (layout raiz). Cada falha ganha uma **referência técnica** exibida na tela e persistida em `tl_erro_aplicacao` via `POST /api/observability/errors`. Busque pela referência no banco para achar o registro.
- **Sanitização.** `sanitizeObservabilityText()` remove e-mails, sequências de 5+ dígitos e tokens `Bearer` antes de enviar. Relatórios idênticos são deduplicados por 30 s.
- **Configuração.** `GET /api/health` retorna `200 ok` ou `503 degraded` com a lista de variáveis ausentes.
- **Permissões.** Se uma tela aparece vazia ou nega acesso, inspecione o retorno de `get_my_platform_context` no console — `status`, `roles` e `modules` explicam o comportamento. O cache de 2 minutos pode ser descartado com `invalidatePlatformContext()`.
- **Erros de RPC** chegam como `PostgrestError`; a mensagem vem do `raise exception` da função SQL. Para reproduzir, execute a função no SQL Editor do Supabase com uma sessão autenticada.
- **Estado do formulário.** No CDDI e no runtime genérico, o rodapé indica `Salvando rascunho…`, `Falha ao salvar` ou o horário do último salvamento.

## Fluxo geral da aplicação

### Inicialização

1. `proxy.ts` intercepta a requisição e chama `updateSession()`, que renova os cookies da sessão Supabase, aplica cabeçalhos de segurança (`no-store`, `nosniff`, `DENY`, `Referrer-Policy`, `Permissions-Policy`) e redireciona usuários não autenticados para `/acesso?next=…`.
2. `src/app/layout.tsx` injeta dois scripts `beforeInteractive` que leem `localStorage` e aplicam tema e estado da sidebar **antes** da primeira pintura, evitando flash.
3. `AppProviders` monta `QueryClientProvider`, `ClientErrorReporter`, `PlatformInteractionLayer`, `NetworkStatusBanner` e `Toaster`.
4. A página chama `usePlatformContext()`, que executa `get_my_platform_context()`. Se o retorno for `UNLINKED`, chama `resolve_authenticated_person(null)` para criar o vínculo institucional e recarrega o contexto.
5. `deriveModules(context)` resolve os módulos visíveis e `PlatformShell` renderiza apenas a navegação permitida.

### Autenticação

```text
/acesso → signInWithOAuth(google, hd=agenciasus.org.br)
        → Google
        → /auth/confirm?code=…&next=…
            exchangeCodeForSession(code)
            valida domínio do e-mail (agenciasus.org.br)
            domínio inválido → signOut() + /acesso?erro=dominio-nao-autorizado
        → redirect(next)   # safeAuthNext() bloqueia destinos externos
```

### Resposta a um formulário

```text
/pesquisas  →  list_my_survey_catalog()
   ├── surveyCode === "CDDI"  →  /cddi          (jornada especializada)
   └── caso contrário         →  /pesquisas/[applicationCode]  (runtime genérico)

runtime:
  get_public_survey_form(code)              estrutura pública, sem dados pessoais
  start_or_resume_my_survey_submission()    cria ou retoma o rascunho
  save_my_survey_answer(...)                autossalvamento serializado
  submit_my_survey_submission(id)           envio definitivo (irreversível)
```

O CDDI adiciona duas etapas exclusivas: seleção da chefia imediata (`get_my_cddi_identity`, `search_cddi_leaders`, `set_my_cddi_leader`) e a avaliação de chefia em `/cddi/chefia/[personId]`.

### Administração de um ciclo

```text
/admin/pesquisas/nova            create_survey_draft
/admin/pesquisas/[surveyId]      get_survey_builder → seções, perguntas, alternativas
                     identidade  update_application_visual_settings
                     operacao    get_survey_operations → manage_survey_cycle
                                 (UPDATE_PERIOD · PUBLISH · SCHEDULE · OPEN
                                  REOPEN · CLOSE · CANCEL)
```

A estrutura só é editável enquanto a versão está em rascunho; `validate_survey_version_integrity` bloqueia a publicação de instrumentos inconsistentes.

### Importação da base institucional

```text
/admin/importacao   lê CSV/XLSX no navegador (xlsx)
                    parsePeopleImportRows() + summarizePeopleImport()
                    envia lotes de 200 linhas com x-admin-import-token
/api/admin/import-participants
                    sync_people_base_rows      atualiza a base mestra
                    sync_cddi_manager_rows     vínculos de gestor
                    data_import_batches / data_import_issues  auditoria
```

A importação **nunca** vincula pessoas a pesquisas automaticamente (`survey_assignment: false`); isso é decisão explícita do administrador em `/admin/participantes`.

## Relações entre módulos

### Componentes centrais

| Componente | Papel | Consumidores |
|---|---|---|
| `usePlatformContext` ([src/lib/platform-context.ts](src/lib/platform-context.ts)) | Única fonte de identidade e permissões no cliente. Cache de 2 min e deduplicação de chamadas concorrentes. | Praticamente todas as páginas autenticadas |
| `PlatformShell` ([src/components/platform-shell.tsx](src/components/platform-shell.tsx)) | Casca visual: sidebar, cabeçalho, drawer móvel, logout, skip link. | Todas as telas internas |
| `createBrowserSupabaseClient` ([src/lib/supabase/client.ts](src/lib/supabase/client.ts)) | Cliente singleton autenticado por cookie. | Toda chamada RPC do navegador |
| `resolvePlatformModules` ([src/lib/platform-modules.ts](src/lib/platform-modules.ts)) | Traduz papéis em módulos visíveis. | `platform-context`, navegação, guardas de página |
| `get_my_platform_context` (SQL) | Contrato de autorização servidor→cliente. | `platform-context` |

### Dependências entre camadas

```text
app/**            →  components/**  →  components/ui/**
   │                     │
   │                     └──────────→  lib/utils, lib/platform-*
   └──────────────────→  lib/**      →  lib/supabase/client
                                          │
                                          ▼
                                    Supabase (RPC + RLS)

app/api/**        →  lib/supabase/admin   (service role, nunca no cliente)
proxy.ts          →  lib/supabase/proxy
```

Regras respeitadas em todo o código:

- `src/lib/**` não importa de `src/components/**` nem de `src/app/**`. Exceção deliberada: `platform-navigation.ts` importa apenas o *tipo* `PlatformIconName`.
- `src/components/ui/**` não conhece Supabase nem regras de negócio.
- `lib/supabase/admin.ts` só é importado por Route Handlers (`src/app/api/**`).

### Pontos de entrada

| Entrada | Arquivo | Observação |
|---|---|---|
| Middleware | [proxy.ts](proxy.ts) | Next.js 16 renomeou `middleware.ts` → `proxy.ts`. |
| Layout raiz | [src/app/layout.tsx](src/app/layout.tsx) | Metadados, viewport, bootstrap de preferências. |
| Rota `/` | [src/app/page.tsx](src/app/page.tsx) | Redireciona para `/acesso`. |
| Callback OAuth | [src/app/auth/confirm/route.ts](src/app/auth/confirm/route.ts) | Troca código por sessão e valida o domínio. |
| Health check | [src/app/api/health/route.ts](src/app/api/health/route.ts) | Rota pública de diagnóstico. |

## Convenções de código

**Arquivos e nomes**

- Arquivos em `kebab-case.tsx`; componentes e tipos em `PascalCase`; funções e variáveis em `camelCase`; constantes de módulo em `SCREAMING_SNAKE_CASE`.
- Testes ao lado do código: `nome.ts` → `nome.test.ts`.
- Rotas em **português** (`/pesquisas`, `/equipe`, `/acessos`); identificadores de código em **inglês** (`applicationCode`, `submissionStatus`).
- Import alias `@/*` → `./src/*`. Sempre preferir o alias a caminhos relativos longos.

**React e dados**

- Componentes que usam hooks, `window` ou Supabase declaram `"use client"` na primeira linha.
- Padrão de carregamento assíncrono: flag `active` + cleanup para descartar respostas de componentes desmontados.
- Estados obrigatórios em toda consulta: carregando (`PlatformSkeleton`), sucesso com dados, vazio (`EmptyState`), erro recuperável e ausência de permissão.
- Mensagens ao usuário sempre em **português**, dizendo o que aconteceu e o que fazer. `toast` (sonner) para retorno de ação; estado local para erros de formulário.
- Datas formatadas com `Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" })`.
- Enums de domínio (`DRAFT`, `SUBMITTED`, `OPEN`, `CLOSED`) trafegam em maiúsculas, iguais ao banco.

**Estilo**

- Tailwind utilitário + variáveis CSS (`var(--brand-primary)`, `var(--surface-card)`) definidas em [src/app/globals.css](src/app/globals.css) e arquivos de tema. Não repetir hexadecimais quando existir token.
- Classes compostas via `cn()` ([src/lib/utils.ts](src/lib/utils.ts)); variantes via `class-variance-authority`.
- Alvo interativo mínimo de 44 px, foco visível, `aria-label` em botões só com ícone, respeito a `prefers-reduced-motion`.

**Banco de dados**

- Nomenclatura institucional obrigatória para **novos** objetos (prefixos `tb_`, `sq_`, `ds_`, `pk_`, `fc_`…). Objetos legados permanecem e são catalogados. Ver [docs/database-naming-standard.md](docs/database-naming-standard.md).
- Nome do arquivo de migration: `AAAAMMDDHHMMSS_nome_em_snake_case.sql`, timestamp único.
- Toda migration precisa habilitar RLS em tabelas expostas, nomear políticas e constraints, fixar `search_path` em funções privilegiadas e revogar `EXECUTE` de `anon`/`authenticated` em funções internas.
- Nunca gravar credenciais, tokens ou dados pessoais no repositório.

## Documentação complementar

| Documento | Conteúdo |
|---|---|
| [docs/visao-produto-e-arquitetura.md](docs/visao-produto-e-arquitetura.md) | Posicionamento, princípios, arquitetura-alvo, roadmap, critérios de pronto. |
| [docs/modelo-dados-cddi.md](docs/modelo-dados-cddi.md) | Mapeamento das planilhas oficiais para o modelo relacional. |
| [docs/auditoria-base-cddi-2026.md](docs/auditoria-base-cddi-2026.md) | Auditoria da base, decisão sobre identidade de acesso, pesos do cálculo. |
| [docs/acesso-institucional.md](docs/acesso-institucional.md) | Autenticação por domínio e autorização por aplicação. |
| [docs/database-naming-standard.md](docs/database-naming-standard.md) | Padrão de nomenclatura e requisitos de segurança das migrations. |
| [docs/design-system.md](docs/design-system.md) | Tokens, semântica de estado, componentes-base, acessibilidade. |
| [docs/equipe-tecnica-fluxos.md](docs/equipe-tecnica-fluxos.md) | Fluxos funcionais de gestão de equipe e de pesquisas. |
| [docs/formulario-cddi-ui.md](docs/formulario-cddi-ui.md) | Experiência do formulário CDDI. |
| [docs/referencias-visuais.md](docs/referencias-visuais.md) | Referências de experiência (AgSUS Monitora, Index original). |

Para desenvolvimento assistido por IA, cada módulo tem um `CLAUDE.md` com contexto reduzido: [raiz](CLAUDE.md) · [src/app](src/app/CLAUDE.md) · [src/app/admin](src/app/admin/CLAUDE.md) · [src/app/api](src/app/api/CLAUDE.md) · [src/components](src/components/CLAUDE.md) · [src/lib](src/lib/CLAUDE.md) · [supabase](supabase/CLAUDE.md) · [scripts](scripts/CLAUDE.md) · [docs](docs/CLAUDE.md).

---

## Observações e Melhorias Sugeridas

Levantamento feito durante a documentação. **Nenhum item abaixo foi alterado** — todos preservam o comportamento atual e ficam registrados para decisão da equipe.

### Código não utilizado

Nenhum destes arquivos é importado por código de produção:

| Arquivo | Situação |
|---|---|
| [src/components/platform-command-menu.tsx](src/components/platform-command-menu.tsx) | Paleta de comandos (Ctrl+K) completa e funcional, nunca renderizada. |
| [src/components/admin-module-page.tsx](src/components/admin-module-page.tsx) | Casca genérica de página administrativa; cada página `/admin/*` reimplementa a guarda de módulo inline. |
| [src/components/admin-participants-table.tsx](src/components/admin-participants-table.tsx) | Tabela de participantes substituída por `admin-participant-management.tsx`. |
| [src/components/cddi-visual-banner.tsx](src/components/cddi-visual-banner.tsx) | Substituído por `survey-banner.tsx`. |
| [src/components/avatar-uploader.tsx](src/components/avatar-uploader.tsx) | Chama `set_my_avatar_url`, mas a migration `20260805194500_block_uploaded_profile_photos.sql` passou a bloquear fotos enviadas — o fluxo atual usa `avatar-studio.tsx`. |
| [src/components/ui/tabs.tsx](src/components/ui/tabs.tsx) | Primitivo acessível pronto, sem consumidores. Exporta `TabButtonProps`, tipo sem uso. |
| [src/lib/survey-catalog.ts](src/lib/survey-catalog.ts) | Coberto por 10 testes, importado apenas pelo próprio teste. |
| [src/lib/reliable-save-queue.ts](src/lib/reliable-save-queue.ts) | Coberto por 4 testes, importado apenas pelo próprio teste. |

**Sugestão:** decidir caso a caso entre adotar (ex.: renderizar `PlatformCommandMenu` no `PlatformShell`) e remover. Manter código testado mas morto dá falsa sensação de cobertura.

### Duplicação de lógica

1. **Estado do catálogo de pesquisas reimplementado três vezes.** `itemState`, `applicationHref` e a ordenação por prioridade aparecem inline em [src/app/area/page.tsx](src/app/area/page.tsx#L45-L55) e [src/app/pesquisas/page.tsx](src/app/pesquisas/page.tsx), enquanto [src/lib/survey-catalog.ts](src/lib/survey-catalog.ts) já contém exatamente essas funções — testadas. Consolidar remove a chance de as telas divergirem.

2. **Duas filas de autossalvamento.** [src/app/pesquisas/[applicationCode]/page.tsx](src/app/pesquisas/[applicationCode]/page.tsx#L117-L147) implementa serialização de gravações inline; `ReliableSaveQueue` faz o mesmo com testes e notificação de estado. O CDDI usa uma terceira abordagem (timers por pergunta, sem serialização).

3. **Dois componentes `Dialog` distintos.** [src/components/ui/dialog.tsx](src/components/ui/dialog.tsx) usa `<dialog>` nativo; [src/components/ui/overlay-panel.tsx](src/components/ui/overlay-panel.tsx) exporta `Dialog` e `Drawer` com focus trap manual. Importar "Dialog" do arquivo errado gera comportamento inesperado.

4. **Diálogos ad hoc.** `/equipe` e componentes admin constroem modais manualmente em vez de usar `OverlayPanel`, perdendo focus trap, `Escape` e bloqueio de scroll consistentes.

5. **`metadataText()` repetido** em [src/app/area/page.tsx](src/app/area/page.tsx#L30-L36) e [src/app/perfil/page.tsx](src/app/perfil/page.tsx#L9-L15) com implementação idêntica.

### Inconsistências

1. **Domínio institucional divergente.** [src/app/auth/confirm/route.ts](src/app/auth/confirm/route.ts#L12) fixa `ALLOWED_DOMAIN = "agenciasus.org.br"` no código, enquanto [docs/acesso-institucional.md](docs/acesso-institucional.md) documenta `ALLOWED_INSTITUTIONAL_DOMAINS` aceitando `agenciasus.org.br,agsus.org.br`. Uma conta `@agsus.org.br` seria aceita pela função SQL e rejeitada pelo callback.

2. **Atalhos de teclado inativos.** `PlatformInteractionLayer` filtra atalhos por `modules`, mas [src/components/app-providers.tsx](src/components/app-providers.tsx#L29) o monta sem a prop — `allowedShortcuts` fica sempre vazio e nenhum atalho `Alt+1..4`/`Alt+A` funciona.

3. **Dois avisos de offline simultâneos.** `PlatformInteractionLayer` e `NetworkStatusBanner` mostram banners próprios ao perder conexão; ambos são renderizados por `AppProviders`.

4. **`/cddi/README.md` desatualizado.** Afirma que "a persistência definitiva depende da autenticação institucional", mas o envio já está implementado (`submit_my_cddi_submission`). O mesmo vale para o último parágrafo de [docs/formulario-cddi-ui.md](docs/formulario-cddi-ui.md).

5. **`supabase/migrations/README.md` desatualizado.** Diz que "a primeira migration será criada após a modelagem"; existem 48 migrations aplicadas.

6. **Rascunho em `sessionStorage`.** [docs/formulario-cddi-ui.md](docs/formulario-cddi-ui.md) cita salvamento em `sessionStorage`; o código atual persiste direto no banco via `save_my_cddi_answer`.

7. **Ciclo CDDI descrito como encerrado** em texto fixo do painel administrativo ([src/app/admin/page.tsx](src/app/admin/page.tsx#L32)), independente do estado real da aplicação.

8. **Dependências declaradas e não usadas.** `react-hook-form`, `@hookform/resolvers`, `zod` e `@tanstack/react-table` estão em `dependencies` sem nenhum import — os formulários usam estado local e as tabelas usam os primitivos de `ui/data-table.tsx`. Ou adotar as bibliotecas, ou removê-las do bundle.

9. **`@dicebear/core` fixado sem `^`** (`10.3.0` / `10.2.0`) enquanto o restante usa faixas. Provavelmente intencional, mas vale documentar o motivo.

10. **`supabase/config.toml` ausente do repositório.** O CI executa `supabase init` condicionalmente; versionar o arquivo tornaria o ambiente local reprodutível.

### Segurança e robustez

1. **Token administrativo digitado na interface.** [src/app/admin/importacao/page.tsx](src/app/admin/importacao/page.tsx) pede o `ADMIN_IMPORT_TOKEN` em um campo de senha e o envia por header. A comparação no servidor é em tempo constante, mas o segredo circula pelo navegador. Alternativa: autorizar a rota pela sessão do usuário + verificação de papel (`is_platform_administrator()`), como as demais operações.

2. **`/api/admin/import-participants` não valida o formato das linhas.** O corpo é convertido para `RequestBody` com `as` e repassado à RPC. Validar com `zod` (já instalado) daria erro `400` claro em vez de falha no banco.

3. **`isSameOrigin()` aceita requisições sem header `Origin`** em [src/app/api/observability/errors/route.ts](src/app/api/observability/errors/route.ts#L9-L13) — comportamento necessário para `keepalive`; a decisão está registrada em comentário no próprio arquivo.

4. **`window.confirm` para ações destrutivas** (envio definitivo, encerrar ciclo, retirar pessoa da equipe). Funciona, mas não é estilizável nem plenamente acessível; `OverlayPanel` já oferece a base para um diálogo de confirmação próprio.

5. **`/api/background/[id]` faz proxy de imagens do Unsplash** apenas para o plano de fundo da tela de login. Índice validado e cache longo, mas é uma dependência externa em rota pública.

### Manutenibilidade

1. **Arquivos muito grandes.** [src/app/admin/pesquisas/[surveyId]/page.tsx](src/app/admin/pesquisas/[surveyId]/page.tsx) tem ~54 KB e [src/app/paineis/cddi/page.tsx](src/app/paineis/cddi/page.tsx) ~37 KB em um único componente. Extrair editores, tabelas e cartões facilitaria revisão e testes.

2. **JSX em linhas muito longas.** Diversas telas concentram seções inteiras em uma única linha (algumas com mais de 3.000 caracteres), o que inviabiliza diffs legíveis. Reformatar é seguro (não altera comportamento), mas produz um diff grande — decisão da equipe.

3. **Tipagem das RPCs por asserção.** Todo retorno usa `data as T`, sem tipos gerados. `supabase gen types typescript` eliminaria a divergência silenciosa entre banco e frontend.

4. **Cores fora dos tokens.** Hexadecimais literais (`#003b70`, `#086ab6`, `#26368d`) convivem com `var(--brand-primary)`. O tema escuro pode não cobrir os valores fixos.

5. **Sem `vitest.config.ts`.** Funciona com o padrão, mas explicitar `include`, ambiente e cobertura evita surpresas ao crescer a suíte.
