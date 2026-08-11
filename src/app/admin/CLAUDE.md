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
| `/admin/pesquisas/[surveyId]/identidade` | `pesquisas/[surveyId]/identidade/tela-admin-identidade-visual.tsx` | `ADMIN_SURVEYS` | `get_survey_builder`, `update_application_visual_settings` |
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

**Criação em três etapas** (`/admin/pesquisas/nova`): Identificação → Ciclo e período → Revisão. As etapas 1 e 2 oferecem só **Cancelar** (vermelho claro) e **Prosseguir** (azul); as ações que gravam — **Criar rascunho** e **Publicar** — existem apenas na etapa de revisão, para que nenhuma etapa intermediária pareça capaz de concluir a criação. `goToNextStep()` valida só os campos da etapa atual (`STEPS[step].fields`): exigir o formulário inteiro impediria sair da primeira etapa por causa de campos ainda não exibidos.

**"Publicar" na criação não publica.** Uma avaliação nasce só com a seção `Introdução`, sem perguntas, e `PUBLISH` exige estrutura — o banco recusaria. O botão cria o rascunho e leva ao construtor com o aviso de que faltam perguntas; a publicação efetiva continua em `/operacao`.

Regras aplicadas pelo banco e refletidas na interface:

- **Abertura não pode ser anterior ao momento atual; encerramento tem de ser posterior à abertura.** Vale em `create_survey_draft` e em `UPDATE_PERIOD` (`20260811120000_periodo_futuro_e_exclusao_rascunho.sql`), com tolerância de um minuto para absorver o intervalo entre preencher "agora" e gravar. A checagem **não** entra em `PUBLISH`: bloquear ali deixaria o operador sem saída dentro da tela, já que o período vencido é justamente o que ele precisa abrir para corrigir. Quem avisa antes de publicar é a tela, por toast (`publishBlockedMessage()` em `@/lib/survey-cycle-period`), pedindo a correção do período. `SCHEDULE` e `OPEN` seguem barrando período vencido no banco.
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

**Excluir formulário** (`fc_excluir_pesquisa_rascunho`) aparece no cabeçalho do construtor apenas enquanto a versão é `DRAFT`. A RPC recusa avaliação já publicada (a estrutura é referência histórica de quem respondeu) ou com qualquer submissão gravada, e a razão vem na própria mensagem de erro. Aceita, apaga ciclo → versão → pesquisa nessa ordem (`survey_applications` referencia a versão com `on delete restrict`; seções, perguntas e alternativas caem por cascade) e registra `SURVEY_DELETED` em `audit_events` **antes** do delete, com `application_id` nulo — a coluna referencia `survey_applications` com `on delete set null`, então o identificador do ciclo fica preservado em `metadata`.

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
- **Identidade visual:** `update_application_visual_settings` aceita apenas URL **HTTPS** para banner. `themeVariant: "INSTITUTIONAL"` ignora banner personalizado e volta ao padrão (ver `resolveSurveyVisualIdentity` em `@/lib/survey-visual-identity`).

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
- Depois de mutação, recarregue o agregado do banco (`loadOperations()`, `loadTeam()`) em vez de tentar reconciliar estado local — o banco é a fonte da verdade.
- Rótulos de sucesso ficam num mapa por ação, não concatenados em texto livre.

## Pontos de atenção

- `/admin/importacao` aplica a guarda de `ADMIN_IMPORT` mas **não** usa `PlatformShell` (layout próprio de página inteira). A proteção efetiva continua na rota de API, que exige sessão institucional com perfil Superadmin.
- O corpo de `/api/admin/import-participants` é validado por esquema `zod` (`@/lib/admin-import-contract`). Mudança no formato enviado pela tela exige mudança no contrato.
- `/admin` exibe "CDDI 2026 · ciclo encerrado" como texto fixo, independente do estado real da aplicação.
- **Toda** rota administrativa usa `usePlatformGuard()` + `PlatformGuardState`; as telas inline de "Acesso restrito" (`<main className="p-10 text-red-700">`, sem caminho de volta) deixaram de existir — inclusive nas três rotas sob `/admin/pesquisas/[surveyId]`. O `AdminModulePage` sem consumidores foi removido.
- `/admin` e `/admin/acessos` chamam `usePlatformGuard()` **sem** módulo, de propósito: a central abre para qualquer `ADMIN_*` (regra de prefixo, não de cartão) e a tela de acessos apresenta a restrição dentro da casca, preservando a navegação.
- `Dialog` importado de `@/components/ui/dialog` (`<dialog>` nativo) é diferente do `Dialog` de `@/components/ui/overlay-panel` (focus trap manual). O construtor usa o primeiro.
