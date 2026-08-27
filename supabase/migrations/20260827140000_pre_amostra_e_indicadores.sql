begin;

-- A fase da publicação vive em `survey_applications.settings.preSample` para
-- preservar a máquina de estados existente. OPEN continua significando prazo
-- aberto; PRE_SAMPLE/POPULATION define quem, dentro desse prazo, pode entrar.

create or replace function public.can_access_application(target_application_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select public.can_manage_surveys()
    or exists (
      select 1
      from public.survey_applications sa
      where sa.id = target_application_id
        and coalesce(sa.settings #>> '{preSample,phase}', 'POPULATION') <> 'PRE_SAMPLE'
        and sa.access_mode = 'INSTITUTIONAL'
        and public.current_person_id() is not null
    )
    or exists (
      select 1
      from public.survey_applications sa
      join public.application_participants ap on ap.application_id = sa.id
      where sa.id = target_application_id
        and ap.person_id = public.current_person_id()
        and ap.status not in ('BLOCKED', 'EXCLUDED')
        and (
          coalesce(sa.settings #>> '{preSample,phase}', 'POPULATION') <> 'PRE_SAMPLE'
          or ap.metadata ->> 'sampleGroup' = 'PRE_SAMPLE'
        )
    );
$$;

create or replace function public.fc_configurar_pre_amostra(
  target_survey_id uuid,
  target_mode text,
  target_size integer default null,
  target_participant_ids uuid[] default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor uuid := public.current_person_id();
  v_application public.survey_applications%rowtype;
  v_population integer;
  v_mode text := upper(btrim(coalesce(target_mode, '')));
  v_selected_ids uuid[];
  v_selected_size integer;
begin
  if not public.can_manage_surveys() then raise exception 'Acesso restrito à administração.'; end if;

  select a.* into v_application
  from public.survey_applications a
  join public.survey_versions v on v.id = a.survey_version_id
  where v.survey_id = target_survey_id
  order by v.version_number desc, a.created_at desc
  limit 1 for update of a;

  if v_application.id is null then raise exception 'Ciclo de aplicação não encontrado.'; end if;
  if v_application.status not in ('DRAFT', 'SCHEDULED') then
    raise exception 'Configure a pré-amostra antes de abrir o ciclo.';
  end if;
  if exists (select 1 from public.submissions where application_id = v_application.id) then
    raise exception 'A pré-amostra não pode ser alterada depois do início das respostas.';
  end if;
  if v_application.access_mode = 'INSTITUTIONAL' then
    raise exception 'A pré-amostra exige um público previamente vinculado ao ciclo.';
  end if;

  select count(*)::integer into v_population
  from public.application_participants
  where application_id = v_application.id and status not in ('BLOCKED', 'EXCLUDED');

  if v_mode not in ('RANDOM', 'MANUAL') then raise exception 'Escolha seleção aleatória simples ou manual.'; end if;

  if v_mode = 'RANDOM' then
    if target_size is null or target_size < 3 then raise exception 'A pré-amostra deve ter ao menos 3 participantes.'; end if;
    select array_agg(chosen.id order by chosen.position) into v_selected_ids
    from (
      select id, row_number() over (order by md5(id::text || v_application.id::text)) as position
      from public.application_participants
      where application_id = v_application.id and status not in ('BLOCKED', 'EXCLUDED')
      order by md5(id::text || v_application.id::text)
      limit target_size
    ) chosen;
  else
    select array_agg(distinct selected_id) into v_selected_ids
    from unnest(coalesce(target_participant_ids, '{}'::uuid[])) selected_id;
    if exists (
      select 1 from unnest(coalesce(v_selected_ids, '{}'::uuid[])) selected_id
      where not exists (
        select 1 from public.application_participants ap
        where ap.id = selected_id and ap.application_id = v_application.id
          and ap.status not in ('BLOCKED', 'EXCLUDED')
      )
    ) then raise exception 'A seleção contém uma pessoa que não está elegível neste ciclo.'; end if;
  end if;

  v_selected_size := coalesce(array_length(v_selected_ids, 1), 0);
  if v_selected_size < 3 then raise exception 'A pré-amostra deve ter ao menos 3 participantes.'; end if;
  if v_selected_size >= v_population then raise exception 'A pré-amostra deve ser menor que a população de % participantes.', v_population; end if;

  update public.application_participants
  set metadata = coalesce(metadata, '{}'::jsonb) - 'sampleGroup', updated_at = timezone('utc', now())
  where application_id = v_application.id;

  update public.application_participants
  set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
        'sampleGroup', case when id = any(v_selected_ids) then 'PRE_SAMPLE' else 'POPULATION' end
      ),
      updated_at = timezone('utc', now())
  where application_id = v_application.id;

  update public.survey_applications
  set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('preSample', jsonb_build_object(
        'enabled', true, 'phase', 'CONFIGURED', 'size', v_selected_size, 'method', v_mode,
        'configuredAt', timezone('utc', now()), 'configuredBy', v_actor
      )),
      status = case when status = 'SCHEDULED' then 'DRAFT' else status end,
      st_notificacao_email = false,
      updated_at = timezone('utc', now())
  where id = v_application.id;

  insert into public.audit_events(actor_person_id, event_type, entity_type, entity_id, application_id, after_data, metadata)
  values (v_actor, 'SURVEY_PRE_SAMPLE_CONFIGURED', 'SURVEY_APPLICATION', v_application.id::text,
    v_application.id, jsonb_build_object('size', v_selected_size, 'population', v_population, 'method', v_mode),
    jsonb_build_object('surveyId', target_survey_id));

  return jsonb_build_object('status', 'OK', 'applicationId', v_application.id,
    'phase', 'CONFIGURED', 'method', v_mode, 'size', v_selected_size, 'population', v_population);
end;
$$;

create or replace function public.fc_proteger_pre_amostra()
returns trigger
language plpgsql
set search_path = pg_catalog, public
as $$
begin
  if new.status in ('OPEN', 'SCHEDULED') and old.status is distinct from new.status
    and coalesce(new.settings #>> '{preSample,phase}', '') = 'CONFIGURED' then
    raise exception 'Use Abrir pré-amostra para liberar somente o grupo selecionado; este ciclo não pode ser aberto ou agendado para toda a população.';
  end if;
  return new;
end;
$$;

drop trigger if exists tbu_proteger_pre_amostra on public.survey_applications;
create trigger tbu_proteger_pre_amostra before update of status on public.survey_applications
for each row execute function public.fc_proteger_pre_amostra();

create or replace function public.fc_abrir_pre_amostra(target_survey_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor uuid := public.current_person_id();
  v_application public.survey_applications%rowtype;
  v_result jsonb;
begin
  if not public.can_manage_surveys() then raise exception 'Acesso restrito à administração.'; end if;
  select a.* into v_application
  from public.survey_applications a join public.survey_versions v on v.id = a.survey_version_id
  where v.survey_id = target_survey_id
  order by v.version_number desc, a.created_at desc limit 1 for update of a;
  if v_application.id is null then raise exception 'Ciclo de aplicação não encontrado.'; end if;
  if coalesce(v_application.settings #>> '{preSample,phase}', '') <> 'CONFIGURED' then
    raise exception 'Configure a pré-amostra antes de liberá-la.';
  end if;

  update public.survey_applications
  set settings = jsonb_set(settings, '{preSample,phase}', '"PRE_SAMPLE"'::jsonb, true),
      st_notificacao_email = false, updated_at = timezone('utc', now())
  where id = v_application.id;

  v_result := public.manage_survey_cycle(target_survey_id, 'OPEN', null, null);

  insert into public.audit_events(actor_person_id, event_type, entity_type, entity_id, application_id, after_data, metadata)
  values (v_actor, 'SURVEY_PRE_SAMPLE_OPENED', 'SURVEY_APPLICATION', v_application.id::text,
    v_application.id, jsonb_build_object('phase', 'PRE_SAMPLE'), jsonb_build_object('surveyId', target_survey_id));
  return v_result || jsonb_build_object('preSamplePhase', 'PRE_SAMPLE');
end;
$$;

create or replace function public.fc_publicar_populacao(target_survey_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor uuid := public.current_person_id();
  v_application public.survey_applications%rowtype;
begin
  if not public.can_manage_surveys() then raise exception 'Acesso restrito à administração.'; end if;
  select a.* into v_application
  from public.survey_applications a join public.survey_versions v on v.id = a.survey_version_id
  where v.survey_id = target_survey_id
  order by v.version_number desc, a.created_at desc limit 1 for update of a;
  if v_application.id is null then raise exception 'Ciclo de aplicação não encontrado.'; end if;
  if v_application.status <> 'OPEN' or coalesce(v_application.settings #>> '{preSample,phase}', '') <> 'PRE_SAMPLE' then
    raise exception 'A população só pode ser liberada durante uma pré-amostra aberta.';
  end if;

  update public.survey_applications
  set settings = jsonb_set(settings, '{preSample,phase}', '"POPULATION"'::jsonb, true),
      updated_at = timezone('utc', now())
  where id = v_application.id;

  insert into public.audit_events(actor_person_id, event_type, entity_type, entity_id, application_id, before_data, after_data, metadata)
  values (v_actor, 'SURVEY_POPULATION_RELEASED', 'SURVEY_APPLICATION', v_application.id::text,
    v_application.id, jsonb_build_object('phase', 'PRE_SAMPLE'), jsonb_build_object('phase', 'POPULATION'),
    jsonb_build_object('surveyId', target_survey_id));
  return jsonb_build_object('status', 'OK', 'applicationId', v_application.id, 'phase', 'POPULATION');
end;
$$;

create or replace function public.fc_obter_pre_amostra(target_survey_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_application public.survey_applications%rowtype;
  v_population integer := 0; v_size integer := 0; v_submitted integer := 0;
begin
  if not public.can_manage_surveys() then raise exception 'Acesso restrito à administração.'; end if;
  select a.* into v_application
  from public.survey_applications a join public.survey_versions v on v.id = a.survey_version_id
  where v.survey_id = target_survey_id order by v.version_number desc, a.created_at desc limit 1;
  if v_application.id is null then raise exception 'Ciclo de aplicação não encontrado.'; end if;
  select count(*)::integer, count(*) filter (where metadata ->> 'sampleGroup' = 'PRE_SAMPLE')::integer
  into v_population, v_size from public.application_participants
  where application_id = v_application.id and status not in ('BLOCKED', 'EXCLUDED');
  select count(*)::integer into v_submitted from public.submissions
  where application_id = v_application.id and status in ('SUBMITTED', 'VALIDATED')
    and metadata ->> 'sampleGroup' = 'PRE_SAMPLE';
  return jsonb_build_object('status', 'OK', 'applicationId', v_application.id,
    'enabled', coalesce((v_application.settings #>> '{preSample,enabled}')::boolean, false),
    'phase', coalesce(v_application.settings #>> '{preSample,phase}', 'DISABLED'),
    'method', v_application.settings #>> '{preSample,method}',
    'size', v_size, 'population', v_population, 'submitted', v_submitted,
    'participantIds', coalesce((select jsonb_agg(ap.id order by p.full_name)
      from public.application_participants ap join public.people p on p.id = ap.person_id
      where ap.application_id = v_application.id and ap.metadata ->> 'sampleGroup' = 'PRE_SAMPLE'), '[]'::jsonb),
    'applicationStatus', v_application.status);
end;
$$;

-- Marca apenas o grupo amostral na submissão. No modo anônimo essa informação
-- sobrevive à destruição do vínculo com a pessoa, sem permitir reidentificação.
create or replace function public.fc_marcar_grupo_amostra()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare v_group text;
begin
  select ap.metadata ->> 'sampleGroup' into v_group
  from public.application_participants ap
  where ap.application_id = new.application_id and ap.person_id = public.current_person_id()
    and ap.participant_role = 'RESPONDENT' limit 1;
  if v_group is not null then new.metadata := coalesce(new.metadata, '{}'::jsonb) || jsonb_build_object('sampleGroup', v_group); end if;
  return new;
end;
$$;

drop trigger if exists tbi_marcar_grupo_amostra on public.submissions;
create trigger tbi_marcar_grupo_amostra before insert on public.submissions
for each row execute function public.fc_marcar_grupo_amostra();

create or replace function public.fc_obter_matriz_pre_amostra(target_survey_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare v_application public.survey_applications%rowtype; v_items jsonb; v_rows jsonb;
begin
  if not public.can_manage_surveys() then raise exception 'Acesso restrito à administração.'; end if;
  select a.* into v_application
  from public.survey_applications a join public.survey_versions v on v.id = a.survey_version_id
  where v.survey_id = target_survey_id order by v.version_number desc, a.created_at desc limit 1;
  if v_application.id is null then raise exception 'Ciclo de aplicação não encontrado.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'code', q.code, 'label', q.title) order by sec.position, q.position), '[]'::jsonb)
  into v_items
  from public.survey_questions q join public.survey_sections sec on sec.id = q.section_id
  where q.survey_version_id = v_application.survey_version_id and (
    q.question_type in ('INTEGER', 'DECIMAL', 'SCALE')
    or (q.question_type = 'SINGLE_CHOICE' and exists (
      select 1 from public.question_options qo where qo.question_id = q.id and qo.active and qo.score is not null))
  );

  select coalesce(jsonb_agg(jsonb_build_object('values', response.values) order by response.submitted_at), '[]'::jsonb)
  into v_rows
  from (
    select s.submitted_at, coalesce(jsonb_object_agg(q.id::text, to_jsonb(coalesce(
      a.answer_number,
      (select qo.score from public.answer_options ao join public.question_options qo on qo.id = ao.option_id
       where ao.answer_id = a.id order by ao.position nulls last limit 1)
    ))) filter (where a.id is not null), '{}'::jsonb) as values
    from public.submissions s
    cross join public.survey_questions q
    left join public.answers a on a.submission_id = s.id and a.question_id = q.id
    where s.application_id = v_application.id and s.status in ('SUBMITTED', 'VALIDATED')
      and s.metadata ->> 'sampleGroup' = 'PRE_SAMPLE'
      and q.survey_version_id = v_application.survey_version_id and (
        q.question_type in ('INTEGER', 'DECIMAL', 'SCALE')
        or (q.question_type = 'SINGLE_CHOICE' and exists (
          select 1 from public.question_options qo where qo.question_id = q.id and qo.active and qo.score is not null))
      )
    group by s.id, s.submitted_at
  ) response;
  return jsonb_build_object('items', v_items, 'rows', v_rows);
end;
$$;

revoke all on function public.fc_configurar_pre_amostra(uuid, text, integer, uuid[]) from public, anon;
revoke all on function public.fc_abrir_pre_amostra(uuid) from public, anon;
revoke all on function public.fc_publicar_populacao(uuid) from public, anon;
revoke all on function public.fc_obter_pre_amostra(uuid) from public, anon;
revoke all on function public.fc_obter_matriz_pre_amostra(uuid) from public, anon;
revoke all on function public.fc_marcar_grupo_amostra() from public, anon, authenticated;
revoke all on function public.fc_proteger_pre_amostra() from public, anon, authenticated;
grant execute on function public.fc_configurar_pre_amostra(uuid, text, integer, uuid[]) to authenticated;
grant execute on function public.fc_abrir_pre_amostra(uuid) to authenticated;
grant execute on function public.fc_publicar_populacao(uuid) to authenticated;
grant execute on function public.fc_obter_pre_amostra(uuid) to authenticated;
grant execute on function public.fc_obter_matriz_pre_amostra(uuid) to authenticated;

commit;
