-- fc_definir_perfil_pessoa / set_person_role: a máquina de exclusividade de
-- perfil. Área que já teve um incidente real em produção — a documentação
-- afirmava que set_person_role tinha sido removida quando na verdade
-- continuava lá com lógica antiga (ver supabase/CLAUDE.md) — e mesmo assim
-- nunca teve teste automatizado.

begin;

select plan(16);

insert into auth.users (id, aud, role, email, created_at, updated_at)
values
  ('00000000-0000-4000-8000-00000000b001', 'authenticated', 'authenticated', 'perfil-nao-admin@agenciasus.org.br', now(), now()),
  ('00000000-0000-4000-8000-00000000b003', 'authenticated', 'authenticated', 'perfil-superadmin@agenciasus.org.br', now(), now()),
  ('00000000-0000-4000-8000-00000000b005', 'authenticated', 'authenticated', 'perfil-alvo@agenciasus.org.br', now(), now()),
  ('00000000-0000-4000-8000-00000000b007', 'authenticated', 'authenticated', 'perfil-inativo@agenciasus.org.br', now(), now());

insert into public.people (id, auth_user_id, employee_number, full_name, institutional_email)
values
  ('00000000-0000-4000-8000-00000000b002', '00000000-0000-4000-8000-00000000b001', 'TESTE-PERFIL-NAOADMIN', 'Admin Comum de Teste', 'perfil-nao-admin@agenciasus.org.br'),
  ('00000000-0000-4000-8000-00000000b004', '00000000-0000-4000-8000-00000000b003', 'TESTE-PERFIL-SUPERADMIN', 'Superadmin de Teste', 'perfil-superadmin@agenciasus.org.br'),
  ('00000000-0000-4000-8000-00000000b006', '00000000-0000-4000-8000-00000000b005', 'TESTE-PERFIL-ALVO', 'Pessoa Alvo de Teste', 'perfil-alvo@agenciasus.org.br');

insert into public.people (id, auth_user_id, employee_number, full_name, institutional_email, active)
values ('00000000-0000-4000-8000-00000000b008', '00000000-0000-4000-8000-00000000b007', 'TESTE-PERFIL-INATIVO', 'Pessoa Inativa de Teste', 'perfil-inativo@agenciasus.org.br', false);

insert into public.person_role_assignments (person_id, role_id)
select '00000000-0000-4000-8000-00000000b002', id from public.system_roles where code = 'SURVEY_MANAGER';
insert into public.person_role_assignments (person_id, role_id)
select '00000000-0000-4000-8000-00000000b004', id from public.system_roles where code = 'ADMINISTRATOR';

-- Quem não é Superadmin não altera perfil de ninguém, nem o próprio.
select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000b001","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select public.fc_definir_perfil_pessoa('00000000-0000-4000-8000-00000000b006', 'LEADER') $$,
  'Apenas o Superadmin pode alterar o perfil de acesso de uma pessoa.',
  'quem não é Superadmin não altera perfil'
);

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000b003","role":"authenticated"}',
  true
);

select throws_ok(
  $$ select public.fc_definir_perfil_pessoa('00000000-0000-4000-8000-00000000b006', 'GERENTE') $$,
  'Perfil inválido. Use Superadmin, Admin, Avaliador ou Participante.',
  'código de perfil fora do catálogo é recusado'
);

select throws_ok(
  $$ select public.fc_definir_perfil_pessoa('00000000-0000-4000-8000-00000000b008', 'LEADER') $$,
  'Pessoa ativa não encontrada.',
  'pessoa inativa não recebe novo perfil'
);

select throws_ok(
  $$ select public.fc_definir_perfil_pessoa('00000000-0000-4000-8000-00000000b004', 'LEADER') $$,
  'Você não pode retirar seu próprio perfil de Superadmin.',
  'Superadmin não rebaixa o próprio perfil'
);

select lives_ok(
  $$ select public.fc_definir_perfil_pessoa('00000000-0000-4000-8000-00000000b006', 'LEADER') $$,
  'Superadmin concede o perfil Avaliador ao alvo'
);

select is(
  (
    select sr.code
    from public.person_role_assignments pra
    join public.system_roles sr on sr.id = pra.role_id
    where pra.person_id = '00000000-0000-4000-8000-00000000b006' and pra.ends_at is null
  ),
  'LEADER',
  'o alvo passa a ter o perfil Avaliador vigente'
);

-- O arquivo inteiro roda numa única transação, então now() não avança entre
-- as chamadas — encerrar a atribuição concedida agora violaria
-- person_role_assignments_period_valid (ends_at > starts_at). A mesma
-- armadilha já apareceu no teste de criar_nova_versao_pesquisa: fora do
-- teste, tempo real separa as duas chamadas; aqui é preciso simular isso.
update public.person_role_assignments
set starts_at = starts_at - interval '1 hour'
where person_id = '00000000-0000-4000-8000-00000000b006' and ends_at is null;

select lives_ok(
  $$ select public.fc_definir_perfil_pessoa('00000000-0000-4000-8000-00000000b006', 'SURVEY_MANAGER') $$,
  'trocar de perfil é aceito'
);

select is(
  (
    select count(*)::integer
    from public.person_role_assignments
    where person_id = '00000000-0000-4000-8000-00000000b006' and ends_at is null
  ),
  1,
  'ao trocar de perfil, o alvo fica com exatamente uma atribuição vigente'
);

select is(
  (
    select sr.code
    from public.person_role_assignments pra
    join public.system_roles sr on sr.id = pra.role_id
    where pra.person_id = '00000000-0000-4000-8000-00000000b006' and pra.ends_at is null
  ),
  'SURVEY_MANAGER',
  'a atribuição vigente do alvo passa a ser Admin'
);

-- Conceder o mesmo perfil de novo reaproveita a atribuição em vez de duplicar
-- — é o que a função comenta sobre "reaproveita a atribuição vigente".
select lives_ok(
  $$ select public.fc_definir_perfil_pessoa('00000000-0000-4000-8000-00000000b006', 'SURVEY_MANAGER') $$,
  'conceder o mesmo perfil de novo é aceito'
);

select is(
  (select count(*)::integer from public.person_role_assignments where person_id = '00000000-0000-4000-8000-00000000b006'),
  2,
  'reatribuir o mesmo perfil não duplica a linha (Avaliador encerrado + Admin vigente)'
);

update public.person_role_assignments
set starts_at = starts_at - interval '1 hour'
where person_id = '00000000-0000-4000-8000-00000000b006' and ends_at is null;

-- set_person_role é ponte para fc_definir_perfil_pessoa desde
-- 20260814140000_limpar_superficie_legada.sql — não deve ter lógica própria.
select lives_ok(
  $$ select public.set_person_role('00000000-0000-4000-8000-00000000b006', 'ADMINISTRATOR', true) $$,
  'set_person_role com enabled=true delega a fc_definir_perfil_pessoa'
);

select is(
  (
    select sr.code
    from public.person_role_assignments pra
    join public.system_roles sr on sr.id = pra.role_id
    where pra.person_id = '00000000-0000-4000-8000-00000000b006' and pra.ends_at is null
  ),
  'ADMINISTRATOR',
  'set_person_role(enabled=true) concede o perfil pedido'
);

update public.person_role_assignments
set starts_at = starts_at - interval '1 hour'
where person_id = '00000000-0000-4000-8000-00000000b006' and ends_at is null;

select lives_ok(
  $$ select public.set_person_role('00000000-0000-4000-8000-00000000b006', 'ADMINISTRATOR', false) $$,
  'set_person_role com enabled=false é aceito'
);

select is(
  (
    select sr.code
    from public.person_role_assignments pra
    join public.system_roles sr on sr.id = pra.role_id
    where pra.person_id = '00000000-0000-4000-8000-00000000b006' and pra.ends_at is null
  ),
  'RESPONDENT',
  'set_person_role(enabled=false) devolve o alvo ao piso Participante'
);

-- Garantia estrutural: mesmo contornando a função e inserindo direto na
-- tabela, o índice único parcial recusa uma segunda atribuição vigente.
select throws_like(
  $$
    insert into public.person_role_assignments (person_id, role_id)
    select '00000000-0000-4000-8000-00000000b006', id from public.system_roles where code = 'LEADER'
  $$,
  '%in_perfil_unico_vigente%',
  'o índice único parcial recusa um segundo perfil vigente mesmo por insert direto'
);

select * from finish();

rollback;
