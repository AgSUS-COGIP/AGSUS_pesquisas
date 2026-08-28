begin;

-- Painel do CDDI: de 957 ms para o custo real da consulta.
--
-- O gargalo
-- ---------
-- O filtro de escopo de `scoped_participants` chamava `can_manage_surveys()` e
-- `has_active_role('LEADER')` **dentro do WHERE**. As duas consultam papéis no
-- banco, e o PostgreSQL as avaliava uma vez por linha — 1.023 vezes cada, a
-- cada abertura do painel.
--
-- Medido em produção, isolando só esse filtro sobre os mesmos 1.023
-- participantes:
--
--     função avaliada por linha ......... 785,5 ms
--     papel resolvido antes, uma vez .....   1,2 ms
--
-- Os dois valores saem da mesma consulta; a única diferença é onde o papel é
-- resolvido. O painel inteiro custava 957 ms, então este padrão respondia por
-- quase todo o tempo.
--
-- A correção é resolver os dois papéis uma vez, antes da consulta, e usar as
-- variáveis no filtro. Nada de índice novo: os índices já estavam corretos, e o
-- volume é pequeno — 1.023 participantes, 1.008 vínculos, 4 resultados
-- consolidados. O custo não era ler dado, era repetir pergunta.
--
-- Vale como regra geral deste banco: **função de papel dentro de WHERE é
-- avaliada por linha.** Onde o escopo depende de quem está pedindo, resolva o
-- papel antes e compare com variável.
--
-- Acentos corrompidos
-- -------------------
-- A mesma função guardava texto com dupla codificação: os bytes de
-- "SEM INFORMAÇÃO" estavam gravados como c383c287 no lugar de c387, e o painel
-- exibia a sequência corrompida na diretoria, na unidade e na coordenação de
-- quem não tem esse dado — além de nas duas mensagens de erro. Corrigido junto,
-- já que a função é reescrita inteira.
--
-- O corpo abaixo é o que estava em produção, com essas duas mudanças e nada
-- mais. Foi extraído do próprio banco em bytes, e não como texto, justamente
-- para não introduzir corrupção nova ao reescrevê-lo.

CREATE OR REPLACE FUNCTION public.get_cddi_monitoring_dashboard_internal(target_application_code text DEFAULT 'CDDI-2026'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_person_id uuid;
  v_application_id uuid;
  v_payload jsonb;
  v_scope text;
  -- Resolvidos UMA vez: usados dentro do filtro, eram avaliados por linha.
  v_pode_gerenciar boolean;
  v_e_lider boolean;
begin
  v_person_id := public.current_person_id();
  if v_person_id is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;

  select sa.id into v_application_id
  from public.survey_applications sa
  where sa.code = btrim(target_application_code)
  limit 1;

  if v_application_id is null then
    raise exception 'Ciclo de pesquisa não encontrado.';
  end if;

  v_pode_gerenciar := public.can_manage_surveys();
  v_e_lider := public.has_active_role('LEADER');

  v_scope := case
    when v_pode_gerenciar then 'INSTITUTIONAL'
    when v_e_lider then 'TEAM'
    else 'INDIVIDUAL'
  end;

  with
  app as (
    select sa.*, sv.title as version_title, sv.version_number, s.name as survey_name
    from public.survey_applications sa
    join public.survey_versions sv on sv.id = sa.survey_version_id
    join public.surveys s on s.id = sv.survey_id
    where sa.id = v_application_id
  ),
  scoped_participants as (
    select
      ap.id as participant_id,
      ap.person_id,
      ap.status as participant_status,
      ap.started_at,
      ap.completed_at,
      p.employee_number,
      p.full_name,
      p.institutional_email,
      p.job_title,
      p.cost_center,
      p.workplace,
      p.metadata,
      coalesce(p.metadata->>'directorate', p.metadata->>'diretoria', 'SEM INFORMAÇÃO') as directorate,
      coalesce(p.metadata->>'unit', p.metadata->>'unidade', p.cost_center, 'SEM INFORMAÇÃO') as unit_name,
      coalesce(p.metadata->>'coordination', p.metadata->>'coordenacao', 'SEM INFORMAÇÃO') as coordination
    from public.application_participants ap
    join public.people p on p.id = ap.person_id
    where ap.application_id = v_application_id
      and ap.status not in ('BLOCKED', 'EXCLUDED')
      and (
        v_pode_gerenciar
        or ap.person_id = v_person_id
        or (
          v_e_lider and exists (
            select 1
            from public.cddi_leadership_links l
            where l.application_id = v_application_id
              and l.leader_person_id = v_person_id
              and l.subordinate_person_id = ap.person_id
              and l.status = 'ACTIVE'
              and l.valid_to is null
          )
        )
      )
  ),
  active_leaders as (
    select distinct on (l.subordinate_person_id)
      l.subordinate_person_id,
      leader.full_name as manager_name,
      leader.institutional_email as manager_email
    from public.cddi_leadership_links l
    join public.people leader on leader.id = l.leader_person_id
    where l.application_id = v_application_id
      and l.status = 'ACTIVE'
      and l.valid_to is null
    order by l.subordinate_person_id, l.valid_from desc
  ),
  latest_submissions as (
    select distinct on (coalesce(s.subject_person_id, s.respondent_person_id), upper(s.submission_type))
      s.*,
      coalesce(s.subject_person_id, s.respondent_person_id) as subject_id,
      upper(s.submission_type) as normalized_type
    from public.submissions s
    join scoped_participants sp on sp.person_id = coalesce(s.subject_person_id, s.respondent_person_id)
    where s.application_id = v_application_id
    order by coalesce(s.subject_person_id, s.respondent_person_id), upper(s.submission_type),
      (s.submitted_at is not null) desc, s.submitted_at desc nulls last, s.updated_at desc, s.version desc
  ),
  participant_rows as (
    select
      sp.*,
      al.manager_name,
      al.manager_email,
      auto.id as auto_submission_id,
      auto.status as auto_status,
      auto.submitted_at as auto_submitted_at,
      auto.calculated_result as auto_score,
      leader.id as leader_submission_id,
      leader.status as leader_status,
      leader.submitted_at as leader_submitted_at,
      leader.calculated_result as leader_score,
      fr.final_score,
      fr.status as final_status,
      fr.calculated_at,
      case when auto.submitted_at is not null then true else false end as auto_completed,
      case when leader.submitted_at is not null then true else false end as leader_completed
    from scoped_participants sp
    left join active_leaders al on al.subordinate_person_id = sp.person_id
    left join latest_submissions auto on auto.subject_id = sp.person_id and auto.normalized_type in ('AUTO', 'AUTOAVALIACAO', 'SELF')
    left join latest_submissions leader on leader.subject_id = sp.person_id and leader.normalized_type in ('CHEFIA', 'LEADER', 'MANAGER')
    left join lateral (
      select r.*
      from public.cddi_final_results r
      where r.application_id = v_application_id and r.subject_person_id = sp.person_id
      order by r.calculated_at desc, r.updated_at desc
      limit 1
    ) fr on true
  ),
  competencies as (
    select sec.id, sec.code, sec.title, sec.position
    from public.survey_sections sec
    join app on app.survey_version_id = sec.survey_version_id
    where sec.code ~ '^C[0-9]{2}$'
    order by sec.position
  ),
  competency_values as (
    select
      ls.subject_id as person_id,
      c.code as competency_code,
      c.title as competency_name,
      c.position,
      max(cr.result) filter (where ls.normalized_type in ('AUTO', 'AUTOAVALIACAO', 'SELF')) as auto_score,
      max(cr.result) filter (where ls.normalized_type in ('CHEFIA', 'LEADER', 'MANAGER')) as leader_score
    from latest_submissions ls
    join public.cddi_competency_results cr on cr.submission_id = ls.id
    join competencies c on c.id = cr.competency_section_id
    group by ls.subject_id, c.code, c.title, c.position
  ),
  event_rows as (
    select
      coalesce(s.subject_person_id, s.respondent_person_id) as person_id,
      upper(s.submission_type) as submission_type,
      s.status,
      s.submitted_at,
      s.version,
      s.metadata
    from public.submissions s
    join scoped_participants sp on sp.person_id = coalesce(s.subject_person_id, s.respondent_person_id)
    where s.application_id = v_application_id
      and s.submitted_at is not null
  )
  select jsonb_build_object(
    'status', 'OK',
    'scope', v_scope,
    'generatedAt', timezone('utc', now()),
    'weights', jsonb_build_object('auto', 0.40, 'leader', 0.60),
    'application', (
      select jsonb_build_object(
        'id', id,
        'code', code,
        'name', name,
        'surveyName', survey_name,
        'versionTitle', version_title,
        'versionNumber', version_number,
        'status', status,
        'opensAt', opens_at,
        'closesAt', closes_at
      ) from app
    ),
    'participants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'personId', pr.person_id,
        'participantId', pr.participant_id,
        'employeeNumber', pr.employee_number,
        'fullName', pr.full_name,
        'institutionalEmail', pr.institutional_email,
        'jobTitle', pr.job_title,
        'directorate', pr.directorate,
        'unit', pr.unit_name,
        'coordination', pr.coordination,
        'workplace', pr.workplace,
        'managerName', pr.manager_name,
        'managerEmail', pr.manager_email,
        'participantStatus', pr.participant_status,
        'startedAt', pr.started_at,
        'completedAt', pr.completed_at,
        'autoStatus', pr.auto_status,
        'autoSubmittedAt', pr.auto_submitted_at,
        'autoScore', pr.auto_score,
        'leaderStatus', pr.leader_status,
        'leaderSubmittedAt', pr.leader_submitted_at,
        'leaderScore', pr.leader_score,
        'finalScore', pr.final_score,
        'finalStatus', pr.final_status,
        'calculatedAt', pr.calculated_at,
        'autoCompleted', pr.auto_completed,
        'leaderCompleted', pr.leader_completed
      ) order by pr.full_name) from participant_rows pr
    ), '[]'::jsonb),
    'competencies', coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'code', code, 'name', title, 'position', position) order by position)
      from competencies
    ), '[]'::jsonb),
    'competencyScores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'personId', person_id,
        'competencyCode', competency_code,
        'competencyName', competency_name,
        'position', position,
        'autoScore', auto_score,
        'leaderScore', leader_score,
        'finalScore', case when auto_score is not null and leader_score is not null then round((auto_score * 0.40 + leader_score * 0.60)::numeric, 2) else null end
      ) order by person_id, position)
      from competency_values
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'personId', person_id,
        'submissionType', submission_type,
        'status', status,
        'submittedAt', submitted_at,
        'version', version,
        'metadata', metadata
      ) order by submitted_at)
      from event_rows
    ), '[]'::jsonb)
  ) into v_payload;

  return v_payload;
end;
$function$;

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   -- Restaurar a definição anterior traz de volta os 957 ms e o texto
--   -- corrompido. Não recomendado.
-- commit;
