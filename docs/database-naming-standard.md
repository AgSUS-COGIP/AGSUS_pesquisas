# Padrão institucional de nomenclatura do banco

Este projeto adota o documento **Padrão Institucional de Nomenclatura — Objetos de Banco de Dados, Lakehouse e Apache Airflow — AgSUS/PDTIC 2026–2027, versão 1.0**.

## Adaptação PostgreSQL

O padrão institucional define nomes em maiúsculas para banco relacional. Como o PostgreSQL converte identificadores não delimitados para minúsculas e o uso de nomes entre aspas prejudica portabilidade, PostgREST, Supabase e manutenção, este projeto usa os mesmos prefixos e a mesma semântica em minúsculas.

Exemplos:

- `TB_PESSOA` → `tb_pessoa`
- `SQ_PESSOA` → `sq_pessoa`
- `NO_PESSOA` → `no_pessoa`
- `PK_PESSOA` → `pk_tb_pessoa`

A adaptação não altera o significado, os prefixos, o singular, o limite de tamanho ou os caracteres permitidos.

## Regras obrigatórias para novos objetos

### Schemas

- `db_[nome]` para schema de aplicação ou domínio;
- `dbdm_[nome]` para Data Warehouse;
- máximo de 20 caracteres;
- somente letras, números e underscore.

### Tabelas

- `tb_` tabela de sistema;
- `rl_` relacionamento N:N;
- `rt_` relacionamento ternário;
- `tl_` log;
- `au_` auditoria;
- `tm_` temporária;
- `th_` histórico;
- `ta_` auxiliar;
- `bk_` backup;
- `td_` dimensão;
- `tf_` fato.

Todos os nomes são no singular e têm no máximo 30 caracteres.

### Colunas

Prefixos aceitos:

- `co_` código;
- `sq_` identificador gerado;
- `dt_` data ou data/hora;
- `hr_` hora;
- `ds_` descrição;
- `no_` nome;
- `nu_` número;
- `qt_` quantidade;
- `vl_` valor;
- `tx_` taxa;
- `sg_` sigla;
- `st_` situação/status;
- `tp_` tipo;
- `im_` imagem/binário;
- `cg_` coordenada;
- `au_` auditoria.

### Constraints e índices

- `pk_` primary key;
- `fk_` foreign key;
- `uk_` unique;
- `ck_` check;
- `in_` índice comum;
- `in_fk_` índice de foreign key;
- `ib_` bitmap;
- `itm_` textual;
- `pi_` partição.

Constraints devem ser nomeadas explicitamente. Não use `primary key`, `unique` ou foreign key anônima em uma coluna.

### Views, funções e triggers

- `vw_` view;
- `mv_` materialized view;
- `fc_` function;
- `sp_` stored procedure;
- `tbi_`, `tai_`, `tbu_`, `tau_`, `tbd_`, `tad_`, `tba_`, `taa_`, `tio_` para triggers;
- `tra_` trigger de auditoria.

## Segurança Supabase

Toda migração deve, no mesmo arquivo:

1. habilitar RLS em tabela de schema exposto;
2. revogar privilégios padrão;
3. conceder apenas os grants necessários;
4. nomear policies, constraints e índices;
5. fixar `search_path` de funções privilegiadas;
6. revogar `EXECUTE` de `public`, `anon` e `authenticated` quando a função for interna;
7. validar `auth.uid()`, pessoa, papel e escopo em RPCs públicas;
8. executar Security e Performance Advisors após DDL.

## Objetos legados

Os objetos atuais permanecem temporariamente com os nomes existentes para preservar compatibilidade. Cada objeto deve ser registrado em `db_governanca.tb_catalogo_objeto` com:

- nome atual;
- nome proposto;
- situação de conformidade;
- justificativa;
- estratégia de migração.

Nenhum objeto legado será renomeado diretamente em produção. A migração exige:

1. inventário de dependências;
2. compatibilidade temporária;
3. atualização de RPCs e frontend;
4. validação em desenvolvimento e homologação;
5. testes de RLS, autosalvamento, envio e painéis;
6. rollback documentado;
7. aprovação por revisão técnica e Data Owner.

