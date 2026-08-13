begin;

-- Abertura automática do ciclo agendado.
--
-- Até aqui "Agendar abertura" só carimbava `survey_applications.status =
-- 'SCHEDULED'`. Nada convertia esse estado em `OPEN`: não há pg_cron, não há
-- cron da Vercel e nenhuma rota fazia a virada. Como responder exige `OPEN`
-- (`application_accepts_responses`), o ciclo chegava na data marcada e
-- continuava fechado — alguém precisava voltar à tela e clicar em abrir. O
-- botão prometia um agendamento que o banco não cumpria.
--
-- A abertura passa a acontecer sozinha, por duas peças que se cobrem:
--
--   1. `fc_abrir_ciclos_agendados()` **materializa** a virada de `SCHEDULED`
--      para `OPEN` quando a abertura chega, e é chamada pelas RPCs de leitura
--      antes de montarem o resultado. É o mesmo desenho preguiçoso que
--      `fc_expirar_pesquisas_arq` adotou para o arquivamento: sem job
--      agendado, o estado se acerta sempre que alguém olha.
--
--   2. `application_accepts_responses()` deixa de depender de a materialização
--      já ter rodado. Sem isso haveria corrida: `/cddi` e o runtime genérico
--      disparam `get_public_survey_form` e `start_or_resume_*` no mesmo
--      `Promise.all`, então a segunda chamada podia ler `SCHEDULED` enquanto a
--      primeira ainda estava abrindo o ciclo, e a primeira pessoa a entrar no
--      minuto da abertura levaria um erro.
--
-- A divisão de papéis é deliberada: o **relógio** decide quem pode responder;
-- o **status** é a materialização desse fato, para catálogo, painel e
-- auditoria lerem um estado honesto.

-- Materializa a abertura dos ciclos cuja data chegou.
--
-- Exige versão publicada porque `OPEN` sem instrumento congelado é estado
-- inválido — a mesma condição que a ação SCHEDULE cobra. Ciclo cujo
-- encerramento já venceu não é aberto: seria abrir e fechar no mesmo instante.
--
-- Concorrência resolvida pelo próprio `update`: duas sessões que chegarem
-- juntas disputam a linha, e a segunda reavalia `status = 'SCHEDULED'` depois
-- do lock, encontra `OPEN` e atualiza zero linhas — sem evento de auditoria
-- duplicado. Por isso a auditoria sai de um CTE alimentado pelo `returning`,
-- e não de uma varredura à parte.
create or replace function public.fc_abrir_ciclos_agendados()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  with abertos as (
    update public.survey_applications sa
    set status = 'OPEN',
        updated_at = now()
    where sa.status = 'SCHEDULED'
      and sa.opens_at is not null
      and sa.opens_at <= now()
      and sa.closes_at is not null
      and sa.closes_at > now()
      and exists (
        select 1
        from public.survey_versions sv
        where sv.id = sa.survey_version_id
          and sv.status = 'PUBLISHED'
      )
    returning sa.id, sa.code, sa.survey_version_id, sa.opens_at, sa.closes_at
  )
  insert into public.audit_events(
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
end;
$$;

-- Função interna: é chamada de dentro de RPCs `security definer`, que executam
-- como o dono e dispensam `execute` do papel de quem chamou. Nenhum grant.
revoke all on function public.fc_abrir_ciclos_agendados() from public, anon, authenticated;

comment on function public.fc_abrir_ciclos_agendados() is
  'Materializa SCHEDULED → OPEN nos ciclos cuja abertura já chegou. Chamada pelas RPCs de leitura; não há job agendado neste projeto.';

-- Portão único do runtime de resposta — passa a aceitar o ciclo agendado cuja
-- abertura já chegou.
--
-- Esta função é a autoridade sobre "aceita resposta agora": além das duas
-- jornadas (`start_or_resume_my_survey_submission` e
-- `start_or_resume_my_cddi_submission`), governa `save_*`, `submit_*`,
-- `can_edit_submission` e as políticas de RLS de submissões e respostas.
-- Reconhecer aqui o ciclo agendado e vencido é o que torna a materialização
-- uma conveniência de exibição, e não uma condição para responder: quem chegar
-- no instante da abertura entra, mesmo que nenhuma leitura tenha virado o
-- status ainda.
--
-- O ramo de `OPEN` é preservado literalmente, inclusive a tolerância a
-- `opens_at`/`closes_at` nulos que ciclos antigos usam.
create or replace function public.application_accepts_responses(target_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.survey_applications sa
    where sa.id = target_application_id
      and (
        sa.status = 'OPEN'
        or (
          sa.status = 'SCHEDULED'
          and sa.opens_at is not null
          and sa.opens_at <= now()
        )
      )
      and (sa.opens_at is null or sa.opens_at <= now())
      and (sa.closes_at is null or sa.closes_at > now())
  );
$$;

-- `manage_survey_cycle`: SCHEDULE passa a gravar o período recebido.
--
-- O agendamento deixou de ser um botão solto na grade de operações e virou o
-- desfecho do cartão de período, onde a data mora. Para isso ser **uma**
-- chamada — e não `UPDATE_PERIOD` seguido de `SCHEDULE`, que não é atômico e
-- deixaria o ciclo com período novo e sem agendamento se a segunda falhasse —
-- a ação passa a aceitar `target_opens_at`/`target_closes_at`, que ela até
-- então ignorava.
--
-- A assinatura **não muda**: os dois argumentos já existiam. Nenhum bundle
-- publicado quebra, e a chamada antiga (sem datas) continua valendo, agendando
-- o período que já estava gravado.
--
-- O restante do corpo é a definição vigente de
-- `20260814090000_arquivar_pesquisa.sql`, reproduzida sem alteração.
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
  v_sections integer;
  v_questions integer;
  v_before jsonb;
  v_after jsonb;
  v_next_status text;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração.';
  end if;

  select * into v_survey
  from public.surveys
  where id = target_survey_id
  for update;
  if v_survey.id is null then raise exception 'Pesquisa não encontrada.'; end if;

  select * into v_version
  from public.survey_versions
  where survey_id = target_survey_id
  order by version_number desc
  limit 1
  for update;
  if v_version.id is null then raise exception 'Versão da pesquisa não encontrada.'; end if;

  select * into v_application
  from public.survey_applications
  where survey_version_id = v_version.id
  order by created_at desc
  limit 1
  for update;
  if v_application.id is null then raise exception 'Ciclo de aplicação não encontrado.'; end if;

  select count(*)::integer into v_sections
  from public.survey_sections
  where survey_version_id = v_version.id;

  select count(*)::integer into v_questions
  from public.survey_questions
  where survey_version_id = v_version.id;

  v_before := jsonb_build_object(
    'surveyStatus', v_survey.status,
    'versionStatus', v_version.status,
    'applicationStatus', v_application.status,
    'opensAt', v_application.opens_at,
    'closesAt', v_application.closes_at,
    'archivedAt', v_survey.dt_arquivamento
  );

  if v_action = 'UPDATE_PERIOD' then
    if target_opens_at is null or target_closes_at is null then
      raise exception 'Informe abertura e encerramento.';
    end if;
    if target_opens_at < now() - interval '1 minute' then
      raise exception 'A abertura não pode ser anterior à data e hora atuais.';
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
    if v_sections = 0 or v_questions = 0 then
      raise exception 'Adicione seções e perguntas antes de publicar.';
    end if;

    update public.survey_versions
    set status = 'PUBLISHED',
        published_at = coalesce(published_at, now()),
        updated_at = now()
    where id = v_version.id;

    update public.surveys
    set status = 'ACTIVE', updated_at = now()
    where id = v_survey.id;

  elsif v_action = 'SCHEDULE' then
    if v_version.status <> 'PUBLISHED' then
      raise exception 'Publique a versão antes de agendar.';
    end if;
    if v_application.status not in ('DRAFT', 'SCHEDULED') then
      raise exception 'Somente ciclos em rascunho ou agendados podem ser agendados.';
    end if;

    -- Período recebido junto: grava antes de agendar, na mesma transação e sob
    -- as mesmas regras de UPDATE_PERIOD. Recebido pela metade é erro — gravar
    -- só uma das pontas deixaria o ciclo num período incoerente.
    if target_opens_at is not null or target_closes_at is not null then
      if target_opens_at is null or target_closes_at is null then
        raise exception 'Informe abertura e encerramento.';
      end if;
      if target_opens_at < now() - interval '1 minute' then
        raise exception 'A abertura não pode ser anterior à data e hora atuais.';
      end if;
      if target_closes_at <= target_opens_at then
        raise exception 'O encerramento deve ocorrer após a abertura.';
      end if;

      update public.survey_applications
      set opens_at = target_opens_at,
          closes_at = target_closes_at,
          updated_at = now()
      where id = v_application.id;

      -- As validações seguintes olham o período efetivo, não o que estava
      -- gravado quando a função começou.
      select * into v_application
      from public.survey_applications
      where id = v_application.id;
    end if;

    if v_application.opens_at is null
       or v_application.closes_at is null
       or v_application.closes_at <= v_application.opens_at then
      raise exception 'Defina um período válido antes de agendar.';
    end if;
    if v_application.closes_at <= now() then
      raise exception 'O período deste ciclo já venceu. Atualize a abertura e o encerramento antes de agendar.';
    end if;

    update public.survey_applications
    set status = 'SCHEDULED', updated_at = now()
    where id = v_application.id;

  elsif v_action = 'OPEN' then
    if v_version.status <> 'PUBLISHED' or v_sections = 0 or v_questions = 0 then
      raise exception 'O instrumento não está pronto para abertura.';
    end if;
    if v_application.status not in ('DRAFT', 'SCHEDULED') then
      raise exception 'Somente ciclos em rascunho ou agendados podem ser abertos.';
    end if;
    if v_application.closes_at is null or v_application.closes_at <= now() then
      raise exception 'O encerramento informado já passou.';
    end if;

    update public.survey_applications
    set status = 'OPEN',
        opens_at = least(coalesce(opens_at, now()), now()),
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
    set status = 'CANCELLED', updated_at = now()
    where id = v_application.id;

    -- Finalizar arquiva na mesma operação: some do catálogo padrão e entra na
    -- janela de 30 dias que antecede a exclusão automática.
    update public.surveys
    set dt_arquivamento = now(), updated_at = now()
    where id = v_survey.id;

  elsif v_action = 'ARCHIVE' then
    if v_survey.dt_arquivamento is not null then
      raise exception 'Esta avaliação já está arquivada.';
    end if;
    if v_application.status in ('SCHEDULED', 'OPEN') then
      raise exception 'Interrompa o ciclo antes de arquivar — use Pausar ou Finalizar.';
    end if;

    update public.surveys
    set dt_arquivamento = now(), updated_at = now()
    where id = v_survey.id;

  elsif v_action = 'UNARCHIVE' then
    if v_survey.dt_arquivamento is null then
      raise exception 'Esta avaliação não está arquivada.';
    end if;

    update public.surveys
    set dt_arquivamento = null, updated_at = now()
    where id = v_survey.id;

  else
    raise exception 'Ação de ciclo inválida.';
  end if;

  select * into v_survey from public.surveys where id = target_survey_id;
  select * into v_version from public.survey_versions where id = v_version.id;
  select * into v_application from public.survey_applications where id = v_application.id;

  v_after := jsonb_build_object(
    'surveyStatus', v_survey.status,
    'versionStatus', v_version.status,
    'applicationStatus', v_application.status,
    'opensAt', v_application.opens_at,
    'closesAt', v_application.closes_at,
    'archivedAt', v_survey.dt_arquivamento
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
  ) values (
    v_actor,
    'SURVEY_CYCLE_' || v_action,
    'SURVEY_APPLICATION',
    v_application.id::text,
    v_application.id,
    v_before,
    v_after,
    jsonb_build_object('surveyId', v_survey.id, 'versionId', v_version.id)
  );

  return jsonb_build_object(
    'status', 'OK',
    'action', v_action,
    'application', v_after
  );
end;
$$;

revoke all on function public.manage_survey_cycle(uuid, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.manage_survey_cycle(uuid, text, timestamptz, timestamptz) to authenticated;

-- As três RPCs de leitura abaixo deixam de ser `stable`.
--
-- Não é escolha de estilo: função `stable` no PostgreSQL é proibida de gravar,
-- inclusive através de outra função — `perform fc_abrir_ciclos_agendados()`
-- dentro delas falharia com "UPDATE is not allowed in a non-volatile
-- function". Como a materialização precisa acontecer na leitura (não há job),
-- elas passam a ser voláteis. Nenhuma é chamada por GET: `supabase.rpc()`
-- envia POST, então o PostgREST as aceita normalmente.
--
-- Os corpos são a definição vigente de cada uma, com uma linha acrescentada.
-- `create or replace function` **preserva os privilégios existentes**, então os
-- grants de cada função não são reaplicados aqui — reaplicá-los correria o
-- risco de devolver a `anon` um acesso que migrations posteriores revogaram.

-- Catálogo do participante: é a porta por onde a maioria entra, e portanto o
-- lugar mais provável de a virada acontecer.
create or replace function public.list_my_survey_catalog()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person_id uuid := public.current_person_id();
  v_is_admin boolean := public.can_manage_surveys();
  v_result jsonb;
begin
  if v_person_id is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;

  perform public.fc_abrir_ciclos_agendados();

  select coalesce(jsonb_agg(jsonb_build_object(
    'surveyId', s.id,
    'surveyCode', s.code,
    'surveyName', s.name,
    'description', s.description,
    'applicationId', sa.id,
    'applicationCode', sa.code,
    'applicationName', sa.name,
    'applicationStatus', sa.status,
    'opensAt', sa.opens_at,
    'closesAt', sa.closes_at,
    'anonymous', sa.anonymous,
    'allowDrafts', sa.allow_drafts,
    'accessMode', sa.access_mode,
    'participantStatus', ap.status,
    'accessProfile', ap.access_profile,
    'completedAt', ap.completed_at,
    'submissionId', sub.id,
    'submissionStatus', sub.status,
    'submissionUpdatedAt', sub.updated_at,
    'sections', (select count(*) from public.survey_sections sec where sec.survey_version_id = sa.survey_version_id),
    'questions', (select count(*) from public.survey_questions q where q.survey_version_id = sa.survey_version_id),
    'canRespond', (public.application_accepts_responses(sa.id) and public.can_access_application(sa.id)),
    'canManage', v_is_admin
  ) order by
    case sa.status when 'OPEN' then 0 when 'SCHEDULED' then 1 when 'CLOSED' then 2 else 3 end,
    coalesce(sa.closes_at, sa.opens_at, sa.created_at) desc), '[]'::jsonb)
  into v_result
  from public.survey_applications sa
  join public.survey_versions sv on sv.id = sa.survey_version_id
  join public.surveys s on s.id = sv.survey_id
  left join public.application_participants ap
    on ap.application_id = sa.id
   and ap.person_id = v_person_id
   and ap.status not in ('BLOCKED', 'EXCLUDED')
  left join lateral (
    select x.id, x.status, x.updated_at
    from public.submissions x
    where x.application_id = sa.id
      and x.respondent_person_id = v_person_id
      and x.submission_type in ('RESPONSE', 'AUTO')
    order by x.version desc, x.created_at desc
    limit 1
  ) sub on true
  where public.can_access_application(sa.id)
    and sa.status in ('SCHEDULED', 'OPEN', 'CLOSED')
    and (v_is_admin or sv.status in ('PUBLISHED', 'RETIRED'));

  return v_result;
end;
$$;

-- Formulário por código de ciclo: a porta do CDDI e de quem chega por link
-- direto, sem passar pelo catálogo. Sem a chamada aqui, essas pessoas veriam o
-- selo "Agendado" para sempre, porque nada mais materializaria a virada no
-- caminho delas.
--
-- Função `sql` com dois comandos: o primeiro é executado e descartado, o
-- resultado é o do último.
create or replace function public.get_public_survey_form(target_application_code text)
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.fc_abrir_ciclos_agendados();

  select jsonb_build_object(
    'application', jsonb_build_object(
      'id', sa.id,
      'code', sa.code,
      'name', sa.name,
      'status', sa.status,
      'opensAt', sa.opens_at,
      'closesAt', sa.closes_at,
      'allowDrafts', sa.allow_drafts,
      'settings', sa.settings,
      'accessMode', sa.access_mode
    ),
    'survey', jsonb_build_object(
      'id', s.id,
      'code', s.code,
      'name', s.name,
      'description', s.description
    ),
    'version', jsonb_build_object(
      'id', sv.id,
      'number', sv.version_number,
      'title', sv.title,
      'description', sv.description,
      'settings', sv.settings
    ),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', ss.id,
        'code', ss.code,
        'title', ss.title,
        'description', ss.description,
        'position', ss.position,
        'settings', ss.settings,
        'questions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', sq.id,
            'code', sq.code,
            'title', sq.title,
            'description', sq.description,
            'type', sq.question_type,
            'required', sq.required,
            'position', sq.position,
            'validation', sq.validation,
            'displayLogic', sq.display_logic,
            'scoring', sq.scoring,
            'settings', sq.settings,
            'options', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', qo.id,
                'code', qo.code,
                'label', qo.label,
                'value', qo.value,
                'score', qo.score,
                'position', qo.position
              ) order by qo.position)
              from public.question_options qo
              where qo.question_id = sq.id and qo.active = true
            ), '[]'::jsonb)
          ) order by sq.position)
          from public.survey_questions sq
          where sq.section_id = ss.id
        ), '[]'::jsonb)
      ) order by ss.position)
      from public.survey_sections ss
      where ss.survey_version_id = sv.id
        and ss.parent_section_id is null
    ), '[]'::jsonb)
  )
  from public.survey_applications sa
  join public.survey_versions sv on sv.id = sa.survey_version_id
  join public.surveys s on s.id = sv.survey_id
  where sa.code = btrim(target_application_code)
    and sv.status in ('PUBLISHED', 'RETIRED')
    and sa.status in ('SCHEDULED', 'OPEN', 'CLOSED')
    and public.can_access_application(sa.id)
  limit 1;
$$;

-- A função passou a gravar, então quem não se autenticou não pode acioná-la.
-- `20260803133300_harden_rpc_permissions.sql` já havia revogado `anon` em
-- massa e `20260812180000` repetiu a dose no runtime, mas esta função nasceu
-- com `grant … to anon` em `20260730211500` e o `create or replace` preserva
-- privilégios — a revogação explícita garante o mesmo resultado num banco
-- reconstruído do zero. Nenhuma rota pública chega aqui: o proxy só libera
-- `/`, `/acesso`, `/auth/confirm`, `/api/health` e `/api/background/*`.
revoke all on function public.get_public_survey_form(text) from public, anon;
grant execute on function public.get_public_survey_form(text) to authenticated;

-- Propriedades do ciclo: sem a chamada aqui, a tela de operação seria a última
-- a saber. Ela busca o agregado ao abrir e depois de cada mutação, sem polling
-- nem revalidação — o ciclo abriria para o participante e o operador
-- continuaria vendo "Agendado" até recarregar por conta própria.
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

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   -- Restaurar a definição anterior das quatro funções redefinidas exige
--   -- reaplicar, nesta ordem: 20260731104000 (application_accepts_responses),
--   -- 20260803133100 (list_my_survey_catalog e get_public_survey_form),
--   -- 20260804195030 (get_survey_operations) e 20260814090000
--   -- (manage_survey_cycle). As três de leitura voltam a ser `stable`.
--   drop function if exists public.fc_abrir_ciclos_agendados();
--   notify pgrst, 'reload schema';
-- commit;
