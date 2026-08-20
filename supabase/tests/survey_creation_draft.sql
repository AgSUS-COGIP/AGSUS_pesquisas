-- Criação administrativa: período planejado não agenda um instrumento que
-- ainda não foi publicado.

begin;

select plan(4);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values (
  '00000000-0000-4000-8000-00000000c001',
  'authenticated',
  'authenticated',
  'criacao-teste@agenciasus.org.br',
  now(),
  now()
);

insert into public.people (
  id, auth_user_id, employee_number, full_name, institutional_email
)
values (
  '00000000-0000-4000-8000-00000000c002',
  '00000000-0000-4000-8000-00000000c001',
  'TESTE-CRIACAO',
  'Administração de Teste',
  'criacao-teste@agenciasus.org.br'
);

insert into public.person_role_assignments (person_id, role_id)
select
  '00000000-0000-4000-8000-00000000c002',
  id
from public.system_roles
where code = 'SURVEY_MANAGER';

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000c001","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.create_survey_draft(
      'TESTE-CRIACAO-DRAFT',
      'Avaliação criada em teste',
      'Valida o estado inicial.',
      'Primeiro ciclo de teste',
      now() + interval '1 day',
      now() + interval '2 days',
      false,
      true
    )
  $$,
  'criação com período futuro é aceita'
);

select is(
  (
    select a.status
    from public.survey_applications a
    where a.code = 'TESTE-CRIACAO-DRAFT-1'
  ),
  'DRAFT',
  'o ciclo nasce em rascunho mesmo com abertura planejada'
);

select is(
  (
    select v.status
    from public.survey_versions v
    join public.surveys s on s.id = v.survey_id
    where s.code = 'TESTE-CRIACAO-DRAFT'
  ),
  'DRAFT',
  'a versão também nasce em rascunho'
);

select ok(
  (
    select a.opens_at is not null and a.closes_at is not null
    from public.survey_applications a
    where a.code = 'TESTE-CRIACAO-DRAFT-1'
  ),
  'o planejamento do período é preservado sem agendar o ciclo'
);

select * from finish();

rollback;
