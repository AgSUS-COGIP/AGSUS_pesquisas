begin;

create or replace function public.assign_admin_application_participants_bulk(
  target_application_id uuid,
  target_person_ids uuid[],
  target_access_profile text default 'PARTICIPANTE'
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_actor uuid := public.current_person_id();
  v_requested_count integer := coalesce(cardinality(target_person_ids), 0);
  v_assigned_count integer := 0;
  v_reactivated_count integer := 0;
  v_skipped_count integer := 0;
  v_person_id uuid;
  v_before_status text;
begin
  if not public.can_manage_surveys() then
    raise exception 'Seu perfil não possui permissão para vincular participantes.';
  end if;

  if not exists (
    select 1
    from public.survey_applications
    where id = target_application_id
  ) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  if v_requested_count < 1 then
    raise exception 'Selecione pelo menos uma pessoa.';
  end if;

  if v_requested_count > 1000 then
    raise exception 'Cada operação pode vincular no máximo 1000 pessoas.';
  end if;

  for v_person_id in
    select distinct requested_person_id
    from unnest(target_person_ids) as requested(requested_person_id)
  loop
    if not exists (
      select 1
      from public.people
      where id = v_person_id
        and active
        and employment_status = 'ATIVO'
    ) then
      v_skipped_count := v_skipped_count + 1;
      continue;
    end if;

    select status
      into v_before_status
    from public.application_participants
    where application_id = target_application_id
      and person_id = v_person_id
      and participant_role = 'RESPONDENT';

    perform public.assign_admin_application_participant(
      target_application_id,
      v_person_id,
      target_access_profile
    );

    if v_before_status in ('BLOCKED', 'EXCLUDED') then
      v_reactivated_count := v_reactivated_count + 1;
    elsif v_before_status is null then
      v_assigned_count := v_assigned_count + 1;
    else
      v_skipped_count := v_skipped_count + 1;
    end if;
  end loop;

  insert into public.audit_events(
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    after_data,
    metadata
  ) values (
    v_actor,
    'PARTICIPANT_BULK_ASSIGNMENT_COMPLETED',
    'SURVEY_APPLICATION',
    target_application_id::text,
    target_application_id,
    jsonb_build_object(
      'requestedCount', v_requested_count,
      'assignedCount', v_assigned_count,
      'reactivatedCount', v_reactivated_count,
      'skippedCount', v_skipped_count
    ),
    jsonb_build_object('source', 'ADMIN_PARTICIPANTS_BULK')
  );

  return jsonb_build_object(
    'status', 'OK',
    'requestedCount', v_requested_count,
    'assignedCount', v_assigned_count,
    'reactivatedCount', v_reactivated_count,
    'skippedCount', v_skipped_count
  );
end;
$function$;

revoke all on function public.assign_admin_application_participants_bulk(uuid, uuid[], text) from public;
revoke all on function public.assign_admin_application_participants_bulk(uuid, uuid[], text) from anon;
revoke all on function public.assign_admin_application_participants_bulk(uuid, uuid[], text) from service_role;
grant execute on function public.assign_admin_application_participants_bulk(uuid, uuid[], text) to authenticated;

comment on function public.assign_admin_application_participants_bulk(uuid, uuid[], text)
is 'Vincula em lote pessoas ativas a uma aplicação de pesquisa, com autorização e auditoria.';

commit;
