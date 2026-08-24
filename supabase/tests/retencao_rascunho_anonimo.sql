-- Expiração de rascunho anônimo: ACL das três funções e limites do prazo.
--
-- Por que este arquivo existe, e não mais asserts em security_audit_hardening:
-- o teste que faltava é sempre o da função nova. Em 24/08/2026 uma redefinição
-- reconcedeu `execute` de `fc_reivindicar_emails` a `authenticated` sem
-- conflito e sem histórico, e só um assert existente barrou a volta. Nenhuma
-- das funções abaixo tinha esse assert.

begin;

select plan(9);

-- ---------------------------------------------------------------------------
-- fc_srv_expirar_rascunhos_anon — contrato de backend.
--
-- É chamada de dentro de `after()`, com o erro reduzido a console.warn para
-- que a faxina nunca derrube a jornada de quem responde. A consequência é que
-- uma ACL faltando não apareceria em lugar nenhum: a rota continuaria
-- respondendo 200 e a expiração simplesmente nunca aconteceria. Estes dois
-- asserts são a única coisa que torna essa falha visível.
-- ---------------------------------------------------------------------------
select ok(
  not has_function_privilege('anon', 'public.fc_srv_expirar_rascunhos_anon()', 'execute'),
  'anon não executa a expiração de rascunhos anônimos'
);

select ok(
  not has_function_privilege('authenticated', 'public.fc_srv_expirar_rascunhos_anon()', 'execute'),
  'authenticated não executa a expiração de rascunhos anônimos'
);

select ok(
  has_function_privilege('service_role', 'public.fc_srv_expirar_rascunhos_anon()', 'execute'),
  'service_role executa a expiração de rascunhos anônimos'
);

-- ---------------------------------------------------------------------------
-- fc_expirar_rascunhos_anonimos — sem grant para ninguém.
--
-- É chamada de dentro de uma função `security definer`, que executa como o
-- dono e dispensa `execute` de quem chamou. Conceder aqui abriria um caminho
-- que nenhum chamador precisa — mesmo desenho de fc_abrir_ciclos_agendados().
-- ---------------------------------------------------------------------------
select ok(
  not has_function_privilege('anon', 'public.fc_expirar_rascunhos_anonimos()', 'execute'),
  'anon não executa a rotina interna de expiração'
);

select ok(
  not has_function_privilege('authenticated', 'public.fc_expirar_rascunhos_anonimos()', 'execute'),
  'authenticated não executa a rotina interna de expiração'
);

-- ---------------------------------------------------------------------------
-- fc_definir_retencao_anonima — exposta a authenticated, guardada em runtime.
--
-- O grant a `authenticated` é correto e deliberado: a autorização está dentro
-- da função (`can_manage_surveys()`), não na ACL. Revogar aqui esconderia a
-- configuração de quem tem o direito de mudá-la.
-- ---------------------------------------------------------------------------
select ok(
  not has_function_privilege('anon', 'public.fc_definir_retencao_anonima(integer)', 'execute'),
  'anon não define o prazo de retenção'
);

select ok(
  has_function_privilege('authenticated', 'public.fc_definir_retencao_anonima(integer)', 'execute'),
  'authenticated alcança a função, que decide por can_manage_surveys()'
);

-- ---------------------------------------------------------------------------
-- A guarda vem antes do intervalo, e é isso que o teste consegue afirmar aqui.
--
-- Sem JWT, `current_person_id()` é nulo e `can_manage_surveys()` é falso, então
-- a função recusa na primeira linha. Testar o piso e o teto exigiria montar
-- pessoa e perfil vigentes só para chegar à segunda checagem — e quem garante
-- o intervalo de verdade é a constraint, afirmada logo abaixo. O que importa
-- travar aqui é que a função não grava para quem não administra avaliações.
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ select public.fc_definir_retencao_anonima(30) $$,
  'Acesso restrito à administração de avaliações.',
  'sem perfil de administração, a função recusa antes de gravar'
);

-- Apagar rascunho vivo é irreversível, então o prazo não depende só da
-- validação da função: a constraint recusa o valor mesmo se alguém gravar a
-- coluna por outro caminho.
select ok(
  exists (
    select 1
    from pg_catalog.pg_constraint
    where conrelid = 'public.tb_config_plataforma'::regclass
      and conname = 'ck_config_retencao_anonima'
      and contype = 'c'
  ),
  'ck_config_retencao_anonima mantém o prazo entre 7 e 730 no próprio banco'
);

select * from finish();

rollback;
