create or replace function public.get_cddi_monitoring_dashboard(target_application_code text default 'CDDI-2026')
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person_id uuid;
  v_application_id uuid;
  v_payload jsonb;
  v_scope text;
begin
  v_person_id := public.current_person_id();
  if v_person_id is null then raise exception 'Cadastro institucional não identificado.'; end if;

  select sa.id into v_application_id
  from public.survey_applications sa
  where sa.code = btrim(target_application_code)
  limit 1;
  if v_application_id is null then raise exception 'Ciclo de pesquisa não encontrado.'; end if;

  v_scope := case
    when public.can_manage_surveys() then 'INSTITUTIONAL'
    when public.has_active_role('LEADER') then 'TEAM'
    else 'INDIVIDUAL'
  end;

  with app as (
    select sa.*, sv.title as version_title, sv.version_number, s.name as survey_name
    from public.survey_applications sa
    join public.survey_versions sv on sv.id = sa.survey_version_id
    join public.surveys s on s.id = sv.survey_id
    where sa.id = v_application_id
  ), scoped_participants as (
    select ap.id participant_id, ap.person_id, ap.status participant_status, ap.started_at, ap.completed_at,
      p.employee_number, p.full_name, p.institutional_email, p.job_title, p.cost_center, p.workplace, p.metadata,
      coalesce(p.metadata->>'directorate', p.metadata->>'diretoria', 'SEM INFORMAÇÃO') directorate,
      coalesce(p.metadata->>'unit', p.metadata->>'unidade', p.cost_center, 'SEM INFORMAÇÃO') unit_name,
      coalesce(p.metadata->>'coordination', p.metadata->>'coordenacao', 'SEM INFORMAÇÃO') coordination
    from public.application_participants ap
    join public.people p on p.id = ap.person_id
    where ap.application_id = v_application_id
      and ap.status not in ('REMOVED','INELIGIBLE')
      and (
        public.can_manage_surveys()
        or ap.person_id = v_person_id
        or (
          public.has_active_role('LEADER') and exists (
            select 1 from public.cddi_leadership_links l
            where l.application_id = v_application_id
              and l.leader_person_id = v_person_id
              and l.subordinate_person_id = ap.person_id
              and l.status = 'ACTIVE'
              and l.valid_to is null
          )
        )
      )
  ), active_leaders as (
    select distinct on (l.subordinate_person_id) l.subordinate_person_id,
      leader.full_name manager_name, leader.institutional_email manager_email
    from public.cddi_leadership_links l
    join public.people leader on leader.id = l.leader_person_id
    where l.application_id = v_application_id and l.status = 'ACTIVE' and l.valid_to is null
    order by l.subordinate_person_id, l.valid_from desc
  ), latest_submissions as (
    select distinct on (coalesce(s.subject_person_id,s.respondent_person_id), upper(s.submission_type))
      s.*, coalesce(s.subject_person_id,s.respondent_person_id) subject_id, upper(s.submission_type) normalized_type
    from public.submissions s
    join scoped_participants sp on sp.person_id = coalesce(s.subject_person_id,s.respondent_person_id)
    where s.application_id = v_application_id
    order by coalesce(s.subject_person_id,s.respondent_person_id), upper(s.submission_type),
      (s.submitted_at is not null) desc, s.submitted_at desc nulls last, s.updated_at desc, s.version desc
  ), participant_rows as (
    select sp.*, al.manager_name, al.manager_email,
      auto.id auto_submission_id, auto.status auto_status, auto.submitted_at auto_submitted_at, auto.calculated_result auto_score,
      leader.id leader_submission_id, leader.status leader_status, leader.submitted_at leader_submitted_at, leader.calculated_result leader_score,
      fr.final_score, fr.status final_status, fr.calculated_at,
      auto.submitted_at is not null auto_completed,
      leader.submitted_at is not null leader_completed
    from scoped_participants sp
    left join active_leaders al on al.subordinate_person_id = sp.person_id
    left join latest_submissions auto on auto.subject_id = sp.person_id and auto.normalized_type in ('AUTO','AUTOAVALIACAO','SELF')
    left join latest_submissions leader on leader.subject_id = sp.person_id and leader.normalized_type in ('CHEFIA','LEADER','MANAGER')
    left join lateral (
      select r.* from public.cddi_final_results r
      where r.application_id = v_application_id and r.subject_person_id = sp.person_id
      order by r.calculated_at desc, r.updated_at desc limit 1
    ) fr on true
  ), competencies as (
    select sec.id, sec.code, sec.title, sec.position
    from public.survey_sections sec
    join app on app.survey_version_id = sec.survey_version_id
    where sec.code ~ '^C[0-9]{2}$'
    order by sec.position
  ), competency_values as (
    select ls.subject_id person_id, c.code competency_code, c.title competency_name, c.position,
      max(cr.result) filter (where ls.normalized_type in ('AUTO','AUTOAVALIACAO','SELF')) auto_score,
      max(cr.result) filter (where ls.normalized_type in ('CHEFIA','LEADER','MANAGER')) leader_score
    from latest_submissions ls
    join public.cddi_competency_results cr on cr.submission_id = ls.id
    join competencies c on c.id = cr.competency_section_id
    group by ls.subject_id, c.code, c.title, c.position
  ), event_rows as (
    select coalesce(s.subject_person_id,s.respondent_person_id) person_id,
      upper(s.submission_type) submission_type, s.status, s.submitted_at, s.version, s.metadata
    from public.submissions s
    join scoped_participants sp on sp.person_id = coalesce(s.subject_person_id,s.respondent_person_id)
    where s.application_id = v_application_id and s.submitted_at is not null
  )
  select jsonb_build_object(
    'status','OK','scope',v_scope,'generatedAt',timezone('utc',now()),
    'weights',jsonb_build_object('auto',0.40,'leader',0.60),
    'application',(select jsonb_build_object('id',id,'code',code,'name',name,'surveyName',survey_name,'versionTitle',version_title,'versionNumber',version_number,'status',status,'opensAt',opens_at,'closesAt',closes_at) from app),
    'participants',coalesce((select jsonb_agg(jsonb_build_object(
      'personId',pr.person_id,'participantId',pr.participant_id,'employeeNumber',pr.employee_number,'fullName',pr.full_name,
      'institutionalEmail',pr.institutional_email,'jobTitle',pr.job_title,'directorate',pr.directorate,'unit',pr.unit_name,
      'coordination',pr.coordination,'workplace',pr.workplace,'managerName',pr.manager_name,'managerEmail',pr.manager_email,
      'participantStatus',pr.participant_status,'startedAt',pr.started_at,'completedAt',pr.completed_at,
      'autoStatus',pr.auto_status,'autoSubmittedAt',pr.auto_submitted_at,'autoScore',pr.auto_score,
      'leaderStatus',pr.leader_status,'leaderSubmittedAt',pr.leader_submitted_at,'leaderScore',pr.leader_score,
      'finalScore',pr.final_score,'finalStatus',pr.final_status,'calculatedAt',pr.calculated_at,
      'autoCompleted',pr.auto_completed,'leaderCompleted',pr.leader_completed
    ) order by pr.full_name) from participant_rows pr),'[]'::jsonb),
    'competencies',coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',title,'position',position) order by position) from competencies),'[]'::jsonb),
    'competencyScores',coalesce((select jsonb_agg(jsonb_build_object(
      'personId',person_id,'competencyCode',competency_code,'competencyName',competency_name,'position',position,
      'autoScore',auto_score,'leaderScore',leader_score,
      'finalScore',case when auto_score is not null and leader_score is not null then round((auto_score*0.40+leader_score*0.60)::numeric,2) else null end
    ) order by person_id, position) from competency_values),'[]'::jsonb),
    'events',coalesce((select jsonb_agg(jsonb_build_object('personId',person_id,'submissionType',submission_type,'status',status,'submittedAt',submitted_at,'version',version,'metadata',metadata) order by submitted_at) from event_rows),'[]'::jsonb)
  ) into v_payload;

  return v_payload;
end;
$$;

grant execute on function public.get_cddi_monitoring_dashboard(text) to authenticated;
