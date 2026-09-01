-- Colunas no padrão institucional — LOTE 1.
--
--   item 7 — prefixo semântico por natureza do dado (CO_, SQ_, DT_, DS_, NO_,
--            NU_, QT_, ST_, TP_, AU_ …);
--   item 3 — MAIÚSCULAS, português, no máximo 30 caracteres.
--
-- POR QUE EM LOTES: corpo de PL/pgSQL resolve identificador em execução, então
-- referência errada a coluna não falha ao criar a função — falha em produção,
-- no caminho que ninguém exercitou. A suíte cobre 24 das 174 funções e
-- `plpgsql_check` não está disponível neste cluster. Este lote é o mais seguro
-- que existe: NENHUMA função de `sigav` referencia estas 6 tabelas.
--
-- VOCABULÁRIO, herdado das 108 colunas que o projeto já havia padronizado:
--   `id` e FK uuid    -> SQ_<entidade>      (como `sq_pessoa`, `sq_aplicacao`)
--   `created_at`      -> DT_INCLUSAO        \ par com AU_USUARIO_INCLUSAO e
--   `updated_at`      -> DT_ALTERACAO       / AU_USUARIO_ALTERACAO (item 7)
--   `*_by` (autoria)  -> AU_USUARIO_<ato>
--   `jsonb`           -> DS_                (como `tl_erro_aplicacao.ds_contexto`)
--
-- As constraints e os índices são renomeados junto: o nome deles aponta a
-- coluna, e `CK_OCORR_IMP_ROW_NUMBER` sobre uma coluna hoje chamada
-- `NU_LINHA` seria a mesma incoerência que este trabalho vem eliminar.
--
-- 67 colunas, 32 constraints, 13 índices.

begin;

-- ---------------------------------------------------------------------------
-- 1. Colunas (item 7)
-- ---------------------------------------------------------------------------

-- TB_CATALOGO_OBJETO
alter table sigav."TB_CATALOGO_OBJETO" rename column sq_catalogo to "SQ_CATALOGO";
alter table sigav."TB_CATALOGO_OBJETO" rename column sg_schema_atual to "SG_SCHEMA_ATUAL";
alter table sigav."TB_CATALOGO_OBJETO" rename column no_objeto_atual to "NO_OBJETO_ATUAL";
alter table sigav."TB_CATALOGO_OBJETO" rename column tp_objeto to "TP_OBJETO";
alter table sigav."TB_CATALOGO_OBJETO" rename column no_objeto_proposto to "NO_OBJETO_PROPOSTO";
alter table sigav."TB_CATALOGO_OBJETO" rename column st_conformidade to "ST_CONFORMIDADE";
alter table sigav."TB_CATALOGO_OBJETO" rename column ds_justificativa to "DS_JUSTIFICATIVA";
alter table sigav."TB_CATALOGO_OBJETO" rename column ds_estrategia_migracao to "DS_ESTRATEGIA_MIGRACAO";
alter table sigav."TB_CATALOGO_OBJETO" rename column st_registro_ativo to "ST_REGISTRO_ATIVO";
alter table sigav."TB_CATALOGO_OBJETO" rename column au_usuario_inclusao to "AU_USUARIO_INCLUSAO";
alter table sigav."TB_CATALOGO_OBJETO" rename column dt_inclusao to "DT_INCLUSAO";
alter table sigav."TB_CATALOGO_OBJETO" rename column au_usuario_alteracao to "AU_USUARIO_ALTERACAO";
alter table sigav."TB_CATALOGO_OBJETO" rename column dt_alteracao to "DT_ALTERACAO";

-- TB_CORRECAO_VINCULO_CDDI
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename column id to "SQ_CORRECAO";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename column application_id to "SQ_APLICACAO";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename column requester_person_id to "SQ_PESSOA_SOLICITANTE";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename column current_leader_person_id to "SQ_LIDER_ATUAL";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename column proposed_leader_person_id to "SQ_LIDER_PROPOSTO";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename column justification to "DS_JUSTIFICATIVA";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename column status to "ST_SITUACAO";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename column analyzed_by to "AU_USUARIO_ANALISE";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename column analyzed_at to "DT_ANALISE";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename column admin_notes to "DS_OBSERVACAO_ADMIN";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename column source_key to "CO_ORIGEM";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename column created_at to "DT_INCLUSAO";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename column updated_at to "DT_ALTERACAO";

-- TB_LOTE_IMPORTACAO
alter table sigav."TB_LOTE_IMPORTACAO" rename column id to "SQ_LOTE";
alter table sigav."TB_LOTE_IMPORTACAO" rename column source_name to "NO_ORIGEM";
alter table sigav."TB_LOTE_IMPORTACAO" rename column source_file_id to "CO_ARQUIVO_ORIGEM";
alter table sigav."TB_LOTE_IMPORTACAO" rename column source_version to "CO_VERSAO_ORIGEM";
alter table sigav."TB_LOTE_IMPORTACAO" rename column entity_type to "TP_ENTIDADE";
alter table sigav."TB_LOTE_IMPORTACAO" rename column status to "ST_SITUACAO";
alter table sigav."TB_LOTE_IMPORTACAO" rename column received_rows to "QT_LINHA_RECEBIDA";
alter table sigav."TB_LOTE_IMPORTACAO" rename column accepted_rows to "QT_LINHA_ACEITA";
alter table sigav."TB_LOTE_IMPORTACAO" rename column rejected_rows to "QT_LINHA_REJEITADA";
alter table sigav."TB_LOTE_IMPORTACAO" rename column warning_rows to "QT_LINHA_ALERTA";
alter table sigav."TB_LOTE_IMPORTACAO" rename column checksum to "CO_VERIFICACAO";
alter table sigav."TB_LOTE_IMPORTACAO" rename column executed_by to "AU_USUARIO_EXECUCAO";
alter table sigav."TB_LOTE_IMPORTACAO" rename column started_at to "DT_INICIO";
alter table sigav."TB_LOTE_IMPORTACAO" rename column completed_at to "DT_CONCLUSAO";
alter table sigav."TB_LOTE_IMPORTACAO" rename column metadata to "DS_METADADO";

-- TB_OCORRENCIA_IMPORTACAO
alter table sigav."TB_OCORRENCIA_IMPORTACAO" rename column id to "SQ_OCORRENCIA";
alter table sigav."TB_OCORRENCIA_IMPORTACAO" rename column batch_id to "SQ_LOTE";
alter table sigav."TB_OCORRENCIA_IMPORTACAO" rename column row_number to "NU_LINHA";
alter table sigav."TB_OCORRENCIA_IMPORTACAO" rename column entity_key to "CO_ENTIDADE";
alter table sigav."TB_OCORRENCIA_IMPORTACAO" rename column severity to "TP_SEVERIDADE";
alter table sigav."TB_OCORRENCIA_IMPORTACAO" rename column issue_code to "CO_OCORRENCIA";
alter table sigav."TB_OCORRENCIA_IMPORTACAO" rename column message to "DS_MENSAGEM";
alter table sigav."TB_OCORRENCIA_IMPORTACAO" rename column payload to "DS_CONTEUDO";
alter table sigav."TB_OCORRENCIA_IMPORTACAO" rename column resolved_at to "DT_RESOLUCAO";
alter table sigav."TB_OCORRENCIA_IMPORTACAO" rename column resolved_by to "AU_USUARIO_RESOLUCAO";
alter table sigav."TB_OCORRENCIA_IMPORTACAO" rename column created_at to "DT_INCLUSAO";

-- TB_PREFERENCIA_USUARIO
alter table sigav."TB_PREFERENCIA_USUARIO" rename column id to "SQ_PREFERENCIA";
alter table sigav."TB_PREFERENCIA_USUARIO" rename column person_id to "SQ_PESSOA";
alter table sigav."TB_PREFERENCIA_USUARIO" rename column preference_key to "CO_PREFERENCIA";
alter table sigav."TB_PREFERENCIA_USUARIO" rename column preference_value to "DS_VALOR";
alter table sigav."TB_PREFERENCIA_USUARIO" rename column created_at to "DT_INCLUSAO";
alter table sigav."TB_PREFERENCIA_USUARIO" rename column updated_at to "DT_ALTERACAO";

-- TB_UNIDADE_ORGANIZACIONAL
alter table sigav."TB_UNIDADE_ORGANIZACIONAL" rename column id to "SQ_UNIDADE";
alter table sigav."TB_UNIDADE_ORGANIZACIONAL" rename column parent_id to "SQ_UNIDADE_PAI";
alter table sigav."TB_UNIDADE_ORGANIZACIONAL" rename column code to "CO_UNIDADE";
alter table sigav."TB_UNIDADE_ORGANIZACIONAL" rename column name to "NO_UNIDADE";
alter table sigav."TB_UNIDADE_ORGANIZACIONAL" rename column unit_type to "TP_UNIDADE";
alter table sigav."TB_UNIDADE_ORGANIZACIONAL" rename column active to "ST_ATIVO";
alter table sigav."TB_UNIDADE_ORGANIZACIONAL" rename column metadata to "DS_METADADO";
alter table sigav."TB_UNIDADE_ORGANIZACIONAL" rename column created_at to "DT_INCLUSAO";
alter table sigav."TB_UNIDADE_ORGANIZACIONAL" rename column updated_at to "DT_ALTERACAO";

-- ---------------------------------------------------------------------------
-- 2. Constraints e índices, realinhados à coluna nova (item 8)
-- ---------------------------------------------------------------------------

alter table sigav."TB_CATALOGO_OBJETO" rename constraint "CK_CATALOGO_OBJ_ATIVO" to "CK_CATALOGO_OBJ_ST_REGIS_ATIVO";
alter table sigav."TB_CATALOGO_OBJETO" rename constraint "CK_CATALOGO_OBJ_PROPOSTO" to "CK_CATALOGO_OBJ_NO_OBJET_PROPO";
alter table sigav."TB_CATALOGO_OBJETO" rename constraint "CK_CATALOGO_OBJ_STATUS" to "CK_CATALOGO_OBJ_ST_CONFORMI";
alter table sigav."TB_CATALOGO_OBJETO" rename constraint "UK_CATALOGO_OBJ_ATUAL" to "UK_CATALOGO_OBJ_SG_SCHEM_ATUAL";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename constraint "CK_CORR_VINC_CDDI_ANALYS_VALID" to "CK_COR_VIN_CDD_ST_SITU_DT_ANAL";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename constraint "CK_CORR_VINC_CDDI_JUS_NOT_BLA" to "CK_CORR_VINC_CDDI_DS_JUSTIFIC";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename constraint "CK_CORR_VINC_CDDI_PEOPL_DIFFE" to "CK_CORR_VINC_CDDI_SQ_PESS_SOLI";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename constraint "CK_CORR_VINC_CDDI_STATUS_VALID" to "CK_CORR_VINC_CDDI_ST_SITUACAO";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename constraint "FK_PESSOA_CORR_VINC_CDDI_CURRE" to "FK_PES_COR_VIN_CDD_LIDER_ATUAL";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename constraint "FK_PESSOA_CORR_VINC_CDDI_PROPO" to "FK_PES_COR_VIN_CDD_LIDER_PROPO";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename constraint "FK_PESSOA_CORR_VINC_CDDI_REQUE" to "FK_PES_COR_VIN_CDD_PESSO_SOLIC";
alter table sigav."TB_CORRECAO_VINCULO_CDDI" rename constraint "UK_CORR_VINC_CDDI_SOURCE" to "UK_COR_VIN_CDD_SQ_APLI_CO_ORIG";
alter table sigav."TB_LOTE_IMPORTACAO" rename constraint "CK_LOTE_IMP_COUNTS_VALID" to "CK_LOTE_IMP_QT_LINHA_RECEBIDA";
alter table sigav."TB_LOTE_IMPORTACAO" rename constraint "CK_LOTE_IMP_STATUS_VALID" to "CK_LOTE_IMP_ST_SITUACAO";
alter table sigav."TB_OCORRENCIA_IMPORTACAO" rename constraint "CK_OCORR_IMP_ROW_VALID" to "CK_OCORR_IMP_NU_LINHA";
alter table sigav."TB_OCORRENCIA_IMPORTACAO" rename constraint "CK_OCORR_IMP_SEVERITY_VALID" to "CK_OCORR_IMP_TP_SEVERIDADE";
alter table sigav."TB_PREFERENCIA_USUARIO" rename constraint "UK_PREF_USU_UNIQUE" to "UK_PREF_USU_SQ_PESSO_CO_PREFE";
alter table sigav."TB_UNIDADE_ORGANIZACIONAL" rename constraint "CK_UNID_ORG_CODE_NOT_BLANK" to "CK_UNID_ORG_CO_UNIDADE";
alter table sigav."TB_UNIDADE_ORGANIZACIONAL" rename constraint "CK_UNID_ORG_NAME_NOT_BLANK" to "CK_UNID_ORG_NO_UNIDADE";

alter index sigav."IN_CATALOGO_OBJ_STATUS" rename to "IN_CATALOGO_OBJ_ST_CONFORMI";
alter index sigav."IN_CATALOGO_OBJ_TIPO" rename to "IN_CATALOGO_OBJ_TP_OBJETO";
alter index sigav."IN_CORR_VINC_CDDI_REQUESTER" rename to "IN_CORR_VINC_CDDI_SQ_APLICACAO";
alter index sigav."IN_FK_CORR_VINC_CDDI_ANALYZ_BY" rename to "IN_FK_COR_VIN_CDD_AU_USUA_ANAL";
alter index sigav."IN_FK_CORR_VINC_CDDI_CURR_LEAD" rename to "IN_FK_COR_VIN_CDD_SQ_LIDE_ATUA";
alter index sigav."IN_FK_CORR_VINC_CDDI_PROP_LEAD" rename to "IN_FK_COR_VIN_CDD_SQ_LIDE_PROP";
alter index sigav."IN_FK_COR_VIN_CDD_REQU_PERS_ID" rename to "IN_FK_COR_VIN_CDD_SQ_PESS_SOLI";
alter index sigav."IN_FK_LOTE_IMP_EXECUTED_BY" rename to "IN_FK_LOTE_IMP_AU_USUAR_EXECU";
alter index sigav."IN_FK_OCORR_IMP_RESOLVED_BY" rename to "IN_FK_OCORR_IMP_AU_USUAR_RESOL";
alter index sigav."IN_OCORR_IMP_BATCH" rename to "IN_OCORR_IMP_SQ_LOTE_TP_SEVERI";
alter index sigav."IN_OCORR_IMP_ENTITY" rename to "IN_OCORR_IMP_CO_ENTIDADE";
alter index sigav."IN_FK_UNID_ORG_PARENT" rename to "IN_FK_UNID_ORG_SQ_UNIDADE_PAI";
alter index sigav."UK_UNID_ORG_CODE" rename to "UK_UNID_ORG_CO_UNIDADE";


-- ---------------------------------------------------------------------------
-- 2b. Colunas da view
--
-- Coluna de view é fixada no CREATE: ela NÃO acompanha o rename da coluna da
-- tabela como o corpo da view acompanha o rename da tabela. Sem isto,
-- `VW_RESUMO_MIGRACAO` continuaria devolvendo `tp_objeto` minúsculo sobre uma
-- tabela cuja coluna já é `TP_OBJETO`.
-- ---------------------------------------------------------------------------

alter view sigav."VW_RESUMO_MIGRACAO" rename column tp_objeto to "TP_OBJETO";
alter view sigav."VW_RESUMO_MIGRACAO" rename column st_conformidade to "ST_CONFORMIDADE";
alter view sigav."VW_RESUMO_MIGRACAO" rename column qt_objeto to "QT_OBJETO";
alter view sigav."VW_RESUMO_MIGRACAO" rename column qt_objeto_ativo to "QT_OBJETO_ATIVO";
alter view sigav."VW_RESUMO_MIGRACAO" rename column dt_ultima_alteracao to "DT_ULTIMA_ALTERACAO";

-- ---------------------------------------------------------------------------
-- 3. Autoverificação
-- ---------------------------------------------------------------------------

do $verificacao$
declare
  v_tabelas text[] := array['TB_CATALOGO_OBJETO', 'TB_CORRECAO_VINCULO_CDDI', 'TB_LOTE_IMPORTACAO', 'TB_OCORRENCIA_IMPORTACAO', 'TB_PREFERENCIA_USUARIO', 'TB_UNIDADE_ORGANIZACIONAL'];
  v_fora text;
begin
  select string_agg(c.relname || '.' || a.attname, ', ' order by c.relname, a.attname) into v_fora
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
   where c.relnamespace = 'sigav'::regnamespace
     and c.relname = any(v_tabelas)
     and a.attnum > 0 and not a.attisdropped
     and (
       a.attname <> upper(a.attname)
       or a.attname !~ '^(CO|SQ|DT|HR|DS|NO|NU|QT|VL|TX|SG|ST|TP|IM|CG|AU)_'
     );
  if v_fora is not null then
    raise exception 'Colunas fora do item 7: %', v_fora;
  end if;

  -- Rede contra o esquecimento: se alguma função tocar estas tabelas com o
  -- nome antigo de coluna, a transação inteira volta atrás.
  select string_agg(distinct p.proname, ', ' order by p.proname) into v_fora
    from pg_proc p, unnest(v_tabelas) t(tabela)
   where p.pronamespace = 'sigav'::regnamespace
     and pg_get_functiondef(p.oid) ~ ('sigav\."' || t.tabela || '"');
  if v_fora is not null then
    raise exception 'Funções referenciam tabelas deste lote e precisam de revisão: %', v_fora;
  end if;

  raise notice 'nomenclatura lote 1: 67 colunas em 6 tabelas';
end
$verificacao$;

commit;
