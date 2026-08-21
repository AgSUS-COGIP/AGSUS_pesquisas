begin;

-- AGS-01 — submissão invalidada deixa de contar como concluída no painel CDDI.
--
-- O defeito
-- `INVALIDATE` anula a resposta mas **preserva `submitted_at`** de propósito: a
-- data é registro histórico do que aconteceu. O painel, porém, usava a presença
-- dessa data como prova de conclusão, em quatro lugares. Consequência: anular a
-- resposta de alguém não a devolvia ao estado pendente — ela continuava
-- concluída na contagem, na curva de adesão, na nota individual e na nota final.
-- Indicador que não reflete a decisão da administração.
--
-- Em 21/08/2026 o defeito estava **armado, não disparado**: a base tinha 17
-- rascunhos e 8 enviadas, nenhuma invalidada. Bastaria a primeira invalidação.
--
-- Onde discordo do relatório de auditoria
-- Ele sugere filtrar `latest_submissions` para aceitar apenas
-- `('SUBMITTED', 'VALIDATED')`. Isso corrigiria o sintoma e removeria
-- comportamento: os 17 rascunhos desapareceriam do painel, e "começou e não
-- enviou" é informação que a tela usa — há coluna e filtro para ela.
--
-- A correção aqui **exclui o que é morto** (`INVALIDATED`, `CANCELLED`) e passa
-- a exigir estado válido onde a pergunta é "concluiu?". O rascunho continua
-- visível; o anulado sai de toda contagem. Mesmo efeito no achado, sem perda.
--
-- Como foi construída
-- A definição foi **extraída do banco** por `pg_get_functiondef` e alterada em
-- quatro pontos ancorados. Nada mais do corpo muda — em particular, os ajustes
-- de desempenho de `20260814170000` (que hoistou as checagens de papel) ficam
-- intactos, o que reescrever de memória teria destruído.
--
-- Quatro alterações:
--   1. `latest_submissions` ignora submissão morta na disputa do `distinct on`;
--   2. `auto_completed` / `leader_completed` exigem estado válido, não data;
--   3. o resultado final ignora `cddi_final_results.status = 'INVALIDATED'`;
--   4. `event_rows` ignora evento anulado na série temporal.
--
-- `individual_scores` não precisou de mudança: ele parte de
-- `latest_submissions`, então herda a exclusão do item 1.
--
-- A assinatura não muda, e a função pública `get_cddi_monitoring_dashboard`
-- continua delegando aqui — nenhum bundle publicado quebra.

---------------------------------------------------------------------------
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
      -- Submissao morta sai da disputa do `distinct on`. Exclui-se o que nao
      -- vale, em vez de aceitar apenas ('SUBMITTED','VALIDATED'): filtrar assim
      -- apagaria os rascunhos do painel, e "comecou e nao enviou" e informacao
      -- que a tela usa.
      and upper(s.status) not in ('INVALIDATED', 'CANCELLED')
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
      -- `submitted_at` sobrevive a invalidacao, entao data preenchida nao prova
      -- conclusao. O estado prova. Sem isto, invalidar uma resposta mantinha a
      -- pessoa como concluida no painel e nos indicadores.
      case when upper(coalesce(auto.status, '')) in ('SUBMITTED', 'VALIDATED') then true else false end as auto_completed,
      case when upper(coalesce(leader.status, '')) in ('SUBMITTED', 'VALIDATED') then true else false end as leader_completed
    from scoped_participants sp
    left join active_leaders al on al.subordinate_person_id = sp.person_id
    left join latest_submissions auto on auto.subject_id = sp.person_id and auto.normalized_type in ('AUTO', 'AUTOAVALIACAO', 'SELF')
    left join latest_submissions leader on leader.subject_id = sp.person_id and leader.normalized_type in ('CHEFIA', 'LEADER', 'MANAGER')
    left join lateral (
      select r.*
      from public.cddi_final_results r
      where r.application_id = v_application_id and r.subject_person_id = sp.person_id
        -- INVALIDATED e registro anulado: ler como nota valida exibiria numero
        -- que a administracao removeu de proposito.
        and upper(r.status) <> 'INVALIDATED'
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
      -- Mesmo critério do `latest_submissions`: evento anulado nao pode
      -- continuar compondo a curva de adesao.
      and upper(s.status) not in ('INVALIDATED', 'CANCELLED')
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
--   -- Restaurar a definição anterior reintroduz o defeito: submissão anulada
--   -- voltaria a contar como concluída. Se for necessário voltar, extraia a
--   -- definição de 20260814170000_acelerar_painel_cddi.sql e aplique ciente
--   -- disso.
-- commit;
