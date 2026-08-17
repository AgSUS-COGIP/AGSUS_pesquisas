begin;

-- Acentos das RPCs de participantes.
--
-- O defeito
-- ---------
-- `20260812170000_restaurar_rpcs_de_participantes_e_painel.sql` foi gravada com
-- texto duplamente codificado: 37 sequências de bytes em que um caractere
-- acentuado passou por UTF-8 → Latin-1 → UTF-8. Quem erra a matrícula deveria
-- ler "Informe a matrícula da pessoa."; o "í" chega como dois caracteres
-- estranhos no lugar do acento. (O exemplo corrompido não é reproduzido aqui de
-- propósito: colar os bytes defeituosos faria esta migration ser apontada pela
-- própria consulta de conferência que está no fim deste comentário.)
--
-- É a única migration do repositório com esse defeito, e ele é **reproduzível**:
-- qualquer ambiente reconstruído por `supabase db reset` nasce com as mensagens
-- corrompidas. Não é divergência entre banco e repositório — é o repositório
-- que está errado.
--
-- Duas das 37 já foram corrigidas em `20260814170000` (o `SEM INFORMAÇÃO` do
-- painel do CDDI) e mais duas em `20260817120000`
-- (`list_admin_participant_applications`). Faltavam as 27 destas cinco funções.
--
-- Como a correção foi feita
-- -------------------------
-- Nenhum acento foi digitado. Os corpos foram extraídos do banco **em bytes** e
-- transformados pela regra que descreve exatamente o defeito: a sequência
-- `c383 c2YY` volta a ser `c3 YY`. Ela é segura porque `c383 c2YY` é "Ã"
-- seguido de um caractere de controle C1 — combinação que não ocorre em texto
-- real.
--
-- A aritmética fecha e é a prova de que nada além disso mudou: cada ocorrência
-- encolhe o corpo em exatamente 2 bytes (4 → 2), e os cinco corpos encolheram
-- 22, 12, 8, 6 e 6 bytes, para 11, 6, 4, 3 e 3 ocorrências. Depois da
-- transformação não sobrou nenhuma sequência `c383c2`, e os cinco decodificam
-- como UTF-8 válido, sem caractere de substituição.
--
-- **Nenhuma lógica muda.** Assinaturas, filtros, permissões e retornos são os
-- que estavam em produção. O que muda é o texto que chega a quem opera.
--
-- Depois desta migration, nenhuma função de `public` tem dupla codificação.
-- Para conferir em qualquer ambiente:
--
--   select p.proname
--   from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--   where n.nspname = 'public'
--     and encode(convert_to(pg_get_functiondef(p.oid), 'UTF8'), 'hex') like '%c383c2%';

---------------------------------------------------------------------------
-- set_admin_application_participant_status
---------------------------------------------------------------------------
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
    raise exception 'Seu perfil não possui permissão para alterar participantes.';
  end if;
  if v_target not in ('ELIGIBLE','BLOCKED','EXCLUDED') then
    raise exception 'Situação de participante inválida.';
  end if;

  select * into v_participant
  from public.application_participants
  where id = target_participant_id
  for update;

  if v_participant.id is null then raise exception 'Participante não localizado.'; end if;
  if v_participant.completed_at is not null and v_target = 'ELIGIBLE' then
    raise exception 'Uma participação concluída não pode voltar para elegível.';
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
$function$
;

---------------------------------------------------------------------------
-- create_and_assign_admin_participant
---------------------------------------------------------------------------
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
    raise exception 'Seu perfil não possui permissão para cadastrar participantes.';
  end if;
  if v_employee = '' then raise exception 'Informe a matrícula da pessoa.'; end if;
  if v_name = '' then raise exception 'Informe o nome completo da pessoa.'; end if;
  if v_email = '' or not public.is_allowed_institutional_email(v_email) then
    raise exception 'Informe um e-mail institucional AgSUS válido.';
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
      raise exception 'O e-mail informado já pertence a outra matrícula (%).', v_person.employee_number;
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
$function$
;

---------------------------------------------------------------------------
-- assign_admin_application_participant
---------------------------------------------------------------------------
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
    raise exception 'Seu perfil não possui permissão para vincular participantes.';
  end if;

  if not exists(select 1 from public.survey_applications where id = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;
  if not exists(select 1 from public.people where id = target_person_id and active) then
    raise exception 'Pessoa ativa não localizada.';
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
$function$
;

---------------------------------------------------------------------------
-- list_admin_application_participants
---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_admin_application_participants(target_application_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
begin
  if not public.can_manage_surveys() then
    raise exception 'Seu perfil não possui permissão para consultar participantes.';
  end if;

  if not exists(select 1 from public.survey_applications where id = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
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
$function$
;

---------------------------------------------------------------------------
-- search_admin_people_for_application
---------------------------------------------------------------------------
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
    raise exception 'Seu perfil não possui permissão para consultar pessoas.';
  end if;

  if not exists(select 1 from public.survey_applications where id = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
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
$function$
;

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   -- Restaurar as definicoes anteriores traz de volta as mensagens
--   -- corrompidas. Nao ha motivo para isso.
-- commit;
