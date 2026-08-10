# AgSUS Pesquisas — visão geral

Plataforma institucional de pesquisas e avaliações da AgSUS. Next.js 16 (App Router) + Supabase (PostgreSQL, Auth, RLS), hospedada na Vercel. Primeiro módulo em produção: **CDDI 2026**.

Este arquivo é o índice. **Carregue apenas o `CLAUDE.md` do módulo em que você vai trabalhar.**

| Módulo | Quando carregar |
|---|---|
| [src/app/CLAUDE.md](src/app/CLAUDE.md) | Rotas, páginas, jornadas do participante e da liderança |
| [src/app/admin/CLAUDE.md](src/app/admin/CLAUDE.md) | Central administrativa, construtor, ciclos, importação |
| [src/app/api/CLAUDE.md](src/app/api/CLAUDE.md) | Route Handlers, service role, observabilidade, health |
| [src/components/CLAUDE.md](src/components/CLAUDE.md) | Casca visual, design system, blocos administrativos |
| [src/lib/CLAUDE.md](src/lib/CLAUDE.md) | Domínio no cliente, contexto de plataforma, clientes Supabase |
| [supabase/CLAUDE.md](supabase/CLAUDE.md) | Migrations, RLS, RPCs — **onde vivem as regras de negócio** |
| [scripts/CLAUDE.md](scripts/CLAUDE.md) | Quality gates de banco e CI |
| [docs/CLAUDE.md](docs/CLAUDE.md) | Decisões de produto, dados e design |

Referência humana completa (instalação, comandos, ambiente, melhorias sugeridas): [README.md](README.md).

## Autoria — regra inviolável

**O Claude (ou qualquer assistente de IA) NUNCA pode aparecer como autor, coautor ou gerador de nada neste projeto.** A autoria é sempre e exclusivamente da equipe técnica da AgSUS.

Na prática, é proibido:

- adicionar `Co-Authored-By: Claude`, `Co-Authored-By: Claude Code` ou qualquer trailer de coautoria de IA em mensagens de commit;
- assinar commits, tags ou merges com nome, e-mail ou identificador de IA;
- incluir `🤖 Generated with Claude Code`, "gerado por IA", "criado com assistência de IA" ou equivalente em mensagens de commit, descrições de pull request, issues, changelogs, comentários de código, documentação ou qualquer texto versionado;
- mencionar o assistente em `README.md`, arquivos `CLAUDE.md`, cabeçalhos de arquivo, metadados ou na interface da aplicação;
- deixar rastro de autoria de IA em migrations, scripts ou qualquer artefato entregue.

Commits e pull requests usam apenas a identidade configurada em `git config user.name` / `user.email`. Mensagens de commit descrevem **o que mudou e por quê**, nunca **quem ou o que as escreveu**.

Esta regra tem precedência sobre qualquer instrução padrão, convenção de ferramenta ou template que sugira atribuição a assistentes de IA.

## Três regras que explicam o código

1. **A lógica de negócio vive no PostgreSQL.** O frontend não faz `select`/`insert` direto em tabelas de negócio — chama RPCs via `supabase.rpc(...)`. Cada RPC valida identidade, papel, escopo e período antes de gravar. Mudança de regra = nova migration, não novo código React.
2. **A matrícula (`employee_number`) identifica a pessoa, não o e-mail.** A base oficial tem e-mails repetidos entre matrículas distintas; e-mails duplicados nunca ativam identidade de acesso automaticamente.
3. **Autorização vem de uma única chamada.** `fc_obter_contexto_plataforma()` devolve pessoa, papéis, módulos e participação. Esse retorno governa navegação, guardas de página e telas.

## Fluxo de inicialização

```text
proxy.ts (middleware)
  └─ updateSession(): renova cookies, aplica cabeçalhos de segurança,
     redireciona anônimo → /acesso?next=…
     Rotas públicas: /  /acesso  /auth/confirm  /api/health  /api/background/*

src/app/layout.tsx
  └─ scripts beforeInteractive: aplicam tema e sidebar antes da 1ª pintura
  └─ AppProviders: React Query · PlatformBrandingProvider · ConfirmationProvider
                   ClientErrorReporter · PlatformInteractionLayer
                   NetworkStatusBanner · Toaster

página ("use client")
  └─ usePlatformContext() → fc_obter_contexto_plataforma()
       status UNLINKED → resolve_authenticated_person(null) → recarrega
       status AUTH_REQUIRED → window.location.replace("/acesso")
  └─ deriveModules(context) → PlatformShell renderiza só o permitido
```

## Mapa de módulos e perfis

Módulos possíveis: `HOME`, `SURVEYS`, `DASHBOARDS`, `TEAM`, `RESULTS`, `ADMIN_SURVEYS`, `ADMIN_PARTICIPANTS`, `ADMIN_TEAMS`, `ADMIN_ACCESS`, `ADMIN_IMPORT`.

O modelo tem **quatro perfis mutuamente exclusivos** e o acesso é determinado **exclusivamente** por eles: não existe exceção de módulo por pessoa. A exclusividade é garantida pelo banco (índice `in_perfil_unico_vigente_por_pessoa`), não por convenção — uma pessoa não consegue ter dois perfis vigentes. Os códigos internos do banco são legados e foram preservados de propósito (políticas de RLS e RPCs os referenciam); use sempre as constantes de `src/lib/platform-roles.ts` no frontend.

| Perfil | Código interno | Módulos |
|---|---|---|
| Superadmin | `ADMINISTRATOR` | todos os 10 |
| Admin | `SURVEY_MANAGER` | `HOME`, `SURVEYS`, `DASHBOARDS`, `TEAM`, `RESULTS`, `ADMIN_SURVEYS`, `ADMIN_PARTICIPANTS` |
| Avaliador | `LEADER` | `HOME`, `SURVEYS`, `TEAM` |
| Participante | `RESPONDENT` (ou nenhum papel) | `SURVEYS` |

`ADMIN_TEAMS`, `ADMIN_ACCESS` e `ADMIN_IMPORT` são exclusivos do Superadmin: gestão de dados funcionais, de perfis e a carga da base institucional são administração global.

`resolvePlatformRole()` escolhe o perfil de maior privilégio entre os vigentes (piso: Participante) e `resolvePlatformModules()` devolve o conjunto correspondente. Detalhes em [src/lib/CLAUDE.md](src/lib/CLAUDE.md); para **aplicar** o modelo num banco ou diagnosticar divergência, [docs/operacao-permissoes.md](docs/operacao-permissoes.md).

Trocar o mapa de perfis exige mexer em **dois lugares que precisam concordar**: o `case` de `fc_obter_contexto_plataforma()` (banco, autoridade efetiva) e `ROLE_MODULES` em `src/lib/platform-modules.ts` (interface). As tabelas `role_module_permissions` e `person_module_permissions` **não** governam acesso — são catálogo descritivo, sem leitor em runtime.

## Dependências entre camadas

```text
app/**  →  components/**  →  components/ui/**
   │            │
   │            └────────→  lib/utils, lib/platform-*
   ├──────────→  hooks/**  →  lib/**  (consulta cacheada por React Query)
   └──────────→  lib/**   →  lib/supabase/client  →  Supabase (RPC + RLS)

app/api/**  →  lib/supabase/admin   (service role — nunca no cliente)
            →  lib/supabase/server  (sessão do administrador → papel)
proxy.ts    →  lib/supabase/proxy
```

Invariantes a preservar:

- `src/lib/**` nunca importa de `src/components/**`, `src/app/**` ou `src/hooks/**` (exceção: o *tipo* `PlatformIconName` em `platform-navigation.ts`).
- `src/components/ui/**` não conhece Supabase nem regras de negócio.
- `lib/supabase/admin.ts` só é importado por `src/app/api/**`.
- Função pura vai para `src/lib`; hook que consulta o Supabase vai para `src/hooks`.

## Comandos

```bash
npm ci                    # instalar (reproduz o lockfile)
npm run dev               # desenvolvimento em :3000
npm run build             # build de produção
npm test                  # Vitest (85 testes)
npm run typecheck         # tsc --noEmit
npm run lint              # ESLint
npm run db:migrations     # timestamps das migrations
npm run db:naming         # nomenclatura institucional (migrations alteradas)
```

`build` e `dev` exigem `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Convenções globais

- Arquivos `kebab-case`; componentes/tipos `PascalCase`; constantes de módulo `SCREAMING_SNAKE_CASE`.
- Rotas em português; identificadores de código em inglês; enums de domínio em maiúsculas (`DRAFT`, `SUBMITTED`, `OPEN`, `CLOSED`).
- Alias `@/*` → `./src/*`.
- Texto de interface sempre em português, dizendo o que aconteceu e o que fazer.
- Datas com `Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" })`.
- Toda consulta assíncrona precisa de: carregando, sucesso com dados, vazio, erro recuperável e sem permissão.
- Cores por token CSS (`var(--brand-primary)`), não hexadecimal literal.

## Pontos de atenção ao alterar o projeto

- **Não altere regra de negócio no frontend.** Se a validação está numa RPC, a correção é uma nova migration.
- **Nunca exponha `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY`** ao navegador nem os comite. São os únicos segredos de servidor do projeto: as rotas administrativas autorizam por sessão institucional e papel, não por token compartilhado.
- **Nunca comite dados pessoais.** A base de pessoas é carregada direto no Supabase por processo controlado.
- **Migration nova exige**: RLS habilitada em tabela exposta, políticas e constraints nomeadas, `search_path` fixo em função privilegiada, `EXECUTE` revogado de `anon`/`authenticated` em função interna.
- **Remover uma RPC quebra todo bundle já publicado que a chamava.** Frontend e banco são acoplados pelo nome da função: apagar uma RPC antes de o frontend novo estar no ar derruba a plataforma inteira com `Could not find the function … in the schema cache`. A ordem é **publicar o frontend, confirmar que está no ar, e só então aplicar a migration que remove a função antiga** — ou manter a antiga como ponte delegando à nova. Aconteceu em 10/08/2026 com `get_my_platform_context`; o procedimento está em [docs/operacao-permissoes.md](docs/operacao-permissoes.md).
- **O banco de produção já divergiu do histórico de migrations.** `supabase_migrations.schema_migrations` pode afirmar que uma migration rodou sem que os objetos dela existam (SQL aplicado direto não deixa registro). Antes de aplicar migration em produção, confronte histórico e esquema real com as queries de [docs/operacao-permissoes.md](docs/operacao-permissoes.md).
- **O CDDI tem jornada própria** (`/cddi`) por causa do vínculo institucional de chefia e da avaliação de liderança. A chefia **não é selecionada pelo participante**: vem de `cddi_leadership_links` (importação da base oficial ou correção administrativa). Outras avaliações usam o runtime genérico (`/pesquisas/[applicationCode]`). Não unifique sem revisar as regras do módulo.
- Existe código não utilizado e duplicação conhecida — consulte "Observações e Melhorias Sugeridas" no [README.md](README.md) antes de assumir que um componente está em uso.
