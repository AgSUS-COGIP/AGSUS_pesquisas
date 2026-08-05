begin;

create or replace function public.assign_admin_all_available_participants(
  target_application_id uuid,
  target_access_profile text default 'PARTICIPANTE'
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_actor uuid := public.current_person_id();
  v_assigned integer := 0;
  v_reactivated integer := 0;
  v_skipped integer := 0;
begin
  if not public.can_manage_surveys() then
    raise exception 'Seu perfil não possui permissão para vincular participantes.';
  end if;
  if not exists(select 1 from public.survey_applications where id = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  with candidates as (
    select p.id, ap.status
    from public.people p
    left join public.application_participants ap
      on ap.application_id = target_application_id
     and ap.person_id = p.id
     and ap.participant_role = 'RESPONDENT'
    where p.active
      and upper(btrim(coalesce(p.employment_status, ''))) in ('ATIVO', 'NORMAL')
      and coalesce((p.metadata->>'leadership_reference_only')::boolean, false) = false
  ), upserted as (
    insert into public.application_participants(
      application_id, person_id, participant_role, status, access_profile, invited_at, metadata
    )
    select
      target_application_id,
      id,
      'RESPONDENT',
      'ELIGIBLE',
      nullif(btrim(target_access_profile), ''),
      timezone('utc', now()),
      jsonb_build_object('assigned_by', v_actor, 'assigned_at', timezone('utc', now()), 'source', 'ADMIN_ALL_AVAILABLE')
    from candidates
    where status is null or status in ('BLOCKED', 'EXCLUDED')
    on conflict(application_id, person_id, participant_role) do update
      set status = 'ELIGIBLE',
          access_profile = coalesce(nullif(btrim(excluded.access_profile), ''), public.application_participants.access_profile),
          invited_at = coalesce(public.application_participants.invited_at, excluded.invited_at),
          metadata = coalesce(public.application_participants.metadata, '{}'::jsonb) || excluded.metadata,
          updated_at = timezone('utc', now())
    returning person_id
  )
  select
    count(*) filter(where c.status is null),
    count(*) filter(where c.status in ('BLOCKED', 'EXCLUDED')),
    count(*) filter(where c.status not in ('BLOCKED', 'EXCLUDED') and c.status is not null)
  into v_assigned, v_reactivated, v_skipped
  from candidates c;

  insert into public.audit_events(
    actor_person_id, event_type, entity_type, entity_id, application_id, after_data, metadata
  ) values (
    v_actor,
    'PARTICIPANT_ALL_AVAILABLE_ASSIGNMENT_COMPLETED',
    'SURVEY_APPLICATION',
    target_application_id::text,
    target_application_id,
    jsonb_build_object('assignedCount', v_assigned, 'reactivatedCount', v_reactivated, 'skippedCount', v_skipped),
    jsonb_build_object('source', 'ADMIN_ALL_AVAILABLE')
  );

  return jsonb_build_object(
    'status', 'OK',
    'assignedCount', v_assigned,
    'reactivatedCount', v_reactivated,
    'skippedCount', v_skipped
  );
end;
$function$;

revoke all on function public.assign_admin_all_available_participants(uuid, text) from public, anon;
grant execute on function public.assign_admin_all_available_participants(uuid, text) to authenticated;

notify pgrst, 'reload schema';

commit;
