-- fc_abrir_ciclos_agendados: materializa SCHEDULED → OPEN quando a abertura
-- chega. Corrigiu um bug real (ciclo agendado nunca abria sozinho, porque
-- não há job agendado no projeto) e nunca teve teste.
--
-- Cada cenário é montado por UPDATE direto, sem esperar o tempo passar: a
-- publicação da versão e o status/período do ciclo são forçados igual ao que
-- manage_survey_cycle produziria depois de PUBLISH + SCHEDULE + a data
-- marcada ter chegado.

begin;

select plan(9);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-00000000f001', 'authenticated', 'authenticated', 'abrir-admin@agenciasus.org.br', now(), now());

insert into public.people (id, auth_user_id, employee_number, full_name, institutional_email)
values ('00000000-0000-4000-8000-00000000f002', '00000000-0000-4000-8000-00000000f001', 'TESTE-ABRIR-ADMIN', 'Administração de Teste', 'abrir-admin@agenciasus.org.br');

insert into public.person_role_assignments (person_id, role_id)
select '00000000-0000-4000-8000-00000000f002', id from public.system_roles where code = 'SURVEY_MANAGER';

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000f001","role":"authenticated"}',
  true
);

select public.create_survey_draft('TESTE-ABRIR-A', 'Cenário A', 'Abertura já chegou', 'Ciclo 1', now() + interval '1 day', now() + interval '2 days', false, true);
select public.create_survey_draft('TESTE-ABRIR-B', 'Cenário B', 'Abertura no futuro', 'Ciclo 1', now() + interval '1 day', now() + interval '2 days', false, true);
select public.create_survey_draft('TESTE-ABRIR-C', 'Cenário C', 'Abertura e encerramento já venceram', 'Ciclo 1', now() + interval '1 day', now() + interval '2 days', false, true);
select public.create_survey_draft('TESTE-ABRIR-D', 'Cenário D', 'Abertura chegou, versão ainda em rascunho', 'Ciclo 1', now() + interval '1 day', now() + interval '2 days', false, true);

-- A, B, C: versão publicada. D fica em DRAFT de propósito.
update public.survey_versions
set status = 'PUBLISHED', published_at = now()
where survey_id in (
  select id from public.surveys where code in ('TESTE-ABRIR-A', 'TESTE-ABRIR-B', 'TESTE-ABRIR-C')
);

-- Cenário A: agendado, abertura já passou, encerramento no futuro — deve abrir.
update public.survey_applications
set status = 'SCHEDULED', opens_at = now() - interval '1 minute', closes_at = now() + interval '1 day'
where code = 'TESTE-ABRIR-A-1';

-- Cenário B: agendado, abertura ainda no futuro — continua agendado.
update public.survey_applications
set status = 'SCHEDULED', opens_at = now() + interval '1 day', closes_at = now() + interval '2 days'
where code = 'TESTE-ABRIR-B-1';

-- Cenário C: agendado, mas o encerramento também já venceu — abrir e fechar
-- no mesmo instante não é abertura válida, então continua agendado.
update public.survey_applications
set status = 'SCHEDULED', opens_at = now() - interval '2 days', closes_at = now() - interval '1 day'
where code = 'TESTE-ABRIR-C-1';

-- Cenário D: agendado e a abertura já passou, mas a versão ainda está em
-- rascunho — nunca deveria acontecer no fluxo normal (SCHEDULE exige versão
-- publicada), mas a função precisa se defender do estado mesmo assim.
update public.survey_applications
set status = 'SCHEDULED', opens_at = now() - interval '1 minute', closes_at = now() + interval '1 day'
where code = 'TESTE-ABRIR-D-1';

select lives_ok(
  $$ select public.fc_abrir_ciclos_agendados() $$,
  'materializar os ciclos agendados não lança erro'
);

select is(
  (select status from public.survey_applications where code = 'TESTE-ABRIR-A-1'),
  'OPEN',
  'cenário A (abertura vencida, versão publicada) vira OPEN'
);

select is(
  (select status from public.survey_applications where code = 'TESTE-ABRIR-B-1'),
  'SCHEDULED',
  'cenário B (abertura no futuro) continua agendado'
);

select is(
  (select status from public.survey_applications where code = 'TESTE-ABRIR-C-1'),
  'SCHEDULED',
  'cenário C (encerramento já vencido) não é aberto'
);

select is(
  (select status from public.survey_applications where code = 'TESTE-ABRIR-D-1'),
  'SCHEDULED',
  'cenário D (versão ainda em rascunho) não é aberto'
);

select is(
  (
    select count(*)::integer
    from public.audit_events
    where event_type = 'SURVEY_CYCLE_AUTO_OPEN'
      and application_id = (select id from public.survey_applications where code = 'TESTE-ABRIR-A-1')
  ),
  1,
  'a abertura automática do cenário A é auditada uma vez'
);

-- Concorrência: uma segunda chamada reavalia a condição, encontra OPEN e não
-- atualiza nada — sem duplicar o evento de auditoria.
select lives_ok(
  $$ select public.fc_abrir_ciclos_agendados() $$,
  'chamar de novo não lança erro'
);

select is(
  (
    select count(*)::integer
    from public.audit_events
    where event_type = 'SURVEY_CYCLE_AUTO_OPEN'
      and application_id = (select id from public.survey_applications where code = 'TESTE-ABRIR-A-1')
  ),
  1,
  'a segunda chamada não duplica o evento de auditoria'
);

select is(
  (select status from public.survey_applications where code = 'TESTE-ABRIR-A-1'),
  'OPEN',
  'a segunda chamada mantém o cenário A em OPEN'
);

select * from finish();

rollback;
