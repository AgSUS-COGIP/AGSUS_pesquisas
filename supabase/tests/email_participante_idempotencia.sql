-- Notificação por e-mail: idempotência e janelas de disparo.
--
-- O contrato central da funcionalidade é "no máximo um e-mail por
-- (aplicação, pessoa, tipo)", garantido pela chave única de
-- `tl_email_participante` e pelo claim-first de
-- `fc_reivindicar_emails()`. Este arquivo exercita exatamente os
-- cenários em que esse contrato costuma quebrar: reprocessamento do job,
-- e-mail inválido, participante fora do ciclo, falha transitória e a janela
-- de 24 horas do lembrete.

begin;

select plan(15);

-- ---------------------------------------------------------------------------
-- Guarda de papel: o EXECUTE de `authenticated` existe pelo gate de contratos
-- de RPC, mas uma sessão autenticada comum não pode reivindicar envios.
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"role":"authenticated"}', true);

select throws_ok(
  'select public.fc_reivindicar_emails()',
  'Acesso restrito ao processamento interno.',
  'sessão autenticada comum não reivindica envios'
);

select set_config('request.jwt.claims', '', true);

-- ---------------------------------------------------------------------------
-- Cenário: ciclo aberto com notificação ligada, encerramento distante.
--   · Pessoa Um    — e-mail válido, elegível          → recebe abertura
--   · Pessoa Dois  — sem e-mail                       → não entra na fila
--   · Pessoa Três  — e-mail válido, porém BLOCKED     → não entra na fila
--   · Pessoa Quatro— e-mail válido, elegível          → recebe abertura
-- ---------------------------------------------------------------------------
insert into public.people (id, employee_number, full_name, institutional_email) values
  ('00000000-0000-4000-8000-000000000001', 'TESTE0001', 'Pessoa Um', 'um@agenciasus.org.br'),
  ('00000000-0000-4000-8000-000000000002', 'TESTE0002', 'Pessoa Dois', null),
  ('00000000-0000-4000-8000-000000000003', 'TESTE0003', 'Pessoa Três', 'tres@agenciasus.org.br'),
  ('00000000-0000-4000-8000-000000000004', 'TESTE0004', 'Pessoa Quatro', 'quatro@agenciasus.org.br');

insert into public.surveys (id, code, name, status)
values ('00000000-0000-4000-8000-0000000000aa', 'TESTE-EMAIL', 'Pesquisa de Teste de E-mail', 'ACTIVE');

insert into public.survey_versions (id, survey_id, version_number, title, status, published_at)
values ('00000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-0000000000aa', 1, 'Versão 1', 'PUBLISHED', now());

insert into public.survey_applications (id, survey_version_id, code, name, status, opens_at, closes_at, st_notificacao_email)
values (
  '00000000-0000-4000-8000-0000000000cc',
  '00000000-0000-4000-8000-0000000000bb',
  'TESTE-EMAIL-1',
  'Ciclo de Teste de E-mail',
  'OPEN',
  now() - interval '1 hour',
  now() + interval '10 days',
  true
);

insert into public.application_participants (application_id, person_id, status) values
  ('00000000-0000-4000-8000-0000000000cc', '00000000-0000-4000-8000-000000000001', 'ELIGIBLE'),
  ('00000000-0000-4000-8000-0000000000cc', '00000000-0000-4000-8000-000000000002', 'ELIGIBLE'),
  ('00000000-0000-4000-8000-0000000000cc', '00000000-0000-4000-8000-000000000003', 'BLOCKED'),
  ('00000000-0000-4000-8000-0000000000cc', '00000000-0000-4000-8000-000000000004', 'INVITED');

-- 1. Abertura: só as duas pessoas elegíveis com e-mail válido entram na fila,
--    e o lembrete de 24 h não dispara com o encerramento a 10 dias.
select is(
  (select jsonb_array_length(public.fc_reivindicar_emails())),
  2,
  'abertura reivindica só participantes elegíveis com e-mail válido; lembrete fora da janela não dispara'
);

-- 2. Os dois claims são do tipo research_opened.
select is(
  (select count(*)::integer from public.tl_email_participante
    where sq_aplicacao = '00000000-0000-4000-8000-0000000000cc'
      and tp_email = 'research_opened'),
  2,
  'os registros criados são do tipo research_opened'
);

-- Uma segunda execução enquanto a primeira detém o lote não pode receber as
-- mesmas linhas.
select is(
  (select jsonb_array_length(public.fc_reivindicar_emails())),
  0,
  'reivindicações concorrentes não devolvem o lote que já está processando'
);

-- Simula o envio bem-sucedido dos dois.
select lives_ok(
  $sql$
    select public.fc_concluir_email_participante(sq_email, co_reivindicacao, true)
    from public.tl_email_participante
    where sq_aplicacao = '00000000-0000-4000-8000-0000000000cc'
      and st_envio = 'PROCESSANDO'
  $sql$,
  'concluir os envios com sucesso não falha'
);

-- 3. Reprocessar o job não devolve nada: quem já recebeu não recebe de novo.
select is(
  (select jsonb_array_length(public.fc_reivindicar_emails())),
  0,
  'reprocessamento não devolve e-mail já enviado'
);

-- 4. E não cria registro em dobro — a chave única segura o insert.
select is(
  (select count(*)::integer from public.tl_email_participante
    where sq_aplicacao = '00000000-0000-4000-8000-0000000000cc'),
  2,
  'reprocessamento não duplica registros de controle'
);

-- ---------------------------------------------------------------------------
-- Janela de 24 horas: encurta o encerramento e reprocessa.
-- ---------------------------------------------------------------------------
-- O lembrete só pode existir depois de um intervalo real desde o convite;
-- ciclos curtos não recebem os dois avisos na mesma execução.
update public.tl_email_participante
set dt_envio = now() - interval '2 hours'
where tp_email = 'research_opened'
  and sq_aplicacao = '00000000-0000-4000-8000-0000000000cc'
  and st_envio = 'ENVIADO';

update public.survey_applications
set closes_at = now() + interval '12 hours'
where id = '00000000-0000-4000-8000-0000000000cc';

-- Pessoa Quatro conclui antes do lembrete: não deve ser lembrada de responder.
update public.application_participants
set status = 'COMPLETED'
where application_id = '00000000-0000-4000-8000-0000000000cc'
  and person_id = '00000000-0000-4000-8000-000000000004';

-- 5. Só a Pessoa Um entra na janela do lembrete.
select is(
  (select jsonb_array_length(public.fc_reivindicar_emails())),
  1,
  'lembrete de 24h reivindica só quem ainda não concluiu'
);

select is(
  (
    select count(*)::integer from public.tl_email_participante
    where sq_aplicacao = '00000000-0000-4000-8000-0000000000cc'
      and tp_email = 'research_expiring_24h'
      and sq_pessoa = '00000000-0000-4000-8000-000000000001'
  ),
  1,
  'o lembrete pertence à pessoa elegível que não concluiu'
);

-- 6. Falha transitória: o registro FALHOU volta para a fila na execução seguinte.
select lives_ok(
  $sql$
    select public.fc_concluir_email_participante(sq_email, co_reivindicacao, false, 'Falha simulada de rede')
    from public.tl_email_participante
    where sq_aplicacao = '00000000-0000-4000-8000-0000000000cc'
      and st_envio = 'PROCESSANDO'
  $sql$,
  'registrar falha de envio não falha'
);

select is(
  (select jsonb_array_length(public.fc_reivindicar_emails())),
  0,
  'falha não é repetida em laço apertado pela mesma execução'
);

update public.tl_email_participante
set dt_atualizacao = now() - interval '6 minutes'
where sq_aplicacao = '00000000-0000-4000-8000-0000000000cc'
  and st_envio = 'FALHOU';

select is(
  (select jsonb_array_length(public.fc_reivindicar_emails())),
  1,
  'envio que falhou é rearmado enquanto a janela continua válida'
);

-- 7. Participante retirado do ciclo entre a falha e o reprocessamento não
--    volta para a fila, mesmo com o registro rearmado.
select lives_ok(
  $sql$
    select public.fc_concluir_email_participante(sq_email, co_reivindicacao, false, 'Falha simulada de rede')
    from public.tl_email_participante
    where sq_aplicacao = '00000000-0000-4000-8000-0000000000cc'
      and st_envio = 'PROCESSANDO'
  $sql$,
  'registrar a segunda falha não falha'
);

update public.tl_email_participante
set dt_atualizacao = now() - interval '6 minutes'
where sq_aplicacao = '00000000-0000-4000-8000-0000000000cc'
  and st_envio = 'FALHOU';

update public.application_participants
set status = 'EXCLUDED'
where application_id = '00000000-0000-4000-8000-0000000000cc'
  and person_id = '00000000-0000-4000-8000-000000000001';

select is(
  (select jsonb_array_length(public.fc_reivindicar_emails())),
  0,
  'participante removido do ciclo não recebe e-mail pendente'
);

-- 8. Uma falha permanente não é tentada indefinidamente a cada cron.
update public.application_participants
set status = 'ELIGIBLE'
where application_id = '00000000-0000-4000-8000-0000000000cc'
  and person_id = '00000000-0000-4000-8000-000000000001';

update public.tl_email_participante
set nu_tentativas = 5,
    dt_atualizacao = now() - interval '6 minutes'
where sq_aplicacao = '00000000-0000-4000-8000-0000000000cc'
  and st_envio = 'FALHOU';

select is(
  (select jsonb_array_length(public.fc_reivindicar_emails())),
  0,
  'envio que atingiu cinco tentativas permanece fora da fila automática'
);

select * from finish();

rollback;
