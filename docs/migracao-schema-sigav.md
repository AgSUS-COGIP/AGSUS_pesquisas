# Migração do schema `public` para `sigav`

A migration `20260826180000_migrar_schema_sigav.sql` transfere todos os objetos
da aplicação para o schema `sigav`. Os dados não são copiados nem recriados: o
PostgreSQL altera o schema dos objetos e preserva OIDs, relacionamentos,
constraints, índices, triggers, políticas RLS, grants e dependências.

O Auth (`auth`), o Storage (`storage`), as rotinas internas (`private`), o
catálogo de governança (`db_governanca`) e as views analíticas
(`"DB_PESQUISAS"`) permanecem em seus schemas próprios.

## Implantação

A mudança do banco e a publicação da aplicação devem ocorrer na mesma janela de
manutenção. O bundle anterior consulta `public`; o bundle novo consulta `sigav`.

1. Ative a página de manutenção ou interrompa temporariamente o tráfego.
2. Confirme o backup e confronte o catálogo real de produção com o histórico de
   migrations, seguindo `scripts/diagnostico-supabase.sql`.
3. Revise o plano sem aplicar:

   ```bash
   supabase db push --dry-run
   ```

4. Aplique a migration pelo fluxo versionado:

   ```bash
   supabase db push
   ```

5. No Dashboard do Supabase, abra **Integrations > Data API** e inclua `sigav`
   em **Exposed schemas**. `public` pode continuar exposto; ele fica vazio.
6. Publique a versão da aplicação que define `db.schema = "sigav"` em todos os
   clientes Supabase.
7. Valide readiness, marca pública, login, catálogo, criação/edição de pesquisa,
   submissão, painéis, fila de e-mails e registro de erro antes de liberar o
   tráfego.

## Verificação no banco

```sql
select count(*) as objetos_restantes
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind in ('r', 'p', 'f', 'S', 'v', 'm');

select count(*) as tabelas_sem_rls
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'sigav'
  and c.relkind in ('r', 'p')
  and not c.relrowsecurity;
```

Ambas as consultas devem retornar zero. A migration também executa essas
validações e reverte a transação inteira se encontrar inconsistência.

## Ambiente local

O arquivo local ignorado `supabase/config.toml` deve conter:

```toml
[api]
schemas = ["sigav", "graphql_public"]
extra_search_path = ["sigav", "extensions"]
```

Reinicie a stack local após mudar a configuração para que o PostgREST passe a
expor o schema novo.

## Retorno

Não remova `sigav` com `cascade`. Em caso de retorno, primeiro republique a
aplicação apontando para `public`; depois aplique uma nova migration que mova os
objetos de volta e reescreva os corpos e `search_path` das funções. O bloco de
rollback comentado na migration registra essa ordem.
