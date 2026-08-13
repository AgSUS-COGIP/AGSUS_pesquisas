begin;

-- Três modelos iniciais da galeria.
--
-- Todos são de **auto-resposta e nominais**, porque é o que a plataforma
-- entrega hoje com honestidade. Clima e engajamento ficaram de fora de
-- propósito: dependem de anonimato estrutural, e um instrumento de clima com
-- resposta identificada produz dado enviesado com aparência de diagnóstico.
-- Avaliação 360 também ficou fora: o runtime genérico ainda não sabe que
-- alguém responde *sobre outra pessoa*.
--
-- Idempotente: reaplica sem duplicar, e reescreve a estrutura de quem já
-- existe. Modelo não tem ciclo nem resposta, então recriar é seguro — a versão
-- fica em DRAFT justamente para permitir isso.

do $modelos$
declare
  v_pesquisa uuid;
  v_versao uuid;
  v_secao uuid;
  v_pergunta uuid;
  v_baixa uuid;
  v_regra uuid;

  -- Escala de concordância usada nos três instrumentos. Cinco pontos, com
  -- rótulo em cada um: escala numerada sem rótulo faz cada pessoa inventar o
  -- próprio significado para o meio.
  v_escala text[] := array[
    'Discordo totalmente', 'Discordo em parte', 'Nem concordo nem discordo',
    'Concordo em parte', 'Concordo totalmente'
  ];
  v_opcao text;
  v_indice integer;

  procedure_marker text;
begin
  ---------------------------------------------------------------------------
  -- 1. Avaliação de capacitação ou evento
  ---------------------------------------------------------------------------
  delete from public.surveys where code = 'MODELO-CAPACITACAO';
  insert into public.surveys (code, name, description, status, st_modelo, tx_categoria_modelo)
  values (
    'MODELO-CAPACITACAO',
    'Avaliação de capacitação ou evento',
    'Aplique ao final de uma ação formativa para medir organização, conteúdo, atuação docente e, principalmente, aplicabilidade no trabalho.',
    'ACTIVE', true, 'Capacitação'
  ) returning id into v_pesquisa;

  insert into public.survey_versions (survey_id, version_number, title, description, status)
  values (v_pesquisa, 1, 'Versão 1', 'Instrumento curto, pensado para ser respondido logo após o encerramento.', 'DRAFT')
  returning id into v_versao;

  insert into public.survey_sections (survey_version_id, code, title, description, position)
  values (v_versao, 'S1', 'Organização',
          'Como a ação foi conduzida do ponto de vista logístico.', 1) returning id into v_secao;

  insert into public.survey_questions (survey_version_id, section_id, code, title, question_type, required, position)
  values (v_versao, v_secao, 'ORG1', 'As informações sobre inscrição, data e local chegaram com antecedência suficiente.', 'SCALE', true, 1)
  returning id into v_pergunta;
  v_indice := 1;
  foreach v_opcao in array v_escala loop
    insert into public.question_options (question_id, code, label, value, score, position)
    values (v_pergunta, 'O' || v_indice::text, v_opcao, v_indice::text, v_indice, v_indice);
    v_indice := v_indice + 1;
  end loop;

  insert into public.survey_questions (survey_version_id, section_id, code, title, question_type, required, position)
  values (v_versao, v_secao, 'ORG2', 'A estrutura oferecida (sala, plataforma, equipamentos) foi adequada.', 'SCALE', true, 2)
  returning id into v_pergunta;
  v_indice := 1;
  foreach v_opcao in array v_escala loop
    insert into public.question_options (question_id, code, label, value, score, position)
    values (v_pergunta, 'O' || v_indice::text, v_opcao, v_indice::text, v_indice, v_indice);
    v_indice := v_indice + 1;
  end loop;

  insert into public.survey_sections (survey_version_id, code, title, description, position)
  values (v_versao, 'S2', 'Conteúdo e docência',
          'O que foi ensinado e como foi ensinado.', 2) returning id into v_secao;

  insert into public.survey_questions (survey_version_id, section_id, code, title, question_type, required, position)
  values (v_versao, v_secao, 'CON1', 'O conteúdo correspondeu ao que havia sido anunciado.', 'SCALE', true, 1)
  returning id into v_pergunta;
  v_indice := 1;
  foreach v_opcao in array v_escala loop
    insert into public.question_options (question_id, code, label, value, score, position)
    values (v_pergunta, 'O' || v_indice::text, v_opcao, v_indice::text, v_indice, v_indice);
    v_indice := v_indice + 1;
  end loop;

  insert into public.survey_questions (survey_version_id, section_id, code, title, question_type, required, position)
  values (v_versao, v_secao, 'CON2', 'Quem conduziu demonstrou domínio do tema e clareza na explicação.', 'SCALE', true, 2)
  returning id into v_pergunta;
  v_indice := 1;
  foreach v_opcao in array v_escala loop
    insert into public.question_options (question_id, code, label, value, score, position)
    values (v_pergunta, 'O' || v_indice::text, v_opcao, v_indice::text, v_indice, v_indice);
    v_indice := v_indice + 1;
  end loop;

  insert into public.survey_questions (survey_version_id, section_id, code, title, description, question_type, required, position)
  values (v_versao, v_secao, 'CON3', 'O ritmo e a carga horária foram adequados ao conteúdo.',
          'Considere se houve tempo para assimilar e perguntar.', 'SCALE', true, 3)
  returning id into v_pergunta;
  v_indice := 1;
  foreach v_opcao in array v_escala loop
    insert into public.question_options (question_id, code, label, value, score, position)
    values (v_pergunta, 'O' || v_indice::text, v_opcao, v_indice::text, v_indice, v_indice);
    v_indice := v_indice + 1;
  end loop;

  insert into public.survey_sections (survey_version_id, code, title, description, position)
  values (v_versao, 'S3', 'Aplicabilidade',
          'A pergunta que justifica o investimento: isto muda o trabalho?', 3) returning id into v_secao;

  insert into public.survey_questions (survey_version_id, section_id, code, title, question_type, required, position)
  values (v_versao, v_secao, 'APL1', 'Consigo aplicar o que aprendi nas minhas atividades.', 'SCALE', true, 1)
  returning id into v_pergunta;
  v_indice := 1;
  foreach v_opcao in array v_escala loop
    insert into public.question_options (question_id, code, label, value, score, position)
    values (v_pergunta, 'O' || v_indice::text, v_opcao, v_indice::text, v_indice, v_indice);
    v_indice := v_indice + 1;
  end loop;

  insert into public.survey_questions (survey_version_id, section_id, code, title, description, question_type, required, position)
  values (v_versao, v_secao, 'APL2', 'O que você pretende colocar em prática nas próximas semanas?',
          'Responder isto por escrito aumenta a chance de a aplicação acontecer.', 'LONG_TEXT', false, 2);

  insert into public.survey_questions (survey_version_id, section_id, code, title, question_type, required, position)
  values (v_versao, v_secao, 'APL3', 'O que faltou, ou o que deveria mudar numa próxima edição?', 'LONG_TEXT', false, 3);

  ---------------------------------------------------------------------------
  -- 2. Pulso rápido
  ---------------------------------------------------------------------------
  delete from public.surveys where code = 'MODELO-PULSO';
  insert into public.surveys (code, name, description, status, st_modelo, tx_categoria_modelo)
  values (
    'MODELO-PULSO',
    'Pulso rápido',
    'Seis perguntas fechadas para repetir periodicamente e acompanhar tendência. O valor está na repetição com o mesmo texto — mudar o enunciado quebra a série histórica.',
    'ACTIVE', true, 'Acompanhamento'
  ) returning id into v_pesquisa;

  insert into public.survey_versions (survey_id, version_number, title, description, status)
  values (v_pesquisa, 1, 'Versão 1', 'Curto de propósito: instrumento longo derruba a taxa de resposta e inutiliza a série.', 'DRAFT')
  returning id into v_versao;

  insert into public.survey_sections (survey_version_id, code, title, description, position)
  values (v_versao, 'S1', 'Como tem sido seu trabalho',
          'Pense nas últimas quatro semanas.', 1) returning id into v_secao;

  v_indice := 1;
  for procedure_marker in
    select unnest(array[
      'Sei o que se espera de mim no trabalho.',
      'Minha carga de trabalho tem sido sustentável.',
      'Tenho as ferramentas e informações de que preciso para fazer meu trabalho.',
      'Recebo de minha chefia imediata o apoio de que preciso.',
      'Meu trabalho é reconhecido.',
      'Consigo conciliar as demandas de trabalho com minha vida pessoal.'
    ])
  loop
    insert into public.survey_questions (survey_version_id, section_id, code, title, question_type, required, position)
    values (v_versao, v_secao, 'P' || v_indice::text, procedure_marker, 'SCALE', true, v_indice)
    returning id into v_pergunta;

    insert into public.question_options (question_id, code, label, value, score, position)
    select v_pergunta, 'O' || posicao::text, rotulo, posicao::text, posicao, posicao
    from unnest(v_escala) with ordinality as escala(rotulo, posicao);

    v_indice := v_indice + 1;
  end loop;

  insert into public.survey_questions (survey_version_id, section_id, code, title, description, question_type, required, position)
  values (v_versao, v_secao, 'P7', 'Há algo que você queira registrar sobre este período?',
          'Opcional. É aqui que costuma aparecer o que as perguntas fechadas não capturam.', 'LONG_TEXT', false, 7);

  ---------------------------------------------------------------------------
  -- 3. Satisfação com serviços internos
  --
  -- Este usa lógica condicional de propósito: serve de exemplo montado do que
  -- a Fase 2 permite, além de evitar pedir justificativa a quem está satisfeito.
  ---------------------------------------------------------------------------
  delete from public.surveys where code = 'MODELO-SERVICOS-INTERNOS';
  insert into public.surveys (code, name, description, status, st_modelo, tx_categoria_modelo)
  values (
    'MODELO-SERVICOS-INTERNOS',
    'Satisfação com serviços internos',
    'Como as áreas avaliam um serviço de apoio (TI, gestão de pessoas, compras, logística). Usa lógica condicional: quem avalia mal recebe uma pergunta a mais, quem avalia bem não é interrogado à toa.',
    'ACTIVE', true, 'Serviços internos'
  ) returning id into v_pesquisa;

  insert into public.survey_versions (survey_id, version_number, title, description, status)
  values (v_pesquisa, 1, 'Versão 1', 'Aplicável a um serviço por ciclo — troque o nome do serviço no enunciado ao clonar.', 'DRAFT')
  returning id into v_versao;

  insert into public.survey_sections (survey_version_id, code, title, description, position)
  values (v_versao, 'S1', 'Seu uso do serviço', 'Para situar sua resposta.', 1) returning id into v_secao;

  insert into public.survey_questions (survey_version_id, section_id, code, title, question_type, required, position)
  values (v_versao, v_secao, 'USO1', 'Com que frequência você aciona este serviço?', 'SINGLE_CHOICE', true, 1)
  returning id into v_pergunta;
  insert into public.question_options (question_id, code, label, value, position) values
    (v_pergunta, 'O1', 'Semanalmente ou mais', 'SEMANAL', 1),
    (v_pergunta, 'O2', 'Algumas vezes por mês', 'MENSAL', 2),
    (v_pergunta, 'O3', 'Raramente', 'RARO', 3);

  insert into public.survey_sections (survey_version_id, code, title, description, position)
  values (v_versao, 'S2', 'Qualidade do atendimento', 'Pense nos atendimentos mais recentes.', 2) returning id into v_secao;

  insert into public.survey_questions (survey_version_id, section_id, code, title, question_type, required, position)
  values (v_versao, v_secao, 'QUA1', 'O prazo de resposta atendeu à minha necessidade.', 'SCALE', true, 1)
  returning id into v_pergunta;
  insert into public.question_options (question_id, code, label, value, score, position)
  select v_pergunta, 'O' || posicao::text, rotulo, posicao::text, posicao, posicao
  from unnest(v_escala) with ordinality as escala(rotulo, posicao);
  -- Guarda a alternativa "Discordo totalmente" para condicionar a pergunta aberta.
  select id into v_baixa from public.question_options where question_id = v_pergunta and code = 'O1';

  insert into public.survey_questions (survey_version_id, section_id, code, title, question_type, required, position)
  values (v_versao, v_secao, 'QUA2', 'Minha solicitação foi resolvida sem que eu precisasse insistir.', 'SCALE', true, 2)
  returning id into v_pergunta;
  insert into public.question_options (question_id, code, label, value, score, position)
  select v_pergunta, 'O' || posicao::text, rotulo, posicao::text, posicao, posicao
  from unnest(v_escala) with ordinality as escala(rotulo, posicao);

  insert into public.survey_questions (survey_version_id, section_id, code, title, question_type, required, position)
  values (v_versao, v_secao, 'QUA3', 'As orientações que recebi foram claras.', 'SCALE', true, 3)
  returning id into v_pergunta;
  insert into public.question_options (question_id, code, label, value, score, position)
  select v_pergunta, 'O' || posicao::text, rotulo, posicao::text, posicao, posicao
  from unnest(v_escala) with ordinality as escala(rotulo, posicao);

  -- Pergunta condicional: só aparece para quem discordou totalmente do prazo.
  insert into public.survey_questions (survey_version_id, section_id, code, title, description, question_type, required, position)
  values (v_versao, v_secao, 'QUA4', 'O que aconteceu no atendimento em que o prazo não atendeu?',
          'Aparece apenas para quem discordou totalmente sobre o prazo.', 'LONG_TEXT', true, 4)
  returning id into v_pergunta;

  insert into public.tb_regra_condicional (sq_versao_pesquisa, tp_alvo, sq_alvo, tp_acao, tp_conector, ds_regra)
  values (v_versao, 'QUESTION', v_pergunta, 'SHOW', 'ALL',
          'Pedir detalhe do prazo apenas a quem discordou totalmente')
  returning sq_regra into v_regra;
  insert into public.tb_condicao_regra (sq_regra, sq_pergunta_origem, tp_operador, sq_opcao)
  select v_regra, sq.id, 'SELECTED', v_baixa
  from public.survey_questions sq
  where sq.survey_version_id = v_versao and sq.code = 'QUA1';

  insert into public.survey_sections (survey_version_id, code, title, description, position)
  values (v_versao, 'S3', 'Prioridade de melhoria', 'O que a área deve atacar primeiro.', 3) returning id into v_secao;

  insert into public.survey_questions (survey_version_id, section_id, code, title, question_type, required, position)
  values (v_versao, v_secao, 'MEL1', 'Se este serviço pudesse melhorar uma única coisa, qual deveria ser?', 'LONG_TEXT', true, 1);

  raise notice 'Modelos criados: capacitação, pulso e serviços internos.';
end;
$modelos$;

commit;

-- Rollback:
-- begin;
--   delete from public.surveys where code in ('MODELO-CAPACITACAO', 'MODELO-PULSO', 'MODELO-SERVICOS-INTERNOS');
-- commit;
