begin;

-- Consolidação do modelo de permissões em quatro perfis mutuamente exclusivos:
--
--   Superadmin   (código interno ADMINISTRATOR)  acesso irrestrito a todos os módulos
--   Admin        (código interno SURVEY_MANAGER) Visão Geral, Pesquisas, Painéis,
--                                                Minha Equipe, Resultados,
--                                                Pesquisas e Ciclos, Participantes
--   Avaliador    (código interno LEADER)         Visão Geral, Pesquisas, Minha Equipe
--   Participante (código interno RESPONDENT)     apenas Pesquisas
--
-- O que muda em relação a 20260807150000:
--
--   1. O Participante deixa de ver HOME e RESULTS — sua jornada é só Pesquisas.
--   2. O Avaliador deixa de ver RESULTS.
--   3. O Admin deixa de ver ADMIN_IMPORT (carga da base institucional é do
--      Superadmin, junto de ADMIN_ACCESS e ADMIN_TEAMS).
--   4. O acesso passa a ser determinado **exclusivamente** pelo perfil: o mapa
--      de módulos por pessoa (person_module_permissions) deixa de ser consultado
--      e a pessoa passa a ter no máximo um papel vigente.
--
-- Os códigos internos legados continuam preservados: has_active_role(),
-- can_manage_surveys(), is_platform_administrator() e dezenas de políticas de
-- RLS os referenciam, e o gate de nomenclatura veda recriar objetos legados.

-- 1) Rótulos alinhados aos nomes oficiais dos quatro perfis. "SuperAdmin" passa
--    a "Superadmin"; os demais textos refletem o novo mapa de módulos.
update public.system_roles
set name = 'Superadmin',
    description = 'Acesso irrestrito a todos os módulos e funcionalidades, incluindo gestão de usuários, perfis e dados institucionais.'
where code = 'ADMINISTRATOR';

update public.system_roles
set name = 'Admin',
    description = 'Visão Geral, Pesquisas, Painéis, Minha Equipe, Resultados, Pesquisas e Ciclos, e Participantes.'
where code = 'SURVEY_MANAGER';

update public.system_roles
set name = 'Avaliador',
    description = 'Visão Geral, Pesquisas e Minha Equipe. Participa das pesquisas e avalia os participantes da sua equipe.'
where code = 'LEADER';

update public.system_roles
set name = 'Participante',
    description = 'Acesso somente ao módulo Pesquisas.'
where code = 'RESPONDENT';

-- 2) Perfis são mutuamente exclusivos: quem acumula mais de um papel vigente
--    mantém apenas o de maior privilégio. Encerra a vigência dos demais em vez
--    de apagar, preservando o histórico das concessões.
update public.person_role_assignments pra
set ends_at = timezone('utc', now())
where pra.starts_at <= timezone('utc', now())
  and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
  and exists (
    select 1
    from public.person_role_assignments outro
    join public.system_roles sr_outro on sr_outro.id = outro.role_id
    join public.system_roles sr_atual on sr_atual.id = pra.role_id
    where outro.person_id = pra.person_id
      and outro.id <> pra.id
      and outro.starts_at <= timezone('utc', now())
      and (outro.ends_at is null or outro.ends_at > timezone('utc', now()))
      -- Precedência: ADMINISTRATOR > SURVEY_MANAGER > LEADER > RESPONDENT.
      and array_position(
            array['ADMINISTRATOR', 'SURVEY_MANAGER', 'LEADER', 'RESPONDENT'],
            sr_outro.code
          )
          < array_position(
            array['ADMINISTRATOR', 'SURVEY_MANAGER', 'LEADER', 'RESPONDENT'],
            sr_atual.code
          )
  );

-- 3) Mapa perfil → módulo, quando as tabelas de catálogo existirem.
--
--    `platform_modules`, `role_module_permissions` e `person_module_permissions`
--    vêm de 20260731115500 e **não têm consumidor em runtime desde
--    20260803104000**: o mapa de módulos passou a ser derivado do papel dentro
--    do corpo de get_my_platform_context() e, hoje, de
--    fc_obter_contexto_plataforma() (item 5 desta migration). O único leitor
--    que existiu foi get_my_platform_context(), removida em 20260807150000.
--
--    Por isso a atualização é condicional: ambientes onde 20260731115500 nunca
--    foi aplicada não têm essas tabelas, e exigi-las quebraria a migration sem
--    nenhum ganho de comportamento. Onde existem, ficam coerentes com o novo
--    modelo — valem como documentação do banco, não como fonte de autorização.
do $$
begin
  if to_regclass('public.role_module_permissions') is not null
     and to_regclass('public.platform_modules') is not null then
    delete from public.role_module_permissions;

    insert into public.role_module_permissions (role_id, module_code, allowed)
    select r.id, m.code, true
    from public.system_roles r
    join public.platform_modules m on (
      r.code = 'ADMINISTRATOR'
      or (r.code = 'SURVEY_MANAGER' and m.code in (
            'HOME', 'SURVEYS', 'DASHBOARDS', 'TEAM', 'RESULTS',
            'ADMIN_SURVEYS', 'ADMIN_PARTICIPANTS'
          ))
      or (r.code = 'LEADER' and m.code in ('HOME', 'SURVEYS', 'TEAM'))
      or (r.code = 'RESPONDENT' and m.code = 'SURVEYS')
    );
  end if;

  -- 4) Exceções individuais de módulo deixam de existir: o acesso é determinado
  --    exclusivamente pelo perfil.
  if to_regclass('public.person_module_permissions') is not null then
    delete from public.person_module_permissions;
  end if;
end;
$$;

-- 5) O contexto passa a derivar os módulos do perfil efetivo, com a mesma
--    precedência aplicada no item 2. `isLeader` continua no retorno por
--    compatibilidade do contrato, significando papel de Avaliador.
create or replace function public.fc_obter_contexto_plataforma()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person public.people%rowtype;
  v_roles text[] := array[]::text[];
  v_role text;
  v_modules text[] := array[]::text[];
  v_participant public.application_participants%rowtype;
  v_application public.survey_applications%rowtype;
  v_participant_id uuid;
begin
  if auth.uid() is null then
    return jsonb_build_object('status', 'AUTH_REQUIRED');
  end if;

  select * into v_person
  from public.people
  where auth_user_id = auth.uid()
    and active = true
  limit 1;

  if v_person.id is null then
    return jsonb_build_object('status', 'UNLINKED', 'message', 'Conta autenticada sem cadastro institucional ativo.');
  end if;

  select coalesce(array_agg(distinct sr.code order by sr.code), array[]::text[])
  into v_roles
  from public.person_role_assignments pra
  join public.system_roles sr on sr.id = pra.role_id
  where pra.person_id = v_person.id
    and pra.starts_at <= timezone('utc', now())
    and (pra.ends_at is null or pra.ends_at > timezone('utc', now()));

  -- Perfil efetivo: o de maior privilégio entre os vigentes. Sem papel
  -- reconhecido, o efetivo é Participante — o piso do modelo.
  v_role := case
    when 'ADMINISTRATOR' = any(v_roles) then 'ADMINISTRATOR'
    when 'SURVEY_MANAGER' = any(v_roles) then 'SURVEY_MANAGER'
    when 'LEADER' = any(v_roles) then 'LEADER'
    else 'RESPONDENT'
  end;

  v_modules := case v_role
    when 'ADMINISTRATOR' then array[
      'HOME','SURVEYS','DASHBOARDS','TEAM','RESULTS',
      'ADMIN_SURVEYS','ADMIN_PARTICIPANTS','ADMIN_TEAMS','ADMIN_ACCESS','ADMIN_IMPORT'
    ]
    when 'SURVEY_MANAGER' then array[
      'HOME','SURVEYS','DASHBOARDS','TEAM','RESULTS','ADMIN_SURVEYS','ADMIN_PARTICIPANTS'
    ]
    when 'LEADER' then array['HOME','SURVEYS','TEAM']
    else array['SURVEYS']
  end;

  select ap.id into v_participant_id
  from public.application_participants ap
  join public.survey_applications sa on sa.id = ap.application_id
  where ap.person_id = v_person.id
    and ap.status not in ('REMOVED','INELIGIBLE')
  order by
    case sa.status when 'OPEN' then 0 when 'SCHEDULED' then 1 when 'DRAFT' then 2 else 3 end,
    coalesce(sa.closes_at, sa.opens_at, sa.created_at) desc
  limit 1;

  if v_participant_id is not null then
    select * into v_participant
    from public.application_participants
    where id = v_participant_id;

    select * into v_application
    from public.survey_applications
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
    'canManageSurveys', public.can_manage_surveys()
  );
end;
$$;

revoke all on function public.fc_obter_contexto_plataforma() from public, anon;
grant execute on function public.fc_obter_contexto_plataforma() to authenticated;

-- 6) `can_manage_surveys()` fica como está: a checagem residual de
--    TECHNICAL_TEAM é inerte (o papel saiu do catálogo em 20260807150000, então
--    has_active_role('TECHNICAL_TEAM') é sempre falso) e redefinir a função aqui
--    esbarraria no gate de nomenclatura, que exige prefixo institucional em
--    função declarada em migration nova. O efeito prático já é o desejado:
--    can_manage_surveys() = Superadmin ou Admin.

-- 7) Atribuição de perfil em uma única operação atômica.
--
--    `set_person_role` concedia e retirava papéis de forma independente, o que
--    permitia acumular perfis (Admin + Participante) e deixava o perfil efetivo
--    ambíguo. Esta função define **o** perfil da pessoa: concede o escolhido e
--    encerra os demais na mesma transação, de modo que ninguém fica sem acesso
--    nem com dois perfis por falha parcial.
create or replace function public.fc_definir_perfil_pessoa(
  p_pessoa uuid,
  p_perfil text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor_id uuid;
  v_role_code text;
  v_role_id uuid;
  v_role_name text;
  v_person_name text;
  v_previous text[];
  v_assignment_id uuid;
begin
  if not public.is_platform_administrator() then
    raise exception 'Apenas o Superadmin pode alterar o perfil de acesso de uma pessoa.';
  end if;

  v_actor_id := public.current_person_id();
  v_role_code := upper(btrim(coalesce(p_perfil, '')));

  if v_role_code not in ('ADMINISTRATOR', 'SURVEY_MANAGER', 'LEADER', 'RESPONDENT') then
    raise exception 'Perfil inválido. Use Superadmin, Admin, Avaliador ou Participante.';
  end if;

  select id, name into v_role_id, v_role_name
  from public.system_roles
  where code = v_role_code;
  if v_role_id is null then
    raise exception 'Perfil não encontrado no catálogo.';
  end if;

  select full_name into v_person_name
  from public.people
  where id = p_pessoa and active;
  if v_person_name is null then
    raise exception 'Pessoa ativa não encontrada.';
  end if;

  -- O Superadmin não pode rebaixar a si mesmo: sobraria a plataforma sem quem
  -- administra perfis.
  if p_pessoa = v_actor_id and v_role_code <> 'ADMINISTRATOR' then
    raise exception 'Você não pode retirar seu próprio perfil de Superadmin.';
  end if;

  select coalesce(array_agg(distinct sr.code order by sr.code), array[]::text[])
  into v_previous
  from public.person_role_assignments pra
  join public.system_roles sr on sr.id = pra.role_id
  where pra.person_id = p_pessoa
    and pra.starts_at <= timezone('utc', now())
    and (pra.ends_at is null or pra.ends_at > timezone('utc', now()));

  -- Concede primeiro: se a pessoa já tem o perfil, a atribuição vigente é
  -- reaproveitada em vez de duplicada.
  select pra.id into v_assignment_id
  from public.person_role_assignments pra
  where pra.person_id = p_pessoa
    and pra.role_id = v_role_id
    and pra.starts_at <= timezone('utc', now())
    and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
  order by pra.starts_at desc
  limit 1;

  if v_assignment_id is null then
    insert into public.person_role_assignments (person_id, role_id, starts_at, assigned_by)
    values (p_pessoa, v_role_id, timezone('utc', now()), v_actor_id)
    returning id into v_assignment_id;
  end if;

  update public.person_role_assignments
  set ends_at = timezone('utc', now())
  where person_id = p_pessoa
    and role_id <> v_role_id
    and starts_at <= timezone('utc', now())
    and (ends_at is null or ends_at > timezone('utc', now()));

  insert into public.audit_events (
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
    jsonb_build_object('migration', '20260810120000_perfis_exclusivos_quatro_papeis')
  );

  return jsonb_build_object(
    'status', 'OK',
    'personName', v_person_name,
    'roleCode', v_role_code,
    'roleName', v_role_name
  );
end;
$$;

revoke all on function public.fc_definir_perfil_pessoa(uuid, text) from public, anon;
grant execute on function public.fc_definir_perfil_pessoa(uuid, text) to authenticated;

-- 8) A função de toggle sai de cena junto com o modelo cumulativo: um perfil por
--    pessoa não se expressa por conceder/retirar papéis independentes.
drop function if exists public.set_person_role(uuid, text, boolean);

-- 9) Registro de auditoria da consolidação.
insert into public.audit_events (event_type, entity_type, entity_id, after_data, metadata)
values (
  'ROLE_MODEL_CONSOLIDATED',
  'SYSTEM_ROLE',
  'ROLE_MODEL_2026_EXCLUSIVE',
  jsonb_build_object(
    'profiles', jsonb_build_array(
      jsonb_build_object('code', 'ADMINISTRATOR', 'name', 'Superadmin', 'modules', 'ALL'),
      jsonb_build_object('code', 'SURVEY_MANAGER', 'name', 'Admin', 'modules', jsonb_build_array('HOME','SURVEYS','DASHBOARDS','TEAM','RESULTS','ADMIN_SURVEYS','ADMIN_PARTICIPANTS')),
      jsonb_build_object('code', 'LEADER', 'name', 'Avaliador', 'modules', jsonb_build_array('HOME','SURVEYS','TEAM')),
      jsonb_build_object('code', 'RESPONDENT', 'name', 'Participante', 'modules', jsonb_build_array('SURVEYS'))
    ),
    'exclusiveProfiles', true,
    'perPersonModuleExceptions', false
  ),
  jsonb_build_object('migration', '20260810120000_perfis_exclusivos_quatro_papeis')
);

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_definir_perfil_pessoa(uuid, text);
--   -- recriar public.set_person_role(uuid, text, boolean) conforme
--   -- 20260731190000_platform_administrator_access.sql (linhas 96-176);
--   -- recriar public.can_manage_surveys() com a checagem de TECHNICAL_TEAM
--   -- conforme 20260731130000 (linhas 22-32);
--   -- recriar public.fc_obter_contexto_plataforma() conforme
--   -- 20260807150000_simplificar_modelo_papeis.sql (linhas 127-232);
--   -- restaurar os nomes/descrições de system_roles conforme
--   -- 20260807150000 (linhas 48-66);
--   -- restaurar o seed de role_module_permissions conforme
--   -- 20260807150000 (linhas 72-82).
--   -- As atribuições encerradas nos itens 2 e as exceções de
--   -- person_module_permissions removidas no item 4 não são recuperáveis:
--   -- consultar audit_events para reconstituir manualmente, se necessário.
-- commit;
