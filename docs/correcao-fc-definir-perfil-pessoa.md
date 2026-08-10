# Correção: `fc_definir_perfil_pessoa` ausente em produção

Registro do incidente de 10/08/2026 em `/admin/acessos` e do procedimento de
correção. Complementa [operacao-permissoes.md](operacao-permissoes.md), que
descreve o modelo e o diagnóstico geral.

## Sintoma

Ao trocar o perfil de acesso de uma pessoa em `/admin/acessos`:

```text
Could not find the function public.fc_definir_perfil_pessoa(p_perfil, p_pessoa)
in the schema cache
```

Os nomes aparecem invertidos porque o PostgREST lista em ordem alfabética **os
parâmetros que recebeu**, não a assinatura do banco. O frontend envia
`p_pessoa`/`p_perfil`, que é a assinatura correta — a mensagem não indica erro
de chamada.

## Causa

O banco de produção ficou num estado intermediário: `20260810120000` removeu
`set_person_role` (item 8, `drop function`) mas a criação de
`fc_definir_perfil_pessoa` (item 7) não chegou a valer. A tela ficou sem
nenhuma função de troca de perfil.

## Como distinguir "não existe" de "sem permissão"

Sondagem somente leitura, com a chave publicável (papel `anon`). O código de
erro é o diagnóstico:

- `42501 permission denied for function …` → **a função existe**; o PostgREST a
  encontrou e só o papel `anon` não pode executá-la. É a resposta esperada para
  uma RPC saudável.
- `PGRST202 … not found in the schema cache` → **a função não existe** no banco.

```bash
set -a && . ./.env.local && set +a
for fn in fc_definir_perfil_pessoa list_access_workspace fc_obter_contexto_plataforma; do
  printf "%-32s " "$fn"
  curl -s -X POST "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/rpc/$fn" \
    -H "apikey: $NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
    -H "Content-Type: application/json" -d '{}' | head -c 120
  echo
done
```

Resultado no incidente: `list_access_workspace` e
`fc_obter_contexto_plataforma` devolveram `42501` (existem);
`fc_definir_perfil_pessoa` devolveu `PGRST202` (ausente).

## Correção

Aplicar `supabase/migrations/20260810140000_perfil_unico_por_pessoa.sql` no
banco de produção.

**Por que essa e não `20260810120000`:** a `140000` cria a versão definitiva da
função (encerra o perfil vigente **antes** de conceder o novo, ordem exigida
pelo índice de exclusividade), cria o índice `in_perfil_unico_vigente` e, no
passo 1, consolida sozinha quem ainda acumula perfil. Ela é idempotente e não
depende da `120000` ter sido aplicada por inteiro.

O arquivo é uma transação única: se qualquer passo falhar, nada é aplicado.

### Pelo editor SQL do Supabase

Cole o conteúdo do arquivo e execute. Depois registre a versão, senão o banco
continua divergindo do repositório:

```sql
insert into supabase_migrations.schema_migrations (version)
values ('20260810120000'), ('20260810140000')
on conflict (version) do nothing;
```

`20260810120000` entra na lista porque a `140000` cumpre o papel dela quanto à
função e à consolidação de perfis acumulados.

### Pelo CLI

```bash
supabase login
supabase link --project-ref <ref-do-projeto>
supabase db push
```

`db push` aplica todas as migrations pendentes e registra as versões sozinho.
Confronte antes o histórico com o esquema real (queries em
[operacao-permissoes.md](operacao-permissoes.md)) — o registro pode afirmar que
uma migration rodou sem que os objetos dela existam.

## Verificação

A migration termina com `notify pgrst, 'reload schema'`, então o cache recarrega
sozinho. Se o erro persistir por cache, force o reload pelo painel
(Settings → API → Restart server) ou repita o `notify`.

```sql
-- A função existe e tem a assinatura esperada (esperado: 1 linha, uuid, text)
select p.proname, pg_get_function_arguments(p.oid) as argumentos
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'fc_definir_perfil_pessoa';

-- O índice de exclusividade existe
select indexname from pg_indexes
where schemaname = 'public' and indexname = 'in_perfil_unico_vigente';

-- Ninguém acumula perfil (esperado: 0)
select count(*) from (
  select person_id from public.person_role_assignments
  where starts_at <= timezone('utc', now())
    and (ends_at is null or ends_at > timezone('utc', now()))
  group by person_id having count(distinct role_id) > 1
) t;
```

O teste que decide é funcional: trocar o perfil de alguém em `/admin/acessos`.

## Lição

O acoplamento entre bundle e RPC vale nos dois sentidos. O caso conhecido é
remover uma função que o frontend ainda chama; este é o inverso — a remoção da
função antiga foi aplicada, a criação da nova não, e a tela ficou sem as duas.
Ao aplicar uma migration que substitui uma RPC, **confirme que a nova existe
antes de considerar a aplicação concluída**, não apenas que o arquivo rodou sem
erro visível.
