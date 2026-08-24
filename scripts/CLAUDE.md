# Módulo `scripts` — quality gates de banco

## Objetivo

Impedir que migrations fora do padrão institucional cheguem à `main`. São scripts Node.js puros (ESM, sem dependências) executados localmente e pelo CI.

## Responsabilidades

- Verificar o formato e a unicidade dos identificadores de migration.
- Verificar a nomenclatura institucional dos objetos criados por migrations **novas ou alteradas**. Objeto legado só é dispensado quando consta de `LEGACY_RESTORED_OBJECTS` (ver abaixo); migration antiga que você **alterar** passa a ser cobrada por inteiro.
- Falhar com mensagem acionável em português, apontando o arquivo, o objeto e a regra violada.

## Arquivos importantes

| Arquivo | Comando | Escopo |
|---|---|---|
| `validate-migrations.mjs` | `npm run db:migrations` | **Todas** as migrations do diretório |
| `validate-db-naming.mjs` | `npm run db:naming` | Apenas migrations diferentes de `origin/main` |
| `validate-rpc-contracts.mjs` + `dump-rpc-signatures.sql` | `npm run db:rpc` | Toda chamada `supabase.rpc(...)` de `src/`, contra o banco reconstruído |

## Fluxo interno

### `validate-migrations.mjs`

```text
lê supabase/migrations/*.sql
valida cada nome contra /^(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/
agrupa por timestamp → mais de um arquivo no mesmo = erro
diretório vazio = erro
```

Saída de sucesso: `Migrations válidas: N arquivo(s), sem timestamps duplicados.`
Em falha, define `process.exitCode = 1` (não usa `process.exit`, para permitir o flush da saída).

### `validate-db-naming.mjs`

```text
1. git diff --name-only ${DB_NAMING_BASE:-origin/main}...HEAD -- supabase/migrations
   git falhou (repo raso, sem remote) → lista vazia → sucesso silencioso
2. sem arquivos alterados → "Nenhuma nova migração SQL para validar." + exit 0
3. para cada arquivo:
   remove comentários -- e /* */
   extrai por regex: schema · tabela · view · função · índice · constraint · trigger
   extrai colunas de cada `create table` via splitTopLevelDefinitions()
4. assertName(): prefixo permitido · limite de tamanho · só [a-z0-9_]
   prefixo dispensado se LEGACY_RESTORED_OBJECTS cobrir (arquivo, tipo, nome)
5. erros → lista + "Consulte docs/database-naming-standard.md" + exit 1
```

### `validate-rpc-contracts.mjs` — a única porta que atravessa as duas camadas

```text
1. RPC_SIGNATURES ausente → avisa e sai com 0 (a porta real é o CI)
2. varre src/**/*.ts(x) atrás de `.rpc(`
   classificar(): marca cada caractere como código, texto ou comentário
   → `.rpc(` dentro de string ou comentário não conta
   → vírgula e parêntese dentro de texto não quebram a contagem de argumentos
3. resolve o nome: literal, ou `const x = cond ? "a" : "b"`
   resolve os argumentos: literal de objeto, ternário de objetos, const local,
   espalhamento (`...outroObjeto`) de const local
4. infere o papel pelo cliente (`createAdminSupabaseClient()` → `service_role`;
   demais clientes → `authenticated`)
5. confronta com pg_proc: a função existe? o conjunto de argumentos resolve
   alguma sobrecarga? o papel efetivamente usado tem EXECUTE?
6. o que não conseguiu ler, imprime
```

**Por que ela vive no job `database` e não no `application`.** Só depois de `supabase db reset` existe o esquema real que as migrations produzem. Comparar contra um retrato versionado seria comparar contra um arquivo que envelhece sozinho — exatamente o problema que a porta existe para evitar. E escrever um parser de SQL nosso obrigaria a reimplementar `create or replace`, `drop` e resolução de sobrecarga para chegar ao mesmo lugar que o PostgreSQL já calculou.

**Três falhas, um erro só.** O PostgREST devolve `Could not find the function … in the schema cache` tanto para função inexistente quanto para nome de argumento divergente — ele resolve a chamada pelo conjunto de argumentos nomeados. Por isso os dois são cobrados aqui, junto com a terceira variante, que dá 403 em vez de 404: a função existe, mas o papel do cliente (`authenticated` ou `service_role`) não tem `EXECUTE`. Nenhuma das três aparece em `typecheck`, `lint`, `test` ou `build`; o acoplamento é por string, e nenhuma dessas ferramentas lê SQL. Foi assim que a plataforma caiu em 10/08/2026.

**O que ela não lê, ela declara.** Chamada cujos argumentos vêm do retorno de uma função (`...buildSurveyAnswerPayload(...)`) não é resolvível estaticamente. Nesse caso o **nome** continua sendo conferido — é ele a falha de 10/08 — e a chamada aparece na lista "não verificáveis" da saída, com o total repetido no resumo final. Silêncio ali leria como cobertura; a lista é o que impede isso.

Literal de expressão regular **não** é tratado: `/` sempre conta como divisão. Uma regex contendo aspas abriria uma string fantasma, e o arquivo terminaria com o estado aberto — é o que a checagem `integro` detecta, e o arquivo inteiro vira "não verificável" em vez de gerar acusação falsa.

**Ramos são pareados na ordem, não em produto cartesiano.** Duas chamadas do construtor escolhem função e argumentos pela mesma condição (`const rpc = modo === "create" ? "add_survey_section" : "update_survey_section"`). Cruzar todos com todos acusaria `add_survey_section` de receber os argumentos de `update_survey_section`, combinação que nenhuma execução monta.

#### `LEGACY_RESTORED_OBJECTS` — a única exceção ao prefixo

Existe uma classe de migration que **não cria objeto novo**: recria um objeto antigo que deveria existir e não existe, porque o banco divergiu do histórico de migrations (ver [../docs/operacao-permissoes.md](../docs/operacao-permissoes.md)). Aí o nome legado é requisito, não desvio — renomear deixaria o banco restaurado incompatível com o de quem aplicou a migration original.

A allowlist é deliberadamente estreita, indexada por **arquivo → tipo → nome exato**:

```js
const LEGACY_RESTORED_OBJECTS = {
  "supabase/migrations/20260810130000_restaurar_catalogo_modulos_plataforma.sql": {
    tabela: new Set(["platform_modules", …]),
    coluna: new Set(["code", "created_at", …]),
  },
};
```

Além da restauração de objeto legado, a allowlist cobre o caso vizinho de **redefinir** função legada consumida pelo nome por bundles já publicados — `20260810141000` (RPCs de avatar) e `20260811120000` (`create_survey_draft` e `manage_survey_cycle`, que ganharam a regra de período no futuro). Renomeá-las para `fc_*` derrubaria a tela que as chama antes de o frontend novo estar no ar. Note que `20260811120000` cria também `fc_excluir_pesquisa_rascunho`, que **não** consta da allowlist: objeto novo segue o padrão institucional, sempre.

Consequências de projeto, todas intencionais:

- Dispensa **só o prefixo**. Limite de tamanho e conjunto de caracteres continuam cobrados.
- Vale só naquele arquivo. Objeto novo fora do padrão **no mesmo arquivo** continua sendo rejeitado — há teste manual disso: acrescente um `create table public.x_qualquer` ao arquivo e o gate falha.
- Não aceita prefixo nem padrão, só nome exato. Não serve para afrouxar o gate em lote.

**Não acrescente entrada para contornar o gate num objeto novo.** Para objeto novo, o padrão de [../docs/database-naming-standard.md](../docs/database-naming-standard.md) é obrigatório — o caminho correto é escolher um nome conforme, não abrir exceção.

`splitTopLevelDefinitions()` é um parser manual, não regex: percorre caractere por caractere rastreando profundidade de parênteses e estado de string simples/dupla (incluindo `''` e `""` escapados) para dividir a lista de colunas apenas nas vírgulas de nível superior. Sem isso, `numeric(6,4)`, `check (status in ('A','B'))` e defaults com vírgula quebrariam a extração.

`normalize()` remove aspas e descarta o qualificador de schema (`public.tb_x` → `tb_x`), então o padrão é verificado no nome simples.

Linhas de definição que começam com `constraint`, `primary`, `foreign`, `unique`, `check`, `exclude` ou `like` são ignoradas na checagem de colunas — constraints têm regra própria.

## Interfaces públicas

Nenhuma para a aplicação. O validador RPC exporta apenas os analisadores puros
usados por `validate-rpc-contracts.test.mjs`; sua execução principal continua
restrita à invocação direta pela linha de comando.

**Contrato de saída:** código `0` em sucesso, `1` em falha; mensagens de erro em `stderr`, sucesso em `stdout`.

## Configuração

| Variável | Padrão | Efeito |
|---|---|---|
| `DB_NAMING_BASE` | `origin/main` | Referência de comparação do `git diff`. |
| `RPC_SIGNATURES` | — | Caminho do JSON de assinaturas. Ausente, `db:rpc` avisa e sai com sucesso. |

Para rodar `db:rpc` localmente contra um Supabase local já iniciado:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -t -A \
  -f scripts/dump-rpc-signatures.sql > /tmp/rpc-signatures.json
RPC_SIGNATURES=/tmp/rpc-signatures.json npm run db:rpc
```

Para validar contra outra base:

```bash
DB_NAMING_BASE=origin/develop npm run db:naming
```

## Prefixos verificados

| Objeto | Prefixos | Máximo |
|---|---|---|
| Schema | `db_`, `dbdm_` | 20 |
| Tabela | `tb_`, `rl_`, `rt_`, `tl_`, `au_`, `tm_`, `th_`, `ta_`, `bk_`, `td_`, `tf_` | 30 |
| View | `vw_`, `mv_` | 30 |
| Função | `fc_`, `sp_` | 30 |
| Índice | `in_`, `in_fk_`, `ib_`, `itm_`, `pi_` | 30 |
| Constraint | `pk_`, `fk_`, `uk_`, `ck_` | 30 |
| Trigger | `tbi_`, `tai_`, `tbu_`, `tau_`, `tbd_`, `tad_`, `tba_`, `taa_`, `tio_`, `tra_` | 30 |
| Coluna | `co_`, `sq_`, `dt_`, `hr_`, `ds_`, `no_`, `nu_`, `qt_`, `vl_`, `tx_`, `sg_`, `st_`, `tp_`, `im_`, `cg_`, `au_` | 30 |

Semântica de cada prefixo: [../docs/database-naming-standard.md](../docs/database-naming-standard.md).

## Dependências

Somente builtins do Node: `node:child_process` (`execFileSync`), `node:fs`, `node:fs/promises`, `node:path`, `node:process`. **Não adicione dependência externa** — os scripts precisam rodar antes de qualquer build.

`validate-db-naming.mjs` depende do binário `git` no PATH e de um histórico com `origin/main` disponível (o CI faz checkout com `fetch-depth: 0` justamente por isso).

## Integração com CI

[.github/workflows/validate.yml](../.github/workflows/validate.yml), dois jobs:

```text
Application validation
  npm ci → db:migrations → db:naming → test → typecheck → lint → build

Supabase migrations and RLS
  supabase start → db reset → test db → dump-rpc-signatures.sql | db:rpc
```

Os gates de banco vêm primeiro porque são os mais baratos e detectam a classe de erro mais custosa de reverter. A porta de RPC fecha o segundo job porque depende do esquema que `db reset` acabou de construir.

## Pontos de atenção

- **`db:naming` passa silenciosamente quando não há diff.** Em execução local sem `origin/main` buscado, o `git diff` falha e o script trata como "nada a validar". Isso é intencional (não travar o desenvolvimento), mas significa que **o gate real é o CI**.
- **A validação é sintática, por regex.** Não substitui revisão: não verifica RLS habilitada, políticas nomeadas, `search_path` fixo nem grants revogados. Esses requisitos são responsabilidade do revisor e do teste pgTAP em [../supabase/CLAUDE.md](../supabase/CLAUDE.md).
- Objeto legado numa migration **alterada** passa a ser cobrado. Evite tocar migrations antigas; crie uma nova. Se a migration nova precisar **restaurar** objeto legado, use `LEGACY_RESTORED_OBJECTS` em vez de ofuscar o DDL para escapar do regex.
- A extração de `create table` exige que a definição termine em `)` seguido de `;`. Formatação muito fora do padrão pode escapar da checagem de colunas — reforço para a revisão humana.
- Ao mudar um prefixo aceito, atualize os três lugares: o mapa `prefixes` do script, [../docs/database-naming-standard.md](../docs/database-naming-standard.md) e a tabela acima.
