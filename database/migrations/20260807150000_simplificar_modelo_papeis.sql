begin;

-- Simplificação do modelo de permissões para quatro papéis:
--
--   SuperAdmin   (código interno ADMINISTRATOR)  acesso irrestrito, inclusive gestão de usuários e permissões
--   Admin        (código interno SURVEY_MANAGER) gestão completa das avaliações, sem administração global
--   Avaliador    (código interno LEADER)         participante + módulo Minha equipe
--   Participante (código interno RESPONDENT)     responde e acompanha as próprias avaliações
--
-- Os códigos internos legados são preservados de propósito: dezenas de políticas
-- de RLS e funções SECURITY DEFINER os referenciam (has_active_role,
-- can_manage_surveys, is_platform_administrator) e o padrão institucional veda
-- recriar objetos legados em migrations novas. O que muda é o conjunto de papéis
-- (TECHNICAL_TEAM é absorvido pelo SuperAdmin; AUDITOR é descontinuado), os
-- rótulos exibidos e o mapa de módulos por papel.

-- 1) Toda pessoa com TECHNICAL_TEAM vigente passa a SuperAdmin, sem duplicar
--    atribuição de quem já acumula os dois papéis.
insert into public.person_role_assignments (person_id, role_id, starts_at)
select distinct pra.person_id, adm.id, timezone('utc', now())
from public.person_role_assignments pra
join public.system_roles tec on tec.id = pra.role_id and tec.code = 'TECHNICAL_TEAM'
join public.system_roles adm on adm.code = 'ADMINISTRATOR'
where pra.starts_at <= timezone('utc', now())
  and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
  and not exists (
    select 1
    from public.person_role_assignments cur
    where cur.person_id = pra.person_id
      and cur.role_id = adm.id
      and cur.starts_at <= timezone('utc', now())
      and (cur.ends_at is null or cur.ends_at > timezone('utc', now()))
  );

-- 2) Papéis descontinuados saem do catálogo. A FK das atribuições é
--    on delete restrict, então elas saem antes; o histórico de concessões
--    permanece registrado em audit_events.
delete from public.person_role_assignments pra
using public.system_roles sr
where sr.id = pra.role_id
  and sr.code in ('TECHNICAL_TEAM', 'AUDITOR');

delete from public.system_roles
where code in ('TECHNICAL_TEAM', 'AUDITOR');

-- 3) Rótulos institucionais dos quatro papéis do novo modelo. A tela de
--    acessos exibe name/description direto do banco.
update public.system_roles
set name = 'SuperAdmin',
    description = 'Acesso irrestrito ao sistema: administração global da plataforma, gestão de usuários e de permissões.'
where code = 'ADMINISTRATOR';

update public.system_roles
set name = 'Admin',
    description = 'Gestão completa das avaliações: instrumentos, ciclos, perguntas, participantes, respostas, painéis e importações.'
where code = 'SURVEY_MANAGER';

update public.system_roles
set name = 'Avaliador',
    description = 'Responde às próprias avaliações e realiza as avaliações da sua equipe.'
where code = 'LEADER';

update public.system_roles
set name = 'Participante',
    description = 'Visualiza e responde as próprias avaliações e acompanha os próprios resultados.'
where code = 'RESPONDENT';

-- 4) Mapa papel → módulo refeito para o novo modelo. Participante e Avaliador
--    deixam de ver DASHBOARDS (painéis analíticos são administrativos) e o
--    Admin deixa de ver ADMIN_TEAMS e ADMIN_ACCESS (gestão de pessoas, dados
--    funcionais e permissões é administração global, exclusiva do SuperAdmin).
delete from public.role_module_permissions;

insert into public.role_module_permissions (role_id, module_code, allowed)
select r.id, m.code, true
from public.system_roles r
join public.platform_modules m on (
  r.code = 'ADMINISTRATOR'
  or (r.code = 'SURVEY_MANAGER' and m.code not in ('ADMIN_ACCESS', 'ADMIN_TEAMS'))
  or (r.code = 'LEADER' and m.code in ('HOME', 'SURVEYS', 'TEAM', 'RESULTS'))
  or (r.code = 'RESPONDENT' and m.code in ('HOME', 'SURVEYS', 'RESULTS'))
);

-- 5) As três políticas que citavam o papel AUDITOR literalmente são recriadas
--    sem ele. A leitura administrativa continua coberta por can_manage_surveys().
drop policy if exists submissions_select_authorized on public.submissions;
create policy submissions_select_authorized on public.submissions
  for select to authenticated
  using (
    respondent_person_id = public.current_person_id()
    or (select public.can_manage_surveys())
  );

drop policy if exists answers_select_authorized on public.answers;
create policy answers_select_authorized on public.answers
  for select to authenticated
  using (
    exists (
      select 1
      from public.submissions s
      where s.id = answers.submission_id
        and (
          s.respondent_person_id = public.current_person_id()
          or (select public.can_manage_surveys())
        )
    )
  );

drop policy if exists answer_options_select_authorized on public.answer_options;
create policy answer_options_select_authorized on public.answer_options
  for select to authenticated
  using (
    exists (
      select 1
      from public.answers a
      join public.submissions s on s.id = a.submission_id
      where a.id = answer_options.answer_id
        and (
          s.respondent_person_id = public.current_person_id()
          or (select public.can_manage_surveys())
        )
    )
  );

-- 6) Novo contrato de contexto com o mapa de módulos do novo modelo.
--    Substitui get_my_platform_context(); isLeader significa papel de Avaliador.
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

  if 'ADMINISTRATOR' = any(v_roles) then
    v_modules := array['HOME','SURVEYS','DASHBOARDS','TEAM','RESULTS','ADMIN_SURVEYS','ADMIN_PARTICIPANTS','ADMIN_TEAMS','ADMIN_ACCESS','ADMIN_IMPORT'];
  elsif 'SURVEY_MANAGER' = any(v_roles) then
    v_modules := array['HOME','SURVEYS','DASHBOARDS','TEAM','RESULTS','ADMIN_SURVEYS','ADMIN_PARTICIPANTS','ADMIN_IMPORT'];
  else
    v_modules := array['HOME','SURVEYS','RESULTS'];
    if 'LEADER' = any(v_roles) then
      v_modules := array_append(v_modules, 'TEAM');
    end if;
  end if;

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
    'isLeader', ('LEADER' = any(v_roles)),
    'roles', to_jsonb(v_roles),
    'modules', to_jsonb(v_modules),
    'canManageSurveys', public.can_manage_surveys()
  );
end;
$$;

revoke all on function public.fc_obter_contexto_plataforma() from public, anon;
grant execute on function public.fc_obter_contexto_plataforma() to authenticated;

-- 7) A função legada sai de cena junto com o modelo antigo: frontend e rota de
--    importação passam a consumir fc_obter_contexto_plataforma().
drop function if exists public.get_my_platform_context();

-- 8) Registro de auditoria da mudança de modelo.
insert into public.audit_events (event_type, entity_type, entity_id, after_data, metadata)
values (
  'ROLE_MODEL_SIMPLIFIED',
  'SYSTEM_ROLE',
  'ROLE_MODEL_2026',
  jsonb_build_object(
    'roles', jsonb_build_array(
      jsonb_build_object('code', 'ADMINISTRATOR', 'name', 'SuperAdmin'),
      jsonb_build_object('code', 'SURVEY_MANAGER', 'name', 'Admin'),
      jsonb_build_object('code', 'LEADER', 'name', 'Avaliador'),
      jsonb_build_object('code', 'RESPONDENT', 'name', 'Participante')
    ),
    'removedRoles', jsonb_build_array('TECHNICAL_TEAM', 'AUDITOR')
  ),
  jsonb_build_object('migration', '20260807150000_simplificar_modelo_papeis')
);

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_obter_contexto_plataforma();
--   -- recriar public.get_my_platform_context() conforme
--   -- 20260803104000_restore_platform_context_and_team_search.sql (linhas 15-119);
--   -- recriar os papéis TECHNICAL_TEAM e AUDITOR e as atribuições encerradas;
--   -- restaurar os nomes/descrições anteriores de system_roles
--   -- (20260730200000, linhas 347-353; 20260731190500, linhas 3-6);
--   -- restaurar o seed de role_module_permissions
--   -- (20260731115500, linhas 48-58);
--   -- recriar as políticas submissions_select_authorized,
--   -- answers_select_authorized e answer_options_select_authorized
--   -- conforme 20260730200000 (linhas 552, 556 e 560).
-- commit;
