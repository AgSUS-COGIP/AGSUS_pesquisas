begin;

-- ============================================================================
-- Uma role técnica para pessoas; autorização funcional por permissão
-- ============================================================================
--
-- Toda requisição institucional continua chegando com a claim técnica
-- `authenticated`. Os antigos perfis (Superadmin, Admin, Gestor, Avaliador e
-- Participante) deixam de participar da autorização e passam a existir apenas
-- como presets da interface. Esta migration materializa o acesso efetivo atual
-- antes de encerrar as atribuições, para ninguém ganhar ou perder acesso no
-- deploy.

insert into sigav.platform_modules (code, name, description, category, position, active)
values (
  'ONLINE_PRESENCE',
  'Visualizar presença online',
  'Permite consultar nomes e fotos das pessoas conectadas.',
  'FEATURE',
  50,
  true
)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    category = excluded.category,
    position = excluded.position,
    active = true;

-- Fotografia do cálculo antigo. A tabela temporária é necessária porque gravar
-- os resultados diretamente em person_module_permissions alteraria a própria
-- entrada do cálculo durante o INSERT.
create temporary table tmp_permissao_efetiva
on commit drop
as
select
  p.id as person_id,
  pm.code as module_code,
  pm.code = any(sigav.effective_platform_modules(p.id)) as allowed
from sigav.people p
cross join sigav.platform_modules pm
where p.active
  and pm.active;

-- Presença possuía uma autorização separada por perfil. Converta-a também em
-- permissão individual antes de aposentar as atribuições funcionais.
update tmp_permissao_efetiva destino
set allowed = true
where destino.module_code = 'ONLINE_PRESENCE'
  and exists (
    select 1
    from sigav.person_role_assignments pra
    join sigav.system_roles sr on sr.id = pra.role_id
    cross join sigav.tb_config_plataforma configuracao
    where pra.person_id = destino.person_id
      and sr.code = any(configuracao.tx_perfis_visualizacao_presenca)
      and pra.starts_at <= timezone('utc', now())
      and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
      and configuracao.co_configuracao = 1
  );

-- HOME e SURVEYS formam o piso da nova role técnica. Bloqueios individuais
-- antigos nessas duas áreas não atravessam a mudança de modelo.
update tmp_permissao_efetiva
set allowed = true
where module_code in ('HOME', 'SURVEYS');

insert into sigav.person_module_permissions (
  person_id,
  module_code,
  allowed,
  granted_by,
  created_at,
  updated_at
)
select
  person_id,
  module_code,
  allowed,
  null,
  timezone('utc', now()),
  timezone('utc', now())
from tmp_permissao_efetiva
on conflict (person_id, module_code) do update
set allowed = excluded.allowed,
    updated_at = excluded.updated_at;

-- As atribuições permanecem como histórico, mas nenhuma fica vigente.
update sigav.person_role_assignments
set ends_at = timezone('utc', now())
where starts_at <= timezone('utc', now())
  and (ends_at is null or ends_at > timezone('utc', now()));

-- Pacotes de perfil não são mais fonte de autorização. Os presets equivalentes
-- passam a morar em src/lib/platform-access-presets.ts.
delete from sigav.role_module_permissions;

create or replace function sigav.effective_platform_modules(target_person_id uuid)
returns text[]
language sql
stable
security definer
set search_path = pg_catalog, sigav
as $function$
  select coalesce(
    array_agg(pm.code order by pm.position, pm.code)
      filter (where coalesce(
        pmp.allowed,
        pm.code in ('HOME', 'SURVEYS')
      )),
    array[]::text[]
  )
  from sigav.people p
  cross join sigav.platform_modules pm
  left join sigav.person_module_permissions pmp
    on pmp.person_id = p.id
   and pmp.module_code = pm.code
  where p.id = target_person_id
    and p.active
    and pm.active;
$function$;

revoke all on function sigav.effective_platform_modules(uuid)
  from public, anon, authenticated, service_role;

-- Compatibilidade para corpos antigos de RPC/RLS. O nome histórico permanece,
-- mas o resultado agora é exclusivamente uma tradução de permissão; nenhuma
-- linha de person_role_assignments é consultada.
create or replace function sigav.has_active_role(required_role text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, sigav
as $function$
  select case upper(btrim(coalesce(required_role, '')))
    when 'ADMINISTRATOR' then sigav.has_platform_module('ADMIN_ACCESS')
    when 'SURVEY_MANAGER' then sigav.has_platform_module('ADMIN_SURVEYS')
    when 'TECHNICAL_TEAM' then sigav.has_platform_module('ADMIN_SURVEYS')
    when 'MANAGER' then sigav.has_platform_module('TEAM')
                          and sigav.has_platform_module('DASHBOARDS')
    when 'LEADER' then sigav.has_platform_module('TEAM')
    when 'AUDITOR' then sigav.has_platform_module('DASHBOARDS')
    when 'RESPONDENT' then sigav.has_platform_module('SURVEYS')
    when 'AUTHENTICATED' then sigav.current_person_id() is not null
    else false
  end;
$function$;

create or replace function sigav.can_manage_surveys()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, sigav
as $function$
  select sigav.has_platform_module('ADMIN_SURVEYS');
$function$;

create or replace function sigav.is_platform_administrator()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, sigav
as $function$
  select sigav.has_platform_module('ADMIN_ACCESS');
$function$;

create or replace function sigav.can_audit_platform()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, sigav
as $function$
  select sigav.has_platform_module('ADMIN_SURVEYS');
$function$;

revoke all on function sigav.has_active_role(text) from public, anon;
revoke all on function sigav.can_manage_surveys() from public, anon;
revoke all on function sigav.is_platform_administrator() from public, anon;
revoke all on function sigav.can_audit_platform()
  from public, anon, authenticated, service_role;
grant execute on function sigav.has_active_role(text) to authenticated;
grant execute on function sigav.can_manage_surveys() to authenticated;
grant execute on function sigav.is_platform_administrator() to authenticated;

-- Contrato administrativo: catálogo de permissões e permissões efetivas de
-- cada pessoa. A role técnica é única e declarada uma vez no agregado.
create or replace function sigav.fc_listar_acessos_paginados(
  p_busca text default '',
  p_limite integer default 100,
  p_offset integer default 0
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, sigav
as $function$
declare
  v_busca text := btrim(coalesce(p_busca, ''));
  v_limite integer := greatest(1, least(coalesce(p_limite, 100), 100));
  v_offset integer := greatest(0, coalesce(p_offset, 0));
  v_total bigint;
  v_people jsonb;
  v_permissions jsonb;
begin
  if sigav.fc_papel_sessao() <> 'authenticated'
     or not sigav.has_platform_module('ADMIN_ACCESS') then
    raise exception 'Acesso restrito à administração de permissões.' using errcode = '42501';
  end if;

  select count(*)
  into v_total
  from sigav.people person
  where person.active
    and (
      v_busca = ''
      or sigav.unaccent_lower(person.full_name) like '%' || sigav.unaccent_lower(v_busca) || '%'
      or coalesce(person.employee_number, '') ilike '%' || v_busca || '%'
      or coalesce(person.institutional_email, '') ilike '%' || v_busca || '%'
      or sigav.unaccent_lower(coalesce(person.job_title, '')) like '%' || sigav.unaccent_lower(v_busca) || '%'
    );

  select coalesce(jsonb_agg(jsonb_build_object(
    'code', pm.code,
    'name', pm.name,
    'description', pm.description,
    'category', pm.category,
    'position', pm.position,
    'required', pm.code in ('HOME', 'SURVEYS')
  ) order by pm.position, pm.code), '[]'::jsonb)
  into v_permissions
  from sigav.platform_modules pm
  where pm.active;

  select coalesce(jsonb_agg(jsonb_build_object(
    'personId', person.id,
    'fullName', person.full_name,
    'employeeNumber', person.employee_number,
    'institutionalEmail', person.institutional_email,
    'jobTitle', person.job_title,
    'unit', coalesce(person.metadata->>'unit', person.cost_center),
    'active', person.active,
    'permissions', to_jsonb(sigav.effective_platform_modules(person.id))
  ) order by person.full_name, person.id), '[]'::jsonb)
  into v_people
  from (
    select candidate.*
    from sigav.people candidate
    where candidate.active
      and (
        v_busca = ''
        or sigav.unaccent_lower(candidate.full_name) like '%' || sigav.unaccent_lower(v_busca) || '%'
        or coalesce(candidate.employee_number, '') ilike '%' || v_busca || '%'
        or coalesce(candidate.institutional_email, '') ilike '%' || v_busca || '%'
        or sigav.unaccent_lower(coalesce(candidate.job_title, '')) like '%' || sigav.unaccent_lower(v_busca) || '%'
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

revoke all on function sigav.fc_listar_acessos_paginados(text, integer, integer)
  from public, anon;
grant execute on function sigav.fc_listar_acessos_paginados(text, integer, integer)
  to authenticated;

create or replace function sigav.fc_definir_permissoes_pessoa(
  p_pessoa uuid,
  p_permissoes text[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, sigav
as $function$
declare
  v_actor_id uuid;
  v_person_name text;
  v_permissions text[];
  v_before text[];
  v_unknown text[];
  v_other_admins integer;
begin
  if sigav.fc_papel_sessao() <> 'authenticated'
     or not sigav.has_platform_module('ADMIN_ACCESS') then
    raise exception 'Acesso restrito à administração de permissões.' using errcode = '42501';
  end if;

  v_actor_id := sigav.current_person_id();
  if v_actor_id is null then
    raise exception 'Sessão sem cadastro institucional vinculado.' using errcode = '42501';
  end if;

  select full_name
  into v_person_name
  from sigav.people
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
      from sigav.platform_modules pm
      where pm.code = upper(btrim(item))
        and pm.active
    );

  if coalesce(cardinality(v_unknown), 0) > 0 then
    raise exception 'Permissões desconhecidas: %', array_to_string(v_unknown, ', ')
      using errcode = '22023';
  end if;

  select coalesce(array_agg(pm.code order by pm.position, pm.code), array[]::text[])
  into v_permissions
  from sigav.platform_modules pm
  where pm.active
    and (
      pm.code in ('HOME', 'SURVEYS')
      or pm.code = any(array(
        select upper(btrim(item))
        from unnest(coalesce(p_permissoes, array[]::text[])) item
        where btrim(item) <> ''
      ))
    );

  v_before := sigav.effective_platform_modules(p_pessoa);

  if p_pessoa = v_actor_id
     and not ('ADMIN_ACCESS' = any(v_permissions)) then
    raise exception 'Você não pode retirar sua própria permissão de administrar acessos.' using errcode = '42501';
  end if;

  if 'ADMIN_ACCESS' = any(v_before)
     and not ('ADMIN_ACCESS' = any(v_permissions)) then
    select count(*)::integer
    into v_other_admins
    from sigav.people p
    where p.active
      and p.id <> p_pessoa
      and 'ADMIN_ACCESS' = any(sigav.effective_platform_modules(p.id));

    if v_other_admins = 0 then
      raise exception 'A plataforma precisa manter ao menos uma pessoa com administração de acessos.' using errcode = '42501';
    end if;
  end if;

  delete from sigav.person_module_permissions
  where person_id = p_pessoa;

  insert into sigav.person_module_permissions (
    person_id,
    module_code,
    allowed,
    granted_by,
    created_at,
    updated_at
  )
  select
    p_pessoa,
    pm.code,
    pm.code = any(v_permissions),
    v_actor_id,
    timezone('utc', now()),
    timezone('utc', now())
  from sigav.platform_modules pm
  where pm.active;

  insert into sigav.audit_events (
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

revoke all on function sigav.fc_definir_permissoes_pessoa(uuid, text[])
  from public, anon;
grant execute on function sigav.fc_definir_permissoes_pessoa(uuid, text[])
  to authenticated;

-- RPCs antigas de manutenção de perfil deixam de fazer parte da superfície da
-- aplicação. Os objetos ficam no banco apenas para preservar histórico e
-- permitir rollback operacional da migration.
revoke all on function sigav.fc_definir_perfil_pessoa(uuid, text)
  from public, anon, authenticated, service_role;
revoke all on function sigav.set_person_role(uuid, text, boolean)
  from public, anon, authenticated, service_role;
revoke all on function sigav.list_access_workspace(text)
  from public, anon, authenticated, service_role;

-- O contexto não expõe mais uma role funcional. TEAM e ADMIN_SURVEYS são
-- capacidades independentes, calculadas da mesma lista de permissões.
create or replace function sigav.fc_obter_contexto_plataforma()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, sigav
as $function$
declare
  v_person sigav.people%rowtype;
  v_modules text[] := array[]::text[];
  v_participant sigav.application_participants%rowtype;
  v_application sigav.survey_applications%rowtype;
  v_participant_id uuid;
begin
  if sigav.fc_uid_sessao() is null then
    return jsonb_build_object('status', 'AUTH_REQUIRED');
  end if;

  select * into v_person
  from sigav.people
  where auth_user_id = sigav.fc_uid_sessao()
    and active = true
  limit 1;

  if v_person.id is null then
    return jsonb_build_object(
      'status', 'UNLINKED',
      'message', 'Conta autenticada sem cadastro institucional ativo.'
    );
  end if;

  v_modules := sigav.effective_platform_modules(v_person.id);

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
    select * into v_participant
    from sigav.application_participants
    where id = v_participant_id;

    select * into v_application
    from sigav.survey_applications
    where id = v_participant.application_id;
  end if;

  return jsonb_build_object(
    'status', 'OK',
    'technicalRole', 'authenticated',
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
    'isLeader', ('TEAM' = any(v_modules)),
    'roles', jsonb_build_array('AUTHENTICATED'),
    'modules', to_jsonb(v_modules),
    'canManageSurveys', ('ADMIN_SURVEYS' = any(v_modules))
  );
end;
$function$;

revoke all on function sigav.fc_obter_contexto_plataforma() from public, anon;
grant execute on function sigav.fc_obter_contexto_plataforma() to authenticated;

-- Presença online também passa a consultar uma permissão, não um perfil.
create or replace function sigav.can_view_platform_presence()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, sigav
as $function$
  select coalesce((
    select configuracao.fl_presenca_online_ativa
      and sigav.has_platform_module('ONLINE_PRESENCE')
    from sigav.tb_config_plataforma configuracao
    where configuracao.co_configuracao = 1
  ), false);
$function$;

revoke all on function sigav.can_view_platform_presence()
  from public, anon, authenticated, service_role;

create or replace function sigav.fc_definir_presenca_plataforma(fl_ativa_param boolean)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, sigav
as $function$
begin
  if sigav.fc_papel_sessao() <> 'authenticated'
     or not sigav.has_platform_module('ADMIN_ACCESS') then
    raise exception 'Acesso restrito à administração da presença online.' using errcode = '42501';
  end if;

  update sigav.tb_config_plataforma
  set fl_presenca_online_ativa = coalesce(fl_ativa_param, false),
      au_usuario_alteracao = sigav.current_person_id(),
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  return jsonb_build_object(
    'onlinePresenceEnabled', coalesce(fl_ativa_param, false)
  );
end;
$function$;

revoke all on function sigav.fc_definir_presenca_plataforma(boolean)
  from public, anon;
grant execute on function sigav.fc_definir_presenca_plataforma(boolean)
  to authenticated;

create or replace function sigav.fc_listar_presenca_online()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, sigav
as $function$
declare
  v_result jsonb;
begin
  if sigav.fc_papel_sessao() <> 'authenticated'
     or not sigav.can_view_platform_presence() then
    raise exception 'Acesso restrito à permissão de visualizar presença online.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(f) order by f."fullName", f."personId"), '[]'::jsonb)
  into v_result
  from (
    select
      p.id as "personId",
      p.full_name as "fullName",
      p.metadata->>'avatar_url' as "avatarUrl",
      'AUTHENTICATED'::text as "roleCode",
      pr.dt_visto_em as "onlineAt"
    from sigav.tb_presenca_online pr
    join sigav.people p on p.id = pr.sq_pessoa
    where pr.dt_visto_em > timezone('utc', now()) - interval '2 minutes'
      and p.active
    order by pr.dt_visto_em desc, p.full_name, p.id
    limit 200
  ) f;

  return v_result;
end;
$function$;

revoke all on function sigav.fc_listar_presenca_online() from public, anon;
grant execute on function sigav.fc_listar_presenca_online() to authenticated;

comment on function sigav.effective_platform_modules(uuid) is
  'Permissões efetivas de uma pessoa ativa. Não consulta perfis; HOME e SURVEYS são o piso para novos cadastros.';
comment on function sigav.has_active_role(text) is
  'Compatibilidade para RPCs legadas: traduz o antigo nome de perfil em permissão, sem consultar atribuições de papel.';
comment on function sigav.fc_definir_permissoes_pessoa(uuid, text[]) is
  'Substitui atomicamente as permissões de uma pessoa; preserva o piso, o próprio administrador e o último administrador.';
comment on function sigav.fc_listar_presenca_online() is
  'Pessoas com batida nos últimos dois minutos. Leitura autorizada por ONLINE_PRESENCE.';

notify pgrst, 'reload schema';

commit;

-- Rollback operacional: restaure role_module_permissions e atribuições vigentes
-- a partir do backup/auditoria anterior. person_module_permissions já contém a
-- fotografia dos acessos e pode ser usada para reconstruir os presets.
