begin;

-- Nova versão de uma pesquisa já publicada: o aviso do construtor ("Crie uma
-- nova versão para realizar alterações") existia desde a publicação da
-- estrutura, mas nenhuma função jamais implementou a ação por trás dele.
--
-- O que entra na cópia
-- --------------------
-- O mesmo conjunto de `fc_clonar_pesquisa`: seções (inclusive aninhadas),
-- perguntas, alternativas e regras de lógica condicional, com os
-- identificadores remapeados (ver o comentário daquela função). A diferença é
-- o destino: aqui a estrutura é copiada para uma versão nova da **mesma**
-- pesquisa (`survey_id` inalterado, `version_number` seguinte), não para uma
-- pesquisa nova.
--
-- Por que também nasce um ciclo novo
-- -----------------------------------
-- `survey_applications.survey_version_id` referencia uma versão específica.
-- Sem uma aplicação nova, `manage_survey_cycle` falharia com "Ciclo de
-- aplicação não encontrado." assim que alguém tentasse publicar a versão
-- criada aqui. O ciclo nasce em rascunho, sem período e sem identidade visual
-- própria — o operador configura os dois em Propriedades do ciclo e em
-- Identidade Visual, como faria para qualquer ciclo novo. A identidade visual
-- não é copiada de propósito: ela mora em `settings->'visualIdentity'` e
-- `update_application_visual_settings` exige que o caminho do banner comece
-- pelo id da própria aplicação — copiar o jsonb geraria uma referência que a
-- tela de identidade recusaria revalidar sem trocar o arquivo.
--
-- Por que a versão atual é aposentada antes, não apagada
-- -------------------------------------------------------
-- `RETIRED` é um estado previsto desde o esquema inicial (aceito por
-- `get_public_survey_form` e `list_my_survey_catalog` para quem já estava
-- respondendo), mas nenhuma função o gravava até aqui. Aposentar a versão
-- publicada faz `get_survey_builder`, `get_survey_operations`,
-- `manage_survey_cycle` e `list_managed_surveys` — que resolvem "a versão"
-- por `order by version_number desc limit 1` — passarem a apontar sozinhas
-- para a versão nova, sem precisar redesenhar nenhuma delas. Quem já
-- respondia o ciclo antigo não é afetado: o código de aplicação antigo não
-- muda, e a versão `RETIRED` continua servindo o formulário para quem estava
-- no meio do preenchimento.
--
-- Por que exige o ciclo anterior encerrado
-- ------------------------------------------
-- Justamente porque as quatro RPCs acima passam a resolver a versão nova como
-- "a corrente", criar uma versão nova enquanto o ciclo anterior ainda está
-- ativo (rascunho, agendado ou aberto) cegaria a administração para esse
-- ciclo — ele continuaria funcionando para quem responde, mas ficaria
-- inacessível pela tela de Propriedades. Por isso a função exige que o ciclo
-- da versão publicada já esteja `CLOSED` ou `CANCELLED`, ou que nunca tenha
-- existido — nunca há dois ciclos operacionalmente relevantes ao mesmo
-- tempo.

create or replace function public.fc_criar_nova_versao_pesquisa(p_pesquisa uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_pessoa uuid := public.current_person_id();
  v_pesquisa public.surveys%rowtype;
  v_versao_origem public.survey_versions%rowtype;
  v_aplicacao_origem public.survey_applications%rowtype;
  v_nova_versao uuid;
  v_novo_numero integer;
  v_nova_aplicacao uuid;
  v_novo_codigo_aplicacao text;
  v_mapa_secao jsonb := '{}'::jsonb;
  v_mapa_pergunta jsonb := '{}'::jsonb;
  v_mapa_opcao jsonb := '{}'::jsonb;
  v_secao record;
  v_pergunta record;
  v_opcao record;
  v_regra record;
  v_nova_regra uuid;
  v_alvo uuid;
  v_secoes integer := 0;
  v_perguntas integer := 0;
  v_regras integer := 0;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  select * into v_pesquisa from public.surveys where id = p_pesquisa for update;
  if v_pesquisa.id is null then
    raise exception 'Avaliação não encontrada.';
  end if;

  if v_pesquisa.dt_arquivamento is not null then
    raise exception 'Esta avaliação está arquivada. Restaure-a antes de criar uma nova versão.';
  end if;

  select * into v_versao_origem
  from public.survey_versions
  where survey_id = p_pesquisa
  order by version_number desc
  limit 1
  for update;
  if v_versao_origem.id is null then
    raise exception 'Versão da pesquisa não encontrada.';
  end if;

  -- Cobre, com a mesma mensagem, tanto "nunca foi publicada" quanto "já existe
  -- um rascunho mais novo aguardando conclusão": nos dois casos a versão mais
  -- recente está em DRAFT.
  if v_versao_origem.status = 'DRAFT' then
    raise exception 'A versão mais recente desta avaliação ainda está em rascunho. Publique-a (ou conclua as alterações pendentes) antes de criar uma nova versão.';
  elsif v_versao_origem.status = 'RETIRED' then
    -- Defensivo: esta é a única função que grava RETIRED, e sempre insere a
    -- versão seguinte na mesma transação — não deveria haver uma RETIRED sem
    -- sucessora mais nova.
    raise exception 'A versão mais recente desta avaliação já está descontinuada.';
  end if;

  select * into v_aplicacao_origem
  from public.survey_applications
  where survey_version_id = v_versao_origem.id
  order by created_at desc
  limit 1
  for update;

  if v_aplicacao_origem.id is not null
     and v_aplicacao_origem.status not in ('CLOSED', 'CANCELLED') then
    raise exception 'O ciclo desta versão ainda está %. Encerre-o (Pausar ou Finalizar, em Propriedades do ciclo) antes de criar uma nova versão.',
      case v_aplicacao_origem.status
        when 'DRAFT' then 'em rascunho'
        when 'SCHEDULED' then 'agendado'
        when 'OPEN' then 'aberto'
        else lower(v_aplicacao_origem.status)
      end;
  end if;

  -- Aposenta a versão atual antes de inserir a próxima, para que nenhuma
  -- leitura concorrente resolva "a versão" pelas duas ao mesmo tempo.
  update public.survey_versions
  set status = 'RETIRED', updated_at = now()
  where id = v_versao_origem.id;

  v_novo_numero := v_versao_origem.version_number + 1;

  insert into public.survey_versions (
    survey_id, version_number, title, description, status, schema_version, settings, created_by
  )
  values (
    p_pesquisa, v_novo_numero, v_versao_origem.title, v_versao_origem.description,
    'DRAFT', v_versao_origem.schema_version, v_versao_origem.settings, v_pessoa
  )
  returning id into v_nova_versao;

  -- Seções em duas passagens: primeiro todas sem pai, depois o vínculo, para
  -- que uma seção aninhada não precise que a pai já exista na hora da
  -- inserção (mesma técnica de fc_clonar_pesquisa).
  for v_secao in
    select * from public.survey_sections where survey_version_id = v_versao_origem.id order by position
  loop
    insert into public.survey_sections (survey_version_id, parent_section_id, code, title, description, position, settings)
    values (v_nova_versao, null, v_secao.code, v_secao.title, v_secao.description, v_secao.position, v_secao.settings)
    returning id into v_alvo;
    v_mapa_secao := v_mapa_secao || jsonb_build_object(v_secao.id::text, v_alvo::text);
    v_secoes := v_secoes + 1;
  end loop;

  for v_secao in
    select * from public.survey_sections where survey_version_id = v_versao_origem.id and parent_section_id is not null
  loop
    update public.survey_sections
    set parent_section_id = (v_mapa_secao->>v_secao.parent_section_id::text)::uuid
    where id = (v_mapa_secao->>v_secao.id::text)::uuid;
  end loop;

  for v_pergunta in
    select * from public.survey_questions where survey_version_id = v_versao_origem.id order by position
  loop
    insert into public.survey_questions (
      survey_version_id, section_id, code, title, description, question_type,
      required, position, validation, display_logic, scoring, settings
    ) values (
      v_nova_versao, (v_mapa_secao->>v_pergunta.section_id::text)::uuid, v_pergunta.code,
      v_pergunta.title, v_pergunta.description, v_pergunta.question_type,
      v_pergunta.required, v_pergunta.position, v_pergunta.validation,
      v_pergunta.display_logic, v_pergunta.scoring, v_pergunta.settings
    ) returning id into v_alvo;
    v_mapa_pergunta := v_mapa_pergunta || jsonb_build_object(v_pergunta.id::text, v_alvo::text);
    v_perguntas := v_perguntas + 1;

    for v_opcao in
      select * from public.question_options where question_id = v_pergunta.id order by position
    loop
      insert into public.question_options (question_id, code, label, value, score, position, active, metadata)
      values (v_alvo, v_opcao.code, v_opcao.label, v_opcao.value, v_opcao.score, v_opcao.position, v_opcao.active, v_opcao.metadata);
    end loop;
  end loop;

  -- O mapa de alternativas é montado numa passagem própria, pareando pelo par
  -- (pergunta, código) — único por constraint — porque o id novo só existe
  -- depois do laço acima.
  for v_opcao in
    select antiga.id as id_antigo, nova.id as id_novo
    from public.question_options antiga
    join public.survey_questions pergunta_antiga on pergunta_antiga.id = antiga.question_id
    join public.question_options nova
      on nova.question_id = (v_mapa_pergunta->>pergunta_antiga.id::text)::uuid
     and nova.code = antiga.code
    where pergunta_antiga.survey_version_id = v_versao_origem.id
  loop
    v_mapa_opcao := v_mapa_opcao || jsonb_build_object(v_opcao.id_antigo::text, v_opcao.id_novo::text);
  end loop;

  -- Regras condicionais, já apontando para os identificadores da versão nova.
  for v_regra in
    select * from public.tb_regra_condicional where sq_versao_pesquisa = v_versao_origem.id and st_ativo
  loop
    v_alvo := case v_regra.tp_alvo
      when 'SECTION' then (v_mapa_secao->>v_regra.sq_alvo::text)::uuid
      else (v_mapa_pergunta->>v_regra.sq_alvo::text)::uuid
    end;
    if v_alvo is null then
      continue;
    end if;

    insert into public.tb_regra_condicional (
      sq_versao_pesquisa, tp_alvo, sq_alvo, tp_acao, tp_conector, ds_regra, au_usuario_inclusao
    ) values (
      v_nova_versao, v_regra.tp_alvo, v_alvo, v_regra.tp_acao, v_regra.tp_conector, v_regra.ds_regra, v_pessoa
    ) returning sq_regra into v_nova_regra;

    insert into public.tb_condicao_regra (sq_regra, sq_pergunta_origem, tp_operador, sq_opcao, tx_valor, nu_valor, nu_ordem)
    select
      v_nova_regra,
      (v_mapa_pergunta->>condicao.sq_pergunta_origem::text)::uuid,
      condicao.tp_operador,
      case when condicao.sq_opcao is null then null else (v_mapa_opcao->>condicao.sq_opcao::text)::uuid end,
      condicao.tx_valor, condicao.nu_valor, condicao.nu_ordem
    from public.tb_condicao_regra condicao
    where condicao.sq_regra = v_regra.sq_regra
      and (v_mapa_pergunta->>condicao.sq_pergunta_origem::text) is not null;

    v_regras := v_regras + 1;
  end loop;

  -- Ciclo novo: mesmas preferências operacionais do ciclo anterior (visibilidade,
  -- reenvio, anonimato, limiar, aviso por e-mail), sem período e sem identidade
  -- visual própria — o código nunca colide porque é a primeira vez que este
  -- version_number existe para esta pesquisa.
  v_novo_codigo_aplicacao := upper(v_pesquisa.code) || '-' || v_novo_numero::text;

  insert into public.survey_applications (
    survey_version_id, code, name, opens_at, closes_at, status,
    allow_drafts, allow_resubmission, anonymous, access_mode,
    nu_limiar_anonimato, st_notificacao_email, settings, created_by
  ) values (
    v_nova_versao,
    v_novo_codigo_aplicacao,
    coalesce(v_aplicacao_origem.name, v_pesquisa.name),
    null, null, 'DRAFT',
    coalesce(v_aplicacao_origem.allow_drafts, true),
    coalesce(v_aplicacao_origem.allow_resubmission, false),
    coalesce(v_aplicacao_origem.anonymous, false),
    coalesce(v_aplicacao_origem.access_mode, 'RESTRICTED'),
    coalesce(v_aplicacao_origem.nu_limiar_anonimato, 5),
    coalesce(v_aplicacao_origem.st_notificacao_email, false),
    '{}'::jsonb,
    v_pessoa
  )
  returning id into v_nova_aplicacao;

  insert into public.audit_events (
    actor_person_id, event_type, entity_type, entity_id, application_id, before_data, after_data, metadata
  ) values (
    v_pessoa, 'SURVEY_VERSION_CREATED', 'SURVEY_VERSION', v_nova_versao::text, v_nova_aplicacao,
    jsonb_build_object('retiredVersionId', v_versao_origem.id, 'retiredVersionNumber', v_versao_origem.version_number),
    jsonb_build_object(
      'newVersionId', v_nova_versao, 'newVersionNumber', v_novo_numero,
      'newApplicationId', v_nova_aplicacao, 'newApplicationCode', v_novo_codigo_aplicacao
    ),
    jsonb_build_object('surveyId', p_pesquisa)
  );

  return jsonb_build_object(
    'status', 'OK',
    'surveyId', p_pesquisa,
    'versionId', v_nova_versao,
    'versionNumber', v_novo_numero,
    'applicationId', v_nova_aplicacao,
    'applicationCode', v_novo_codigo_aplicacao,
    'sections', v_secoes,
    'questions', v_perguntas,
    'rules', v_regras
  );
end;
$$;

revoke all on function public.fc_criar_nova_versao_pesquisa(uuid) from public, anon;
grant execute on function public.fc_criar_nova_versao_pesquisa(uuid) to authenticated;

comment on function public.fc_criar_nova_versao_pesquisa(uuid) is
  'Cria uma nova versão em rascunho de uma pesquisa já publicada — com um novo ciclo em rascunho —, aposentando a versão e o ciclo atuais.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_criar_nova_versao_pesquisa(uuid);
--   notify pgrst, 'reload schema';
-- commit;
