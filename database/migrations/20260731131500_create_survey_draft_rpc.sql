begin;

create or replace function public.create_survey_draft(
  p_code text,
  p_name text,
  p_description text,
  p_application_name text,
  p_opens_at timestamptz default null,
  p_closes_at timestamptz default null,
  p_anonymous boolean default false,
  p_allow_drafts boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person_id uuid;
  v_survey_id uuid;
  v_version_id uuid;
  v_application_id uuid;
  v_code text;
begin
  if not public.can_manage_surveys() then
    raise exception 'Você não possui permissão para criar pesquisas.';
  end if;

  v_code := upper(regexp_replace(btrim(p_code), '[^A-Za-z0-9_-]+', '-', 'g'));
  if v_code = '' then raise exception 'Informe um código válido.'; end if;
  if btrim(p_name) = '' then raise exception 'Informe o nome da pesquisa.'; end if;
  if p_closes_at is not null and p_opens_at is not null and p_closes_at <= p_opens_at then
    raise exception 'A data de encerramento deve ser posterior à abertura.';
  end if;

  select id into v_person_id from public.people where auth_user_id = auth.uid() limit 1;

  insert into public.surveys (code, name, description, status, settings, created_by)
  values (v_code, btrim(p_name), nullif(btrim(p_description), ''), 'DRAFT', '{}'::jsonb, v_person_id)
  returning id into v_survey_id;

  insert into public.survey_versions (survey_id, version_number, title, description, status, schema_version, settings, created_by)
  values (v_survey_id, 1, btrim(p_name), nullif(btrim(p_description), ''), 'DRAFT', 1, '{}'::jsonb, v_person_id)
  returning id into v_version_id;

  insert into public.survey_applications (
    survey_version_id, code, name, opens_at, closes_at, status,
    allow_drafts, allow_resubmission, anonymous, settings, created_by
  ) values (
    v_version_id,
    v_code || '-1',
    coalesce(nullif(btrim(p_application_name), ''), btrim(p_name)),
    p_opens_at,
    p_closes_at,
    case when p_opens_at is not null then 'SCHEDULED' else 'DRAFT' end,
    p_allow_drafts,
    false,
    p_anonymous,
    '{}'::jsonb,
    v_person_id
  ) returning id into v_application_id;

  insert into public.survey_sections (survey_version_id, code, title, description, position, settings)
  values (v_version_id, 'INTRO', 'Introdução', 'Seção inicial da pesquisa.', 1, '{}'::jsonb);

  return jsonb_build_object(
    'status','OK',
    'surveyId',v_survey_id,
    'versionId',v_version_id,
    'applicationId',v_application_id,
    'code',v_code
  );
end;
$$;

grant execute on function public.create_survey_draft(text,text,text,text,timestamptz,timestamptz,boolean,boolean) to authenticated;

commit;
