-- fc_sincronizar_estado_ciclos: a metade que faltava do lifecycle temporal.
--
-- Antes deste hotfix o banco só sabia abrir ciclo agendado. Fechar quem passou
-- do prazo era ação administrativa manual, então um ciclo podia ficar
-- simultaneamente `status = OPEN` e recusando resposta — o caso one_piece.
--
-- O que este arquivo protege:
--   * prazo no futuro não é tocado (não fechar cedo é tão importante quanto
--     fechar na hora);
--   * OPEN e SCHEDULED vencidos fecham;
--   * SCHEDULED dentro da janela abre;
--   * `closes_at` sobrevive ao fechamento — é o prazo institucional, não um
--     campo de trabalho da rotina;
--   * a rotina é idempotente: repetir a chamada não gera um segundo evento de
--     auditoria para a mesma transição.

begin;

select plan(12);

insert into sigav."TB_PESQUISA" ("SQ_PESQUISA", "CO_PESQUISA", "NO_PESQUISA")
values ('00000000-0000-4000-8000-00000000e001', 'TESTE-LIFECYCLE', 'Pesquisa de lifecycle');

insert into sigav."TH_VERSAO_PESQUISA" ("SQ_VERSAO_PESQUISA", "SQ_PESQUISA", "NU_VERSAO", "NO_VERSAO", "ST_SITUACAO")
values ('00000000-0000-4000-8000-00000000e002', '00000000-0000-4000-8000-00000000e001', 1, 'Versão 1', 'PUBLISHED');

-- Um ciclo por caso da regra, todos sobre a mesma versão publicada.
insert into sigav."TB_APLICACAO_PESQUISA" ("SQ_APLICACAO", "SQ_VERSAO_PESQUISA", "CO_APLICACAO", "NO_APLICACAO", "DT_ABERTURA", "DT_ENCERRAMENTO", "ST_SITUACAO")
values
  -- Caso 1: aberto, prazo no futuro.
  ('00000000-0000-4000-8000-00000000e101', '00000000-0000-4000-8000-00000000e002',
   'LIFECYCLE-1', 'Aberto no prazo', now() - interval '2 days', now() + interval '2 days', 'OPEN'),
  -- Caso 2: aberto, prazo vencido — o caso one_piece.
  ('00000000-0000-4000-8000-00000000e102', '00000000-0000-4000-8000-00000000e002',
   'LIFECYCLE-2', 'Aberto vencido', now() - interval '5 days', now() - interval '1 day', 'OPEN'),
  -- Caso 3: agendado, janela já começou e ainda não terminou.
  ('00000000-0000-4000-8000-00000000e103', '00000000-0000-4000-8000-00000000e002',
   'LIFECYCLE-3', 'Agendado na janela', now() - interval '1 hour', now() + interval '3 days', 'SCHEDULED'),
  -- Caso 4: agendado cuja janela inteira passou sem ninguém abrir.
  ('00000000-0000-4000-8000-00000000e104', '00000000-0000-4000-8000-00000000e002',
   'LIFECYCLE-4', 'Agendado vencido', now() - interval '9 days', now() - interval '2 days', 'SCHEDULED'),
  -- Caso 5: já fechado antes da rotina rodar.
  ('00000000-0000-4000-8000-00000000e105', '00000000-0000-4000-8000-00000000e002',
   'LIFECYCLE-5', 'Já fechado', now() - interval '9 days', now() - interval '3 days', 'CLOSED');

-- O prazo do caso 2 é guardado antes para provar depois que a rotina não o
-- substituiu por now().
create temporary table prazo_original on commit drop as
select "DT_ENCERRAMENTO" from sigav."TB_APLICACAO_PESQUISA"
where "SQ_APLICACAO" = '00000000-0000-4000-8000-00000000e102';

select sigav."FC_SINCRONIZAR_ESTADO_CICLOS"();

select is(
  (select "ST_SITUACAO" from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = '00000000-0000-4000-8000-00000000e101'),
  'OPEN',
  'caso 1 — aberto com prazo no futuro continua OPEN'
);

select is(
  (select "ST_SITUACAO" from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = '00000000-0000-4000-8000-00000000e102'),
  'CLOSED',
  'caso 2 — aberto com prazo vencido passa a CLOSED'
);

select is(
  (select "ST_SITUACAO" from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = '00000000-0000-4000-8000-00000000e103'),
  'OPEN',
  'caso 3 — agendado dentro da janela passa a OPEN'
);

select is(
  (select "ST_SITUACAO" from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = '00000000-0000-4000-8000-00000000e104'),
  'CLOSED',
  'caso 4 — agendado com prazo vencido passa a CLOSED sem abrir antes'
);

select is(
  (select "ST_SITUACAO" from sigav."TB_APLICACAO_PESQUISA" where "SQ_APLICACAO" = '00000000-0000-4000-8000-00000000e105'),
  'CLOSED',
  'caso 5 — quem já estava fechado permanece CLOSED'
);

-- Compara estado e prazo juntos de propósito. Só o prazo passaria à toa num
-- cenário em que a rotina não fez nada — e "não fez nada" é exatamente o bug.
select is(
  (select "ST_SITUACAO" || ' | ' || "DT_ENCERRAMENTO"::text from sigav."TB_APLICACAO_PESQUISA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-00000000e102'),
  (select 'CLOSED | ' || "DT_ENCERRAMENTO"::text from prazo_original),
  'o prazo institucional é preservado no fechamento automático'
);

-- Caso 4 é a prova de que o fechamento vem antes da abertura: se a ordem fosse
-- inversa ele teria virado OPEN e só depois CLOSED, deixando dois eventos.
select is(
  (select count(*)::integer from sigav."TL_EVENTO_AUDITORIA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-00000000e104'
     and "TP_EVENTO" = 'SURVEY_CYCLE_AUTO_OPEN'),
  0,
  'agendado vencido não passa por abertura antes de fechar'
);

select is(
  (select count(*)::integer from sigav."TL_EVENTO_AUDITORIA"
   where "TP_EVENTO" = 'SURVEY_CYCLE_AUTO_CLOSE'
     and "SQ_APLICACAO" in ('00000000-0000-4000-8000-00000000e102', '00000000-0000-4000-8000-00000000e104')),
  2,
  'cada transição automática gera um evento de auditoria'
);

-- Conta em vez de ler o campo: `select actor_person_id` de zero linhas devolve
-- null e passaria mesmo se nenhum evento tivesse sido gravado.
select is(
  (select count(*)::integer from sigav."TL_EVENTO_AUDITORIA"
   where "TP_EVENTO" = 'SURVEY_CYCLE_AUTO_CLOSE'
     and "SQ_APLICACAO" in ('00000000-0000-4000-8000-00000000e102', '00000000-0000-4000-8000-00000000e104')
     and "SQ_PESSOA_ATOR" is null),
  2,
  'não há ator humano registrado quando não houve ator humano'
);

select is(
  (select "DS_METADADO" ->> 'reason' from sigav."TL_EVENTO_AUDITORIA"
   where "TP_EVENTO" = 'SURVEY_CYCLE_AUTO_CLOSE'
     and "SQ_APLICACAO" = '00000000-0000-4000-8000-00000000e102'),
  'closes_at_reached',
  'a auditoria diz por que o ciclo fechou'
);

select is(
  (select "DS_DADO_ANTERIOR" ->> 'applicationStatus' from sigav."TL_EVENTO_AUDITORIA"
   where "TP_EVENTO" = 'SURVEY_CYCLE_AUTO_CLOSE'
     and "SQ_APLICACAO" = '00000000-0000-4000-8000-00000000e104'),
  'SCHEDULED',
  'a auditoria preserva o estado anterior real, não um valor fixo'
);

-- Caso 9: idempotência. Chamar de novo não pode produzir um segundo evento de
-- fechamento para uma transição que já aconteceu.
select sigav."FC_SINCRONIZAR_ESTADO_CICLOS"();
select sigav."FC_SINCRONIZAR_ESTADO_CICLOS"();

select is(
  (select count(*)::integer from sigav."TL_EVENTO_AUDITORIA"
   where "TP_EVENTO" = 'SURVEY_CYCLE_AUTO_CLOSE'
     and "SQ_APLICACAO" in ('00000000-0000-4000-8000-00000000e102', '00000000-0000-4000-8000-00000000e104')),
  2,
  'chamadas repetidas não geram eventos duplicados de fechamento'
);

select * from finish();

rollback;
