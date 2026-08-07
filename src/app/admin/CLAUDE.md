# Módulo `src/app/admin` — central administrativa

## Objetivo

Dar à Equipe Técnica e ao Administrador da Plataforma autonomia para criar instrumentos, operar ciclos, definir público, corrigir estrutura organizacional, administrar acessos e atualizar a base institucional — sempre com validação e auditoria no banco.

Convenções gerais de rota em [../CLAUDE.md](../CLAUDE.md).

## Responsabilidades

- Aplicar a guarda de módulo antes de qualquer operação (`deriveModules(context).includes("ADMIN_…")`).
- Traduzir ações administrativas em chamadas RPC e apresentar o resultado (toast de sucesso, mensagem de erro do banco).
- Explicar ao operador **por que** uma ação está indisponível — nunca apenas desabilitar o botão.

## Rotas e RPCs

| Rota | Módulo exigido | RPCs |
|---|---|---|
| `/admin` | qualquer `ADMIN_*` | — (cartões de navegação) |
| `/admin/pesquisas` | `ADMIN_SURVEYS` | `list_managed_surveys` |
| `/admin/pesquisas/nova` | `ADMIN_SURVEYS` | `create_survey_draft` |
| `/admin/pesquisas/[surveyId]` | `ADMIN_SURVEYS` | `get_survey_builder`, `add_survey_section`, `update_survey_section`, `add_survey_question`, `update_survey_question`, `delete_survey_question`, `duplicate_survey_builder_item`, `reorder_survey_builder_item`, `move_survey_question_to_section` |
| `/admin/pesquisas/[surveyId]/identidade` | `ADMIN_SURVEYS` | `get_survey_builder`, `update_application_visual_settings` |
| `/admin/pesquisas/[surveyId]/operacao` | `ADMIN_SURVEYS` | `get_survey_operations`, `manage_survey_cycle` |
| `/admin/participantes` | `ADMIN_PARTICIPANTS` | via componentes: `get_admin_people_base_summary`, `list_admin_participant_applications`, `list_admin_application_participants`, `search_admin_people_for_application`, `assign_admin_application_participant`, `assign_admin_application_participants_bulk`, `assign_admin_all_available_participants`, `create_and_assign_admin_participant`, `set_admin_application_participant_status` |
| `/admin/equipes` | `ADMIN_TEAMS` **e** papel `ADMINISTRATOR` | `search_platform_admin_people`, `update_platform_admin_person`, `list_platform_admin_leadership_links`, `set_platform_admin_leadership_link`, `list_platform_admin_person_audit`, `list_admin_participant_applications` |
| `/admin/acessos` | `ADMIN_ACCESS` | `list_access_workspace`, `set_person_role` |
| `/admin/importacao` | — (protegida por token, não por módulo) | via `POST /api/admin/import-participants` |

## Fluxo interno

### Ciclo de vida de uma pesquisa

```text
/admin/pesquisas/nova       create_survey_draft
        ↓                   cria survey + versão 1 + aplicação, todos em rascunho
/admin/pesquisas/[surveyId]              estrutura: seções, perguntas, alternativas
        ├── /identidade                  banner, título e subtítulo da capa
        └── /operacao                    período e máquina de estados do ciclo
```

**Máquina de estados do ciclo** (`manage_survey_cycle`, ação em `target_action`):

```text
DRAFT ──UPDATE_PERIOD──▶ DRAFT
DRAFT ──PUBLISH──▶ (versão publicada; estrutura congelada)
DRAFT/SCHEDULED ──SCHEDULE──▶ SCHEDULED ──OPEN──▶ OPEN
OPEN ──CLOSE──▶ CLOSED ──REOPEN(novo período)──▶ OPEN
qualquer ──CANCEL──▶ CANCELLED   (irreversível)
```

Regras aplicadas pelo banco e refletidas na interface:

- Período editável só em `DRAFT` ou `SCHEDULED`. Em `OPEN`, é preciso encerrar antes de alterar.
- `REOPEN` só a partir de `CLOSED` e exige novo `opensAt`/`closesAt`.
- `CANCELLED` não retoma — exige criar novo ciclo.
- `PUBLISH` roda `validate_survey_version_integrity`, que devolve pendências classificadas por `severity` (`BLOCKING` bloqueia; `WARNING` apenas alerta) e `category` (`STRUCTURE`, `CYCLE`, `PERIOD`, `AUDIENCE`). `readyToPublish` / `readyToOpen` no retorno de `get_survey_operations` derivam dessa validação.

### Construtor de formulários

Validação no cliente por `@/lib/survey-builder` **antes** de chamar a RPC (o banco revalida):

- Seção: título obrigatório, ≤ 160 caracteres; descrição ≤ 1.000.
- Pergunta: enunciado obrigatório, ≤ 500; descrição ≤ 2.000; tipo dentre os 10 suportados.
- Tipos que exigem alternativas: `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `SCALE` — entre 2 e 50, cada uma ≤ 200 caracteres, sem repetição (comparação `toLocaleLowerCase("pt-BR")`).
- `buildQuestionOptions()` preserva `id` e `value` das alternativas existentes ao renomear rótulos, evitando invalidar respostas já gravadas. Em `SCALE`, `score` padrão é a posição (1, 2, 3…).
- `hasUnsavedChanges()` compara assinaturas para avisar antes de descartar edição.

**Só estrutura em rascunho é editável.** `enforce_draft_survey_structure` (trigger) impede alteração após a publicação.

### Gestão de participantes

Três blocos independentes na mesma página:

1. `PeopleBaseSummaryCard` — retrato da base mestra.
2. `AdminParticipantBulkSelector` — vinculação em lote, incluindo "todos os disponíveis".
3. `AdminParticipantManagement` — busca individual, vinculação, criação avulsa e mudança de status (bloquear, reativar, excluir).

**Regra da arquitetura:** a base mestra de pessoas e o público de uma pesquisa são decisões separadas. A importação atualiza só a base; vincular alguém a um ciclo é ato explícito do administrador.

### Importação da base institucional

```text
navegador                       lê CSV/XLSX com `xlsx`
                                aba preferida: BASE_PARTICIPANTES → BASE → primeira
                                parsePeopleImportRows() + summarizePeopleImport()
                                lotes de CHUNK_SIZE = 200 linhas válidas
        ↓ POST /api/admin/import-participants  (header x-admin-import-token)
servidor                        sync_people_base_rows → sync_cddi_manager_rows
                                registra data_import_batches / data_import_issues
```

- Só linhas com `valid === true` são enviadas; avisos não impedem o envio.
- `isFirstChunk` cria o lote; `isLastChunk` fecha como `COMPLETED` ou `COMPLETED_WITH_WARNINGS`.
- `survey_assignment: false` nos metadados registra que ninguém foi vinculado a pesquisa.
- CPF não é lido nem armazenado neste fluxo.

## Regras de negócio específicas

- **`/admin/equipes` exige papel `ADMINISTRATOR`**, não apenas o módulo `ADMIN_TEAMS`. É a única rota com essa dupla verificação: alterar dado funcional é privilégio máximo.
- **Matrícula é imutável.** `update_platform_admin_person` não altera `employee_number` e exige justificativa, registrada para auditoria.
- **`SURVEY_MANAGER` nunca recebe `ADMIN_ACCESS`** — quem gerencia pesquisa não concede papéis. `/admin` esconde o cartão de Acessos para quem não tem o módulo.
- **Vínculos encerrados são preservados.** Retirar alguém da equipe encerra a vigência e registra evento em `audit_events`; nada é apagado.
- **Identidade visual:** `update_application_visual_settings` aceita apenas URL **HTTPS** para banner. `themeVariant: "INSTITUTIONAL"` ignora banner personalizado e volta ao padrão (ver `resolveSurveyVisualIdentity` em `@/lib/survey-visual-identity`).

## Dependências

- [@/components](../../components/CLAUDE.md) — `admin-participant-*`, `admin-people-teams-management`, `people-base-summary`, primitivos `ui/`.
- [@/lib/survey-builder](../../lib/CLAUDE.md) — validação de rascunhos.
- [@/lib/people-import](../../lib/CLAUDE.md) — parsing e resumo da planilha.
- [/api/admin/import-participants](../api/CLAUDE.md) — única rota administrativa com service role.

## Convenções específicas

- Ação destrutiva ou irreversível pede `window.confirm` com texto que cita o objeto afetado.
- Erros de RPC passam por um helper que percorre `message` → `details` → `hint` antes do texto genérico (ver `errorMessage()` em `operacao/page.tsx`).
- Depois de mutação, recarregue o agregado do banco (`loadOperations()`, `loadTeam()`) em vez de tentar reconciliar estado local — o banco é a fonte da verdade.
- Rótulos de sucesso ficam num mapa por ação, não concatenados em texto livre.

## Pontos de atenção

- `/admin/importacao` **não** aplica guarda de módulo nem usa `PlatformShell`; a proteção é o `ADMIN_IMPORT_TOKEN` digitado pelo operador e validado no servidor em tempo constante. Isso circula um segredo pelo navegador — ver melhorias no [README](../../../README.md).
- O corpo de `/api/admin/import-participants` é convertido com `as RequestBody`, sem validação de esquema.
- `/admin` exibe "CDDI 2026 · ciclo encerrado" como texto fixo, independente do estado real da aplicação.
- Cada página `/admin/*` reimplementa a tela de "Acesso restrito" inline; existe um `AdminModulePage` pronto e não utilizado em `@/components/admin-module-page.tsx`.
- `Dialog` importado de `@/components/ui/dialog` (`<dialog>` nativo) é diferente do `Dialog` de `@/components/ui/overlay-panel` (focus trap manual). O construtor usa o primeiro.
