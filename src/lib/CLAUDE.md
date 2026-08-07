# Módulo `src/lib` — domínio no cliente e acesso ao Supabase

## Objetivo

Concentrar tudo que não é apresentação: identidade e permissões, fábricas de cliente Supabase e **funções puras** que carregam a parte testável do domínio.

É a camada mais testada do projeto — 18 arquivos de teste, 84 casos.

## Responsabilidades

- Resolver e cachear o contexto institucional do usuário.
- Criar clientes Supabase com a configuração correta para cada ambiente de execução.
- Normalizar, validar e ordenar dados sem depender de React, DOM ou rede.
- **Não** conter regra de autorização definitiva: essa vive no banco. O que existe aqui é derivação de interface a partir do que o banco autorizou.

## Arquivos importantes

### Identidade e permissões

| Arquivo | Interface pública |
|---|---|
| `platform-context.ts` | `usePlatformContext()`, `deriveModules()`, `profileLabel()`, `invalidatePlatformContext()`, tipo `PlatformContext` |
| `platform-modules.ts` | `PLATFORM_MODULE`, `PLATFORM_MODULES`, `resolvePlatformModules()`, `normalizePlatformModules()`, `isPlatformModule()` |
| `platform-navigation.ts` | `platformNavigationGroups`, `navigationGroupsForModules()`, `isPlatformNavItemActive()` |
| `platform-theme.ts` | `normalizePlatformTheme()`, `resolvePlatformTheme()`, `getPlatformThemeState()`, `platformThemeBootstrapScript()` |
| `platform-sidebar.ts` | `isPlatformSidebarCompact()`, `platformSidebarBootstrapScript()`, chave e atributo compartilhados |
| `auth-callback.ts` | `safeAuthNext()`, `pkceExchangeOptions()`, `DEFAULT_AUTH_DESTINATION` |

### Clientes Supabase (`supabase/`)

| Arquivo | Onde usar | Chave |
|---|---|---|
| `client.ts` | componentes de cliente | publicável, singleton, PKCE com `appendPkceFlowIdToRedirects` |
| `server.ts` | Server Components e Route Handlers com sessão | publicável, cookies via `next/headers` |
| `proxy.ts` | apenas `proxy.ts` da raiz | publicável, reescreve cookies na resposta |
| `admin.ts` | **apenas** `src/app/api/**` | **secreta — ignora RLS** |

### Domínio

| Arquivo | Interface pública |
|---|---|
| `survey-catalog.ts` | `surveyItemState()`, `surveyStateRank()`, `compareSurveyPriority()`, `selectPrioritySurvey()`, `summarizeSurveyCatalog()`, `surveyApplicationHref()` |
| `survey-builder.ts` | `QUESTION_TYPES`, `sectionDraftErrors()`, `questionDraftErrors()`, `buildQuestionOptions()`, `questionOptionsToText()`, `needsQuestionOptions()`, `moveAvailability()`, `questionMoveTargets()`, `hasUnsavedChanges()` |
| `survey-visual-identity.ts` | `resolveSurveyVisualIdentity()`, `DEFAULT_CDDI_VISUAL_IDENTITY` |
| `survey-runtime.ts` | `restoreSurveyAnswer()`, `isSurveyAnswerComplete()`, `buildSurveyAnswerPayload()`, tipos `StoredSurveyAnswer`, `SurveyAnswerValue` |
| `cddi-question-applicability.ts` | `isCddiQuestionVisible()`, `visibleCddiSections()` |
| `platform-branding.ts` | `PlatformBranding`, `DEFAULT_PLATFORM_BRANDING`, `normalizePlatformBranding()`, `platformBrandingTitle()` |
| `admin-import-contract.ts` | `adminImportRequestSchema`, `parseAdminImportRequest()`, `formatAdminImportValidationErrors()`, `MAX_IMPORT_ROWS_PER_REQUEST`, `MAX_IMPORT_TOTAL_ROWS`, tipos `AdminImportRequest`, `ParticipantImportRow` |
| `people-import.ts` | `parsePeopleImportRows()`, `summarizePeopleImport()`, tipos `PeopleImportRow`, `PeopleImportSummary` |
| `avatar-config.ts` | `defaultAvatarConfig()`, `normalizeAvatarConfig()`, catálogos de opções e cores |
| `observability.ts` | `reportApplicationError()`, `sanitizeObservabilityText()`, `errorMessageFromUnknown()`, `createErrorReference()` |
| `reliable-save-queue.ts` | classe `ReliableSaveQueue` |
| `utils.ts` | `cn()` — `twMerge(clsx(...))` |

## Fluxo interno

### `usePlatformContext()`

```text
cache válido (< 2 min)?  → devolve na hora
requisição em voo?       → devolve a mesma promise (deduplicação)
senão:
  1. auth.getUser()  sem usuário → throw "AUTH_REQUIRED"
  2. sync_my_google_avatar()     falha não-AUTH → apenas console.warn
  3. get_my_platform_context()
  4. status UNLINKED →
       resolve_authenticated_person(null)   cria/vincula cadastro institucional
       sync_my_google_avatar()
       get_my_platform_context()            recarrega
  5. AUTH_REQUIRED → throw ; status ≠ OK → throw com a mensagem do banco
  6. grava no cache de módulo
```

O hook trata `AUTH_REQUIRED` com `window.location.replace("/acesso")`; qualquer outro erro vira a string `error`. O cache é **de módulo, não de React** — sobrevive à navegação no cliente. Após alterar papéis ou perfil, chame `invalidatePlatformContext()`.

### `resolvePlatformModules()` — precedência

```text
1. roles contém ADMINISTRATOR      → todos os módulos (curto-circuito)
2. explicitModules válidos e não vazios → usa exatamente esses
3. roles contém TECHNICAL_TEAM     → todos os módulos
4. roles contém SURVEY_MANAGER     → todos exceto ADMIN_ACCESS
5. padrão do participante (HOME, SURVEYS, DASHBOARDS, RESULTS)
   + TEAM se isLeader ou role LEADER
```

`profileLabel()` segue ordem própria: `ADMINISTRATOR` → `TECHNICAL_TEAM` → `SURVEY_MANAGER` → liderança → participante.

### `parsePeopleImportRows()` — duas passagens

**Passagem 1 — por linha:**
- Cabeçalhos resolvidos por alias: `normalizeToken()` remove acentos, força maiúsculas e reduz separadores a espaço, então `NU_MATRICULA`, `Matrícula` e `matricula` colidem no mesmo token.
- `detectSourceFormat()` distingue `CDDI_BASE_COMPILADO` de `STANDARD_PEOPLE_BASE` pelos cabeçalhos presentes.
- `normalizeDate()` aceita `DD/MM/AAAA`, ISO e dois formatos que o SheetJS produz ao reinterpretar CSV como padrão norte-americano (`M/D/AA` e `M/D/AAAA`). Ano de dois dígitos: `≥ 70` → 1900+, senão 2000+.
- Ausência de matrícula ou nome é **erro** (bloqueia a linha); problema de e-mail, e-mail de gestor ou data é **aviso** (preserva a pessoa).
- `rowNumber` é `index + 2` porque a linha 1 da planilha é o cabeçalho.

**Passagem 2 — entre linhas:**
- Matrícula repetida: a **primeira** ocorrência recebe aviso, as seguintes recebem erro. Assim uma linha é importada e o restante é rejeitado, sem perder o registro.
- Contagem de e-mails considera **matrículas distintas** (`uniqueEmployeesForEmail`), não linhas — duplicata de matrícula não infla a contagem de e-mail.
- `emailEligibleForAccess` só é `true` com e-mail válido, **único entre matrículas** e linha sem erro. É a tradução em código da decisão de [docs/auditoria-base-cddi-2026.md](../../docs/auditoria-base-cddi-2026.md).

### `ReliableSaveQueue`

Serializa gravações encadeando `tail`. `enqueue()` devolve a promise da operação (para o chamador tratar erro) e mantém `tail` sempre resolvida, de modo que uma falha não trava a fila. `getSnapshot()` deriva `SAVING`/`ERROR`/`IDLE` de `pending` e `lastError`; `subscribe()` emite imediatamente ao assinar. `flush()` aguarda a fila e relança o último erro.

### `reportApplicationError()`

Deduplicação por impressão digital (`type|route|message|httpStatus`) com janela de 30 s, limpando entradas expiradas a cada chamada. Envia com `keepalive: true` para sobreviver ao descarregamento da página; `fetch` que falha devolve `false` em vez de lançar — observabilidade nunca deve quebrar a aplicação.

## Regras de negócio nesta camada

- **`safeAuthNext()`** só aceita caminho interno: precisa começar com `/`, não pode começar com `//`, não pode conter `\`, e o `URL` resolvido contra uma origem sentinela precisa manter essa origem. Qualquer desvio devolve `/area`. Preserva `search` e `hash`.
- **`resolveSurveyVisualIdentity()`** aceita banner personalizado só com `themeVariant === "CUSTOM"` **e** URL **HTTPS** válida. `INSTITUTIONAL` volta ao padrão. Título e subtítulo podem ser personalizados em qualquer variante.
- **`normalizeAvatarConfig()`** valida cada campo contra o catálogo permitido e degrada para o padrão derivado do nome da pessoa. Metadado corrompido nunca quebra a renderização; `seed` limitado a 120 caracteres.
- **`buildQuestionOptions()`** preserva `id` e `value` das alternativas existentes por posição ao renomear rótulos — evita invalidar respostas já gravadas.
- **`surveyItemState()`** — precedência: concluída > rascunho > encerrada > agendada > pendente.
- **`survey-runtime.ts` é a tradução entre banco e formulário**, por tipo de pergunta. `buildSurveyAnswerPayload()` zera todo campo que não pertence ao tipo — texto em pergunta numérica vai como `null`, não como string. `DATETIME` é o único caso com conversão de fuso: o banco guarda ISO em UTC e o input `datetime-local` exige hora local, então `restoreSurveyAnswer()` reformata na ida e `buildSurveyAnswerPayload()` volta para ISO. Adicionar tipo de pergunta exige mexer nas três funções **e** em `isSurveyAnswerComplete()`, que é quem decide se uma obrigatória está respondida.
- **`isCddiQuestionVisible()`** esconde toda pergunta `PERSON` (a chefia é vínculo institucional, gravado por `set_my_cddi_leader`, não campo do formulário) e respeita `validation.allowed_submission_types`. Lista ausente ou vazia significa "vale para os dois tipos".
- **`normalizePlatformBranding()`** exige cor no formato `#RRGGBB` e degrada campo a campo para `DEFAULT_PLATFORM_BRANDING` — marca corrompida no banco nunca deixa a casca sem logotipo ou sem nome.
- **`admin-import-contract.ts` é a fonte única do formato da importação**, compartilhada entre a tela, a rota de API e o teste. Limite de 250 linhas por requisição e 50.000 no total.

## Dependências

Externas: `@supabase/ssr`, `@supabase/supabase-js`, `clsx`, `tailwind-merge`, `zod` (só em `admin-import-contract.ts`), `react` (só em `platform-context.ts`), `next/headers` e `next/server` (só nos clientes de servidor/proxy).

Internas: apenas entre arquivos deste módulo. `platform-navigation.ts` importa o **tipo** `PlatformIconName` de `@/components/platform-icons` — única dependência para fora, deliberada e sem custo em runtime.

`src/hooks/` fica **fora** deste módulo e pode depender dele: `use-survey-catalog.ts` combina React Query com o tipo `SurveyCatalogItem` daqui. Função pura vai para `src/lib`; hook que consulta o Supabase vai para `src/hooks`.

## Convenções específicas

- Função exportada de arquivo sem `"use client"` deve ser pura e testável. Só `platform-context.ts` declara `"use client"`.
- Scripts de bootstrap (`platformThemeBootstrapScript`, `platformSidebarBootstrapScript`) devolvem string de IIFE com valores serializados por `JSON.stringify`, executada `beforeInteractive` no layout raiz. Preferência e chave de `localStorage` ficam definidas em um só lugar, compartilhadas entre script e componente.
- Validadores devolvem **array de mensagens em português**, não lançam exceção.
- Normalizadores nunca lançam: entrada inválida degrada para um padrão seguro.
- Mensagem de erro de configuração é explícita sobre qual variável falta.

## Pontos de atenção

- **`supabase/admin.ts` ignora RLS.** Importá-lo de um componente de cliente vaza a chave de serviço no bundle. Só `src/app/api/**` pode usá-lo.
- O cache de contexto é global ao módulo. Ao alterar papel, módulo ou avatar, chame `invalidatePlatformContext()` ou o usuário vê dado velho por até 2 minutos.
- `server.ts` engole a falha de escrita de cookie em `try/catch` porque Server Components não podem escrever cookies — o proxy mantém a sessão. Não "corrija" removendo o catch.
- `platform-navigation.ts` é a **única** fonte do menu. Nova rota no menu = nova entrada aqui, com `module` associado, senão ela aparece para todos.
- `survey-catalog.ts` e `reliable-save-queue.ts` saíram do limbo: `/area` e `/pesquisas` consomem o catálogo (pelo hook `@/hooks/use-survey-catalog`) e as duas jornadas do CDDI usam `ReliableSaveQueue`. O runtime genérico (`/pesquisas/[applicationCode]`) ainda serializa gravações com um `useRef<Promise>` próprio — é a última duplicação viva desse par. Ver melhorias no [README](../../README.md).
- `people-import.ts` compara warnings por **string literal** (`row.warnings.includes("E-mail institucional não informado")`), e `src/app/api/admin/import-participants/route.ts` depende dos mesmos literais para derivar `data_import_issues`. Alterar um texto exige alterar o outro.
