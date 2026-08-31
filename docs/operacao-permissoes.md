# Operação do modelo de permissões

Desde `20260828130000_unificar_autorizacao_por_permissao.sql`, toda pessoa
institucional usa uma única role técnica: `authenticated`. Superadmin, Admin,
Gestor, Avaliador e Participante continuam visíveis na interface somente como
presets para preencher permissões; não são identidade nem fonte de autorização.

As roles lógicas `anon` e `service_role` continuam separando, no adaptador de
RPC, jornadas públicas e rotinas internas. Elas não representam pessoas nem
perfis funcionais.

## Três roles no cluster, três palavras no código

Desde `20260828140000_remover_roles_legadas_do_cluster.sql` não existem mais as
roles do contrato PostgREST/GoTrue — `anon`, `authenticated`, `service_role`,
`authenticator`, `dashboard_user`, `pgbouncer` e as quatro `supabase_*`. E
desde `scripts/separar-usuarios-app-e-migration.sql` (31/08) o ambiente local
usa a arquitetura de três roles, cada uma com um trabalho:

| Role | Trabalho | Poder |
|---|---|---|
| `app_user` | runtime da aplicação (`src/lib/db/pool.ts`) | DML e EXECUTE em `sigav`, via policies explícitas; zero DDL, dona de nada |
| `migration_user` | migrations e DDL (`scripts/aplicar-migrations.mjs`) | dona de todo o schema `sigav` e do banco |
| `postgres` | manutenção do servidor | superusuário |

Usuários finais **não viram role**: são claims de sessão, com perfis geridos
pela aplicação em `person_module_permissions`. As 14 roles `pg_*` que aparecem
em qualquer cliente SQL são predefinidas do PostgreSQL (nascem no `initdb`,
nenhuma conecta, o servidor recusa removê-las) — não fazem parte da
autorização.

No `db_dataware` da empresa ainda vale a credencial única `usr_sip_app` (o DBA
é quem pode criar a separação lá; o mesmo script serve de modelo). O código
funciona nos dois mundos: `aplicar-migrations.mjs` usa
`MIGRATION_USERNAME_DATABASE_URL`/`MIGRATION_PASSWORD_DATABASE_URL` quando
existem e cai nas variáveis do runtime quando não existem.

A réplica local é recriada por `scripts/replicar-banco-local.mjs`, e o dump da
empresa não traz `app_user` nem as policies dela — **rode o script de separação
de novo após cada replicação** (é idempotente).

`anon`, `authenticated` e `service_role` continuam aparecendo no código, e
continuam certas: ali são **claim de sessão**, não role do banco. A distinção
vale a pena guardar, porque a mesma palavra significa duas coisas:

| Onde aparece | O que é | Ainda existe? |
|---|---|---|
| `grant ... to authenticated` | role do Postgres | não — removida do cluster |
| `RpcRole` em `rpc-permissions.ts` | rótulo de aplicação | sim |
| `sigav.fc_papel_sessao() = 'authenticated'` | claim em `request.jwt.claims` | sim |

Consequência prática para quem escreve migration: **nenhum `grant` ou `revoke`
precisa nomear role**. Objetos novos criados pela `migration_user` já nascem
acessíveis à `app_user` (via `alter default privileges`); tabela nova precisa
apenas da policy `pl_app_user_acesso_total`, no padrão do script de separação.
Quem pode chamar cada RPC está em `src/lib/db/rpc-permissions.ts`.
`revoke ... from public` continua válido — PUBLIC não é role, é a ausência de
restrição. `npm run db:migrations` recusa migration nova que use um dos nomes
removidos como identificador.

Na instância compartilhada da empresa, a credencial da aplicação não tem
CREATEROLE: a migration retira todo privilégio das roles legadas e o
`DROP ROLE` fica para quem tem o privilégio, com
`scripts/remover-roles-legadas-do-cluster.sql` (relatório por padrão;
`-v aplicar=1` para agir). O invariante 8 de
`database/tests/invariantes_schema.sql` falha se alguma role fora da
arquitetura tiver privilégio em `sigav`, exige que `app_user` não possua objeto
nem tenha CREATE, e avisa enquanto restar role legada no catálogo.

## Fonte de verdade

- `sigav.platform_modules` cataloga as permissões disponíveis;
- `sigav.person_module_permissions` registra concessões por pessoa;
- `sigav.effective_platform_modules(person_id)` calcula as permissões efetivas;
- `sigav.has_platform_module(module_code)` protege RPCs e regras de domínio;
- `sigav.fc_obter_contexto_plataforma()` entrega `technicalRole = authenticated`
  e a lista efetiva em `modules`;
- `src/lib/platform-access-presets.ts` contém os presets funcionais da interface.

`sigav.system_roles`, `sigav.person_role_assignments` e
`sigav.role_module_permissions` **não existem mais**: a migration de 28/08
encerrou as atribuições vigentes e esvaziou os pacotes por role, e
`20260828150000_remover_perfis_legados_do_banco.sql` removeu as três tabelas e
as duas funções órfãs que ainda as liam (`fc_definir_perfil_pessoa` e
`list_access_workspace`, nenhuma alcançável pelo adaptador).

O histórico não se perdeu. As 144 atribuições e as descrições dos cinco perfis
foram arquivadas em `sigav.audit_events`, no formato que os eventos
`ROLE_GRANTED` já usavam:

| Evento | O que guarda |
|---|---|
| `ROLE_LEGACY_ARCHIVED` | uma linha por atribuição, com pessoa, perfil e período — desnormalizado, para continuar legível sem as tabelas de origem |
| `ROLE_MODEL_TABLES_REMOVED` | o catálogo dos cinco perfis e as contagens do que saiu |

Foi para `audit_events` e não para um CSV porque as linhas têm nome, e-mail e
matrícula de pessoas reais: na tabela de auditoria ficam sob o mesmo dono e o
mesmo regime de acesso do resto, e viajam em qualquer cópia do banco. O
rollback comentado no fim daquela migration reconstrói as tabelas a partir
desses eventos.

A migration aborta se encontrar atribuição vigente em
`person_role_assignments` — nesse caso ela estaria apagando autorização viva, o
que é defeito e não limpeza.

## Permissões

| Código | Finalidade |
|---|---|
| `HOME` | Visão geral; obrigatória |
| `SURVEYS` | Catálogo e respostas; obrigatória |
| `DASHBOARDS` | Painéis e indicadores |
| `TEAM` | Minha equipe e avaliação de liderados |
| `ONLINE_PRESENCE` | Ver nomes e fotos de pessoas conectadas |
| `ADMIN_SURVEYS` | Criar pesquisas e operar ciclos |
| `ADMIN_PARTICIPANTS` | Administrar participantes |
| `ADMIN_TEAMS` | Administrar equipes, lideranças e respostas excepcionais |
| `ADMIN_ACCESS` | Configurações, acessos e permissões |
| `ADMIN_IMPORT` | Importações administrativas |

Pessoas novas recebem `HOME` e `SURVEYS`. As demais permissões são negadas até
serem concedidas. A tela não permite retirar as duas permissões obrigatórias.

## Presets da interface

Os presets são conveniência operacional e aplicam uma lista inteira:

| Preset | Permissões preenchidas |
|---|---|
| Superadmin | todas |
| Admin | `HOME`, `SURVEYS`, `DASHBOARDS`, `ONLINE_PRESENCE`, `ADMIN_SURVEYS`, `ADMIN_PARTICIPANTS` |
| Gestor | `HOME`, `SURVEYS`, `DASHBOARDS`, `TEAM` |
| Avaliador | `HOME`, `SURVEYS`, `TEAM` |
| Participante | `HOME`, `SURVEYS` |

Depois de aplicar um preset, qualquer permissão pode ser ajustada
individualmente. Se a combinação não corresponder exatamente a um preset, a
interface mostra “Personalizado”. Nenhuma RPC consulta o preset selecionado.

## Proteções administrativas

`sigav.fc_definir_permissoes_pessoa` substitui o conjunto inteiro em uma única
transação e:

1. exige sessão `authenticated` com `ADMIN_ACCESS`;
2. rejeita códigos desconhecidos;
3. sempre inclui `HOME` e `SURVEYS`;
4. impede a pessoa de retirar o próprio `ADMIN_ACCESS`;
5. impede a remoção do último administrador de acessos;
6. registra antes e depois em `sigav.audit_events`.

## Compatibilidade com RPCs antigas

Há funções históricas que ainda chamam `has_active_role()`,
`can_manage_surveys()` ou `is_platform_administrator()`. Seus nomes foram
preservados para evitar uma reescrita arriscada do histórico, mas os corpos agora
traduzem a chamada para `has_platform_module()` e nunca consultam atribuições de
role.

Para código novo, use diretamente a permissão correspondente:

```sql
if not sigav.has_platform_module('ADMIN_TEAMS') then
  raise exception 'Acesso não autorizado.' using errcode = '42501';
end if;
```

## Deploy e verificação

Antes do deploy, confirme backup e execute:

```bash
npm run db:migrations
node --env-file=.env.local scripts/aplicar-migrations.mjs
```

A remoção das roles é o passo seguinte, e é de cluster:

```bash
# relatório: diz o que ainda segura cada role, e em qual banco
docker exec -i agsus-local psql -U postgres -d db_dataware   < scripts/remover-roles-legadas-do-cluster.sql

# aplicar (exige CREATEROLE; no db_dataware da empresa é o DBA que roda)
docker exec -i agsus-local psql -U postgres -d db_dataware -v aplicar=1   -v ON_ERROR_STOP=1 < scripts/remover-roles-legadas-do-cluster.sql
```

Depois de aplicar a migration em uma réplica, valide:

1. os acessos anteriores foram preservados em `person_module_permissions`;
2. não existe atribuição funcional vigente em `person_role_assignments`;
3. o contexto devolve somente `AUTHENTICATED` em `roles` e permissões em `modules`;
4. presets apenas alteram permissões;
5. uma pessoa não remove o próprio `ADMIN_ACCESS`;
6. o último administrador não pode ser removido;
7. `ONLINE_PRESENCE` controla a consulta da lista de presença;
8. acesso direto a uma RPC continua sendo recusado pelo banco quando falta a
   permissão.

O rollback precisa restaurar pacotes e atribuições a partir do backup ou da
auditoria. As linhas de `person_module_permissions` preservam a fotografia do
acesso anterior e podem ser usadas para reconstruir presets, mas não recriam
sozinhas os períodos históricos das atribuições.
