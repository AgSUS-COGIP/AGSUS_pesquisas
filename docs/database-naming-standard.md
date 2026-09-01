# Padrão institucional de nomenclatura do banco

Este projeto adota o documento **Padrão Institucional de Nomenclatura — Objetos de Banco de Dados, Lakehouse e Apache Airflow — AgSUS/PDTIC 2026–2027, versão 1.0**.

## Caixa: MAIÚSCULAS com identificador citado

O padrão institucional define nomes em MAIÚSCULAS para banco relacional (Parte I,
item 3), e é o que este projeto usa.

PostgreSQL dobra para minúscula todo identificador que não venha entre aspas.
Logo, `create table TB_PESSOA` produziria `tb_pessoa`: para o nome ser de fato
maiúsculo, o identificador precisa ser **citado**, e a citação passa a ser
obrigatória em toda referência.

```sql
select * from sigav."TB_PESSOA";   -- funciona
select * from sigav.TB_PESSOA;     -- procura tb_pessoa -> erro
```

Isso é custo permanente e conhecido: toda query, função, script e teste que
tocar numa tabela precisa das aspas. Em troca, o nome no catálogo é exatamente
o que o padrão manda.

Estado por tipo de objeto:

| Objeto | Caixa | Situação |
| --- | --- | --- |
| Tabelas (37) | `"TB_PESSOA"` | conforme |
| Constraints (195) | `"PK_TB_PESSOA"` | conforme |
| Índices (154) | `"IN_PESSOA_EMAIL_LOOKUP"` | conforme |
| Funções (174) | `"FC_PESSOA_SESSAO"` | conforme |
| Triggers (30) | `"TBU_PESSOA"` | conforme |
| Policies (37) | `"PL_APP_USER_ACESSO_TOTAL"` | conforme |
| View (1) e sequences (2) | `"VW_RESUMO_MIGRACAO"`, `"SQ_TL_EVENTO_AUDITORIA_ID"` | conforme |
| Colunas (415) | 415 conformes, 0 pendentes | conforme |

As 36 funções do pgcrypto ficam de fora: o nome pertence à extensão.

A sequence de coluna de identidade é objeto próprio e **não** acompanha o
rename da tabela — as duas do schema carregaram o nome inglês
(`audit_events_id_seq`) até `20260831170000`. Coluna de view também não
acompanha o rename da coluna da tabela; ela é fixada no `CREATE`.

### Colunas: por que foram por lote

Corpo de PL/pgSQL resolve identificador em execução. Referência errada a coluna
não falha ao criar a função — falha em produção, no caminho que ninguém
exercitou. E as duas defesas que resolveriam isso não existem aqui: a suíte
exercita 24 das 174 funções (14%), e a extensão `plpgsql_check` não está
disponível no cluster.

Pior, o texto não distingue os casos. Nos corpos, `status` aparece 458 vezes,
132 delas dentro de aspas — chave de `jsonb_build_object`, que é contrato com o
frontend. `id` aparece 1.085 vezes. Em `FC_SRV_RESOLVER_IDENT_OAUTH`, `email`,
`provider` e `provider_id` são coluna **e** chave JSON na mesma função.

Por isso cada lote foi aplicado e validado antes do seguinte, na ordem do menor
risco para o maior — medido pelo número de funções que tocam a tabela. Os cinco
primeiros lotes combinaram substituições explícitas e trocas de tokens provadas
pelo gerador. O lote final usou o escopo SQL de cada referência para reescrever
aliases, registros, gatilhos e alvos de DML sem alterar chaves JSON ou contratos
de retorno.

Concluídos:

| Lote | Migration | Tabelas | Critério |
| --- | --- | --- | --- |
| 1 | `20260831180000` | 6 | nenhuma função referencia |
| 2 | `20260831190000` | 6 | 1 ou 2 funções, revisadas linha a linha |
| 3 | `20260831210000` | 4 | 3 funções por tabela, 12 no total |
| 4 | `20260831230000` | 3 | 16 funções, duas tabelas por token e uma à mão |
| 5 | `20260831250000` | 3 | 23 funções distintas; regras por token e relação de opções à mão |
| 6 | `20260831260000` | 15 | 226 colunas e 134 funções, reescritas por escopo SQL |
| fechamento | `20260831270000` | — | remove o ramo temporário de `updated_at` do gatilho compartilhado |
| reparo | `20260831280000` | — | preserva a coluna interna `value` de `jsonb_array_elements` |
| reparo | `20260831290000` | — | aplica a mesma proteção às três RPCs restantes |

Os cabeçalhos dos arquivos dos lotes 1 e 2 dizem "NENHUMA função de `sigav`
referencia estas 6 tabelas". Vale para o lote 1; no lote 2 a frase é herdada do
gerador e está errada — aquele arquivo reescreve 8 funções, listadas nele. O
gerador passou a montar a frase a partir da contagem real; os dois arquivos
ficam como estão, porque migration aplicada não se edita.

O fechamento incluiu as tabelas de identidade do GoTrue, cujas 44 colunas
repetiam nomes entre si e colidiam com chaves JSON dos metadados OAuth. A
autoverificação da migration e `database/tests/invariantes_schema.sql` protegem
o estado final. A medição no catálogo após a aplicação encontrou 415/415
colunas conformes.

### Como cada lote é reescrito, e as três redes

Reescrever corpo de função é onde este trabalho pode quebrar produção sem avisar,
então a escrita das substituições tem duas formas e o gerador prova qual cabe:

**Trecho à mão** — o padrão. Cada substituição declara o texto exato que espera
encontrar, e a GERAÇÃO falha se não casar. É o que se usa quando o nome da coluna
é ambíguo: `status` aparece 458 vezes nos corpos, `id` 1.085, e uma parte dessas
menções é chave JSON, que é contrato com a tela.

**Por token** (`AUTO`) — para tabela, ou subconjunto de colunas, cujos nomes são
exclusivos no schema. A troca varre o corpo respeitando comentário, literal e
identificador já citado, e o arquivo gerado registra quantas ocorrências caíram
em cada coluna.
`FC_REIVINDICAR_EMAILS` sozinha teve 68 trocas em 12 colunas; transcrever isso à
mão erraria de um jeito que a revisão não pega. O gerador só aceita `AUTO`
depois de provar que (1) o nome antigo não existe em nenhuma tabela fora do lote
e (2) a função não declara parâmetro nem variável com esse nome.

**Por escopo SQL** (`AUTO_ESCOPO`) — usado no lote 6. O gerador associa cada
referência à tabela por alias de `FROM`/`JOIN`, `%rowtype`, `NEW`/`OLD`, CTE e
alvo de `INSERT`/`UPDATE`/`DELETE`. Literais, comentários, identificadores já
citados e parâmetros ficam fora da troca. Nove usos internos legítimos foram
registrados nominalmente em `SOBRAS_ACEITAS`; qualquer outra sobra interrompe a
migration.

Sobre isso, três redes no bloco de autoverificação de cada lote:

1. **Sobra** — nenhum corpo de função pode ainda mencionar o nome ANTIGO de uma
   coluna do lote, fora de comentário e de literal. Vale só para os nomes
   exclusivos das tabelas do lote; para os ambíguos, o que vale é a revisão.
   As exceções são declaradas uma a uma com o motivo (apelido de CTE, coluna de
   saída de outra função) em `SOBRAS_ACEITAS`.
2. **Função não revisada** — acusa função que toque as tabelas do lote e não
   conste da lista, contando quem escreve o nome da tabela **e** quem chega às
   colunas por gatilho.
3. **Constraint citada** — nenhuma função pode citar, em `on conflict on
   constraint`, uma constraint que não existe mais.

### O ponto cego: função de gatilho não escreve o nome da tabela

A fila de lotes foi montada contando as funções que citam `sigav."TABELA"`. Uma
função de gatilho não cita: ela chega às colunas por `new.<coluna>` e
`old.<coluna>`. Duas consequências apareceram, uma de cada lado:

* **`FC_DEFINIR_DT_ALTERACAO`**, compartilhada por 17 tabelas, ficou apontando
  para `updated_at` depois do lote 1 e derrubaria qualquer UPDATE em três
  tabelas. Reparada em `20260831200000`, agora atende os dois estados da
  nomenclatura ao mesmo tempo.
* **`FC_VALIDAR_RESULT_FINAL_CDDI`**, gatilho de TB_RESULTADO_FINAL_CDDI, valida
  a tabela inteira por `new.<coluna>` e quase ficou fora do lote 4. Foi a rede de
  sobra que a acusou.

Desde então a rede 2 acima olha os gatilhos, e a contagem de funções da fila
também.

### Duas grafias para a mesma data, e o fim disso

O padrão manda o prefixo (`DT_`) e não escolhe a palavra, e o projeto ficou com
duas: `DT_INCLUSAO`/`DT_ALTERACAO` em 14 tabelas — o par do exemplo do manual,
ao lado de `AU_USUARIO_INCLUSAO`/`AU_USUARIO_ALTERACAO` — e `DT_CRIACAO`/
`DT_ATUALIZACAO` em três. `20260831240000` fechou a divergência; hoje as datas
de auditoria de linha têm uma grafia só, verificada por invariante dentro da
própria migration.

### O gatilho compartilhado, que o lote 1 quebrou

`FC_DEFINIR_DT_ALTERACAO` atribui a coluna de data de alteração e serve **17
tabelas**. O lote 1 renomeou `updated_at` para `DT_ALTERACAO` em três delas, e o
corpo do gatilho continuou apontando para `updated_at`: `create or replace` não
reclama, a migration aplica limpa, a suíte passa — e o primeiro `UPDATE` em
produção morre com `record "new" has no field "updated_at"`. O defeito ficou
três lotes escondido.

`20260831200000` reparou temporariamente: o gatilho passou a testar
`to_jsonb(new) ? 'DT_ALTERACAO'` para atender os dois estados da nomenclatura.
Depois da última tabela, `20260831270000` removeu essa compatibilidade; o corpo
agora atribui somente `new."DT_ALTERACAO"`.

O **invariante 10** (`database/tests/invariantes_schema.sql`) passou a cobrir a
classe inteira: nenhum gatilho pode citar `new.X`/`old.X` que a tabela não
tenha. Quem ramifica por `tg_table_name` ou testa a existência do campo é
avaliado pelo que importa ali — que a tabela case com algum ramo vivo.

### A constraint citada pelo nome antigo

`20260831150000` renomeou a constraint `uk_tb_arquivo_caminho` para
`"UK_ARQUIVO_CAMINHO"` e, mais abaixo no MESMO arquivo, recriou `FC_ARQ_GRAVAR`
com o corpo antigo — que ainda dizia `on conflict on constraint
uk_tb_arquivo_caminho`. O gerador daquela migration trocava referência a tabela
nos corpos; nome de constraint não estava no seu alcance. Sem aspas o PostgreSQL
dobra para minúscula, e não existe mais constraint minúscula no schema.

Quebrava a gravação da marca da plataforma e das capas de pesquisa. Reparado em
`20260831220000`, coberto pelo **invariante 11** e pela rede 3 de cada lote.
`UK_ARQUIVO_CAMINHO` ficou pinada com esse nome no gerador, justamente para que
um lote seguinte não a renomeie e reabra o buraco.

Ao renomear coluna, portanto, verifique também: **gatilho** (função
compartilhada, resolve em execução), **coluna de saída de view** (fixada no
`CREATE`) e **sequence de identidade** (objeto próprio). Ao renomear constraint,
verifique **quem a cita pelo nome** em corpo de função e em script. Índice por
expressão, predicado de índice, corpo de view, FK e check acompanham sozinhos —
guardam árvore de parse com OID, não texto.

Os lotes são artefatos históricos e devem ser gerados contra o estado anterior
à sua aplicação. Para verificar os consumidores SQL do lote final:
`node scripts/gerar-nomenclatura-colunas.mjs 6 --verificar-consumidores`.

## Regras obrigatórias para novos objetos

### Schemas

- `DB_[NOME]` para schema de aplicação ou domínio;
- `DBDM_[NOME]` para Data Warehouse;
- máximo de 20 caracteres;
- somente letras, números e underscore.

### Tabelas

- `TB_` tabela de sistema;
- `RL_` relacionamento N:N;
- `RT_` relacionamento ternário;
- `TL_` log;
- `AU_` auditoria;
- `TM_` temporária;
- `TH_` histórico;
- `TA_` auxiliar;
- `BK_` backup;
- `TD_` dimensão;
- `TF_` fato.

Todos os nomes são no singular e têm no máximo 30 caracteres.

### Colunas

Prefixos aceitos:

- `CO_` código;
- `SQ_` identificador gerado;
- `DT_` data ou data/hora;
- `HR_` hora;
- `DS_` descrição;
- `NO_` nome;
- `NU_` número;
- `QT_` quantidade;
- `VL_` valor;
- `TX_` taxa;
- `SG_` sigla;
- `ST_` situação/status;
- `TP_` tipo;
- `IM_` imagem/binário;
- `CG_` coordenada;
- `AU_` auditoria.

### Constraints e índices

- `PK_` primary key;
- `FK_` foreign key;
- `UK_` unique;
- `CK_` check;
- `IN_` índice comum;
- `IN_FK_` índice de foreign key;
- `IB_` bitmap;
- `ITM_` textual;
- `PI_` partição.

Constraints devem ser nomeadas explicitamente. Não use `primary key`, `unique` ou foreign key anônima em uma coluna.

### Views, funções e triggers

- `VW_` view;
- `MV_` materialized view;
- `FC_` function;
- `SP_` stored procedure;
- `TBI_`, `TAI_`, `TBU_`, `TAU_`, `TBD_`, `TAD_`, `TBA_`, `TAA_`, `TIO_` para triggers;
- `TRA_` trigger de auditoria.

## Segurança PostgreSQL

Toda migração deve, no mesmo arquivo:

1. habilitar RLS em tabela de schema exposto;
2. revogar privilégios padrão;
3. conceder apenas os grants necessários;
4. nomear policies, constraints e índices;
5. fixar `search_path` de funções privilegiadas;
6. revogar `EXECUTE` de `public` quando a função for interna — o cluster tem uma role só,
   `usr_sip_app`, e nenhum `grant`/`revoke` nomeia role (ver `docs/operacao-permissoes.md`);
7. validar `sigav."FC_UID_SESSAO"()`, pessoa, papel e escopo em RPCs públicas;
8. executar Security e Performance Advisors após DDL.

## Objetos legados

Tabelas, constraints e índices foram renomeados em `20260831150000_padronizar_nomenclatura_maiuscula`; funções, triggers, policies, view, sequences e todas as 415 colunas também estão conformes. Qualquer novo objeto divergente deve ser registrado em `sigav."TB_CATALOGO_OBJETO"` com:

- nome atual;
- nome proposto;
- situação de conformidade;
- justificativa;
- estratégia de migração.

Uma futura renomeação de coluna ou função não pode ir direto a produção, porque muda o contrato do frontend. Exige:

1. inventário de dependências;
2. compatibilidade temporária;
3. atualização de RPCs e frontend;
4. validação em desenvolvimento e homologação;
5. testes de RLS, autosalvamento, envio e painéis;
6. rollback documentado;
7. aprovação por revisão técnica e Data Owner.

