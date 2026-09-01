-- View e sequences no padrão institucional — o que ficou de fora de
-- 20260831150000 (tabelas/constraints/índices) e 20260831160000
-- (funções/triggers/policies).
--
--   item 9 — `VW_[NOME]` para view; `SQ_[TABELA]_[COLUNA]` para sequence
--            vinculada a coluna;
--   item 3 — MAIÚSCULAS, no máximo 30 caracteres.
--
-- As duas sequences escaparam porque `alter table ... rename to` NÃO renomeia a
-- sequence de uma coluna de identidade: ela é objeto próprio, com nome gerado
-- pelo PostgreSQL na criação da tabela. Por isso ainda carregavam o nome inglês
-- (`audit_events_id_seq`) depois de a tabela já ser `"TL_EVENTO_AUDITORIA"`.
--
-- Renomear sequence de identidade não afeta o `default` da coluna: a ligação é
-- por OID, registrada em `pg_depend`, não pelo nome.
--
-- O corpo da view não precisa de reparo: view guarda árvore de parse com OID,
-- então ela já acompanhou o rename das tabelas.

begin;

alter view sigav.vw_resumo_migracao rename to "VW_RESUMO_MIGRACAO";

alter sequence sigav.audit_events_id_seq rename to "SQ_TL_EVENTO_AUDITORIA_ID";
alter sequence sigav.data_import_issues_id_seq rename to "SQ_TB_OCORRENCIA_IMPORT_ID";

do $verificacao$
declare
  v_fora text;
begin
  select string_agg(c.relname, ', ' order by c.relname) into v_fora
    from pg_class c
   where c.relnamespace = 'sigav'::regnamespace
     and c.relkind in ('v', 'm', 'S')
     and (
       c.relname <> upper(c.relname)
       or (c.relkind in ('v', 'm') and c.relname !~ '^(VW|MV)_')
       or (c.relkind = 'S' and c.relname !~ '^SQ_')
     );
  if v_fora is not null then
    raise exception 'Views/sequences fora do padrão: %', v_fora;
  end if;

  raise notice 'nomenclatura: 1 view e 2 sequences em MAIÚSCULAS';
end
$verificacao$;

commit;
