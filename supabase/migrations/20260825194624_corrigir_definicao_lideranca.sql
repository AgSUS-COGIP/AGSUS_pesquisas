begin;

-- As duas RPCs legadas redefinidas abaixo preservam contratos já consumidos
-- pelo frontend e constam de LEGACY_RESTORED_OBJECTS no validador. A nova RPC
-- de ciclos segue o padrão institucional.

-- O formulário administrativo de liderança usava o catálogo genérico de
-- aplicações. Isso permitia escolher pesquisas que não são CDDI e oferecia um
-- vínculo que o restante da plataforma nunca consumiria.
create or replace function public.fc_listar_ciclos_lideranca_adm()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
begin
  if not public.is_platform_administrator() then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;

  return (
    select coalesce(jsonb_agg(item order by item->>'code'), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'id', application.id,
        'code', application.code,
        'name', application.name,
        'status', application.status,
        'accessMode', application.access_mode,
        'participantCount', count(participant.id),
        'completedCount', count(participant.id) filter (where participant.status = 'COMPLETED')
      ) as item
      from public.survey_applications application
      join public.survey_versions version on version.id = application.survey_version_id
      join public.surveys survey on survey.id = version.survey_id
      left join public.application_participants participant
        on participant.application_id = application.id
       and participant.participant_role = 'RESPONDENT'
       and participant.status <> 'EXCLUDED'
      where survey.code = 'CDDI'
        and survey.dt_arquivamento is null
        and application.status <> 'CANCELLED'
      group by application.id
    ) applications
  );
end;
$function$;

-- A lista anterior devolvia somente a página de até 250 registros. A interface
-- tratava o tamanho dessa página como o total de vínculos ativos. O envelope
-- abaixo separa os itens visíveis das contagens reais do ciclo e da busca.
drop function if exists public.list_platform_admin_leadership_links(uuid, text, integer);

create function public.list_platform_admin_leadership_links(
  target_application_id uuid,
  target_search text default null,
  target_limit integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_search text := lower(btrim(coalesce(target_search, '')));
  v_limit integer := least(greatest(coalesce(target_limit, 100), 1), 250);
begin
  if not public.is_platform_administrator() then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;

  if not exists (
    select 1
    from public.survey_applications application
    join public.survey_versions version on version.id = application.survey_version_id
    join public.surveys survey on survey.id = version.survey_id
    where application.id = target_application_id
      and survey.code = 'CDDI'
      and survey.dt_arquivamento is null
      and application.status <> 'CANCELLED'
  ) then
    raise exception 'Ciclo CDDI não localizado ou indisponível.';
  end if;

  return (
    with filtered as materialized (
      select
        link.id as link_id,
        link.application_id,
        link.leader_person_id,
        leader.full_name as leader_name,
        leader.employee_number as leader_employee_number,
        link.subordinate_person_id,
        subordinate.full_name as subordinate_name,
        subordinate.employee_number as subordinate_employee_number,
        link.status,
        link.valid_from,
        link.valid_to,
        link.origin,
        (link.status = 'ACTIVE' and link.valid_to is null) as is_active
      from public.cddi_leadership_links link
      join public.people leader on leader.id = link.leader_person_id
      join public.people subordinate on subordinate.id = link.subordinate_person_id
      where link.application_id = target_application_id
        and (
          v_search = ''
          or lower(leader.full_name) like '%' || v_search || '%'
          or lower(leader.employee_number) like '%' || v_search || '%'
          or lower(subordinate.full_name) like '%' || v_search || '%'
          or lower(subordinate.employee_number) like '%' || v_search || '%'
        )
    ),
    page as (
      select *
      from filtered
      order by is_active desc, subordinate_name, valid_from desc
      limit v_limit
    )
    select jsonb_build_object(
      'links',
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'linkId', item.link_id,
            'applicationId', item.application_id,
            'leaderPersonId', item.leader_person_id,
            'leaderName', item.leader_name,
            'leaderEmployeeNumber', item.leader_employee_number,
            'subordinatePersonId', item.subordinate_person_id,
            'subordinateName', item.subordinate_name,
            'subordinateEmployeeNumber', item.subordinate_employee_number,
            'status', item.status,
            'validFrom', item.valid_from,
            'validTo', item.valid_to,
            'origin', item.origin
          )
          order by item.is_active desc, item.subordinate_name, item.valid_from desc
        )
        from page item
      ), '[]'::jsonb),
      'totalActive',
      (
        select count(*)
        from public.cddi_leadership_links active_link
        where active_link.application_id = target_application_id
          and active_link.status = 'ACTIVE'
          and active_link.valid_to is null
      ),
      'totalMatches', (select count(*) from filtered),
      'limit', v_limit
    )
  );
end;
$function$;

-- A operação continua atômica e auditada, mas passa a rejeitar dois estados que
-- antes eram aceitos: pesquisa fora do CDDI e integrante fora do público válido
-- daquele ciclo. IN_PROGRESS e COMPLETED continuam elegíveis para correção.
create or replace function public.set_platform_admin_leadership_link(
  target_application_id uuid,
  target_subordinate_person_id uuid,
  target_leader_person_id uuid,
  target_justification text
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_actor_id uuid;
  v_justification text := btrim(coalesce(target_justification, ''));
  v_previous public.cddi_leadership_links%rowtype;
  v_new_link public.cddi_leadership_links%rowtype;
  v_leader_name text;
  v_subordinate_name text;
begin
  if not public.is_platform_administrator() then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;

  v_actor_id := public.current_person_id();
  if v_actor_id is null then
    raise exception 'Cadastro institucional do administrador não identificado.';
  end if;
  if length(v_justification) < 10 then
    raise exception 'Informe uma justificativa com pelo menos 10 caracteres.';
  end if;
  if target_leader_person_id = target_subordinate_person_id then
    raise exception 'Uma pessoa não pode ser liderança de si própria.';
  end if;
  if not exists (
    select 1
    from public.survey_applications application
    join public.survey_versions version on version.id = application.survey_version_id
    join public.surveys survey on survey.id = version.survey_id
    where application.id = target_application_id
      and survey.code = 'CDDI'
      and survey.dt_arquivamento is null
      and application.status <> 'CANCELLED'
  ) then
    raise exception 'Ciclo CDDI não localizado ou indisponível.';
  end if;
  if not exists (
    select 1
    from public.application_participants participant
    where participant.application_id = target_application_id
      and participant.person_id = target_subordinate_person_id
      and participant.participant_role = 'RESPONDENT'
      and participant.status not in ('BLOCKED', 'EXCLUDED')
  ) then
    raise exception 'O integrante não participa ativamente do ciclo CDDI selecionado.';
  end if;

  select full_name into v_leader_name
  from public.people
  where id = target_leader_person_id and active;
  if v_leader_name is null then
    raise exception 'Liderança ativa não encontrada.';
  end if;

  select full_name into v_subordinate_name
  from public.people
  where id = target_subordinate_person_id and active;
  if v_subordinate_name is null then
    raise exception 'Integrante ativo não encontrado.';
  end if;

  select * into v_previous
  from public.cddi_leadership_links
  where application_id = target_application_id
    and subordinate_person_id = target_subordinate_person_id
    and status = 'ACTIVE'
    and valid_to is null
  order by valid_from desc
  limit 1
  for update;

  if v_previous.id is not null and v_previous.leader_person_id = target_leader_person_id then
    raise exception 'A pessoa já está vinculada a esta liderança no ciclo selecionado.';
  end if;

  if v_previous.id is not null then
    update public.cddi_leadership_links
    set status = 'ENDED',
        valid_to = timezone('utc', now()),
        metadata = coalesce(metadata, '{}'::jsonb)
          || jsonb_build_object(
            'ended_by_admin', v_actor_id,
            'end_justification', v_justification
          ),
        updated_at = timezone('utc', now())
    where id = v_previous.id;
  end if;

  insert into public.cddi_leadership_links(
    application_id,
    leader_person_id,
    subordinate_person_id,
    status,
    valid_from,
    origin,
    metadata
  ) values (
    target_application_id,
    target_leader_person_id,
    target_subordinate_person_id,
    'ACTIVE',
    timezone('utc', now()),
    'ADMIN_CORRECTION',
    jsonb_build_object(
      'created_by_admin', v_actor_id,
      'justification', v_justification,
      'replaces_link_id', v_previous.id
    )
  ) returning * into v_new_link;

  insert into public.audit_events(
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'LEADERSHIP_LINK_CORRECTED',
    'CDDI_LEADERSHIP_LINK',
    v_new_link.id::text,
    target_application_id,
    case when v_previous.id is null then null else to_jsonb(v_previous) end,
    to_jsonb(v_new_link),
    jsonb_build_object(
      'justification', v_justification,
      'leaderName', v_leader_name,
      'subordinateName', v_subordinate_name
    )
  );

  return jsonb_build_object(
    'status', 'OK',
    'linkId', v_new_link.id,
    'leaderName', v_leader_name,
    'subordinateName', v_subordinate_name,
    'replacedLinkId', v_previous.id
  );
end;
$function$;

revoke all on function public.fc_listar_ciclos_lideranca_adm() from public, anon;
revoke all on function public.list_platform_admin_leadership_links(uuid, text, integer) from public, anon;
revoke all on function public.set_platform_admin_leadership_link(uuid, uuid, uuid, text) from public, anon;

grant execute on function public.fc_listar_ciclos_lideranca_adm() to authenticated;
grant execute on function public.list_platform_admin_leadership_links(uuid, text, integer) to authenticated;
grant execute on function public.set_platform_admin_leadership_link(uuid, uuid, uuid, text) to authenticated;

comment on function public.fc_listar_ciclos_lideranca_adm() is
  'Lista somente ciclos CDDI disponíveis para a correção administrativa de liderança.';
comment on function public.list_platform_admin_leadership_links(uuid, text, integer) is
  'Lista uma página de vínculos e devolve as contagens reais do ciclo e da busca.';
comment on function public.set_platform_admin_leadership_link(uuid, uuid, uuid, text) is
  'Define a liderança de participante válido do CDDI, encerrando o vínculo anterior e auditando a correção.';

commit;
