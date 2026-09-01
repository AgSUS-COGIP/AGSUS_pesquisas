begin;

-- Fundação do modelo de permissões por módulo no schema transacional `sigav`.
--
-- Até aqui havia três fontes que podiam divergir:
--   1. ROLE_MODULES no frontend;
--   2. um CASE fixo em fc_obter_contexto_plataforma();
--   3. role_module_permissions/person_module_permissions no banco.
--
-- A partir desta migration, o banco passa a ser a fonte de verdade dos módulos
-- efetivos. role_module_permissions define o pacote padrão do perfil e
-- person_module_permissions pode conceder ou negar um módulo para uma pessoa.
-- O Superadmin mantém bypass para todos os módulos ativos.

-- Primeiro, alinhe o catálogo de permissões padrão ao comportamento vigente do
-- frontend. Isso evita conceder TEAM/ADMIN_IMPORT ao Admin ou HOME ao
-- Participante apenas porque registros antigos permaneceram no catálogo.
delete from sigav.role_module_permissions rmp
where rmp.role_id in (
  select sr.id
  from sigav.system_roles sr
  where sr.code in ('ADMINISTRATOR', 'SURVEY_MANAGER', 'LEADER', 'RESPONDENT')
);

-- Superadmin: todos os módulos ativos.
insert into sigav.role_module_permissions (role_id, module_code, allowed)
select sr.id, pm.code, true
from sigav.system_roles sr
cross join sigav.platform_modules pm
where sr.code = 'ADMINISTRATOR'
  and pm.active;

-- Admin: operação de avaliações e participantes, sem administração global.
insert into sigav.role_module_permissions (role_id, module_code, allowed)
select sr.id, module_code, true
from sigav.system_roles sr
cross join unnest(array[
  'HOME',
  'SURVEYS',
  'DASHBOARDS',
  'ADMIN_SURVEYS',
  'ADMIN_PARTICIPANTS'
]::text[]) as module_code
where sr.code = 'SURVEY_MANAGER';

-- Avaliador: jornada própria + equipe.
insert into sigav.role_module_permissions (role_id, module_code, allowed)
select sr.id, module_code, true
from sigav.system_roles sr
cross join unnest(array['HOME', 'SURVEYS', 'TEAM']::text[]) as module_code
where sr.code = 'LEADER';

-- Participante: apenas as próprias avaliações.
insert into sigav.role_module_permissions (role_id, module_code, allowed)
select sr.id, 'SURVEYS', true
from sigav.system_roles sr
where sr.code = 'RESPONDENT';

-- Cálculo único dos módulos efetivos de uma pessoa.
--
-- Regras:
--   * pessoa inexistente/inativa -> nenhum módulo;
--   * Superadmin -> todos os módulos ativos;
--   * demais perfis -> pacote de role_module_permissions;
--   * person_module_permissions prevalece sobre o pacote do perfil;
--   * módulo inativo nunca é liberado.
create or replace function private.effective_platform_modules(target_person_id uuid)
returns text[]
language sql
stable
security definer
set search_path to 'pg_catalog', 'sigav', 'auth'
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
          and sr.code in ('ADMINISTRATOR', 'SURVEY_MANAGER', 'LEADER', 'RESPONDENT')
        order by case sr.code
          when 'ADMINISTRATOR' then 1
          when 'SURVEY_MANAGER' then 2
          when 'LEADER' then 3
          when 'RESPONDENT' then 4
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
      on rmp.role_id = sr.id
     and rmp.module_code = pm.code
    left join sigav.person_module_permissions pmp
      on pmp.person_id = target_person_id
     and pmp.module_code = pm.code
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

-- Helper exposto no schema da aplicação para RPCs/RLS de domínio. A função
-- sempre verifica a pessoa da sessão atual; não recebe person_id, evitando
-- transformar a autorização em uma API de permissões de terceiros.
create or replace function sigav.has_platform_module(target_module_code text)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'sigav', 'auth'
as $function$
  select coalesce(
    upper(btrim(coalesce(target_module_code, ''))) = any(
      private.effective_platform_modules(sigav.current_person_id())
    ),
    false
  );
$function$;

revoke all on function sigav.has_platform_module(text) from public, anon;
grant execute on function sigav.has_platform_module(text) to authenticated;

-- O contexto institucional passa a devolver exatamente os módulos calculados
-- pelas tabelas de permissão. O contrato JSON é preservado: apenas muda a fonte
-- de `modules`, que já existia no retorno da RPC.
create or replace function sigav.fc_obter_contexto_plataforma()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'sigav', 'auth'
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

  -- O perfil efetivo continua existindo para rótulo e compatibilidade. Módulos
  -- não são mais derivados deste CASE; vêm do cálculo centralizado acima.
  v_role := case
    when 'ADMINISTRATOR' = any(v_roles) then 'ADMINISTRATOR'
    when 'SURVEY_MANAGER' = any(v_roles) then 'SURVEY_MANAGER'
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
    select * into v_participant
    from sigav.application_participants
    where id = v_participant_id;

    select * into v_application
    from sigav.survey_applications
    where id = v_participant.application_id;
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
    'isLeader', (v_role = 'LEADER'),
    'roles', to_jsonb(array[v_role]),
    'modules', to_jsonb(v_modules),
    'canManageSurveys', sigav.can_manage_surveys()
  );
end;
$function$;

revoke all on function sigav.fc_obter_contexto_plataforma() from public, anon;
grant execute on function sigav.fc_obter_contexto_plataforma() to authenticated;

comment on function sigav.has_platform_module(text) is
  'Retorna se a pessoa autenticada possui um módulo efetivo, considerando perfil e override individual.';
comment on function private.effective_platform_modules(uuid) is
  'Calcula módulos efetivos de uma pessoa ativa: perfil padrão + override individual; Superadmin recebe todos os módulos ativos.';

notify pgrst, 'reload schema';

commit;
