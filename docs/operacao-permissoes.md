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

A exclusividade é garantida pelo índice parcial `in_perfil_unico_vigente` sobre
`sigav.person_role_assignments (person_id) where ends_at is null`.

Toda RPC que altera perfil deve encerrar a atribuição vigente antes de criar a
nova. `sigav.fc_definir_perfil_pessoa` já segue essa ordem e impede o Superadmin
de retirar o próprio perfil.

## Autorização de domínio

Para código novo, prefira:

```sql
if not sigav.has_platform_module('ADMIN_TEAMS') then
  raise exception 'Acesso não autorizado.';
end if;
```

Evite criar novos `if has_active_role(...)` ou `if is_platform_administrator()`
quando a regra representa acesso a uma função da plataforma e não uma capacidade
que precisa ser exclusivamente de Superadmin.

`sigav.is_platform_administrator()` continua válido para operações que realmente
administram a própria segurança da plataforma, como alterar perfis e permissões.

## Diagnóstico do banco

Nunca confie apenas em `supabase_migrations.schema_migrations`. SQL aplicado
manualmente pode alterar o esquema sem registrar versão. Confronte sempre o
histórico com os objetos reais.

```sql
select version
from supabase_migrations.schema_migrations
order by version;

select code, name, active, position
from sigav.platform_modules
order by position, code;

select sr.code as role_code,
       array_agg(rmp.module_code order by pm.position, rmp.module_code)
         filter (where rmp.allowed) as modules
from sigav.system_roles sr
left join sigav.role_module_permissions rmp on rmp.role_id = sr.id
left join sigav.platform_modules pm on pm.code = rmp.module_code
group by sr.code
order by sr.code;

select person_id, module_code, allowed, updated_at
from sigav.person_module_permissions
order by updated_at desc;
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

Não teste overrides permanentes em pessoas reais de produção sem plano de
reversão e auditoria. O PR 0B deve fornecer a operação administrativa adequada.

## Ordem de deploy do PR 0A

Este PR muda quem é a fonte de verdade do frontend. O banco de produção atual já
devolve `modules`, mas o `CASE` legado não corresponde integralmente ao mapa
vigente do frontend para Admin.

A aplicação já está configurada para usar `db.schema = "sigav"`; esta migration
não deve recriar objetos equivalentes em `public`.

Portanto a ordem segura é:

1. aplicar a migration `20260826193000_fundar_permissoes_por_modulo.sql`;
2. validar `sigav.fc_obter_contexto_plataforma()` com os quatro perfis;
3. somente então promover o frontend que passa a confiar em `context.modules`.

A migration é compatível com o frontend antigo porque o bundle antigo ignora
`context.modules` e continua derivando módulos localmente. O inverso não é seguro:
promover primeiro o frontend novo faria o Admin confiar temporariamente no mapa
legado do banco e poderia exibir `TEAM` e `ADMIN_IMPORT`.

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
