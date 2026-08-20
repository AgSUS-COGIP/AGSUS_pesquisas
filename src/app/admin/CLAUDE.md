# Módulo `src/app/admin` — central administrativa

## Objetivo

Dar ao Admin e ao Superadmin autonomia para criar instrumentos, operar ciclos, definir público, corrigir estrutura organizacional e administrar acessos — sempre com validação e auditoria no banco.

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
| `/admin/pesquisas/nova` | `pesquisas/nova/tela-admin-nova-pesquisa.tsx` | `ADMIN_SURVEYS` | `POST /api/avaliacoes` → `create_survey_draft` |
| `/admin/pesquisas/[surveyId]` | `pesquisas/[surveyId]/tela-admin-construtor-pesquisa.tsx` | `ADMIN_SURVEYS` | `/api/avaliacoes/[id]/construtor`, `…/secoes`, `…/perguntas`, `…/itens/copia`, `…/itens/ordem`, `…/regras`, `DELETE /api/avaliacoes/[id]` |
| `/admin/pesquisas/[surveyId]/identidade` | `pesquisas/[surveyId]/identidade/tela-admin-identidade-visual.tsx` | `ADMIN_SURVEYS` | `GET`/`PUT /api/avaliacoes/[id]/identidade-visual`; upload direto no storage `survey-assets` |
| `/admin/pesquisas/[surveyId]/operacao` | `pesquisas/[surveyId]/operacao/tela-admin-operacao-ciclo.tsx` | `ADMIN_SURVEYS` | `GET`/`POST /api/avaliacoes/[id]/ciclo` → `get_survey_operations`, `manage_survey_cycle`; `PUT /api/avaliacoes/[id]/notificacoes` → `fc_definir_notificacao_email` |
| `/admin/participantes` | `participantes/tela-admin-participantes.tsx` | `ADMIN_PARTICIPANTS` | via componentes: `get_admin_people_base_summary`, `list_admin_participant_applications`, `search_admin_people_for_application`, `assign_admin_application_participant`, `assign_admin_application_participants_bulk`, `assign_admin_all_available_participants` |
| `/admin/participantes/todos` | `participantes/todos/tela-admin-participantes-todos.tsx` | `ADMIN_PARTICIPANTS` | `list_admin_participant_applications`, `list_admin_application_participants`, `set_admin_application_participant_status` |
| `/admin/equipes` | `equipes/tela-admin-equipes.tsx` | `ADMIN_TEAMS` | `search_platform_admin_people`, `update_platform_admin_person`, `list_platform_admin_leadership_links`, `set_platform_admin_leadership_link`, `list_platform_admin_person_audit`, `list_admin_participant_applications` |
| `/admin/acessos` | `acessos/tela-admin-acessos.tsx` | `ADMIN_ACCESS` | `list_access_workspace`, `fc_definir_perfil_pessoa` |
| `/admin/configuracoes` | `configuracoes/tela-admin-configuracoes.tsx` | `ADMIN_ACCESS` | `fc_atualizar_marca_plataforma` |

## Fluxo interno

### Ciclo de vida de uma pesquisa

```text
/admin/pesquisas/nova       create_survey_draft
        ↓                   cria survey + versão 1 + aplicação, todos em rascunho
/admin/pesquisas/[surveyId]              estrutura: seções, perguntas, alternativas
        ├── /identidade                  título e subtítulo da capa (a arte é fixa)
        └── /operacao                    período e máquina de estados do ciclo
```

**A árvore acima é de rotas, não de navegação.** As duas telas filhas não são alcançáveis pelo construtor: o catálogo (`/admin/pesquisas`) leva ao construtor por "Editar formulário" e a `/operacao` por "Propriedades", e **`/identidade` só é alcançável a partir de `/operacao`**, pelo botão "Editar identidade visual". Por isso a tela de identidade volta para `/operacao` ("Voltar às propriedades"), e não para o construtor — o botão de ida saiu de lá. Mover essa entrada de novo exige mexer nos **dois** retornos da tela de identidade (o botão de voltar e o Cancelar), senão o operador cai numa tela de onde não veio.

**A tela de `/identidade` não usa `Breadcrumbs`.** Como `/operacao`, ela tem uma só origem, então o retorno é um botão "Voltar às propriedades" (com `ArrowLeft`) numa `<nav aria-label="Ações da avaliação">` que abre o conteúdo — **fora** do bloco de carregamento de propósito: a saída precisa existir antes dos dados e sobreviver a uma falha da RPC. Trilha estrutural com quatro níveis prometia uma hierarquia navegável que não existe. O botão fica no conteúdo e não em `actions` do `PlatformShell` para não duplicar o mesmo destino no cabeçalho.

**"Cancelar" sai sem gravar; "Restaurar padrão" limpa o formulário.** São ações diferentes e ambas ficam na tela: o Cancelar (abaixo de "Salvar identidade visual") navega de volta para `/operacao` descartando o que estiver em tela — a capa publicada continua sendo a do último salvamento —, enquanto "Restaurar padrão" zera os campos por `resetVisualIdentity()` e ainda exige salvar para valer. Durante `saving`/`uploading` o Cancelar é neutralizado (`aria-disabled`, `pointer-events-none` e `preventDefault`), porque `<Link>` não respeita `disabled`.

**Máquina de estados do ciclo** (`manage_survey_cycle`, ação em `target_action`):

```text
DRAFT ──UPDATE_PERIOD──▶ DRAFT
DRAFT ──PUBLISH──▶ (versão publicada; estrutura congelada)
DRAFT/SCHEDULED ──SCHEDULE(período)──▶ SCHEDULED ┬─(a abertura chega)─▶ OPEN
DRAFT/SCHEDULED ──OPEN──────────────────────────┴────────────────────▶ OPEN
OPEN ──CLOSE──▶ CLOSED ──REOPEN(novo período)──▶ OPEN
qualquer ──CANCEL──▶ CANCELLED   (irreversível)
```

**`SCHEDULED` vira `OPEN` sozinho** (`20260814100000_abrir_ciclos_agendados.sql`). Antes não virava: nada convertia o estado, e como responder exige `OPEN`, o ciclo chegava na data marcada e continuava fechado — alguém tinha de voltar à tela e abrir na mão. Como o projeto não tem job agendado (sem `pg_cron`, sem cron da Vercel), a abertura é **preguiçosa**, no mesmo desenho do arquivamento: `fc_abrir_ciclos_agendados()` é chamada por `get_survey_operations`, `list_my_survey_catalog` e `get_public_survey_form` antes de montarem o resultado, e materializa a virada de quem já venceu, auditando em `SURVEY_CYCLE_AUTO_OPEN`.

Duas consequências que valem lembrar ao mexer nisso:

- **As três RPCs de leitura deixaram de ser `stable`.** Função `stable` no PostgreSQL não pode gravar, nem através de outra função — manter o marcador faria a chamada falhar com *"UPDATE is not allowed in a non-volatile function"*. Nenhuma delas é chamada por GET (`supabase.rpc()` envia POST), então o PostgREST as aceita normalmente.
- **Quem decide se dá para responder é o relógio, não o status.** `application_accepts_responses()` — o portão único do runtime, usado pelas duas jornadas, pelos `save_*`/`submit_*` e pelas políticas de RLS — aceita o ciclo `SCHEDULED` cuja abertura já passou. Sem isso haveria corrida: `/cddi` e o runtime genérico disparam `get_public_survey_form` e `start_or_resume_*` no mesmo `Promise.all`, e a primeira pessoa a entrar no minuto da abertura levaria erro. O status é materialização para catálogo, painel e auditoria lerem estado honesto.

**Criação em três etapas** (`/admin/pesquisas/nova`): Identificação → Ciclo e período → Revisão. Só a revisão grava: **Criar rascunho** volta ao catálogo; **Criar e configurar** abre o construtor. As duas criam exatamente o mesmo rascunho — a publicação continua em `/operacao`, depois que houver perguntas. Datas preenchidas são planejamento e não mudam o ciclo para `SCHEDULED`; somente a ação `SCHEDULE`, após publicar a versão, agenda a abertura. `goToNextStep()` valida apenas os campos da etapa atual.

**A opção "Avaliação anônima" voltou a existir.** Ela esteve indisponível enquanto o anonimato não era estrutural — a submissão guardava quem respondeu, e a administração conseguia reidentificar. `20260813220000_anonimato_estrutural.sql` mudou isso: o vínculo entre pessoa e submissão passa a ser destruído no envio. O aviso "o modo anônimo está indisponível" sobreviveu à migration e passou a negar um recurso que existe; o banco aceitava `p_anonymous` e a rota REST já o repassava — só a caixa faltava.

O bloco `AnonymityNotice` fica **sempre visível**, e não só quando a caixa está marcada: a irreversibilidade (`tba_ciclo_anonimo` recusa ligar ou desligar depois da primeira resposta) precisa ser lida antes da decisão, não depois dela.

Regras aplicadas pelo banco e refletidas na interface:

- **Abertura não pode ser anterior ao momento atual; encerramento tem de ser posterior à abertura.** Vale em `create_survey_draft` e em `UPDATE_PERIOD` (`20260811120000_periodo_futuro_e_exclusao_rascunho.sql`), com tolerância de um minuto para absorver o intervalo entre preencher "agora" e gravar. A checagem **não** entra em `PUBLISH`: bloquear ali deixaria o operador sem saída dentro da tela, já que o período vencido é justamente o que ele precisa abrir para corrigir. Quem avisa antes de publicar é a tela, por toast (`publishBlockedMessage()` em `@/lib/survey-cycle-period`), pedindo a correção do período. `SCHEDULE` e `OPEN` seguem barrando período vencido no banco.
- Período editável só em `DRAFT` ou `SCHEDULED`. Em `OPEN`, é preciso encerrar antes de alterar.
- `REOPEN` só a partir de `CLOSED` e exige novo `opensAt`/`closesAt`.
- `CANCELLED` não retoma — exige criar novo ciclo.
- `PUBLISH` roda `validate_survey_version_integrity`, que devolve pendências classificadas por `severity` (`BLOCKING` bloqueia; `WARNING` apenas alerta) e `category` (`STRUCTURE`, `CYCLE`, `PERIOD`, `AUDIENCE`). `readyToPublish` / `readyToOpen` no retorno de `get_survey_operations` derivam dessa validação.

**A tela de `/operacao` é a "Propriedades" do ciclo** — é assim que o catálogo a chama, pelo botão **"Propriedades"**. Ela usa os primitivos do design system (`Surface`, `PageHeader`, `Button`, `Badge`, `Skeleton`) e tokens CSS, não hexadecimal literal, então acompanha o tema escuro como o restante da administração.

Quatro decisões estruturam a tela:

- **O agendamento mora no cartão de período, não na grade de operações.** "Agendar abertura" era um botão sem dado próprio — toda a informação dele estava no campo **Abertura**, dois cartões acima, e a distância entre os dois fazia o par parecer redundante. Hoje o botão primário do cartão de período é contextual, como já era com `REOPEN`: **Reabrir ciclo com este período** (ciclo encerrado), **Salvar e agendar abertura** (`readyToOpen`, ciclo parado e abertura no futuro, por `opensInFuture()`) ou **Salvar período**. É **uma** chamada, não duas: `SCHEDULE` passou a aceitar `target_opens_at`/`target_closes_at` — encadear `UPDATE_PERIOD` e depois `SCHEDULE` não seria atômico e deixaria o ciclo com período novo e sem agendamento se a segunda falhasse. O bloco de datas registradas ganhou a linha **"O que acontece"** (`periodOutcome()`), que diz a consequência em vez de repetir os campos. Na grade sobraram três operações, e `OPEN` virou **"Abrir agora"**: com a abertura automática, ele deixou de ser o gêmeo do agendamento e passou a ser a antecipação deliberada dela.
- **Nenhum botão fica apagado sem explicação.** Cada operação do ciclo de vida é um objeto `CycleAction` com `description` (o que a ação faz) e `blockedReason` (por que está indisponível), derivado do estado atual. A mesma frase alimenta o `title`, o `aria-describedby` e a nota sob o botão — é a aplicação concreta da responsabilidade declarada no topo deste arquivo. Adicionar operação nova exige preencher os dois textos.
- **Código do banco não é rótulo de interface.** `CYCLE_STATUS_LABELS` e `VERSION_STATUS_LABELS` traduzem `DRAFT`/`OPEN`/`PUBLISHED` para português; o código interno sobrevive apenas no `title` do selo, para quem precisa correlacionar com o banco.
- **A navegação da rota fica no topo do conteúdo, não na casca.** Uma `<nav aria-label="Ações da avaliação">` abre a `main`, antes do `PageHeader`, com "Voltar ao catálogo" e "Editar identidade visual" (azul, `--brand-solid`). Ela fica **fora** do bloco de carregamento de propósito: a saída da tela precisa existir antes dos dados e sobreviver a uma falha da RPC. Por isso o teste do botão de identidade é `operations?.application?.id` — com encadeamento opcional, já que ali `operations` ainda pode ser nulo. `PlatformShell` é chamado **sem** `actions`: a tela não tem ação própria de cabeçalho.

**Notificações por e-mail aos participantes.** O checkbox persiste `st_notificacao_email` por `fc_definir_notificacao_email`. A fila usa chave única por ciclo/pessoa/tipo e uma reivindicação temporária por execução, evitando que cron e `after()` processem a mesma linha ao mesmo tempo. O servidor envia lotes com concorrência limitada por SMTP institucional. Sem participantes o checkbox não liga; sem `SMTP_APP_PASSWORD`, `NEXT_PUBLIC_SITE_URL` ou `CRON_SECRET`, `/api/health` identifica a variável ausente.

O que **não** existe nesta tela, e foi removido por decisão de interface — não reintroduza sem pedido:

- **Trilha de etapas.** O `CycleProgress` (`Rascunho → Agendado → Aberto → Encerrado`) e a constante `CYCLE_STEPS` foram removidos. O aviso enfático de ciclo cancelado morava no ramo `CANCELLED` dessa trilha; a informação continua na tela por `cycleExplanation()`, no cartão de período.
- **Breadcrumbs.** A tela não tem caminho estrutural; o retorno é o botão "Voltar ao catálogo". O primitivo `Breadcrumbs` segue em uso em outras rotas administrativas — o que saiu foi só a chamada daqui.
- **Botão "Editar formulário".** O acesso ao construtor é pelo catálogo. Dentro desta tela, o único link para lá é o atalho "Abrir construtor" do checklist, que `issueFixHref()` só devolve para pendência de `category: "STRUCTURE"` — logo, num ciclo sem pendências não há caminho para o construtor daqui.
- **Botão "Atualizar dados".** A tela busca o agregado ao abrir (`useEffect`) e depois de cada mutação (`runAction` → `loadOperations()`), e não revalida sozinha — não há React Query nem polling aqui. Consequência aceita: o contador de resposta num ciclo aberto só muda ao recarregar a página. O estado do ciclo **não** entra nessa ressalva: `get_survey_operations` materializa a abertura vencida antes de responder, então toda carga da tela já traz o ciclo no estado certo.

### Construtor de formulários

Validação no cliente por `@/lib/survey-builder` **antes** de chamar a RPC (o banco revalida):

- Seção: título obrigatório, ≤ 160 caracteres; descrição ≤ 1.000.
- Pergunta: enunciado obrigatório, ≤ 500; descrição ≤ 2.000; tipo dentre os 10 suportados.
- Tipos que exigem alternativas: `SINGLE_CHOICE`, `MULTIPLE_CHOICE`, `SCALE` — entre 2 e 50, cada uma ≤ 200 caracteres, sem repetição (comparação `toLocaleLowerCase("pt-BR")`).
- `buildQuestionOptions()` preserva `id` e `value` das alternativas existentes ao renomear rótulos, evitando invalidar respostas já gravadas. Em `SCALE`, `score` padrão é a posição (1, 2, 3…).
- `hasUnsavedChanges()` compara assinaturas para avisar antes de descartar edição.

**Só estrutura em rascunho é editável.** `enforce_draft_survey_structure` (trigger) impede alteração após a publicação.

#### Lógica condicional

Cada seção e cada pergunta ganharam o botão **Regra**, que abre `SurveyRuleEditor` — componente próprio, e não mais um diálogo nesta tela, que já passava de mil linhas com cinco deles. O alvo tem no máximo **uma** regra (índice `in_regra_condicional_alvo`), então o editor sempre substitui, nunca acumula: por isso a rota é `PUT /api/avaliacoes/[id]/regras` e não `POST`.

O **resumo em português** aparece sob o título do alvo mesmo em versão publicada. Editar exige rascunho, mas a regra continua valendo para quem responde — esconder a informação porque ela ficou imutável deixaria o operador sem entender por que uma pergunta não aparece.

**Dependência circular não é verificada na tela.** Quem percorre o grafo é `fc_regra_gera_ciclo()`, no banco, resolvendo seção → perguntas da seção. Reimplementar a travessia criaria um segundo algoritmo para a mesma decisão — o erro que [../../lib/CLAUDE.md](../../lib/CLAUDE.md) documenta entre avaliador do cliente e do banco. A recusa chega como toast, e o editor **fica aberto** para correção. A tela valida só o que é local e inequívoco (`ruleDraftErrors()`): operador que compara alternativa exige a alternativa, operador numérico exige número, pergunta não condiciona a si mesma, e pergunta de dentro da seção não decide se a seção aparece.

**Confirmar exclusão exige fechar o editor antes.** `SurveyRuleEditor` usa o `Dialog` de `ui/dialog.tsx`, que é `<dialog>` nativo e vive na camada superior do navegador; o diálogo de `useConfirm()` é uma camada comum e ficaria **atrás dele — presente no DOM, invisível e inalcançável**. `removeRule()` fecha o editor, guarda o rascunho e o devolve intacto a quem desistir. Vale para qualquer `confirm()` chamado de dentro desses diálogos.

**Excluir formulário** (`fc_excluir_pesquisa_rascunho`) fica numa seção destrutiva ao **fim** da página do construtor, apenas enquanto a versão é `DRAFT`, e confirma em diálogo que nomeia o formulário. A RPC recusa avaliação já publicada (a estrutura é referência histórica de quem respondeu) ou com qualquer submissão gravada, e a razão vem na própria mensagem de erro. Registra `SURVEY_DELETED` em `audit_events` **antes** do delete, com `application_id` nulo — a coluna referencia `survey_applications` com `on delete set null`, então o identificador do ciclo fica preservado em `metadata`.

**Não confie no cascade para apagar a estrutura.** `survey_sections`, `survey_questions` e `question_options` têm o trigger `enforce_draft_survey_structure` (`before … delete`), que resolve a versão da linha afetada e exige que ela **exista** e esteja em `DRAFT`. Como o `on delete cascade` do PostgreSQL remove a linha-pai antes das filhas, apagar `survey_versions` direto faz cada trigger filho não encontrar mais a versão e abortar tudo com `Versão da pesquisa não encontrada.`. Por isso a exclusão apaga explicitamente **de baixo para cima** — alternativas → perguntas → seções → ciclo → versão → pesquisa — com a versão ainda presente em cada passo (`20260811143000_corrigir_exclusao_pesquisa_rascunho.sql`). Inverter a ordem traz o erro de volta.

O mesmo vale **dentro** de `survey_sections`, que referencia a si mesma com `on delete cascade`: apagar a versão inteira num único `delete` remove a seção-pai antes da filha e reproduz o erro em avaliação com seções aninhadas. `20260811160000_corrigir_exclusao_secoes_aninhadas.sql` substitui essa varredura por um laço que apaga só folhas até esvaziar. Detalhe da regra em [../../../supabase/CLAUDE.md](../../../supabase/CLAUDE.md).

**404 na RPC é migration não aplicada, não bug de tela.** `POST …/rpc/fc_excluir_pesquisa_rascunho 404 (Not Found)` no console significa que a função não existe no banco daquele ambiente — o PostgREST nem chegou a executar SQL. Commit não é deploy: os arquivos em `supabase/migrations/` só passam a valer depois de aplicados no projeto Supabase. Antes de investigar a tela, confirme a existência da função (`select proname from pg_proc where proname = '…'`) e confronte `supabase_migrations.schema_migrations` com o esquema real, pelo procedimento de [../../../docs/operacao-permissoes.md](../../../docs/operacao-permissoes.md).

### Gestão de participantes

Duas rotas, cada uma com **um** par de campos (avaliação + busca):

- `/admin/participantes` — `PeopleBaseSummaryCard` (retrato da base mestra) e `AdminParticipantLinker`: escolher a avaliação, buscar na base institucional e vincular, seja por seleção múltipla ou por "todos os disponíveis". A tela só vincula quem já está na base — cadastrar pessoa nova é fluxo de importação, não desta tela. Ao fim da página, um botão leva à visualização completa, levando a avaliação escolhida em `?avaliacao=`.
- `/admin/participantes/todos` — `AdminParticipantRoster`: lista de quem já está vinculado, com filtro por situação e as ações de bloquear, reativar e remover. **Não vincula ninguém.**

A separação é deliberada. Antes, `AdminParticipantBulkSelector` e `AdminParticipantManagement` conviviam na mesma página, cada um com o seu seletor de avaliação e o seu campo de busca sobre a **mesma** RPC — três campos de vínculo ao todo, dois estados de `applicationId` que podiam divergir, e nenhuma pista de qual valia. Hoje há um seletor por rota, e escolher a avaliação num lugar não contradiz o outro.

**Regra da arquitetura:** a base mestra de pessoas e o público de uma pesquisa são decisões separadas. A importação atualiza só a base; vincular alguém a um ciclo é ato explícito do administrador.

**Seletor não oferece ciclo de avaliação arquivada nem ciclo cancelado** (`20260817120000_seletores_respeitam_arquivamento.sql`). `CANCEL` arquiva a avaliação (`surveys.dt_arquivamento`) e `list_managed_surveys` já respeitava isso, mas `list_admin_participant_applications` **não fazia join com `public.surveys`** — não tinha como saber. Como ela ordena por `code` e cada componente faz `setApplicationId(rows[0]?.id)`, um ciclo cancelado de código anterior no alfabeto virava a **seleção padrão** de `/admin/participantes` e `/admin/equipes`; foi o que aconteceu com `BOMDIA-1`. E não sairia sozinho: `fc_expirar_pesquisas_arq` preserva arquivada que já teve versão publicada. A mesma regra passou a valer em `fc_listar_ciclos_lideranca` e em `fc_obter_ciclo_cddi_vigente` — "vigente" não pode ser cancelado.

`fc_listar_ciclos_pesquisa` ficou **de fora de propósito**: alimenta o painel e `/admin/respostas`, superfícies de leitura sobre uma avaliação já escolhida. Esconder ciclo cancelado ali esconderia respostas coletadas antes do cancelamento. Ao criar seletor novo, a pergunta é "esta tela **age** sobre o ciclo?" — se sim, filtre; se só lê, não.

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

## Regras de negócio específicas

- **`/admin/equipes` exige o módulo `ADMIN_TEAMS`**, que pertence só ao Superadmin — a guarda é uma só, pelo módulo. A dupla verificação anterior (módulo **e** papel) deixou de existir: com perfis exclusivos, o mapa de módulos já é a regra.
- **Matrícula é imutável.** `update_platform_admin_person` não altera `employee_number` e exige justificativa, registrada para auditoria.
- **Admin nunca recebe `ADMIN_ACCESS`, `ADMIN_TEAMS` nem `ADMIN_IMPORT`** — quem gerencia pesquisas não define perfis, não altera dados funcionais e não carrega a base institucional. Cada cartão de `/admin` declara seu módulo e só aparece para quem o tem.
- **Perfis são exclusivos.** `/admin/acessos` define **o** perfil da pessoa por `fc_definir_perfil_pessoa`, que concede o escolhido e encerra os demais na mesma transação. Não há como acumular Admin + Participante.
- **Vínculos encerrados são preservados.** Retirar alguém da equipe encerra a vigência e registra evento em `audit_events`; nada é apagado.
- **A capa da avaliação pode ser personalizada por ciclo.** `/admin/pesquisas/[surveyId]/identidade` configura imagem de capa, texto alternativo, título e subtítulo. O envio grava em `survey-assets` no caminho `<applicationId>/banner.<ext>` (JPG, PNG ou WEBP, até 5 MB, `upsert: true`) e só depois de **salvar** a identidade a capa vale no instrumento — o upload por si não publica nada. `update_application_visual_settings` revalida tudo: em `CUSTOM` exige URL, caminho e texto alternativo, impõe HTTPS, e confere que a URL pertence ao storage institucional e que o caminho começa pelo id da aplicação. Em `INSTITUTIONAL` o banco zera os três campos de banner. As checagens equivalentes na tela existem para o operador ler o motivo no formulário, não para substituir as do banco.

## Dependências

- [@/components](../../components/CLAUDE.md) — `admin-participant-*`, `admin-people-teams-management`, `people-base-summary`, primitivos `ui/`.
- [@/lib/survey-builder](../../lib/CLAUDE.md) — validação de rascunhos.
- [@/lib/platform-branding](../../lib/CLAUDE.md) — normalização da marca em `/admin/configuracoes`.
- `react-hook-form` + `zod` (via `zodResolver`) nos formulários de `/admin/configuracoes` e `/admin/pesquisas/nova`; o restante das telas usa estado local.

## Convenções específicas

- Ação destrutiva ou irreversível pede confirmação por `await confirm({ … })` (`useConfirm()` de `@/components/confirmation-provider`), com `tone: "danger"` quando o efeito não se desfaz e texto que cita o objeto afetado.
- Erros de chamada passam por `errorMessageFromUnknown()` (`@/lib/observability`), que percorre `message` → `details` → `hint` antes do texto genérico. O `errorMessage()` local de `pesquisas/[surveyId]/operacao/` era uma cópia dessa mesma lógica e foi removido na migração das telas para as rotas REST.
- Depois de mutação, recarregue o agregado do banco (`loadOperations()`, `loadTeam()`) em vez de tentar reconciliar estado local — o banco é a fonte da verdade. Em `/operacao` isso não é só convenção: sem botão de atualizar e sem revalidação automática, a recarga pós-mutação é o único momento em que a tela reencontra o banco depois de abrir.
- Rótulos de sucesso ficam num mapa por ação, não concatenados em texto livre.

## Pontos de atenção

- **Toda** rota administrativa usa `usePlatformGuard()` + `PlatformGuardState`; as telas inline de "Acesso restrito" (`<main className="p-10 text-red-700">`, sem caminho de volta) deixaram de existir — inclusive nas três rotas sob `/admin/pesquisas/[surveyId]`. O `AdminModulePage` sem consumidores foi removido.
- `/admin` e `/admin/acessos` chamam `usePlatformGuard()` **sem** módulo, de propósito: a central abre para qualquer `ADMIN_*` (regra de prefixo, não de cartão) e a tela de acessos apresenta a restrição dentro da casca, preservando a navegação.
- `Dialog` importado de `@/components/ui/dialog` (`<dialog>` nativo) é diferente do `Dialog` de `@/components/ui/overlay-panel` (focus trap manual). O construtor usa o primeiro.
