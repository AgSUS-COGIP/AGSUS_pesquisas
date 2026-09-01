begin;

-- Clonagem de avaliação: copia o instrumento, não o histórico.
--
-- O que entra na cópia
-- --------------------
-- Seções (inclusive aninhadas), perguntas, alternativas e as regras de lógica
-- condicional. O que **não** entra: ciclo, participantes, submissões e
-- respostas. Uma copia nasce em DRAFT, sem periodo e sem publico — clonar um
-- instrumento e reaproveitar o desenho dele, nao a execucao passada.
--
-- Por que os identificadores precisam ser remapeados
-- --------------------------------------------------
-- Uma regra condicional aponta para a pergunta de origem e para a alternativa
-- comparada. Copiar as regras apontando para os identificadores **do original**
-- criaria um instrumento novo cuja lógica depende de perguntas de outro
-- instrumento: alterar o original mudaria a cópia, e apagar o original deixaria
-- a cópia com regra órfã. O mapa `v_mapa_*` traduz cada identificador antigo no
-- novo antes de gravar a regra.
--
-- A versão copiada é sempre a mais recente que já tem estrutura — a publicada,
-- se houver, senão o rascunho. Copiar de uma versão RETIRED seria reproduzir um
-- desenho que a própria administração já aposentou.

create or replace function public.fc_clonar_pesquisa(
  p_pesquisa uuid,
  p_nome text default null,
  p_codigo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_pessoa uuid := public.current_person_id();
  v_origem public.surveys%rowtype;
  v_versao_origem uuid;
  v_nova_pesquisa uuid;
  v_nova_versao uuid;
  v_codigo text;
  v_nome text;
  v_sufixo integer := 1;
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

  select * into v_origem from public.surveys where id = p_pesquisa;
  if v_origem.id is null then
    raise exception 'Avaliação não localizada.';
  end if;

  -- Prefere a versão publicada; sem ela, o rascunho mais recente.
  select id into v_versao_origem
  from public.survey_versions
  where survey_id = p_pesquisa and status in ('PUBLISHED', 'DRAFT')
  order by case status when 'PUBLISHED' then 0 else 1 end, version_number desc
  limit 1;
  if v_versao_origem is null then
    raise exception 'Esta avaliação não tem versão com estrutura para copiar.';
  end if;

  v_nome := coalesce(nullif(btrim(coalesce(p_nome, '')), ''), v_origem.name || ' (cópia)');
  if length(v_nome) > 160 then
    raise exception 'O nome da cópia é longo demais.';
  end if;

  -- O código é único por constraint. Em vez de devolver erro de banco para quem
  -- clicou em "Duplicar", a função procura o primeiro sufixo livre.
  v_codigo := upper(btrim(coalesce(nullif(btrim(coalesce(p_codigo, '')), ''), v_origem.code || '-COPIA')));
  while exists (select 1 from public.surveys where code = v_codigo) loop
    v_sufixo := v_sufixo + 1;
    v_codigo := upper(btrim(coalesce(nullif(btrim(coalesce(p_codigo, '')), ''), v_origem.code || '-COPIA'))) || '-' || v_sufixo::text;
    if v_sufixo > 50 then
      raise exception 'Não foi possível gerar um código livre para a cópia. Informe um código.';
    end if;
  end loop;

  insert into public.surveys (code, name, description, owner_unit_id, status, settings, created_by)
  values (v_codigo, v_nome, v_origem.description, v_origem.owner_unit_id, 'DRAFT', v_origem.settings, v_pessoa)
  returning id into v_nova_pesquisa;

  insert into public.survey_versions (survey_id, version_number, title, description, status, settings)
  select v_nova_pesquisa, 1, title, description, 'DRAFT', settings
  from public.survey_versions where id = v_versao_origem
  returning id into v_nova_versao;

  -- Seções em duas passagens: primeiro todas sem pai, depois o vínculo, para
  -- que uma seção aninhada não precise que a pai já exista na hora da inserção.
  for v_secao in
    select * from public.survey_sections where survey_version_id = v_versao_origem order by position
  loop
    insert into public.survey_sections (survey_version_id, parent_section_id, code, title, description, position, settings)
    values (v_nova_versao, null, v_secao.code, v_secao.title, v_secao.description, v_secao.position, v_secao.settings)
    returning id into v_alvo;
    v_mapa_secao := v_mapa_secao || jsonb_build_object(v_secao.id::text, v_alvo::text);
    v_secoes := v_secoes + 1;
  end loop;

  for v_secao in
    select * from public.survey_sections where survey_version_id = v_versao_origem and parent_section_id is not null
  loop
    update public.survey_sections
    set parent_section_id = (v_mapa_secao->>v_secao.parent_section_id::text)::uuid
    where id = (v_mapa_secao->>v_secao.id::text)::uuid;
  end loop;

  for v_pergunta in
    select * from public.survey_questions where survey_version_id = v_versao_origem order by position
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
  -- (pergunta, código) — que é único por constraint. Fazer isso dentro do laço
  -- acima exigiria alimentar o jsonb e o id na mesma instrução.
  for v_opcao in
    select antiga.id as id_antigo, nova.id as id_novo
    from public.question_options antiga
    join public.survey_questions pergunta_antiga on pergunta_antiga.id = antiga.question_id
    join public.question_options nova
      on nova.question_id = (v_mapa_pergunta->>pergunta_antiga.id::text)::uuid
     and nova.code = antiga.code
    where pergunta_antiga.survey_version_id = v_versao_origem
  loop
    v_mapa_opcao := v_mapa_opcao || jsonb_build_object(v_opcao.id_antigo::text, v_opcao.id_novo::text);
  end loop;

  -- Regras condicionais, já apontando para os identificadores da cópia.
  for v_regra in
    select * from public.tb_regra_condicional where sq_versao_pesquisa = v_versao_origem and st_ativo
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

  insert into public.audit_events (actor_person_id, event_type, entity_type, entity_id, after_data, metadata)
  values (
    v_pessoa, 'SURVEY_CLONED', 'SURVEY', v_nova_pesquisa::text,
    jsonb_build_object('code', v_codigo, 'name', v_nome, 'sourceSurveyId', p_pesquisa),
    '{}'::jsonb
  );

  return jsonb_build_object(
    'status', 'OK',
    'surveyId', v_nova_pesquisa,
    'code', v_codigo,
    'name', v_nome,
    'sections', v_secoes,
    'questions', v_perguntas,
    'rules', v_regras
  );
end;
$$;

revoke all on function public.fc_clonar_pesquisa(uuid, text, text) from public, anon;
grant execute on function public.fc_clonar_pesquisa(uuid, text, text) to authenticated;

comment on function public.fc_clonar_pesquisa(uuid, text, text) is
  'Duplica a estrutura de uma avaliação (seções, perguntas, alternativas e regras) num novo rascunho, sem ciclo nem histórico.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_clonar_pesquisa(uuid, text, text);
--   notify pgrst, 'reload schema';
-- commit;
