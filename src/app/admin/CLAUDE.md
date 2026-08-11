# Módulo `src/app/admin` — central administrativa

## Objetivo

Dar ao Admin e ao Superadmin autonomia para criar instrumentos, operar ciclos, definir público, corrigir estrutura organizacional, administrar acessos e atualizar a base institucional — sempre com validação e auditoria no banco.

Perfis: Admin (código interno `SURVEY_MANAGER`) opera as pesquisas — `ADMIN_SURVEYS` e `ADMIN_PARTICIPANTS`; Superadmin (código interno `ADMINISTRATOR`) soma a administração global — `ADMIN_TEAMS`, `ADMIN_ACCESS` e `ADMIN_IMPORT`. Constantes em `@/lib/platform-roles` e `@/lib/platform-modules`.

Convenções gerais de rota em [../CLAUDE.md](../CLAUDE.md).

## Responsabilidades

- Aplicar a guarda de módulo antes de qualquer operação (`usePlatformGuard(PLATFORM_MODULE.ADMIN_…)`, ver [../CLAUDE.md](../CLAUDE.md)).
- Traduzir ações administrativas em chamadas RPC e apresentar o resultado (toast de sucesso, mensagem de erro do banco).
- Explicar ao operador **por que** uma ação está indisponível — nunca apenas desabilitar o botão.

## Rotas e RPCs

A coluna **Tela** é o arquivo a abrir para editar a rota; o `page.tsx` ao lado só re-exporta (convenção descrita em [../CLAUDE.md](../CLAUDE.md)). Caminhos relativos a `src/app/admin/`.

| Rota | Tela | Módulo exigido | RPCs |
|---|---|---|---|
| `/admin` | `tela-central-admin.tsx` | qualquer `ADMIN_*` | — (cartões de navegação) |
| `/admin/pesquisas` | `pesquisas/tela-admin-lista-pesquisas.tsx` | `ADMIN_SURVEYS` | `list_managed_surveys` |
| `/admin/pesquisas/nova` | `pesquisas/nova/tela-admin-nova-pesquisa.tsx` | `ADMIN_SURVEYS` | `create_survey_draft` |
| `/admin/pesquisas/[surveyId]` | `pesquisas/[surveyId]/tela-admin-construtor-pesquisa.tsx` | `ADMIN_SURVEYS` | `get_survey_builder`, `add_survey_section`, `update_survey_section`, `add_survey_question`, `update_survey_question`, `delete_survey_question`, `duplicate_survey_builder_item`, `reorder_survey_builder_item`, `move_survey_question_to_section`, `fc_excluir_pesquisa_rascunho` |
| `/admin/pesquisas/[surveyId]/identidade` | `pesquisas/[surveyId]/identidade/tela-admin-identidade-visual.tsx` | `ADMIN_SURVEYS` | `get_survey_builder`, `get_application_visual_settings`, `update_application_visual_settings` |
| `/admin/pesquisas/[surveyId]/operacao` | `pesquisas/[surveyId]/operacao/tela-admin-operacao-ciclo.tsx` | `ADMIN_SURVEYS` | `get_survey_operations`, `manage_survey_cycle` |
| `/admin/participantes` | `participantes/tela-admin-participantes.tsx` | `ADMIN_PARTICIPANTS` | via componentes: `get_admin_people_base_summary`, `list_admin_participant_applications`, `list_admin_application_participants`, `search_admin_people_for_application`, `assign_admin_application_participant`, `assign_admin_application_participants_bulk`, `assign_admin_all_available_participants`, `create_and_assign_admin_participant`, `set_admin_application_participant_status` |
| `/admin/equipes` | `equipes/tela-admin-equipes.tsx` | `ADMIN_TEAMS` | `search_platform_admin_people`, `update_platform_admin_person`, `list_platform_admin_leadership_links`, `set_platform_admin_leadership_link`, `list_platform_admin_person_audit`, `list_admin_participant_applications` |
| `/admin/acessos` | `acessos/tela-admin-acessos.tsx` | `ADMIN_ACCESS` | `list_access_workspace`, `fc_definir_perfil_pessoa` |
| `/admin/configuracoes` | `configuracoes/tela-admin-configuracoes.tsx` | `ADMIN_ACCESS` | `fc_atualizar_marca_plataforma` |
| `/admin/importacao` | `importacao/tela-admin-importacao.tsx` | `ADMIN_IMPORT` | via `POST /api/admin/import-participants` |

## Fluxo interno

### Ciclo de vida de uma pesquisa

```text
/admin/pesquisas/nova       create_survey_draft
        ↓                   cria survey + versão 1 + aplicação, todos em rascunho
/admin/pesquisas/[surveyId]              estrutura: seções, perguntas, alternativas
        ├── /identidade                  título e subtítulo da capa (a arte é fixa)
        └── /operacao                    período e máquina de estados do ciclo
```

**A árvore acima é de rotas, não de navegação.** As duas telas filhas não são alcançáveis pelo construtor: o catálogo (`/admin/pesquisas`) leva ao construtor por "Editar formulário" e a `/operacao` por "Propriedades", e **`/identidade` só é alcançável a partir de `/operacao`**, pelo botão "Editar identidade visual". Por isso a tela de identidade volta para `/operacao` ("Voltar às propriedades"), e não para o construtor — o botão de ida saiu de lá. Mover essa entrada de novo exige mexer no botão de volta da tela de identidade, senão o operador cai numa tela de onde não veio.

**Máquina de estados do ciclo** (`manage_survey_cycle`, ação em `target_action`):

```text
DRAFT ──UPDATE_PERIOD──▶ DRAFT
DRAFT ──PUBLISH──▶ (versão publicada; estrutura congelada)
DRAFT/SCHEDULED ──SCHEDULE──▶ SCHEDULED ──OPEN──▶ OPEN
OPEN ──CLOSE──▶ CLOSED ──REOPEN(novo período)──▶ OPEN
qualquer ──CANCEL──▶ CANCELLED   (irreversível)
```

**Criação em três etapas** (`/admin/pesquisas/nova`): Identificação → Ciclo e período → Revisão. As etapas 1 e 2 oferecem só **Cancelar** (vermelho claro) e **Prosseguir** (azul); as ações que gravam — **Criar rascunho** e **Publicar** — existem apenas na etapa de revisão, para que nenhuma etapa intermediária pareça capaz de concluir a criação. `goToNextStep()` valida só os campos da etapa atual (`STEPS[step].fields`): exigir o formulário inteiro impediria sair da primeira etapa por causa de campos ainda não exibidos.

**"Publicar" na criação não publica.** Uma avaliação nasce só com a seção `Introdução`, sem perguntas, e `PUBLISH` exige estrutura — o banco recusaria. O botão cria o rascunho e leva ao construtor com o aviso de que faltam perguntas; a publicação efetiva continua em `/operacao`.

Regras aplicadas pelo banco e refletidas na interface:

- **Abertura não pode ser anterior ao momento atual; encerramento tem de ser posterior à abertura.** Vale em `create_survey_draft` e em `UPDATE_PERIOD` (`20260811120000_periodo_futuro_e_exclusao_rascunho.sql`), com tolerância de um minuto para absorver o intervalo entre preencher "agora" e gravar. A checagem **não** entra em `PUBLISH`: bloquear ali deixaria o operador sem saída dentro da tela, já que o período vencido é justamente o que ele precisa abrir para corrigir. Quem avisa antes de publicar é a tela, por toast (`publishBlockedMessage()` em `@/lib/survey-cycle-period`), pedindo a correção do período. `SCHEDULE` e `OPEN` seguem barrando período vencido no banco.
- Período editável só em `DRAFT` ou `SCHEDULED`. Em `OPEN`, é preciso encerrar antes de alterar.
- `REOPEN` só a partir de `CLOSED` e exige novo `opensAt`/`closesAt`.
- `CANCELLED` não retoma — exige criar novo ciclo.
- `PUBLISH` roda `validate_survey_version_integrity`, que devolve pendências classificadas por `severity` (`BLOCKING` bloqueia; `WARNING` apenas alerta) e `category` (`STRUCTURE`, `CYCLE`, `PERIOD`, `AUDIENCE`). `readyToPublish` / `readyToOpen` no retorno de `get_survey_operations` derivam dessa validação.

**A tela de `/operacao` é a "Propriedades" do ciclo** — é assim que o catálogo a chama, pelo botão **"Propriedades"**. Ela usa os primitivos do design system (`Surface`, `PageHeader`, `Button`, `Badge`, `Skeleton`) e tokens CSS, não hexadecimal literal, então acompanha o tema escuro como o restante da administração.

Três decisões estruturam a tela:

- **Nenhum botão fica apagado sem explicação.** Cada operação do ciclo de vida é um objeto `CycleAction` com `description` (o que a ação faz) e `blockedReason` (por que está indisponível), derivado do estado atual. A mesma frase alimenta o `title`, o `aria-describedby` e a nota sob o botão — é a aplicação concreta da responsabilidade declarada no topo deste arquivo. Adicionar operação nova exige preencher os dois textos.
- **Código do banco não é rótulo de interface.** `CYCLE_STATUS_LABELS` e `VERSION_STATUS_LABELS` traduzem `DRAFT`/`OPEN`/`PUBLISHED` para português; o código interno sobrevive apenas no `title` do selo, para quem precisa correlacionar com o banco.
- **A navegação da rota fica no topo do conteúdo, não na casca.** Uma `<nav aria-label="Ações da avaliação">` abre a `main`, antes do `PageHeader`, com "Voltar ao catálogo" e "Editar identidade visual" (azul, `--brand-solid`). Ela fica **fora** do bloco de carregamento de propósito: a saída da tela precisa existir antes dos dados e sobreviver a uma falha da RPC. Por isso o teste do botão de identidade é `operations?.application?.id` — com encadeamento opcional, já que ali `operations` ainda pode ser nulo. `PlatformShell` é chamado **sem** `actions`: a tela não tem ação própria de cabeçalho.

O que **não** existe nesta tela, e foi removido por decisão de interface — não reintroduza sem pedido:

- **Trilha de etapas.** O `CycleProgress` (`Rascunho → Agendado → Aberto → Encerrado`) e a constante `CYCLE_STEPS` foram removidos. O aviso enfático de ciclo cancelado morava no ramo `CANCELLED` dessa trilha; a informação continua na tela por `cycleExplanation()`, no cartão de período.
- **Breadcrumbs.** A tela não tem caminho estrutural; o retorno é o botão "Voltar ao catálogo". O primitivo `Breadcrumbs` segue em uso em outras rotas administrativas — o que saiu foi só a chamada daqui.
- **Botão "Editar formulário".** O acesso ao construtor é pelo catálogo. Dentro desta tela, o único link para lá é o atalho "Abrir construtor" do checklist, que `issueFixHref()` só devolve para pendência de `category: "STRUCTURE"` — logo, num ciclo sem pendências não há caminho para o construtor daqui.
- **Botão "Atualizar dados".** A tela busca o agregado ao abrir (`useEffect`) e depois de cada mutação (`runAction` → `loadOperations()`), e não revalida sozinha — não há React Query nem polling aqui. Consequência aceita: contador de resposta num ciclo aberto e virada automática de `SCHEDULED` para `OPEN` só aparecem ao recarregar a página.

### Construtor de formulários

Validação no cliente por `@/lib/survey-builder` **antes** de chamar a RPC (o banco revalida):

- Seção: título obrigatório, ≤ 160 caracteres; descrição ≤ 1.000.
- Pergunta: enunciado obrigatório, ≤ 500; descrição ≤ 2.000; tipo dentre os 10 suportados.
- Tipos que exigem alternativas: `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `SCALE` — entre 2 e 50, cada uma ≤ 200 caracteres, sem repetição (comparação `toLocaleLowerCase("pt-BR")`).
- `buildQuestionOptions()` preserva `id` e `value` das alternativas existentes ao renomear rótulos, evitando invalidar respostas já gravadas. Em `SCALE`, `score` padrão é a posição (1, 2, 3…).
- `hasUnsavedChanges()` compara assinaturas para avisar antes de descartar edição.

**Só estrutura em rascunho é editável.** `enforce_draft_survey_structure` (trigger) impede alteração após a publicação.

**Excluir formulário** (`fc_excluir_pesquisa_rascunho`) fica numa seção destrutiva ao **fim** da página do construtor, apenas enquanto a versão é `DRAFT`, e confirma em diálogo que nomeia o formulário. A RPC recusa avaliação já publicada (a estrutura é referência histórica de quem respondeu) ou com qualquer submissão gravada, e a razão vem na própria mensagem de erro. Registra `SURVEY_DELETED` em `audit_events` **antes** do delete, com `application_id` nulo — a coluna referencia `survey_applications` com `on delete set null`, então o identificador do ciclo fica preservado em `metadata`.

**Não confie no cascade para apagar a estrutura.** `survey_sections`, `survey_questions` e `question_options` têm o trigger `enforce_draft_survey_structure` (`before … delete`), que resolve a versão da linha afetada e exige que ela **exista** e esteja em `DRAFT`. Como o `on delete cascade` do PostgreSQL remove a linha-pai antes das filhas, apagar `survey_versions` direto faz cada trigger filho não encontrar mais a versão e abortar tudo com `Versão da pesquisa não encontrada.`. Por isso a exclusão apaga explicitamente **de baixo para cima** — alternativas → perguntas → seções → ciclo → versão → pesquisa — com a versão ainda presente em cada passo (`20260811143000_corrigir_exclusao_pesquisa_rascunho.sql`). Inverter a ordem traz o erro de volta.

O mesmo vale **dentro** de `survey_sections`, que referencia a si mesma com `on delete cascade`: apagar a versão inteira num único `delete` remove a seção-pai antes da filha e reproduz o erro em avaliação com seções aninhadas. `20260811160000_corrigir_exclusao_secoes_aninhadas.sql` substitui essa varredura por um laço que apaga só folhas até esvaziar. Detalhe da regra em [../../../supabase/CLAUDE.md](../../../supabase/CLAUDE.md).

**404 na RPC é migration não aplicada, não bug de tela.** `POST …/rpc/fc_excluir_pesquisa_rascunho 404 (Not Found)` no console significa que a função não existe no banco daquele ambiente — o PostgREST nem chegou a executar SQL. Commit não é deploy: os arquivos em `supabase/migrations/` só passam a valer depois de aplicados no projeto Supabase. Antes de investigar a tela, confirme a existência da função (`select proname from pg_proc where proname = '…'`) e confronte `supabase_migrations.schema_migrations` com o esquema real, pelo procedimento de [../../../docs/operacao-permissoes.md](../../../docs/operacao-permissoes.md).

### Gestão de participantes

Três blocos independentes na mesma página:

1. `PeopleBaseSummaryCard` — retrato da base mestra.
2. `AdminParticipantBulkSelector` — vinculação em lote, incluindo "todos os disponíveis".
3. `AdminParticipantManagement` — busca individual, vinculação, criação avulsa e mudança de status (bloquear, reativar, excluir).

**Regra da arquitetura:** a base mestra de pessoas e o público de uma pesquisa são decisões separadas. A importação atualiza só a base; vincular alguém a um ciclo é ato explícito do administrador.

### Identidade da plataforma (`/admin/configuracoes`)

```text
formulário react-hook-form + zodResolver
  organizationName ≤ 60 · productName ≤ 60 · primaryColor /^#RRGGBB$/
logotipo (opcional)
  tipos aceitos: image/jpeg · image/png · image/webp
  validateLogoComposition(): ≥ 128 × 128 px e proporção entre 0,5 e 2
  upload em storage "platform-assets" → branding/logo-<uuid>.<ext>
fc_atualizar_marca_plataforma(no_organizacao, no_produto,
                              tx_url_logotipo, tx_caminho, co_cor_principal)
  falha depois do upload → remove o arquivo enviado (sem órfão no storage)
sucesso → queryClient.setQueryData(platformBrandingQueryKey, …)
```

A marca resolvida é distribuída por `PlatformBrandingProvider` (ver [../../components/CLAUDE.md](../../components/CLAUDE.md)), então salvar aqui muda cabeçalho e logotipo de toda a aplicação sem recarregar.

### Importação da base institucional

```text
navegador                       lê CSV/XLSX com `xlsx`
                                aba preferida: BASE_PARTICIPANTES → BASE → primeira
                                parsePeopleImportRows() + summarizePeopleImport()
                                lotes de CHUNK_SIZE = 200 linhas válidas
        ↓ POST /api/admin/import-participants  (sessão institucional, sem token)
servidor                        resolveAuthorizedActor() → apenas Superadmin
                                parseAdminImportRequest() → esquema zod
                                sync_people_base_rows → sync_cddi_manager_rows
                                registra data_import_batches / data_import_issues
```

- Só linhas com `valid === true` são enviadas; avisos não impedem o envio.
- `isFirstChunk` cria o lote; `isLastChunk` fecha como `COMPLETED` ou `COMPLETED_WITH_WARNINGS`.
- `survey_assignment: false` nos metadados registra que ninguém foi vinculado a pesquisa.
- CPF não é lido nem armazenado neste fluxo.

## Regras de negócio específicas

- **`/admin/equipes` exige o módulo `ADMIN_TEAMS`**, que pertence só ao Superadmin — a guarda é uma só, pelo módulo. A dupla verificação anterior (módulo **e** papel) deixou de existir: com perfis exclusivos, o mapa de módulos já é a regra.
- **Matrícula é imutável.** `update_platform_admin_person` não altera `employee_number` e exige justificativa, registrada para auditoria.
- **Admin nunca recebe `ADMIN_ACCESS`, `ADMIN_TEAMS` nem `ADMIN_IMPORT`** — quem gerencia pesquisas não define perfis, não altera dados funcionais e não carrega a base institucional. Cada cartão de `/admin` declara seu módulo e só aparece para quem o tem.
- **Perfis são exclusivos.** `/admin/acessos` define **o** perfil da pessoa por `fc_definir_perfil_pessoa`, que concede o escolhido e encerra os demais na mesma transação. Não há como acumular Admin + Participante.
- **Vínculos encerrados são preservados.** Retirar alguém da equipe encerra a vigência e registra evento em `audit_events`; nada é apagado.
- **A capa da avaliação é sempre a institucional.** `/admin/pesquisas/[surveyId]/identidade` configura **somente** título e subtítulo de abertura — não há envio de imagem. A tela chama `update_application_visual_settings` com `theme_variant: "INSTITUTIONAL"` e os três parâmetros de banner nulos; os parâmetros continuam na assinatura da RPC por compatibilidade com o bundle publicado, e removê-los exige a ordem descrita em [../../../CLAUDE.md](../../../CLAUDE.md) (publicar o frontend antes da migration). `resolveSurveyVisualIdentity()` descarta `bannerUrl`/`themeVariant` gravados em ciclos antigos — sem isso, uma capa personalizada salva antes da mudança sobreviveria sem caminho de edição. O bucket `survey-assets` deixou de receber uploads pela interface.

## Dependências

- [@/components](../../components/CLAUDE.md) — `admin-participant-*`, `admin-people-teams-management`, `people-base-summary`, primitivos `ui/`.
- [@/lib/survey-builder](../../lib/CLAUDE.md) — validação de rascunhos.
- [@/lib/people-import](../../lib/CLAUDE.md) — parsing e resumo da planilha.
- [@/lib/platform-branding](../../lib/CLAUDE.md) — normalização da marca em `/admin/configuracoes`.
- [/api/admin/import-participants](../api/CLAUDE.md) — única rota administrativa com service role.
- `react-hook-form` + `zod` (via `zodResolver`) nos formulários de `/admin/configuracoes` e `/admin/pesquisas/nova`; o restante das telas usa estado local.

## Convenções específicas

- Ação destrutiva ou irreversível pede confirmação por `await confirm({ … })` (`useConfirm()` de `@/components/confirmation-provider`), com `tone: "danger"` quando o efeito não se desfaz e texto que cita o objeto afetado.
- Erros de RPC passam por um helper que percorre `message` → `details` → `hint` antes do texto genérico (ver `errorMessage()` em `pesquisas/[surveyId]/operacao/tela-admin-operacao-ciclo.tsx`).
- Depois de mutação, recarregue o agregado do banco (`loadOperations()`, `loadTeam()`) em vez de tentar reconciliar estado local — o banco é a fonte da verdade. Em `/operacao` isso não é só convenção: sem botão de atualizar e sem revalidação automática, a recarga pós-mutação é o único momento em que a tela reencontra o banco depois de abrir.
- Rótulos de sucesso ficam num mapa por ação, não concatenados em texto livre.

## Pontos de atenção

- `/admin/importacao` aplica a guarda de `ADMIN_IMPORT` mas **não** usa `PlatformShell` (layout próprio de página inteira). A proteção efetiva continua na rota de API, que exige sessão institucional com perfil Superadmin.
- O corpo de `/api/admin/import-participants` é validado por esquema `zod` (`@/lib/admin-import-contract`). Mudança no formato enviado pela tela exige mudança no contrato.
- **Toda** rota administrativa usa `usePlatformGuard()` + `PlatformGuardState`; as telas inline de "Acesso restrito" (`<main className="p-10 text-red-700">`, sem caminho de volta) deixaram de existir — inclusive nas três rotas sob `/admin/pesquisas/[surveyId]`. O `AdminModulePage` sem consumidores foi removido.
- `/admin` e `/admin/acessos` chamam `usePlatformGuard()` **sem** módulo, de propósito: a central abre para qualquer `ADMIN_*` (regra de prefixo, não de cartão) e a tela de acessos apresenta a restrição dentro da casca, preservando a navegação.
- `Dialog` importado de `@/components/ui/dialog` (`<dialog>` nativo) é diferente do `Dialog` de `@/components/ui/overlay-panel` (focus trap manual). O construtor usa o primeiro.
