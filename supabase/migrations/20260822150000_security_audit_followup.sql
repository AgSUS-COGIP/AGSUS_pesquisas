-- Auditoria de seguranca 2026-08-22.
--
-- Em vez de ampliar a lista de excecoes ao padrao institucional, esta migration
-- cria contratos FC_ em portugues para os tres fluxos corrigidos e retira a
-- execucao autenticada dos nomes legados. Isso permite corrigir bancos que
-- divergiram do historico de migrations sem quebrar o formato REST consumido
-- pelas telas.

-- ---------------------------------------------------------------------------
-- 1. Formulario do respondente: metadados de calculo ficam somente no servidor.
-- ---------------------------------------------------------------------------
create or replace function public.fc_obter_formulario_publico(target_application_code text)
returns jsonb
language sql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
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
            'settings', sq.settings,
            'options', coalesce((
              select jsonb_agg(jsonb_build_object(
                'id', qo.id,
                'code', qo.code,
                'label', qo.label,
                'value', qo.value,
                'position', qo.position
              ) order by qo.position)
              from public.question_options qo
              where qo.question_id = sq.id
                and qo.active = true
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
    and (sa.anonymous or public.can_access_application(sa.id))
  limit 1;
$function$;

revoke all on function public.fc_obter_formulario_publico(text) from public, anon;
grant execute on function public.fc_obter_formulario_publico(text) to authenticated;

-- A jornada anonima entra por uma RPC service_role. O contrato intermediario
-- permanece inacessivel ao cliente e passa a reutilizar o formulario saneado.
create or replace function public.fc_obter_form_anonimo(target_application_code text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public'
as $function$
declare
  v_application public.survey_applications%rowtype;
begin
  select *
  into v_application
  from public.survey_applications
  where code = btrim(target_application_code)
  limit 1;

  if v_application.id is null
     or not v_application.anonymous
     or not public.application_accepts_responses(v_application.id) then
    return null;
  end if;

  return public.fc_obter_formulario_publico(target_application_code);
end;
$function$;

revoke all on function public.fc_obter_form_anonimo(text) from public, anon, authenticated, service_role;

-- O nome legado deixa de ser uma superficie chamavel por usuarios. Mantemos o
-- objeto somente para compatibilidade interna com migrations antigas.
revoke all on function public.get_public_survey_form(text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Busca administrativa: limitar linhas ANTES do jsonb_agg.
-- ---------------------------------------------------------------------------
create or replace function public.fc_pesquisar_pessoa_admin(
  target_search text default null::text,
  target_limit integer default 80
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_search text := lower(btrim(coalesce(target_search, '')));
  v_limit integer := least(greatest(coalesce(target_limit, 80), 1), 250);
begin
  if not public.is_platform_administrator() then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'personId', p.id,
          'employeeNumber', p.employee_number,
          'fullName', p.full_name,
          'institutionalEmail', p.institutional_email,
          'jobTitle', p.job_title,
          'costCenter', p.cost_center,
          'workplace', p.workplace,
          'directorate', nullif(btrim(coalesce(p.metadata->>'directorate', '')), ''),
          'organizationalUnit', nullif(btrim(coalesce(p.metadata->>'unit', '')), ''),
          'coordination', nullif(btrim(coalesce(p.metadata->>'coordination', '')), ''),
          'employmentStatus', p.employment_status,
          'active', p.active,
          'updatedAt', p.updated_at
        )
        order by p.active desc, p.full_name
      ),
      '[]'::jsonb
    )
    from (
      select candidate.*
      from public.people candidate
      where v_search = ''
        or lower(candidate.full_name) like '%' || v_search || '%'
        or lower(candidate.employee_number) like '%' || v_search || '%'
        or lower(coalesce(candidate.institutional_email, '')) like '%' || v_search || '%'
        or lower(coalesce(candidate.job_title, '')) like '%' || v_search || '%'
        or lower(coalesce(candidate.cost_center, '')) like '%' || v_search || '%'
        or lower(coalesce(candidate.workplace, '')) like '%' || v_search || '%'
        or lower(coalesce(candidate.metadata->>'directorate', '')) like '%' || v_search || '%'
        or lower(coalesce(candidate.metadata->>'unit', '')) like '%' || v_search || '%'
        or lower(coalesce(candidate.metadata->>'coordination', '')) like '%' || v_search || '%'
      order by candidate.active desc, candidate.full_name
      limit v_limit
    ) p
  );
end;
$function$;

revoke all on function public.fc_pesquisar_pessoa_admin(text, integer) from public, anon;
grant execute on function public.fc_pesquisar_pessoa_admin(text, integer) to authenticated;
revoke all on function public.search_platform_admin_people(text, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Auditoria por pessoa: limitar eventos ANTES do jsonb_agg.
-- ---------------------------------------------------------------------------
create or replace function public.fc_listar_auditoria_pessoa(
  target_person_id uuid,
  target_limit integer default 30
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_limit integer := least(greatest(coalesce(target_limit, 30), 1), 100);
begin
  if not public.is_platform_administrator() then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;
  if target_person_id is null
     or not exists(select 1 from public.people where id = target_person_id) then
    raise exception 'Pessoa nao encontrada.';
  end if;

  return (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'eventId', e.id,
          'eventType', e.event_type,
          'actorPersonId', e.actor_person_id,
          'actorName', actor.full_name,
          'beforeData', e.before_data,
          'afterData', e.after_data,
          'justification', nullif(btrim(coalesce(e.metadata->>'justification', '')), ''),
          'createdAt', e.created_at
        )
        order by e.created_at desc
      ),
      '[]'::jsonb
    )
    from (
      select event.*
      from public.audit_events event
      where event.entity_type = 'PERSON'
        and event.entity_id = target_person_id::text
      order by event.created_at desc
      limit v_limit
    ) e
    left join public.people actor on actor.id = e.actor_person_id
  );
end;
$function$;

revoke all on function public.fc_listar_auditoria_pessoa(uuid, integer) from public, anon;
grant execute on function public.fc_listar_auditoria_pessoa(uuid, integer) to authenticated;
revoke all on function public.list_platform_admin_person_audit(uuid, integer) from public, anon, authenticated;
