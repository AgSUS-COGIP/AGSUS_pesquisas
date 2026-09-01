-- Colunas no padrão institucional — LOTE 3.
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
-- RISCO DESTE LOTE: 12 função(ões) referenciam estas 4 tabelas, e cada
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
-- 32 colunas, 19 constraints, 4 índices.

begin;

-- ---------------------------------------------------------------------------
-- 1. Colunas (item 7)
-- ---------------------------------------------------------------------------

-- TB_BILHETE_ANONIMO
alter table sigav."TB_BILHETE_ANONIMO" rename column sq_bilhete to "SQ_BILHETE";
alter table sigav."TB_BILHETE_ANONIMO" rename column sq_aplicacao to "SQ_APLICACAO";
alter table sigav."TB_BILHETE_ANONIMO" rename column sq_pessoa to "SQ_PESSOA";
alter table sigav."TB_BILHETE_ANONIMO" rename column sq_submissao to "SQ_SUBMISSAO";
alter table sigav."TB_BILHETE_ANONIMO" rename column dt_criacao to "DT_INCLUSAO";

-- TB_IDENTIDADE_ACESSO
alter table sigav."TB_IDENTIDADE_ACESSO" rename column id to "SQ_IDENTIDADE";
alter table sigav."TB_IDENTIDADE_ACESSO" rename column person_id to "SQ_PESSOA";
alter table sigav."TB_IDENTIDADE_ACESSO" rename column identity_type to "TP_IDENTIDADE";
alter table sigav."TB_IDENTIDADE_ACESSO" rename column email to "NO_EMAIL";
alter table sigav."TB_IDENTIDADE_ACESSO" rename column status to "ST_SITUACAO";
alter table sigav."TB_IDENTIDADE_ACESSO" rename column source to "NO_ORIGEM";
alter table sigav."TB_IDENTIDADE_ACESSO" rename column verified_at to "DT_VERIFICACAO";
alter table sigav."TB_IDENTIDADE_ACESSO" rename column revoked_at to "DT_REVOGACAO";
alter table sigav."TB_IDENTIDADE_ACESSO" rename column metadata to "DS_METADADO";
alter table sigav."TB_IDENTIDADE_ACESSO" rename column created_at to "DT_INCLUSAO";
alter table sigav."TB_IDENTIDADE_ACESSO" rename column updated_at to "DT_ALTERACAO";

-- TB_MODULO_PLATAFORMA
alter table sigav."TB_MODULO_PLATAFORMA" rename column code to "CO_MODULO";
alter table sigav."TB_MODULO_PLATAFORMA" rename column name to "NO_MODULO";
alter table sigav."TB_MODULO_PLATAFORMA" rename column description to "DS_MODULO";
alter table sigav."TB_MODULO_PLATAFORMA" rename column category to "TP_CATEGORIA";
alter table sigav."TB_MODULO_PLATAFORMA" rename column position to "NU_ORDEM";
alter table sigav."TB_MODULO_PLATAFORMA" rename column active to "ST_ATIVO";
alter table sigav."TB_MODULO_PLATAFORMA" rename column created_at to "DT_INCLUSAO";

-- TB_RESULTADO_COMPET_CDDI
alter table sigav."TB_RESULTADO_COMPET_CDDI" rename column id to "SQ_RESULTADO";
alter table sigav."TB_RESULTADO_COMPET_CDDI" rename column submission_id to "SQ_SUBMISSAO";
alter table sigav."TB_RESULTADO_COMPET_CDDI" rename column competency_section_id to "SQ_SECAO_COMPETENCIA";
alter table sigav."TB_RESULTADO_COMPET_CDDI" rename column behavior_average to "VL_MEDIA_COMPORTAMENTO";
alter table sigav."TB_RESULTADO_COMPET_CDDI" rename column development_level to "VL_NIVEL_DESENVOLVIMENTO";
alter table sigav."TB_RESULTADO_COMPET_CDDI" rename column result to "VL_RESULTADO";
alter table sigav."TB_RESULTADO_COMPET_CDDI" rename column calculation_version to "CO_VERSAO_CALCULO";
alter table sigav."TB_RESULTADO_COMPET_CDDI" rename column created_at to "DT_INCLUSAO";
alter table sigav."TB_RESULTADO_COMPET_CDDI" rename column updated_at to "DT_ALTERACAO";

-- ---------------------------------------------------------------------------
-- 2. Constraints e índices, realinhados à coluna nova (item 8)
-- ---------------------------------------------------------------------------

alter table sigav."TB_BILHETE_ANONIMO" rename constraint "UK_BILHETE_ANON_PESSOA" to "UK_BILHET_ANON_SQ_APLI_SQ_PESS";
alter table sigav."TB_BILHETE_ANONIMO" rename constraint "UK_BILHETE_ANON_SUBMISSAO" to "UK_BILHETE_ANON_SQ_SUBMISSAO";
alter table sigav."TB_IDENTIDADE_ACESSO" rename constraint "CK_IDENT_ACESSO_EMAIL_NORMALIZ" to "CK_IDENT_ACESSO_NO_EMAIL";
alter table sigav."TB_IDENTIDADE_ACESSO" rename constraint "CK_IDENT_ACESSO_REVOK_AT_VALID" to "CK_IDEN_ACES_ST_SITUA_DT_REVOG";
alter table sigav."TB_IDENTIDADE_ACESSO" rename constraint "CK_IDENT_ACESSO_STATUS_VALID" to "CK_IDENT_ACESSO_ST_SITUACAO";
alter table sigav."TB_IDENTIDADE_ACESSO" rename constraint "CK_IDENT_ACESSO_TYPE_VALID" to "CK_IDENT_ACESSO_TP_IDENTIDADE";
alter table sigav."TB_IDENTIDADE_ACESSO" rename constraint "UK_IDENT_ACESSO_EMAIL" to "UK_IDEN_ACES_SQ_PESSO_TP_IDENT";
alter table sigav."TB_RESULTADO_COMPET_CDDI" rename constraint "CK_RES_COMP_CDDI_VALUES_VALID" to "CK_RES_COMP_CDDI_VL_MEDI_COMP";
alter table sigav."TB_RESULTADO_COMPET_CDDI" rename constraint "UK_RES_COMP_CDDI_UNIQUE" to "UK_RES_COMP_CDDI_SQ_SUBMISSAO";

alter index sigav."IN_FK_BILHETE_ANON_ANON_PESSOA" rename to "IN_FK_BILHETE_ANON_SQ_PESSOA";
alter index sigav."IN_IDENT_ACESSO_IDX" rename to "IN_IDEN_ACES_SQ_PESSO_ST_SITUA";
alter index sigav."UK_IDENT_ACESSO_ACTIVE_EMAIL" rename to "UK_IDENT_ACESSO_NO_EMAIL_ATIVO";
alter index sigav."IN_FK_RES_COMP_CDDI_SECTION" rename to "IN_FK_RES_COM_CDD_SQ_SECA_COMP";

-- ---------------------------------------------------------------------------
-- 4. Funções que tocam estas colunas (12)
--
-- Cada substituição abaixo foi conferida contra a linha real da função. Onde o
-- nome da coluna é também chave JSON, ou pertence a outra tabela, a troca é
-- ancorada no alias — ou simplesmente não é feita.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sigav."FC_DEFINIR_PERMISSOES_PESSOA"(p_pessoa uuid, p_permissoes text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor_id uuid;
  v_person_name text;
  v_permissions text[];
  v_before text[];
  v_unknown text[];
  v_other_admins integer;
begin
  if sigav."FC_PAPEL_SESSAO"() is distinct from 'authenticated'
     or not sigav."FC_TEM_MODULO"('ADMIN_ACCESS') then
    raise exception 'Acesso restrito à administração de permissões.' using errcode = '42501';
  end if;

  v_actor_id := sigav."FC_PESSOA_SESSAO"();
  if v_actor_id is null then
    raise exception 'Sessão sem cadastro institucional vinculado.' using errcode = '42501';
  end if;

  select full_name
  into v_person_name
  from sigav."TB_PESSOA"
  where id = p_pessoa
    and active;

  if v_person_name is null then
    raise exception 'Pessoa ativa não encontrada.' using errcode = '22023';
  end if;

  select array_agg(distinct upper(btrim(item)) order by upper(btrim(item)))
  into v_unknown
  from unnest(coalesce(p_permissoes, array[]::text[])) item
  where btrim(item) <> ''
    and not exists (
      select 1
      from sigav."TB_MODULO_PLATAFORMA" pm
      where pm."CO_MODULO" = upper(btrim(item))
        and pm."ST_ATIVO"
    );

  if coalesce(cardinality(v_unknown), 0) > 0 then
    raise exception 'Permissões desconhecidas: %', array_to_string(v_unknown, ', ')
      using errcode = '22023';
  end if;

  select coalesce(array_agg(pm."CO_MODULO" order by pm."NU_ORDEM", pm."CO_MODULO"), array[]::text[])
  into v_permissions
  from sigav."TB_MODULO_PLATAFORMA" pm
  where pm."ST_ATIVO"
    and (
      pm."CO_MODULO" in ('HOME', 'SURVEYS')
      or pm."CO_MODULO" = any(array(
        select upper(btrim(item))
        from unnest(coalesce(p_permissoes, array[]::text[])) item
        where btrim(item) <> ''
      ))
    );

  v_before := sigav."FC_MODULOS_EFETIVOS"(p_pessoa);

  if p_pessoa = v_actor_id
     and not ('ADMIN_ACCESS' = any(v_permissions)) then
    raise exception 'Você não pode retirar sua própria permissão de administrar acessos.' using errcode = '42501';
  end if;

  if 'ADMIN_ACCESS' = any(v_before)
     and not ('ADMIN_ACCESS' = any(v_permissions)) then
    select count(*)::integer
    into v_other_admins
    from sigav."TB_PESSOA" p
    where p.active
      and p.id <> p_pessoa
      and 'ADMIN_ACCESS' = any(sigav."FC_MODULOS_EFETIVOS"(p.id));

    if v_other_admins = 0 then
      raise exception 'A plataforma precisa manter ao menos uma pessoa com administração de acessos.' using errcode = '42501';
    end if;
  end if;

  delete from sigav."RL_PESSOA_MODULO"
  where "SQ_PESSOA" = p_pessoa;

  insert into sigav."RL_PESSOA_MODULO" (
    "SQ_PESSOA",
    "CO_MODULO",
    "ST_PERMITIDO",
    "AU_USUARIO_CONCESSAO",
    "DT_INCLUSAO",
    "DT_ALTERACAO"
  )
  select
    p_pessoa,
    pm."CO_MODULO",
    pm."CO_MODULO" = any(v_permissions),
    v_actor_id,
    timezone('utc', now()),
    timezone('utc', now())
  from sigav."TB_MODULO_PLATAFORMA" pm
  where pm."ST_ATIVO";

  insert into sigav."TL_EVENTO_AUDITORIA" (
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'PERSON_PERMISSIONS_SET',
    'PERSON_MODULE_PERMISSION',
    p_pessoa::text,
    jsonb_build_object('permissions', to_jsonb(v_before)),
    jsonb_build_object(
      'personId', p_pessoa,
      'personName', v_person_name,
      'permissions', to_jsonb(v_permissions)
    ),
    jsonb_build_object('technicalRole', 'authenticated')
  );

  return jsonb_build_object(
    'status', 'OK',
    'personId', p_pessoa,
    'technicalRole', 'authenticated',
    'permissions', to_jsonb(v_permissions)
  );
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
            select 1 from sigav."RL_RESPOSTA_OPCAO" ao where ao.answer_id = a.id
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
      application_id,
      subject_person_id,
      auto_submission_id,
      auto_score,
      final_score,
      status,
      calculated_at
    ) values (
      v_submission.application_id,
      v_submission.subject_person_id,
      v_submission.id,
      v_final_score,
      null,
      'PARTIAL',
      null
    )
    on conflict (application_id, subject_person_id) do update
      set auto_submission_id = excluded.auto_submission_id,
          auto_score = excluded.auto_score,
          final_score = case
            when sigav."TB_RESULTADO_FINAL_CDDI".leader_score is null then null
            else round((excluded.auto_score * 0.40 + sigav."TB_RESULTADO_FINAL_CDDI".leader_score * 0.60)::numeric, 4)
          end,
          status = case
            when sigav."TB_RESULTADO_FINAL_CDDI".leader_score is null then 'PARTIAL'
            else 'CALCULATED'
          end,
          calculated_at = case
            when sigav."TB_RESULTADO_FINAL_CDDI".leader_score is null then null
            else v_submitted_at
          end,
          updated_at = now();
  else
    insert into sigav."TB_RESULTADO_FINAL_CDDI" (
      application_id,
      subject_person_id,
      leader_submission_id,
      leader_score,
      final_score,
      status,
      calculated_at
    ) values (
      v_submission.application_id,
      v_submission.subject_person_id,
      v_submission.id,
      v_final_score,
      null,
      'PARTIAL',
      null
    )
    on conflict (application_id, subject_person_id) do update
      set leader_submission_id = excluded.leader_submission_id,
          leader_score = excluded.leader_score,
          final_score = case
            when sigav."TB_RESULTADO_FINAL_CDDI".auto_score is null then null
            else round((sigav."TB_RESULTADO_FINAL_CDDI".auto_score * 0.40 + excluded.leader_score * 0.60)::numeric, 4)
          end,
          status = case
            when sigav."TB_RESULTADO_FINAL_CDDI".auto_score is null then 'PARTIAL'
            else 'CALCULATED'
          end,
          calculated_at = case
            when sigav."TB_RESULTADO_FINAL_CDDI".auto_score is null then null
            else v_submitted_at
          end,
          updated_at = now();
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
        (q.question_type in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE') and exists(select 1 from sigav."RL_RESPOSTA_OPCAO" ao where ao.answer_id = a.id))
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
      select jsonb_agg(ao.option_id order by ao.position) ids
      from sigav."RL_RESPOSTA_OPCAO" ao where ao.answer_id = a.id
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

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_ACESSOS_PAGINADOS"(p_busca text DEFAULT ''::text, p_limite integer DEFAULT 100, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_busca text := btrim(coalesce(p_busca, ''));
  v_limite integer := greatest(1, least(coalesce(p_limite, 100), 100));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_total bigint;
  v_people jsonb;
  v_permissions jsonb;
begin
  if sigav."FC_PAPEL_SESSAO"() is distinct from 'authenticated'
     or not sigav."FC_TEM_MODULO"('ADMIN_ACCESS') then
    raise exception 'Acesso restrito à administração de permissões.' using errcode = '42501';
  end if;

  select count(*)
  into v_total
  from sigav."TB_PESSOA" person
  where person.active
    and (
      v_busca = ''
      or sigav."FC_SEM_ACENTO_MINUSCULA"(person.full_name) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(v_busca) || '%'
      or coalesce(person.employee_number, '') ilike '%' || v_busca || '%'
      or coalesce(person.institutional_email, '') ilike '%' || v_busca || '%'
      or sigav."FC_SEM_ACENTO_MINUSCULA"(coalesce(person.job_title, '')) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(v_busca) || '%'
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', pm."CO_MODULO",
    'name', pm."NO_MODULO",
    'description', pm."DS_MODULO",
    'category', pm."TP_CATEGORIA",
    'position', pm."NU_ORDEM",
    'required', pm."CO_MODULO" in ('HOME', 'SURVEYS')
  ) order by pm."NU_ORDEM", pm."CO_MODULO"), '[]'::jsonb)
  into v_permissions
  from sigav."TB_MODULO_PLATAFORMA" pm
  where pm."ST_ATIVO";

  select coalesce(jsonb_agg(jsonb_build_object(
    'personId', person.id,
    'fullName', person.full_name,
    'employeeNumber', person.employee_number,
    'institutionalEmail', person.institutional_email,
    'jobTitle', person.job_title,
    'unit', coalesce(person.metadata->>'unit', person.cost_center),
    'active', person.active,
    'permissions', to_jsonb(sigav."FC_MODULOS_EFETIVOS"(person.id))
  ) order by person.full_name, person.id), '[]'::jsonb)
  into v_people
  from (
    select candidate.*
    from sigav."TB_PESSOA" candidate
    where candidate.active
      and (
        v_busca = ''
        or sigav."FC_SEM_ACENTO_MINUSCULA"(candidate.full_name) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(v_busca) || '%'
        or coalesce(candidate.employee_number, '') ilike '%' || v_busca || '%'
        or coalesce(candidate.institutional_email, '') ilike '%' || v_busca || '%'
        or sigav."FC_SEM_ACENTO_MINUSCULA"(coalesce(candidate.job_title, '')) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(v_busca) || '%'
      )
    order by candidate.full_name, candidate.id
    limit v_limite
    offset v_offset
  ) person;

  return jsonb_build_object(
    'status', 'OK',
    'technicalRole', 'authenticated',
    'permissions', v_permissions,
    'people', v_people,
    'total', v_total,
    'limit', v_limite,
    'offset', v_offset,
    'hasMore', v_offset + jsonb_array_length(v_people) < v_total
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_MODULOS_EFETIVOS"(target_person_id uuid)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select coalesce(
    array_agg(pm."CO_MODULO" order by pm."NU_ORDEM", pm."CO_MODULO")
      filter (where coalesce(
        pmp."ST_PERMITIDO",
        pm."CO_MODULO" in ('HOME', 'SURVEYS')
      )),
    array[]::text[]
  )
  from sigav."TB_PESSOA" p
  cross join sigav."TB_MODULO_PLATAFORMA" pm
  left join sigav."RL_PESSOA_MODULO" pmp
    on pmp."SQ_PESSOA" = p.id
   and pmp."CO_MODULO" = pm."CO_MODULO"
  where p.id = target_person_id
    and p.active
    and pm."ST_ATIVO";
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_PAINEL_MONITOR_CDDI_INT"(target_application_code text DEFAULT 'CDDI-2026'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_person_id uuid;
  v_application_id uuid;
  v_payload jsonb;
  v_scope text;
  -- Resolvidos UMA vez: usados dentro do filtro, eram avaliados por linha.
  v_pode_gerenciar boolean;
  v_e_lider boolean;
begin
  v_person_id := sigav."FC_PESSOA_SESSAO"();
  if v_person_id is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;

  select sa.id into v_application_id
  from sigav."TB_APLICACAO_PESQUISA" sa
  where sa.code = btrim(target_application_code)
  limit 1;

  if v_application_id is null then
    raise exception 'Ciclo de pesquisa não encontrado.';
  end if;

  v_pode_gerenciar := sigav."FC_PODE_GERIR_PESQUISA"();
  v_e_lider := sigav."FC_TEM_PAPEL_ATIVO"('LEADER');

  v_scope := case
    when v_pode_gerenciar then 'INSTITUTIONAL'
    when v_e_lider then 'TEAM'
    else 'INDIVIDUAL'
  end;

  with
  app as (
    select sa.*, sv.title as version_title, sv.version_number, s.name as survey_name
    from sigav."TB_APLICACAO_PESQUISA" sa
    join sigav."TH_VERSAO_PESQUISA" sv on sv.id = sa.survey_version_id
    join sigav."TB_PESQUISA" s on s.id = sv.survey_id
    where sa.id = v_application_id
  ),
  scoped_participants as (
    select
      ap.id as participant_id,
      ap.person_id,
      ap.status as participant_status,
      ap.started_at,
      ap.completed_at,
      p.employee_number,
      p.full_name,
      p.institutional_email,
      p.job_title,
      p.cost_center,
      p.workplace,
      p.metadata,
      coalesce(p.metadata->>'directorate', p.metadata->>'diretoria', 'SEM INFORMAÇÃO') as directorate,
      coalesce(p.metadata->>'unit', p.metadata->>'unidade', p.cost_center, 'SEM INFORMAÇÃO') as unit_name,
      coalesce(p.metadata->>'coordination', p.metadata->>'coordenacao', 'SEM INFORMAÇÃO') as coordination
    from sigav."RL_APLICACAO_PESSOA" ap
    join sigav."TB_PESSOA" p on p.id = ap.person_id
    where ap.application_id = v_application_id
      and ap.status not in ('BLOCKED', 'EXCLUDED')
      and (
        v_pode_gerenciar
        or ap.person_id = v_person_id
        or (
          v_e_lider and exists (
            select 1
            from sigav."RT_LIDERANCA_CDDI" l
            where l.application_id = v_application_id
              and l.leader_person_id = v_person_id
              and l.subordinate_person_id = ap.person_id
              and l.status = 'ACTIVE'
              and l.valid_to is null
          )
        )
      )
  ),
  active_leaders as (
    select distinct on (l.subordinate_person_id)
      l.subordinate_person_id,
      leader.full_name as manager_name,
      leader.institutional_email as manager_email
    from sigav."RT_LIDERANCA_CDDI" l
    join sigav."TB_PESSOA" leader on leader.id = l.leader_person_id
    where l.application_id = v_application_id
      and l.status = 'ACTIVE'
      and l.valid_to is null
    order by l.subordinate_person_id, l.valid_from desc
  ),
  latest_submissions as (
    select distinct on (coalesce(s.subject_person_id, s.respondent_person_id), upper(s.submission_type))
      s.*,
      coalesce(s.subject_person_id, s.respondent_person_id) as subject_id,
      upper(s.submission_type) as normalized_type
    from sigav."TB_SUBMISSAO" s
    join scoped_participants sp on sp.person_id = coalesce(s.subject_person_id, s.respondent_person_id)
    where s.application_id = v_application_id
      and upper(s.status) not in ('INVALIDATED', 'CANCELLED')
    order by coalesce(s.subject_person_id, s.respondent_person_id), upper(s.submission_type),
      (s.submitted_at is not null) desc, s.submitted_at desc nulls last, s.updated_at desc, s.version desc
  ),
  participant_rows as (
    select
      sp.*,
      al.manager_name,
      al.manager_email,
      auto.id as auto_submission_id,
      auto.status as auto_status,
      auto.submitted_at as auto_submitted_at,
      auto.calculated_result as auto_score,
      leader.id as leader_submission_id,
      leader.status as leader_status,
      leader.submitted_at as leader_submitted_at,
      leader.calculated_result as leader_score,
      fr.final_score,
      fr.status as final_status,
      fr.calculated_at,
      case when upper(coalesce(auto.status, '')) in ('SUBMITTED', 'VALIDATED') then true else false end as auto_completed,
      case when upper(coalesce(leader.status, '')) in ('SUBMITTED', 'VALIDATED') then true else false end as leader_completed
    from scoped_participants sp
    left join active_leaders al on al.subordinate_person_id = sp.person_id
    left join latest_submissions auto on auto.subject_id = sp.person_id and auto.normalized_type in ('AUTO', 'AUTOAVALIACAO', 'SELF')
    left join latest_submissions leader on leader.subject_id = sp.person_id and leader.normalized_type in ('CHEFIA', 'LEADER', 'MANAGER')
    left join lateral (
      select r.*
      from sigav."TB_RESULTADO_FINAL_CDDI" r
      where r.application_id = v_application_id and r.subject_person_id = sp.person_id
        and upper(r.status) <> 'INVALIDATED'
      order by r.calculated_at desc, r.updated_at desc
      limit 1
    ) fr on true
  ),
  competencies as (
    select sec.id, sec.code, sec.title, sec.position
    from sigav."TB_SECAO_PESQUISA" sec
    join app on app.survey_version_id = sec.survey_version_id
    where sec.code ~ '^C[0-9]{2}$'
    order by sec.position
  ),
  competency_values as (
    select
      ls.subject_id as person_id,
      c.code as competency_code,
      c.title as competency_name,
      c.position,
      max(cr."VL_RESULTADO") filter (where ls.normalized_type in ('AUTO', 'AUTOAVALIACAO', 'SELF')) as auto_score,
      max(cr."VL_RESULTADO") filter (where ls.normalized_type in ('CHEFIA', 'LEADER', 'MANAGER')) as leader_score
    from latest_submissions ls
    join sigav."TB_RESULTADO_COMPET_CDDI" cr on cr."SQ_SUBMISSAO" = ls.id
    join competencies c on c.id = cr."SQ_SECAO_COMPETENCIA"
    group by ls.subject_id, c.code, c.title, c.position
  ),
  event_rows as (
    select
      coalesce(s.subject_person_id, s.respondent_person_id) as person_id,
      upper(s.submission_type) as submission_type,
      s.status,
      s.submitted_at,
      s.version,
      s.metadata
    from sigav."TB_SUBMISSAO" s
    join scoped_participants sp on sp.person_id = coalesce(s.subject_person_id, s.respondent_person_id)
    where s.application_id = v_application_id
      and s.submitted_at is not null
      and upper(s.status) not in ('INVALIDATED', 'CANCELLED')
  )
  select jsonb_build_object(
    'status', 'OK',
    'scope', v_scope,
    'generatedAt', timezone('utc', now()),
    'weights', jsonb_build_object('auto', 0.40, 'leader', 0.60),
    'application', (
      select jsonb_build_object(
        'id', id,
        'code', code,
        'name', name,
        'surveyName', survey_name,
        'versionTitle', version_title,
        'versionNumber', version_number,
        'status', status,
        'opensAt', opens_at,
        'closesAt', closes_at
      ) from app
    ),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'personId', pr.person_id,
        'participantId', pr.participant_id,
        'employeeNumber', pr.employee_number,
        'fullName', pr.full_name,
        'institutionalEmail', pr.institutional_email,
        'jobTitle', pr.job_title,
        'directorate', pr.directorate,
        'unit', pr.unit_name,
        'coordination', pr.coordination,
        'workplace', pr.workplace,
        'managerName', pr.manager_name,
        'managerEmail', pr.manager_email,
        'participantStatus', pr.participant_status,
        'startedAt', pr.started_at,
        'completedAt', pr.completed_at,
        'autoStatus', pr.auto_status,
        'autoSubmittedAt', pr.auto_submitted_at,
        'autoScore', pr.auto_score,
        'leaderStatus', pr.leader_status,
        'leaderSubmittedAt', pr.leader_submitted_at,
        'leaderScore', pr.leader_score,
        'finalScore', pr.final_score,
        'finalStatus', pr.final_status,
        'calculatedAt', pr.calculated_at,
        'autoCompleted', pr.auto_completed,
        'leaderCompleted', pr.leader_completed
      ) order by pr.full_name) from participant_rows pr
    ), '[]'::jsonb),
    'competencies', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'code', code, 'name', title, 'position', position) order by position)
      from competencies
    ), '[]'::jsonb),
    'competencyScores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'personId', person_id,
        'competencyCode', competency_code,
        'competencyName', competency_name,
        'position', position,
        'autoScore', auto_score,
        'leaderScore', leader_score,
        'finalScore', case when auto_score is not null and leader_score is not null then round((auto_score * 0.40 + leader_score * 0.60)::numeric, 2) else null end
      ) order by person_id, position)
      from competency_values
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'personId', person_id,
        'submissionType', submission_type,
        'status', status,
        'submittedAt', submitted_at,
        'version', version,
        'metadata', metadata
      ) order by submitted_at)
      from event_rows
    ), '[]'::jsonb)
  ) into v_payload;

  return v_payload;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_REIVINDICAR_ACESSO"()
 RETURNS TABLE(status text, person_id uuid, full_name text, employee_number text, access_profile text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := sigav."FC_UID_SESSAO"();
  v_email text := lower(btrim(coalesce(sigav."FC_CLAIMS_SESSAO"() ->> 'email', '')));
  v_person sigav."TB_PESSOA"%rowtype;
  v_identity sigav."TB_IDENTIDADE_ACESSO"%rowtype;
  v_access_profile text;
begin
  if v_uid is null then
    return query select 'UNAUTHENTICATED'::text, null::uuid, null::text, null::text, null::text;
    return;
  end if;

  if v_email = '' or right(v_email, length('@agenciasus.org.br')) <> '@agenciasus.org.br' then
    return query select 'DOMAIN_NOT_ALLOWED'::text, null::uuid, null::text, null::text, null::text;
    return;
  end if;

  select pai.*
    into v_identity
  from sigav."TB_IDENTIDADE_ACESSO" pai
  where lower(pai."NO_EMAIL") = v_email
    and pai."TP_IDENTIDADE" = 'INSTITUTIONAL_EMAIL'
    and pai."ST_SITUACAO" in ('PENDING', 'ACTIVE')
    and pai."DT_REVOGACAO" is null
  order by case when pai."ST_SITUACAO" = 'ACTIVE' then 0 else 1 end, pai."DT_INCLUSAO"
  limit 1;

  if v_identity."SQ_IDENTIDADE" is null then
    return query select 'IDENTITY_NOT_FOUND'::text, null::uuid, null::text, null::text, null::text;
    return;
  end if;

  select p.*
    into v_person
  from sigav."TB_PESSOA" p
  where p.id = v_identity."SQ_PESSOA"
    and p.active = true;

  if v_person.id is null then
    return query select 'PERSON_INACTIVE'::text, null::uuid, null::text, null::text, null::text;
    return;
  end if;

  if v_person.auth_user_id is not null and v_person.auth_user_id <> v_uid then
    return query select 'IDENTITY_CONFLICT'::text, null::uuid, null::text, null::text, null::text;
    return;
  end if;

  update sigav."TB_PESSOA"
     set auth_user_id = v_uid,
         updated_at = timezone('utc', now())
   where id = v_person.id;

  update sigav."TB_IDENTIDADE_ACESSO"
     set "ST_SITUACAO" = 'ACTIVE',
         "DT_VERIFICACAO" = coalesce("DT_VERIFICACAO", timezone('utc', now())),
         "DT_ALTERACAO" = timezone('utc', now())
   where "SQ_IDENTIDADE" = v_identity."SQ_IDENTIDADE";

  select ap.access_profile
    into v_access_profile
  from sigav."RL_APLICACAO_PESSOA" ap
  join sigav."TB_APLICACAO_PESQUISA" sa on sa.id = ap.application_id
  where ap.person_id = v_person.id
    and sa.code = 'CDDI-2026'
  order by ap.created_at desc
  limit 1;

  return query
  select
    'CLAIMED'::text,
    v_person.id,
    v_person.full_name,
    v_person.employee_number,
    coalesce(v_access_profile, 'USUARIO_COMUM');
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
  select coalesce(array_agg(id), '{}')
  into v_resultados
  from sigav."TB_RESULTADO_FINAL_CDDI"
  where auto_submission_id = p_submissao or leader_submission_id = p_submissao;

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
    set status = 'INVALIDATED',
        auto_score = null,
        leader_score = null,
        final_score = null,
        published_at = null,
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'invalidatedBy', v_pessoa,
          'invalidatedAt', now(),
          'invalidationReason', v_motivo,
          'invalidationSource', 'SUBMISSION_' || v_modo
        )
    where id = any(v_resultados);
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
    update sigav."TB_RESULTADO_FINAL_CDDI" set auto_submission_id = null where auto_submission_id = p_submissao;
    update sigav."TB_RESULTADO_FINAL_CDDI" set leader_submission_id = null where leader_submission_id = p_submissao;
    delete from sigav."RL_RESPOSTA_OPCAO" where answer_id in (
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

CREATE OR REPLACE FUNCTION sigav."FC_RESOLVER_PESSOA_AUTENTIC"(target_employee_number text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_auth uuid := sigav."FC_UID_SESSAO"();
  v_email text := lower(btrim(coalesce(sigav."FC_CLAIMS_SESSAO"()->>'email','')));
  v_name text := nullif(btrim(coalesce(
    sigav."FC_CLAIMS_SESSAO"()#>>'{user_metadata,full_name}',
    sigav."FC_CLAIMS_SESSAO"()#>>'{user_metadata,name}',
    split_part(v_email,'@',1)
  )), '');
  v_avatar text := nullif(btrim(coalesce(
    sigav."FC_CLAIMS_SESSAO"()#>>'{user_metadata,avatar_url}',
    sigav."FC_CLAIMS_SESSAO"()#>>'{user_metadata,picture}',
    sigav."FC_CLAIMS_SESSAO"()#>>'{user_metadata,photo_url}',
    ''
  )), '');
  v_person sigav."TB_PESSOA"%rowtype;
  v_count integer := 0;
  v_employee text;
begin
  if v_auth is null then
    return jsonb_build_object('status','AUTH_REQUIRED','message','Autenticação necessária.');
  end if;

  if not sigav."FC_EMAIL_INSTITUC_PERMITIDO"(v_email) then
    return jsonb_build_object('status','INVALID_DOMAIN','message','Utilize uma conta institucional AgSUS autorizada.');
  end if;

  select * into v_person
  from sigav."TB_PESSOA"
  where auth_user_id = v_auth and active
  limit 1;

  if v_person.id is null then
    select count(*) into v_count
    from sigav."TB_PESSOA"
    where active
      and lower(btrim(coalesce(institutional_email,''))) = v_email
      and (target_employee_number is null or employee_number = btrim(target_employee_number));

    if v_count > 1 and target_employee_number is null then
      return jsonb_build_object('status','NEEDS_EMPLOYEE_NUMBER','message','Há mais de um cadastro associado ao e-mail. Informe sua matrícula.');
    end if;

    select * into v_person
    from sigav."TB_PESSOA"
    where active
      and lower(btrim(coalesce(institutional_email,''))) = v_email
      and (target_employee_number is null or employee_number = btrim(target_employee_number))
    order by (auth_user_id is null) desc, created_at
    limit 1;
  end if;

  if v_person.id is null then
    select p.* into v_person
    from sigav."TB_IDENTIDADE_ACESSO" pai
    join sigav."TB_PESSOA" p on p.id = pai."SQ_PESSOA"
    where lower(pai."NO_EMAIL") = v_email
      and pai."ST_SITUACAO" in ('PENDING','ACTIVE')
      and p.active
      and (target_employee_number is null or p.employee_number = btrim(target_employee_number))
    order by pai."ST_SITUACAO" = 'ACTIVE' desc, pai."DT_INCLUSAO"
    limit 1;
  end if;

  if v_person.id is null then
    v_employee := 'AUTH-' || upper(substr(replace(v_auth::text,'-',''),1,20));
    insert into sigav."TB_PESSOA"(
      auth_user_id, employee_number, full_name, institutional_email,
      employment_status, active, source_system, source_key, metadata
    ) values (
      v_auth, v_employee, coalesce(v_name,v_email), v_email,
      'ATIVO', true, 'SUPABASE_AUTH', v_auth::text,
      jsonb_strip_nulls(jsonb_build_object(
        'provisioning','INSTITUTIONAL_DOMAIN',
        'provisioned_at',timezone('utc',now()),
        'avatar_url',v_avatar,
        'avatar_source',case when v_avatar is null then 'INITIALS' else 'GOOGLE' end,
        'google_avatar_url',v_avatar
      ))
    ) returning * into v_person;
  else
    if v_person.auth_user_id is not null and v_person.auth_user_id <> v_auth then
      return jsonb_build_object('status','ALREADY_LINKED','message','Este cadastro já está vinculado a outra conta autenticada.');
    end if;

    update sigav."TB_PESSOA"
    set auth_user_id = v_auth,
        institutional_email = coalesce(nullif(btrim(institutional_email),''),v_email),
        full_name = case
          when source_system = 'SUPABASE_AUTH' and v_name is not null then v_name
          else full_name
        end,
        metadata = coalesce(metadata,'{}'::jsonb)
          || case when v_avatar is null then '{}'::jsonb else jsonb_build_object('google_avatar_url',v_avatar) end
          || case
               when v_avatar is not null and coalesce(metadata->>'avatar_source','') not in ('UPLOADED','GENERATED')
                 then jsonb_build_object('avatar_url',v_avatar,'avatar_source','GOOGLE')
               else '{}'::jsonb
             end,
        updated_at = timezone('utc',now())
    where id = v_person.id
    returning * into v_person;
  end if;

  insert into sigav."TB_IDENTIDADE_ACESSO"(
    "SQ_PESSOA", "TP_IDENTIDADE", "NO_EMAIL", "ST_SITUACAO", "NO_ORIGEM", "DT_VERIFICACAO", "DS_METADADO"
  ) values (
    v_person.id, 'INSTITUTIONAL_EMAIL', v_email, 'ACTIVE', 'SUPABASE_AUTH', timezone('utc',now()),
    jsonb_build_object('auth_user_id',v_auth)
  )
  on conflict("SQ_PESSOA","TP_IDENTIDADE","NO_EMAIL") do update
  set "ST_SITUACAO"='ACTIVE',
      "DT_VERIFICACAO"=coalesce(sigav."TB_IDENTIDADE_ACESSO"."DT_VERIFICACAO",excluded."DT_VERIFICACAO"),
      "DT_REVOGACAO"=null,
      "DT_ALTERACAO"=timezone('utc',now());

  return jsonb_build_object(
    'status','OK',
    'person',jsonb_build_object(
      'id',v_person.id,
      'employeeNumber',v_person.employee_number,
      'fullName',v_person.full_name,
      'institutionalEmail',v_person.institutional_email,
      'jobTitle',v_person.job_title,
      'costCenter',v_person.cost_center,
      'workplace',v_person.workplace,
      'metadata',v_person.metadata,
      'avatarUrl',coalesce(v_person.metadata->>'avatar_url',v_person.metadata->>'picture',v_person.metadata->>'photo_url')
    )
  );
end
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SINCRONIZAR_ESTADO_CICLOS"()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav', 'auth'
AS $function$
begin
  -- 1. Fechar o que venceu.
  --
  -- Vem antes da abertura de propósito: um SCHEDULED cuja janela inteira já
  -- passou fecha aqui e some do passo seguinte, gerando uma transição só e um
  -- evento só. Fosse o contrário, ele seria aberto para fechar em seguida.
  --
  -- `for update skip locked` é o que sustenta a idempotência sob concorrência.
  -- A sincronização é preguiçosa: cinco funções a disparam, e duas requisições
  -- simultâneas veriam a mesma linha vencida. Sem o lock, ambas gravariam
  -- SURVEY_CYCLE_AUTO_CLOSE para a mesma transição. Com ele, quem chega depois
  -- pula a linha que já está sendo tratada — o fechamento acontece uma vez.
  with alvos as (
    select sa.id, sa.code, sa.status as status_anterior, sa.opens_at, sa.closes_at
    from sigav."TB_APLICACAO_PESQUISA" sa
    where sa.closes_at is not null
      and sa.closes_at <= now()
      and sa.status in ('OPEN', 'SCHEDULED')
    for update skip locked
  ), fechados as (
    update sigav."TB_APLICACAO_PESQUISA" sa
    set status = 'CLOSED',
        updated_at = now()
    from alvos
    where sa.id = alvos.id
    returning sa.id, sa.code, alvos.status_anterior, sa.opens_at, sa.closes_at
  )
  insert into sigav."TL_EVENTO_AUDITORIA"(
    actor_person_id, event_type, entity_type, entity_id, application_id,
    before_data, after_data, metadata
  )
  select
    -- Não houve ator humano. Registrar um seria inventar responsável.
    null,
    'SURVEY_CYCLE_AUTO_CLOSE',
    'SURVEY_APPLICATION',
    fechados.id::text,
    fechados.id,
    jsonb_build_object('applicationStatus', fechados.status_anterior),
    jsonb_build_object('applicationStatus', 'CLOSED'),
    jsonb_build_object(
      'applicationCode', fechados.code,
      'opensAt', fechados.opens_at,
      'closesAt', fechados.closes_at,
      'reason', 'closes_at_reached'
    )
  from fechados;

  -- 2. Abrir o que chegou a hora. Lógica preservada de
  -- `FC_ABRIR_CICLOS_AGENDADOS()` sem alteração de comportamento.
  with abertos as (
    update sigav."TB_APLICACAO_PESQUISA" sa
    set status = 'OPEN',
        updated_at = now()
    where sa.status = 'SCHEDULED'
      and sa.opens_at is not null
      and sa.opens_at <= now()
      and sa.closes_at is not null
      and sa.closes_at > now()
      and exists (
        select 1
        from sigav."TH_VERSAO_PESQUISA" sv
        where sv.id = sa.survey_version_id
          and sv.status = 'PUBLISHED'
      )
    returning sa.id, sa.code, sa.survey_version_id, sa.opens_at, sa.closes_at
  )
  insert into sigav."TL_EVENTO_AUDITORIA"(
    actor_person_id, event_type, entity_type, entity_id, application_id,
    before_data, after_data, metadata
  )
  select
    null,
    'SURVEY_CYCLE_AUTO_OPEN',
    'SURVEY_APPLICATION',
    abertos.id::text,
    abertos.id,
    jsonb_build_object('applicationStatus', 'SCHEDULED'),
    jsonb_build_object('applicationStatus', 'OPEN'),
    jsonb_build_object(
      'applicationCode', abertos.code,
      'versionId', abertos.survey_version_id,
      'opensAt', abertos.opens_at,
      'closesAt', abertos.closes_at,
      'reason', 'opens_at_reached'
    )
  from abertos;

  -- 3. Purga de bilhetes anônimos. Preservada como estava.
  --
  -- Ciclo encerrado — por ação administrativa ou porque a data passou — não tem
  -- mais rascunho a retomar. O que resta do bilhete é só o vínculo.
  with purgados as (
    delete from sigav."TB_BILHETE_ANONIMO" b
    using sigav."TB_APLICACAO_PESQUISA" sa
    where sa.id = b."SQ_APLICACAO"
      and (
        sa.status in ('CLOSED', 'CANCELLED')
        or (sa.closes_at is not null and sa.closes_at <= now())
      )
    returning b."SQ_APLICACAO"
  ), totais as (
    select "SQ_APLICACAO", count(*)::integer as quantidade
    from purgados
    group by "SQ_APLICACAO"
  )
  insert into sigav."TL_EVENTO_AUDITORIA"(
    actor_person_id, event_type, entity_type, entity_id, application_id,
    before_data, after_data, metadata
  )
  select
    null,
    'ANONYMOUS_TICKET_PURGED',
    'SURVEY_APPLICATION',
    totais."SQ_APLICACAO"::text,
    totais."SQ_APLICACAO",
    '{}'::jsonb,
    '{}'::jsonb,
    -- Só a contagem. Registrar a pessoa aqui desfaria a purga no próprio log.
    jsonb_build_object('ticketsPurged', totais.quantidade, 'reason', 'cycle_closed')
  from totais;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SINCR_LINHAS_BASE_PESSOA"(p_rows jsonb, p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_row jsonb;
  v_person sigav."TB_PESSOA"%rowtype;
  v_manager sigav."TB_PESSOA"%rowtype;
  v_employee text;
  v_email text;
  v_status text;
  v_active boolean;
  v_source_key text;
  v_manager_email text;
  v_manager_name text;
  v_admission_date text;
  v_import_metadata jsonb;
  v_inserted integer := 0;
  v_updated integer := 0;
  v_identity_count integer := 0;
  v_link_count integer := 0;
  v_application_id uuid;
begin
  if sigav."FC_PAPEL_SESSAO"() <> 'service_role' and not sigav."FC_PODE_GERIR_PESQUISA"() then raise exception 'Seu perfil não possui permissão para atualizar a base de pessoas.'; end if;
  if jsonb_typeof(p_rows) <> 'array' then raise exception 'O conteúdo da importação deve ser uma lista de pessoas.'; end if;
  select id into v_application_id from sigav."TB_APLICACAO_PESQUISA" where code='CDDI-2026' limit 1;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_employee := btrim(coalesce(v_row->>'employeeNumber',''));
    v_email := lower(btrim(coalesce(v_row->>'institutionalEmail','')));
    v_status := upper(btrim(coalesce(v_row->>'status','ATIVO')));
    v_source_key := nullif(btrim(coalesce(v_row->>'participantKey',v_employee)),'');
    v_manager_email := lower(btrim(coalesce(v_row->>'managerEmail','')));
    v_manager_name := btrim(coalesce(v_row->>'managerName',''));
    v_admission_date := btrim(coalesce(v_row->>'admissionDate',''));
    if v_employee='' or btrim(coalesce(v_row->>'fullName',''))='' then raise exception 'Matrícula e nome são obrigatórios em todas as linhas.'; end if;
    v_active := v_status in ('ATIVO','NORMAL','ACTIVE','EM EXERCICIO','EM EXERCÍCIO');
    if v_status='' then v_active:=true; end if;

    select * into v_person from sigav."TB_PESSOA" p where p.employee_number=v_employee or (v_email<>'' and lower(btrim(coalesce(p.institutional_email,'')))=v_email) order by (p.employee_number=v_employee) desc,(p.auth_user_id is not null) desc,p.created_at limit 1 for update;
    v_import_metadata := jsonb_strip_nulls(jsonb_build_object(
      'detailed_status',nullif(btrim(coalesce(v_row->>'detailedStatus','')),''),
      'directorate',nullif(btrim(coalesce(v_row->>'directorate','')),''),
      'unit',nullif(btrim(coalesce(v_row->>'unit','')),''),
      'coordination',nullif(btrim(coalesce(v_row->>'coordination','')),''),
      'admission_date',nullif(v_admission_date,''),
      'manager_name',nullif(v_manager_name,''),
      'manager_email',nullif(v_manager_email,''),
      'source_row',nullif(v_row->>'rowNumber',''),
      'last_import_batch_id',p_batch_id,
      'last_imported_at',timezone('utc',now())
    ));

    if v_person.id is null then
      insert into sigav."TB_PESSOA"(employee_number,full_name,institutional_email,job_title,cost_center,workplace,employment_status,active,source_system,source_key,metadata)
      values(v_employee,btrim(v_row->>'fullName'),nullif(v_email,''),nullif(btrim(coalesce(v_row->>'jobTitle','')),''),nullif(btrim(coalesce(v_row->>'costCenter','')),''),nullif(btrim(coalesce(v_row->>'workplace','')),''),coalesce(nullif(v_status,''),'ATIVO'),v_active,'AGSUS_PEOPLE_BASE',coalesce(v_source_key,v_employee),v_import_metadata)
      returning * into v_person; v_inserted:=v_inserted+1;
    else
      update sigav."TB_PESSOA" set employee_number=v_employee,full_name=btrim(v_row->>'fullName'),institutional_email=coalesce(nullif(v_email,''),institutional_email),job_title=nullif(btrim(coalesce(v_row->>'jobTitle','')),''),cost_center=nullif(btrim(coalesce(v_row->>'costCenter','')),''),workplace=nullif(btrim(coalesce(v_row->>'workplace','')),''),employment_status=coalesce(nullif(v_status,''),employment_status,'ATIVO'),active=v_active,source_system=case when auth_user_id is null then 'AGSUS_PEOPLE_BASE' else source_system end,source_key=case when auth_user_id is null then coalesce(v_source_key,v_employee) else source_key end,metadata=coalesce(metadata,'{}'::jsonb)||v_import_metadata,updated_at=timezone('utc',now()) where id=v_person.id returning * into v_person; v_updated:=v_updated+1;
    end if;

    if v_email<>'' and coalesce((v_row->>'emailEligibleForAccess')::boolean,false) then
      insert into sigav."TB_IDENTIDADE_ACESSO"("SQ_PESSOA","TP_IDENTIDADE","NO_EMAIL","ST_SITUACAO","NO_ORIGEM","DS_METADADO")
      values(v_person.id,'INSTITUTIONAL_EMAIL',v_email,case when v_person.auth_user_id is null then 'PENDING' else 'ACTIVE' end,'AGSUS_PEOPLE_BASE',jsonb_build_object('import_batch_id',p_batch_id))
      on conflict("SQ_PESSOA","TP_IDENTIDADE","NO_EMAIL") do update set "ST_SITUACAO"=case when v_person.auth_user_id is null then sigav."TB_IDENTIDADE_ACESSO"."ST_SITUACAO" else 'ACTIVE' end,"DT_REVOGACAO"=null,"DS_METADADO"=coalesce(sigav."TB_IDENTIDADE_ACESSO"."DS_METADADO",'{}'::jsonb)||jsonb_build_object('import_batch_id',p_batch_id),"DT_ALTERACAO"=timezone('utc',now()); v_identity_count:=v_identity_count+1;
    end if;

    if v_application_id is not null and v_manager_email<>'' and v_manager_email<>v_email then
      select * into v_manager from sigav."TB_PESSOA" where lower(btrim(coalesce(institutional_email,'')))=v_manager_email order by (auth_user_id is not null) desc,created_at limit 1;
      if v_manager.id is null then
        insert into sigav."TB_PESSOA"(employee_number,full_name,institutional_email,employment_status,active,source_system,source_key,metadata)
        values('LIDER-'||upper(substr(md5(v_manager_email),1,16)),coalesce(nullif(v_manager_name,''),v_manager_email),v_manager_email,'ATIVO',true,'AGSUS_LEADERSHIP_REFERENCE',v_manager_email,jsonb_build_object('leadership_reference',true,'evaluation_exempt',true,'manager_email',v_manager_email,'created_from_import_batch',p_batch_id))
        returning * into v_manager;
      end if;
      if not coalesce((v_manager.metadata->>'evaluation_exempt')::boolean,false) and v_manager.source_system='AGSUS_LEADERSHIP_REFERENCE' then
        update sigav."TB_PESSOA" set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('leadership_reference',true,'evaluation_exempt',true),updated_at=timezone('utc',now()) where id=v_manager.id returning * into v_manager;
      end if;
      if not exists(select 1 from sigav."RT_LIDERANCA_CDDI" where application_id=v_application_id and subordinate_person_id=v_person.id and status='ACTIVE' and valid_to is null and origin='ADMIN_CORRECTION') then
        update sigav."RT_LIDERANCA_CDDI" set status='ENDED',valid_to=timezone('utc',now()),updated_at=timezone('utc',now()) where application_id=v_application_id and subordinate_person_id=v_person.id and status='ACTIVE' and valid_to is null and leader_person_id<>v_manager.id;
        insert into sigav."RT_LIDERANCA_CDDI"(application_id,leader_person_id,subordinate_person_id,status,valid_from,origin,source_key,metadata)
        values(v_application_id,v_manager.id,v_person.id,'ACTIVE',timezone('utc',now()),'PEOPLE_BASE_IMPORT',v_employee,jsonb_build_object('import_batch_id',p_batch_id,'manager_email',v_manager_email))
        on conflict(application_id,source_key) do update set leader_person_id=excluded.leader_person_id,subordinate_person_id=excluded.subordinate_person_id,status='ACTIVE',valid_to=null,origin='PEOPLE_BASE_IMPORT',metadata=coalesce(sigav."RT_LIDERANCA_CDDI".metadata,'{}'::jsonb)||excluded.metadata,updated_at=timezone('utc',now());
        v_link_count:=v_link_count+1;
      end if;
    end if;
  end loop;

  return jsonb_build_object('status','OK','inserted',v_inserted,'updated',v_updated,'identitiesProcessed',v_identity_count,'leadershipLinksProcessed',v_link_count,'processed',v_inserted+v_updated);
end;$function$;

-- ---------------------------------------------------------------------------
-- 3. Autoverificação
-- ---------------------------------------------------------------------------

do $verificacao$
declare
  v_tabelas text[] := array['TB_BILHETE_ANONIMO', 'TB_IDENTIDADE_ACESSO', 'TB_MODULO_PLATAFORMA', 'TB_RESULTADO_COMPET_CDDI'];
  v_revisadas text[] := array['FC_ENVIAR_SUBMISSAO_PESQUISA', 'FC_INICIAR_OU_RETOMAR_PESQ', 'FC_SINCRONIZAR_ESTADO_CICLOS', 'FC_REIVINDICAR_ACESSO', 'FC_RESOLVER_PESSOA_AUTENTIC', 'FC_SINCR_LINHAS_BASE_PESSOA', 'FC_MODULOS_EFETIVOS', 'FC_DEFINIR_PERMISSOES_PESSOA', 'FC_LISTAR_ACESSOS_PAGINADOS', 'FC_ENVIAR_SUBMISSAO_CDDI', 'FC_PAINEL_MONITOR_CDDI_INT', 'FC_REMOVER_RESPOSTA_PESSOA'];
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
  select string_agg(distinct p.proname, ', ' order by p.proname) into v_fora
    from pg_proc p, unnest(v_tabelas) t(tabela)
   where p.pronamespace = 'sigav'::regnamespace
     and not (p.proname = any(v_revisadas))
     and regexp_replace(pg_get_functiondef(p.oid), '^[[:space:]]*--.*$', '', 'gn')
         ~ ('sigav[.]"' || t.tabela || '"');
  if v_fora is not null then
    raise exception 'Funcoes tocam tabelas deste lote e nao foram revisadas: %', v_fora;
  end if;

  raise notice 'nomenclatura lote 3: 32 colunas em 4 tabelas';
end
$verificacao$;

commit;
