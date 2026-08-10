# Operação do modelo de permissões

Registro operacional da consolidação dos quatro perfis (10/08/2026) e do que
aprendemos aplicando-a em produção. Serve para duas situações: aplicar o modelo
num banco novo e diagnosticar um banco que divergiu do repositório.

O modelo em si está documentado em [../supabase/CLAUDE.md](../supabase/CLAUDE.md)
(banco) e [../src/lib/CLAUDE.md](../src/lib/CLAUDE.md) (frontend). Aqui é só
operação.

## O modelo em uma tabela

| Perfil | Código interno | Módulos |
|---|---|---|
| Superadmin | `ADMINISTRATOR` | todos os 10 |
| Admin | `SURVEY_MANAGER` | `HOME`, `SURVEYS`, `DASHBOARDS`, `TEAM`, `RESULTS`, `ADMIN_SURVEYS`, `ADMIN_PARTICIPANTS` |
| Avaliador | `LEADER` | `HOME`, `SURVEYS`, `TEAM` |
| Participante | `RESPONDENT` (ou nenhum papel) | `SURVEYS` |

Perfis são **mutuamente exclusivos** e o acesso vem exclusivamente deles: não há
exceção de módulo por pessoa. `ADMIN_TEAMS`, `ADMIN_ACCESS` e `ADMIN_IMPORT` são
só do Superadmin.

## Duas armadilhas que custaram tempo

### 1. O histórico de migrations pode mentir

`supabase_migrations.schema_migrations` só registra o que passou pelo CLI ou por
push de migration. SQL aplicado direto no editor altera o banco **sem** deixar
registro. Em produção isso produziu um estado onde a tabela de histórico existia,
mas a maioria das migrations não constava — e ainda assim os objetos estavam lá.

**Nunca confie apenas no histórico.** Confronte com o esquema real (queries
abaixo). O sinal de alarme é uma migration marcada como aplicada cujos objetos
não existem, ou o contrário.

### 2. Bundle do frontend e RPC do banco são acoplados

Remover uma RPC quebra **todo bundle já publicado** que a chamava. Em 10/08 as
migrations rodaram antes do deploy do frontend, e o resultado foi a plataforma
inteira fora do ar com:

```text
Falha ao carregar permissões da plataforma: Could not find the function
public.get_my_platform_context without parameters in the schema cache
```

A causa é sempre a mesma: o JS no navegador chama uma RPC que a migration já
apagou. **A ordem correta é publicar o frontend primeiro, confirmar que está no
ar, e só então aplicar a migration que remove a RPC antiga.** Quando as duas
versões precisam coexistir, mantenha a função antiga como ponte delegando à nova:

```sql
create or replace function public.get_my_platform_context()
returns jsonb language sql stable security definer
set search_path = pg_catalog, public, auth
as $$ select public.fc_obter_contexto_plataforma(); $$;

revoke all on function public.get_my_platform_context() from public, anon;
grant execute on function public.get_my_platform_context() to authenticated;
notify pgrst, 'reload schema';
```

Remova a ponte (`drop function public.get_my_platform_context();`) depois que o
bundle novo estiver confirmado em produção.

## Diagnóstico: em que estado está este banco?

Somente leitura. Rode antes de aplicar qualquer coisa.

```sql
-- Existe registro de migrations?
select exists (
  select 1 from information_schema.tables
  where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'
) as tem_historico;

-- Quais versões constam como aplicadas
select version from supabase_migrations.schema_migrations order by version;
```

O esquema real é o que decide. Esta query diz em que ponto do histórico o banco
está, independente do registro:

```sql
with esperado(tipo, nome, origem) as (values
  ('tabela','people','20260730200000'),
  ('tabela','system_roles','20260730200000'),
  ('tabela','person_role_assignments','20260730200000'),
  ('tabela','audit_events','20260730200000'),
  ('tabela','platform_modules','20260731115500 / 20260810130000'),
  ('tabela','role_module_permissions','20260731115500 / 20260810130000'),
  ('tabela','person_module_permissions','20260731115500 / 20260810130000'),
  ('funcao','current_person_id','20260730200000'),
  ('funcao','has_active_role','20260730200000'),
  ('funcao','can_manage_surveys','20260731130000'),
  ('funcao','is_platform_administrator','20260731190000'),
  ('funcao','get_my_platform_context','REMOVIDA em 20260807150000'),
  ('funcao','fc_obter_contexto_plataforma','20260807150000'),
  ('funcao','fc_listar_ciclos_lideranca','20260807151500'),
  ('funcao','set_person_role','REMOVIDA em 20260810120000'),
  ('funcao','fc_definir_perfil_pessoa','20260810120000')
)
select e.tipo, e.nome, e.origem,
  case
    when e.tipo = 'tabela' then
      case when to_regclass('public.' || e.nome) is not null then 'existe' else 'ausente' end
    else
      case when exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public' and p.proname = e.nome
      ) then 'existe' else 'ausente' end
  end as situacao
from esperado e order by e.tipo desc, e.nome;
```

Como ler o resultado:

- `get_my_platform_context` **existe** e `fc_obter_contexto_plataforma` **ausente**
  → o banco está antes de `20260807150000`. Foi o caso de produção em 10/08.
- `set_person_role` **existe** e `fc_definir_perfil_pessoa` **ausente**
  → falta `20260810120000`.
- Falta alguma tabela do núcleo (`people`, `system_roles`…)
  → esquema base ausente; provavelmente o projeto Supabase errado.

## Aplicação num banco fora de sincronia

Ordem usada em produção em 10/08/2026, com todas as cinco migrations pendentes.
Cada arquivo é uma transação: falha reverte inteiro.

| # | Migration | Papel |
|---|---|---|
| 1 | `20260810130000_restaurar_catalogo_modulos_plataforma.sql` | Cria as 3 tabelas de módulo. **Primeiro**, senão o passo 3 falha |
| 2 | `20260807150000_simplificar_modelo_papeis.sql` | Cria `fc_obter_contexto_plataforma` — é o que destrava a aplicação |
| 3 | `20260807150500_renomear_modulo_avaliacoes.sql` | Escreve em `platform_modules` (ver ressalva) |
| 4 | `20260807151000_remover_selecao_manual_chefia.sql` | Remove duas RPCs do CDDI |
| 5 | `20260807151500_listar_ciclos_lideranca.sql` | Cria `fc_listar_ciclos_lideranca`, usada por `/equipe` |
| 6 | `20260810120000_perfis_exclusivos_quatro_papeis.sql` | Consolida os quatro perfis |

O passo 1 roda **fora da ordem cronológica de propósito**: o timestamp dele é o
mais alto, mas precisa vir antes do 3. Num `supabase db reset` isso não importa,
porque lá `20260731115500` cria as tabelas na posição original.

**Ressalva no passo 3:** ele renomeia o módulo `SURVEYS` para "Avaliações", mas a
especificação vigente chama o módulo **Pesquisas**, e é esse o rótulo da
navegação. O rótulo do banco não tem consumidor em runtime, então não quebra —
mas para manter coerência:

```sql
update public.platform_modules set name = 'Pesquisas'          where code = 'SURVEYS';
update public.platform_modules set name = 'Pesquisas e ciclos' where code = 'ADMIN_SURVEYS';
```

Depois de aplicar, registre as versões para o banco parar de divergir:

```sql
insert into supabase_migrations.schema_migrations (version)
values ('20260731115500'), ('20260807150000'), ('20260807150500'),
       ('20260807151000'), ('20260807151500'),
       ('20260810120000'), ('20260810130000')
on conflict (version) do nothing;
```

`20260731115500` entra na lista porque `20260810130000` cumpre o papel dela.

## Verificação após aplicar

```sql
-- Perfis com os rótulos novos
select code, name from public.system_roles order by code;

-- Ninguém acumula perfil (esperado: 0)
select count(*) as pessoas_com_mais_de_um_papel from (
  select person_id from public.person_role_assignments
  where starts_at <= timezone('utc', now())
    and (ends_at is null or ends_at > timezone('utc', now()))
  group by person_id having count(distinct role_id) > 1
) t;

-- Mapa perfil → módulo (esperado: 10 / 7 / 3 / 1)
select sr.code, count(*) as modulos
from public.role_module_permissions rmp
join public.system_roles sr on sr.id = rmp.role_id
group by sr.code order by count(*) desc;
```

O teste que realmente importa é funcional: fazer login (confirma
`fc_obter_contexto_plataforma`) e trocar o perfil de alguém em `/admin/acessos`
(confirma `fc_definir_perfil_pessoa`).

## Verificar qual bundle está em produção

Quando a plataforma acusa RPC inexistente, o suspeito é o bundle publicado, não o
banco. O `Age` de página estática **não** serve para julgar: `/acesso` é
pré-renderizada e fica em cache por horas mesmo após deploy novo. Compare assim:

- `/api/health` é `force-dynamic` — `Age: 0` prova que o servidor está atualizado.
- O JS é a prova real. Baixe os chunks de uma rota autenticada e procure o nome da
  RPC: se `get_my_platform_context` aparecer e `fc_obter_contexto_plataforma` não,
  o bundle é anterior à consolidação, independente do que o painel diga.

Servidor fresco com JS antigo indica **domínio apontando para deployment
antigo** — as rotas serverless respondem em qualquer build, mas HTML e JS vêm do
deployment atribuído ao alias. A correção é promover o deployment correto a
produção, não mexer no banco.

## Rollback

`20260810120000` tem o bloco de rollback comentado no fim do arquivo. Duas coisas
**não** voltam automaticamente:

- as atribuições de papel encerradas (item 2 da migration);
- as exceções de `person_module_permissions` (item 4).

Ambas ficam registradas em `audit_events` — o evento `PERSON_PROFILE_SET` guarda
os papéis anteriores em `before_data.roles`, e `ROLE_MODEL_CONSOLIDATED` registra
a consolidação. Reconstituir é manual, a partir dessa trilha.
