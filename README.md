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
3. **Definição de público, perfis e hierarquias** — participantes por aplicação, vínculos de liderança e quatro perfis globais **mutuamente exclusivos**: **Participante** (somente o módulo Pesquisas), **Avaliador** (Visão Geral, Pesquisas e Minha Equipe — participa das pesquisas e avalia sua equipe), **Admin** (Visão Geral, Pesquisas, Painéis, Minha Equipe, Pesquisas e Ciclos, e Participantes) e **Superadmin** (acesso irrestrito a todos os módulos, incluindo gestão de usuários, perfis e dados institucionais). O acesso é determinado exclusivamente pelo perfil — não há exceção de módulo por pessoa. Os códigos internos no banco (`ADMINISTRATOR`, `SURVEY_MANAGER`, `LEADER`, `RESPONDENT`) são legados preservados por compatibilidade com RLS e RPCs — o frontend usa as constantes de [src/lib/platform-roles.ts](src/lib/platform-roles.ts).
4. **Experiência segura de resposta** — formulários com autossalvamento, rascunho, validação por etapa e envio definitivo.
5. **Painéis e auditoria** — indicadores por instrumento, painel específico do CDDI, trilha de eventos.

Três decisões estruturantes explicam quase todo o código:

| Decisão | Consequência prática |
|---|---|
| **Toda lógica de negócio vive no PostgreSQL** | O frontend não faz `select`/`insert` direto em tabelas de negócio. Consome a API REST em `/api/**`, e cada rota chama a RPC que valida identidade, papel, escopo e período antes de gravar. Mudança de regra é migration nova, não código React. |
| **A matrícula é o identificador da pessoa, não o e-mail** | A base oficial contém e-mails repetidos entre matrículas distintas. Ver [docs/auditoria-base-cddi-2026.md](docs/auditoria-base-cddi-2026.md). |
| **Autorização é resolvida em uma única chamada** | `fc_obter_contexto_plataforma()` devolve pessoa, papéis, módulos e participação. O resultado governa navegação, permissões e telas. |

## Arquitetura do sistema

```text
┌─ Navegador ────────────────────────────────────────────────────────┐
│  Next.js App Router (React 19, componentes "use client")            │
│    · PlatformShell ....... casca visual, navegação por módulo       │
│    · usePlatformContext .. identidade e permissões (cache 2 min)    │
│    · @/lib/api/cliente-* . chamadas tipadas à API REST             │
│    · @supabase/ssr ....... apenas auth (login, sessão, logout)     │
└───────────────────────────────┬────────────────────────────────────┘
                                │ fetch /api/... (cookie de sessão)
                                ▼
┌─ Route Handlers (Node) ────────────────────────────────────────────┐
│  ~50 rotas de domínio ....... createServerSupabaseClient()          │
│    avaliacoes · pessoas · equipe · submissoes · cddi · paineis      │
│    validam forma, traduzem erro do banco em status HTTP             │
│  4 de infraestrutura ........ health · observability · background   │
│                               /auth/confirm (callback OAuth)        │
└───────────────────────────────┬────────────────────────────────────┘
                                │ supabase.rpc(...)  — JWT do usuário
                                ▼
┌─ Supabase / PostgreSQL ────────────────────────────────────────────┐
│  Tabelas + RLS por pessoa/papel .... última barreira de acesso      │
│  RPCs SECURITY DEFINER ............. AS REGRAS DE NEGÓCIO           │
│    identidade e permissões · runtime · construtor e ciclo           │
│    painéis · anonimato estrutural · auditoria                       │
│  Auth (Google OAuth, PKCE) · Views institucionais DB_PESQUISAS      │
└────────────────────────────────────────────────────────────────────┘
                ▲
                │ src/proxy.ts (Next.js middleware) — sessão + guarda de rota
                └───────────────────────────────────────────────────────
```

**REST na borda, regra no banco.** O navegador fala HTTP com `/api/**`; a rota chama a RPC correspondente. As duas camadas não competem: a rota decide **formato** (campo presente, UUID válido, status de retorno), a RPC decide **permissão e regra** (quem pode, quando pode, o que é obrigatório, o que é auditado). Como as rotas autenticam com a sessão de quem chamou — e não com a chave de serviço —, a RLS continua valendo mesmo se uma rota tiver defeito.

A consequência prática: **mudar regra de negócio continua exigindo migration**, não edição de TypeScript.

**Camadas e responsabilidades**

| Camada | Localização | Responsabilidade |
|---|---|---|
| Proxy de borda | [src/proxy.ts](src/proxy.ts), [src/lib/supabase/proxy.ts](src/lib/supabase/proxy.ts) | Renova a sessão, redireciona anônimos para `/acesso`, responde `401` em `/api/**`, aplica cabeçalhos de segurança. |
| Rotas e telas | [src/app/](src/app/) | Uma pasta por jornada. Componentes de cliente que consomem a API pelos clientes tipados. |
| API REST | [src/app/api/](src/app/api/) | Casca HTTP sobre as RPCs, organizada por domínio. |
| Contratos e clientes | [src/lib/api/](src/lib/api/) | `chamar()` e `ErroDeApi` (transporte), tradução de erro Postgres→HTTP, tipos e uma função por operação. |
| Casca e design system | [src/components/](src/components/) | `PlatformShell`, primitivos acessíveis em `ui/`, blocos administrativos. |
| Domínio no cliente | [src/lib/](src/lib/) | Funções puras testáveis (validação, ordenação, normalização) e clientes Supabase. |
| Consultas cacheadas | [src/hooks/](src/hooks/) | Hooks que combinam React Query com a API — o que não é função pura nem componente. |
| Banco e regras | [supabase/migrations/](supabase/migrations/) | Esquema, RLS, RPCs, triggers, views institucionais. Fonte da verdade das regras. |

**Exceção única:** [src/app/acesso/page.tsx](src/app/acesso/page.tsx) lê a marca institucional (logotipo, cores) direto do banco. É Server Component anônimo, renderizado antes de existir sessão — rotear por `/api` só somaria um salto de rede.

## Estrutura de diretórios

```text
agsus-pesquisas/
├── README.md                     # Este documento
├── src/proxy.ts                  # Middleware do Next.js (nome e local exigidos pelo Next 16)
├── next.config.ts                # React Strict Mode, hosts de imagem permitidos
├── vercel.json                   # Deploy automático apenas a partir de main
├── tsconfig.json                 # strict, alias @/* → ./src/*
├── postcss.config.mjs            # Tailwind CSS v4 via @tailwindcss/postcss
├── .env.example                  # Contrato de variáveis de ambiente
│
├── docs/                         # Decisões de produto, dados e design
│
├── scripts/                      # Diagnóstico e manutenção operacional do banco
│
├── supabase/
│   └── migrations/               # SQL versionado — regras de negócio e RLS
│
└── src/
    ├── app/                      # App Router
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
    │   └── api/                  # API REST — uma pasta por recurso
    │       ├── avaliacoes/       # Catálogo, construtor, ciclo, participantes
    │       ├── pessoas/          # Base funcional, auditoria, lideranças
    │       ├── equipe/           # Ciclos, integrantes, candidatos
    │       ├── submissoes/       # Runtime genérico de resposta
    │       ├── cddi/             # Jornada do CDDI
    │       ├── paineis/          # Resultados e monitoramento
    │       ├── plataforma/       # Marca e perfis de acesso
    │       ├── meu/              # Relativo a quem chamou — sem id no caminho
    │       ├── formularios/  ciclos/  respostas/  modelos-avaliacao/
    │       └── health/  observability/  background/   # infraestrutura
    ├── components/
    │   └── ui/                   # Primitivos do design system
    ├── hooks/                    # Hooks de consulta (React Query + API REST)
    └── lib/
        ├── api/                  # Cliente da API REST
        │   ├── requisicao.ts     # chamar() e ErroDeApi — transporte único
        │   ├── resposta-http.ts  # Erro do Postgres → status HTTP (usado pelas rotas)
        │   ├── validacao.ts      # Validação de forma nas rotas
        │   ├── contratos*.ts     # Formatos que trafegam, por domínio
        │   └── cliente*.ts       # Uma função por operação, por domínio
        └── supabase/             # Fábricas de cliente (browser, server, admin, proxy)
```

## Tecnologias utilizadas

| Camada | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js | `24.x` (fixado em `engines`) |
| Framework | Next.js (App Router) | `16.3.2` |
| UI | React / React DOM | `19.2.8` |
| Linguagem | TypeScript (modo `strict`) | `^6.0.0` |
| Estilo | Tailwind CSS v4 + CSS custom properties | `^4.3.3` |
| Backend | Supabase (PostgreSQL, Auth, RLS) | `@supabase/supabase-js 2.112.0`, `@supabase/ssr 0.12.4` |
| Estado de servidor | TanStack React Query | `^5.101.4` |
| Hospedagem | Vercel | — |

## Dependências

**Produção** — `@hookform/resolvers` + `react-hook-form` + `zod` (formulários e validação), `@tanstack/react-query`, `class-variance-authority` + `clsx` + `tailwind-merge` (variantes de classe), `lucide-react` (ícones), `sonner` (toasts).

**Desenvolvimento** — `tailwindcss` + `@tailwindcss/postcss`, `typescript` e tipos de Node e React.

> `@hookform/resolvers`, `react-hook-form` e `zod` sustentam `/admin/configuracoes` e `/admin/pesquisas/nova`.

## Variáveis de ambiente

Copie [.env.example](.env.example) para `.env.local` e preencha os valores.

| Variável | Escopo | Obrigatória | Finalidade |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Navegador + servidor | Sim | URL do projeto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Navegador + servidor | Sim | Chave pública. Toda leitura/escrita passa por RLS. |
| `SUPABASE_URL` | Servidor | Não | Alternativa à variável pública nas rotas administrativas. |
| `SUPABASE_SECRET_KEY` | **Servidor** | Sim (rotas admin) | Chave secreta moderna, usada por `createAdminSupabaseClient()`. |
| `SUPABASE_SERVICE_ROLE_KEY` | **Servidor** | Sim (rotas admin) | Nome legado, aceito como alternativa à anterior. |
| `NEXT_PUBLIC_SITE_URL` | Navegador + servidor | Sim (e-mails) | URL canônica usada nos links enviados aos participantes. |
| `SMTP_APP_PASSWORD` | **Servidor** | Sim (e-mails) | Senha de app da caixa Google Workspace; nunca use a senha normal da conta. |
| `SMTP_USER` | **Servidor** | Não | Caixa que autentica no SMTP; padrão: remetente institucional configurado no código. |
| `CRON_SECRET` | **Servidor** | Sim (e-mails) | Autoriza as chamadas do cron da Vercel a `/api/tarefas/emails`. |
| `ALLOWED_INSTITUTIONAL_DOMAINS` | Banco de dados | Não | Lida pela função SQL de acesso institucional. Padrão: `agenciasus.org.br,agsus.org.br`. |

> **Segurança.** `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` **nunca** podem receber o prefixo `NEXT_PUBLIC_`, ser importados por componentes de cliente nem ser gravados no repositório. Sem essas chaves a aplicação sobe, mas `/api/health` responde `503 degraded`.

**Sem as variáveis públicas configuradas** o proxy devolve `503` em rotas privadas e permite apenas `/`, `/acesso`, `/auth/confirm` e `/api/health`.

## Instalação

Pré-requisitos: **Node.js 24.x**, **npm 11+** e um projeto Supabase acessível. Para trabalhar no banco localmente, também é necessária a [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
git clone <url-do-repositorio>
cd agsus-pesquisas

npm ci                    # instala exatamente o que está em package-lock.json
cp .env.example .env.local
# preencha .env.local com as credenciais do Supabase
```

Use `npm ci` (não `npm install`) para reproduzir exatamente o lockfile.

## Ambiente de desenvolvimento

```bash
npm run dev
```

A aplicação fica disponível em `http://localhost:3000` e redireciona para `/acesso`.

Para autenticar em desenvolvimento, o provedor Google do projeto Supabase precisa aceitar `http://localhost:3000/auth/confirm` como URL de redirecionamento.

Comandos de verificação:

```bash
npm run typecheck         # tsc --noEmit
```

Banco de dados local (opcional, requer Docker + Supabase CLI):

```bash
supabase init             # apenas se supabase/config.toml não existir
supabase start
supabase db reset         # reconstrói o banco a partir de supabase/migrations
supabase stop --no-backup
```

## Build de produção

```bash
npm run build             # compila para .next/
npm start                 # serve o build compilado
```

`npm run build` exige `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` definidas.

**Deploy.** [vercel.json](vercel.json) habilita deploy automático **somente** para a branch `main`. Todas as variáveis de ambiente devem estar configuradas no projeto Vercel.

Fluxo de branches: `main` (estável) ← `develop` (integração) ← `feature/*`.

## Rotas de API — verificação manual

A matriz abaixo permite verificar manualmente os endpoints com o servidor de desenvolvimento no ar (`npm run dev`).

**Não há link clicável para testar as rotas de domínio, e isso é por desenho.** Elas autenticam pelo cookie de sessão institucional, então abrir `/api/pessoas` no navegador anônimo ou no `curl` devolve `401` — que é justamente o comportamento correto. Só há duas formas de exercitá-las de verdade:

1. **Pelo navegador já autenticado** — entre em `/acesso`, faça login e abra a URL na mesma aba. O cookie viaja junto e a rota responde. É o caminho mais rápido para inspecionar o corpo de uma resposta.
2. **Por `curl` com o cookie de sessão** — copie o cookie `sb-…-auth-token` das ferramentas de desenvolvedor (aba *Application* → *Cookies*) e passe em `--cookie`. Útil para reproduzir um cenário específico:

```bash
curl -i http://localhost:3000/api/avaliacoes   --cookie "sb-<ref>-auth-token=<valor copiado do navegador>"
```

As rotas estão agrupadas por recurso em [src/app/api/](src/app/api/). O cliente tipado que as consome está em [src/lib/api/](src/lib/api/) — em geral é dele que se deve chamar, não de `fetch` avulso.

#### Cenários verificados

Resultado real da última execução, não comportamento presumido.

| Rota | Método | Cenário | Esperado |
|---|---|---|---|
| `/api/health` | `GET` | sem sessão | `200` · `{"status":"ok"}` — `503` se faltar variável |
| `/api/background/0` | `GET` | índice válido (0–5) | `200` · imagem, com cache longo |
| `/api/background/99` | `GET` | índice fora da faixa | `404` · `Imagem inválida.` |
| `/api/background/abc` | `GET` | índice não numérico | `404` · `Imagem inválida.` |
| `/api/observability/errors` | `GET` | método não suportado | `405` |
| `/api/observability/errors` | `POST` | corpo válido | `202` · `{"reference":…}` |
| `/api/observability/errors` | `POST` | `Origin` de outro host | `403` · `Origem não autorizada.` |
| `/api/observability/errors` | `POST` | `type` fora do catálogo | `400` · `Relatório inválido.` |
| `/api/observability/errors` | `POST` | `reference` ausente | `400` · `Relatório inválido.` |
| `/api/observability/errors` | `POST` | corpo acima de 16 KB | `413` · `Conteúdo excede o limite permitido.` |
| `/api/avaliacoes`, `/api/meu/contexto`, `/api/pessoas`, `/api/equipe`, `/api/submissoes`, `/api/paineis/*` | qualquer | **sem sessão** | `401` · `application/json` com `{"mensagem":"Sua sessão expirou…"}` |
| `/api/avaliacoes` | `DELETE` | método inexistente, sem sessão | `401` — **não** `405`: o middleware barra antes de o Next avaliar o método, e assim não revela quais verbos existem |

```bash
# saúde e proxy de imagens
curl -i http://localhost:3000/api/health
curl -o /dev/null -w "%{http_code} %{content_type}
" http://localhost:3000/api/background/0
curl -i http://localhost:3000/api/background/99

# coleta de erros: caminho feliz, origem externa e payload inválido
curl -i -X POST http://localhost:3000/api/observability/errors   -H "content-type: application/json"   -d '{"reference":"teste-1","route":"/teste","type":"CLIENTE","message":"erro de teste"}'

curl -i -X POST http://localhost:3000/api/observability/errors   -H "content-type: application/json" -H "origin: https://exemplo-externo.test"   -d '{"reference":"teste-2","route":"/teste","type":"CLIENTE","message":"m"}'

# rota de domínio sem sessão: 401 em JSON, nunca HTML de login
for r in /api/avaliacoes /api/meu/contexto /api/pessoas /api/equipe; do
  printf "%-24s %s\n" "$r" "$(curl -s -o /dev/null -w '%{http_code}' "http://localhost:3000$r")"
done
```

**O `401` em JSON é o ponto a conferir depois de mexer no middleware.** Se uma rota de API voltar a responder `307` para `/acesso`, o `fetch` do navegador segue o redirecionamento sozinho, recebe `200` com o HTML do login e `response.json()` falha com `Unexpected token '<'` — mensagem que não menciona sessão expirada em lugar nenhum.

### Guarda de rota — verificação manual

O middleware ([src/proxy.ts](src/proxy.ts)) é a primeira camada de acesso, e **falha em silêncio quando não é carregado**: as páginas continuam respondendo, só que sem guarda e sem cabeçalhos. Vale conferir depois de mexer em rota, em `PUBLIC_PATHS` ou na localização do arquivo.

| Requisição | Esperado |
|---|---|
| `/area`, `/pesquisas`, `/paineis`, `/admin/**` sem sessão | `307` → `/acesso?next=…` |
| **`/api/**` de domínio sem sessão** | **`401` em JSON — nunca redirecionamento** |
| `/acesso`, `/api/health`, `/api/background/*` sem sessão | `200` |
| `/api/observability/errors` sem sessão | `202` — anônima por desenho |
| qualquer resposta | `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy` |

Página e rota de API se comportam de formas diferentes de propósito: quem navega precisa ser levado ao login; quem chama a API precisa de um status que o código saiba tratar.

```bash
curl -o /dev/null -w "%{http_code} -> %{redirect_url}
" http://localhost:3000/admin/configuracoes
curl -sD - -o /dev/null http://localhost:3000/acesso | grep -iE "x-frame-options|permissions-policy"
```

**Ausência dos cabeçalhos é o sintoma de que o middleware não está ativo** — foi assim que se descobriu que `proxy.ts` estava na raiz do projeto, onde o Next 16 não o procura.

## Depuração

- **Erros de aplicação** são capturados por `ClientErrorReporter` (erros globais e promises rejeitadas), `error.tsx` (rota) e `global-error.tsx` (layout raiz). Cada falha ganha uma **referência técnica** exibida na tela e persistida em `tl_erro_aplicacao` via `POST /api/observability/errors`. Busque pela referência no banco para achar o registro.
- **Sanitização.** `sanitizeObservabilityText()` remove e-mails, sequências de 5+ dígitos e tokens `Bearer` antes de enviar. Relatórios idênticos são deduplicados por 30 s.
- **Configuração.** `GET /api/health` retorna `200 ok` ou `503 degraded` com a lista de variáveis ausentes.
- **Permissões.** Se uma tela aparece vazia ou nega acesso, inspecione o retorno de `fc_obter_contexto_plataforma` no console — `status`, `roles` e `modules` explicam o comportamento. O cache de 2 minutos pode ser descartado com `invalidatePlatformContext()`.
- **Erros de RPC** chegam como `PostgrestError`; a mensagem vem do `raise exception` da função SQL. Para reproduzir, execute a função no SQL Editor do Supabase com uma sessão autenticada.
- **Estado do formulário.** No CDDI e no runtime genérico, o rodapé indica `Salvando rascunho…`, `Falha ao salvar` ou o horário do último salvamento.

## Fluxo geral da aplicação

### Inicialização

1. `src/proxy.ts` intercepta a requisição e chama `updateSession()`, que renova os cookies da sessão Supabase, aplica cabeçalhos de segurança (`no-store`, `nosniff`, `DENY`, `Referrer-Policy`, `Permissions-Policy`) e redireciona usuários não autenticados para `/acesso?next=…`.
2. `src/app/layout.tsx` injeta dois scripts `beforeInteractive` que leem `localStorage` e aplicam tema e estado da sidebar **antes** da primeira pintura, evitando flash.
3. `AppProviders` monta `QueryClientProvider`, `PlatformBrandingProvider` (marca institucional, com cache em `localStorage` para não piscar o padrão), `ConfirmationProvider` (diálogo de confirmação disponível a qualquer tela), `ClientErrorReporter`, `PlatformInteractionLayer`, `NetworkStatusBanner` e `Toaster`.
4. A página chama `usePlatformGuard(módulo?)`, que por baixo usa `usePlatformContext()` e consulta `GET /api/meu/contexto` (→ `fc_obter_contexto_plataforma()`). Se o retorno for `UNLINKED`, chama `POST /api/meu/acesso-institucional` (→ `resolve_authenticated_person(null)`) para criar o vínculo e recarrega o contexto.
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

Cada passo mostra a rota chamada pela tela e, à direita, a RPC que ela aciona no banco.

```text
/pesquisas  →  GET /api/meu/catalogo            list_my_survey_catalog()
   ├── surveyCode === "CDDI"  →  /cddi          (jornada especializada)
   └── caso contrário         →  /pesquisas/[applicationCode]  (runtime genérico)

runtime:
  GET  /api/formularios/[codigo]        get_public_survey_form         estrutura, sem dados pessoais
  POST /api/submissoes                  start_or_resume_my_…           cria ou retoma o rascunho
  GET  /api/ciclos/[codigo]/regras      fc_obter_regras_do_ciclo       lógica condicional (tolerante a falha)
  PUT  /api/submissoes/[id]/respostas   save_my_survey_answer          autossalvamento serializado
  POST /api/submissoes/[id]/envio       submit_my_survey_submission    envio definitivo (irreversível)
```

O envio é o passo que mais concentra regra no banco: numa transação só, a RPC confere identidade e período, conta as obrigatórias **visíveis** pelo motor de lógica condicional, grava, apaga o bilhete de anonimato quando o ciclo é anônimo e registra auditoria.

O CDDI adiciona duas particularidades: a chefia responsável é resolvida automaticamente do vínculo institucional (`get_my_cddi_identity` lê `cddi_leadership_links`, alimentado pela importação da base e por correções administrativas — não há seleção manual pelo participante) e a avaliação de chefia acontece em `/cddi/chefia/[personId]`.

### Administração de um ciclo

```text
/admin/pesquisas/nova       POST /api/avaliacoes                       create_survey_draft
/admin/pesquisas/[id]       GET  /api/avaliacoes/[id]/construtor       get_survey_builder
                            POST/PATCH …/secoes · …/perguntas          add_/update_survey_*
                            POST …/itens/copia · …/itens/ordem         duplicate_/reorder_*
              identidade    PUT  /api/avaliacoes/[id]/identidade-visual update_application_visual_settings
              operacao      GET  /api/avaliacoes/[id]/ciclo            get_survey_operations
                            POST /api/avaliacoes/[id]/ciclo            manage_survey_cycle
                                 (UPDATE_PERIOD · PUBLISH · SCHEDULE · OPEN
                                  REOPEN · CLOSE · CANCEL · ARCHIVE)
```

A ação do ciclo vai no corpo do `POST`, não no caminho: as transições operam o mesmo recurso, e uma rota por verbo de negócio multiplicaria caminhos para um estado só.

A estrutura só é editável enquanto a versão está em rascunho; `validate_survey_version_integrity` bloqueia a publicação de instrumentos inconsistentes.

A árvore acima é de **rotas**, não de navegação. Os caminhos que a interface realmente oferece são:

```text
/admin/pesquisas  ──[Editar formulário]──▶  /admin/pesquisas/[surveyId]
                  ──[Propriedades]──────▶  …/operacao
                                               └──[Editar identidade visual]──▶ …/identidade
```

Ou seja, `/identidade` só é alcançável a partir de `/operacao` — por isso a tela de identidade volta para "Propriedades", e não para o construtor. A tela de propriedades traz as ações de navegação no topo do próprio conteúdo, não na barra da casca.

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
src/proxy.ts      →  lib/supabase/proxy
```

Regras respeitadas em todo o código:

- `src/lib/**` não importa de `src/components/**`, `src/app/**` nem `src/hooks/**`. Exceção deliberada: `platform-navigation.ts` importa apenas o *tipo* `PlatformIconName`.
- `src/components/ui/**` não conhece Supabase nem regras de negócio.
- `lib/supabase/admin.ts` só é importado por Route Handlers (`src/app/api/**`).
- Função pura vai para `src/lib`; hook que consulta o Supabase vai para `src/hooks`.

### Pontos de entrada

| Entrada | Arquivo | Observação |
|---|---|---|
| Middleware | [src/proxy.ts](src/proxy.ts) | Next.js 16 renomeou `middleware.ts` → `proxy.ts`. O arquivo precisa ficar **ao lado de `app/`** — como o app é `src/app`, o local é `src/`, não a raiz. Fora daí o Next não o carrega, e a guarda deixa de existir sem nenhum aviso. |
| Layout raiz | [src/app/layout.tsx](src/app/layout.tsx) | Metadados, viewport, bootstrap de preferências. |
| Rota `/` | [src/app/page.tsx](src/app/page.tsx) | Redireciona para `/acesso`. |
| Callback OAuth | [src/app/auth/confirm/route.ts](src/app/auth/confirm/route.ts) | Troca código por sessão e valida o domínio. |
| Health check | [src/app/api/health/route.ts](src/app/api/health/route.ts) | Rota pública de diagnóstico. |

## Convenções de código

**Arquivos e nomes**

- Arquivos em `kebab-case.tsx`; componentes e tipos em `PascalCase`; funções e variáveis em `camelCase`; constantes de módulo em `SCREAMING_SNAKE_CASE`.
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
| [docs/migracao-schema-sigav.md](docs/migracao-schema-sigav.md) | Implantação e validação da migração do schema `public` para `sigav`. |
| [docs/design-system.md](docs/design-system.md) | Tokens, semântica de estado, componentes-base, acessibilidade. |
| [docs/equipe-tecnica-fluxos.md](docs/equipe-tecnica-fluxos.md) | Fluxos funcionais de gestão de equipe e de pesquisas. |
| [docs/formulario-cddi-ui.md](docs/formulario-cddi-ui.md) | Experiência do formulário CDDI. |
| [docs/referencias-visuais.md](docs/referencias-visuais.md) | Referências de experiência (AgSUS Monitora, Index original). |

## Observações e Melhorias Sugeridas

Levantamento feito durante a documentação. **Nenhum item abaixo foi alterado** — todos preservam o comportamento atual e ficam registrados para decisão da equipe.

### Duplicação de lógica

1. **Dois componentes `Dialog` distintos.** [src/components/ui/dialog.tsx](src/components/ui/dialog.tsx) usa `<dialog>` nativo; [src/components/ui/overlay-panel.tsx](src/components/ui/overlay-panel.tsx) exporta `Dialog` e `Drawer` com focus trap manual. Importar "Dialog" do arquivo errado gera comportamento inesperado.

**Resolvidos.** Os **formatos de retorno deixaram de ser redeclarados em cada tela**: `ManagedSurvey` existia em três arquivos com campos diferentes, `ApplicationItem` e `PersonSearchResult` em dois cada, e nenhuma cópia sabia da outra — divergiam em silêncio até alguém ler um campo que aquela versão não declarava. Hoje o formato vem dos contratos em [src/lib/api/](src/lib/api/), que declaram o retorno **completo** da RPC; tela que usa menos campos ignora o resto, e o compilador avisa quando o banco muda. A **guarda de acesso deixou de ser reescrita em cada página**: as 17 telas autenticadas repetiam a mesma sequência (carregando → identidade → módulo → montar o `user` da casca), com desfechos divergentes — parte usava `FullPageState`, parte um `<main>` vermelho sem caminho de volta. Hoje `usePlatformGuard()` ([src/lib/platform-guard.ts](src/lib/platform-guard.ts)) resolve os quatro estados e `PlatformGuardState` os apresenta. `metadataText()` e `metadataObject()`, antes duplicadas em `/area` e `/perfil`, vivem em [src/lib/person-metadata.ts](src/lib/person-metadata.ts). O estado do catálogo deixou de ser reimplementado nas telas — `/area` e `/pesquisas` importam `surveyItemState()` e `surveyApplicationHref()` de [src/lib/survey-catalog.ts](src/lib/survey-catalog.ts) e compartilham a consulta pelo hook `useSurveyCatalog`. Os modais ad hoc de `/equipe` e das telas administrativas deram lugar ao `Dialog` de `overlay-panel.tsx` e ao diálogo de confirmação de `confirmation-provider.tsx`. O **autossalvamento genérico** deixou de manter uma corrente manual de `Promise`: `/pesquisas/[applicationCode]` agora usa a mesma `ReliableSaveQueue` das duas jornadas do CDDI, inclusive para estado visual e bloqueio do envio quando a gravação falha.

### Inconsistências

1. **Domínio institucional divergente.** [src/app/auth/confirm/route.ts](src/app/auth/confirm/route.ts#L12) fixa `ALLOWED_DOMAIN = "agenciasus.org.br"` no código, enquanto [docs/acesso-institucional.md](docs/acesso-institucional.md) documenta `ALLOWED_INSTITUTIONAL_DOMAINS` aceitando `agenciasus.org.br,agsus.org.br`. Uma conta `@agsus.org.br` seria aceita pela função SQL e rejeitada pelo callback.

2. **Atalhos de teclado inativos.** `PlatformInteractionLayer` filtra atalhos por `modules`, mas [src/components/app-providers.tsx](src/components/app-providers.tsx#L29) o monta sem a prop — `allowedShortcuts` fica sempre vazio e nenhum atalho `Alt+1..4`/`Alt+A` funciona.

3. **Dois avisos de offline simultâneos.** `PlatformInteractionLayer` e `NetworkStatusBanner` mostram banners próprios ao perder conexão; ambos são renderizados por `AppProviders`.

4. **`/cddi/README.md` desatualizado.** Afirma que "a persistência definitiva depende da autenticação institucional", mas o envio já está implementado (`submit_my_cddi_submission`). O mesmo vale para o último parágrafo de [docs/formulario-cddi-ui.md](docs/formulario-cddi-ui.md).

5. **`supabase/migrations/README.md` desatualizado.** Diz que "a primeira migration será criada após a modelagem"; existem 51 migrations aplicadas.

6. **Rascunho em `sessionStorage`.** [docs/formulario-cddi-ui.md](docs/formulario-cddi-ui.md) cita salvamento em `sessionStorage`; o código atual persiste direto no banco via `save_my_cddi_answer`.

7. **Adoção parcial das bibliotecas de formulário.** `react-hook-form` + `@hookform/resolvers` + `zod` agora sustentam `/admin/configuracoes` e `/admin/pesquisas/nova`; o restante das telas continua com estado local e validação manual.

8. **`supabase/config.toml` ausente do repositório.** É preciso executar `supabase init` localmente antes de usar a CLI; versionar o arquivo tornaria o ambiente local reprodutível.

### Segurança e robustez

1. **`isSameOrigin()` aceita requisições sem header `Origin`** em [src/app/api/observability/errors/route.ts](src/app/api/observability/errors/route.ts#L9-L13) — comportamento necessário para `keepalive`; a decisão está registrada em comentário no próprio arquivo.

2. **`/api/background/[id]` faz proxy de imagens do Unsplash** apenas para o plano de fundo da tela de login. Índice validado e cache longo, mas é uma dependência externa em rota pública.

3. **Upload de logotipo validado só no navegador.** [src/app/admin/configuracoes/tela-admin-configuracoes.tsx](src/app/admin/configuracoes/tela-admin-configuracoes.tsx) checa tipo, dimensão mínima e proporção antes de enviar ao storage `platform-assets`; quem chamar a API direto não passa por essa checagem. A limpeza do arquivo órfão em caso de falha da RPC está implementada.

**Resolvidos.** O token administrativo digitado na interface deixou de existir junto com a tela de importação, e `window.confirm` foi substituído pelo diálogo acessível de `confirmation-provider.tsx`.

### Manutenibilidade

1. **Arquivos muito grandes.** [src/app/admin/pesquisas/[surveyId]/tela-admin-construtor-pesquisa.tsx](src/app/admin/pesquisas/[surveyId]/tela-admin-construtor-pesquisa.tsx) tem ~54 KB e [src/app/paineis/cddi/tela-painel-cddi.tsx](src/app/paineis/cddi/tela-painel-cddi.tsx) ~37 KB em um único componente. Extrair editores, tabelas e cartões facilitaria revisão e manutenção.

2. **JSX em linhas muito longas.** Diversas telas concentram seções inteiras em uma única linha (algumas com mais de 3.000 caracteres), o que inviabiliza diffs legíveis. Reformatar é seguro (não altera comportamento), mas produz um diff grande — decisão da equipe.

3. **Tipagem das RPCs por asserção.** Todo retorno usa `data as T`, sem tipos gerados. `supabase gen types typescript` eliminaria a divergência silenciosa entre banco e frontend.

4. **Cores fora dos tokens.** Hexadecimais literais (`#003b70`, `#086ab6`, `#26368d`) convivem com `var(--brand-primary)`. O tema escuro pode não cobrir os valores fixos.
