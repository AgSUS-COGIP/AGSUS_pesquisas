-- Trava a regra de elegibilidade de `FC_ATRIB_TODOS_DISPONIVEIS`.
--
-- Esta função derivou de produção sem que nada acusasse: `set schema` não
-- reescreve corpo de função, nenhuma migration posterior a redefiniu, e o job
-- de reconstrução não compara com produção — ele reconstrói do zero, onde a
-- versão da main sempre vence.
--
-- Um teste de comportamento fecha essa porta: a regra passa a estar escrita em
-- asserções, e mudá-la sem querer quebra o CI. Se alguém precisar mudá-la de
-- propósito — a Fase 1 vai, adotando `tb_pessoa.active` como critério canônico —,
-- quebrar este arquivo é o aviso de que a decisão é deliberada.

begin;

select plan(4);

insert into sigav."TB_USUARIO_IDENTIDADE" ("SQ_USUARIO", "TP_AUDIENCIA", "TP_PAPEL", "DS_EMAIL", "DT_INCLUSAO", "DT_ALTERACAO")
values ('00000000-0000-4000-8000-00000000f001', 'authenticated', 'authenticated', 'eleg-admin@agenciasus.org.br', now(), now());

insert into sigav."TB_PESSOA" ("SQ_PESSOA", "SQ_USUARIO_IDENTIDADE", "CO_MATRICULA", "NO_PESSOA", "DS_EMAIL_INSTITUCIONAL", "ST_ATIVO", "ST_VINCULO")
values ('00000000-0000-4000-8000-00000000f002', '00000000-0000-4000-8000-00000000f001', 'TESTE-ELEG-ADMIN', 'Administração de Teste', 'eleg-admin@agenciasus.org.br', true, 'ATIVO');

-- Preset Admin - era a role SURVEY_MANAGER, e as tabelas de perfil sairam do
-- banco em 20260828150000_remover_perfis_legados_do_banco.sql. A autorizacao
-- hoje e permissao por pessoa; as funcoes sob teste exigem ADMIN_SURVEYS, via
-- can_manage_surveys().
insert into sigav."RL_PESSOA_MODULO" ("SQ_PESSOA", "CO_MODULO", "ST_PERMITIDO")
select '00000000-0000-4000-8000-00000000f002', modulo, true
  from unnest(array[
    'HOME', 'SURVEYS', 'DASHBOARDS', 'ONLINE_PRESENCE',
    'ADMIN_SURVEYS', 'ADMIN_PARTICIPANTS'
  ]) modulo;

-- Quatro pessoas, uma por regra. A administradora acima também é candidata
-- elegível, por isso as contagens abaixo olham pessoa a pessoa e não o total.
insert into sigav."TB_PESSOA" ("SQ_PESSOA", "CO_MATRICULA", "NO_PESSOA", "DS_EMAIL_INSTITUCIONAL", "ST_ATIVO", "ST_VINCULO", "DS_METADADO")
values
  ('00000000-0000-4000-8000-00000000f011', 'TESTE-ELEG-1', 'Ativa e ATIVO',      'eleg1@agenciasus.org.br', true,  'ATIVO',  '{}'::jsonb),
  ('00000000-0000-4000-8000-00000000f012', 'TESTE-ELEG-2', 'Ativa e NORMAL',     'eleg2@agenciasus.org.br', true,  'NORMAL', '{}'::jsonb),
  ('00000000-0000-4000-8000-00000000f013', 'TESTE-ELEG-3', 'Ativa e isenta',     'eleg3@agenciasus.org.br', true,  'ATIVO',  '{"evaluation_exempt": true}'::jsonb),
  ('00000000-0000-4000-8000-00000000f014', 'TESTE-ELEG-4', 'Inativa',            'eleg4@agenciasus.org.br', false, 'ATIVO',  '{}'::jsonb);

insert into sigav."TB_PESQUISA" ("SQ_PESQUISA", "CO_PESQUISA", "NO_PESQUISA")
values ('00000000-0000-4000-8000-00000000f021', 'TESTE-ELEG', 'Pesquisa de elegibilidade');

insert into sigav."TH_VERSAO_PESQUISA" ("SQ_VERSAO_PESQUISA", "SQ_PESQUISA", "NU_VERSAO", "NO_VERSAO", "ST_SITUACAO")
values ('00000000-0000-4000-8000-00000000f022', '00000000-0000-4000-8000-00000000f021', 1, 'Versão 1', 'PUBLISHED');

insert into sigav."TB_APLICACAO_PESQUISA" ("SQ_APLICACAO", "SQ_VERSAO_PESQUISA", "CO_APLICACAO", "NO_APLICACAO", "DT_ABERTURA", "DT_ENCERRAMENTO", "ST_SITUACAO")
values ('00000000-0000-4000-8000-00000000f023', '00000000-0000-4000-8000-00000000f022',
        'TESTE-ELEG-1', 'Ciclo de elegibilidade', now() - interval '1 day', now() + interval '7 days', 'OPEN');

select set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-4000-8000-00000000f001","role":"authenticated"}',
  true
);

select sigav."FC_ATRIB_TODOS_DISPONIVEIS"('00000000-0000-4000-8000-00000000f023');

select is(
  (select count(*)::integer from sigav."RL_APLICACAO_PESSOA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-00000000f023'
     and "SQ_PESSOA" = '00000000-0000-4000-8000-00000000f011'),
  1,
  'pessoa ativa com employment_status ATIVO é vinculada'
);

-- A asserção que trava a deriva. A definição antiga da main aceitava 'NORMAL';
-- produção não aceita. Se alguém reintroduzir a versão permissiva, cai aqui.
select is(
  (select count(*)::integer from sigav."RL_APLICACAO_PESSOA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-00000000f023'
     and "SQ_PESSOA" = '00000000-0000-4000-8000-00000000f012'),
  0,
  'employment_status NORMAL não é elegível'
);

select is(
  (select count(*)::integer from sigav."RL_APLICACAO_PESSOA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-00000000f023'
     and "SQ_PESSOA" = '00000000-0000-4000-8000-00000000f013'),
  0,
  'pessoa marcada com evaluation_exempt não é vinculada'
);

select is(
  (select count(*)::integer from sigav."RL_APLICACAO_PESSOA"
   where "SQ_APLICACAO" = '00000000-0000-4000-8000-00000000f023'
     and "SQ_PESSOA" = '00000000-0000-4000-8000-00000000f014'),
  0,
  'pessoa inativa não é vinculada'
);

select * from finish();

rollback;
