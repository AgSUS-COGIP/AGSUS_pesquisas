# Módulo `supabase` — banco de dados, RLS e RPCs

## Objetivo

**Este é o módulo onde vivem as regras de negócio.** O esquema, as políticas de RLS, as funções `SECURITY DEFINER` e os triggers formam a fronteira de autorização e integridade da plataforma. O frontend é uma casca de apresentação sobre este contrato.

Toda alteração de comportamento começa aqui, não em React.

## Responsabilidades

- Garantir que nenhuma pessoa leia ou grave o que não lhe pertence (RLS em toda tabela exposta).
- Validar identidade, papel, escopo, período e estado antes de qualquer gravação (RPCs e triggers).
- Calcular resultados e agregados de painéis no banco, evitando divergência entre registro e consolidação.
- Registrar eventos críticos em `audit_events` e preservar histórico.

## Estrutura

```text
supabase/
├── migrations/      55 arquivos .sql versionados (fonte da verdade)
│   └── README.md
└── tests/
    └── rls_exposed_tables.sql   pgTAP: nenhuma tabela de `public` sem RLS
```

## Modelo de dados

### Núcleo genérico — `20260730200000_initial_platform_schema.sql`

```text
organizational_units ──┐
                       ├──▶ people ──▶ person_role_assignments ──▶ system_roles
                       │       │
surveys ──▶ survey_versions ──▶ survey_applications
                                     │        │
              survey_sections ◀──────┘        ├──▶ application_participants
                     │                        │
              survey_questions                └──▶ submissions ──▶ answers ──▶ answer_options
                     │                                                 ▲
              question_options ─────────────────────────────────────────┘

user_preferences · audit_events
```

Hierarquia conceitual: **pesquisa** (produto permanente, ex. CDDI) → **versão** (estrutura congelada de uma edição) → **aplicação/ciclo** (período, público e regras de uma execução).

### Módulo CDDI — `20260730203000_cddi_module.sql`

`person_access_identities`, `cddi_leadership_links`, `cddi_link_correction_requests`, `cddi_competency_results`, `cddi_final_results`, `data_import_batches`, `data_import_issues`.

### Permissões e acesso

`platform_modules`, `role_module_permissions`, `person_module_permissions`, `institutional_domains`.

**Modelo de perfis** (`20260807150000_simplificar_modelo_papeis.sql`, consolidado por `20260810120000_perfis_exclusivos_quatro_papeis.sql`): quatro perfis em `system_roles` — Superadmin (`ADMINISTRATOR`), Admin (`SURVEY_MANAGER`), Avaliador (`LEADER`) e Participante (`RESPONDENT`). Os códigos internos são legados e foram preservados porque `has_active_role()`, `can_manage_surveys()`, `is_platform_administrator()` e dezenas de políticas os referenciam — e o gate de nomenclatura impede recriar funções legadas em migrations novas. `TECHNICAL_TEAM` foi absorvido pelo Superadmin e `AUDITOR` foi descontinuado. Efeito prático dos helpers: `can_manage_surveys()` = Superadmin ou Admin; `is_platform_administrator()` = Superadmin. A checagem residual de `TECHNICAL_TEAM` dentro de `can_manage_surveys()` é **inerte** — o papel saiu do catálogo, então `has_active_role('TECHNICAL_TEAM')` é sempre falso. Ela permanece de propósito: redefinir a função numa migration nova esbarra no gate de nomenclatura, e o comportamento já é o desejado.

Os perfis são **mutuamente exclusivos**: `20260810120000` encerrou as atribuições acumuladas (mantendo a de maior privilégio), esvaziou `person_module_permissions` — não há mais exceção de módulo por pessoa — e substituiu `set_person_role` por `fc_definir_perfil_pessoa(p_pessoa, p_perfil)`, que encerra os perfis vigentes e concede o escolhido na mesma transação.

**`set_person_role` continua existindo, agora como ponte** (`20260814140000_limpar_superficie_legada.sql`). Até 14/08/2026 a documentação afirmava que ela havia sido removida; auditoria do banco de produção mostrou que não — ela seguia lá com a lógica **antiga**, de papel avulso, anterior aos perfis exclusivos. Apagá-la seria repetir 10/08: bundle publicado que a chame passaria a receber `Could not find the function …`. Em vez disso, ela foi esvaziada e agora delega a `fc_definir_perfil_pessoa`, com `enabled => false` traduzido como "volta ao piso Participante". **Não a use em código novo.** O episódio é também um lembrete do que este arquivo já avisa: o histórico de migrations não prova o que existe no banco — confira o esquema real.

A exclusividade é **garantida pelo banco** desde `20260810140000_perfil_unico_por_pessoa.sql`: o índice único parcial `in_perfil_unico_vigente` sobre `person_role_assignments (person_id) where ends_at is null` impede o estado inválido de existir. Antes era só convenção — `fc_definir_perfil_pessoa` encerrava os outros e `resolvePlatformRole()` desempatava por privilégio quando encontrava vários, mas nada barrava uma correção manual ou uma RPC futura de reintroduzir acumulação. Consequência para quem escrever RPC nova: **encerre o perfil vigente antes de conceder o novo**, nunca o contrário — foi por isso que `20260810140000` redefiniu `fc_definir_perfil_pessoa`, cuja ordem original (conceder e depois encerrar) violava o índice. Histórico encerrado não conflita: `ends_at` preenchido sai do escopo do índice.

**`platform_modules`, `role_module_permissions` e `person_module_permissions` não são fonte de autorização.** Criadas em `20260731115500`, deixaram de ter leitor em runtime a partir de `20260803104000`, quando o mapa de módulos passou a ser derivado do papel dentro do corpo da função de contexto; o último leitor, `get_my_platform_context()`, foi removido em `20260807150000`. Hoje quem decide os módulos é o `case` de `fc_obter_contexto_plataforma()`. Por isso `20260810120000` só as atualiza **se existirem** (`to_regclass`), e `20260810130000_restaurar_catalogo_modulos_plataforma.sql` as recria de forma idempotente onde faltam. Valem como documentação do banco — ao alterar o mapa de perfis, atualize a função, não a tabela.

> **O banco de produção divergiu do histórico de migrations.** Em 10/08/2026 descobriu-se que `20260731115500` e as quatro migrations de `20260807*` nunca foram aplicadas lá, embora `supabase_migrations.schema_migrations` existisse: parte do esquema foi criada por SQL direto, sem passar pelo registro. O sintoma foi `relation "public.role_module_permissions" does not exist` ao aplicar `20260810120000`. **Antes de aplicar qualquer migration em produção, confronte o histórico com o esquema real** — o registro pode afirmar que uma migration rodou quando os objetos dela não existem, e vice-versa. O procedimento de verificação está em [../docs/operacao-permissoes.md](../docs/operacao-permissoes.md).

Mapa perfil → módulo em `role_module_permissions` e em `fc_obter_contexto_plataforma()`:

| Perfil | Módulos |
|---|---|
| `ADMINISTRATOR` | todos os 9 |
| `SURVEY_MANAGER` | `HOME`, `SURVEYS`, `DASHBOARDS`, `TEAM`, `ADMIN_SURVEYS`, `ADMIN_PARTICIPANTS` |
| `LEADER` | `HOME`, `SURVEYS`, `TEAM` |
| `RESPONDENT` | `SURVEYS` |

### Lógica condicional — `20260813120000_motor_logica_condicional.sql`

`public.tb_regra_condicional` (uma regra vigente por alvo, garantida pelo índice parcial `in_regra_condicional_alvo`) e `public.tb_condicao_regra` (as condições daquela regra). Alvo é pergunta **ou** seção; esconder a seção esconde tudo dentro dela. RLS habilitada e todos os privilégios revogados: o acesso é só pelas funções `security definer`.

**Por que tabela e não `display_logic`.** A coluna JSONB existe desde o esquema inicial e nunca ganhou leitor. Como JSON solto, ela não consegue garantir o que uma regra precisa garantir — que a pergunta de origem existe, pertence à mesma versão, que a alternativa comparada é daquela pergunta e que o conjunto não forma ciclo. `display_logic` **fica intocado**: sua única ocorrência preenchida em produção é `CHEFIA_RESPONSAVEL` no CDDI publicado, e o conteúdo lá é filtro de tipo de submissão, lido por `isCddiQuestionVisible()` no frontend — assunto diferente, apesar do nome parecido.

**O grafo precisa ser acíclico.** Se A depende de B e B volta a depender de A, não existe ordem de avaliação. `fc_regra_gera_ciclo()` percorre o grafo na **gravação** e recusa a regra — o operador vê o erro ao montar o instrumento, não o participante na frente da tela. É essa garantia que torna segura a recursão de `fc_alvo_visivel()`.

| RPC | Uso |
|---|---|
| `fc_salvar_regra_condicional(...)` | Substitui em bloco a regra do alvo. Exige `can_manage_surveys()` e **versão em `DRAFT`** — regra é estrutura do instrumento, como seção e pergunta. |
| `fc_excluir_regra_condicional(p_alvo)` | Remove a regra vigente do alvo. |
| `fc_listar_regras_condicionais(p_versao)` | Regras da versão, para o construtor. |
| `fc_obter_regras_do_ciclo(p_codigo_ciclo)` | Regras do ciclo, para o runtime. Respeita `can_access_application()`. |
| `fc_pergunta_visivel(submissão, pergunta)` | Seção visível **e** regra própria satisfeita. É o que o envio consulta. |

**`submit_my_survey_submission` foi redefinida** (mesma assinatura) para não contar como pendente a obrigatória que a lógica escondeu. Sem isso, a primeira regra criada tornaria o instrumento impossível de enviar. Por redefinir função legada consumida pelo nome por bundles publicados, o arquivo tem entrada em `LEGACY_RESTORED_OBJECTS`.

O avaliador equivalente no cliente é `src/lib/survey-conditional-logic.ts`. **Os dois precisam concordar** — ver as armadilhas de paridade (número e `DATETIME`) em [../src/lib/CLAUDE.md](../src/lib/CLAUDE.md).

### Clonagem de avaliação — `20260813160000_clonar_pesquisa.sql`

`fc_clonar_pesquisa(p_pesquisa, p_nome, p_codigo)` duplica **a estrutura**, não o histórico: seções (inclusive aninhadas), perguntas, alternativas e regras condicionais. Ciclo, participantes, submissões e respostas **não** entram. A cópia nasce em `DRAFT`, sem período e sem público.

**Os identificadores são remapeados, e isso é o cerne da função.** Uma regra condicional aponta para a pergunta de origem e para a alternativa comparada; copiar as regras apontando para os identificadores do original criaria um instrumento cuja lógica depende de outro — alterar o original mudaria a cópia, e apagá-lo deixaria regra órfã. Os mapas `v_mapa_secao`/`v_mapa_pergunta`/`v_mapa_opcao` traduzem cada identificador antigo no novo antes de gravar. O mapa de alternativas pareia por `(pergunta, código)`, que é único por constraint.

Copia a versão `PUBLISHED` se houver, senão o rascunho mais recente — nunca uma `RETIRED`, que é desenho que a própria administração aposentou. O código é gerado com sufixo até achar um livre, para que a tela não devolva erro de constraint a quem clicou em "Duplicar".

### Governança e observabilidade

`db_governanca.tb_catalogo_objeto` + `db_governanca.vw_resumo_migracao` (catálogo de conformidade de nomenclatura, restrito a `service_role`), `public.tl_erro_aplicacao` (log técnico sanitizado, sem leitura para `authenticated`).

### Marca da plataforma — `20260807093000_platform_branding_settings.sql`

`public.tb_config_plataforma` é uma tabela de **linha única**, garantida pela constraint `ck_tb_config_plataforma_unica (co_configuracao = 1)`: não há como criar uma segunda configuração. Guarda nome da organização, nome do produto, cor principal e o par URL + caminho do logotipo. RLS habilitada e `all` revogado de `anon`/`authenticated` — o acesso é só pelas duas funções `security definer`.

O bucket `platform-assets` é público para leitura, limitado a 2 MB e a `image/jpeg`, `image/png`, `image/webp`. As quatro políticas de `storage.objects` (select, insert, update, delete) exigem `can_manage_surveys()`, então apenas a administração troca o logotipo.

### Camada institucional de leitura — `20260805184500_institutional_naming_views.sql`

Schema `"DB_PESQUISAS"` com views `VW_PESSOA`, `VW_PESQUISA`, `VW_APLICACAO_PESQUISA`, `VW_SUBMISSAO`, `VW_RESPOSTA`, `VW_RESPOSTA_OPCAO`, `VW_RESULTADO_COMPETENCIA`, `VW_RESULTADO_FINAL_CDDI` — colunas renomeadas para o padrão corporativo (`SQ_PESSOA`, `NO_PESSOA`, `DT_INCLUSAO`…). Todas com `security_invoker = true`, portanto **herdam a RLS** das tabelas de origem. Destinam-se a consumo analítico externo (ex.: Power BI); a aplicação continua usando as tabelas `public`.

## Superfície de RPCs

O frontend só interage por estas funções. Assinaturas em `migrations/`; sempre confira a **migration mais recente** que redefine a função.

### Contexto e acesso

| RPC | Uso |
|---|---|
| `fc_obter_contexto_plataforma()` | Contrato de autorização. Devolve `status`, `person`, `participant`, `application`, `isLeader`, `roles`, `modules`, `canManageSurveys`. `roles` traz **um** perfil (o efetivo) e `modules` deriva só dele. Substituiu `get_my_platform_context()`, removida em `20260807150000`; redefinida em `20260810120000`. |
| `resolve_authenticated_person(target_employee_number)` | Vincula ou cria o cadastro institucional no primeiro acesso. |
| `sync_my_google_avatar()` | Copia automaticamente a foto da identidade OAuth Google para os metadados da pessoa. |
| `set_my_avatar_choice(...)` / `set_my_avatar_url(...)` | Pontes de compatibilidade: ignoram escolhas antigas e restauram a foto Google. |
| `is_allowed_institutional_email(...)` | Valida o domínio contra `institutional_domains`. |

### Catálogo e runtime genérico

`list_my_survey_catalog()` · `get_public_survey_form(target_application_code)` · `start_or_resume_my_survey_submission(...)` · `save_my_survey_answer(...)` · `submit_my_survey_submission(target_submission_id)` · `get_survey_dashboard(target_application_code)`

### Runtime CDDI

`start_or_resume_my_cddi_submission(target_application_code, target_submission_type, target_subject_person_id)` · `save_my_cddi_answer(...)` · `submit_my_cddi_submission(target_submission_id)` · `get_my_cddi_identity(...)` · `get_cddi_monitoring_dashboard(...)`

**A seleção manual de chefia foi removida** (`20260807151000_remover_selecao_manual_chefia.sql`): `search_cddi_leaders` e `set_my_cddi_leader` não existem mais. O vínculo vem só da importação da base (`sync_cddi_manager_rows`) e das correções administrativas (`set_platform_admin_leadership_link`); `get_my_cddi_identity` continua devolvendo a chefia vigente.

### Equipe e liderança

`fc_listar_ciclos_lideranca()` · `get_my_team_workspace(target_application_code)` · `search_team_candidates(target_application_id, search_term)` · `add_person_to_my_team(...)` · `remove_person_from_my_team(target_link_id)`

`20260807101500_team_avatar_contracts.sql` redefiniu `fc_obter_minha_equipe(...)` e `fc_pesquisar_equipe(...)` para devolver também o avatar canônico de cada integrante — a tela de equipe deixou de resolver imagem por conta própria. `fc_listar_ciclos_lideranca()` (`20260807151500`) lista, do mais recente ao mais antigo, os ciclos em que a pessoa autenticada tem vínculo ativo de liderança — alimenta o seletor de avaliação de `/equipe`.

### Marca da plataforma

| RPC | Uso |
|---|---|
| `fc_obter_marca_plataforma()` | Devolve `organizationName`, `productName`, `logoUrl`, `logoPath`, `primaryColor`, `updatedAt` e os textos e cores configuráveis (`productDescription`, `accessGreeting`, `accessInstruction`, `emailInstruction`, `emailFooter`, `sidebarColor`, `accessPanelColor`, arte de fundo). Leitura para qualquer sessão. Redefinida várias vezes **sem mudar a assinatura** — acrescentar chave ao jsonb é seguro, quem não a conhece a ignora. |
| `fc_atualizar_marca_plataforma(no_organizacao, no_produto, tx_url_logotipo, tx_caminho, co_cor_principal)` | Grava a linha única. Exige `can_manage_surveys()`; valida nomes (1–60), cor `^#[0-9a-f]{6}$`, logotipo obrigatoriamente **HTTPS** e URL + caminho informados **em conjunto**. |

### Construtor e ciclo

`create_survey_draft(...)` · `list_managed_surveys()` · `get_survey_builder(target_survey_id)` · `add_survey_section` / `update_survey_section` · `add_survey_question` / `update_survey_question` / `delete_survey_question` · `duplicate_survey_builder_item` · `reorder_survey_builder_item` · `move_survey_question_to_section` · `fc_excluir_pesquisa_rascunho(p_pesquisa)` · `fc_criar_nova_versao_pesquisa(p_pesquisa)` · `get_survey_operations(target_survey_id)` · `manage_survey_cycle(target_survey_id, target_action, target_opens_at, target_closes_at)` · `update_application_visual_settings(...)` · `get_application_visual_settings(...)`

### Nova versão de uma pesquisa publicada — `20260824110000_criar_nova_versao_pesquisa.sql`

`fc_criar_nova_versao_pesquisa(p_pesquisa)` implementa o que o construtor só prometia em texto ("Crie uma nova versão para realizar alterações"): copia a estrutura da versão publicada (seções, perguntas, alternativas, regras condicionais — mesmo remapeamento de identificadores de `fc_clonar_pesquisa`) para uma versão nova **da mesma pesquisa** (`survey_id` inalterado, `version_number` seguinte), em vez de criar uma pesquisa nova como o clone faz.

**É a primeira função a gravar `RETIRED`.** O estado existe desde o esquema inicial e sempre foi aceito na leitura (`get_public_survey_form`, `list_my_survey_catalog` tratam `sv.status in ('PUBLISHED','RETIRED')` como válido para quem já estava respondendo), mas nenhuma função o escrevia. Esta função aposenta a versão publicada **antes** de inserir a próxima — nunca depois — para que `get_survey_builder`, `get_survey_operations`, `manage_survey_cycle` e `list_managed_surveys`, que resolvem "a versão" por `order by version_number desc limit 1`, passem a apontar sozinhas para a versão nova sem precisar ser redesenhadas.

**Também cria uma `survey_applications` nova.** `survey_version_id` é FK direta para uma versão; sem uma aplicação nova, `manage_survey_cycle` falharia com "Ciclo de aplicação não encontrado." assim que alguém tentasse publicar a versão criada aqui. O ciclo novo herda as preferências operacionais da aplicação anterior (`allow_drafts`, `allow_resubmission`, `anonymous`, `access_mode`, `nu_limiar_anonimato`, `st_notificacao_email`), mas nasce sem período e **sem identidade visual** — `settings` começa vazio, de propósito: a capa mora em `settings->'visualIdentity'` e `update_application_visual_settings` exige que o caminho do banner comece pelo id da própria aplicação, então copiar o jsonb geraria uma referência que a tela de identidade recusaria revalidar sem trocar o arquivo.

**Exige o ciclo anterior encerrado.** A função recusa a operação se a versão mais recente ainda estiver em `DRAFT` (nunca publicada, ou já existe um rascunho mais novo) ou se o ciclo dela ainda estiver `DRAFT`/`SCHEDULED`/`OPEN`. A razão é a mesma da resolução por "versão mais recente" citada acima: permitir a criação com o ciclo anterior ainda ativo cegaria a administração para ele, que ficaria correto para quem responde mas inacessível pela tela de Propriedades — **nunca há dois ciclos operacionalmente relevantes ao mesmo tempo**. Por isso nenhuma das quatro RPCs de resolução precisou mudar.

`20260811120000_periodo_futuro_e_exclusao_rascunho.sql` acrescentou duas regras. **Período no futuro:** `create_survey_draft` e `manage_survey_cycle`/`UPDATE_PERIOD` recusam abertura anterior ao momento atual (tolerância de `interval '1 minute'`), e `SCHEDULE` passou a recusar ciclo cujo encerramento já venceu. A regra fica fora de `PUBLISH` de propósito — um rascunho com período vencido precisa continuar publicável para que o operador chegue à tela onde corrige a data; o aviso prévio é do frontend. **Exclusão:** `fc_excluir_pesquisa_rascunho` remove a avaliação inteira só enquanto nenhuma versão saiu de `DRAFT` e não há submissão; audita em `SURVEY_DELETED` antes do delete. `20260811143000_corrigir_exclusao_pesquisa_rascunho.sql` corrigiu a definição original, que falhava **sempre** que houvesse seção, pergunta ou alternativa: ela apagava `survey_versions` e confiava no cascade, mas `enforce_draft_survey_structure` dispara `before … delete` nas três tabelas estruturais e exige que a versão da linha ainda exista e esteja em `DRAFT` — e o cascade do PostgreSQL remove o pai antes dos filhos, então o trigger abortava tudo com `Versão da pesquisa não encontrada.`. A versão corrigida apaga de baixo para cima (alternativas → perguntas → seções → ciclo → versão → pesquisa), com a versão presente em cada passo. **Trigger `security definer` não se desliga por sessão: quando existe um, o cascade deixa de ser caminho viável.** Como redefine duas funções legadas consumidas por bundles publicados, o arquivo tem entrada em `LEGACY_RESTORED_OBJECTS` (ver [../scripts/CLAUDE.md](../scripts/CLAUDE.md)) — renomeá-las quebraria a criação de avaliações e a operação de ciclos.

`20260811160000_corrigir_exclusao_secoes_aninhadas.sql` fecha a mesma armadilha uma camada abaixo, **dentro da própria tabela**. `survey_sections` referencia a si mesma por `survey_sections_parent_same_version_fk (parent_section_id, survey_version_id)`, declarada `on delete cascade`: um `delete` que varre toda a versão de uma vez remove a seção-pai antes da filha, o cascade dispara `enforce_draft_survey_structure` sobre a filha e o erro `Versão da pesquisa não encontrada.` volta em avaliação com seções aninhadas. A correção troca a varredura única por um laço que apaga **só folhas** (`not exists` de filha) até esvaziar — linha sem filha nunca aciona cascade, e o trigger avalia cada uma com a versão presente e em `DRAFT`. A definição vigente da função é a deste arquivo. Regra geral que vale para qualquer `delete` novo nessas tabelas: **enquanto houver trigger estrutural, nenhum cascade é caminho viável — nem o que a tabela faz para ela mesma.**

`20260814100000_abrir_ciclos_agendados.sql` faz o agendamento cumprir o que promete. `SCHEDULED` nunca virava `OPEN`: não há job agendado no projeto (sem `pg_cron`, sem cron da Vercel) e nenhuma rota fazia a virada, então o ciclo chegava na data marcada e continuava recusando resposta. A correção tem duas peças que se cobrem. **`fc_abrir_ciclos_agendados()`** materializa a virada (versão publicada, abertura vencida, encerramento no futuro), audita em `SURVEY_CYCLE_AUTO_OPEN` e é chamada por `get_survey_operations`, `list_my_survey_catalog` e `get_public_survey_form` — que por isso **deixaram de ser `stable`**, já que função `stable` não pode gravar nem através de outra. **`application_accepts_responses()`** passou a aceitar o ciclo `SCHEDULED` cuja abertura já passou, o que desacopla "pode responder" de "a materialização já rodou": sem isso, `/cddi` e o runtime genérico — que disparam `get_public_survey_form` e `start_or_resume_*` no mesmo `Promise.all` — dariam erro para a primeira pessoa a entrar no minuto da abertura. O arquivo também faz `SCHEDULE` aceitar `target_opens_at`/`target_closes_at`, que ele ignorava, para que a tela grave o período e agende numa transação só; **a assinatura não muda**, então nenhum bundle publicado quebra. Como redefine cinco funções legadas consumidas pelo nome (quatro por bundles publicados, `application_accepts_responses` por políticas de RLS), o arquivo tem entrada em `LEGACY_RESTORED_OBJECTS`.

### Administração

`list_access_workspace()` · `fc_definir_perfil_pessoa(p_pessoa, p_perfil)` (substituiu `set_person_role`, que **não** foi removida — ver abaixo) · `get_admin_people_base_summary(target_application_id)` · `list_admin_participant_applications()` · `list_admin_application_participants(...)` · `search_admin_people_for_application(...)` · `assign_admin_application_participant(...)` · `assign_admin_application_participants_bulk(...)` · `assign_admin_all_available_participants(...)` · `create_and_assign_admin_participant(...)` · `set_admin_application_participant_status(...)` · `search_platform_admin_people(...)` · `update_platform_admin_person(...)` · `list_platform_admin_leadership_links(...)` · `set_platform_admin_leadership_link(...)` · `list_platform_admin_person_audit(...)`

### Notificação por e-mail — `20260818130000` + `20260820153000`

`survey_applications.st_notificacao_email` liga os avisos automáticos do ciclo, e `tl_email_participante` registra cada envio com chave única `(sq_aplicacao, sq_pessoa, tp_email)` — é a constraint, não o código da aplicação, que impede e-mail em dobro quando o processamento roda mais de uma vez. Tipos: `research_opened` (abertura) e `research_expiring_24h` (24 horas finais). O lembrete exige que o aviso de abertura tenha sido enviado há pelo menos uma hora, para ciclos curtos não receberem os dois simultaneamente. A tabela fica sem grant para `anon`/`authenticated`.

| RPC | Uso |
|---|---|
| `fc_definir_notificacao_email(target_survey_id, target_enabled)` | Liga/desliga a opção do ciclo. Exige `can_manage_surveys()`; audita `SURVEY_EMAIL_NOTIFICATIONS_SET`. |
| `fc_reivindicar_emails()` | **Service role apenas.** Materializa aberturas, cria pendências e entrega até 100 por token. `PROCESSANDO` expira em 15 minutos; `FALHOU` espera 5 minutos e tem no máximo 5 tentativas; `FOR UPDATE SKIP LOCKED` separa execuções concorrentes. |
| `fc_concluir_email_participante(target_email_id, target_claim_token, target_success, target_error)` | **Service role apenas.** Só conclui uma linha enquanto o token da execução ainda é vigente. A assinatura anterior permanece temporariamente para bundles já publicados. |

**O conteúdo do e-mail vem de três lugares, e nenhum deles é escolha de estilo.** Nome, prazo e link vêm do ciclo; **o que a avaliação é** vem de `surveys.description`, já editada no construtor — o payload só a transporta, em vez de existir um segundo campo que divergiria dela; **a instrução de acesso e o rodapé** são institucionais, se repetem em todo ciclo e moram em `tb_config_plataforma` (`tx_instrucao_email`, `tx_rodape_email`), configurados na central de e-mails por `fc_definir_textos_email(p_instrucao, p_rodape)`.

A configuração entra na reivindicação por `left join … on cfg.co_configuracao = 1`, e o `left` é a decisão que importa: com `cross join`, uma instalação sem a linha de configuração deixaria de reivindicar **qualquer** e-mail, em silêncio. Nulo faz o template cair no padrão de `src/lib/participant-emails.ts`, que nunca envia sem instrução nem sem assinatura.

**Envio dirigido** (`manual_reminder`), para avisar pessoas escolhidas em vez do ciclo inteiro:

| RPC | Uso |
|---|---|
| `fc_agendar_envio_manual(p_aplicacao, p_pessoas[])` | Enfileira `manual_reminder` para as pessoas escolhidas. Exige `can_manage_surveys()` e ciclo `OPEN`; teto de 1500 por disparo; audita `EMAIL_MANUAL_QUEUED`. **Não envia — enfileira**, e o despacho é o mesmo dos automáticos. |
| `fc_listar_audiencia_email(...)` · `fc_listar_envios_email(...)` | Leitura administrativa. `tl_email_participante` continua sem grant: quem lê são estas funções. |

**O índice único virou parcial.** `uk_email_participante` deu lugar a `in_email_partic_auto_unico`, restrita aos dois tipos automáticos. `manual_reminder` é append-only de propósito: um segundo lembrete à mesma pessoa é legítimo, e a unicidade antiga o bloquearia em silêncio. O que protege do clique duplo é a regra de `fc_agendar_envio_manual`, que recusa quem já tem manual em `PENDENTE` — ou em `PROCESSANDO` dentro do lease, para que um claim abandonado não bloqueie para sempre.

**`manual_reminder` não exige `st_notificacao_email`.** Envio dirigido é ato explícito de quem opera; exigir o interruptor do ciclo tornaria impossível cobrar quem falta num ciclo sem aviso automático.

> **Duas frentes trabalharam nesta fila no mesmo dia (20/08/2026)**, e a reconciliação vale registrar. Uma criou a máquina de estados, o contador de tentativas e o token de reivindicação; a outra criou o envio dirigido, a leitura administrativa e os textos configuráveis. Como as duas redefiniram `fc_reivindicar_emails()`, a segunda sobrescreveu a primeira em produção e deixou `nu_tentativas` órfão por algumas horas. A versão vigente é a **da primeira frente**, acrescida do payload de conteúdo e do suporte a `manual_reminder`. A lição é a de sempre neste arquivo: **redefinição de função é o ponto onde trabalho paralelo se perde em silêncio** — confira a definição viva no banco antes de assumir que a sua é a que está lá.

Quem envia é `/api/tarefas/emails` (ver [../src/app/api/CLAUDE.md](../src/app/api/CLAUDE.md)). A chave única impede criar dois registros para o mesmo aviso; o token impede processamento concorrente. Como SMTP e confirmação no banco são sistemas distintos, uma interrupção exatamente entre os dois ainda pode exigir reconciliação operacional. Teste em `tests/email_participante_idempotencia.sql`.

### Presença online — `20260821100000_presenca_online_com_rls.sql`

`public.tb_presenca_online` guarda **uma linha por pessoa**, sobrescrita a cada batida: o histórico de quem esteve online é dado descartável, e acumulá-lo faria a tabela crescer sem limite. RLS habilitada e todos os privilégios revogados — o acesso é só pelas duas funções.

| RPC | Uso |
|---|---|
| `fc_registrar_presenca()` | Registra a batida de **quem chamou** — não recebe identificador, porque rota com parâmetro exigiria verificar que o parâmetro é o próprio chamador. Devolve `DISABLED` (não erro) com a presença desligada na configuração. |
| `fc_listar_presenca_online()` | Pessoas com batida nos últimos 2 minutos. Recusa quem não é perfil de visualização com **exceção**, não com lista vazia: a tela precisa distinguir "ninguém online" de "você não pode ver". |

**As duas reusam os portões de `private`** (`can_track_platform_presence`, `can_view_platform_presence`) criados por `20260819135306`. Reimplementar a checagem de perfil aqui criaria a segunda fonte que divergiria da primeira na correção seguinte.

**Por que a presença deixou de ser Realtime.** As políticas de `realtime.messages` estavam corretas — leitura e track separados, cada um com o seu portão. O problema é o protocolo: entrar num canal privado exige permissão de **leitura**, e sem entrar não há `track`. Logo o portão de leitura bloqueava o anúncio também, e quem não era perfil de visualização nunca aparecia **e** gerava erro de autorização a cada carregamento de página. Canal privado é a ferramenta errada para "escrever sem ler". As políticas ficam no banco, inertes, até o frontend antigo sair de circulação.

> **`fc_obter_marca_plataforma()` voltou a devolver 17 chaves nesta migration.** As duas de presença (`onlinePresenceEnabled`, `onlinePresenceViewerRoles`) existiam em `20260819135306` e foram perdidas quando `20260820120000` redefiniu a função para acrescentar os textos de e-mail — a mesma classe de erro que apagou `nu_tentativas` da fila. O efeito não era cosmético: sem elas o cliente caía nos padrões do código e podia mostrar o indicador a um perfil que o banco recusa, **produzindo** parte do erro de autorização descrito acima. Terceira ocorrência do mesmo padrão em dois dias — antes de redefinir função, confira a lista de chaves que a versão viva devolve.

### Service role apenas

`sync_people_base_rows(p_rows, p_batch_id)` e `sync_cddi_manager_rows(p_rows, p_batch_id)` — chamadas exclusivamente por `/api/admin/import-participants`. `fc_reivindicar_emails()` e `fc_concluir_email_participante(...)` — chamadas exclusivamente por `/api/tarefas/emails`.

### Helpers internos (não são RPCs)

`current_person_id()`, `has_active_role(...)`, `can_manage_surveys()`, `can_access_application(...)`, `application_accepts_responses(...)`, `fc_abrir_ciclos_agendados()`, `is_platform_administrator()`, `unaccent_lower(...)`, `set_updated_at()`, `validate_survey_version_integrity(...)`.

**`application_accepts_responses(uuid)` é o portão único do runtime de resposta.** Governa as duas jornadas (`start_or_resume_my_survey_submission` e `start_or_resume_my_cddi_submission`), `save_*`, `submit_*`, `can_edit_submission` e as políticas de RLS de submissões e respostas. Mudar essa função muda quem pode responder em toda a plataforma de uma vez — é o lugar certo para a regra de período, e o lugar errado para qualquer coisa específica de um instrumento.

`fc_abrir_ciclos_agendados()` não recebe grant nenhum, de propósito: é chamada de dentro de RPCs `security definer`, que executam como o dono e dispensam `execute` do papel de quem chamou.

`private.can_audit_platform()` e `private.can_edit_submission(uuid)` foram movidos para o schema `private` em `20260804172000` — schema **não exposto** pela Data API, com `EXECUTE` concedido apenas a `authenticated`.

## Regras de negócio no banco

### Autorização por aplicação

`survey_applications.access_mode` decide quem entra:

- `INSTITUTIONAL` — qualquer usuário institucional autenticado e ativo, durante o período aberto.
- `RESTRICTED` — apenas participantes elegíveis em `application_participants` e administradores.

`CDDI-2026` é `RESTRICTED`.

### Submissões

- `submissions.submission_type` distingue `AUTO`, `CHEFIA` e outros fluxos.
- Trigger `validate_cddi_submission` (só quando `surveys.code = 'CDDI'`):
  - tipo precisa ser `AUTO` ou `CHEFIA`;
  - `subject_person_id` é obrigatório;
  - em `AUTO`, respondente e avaliado precisam ser a mesma pessoa;
  - em `CHEFIA`, precisa existir vínculo `ACTIVE` e **vigente** em `cddi_leadership_links` entre respondente e avaliado.
- Trigger `validate_cddi_final_result` garante que as submissões referenciadas pertencem à mesma aplicação e ao mesmo avaliado, e que os tipos correspondem aos campos (`auto_submission_id` → `AUTO`, `leader_submission_id` → `CHEFIA`).
- **Respostas só mudam enquanto a submissão está `DRAFT`** (`can_edit_submission`).
- Uma avaliação de chefia por pessoa e ciclo.

**A chefia responsável não é campo de formulário** (`20260807113000_fix_cddi_leader_submission_contract.sql`). A versão publicada declara uma pergunta `PERSON` de código `CHEFIA_RESPONSAVEL`, mas ela é preenchida pelo banco a partir do vínculo institucional, nunca digitada:

- `sync_cddi_leader_technical_answer(application, subordinado, chefia)` grava `answer_json = {personId, source: "cddi_leadership_links"}` nas submissões `DRAFT` (`AUTO` e `CHEFIA`) daquele avaliado, limpando os demais campos de resposta no `on conflict`.
- O trigger `sync_new_cddi_submission_leader_answer` faz o mesmo ao criar submissão, e a definição do vínculo o refaz — trocar a chefia atualiza a resposta técnica sozinha.
- Se a versão publicada não tiver a pergunta, a função retorna sem erro: instrumento sem esse contrato continua válido.

No frontend, `visibleCddiSections()` remove toda pergunta `PERSON` antes de renderizar, para que o operador não veja um campo que não deve preencher (ver [../src/lib/CLAUDE.md](../src/lib/CLAUDE.md)).

### Cálculo do CDDI (`calculation_version = 'CDDI-2026-V1'`)

| Componente | Peso |
|---|---|
| Média dos três comportamentos da competência | 70 % |
| Nível de desenvolvimento | 30 % |
| Autoavaliação no resultado final | 40 % |
| Avaliação da chefia no resultado final | 60 % |

Escala de 1 a 5, validada por `check` em `cddi_competency_results` e `cddi_final_results`. `cddi_final_results.status` percorre `PENDING → PARTIAL → CALCULATED → PUBLISHED` (ou `INVALIDATED`); `PUBLISHED` exige `published_at`.

### Ciclo de vida da aplicação

`manage_survey_cycle` implementa a máquina de estados; `validate_survey_version_integrity` bloqueia publicação inconsistente; `enforce_draft_survey_structure` impede alterar estrutura após a publicação. Detalhes das transições em [../src/app/admin/CLAUDE.md](../src/app/admin/CLAUDE.md).

### Identidade de acesso

- `people.employee_number` é único e identifica a pessoa.
- `people.institutional_email` preserva o dado recebido da fonte, mesmo repetido.
- `person_access_identities.email` representa identidade **validada** para login; e-mail duplicado entre matrículas **não** é ativado automaticamente.
- Vinculação automática só por matrícula permanece desabilitada.

Contexto completo: [../docs/auditoria-base-cddi-2026.md](../docs/auditoria-base-cddi-2026.md).

### Fotos de perfil

`20260810140000_usar_foto_google_automaticamente.sql` remove escolhas anteriores, usa exclusivamente a imagem de `auth.identities` com provedor Google e mantém os setters antigos apenas como ponte. Sem imagem disponível, o frontend mostra um ícone neutro; não há iniciais, upload ou avatar gerado.

## Convenções específicas

### Nome do arquivo

`AAAAMMDDHHMMSS_nome_em_snake_case.sql`, timestamp único. Validado por `npm run db:migrations`.

### Estrutura do arquivo

```sql
begin;

-- comentário explicando a decisão de negócio, não a sintaxe

create table ... ;
alter table ... enable row level security;
revoke all on ... from public, anon, authenticated;
grant select, insert on ... to authenticated;
create policy nome_explicito on ... for ... to ... using (...) with check (...);

commit;

-- Rollback:
-- begin;
--   ...
-- commit;
```

Migrations recentes (a partir de `20260804172000`) incluem o bloco de rollback comentado. Siga esse padrão.

### Nomenclatura

Novos objetos seguem o padrão institucional AgSUS: `tb_`/`rl_`/`tl_`/`au_` para tabelas, `co_`/`sq_`/`dt_`/`ds_`/`no_`/`nu_`/`st_`/`tp_` para colunas, `pk_`/`fk_`/`uk_`/`ck_`/`in_` para constraints e índices, `vw_`/`fc_` para views e funções. Constraints **sempre** nomeadas explicitamente. Validado por `npm run db:naming` **apenas nas migrations alteradas em relação a `main`** — objetos legados (`people`, `surveys`, `submissions`…) permanecem com os nomes atuais e são catalogados em `db_governanca.tb_catalogo_objeto`. Regras completas: [../docs/database-naming-standard.md](../docs/database-naming-standard.md).

### Segurança obrigatória em toda migration

1. RLS habilitada em qualquer tabela de schema exposto.
2. Privilégios padrão revogados; só os grants necessários concedidos.
3. Políticas, constraints e índices com nome explícito.
4. `set search_path = pg_catalog, public` em toda função privilegiada.
5. `EXECUTE` revogado de `public` e `anon` em função interna.
6. RPC pública valida `auth.uid()`, pessoa, papel e escopo.
7. Security e Performance Advisors executados após DDL.

`20260803133300_harden_rpc_permissions.sql` aplica a regra 5 em massa: revoga `EXECUTE` de `public`/`anon` em **todas** as funções `SECURITY DEFINER` de `public` e concede a `authenticated`. Ao criar uma nova função `SECURITY DEFINER`, repita esses grants explicitamente — o bloco `do $$` foi executado uma única vez.

### Timezone

`timezone('utc', now())` em todo default e comparação. A conversão para `America/Sao_Paulo` acontece na apresentação.

## Testes

```bash
supabase start
supabase db reset       # reconstrói o banco a partir das migrations
supabase test db        # pgTAP
supabase stop --no-backup
```

`tests/rls_exposed_tables.sql` afirma que a contagem de tabelas de `public` com `relrowsecurity = false` é zero. **Criar tabela em `public` sem RLS quebra o CI** — é o comportamento desejado.

## Pontos de atenção

- **Nunca renomeie objeto legado diretamente.** Exige inventário de dependências, compatibilidade temporária, atualização de RPCs e frontend, testes de RLS/autossalvamento/envio/painéis, rollback documentado e aprovação do Data Owner.
- **Ao aplicar SQL pela Management API, cuide do transporte do UTF-8.** O `Invoke-RestMethod` do Windows PowerShell 5.1 **destrói caractere não-ASCII no corpo da requisição**: um `í` sai do arquivo correto e chega ao banco como `U+FFFD`. O defeito é silencioso — a migration retorna sucesso, e só uma leitura por bytes o revela. Em 17/08/2026 sete migrations acentuadas entraram em produção assim, e a correção foi reaplicá-las por um cliente que serializa em UTF-8 (o `fetch` do Node serve). Confira depois de aplicar, sempre por bytes:
  ```sql
  select p.proname,
         encode(convert_to(pg_get_functiondef(p.oid), 'UTF8'), 'hex') like '%efbfbd%' as destruido,
         encode(convert_to(pg_get_functiondef(p.oid), 'UTF8'), 'hex') like '%c383c2%' as duplamente_codificado
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prokind = 'f';
  ```
  Ler o texto na tela **não** serve para diagnosticar: o PowerShell também exibe acento correto como se estivesse corrompido, e os dois defeitos são distintos — `c383c2` é dupla codificação (o texto original ainda está lá, recuperável); `efbfbd` é perda, e a única saída é reaplicar a definição.
- **Nunca aplique DDL manualmente em produção.** Toda mudança é migration revisada. Aplicar SQL direto no editor **não** registra nada em `supabase_migrations.schema_migrations`, e é assim que um banco passa a divergir do repositório sem sintoma — foi o que aconteceu em produção até 10/08/2026 (ver [../docs/operacao-permissoes.md](../docs/operacao-permissoes.md)). Se precisar aplicar um arquivo pelo editor, registre a versão depois com `insert into supabase_migrations.schema_migrations (version) values ('…') on conflict do nothing`.
- **`drop function` em RPC consumida pelo frontend é mudança quebrante.** O bundle publicado chama a função pelo nome; removê-la antes de o frontend novo estar no ar derruba toda tela que dependa dela, com `Could not find the function … in the schema cache`. Publique o frontend primeiro, confirme, e só então remova — ou mantenha a antiga como ponte delegando à nova (`select public.fc_nova();`) e remova depois.
- **Nunca comite credencial, token ou dado pessoal.** A base de pessoas é carregada por processo controlado.
- **Várias funções foram redefinidas múltiplas vezes** (`manage_survey_cycle`, `set_my_avatar_url`, `search_team_candidates`, `get_survey_dashboard`, `duplicate_survey_builder_item`, `resolve_authenticated_person`, `can_access_application`, `list_my_survey_catalog`, `start_or_resume_my_survey_submission`, `get_public_survey_form`). Antes de editar, encontre a definição vigente:
  ```bash
  grep -rn "function public.nome_da_funcao" supabase/migrations | sort
  ```
  A migration com timestamp mais alto é a que vale.
- **Função nova em migration precisa do prefixo `fc_`/`sp_`** (`npm run db:naming`). Para mudar o comportamento de uma função legada, o padrão do repositório é criar a substituta `fc_*`, migrar os consumidores e dar `drop` na antiga — foi o que `20260807150000` fez com `get_my_platform_context` → `fc_obter_contexto_plataforma`.
- Mudar mensagem de `raise exception` altera texto que chega ao usuário final — as telas exibem `error.message` diretamente. Algumas mensagens legadas ainda citam "pesquisa"/"Equipe Técnica" (ex.: `list_managed_surveys`); atualizá-las exige redefinir as funções, o que ficou para uma manutenção futura.
- `supabase/config.toml` não está versionado; o CI executa `supabase init` quando ausente.
- `supabase/migrations/README.md` está desatualizado (afirma que a primeira migration ainda será criada).
