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

A exclusividade é **garantida pelo banco** desde `20260810140000_perfil_unico_por_pessoa.sql`: o índice único parcial `in_perfil_unico_vigente` sobre `person_role_assignments (person_id) where ends_at is null` impede o estado inválido de existir. Antes era só convenção — `fc_definir_perfil_pessoa` encerrava os outros e `resolvePlatformRole()` desempatava por privilégio quando encontrava vários, mas nada barrava uma correção manual ou uma RPC futura de reintroduzir acumulação. Consequência para quem escrever RPC nova: **encerre o perfil vigente antes de conceder o novo**, nunca o contrário — foi por isso que `20260810140000` redefiniu `fc_definir_perfil_pessoa`, cuja ordem original (conceder e depois encerrar) violava o índice. Histórico encerrado não conflita: `ends_at` preenchido sai do escopo do índice.

**`platform_modules`, `role_module_permissions` e `person_module_permissions` não são fonte de autorização.** Criadas em `20260731115500`, deixaram de ter leitor em runtime a partir de `20260803104000`, quando o mapa de módulos passou a ser derivado do papel dentro do corpo da função de contexto; o último leitor, `get_my_platform_context()`, foi removido em `20260807150000`. Hoje quem decide os módulos é o `case` de `fc_obter_contexto_plataforma()`. Por isso `20260810120000` só as atualiza **se existirem** (`to_regclass`), e `20260810130000_restaurar_catalogo_modulos_plataforma.sql` as recria de forma idempotente onde faltam. Valem como documentação do banco — ao alterar o mapa de perfis, atualize a função, não a tabela.

> **O banco de produção divergiu do histórico de migrations.** Em 10/08/2026 descobriu-se que `20260731115500` e as quatro migrations de `20260807*` nunca foram aplicadas lá, embora `supabase_migrations.schema_migrations` existisse: parte do esquema foi criada por SQL direto, sem passar pelo registro. O sintoma foi `relation "public.role_module_permissions" does not exist` ao aplicar `20260810120000`. **Antes de aplicar qualquer migration em produção, confronte o histórico com o esquema real** — o registro pode afirmar que uma migration rodou quando os objetos dela não existem, e vice-versa. O procedimento de verificação está em [../docs/operacao-permissoes.md](../docs/operacao-permissoes.md).

Mapa perfil → módulo em `role_module_permissions` e em `fc_obter_contexto_plataforma()`:

| Perfil | Módulos |
|---|---|
| `ADMINISTRATOR` | todos os 10 |
| `SURVEY_MANAGER` | `HOME`, `SURVEYS`, `DASHBOARDS`, `TEAM`, `RESULTS`, `ADMIN_SURVEYS`, `ADMIN_PARTICIPANTS` |
| `LEADER` | `HOME`, `SURVEYS`, `TEAM` |
| `RESPONDENT` | `SURVEYS` |

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
| `fc_obter_marca_plataforma()` | Devolve `organizationName`, `productName`, `logoUrl`, `logoPath`, `primaryColor`, `updatedAt`. Leitura para qualquer sessão. |
| `fc_atualizar_marca_plataforma(no_organizacao, no_produto, tx_url_logotipo, tx_caminho, co_cor_principal)` | Grava a linha única. Exige `can_manage_surveys()`; valida nomes (1–60), cor `^#[0-9a-f]{6}$`, logotipo obrigatoriamente **HTTPS** e URL + caminho informados **em conjunto**. |

### Construtor e ciclo

`create_survey_draft(...)` · `list_managed_surveys()` · `get_survey_builder(target_survey_id)` · `add_survey_section` / `update_survey_section` · `add_survey_question` / `update_survey_question` / `delete_survey_question` · `duplicate_survey_builder_item` · `reorder_survey_builder_item` · `move_survey_question_to_section` · `fc_excluir_pesquisa_rascunho(p_pesquisa)` · `get_survey_operations(target_survey_id)` · `manage_survey_cycle(target_survey_id, target_action, target_opens_at, target_closes_at)` · `update_application_visual_settings(...)` · `get_application_visual_settings(...)`

`20260811120000_periodo_futuro_e_exclusao_rascunho.sql` acrescentou duas regras. **Período no futuro:** `create_survey_draft` e `manage_survey_cycle`/`UPDATE_PERIOD` recusam abertura anterior ao momento atual (tolerância de `interval '1 minute'`), e `SCHEDULE` passou a recusar ciclo cujo encerramento já venceu. A regra fica fora de `PUBLISH` de propósito — um rascunho com período vencido precisa continuar publicável para que o operador chegue à tela onde corrige a data; o aviso prévio é do frontend. **Exclusão:** `fc_excluir_pesquisa_rascunho` remove a avaliação inteira só enquanto nenhuma versão saiu de `DRAFT` e não há submissão; audita em `SURVEY_DELETED` antes do delete. `20260811143000_corrigir_exclusao_pesquisa_rascunho.sql` corrigiu a definição original, que falhava **sempre** que houvesse seção, pergunta ou alternativa: ela apagava `survey_versions` e confiava no cascade, mas `enforce_draft_survey_structure` dispara `before … delete` nas três tabelas estruturais e exige que a versão da linha ainda exista e esteja em `DRAFT` — e o cascade do PostgreSQL remove o pai antes dos filhos, então o trigger abortava tudo com `Versão da pesquisa não encontrada.`. A versão corrigida apaga de baixo para cima (alternativas → perguntas → seções → ciclo → versão → pesquisa), com a versão presente em cada passo. **Trigger `security definer` não se desliga por sessão: quando existe um, o cascade deixa de ser caminho viável.** Como redefine duas funções legadas consumidas por bundles publicados, o arquivo tem entrada em `LEGACY_RESTORED_OBJECTS` (ver [../scripts/CLAUDE.md](../scripts/CLAUDE.md)) — renomeá-las quebraria a criação de avaliações e a operação de ciclos.

`20260811160000_corrigir_exclusao_secoes_aninhadas.sql` fecha a mesma armadilha uma camada abaixo, **dentro da própria tabela**. `survey_sections` referencia a si mesma por `survey_sections_parent_same_version_fk (parent_section_id, survey_version_id)`, declarada `on delete cascade`: um `delete` que varre toda a versão de uma vez remove a seção-pai antes da filha, o cascade dispara `enforce_draft_survey_structure` sobre a filha e o erro `Versão da pesquisa não encontrada.` volta em avaliação com seções aninhadas. A correção troca a varredura única por um laço que apaga **só folhas** (`not exists` de filha) até esvaziar — linha sem filha nunca aciona cascade, e o trigger avalia cada uma com a versão presente e em `DRAFT`. A definição vigente da função é a deste arquivo. Regra geral que vale para qualquer `delete` novo nessas tabelas: **enquanto houver trigger estrutural, nenhum cascade é caminho viável — nem o que a tabela faz para ela mesma.**

### Administração

`list_access_workspace()` · `fc_definir_perfil_pessoa(p_pessoa, p_perfil)` (substituiu `set_person_role`, removida em `20260810120000`) · `get_admin_people_base_summary(target_application_id)` · `list_admin_participant_applications()` · `list_admin_application_participants(...)` · `search_admin_people_for_application(...)` · `assign_admin_application_participant(...)` · `assign_admin_application_participants_bulk(...)` · `assign_admin_all_available_participants(...)` · `create_and_assign_admin_participant(...)` · `set_admin_application_participant_status(...)` · `search_platform_admin_people(...)` · `update_platform_admin_person(...)` · `list_platform_admin_leadership_links(...)` · `set_platform_admin_leadership_link(...)` · `list_platform_admin_person_audit(...)`

### Service role apenas

`sync_people_base_rows(p_rows, p_batch_id)` e `sync_cddi_manager_rows(p_rows, p_batch_id)` — chamadas exclusivamente por `/api/admin/import-participants`.

### Helpers internos (não são RPCs)

`current_person_id()`, `has_active_role(...)`, `can_manage_surveys()`, `can_access_application(...)`, `is_platform_administrator()`, `unaccent_lower(...)`, `set_updated_at()`, `validate_survey_version_integrity(...)`.

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
