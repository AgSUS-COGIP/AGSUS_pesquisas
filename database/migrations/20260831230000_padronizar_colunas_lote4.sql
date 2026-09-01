-- Colunas no padrão institucional — LOTE 4.
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
-- RISCO DESTE LOTE: 16 função(ões) referenciam estas 3 tabelas, e cada
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
-- 37 colunas, 20 constraints, 11 índices.

begin;

-- ---------------------------------------------------------------------------
-- 1. Colunas (item 7)
-- ---------------------------------------------------------------------------

-- TB_ARQUIVO
alter table sigav."TB_ARQUIVO" rename column sq_arquivo to "SQ_ARQUIVO";
alter table sigav."TB_ARQUIVO" rename column co_balde to "CO_BALDE";
alter table sigav."TB_ARQUIVO" rename column ds_caminho to "DS_CAMINHO";
alter table sigav."TB_ARQUIVO" rename column tp_conteudo to "TP_CONTEUDO";
alter table sigav."TB_ARQUIVO" rename column nu_tamanho to "NU_TAMANHO";
alter table sigav."TB_ARQUIVO" rename column im_conteudo to "IM_CONTEUDO";
alter table sigav."TB_ARQUIVO" rename column co_autor to "CO_AUTOR";
alter table sigav."TB_ARQUIVO" rename column dt_criacao to "DT_INCLUSAO";
alter table sigav."TB_ARQUIVO" rename column dt_atualizacao to "DT_ALTERACAO";

-- TL_EMAIL_PARTICIPANTE
alter table sigav."TL_EMAIL_PARTICIPANTE" rename column sq_email to "SQ_EMAIL";
alter table sigav."TL_EMAIL_PARTICIPANTE" rename column sq_aplicacao to "SQ_APLICACAO";
alter table sigav."TL_EMAIL_PARTICIPANTE" rename column sq_pessoa to "SQ_PESSOA";
alter table sigav."TL_EMAIL_PARTICIPANTE" rename column tp_email to "TP_EMAIL";
alter table sigav."TL_EMAIL_PARTICIPANTE" rename column st_envio to "ST_ENVIO";
alter table sigav."TL_EMAIL_PARTICIPANTE" rename column ds_erro to "DS_ERRO";
alter table sigav."TL_EMAIL_PARTICIPANTE" rename column dt_envio to "DT_ENVIO";
alter table sigav."TL_EMAIL_PARTICIPANTE" rename column dt_criacao to "DT_INCLUSAO";
alter table sigav."TL_EMAIL_PARTICIPANTE" rename column dt_atualizacao to "DT_ALTERACAO";
alter table sigav."TL_EMAIL_PARTICIPANTE" rename column co_reivindicacao to "CO_REIVINDICACAO";
alter table sigav."TL_EMAIL_PARTICIPANTE" rename column nu_tentativas to "NU_TENTATIVAS";
alter table sigav."TL_EMAIL_PARTICIPANTE" rename column co_message_id to "CO_MENSAGEM_SMTP";
alter table sigav."TL_EMAIL_PARTICIPANTE" rename column dt_transporte to "DT_TRANSPORTE";

-- TB_RESULTADO_FINAL_CDDI
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename column id to "SQ_RESULTADO";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename column application_id to "SQ_APLICACAO";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename column subject_person_id to "SQ_PESSOA_AVALIADA";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename column auto_submission_id to "SQ_SUBMISSAO_AUTO";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename column leader_submission_id to "SQ_SUBMISSAO_LIDER";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename column auto_score to "VL_NOTA_AUTO";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename column leader_score to "VL_NOTA_LIDER";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename column final_score to "VL_NOTA_FINAL";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename column status to "ST_SITUACAO";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename column calculation_version to "CO_VERSAO_CALCULO";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename column calculated_at to "DT_CALCULO";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename column published_at to "DT_PUBLICACAO";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename column metadata to "DS_METADADO";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename column created_at to "DT_INCLUSAO";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename column updated_at to "DT_ALTERACAO";

-- ---------------------------------------------------------------------------
-- 2. Constraints e índices, realinhados à coluna nova (item 8)
-- ---------------------------------------------------------------------------

alter table sigav."TB_ARQUIVO" rename constraint "CK_ARQUIVO_BALDE" to "CK_ARQUIVO_CO_BALDE";
alter table sigav."TB_ARQUIVO" rename constraint "CK_ARQUIVO_TAMANHO" to "CK_ARQUIVO_NU_TAMANHO";
alter table sigav."TB_ARQUIVO" rename constraint "CK_ARQUIVO_TIPO" to "CK_ARQUIVO_TP_CONTEUDO";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename constraint "CK_RES_FINAL_CDDI_PUBLIS_VALID" to "CK_RES_FIN_CDD_ST_SITU_DT_PUBL";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename constraint "CK_RES_FINAL_CDDI_SCORE_VALID" to "CK_RES_FINAL_CDDI_VL_NOTA_AUTO";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename constraint "CK_RES_FINAL_CDDI_STATUS_VALID" to "CK_RES_FINAL_CDDI_ST_SITUACAO";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename constraint "FK_SUBM_RES_FINAL_CDDI_LEADER" to "FK_SUB_RES_FIN_CDD_SUBMI_LIDER";
alter table sigav."TB_RESULTADO_FINAL_CDDI" rename constraint "UK_RES_FINAL_CDDI_UNIQUE" to "UK_RES_FINAL_CDDI_SQ_APLICACAO";
alter table sigav."TL_EMAIL_PARTICIPANTE" rename constraint "CK_EMAIL_PART_ENVIO" to "CK_EMAIL_PART_ST_ENVIO";
alter table sigav."TL_EMAIL_PARTICIPANTE" rename constraint "CK_EMAIL_PART_TIPO" to "CK_EMAIL_PART_TP_EMAIL";

alter index sigav."IN_FK_ARQUIVO_AUTOR" rename to "IN_FK_ARQUIVO_CO_AUTOR";
alter index sigav."IN_FK_RES_FINA_CDDI_AUT_SUB_ID" rename to "IN_FK_RES_FIN_CDD_SQ_SUBM_AUTO";
alter index sigav."IN_FK_RES_FINA_CDDI_LEA_SUB_ID" rename to "IN_FK_RES_FIN_CDD_SQ_SUBM_LIDE";
alter index sigav."IN_FK_RES_FINA_CDDI_SUB_PER_ID" rename to "IN_FK_RES_FIN_CDD_SQ_PESS_AVAL";
alter index sigav."IN_RES_FINAL_CDDI_STATUS" rename to "IN_RES_FIN_CDD_SQ_APLI_ST_SITU";
alter index sigav."IN_EMAIL_PART_FILA" rename to "IN_EMAIL_PART_ST_ENVI_DT_ALTE";
alter index sigav."IN_EMAIL_PART_PARTIC_HISTORICO" rename to "IN_EMAIL_PART_SQ_APLI_DT_INCL";
alter index sigav."IN_EMAIL_PART_PARTIC_MSGID" rename to "IN_EMAIL_PART_CO_MENSAGEM_SMTP";
alter index sigav."IN_EMAIL_PART_SITUACAO" rename to "IN_EMAIL_PART_ST_ENVI_SQ_APLI";
alter index sigav."IN_FK_EMAIL_PART_PART_PESSOA" rename to "IN_FK_EMAIL_PART_SQ_PESSOA";
alter index sigav."UK_EMAIL_PART_PARTI_AUTO_UNICO" rename to "UK_EMAIL_PART_SQ_APLI_SQ_PESS";

-- ---------------------------------------------------------------------------
-- 4. Funções que tocam estas colunas (16)
--
-- Cada substituição abaixo foi conferida contra a linha real da função. Onde o
-- nome da coluna é também chave JSON, ou pertence a outra tabela, a troca é
-- ancorada no alias — ou simplesmente não é feita.
-- ---------------------------------------------------------------------------

-- FC_ARQ_GRAVAR(p_balde text, p_caminho text, p_tipo text, p_conteudo_base64 text)
-- troca por token, fora de comentário e de literal: co_autor=3, co_balde=1, ds_caminho=1, dt_atualizacao=1, im_conteudo=3, nu_tamanho=3, sq_arquivo=1, tp_conteudo=3
CREATE OR REPLACE FUNCTION sigav."FC_ARQ_GRAVAR"(p_balde text, p_caminho text, p_tipo text, p_conteudo_base64 text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_caminho text := btrim(coalesce(p_caminho, ''));
  v_conteudo bytea;
  v_tamanho integer;
  v_id uuid;
begin
  -- Mesma autoridade que decidia a escrita nas políticas dos dois buckets:
  -- quem administra pesquisas administra a marca e as capas.
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Sem permissão para gravar arquivos.' using errcode = '42501';
  end if;

  if v_caminho = '' then
    raise exception 'O caminho do arquivo é obrigatório.' using errcode = '22023';
  end if;

  -- Impede que um caminho escape do próprio balde ou monte um endereço que a
  -- rota de leitura interpretaria de outro modo.
  if v_caminho like '/%' or v_caminho like '%..%' then
    raise exception 'Caminho de arquivo inválido: %', v_caminho using errcode = '22023';
  end if;

  if coalesce(p_conteudo_base64, '') = '' then
    raise exception 'O conteúdo do arquivo é obrigatório.' using errcode = '22023';
  end if;

  v_conteudo := decode(p_conteudo_base64, 'base64');
  v_tamanho := octet_length(v_conteudo);

  insert into sigav."TB_ARQUIVO" ("CO_BALDE", "DS_CAMINHO", "TP_CONTEUDO", "NU_TAMANHO", "IM_CONTEUDO", "CO_AUTOR")
  values (p_balde, v_caminho, p_tipo, v_tamanho, v_conteudo, sigav."FC_UID_SESSAO"())
  on conflict on constraint "UK_ARQUIVO_CAMINHO" do update
    set "TP_CONTEUDO"    = excluded."TP_CONTEUDO",
        "NU_TAMANHO"     = excluded."NU_TAMANHO",
        "IM_CONTEUDO"    = excluded."IM_CONTEUDO",
        "CO_AUTOR"       = excluded."CO_AUTOR",
        "DT_ALTERACAO" = now()
  returning "SQ_ARQUIVO" into v_id;

  return jsonb_build_object(
    'sqArquivo', v_id,
    'balde', p_balde,
    'caminho', v_caminho,
    'tamanho', v_tamanho,
    'url', '/api/arquivos/' || p_balde || '/' || v_caminho
  );
end;
$function$;

-- FC_ARQ_LISTAR(p_balde text, p_prefixo text)
-- troca por token, fora de comentário e de literal: co_balde=2, ds_caminho=3, dt_criacao=2, nu_tamanho=1, tp_conteudo=1
CREATE OR REPLACE FUNCTION sigav."FC_ARQ_LISTAR"(p_balde text, p_prefixo text DEFAULT ''::text)
 RETURNS TABLE(caminho text, tipo text, tamanho integer, criado_em timestamp with time zone, url text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Sem permissão para listar arquivos.' using errcode = '42501';
  end if;

  return query
    select a."DS_CAMINHO",
           a."TP_CONTEUDO",
           a."NU_TAMANHO",
           a."DT_INCLUSAO",
           '/api/arquivos/' || a."CO_BALDE" || '/' || a."DS_CAMINHO"
    from sigav."TB_ARQUIVO" a
    where a."CO_BALDE" = p_balde
      and a."DS_CAMINHO" like coalesce(nullif(btrim(p_prefixo), ''), '') || '%'
    order by a."DT_INCLUSAO" desc
    limit 100;
end;
$function$;

-- FC_ARQ_OBTER(p_balde text, p_caminho text)
-- troca por token, fora de comentário e de literal: co_balde=1, ds_caminho=1, dt_atualizacao=1, im_conteudo=1, nu_tamanho=1, tp_conteudo=1
CREATE OR REPLACE FUNCTION sigav."FC_ARQ_OBTER"(p_balde text, p_caminho text)
 RETURNS TABLE(conteudo bytea, tipo text, tamanho integer, atualizado_em timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select a."IM_CONTEUDO", a."TP_CONTEUDO", a."NU_TAMANHO", a."DT_ALTERACAO"
  from sigav."TB_ARQUIVO" a
  where a."CO_BALDE" = p_balde
    and a."DS_CAMINHO" = btrim(coalesce(p_caminho, ''));
$function$;

-- FC_ARQ_REMOVER(p_balde text, p_caminho text)
-- troca por token, fora de comentário e de literal: co_balde=1, ds_caminho=1
CREATE OR REPLACE FUNCTION sigav."FC_ARQ_REMOVER"(p_balde text, p_caminho text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_removidos integer;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Sem permissão para remover arquivos.' using errcode = '42501';
  end if;

  delete from sigav."TB_ARQUIVO"
  where "CO_BALDE" = p_balde and "DS_CAMINHO" = btrim(coalesce(p_caminho, ''));

  get diagnostics v_removidos = row_count;

  -- Remover o que já não existe não é erro: a tela chama isto em rotinas de
  -- faxina, e falhar ali produziria mensagem de erro para um estado que já é o
  -- desejado.
  return jsonb_build_object('removidos', v_removidos);
end;
$function$;

-- FC_CONCLUIR_EMAIL_PARTICIPANTE(target_email_id uuid, target_success boolean, target_error text)
-- troca por token, fora de comentário e de literal: ds_erro=1, dt_atualizacao=1, dt_envio=2, sq_email=1, st_envio=1
CREATE OR REPLACE FUNCTION sigav."FC_CONCLUIR_EMAIL_PARTICIPANTE"(target_email_id uuid, target_success boolean, target_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  -- Mesma guarda de FC_REIVINDICAR_EMAILS: EXECUTE de authenticated existe
  -- pelo gate de contratos, mas só o processamento interno passa daqui.
  if coalesce(sigav."FC_PAPEL_SESSAO"(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  update sigav."TL_EMAIL_PARTICIPANTE"
  set "ST_ENVIO" = case when target_success then 'ENVIADO' else 'FALHOU' end,
      "DT_ENVIO" = case when target_success then timezone('utc', now()) else "DT_ENVIO" end,
      "DS_ERRO" = case when target_success then null else left(coalesce(target_error, 'Falha não detalhada.'), 500) end,
      "DT_ALTERACAO" = timezone('utc', now())
  where "SQ_EMAIL" = target_email_id;
end;
$function$;

-- FC_CONCLUIR_EMAIL_PARTICIPANTE(target_email_id uuid, target_claim_token uuid, target_success boolean, target_error text)
-- troca por token, fora de comentário e de literal: co_reivindicacao=2, ds_erro=1, dt_atualizacao=1, dt_envio=2, sq_email=1, st_envio=2
CREATE OR REPLACE FUNCTION sigav."FC_CONCLUIR_EMAIL_PARTICIPANTE"(target_email_id uuid, target_claim_token uuid, target_success boolean, target_error text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  if coalesce(sigav."FC_PAPEL_SESSAO"(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  update sigav."TL_EMAIL_PARTICIPANTE"
  set "ST_ENVIO" = case when target_success then 'ENVIADO' else 'FALHOU' end,
      "DT_ENVIO" = case when target_success then timezone('utc', now()) else "DT_ENVIO" end,
      "DS_ERRO" = case
        when target_success then null
        else left(coalesce(target_error, 'Falha não detalhada.'), 500)
      end,
      "CO_REIVINDICACAO" = null,
      "DT_ALTERACAO" = timezone('utc', now())
  where "SQ_EMAIL" = target_email_id
    and "ST_ENVIO" = 'PROCESSANDO'
    and "CO_REIVINDICACAO" = target_claim_token;

  if not found then
    raise exception 'A reivindicação deste e-mail não está mais vigente.';
  end if;
end;
$function$;

-- FC_AGENDAR_ENVIO_MANUAL(p_aplicacao uuid, p_pessoas uuid[])
-- troca por token, fora de comentário e de literal: dt_atualizacao=1, sq_aplicacao=2, sq_pessoa=2, st_envio=2, tp_email=2
CREATE OR REPLACE FUNCTION sigav."FC_AGENDAR_ENVIO_MANUAL"(p_aplicacao uuid, p_pessoas uuid[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor uuid := sigav."FC_PESSOA_SESSAO"();
  v_application sigav."TB_APLICACAO_PESQUISA"%rowtype;
  v_pedidas integer := coalesce(array_length(p_pessoas, 1), 0);
  v_enfileiradas integer := 0;
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  if p_aplicacao is null then
    raise exception 'Informe o ciclo.';
  end if;

  if v_pedidas = 0 then
    raise exception 'Selecione ao menos uma pessoa.';
  end if;

  -- Teto por disparo: proteção contra o clique acidental que atinge a base
  -- inteira. A cota diária da conta institucional do Google é finita, e
  -- estourá-la derruba também os e-mails de quem realmente precisa receber.
  if v_pedidas > 1500 then
    raise exception 'Selecione no máximo 1500 pessoas por disparo.';
  end if;

  select * into v_application
  from sigav."TB_APLICACAO_PESQUISA"
  where id = p_aplicacao;

  if v_application.id is null then
    raise exception 'Ciclo não encontrado.';
  end if;

  if v_application.status <> 'OPEN' then
    raise exception 'O ciclo precisa estar aberto para receber envios.';
  end if;

  with elegiveis as (
    select p.id
    from sigav."TB_PESSOA" p
    join sigav."RL_APLICACAO_PESSOA" ap
      on ap.person_id = p.id and ap.application_id = p_aplicacao
    where p.id = any(p_pessoas)
      and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
      and p.active
      and p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      -- Bloqueia o clique duplo sem bloquear para sempre.
      --
      -- PENDENTE sempre impede: o lembrete está na fila e vai sair.
      -- PROCESSANDO só impede enquanto o lease vale — passados 15 minutos sem
      -- desfecho, o claim é tratado como abandonado, e insistir é legítimo.
      and not exists (
        select 1 from sigav."TL_EMAIL_PARTICIPANTE" t
        where t."SQ_APLICACAO" = p_aplicacao
          and t."SQ_PESSOA" = p.id
          and t."TP_EMAIL" = 'manual_reminder'
          and (
            t."ST_ENVIO" = 'PENDENTE'
            or (t."ST_ENVIO" = 'PROCESSANDO'
                and t."DT_ALTERACAO" > timezone('utc', now()) - interval '15 minutes')
          )
      )
  )
  insert into sigav."TL_EMAIL_PARTICIPANTE" ("SQ_APLICACAO", "SQ_PESSOA", "TP_EMAIL")
  select p_aplicacao, e.id, 'manual_reminder'
  from elegiveis e;

  get diagnostics v_enfileiradas = row_count;

  insert into sigav."TL_EVENTO_AUDITORIA"(
    actor_person_id, event_type, entity_type, entity_id, application_id,
    before_data, after_data, metadata
  )
  values (
    v_actor, 'EMAIL_MANUAL_QUEUED', 'survey_application', p_aplicacao, p_aplicacao,
    null, null,
    jsonb_build_object('solicitadas', v_pedidas, 'enfileiradas', v_enfileiradas)
  );

  return jsonb_build_object(
    'status', 'OK',
    'solicitadas', v_pedidas,
    'enfileiradas', v_enfileiradas,
    'ignoradas', v_pedidas - v_enfileiradas
  );
end;
$function$;

-- FC_LISTAR_AUDIENCIA_EMAIL(p_aplicacao uuid, p_situacao text, p_busca text, p_limite integer)
-- troca por token, fora de comentário e de literal: dt_criacao=4, sq_aplicacao=3, sq_pessoa=3, st_envio=1, tp_email=1
CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_AUDIENCIA_EMAIL"(p_aplicacao uuid, p_situacao text DEFAULT 'ALL'::text, p_busca text DEFAULT NULL::text, p_limite integer DEFAULT 500)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_result jsonb;
  v_limite integer := greatest(1, least(coalesce(p_limite, 500), 2000));
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_situacao text := upper(coalesce(nullif(btrim(p_situacao), ''), 'ALL'));
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  if v_situacao not in ('ALL', 'PENDING', 'DRAFT', 'DONE') then
    raise exception 'Situação inválida. Use ALL, PENDING, DRAFT ou DONE.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(f) order by f."fullName"), '[]'::jsonb)
  into v_result
  from (
    select
      p.id as "personId",
      p.full_name as "fullName",
      p.employee_number as "employeeNumber",
      p.institutional_email as email,
      ap.status as "participantStatus",
      d.situacao as situation,
      d.ultimo_envio as "lastEmailAt",
      d.ultimo_tipo as "lastEmailKind",
      d.ultimo_estado as "lastEmailStatus",
      (p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') as "emailValido"
    from sigav."RL_APLICACAO_PESSOA" ap
    join sigav."TB_PESSOA" p on p.id = ap.person_id
    cross join lateral (
      select
        case
          when ap.completed_at is not null
            or exists (
              select 1
              from sigav."TB_SUBMISSAO" sb
              where sb.application_id = ap.application_id
                and sb.respondent_person_id = p.id
                and (sb.subject_person_id is null or sb.subject_person_id = p.id)
                and sb.status in ('SUBMITTED', 'VALIDATED')
            ) then 'DONE'
          when exists (
              select 1
              from sigav."TB_SUBMISSAO" sb
              where sb.application_id = ap.application_id
                and sb.respondent_person_id = p.id
                and (sb.subject_person_id is null or sb.subject_person_id = p.id)
                and sb.status = 'DRAFT'
            ) then 'DRAFT'
          else 'PENDING'
        end as situacao,
        (
          select t."DT_INCLUSAO"
          from sigav."TL_EMAIL_PARTICIPANTE" t
          where t."SQ_APLICACAO" = ap.application_id
            and t."SQ_PESSOA" = p.id
          order by t."DT_INCLUSAO" desc
          limit 1
        ) as ultimo_envio,
        (
          select t."TP_EMAIL"
          from sigav."TL_EMAIL_PARTICIPANTE" t
          where t."SQ_APLICACAO" = ap.application_id
            and t."SQ_PESSOA" = p.id
          order by t."DT_INCLUSAO" desc
          limit 1
        ) as ultimo_tipo,
        (
          select t."ST_ENVIO"
          from sigav."TL_EMAIL_PARTICIPANTE" t
          where t."SQ_APLICACAO" = ap.application_id
            and t."SQ_PESSOA" = p.id
          order by t."DT_INCLUSAO" desc
          limit 1
        ) as ultimo_estado
    ) d
    where ap.application_id = p_aplicacao
      and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS', 'COMPLETED')
      and p.active
      and (v_situacao = 'ALL' or d.situacao = v_situacao)
      and (
        v_busca is null
        or sigav."FC_SEM_ACENTO_MINUSCULA"(p.full_name) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(v_busca) || '%'
        or p.employee_number like '%' || v_busca || '%'
        or sigav."FC_SEM_ACENTO_MINUSCULA"(p.institutional_email) like '%' || sigav."FC_SEM_ACENTO_MINUSCULA"(v_busca) || '%'
      )
    limit v_limite
  ) f;

  return v_result;
end;
$function$;

-- FC_LISTAR_ENVIOS_EMAIL(p_aplicacao uuid, p_situacao text, p_limite integer)
-- troca por token, fora de comentário e de literal: ds_erro=1, dt_criacao=2, dt_envio=1, sq_aplicacao=3, sq_email=1, sq_pessoa=1, st_envio=5, tp_email=1
CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_ENVIOS_EMAIL"(p_aplicacao uuid DEFAULT NULL::uuid, p_situacao text DEFAULT 'ALL'::text, p_limite integer DEFAULT 200)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_result jsonb;
  v_limite integer := greatest(1, least(coalesce(p_limite, 200), 1000));
  v_situacao text := upper(coalesce(nullif(btrim(p_situacao), ''), 'ALL'));
begin
  if not sigav."FC_PODE_GERIR_PESQUISA"() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  if v_situacao not in ('ALL', 'PENDENTE', 'PROCESSANDO', 'ENVIADO', 'FALHOU') then
    raise exception 'Situação inválida. Use ALL, PENDENTE, PROCESSANDO, ENVIADO ou FALHOU.';
  end if;

  select jsonb_build_object(
    'resumo', (
      select coalesce(jsonb_object_agg(x."ST_ENVIO", x.total), '{}'::jsonb)
      from (
        select t."ST_ENVIO", count(*) as total
        from sigav."TL_EMAIL_PARTICIPANTE" t
        where p_aplicacao is null or t."SQ_APLICACAO" = p_aplicacao
        group by t."ST_ENVIO"
      ) x
    ),
    'envios', (
      -- O apelido entre aspas, e não `f.dt_criacao`: é o nome que existe aqui.
      select coalesce(jsonb_agg(to_jsonb(f) order by f."createdAt" desc), '[]'::jsonb)
      from (
        select t."SQ_EMAIL" as id,
               t."TP_EMAIL" as kind,
               t."ST_ENVIO" as status,
               t."DS_ERRO" as erro,
               t."DT_INCLUSAO" as "createdAt",
               t."DT_ENVIO" as "sentAt",
               p.full_name as "personName",
               p.institutional_email as "personEmail",
               a.code as "applicationCode",
               a.name as "applicationName"
        from sigav."TL_EMAIL_PARTICIPANTE" t
        join sigav."TB_PESSOA" p on p.id = t."SQ_PESSOA"
        join sigav."TB_APLICACAO_PESQUISA" a on a.id = t."SQ_APLICACAO"
        where (p_aplicacao is null or t."SQ_APLICACAO" = p_aplicacao)
          and (v_situacao = 'ALL' or t."ST_ENVIO" = v_situacao)
        order by t."DT_INCLUSAO" desc
        limit v_limite
      ) f
    )
  )
  into v_result;

  return v_result;
end;
$function$;

-- FC_REIVINDICAR_EMAILS()
-- troca por token, fora de comentário e de literal: co_message_id=2, co_reivindicacao=5, ds_erro=3, dt_atualizacao=6, dt_criacao=2, dt_envio=4, nu_tentativas=5, sq_aplicacao=9, sq_email=6, sq_pessoa=9, st_envio=11, tp_email=14
CREATE OR REPLACE FUNCTION sigav."FC_REIVINDICAR_EMAILS"()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_claim_token uuid := gen_random_uuid();
  v_now timestamptz := timezone('utc', now());
  v_result jsonb;
begin
  if coalesce(sigav."FC_PAPEL_SESSAO"(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  perform sigav."FC_ABRIR_CICLOS_AGENDADOS"();

  /*
    Reivindicação expirada: reconciliar antes de reenfileirar.

    O caso perigoso é a entrega ambígua — o SMTP aceitou a mensagem e a
    confirmação no banco não chegou (queda da função, timeout, rede). A linha
    fica PROCESSANDO, o lease vence, e a versão anterior devolvia tudo para
    PENDENTE: a pessoa recebia o mesmo e-mail de novo.

    `co_message_id` é gravado **antes** do envio, por
    `fc_srv_registrar_transporte`. Sua presença significa "o transporte foi
    iniciado com este identificador". Quem tem identificador não volta para a
    fila: é marcado ENVIADO e sinalizado para conferência humana, porque
    reenviar às cegas é pior do que registrar a dúvida.

    Quem NÃO tem identificador nunca chegou ao SMTP — esse é o retry legítimo, e
    continua funcionando exatamente como antes.
  */
  update sigav."TL_EMAIL_PARTICIPANTE"
  set "ST_ENVIO" = 'ENVIADO',
      "CO_REIVINDICACAO" = null,
      "DS_ERRO" = 'Entrega ambígua: o transporte foi iniciado e a confirmação não chegou. Conferir na caixa de saída antes de reenviar.',
      "DT_ENVIO" = coalesce("DT_ENVIO", v_now),
      "DT_ALTERACAO" = v_now
  where "ST_ENVIO" = 'PROCESSANDO'
    and "DT_ALTERACAO" < v_now - interval '15 minutes'
    and "CO_MENSAGEM_SMTP" is not null;

  update sigav."TL_EMAIL_PARTICIPANTE"
  set "ST_ENVIO" = case when "NU_TENTATIVAS" >= 5 then 'FALHOU' else 'PENDENTE' end,
      "CO_REIVINDICACAO" = null,
      "DS_ERRO" = case
        when "NU_TENTATIVAS" >= 5 then 'Limite de tentativas atingido após expiração da reivindicação.'
        else 'A reivindicação anterior expirou antes da confirmação.'
      end,
      "DT_ALTERACAO" = v_now
  where "ST_ENVIO" = 'PROCESSANDO'
    and "DT_ALTERACAO" < v_now - interval '15 minutes'
    and "CO_MENSAGEM_SMTP" is null;

  insert into sigav."TL_EMAIL_PARTICIPANTE" (
    "SQ_APLICACAO", "SQ_PESSOA", "TP_EMAIL", "ST_ENVIO"
  )
  select a.id, p.id, e."TP_EMAIL", 'PENDENTE'
  from sigav."TB_APLICACAO_PESQUISA" a
  join sigav."RL_APLICACAO_PESSOA" ap on ap.application_id = a.id
  join sigav."TB_PESSOA" p on p.id = ap.person_id
  cross join lateral (
    values ('research_opened'), ('research_expiring_24h')
  ) as e("TP_EMAIL")
  where a.st_notificacao_email
    and a.status = 'OPEN'
    and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
    and p.active
    and p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    and (
      (e."TP_EMAIL" = 'research_opened'
        and (a.closes_at is null or a.closes_at > now()))
      or
      (e."TP_EMAIL" = 'research_expiring_24h'
        and a.closes_at is not null
        and a.closes_at > now()
        and a.closes_at <= now() + interval '24 hours'
        and exists (
          select 1
          from sigav."TL_EMAIL_PARTICIPANTE" abertura
          where abertura."SQ_APLICACAO" = a.id
            and abertura."SQ_PESSOA" = p.id
            and abertura."TP_EMAIL" = 'research_opened'
            and abertura."ST_ENVIO" = 'ENVIADO'
            and abertura."DT_ENVIO" <= now() - interval '1 hour'
        ))
    )
  on conflict ("SQ_APLICACAO", "SQ_PESSOA", "TP_EMAIL")
    where "TP_EMAIL" in ('research_opened', 'research_expiring_24h')
  do nothing;

  with candidates as (
    select t."SQ_EMAIL"
    from sigav."TL_EMAIL_PARTICIPANTE" t
    join sigav."TB_APLICACAO_PESQUISA" a on a.id = t."SQ_APLICACAO"
    join sigav."RL_APLICACAO_PESSOA" ap
      on ap.application_id = t."SQ_APLICACAO"
     and ap.person_id = t."SQ_PESSOA"
    join sigav."TB_PESSOA" p on p.id = t."SQ_PESSOA"
    where (
        t."ST_ENVIO" = 'PENDENTE'
        or (
          t."ST_ENVIO" = 'FALHOU'
          and t."DT_ALTERACAO" <= v_now - interval '5 minutes'
        )
      )
      -- Envio dirigido nao exige o interruptor do ciclo: e ato explicito de
      -- quem opera, e exigi-lo impediria cobrar quem falta num ciclo sem
      -- aviso automatico ligado.
      and (t."TP_EMAIL" = 'manual_reminder' or a.st_notificacao_email)
      and a.status = 'OPEN'
      and t."NU_TENTATIVAS" < 5
      and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
      and p.active
      and p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      and (
        -- Sem janela propria: o lembrete dirigido vale enquanto o ciclo estiver
        -- aberto, porque quem o disparou decidiu o momento.
        t."TP_EMAIL" = 'manual_reminder'
        or
        (t."TP_EMAIL" = 'research_opened'
          and (a.closes_at is null or a.closes_at > now()))
        or
        (t."TP_EMAIL" = 'research_expiring_24h'
          and a.closes_at is not null
          and a.closes_at > now()
          and a.closes_at <= now() + interval '24 hours'
          and exists (
            select 1
            from sigav."TL_EMAIL_PARTICIPANTE" abertura
            where abertura."SQ_APLICACAO" = t."SQ_APLICACAO"
              and abertura."SQ_PESSOA" = t."SQ_PESSOA"
              and abertura."TP_EMAIL" = 'research_opened'
              and abertura."ST_ENVIO" = 'ENVIADO'
              and abertura."DT_ENVIO" <= now() - interval '1 hour'
          ))
      )
    order by t."DT_INCLUSAO", t."SQ_EMAIL"
    for update of t skip locked
    limit 100
  )
  update sigav."TL_EMAIL_PARTICIPANTE" t
  set "ST_ENVIO" = 'PROCESSANDO',
      "CO_REIVINDICACAO" = v_claim_token,
      "NU_TENTATIVAS" = t."NU_TENTATIVAS" + 1,
      "DS_ERRO" = null,
      "DT_ALTERACAO" = v_now
  from candidates c
  where t."SQ_EMAIL" = c."SQ_EMAIL";

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', t."SQ_EMAIL",
    'claimToken', t."CO_REIVINDICACAO",
    'applicationId', t."SQ_APLICACAO",
    'personId', t."SQ_PESSOA",
    'kind', t."TP_EMAIL",
    'personName', p.full_name,
    'personEmail', p.institutional_email,
    'applicationName', a.name,
    'applicationCode', a.code,
    'surveyCode', s.code,
    'closesAt', a.closes_at,
    'surveyDescription', s.description,
    'organizationName', cfg.no_organizacao,
    'productName', cfg.no_produto,
    'emailInstruction', cfg.tx_instrucao_email,
    'emailFooter', cfg.tx_rodape_email
  ) order by t."DT_INCLUSAO", t."SQ_EMAIL"), '[]'::jsonb)
  into v_result
  from sigav."TL_EMAIL_PARTICIPANTE" t
  join sigav."TB_APLICACAO_PESQUISA" a on a.id = t."SQ_APLICACAO"
  join sigav."TH_VERSAO_PESQUISA" sv on sv.id = a.survey_version_id
  join sigav."TB_PESQUISA" s on s.id = sv.survey_id
  join sigav."TB_PESSOA" p on p.id = t."SQ_PESSOA"
  -- LEFT de proposito: configuracao ausente faz o template cair no padrao do
  -- codigo, e nunca impede o envio.
  left join sigav."TB_CONFIG_PLATAFORMA" cfg on cfg.co_configuracao = 1
  where t."ST_ENVIO" = 'PROCESSANDO'
    and t."CO_REIVINDICACAO" = v_claim_token;

  return v_result;
end;
$function$;

-- FC_SRV_REGISTRAR_TRANSPORTE(target_email_id uuid, target_claim_token uuid, target_message_id text)
-- troca por token, fora de comentário e de literal: co_message_id=1, co_reivindicacao=1, dt_atualizacao=1, dt_transporte=1, sq_email=1, st_envio=1
CREATE OR REPLACE FUNCTION sigav."FC_SRV_REGISTRAR_TRANSPORTE"(target_email_id uuid, target_claim_token uuid, target_message_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_afetadas integer;
begin
  if coalesce(sigav."FC_PAPEL_SESSAO"(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  if target_email_id is null or target_claim_token is null then
    raise exception 'Informe o envio e o token da reivindicação.';
  end if;

  if coalesce(btrim(target_message_id), '') = '' then
    raise exception 'Informe o identificador da mensagem.';
  end if;

  update sigav."TL_EMAIL_PARTICIPANTE"
  set "CO_MENSAGEM_SMTP" = btrim(target_message_id),
      "DT_TRANSPORTE" = timezone('utc', now()),
      "DT_ALTERACAO" = timezone('utc', now())
  where "SQ_EMAIL" = target_email_id
    and "CO_REIVINDICACAO" = target_claim_token
    and "ST_ENVIO" = 'PROCESSANDO';

  get diagnostics v_afetadas = row_count;

  -- Zero linhas não é erro: o lease pode ter vencido entre reivindicar e
  -- enviar. Quem chamou precisa saber para **não** prosseguir com o envio.
  return jsonb_build_object('status', case when v_afetadas = 1 then 'OK' else 'EXPIRADO' end);
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

CREATE OR REPLACE FUNCTION sigav."FC_VALIDAR_RESULT_FINAL_CDDI"()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  sid uuid;
  app uuid;
  subject uuid;
  stype text;
begin
  foreach sid in array array[new."SQ_SUBMISSAO_AUTO", new."SQ_SUBMISSAO_LIDER"] loop
    if sid is null then continue; end if;
    select application_id, subject_person_id, submission_type into app, subject, stype
    from sigav."TB_SUBMISSAO" where id = sid;
    if app is distinct from new."SQ_APLICACAO" or subject is distinct from new."SQ_PESSOA_AVALIADA" then
      raise exception 'A submissão não corresponde à aplicação e ao avaliado do resultado final.';
    end if;
    if sid = new."SQ_SUBMISSAO_AUTO" and stype <> 'AUTO' then
      raise exception 'A submissão de autoavaliação deve ser do tipo AUTO.';
    end if;
    if sid = new."SQ_SUBMISSAO_LIDER" and stype <> 'CHEFIA' then
      raise exception 'A submissão de chefia deve ser do tipo CHEFIA.';
    end if;
  end loop;
  return new;
end;
$function$;

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
  delete from sigav."TB_REGRA_CONDICIONAL" where sq_versao_pesquisa = any(v_versoes);

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
      fr."VL_NOTA_FINAL" as final_score,
      fr."ST_SITUACAO" as final_status,
      fr."DT_CALCULO" as calculated_at,
      case when upper(coalesce(auto.status, '')) in ('SUBMITTED', 'VALIDATED') then true else false end as auto_completed,
      case when upper(coalesce(leader.status, '')) in ('SUBMITTED', 'VALIDATED') then true else false end as leader_completed
    from scoped_participants sp
    left join active_leaders al on al.subordinate_person_id = sp.person_id
    left join latest_submissions auto on auto.subject_id = sp.person_id and auto.normalized_type in ('AUTO', 'AUTOAVALIACAO', 'SELF')
    left join latest_submissions leader on leader.subject_id = sp.person_id and leader.normalized_type in ('CHEFIA', 'LEADER', 'MANAGER')
    left join lateral (
      select r.*
      from sigav."TB_RESULTADO_FINAL_CDDI" r
      where r."SQ_APLICACAO" = v_application_id and r."SQ_PESSOA_AVALIADA" = sp.person_id
        and upper(r."ST_SITUACAO") <> 'INVALIDATED'
      order by r."DT_CALCULO" desc, r."DT_ALTERACAO" desc
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

-- ---------------------------------------------------------------------------
-- 3. Autoverificação
-- ---------------------------------------------------------------------------

do $verificacao$
declare
  v_tabelas text[] := array['TB_ARQUIVO', 'TL_EMAIL_PARTICIPANTE', 'TB_RESULTADO_FINAL_CDDI'];
  v_revisadas text[] := array['FC_ARQ_GRAVAR', 'FC_ARQ_LISTAR', 'FC_ARQ_OBTER', 'FC_ARQ_REMOVER', 'FC_CONCLUIR_EMAIL_PARTICIPANTE', 'FC_AGENDAR_ENVIO_MANUAL', 'FC_LISTAR_AUDIENCIA_EMAIL', 'FC_LISTAR_ENVIOS_EMAIL', 'FC_REIVINDICAR_EMAILS', 'FC_SRV_REGISTRAR_TRANSPORTE', 'FC_ENVIAR_SUBMISSAO_CDDI', 'FC_VALIDAR_RESULT_FINAL_CDDI', 'FC_EXCLUIR_PESQUISA_ARQUIVADA', 'FC_PAINEL_MONITOR_CDDI_INT', 'FC_REMOVER_RESPOSTA_PESSOA'];
  v_velhos_exclusivos text[] := array['sq_arquivo', 'co_balde', 'ds_caminho', 'tp_conteudo', 'nu_tamanho', 'im_conteudo', 'co_autor', 'dt_criacao', 'dt_atualizacao', 'sq_email', 'sq_aplicacao', 'sq_pessoa', 'tp_email', 'st_envio', 'ds_erro', 'dt_envio', 'dt_criacao', 'dt_atualizacao', 'co_reivindicacao', 'nu_tentativas', 'co_message_id', 'dt_transporte', 'auto_submission_id', 'leader_submission_id', 'auto_score', 'leader_score', 'final_score', 'calculation_version', 'calculated_at']::text[];
  v_sobras_aceitas text[] := array['FC_PAINEL_MONITOR_CDDI_INT|auto_score', 'FC_PAINEL_MONITOR_CDDI_INT|leader_score', 'FC_PAINEL_MONITOR_CDDI_INT|final_score', 'FC_PAINEL_MONITOR_CDDI_INT|calculated_at', 'FC_PAINEL_MONITOR_CDDI_INT|auto_submission_id', 'FC_PAINEL_MONITOR_CDDI_INT|leader_submission_id', 'FC_APLICAR_PUBLICO_AVALIACAO|sq_pessoa', 'FC_PLANEJAR_PUBLICO_AVALIACAO|sq_pessoa', 'FC_PREVISUALIZAR_PUBLICO|sq_pessoa', 'FC_RESOLVER_PUBLICO_AVALIACAO|sq_pessoa']::text[];
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

  raise notice 'nomenclatura lote 4: 37 colunas em 3 tabelas';
end
$verificacao$;

commit;
