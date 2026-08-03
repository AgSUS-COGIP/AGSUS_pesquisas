begin;

create or replace function public.set_my_avatar_url(p_avatar_url text)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth'
as $function$
declare
  v_person_id uuid;
  v_url text := nullif(btrim(coalesce(p_avatar_url,'')), '');
  v_source text;
begin
  select id into v_person_id from public.people where auth_user_id = auth.uid() limit 1;
  if v_person_id is null then raise exception 'Cadastro institucional não localizado.'; end if;

  v_source := case
    when v_url is null then 'INITIALS'
    when v_url like 'data:image/%' then 'GENERATED'
    when v_url like '%/storage/v1/object/%/avatars/%' then 'UPLOADED'
    else 'EXTERNAL'
  end;

  update public.people
  set metadata = (coalesce(metadata, '{}'::jsonb) - 'avatar_url' - 'avatar_source' - 'avatar_updated_at')
      || jsonb_strip_nulls(jsonb_build_object('avatar_url',v_url,'avatar_source',v_source,'avatar_updated_at',timezone('utc',now()))),
      updated_at = timezone('utc',now())
  where id = v_person_id;

  return jsonb_build_object('status','OK','avatarUrl',v_url,'avatarSource',v_source);
end;
$function$;

create or replace function public.get_admin_people_base_summary(target_application_id uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
begin
  if not public.can_manage_surveys() then raise exception 'Seu perfil não possui permissão para consultar a base de pessoas.'; end if;
  if target_application_id is not null and not exists(select 1 from public.survey_applications where id=target_application_id) then raise exception 'Pesquisa ou ciclo não localizado.'; end if;

  return (
    select jsonb_build_object(
      'totalPeople',count(*),
      'activePeople',count(*) filter(where p.active and upper(btrim(coalesce(p.employment_status,''))) in ('ATIVO','NORMAL')),
      'inactivePeople',count(*) filter(where not p.active or upper(btrim(coalesce(p.employment_status,''))) not in ('ATIVO','NORMAL')),
      'withInstitutionalEmail',count(*) filter(where nullif(btrim(coalesce(p.institutional_email,'')),'') is not null),
      'withoutInstitutionalEmail',count(*) filter(where nullif(btrim(coalesce(p.institutional_email,'')),'') is null),
      'authenticatedPeople',count(*) filter(where p.auth_user_id is not null),
      'withChosenAvatar',count(*) filter(where coalesce(p.metadata->>'avatar_source','') in ('UPLOADED','GENERATED')),
      'linkedToApplication',count(*) filter(where ap.id is not null and ap.status <> 'EXCLUDED'),
      'availableToLink',count(*) filter(where p.active and upper(btrim(coalesce(p.employment_status,''))) in ('ATIVO','NORMAL') and (target_application_id is null or ap.id is null or ap.status='EXCLUDED'))
    )
    from public.people p
    left join public.application_participants ap
      on target_application_id is not null and ap.application_id=target_application_id and ap.person_id=p.id and ap.participant_role='RESPONDENT'
  );
end;
$$;

create or replace function public.sync_people_base_rows(p_rows jsonb,p_batch_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_row jsonb; v_person public.people%rowtype; v_employee text; v_email text; v_status text;
  v_active boolean; v_source_key text; v_import_metadata jsonb;
  v_inserted integer:=0; v_updated integer:=0; v_identity_count integer:=0;
begin
  if auth.role()<>'service_role' and not public.can_manage_surveys() then raise exception 'Seu perfil não possui permissão para atualizar a base de pessoas.'; end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'O conteúdo da importação deve ser uma lista de pessoas.'; end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_employee:=btrim(coalesce(v_row->>'employeeNumber',''));
    v_email:=lower(btrim(coalesce(v_row->>'institutionalEmail','')));
    v_status:=upper(btrim(coalesce(v_row->>'status','ATIVO')));
    v_source_key:=nullif(btrim(coalesce(v_row->>'participantKey',v_employee)),'');
    if v_employee='' or btrim(coalesce(v_row->>'fullName',''))='' then raise exception 'Matrícula e nome são obrigatórios em todas as linhas.'; end if;
    v_active:=v_status in ('ATIVO','NORMAL','ACTIVE','EM EXERCICIO','EM EXERCÍCIO');
    if v_status='' then v_active:=true; end if;

    select * into v_person from public.people p
    where p.employee_number=v_employee or (v_email<>'' and lower(btrim(coalesce(p.institutional_email,'')))=v_email)
    order by (p.employee_number=v_employee) desc,(p.auth_user_id is not null) desc,p.created_at limit 1 for update;

    v_import_metadata:=jsonb_strip_nulls(jsonb_build_object(
      'detailed_status',nullif(btrim(coalesce(v_row->>'detailedStatus','')),''),
      'directorate',nullif(btrim(coalesce(v_row->>'directorate','')),''),
      'unit',nullif(btrim(coalesce(v_row->>'unit','')),''),
      'coordination',nullif(btrim(coalesce(v_row->>'coordination','')),''),
      'source_row',nullif(v_row->>'rowNumber',''),
      'last_import_batch_id',p_batch_id,
      'last_imported_at',timezone('utc',now())
    ));

    if v_person.id is null then
      insert into public.people(employee_number,full_name,institutional_email,job_title,cost_center,workplace,employment_status,active,source_system,source_key,metadata)
      values(v_employee,btrim(v_row->>'fullName'),nullif(v_email,''),nullif(btrim(coalesce(v_row->>'jobTitle','')),''),nullif(btrim(coalesce(v_row->>'costCenter','')),''),nullif(btrim(coalesce(v_row->>'workplace','')),''),coalesce(nullif(v_status,''),'ATIVO'),v_active,'AGSUS_PEOPLE_BASE',coalesce(v_source_key,v_employee),v_import_metadata)
      returning * into v_person;
      v_inserted:=v_inserted+1;
    else
      if exists(select 1 from public.people other where other.employee_number=v_employee and other.id<>v_person.id) then raise exception 'A matrícula % já pertence a outra pessoa.',v_employee; end if;
      update public.people set
        employee_number=v_employee,full_name=btrim(v_row->>'fullName'),institutional_email=coalesce(nullif(v_email,''),institutional_email),
        job_title=nullif(btrim(coalesce(v_row->>'jobTitle','')),''),cost_center=nullif(btrim(coalesce(v_row->>'costCenter','')),''),workplace=nullif(btrim(coalesce(v_row->>'workplace','')),''),
        employment_status=coalesce(nullif(v_status,''),employment_status,'ATIVO'),active=v_active,
        source_system=case when auth_user_id is null then 'AGSUS_PEOPLE_BASE' else source_system end,
        source_key=case when auth_user_id is null then coalesce(v_source_key,v_employee) else source_key end,
        metadata=coalesce(metadata,'{}'::jsonb)||v_import_metadata,updated_at=timezone('utc',now())
      where id=v_person.id returning * into v_person;
      v_updated:=v_updated+1;
    end if;

    if v_email<>'' and coalesce((v_row->>'emailEligibleForAccess')::boolean,false) then
      insert into public.person_access_identities(person_id,identity_type,email,status,source,metadata)
      values(v_person.id,'INSTITUTIONAL_EMAIL',v_email,case when v_person.auth_user_id is null then 'PENDING' else 'ACTIVE' end,'AGSUS_PEOPLE_BASE',jsonb_build_object('import_batch_id',p_batch_id))
      on conflict(person_id,identity_type,email) do update set
        status=case when v_person.auth_user_id is null then public.person_access_identities.status else 'ACTIVE' end,
        revoked_at=null,metadata=coalesce(public.person_access_identities.metadata,'{}'::jsonb)||jsonb_build_object('import_batch_id',p_batch_id),updated_at=timezone('utc',now());
      v_identity_count:=v_identity_count+1;
    end if;
  end loop;

  return jsonb_build_object('status','OK','inserted',v_inserted,'updated',v_updated,'identitiesProcessed',v_identity_count,'processed',v_inserted+v_updated);
end;
$$;

revoke all on function public.get_admin_people_base_summary(uuid) from public,anon;
grant execute on function public.get_admin_people_base_summary(uuid) to authenticated;
revoke all on function public.sync_people_base_rows(jsonb,uuid) from public,anon,authenticated;
grant execute on function public.sync_people_base_rows(jsonb,uuid) to service_role;

update public.people set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('avatar_source',case
  when coalesce(metadata->>'avatar_source','')<>'' then metadata->>'avatar_source'
  when coalesce(metadata->>'avatar_url','') like 'data:image/%' then 'GENERATED'
  when coalesce(metadata->>'avatar_url','') like '%/storage/v1/object/%/avatars/%' then 'UPLOADED'
  when nullif(btrim(coalesce(metadata->>'avatar_url','')),'') is not null then 'GOOGLE'
  else 'INITIALS' end)
where coalesce(metadata->>'avatar_source','')='';

commit;
