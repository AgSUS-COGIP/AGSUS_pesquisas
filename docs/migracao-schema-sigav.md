# Migração do schema `public` para `sigav`

A migration `20260826180000_migrar_schema_sigav.sql` transfere todos os objetos
da aplicação para o schema `sigav`. Os dados não são copiados nem recriados: o
PostgreSQL altera o schema dos objetos e preserva OIDs, relacionamentos,
constraints, índices, triggers, políticas RLS, grants e dependências.

Esta migration foi o primeiro passo de uma unificação que terminou em 28/08/2026
com **`sigav` como único schema da aplicação**. As etapas seguintes:

| Migration | Efeito |
|---|---|
| `20260827170000_unificar_schemas_em_sigav.sql` | Absorve `private`, `db_governanca` e `"DB_PESQUISAS"` |
| `20260827180000_remover_schema_public.sql` | Remove o `public`, já vazio |
| `20260828090000_corrigir_referencias_a_private.sql` | Conserta 4 funções que a primeira quebrou |
| `20260828100000_unificar_auth_e_extensions_em_sigav.sql` | Absorve `auth`; troca pgcrypto pelo `sha256()` nativo |
| `20260828110000_preservar_pgcrypto_em_sigav.sql` | Preserva as 36 funções do pgcrypto dentro de `sigav` e encerra `extensions` |

O quadro completo do estado final, incluindo os nomes novos das funções de
claims e das tabelas de identidade, está em
[../database/README.md](../database/README.md).

Duas operações são **condicionais**, porque o `db_dataware` é instância
compartilhada com `sip` e `sigepsi` e a aplicação não é dona de tudo. Em ambos
os casos a migration registra um aviso e segue, em vez de falhar:

- **`public`** é território comum, cujo dono é o administrador do banco.
- **pgcrypto** só pode ser transferida por quem é dono da extensão. Se lá ela
  pertencer ao administrador, `20260828110000` avisa e a deixa onde está — e
  então `extensions` também permanece.

O que pedir ao administrador da instância, se for o caso (o aviso da migration
diz exatamente qual se aplica):

```sql
alter extension pgcrypto set schema sigav;  -- preserva as funções em sigav
drop schema extensions;                     -- só depois, e se ficar vazio
drop schema public;                         -- se nenhuma outra aplicação o usa
```

Note que é `alter ... set schema`, não `drop extension`: a decisão é **preservar**
as funções do pgcrypto dentro de `sigav`, não descartá-las.

## Implantação

A mudança do banco e a publicação da aplicação devem ocorrer na mesma janela de
manutenção. `PostgreSQL db push` **não** se aplica mais: o histórico vive em
`sigav."TB_MIGRACAO"` e quem aplica é `scripts/aplicar-migrations.mjs` (a razão
está no cabeçalho daquele arquivo).

1. Ative a página de manutenção ou interrompa temporariamente o tráfego.
2. **Confirme o backup.** A absorção de `auth` remove definitivamente as tabelas
   de sessão do GoTrue, inclusive `audit_log_entries`; não há migration de volta.
3. Ensaie numa cópia do banco, que é o único teste que enxerga objetos criados
   fora do histórico de migrations:

   ```bash
   docker exec agsus-local psql -U postgres -c \
     "create database db_conferencia template db_dataware"
   ```

   Aplique as migrations na cópia, rode `database/tests/invariantes_schema.sql`
   e chame as RPCs afetadas com claims de sessão de verdade.
4. Liste o que está pendente, sem aplicar:

   ```bash
   node --env-file=.env.local scripts/aplicar-migrations.mjs
   ```

5. Aplique:

   ```bash
   node --env-file=.env.local scripts/aplicar-migrations.mjs --aplicar
   ```

   Leia os avisos. As remoções condicionais (`public`, `pgcrypto`/`extensions`)
   informam quando decidem não remover, e por quê.
6. Valide readiness, marca pública, login, catálogo, criação/edição de pesquisa,
   submissão, painéis, fila de e-mails e registro de erro antes de liberar o
   tráfego.

## Verificação no banco

```bash
docker cp database/tests/invariantes_schema.sql agsus-local:/tmp/inv.sql
docker exec agsus-local psql -U postgres -d db_dataware -v ON_ERROR_STOP=1 -f /tmp/inv.sql
```

São sete invariantes, entre eles que `sigav` é o único schema da aplicação, que
nenhum objeto cita schema removido, que toda tabela tem RLS e que o UTF-8 das
funções está íntegro. Cada migration também executa as próprias validações e
reverte a transação inteira se encontrar inconsistência.

## Ambiente local

A stack local do PostgreSQL não é mais ambiente deste projeto — ela não consegue
aplicar `20260828100000` (as tabelas de `auth` pertencem a `PostgreSQL_auth_admin`
lá) e nunca representou produção. O ambiente de desenvolvimento é a réplica em
Docker criada por `scripts/replicar-banco-local.mjs`, apontada no `.env.local`
por `EMPRESA_DATABASE_URL`.

## Retorno

Não remova `sigav` com `cascade`. Em caso de retorno, primeiro republique a
aplicação apontando para `public`; depois aplique uma nova migration que mova os
objetos de volta e reescreva os corpos e `search_path` das funções. O bloco de
rollback comentado na migration registra essa ordem.
