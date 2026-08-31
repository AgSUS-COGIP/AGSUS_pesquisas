begin;

-- Remove o módulo `RESULTS` do modelo de acesso.
--
-- A rota `/resultados` era um placeholder: uma página com `EmptyState` que
-- nunca chegou a exibir devolutiva alguma. Ela foi removida do frontend, e o
-- módulo que a governava sai junto — módulo sem tela não concede nada, só
-- aparece no menu e nos atalhos como uma porta que não abre.
--
-- Esta migration existe porque o mapa de módulos vive em **dois lugares que
-- precisam concordar**: o `case` de `fc_obter_contexto_plataforma()` (banco,
-- autoridade efetiva) e `ROLE_MODULES` em `src/lib/platform-modules.ts`
-- (interface). Tirar `RESULTS` só do frontend deixaria o banco devolvendo um
-- módulo que a aplicação não conhece mais.
--
-- O desencontro seria inofensivo por acaso, não por desenho:
-- `normalizePlatformModules()` descarta módulo desconhecido justamente para
-- isso. Mas a regra do projeto é que os dois lados concordem, e é o banco que
-- manda — deixar a divergência de pé transformaria um contrato em coincidência.

-- 1) Contexto da plataforma: o módulo sai dos dois perfis que o recebiam.
--
-- Reproduz a definição vigente de
-- `20260810120000_perfis_exclusivos_quatro_papeis.sql`, alterando apenas as
-- duas listas de `v_modules`. Superadmin passa de dez para nove módulos; Admin,
-- de sete para seis. Avaliador e Participante nunca tiveram `RESULTS`.
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
      'HOME','SURVEYS','DASHBOARDS','TEAM',
      'ADMIN_SURVEYS','ADMIN_PARTICIPANTS','ADMIN_TEAMS','ADMIN_ACCESS','ADMIN_IMPORT'
    ]
    when 'SURVEY_MANAGER' then array[
      'HOME','SURVEYS','DASHBOARDS','TEAM','ADMIN_SURVEYS','ADMIN_PARTICIPANTS'
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

-- 2) Catálogo descritivo.
--
-- `platform_modules`, `role_module_permissions` e `person_module_permissions`
-- **não governam acesso** — não têm leitor em runtime desde `20260803104000`.
-- São documentação do banco, e documentação que descreve um módulo inexistente
-- confunde quem for consultá-la depois.
--
-- `to_regclass` mantém o passo inerte onde as tabelas não existem: elas foram
-- criadas por `20260731115500`, que nunca rodou em parte dos ambientes (ver
-- docs/operacao-permissoes.md), e a ausência delas não pode abortar a migration.
do $$
begin
  if to_regclass('public.role_module_permissions') is not null then
    delete from public.role_module_permissions where module_code = 'RESULTS';
  end if;

  if to_regclass('public.person_module_permissions') is not null then
    delete from public.person_module_permissions where module_code = 'RESULTS';
  end if;

  if to_regclass('public.platform_modules') is not null then
    delete from public.platform_modules where code = 'RESULTS';
  end if;
end
$$;

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   -- Restaura o módulo nas duas listas de v_modules reaplicando a definição de
--   -- 20260810120000_perfis_exclusivos_quatro_papeis.sql, e recria a linha do
--   -- catálogo descritivo:
--   --   insert into public.platform_modules (code, name, category, position)
--   --   values ('RESULTS', 'Resultados', 'WORK', 50) on conflict do nothing;
--   -- A rota /resultados precisa voltar ao frontend antes, senão o módulo
--   -- concede acesso a uma tela que não existe.
--   notify pgrst, 'reload schema';
-- commit;
