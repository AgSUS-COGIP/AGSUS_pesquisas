-- Colunas no padrão institucional — LOTE 5.
--
--   item 7 — prefixo semântico por natureza do dado (CO_, SQ_, DT_, DS_, NO_,
--            NU_, QT_, ST_, TP_, AU_ …);
--   item 3 — MAIÚSCULAS, português, no máximo 30 caracteres.
--
-- POR QUE EM LOTES: corpo de PL/pgSQL resolve identificador em execução, então
-- referência errada a coluna não falha ao criar a função — falha em produção,
-- no caminho que ninguém exercitou. A suíte cobre 24 das 174 funções e
-- `plpgsql_check` não está disponível neste cluster.
--
-- RISCO DESTE LOTE: 23 função(ões) referenciam estas 3 tabelas, e cada
-- substituição de corpo abaixo foi conferida contra a linha real. A rede está no
-- gerador (o trecho tem de casar exatamente, senão a geração falha) e no bloco de
-- autoverificação ao final, que acusa função que toque estas tabelas e não conste
-- da lista revisada.
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
-- 23 colunas, 16 constraints, 8 índices.

begin;

-- ---------------------------------------------------------------------------
-- 1. Colunas (item 7)
-- ---------------------------------------------------------------------------

-- TB_CONDICAO_REGRA
alter table sigav."TB_CONDICAO_REGRA" rename column sq_condicao to "SQ_CONDICAO";
alter table sigav."TB_CONDICAO_REGRA" rename column sq_regra to "SQ_REGRA";
alter table sigav."TB_CONDICAO_REGRA" rename column sq_pergunta_origem to "SQ_PERGUNTA_ORIGEM";
alter table sigav."TB_CONDICAO_REGRA" rename column tp_operador to "TP_OPERADOR";
alter table sigav."TB_CONDICAO_REGRA" rename column sq_opcao to "SQ_OPCAO";
alter table sigav."TB_CONDICAO_REGRA" rename column tx_valor to "DS_VALOR";
alter table sigav."TB_CONDICAO_REGRA" rename column nu_valor to "NU_VALOR";
alter table sigav."TB_CONDICAO_REGRA" rename column nu_ordem to "NU_ORDEM";

-- TB_REGRA_CONDICIONAL
alter table sigav."TB_REGRA_CONDICIONAL" rename column sq_regra to "SQ_REGRA";
alter table sigav."TB_REGRA_CONDICIONAL" rename column sq_versao_pesquisa to "SQ_VERSAO_PESQUISA";
alter table sigav."TB_REGRA_CONDICIONAL" rename column tp_alvo to "TP_ALVO";
alter table sigav."TB_REGRA_CONDICIONAL" rename column sq_alvo to "SQ_ALVO";
alter table sigav."TB_REGRA_CONDICIONAL" rename column tp_acao to "TP_ACAO";
alter table sigav."TB_REGRA_CONDICIONAL" rename column tp_conector to "TP_CONECTOR";
alter table sigav."TB_REGRA_CONDICIONAL" rename column ds_regra to "DS_REGRA";
alter table sigav."TB_REGRA_CONDICIONAL" rename column st_ativo to "ST_ATIVO";
alter table sigav."TB_REGRA_CONDICIONAL" rename column au_usuario_inclusao to "AU_USUARIO_INCLUSAO";
alter table sigav."TB_REGRA_CONDICIONAL" rename column dt_inclusao to "DT_INCLUSAO";
alter table sigav."TB_REGRA_CONDICIONAL" rename column dt_alteracao to "DT_ALTERACAO";

-- RL_RESPOSTA_OPCAO
alter table sigav."RL_RESPOSTA_OPCAO" rename column answer_id to "SQ_RESPOSTA";
alter table sigav."RL_RESPOSTA_OPCAO" rename column option_id to "SQ_OPCAO";
alter table sigav."RL_RESPOSTA_OPCAO" rename column position to "NU_ORDEM";
alter table sigav."RL_RESPOSTA_OPCAO" rename column created_at to "DT_INCLUSAO";

-- ---------------------------------------------------------------------------
-- 2. Constraints e índices, realinhados à coluna nova (item 8)
-- ---------------------------------------------------------------------------

alter table sigav."TB_CONDICAO_REGRA" rename constraint "CK_COND_REGRA_NUMERO" to "CK_COND_REGRA_TP_OPER_NU_VALO";
alter table sigav."TB_CONDICAO_REGRA" rename constraint "CK_COND_REGRA_OPCAO" to "CK_COND_REGRA_TP_OPER_SQ_OPCA";
alter table sigav."TB_CONDICAO_REGRA" rename constraint "CK_COND_REGRA_OPERADOR" to "CK_COND_REGRA_TP_OPERADOR";
alter table sigav."TB_REGRA_CONDICIONAL" rename constraint "CK_REGRA_COND_ACAO" to "CK_REGRA_COND_TP_ACAO";
alter table sigav."TB_REGRA_CONDICIONAL" rename constraint "CK_REGRA_COND_ALVO" to "CK_REGRA_COND_TP_ALVO";
alter table sigav."TB_REGRA_CONDICIONAL" rename constraint "CK_REGRA_COND_CONEC" to "CK_REGRA_COND_TP_CONECTOR";

alter index sigav."IN_FK_RESP_OPCAO_OPTION" rename to "IN_FK_RESP_OPCAO_SQ_OPCAO";
alter index sigav."UK_RESP_OPCAO_POSITION" rename to "UK_RESP_OPCAO_SQ_RESP_NU_ORDE";
alter index sigav."IN_FK_COND_REGRA_CON_REG_OPC" rename to "IN_FK_COND_REGRA_SQ_OPCAO";
alter index sigav."IN_FK_COND_REGRA_PERGUNTA" rename to "IN_FK_COND_REGRA_SQ_PERG_ORIG";
alter index sigav."IN_FK_COND_REGRA_REGRA" rename to "IN_FK_COND_REGRA_SQ_REGRA";
alter index sigav."IN_FK_REGRA_COND_COND_USUA_INC" rename to "IN_FK_REGRA_COND_AU_USUA_INCL";
alter index sigav."IN_FK_REGRA_COND_VERSAO" rename to "IN_FK_REGRA_COND_SQ_VERS_PESQ";
alter index sigav."UK_REGRA_COND_ALVO" rename to "UK_REGRA_COND_SQ_ALVO";

-- ---------------------------------------------------------------------------
-- 4. Funções que tocam estas colunas (23)
--
-- Cada substituição abaixo foi conferida contra a linha real da função. Onde o
-- nome da coluna é também chave JSON, ou pertence a outra tabela, a troca é
-- ancorada no alias — ou simplesmente não é feita.
-- ---------------------------------------------------------------------------

-- FC_ALVO_VISIVEL(p_submissao uuid, p_alvo uuid)
-- troca por token, fora de comentário e de literal: sq_alvo=1, sq_condicao=1, sq_regra=3, st_ativo=1, tp_acao=1, tp_conector=1
CREATE OR REPLACE FUNCTION sigav."FC_ALVO_VISIVEL"(p_submissao uuid, p_alvo uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_regra sigav."TB_REGRA_CONDICIONAL"%rowtype;
  v_total integer;
  v_atendidas integer;
  v_satisfeita boolean;
begin
  select * into v_regra
  from sigav."TB_REGRA_CONDICIONAL"
  where "SQ_ALVO" = p_alvo and "ST_ATIVO";

  if v_regra."SQ_REGRA" is null then
    return true;
  end if;

  select count(*)::integer,
         count(*) filter (where sigav."FC_CONDICAO_ATENDIDA"(p_submissao, "SQ_CONDICAO"))::integer
  into v_total, v_atendidas
  from sigav."TB_CONDICAO_REGRA"
  where "SQ_REGRA" = v_regra."SQ_REGRA";

  -- Regra sem condição não decide nada; deixar visível é o padrão seguro.
  if v_total = 0 then
    return true;
  end if;

  v_satisfeita := case when v_regra."TP_CONECTOR" = 'ALL' then v_atendidas = v_total else v_atendidas > 0 end;
  return case when v_regra."TP_ACAO" = 'SHOW' then v_satisfeita else not v_satisfeita end;
end;
$function$;

-- FC_CLONAR_PESQUISA_ESTRUTURA(p_pesquisa uuid, p_nome text, p_codigo text)
-- troca por token, fora de comentário e de literal: au_usuario_inclusao=1, ds_regra=2, nu_ordem=2, nu_valor=2, sq_alvo=3, sq_opcao=3, sq_pergunta_origem=3, sq_regra=4, sq_versao_pesquisa=2, st_ativo=1, tp_acao=2, tp_alvo=3, tp_conector=2, tp_operador=2, tx_valor=2
CREATE OR REPLACE FUNCTION sigav."FC_CLONAR_PESQUISA_ESTRUTURA"(p_pesquisa uuid, p_nome text DEFAULT NULL::text, p_codigo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_pessoa uuid := sigav."FC_PESSOA_SESSAO"();
  v_origem sigav."TB_PESQUISA"%rowtype;
  v_versao_origem uuid;
  v_nova_pesquisa uuid;
  v_nova_versao uuid;
  v_codigo text;
  v_nome text;
  v_sufixo integer := 1;
  v_mapa_secao jsonb := '{}'::jsonb;
  v_mapa_pergunta jsonb := '{}'::jsonb;
  v_mapa_opcao jsonb := '{}'::jsonb;
  v_secao record;
  v_pergunta record;
  v_opcao record;
  v_regra record;
  v_nova_regra uuid;
  v_alvo uuid;
  v_secoes integer := 0;
  v_perguntas integer := 0;
  v_regras integer := 0;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  select * into v_origem from sigav."TB_PESQUISA" where id = p_pesquisa;
  if v_origem.id is null then
    raise exception 'Avaliação não localizada.';
  end if;

  -- Prefere a versão publicada; sem ela, o rascunho mais recente.
  select id into v_versao_origem
  from sigav."TH_VERSAO_PESQUISA"
  where survey_id = p_pesquisa and status in ('PUBLISHED', 'DRAFT')
  order by case status when 'PUBLISHED' then 0 else 1 end, version_number desc
  limit 1;
  if v_versao_origem is null then
    raise exception 'Esta avaliação não tem versão com estrutura para copiar.';
  end if;

  v_nome := coalesce(nullif(btrim(coalesce(p_nome, '')), ''), v_origem.name || ' (cópia)');
  if length(v_nome) > 160 then
    raise exception 'O nome da cópia é longo demais.';
  end if;

  -- O código é único por constraint. Em vez de devolver erro de banco para quem
  -- clicou em "Duplicar", a função procura o primeiro sufixo livre.
  v_codigo := upper(btrim(coalesce(nullif(btrim(coalesce(p_codigo, '')), ''), v_origem.code || '-COPIA')));
  while exists (select 1 from sigav."TB_PESQUISA" where code = v_codigo) loop
    v_sufixo := v_sufixo + 1;
    v_codigo := upper(btrim(coalesce(nullif(btrim(coalesce(p_codigo, '')), ''), v_origem.code || '-COPIA'))) || '-' || v_sufixo::text;
    if v_sufixo > 50 then
      raise exception 'Não foi possível gerar um código livre para a cópia. Informe um código.';
    end if;
  end loop;

  insert into sigav."TB_PESQUISA" (code, name, description, owner_unit_id, status, settings, created_by)
  values (v_codigo, v_nome, v_origem.description, v_origem.owner_unit_id, 'DRAFT', v_origem.settings, v_pessoa)
  returning id into v_nova_pesquisa;

  insert into sigav."TH_VERSAO_PESQUISA" (survey_id, version_number, title, description, status, settings)
  select v_nova_pesquisa, 1, title, description, 'DRAFT', settings
  from sigav."TH_VERSAO_PESQUISA" where id = v_versao_origem
  returning id into v_nova_versao;

  -- Seções em duas passagens: primeiro todas sem pai, depois o vínculo, para
  -- que uma seção aninhada não precise que a pai já exista na hora da inserção.
  for v_secao in
    select * from sigav."TB_SECAO_PESQUISA" where survey_version_id = v_versao_origem order by position
  loop
    insert into sigav."TB_SECAO_PESQUISA" (survey_version_id, parent_section_id, code, title, description, position, settings)
    values (v_nova_versao, null, v_secao.code, v_secao.title, v_secao.description, v_secao.position, v_secao.settings)
    returning id into v_alvo;
    v_mapa_secao := v_mapa_secao || jsonb_build_object(v_secao.id::text, v_alvo::text);
    v_secoes := v_secoes + 1;
  end loop;

  for v_secao in
    select * from sigav."TB_SECAO_PESQUISA" where survey_version_id = v_versao_origem and parent_section_id is not null
  loop
    update sigav."TB_SECAO_PESQUISA"
    set parent_section_id = (v_mapa_secao->>v_secao.parent_section_id::text)::uuid
    where id = (v_mapa_secao->>v_secao.id::text)::uuid;
  end loop;

  for v_pergunta in
    select * from sigav."TB_PERGUNTA_PESQUISA" where survey_version_id = v_versao_origem order by position
  loop
    insert into sigav."TB_PERGUNTA_PESQUISA" (
      survey_version_id, section_id, code, title, description, question_type,
      required, position, validation, display_logic, scoring, settings
    ) values (
      v_nova_versao, (v_mapa_secao->>v_pergunta.section_id::text)::uuid, v_pergunta.code,
      v_pergunta.title, v_pergunta.description, v_pergunta.question_type,
      v_pergunta.required, v_pergunta.position, v_pergunta.validation,
      v_pergunta.display_logic, v_pergunta.scoring, v_pergunta.settings
    ) returning id into v_alvo;
    v_mapa_pergunta := v_mapa_pergunta || jsonb_build_object(v_pergunta.id::text, v_alvo::text);
    v_perguntas := v_perguntas + 1;

    for v_opcao in
      select * from sigav."TB_OPCAO_PERGUNTA" where question_id = v_pergunta.id order by position
    loop
      insert into sigav."TB_OPCAO_PERGUNTA" (question_id, code, label, value, score, position, active, metadata)
      values (v_alvo, v_opcao.code, v_opcao.label, v_opcao.value, v_opcao.score, v_opcao.position, v_opcao.active, v_opcao.metadata);
    end loop;
  end loop;

  -- O mapa de alternativas é montado numa passagem própria, pareando pelo par
  -- (pergunta, código) — que é único por constraint. Fazer isso dentro do laço
  -- acima exigiria alimentar o jsonb e o id na mesma instrução.
  for v_opcao in
    select antiga.id as id_antigo, nova.id as id_novo
    from sigav."TB_OPCAO_PERGUNTA" antiga
    join sigav."TB_PERGUNTA_PESQUISA" pergunta_antiga on pergunta_antiga.id = antiga.question_id
    join sigav."TB_OPCAO_PERGUNTA" nova
      on nova.question_id = (v_mapa_pergunta->>pergunta_antiga.id::text)::uuid
     and nova.code = antiga.code
    where pergunta_antiga.survey_version_id = v_versao_origem
  loop
    v_mapa_opcao := v_mapa_opcao || jsonb_build_object(v_opcao.id_antigo::text, v_opcao.id_novo::text);
  end loop;

  -- Regras condicionais, já apontando para os identificadores da cópia.
  for v_regra in
    select * from sigav."TB_REGRA_CONDICIONAL" where "SQ_VERSAO_PESQUISA" = v_versao_origem and "ST_ATIVO"
  loop
    v_alvo := case v_regra."TP_ALVO"
      when 'SECTION' then (v_mapa_secao->>v_regra."SQ_ALVO"::text)::uuid
      else (v_mapa_pergunta->>v_regra."SQ_ALVO"::text)::uuid
    end;
    if v_alvo is null then
      continue;
    end if;

    insert into sigav."TB_REGRA_CONDICIONAL" (
      "SQ_VERSAO_PESQUISA", "TP_ALVO", "SQ_ALVO", "TP_ACAO", "TP_CONECTOR", "DS_REGRA", "AU_USUARIO_INCLUSAO"
    ) values (
      v_nova_versao, v_regra."TP_ALVO", v_alvo, v_regra."TP_ACAO", v_regra."TP_CONECTOR", v_regra."DS_REGRA", v_pessoa
    ) returning "SQ_REGRA" into v_nova_regra;

    insert into sigav."TB_CONDICAO_REGRA" ("SQ_REGRA", "SQ_PERGUNTA_ORIGEM", "TP_OPERADOR", "SQ_OPCAO", "DS_VALOR", "NU_VALOR", "NU_ORDEM")
    select
      v_nova_regra,
      (v_mapa_pergunta->>condicao."SQ_PERGUNTA_ORIGEM"::text)::uuid,
      condicao."TP_OPERADOR",
      case when condicao."SQ_OPCAO" is null then null else (v_mapa_opcao->>condicao."SQ_OPCAO"::text)::uuid end,
      condicao."DS_VALOR", condicao."NU_VALOR", condicao."NU_ORDEM"
    from sigav."TB_CONDICAO_REGRA" condicao
    where condicao."SQ_REGRA" = v_regra."SQ_REGRA"
      and (v_mapa_pergunta->>condicao."SQ_PERGUNTA_ORIGEM"::text) is not null;

    v_regras := v_regras + 1;
  end loop;

  insert into sigav."TL_EVENTO_AUDITORIA" (actor_person_id, event_type, entity_type, entity_id, after_data, metadata)
  values (
    v_pessoa, 'SURVEY_CLONED', 'SURVEY', v_nova_pesquisa::text,
    jsonb_build_object('code', v_codigo, 'name', v_nome, 'sourceSurveyId', p_pesquisa),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'status', 'OK',
    'surveyId', v_nova_pesquisa,
    'code', v_codigo,
    'name', v_nome,
    'sections', v_secoes,
    'questions', v_perguntas,
    'rules', v_regras
  );
end;
$function$;

-- FC_CONDICAO_ATENDIDA(p_submissao uuid, p_condicao uuid)
-- troca por token, fora de comentário e de literal: nu_valor=2, sq_condicao=2, sq_opcao=1, sq_pergunta_origem=2, tp_operador=11, tx_valor=2
CREATE OR REPLACE FUNCTION sigav."FC_CONDICAO_ATENDIDA"(p_submissao uuid, p_condicao uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_condicao sigav."TB_CONDICAO_REGRA"%rowtype;
  v_resposta sigav."TB_RESPOSTA"%rowtype;
  v_respondida boolean;
  v_selecionada boolean;
begin
  select * into v_condicao from sigav."TB_CONDICAO_REGRA" where "SQ_CONDICAO" = p_condicao;
  if v_condicao."SQ_CONDICAO" is null then
    return false;
  end if;

  if not sigav."FC_PERGUNTA_VISIVEL"(p_submissao, v_condicao."SQ_PERGUNTA_ORIGEM") then
    return v_condicao."TP_OPERADOR" in ('NOT_ANSWERED', 'NOT_SELECTED');
  end if;

  select * into v_resposta
  from sigav."TB_RESPOSTA"
  where submission_id = p_submissao and question_id = v_condicao."SQ_PERGUNTA_ORIGEM";

  v_respondida := v_resposta.id is not null and (
    num_nonnulls(
      nullif(btrim(coalesce(v_resposta.answer_text, '')), ''),
      v_resposta.answer_number::text,
      v_resposta.answer_boolean::text,
      v_resposta.answer_date::text,
      v_resposta.answer_datetime::text
    ) > 0
    or exists (select 1 from sigav."RL_RESPOSTA_OPCAO" where "SQ_RESPOSTA" = v_resposta.id)
  );

  if v_condicao."TP_OPERADOR" = 'ANSWERED' then return v_respondida; end if;
  if v_condicao."TP_OPERADOR" = 'NOT_ANSWERED' then return not v_respondida; end if;
  if not v_respondida then
    -- Nenhuma comparação de valor se sustenta sobre resposta ausente.
    return v_condicao."TP_OPERADOR" = 'NOT_EQUALS' or v_condicao."TP_OPERADOR" = 'NOT_SELECTED';
  end if;

  if v_condicao."TP_OPERADOR" in ('SELECTED', 'NOT_SELECTED') then
    v_selecionada := exists (
      select 1 from sigav."RL_RESPOSTA_OPCAO"
      where "SQ_RESPOSTA" = v_resposta.id and "SQ_OPCAO" = v_condicao."SQ_OPCAO"
    );
    return case when v_condicao."TP_OPERADOR" = 'SELECTED' then v_selecionada else not v_selecionada end;
  end if;

  if v_condicao."TP_OPERADOR" = 'GREATER_THAN' then
    return v_resposta.answer_number is not null and v_resposta.answer_number > v_condicao."NU_VALOR";
  end if;
  if v_condicao."TP_OPERADOR" = 'LESS_THAN' then
    return v_resposta.answer_number is not null and v_resposta.answer_number < v_condicao."NU_VALOR";
  end if;
  if v_condicao."TP_OPERADOR" = 'CONTAINS' then
    return position(lower(coalesce(v_condicao."DS_VALOR", '')) in lower(coalesce(v_resposta.answer_text, ''))) > 0;
  end if;

  -- EQUALS e NOT_EQUALS comparam a representação textual do valor gravado, para
  -- que a mesma regra sirva a texto, número, data e booleano sem multiplicar
  -- operadores por tipo.
  --
  -- `trim_scale` existe aqui por causa da paridade com o avaliador do frontend:
  -- a coluna é `numeric(18,6)`, então `5::text` sai como '5.000000' e nunca
  -- casaria com o '5' que o operador digitou nem com o `String(5)` do JavaScript.
  -- Divergência entre os dois avaliadores é pior que regra que não casa: a tela
  -- mostraria uma pergunta que o banco considera escondida.
  --
  -- DATETIME é a exceção conhecida: o banco serializa com fuso
  -- ('2026-08-13 12:00:00+00') e o input `datetime-local` não. Comparação de
  -- igualdade em DATETIME não é confiável nos dois lados — use ANSWERED,
  -- GREATER_THAN ou LESS_THAN.
  v_selecionada := lower(btrim(coalesce(
    v_resposta.answer_text,
    trim_scale(v_resposta.answer_number)::text,
    v_resposta.answer_boolean::text,
    v_resposta.answer_date::text,
    v_resposta.answer_datetime::text,
    ''
  ))) = lower(btrim(coalesce(v_condicao."DS_VALOR", '')));
  return case when v_condicao."TP_OPERADOR" = 'EQUALS' then v_selecionada else not v_selecionada end;
end;
$function$;

-- FC_CRIAR_NOVA_VERSAO_PESQUISA(p_pesquisa uuid)
-- troca por token, fora de comentário e de literal: au_usuario_inclusao=1, ds_regra=2, nu_ordem=2, nu_valor=2, sq_alvo=3, sq_opcao=3, sq_pergunta_origem=3, sq_regra=4, sq_versao_pesquisa=2, st_ativo=1, tp_acao=2, tp_alvo=3, tp_conector=2, tp_operador=2, tx_valor=2
CREATE OR REPLACE FUNCTION sigav."FC_CRIAR_NOVA_VERSAO_PESQUISA"(p_pesquisa uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_pessoa uuid := sigav."FC_PESSOA_SESSAO"();
  v_pesquisa sigav."TB_PESQUISA"%rowtype;
  v_versao_origem sigav."TH_VERSAO_PESQUISA"%rowtype;
  v_aplicacao_origem sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_nova_versao uuid;
  v_novo_numero integer;
  v_nova_aplicacao uuid;
  v_novo_codigo_aplicacao text;
  v_mapa_secao jsonb := '{}'::jsonb;
  v_mapa_pergunta jsonb := '{}'::jsonb;
  v_mapa_opcao jsonb := '{}'::jsonb;
  v_secao record;
  v_pergunta record;
  v_opcao record;
  v_regra record;
  v_nova_regra uuid;
  v_alvo uuid;
  v_secoes integer := 0;
  v_perguntas integer := 0;
  v_regras integer := 0;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  select * into v_pesquisa from sigav."TB_PESQUISA" where id = p_pesquisa for update;
  if v_pesquisa.id is null then
    raise exception 'Avaliação não encontrada.';
  end if;

  if v_pesquisa.dt_arquivamento is not null then
    raise exception 'Esta avaliação está arquivada. Restaure-a antes de criar uma nova versão.';
  end if;

  select * into v_versao_origem
  from sigav."TH_VERSAO_PESQUISA"
  where survey_id = p_pesquisa
  order by version_number desc
  limit 1
  for update;
  if v_versao_origem.id is null then
    raise exception 'Versão da pesquisa não encontrada.';
  end if;

  -- Cobre, com a mesma mensagem, tanto "nunca foi publicada" quanto "já existe
  -- um rascunho mais novo aguardando conclusão": nos dois casos a versão mais
  -- recente está em DRAFT.
  if v_versao_origem.status = 'DRAFT' then
    raise exception 'A versão mais recente desta avaliação ainda está em rascunho. Publique-a (ou conclua as alterações pendentes) antes de criar uma nova versão.';
  elsif v_versao_origem.status = 'RETIRED' then
    -- Defensivo: esta é a única função que grava RETIRED, e sempre insere a
    -- versão seguinte na mesma transação — não deveria haver uma RETIRED sem
    -- sucessora mais nova.
    raise exception 'A versão mais recente desta avaliação já está descontinuada.';
  end if;

  select * into v_aplicacao_origem
  from sigav."TB_APLICACAO_PESQUISA"
  where survey_version_id = v_versao_origem.id
  order by created_at desc
  limit 1
  for update;

  if v_aplicacao_origem.id is not null
     and v_aplicacao_origem.status not in ('CLOSED', 'CANCELLED') then
    raise exception 'O ciclo desta versão ainda está %. Encerre-o (Pausar ou Finalizar, em Propriedades do ciclo) antes de criar uma nova versão.',
      case v_aplicacao_origem.status
        when 'DRAFT' then 'em rascunho'
        when 'SCHEDULED' then 'agendado'
        when 'OPEN' then 'aberto'
        else lower(v_aplicacao_origem.status)
      end;
  end if;

  -- Aposenta a versão atual antes de inserir a próxima, para que nenhuma
  -- leitura concorrente resolva "a versão" pelas duas ao mesmo tempo.
  update sigav."TH_VERSAO_PESQUISA"
  set status = 'RETIRED', updated_at = now()
  where id = v_versao_origem.id;

  v_novo_numero := v_versao_origem.version_number + 1;

  insert into sigav."TH_VERSAO_PESQUISA" (
    survey_id, version_number, title, description, status, schema_version, settings, created_by
  )
  values (
    p_pesquisa, v_novo_numero, v_versao_origem.title, v_versao_origem.description,
    'DRAFT', v_versao_origem.schema_version, v_versao_origem.settings, v_pessoa
  )
  returning id into v_nova_versao;

  -- Seções em duas passagens: primeiro todas sem pai, depois o vínculo, para
  -- que uma seção aninhada não precise que a pai já exista na hora da
  -- inserção (mesma técnica de FC_CLONAR_PESQUISA).
  for v_secao in
    select * from sigav."TB_SECAO_PESQUISA" where survey_version_id = v_versao_origem.id order by position
  loop
    insert into sigav."TB_SECAO_PESQUISA" (survey_version_id, parent_section_id, code, title, description, position, settings)
    values (v_nova_versao, null, v_secao.code, v_secao.title, v_secao.description, v_secao.position, v_secao.settings)
    returning id into v_alvo;
    v_mapa_secao := v_mapa_secao || jsonb_build_object(v_secao.id::text, v_alvo::text);
    v_secoes := v_secoes + 1;
  end loop;

  for v_secao in
    select * from sigav."TB_SECAO_PESQUISA" where survey_version_id = v_versao_origem.id and parent_section_id is not null
  loop
    update sigav."TB_SECAO_PESQUISA"
    set parent_section_id = (v_mapa_secao->>v_secao.parent_section_id::text)::uuid
    where id = (v_mapa_secao->>v_secao.id::text)::uuid;
  end loop;

  for v_pergunta in
    select * from sigav."TB_PERGUNTA_PESQUISA" where survey_version_id = v_versao_origem.id order by position
  loop
    insert into sigav."TB_PERGUNTA_PESQUISA" (
      survey_version_id, section_id, code, title, description, question_type,
      required, position, validation, display_logic, scoring, settings
    ) values (
      v_nova_versao, (v_mapa_secao->>v_pergunta.section_id::text)::uuid, v_pergunta.code,
      v_pergunta.title, v_pergunta.description, v_pergunta.question_type,
      v_pergunta.required, v_pergunta.position, v_pergunta.validation,
      v_pergunta.display_logic, v_pergunta.scoring, v_pergunta.settings
    ) returning id into v_alvo;
    v_mapa_pergunta := v_mapa_pergunta || jsonb_build_object(v_pergunta.id::text, v_alvo::text);
    v_perguntas := v_perguntas + 1;

    for v_opcao in
      select * from sigav."TB_OPCAO_PERGUNTA" where question_id = v_pergunta.id order by position
    loop
      insert into sigav."TB_OPCAO_PERGUNTA" (question_id, code, label, value, score, position, active, metadata)
      values (v_alvo, v_opcao.code, v_opcao.label, v_opcao.value, v_opcao.score, v_opcao.position, v_opcao.active, v_opcao.metadata);
    end loop;
  end loop;

  -- O mapa de alternativas é montado numa passagem própria, pareando pelo par
  -- (pergunta, código) — único por constraint — porque o id novo só existe
  -- depois do laço acima.
  for v_opcao in
    select antiga.id as id_antigo, nova.id as id_novo
    from sigav."TB_OPCAO_PERGUNTA" antiga
    join sigav."TB_PERGUNTA_PESQUISA" pergunta_antiga on pergunta_antiga.id = antiga.question_id
    join sigav."TB_OPCAO_PERGUNTA" nova
      on nova.question_id = (v_mapa_pergunta->>pergunta_antiga.id::text)::uuid
     and nova.code = antiga.code
    where pergunta_antiga.survey_version_id = v_versao_origem.id
  loop
    v_mapa_opcao := v_mapa_opcao || jsonb_build_object(v_opcao.id_antigo::text, v_opcao.id_novo::text);
  end loop;

  -- Regras condicionais, já apontando para os identificadores da versão nova.
  for v_regra in
    select * from sigav."TB_REGRA_CONDICIONAL" where "SQ_VERSAO_PESQUISA" = v_versao_origem.id and "ST_ATIVO"
  loop
    v_alvo := case v_regra."TP_ALVO"
      when 'SECTION' then (v_mapa_secao->>v_regra."SQ_ALVO"::text)::uuid
      else (v_mapa_pergunta->>v_regra."SQ_ALVO"::text)::uuid
    end;
    if v_alvo is null then
      continue;
    end if;

    insert into sigav."TB_REGRA_CONDICIONAL" (
      "SQ_VERSAO_PESQUISA", "TP_ALVO", "SQ_ALVO", "TP_ACAO", "TP_CONECTOR", "DS_REGRA", "AU_USUARIO_INCLUSAO"
    ) values (
      v_nova_versao, v_regra."TP_ALVO", v_alvo, v_regra."TP_ACAO", v_regra."TP_CONECTOR", v_regra."DS_REGRA", v_pessoa
    ) returning "SQ_REGRA" into v_nova_regra;

    insert into sigav."TB_CONDICAO_REGRA" ("SQ_REGRA", "SQ_PERGUNTA_ORIGEM", "TP_OPERADOR", "SQ_OPCAO", "DS_VALOR", "NU_VALOR", "NU_ORDEM")
    select
      v_nova_regra,
      (v_mapa_pergunta->>condicao."SQ_PERGUNTA_ORIGEM"::text)::uuid,
      condicao."TP_OPERADOR",
      case when condicao."SQ_OPCAO" is null then null else (v_mapa_opcao->>condicao."SQ_OPCAO"::text)::uuid end,
      condicao."DS_VALOR", condicao."NU_VALOR", condicao."NU_ORDEM"
    from sigav."TB_CONDICAO_REGRA" condicao
    where condicao."SQ_REGRA" = v_regra."SQ_REGRA"
      and (v_mapa_pergunta->>condicao."SQ_PERGUNTA_ORIGEM"::text) is not null;

    v_regras := v_regras + 1;
  end loop;

  -- Ciclo novo: mesmas preferências operacionais do ciclo anterior (visibilidade,
  -- reenvio, anonimato, limiar, aviso por e-mail), sem período e sem identidade
  -- visual própria — o código nunca colide porque é a primeira vez que este
  -- version_number existe para esta pesquisa.
  v_novo_codigo_aplicacao := upper(v_pesquisa.code) || '-' || v_novo_numero::text;

  insert into sigav."TB_APLICACAO_PESQUISA" (
    survey_version_id, code, name, opens_at, closes_at, status,
    allow_drafts, allow_resubmission, anonymous, access_mode,
    nu_limiar_anonimato, st_notificacao_email, settings, created_by
  ) values (
    v_nova_versao,
    v_novo_codigo_aplicacao,
    coalesce(v_aplicacao_origem.name, v_pesquisa.name),
    null, null, 'DRAFT',
    coalesce(v_aplicacao_origem.allow_drafts, true),
    coalesce(v_aplicacao_origem.allow_resubmission, false),
    coalesce(v_aplicacao_origem.anonymous, false),
    coalesce(v_aplicacao_origem.access_mode, 'RESTRICTED'),
    coalesce(v_aplicacao_origem.nu_limiar_anonimato, 5),
    coalesce(v_aplicacao_origem.st_notificacao_email, false),
    '{}'::jsonb,
    v_pessoa
  )
  returning id into v_nova_aplicacao;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    actor_person_id, event_type, entity_type, entity_id, application_id, before_data, after_data, metadata
  ) values (
    v_pessoa, 'SURVEY_VERSION_CREATED', 'SURVEY_VERSION', v_nova_versao::text, v_nova_aplicacao,
    jsonb_build_object('retiredVersionId', v_versao_origem.id, 'retiredVersionNumber', v_versao_origem.version_number),
    jsonb_build_object(
      'newVersionId', v_nova_versao, 'newVersionNumber', v_novo_numero,
      'newApplicationId', v_nova_aplicacao, 'newApplicationCode', v_novo_codigo_aplicacao
    ),
    jsonb_build_object('surveyId', p_pesquisa)
  );

  return jsonb_build_object(
    'status', 'OK',
    'surveyId', p_pesquisa,
    'versionId', v_nova_versao,
    'versionNumber', v_novo_numero,
    'applicationId', v_nova_aplicacao,
    'applicationCode', v_novo_codigo_aplicacao,
    'sections', v_secoes,
    'questions', v_perguntas,
    'rules', v_regras
  );
end;
$function$;

-- FC_EXCLUIR_PESQUISA_ARQUIVADA(p_pesquisa uuid)
-- troca por token, fora de comentário e de literal: sq_versao_pesquisa=1
CREATE OR REPLACE FUNCTION sigav."FC_EXCLUIR_PESQUISA_ARQUIVADA"(p_pesquisa uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor uuid := sigav."FC_PESSOA_SESSAO"();
  v_survey sigav."TB_PESQUISA"%rowtype;
  v_versoes uuid[];
  v_aplicacoes uuid[];
  v_aplicacoes_auditoria jsonb;
  v_submissoes integer;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração.';
  end if;

  select * into v_survey from sigav."TB_PESQUISA" where id = p_pesquisa for update;
  if v_survey.id is null then raise exception 'Avaliação não encontrada.'; end if;
  if v_survey.dt_arquivamento is null then
    raise exception 'Apenas avaliações arquivadas podem ser apagadas definitivamente.';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[]) into v_versoes
  from sigav."TH_VERSAO_PESQUISA" where survey_id = p_pesquisa;
  select coalesce(array_agg(id), '{}'::uuid[]) into v_aplicacoes
  from sigav."TB_APLICACAO_PESQUISA" where survey_version_id = any(v_versoes);
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'code', code, 'status', status)), '[]'::jsonb)
  into v_aplicacoes_auditoria
  from sigav."TB_APLICACAO_PESQUISA" where id = any(v_aplicacoes);
  select count(*)::integer into v_submissoes
  from sigav."TB_SUBMISSAO" where application_id = any(v_aplicacoes);

  insert into sigav."TL_EVENTO_AUDITORIA"(
    actor_person_id, event_type, entity_type, entity_id, application_id,
    before_data, after_data, metadata
  ) values (
    v_actor, 'SURVEY_ARCHIVED_DELETED', 'SURVEY', v_survey.id::text, null,
    jsonb_build_object('code', v_survey.code, 'name', v_survey.name, 'applications', v_aplicacoes_auditoria),
    null,
    jsonb_build_object('surveyId', v_survey.id, 'applications', v_aplicacoes_auditoria, 'submissionsDeleted', v_submissoes)
  );

  -- Resultado final aponta para submissões com RESTRICT; remove-o antes das
  -- submissões. As demais dependências de submissão e de aplicação usam cascade.
  delete from sigav."TB_RESULTADO_FINAL_CDDI" where "SQ_APLICACAO" = any(v_aplicacoes);
  delete from sigav."TB_SUBMISSAO" where application_id = any(v_aplicacoes);
  delete from sigav."TB_REGRA_CONDICIONAL" where "SQ_VERSAO_PESQUISA" = any(v_versoes);

  perform set_config('app.exclusao_arquivada', 'on', true);
  delete from sigav."TB_OPCAO_PERGUNTA"
  where question_id in (select id from sigav."TB_PERGUNTA_PESQUISA" where survey_version_id = any(v_versoes));
  delete from sigav."TB_PERGUNTA_PESQUISA" where survey_version_id = any(v_versoes);

  -- Sempre remove folhas antes das seções-pai: isso impede o cascade da FK
  -- recursiva de acionar o gatilho estrutural num estado intermediário.
  loop
    delete from sigav."TB_SECAO_PESQUISA" filha
    where filha.survey_version_id = any(v_versoes)
      and not exists (
        select 1 from sigav."TB_SECAO_PESQUISA" neta where neta.parent_section_id = filha.id
      );
    exit when not found;
  end loop;

  delete from sigav."TB_APLICACAO_PESQUISA" where id = any(v_aplicacoes);
  delete from sigav."TH_VERSAO_PESQUISA" where survey_id = p_pesquisa;
  delete from sigav."TB_PESQUISA" where id = p_pesquisa;

  return jsonb_build_object('status', 'OK', 'code', v_survey.code, 'name', v_survey.name);
end;
$function$;

-- FC_EXCLUIR_REGRA_CONDICIONAL(p_alvo uuid)
-- troca por token, fora de comentário e de literal: sq_alvo=2, sq_versao_pesquisa=1
CREATE OR REPLACE FUNCTION sigav."FC_EXCLUIR_REGRA_CONDICIONAL"(p_alvo uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_pessoa uuid := sigav."FC_PESSOA_SESSAO"();
  v_versao uuid;
  v_status text;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  select "SQ_VERSAO_PESQUISA" into v_versao
  from sigav."TB_REGRA_CONDICIONAL" where "SQ_ALVO" = p_alvo;
  if v_versao is null then
    return jsonb_build_object('status', 'OK', 'removed', 0);
  end if;

  select status into v_status from sigav."TH_VERSAO_PESQUISA" where id = v_versao;
  if v_status <> 'DRAFT' then
    raise exception 'A lógica condicional só pode ser alterada enquanto a versão está em rascunho.';
  end if;

  delete from sigav."TB_REGRA_CONDICIONAL" where "SQ_ALVO" = p_alvo;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    actor_person_id, event_type, entity_type, entity_id, after_data, metadata
  ) values (
    v_pessoa, 'SURVEY_RULE_DELETED', 'CONDITIONAL_RULE', p_alvo::text, '{}'::jsonb, '{}'::jsonb
  );

  return jsonb_build_object('status', 'OK', 'removed', 1);
end;
$function$;

-- FC_LISTAR_REGRAS_CONDICIONAIS(p_versao uuid)
-- troca por token, fora de comentário e de literal: ds_regra=1, nu_ordem=1, nu_valor=1, sq_alvo=1, sq_condicao=1, sq_opcao=1, sq_pergunta_origem=1, sq_regra=3, sq_versao_pesquisa=1, st_ativo=1, tp_acao=1, tp_alvo=1, tp_conector=1, tp_operador=1, tx_valor=1
CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_REGRAS_CONDICIONAIS"(p_versao uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_result jsonb;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  select coalesce(jsonb_agg(item order by item->>'targetId'), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'ruleId', regra."SQ_REGRA",
      'targetType', regra."TP_ALVO",
      'targetId', regra."SQ_ALVO",
      'action', regra."TP_ACAO",
      'connector', regra."TP_CONECTOR",
      'description', regra."DS_REGRA",
      'conditions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'conditionId', condicao."SQ_CONDICAO",
          'questionId', condicao."SQ_PERGUNTA_ORIGEM",
          'operator', condicao."TP_OPERADOR",
          'optionId', condicao."SQ_OPCAO",
          'value', coalesce(condicao."DS_VALOR", condicao."NU_VALOR"::text)
        ) order by condicao."NU_ORDEM")
        from sigav."TB_CONDICAO_REGRA" as condicao
        where condicao."SQ_REGRA" = regra."SQ_REGRA"
      ), '[]'::jsonb)
    ) as item
    from sigav."TB_REGRA_CONDICIONAL" as regra
    where regra."SQ_VERSAO_PESQUISA" = p_versao and regra."ST_ATIVO"
  ) as regras;

  return v_result;
end;
$function$;

-- FC_OBTER_REGRAS_DO_CICLO(p_codigo_ciclo text)
-- troca por token, fora de comentário e de literal: nu_ordem=1, nu_valor=1, sq_alvo=2, sq_opcao=1, sq_pergunta_origem=1, sq_regra=2, sq_versao_pesquisa=1, st_ativo=1, tp_acao=1, tp_alvo=1, tp_conector=1, tp_operador=1, tx_valor=1
CREATE OR REPLACE FUNCTION sigav."FC_OBTER_REGRAS_DO_CICLO"(p_codigo_ciclo text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select coalesce(jsonb_agg(jsonb_build_object(
    'targetType', regra."TP_ALVO",
    'targetId', regra."SQ_ALVO",
    'action', regra."TP_ACAO",
    'connector', regra."TP_CONECTOR",
    'conditions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'questionId', condicao."SQ_PERGUNTA_ORIGEM",
        'operator', condicao."TP_OPERADOR",
        'optionId', condicao."SQ_OPCAO",
        'value', coalesce(condicao."DS_VALOR", condicao."NU_VALOR"::text)
      ) order by condicao."NU_ORDEM")
      from sigav."TB_CONDICAO_REGRA" as condicao
      where condicao."SQ_REGRA" = regra."SQ_REGRA"
    ), '[]'::jsonb)
  ) order by regra."SQ_ALVO"), '[]'::jsonb)
  from sigav."TB_APLICACAO_PESQUISA" as aplicacao
  join sigav."TB_REGRA_CONDICIONAL" as regra on regra."SQ_VERSAO_PESQUISA" = aplicacao.survey_version_id
  where aplicacao.code = btrim(p_codigo_ciclo)
    and regra."ST_ATIVO"
    and sigav."FC_PODE_ACESSAR_CICLO"(aplicacao.id);
$function$;

-- FC_ORIGENS_DA_REGRA(p_alvo uuid)
-- troca por token, fora de comentário e de literal: sq_alvo=2, sq_pergunta_origem=1, sq_regra=2, st_ativo=1, tp_alvo=1
CREATE OR REPLACE FUNCTION sigav."FC_ORIGENS_DA_REGRA"(p_alvo uuid)
 RETURNS TABLE(sq_origem uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select distinct condicao."SQ_PERGUNTA_ORIGEM"
  from sigav."TB_REGRA_CONDICIONAL" as regra
  join sigav."TB_CONDICAO_REGRA" as condicao on condicao."SQ_REGRA" = regra."SQ_REGRA"
  where regra."ST_ATIVO"
    and (
      regra."SQ_ALVO" = p_alvo
      or (
        regra."TP_ALVO" = 'SECTION'
        and exists (
          select 1
          from sigav."TB_PERGUNTA_PESQUISA" as pergunta
          where pergunta.id = p_alvo
            and pergunta.section_id = regra."SQ_ALVO"
        )
      )
    );
$function$;

-- FC_SALVAR_REGRA_CONDICIONAL(p_alvo_tipo text, p_alvo uuid, p_acao text, p_conector text, p_condicoes jsonb, p_descricao text)
-- troca por token, fora de comentário e de literal: au_usuario_inclusao=1, ds_regra=1, nu_ordem=1, nu_valor=1, sq_alvo=2, sq_opcao=1, sq_pergunta_origem=1, sq_regra=2, sq_versao_pesquisa=1, tp_acao=1, tp_alvo=1, tp_conector=1, tp_operador=1, tx_valor=1
CREATE OR REPLACE FUNCTION sigav."FC_SALVAR_REGRA_CONDICIONAL"(p_alvo_tipo text, p_alvo uuid, p_acao text DEFAULT 'SHOW'::text, p_conector text DEFAULT 'ALL'::text, p_condicoes jsonb DEFAULT '[]'::jsonb, p_descricao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_pessoa uuid := sigav."FC_PESSOA_SESSAO"();
  v_tipo text := upper(btrim(coalesce(p_alvo_tipo, '')));
  v_acao text := upper(btrim(coalesce(p_acao, 'SHOW')));
  v_conector text := upper(btrim(coalesce(p_conector, 'ALL')));
  v_versao uuid;
  v_status text;
  v_regra uuid;
  v_condicao jsonb;
  v_origens uuid[] := array[]::uuid[];
  v_origem uuid;
  v_operador text;
  v_ordem integer := 0;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;
  if v_tipo not in ('QUESTION', 'SECTION') then
    raise exception 'Informe se a regra vale para uma pergunta ou para uma seção.';
  end if;
  if v_acao not in ('SHOW', 'HIDE') then
    raise exception 'A ação da regra precisa ser SHOW ou HIDE.';
  end if;
  if v_conector not in ('ALL', 'ANY') then
    raise exception 'O conector da regra precisa ser ALL ou ANY.';
  end if;

  if v_tipo = 'QUESTION' then
    select pergunta.survey_version_id into v_versao
    from sigav."TB_PERGUNTA_PESQUISA" as pergunta where pergunta.id = p_alvo;
  else
    select secao.survey_version_id into v_versao
    from sigav."TB_SECAO_PESQUISA" as secao where secao.id = p_alvo;
  end if;
  if v_versao is null then
    raise exception 'Pergunta ou seção não localizada.';
  end if;

  -- Regra é estrutura do instrumento: muda enquanto a versão é rascunho, como
  -- seção e pergunta. Depois de publicada, alterar a lógica mudaria o que já foi
  -- respondido por quem já respondeu.
  select status into v_status from sigav."TH_VERSAO_PESQUISA" where id = v_versao;
  if v_status <> 'DRAFT' then
    raise exception 'A lógica condicional só pode ser alterada enquanto a versão está em rascunho.';
  end if;

  -- Origens propostas, validadas antes de gravar: pergunta precisa existir, ser
  -- da mesma versão e não ser o próprio alvo.
  for v_condicao in select value from jsonb_array_elements(coalesce(p_condicoes, '[]'::jsonb)) loop
    v_origem := nullif(btrim(coalesce(v_condicao->>'questionId', '')), '')::uuid;
    v_operador := upper(btrim(coalesce(v_condicao->>'operator', '')));
    if v_origem is null then
      raise exception 'Toda condição precisa apontar uma pergunta de origem.';
    end if;
    if not exists (
      select 1 from sigav."TB_PERGUNTA_PESQUISA"
      where id = v_origem and survey_version_id = v_versao
    ) then
      raise exception 'A pergunta de origem não pertence a esta versão da avaliação.';
    end if;
    if v_origem = p_alvo then
      raise exception 'Uma pergunta não pode condicionar a si mesma.';
    end if;
    if v_operador in ('SELECTED', 'NOT_SELECTED') and not exists (
      select 1 from sigav."TB_OPCAO_PERGUNTA"
      where id = nullif(btrim(coalesce(v_condicao->>'optionId', '')), '')::uuid
        and question_id = v_origem
    ) then
      raise exception 'A alternativa comparada não pertence à pergunta de origem.';
    end if;
    v_origens := v_origens || v_origem;
  end loop;

  if sigav."FC_REGRA_GERA_CICLO"(p_alvo, v_origens) then
    raise exception 'Esta regra cria uma dependência circular entre as perguntas.';
  end if;

  -- Substituição em bloco: a regra vigente do alvo sai e a nova entra na mesma
  -- transação, o que mantém o índice de unicidade satisfeito sem exigir que a
  -- tela apague antes de salvar.
  delete from sigav."TB_REGRA_CONDICIONAL" where "SQ_ALVO" = p_alvo;

  insert into sigav."TB_REGRA_CONDICIONAL" (
    "SQ_VERSAO_PESQUISA", "TP_ALVO", "SQ_ALVO", "TP_ACAO", "TP_CONECTOR", "DS_REGRA", "AU_USUARIO_INCLUSAO"
  ) values (
    v_versao, v_tipo, p_alvo, v_acao, v_conector, nullif(btrim(coalesce(p_descricao, '')), ''), v_pessoa
  ) returning "SQ_REGRA" into v_regra;

  for v_condicao in select value from jsonb_array_elements(coalesce(p_condicoes, '[]'::jsonb)) loop
    v_ordem := v_ordem + 1;
    v_operador := upper(btrim(coalesce(v_condicao->>'operator', '')));
    insert into sigav."TB_CONDICAO_REGRA" (
      "SQ_REGRA", "SQ_PERGUNTA_ORIGEM", "TP_OPERADOR", "SQ_OPCAO", "DS_VALOR", "NU_VALOR", "NU_ORDEM"
    ) values (
      v_regra,
      (v_condicao->>'questionId')::uuid,
      v_operador,
      nullif(btrim(coalesce(v_condicao->>'optionId', '')), '')::uuid,
      nullif(btrim(coalesce(v_condicao->>'value', '')), ''),
      case when v_operador in ('GREATER_THAN', 'LESS_THAN')
        then nullif(btrim(coalesce(v_condicao->>'value', '')), '')::numeric
      end,
      v_ordem
    );
  end loop;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    actor_person_id, event_type, entity_type, entity_id, after_data, metadata
  ) values (
    v_pessoa, 'SURVEY_RULE_SAVED', 'CONDITIONAL_RULE', v_regra::text,
    jsonb_build_object('target', p_alvo, 'action', v_acao, 'connector', v_conector),
    '{}'::jsonb
  );

  return jsonb_build_object('status', 'OK', 'ruleId', v_regra, 'conditions', v_ordem);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ENVIAR_RESP_ANON"(target_submission_id uuid, target_session_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_submission sigav."TB_SUBMISSAO"%rowtype;
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_missing integer;
  v_submitted_at timestamptz := now();
  v_token_hash text;
begin
  if target_session_token is null then raise exception 'A resposta anônima não está disponível para envio.'; end if;
  v_token_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(target_session_token, 'UTF8')), 'hex');
  select * into v_submission from sigav."TB_SUBMISSAO" where id=target_submission_id for update;
  if v_submission.id is null or v_submission.status <> 'DRAFT' or coalesce(v_submission.metadata ->> 'public_session_token_hash','') <> v_token_hash then
    raise exception 'A resposta anônima não está disponível para envio.';
  end if;
  select * into v_application from sigav."TB_APLICACAO_PESQUISA" where id=v_submission.application_id;
  if not v_application.anonymous or not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application.id) then raise exception 'O período de respostas está encerrado.'; end if;
  select count(*)::integer into v_missing
  from sigav."TB_PERGUNTA_PESQUISA" q
  where q.survey_version_id=v_application.survey_version_id
    and q.required
    and sigav."FC_PERGUNTA_VISIVEL"(v_submission.id,q.id)
    and not exists (
      select 1 from sigav."TB_RESPOSTA" a
      where a.submission_id=v_submission.id and a.question_id=q.id and (
        (q.question_type in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE') and exists(select 1 from sigav."RL_RESPOSTA_OPCAO" ao where ao."SQ_RESPOSTA"=a.id))
        or (q.question_type in ('SHORT_TEXT','LONG_TEXT') and nullif(btrim(a.answer_text),'') is not null)
        or (q.question_type in ('INTEGER','DECIMAL') and a.answer_number is not null)
        or (q.question_type='BOOLEAN' and a.answer_boolean is not null)
        or (q.question_type='DATE' and a.answer_date is not null)
        or (q.question_type='DATETIME' and a.answer_datetime is not null)
      )
    );
  if v_missing>0 then raise exception 'Existem % pergunta(s) obrigatória(s) sem resposta.',v_missing; end if;
  update sigav."TB_SUBMISSAO"
  set status='SUBMITTED',submitted_at=v_submitted_at,updated_at=v_submitted_at,
      metadata=(coalesce(metadata,'{}'::jsonb)-'public_session_token'-'public_session_token_hash')||jsonb_build_object('submitted_from','PUBLIC_ANONYMOUS_LINK')
  where id=v_submission.id;
  insert into sigav."TL_EVENTO_AUDITORIA"(actor_person_id,event_type,entity_type,entity_id,application_id,after_data,metadata)
  values(null,'ANONYMOUS_SUBMISSION_SUBMITTED','APPLICATION',v_application.id::text,v_application.id,jsonb_build_object('status','SUBMITTED'),jsonb_build_object('anonymous',true));
  return jsonb_build_object('status','OK','submissionStatus','SUBMITTED','submittedAt',v_submitted_at,'anonymous',true);
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ENVIAR_SUBMISSAO_CDDI"(target_submission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid := sigav."FC_PESSOA_SESSAO"();
  v_submission sigav."TB_SUBMISSAO"%rowtype;
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_missing_count integer := 0;
  v_section record;
  v_behavior_average numeric(12,6);
  v_development_level numeric(12,6);
  v_section_result numeric(12,6);
  v_final_score numeric(12,6);
  v_submitted_at timestamptz := now();
begin
  if sigav."FC_UID_SESSAO"() is null or v_person_id is null then
    raise exception 'Usuário não identificado.';
  end if;

  select s.*
    into v_submission
  from sigav."TB_SUBMISSAO" s
  where s.id = target_submission_id
  for update;

  if not found
    or v_submission.respondent_person_id is distinct from v_person_id
    or v_submission.status <> 'DRAFT' then
    raise exception 'A avaliação não está disponível para envio.';
  end if;

  select sa.*
    into v_application
  from sigav."TB_APLICACAO_PESQUISA" sa
  where sa.id = v_submission.application_id;

  if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application.id) then
    raise exception 'O período de respostas está encerrado.';
  end if;

  select count(*)::integer
    into v_missing_count
  from sigav."TB_PERGUNTA_PESQUISA" q
  where q.survey_version_id = v_application.survey_version_id
    and q.required = true
    and not exists (
      select 1
      from sigav."TB_RESPOSTA" a
      where a.submission_id = v_submission.id
        and a.question_id = q.id
        and (
          (q.question_type = 'SCALE' and exists (
            select 1 from sigav."RL_RESPOSTA_OPCAO" ao where ao."SQ_RESPOSTA" = a.id
          ))
          or (q.question_type in ('SHORT_TEXT', 'LONG_TEXT') and nullif(btrim(a.answer_text), '') is not null)
          or (q.question_type not in ('SCALE', 'SHORT_TEXT', 'LONG_TEXT') and num_nonnulls(
            a.answer_text,
            a.answer_number,
            a.answer_boolean,
            a.answer_date,
            a.answer_datetime,
            a.answer_json
          ) > 0)
        )
    );

  if v_missing_count > 0 then
    raise exception 'Existem % pergunta(s) obrigatória(s) sem resposta.', v_missing_count;
  end if;

  for v_section in
    select ss.id
    from sigav."TB_SECAO_PESQUISA" ss
    where ss.survey_version_id = v_application.survey_version_id
      and coalesce(ss.code, '') <> 'FINAL'
    order by ss.position
  loop
    select
      avg(a.score) filter (where q.scoring ->> 'component' = 'BEHAVIOR'),
      max(a.score) filter (where q.scoring ->> 'component' = 'DEVELOPMENT_LEVEL')
      into v_behavior_average, v_development_level
    from sigav."TB_PERGUNTA_PESQUISA" q
    join sigav."TB_RESPOSTA" a
      on a.question_id = q.id
     and a.submission_id = v_submission.id
    where q.section_id = v_section.id;

    if v_behavior_average is null or v_development_level is null then
      raise exception 'Não foi possível calcular uma das competências.';
    end if;

    v_section_result := round((v_behavior_average * 0.70 + v_development_level * 0.30)::numeric, 4);

    insert into sigav."TB_RESULTADO_COMPET_CDDI" (
      "SQ_SUBMISSAO",
      "SQ_SECAO_COMPETENCIA",
      "VL_MEDIA_COMPORTAMENTO",
      "VL_NIVEL_DESENVOLVIMENTO",
      "VL_RESULTADO",
      "CO_VERSAO_CALCULO"
    ) values (
      v_submission.id,
      v_section.id,
      round(v_behavior_average::numeric, 4),
      round(v_development_level::numeric, 4),
      v_section_result,
      'CDDI-2026-V1'
    )
    on conflict ("SQ_SUBMISSAO", "SQ_SECAO_COMPETENCIA") do update
      set "VL_MEDIA_COMPORTAMENTO" = excluded."VL_MEDIA_COMPORTAMENTO",
          "VL_NIVEL_DESENVOLVIMENTO" = excluded."VL_NIVEL_DESENVOLVIMENTO",
          "VL_RESULTADO" = excluded."VL_RESULTADO",
          "CO_VERSAO_CALCULO" = excluded."CO_VERSAO_CALCULO",
          "DT_ALTERACAO" = now();
  end loop;

  select round(avg(cr."VL_RESULTADO")::numeric, 4)
    into v_final_score
  from sigav."TB_RESULTADO_COMPET_CDDI" cr
  where cr."SQ_SUBMISSAO" = v_submission.id;

  update sigav."TB_SUBMISSAO"
  set status = 'SUBMITTED',
      submitted_at = v_submitted_at,
      calculated_result = v_final_score,
      metadata = metadata || jsonb_build_object('submitted_from', 'PLATFORM_WEB')
  where id = v_submission.id;

  if v_submission.submission_type = 'AUTO' then
    update sigav."RL_APLICACAO_PESSOA"
    set status = 'COMPLETED',
        completed_at = v_submitted_at
    where id = v_submission.participant_id;

    insert into sigav."TB_RESULTADO_FINAL_CDDI" (
      "SQ_APLICACAO",
      "SQ_PESSOA_AVALIADA",
      "SQ_SUBMISSAO_AUTO",
      "VL_NOTA_AUTO",
      "VL_NOTA_FINAL",
      "ST_SITUACAO",
      "DT_CALCULO"
    ) values (
      v_submission.application_id,
      v_submission.subject_person_id,
      v_submission.id,
      v_final_score,
      null,
      'PARTIAL',
      null
    )
    on conflict ("SQ_APLICACAO", "SQ_PESSOA_AVALIADA") do update
      set "SQ_SUBMISSAO_AUTO" = excluded."SQ_SUBMISSAO_AUTO",
          "VL_NOTA_AUTO" = excluded."VL_NOTA_AUTO",
          "VL_NOTA_FINAL" = case
            when sigav."TB_RESULTADO_FINAL_CDDI"."VL_NOTA_LIDER" is null then null
            else round((excluded."VL_NOTA_AUTO" * 0.40 + sigav."TB_RESULTADO_FINAL_CDDI"."VL_NOTA_LIDER" * 0.60)::numeric, 4)
          end,
          "ST_SITUACAO" = case
            when sigav."TB_RESULTADO_FINAL_CDDI"."VL_NOTA_LIDER" is null then 'PARTIAL'
            else 'CALCULATED'
          end,
          "DT_CALCULO" = case
            when sigav."TB_RESULTADO_FINAL_CDDI"."VL_NOTA_LIDER" is null then null
            else v_submitted_at
          end,
          "DT_ALTERACAO" = now();
  else
    insert into sigav."TB_RESULTADO_FINAL_CDDI" (
      "SQ_APLICACAO",
      "SQ_PESSOA_AVALIADA",
      "SQ_SUBMISSAO_LIDER",
      "VL_NOTA_LIDER",
      "VL_NOTA_FINAL",
      "ST_SITUACAO",
      "DT_CALCULO"
    ) values (
      v_submission.application_id,
      v_submission.subject_person_id,
      v_submission.id,
      v_final_score,
      null,
      'PARTIAL',
      null
    )
    on conflict ("SQ_APLICACAO", "SQ_PESSOA_AVALIADA") do update
      set "SQ_SUBMISSAO_LIDER" = excluded."SQ_SUBMISSAO_LIDER",
          "VL_NOTA_LIDER" = excluded."VL_NOTA_LIDER",
          "VL_NOTA_FINAL" = case
            when sigav."TB_RESULTADO_FINAL_CDDI"."VL_NOTA_AUTO" is null then null
            else round((sigav."TB_RESULTADO_FINAL_CDDI"."VL_NOTA_AUTO" * 0.40 + excluded."VL_NOTA_LIDER" * 0.60)::numeric, 4)
          end,
          "ST_SITUACAO" = case
            when sigav."TB_RESULTADO_FINAL_CDDI"."VL_NOTA_AUTO" is null then 'PARTIAL'
            else 'CALCULATED'
          end,
          "DT_CALCULO" = case
            when sigav."TB_RESULTADO_FINAL_CDDI"."VL_NOTA_AUTO" is null then null
            else v_submitted_at
          end,
          "DT_ALTERACAO" = now();
  end if;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    after_data,
    metadata
  ) values (
    v_person_id,
    'CDDI_SUBMISSION_SUBMITTED',
    'SUBMISSION',
    v_submission.id::text,
    v_submission.application_id,
    jsonb_build_object('status', 'SUBMITTED', 'result', v_final_score),
    jsonb_build_object('submission_type', v_submission.submission_type)
  );

  return jsonb_build_object(
    'status', 'OK',
    'submissionStatus', 'SUBMITTED',
    'submittedAt', v_submitted_at,
    'result', v_final_score
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_ENVIAR_SUBMISSAO_PESQUISA"(target_submission_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid := sigav."FC_PESSOA_SESSAO"();
  v_submission sigav."TB_SUBMISSAO"%rowtype;
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_bilhete sigav."TB_BILHETE_ANONIMO"%rowtype;
  v_participante uuid;
  v_missing integer;
  v_submitted_at timestamptz := now();
begin
  if v_person_id is null then raise exception 'Usuário não identificado.'; end if;
  select * into v_submission from sigav."TB_SUBMISSAO" where id = target_submission_id for update;
  if v_submission.id is null or v_submission.status <> 'DRAFT' then
    raise exception 'A resposta não está disponível para envio.';
  end if;
  select * into v_application from sigav."TB_APLICACAO_PESQUISA" where id = v_submission.application_id;

  -- A titularidade vem do bilhete quando o ciclo é anônimo, e da própria
  -- submissão quando não é.
  if v_application.anonymous then
    select * into v_bilhete from sigav."TB_BILHETE_ANONIMO"
    where "SQ_SUBMISSAO" = v_submission.id and "SQ_PESSOA" = v_person_id;
    if v_bilhete."SQ_BILHETE" is null then raise exception 'A resposta não está disponível para envio.'; end if;
    select id into v_participante from sigav."RL_APLICACAO_PESSOA"
    where application_id = v_application.id and person_id = v_person_id and participant_role = 'RESPONDENT';
  else
    if v_submission.respondent_person_id is distinct from v_person_id then
      raise exception 'A resposta não está disponível para envio.';
    end if;
    v_participante := v_submission.participant_id;
  end if;

  if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application.id) then
    raise exception 'O período de respostas está encerrado.';
  end if;

  select count(*)::integer into v_missing
  from sigav."TB_PERGUNTA_PESQUISA" q
  where q.survey_version_id = v_application.survey_version_id and q.required
    and sigav."FC_PERGUNTA_VISIVEL"(v_submission.id, q.id)
    and not exists (
      select 1 from sigav."TB_RESPOSTA" a where a.submission_id = v_submission.id and a.question_id = q.id and (
        (q.question_type in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE') and exists(select 1 from sigav."RL_RESPOSTA_OPCAO" ao where ao."SQ_RESPOSTA" = a.id))
        or (q.question_type in ('SHORT_TEXT','LONG_TEXT') and nullif(btrim(a.answer_text),'') is not null)
        or (q.question_type in ('INTEGER','DECIMAL') and a.answer_number is not null)
        or (q.question_type = 'BOOLEAN' and a.answer_boolean is not null)
        or (q.question_type = 'DATE' and a.answer_date is not null)
        or (q.question_type = 'DATETIME' and a.answer_datetime is not null)
        or (q.question_type not in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE','SHORT_TEXT','LONG_TEXT','INTEGER','DECIMAL','BOOLEAN','DATE','DATETIME')
            and num_nonnulls(a.answer_text, a.answer_number, a.answer_boolean, a.answer_date, a.answer_datetime, a.answer_json) > 0)
      )
    );
  if v_missing > 0 then raise exception 'Existem % pergunta(s) obrigatória(s) sem resposta.', v_missing; end if;

  update sigav."TB_SUBMISSAO"
  set status = 'SUBMITTED', submitted_at = v_submitted_at, updated_at = v_submitted_at,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'submitted_from', case when v_application.anonymous then 'PLATFORM_WEB_ANONYMOUS' else 'PLATFORM_WEB_GENERIC' end)
  where id = v_submission.id;

  update sigav."RL_APLICACAO_PESSOA"
  set status = 'COMPLETED', completed_at = v_submitted_at, updated_at = v_submitted_at
  where id = v_participante;

  if v_application.anonymous then
    -- Os três atos que tornam o anonimato estrutural, nesta ordem.
    --
    -- 1. O bilhete é apagado: era a única linha ligando pessoa e submissão.
    delete from sigav."TB_BILHETE_ANONIMO" where "SQ_BILHETE" = v_bilhete."SQ_BILHETE";

    -- 2. A auditoria registra o envio **sem ator e sem a submissão**. Gravar
    --    `actor_person_id` com o id da submissão refaria o vínculo dentro da
    --    própria trilha de auditoria — seria anonimato desfeito pelo registro
    --    de que houve anonimato.
    insert into sigav."TL_EVENTO_AUDITORIA"(actor_person_id, event_type, entity_type, entity_id, application_id, after_data, metadata)
    values (null, 'ANONYMOUS_SUBMISSION_SUBMITTED', 'APPLICATION', v_application.id::text, v_application.id,
            jsonb_build_object('status','SUBMITTED'), jsonb_build_object('anonymous', true));
  else
    insert into sigav."TL_EVENTO_AUDITORIA"(actor_person_id, event_type, entity_type, entity_id, application_id, after_data, metadata)
    values (v_person_id, 'SURVEY_SUBMISSION_SUBMITTED', 'SUBMISSION', v_submission.id::text, v_submission.application_id,
            jsonb_build_object('status','SUBMITTED'), '{}'::jsonb);
  end if;

  return jsonb_build_object('status','OK','submissionStatus','SUBMITTED','submittedAt',v_submitted_at,'anonymous',v_application.anonymous);
end $function$;

CREATE OR REPLACE FUNCTION sigav."FC_GRAVAR_RESP_ANON"(target_submission_id uuid, target_session_token text, target_question_id uuid, target_option_ids uuid[], target_text text, target_number numeric, target_boolean boolean, target_date date, target_datetime timestamp with time zone, target_json jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_submission sigav."TB_SUBMISSAO"%rowtype;
  v_version_id uuid;
  v_question sigav."TB_PERGUNTA_PESQUISA"%rowtype;
  v_answer_id uuid;
  v_option_ids uuid[];
  v_invalid_options integer;
  v_text text;
  v_token_hash text;
begin
  if target_session_token is null then
    raise exception 'O rascunho anônimo não está disponível para edição.';
  end if;
  v_token_hash := pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(target_session_token, 'UTF8')), 'hex');
  select * into v_submission from sigav."TB_SUBMISSAO" where id = target_submission_id for update;
  if v_submission.id is null or v_submission.status <> 'DRAFT' or coalesce(v_submission.metadata ->> 'public_session_token_hash', '') <> v_token_hash then
    raise exception 'O rascunho anônimo não está disponível para edição.';
  end if;
  if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_submission.application_id) then
    raise exception 'O período de respostas está encerrado.';
  end if;
  select survey_version_id into v_version_id from sigav."TB_APLICACAO_PESQUISA" where id = v_submission.application_id and anonymous;
  if v_version_id is null then raise exception 'A avaliação anônima não está disponível.'; end if;
  select * into v_question from sigav."TB_PERGUNTA_PESQUISA" where id = target_question_id and survey_version_id = v_version_id;
  if v_question.id is null then raise exception 'Pergunta inválida para esta pesquisa.'; end if;
  if v_question.question_type in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE') then
    select coalesce(array_agg(distinct option_id),'{}'::uuid[]) into v_option_ids from unnest(coalesce(target_option_ids,'{}'::uuid[])) option_id;
    if coalesce(array_length(v_option_ids,1),0)=0 then
      delete from sigav."TB_RESPOSTA" where submission_id=v_submission.id and question_id=v_question.id;
    else
      if v_question.question_type in ('SCALE','SINGLE_CHOICE') and array_length(v_option_ids,1)<>1 then raise exception 'Selecione apenas uma alternativa.'; end if;
      select count(*) into v_invalid_options from unnest(v_option_ids) selected_id left join sigav."TB_OPCAO_PERGUNTA" qo on qo.id=selected_id and qo.question_id=v_question.id and qo.active where qo.id is null;
      if v_invalid_options>0 then raise exception 'Uma ou mais alternativas são inválidas.'; end if;
      insert into sigav."TB_RESPOSTA"(submission_id,question_id) values(v_submission.id,v_question.id)
      on conflict(submission_id,question_id) do update set answer_text=null,answer_number=null,answer_boolean=null,answer_date=null,answer_datetime=null,answer_json=null,score=null,updated_at=now()
      returning id into v_answer_id;
      delete from sigav."RL_RESPOSTA_OPCAO" where "SQ_RESPOSTA"=v_answer_id;
      insert into sigav."RL_RESPOSTA_OPCAO"("SQ_RESPOSTA","SQ_OPCAO","NU_ORDEM")
      select v_answer_id,option_id,row_number() over(order by option_id)::integer from unnest(v_option_ids) option_id;
    end if;
  elsif v_question.question_type in ('SHORT_TEXT','LONG_TEXT') then
    v_text:=nullif(btrim(coalesce(target_text,'')), '');
    if length(coalesce(v_text,''))>12000 then raise exception 'O texto excede o limite de 12.000 caracteres.'; end if;
    if v_text is null then
      delete from sigav."TB_RESPOSTA" where submission_id=v_submission.id and question_id=v_question.id;
    else
      insert into sigav."TB_RESPOSTA"(submission_id,question_id,answer_text) values(v_submission.id,v_question.id,v_text)
      on conflict(submission_id,question_id) do update set answer_text=excluded.answer_text,answer_number=null,answer_boolean=null,answer_date=null,answer_datetime=null,answer_json=null,score=null,updated_at=now();
    end if;
  elsif v_question.question_type in ('INTEGER','DECIMAL') then
    if target_number is null then delete from sigav."TB_RESPOSTA" where submission_id=v_submission.id and question_id=v_question.id;
    else
      if v_question.question_type='INTEGER' and target_number<>trunc(target_number) then raise exception 'Informe um número inteiro.'; end if;
      insert into sigav."TB_RESPOSTA"(submission_id,question_id,answer_number) values(v_submission.id,v_question.id,target_number)
      on conflict(submission_id,question_id) do update set answer_text=null,answer_number=excluded.answer_number,answer_boolean=null,answer_date=null,answer_datetime=null,answer_json=null,score=null,updated_at=now();
    end if;
  elsif v_question.question_type='BOOLEAN' then
    if target_boolean is null then delete from sigav."TB_RESPOSTA" where submission_id=v_submission.id and question_id=v_question.id;
    else
      insert into sigav."TB_RESPOSTA"(submission_id,question_id,answer_boolean) values(v_submission.id,v_question.id,target_boolean)
      on conflict(submission_id,question_id) do update set answer_text=null,answer_number=null,answer_boolean=excluded.answer_boolean,answer_date=null,answer_datetime=null,answer_json=null,score=null,updated_at=now();
    end if;
  elsif v_question.question_type='DATE' then
    if target_date is null then delete from sigav."TB_RESPOSTA" where submission_id=v_submission.id and question_id=v_question.id;
    else
      insert into sigav."TB_RESPOSTA"(submission_id,question_id,answer_date) values(v_submission.id,v_question.id,target_date)
      on conflict(submission_id,question_id) do update set answer_text=null,answer_number=null,answer_boolean=null,answer_date=excluded.answer_date,answer_datetime=null,answer_json=null,score=null,updated_at=now();
    end if;
  elsif v_question.question_type='DATETIME' then
    if target_datetime is null then delete from sigav."TB_RESPOSTA" where submission_id=v_submission.id and question_id=v_question.id;
    else
      insert into sigav."TB_RESPOSTA"(submission_id,question_id,answer_datetime) values(v_submission.id,v_question.id,target_datetime)
      on conflict(submission_id,question_id) do update set answer_text=null,answer_number=null,answer_boolean=null,answer_date=null,answer_datetime=excluded.answer_datetime,answer_json=null,score=null,updated_at=now();
    end if;
  else raise exception 'Tipo de pergunta ainda não suportado: %.',v_question.question_type; end if;
  update sigav."TB_SUBMISSAO" set updated_at=now() where id=v_submission.id;
  return jsonb_build_object('status','OK','savedAt',now());
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_INICIAR_OU_RETOMAR_CDDI"(target_application_code text DEFAULT 'CDDI-2026'::text, target_submission_type text DEFAULT 'AUTO'::text, target_subject_person_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid := sigav."FC_PESSOA_SESSAO"();
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_participant sigav."RL_APLICACAO_PESSOA"%rowtype;
  v_submission sigav."TB_SUBMISSAO"%rowtype;
  v_subject_person_id uuid;
  v_type text := upper(btrim(coalesce(target_submission_type, 'AUTO')));
  v_answers jsonb := '{}'::jsonb;
  v_can_edit boolean := false;
begin
  if sigav."FC_UID_SESSAO"() is null or v_person_id is null then
    raise exception 'Usuário autenticado sem cadastro institucional vinculado.';
  end if;

  select sa.*
    into v_application
  from sigav."TB_APLICACAO_PESQUISA" sa
  join sigav."TH_VERSAO_PESQUISA" sv on sv.id = sa.survey_version_id
  join sigav."TB_PESQUISA" s on s.id = sv.survey_id
  where sa.code = target_application_code
    and s.code = 'CDDI'
  limit 1;

  if not found then
    raise exception 'Aplicação CDDI não encontrada.';
  end if;

  select ap.*
    into v_participant
  from sigav."RL_APLICACAO_PESSOA" ap
  where ap.application_id = v_application.id
    and ap.person_id = v_person_id
    and ap.participant_role = 'RESPONDENT'
    and ap.status not in ('BLOCKED', 'EXCLUDED')
  order by ap.created_at desc
  limit 1;

  if not found then
    raise exception 'Seu cadastro não está elegível para esta aplicação.';
  end if;

  if v_type = 'AUTO' then
    v_subject_person_id := v_person_id;
  elsif v_type = 'CHEFIA' then
    v_subject_person_id := target_subject_person_id;
    if v_subject_person_id is null then
      raise exception 'A pessoa avaliada é obrigatória para a avaliação da chefia.';
    end if;

    if not exists (
      select 1
      from sigav."RT_LIDERANCA_CDDI" l
      where l.application_id = v_application.id
        and l.leader_person_id = v_person_id
        and l.subordinate_person_id = v_subject_person_id
        and l.status = 'ACTIVE'
        and l.valid_from <= now()
        and (l.valid_to is null or l.valid_to > now())
    ) then
      raise exception 'Não existe vínculo ativo com a pessoa avaliada.';
    end if;
  else
    raise exception 'Tipo de avaliação inválido.';
  end if;

  select s.*
    into v_submission
  from sigav."TB_SUBMISSAO" s
  where s.application_id = v_application.id
    and s.respondent_person_id = v_person_id
    and s.subject_person_id = v_subject_person_id
    and s.submission_type = v_type
    and s.status in ('DRAFT', 'SUBMITTED', 'VALIDATED')
  order by s.version desc, s.created_at desc
  limit 1;

  if not found then
    if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application.id) then
      return jsonb_build_object(
        'status', 'PERIOD_CLOSED',
        'applicationStatus', v_application.status,
        'canEdit', false,
        'submission', null,
        'answers', '{}'::jsonb
      );
    end if;

    insert into sigav."TB_SUBMISSAO" (
      application_id,
      participant_id,
      respondent_person_id,
      subject_person_id,
      submission_type,
      status,
      metadata
    ) values (
      v_application.id,
      v_participant.id,
      v_person_id,
      v_subject_person_id,
      v_type,
      'DRAFT',
      jsonb_build_object('origin', 'PLATFORM_WEB')
    )
    returning * into v_submission;

    if v_type = 'AUTO' then
      update sigav."RL_APLICACAO_PESSOA"
      set status = case when status in ('ELIGIBLE', 'INVITED') then 'IN_PROGRESS' else status end,
          started_at = coalesce(started_at, now())
      where id = v_participant.id;
    end if;
  end if;

  select coalesce(
    jsonb_object_agg(
      a.question_id::text,
      jsonb_build_object(
        'answerText', a.answer_text,
        'answerNumber', a.answer_number,
        'optionId', selected_option.option_id,
        'optionValue', qo.value
      )
    ),
    '{}'::jsonb
  )
  into v_answers
  from sigav."TB_RESPOSTA" a
  left join lateral (
    select ao."SQ_OPCAO" as option_id
    from sigav."RL_RESPOSTA_OPCAO" ao
    where ao."SQ_RESPOSTA" = a.id
    order by ao."NU_ORDEM" nulls last, ao."DT_INCLUSAO"
    limit 1
  ) selected_option on true
  left join sigav."TB_OPCAO_PERGUNTA" qo on qo.id = selected_option.option_id
  where a.submission_id = v_submission.id;

  v_can_edit := v_submission.status = 'DRAFT'
    and sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application.id);

  return jsonb_build_object(
    'status', 'OK',
    'applicationStatus', v_application.status,
    'canEdit', v_can_edit,
    'submission', jsonb_build_object(
      'id', v_submission.id,
      'status', v_submission.status,
      'startedAt', v_submission.started_at,
      'submittedAt', v_submission.submitted_at,
      'updatedAt', v_submission.updated_at,
      'result', v_submission.calculated_result,
      'type', v_submission.submission_type
    ),
    'answers', v_answers
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_INICIAR_OU_RETOMAR_PESQ"(target_application_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person uuid := sigav."FC_PESSOA_SESSAO"();
  v_app sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_part sigav."RL_APLICACAO_PESSOA"%rowtype;
  v_sub sigav."TB_SUBMISSAO"%rowtype;
  v_answers jsonb := '{}'::jsonb;
  v_edit boolean := false;
begin
  if v_person is null then raise exception 'Cadastro institucional não identificado.'; end if;
  select * into v_app from sigav."TB_APLICACAO_PESQUISA" where code = btrim(target_application_code) limit 1;
  if v_app.id is null then raise exception 'Aplicação não encontrada.'; end if;
  if not sigav."FC_PODE_ACESSAR_CICLO"(v_app.id) then raise exception 'Seu cadastro não está autorizado para esta pesquisa.'; end if;

  select * into v_part from sigav."RL_APLICACAO_PESSOA"
  where application_id = v_app.id and person_id = v_person and participant_role = 'RESPONDENT'
    and status not in ('BLOCKED','EXCLUDED')
  order by created_at desc limit 1;

  if v_part.id is null and v_app.access_mode = 'INSTITUTIONAL' then
    insert into sigav."RL_APLICACAO_PESSOA"(application_id, person_id, participant_role, status, access_profile, metadata)
    values (v_app.id, v_person, 'RESPONDENT', 'ELIGIBLE', 'USUARIO_INSTITUCIONAL', jsonb_build_object('origin','INSTITUTIONAL_ACCESS'))
    on conflict (application_id, person_id, participant_role) do update
      set status = case when sigav."RL_APLICACAO_PESSOA".status in ('BLOCKED','EXCLUDED')
                        then sigav."RL_APLICACAO_PESSOA".status else 'ELIGIBLE' end,
          updated_at = timezone('utc', now())
    returning * into v_part;
  end if;
  if v_part.id is null and not sigav."FC_PODE_GERIR_PESQUISA"() then raise exception 'Seu cadastro não está elegível para esta pesquisa.'; end if;

  if v_app.anonymous then
    -- A submissão nunca recebe a identidade; quem sabe de quem é o rascunho é o
    -- bilhete, e só enquanto ele existir.
    select s.* into v_sub
    from sigav."TB_SUBMISSAO" s
    join sigav."TB_BILHETE_ANONIMO" b on b."SQ_SUBMISSAO" = s.id
    where b."SQ_APLICACAO" = v_app.id and b."SQ_PESSOA" = v_person
    limit 1;

    -- Sem bilhete e com participação concluída, a pessoa já enviou: não há
    -- rascunho a retomar e um novo seria resposta em dobro.
    if v_sub.id is null and v_part.status = 'COMPLETED' then
      return jsonb_build_object(
        'status', 'ALREADY_SUBMITTED', 'applicationStatus', v_app.status,
        'anonymous', true, 'canEdit', false, 'submission', null, 'answers', '{}'::jsonb
      );
    end if;

    if v_sub.id is null and sigav."FC_CICLO_ACEITA_RESPOSTA"(v_app.id) then
      insert into sigav."TB_SUBMISSAO"(application_id, participant_id, respondent_person_id, subject_person_id, submission_type, status, metadata)
      values (v_app.id, null, null, null, 'RESPONSE', 'DRAFT', jsonb_build_object('origin','PLATFORM_WEB_ANONYMOUS'))
      returning * into v_sub;

      insert into sigav."TB_BILHETE_ANONIMO" ("SQ_APLICACAO", "SQ_PESSOA", "SQ_SUBMISSAO")
      values (v_app.id, v_person, v_sub.id);

      update sigav."RL_APLICACAO_PESSOA"
      set status = 'IN_PROGRESS', started_at = coalesce(started_at, timezone('utc', now())), updated_at = timezone('utc', now())
      where id = v_part.id and status in ('ELIGIBLE','INVITED');
    end if;
  else
    select * into v_sub from sigav."TB_SUBMISSAO"
    where application_id = v_app.id and respondent_person_id = v_person and subject_person_id = v_person
      and submission_type in ('RESPONSE','AUTO') and status in ('DRAFT','SUBMITTED','VALIDATED')
    order by version desc, created_at desc limit 1;

    if v_sub.id is null and sigav."FC_CICLO_ACEITA_RESPOSTA"(v_app.id) then
      if v_part.id is null then raise exception 'Inclua seu cadastro como participante antes de responder.'; end if;
      insert into sigav."TB_SUBMISSAO"(application_id, participant_id, respondent_person_id, subject_person_id, submission_type, status, metadata)
      values (v_app.id, v_part.id, v_person, v_person, 'RESPONSE', 'DRAFT', jsonb_build_object('origin','PLATFORM_WEB_GENERIC'))
      returning * into v_sub;
      update sigav."RL_APLICACAO_PESSOA"
      set status = 'IN_PROGRESS', started_at = coalesce(started_at, timezone('utc', now())), updated_at = timezone('utc', now())
      where id = v_part.id and status in ('ELIGIBLE','INVITED');
    end if;
  end if;

  if v_sub.id is not null then
    select coalesce(jsonb_object_agg(a.question_id::text, jsonb_build_object(
      'answerText', a.answer_text, 'answerNumber', a.answer_number, 'answerBoolean', a.answer_boolean,
      'answerDate', a.answer_date, 'answerDatetime', a.answer_datetime, 'answerJson', a.answer_json,
      'optionIds', coalesce(o.ids, '[]'::jsonb))), '{}'::jsonb)
    into v_answers
    from sigav."TB_RESPOSTA" a
    left join lateral (
      select jsonb_agg(ao."SQ_OPCAO" order by ao."NU_ORDEM") ids
      from sigav."RL_RESPOSTA_OPCAO" ao where ao."SQ_RESPOSTA" = a.id
    ) o on true
    where a.submission_id = v_sub.id;
  end if;

  v_edit := v_sub.id is not null and v_sub.status = 'DRAFT' and sigav."FC_CICLO_ACEITA_RESPOSTA"(v_app.id);
  return jsonb_build_object(
    'status', case when sigav."FC_CICLO_ACEITA_RESPOSTA"(v_app.id) then 'OK' else 'PERIOD_CLOSED' end,
    'applicationStatus', v_app.status,
    'anonymous', v_app.anonymous,
    'canEdit', v_edit,
    'submission', case when v_sub.id is null then null else jsonb_build_object(
      'id', v_sub.id, 'status', v_sub.status, 'startedAt', v_sub.started_at,
      'submittedAt', v_sub.submitted_at, 'updatedAt', v_sub.updated_at) end,
    'answers', v_answers
  );
end $function$;

CREATE OR REPLACE FUNCTION sigav."FC_INICIAR_OU_RETOMAR_SUBM"(target_application_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid := sigav."FC_PESSOA_SESSAO"();
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_participant sigav."RL_APLICACAO_PESSOA"%rowtype;
  v_submission sigav."TB_SUBMISSAO"%rowtype;
  v_answers jsonb := '{}'::jsonb;
  v_can_edit boolean := false;
begin
  if sigav."FC_UID_SESSAO"() is null or v_person_id is null then raise exception 'Usuário autenticado sem cadastro institucional vinculado.'; end if;

  select * into v_application from sigav."TB_APLICACAO_PESQUISA" where code = btrim(target_application_code) limit 1;
  if v_application.id is null then raise exception 'Aplicação não encontrada.'; end if;

  select * into v_participant
  from sigav."RL_APLICACAO_PESSOA"
  where application_id = v_application.id
    and person_id = v_person_id
    and participant_role = 'RESPONDENT'
    and status not in ('REMOVED','INELIGIBLE','BLOCKED','EXCLUDED')
  order by created_at desc limit 1;

  if v_participant.id is null and not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Seu cadastro não está elegível para esta pesquisa.';
  end if;

  select * into v_submission
  from sigav."TB_SUBMISSAO"
  where application_id = v_application.id
    and respondent_person_id = v_person_id
    and subject_person_id = v_person_id
    and submission_type = 'AUTO'
    and status in ('DRAFT','SUBMITTED','VALIDATED')
  order by version desc, created_at desc limit 1;

  if v_submission.id is null then
    if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application.id) then
      return jsonb_build_object('status','PERIOD_CLOSED','applicationStatus',v_application.status,'canEdit',false,'submission',null,'answers','{}'::jsonb);
    end if;
    if v_participant.id is null then raise exception 'Administradores devem ser incluídos como participantes para responder esta pesquisa.'; end if;

    insert into sigav."TB_SUBMISSAO"(application_id,participant_id,respondent_person_id,subject_person_id,submission_type,status,metadata)
    values(v_application.id,v_participant.id,v_person_id,v_person_id,'AUTO','DRAFT',jsonb_build_object('origin','PLATFORM_WEB_GENERIC'))
    returning * into v_submission;

    update sigav."RL_APLICACAO_PESSOA"
    set status = case when status in ('ELIGIBLE','INVITED') then 'IN_PROGRESS' else status end,
        started_at = coalesce(started_at, now())
    where id = v_participant.id;
  end if;

  select coalesce(jsonb_object_agg(a.question_id::text,jsonb_build_object(
    'answerText',a.answer_text,'answerNumber',a.answer_number,'optionId',selected.option_id,'optionValue',qo.value
  )),'{}'::jsonb)
  into v_answers
  from sigav."TB_RESPOSTA" a
  left join lateral (
    select ao."SQ_OPCAO" as option_id from sigav."RL_RESPOSTA_OPCAO" ao where ao."SQ_RESPOSTA"=a.id order by ao."NU_ORDEM" nulls last,ao."DT_INCLUSAO" limit 1
  ) selected on true
  left join sigav."TB_OPCAO_PERGUNTA" qo on qo.id=selected.option_id
  where a.submission_id=v_submission.id;

  v_can_edit := v_submission.status='DRAFT' and sigav."FC_CICLO_ACEITA_RESPOSTA"(v_application.id);
  return jsonb_build_object(
    'status','OK','applicationStatus',v_application.status,'canEdit',v_can_edit,
    'submission',jsonb_build_object('id',v_submission.id,'status',v_submission.status,'startedAt',v_submission.started_at,'submittedAt',v_submission.submitted_at,'updatedAt',v_submission.updated_at,'type',v_submission.submission_type),
    'answers',v_answers
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_PAINEL_PESQ"(target_application_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_application_id uuid;
  v_payload jsonb;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à Equipe Técnica.';
  end if;

  select id into v_application_id
  from sigav."TB_APLICACAO_PESQUISA"
  where code = btrim(target_application_code)
  limit 1;

  if v_application_id is null then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  with app as (
    select sa.*, sv.title version_title, sv.description version_description,
      sv.version_number, s.code survey_code, s.name survey_name,
      s.description survey_description
    from sigav."TB_APLICACAO_PESQUISA" sa
    join sigav."TH_VERSAO_PESQUISA" sv on sv.id = sa.survey_version_id
    join sigav."TB_PESQUISA" s on s.id = sv.survey_id
    where sa.id = v_application_id
  ), latest_submissions as (
    select distinct on (s.participant_id)
      s.id, s.participant_id, s.status, s.updated_at
    from sigav."TB_SUBMISSAO" s
    where s.application_id = v_application_id
      and s.participant_id is not null
    order by s.participant_id, s.updated_at desc
  ), participant_summary as (
    select
      count(*) total,
      count(*) filter (where sub.status = 'DRAFT') drafts,
      count(*) filter (where sub.status in ('SUBMITTED', 'VALIDATED')) submitted,
      count(*) filter (where sub.id is null) not_started
    from sigav."RL_APLICACAO_PESSOA" ap
    left join latest_submissions sub on sub.participant_id = ap.id
    where ap.application_id = v_application_id
      and ap.status not in ('REMOVED', 'INELIGIBLE', 'EXCLUDED')
  ), question_rows as (
    select q.id, q.code, q.title, q.description, q.question_type, q.position,
      sec.id section_id, sec.title section_title, sec.position section_position
    from sigav."TB_PERGUNTA_PESQUISA" q
    join sigav."TB_SECAO_PESQUISA" sec on sec.id = q.section_id
    join app on app.survey_version_id = q.survey_version_id
  ), submitted_answers as (
    select a.*, s.submitted_at
    from sigav."TB_RESPOSTA" a
    join sigav."TB_SUBMISSAO" s on s.id = a.submission_id
    where s.application_id = v_application_id
      and s.status in ('SUBMITTED', 'VALIDATED')
  ), option_counts as (
    select a.question_id, ao."SQ_OPCAO" as option_id, count(*) answer_count
    from sigav."RL_RESPOSTA_OPCAO" ao
    join submitted_answers a on a.id = ao."SQ_RESPOSTA"
    group by a.question_id, ao."SQ_OPCAO"
  )
  select jsonb_build_object(
    'status', 'OK',
    'generatedAt', timezone('utc', now()),
    'application', (
      select jsonb_build_object(
        'id', id,
        'code', code,
        'name', name,
        'status', status,
        'opensAt', opens_at,
        'closesAt', closes_at,
        'surveyCode', survey_code,
        'surveyName', survey_name,
        'surveyDescription', coalesce(survey_description, version_description),
        'versionTitle', version_title,
        'versionNumber', version_number
      ) from app
    ),
    'summary', (
      select jsonb_build_object(
        'totalParticipants', total,
        'drafts', drafts,
        'submitted', submitted,
        'notStarted', not_started,
        'completionRate', case when total = 0 then 0 else round(submitted::numeric * 100 / total, 1) end
      ) from participant_summary
    ),
    'questions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', qr.id,
        'code', qr.code,
        'title', qr.title,
        'description', qr.description,
        'type', qr.question_type,
        'position', qr.position,
        'sectionId', qr.section_id,
        'sectionTitle', qr.section_title,
        'sectionPosition', qr.section_position,
        'responseCount', (select count(*) from submitted_answers a where a.question_id = qr.id),
        'options', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', o.id,
            'label', o.label,
            'value', o.value,
            'count', coalesce(oc.answer_count, 0)
          ) order by o.position)
          from sigav."TB_OPCAO_PERGUNTA" o
          left join option_counts oc on oc.question_id = qr.id and oc.option_id = o.id
          where o.question_id = qr.id and o.active
        ), '[]'::jsonb),
        'textResponses', coalesce((
          select jsonb_agg(jsonb_build_object(
            'text', left(sample.answer_text, 1000),
            'submittedAt', sample.submitted_at
          ) order by sample.submitted_at desc)
          from (
            select a.answer_text, a.submitted_at
            from submitted_answers a
            where a.question_id = qr.id
              and nullif(btrim(a.answer_text), '') is not null
            order by a.submitted_at desc
            limit 100
          ) sample
        ), '[]'::jsonb)
      ) order by qr.section_position, qr.position)
      from question_rows qr
    ), '[]'::jsonb)
  ) into v_payload;

  return v_payload;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_OBTER_PAINEL_PESQUISA"(target_application_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_application_id uuid;
  v_anonimo boolean;
  v_limiar integer;
  v_payload jsonb;
begin
  if not sigav."FC_TEM_MODULO"('DASHBOARDS') then
    raise exception 'Acesso restrito ao módulo de Painéis.';
  end if;

  select id, coalesce(anonymous, false), coalesce(nu_limiar_anonimato, 5)
  into v_application_id, v_anonimo, v_limiar
  from sigav."TB_APLICACAO_PESQUISA"
  where code = btrim(target_application_code)
  limit 1;

  if v_application_id is null then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  -- Ciclo identificado não sofre supressão: limiar zero nunca é atingido.
  -- Assim a mudança é inerte para tudo que já existe.
  if not v_anonimo then
    v_limiar := 0;
  end if;

  with app as (
    select sa.*, sv.title version_title, sv.description version_description,
      sv.version_number, s.code survey_code, s.name survey_name,
      s.description survey_description
    from sigav."TB_APLICACAO_PESQUISA" sa
    join sigav."TH_VERSAO_PESQUISA" sv on sv.id = sa.survey_version_id
    join sigav."TB_PESQUISA" s on s.id = sv.survey_id
    where sa.id = v_application_id
  ), latest_submissions as (
    select distinct on (s.participant_id)
      s.id, s.participant_id, s.status, s.updated_at
    from sigav."TB_SUBMISSAO" s
    where s.application_id = v_application_id
      and s.participant_id is not null
    order by s.participant_id, s.updated_at desc
  ), participant_summary as (
    /*
      O acompanhamento tem duas fontes, porque as duas jornadas guardam o
      progresso em lugares diferentes.

      Em ciclo identificado, a submissão aponta para o participante e o estado
      dela é a fonte. Em ciclo **anônimo** a submissão não tem `participant_id`
      — é justamente isso que garante o anonimato —, então nada casaria no
      `join` e o painel diria que ninguém respondeu, mesmo com o ciclo inteiro
      concluído. Ali quem sabe do progresso é `application_participants`, que
      registra a participação sem registrar o conteúdo.

      Saber que alguém respondeu é diferente de saber o que respondeu: o
      acompanhamento continua possível sem quebrar o anonimato.
    */
    select
      count(*) total,
      count(*) filter (
        where case when v_anonimo then ap.status = 'IN_PROGRESS' else sub.status = 'DRAFT' end
      ) drafts,
      count(*) filter (
        where case when v_anonimo then ap.status = 'COMPLETED' else sub.status in ('SUBMITTED', 'VALIDATED') end
      ) submitted,
      count(*) filter (
        where case when v_anonimo then ap.status in ('ELIGIBLE', 'INVITED') else sub.id is null end
      ) not_started
    from sigav."RL_APLICACAO_PESSOA" ap
    left join latest_submissions sub on sub.participant_id = ap.id
    where ap.application_id = v_application_id
      -- Quem está bloqueado ou excluído não pode responder: manter no
      -- denominador faria a taxa de conclusão nunca chegar a 100%.
      and ap.status not in ('BLOCKED', 'EXCLUDED')
  ), question_rows as (
    select q.id, q.code, q.title, q.description, q.question_type, q.position,
      sec.id section_id, sec.title section_title, sec.position section_position
    from sigav."TB_PERGUNTA_PESQUISA" q
    join sigav."TB_SECAO_PESQUISA" sec on sec.id = q.section_id
    join app on app.survey_version_id = q.survey_version_id
  ), submitted_answers as (
    select a.*, s.submitted_at
    from sigav."TB_RESPOSTA" a
    join sigav."TB_SUBMISSAO" s on s.id = a.submission_id
    where s.application_id = v_application_id
      and s.status in ('SUBMITTED', 'VALIDATED')
  ), option_counts as (
    select a.question_id, ao."SQ_OPCAO" as option_id, count(*) answer_count
    from sigav."RL_RESPOSTA_OPCAO" ao
    join submitted_answers a on a.id = ao."SQ_RESPOSTA"
    group by a.question_id, ao."SQ_OPCAO"
  )
  select jsonb_build_object(
    'status', 'OK',
    'generatedAt', timezone('utc', now()),
    -- A tela precisa saber que o ciclo é anônimo e qual o limiar, para explicar
    -- a supressão em vez de mostrar um vazio inexplicado.
    'anonymous', v_anonimo,
    'threshold', v_limiar,
    'application', (
      select jsonb_build_object(
        'id', id,
        'code', code,
        'name', name,
        'status', status,
        'opensAt', opens_at,
        'closesAt', closes_at,
        'surveyCode', survey_code,
        'surveyName', survey_name,
        'surveyDescription', coalesce(survey_description, version_description),
        'versionTitle', version_title,
        'versionNumber', version_number
      ) from app
    ),
    'summary', (
      select jsonb_build_object(
        'totalParticipants', total,
        'drafts', drafts,
        'submitted', submitted,
        'notStarted', not_started,
        'completionRate', case when total = 0 then 0 else round(submitted::numeric * 100 / total, 1) end
      ) from participant_summary
    ),
    'questions', coalesce((
      select jsonb_agg(item order by ordem_secao, ordem)
      from (
        select
          qr.section_position as ordem_secao,
          qr.position as ordem,
          jsonb_build_object(
            'id', qr.id,
            'code', qr.code,
            'title', qr.title,
            'description', qr.description,
            'type', qr.question_type,
            'position', qr.position,
            'sectionId', qr.section_id,
            'sectionTitle', qr.section_title,
            'sectionPosition', qr.section_position,
            -- A contagem continua visível mesmo quando o conteúdo é suprimido:
            -- saber que houve poucas respostas é informação de acompanhamento,
            -- e é ela que justifica a supressão a quem lê.
            'responseCount', respostas.total,
            'suppressed', false,
            'options', case
              when false then '[]'::jsonb
              else coalesce((
                select jsonb_agg(jsonb_build_object(
                  'id', o.id,
                  'label', o.label,
                  'value', o.value,
                  'count', coalesce(oc.answer_count, 0)
                ) order by o.position)
                from sigav."TB_OPCAO_PERGUNTA" o
                left join option_counts oc on oc.question_id = qr.id and oc.option_id = o.id
                where o.question_id = qr.id and o.active
              ), '[]'::jsonb)
            end,
            'textResponses', case
              when false then '[]'::jsonb
              else coalesce((
                select jsonb_agg(jsonb_build_object(
                  'text', left(sample.answer_text, 1000),
                  -- Ciclo anônimo não devolve o horário: cruzado com a data de
                  -- conclusão de cada participante, ele reconstrói o nome.
                  'submittedAt', sample.submitted_at
                ) order by sample.ordenacao)
                from (
                  select
                    a.answer_text,
                    a.submitted_at,
                    -- Em ciclo anônimo a ordem não pode acompanhar o tempo, ou
                    -- entrega a sequência de quem respondeu. `md5` do texto é
                    -- estável entre chamadas e não guarda relação com o envio.
                    case when v_anonimo then md5(a.answer_text) else to_char(a.submitted_at, 'YYYYMMDDHH24MISS') end as ordenacao
                  from submitted_answers a
                  where a.question_id = qr.id
                    and nullif(btrim(a.answer_text), '') is not null
                  order by ordenacao desc
                  limit 100
                ) sample
              ), '[]'::jsonb)
            end
          ) as item
        from question_rows qr
        cross join lateral (
          select count(*)::integer as total
          from submitted_answers a
          where a.question_id = qr.id
        ) respostas
      ) perguntas
    ), '[]'::jsonb)
  ) into v_payload;

  if v_anonimo then
    v_payload := jsonb_set(v_payload, '{summary}', jsonb_build_object(
      'totalParticipants', (select count(*) from sigav."TB_SUBMISSAO" s where s.application_id = v_application_id and s.status in ('DRAFT', 'SUBMITTED', 'VALIDATED')),
      'drafts', (select count(*) from sigav."TB_SUBMISSAO" s where s.application_id = v_application_id and s.status = 'DRAFT'),
      'submitted', (select count(*) from sigav."TB_SUBMISSAO" s where s.application_id = v_application_id and s.status in ('SUBMITTED', 'VALIDATED')),
      'notStarted', 0,
      'completionRate', case when (select count(*) from sigav."TB_SUBMISSAO" s where s.application_id = v_application_id and s.status in ('DRAFT', 'SUBMITTED', 'VALIDATED')) = 0 then 0 else round((select count(*) from sigav."TB_SUBMISSAO" s where s.application_id = v_application_id and s.status in ('SUBMITTED', 'VALIDATED'))::numeric * 100 / (select count(*) from sigav."TB_SUBMISSAO" s where s.application_id = v_application_id and s.status in ('DRAFT', 'SUBMITTED', 'VALIDATED')), 1) end
    ));
  end if;
  return v_payload;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_REMOVER_RESPOSTA_PESSOA"(p_submissao uuid, p_modo text DEFAULT 'INVALIDATE'::text, p_motivo text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_pessoa uuid;
  v_submissao sigav."TB_SUBMISSAO"%rowtype;
  v_modo text;
  v_motivo text;
  v_respostas integer;
  v_retrato jsonb;
  v_resultados uuid[];
begin
  if not sigav."FC_TEM_MODULO"('ADMIN_TEAMS') then
    raise exception 'Apenas o Superadmin pode anular ou apagar a resposta de outra pessoa.';
  end if;

  v_pessoa := sigav."FC_PESSOA_SESSAO"();
  v_modo := upper(btrim(coalesce(p_modo, '')));
  v_motivo := btrim(coalesce(p_motivo, ''));

  if v_modo not in ('INVALIDATE', 'DELETE') then
    raise exception 'Modo inválido. Use INVALIDATE para anular ou DELETE para apagar.';
  end if;

  if length(v_motivo) < 10 then
    raise exception 'Descreva o motivo da operação com pelo menos 10 caracteres.';
  end if;

  select * into v_submissao from sigav."TB_SUBMISSAO" where id = p_submissao;
  if v_submissao.id is null then
    raise exception 'Resposta não localizada.';
  end if;

  select count(*)::integer into v_respostas from sigav."TB_RESPOSTA" where submission_id = p_submissao;

  -- Quais resultados consolidados dependem desta submissão. Levantado agora
  -- porque o `DELETE` anula os vínculos logo adiante, e depois disso a
  -- informação some.
  select coalesce(array_agg("SQ_RESULTADO"), '{}')
  into v_resultados
  from sigav."TB_RESULTADO_FINAL_CDDI"
  where "SQ_SUBMISSAO_AUTO" = p_submissao or "SQ_SUBMISSAO_LIDER" = p_submissao;

  -- Retrato do que existia, gravado na auditoria antes de qualquer alteração.
  select jsonb_build_object(
    'submissionId', v_submissao.id,
    'status', v_submissao.status,
    'submissionType', v_submissao.submission_type,
    'submittedAt', v_submissao.submitted_at,
    'answers', v_respostas,
    'consolidatedResults', coalesce(array_length(v_resultados, 1), 0),
    'respondent', jsonb_build_object(
      'personId', pessoa.id, 'employeeNumber', pessoa.employee_number, 'fullName', pessoa.full_name
    ),
    'application', jsonb_build_object('id', aplicacao.id, 'code', aplicacao.code, 'name', aplicacao.name)
  )
  into v_retrato
  from sigav."TB_APLICACAO_PESQUISA" as aplicacao
  left join sigav."TB_PESSOA" as pessoa on pessoa.id = v_submissao.respondent_person_id
  where aplicacao.id = v_submissao.application_id;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    actor_person_id, event_type, entity_type, entity_id, application_id, before_data, metadata
  ) values (
    v_pessoa,
    case when v_modo = 'DELETE' then 'SUBMISSION_DELETED' else 'SUBMISSION_INVALIDATED' end,
    'SUBMISSION', v_submissao.id::text, v_submissao.application_id, v_retrato,
    jsonb_build_object('reason', v_motivo, 'mode', v_modo)
  );

  -- Vale para os dois modos: o cálculo derivado não sobrevive à resposta que o
  -- originou. A linha fica, como registro de que houve um cálculo; o número sai.
  if array_length(v_resultados, 1) > 0 then
    update sigav."TB_RESULTADO_FINAL_CDDI"
    set "ST_SITUACAO" = 'INVALIDATED',
        "VL_NOTA_AUTO" = null,
        "VL_NOTA_LIDER" = null,
        "VL_NOTA_FINAL" = null,
        "DT_PUBLICACAO" = null,
        "DT_ALTERACAO" = now(),
        "DS_METADADO" = coalesce("DS_METADADO", '{}'::jsonb) || jsonb_build_object(
          'invalidatedBy', v_pessoa,
          'invalidatedAt', now(),
          'invalidationReason', v_motivo,
          'invalidationSource', 'SUBMISSION_' || v_modo
        )
    where "SQ_RESULTADO" = any(v_resultados);
  end if;

  -- Detalhe por competência daquela submissão: sem estado próprio, some nos dois
  -- modos.
  delete from sigav."TB_RESULTADO_COMPET_CDDI" where "SQ_SUBMISSAO" = p_submissao;

  if v_modo = 'INVALIDATE' then
    -- As respostas continuam gravadas; o que muda é o estado da submissão, e é
    -- ele que os painéis e o cálculo leem.
    update sigav."TB_SUBMISSAO"
    set status = 'INVALIDATED',
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'invalidatedBy', v_pessoa, 'invalidatedAt', now(), 'invalidationReason', v_motivo
        )
    where id = p_submissao;
  else
    -- De baixo para cima, como toda remoção neste banco. Os vínculos só são
    -- anulados aqui, depois de os resultados já terem sido marcados.
    update sigav."TB_RESULTADO_FINAL_CDDI" set "SQ_SUBMISSAO_AUTO" = null where "SQ_SUBMISSAO_AUTO" = p_submissao;
    update sigav."TB_RESULTADO_FINAL_CDDI" set "SQ_SUBMISSAO_LIDER" = null where "SQ_SUBMISSAO_LIDER" = p_submissao;
    delete from sigav."RL_RESPOSTA_OPCAO" where "SQ_RESPOSTA" in (
      select id from sigav."TB_RESPOSTA" where submission_id = p_submissao
    );
    delete from sigav."TB_RESPOSTA" where submission_id = p_submissao;
    delete from sigav."TB_SUBMISSAO" where id = p_submissao;
  end if;

  -- A pessoa volta a constar como pendente no ciclo: sem isso, o painel
  -- continuaria contando como concluída uma resposta que não existe mais.
  update sigav."RL_APLICACAO_PESSOA"
  set status = 'ELIGIBLE', completed_at = null, updated_at = now()
  where application_id = v_submissao.application_id
    and person_id = v_submissao.respondent_person_id
    and status = 'COMPLETED';

  return jsonb_build_object(
    'status', 'OK',
    'mode', v_modo,
    'submissionId', p_submissao,
    'answers', v_respostas,
    'invalidatedResults', coalesce(array_length(v_resultados, 1), 0)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SALVAR_RESPOSTA_CDDI"(target_submission_id uuid, target_question_id uuid, target_option_id uuid DEFAULT NULL::uuid, target_text text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid := sigav."FC_PESSOA_SESSAO"();
  v_submission sigav."TB_SUBMISSAO"%rowtype;
  v_survey_version_id uuid;
  v_question sigav."TB_PERGUNTA_PESQUISA"%rowtype;
  v_option sigav."TB_OPCAO_PERGUNTA"%rowtype;
  v_answer_id uuid;
  v_numeric numeric(18,6);
  v_text text;
begin
  if sigav."FC_UID_SESSAO"() is null or v_person_id is null then
    raise exception 'Usuário não identificado.';
  end if;

  select s.*
    into v_submission
  from sigav."TB_SUBMISSAO" s
  where s.id = target_submission_id
  for update;

  if not found
    or v_submission.respondent_person_id is distinct from v_person_id
    or v_submission.status <> 'DRAFT' then
    raise exception 'O rascunho não está disponível para edição.';
  end if;

  if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_submission.application_id) then
    raise exception 'O período de respostas está encerrado.';
  end if;

  select sa.survey_version_id
    into v_survey_version_id
  from sigav."TB_APLICACAO_PESQUISA" sa
  where sa.id = v_submission.application_id;

  select q.*
    into v_question
  from sigav."TB_PERGUNTA_PESQUISA" q
  where q.id = target_question_id
    and q.survey_version_id = v_survey_version_id;

  if not found then
    raise exception 'Pergunta inválida para esta aplicação.';
  end if;

  if v_question.question_type = 'SCALE' then
    if target_option_id is null then
      raise exception 'Selecione uma alternativa da escala.';
    end if;

    select qo.*
      into v_option
    from sigav."TB_OPCAO_PERGUNTA" qo
    where qo.id = target_option_id
      and qo.question_id = v_question.id
      and qo.active = true;

    if not found then
      raise exception 'Alternativa inválida para esta pergunta.';
    end if;

    v_numeric := coalesce(
      v_option.score,
      case
        when v_option.value ~ '^[+-]?([0-9]+([.][0-9]*)?|[.][0-9]+)$'
          then v_option.value::numeric
        else null
      end
    );

    insert into sigav."TB_RESPOSTA" (
      submission_id,
      question_id,
      answer_text,
      answer_number,
      answer_boolean,
      answer_date,
      answer_datetime,
      answer_json,
      score
    ) values (
      v_submission.id,
      v_question.id,
      null,
      v_numeric,
      null,
      null,
      null,
      null,
      v_numeric
    )
    on conflict (submission_id, question_id) do update
      set answer_text = null,
          answer_number = excluded.answer_number,
          answer_boolean = null,
          answer_date = null,
          answer_datetime = null,
          answer_json = null,
          score = excluded.score,
          updated_at = now()
    returning id into v_answer_id;

    delete from sigav."RL_RESPOSTA_OPCAO" where "SQ_RESPOSTA" = v_answer_id;
    insert into sigav."RL_RESPOSTA_OPCAO" ("SQ_RESPOSTA", "SQ_OPCAO", "NU_ORDEM")
    values (v_answer_id, v_option.id, 1);

  elsif v_question.question_type in ('SHORT_TEXT', 'LONG_TEXT') then
    v_text := nullif(btrim(coalesce(target_text, '')), '');

    if length(coalesce(v_text, '')) > 12000 then
      raise exception 'O texto excede o limite de 12.000 caracteres.';
    end if;

    if v_text is null then
      delete from sigav."TB_RESPOSTA"
      where submission_id = v_submission.id
        and question_id = v_question.id;
    else
      insert into sigav."TB_RESPOSTA" (
        submission_id,
        question_id,
        answer_text,
        answer_number,
        answer_boolean,
        answer_date,
        answer_datetime,
        answer_json,
        score
      ) values (
        v_submission.id,
        v_question.id,
        v_text,
        null,
        null,
        null,
        null,
        null,
        null
      )
      on conflict (submission_id, question_id) do update
        set answer_text = excluded.answer_text,
            answer_number = null,
            answer_boolean = null,
            answer_date = null,
            answer_datetime = null,
            answer_json = null,
            score = null,
            updated_at = now()
      returning id into v_answer_id;

      delete from sigav."RL_RESPOSTA_OPCAO" where "SQ_RESPOSTA" = v_answer_id;
    end if;
  else
    raise exception 'Tipo de pergunta ainda não suportado pelo formulário CDDI.';
  end if;

  update sigav."TB_SUBMISSAO"
  set metadata = metadata || jsonb_build_object('last_saved_at', now())
  where id = v_submission.id;

  return jsonb_build_object(
    'status', 'OK',
    'savedAt', now()
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SALVAR_RESPOSTA_PESQUISA"(target_submission_id uuid, target_question_id uuid, target_option_ids uuid[], target_text text, target_number numeric, target_boolean boolean, target_date date, target_datetime timestamp with time zone, target_json jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid := sigav."FC_PESSOA_SESSAO"();
  v_submission sigav."TB_SUBMISSAO"%rowtype;
  v_version_id uuid;
  v_question sigav."TB_PERGUNTA_PESQUISA"%rowtype;
  v_answer_id uuid;
  v_option_ids uuid[];
  v_invalid_options integer;
  v_text text;
begin
  if v_person_id is null then raise exception 'Usuário não identificado.'; end if;

  select * into v_submission
  from sigav."TB_SUBMISSAO"
  where id = target_submission_id
  for update;

  if v_submission.id is null
     or v_submission.respondent_person_id is distinct from v_person_id
     or v_submission.status <> 'DRAFT' then
    raise exception 'O rascunho não está disponível para edição.';
  end if;

  if not sigav."FC_CICLO_ACEITA_RESPOSTA"(v_submission.application_id) then
    raise exception 'O período de respostas está encerrado.';
  end if;

  select survey_version_id into v_version_id
  from sigav."TB_APLICACAO_PESQUISA"
  where id = v_submission.application_id;

  select * into v_question
  from sigav."TB_PERGUNTA_PESQUISA"
  where id = target_question_id
    and survey_version_id = v_version_id;

  if v_question.id is null then raise exception 'Pergunta inválida para esta pesquisa.'; end if;

  if v_question.question_type in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE') then
    select coalesce(array_agg(distinct option_id), '{}'::uuid[])
    into v_option_ids
    from unnest(coalesce(target_option_ids, '{}'::uuid[])) option_id;

    if coalesce(array_length(v_option_ids, 1), 0) = 0 then
      delete from sigav."TB_RESPOSTA" where submission_id = v_submission.id and question_id = v_question.id;
    else
      if v_question.question_type in ('SCALE','SINGLE_CHOICE') and array_length(v_option_ids, 1) <> 1 then
        raise exception 'Selecione apenas uma alternativa.';
      end if;

      select count(*) into v_invalid_options
      from unnest(v_option_ids) selected_id
      left join sigav."TB_OPCAO_PERGUNTA" qo
        on qo.id = selected_id
       and qo.question_id = v_question.id
       and qo.active = true
      where qo.id is null;

      if v_invalid_options > 0 then raise exception 'Uma ou mais alternativas são inválidas.'; end if;

      insert into sigav."TB_RESPOSTA"(submission_id, question_id)
      values(v_submission.id, v_question.id)
      on conflict(submission_id, question_id) do update set
        answer_text = null,
        answer_number = null,
        answer_boolean = null,
        answer_date = null,
        answer_datetime = null,
        answer_json = null,
        score = null,
        updated_at = now()
      returning id into v_answer_id;

      delete from sigav."RL_RESPOSTA_OPCAO" where "SQ_RESPOSTA" = v_answer_id;
      insert into sigav."RL_RESPOSTA_OPCAO"("SQ_RESPOSTA", "SQ_OPCAO", "NU_ORDEM")
      select v_answer_id, option_id, row_number() over (order by option_id)::integer
      from unnest(v_option_ids) option_id;
    end if;
  elsif v_question.question_type in ('SHORT_TEXT','LONG_TEXT') then
    v_text := nullif(btrim(coalesce(target_text, '')), '');
    if length(coalesce(v_text, '')) > 12000 then raise exception 'O texto excede o limite de 12.000 caracteres.'; end if;
    if v_text is null then
      delete from sigav."TB_RESPOSTA" where submission_id = v_submission.id and question_id = v_question.id;
    else
      insert into sigav."TB_RESPOSTA"(submission_id, question_id, answer_text)
      values(v_submission.id, v_question.id, v_text)
      on conflict(submission_id, question_id) do update set
        answer_text = excluded.answer_text,
        answer_number = null,
        answer_boolean = null,
        answer_date = null,
        answer_datetime = null,
        answer_json = null,
        score = null,
        updated_at = now();
    end if;
  elsif v_question.question_type in ('INTEGER','DECIMAL') then
    if target_number is null then
      delete from sigav."TB_RESPOSTA" where submission_id = v_submission.id and question_id = v_question.id;
    else
      if v_question.question_type = 'INTEGER' and target_number <> trunc(target_number) then
        raise exception 'Informe um número inteiro.';
      end if;
      insert into sigav."TB_RESPOSTA"(submission_id, question_id, answer_number)
      values(v_submission.id, v_question.id, target_number)
      on conflict(submission_id, question_id) do update set
        answer_text = null,
        answer_number = excluded.answer_number,
        answer_boolean = null,
        answer_date = null,
        answer_datetime = null,
        answer_json = null,
        score = null,
        updated_at = now();
    end if;
  elsif v_question.question_type = 'BOOLEAN' then
    if target_boolean is null then
      delete from sigav."TB_RESPOSTA" where submission_id = v_submission.id and question_id = v_question.id;
    else
      insert into sigav."TB_RESPOSTA"(submission_id, question_id, answer_boolean)
      values(v_submission.id, v_question.id, target_boolean)
      on conflict(submission_id, question_id) do update set
        answer_text = null,
        answer_number = null,
        answer_boolean = excluded.answer_boolean,
        answer_date = null,
        answer_datetime = null,
        answer_json = null,
        score = null,
        updated_at = now();
    end if;
  elsif v_question.question_type = 'DATE' then
    if target_date is null then
      delete from sigav."TB_RESPOSTA" where submission_id = v_submission.id and question_id = v_question.id;
    else
      insert into sigav."TB_RESPOSTA"(submission_id, question_id, answer_date)
      values(v_submission.id, v_question.id, target_date)
      on conflict(submission_id, question_id) do update set
        answer_text = null,
        answer_number = null,
        answer_boolean = null,
        answer_date = excluded.answer_date,
        answer_datetime = null,
        answer_json = null,
        score = null,
        updated_at = now();
    end if;
  elsif v_question.question_type = 'DATETIME' then
    if target_datetime is null then
      delete from sigav."TB_RESPOSTA" where submission_id = v_submission.id and question_id = v_question.id;
    else
      insert into sigav."TB_RESPOSTA"(submission_id, question_id, answer_datetime)
      values(v_submission.id, v_question.id, target_datetime)
      on conflict(submission_id, question_id) do update set
        answer_text = null,
        answer_number = null,
        answer_boolean = null,
        answer_date = null,
        answer_datetime = excluded.answer_datetime,
        answer_json = null,
        score = null,
        updated_at = now();
    end if;
  else
    raise exception 'Tipo de pergunta ainda não suportado: %.', v_question.question_type;
  end if;

  update sigav."TB_SUBMISSAO"
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('last_saved_at', now()),
      updated_at = now()
  where id = v_submission.id;

  return jsonb_build_object('status', 'OK', 'savedAt', now());
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_VALIDAR_OPCAO_RESPOSTA"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  answer_question uuid;
  option_question uuid;
begin
  select question_id into answer_question from sigav."TB_RESPOSTA" where id = new."SQ_RESPOSTA";
  select question_id into option_question from sigav."TB_OPCAO_PERGUNTA" where id = new."SQ_OPCAO";
  if answer_question is distinct from option_question then
    raise exception 'Alternativa não pertence à pergunta respondida.';
  end if;
  return new;
end;
$function$;

-- ---------------------------------------------------------------------------
-- 3. Autoverificação
-- ---------------------------------------------------------------------------

do $verificacao$
declare
  v_tabelas text[] := array['TB_CONDICAO_REGRA', 'TB_REGRA_CONDICIONAL', 'RL_RESPOSTA_OPCAO'];
  v_revisadas text[] := array['FC_ALVO_VISIVEL', 'FC_CLONAR_PESQUISA_ESTRUTURA', 'FC_CONDICAO_ATENDIDA', 'FC_CRIAR_NOVA_VERSAO_PESQUISA', 'FC_EXCLUIR_PESQUISA_ARQUIVADA', 'FC_EXCLUIR_REGRA_CONDICIONAL', 'FC_LISTAR_REGRAS_CONDICIONAIS', 'FC_OBTER_REGRAS_DO_CICLO', 'FC_ORIGENS_DA_REGRA', 'FC_SALVAR_REGRA_CONDICIONAL', 'FC_ENVIAR_RESP_ANON', 'FC_ENVIAR_SUBMISSAO_CDDI', 'FC_ENVIAR_SUBMISSAO_PESQUISA', 'FC_GRAVAR_RESP_ANON', 'FC_INICIAR_OU_RETOMAR_CDDI', 'FC_INICIAR_OU_RETOMAR_PESQ', 'FC_INICIAR_OU_RETOMAR_SUBM', 'FC_OBTER_PAINEL_PESQ', 'FC_OBTER_PAINEL_PESQUISA', 'FC_REMOVER_RESPOSTA_PESSOA', 'FC_SALVAR_RESPOSTA_CDDI', 'FC_SALVAR_RESPOSTA_PESQUISA', 'FC_VALIDAR_OPCAO_RESPOSTA'];
  v_velhos_exclusivos text[] := array['sq_condicao', 'sq_regra', 'sq_pergunta_origem', 'tp_operador', 'sq_opcao', 'tx_valor', 'nu_valor', 'nu_ordem', 'sq_regra', 'sq_versao_pesquisa', 'tp_alvo', 'sq_alvo', 'tp_acao', 'tp_conector', 'ds_regra', 'st_ativo', 'au_usuario_inclusao', 'dt_inclusao', 'answer_id', 'option_id']::text[];
  v_sobras_aceitas text[] := array['FC_GRAVAR_RESP_ANON|option_id', 'FC_INICIAR_OU_RETOMAR_CDDI|option_id', 'FC_INICIAR_OU_RETOMAR_SUBM|option_id', 'FC_OBTER_PAINEL_PESQ|option_id', 'FC_OBTER_PAINEL_PESQUISA|option_id', 'FC_SALVAR_RESPOSTA_PESQUISA|option_id']::text[];
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

  -- Rede contra o esquecimento: acusa funcao que toca as tabelas deste lote e
  -- NAO esta na lista revisada. Comentario nao conta: varias funcoes citam a
  -- tabela so em prosa, e isso nao e referencia a coluna.
  select string_agg(distinct nome, ', ' order by nome) into v_fora
    from (
      -- Quem escreve o nome da tabela.
      select p.proname as nome
        from pg_proc p, unnest(v_tabelas) t(tabela)
       where p.pronamespace = 'sigav'::regnamespace
         and regexp_replace(pg_get_functiondef(p.oid), '^[[:space:]]*--.*$', '', 'gn')
             ~ ('sigav[.]"' || t.tabela || '"')
      union
      -- E quem chega às colunas por new/old, sem nunca nomear a tabela.
      -- Foi assim que FC_VALIDAR_RESULT_FINAL_CDDI quase escapou deste lote.
      select p.proname
        from pg_trigger tg
        join pg_class cl on cl.oid = tg.tgrelid
        join pg_proc p on p.oid = tg.tgfoid
       where cl.relnamespace = 'sigav'::regnamespace
         and not tg.tgisinternal
         and cl.relname = any(v_tabelas)
         -- Fora quem atende os DOIS estados da nomenclatura testando o campo
         -- (FC_DEFINIR_DT_ALTERACAO, reparada em 20260831200000). Essa nao
         -- precisa de edicao por lote: e justamente o que ela resolve.
         and pg_get_functiondef(p.oid) !~ 'to_jsonb[(]new[)][[:space:]]*[?]'
    ) tocam
   where not (nome = any(v_revisadas));
  if v_fora is not null then
    raise exception 'Funcoes tocam tabelas deste lote e nao foram revisadas: %', v_fora;
  end if;

  -- Sobra: corpo de função que ainda menciona o nome ANTIGO de uma coluna
  -- deste lote. Vale só para os nomes exclusivos das tabelas do lote — nome
  -- que outra tabela também usa apareceria aqui por motivo legítimo.
  --
  -- Comentário e literal saem antes da conferência: o comentário cita o nome
  -- antigo para explicar a mudança, e literal é chave JSON, que é contrato com
  -- a tela e não se renomeia.
  select string_agg(distinct p.proname || ' -> ' || v.coluna, ', ' order by p.proname || ' -> ' || v.coluna)
    into v_fora
    from pg_proc p, unnest(v_velhos_exclusivos) v(coluna)
   where p.pronamespace = 'sigav'::regnamespace
     and cardinality(v_velhos_exclusivos) > 0
     and not (p.proname || '|' || v.coluna = any(v_sobras_aceitas))
     and regexp_replace(
           regexp_replace(
             regexp_replace(pg_get_functiondef(p.oid), '/[*].*?[*]/', '', 'gs'),
             '--[^' || chr(10) || ']*', '', 'g'),
           '''([^'']|'''''')*''', '''''', 'g')
         ~ ('\m' || v.coluna || '\M');
  if v_fora is not null then
    raise exception 'Sobrou referência ao nome antigo da coluna: %', v_fora;
  end if;

  -- Constraint citada por nome dentro de corpo de funcao. Renomear a
  -- constraint sem trocar a citacao quebra em execucao, e a reescrita por TOKEN
  -- so mexe em nome de COLUNA. Foi assim que FC_ARQ_GRAVAR ficou apontando para
  -- uma constraint inexistente entre 20260831150000 e 20260831220000.
  select string_agg(distinct p.proname || ' -> ' || m[2], ', ' order by p.proname || ' -> ' || m[2])
    into v_fora
    from pg_proc p
    cross join lateral regexp_matches(
      regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g'),
      'on[[:space:]]+constraint[[:space:]]+("?)([a-zA-Z_][a-zA-Z_0-9]*)\1', 'gi') as m
   where p.pronamespace = 'sigav'::regnamespace
     and p.prokind = 'f'
     and not exists (
       select 1 from pg_constraint con
         join pg_class rel on rel.oid = con.conrelid
        where rel.relnamespace = 'sigav'::regnamespace
          and con.conname = case when m[1] = '' then lower(m[2]) else m[2] end);
  if v_fora is not null then
    raise exception 'Funcao cita constraint que nao existe mais: %', v_fora;
  end if;

  raise notice 'nomenclatura lote 5: 23 colunas em 3 tabelas';
end
$verificacao$;

commit;
