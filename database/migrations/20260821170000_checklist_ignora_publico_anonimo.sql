begin;

-- Ciclo anônimo não tem vínculo de participante: a jornada pública
-- (`fc_iniciar_resp_anon`) nem consulta `application_participants`, então o
-- aviso "nenhum participante vinculado" aponta uma pendência que não existe
-- para esse tipo de ciclo. Redefinição da função legada consumida pelo nome
-- por bundles publicados — mesma política das demais entradas de
-- LEGACY_RESTORED_OBJECTS; a única mudança de comportamento é a condição
-- acrescentada ao bloco `NO_PARTICIPANTS`.
create or replace function public.get_survey_operations(target_survey_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_survey public.surveys%rowtype;
  v_version public.survey_versions%rowtype;
  v_application public.survey_applications%rowtype;
  v_sections integer := 0;
  v_questions integer := 0;
  v_required integer := 0;
  v_participants integer := 0;
  v_drafts integer := 0;
  v_submitted integer := 0;
  v_integrity jsonb;
  v_issues jsonb := '[]'::jsonb;
  v_ready_to_publish boolean := false;
  v_ready_to_open boolean := false;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração.';
  end if;

  perform public.fc_abrir_ciclos_agendados();

  select *
  into v_survey
  from public.surveys
  where id = target_survey_id;

  if v_survey.id is null then
    raise exception 'Pesquisa não encontrada.';
  end if;

  select *
  into v_version
  from public.survey_versions
  where survey_id = target_survey_id
  order by version_number desc
  limit 1;

  if v_version.id is null then
    raise exception 'Versão da pesquisa não encontrada.';
  end if;

  select *
  into v_application
  from public.survey_applications
  where survey_version_id = v_version.id
  order by created_at desc
  limit 1;

  v_integrity := public.validate_survey_version_integrity(v_version.id);
  v_issues := coalesce(v_integrity -> 'issues', '[]'::jsonb);

  select count(*)::integer
  into v_sections
  from public.survey_sections
  where survey_version_id = v_version.id;

  select
    count(*)::integer,
    count(*) filter (where required)::integer
  into v_questions, v_required
  from public.survey_questions
  where survey_version_id = v_version.id;

  if v_application.id is null then
    v_issues := v_issues || jsonb_build_array(
      jsonb_build_object(
        'id', 'NO_APPLICATION',
        'code', 'NO_APPLICATION',
        'severity', 'BLOCKING',
        'category', 'CYCLE',
        'entityType', 'VERSION',
        'entityId', v_version.id,
        'message', 'Configure um ciclo de aplicação.',
        'action', 'Crie o ciclo antes de publicar a versão.'
      )
    );
  else
    select count(*)::integer
    into v_participants
    from public.application_participants
    where application_id = v_application.id
      and status not in ('BLOCKED', 'EXCLUDED');

    select
      count(*) filter (where status = 'DRAFT')::integer,
      count(*) filter (where status in ('SUBMITTED', 'VALIDATED'))::integer
    into v_drafts, v_submitted
    from public.submissions
    where application_id = v_application.id;

    if v_application.opens_at is null or v_application.closes_at is null then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'NO_PERIOD',
          'code', 'NO_PERIOD',
          'severity', 'BLOCKING',
          'category', 'PERIOD',
          'entityType', 'APPLICATION',
          'entityId', v_application.id,
          'message', 'Defina abertura e encerramento do ciclo.',
          'action', 'Preencha as duas datas e salve o período.'
        )
      );
    elsif v_application.closes_at <= v_application.opens_at then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'INVALID_PERIOD',
          'code', 'INVALID_PERIOD',
          'severity', 'BLOCKING',
          'category', 'PERIOD',
          'entityType', 'APPLICATION',
          'entityId', v_application.id,
          'message', 'O período do ciclo é inválido.',
          'action', 'Defina o encerramento depois da abertura.'
        )
      );
    elsif v_application.status in ('DRAFT', 'SCHEDULED')
      and v_application.closes_at <= now() then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'PERIOD_EXPIRED',
          'code', 'PERIOD_EXPIRED',
          'severity', 'BLOCKING',
          'category', 'PERIOD',
          'entityType', 'APPLICATION',
          'entityId', v_application.id,
          'message', 'O encerramento informado já passou.',
          'action', 'Atualize o período antes de abrir o ciclo.'
        )
      );
    elsif v_application.status = 'OPEN'
      and v_application.closes_at <= now() then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'OPEN_PERIOD_EXPIRED',
          'code', 'OPEN_PERIOD_EXPIRED',
          'severity', 'WARNING',
          'category', 'PERIOD',
          'entityType', 'APPLICATION',
          'entityId', v_application.id,
          'message', 'O prazo terminou, mas o ciclo ainda está aberto.',
          'action', 'Encerre o ciclo para consolidar o período.'
        )
      );
    end if;

    if v_application.status = 'CLOSED' then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'CYCLE_CLOSED',
          'code', 'CYCLE_CLOSED',
          'severity', 'WARNING',
          'category', 'CYCLE',
          'entityType', 'APPLICATION',
          'entityId', v_application.id,
          'message', 'Este ciclo está encerrado.',
          'action', 'Informe um novo período se precisar reabri-lo.'
        )
      );
    end if;

    if v_participants = 0 and not v_application.anonymous then
      v_issues := v_issues || jsonb_build_array(
        jsonb_build_object(
          'id', 'NO_PARTICIPANTS',
          'code', 'NO_PARTICIPANTS',
          'severity', 'WARNING',
          'category', 'AUDIENCE',
          'entityType', 'APPLICATION',
          'entityId', v_application.id,
          'message', 'Nenhum participante foi vinculado ao ciclo.',
          'action', 'Revise o público antes da abertura.'
        )
      );
    end if;
  end if;

  v_ready_to_publish :=
    (v_integrity ->> 'valid')::boolean
    and v_application.id is not null
    and v_version.status = 'DRAFT';

  v_ready_to_open :=
    (v_integrity ->> 'valid')::boolean
    and v_version.status = 'PUBLISHED'
    and v_application.id is not null
    and v_application.opens_at is not null
    and v_application.closes_at is not null
    and v_application.closes_at > v_application.opens_at
    and v_application.closes_at > now();

  return jsonb_build_object(
    'status', 'OK',
    'survey', jsonb_build_object(
      'id', v_survey.id,
      'code', v_survey.code,
      'name', v_survey.name,
      'status', v_survey.status,
      'description', v_survey.description
    ),
    'version', jsonb_build_object(
      'id', v_version.id,
      'number', v_version.version_number,
      'status', v_version.status
    ),
    'application', case
      when v_application.id is null then null
      else jsonb_build_object(
        'id', v_application.id,
        'code', v_application.code,
        'name', v_application.name,
        'status', v_application.status,
        'opensAt', v_application.opens_at,
        'closesAt', v_application.closes_at,
        'allowDrafts', v_application.allow_drafts,
        'accessMode', v_application.access_mode,
        'emailNotifications', v_application.st_notificacao_email,
        'anonymous', v_application.anonymous
      )
    end,
    'metrics', jsonb_build_object(
      'sections', v_sections,
      'questions', v_questions,
      'requiredQuestions', v_required,
      'participants', v_participants,
      'draftSubmissions', v_drafts,
      'submittedSubmissions', v_submitted
    ),
    'integrity', v_integrity,
    'issues', v_issues,
    'readyToPublish', v_ready_to_publish,
    'readyToOpen', v_ready_to_open
  );
end;
$$;

notify pgrst, 'reload schema';
commit;

-- Rollback:
-- begin;
--   -- Restaure `get_survey_operations` pela definição de
--   -- 20260821100000_resposta_anonima_publica.sql (sem a condição
--   -- `and not v_application.anonymous` no bloco NO_PARTICIPANTS).
-- commit;
