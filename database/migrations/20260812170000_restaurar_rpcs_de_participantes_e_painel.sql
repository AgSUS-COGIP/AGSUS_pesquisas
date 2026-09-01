begin;

-- Restaura no repositório sete funções que existem no banco de produção e que
-- nenhuma migration cria. Elas foram aplicadas por SQL direto e nunca viraram
-- arquivo, o que deixa o repositório incapaz de reconstruir o sistema: num
-- banco montado só a partir das migrations, a tela de Participantes e o painel
-- do CDDI simplesmente não funcionam.
--
-- Levantamento de 12/08/2026: 91 funções em produção, 85 criadas por migrations.
-- Destas doze órfãs, sete são usadas — as seis primeiras pelo frontend e a
-- última pela RPC do painel CDDI, que delega o trabalho a ela.
--
-- Ficam de fora, por decisão:
--   claim_my_access, start_or_resume_my_submission,
--   normalize_agsus_google_oauth_referrer — ninguém as chama; restaurá-las
--   perpetuaria código morto no repositório;
--   fc_zzz_teste — resíduo de teste, executável por `authenticated`; deve ser
--   removida do banco, não versionada.
--
-- As definições abaixo foram extraídas de produção com `pg_get_functiondef`,
-- sem edição: o objetivo é que repositório e banco descrevam a mesma coisa.
-- Os nomes legados constam da allowlist de `npm run db:naming`, como os demais
-- objetos restaurados — renomeá-los quebraria os bundles já publicados que os
-- chamam pelo nome.
-- ---------------------------------------------------------------------------
-- list_admin_participant_applications
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_admin_participant_applications()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
begin
  if not public.can_manage_surveys() then
    raise exception 'Seu perfil nÃ£o possui permissÃ£o para gerenciar participantes.';
  end if;

  return (
    select coalesce(jsonb_agg(item order by item->>'code'), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'id', sa.id,
        'code', sa.code,
        'name', sa.name,
        'status', sa.status,
        'accessMode', sa.access_mode,
        'opensAt', sa.opens_at,
        'closesAt', sa.closes_at,
        'participantCount', count(ap.id),
        'completedCount', count(ap.id) filter (where ap.status = 'COMPLETED')
      ) as item
      from public.survey_applications sa
      left join public.application_participants ap
        on ap.application_id = sa.id
       and ap.participant_role = 'RESPONDENT'
       and ap.status <> 'EXCLUDED'
      group by sa.id
    ) q
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- list_admin_application_participants
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_admin_application_participants(target_application_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
begin
  if not public.can_manage_surveys() then
    raise exception 'Seu perfil nÃ£o possui permissÃ£o para consultar participantes.';
  end if;

  if not exists(select 1 from public.survey_applications where id = target_application_id) then
    raise exception 'Pesquisa ou ciclo nÃ£o localizado.';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'id', ap.id,
      'personId', p.id,
      'employeeNumber', p.employee_number,
      'fullName', p.full_name,
      'institutionalEmail', p.institutional_email,
      'jobTitle', p.job_title,
      'costCenter', p.cost_center,
      'workplace', p.workplace,
      'avatarUrl', coalesce(p.metadata->>'avatar_url', p.metadata->>'picture', p.metadata->>'photo_url'),
      'participantRole', ap.participant_role,
      'accessProfile', ap.access_profile,
      'status', ap.status,
      'invitedAt', ap.invited_at,
      'startedAt', ap.started_at,
      'completedAt', ap.completed_at,
      'createdAt', ap.created_at,
      'hasSubmission', exists(
        select 1 from public.submissions s where s.participant_id = ap.id
      )
    ) order by p.full_name), '[]'::jsonb)
    from public.application_participants ap
    join public.people p on p.id = ap.person_id
    where ap.application_id = target_application_id
      and ap.participant_role = 'RESPONDENT'
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- search_admin_people_for_application
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.search_admin_people_for_application(target_application_id uuid, target_search text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_search text := lower(btrim(coalesce(target_search,'')));
begin
  if not public.can_manage_surveys() then
    raise exception 'Seu perfil nÃ£o possui permissÃ£o para consultar pessoas.';
  end if;

  if not exists(select 1 from public.survey_applications where id = target_application_id) then
    raise exception 'Pesquisa ou ciclo nÃ£o localizado.';
  end if;

  return (
    select coalesce(jsonb_agg(jsonb_build_object(
      'personId', p.id,
      'employeeNumber', p.employee_number,
      'fullName', p.full_name,
      'institutionalEmail', p.institutional_email,
      'jobTitle', p.job_title,
      'costCenter', p.cost_center,
      'workplace', p.workplace,
      'avatarUrl', coalesce(p.metadata->>'avatar_url', p.metadata->>'picture', p.metadata->>'photo_url'),
      'participantId', ap.id,
      'participantStatus', ap.status
    ) order by p.full_name), '[]'::jsonb)
    from public.people p
    left join public.application_participants ap
      on ap.application_id = target_application_id
     and ap.person_id = p.id
     and ap.participant_role = 'RESPONDENT'
    where p.active
      and p.employment_status = 'ATIVO'
      and (
        v_search = ''
        or lower(p.full_name) like '%' || v_search || '%'
        or lower(coalesce(p.institutional_email,'')) like '%' || v_search || '%'
        or lower(p.employee_number) like '%' || v_search || '%'
        or lower(coalesce(p.job_title,'')) like '%' || v_search || '%'
      )
    limit 50
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- assign_admin_application_participant
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assign_admin_application_participant(target_application_id uuid, target_person_id uuid, target_access_profile text DEFAULT 'PARTICIPANTE'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_actor uuid := public.current_person_id();
  v_participant public.application_participants%rowtype;
  v_before jsonb;
begin
  if not public.can_manage_surveys() then
    raise exception 'Seu perfil nÃ£o possui permissÃ£o para vincular participantes.';
  end if;

  if not exists(select 1 from public.survey_applications where id = target_application_id) then
    raise exception 'Pesquisa ou ciclo nÃ£o localizado.';
  end if;
  if not exists(select 1 from public.people where id = target_person_id and active) then
    raise exception 'Pessoa ativa nÃ£o localizada.';
  end if;

  select to_jsonb(ap.*) into v_before
  from public.application_participants ap
  where ap.application_id = target_application_id
    and ap.person_id = target_person_id
    and ap.participant_role = 'RESPONDENT';

  insert into public.application_participants(
    application_id, person_id, participant_role, status, access_profile, invited_at, metadata
  ) values (
    target_application_id, target_person_id, 'RESPONDENT', 'ELIGIBLE',
    nullif(btrim(target_access_profile),''), timezone('utc',now()),
    jsonb_build_object('assigned_by',v_actor,'assigned_at',timezone('utc',now()))
  )
  on conflict(application_id, person_id, participant_role) do update
  set status = case
        when public.application_participants.status in ('BLOCKED','EXCLUDED') then 'ELIGIBLE'
        else public.application_participants.status
      end,
      access_profile = coalesce(nullif(btrim(excluded.access_profile),''), public.application_participants.access_profile),
      invited_at = coalesce(public.application_participants.invited_at, excluded.invited_at),
      metadata = coalesce(public.application_participants.metadata,'{}'::jsonb)
        || jsonb_build_object('assigned_by',v_actor,'assigned_at',timezone('utc',now())),
      updated_at = timezone('utc',now())
  returning * into v_participant;

  insert into public.audit_events(
    actor_person_id,event_type,entity_type,entity_id,application_id,before_data,after_data,metadata
  ) values (
    v_actor,'PARTICIPANT_ASSIGNED','APPLICATION_PARTICIPANT',v_participant.id::text,
    target_application_id,v_before,to_jsonb(v_participant),jsonb_build_object('source','ADMIN_PARTICIPANTS')
  );

  return jsonb_build_object('status','OK','participantId',v_participant.id,'participantStatus',v_participant.status);
end;
$function$;

-- ---------------------------------------------------------------------------
-- create_and_assign_admin_participant
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_and_assign_admin_participant(target_application_id uuid, target_employee_number text, target_full_name text, target_institutional_email text, target_job_title text DEFAULT NULL::text, target_cost_center text DEFAULT NULL::text, target_workplace text DEFAULT NULL::text, target_access_profile text DEFAULT 'PARTICIPANTE'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_employee text := btrim(coalesce(target_employee_number,''));
  v_name text := btrim(coalesce(target_full_name,''));
  v_email text := lower(btrim(coalesce(target_institutional_email,'')));
  v_person public.people%rowtype;
  v_result jsonb;
begin
  if not public.can_manage_surveys() then
    raise exception 'Seu perfil nÃ£o possui permissÃ£o para cadastrar participantes.';
  end if;
  if v_employee = '' then raise exception 'Informe a matrÃ­cula da pessoa.'; end if;
  if v_name = '' then raise exception 'Informe o nome completo da pessoa.'; end if;
  if v_email = '' or not public.is_allowed_institutional_email(v_email) then
    raise exception 'Informe um e-mail institucional AgSUS vÃ¡lido.';
  end if;

  select * into v_person
  from public.people
  where employee_number = v_employee
     or lower(coalesce(institutional_email,'')) = v_email
  order by employee_number = v_employee desc
  limit 1;

  if v_person.id is null then
    insert into public.people(
      employee_number,full_name,institutional_email,job_title,cost_center,workplace,
      employment_status,active,source_system,source_key,metadata
    ) values (
      v_employee,v_name,v_email,nullif(btrim(target_job_title),''),nullif(btrim(target_cost_center),''),
      nullif(btrim(target_workplace),''),'ATIVO',true,'ADMIN_MANUAL',v_employee,
      jsonb_build_object('created_by',public.current_person_id(),'created_at',timezone('utc',now()))
    ) returning * into v_person;
  else
    if v_person.employee_number <> v_employee
       and lower(coalesce(v_person.institutional_email,'')) = v_email then
      raise exception 'O e-mail informado jÃ¡ pertence a outra matrÃ­cula (%).', v_person.employee_number;
    end if;

    update public.people
    set full_name = v_name,
        institutional_email = v_email,
        job_title = coalesce(nullif(btrim(target_job_title),''),job_title),
        cost_center = coalesce(nullif(btrim(target_cost_center),''),cost_center),
        workplace = coalesce(nullif(btrim(target_workplace),''),workplace),
        active = true,
        employment_status = 'ATIVO',
        updated_at = timezone('utc',now())
    where id = v_person.id
    returning * into v_person;
  end if;

  v_result := public.assign_admin_application_participant(
    target_application_id,
    v_person.id,
    target_access_profile
  );

  return v_result || jsonb_build_object('personId',v_person.id,'employeeNumber',v_person.employee_number);
end;
$function$;

-- ---------------------------------------------------------------------------
-- set_admin_application_participant_status
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_admin_application_participant_status(target_participant_id uuid, target_status text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_actor uuid := public.current_person_id();
  v_target text := upper(btrim(coalesce(target_status,'')));
  v_participant public.application_participants%rowtype;
  v_before jsonb;
begin
  if not public.can_manage_surveys() then
    raise exception 'Seu perfil nÃ£o possui permissÃ£o para alterar participantes.';
  end if;
  if v_target not in ('ELIGIBLE','BLOCKED','EXCLUDED') then
    raise exception 'SituaÃ§Ã£o de participante invÃ¡lida.';
  end if;

  select * into v_participant
  from public.application_participants
  where id = target_participant_id
  for update;

  if v_participant.id is null then raise exception 'Participante nÃ£o localizado.'; end if;
  if v_participant.completed_at is not null and v_target = 'ELIGIBLE' then
    raise exception 'Uma participaÃ§Ã£o concluÃ­da nÃ£o pode voltar para elegÃ­vel.';
  end if;

  v_before := to_jsonb(v_participant);

  update public.application_participants
  set status = v_target,
      metadata = coalesce(metadata,'{}'::jsonb)
        || jsonb_build_object('status_changed_by',v_actor,'status_changed_at',timezone('utc',now())),
      updated_at = timezone('utc',now())
  where id = target_participant_id
  returning * into v_participant;

  insert into public.audit_events(
    actor_person_id,event_type,entity_type,entity_id,application_id,before_data,after_data,metadata
  ) values (
    v_actor,'PARTICIPANT_STATUS_CHANGED','APPLICATION_PARTICIPANT',v_participant.id::text,
    v_participant.application_id,v_before,to_jsonb(v_participant),jsonb_build_object('source','ADMIN_PARTICIPANTS')
  );

  return jsonb_build_object('status','OK','participantId',v_participant.id,'participantStatus',v_participant.status);
end;
$function$;

-- ---------------------------------------------------------------------------
-- get_cddi_monitoring_dashboard_internal
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_cddi_monitoring_dashboard_internal(target_application_code text DEFAULT 'CDDI-2026'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_person_id uuid;
  v_application_id uuid;
  v_payload jsonb;
  v_scope text;
begin
  v_person_id := public.current_person_id();
  if v_person_id is null then
    raise exception 'Cadastro institucional nÃ£o identificado.';
  end if;

  select sa.id into v_application_id
  from public.survey_applications sa
  where sa.code = btrim(target_application_code)
  limit 1;

  if v_application_id is null then
    raise exception 'Ciclo de pesquisa nÃ£o encontrado.';
  end if;

  v_scope := case
    when public.can_manage_surveys() then 'INSTITUTIONAL'
    when public.has_active_role('LEADER') then 'TEAM'
    else 'INDIVIDUAL'
  end;

  with
  app as (
    select sa.*, sv.title as version_title, sv.version_number, s.name as survey_name
    from public.survey_applications sa
    join public.survey_versions sv on sv.id = sa.survey_version_id
    join public.surveys s on s.id = sv.survey_id
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
      coalesce(p.metadata->>'directorate', p.metadata->>'diretoria', 'SEM INFORMAÃÃO') as directorate,
      coalesce(p.metadata->>'unit', p.metadata->>'unidade', p.cost_center, 'SEM INFORMAÃÃO') as unit_name,
      coalesce(p.metadata->>'coordination', p.metadata->>'coordenacao', 'SEM INFORMAÃÃO') as coordination
    from public.application_participants ap
    join public.people p on p.id = ap.person_id
    where ap.application_id = v_application_id
      and ap.status not in ('BLOCKED', 'EXCLUDED')
      and (
        public.can_manage_surveys()
        or ap.person_id = v_person_id
        or (
          public.has_active_role('LEADER') and exists (
            select 1
            from public.cddi_leadership_links l
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
    from public.cddi_leadership_links l
    join public.people leader on leader.id = l.leader_person_id
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
    from public.submissions s
    join scoped_participants sp on sp.person_id = coalesce(s.subject_person_id, s.respondent_person_id)
    where s.application_id = v_application_id
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
      case when auto.submitted_at is not null then true else false end as auto_completed,
      case when leader.submitted_at is not null then true else false end as leader_completed
    from scoped_participants sp
    left join active_leaders al on al.subordinate_person_id = sp.person_id
    left join latest_submissions auto on auto.subject_id = sp.person_id and auto.normalized_type in ('AUTO', 'AUTOAVALIACAO', 'SELF')
    left join latest_submissions leader on leader.subject_id = sp.person_id and leader.normalized_type in ('CHEFIA', 'LEADER', 'MANAGER')
    left join lateral (
      select r.*
      from public.cddi_final_results r
      where r.application_id = v_application_id and r.subject_person_id = sp.person_id
      order by r.calculated_at desc, r.updated_at desc
      limit 1
    ) fr on true
  ),
  competencies as (
    select sec.id, sec.code, sec.title, sec.position
    from public.survey_sections sec
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
      max(cr.result) filter (where ls.normalized_type in ('AUTO', 'AUTOAVALIACAO', 'SELF')) as auto_score,
      max(cr.result) filter (where ls.normalized_type in ('CHEFIA', 'LEADER', 'MANAGER')) as leader_score
    from latest_submissions ls
    join public.cddi_competency_results cr on cr.submission_id = ls.id
    join competencies c on c.id = cr.competency_section_id
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
    from public.submissions s
    join scoped_participants sp on sp.person_id = coalesce(s.subject_person_id, s.respondent_person_id)
    where s.application_id = v_application_id
      and s.submitted_at is not null
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


-- ---------------------------------------------------------------------------
-- Privilégios
--
-- O PostgreSQL concede `execute` a `public` por padrão, e `anon` herda de
-- `public`. Função `security definer` criada sem `revoke` explícito nasce, num
-- banco reconstruído, chamável por quem nem se autenticou — foi exatamente o
-- que o teste de RLS efetiva acusou ao rodar `PostgreSQL db reset`. Em produção
-- estas funções estão protegidas pelo revoke em massa de 20260803133300 e por
-- SQL aplicado depois; aqui o privilégio passa a viajar junto da definição.
-- ---------------------------------------------------------------------------
revoke all on function public.list_admin_participant_applications() from public, anon;
grant execute on function public.list_admin_participant_applications() to authenticated;

revoke all on function public.list_admin_application_participants(uuid) from public, anon;
grant execute on function public.list_admin_application_participants(uuid) to authenticated;

revoke all on function public.search_admin_people_for_application(uuid, text) from public, anon;
grant execute on function public.search_admin_people_for_application(uuid, text) to authenticated;

revoke all on function public.assign_admin_application_participant(uuid, uuid, text) from public, anon;
grant execute on function public.assign_admin_application_participant(uuid, uuid, text) to authenticated;

revoke all on function public.create_and_assign_admin_participant(uuid, text, text, text, text, text, text, text) from public, anon;
grant execute on function public.create_and_assign_admin_participant(uuid, text, text, text, text, text, text, text) to authenticated;

revoke all on function public.set_admin_application_participant_status(uuid, text) from public, anon;
grant execute on function public.set_admin_application_participant_status(uuid, text) to authenticated;

-- Interna: só a RPC pública `get_cddi_monitoring_dashboard` a invoca, depois de
-- validar identidade e papel. Ninguém a chama diretamente.
revoke all on function public.get_cddi_monitoring_dashboard_internal(text) from public, anon, authenticated;

notify pgrst, 'reload schema';

commit;

-- Rollback: as funções já existem em produção; remover o arquivo basta para
-- desfazer o versionamento. Não execute drop — derrubaria a aplicação.
