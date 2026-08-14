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
3. **Definição de público, perfis e hierarquias** — participantes por aplicação, vínculos de liderança e quatro perfis globais **mutuamente exclusivos**: **Participante** (somente o módulo Pesquisas), **Avaliador** (Visão Geral, Pesquisas e Minha Equipe — participa das pesquisas e avalia sua equipe), **Admin** (Visão Geral, Pesquisas, Painéis, Minha Equipe, Resultados, Pesquisas e Ciclos, e Participantes) e **Superadmin** (acesso irrestrito a todos os módulos, incluindo gestão de usuários, perfis e dados institucionais). O acesso é determinado exclusivamente pelo perfil — não há exceção de módulo por pessoa. Os códigos internos no banco (`ADMINISTRATOR`, `SURVEY_MANAGER`, `LEADER`, `RESPONDENT`) são legados preservados por compatibilidade com RLS e RPCs — o frontend usa as constantes de [src/lib/platform-roles.ts](src/lib/platform-roles.ts).
4. **Experiência segura de resposta** — formulários com autossalvamento, rascunho, validação por etapa e envio definitivo.
5. **Resultados, painéis e auditoria** — indicadores por instrumento, painel específico do CDDI, trilha de eventos.

Três decisões estruturantes explicam quase todo o código:

| Decisão | Consequência prática |
|---|---|
| **Toda lógica de negócio vive no PostgreSQL** | O frontend não faz `select`/`insert` direto em tabelas de negócio. Chama RPCs (`supabase.rpc(...)`) que validam identidade, papel, escopo e período antes de gravar. |
| **A matrícula é o identificador da pessoa, não o e-mail** | A base oficial contém e-mails repetidos entre matrículas distintas. Ver [docs/auditoria-base-cddi-2026.md](docs/auditoria-base-cddi-2026.md). |
| **Autorização é resolvida em uma única chamada** | `fc_obter_contexto_plataforma()` devolve pessoa, papéis, módulos e participação. O resultado governa navegação, permissões e telas. |

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
| Consultas cacheadas | [src/hooks/](src/hooks/) | Hooks que combinam React Query com RPCs — o que não é função pura nem componente. |
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
    │   │
    │   │   # Cada pasta de rota tem dois arquivos: o `page.tsx` reservado do
    │   │   # App Router (uma linha, só re-exporta) e a `tela-*.tsx` com o
    │   │   # componente de verdade — é nela que se edita a tela.
    │   │
    │   ├── acesso/               # Login Google institucional
    │   ├── auth/confirm/         # Callback OAuth (troca de código por sessão)
    │   ├── area/                 # Visão geral do participante
    │   ├── pesquisas/            # Catálogo de avaliações e runtime genérico de formulários
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
    ├── hooks/                    # Hooks de consulta (React Query + Supabase)
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

**Produção** — `@hookform/resolvers` + `react-hook-form` + `zod` (formulários e validação), `@tanstack/react-query`, `@tanstack/react-table`, `class-variance-authority` + `clsx` + `tailwind-merge` (variantes de classe), `cmdk` (paleta de comandos), `lucide-react` (ícones), `sonner` (toasts), `xlsx` (sem consumidor desde a remoção da tela de importação).

**Desenvolvimento** — `eslint` + `eslint-config-next`, `tailwindcss` + `@tailwindcss/postcss`, `typescript`, `vitest`, tipos de Node e React.

> `@hookform/resolvers`, `react-hook-form` e `zod` sustentam `/admin/configuracoes` e `/admin/pesquisas/nova`. `@tanstack/react-table` só é importado por um componente sem consumidores, e `xlsx` não é mais importado por ninguém. Ver [Observações e Melhorias Sugeridas](#observações-e-melhorias-sugeridas).

## Variáveis de ambiente

Copie [.env.example](.env.example) para `.env.local` e preencha os valores.

| Variável | Escopo | Obrigatória | Finalidade |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Navegador + servidor | Sim | URL do projeto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Navegador + servidor | Sim | Chave pública. Toda leitura/escrita passa por RLS. |
| `SUPABASE_URL` | Servidor | Não | Alternativa à variável pública nas rotas administrativas. |
| `SUPABASE_SECRET_KEY` | **Servidor** | Sim (rotas admin) | Chave secreta moderna, usada por `createAdminSupabaseClient()`. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Servidor** | Sim (rotas admin) | Nome legado, aceito como alternativa à anterior. |
| `NEXT_PUBLIC_SITE_URL` | Navegador | Não | URL canônica de produção. |
| `ALLOWED_INSTITUTIONAL_DOMAINS` | Banco de dados | Não | Lida pela função SQL de acesso institucional. Padrão: `agenciasus.org.br,agsus.org.br`. |

> **Segurança.** `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` **nunca** podem receber o prefixo `NEXT_PUBLIC_`, ser importados por componentes de cliente nem ser gravados no repositório. Sem essas chaves a aplicação sobe, mas `/api/health` responde `503 degraded`.

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
npx vitest run src/lib/survey-cycle-period.test.ts   # arquivo específico
```

| Arquivo | O que garante |
|---|---|
| [src/lib/auth-callback.test.ts](src/lib/auth-callback.test.ts) | Redirecionamento pós-login não aceita destinos externos; compatibilidade do fluxo PKCE. |
| [src/lib/cddi-question-applicability.test.ts](src/lib/cddi-question-applicability.test.ts) | Perguntas `PERSON` e fora do tipo de submissão não chegam ao formulário. |
| [src/lib/observability.test.ts](src/lib/observability.test.ts) | `errorMessageFromUnknown()` extrai a mensagem do PostgREST e preserva a de erros nativos. |
| [src/lib/platform-branding.test.ts](src/lib/platform-branding.test.ts) | Marca ausente ou inválida cai no padrão institucional; aceita só logotipo seguro e cor `#RRGGBB` completa. |
| [src/lib/platform-modules.test.ts](src/lib/platform-modules.test.ts) | Precedência entre papéis, módulos explícitos e liderança. |
| [src/lib/platform-navigation.test.ts](src/lib/platform-navigation.test.ts) | Menu exibe só o permitido; rota exata não ativa páginas aninhadas. |
| [src/lib/platform-sidebar.test.ts](src/lib/platform-sidebar.test.ts) | Preferência de sidebar compartilha chave e atributo com a casca. |
| [src/lib/platform-theme.test.ts](src/lib/platform-theme.test.ts) | Normalização e resolução de tema claro/escuro/sistema. |
| [src/lib/reliable-save-queue.test.ts](src/lib/reliable-save-queue.test.ts) | Fila serializa operações e preserva o último erro. |
| [src/lib/survey-builder.test.ts](src/lib/survey-builder.test.ts) | Limites e validações de seções, perguntas e alternativas. |
| [src/lib/survey-catalog.test.ts](src/lib/survey-catalog.test.ts) | Estado, prioridade e roteamento dos itens do catálogo. |
| [src/lib/survey-runtime.test.ts](src/lib/survey-runtime.test.ts) | Conversão de resposta por tipo de pergunta, incluindo o fuso do `DATETIME`. |
| [src/lib/survey-visual-identity.test.ts](src/lib/survey-visual-identity.test.ts) | Identidade visual personalizada rejeita URLs não-HTTPS. |
| [src/lib/supabase/admin.test.ts](src/lib/supabase/admin.test.ts) | Detecção das variáveis administrativas modernas e legadas. |
| [src/lib/supabase/client.test.ts](src/lib/supabase/client.test.ts) | Detecção da configuração pública: só há cliente quando URL **e** chave publicável existem. |

**Testes de banco** ficam em [supabase/tests/](supabase/tests/) e rodam via `supabase test db` (pgTAP). O teste atual assegura que nenhuma tabela do schema `public` fique sem RLS.

**CI.** [.github/workflows/validate.yml](.github/workflows/validate.yml) executa dois jobs: *Application validation* (`db:migrations` → `db:naming` → `test` → `typecheck` → `lint` → `build`) e *Supabase migrations and RLS* (`supabase db reset` → `supabase test db`).

## Depuração

- **Erros de aplicação** são capturados por `ClientErrorReporter` (erros globais e promises rejeitadas), `error.tsx` (rota) e `global-error.tsx` (layout raiz). Cada falha ganha uma **referência técnica** exibida na tela e persistida em `tl_erro_aplicacao` via `POST /api/observability/errors`. Busque pela referência no banco para achar o registro.
- **Sanitização.** `sanitizeObservabilityText()` remove e-mails, sequências de 5+ dígitos e tokens `Bearer` antes de enviar. Relatórios idênticos são deduplicados por 30 s.
- **Configuração.** `GET /api/health` retorna `200 ok` ou `503 degraded` com a lista de variáveis ausentes.
- **Permissões.** Se uma tela aparece vazia ou nega acesso, inspecione o retorno de `fc_obter_contexto_plataforma` no console — `status`, `roles` e `modules` explicam o comportamento. O cache de 2 minutos pode ser descartado com `invalidatePlatformContext()`.
- **Erros de RPC** chegam como `PostgrestError`; a mensagem vem do `raise exception` da função SQL. Para reproduzir, execute a função no SQL Editor do Supabase com uma sessão autenticada.
- **Estado do formulário.** No CDDI e no runtime genérico, o rodapé indica `Salvando rascunho…`, `Falha ao salvar` ou o horário do último salvamento.

## Fluxo geral da aplicação

### Inicialização

1. `proxy.ts` intercepta a requisição e chama `updateSession()`, que renova os cookies da sessão Supabase, aplica cabeçalhos de segurança (`no-store`, `nosniff`, `DENY`, `Referrer-Policy`, `Permissions-Policy`) e redireciona usuários não autenticados para `/acesso?next=…`.
2. `src/app/layout.tsx` injeta dois scripts `beforeInteractive` que leem `localStorage` e aplicam tema e estado da sidebar **antes** da primeira pintura, evitando flash.
3. `AppProviders` monta `QueryClientProvider`, `PlatformBrandingProvider` (marca institucional, com cache em `localStorage` para não piscar o padrão), `ConfirmationProvider` (diálogo de confirmação disponível a qualquer tela), `ClientErrorReporter`, `PlatformInteractionLayer`, `NetworkStatusBanner` e `Toaster`.
4. A página chama `usePlatformGuard(módulo?)`, que por baixo usa `usePlatformContext()` e executa `fc_obter_contexto_plataforma()`. Se o retorno for `UNLINKED`, chama `resolve_authenticated_person(null)` para criar o vínculo institucional e recarrega o contexto.
5. A guarda devolve um de quatro estados. Negado (`loading`, `unidentified`, `restricted`) vira `PlatformGuardState`; liberado (`granted`) entrega `user` e `modules` já resolvidos, e `PlatformShell` renderiza apenas a navegação permitida.

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

O CDDI adiciona duas particularidades: a chefia responsável é resolvida automaticamente do vínculo institucional (`get_my_cddi_identity` lê `cddi_leadership_links`, alimentado pela importação da base e por correções administrativas — não há seleção manual pelo participante) e a avaliação de chefia acontece em `/cddi/chefia/[personId]`.

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

A árvore acima é de **rotas**, não de navegação. Os caminhos que a interface realmente oferece são:

```text
/admin/pesquisas  ──[Editar formulário]──▶  /admin/pesquisas/[surveyId]
                  ──[Propriedades]──────▶  …/operacao
                                               └──[Editar identidade visual]──▶ …/identidade
```

Ou seja, `/identidade` só é alcançável a partir de `/operacao` — por isso a tela de identidade volta para "Propriedades", e não para o construtor. A tela de propriedades traz as ações de navegação no topo do próprio conteúdo, não na barra da casca. Detalhes e o que foi deliberadamente removido dela em [src/app/admin/CLAUDE.md](src/app/admin/CLAUDE.md).

### Carga da base institucional

A tela `/admin/importacao` e a rota `/api/admin/import-participants` **foram removidas**. A base de pessoas passa a ser carregada direto no Supabase, por processo controlado, chamando as RPCs que continuam existindo: `sync_people_base_rows` (base mestra) e `sync_cddi_manager_rows` (vínculos de chefia), ambas restritas a `service_role` e registrando `data_import_batches` / `data_import_issues`.

A carga **nunca** vincula pessoas a pesquisas: isso é decisão explícita do administrador em `/admin/participantes`.

## Relações entre módulos

### Componentes centrais

| Componente | Papel | Consumidores |
|---|---|---|
| `usePlatformContext` ([src/lib/platform-context.ts](src/lib/platform-context.ts)) | Única fonte de identidade e permissões no cliente. Cache de 2 min e deduplicação de chamadas concorrentes. | `usePlatformGuard`, `PersonAvatar` |
| `usePlatformGuard` ([src/lib/platform-guard.ts](src/lib/platform-guard.ts)) | Guarda de página: traduz o contexto em `loading · unidentified · restricted · granted` e entrega `user` e `modules` prontos. | Todas as páginas autenticadas |
| `PlatformShell` ([src/components/platform-shell.tsx](src/components/platform-shell.tsx)) | Casca visual: sidebar, cabeçalho, drawer móvel, logout, skip link. | Todas as telas internas |
| `createBrowserSupabaseClient` ([src/lib/supabase/client.ts](src/lib/supabase/client.ts)) | Cliente singleton autenticado por cookie. | Toda chamada RPC do navegador |
| `resolvePlatformModules` ([src/lib/platform-modules.ts](src/lib/platform-modules.ts)) | Traduz papéis em módulos visíveis. | `platform-context`, navegação, guardas de página |
| `fc_obter_contexto_plataforma` (SQL) | Contrato de autorização servidor→cliente. | `platform-context` |
| `usePlatformBranding` ([src/components/platform-branding-provider.tsx](src/components/platform-branding-provider.tsx)) | Marca institucional (nome, cor, logotipo) resolvida uma vez e cacheada. | `PlatformShell`, `PlatformLogo`, `/admin/configuracoes` |
| `useConfirm` ([src/components/confirmation-provider.tsx](src/components/confirmation-provider.tsx)) | Confirmação acessível de ação irreversível, em promise. | Envio de formulário, operação de ciclo, gestão de equipe |

### Dependências entre camadas

```text
app/**            →  components/**  →  components/ui/**
   │                     │
   │                     └──────────→  lib/utils, lib/platform-*
   ├──────────────────→  hooks/**    →  lib/**
   └──────────────────→  lib/**      →  lib/supabase/client
                                          │
                                          ▼
                                    Supabase (RPC + RLS)

app/api/**        →  lib/supabase/admin   (service role, nunca no cliente)
                  →  lib/supabase/server  (sessão do administrador → papel)
proxy.ts          →  lib/supabase/proxy
```

Regras respeitadas em todo o código:

- `src/lib/**` não importa de `src/components/**`, `src/app/**` nem `src/hooks/**`. Exceção deliberada: `platform-navigation.ts` importa apenas o *tipo* `PlatformIconName`.
- `src/components/ui/**` não conhece Supabase nem regras de negócio.
- `lib/supabase/admin.ts` só é importado por Route Handlers (`src/app/api/**`).
- Função pura vai para `src/lib`; hook que consulta o Supabase vai para `src/hooks`.

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
- **Cor por token, nunca hexadecimal literal** — é o que faz a aplicação inteira acompanhar o tema escuro. Telas montam a partir dos primitivos de [src/components/ui](src/components/ui) (`Surface`, `PageHeader`, `StatCard`, `Button`, `Badge`, `EmptyState`, `Skeleton`) em vez de recriar caixa e cabeçalho.
- Três exceções deliberadas, todas por identidade institucional fixa: as constantes `CDDI_INK`/`CDDI_RULE` das telas do CDDI, a paleta literal da tela pública `/acesso` (sempre clara, fora da casca temática) e a barra de cinco cores da marca. Exceção nova exige a mesma justificativa — não espalhe literais.
- Classes compostas via `cn()` ([src/lib/utils.ts](src/lib/utils.ts)); variantes via `class-variance-authority`. `<Link>` que deve parecer botão usa `buttonVariants({ variant })`, não a cadeia de classes copiada.
- Alvo interativo mínimo de 44 px, foco visível, `aria-label` em botões só com ícone, respeito a `prefers-reduced-motion`.
- **Estado nunca depende só de cor** (todo selo leva rótulo ou ícone), **código do banco não é rótulo de interface** (`DRAFT` → "Rascunho", com o código no `title`) e **botão indisponível explica o motivo** (`title` + `aria-describedby` + nota visível).

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
| [src/components/admin-participants-table.tsx](src/components/admin-participants-table.tsx) | Tabela de participantes substituída por `admin-participant-management.tsx`. É a única consumidora de `@tanstack/react-table` — remover o arquivo torna a dependência descartável. |
| [src/components/ui/tabs.tsx](src/components/ui/tabs.tsx) | Primitivo acessível pronto, sem consumidores. Exporta `TabButtonProps`, tipo sem uso. |

**Sugestão:** decidir caso a caso entre adotar e remover. Manter código testado mas morto dá falsa sensação de cobertura.

**Resolvidos.** `admin-module-page.tsx` foi **removido**: a casca administrativa genérica que ele propunha virou `usePlatformGuard()` + `PlatformGuardState`, hoje usada por todas as rotas. `platform-command-menu.tsx` passou a ser renderizado por `PlatformShell` com os `modules` do usuário; `survey-catalog.ts` é consumido por `/area` e `/pesquisas` (via `src/hooks/use-survey-catalog.ts`); `reliable-save-queue.ts` é usado pelas duas jornadas do CDDI; os componentes de upload e geração de avatar foram removidos quando a foto do Google se tornou automática.

### Duplicação de lógica

1. **Uma fila de autossalvamento ainda fora do padrão.** [src/app/pesquisas/[applicationCode]/tela-responder-pesquisa.tsx](src/app/pesquisas/[applicationCode]/tela-responder-pesquisa.tsx) serializa gravações com um `useRef<Promise>` próprio, enquanto as duas jornadas do CDDI já usam `ReliableSaveQueue` — que faz o mesmo com testes e notificação de estado. Migrar o runtime genérico encerra a duplicação.

2. **Dois componentes `Dialog` distintos.** [src/components/ui/dialog.tsx](src/components/ui/dialog.tsx) usa `<dialog>` nativo; [src/components/ui/overlay-panel.tsx](src/components/ui/overlay-panel.tsx) exporta `Dialog` e `Drawer` com focus trap manual. Importar "Dialog" do arquivo errado gera comportamento inesperado.

**Resolvidos.** A **guarda de acesso deixou de ser reescrita em cada página**: as 17 telas autenticadas repetiam a mesma sequência (carregando → identidade → módulo → montar o `user` da casca), com desfechos divergentes — parte usava `FullPageState`, parte um `<main>` vermelho sem caminho de volta. Hoje `usePlatformGuard()` ([src/lib/platform-guard.ts](src/lib/platform-guard.ts)) resolve os quatro estados e `PlatformGuardState` os apresenta. `metadataText()` e `metadataObject()`, antes duplicadas em `/area` e `/perfil`, vivem em [src/lib/person-metadata.ts](src/lib/person-metadata.ts). O estado do catálogo deixou de ser reimplementado nas telas — `/area` e `/pesquisas` importam `surveyItemState()` e `surveyApplicationHref()` de [src/lib/survey-catalog.ts](src/lib/survey-catalog.ts) e compartilham a consulta pelo hook `useSurveyCatalog`. Os modais ad hoc de `/equipe` e das telas administrativas deram lugar ao `Dialog` de `overlay-panel.tsx` e ao diálogo de confirmação de `confirmation-provider.tsx`.

### Inconsistências

1. **Domínio institucional divergente.** [src/app/auth/confirm/route.ts](src/app/auth/confirm/route.ts#L12) fixa `ALLOWED_DOMAIN = "agenciasus.org.br"` no código, enquanto [docs/acesso-institucional.md](docs/acesso-institucional.md) documenta `ALLOWED_INSTITUTIONAL_DOMAINS` aceitando `agenciasus.org.br,agsus.org.br`. Uma conta `@agsus.org.br` seria aceita pela função SQL e rejeitada pelo callback.

2. **Atalhos de teclado inativos.** `PlatformInteractionLayer` filtra atalhos por `modules`, mas [src/components/app-providers.tsx](src/components/app-providers.tsx#L29) o monta sem a prop — `allowedShortcuts` fica sempre vazio e nenhum atalho `Alt+1..4`/`Alt+A` funciona.

3. **Dois avisos de offline simultâneos.** `PlatformInteractionLayer` e `NetworkStatusBanner` mostram banners próprios ao perder conexão; ambos são renderizados por `AppProviders`.

4. **`/cddi/README.md` desatualizado.** Afirma que "a persistência definitiva depende da autenticação institucional", mas o envio já está implementado (`submit_my_cddi_submission`). O mesmo vale para o último parágrafo de [docs/formulario-cddi-ui.md](docs/formulario-cddi-ui.md).

5. **`supabase/migrations/README.md` desatualizado.** Diz que "a primeira migration será criada após a modelagem"; existem 51 migrations aplicadas.

6. **Rascunho em `sessionStorage`.** [docs/formulario-cddi-ui.md](docs/formulario-cddi-ui.md) cita salvamento em `sessionStorage`; o código atual persiste direto no banco via `save_my_cddi_answer`.

7. **Adoção parcial das bibliotecas de formulário.** `react-hook-form` + `@hookform/resolvers` + `zod` agora sustentam `/admin/configuracoes` e `/admin/pesquisas/nova`, ; o restante das telas continua com estado local e validação manual. `@tanstack/react-table` só é importado por `admin-participants-table.tsx`, que não tem consumidores — na prática, uma dependência sem uso em produção.

8. **`supabase/config.toml` ausente do repositório.** O CI executa `supabase init` condicionalmente; versionar o arquivo tornaria o ambiente local reprodutível.

### Segurança e robustez

1. **`isSameOrigin()` aceita requisições sem header `Origin`** em [src/app/api/observability/errors/route.ts](src/app/api/observability/errors/route.ts#L9-L13) — comportamento necessário para `keepalive`; a decisão está registrada em comentário no próprio arquivo.

2. **`/api/background/[id]` faz proxy de imagens do Unsplash** apenas para o plano de fundo da tela de login. Índice validado e cache longo, mas é uma dependência externa em rota pública.

3. **Upload de logotipo validado só no navegador.** [src/app/admin/configuracoes/tela-admin-configuracoes.tsx](src/app/admin/configuracoes/tela-admin-configuracoes.tsx) checa tipo, dimensão mínima e proporção antes de enviar ao storage `platform-assets`; quem chamar a API direto não passa por essa checagem. A limpeza do arquivo órfão em caso de falha da RPC está implementada.

**Resolvidos.** O token administrativo digitado na interface deixou de existir junto com a tela de importação, e `window.confirm` foi substituído pelo diálogo acessível de `confirmation-provider.tsx`.

### Manutenibilidade

1. **Arquivos muito grandes.** [src/app/admin/pesquisas/[surveyId]/tela-admin-construtor-pesquisa.tsx](src/app/admin/pesquisas/[surveyId]/tela-admin-construtor-pesquisa.tsx) tem ~54 KB e [src/app/paineis/cddi/tela-painel-cddi.tsx](src/app/paineis/cddi/tela-painel-cddi.tsx) ~37 KB em um único componente. Extrair editores, tabelas e cartões facilitaria revisão e testes.

2. **JSX em linhas muito longas.** Diversas telas concentram seções inteiras em uma única linha (algumas com mais de 3.000 caracteres), o que inviabiliza diffs legíveis. Reformatar é seguro (não altera comportamento), mas produz um diff grande — decisão da equipe.

3. **Tipagem das RPCs por asserção.** Todo retorno usa `data as T`, sem tipos gerados. `supabase gen types typescript` eliminaria a divergência silenciosa entre banco e frontend.

4. **Cores fora dos tokens.** Hexadecimais literais (`#003b70`, `#086ab6`, `#26368d`) convivem com `var(--brand-primary)`. O tema escuro pode não cobrir os valores fixos.

5. **Sem `vitest.config.ts`.** Funciona com o padrão, mas explicitar `include`, ambiente e cobertura evita surpresas ao crescer a suíte.
