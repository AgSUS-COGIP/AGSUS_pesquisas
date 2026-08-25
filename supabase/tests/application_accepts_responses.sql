-- application_accepts_responses: o portão único do runtime de resposta.
-- Governa start_or_resume_*, save_*, submit_*, can_edit_submission e as
-- políticas de RLS de submissões e respostas — mudar esta função muda quem
-- pode responder em toda a plataforma de uma vez, e ela já foi redefinida
-- mais de uma vez sem nenhum teste.
--
-- A tabela não tem máquina de estados própria (survey_applications só valida
-- período e o enum de status), então cada cenário é montado por UPDATE direto
-- na mesma aplicação, sem precisar repetir manage_survey_cycle.

begin;

select plan(7);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values ('00000000-0000-4000-8000-00000000a001', 'authenticated', 'authenticated', 'aar-admin@agenciasus.org.br', now(), now());

insert into public.people (id, auth_user_id, employee_number, full_name, institutional_email)
values ('00000000-0000-4000-8000-00000000a002', '00000000-0000-4000-8000-00000000a001', 'TESTE-AAR-ADMIN', 'Administração de Teste', 'aar-admin@agenciasus.org.br');

insert into public.person_role_assignments (person_id, role_id)
select '00000000-0000-4000-8000-00000000a002', id from public.system_roles where code = 'SURVEY_MANAGER';

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000a001","role":"authenticated"}',
  true
);

select public.create_survey_draft(
  'TESTE-AAR', 'Pesquisa do portão de respostas', 'Descrição', 'Ciclo 1',
  now() + interval '1 day', now() + interval '2 days', false, true
);

-- OPEN dentro do período: aceita.
update public.survey_applications
set status = 'OPEN', opens_at = now() - interval '1 hour', closes_at = now() + interval '1 hour'
where code = 'TESTE-AAR-1';

select ok(
  (select public.application_accepts_responses(id) from public.survey_applications where code = 'TESTE-AAR-1'),
  'OPEN dentro do período aceita respostas'
);

-- OPEN mas o encerramento já passou: mesmo com status OPEN, o relógio decide.
update public.survey_applications
set closes_at = now() - interval '1 minute'
where code = 'TESTE-AAR-1';

select ok(
  not (select public.application_accepts_responses(id) from public.survey_applications where code = 'TESTE-AAR-1'),
  'OPEN com encerramento vencido deixa de aceitar respostas'
);

-- SCHEDULED cuja abertura já chegou: aceita mesmo sem a materialização
-- SCHEDULED → OPEN ter rodado ainda — é o motivo desta função ter sido
-- redefinida em 20260814100000_abrir_ciclos_agendados.sql.
update public.survey_applications
set status = 'SCHEDULED', opens_at = now() - interval '1 minute', closes_at = now() + interval '1 day'
where code = 'TESTE-AAR-1';

select ok(
  (select public.application_accepts_responses(id) from public.survey_applications where code = 'TESTE-AAR-1'),
  'SCHEDULED cuja abertura já chegou aceita respostas antes da materialização'
);

-- SCHEDULED cuja abertura ainda não chegou: não aceita.
update public.survey_applications
set opens_at = now() + interval '1 day', closes_at = now() + interval '2 days'
where code = 'TESTE-AAR-1';

select ok(
  not (select public.application_accepts_responses(id) from public.survey_applications where code = 'TESTE-AAR-1'),
  'SCHEDULED cuja abertura ainda não chegou não aceita respostas'
);

-- DRAFT nunca aceita, mesmo com um período válido gravado.
update public.survey_applications
set status = 'DRAFT', opens_at = now() - interval '1 hour', closes_at = now() + interval '1 hour'
where code = 'TESTE-AAR-1';

select ok(
  not (select public.application_accepts_responses(id) from public.survey_applications where code = 'TESTE-AAR-1'),
  'DRAFT não aceita respostas mesmo com período válido'
);

-- CLOSED nunca aceita, independentemente das datas.
update public.survey_applications
set status = 'CLOSED', opens_at = now() - interval '2 days', closes_at = now() + interval '1 day'
where code = 'TESTE-AAR-1';

select ok(
  not (select public.application_accepts_responses(id) from public.survey_applications where code = 'TESTE-AAR-1'),
  'CLOSED não aceita respostas mesmo com closes_at no futuro'
);

-- OPEN com opens_at/closes_at nulos: tolerância a ciclos antigos sem período
-- gravado, preservada literalmente pela migration que redefiniu esta função.
update public.survey_applications
set status = 'OPEN', opens_at = null, closes_at = null
where code = 'TESTE-AAR-1';

select ok(
  (select public.application_accepts_responses(id) from public.survey_applications where code = 'TESTE-AAR-1'),
  'OPEN sem período gravado (ciclo legado) continua aceitando respostas'
);

select * from finish();

rollback;
