# Módulo `scripts` — quality gates de banco

## Objetivo

Impedir que migrations fora do padrão institucional cheguem à `main`. São scripts Node.js puros (ESM, sem dependências) executados localmente e pelo CI.

## Responsabilidades

- Verificar o formato e a unicidade dos identificadores de migration.
- Verificar a nomenclatura institucional dos objetos criados por migrations **novas ou alteradas**, sem penalizar objetos legados.
- Falhar com mensagem acionável em português, apontando o arquivo, o objeto e a regra violada.

## Arquivos importantes

| Arquivo | Comando | Escopo |
|---|---|---|
| `validate-migrations.mjs` | `npm run db:migrations` | **Todas** as migrations do diretório |
| `validate-db-naming.mjs` | `npm run db:naming` | Apenas migrations diferentes de `origin/main` |

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
5. erros → lista + "Consulte docs/database-naming-standard.md" + exit 1
```

`splitTopLevelDefinitions()` é um parser manual, não regex: percorre caractere por caractere rastreando profundidade de parênteses e estado de string simples/dupla (incluindo `''` e `""` escapados) para dividir a lista de colunas apenas nas vírgulas de nível superior. Sem isso, `numeric(6,4)`, `check (status in ('A','B'))` e defaults com vírgula quebrariam a extração.

`normalize()` remove aspas e descarta o qualificador de schema (`public.tb_x` → `tb_x`), então o padrão é verificado no nome simples.

Linhas de definição que começam com `constraint`, `primary`, `foreign`, `unique`, `check`, `exclude` ou `like` são ignoradas na checagem de colunas — constraints têm regra própria.

## Interfaces públicas

Nenhuma. São executáveis de linha de comando, não módulos importáveis.

**Contrato de saída:** código `0` em sucesso, `1` em falha; mensagens de erro em `stderr`, sucesso em `stdout`.

## Configuração

| Variável | Padrão | Efeito |
|---|---|---|
| `DB_NAMING_BASE` | `origin/main` | Referência de comparação do `git diff`. |

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

[.github/workflows/validate.yml](../.github/workflows/validate.yml), job *Application validation*, nesta ordem:

```text
npm ci → db:migrations → db:naming → test → typecheck → lint → build
```

Os gates de banco vêm primeiro porque são os mais baratos e detectam a classe de erro mais custosa de reverter.

## Pontos de atenção

- **`db:naming` passa silenciosamente quando não há diff.** Em execução local sem `origin/main` buscado, o `git diff` falha e o script trata como "nada a validar". Isso é intencional (não travar o desenvolvimento), mas significa que **o gate real é o CI**.
- **A validação é sintática, por regex.** Não substitui revisão: não verifica RLS habilitada, políticas nomeadas, `search_path` fixo nem grants revogados. Esses requisitos são responsabilidade do revisor e do teste pgTAP em [../supabase/CLAUDE.md](../supabase/CLAUDE.md).
- Objeto legado numa migration **alterada** passa a ser cobrado. Evite tocar migrations antigas; crie uma nova.
- A extração de `create table` exige que a definição termine em `)` seguido de `;`. Formatação muito fora do padrão pode escapar da checagem de colunas — reforço para a revisão humana.
- Ao mudar um prefixo aceito, atualize os três lugares: o mapa `prefixes` do script, [../docs/database-naming-standard.md](../docs/database-naming-standard.md) e a tabela acima.
