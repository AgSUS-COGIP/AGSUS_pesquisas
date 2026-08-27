begin;

-- Cinco perfis institucionais mutuamente exclusivos:
-- Superadmin, Admin, Gestor, Avaliador e Participante.
-- Gestor herda as capacidades funcionais do Avaliador e acrescenta Painéis.
-- Participante passa a receber HOME + SURVEYS.

insert into sigav.system_roles (code, name, description)
values (
  'MANAGER',
  'Gestor',
  'Responde às próprias avaliações, realiza avaliações da equipe e acessa painéis de acompanhamento.'
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description;

-- Regrava os pacotes padrão dos cinco perfis.
delete from sigav.role_module_permissions rmp
where rmp.role_id in (
  select sr.id
  from sigav.system_roles sr
  where sr.code in ('ADMINISTRATOR','SURVEY_MANAGER','MANAGER','LEADER','RESPONDENT')
);

insert into sigav.role_module_permissions (role_id, module_code, allowed)
select sr.id, pm.code, true
from sigav.system_roles sr
cross join sigav.platform_modules pm
where sr.code = 'ADMINISTRATOR'
  and pm.active;

insert into sigav.role_module_permissions (role_id, module_code, allowed)
select sr.id, module_code, true
from sigav.system_roles sr
cross join unnest(array[
  'HOME','SURVEYS','DASHBOARDS','ADMIN_SURVEYS','ADMIN_PARTICIPANTS'
]::text[]) module_code
where sr.code = 'SURVEY_MANAGER';

insert into sigav.role_module_permissions (role_id, module_code, allowed)
select sr.id, module_code, true
from sigav.system_roles sr
cross join unnest(array['HOME','SURVEYS','TEAM','DASHBOARDS']::text[]) module_code
where sr.code = 'MANAGER';

insert into sigav.role_module_permissions (role_id, module_code, allowed)
select sr.id, module_code, true
from sigav.system_roles sr
cross join unnest(array['HOME','SURVEYS','TEAM']::text[]) module_code
where sr.code = 'LEADER';

insert into sigav.role_module_permissions (role_id, module_code, allowed)
select sr.id, module_code, true
from sigav.system_roles sr
cross join unnest(array['HOME','SURVEYS']::text[]) module_code
where sr.code = 'RESPONDENT';

-- Herança funcional: qualquer RPC antiga que exige LEADER também aceita MANAGER.
-- Demais papéis continuam sendo comparados de forma estrita.
create or replace function sigav.has_active_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, sigav, auth
as $function$
  select exists (
    select 1
    from sigav.person_role_assignments pra
    join sigav.system_roles sr on sr.id = pra.role_id
    where pra.person_id = sigav.current_person_id()
      and (
        sr.code = upper(btrim(required_role))
        or (upper(btrim(required_role)) = 'LEADER' and sr.code = 'MANAGER')
      )
      and pra.starts_at <= timezone('utc', now())
      and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
  );
$function$;

-- Cálculo central dos módulos efetivos com a nova precedência.
create or replace function private.effective_platform_modules(target_person_id uuid)
returns text[]
language sql
stable
security definer
set search_path = pg_catalog, sigav, auth
as $function$
  with valid_person as (
    select p.id
    from sigav.people p
    where p.id = target_person_id
      and p.active = true
  ),
  effective_role as (
    select coalesce(
      (
        select sr.code
        from sigav.person_role_assignments pra
        join sigav.system_roles sr on sr.id = pra.role_id
        join valid_person vp on vp.id = pra.person_id
        where pra.starts_at <= timezone('utc', now())
          and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
          and sr.code in ('ADMINISTRATOR','SURVEY_MANAGER','MANAGER','LEADER','RESPONDENT')
        order by case sr.code
          when 'ADMINISTRATOR' then 1
          when 'SURVEY_MANAGER' then 2
          when 'MANAGER' then 3
          when 'LEADER' then 4
          when 'RESPONDENT' then 5
          else 99
        end,
        pra.starts_at desc
        limit 1
      ),
      case when exists (select 1 from valid_person) then 'RESPONDENT' else null end
    ) as code
  ),
  module_state as (
    select
      pm.code,
      pm.position,
      case
        when er.code = 'ADMINISTRATOR' then true
        when pmp.person_id is not null then pmp.allowed
        else coalesce(rmp.allowed, false)
      end as allowed
    from sigav.platform_modules pm
    cross join effective_role er
    left join sigav.system_roles sr on sr.code = er.code
    left join sigav.role_module_permissions rmp
      on rmp.role_id = sr.id and rmp.module_code = pm.code
    left join sigav.person_module_permissions pmp
      on pmp.person_id = target_person_id and pmp.module_code = pm.code
    where pm.active = true
      and er.code is not null
  )
  select coalesce(
    array_agg(ms.code order by ms.position, ms.code) filter (where ms.allowed),
    array[]::text[]
  )
  from module_state ms;
$function$;

revoke all on function private.effective_platform_modules(uuid) from public, anon, authenticated;

-- Permite selecionar Gestor na administração de acessos.
create or replace function sigav.fc_definir_perfil_pessoa(p_pessoa uuid, p_perfil text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, sigav, auth
as $function$
declare
  v_actor_id uuid;
  v_role_code text;
  v_role_id uuid;
  v_role_name text;
  v_person_name text;
  v_previous text[];
  v_assignment_id uuid;
begin
  if not sigav.is_platform_administrator() then
    raise exception 'Apenas o Superadmin pode alterar o perfil de acesso de uma pessoa.';
  end if;

  v_actor_id := sigav.current_person_id();
  v_role_code := upper(btrim(coalesce(p_perfil, '')));

  if v_role_code not in ('ADMINISTRATOR','SURVEY_MANAGER','MANAGER','LEADER','RESPONDENT') then
    raise exception 'Perfil inválido. Use Superadmin, Admin, Gestor, Avaliador ou Participante.';
  end if;

  select id, name into v_role_id, v_role_name
  from sigav.system_roles
  where code = v_role_code;
  if v_role_id is null then
    raise exception 'Perfil não encontrado no catálogo.';
  end if;

  select full_name into v_person_name
  from sigav.people
  where id = p_pessoa and active;
  if v_person_name is null then
    raise exception 'Pessoa ativa não encontrada.';
  end if;

  if p_pessoa = v_actor_id and v_role_code <> 'ADMINISTRATOR' then
    raise exception 'Você não pode retirar seu próprio perfil de Superadmin.';
  end if;

  select coalesce(array_agg(distinct sr.code order by sr.code), array[]::text[])
  into v_previous
  from sigav.person_role_assignments pra
  join sigav.system_roles sr on sr.id = pra.role_id
  where pra.person_id = p_pessoa
    and pra.starts_at <= timezone('utc', now())
    and (pra.ends_at is null or pra.ends_at > timezone('utc', now()));

  update sigav.person_role_assignments
  set ends_at = timezone('utc', now())
  where person_id = p_pessoa
    and role_id <> v_role_id
    and starts_at <= timezone('utc', now())
    and (ends_at is null or ends_at > timezone('utc', now()));

  select pra.id into v_assignment_id
  from sigav.person_role_assignments pra
  where pra.person_id = p_pessoa
    and pra.role_id = v_role_id
    and pra.starts_at <= timezone('utc', now())
    and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
  order by pra.starts_at desc
  limit 1;

  if v_assignment_id is null then
    insert into sigav.person_role_assignments (person_id, role_id, starts_at, assigned_by)
    values (p_pessoa, v_role_id, timezone('utc', now()), v_actor_id)
    returning id into v_assignment_id;
  end if;

  insert into sigav.audit_events (
    actor_person_id, event_type, entity_type, entity_id, before_data, after_data, metadata
  ) values (
    v_actor_id,
    'PERSON_PROFILE_SET',
    'PERSON_ROLE_ASSIGNMENT',
    v_assignment_id::text,
    jsonb_build_object('roles', to_jsonb(v_previous)),
    jsonb_build_object(
      'personId', p_pessoa,
      'personName', v_person_name,
      'roleCode', v_role_code,
      'roleName', v_role_name
    ),
    jsonb_build_object('migration', '20260827123000_adicionar_perfil_gestor')
  );

  return jsonb_build_object(
    'status', 'OK',
    'personName', v_person_name,
    'roleCode', v_role_code,
    'roleName', v_role_name
  );
end;
$function$;

revoke all on function sigav.fc_definir_perfil_pessoa(uuid,text) from public, anon;
grant execute on function sigav.fc_definir_perfil_pessoa(uuid,text) to authenticated;

-- Gestor passa a ser uma opção válida na configuração de presença online.
create or replace function sigav.fc_definir_presenca_plataforma(fl_ativa_param boolean, tx_perfis_param text[])
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, sigav, auth
as $function$
declare
  perfis text[];
begin
  if not sigav.has_active_role('ADMINISTRATOR') then
    raise exception 'Somente Superadmin pode alterar a presença online.' using errcode = '42501';
  end if;

  select array_agg(distinct perfil order by perfil)
  into perfis
  from unnest(coalesce(tx_perfis_param, array[]::text[])) perfil
  where perfil = any(array['ADMINISTRATOR','SURVEY_MANAGER','MANAGER','LEADER','RESPONDENT']::text[]);

  if coalesce(cardinality(perfis), 0) = 0 then
    raise exception 'Selecione ao menos um perfil para a presença online.' using errcode = '22023';
  end if;

  update sigav.tb_config_plataforma
  set fl_presenca_online_ativa = coalesce(fl_ativa_param, false),
      tx_perfis_visualizacao_presenca = perfis,
      au_usuario_alteracao = sigav.current_person_id(),
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  return jsonb_build_object(
    'onlinePresenceEnabled', coalesce(fl_ativa_param, false),
    'onlinePresenceViewerRoles', perfis
  );
end;
$function$;

revoke all on function sigav.fc_definir_presenca_plataforma(boolean,text[]) from public, anon;
grant execute on function sigav.fc_definir_presenca_plataforma(boolean,text[]) to authenticated;

-- Contexto institucional reconhece o quinto perfil e continua usando os módulos
-- efetivos calculados no banco.
create or replace function sigav.fc_obter_contexto_plataforma()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, sigav, auth
as $function$
declare
  v_person sigav.people%rowtype;
  v_roles text[] := array[]::text[];
  v_role text;
  v_modules text[] := array[]::text[];
  v_participant sigav.application_participants%rowtype;
  v_application sigav.survey_applications%rowtype;
  v_participant_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'AUTH_REQUIRED');
  end if;

  select * into v_person
  from sigav.people
  where auth_user_id = auth.uid()
    and active = true
  limit 1;

  if v_person.id is null then
    return jsonb_build_object(
      'status', 'UNLINKED',
      'message', 'Conta autenticada sem cadastro institucional ativo.'
    );
  end if;

  select coalesce(array_agg(distinct sr.code order by sr.code), array[]::text[])
  into v_roles
  from sigav.person_role_assignments pra
  join sigav.system_roles sr on sr.id = pra.role_id
  where pra.person_id = v_person.id
    and pra.starts_at <= timezone('utc', now())
    and (pra.ends_at is null or pra.ends_at > timezone('utc', now()));

  v_role := case
    when 'ADMINISTRATOR' = any(v_roles) then 'ADMINISTRATOR'
    when 'SURVEY_MANAGER' = any(v_roles) then 'SURVEY_MANAGER'
    when 'MANAGER' = any(v_roles) then 'MANAGER'
    when 'LEADER' = any(v_roles) then 'LEADER'
    else 'RESPONDENT'
  end;

  v_modules := private.effective_platform_modules(v_person.id);

  select ap.id into v_participant_id
  from sigav.application_participants ap
  join sigav.survey_applications sa on sa.id = ap.application_id
  where ap.person_id = v_person.id
    and ap.status not in ('REMOVED', 'INELIGIBLE')
  order by
    case sa.status when 'OPEN' then 0 when 'SCHEDULED' then 1 when 'DRAFT' then 2 else 3 end,
    coalesce(sa.closes_at, sa.opens_at, sa.created_at) desc
  limit 1;

  if v_participant_id is not null then
    select * into v_participant from sigav.application_participants where id = v_participant_id;
    select * into v_application from sigav.survey_applications where id = v_participant.application_id;
  end if;

  return jsonb_build_object(
    'status', 'OK',
    'person', jsonb_build_object(
      'id', v_person.id,
      'employeeNumber', v_person.employee_number,
      'fullName', v_person.full_name,
      'institutionalEmail', v_person.institutional_email,
      'jobTitle', v_person.job_title,
      'costCenter', v_person.cost_center,
      'workplace', v_person.workplace,
      'metadata', coalesce(v_person.metadata, '{}'::jsonb),
      'avatarUrl', v_person.metadata->>'avatar_url'
    ),
    'participant', case when v_participant.id is null then null else jsonb_build_object(
      'id', v_participant.id,
      'status', v_participant.status,
      'accessProfile', v_participant.access_profile,
      'completedAt', v_participant.completed_at,
      'metadata', coalesce(v_participant.metadata, '{}'::jsonb)
    ) end,
    'application', case when v_application.id is null then null else jsonb_build_object(
      'id', v_application.id,
      'code', v_application.code,
      'name', v_application.name,
      'status', v_application.status,
      'opensAt', v_application.opens_at,
      'closesAt', v_application.closes_at
    ) end,
    'isLeader', (v_role in ('LEADER','MANAGER')),
    'roles', to_jsonb(array[v_role]),
    'modules', to_jsonb(v_modules),
    'canManageSurveys', sigav.can_manage_surveys()
  );
end;
$function$;

revoke all on function sigav.fc_obter_contexto_plataforma() from public, anon;
grant execute on function sigav.fc_obter_contexto_plataforma() to authenticated;

notify pgrst, 'reload schema';

commit;
