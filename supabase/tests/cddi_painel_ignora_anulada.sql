-- Painel CDDI: submissão anulada não conta como concluída (AGS-01).
--
-- O cenário é construído integralmente neste teste. Isso evita falso positivo
-- quando o banco local não contém resposta enviada no seed e permite provar os
-- três efeitos: situação do participante, série de eventos e resultado final.

begin;

select plan(10);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  '00000000-0000-4000-8000-00000000d001',
  'authenticated',
  'authenticated',
  'painel-cddi-admin@agenciasus.org.br',
  now(),
  now()
);

insert into public.people (
  id, auth_user_id, employee_number, full_name, institutional_email
)
values
  (
    '00000000-0000-4000-8000-00000000d002',
    '00000000-0000-4000-8000-00000000d001',
    'TESTE-CDDI-ADMIN',
    'Administração CDDI de Teste',
    'painel-cddi-admin@agenciasus.org.br'
  ),
  (
    '00000000-0000-4000-8000-00000000d003',
    null,
    'TESTE-CDDI-ALVO',
    'Pessoa Avaliada de Teste',
    'painel-cddi-alvo@agenciasus.org.br'
  );

insert into public.person_role_assignments (person_id, role_id)
select '00000000-0000-4000-8000-00000000d002', id
from public.system_roles
where code = 'SURVEY_MANAGER';

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000d001","role":"authenticated"}',
  true
);

create temporary table alvo as
select id as aplicacao
from public.survey_applications
where code = 'CDDI-2026'
limit 1;

select isnt(
  (select aplicacao from alvo),
  null,
  'o ciclo CDDI-2026 existe no banco reconstruído'
);

insert into public.application_participants (
  id, application_id, person_id, participant_role, status, started_at, completed_at
)
select
  '00000000-0000-4000-8000-00000000d004',
  aplicacao,
  '00000000-0000-4000-8000-00000000d003',
  'RESPONDENT',
  'COMPLETED',
  now() - interval '2 hours',
  now() - interval '1 hour'
from alvo;

insert into public.submissions (
  id, application_id, participant_id, respondent_person_id, subject_person_id,
  submission_type, status, started_at, submitted_at, version, calculated_result
)
select
  '00000000-0000-4000-8000-00000000d005',
  aplicacao,
  '00000000-0000-4000-8000-00000000d004',
  '00000000-0000-4000-8000-00000000d003',
  '00000000-0000-4000-8000-00000000d003',
  'AUTO',
  'SUBMITTED',
  now() - interval '2 hours',
  now() - interval '1 hour',
  1,
  4.2
from alvo;

insert into public.cddi_final_results (
  id, application_id, subject_person_id, auto_submission_id,
  auto_score, final_score, status, calculated_at
)
select
  '00000000-0000-4000-8000-00000000d006',
  aplicacao,
  '00000000-0000-4000-8000-00000000d003',
  '00000000-0000-4000-8000-00000000d005',
  4.2,
  4.2,
  'CALCULATED',
  now() - interval '50 minutes'
from alvo;

create or replace function pg_temp.linha_alvo()
returns jsonb
language sql
as $$
  select item
  from jsonb_array_elements(
    public.get_cddi_monitoring_dashboard_internal('CDDI-2026')->'participants'
  ) item
  where item->>'personId' = '00000000-0000-4000-8000-00000000d003'
  limit 1;
$$;

create or replace function pg_temp.eventos_alvo()
returns integer
language sql
as $$
  select count(*)::integer
  from jsonb_array_elements(
    public.get_cddi_monitoring_dashboard_internal('CDDI-2026')->'events'
  ) evento
  where evento->>'personId' = '00000000-0000-4000-8000-00000000d003';
$$;

select is(
  (pg_temp.linha_alvo()->>'autoCompleted')::boolean,
  true,
  'autoavaliação enviada aparece como concluída antes da anulação'
);

select is(
  pg_temp.eventos_alvo(),
  1,
  'a resposta enviada aparece uma vez na série de eventos'
);

select is(
  (pg_temp.linha_alvo()->>'finalScore')::numeric,
  4.2::numeric,
  'o resultado calculado aparece antes da anulação'
);

-- Mantém `submitted_at` e a nota para provar que o painel filtra pelo estado,
-- não pela ausência física desses valores.
update public.submissions
set status = 'INVALIDATED',
    submitted_at = now() + interval '1 hour'
where id = '00000000-0000-4000-8000-00000000d005';

update public.cddi_final_results
set status = 'INVALIDATED'
where id = '00000000-0000-4000-8000-00000000d006';

select isnt(
  (select submitted_at from public.submissions
   where id = '00000000-0000-4000-8000-00000000d005'),
  null,
  'a anulação preserva submitted_at'
);

select is(
  (pg_temp.linha_alvo()->>'autoCompleted')::boolean,
  false,
  'submissão anulada deixa de contar como concluída'
);

select is(
  pg_temp.eventos_alvo(),
  0,
  'evento anulado deixa de compor a série temporal'
);

select is(
  pg_temp.linha_alvo()->>'finalScore',
  null::text,
  'resultado final anulado deixa de aparecer como nota válida'
);

-- A anulada tem `submitted_at` futuro de propósito. Sem o filtro anterior ao
-- `distinct on`, ela venceria esta nova resposta válida e o teste falharia.
insert into public.submissions (
  id, application_id, participant_id, respondent_person_id, subject_person_id,
  submission_type, status, started_at, submitted_at, version, calculated_result
)
select
  '00000000-0000-4000-8000-00000000d007',
  aplicacao,
  '00000000-0000-4000-8000-00000000d004',
  '00000000-0000-4000-8000-00000000d003',
  '00000000-0000-4000-8000-00000000d003',
  'AUTO',
  'SUBMITTED',
  now() - interval '10 minutes',
  now(),
  2,
  4.5
from alvo;

select is(
  (pg_temp.linha_alvo()->>'autoCompleted')::boolean,
  true,
  'uma resposta válida posterior volta a marcar a autoavaliação como concluída'
);

select is(
  pg_temp.eventos_alvo(),
  1,
  'a série contém apenas o novo envio válido'
);

select * from finish();

rollback;
