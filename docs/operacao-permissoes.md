# Operação do modelo de permissões

Este documento descreve o modelo vigente de autorização da plataforma e os
cuidados de deploy. O núcleo continua com quatro perfis mutuamente exclusivos,
mas os módulos efetivos deixam de ser hard-coded no frontend e passam a ser
calculados no PostgreSQL, no schema transacional `sigav`.

## Fonte de verdade

Desde `20260826193000_fundar_permissoes_por_modulo.sql`:

- `sigav.system_roles` contém os quatro perfis institucionais;
- `sigav.role_module_permissions` define o pacote padrão de módulos de cada perfil;
- `sigav.person_module_permissions` aplica concessão ou bloqueio individual;
- `private.effective_platform_modules(person_id)` calcula o conjunto efetivo;
- `sigav.has_platform_module(module_code)` é o helper de autorização para RPCs e RLS;
- `sigav.fc_obter_contexto_plataforma()` devolve os módulos efetivos em `modules`;
- o frontend apenas normaliza `context.modules`; ele não recalcula módulos pelo perfil.

O perfil continua sendo usado como identidade de acesso e rótulo. A permissão de
uma ação deve ser verificada pelo módulo correspondente no banco.

## Perfis e módulos padrão

| Perfil | Código interno | Módulos padrão |
|---|---|---|
| Superadmin | `ADMINISTRATOR` | todos os módulos ativos |
| Admin | `SURVEY_MANAGER` | `HOME`, `SURVEYS`, `DASHBOARDS`, `ADMIN_SURVEYS`, `ADMIN_PARTICIPANTS` |
| Avaliador | `LEADER` | `HOME`, `SURVEYS`, `TEAM` |
| Participante | `RESPONDENT` | `SURVEYS` |

O catálogo atual possui nove módulos:

`HOME`, `SURVEYS`, `DASHBOARDS`, `TEAM`, `ADMIN_SURVEYS`,
`ADMIN_PARTICIPANTS`, `ADMIN_TEAMS`, `ADMIN_ACCESS` e `ADMIN_IMPORT`.

`RESULTS` não é um módulo vigente. E-mails ainda compartilha
`ADMIN_SURVEYS`, e Respostas ainda compartilha `ADMIN_TEAMS`; a separação em
módulos próprios pertence ao PR 0B.

## Overrides individuais

`sigav.person_module_permissions` possui uma linha por pessoa e módulo:

- `allowed = true`: concede o módulo mesmo que o perfil não o possua;
- `allowed = false`: retira o módulo mesmo que o perfil o possua;
- Superadmin ignora overrides e sempre recebe todos os módulos ativos.

A interface administrativa para editar esses overrides também pertence ao PR 0B.
Até lá, a tabela pode permanecer sem registros.

## Perfis continuam exclusivos

```text
Falha ao carregar permissões da plataforma: Could not find the function
sigav.get_my_platform_context without parameters in the schema cache
```

## Autorização de domínio

Para código novo, prefira:

```sql
create or replace function sigav.get_my_platform_context()
returns jsonb language sql stable security definer
set search_path = pg_catalog, sigav, auth
as $$ select sigav.fc_obter_contexto_plataforma(); $$;

revoke all on function sigav.get_my_platform_context() from public, anon;
grant execute on function sigav.get_my_platform_context() to authenticated;
notify pgrst, 'reload schema';
```

Remova a ponte (`drop function sigav.get_my_platform_context();`) depois que o
bundle novo estiver confirmado em produção.

## Diagnóstico: em que estado está este banco?

`sigav.is_platform_administrator()` continua válido para operações que realmente
administram a própria segurança da plataforma, como alterar perfis e permissões.

## Diagnóstico do banco

Nunca confie apenas em `supabase_migrations.schema_migrations`. SQL aplicado
manualmente pode alterar o esquema sem registrar versão. Confronte sempre o
histórico com os objetos reais.

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
  ('funcao','set_person_role','PONTE desde 20260814140000 — delega a fc_definir_perfil_pessoa'),
  ('funcao','fc_definir_perfil_pessoa','20260810120000')
)
select e.tipo, e.nome, e.origem,
  case
    when e.tipo = 'tabela' then
      case when to_regclass('sigav.' || e.nome) is not null then 'existe' else 'ausente' end
    else
      case when exists (
        select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'sigav' and p.proname = e.nome
      ) then 'existe' else 'ausente' end
  end as situacao
from esperado e order by e.tipo desc, e.nome;
```

Os valores padrão esperados são:

- `ADMINISTRATOR`: todos os módulos ativos;
- `SURVEY_MANAGER`: 5 módulos;
- `LEADER`: 3 módulos;
- `RESPONDENT`: 1 módulo.

## Verificação funcional

Depois da migration, valide pelo menos:

1. Superadmin continua vendo toda a navegação;
2. Admin vê Visão geral, Avaliações, Painéis, Gerenciar avaliações e Participantes;
3. Admin não recebe Minha equipe nem Importações apenas pelo perfil;
4. Avaliador vê Visão geral, Avaliações e Minha equipe;
5. Participante vê somente Avaliações;
6. `sigav.fc_obter_contexto_plataforma()` retorna `modules` coerente com o perfil;
7. um override `allowed=true` concede um módulo a uma pessoa não-Superadmin;
8. um override `allowed=false` remove um módulo padrão;
9. `sigav.has_platform_module()` produz o mesmo resultado do contexto.

```sql
update sigav.platform_modules set name = 'Pesquisas'          where code = 'SURVEYS';
update sigav.platform_modules set name = 'Pesquisas e ciclos' where code = 'ADMIN_SURVEYS';
```

## Ordem de deploy do PR 0A

Este PR muda quem é a fonte de verdade do frontend. O banco de produção atual já
devolve `modules`, mas o `CASE` legado não corresponde integralmente ao mapa
vigente do frontend para Admin.

A aplicação já está configurada para usar `db.schema = "sigav"`; esta migration
não deve recriar objetos equivalentes em `public`.

Portanto a ordem segura é:

```sql
-- Perfis com os rótulos novos
select code, name from sigav.system_roles order by code;

-- Ninguém acumula perfil (esperado: 0)
select count(*) as pessoas_com_mais_de_um_papel from (
  select person_id from sigav.person_role_assignments
  where starts_at <= timezone('utc', now())
    and (ends_at is null or ends_at > timezone('utc', now()))
  group by person_id having count(distinct role_id) > 1
) t;

-- Mapa perfil → módulo (esperado: 10 / 7 / 3 / 1)
select sr.code, count(*) as modulos
from sigav.role_module_permissions rmp
join sigav.system_roles sr on sr.id = rmp.role_id
group by sr.code order by count(*) desc;
```

## Bundle, schema e RPC

Remover, renomear ou mover uma RPC usada por bundles já publicados pode derrubar
a plataforma. O schema da aplicação é `sigav` e deve continuar exposto na Data
API. Todos os clientes Supabase do bundle precisam usar o mesmo schema.

Quando houver substituição de função, mantenha uma ponte durante a janela de
transição e remova-a apenas após confirmar o bundle novo em produção.

O PR 0A não remove nenhuma RPC existente: ele substitui o corpo de
`sigav.fc_obter_contexto_plataforma()` preservando assinatura e contrato JSON.

## Rollback do PR 0A

O rollback precisa restaurar duas coisas em conjunto:

1. o mapa anterior em `sigav.role_module_permissions`;
2. o corpo anterior de `sigav.fc_obter_contexto_plataforma()` que derivava módulos por perfil.

O frontend novo não deve permanecer em produção se o banco for revertido para o
`CASE` legado. Em incidente, reverta primeiro o frontend para a versão que ainda
calcula módulos por perfil e depois reverta a migration.

`sigav.person_module_permissions` não é apagada pelo rollback: overrides são
dados de segurança e devem ser preservados para investigação ou restauração
controlada.
