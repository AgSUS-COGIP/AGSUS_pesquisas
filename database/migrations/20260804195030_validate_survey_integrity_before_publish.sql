begin;

create or replace function public.validate_survey_version_integrity(
  target_survey_version_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_version public.survey_versions%rowtype;
  v_issues jsonb := '[]'::jsonb;
  v_blocking_count integer := 0;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração.';
  end if;

  select *
  into v_version
  from public.survey_versions
  where id = target_survey_version_id;

  if v_version.id is null then
    raise exception 'Versão da pesquisa não encontrada.';
  end if;

  with issue_rows as (
    select
      10 as priority,
      'NO_SECTIONS'::text as code,
      'NO_SECTIONS'::text as issue_id,
      'STRUCTURE'::text as category,
      'VERSION'::text as entity_type,
      v_version.id as entity_id,
      'Adicione pelo menos uma seção.'::text as message,
      'Crie a primeira seção no construtor.'::text as action
    where not exists (
      select 1
      from public.survey_sections section
      where section.survey_version_id = v_version.id
    )

    union all

    select
      20,
      'NO_QUESTIONS',
      'NO_QUESTIONS',
      'STRUCTURE',
      'VERSION',
      v_version.id,
      'Adicione pelo menos uma pergunta.',
      'Inclua uma pergunta em uma das seções.'
    where not exists (
      select 1
      from public.survey_questions question
      where question.survey_version_id = v_version.id
    )

    union all

    select
      30,
      'BLANK_VERSION_TITLE',
      'BLANK_VERSION_TITLE',
      'STRUCTURE',
      'VERSION',
      v_version.id,
      'O título da versão está vazio.',
      'Informe um título para a versão antes de publicar.'
    where nullif(btrim(v_version.title), '') is null

    union all

    select
      40,
      'BLANK_SECTION_TITLE',
      'BLANK_SECTION_TITLE:' || section.id::text,
      'STRUCTURE',
      'SECTION',
      section.id,
      'Uma seção está sem título.',
      'Informe o título da seção no construtor.'
    from public.survey_sections section
    where section.survey_version_id = v_version.id
      and nullif(btrim(section.title), '') is null

    union all

    select
      50,
      'SECTION_TITLE_TOO_LONG',
      'SECTION_TITLE_TOO_LONG:' || section.id::text,
      'STRUCTURE',
      'SECTION',
      section.id,
      format('A seção "%s" ultrapassa 160 caracteres.', left(section.title, 80)),
      'Reduza o título da seção para até 160 caracteres.'
    from public.survey_sections section
    where section.survey_version_id = v_version.id
      and char_length(section.title) > 160

    union all

    select
      60,
      'EMPTY_SECTION',
      'EMPTY_SECTION:' || section.id::text,
      'STRUCTURE',
      'SECTION',
      section.id,
      format('A seção "%s" não possui perguntas.', left(section.title, 80)),
      'Adicione uma pergunta ou remova a seção vazia.'
    from public.survey_sections section
    where section.survey_version_id = v_version.id
      and not exists (
        select 1
        from public.survey_questions question
        where question.section_id = section.id
      )

    union all

    select
      70,
      'BLANK_QUESTION_TITLE',
      'BLANK_QUESTION_TITLE:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      'Uma pergunta está sem enunciado.',
      'Informe o enunciado da pergunta no construtor.'
    from public.survey_questions question
    where question.survey_version_id = v_version.id
      and nullif(btrim(question.title), '') is null

    union all

    select
      80,
      'QUESTION_TITLE_TOO_LONG',
      'QUESTION_TITLE_TOO_LONG:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      format('A pergunta "%s" ultrapassa 500 caracteres.', left(question.title, 80)),
      'Reduza o enunciado para até 500 caracteres.'
    from public.survey_questions question
    where question.survey_version_id = v_version.id
      and char_length(question.title) > 500

    union all

    select
      90,
      'INSUFFICIENT_OPTIONS',
      'INSUFFICIENT_OPTIONS:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      format('A pergunta "%s" precisa de pelo menos duas alternativas ativas.', left(question.title, 80)),
      'Edite a pergunta e informe ao menos duas alternativas.'
    from public.survey_questions question
    where question.survey_version_id = v_version.id
      and question.question_type in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE')
      and (
        select count(*)
        from public.question_options option
        where option.question_id = question.id
          and option.active
      ) < 2

    union all

    select
      100,
      'BLANK_OPTION',
      'BLANK_OPTION:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      format('A pergunta "%s" possui alternativa sem rótulo ou valor.', left(question.title, 80)),
      'Preencha todas as alternativas e salve a pergunta novamente.'
    from public.survey_questions question
    where question.survey_version_id = v_version.id
      and exists (
        select 1
        from public.question_options option
        where option.question_id = question.id
          and option.active
          and (
            nullif(btrim(option.label), '') is null
            or nullif(btrim(option.value), '') is null
          )
      )

    union all

    select
      110,
      'OPTION_LABEL_TOO_LONG',
      'OPTION_LABEL_TOO_LONG:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      format('A pergunta "%s" possui alternativa com mais de 200 caracteres.', left(question.title, 80)),
      'Reduza cada alternativa para até 200 caracteres.'
    from public.survey_questions question
    where question.survey_version_id = v_version.id
      and exists (
        select 1
        from public.question_options option
        where option.question_id = question.id
          and option.active
          and char_length(option.label) > 200
      )

    union all

    select
      120,
      'DUPLICATE_OPTION_LABEL',
      'DUPLICATE_OPTION_LABEL:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      format('A pergunta "%s" possui alternativas repetidas.', left(question.title, 80)),
      'Use rótulos diferentes para cada alternativa.'
    from public.survey_questions question
    where question.survey_version_id = v_version.id
      and question.question_type in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE')
      and (
        select count(*)
        from public.question_options option
        where option.question_id = question.id
          and option.active
      ) <> (
        select count(distinct lower(btrim(option.label)))
        from public.question_options option
        where option.question_id = question.id
          and option.active
      )

    union all

    select
      130,
      'DUPLICATE_OPTION_VALUE',
      'DUPLICATE_OPTION_VALUE:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      format('A pergunta "%s" possui valores internos repetidos.', left(question.title, 80)),
      'Edite e salve novamente as alternativas para gerar valores únicos.'
    from public.survey_questions question
    where question.survey_version_id = v_version.id
      and question.question_type in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE')
      and (
        select count(*)
        from public.question_options option
        where option.question_id = question.id
          and option.active
      ) <> (
        select count(distinct lower(btrim(option.value)))
        from public.question_options option
        where option.question_id = question.id
          and option.active
      )

    union all

    select
      140,
      'SCALE_WITHOUT_SCORE',
      'SCALE_WITHOUT_SCORE:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      format('A escala "%s" possui alternativa sem pontuação.', left(question.title, 80)),
      'Edite e salve novamente a escala para preencher a pontuação.'
    from public.survey_questions question
    where question.survey_version_id = v_version.id
      and question.question_type = 'SCALE'
      and exists (
        select 1
        from public.question_options option
        where option.question_id = question.id
          and option.active
          and option.score is null
      )

    union all

    select
      150,
      'DUPLICATE_SCALE_SCORE',
      'DUPLICATE_SCALE_SCORE:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      format('A escala "%s" possui pontuações repetidas.', left(question.title, 80)),
      'Use uma pontuação diferente em cada alternativa da escala.'
    from public.survey_questions question
    where question.survey_version_id = v_version.id
      and question.question_type = 'SCALE'
      and (
        select count(*)
        from public.question_options option
        where option.question_id = question.id
          and option.active
          and option.score is not null
      ) <> (
        select count(distinct option.score)
        from public.question_options option
        where option.question_id = question.id
          and option.active
          and option.score is not null
      )

    union all

    select
      160,
      'UNEXPECTED_OPTIONS',
      'UNEXPECTED_OPTIONS:' || question.id::text,
      'STRUCTURE',
      'QUESTION',
      question.id,
      format('A pergunta "%s" possui alternativas incompatíveis com o tipo de resposta.', left(question.title, 80)),
      'Edite e salve novamente a pergunta para limpar as alternativas.'
    from public.survey_questions question
    where question.survey_version_id = v_version.id
      and question.question_type not in ('SINGLE_CHOICE', 'MULTIPLE_CHOICE', 'SCALE', 'MATRIX')
      and exists (
        select 1
        from public.question_options option
        where option.question_id = question.id
          and option.active
      )
  )
  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', issue_id,
          'code', code,
          'severity', 'BLOCKING',
          'category', category,
          'entityType', entity_type,
          'entityId', entity_id,
          'message', message,
          'action', action
        )
        order by priority, issue_id
      ),
      '[]'::jsonb
    ),
    count(*)::integer
  into v_issues, v_blocking_count
  from issue_rows;

  return jsonb_build_object(
    'status', 'OK',
    'versionId', v_version.id,
    'versionStatus', v_version.status,
    'valid', v_blocking_count = 0,
    'blockingCount', v_blocking_count,
    'issues', v_issues
  );
end;
$$;

revoke all on function public.validate_survey_version_integrity(uuid)
from public, anon, service_role;
grant execute on function public.validate_survey_version_integrity(uuid)
to authenticated;

create or replace function public.enforce_draft_survey_structure()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_version_ids uuid[];
  v_expected integer;
begin
  if tg_table_name = 'survey_sections' then
    select array_agg(distinct version_id order by version_id)
    into v_version_ids
    from (
      select old.survey_version_id as version_id
      where tg_op in ('UPDATE', 'DELETE')
      union all
      select new.survey_version_id
      where tg_op in ('INSERT', 'UPDATE')
    ) versions;
  elsif tg_table_name = 'survey_questions' then
    select array_agg(distinct version_id order by version_id)
    into v_version_ids
    from (
      select old.survey_version_id as version_id
      where tg_op in ('UPDATE', 'DELETE')
      union all
      select new.survey_version_id
      where tg_op in ('INSERT', 'UPDATE')
    ) versions;
  elsif tg_table_name = 'question_options' then
    select array_agg(distinct question.survey_version_id order by question.survey_version_id)
    into v_version_ids
    from public.survey_questions question
    where question.id in (
      select old.question_id where tg_op in ('UPDATE', 'DELETE')
      union
      select new.question_id where tg_op in ('INSERT', 'UPDATE')
    );

    if v_version_ids is null and tg_op = 'DELETE' then
      return old;
    end if;
  else
    raise exception 'Tabela estrutural não suportada: %.', tg_table_name;
  end if;

  if v_version_ids is null or cardinality(v_version_ids) = 0 then
    raise exception 'Não foi possível identificar a versão da pesquisa.';
  end if;

  v_expected := cardinality(v_version_ids);

  perform version.id
  from public.survey_versions version
  where version.id = any(v_version_ids)
  order by version.id
  for update;

  if (
    select count(*)
    from public.survey_versions version
    where version.id = any(v_version_ids)
  ) <> v_expected then
    raise exception 'Versão da pesquisa não encontrada.';
  end if;

  if exists (
    select 1
    from public.survey_versions version
    where version.id = any(v_version_ids)
      and version.status <> 'DRAFT'
  ) then
    raise exception 'Versões publicadas não podem ser alteradas. Crie uma nova versão em rascunho.';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_draft_survey_structure()
from public, anon, authenticated, service_role;

drop trigger if exists enforce_draft_survey_sections
on public.survey_sections;
create trigger enforce_draft_survey_sections
before insert or update or delete
on public.survey_sections
for each row
execute function public.enforce_draft_survey_structure();

drop trigger if exists enforce_draft_survey_questions
on public.survey_questions;
create trigger enforce_draft_survey_questions
before insert or update or delete
on public.survey_questions
for each row
execute function public.enforce_draft_survey_structure();

drop trigger if exists enforce_draft_question_options
on public.question_options;
create trigger enforce_draft_question_options
before insert or update or delete
on public.question_options
for each row
execute function public.enforce_draft_survey_structure();

create or replace function public.get_survey_operations(target_survey_id uuid)
returns jsonb
language plpgsql
stable
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

    if v_participants = 0 then
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
        'accessMode', v_application.access_mode
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

revoke all on function public.get_survey_operations(uuid)
from public, anon, service_role;
grant execute on function public.get_survey_operations(uuid)
to authenticated;

create or replace function public.manage_survey_cycle(
  target_survey_id uuid,
  target_action text,
  target_opens_at timestamptz default null,
  target_closes_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor uuid := public.current_person_id();
  v_action text := upper(btrim(coalesce(target_action, '')));
  v_survey public.surveys%rowtype;
  v_version public.survey_versions%rowtype;
  v_application public.survey_applications%rowtype;
  v_integrity jsonb;
  v_first_issue text;
  v_before jsonb;
  v_after jsonb;
  v_next_status text;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração.';
  end if;

  select *
  into v_survey
  from public.surveys
  where id = target_survey_id
  for update;

  if v_survey.id is null then
    raise exception 'Pesquisa não encontrada.';
  end if;

  select *
  into v_version
  from public.survey_versions
  where survey_id = target_survey_id
  order by version_number desc
  limit 1
  for update;

  if v_version.id is null then
    raise exception 'Versão da pesquisa não encontrada.';
  end if;

  select *
  into v_application
  from public.survey_applications
  where survey_version_id = v_version.id
  order by created_at desc
  limit 1
  for update;

  if v_application.id is null then
    raise exception 'Ciclo de aplicação não encontrado.';
  end if;

  if v_action in ('PUBLISH', 'SCHEDULE', 'OPEN', 'REOPEN') then
    v_integrity := public.validate_survey_version_integrity(v_version.id);

    if not (v_integrity ->> 'valid')::boolean then
      v_first_issue := v_integrity #>> '{issues,0,message}';
      raise exception using
        message = format(
          'Operação bloqueada por %s pendência(s) de integridade. %s',
          v_integrity ->> 'blockingCount',
          coalesce(v_first_issue, 'Revise o instrumento.')
        ),
        detail = v_integrity::text,
        hint = 'Atualize o checklist e corrija o instrumento no construtor.';
    end if;
  end if;

  v_before := jsonb_build_object(
    'surveyStatus', v_survey.status,
    'versionStatus', v_version.status,
    'applicationStatus', v_application.status,
    'opensAt', v_application.opens_at,
    'closesAt', v_application.closes_at
  );

  if v_action = 'UPDATE_PERIOD' then
    if target_opens_at is null or target_closes_at is null then
      raise exception 'Informe abertura e encerramento.';
    end if;
    if target_closes_at <= target_opens_at then
      raise exception 'O encerramento deve ocorrer após a abertura.';
    end if;
    if v_application.status not in ('DRAFT', 'SCHEDULED') then
      raise exception 'O período só pode ser alterado em ciclos em rascunho ou agendados.';
    end if;

    update public.survey_applications
    set opens_at = target_opens_at,
        closes_at = target_closes_at,
        updated_at = now()
    where id = v_application.id;

  elsif v_action = 'PUBLISH' then
    if v_version.status <> 'DRAFT' then
      raise exception 'Somente versões em rascunho podem ser publicadas.';
    end if;

    update public.survey_versions
    set status = 'PUBLISHED',
        published_at = coalesce(published_at, now()),
        updated_at = now()
    where id = v_version.id;

    update public.surveys
    set status = 'ACTIVE',
        updated_at = now()
    where id = v_survey.id;

  elsif v_action = 'SCHEDULE' then
    if v_version.status <> 'PUBLISHED' then
      raise exception 'Publique a versão antes de agendar.';
    end if;
    if v_application.status not in ('DRAFT', 'SCHEDULED') then
      raise exception 'Somente ciclos em rascunho ou agendados podem ser agendados.';
    end if;
    if v_application.opens_at is null
      or v_application.closes_at is null
      or v_application.closes_at <= v_application.opens_at then
      raise exception 'Defina um período válido antes de agendar.';
    end if;

    update public.survey_applications
    set status = 'SCHEDULED',
        updated_at = now()
    where id = v_application.id;

  elsif v_action = 'OPEN' then
    if v_version.status <> 'PUBLISHED' then
      raise exception 'Publique a versão antes de abrir o ciclo.';
    end if;
    if v_application.status not in ('DRAFT', 'SCHEDULED') then
      raise exception 'Somente ciclos em rascunho ou agendados podem ser abertos.';
    end if;
    if v_application.opens_at is null or v_application.closes_at is null then
      raise exception 'Defina o período antes de abrir.';
    end if;
    if v_application.closes_at <= v_application.opens_at then
      raise exception 'Defina um período válido antes de abrir.';
    end if;
    if v_application.closes_at <= now() then
      raise exception 'O encerramento informado já passou.';
    end if;

    update public.survey_applications
    set status = 'OPEN',
        opens_at = least(v_application.opens_at, now()),
        updated_at = now()
    where id = v_application.id;

  elsif v_action = 'REOPEN' then
    if v_application.status <> 'CLOSED' then
      raise exception 'Somente ciclos encerrados podem ser reabertos.';
    end if;
    if target_opens_at is null or target_closes_at is null then
      raise exception 'Informe o novo período para reabrir o ciclo.';
    end if;
    if target_closes_at <= greatest(target_opens_at, now()) then
      raise exception 'O novo encerramento deve estar no futuro e após a abertura.';
    end if;
    if v_version.status <> 'PUBLISHED' then
      raise exception 'A versão precisa estar publicada para reabrir o ciclo.';
    end if;

    v_next_status := case
      when target_opens_at > now() then 'SCHEDULED'
      else 'OPEN'
    end;

    update public.survey_applications
    set status = v_next_status,
        opens_at = target_opens_at,
        closes_at = target_closes_at,
        updated_at = now()
    where id = v_application.id;

  elsif v_action = 'CLOSE' then
    if v_application.status <> 'OPEN' then
      raise exception 'Somente ciclos abertos podem ser encerrados. Para ciclos agendados, utilize Cancelar.';
    end if;

    update public.survey_applications
    set status = 'CLOSED',
        closes_at = least(coalesce(closes_at, now()), now()),
        updated_at = now()
    where id = v_application.id;

  elsif v_action = 'CANCEL' then
    if v_application.status not in ('DRAFT', 'SCHEDULED', 'OPEN') then
      raise exception 'Somente ciclos em rascunho, agendados ou abertos podem ser cancelados.';
    end if;

    update public.survey_applications
    set status = 'CANCELLED',
        updated_at = now()
    where id = v_application.id;

  else
    raise exception 'Ação de ciclo inválida.';
  end if;

  select *
  into v_survey
  from public.surveys
  where id = target_survey_id;

  select *
  into v_version
  from public.survey_versions
  where id = v_version.id;

  select *
  into v_application
  from public.survey_applications
  where id = v_application.id;

  v_after := jsonb_build_object(
    'surveyStatus', v_survey.status,
    'versionStatus', v_version.status,
    'applicationStatus', v_application.status,
    'opensAt', v_application.opens_at,
    'closesAt', v_application.closes_at
  );

  insert into public.audit_events(
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    before_data,
    after_data,
    metadata
  )
  values (
    v_actor,
    'SURVEY_CYCLE_' || v_action,
    'SURVEY_APPLICATION',
    v_application.id::text,
    v_application.id,
    v_before,
    v_after,
    jsonb_build_object(
      'surveyId', target_survey_id,
      'versionId', v_version.id,
      'integrityChecked', v_action in ('PUBLISH', 'SCHEDULE', 'OPEN', 'REOPEN')
    )
  );

  return jsonb_build_object(
    'status', 'OK',
    'action', v_action,
    'before', v_before,
    'after', v_after
  );
end;
$$;

revoke all on function public.manage_survey_cycle(uuid, text, timestamptz, timestamptz)
from public, anon, service_role;
grant execute on function public.manage_survey_cycle(uuid, text, timestamptz, timestamptz)
to authenticated;

commit;
