begin;

-- Motor de lógica condicional: perguntas e seções que aparecem conforme o que já
-- foi respondido.
--
-- Por que tabela e não JSONB
-- --------------------------
-- `survey_questions.display_logic` existe desde o esquema inicial e nunca ganhou
-- leitor: `get_public_survey_form` devolve o campo, nenhuma tela o consome. Como
-- JSONB solto, ele não consegue garantir o que uma regra precisa garantir — que a
-- pergunta de origem existe, pertence à mesma versão, que a alternativa comparada
-- é daquela pergunta, e que o conjunto de regras não forma ciclo. Chave
-- estrangeira e constraint fazem isso; validação em JSON, não.
--
-- `display_logic` fica intocado. Sua única ocorrência preenchida em produção é a
-- pergunta CHEFIA_RESPONSAVEL do CDDI publicado, e o conteúdo lá
-- (`{"submission_types": ["AUTO"]}`) é filtro de tipo de submissão, não regra de
-- ramificação — quem o interpreta é `isCddiQuestionVisible()`, no frontend.
-- Migrar aquilo para cá seria misturar dois assuntos que só se parecem no nome.
--
-- O grafo precisa ser acíclico
-- ---------------------------
-- Uma regra liga um alvo (pergunta ou seção) às perguntas que a condicionam. Se
-- A depende de B e B volta a depender de A, não existe ordem de avaliação: o
-- formulário entra em laço ou pisca para sempre. A validação de ciclo acontece na
-- gravação, uma vez, e não a cada renderização — é a diferença entre um erro que
-- o operador vê ao montar o instrumento e um defeito que só aparece com o
-- participante na frente da tela.

create table if not exists public.tb_regra_condicional (
  sq_regra uuid not null default gen_random_uuid(),
  sq_versao_pesquisa uuid not null,
  tp_alvo text not null,
  sq_alvo uuid not null,
  tp_acao text not null default 'SHOW',
  tp_conector text not null default 'ALL',
  ds_regra text,
  st_ativo boolean not null default true,
  au_usuario_inclusao uuid,
  dt_inclusao timestamptz not null default timezone('utc', now()),
  dt_alteracao timestamptz not null default timezone('utc', now()),
  constraint pk_tb_regra_condicional primary key (sq_regra),
  constraint fk_tb_regra_condicional_versao foreign key (sq_versao_pesquisa)
    references public.survey_versions(id) on delete cascade,
  constraint fk_tb_regra_condicional_pessoa foreign key (au_usuario_inclusao)
    references public.people(id) on delete set null,
  constraint ck_tb_regra_condicional_alvo check (tp_alvo in ('QUESTION', 'SECTION')),
  constraint ck_tb_regra_condicional_acao check (tp_acao in ('SHOW', 'HIDE')),
  constraint ck_tb_regra_condicional_conec check (tp_conector in ('ALL', 'ANY'))
);

-- Uma regra vigente por alvo. Duas regras ativas sobre a mesma pergunta exigiriam
-- uma ordem de precedência que ninguém consegue prever ao montar o instrumento;
-- com `tp_conector` valendo ALL ou ANY, uma regra já expressa o que duas
-- expressariam.
create unique index if not exists in_regra_condicional_alvo
  on public.tb_regra_condicional (sq_alvo)
  where st_ativo;

create index if not exists in_regra_condicional_versao
  on public.tb_regra_condicional (sq_versao_pesquisa);

create table if not exists public.tb_condicao_regra (
  sq_condicao uuid not null default gen_random_uuid(),
  sq_regra uuid not null,
  sq_pergunta_origem uuid not null,
  tp_operador text not null,
  sq_opcao uuid,
  tx_valor text,
  nu_valor numeric(18,6),
  nu_ordem integer not null default 1,
  constraint pk_tb_condicao_regra primary key (sq_condicao),
  constraint fk_tb_condicao_regra_regra foreign key (sq_regra)
    references public.tb_regra_condicional(sq_regra) on delete cascade,
  constraint fk_tb_condicao_regra_pergunta foreign key (sq_pergunta_origem)
    references public.survey_questions(id) on delete cascade,
  constraint fk_tb_condicao_regra_opcao foreign key (sq_opcao)
    references public.question_options(id) on delete cascade,
  constraint ck_tb_condicao_regra_operador check (tp_operador in (
    'SELECTED', 'NOT_SELECTED', 'ANSWERED', 'NOT_ANSWERED',
    'EQUALS', 'NOT_EQUALS', 'GREATER_THAN', 'LESS_THAN', 'CONTAINS'
  )),
  -- Operador que compara alternativa exige a alternativa; operador que compara
  -- número exige o número. Sem isso, uma regra pela metade seria gravada e só
  -- falharia calada na hora de avaliar.
  constraint ck_tb_condicao_regra_opcao check (
    (tp_operador in ('SELECTED', 'NOT_SELECTED') and sq_opcao is not null)
    or (tp_operador not in ('SELECTED', 'NOT_SELECTED') and sq_opcao is null)
  ),
  constraint ck_tb_condicao_regra_numero check (
    (tp_operador in ('GREATER_THAN', 'LESS_THAN') and nu_valor is not null)
    or tp_operador not in ('GREATER_THAN', 'LESS_THAN')
  )
);

create index if not exists in_condicao_regra_regra
  on public.tb_condicao_regra (sq_regra);

create index if not exists in_condicao_regra_pergunta
  on public.tb_condicao_regra (sq_pergunta_origem);

alter table public.tb_regra_condicional enable row level security;
alter table public.tb_condicao_regra enable row level security;

-- Sem grant e sem política: as duas tabelas são acessíveis apenas pelas funções
-- `security definer` abaixo, que validam papel e escopo antes de qualquer coisa.
revoke all on table public.tb_regra_condicional from anon, authenticated;
revoke all on table public.tb_condicao_regra from anon, authenticated;

comment on table public.tb_regra_condicional is
  'Regra de exibição condicional de pergunta ou seção, vinculada à versão da pesquisa.';
comment on table public.tb_condicao_regra is
  'Condição individual de uma regra: pergunta de origem, operador e valor comparado.';

-- ---------------------------------------------------------------------------
-- Validação do grafo
-- ---------------------------------------------------------------------------

-- Devolve as perguntas que condicionam um alvo, já resolvendo seção → perguntas
-- da seção: esconder a seção esconde tudo que está dentro dela, então a
-- dependência é das perguntas, não da caixa que as agrupa.
create or replace function public.fc_origens_da_regra(p_alvo uuid)
returns table (sq_origem uuid)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select distinct condicao.sq_pergunta_origem
  from public.tb_regra_condicional as regra
  join public.tb_condicao_regra as condicao on condicao.sq_regra = regra.sq_regra
  where regra.st_ativo
    and (
      regra.sq_alvo = p_alvo
      or (
        regra.tp_alvo = 'SECTION'
        and exists (
          select 1
          from public.survey_questions as pergunta
          where pergunta.id = p_alvo
            and pergunta.section_id = regra.sq_alvo
        )
      )
    );
$$;

-- Percorre o grafo a partir das origens propostas e informa se alguma delas
-- chega de volta ao alvo. A busca considera as regras já gravadas mais a que
-- está sendo avaliada, porque o ciclo precisa ser barrado antes de existir.
create or replace function public.fc_regra_gera_ciclo(p_alvo uuid, p_origens uuid[])
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  with recursive alcancavel(sq_no) as (
    select unnest(coalesce(p_origens, array[]::uuid[]))
    union
    select origem.sq_origem
    from alcancavel
    cross join lateral public.fc_origens_da_regra(alcancavel.sq_no) as origem
  )
  select exists (select 1 from alcancavel where sq_no = p_alvo);
$$;

-- ---------------------------------------------------------------------------
-- Avaliação em tempo de resposta
-- ---------------------------------------------------------------------------

-- Uma condição isolada, avaliada contra as respostas já gravadas na submissão.
--
-- Origem invisível conta como não respondida: se a pergunta que condiciona esta
-- aqui está escondida, a resposta que ela porventura tenha é resíduo de um
-- caminho que o participante abandonou, e tratá-la como válida ressuscitaria o
-- ramo abandonado.
create or replace function public.fc_condicao_atendida(p_submissao uuid, p_condicao uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_condicao public.tb_condicao_regra%rowtype;
  v_resposta public.answers%rowtype;
  v_respondida boolean;
  v_selecionada boolean;
begin
  select * into v_condicao from public.tb_condicao_regra where sq_condicao = p_condicao;
  if v_condicao.sq_condicao is null then
    return false;
  end if;

  if not public.fc_pergunta_visivel(p_submissao, v_condicao.sq_pergunta_origem) then
    return v_condicao.tp_operador in ('NOT_ANSWERED', 'NOT_SELECTED');
  end if;

  select * into v_resposta
  from public.answers
  where submission_id = p_submissao and question_id = v_condicao.sq_pergunta_origem;

  v_respondida := v_resposta.id is not null and (
    num_nonnulls(
      nullif(btrim(coalesce(v_resposta.answer_text, '')), ''),
      v_resposta.answer_number::text,
      v_resposta.answer_boolean::text,
      v_resposta.answer_date::text,
      v_resposta.answer_datetime::text
    ) > 0
    or exists (select 1 from public.answer_options where answer_id = v_resposta.id)
  );

  if v_condicao.tp_operador = 'ANSWERED' then return v_respondida; end if;
  if v_condicao.tp_operador = 'NOT_ANSWERED' then return not v_respondida; end if;
  if not v_respondida then
    -- Nenhuma comparação de valor se sustenta sobre resposta ausente.
    return v_condicao.tp_operador = 'NOT_EQUALS' or v_condicao.tp_operador = 'NOT_SELECTED';
  end if;

  if v_condicao.tp_operador in ('SELECTED', 'NOT_SELECTED') then
    v_selecionada := exists (
      select 1 from public.answer_options
      where answer_id = v_resposta.id and option_id = v_condicao.sq_opcao
    );
    return case when v_condicao.tp_operador = 'SELECTED' then v_selecionada else not v_selecionada end;
  end if;

  if v_condicao.tp_operador = 'GREATER_THAN' then
    return v_resposta.answer_number is not null and v_resposta.answer_number > v_condicao.nu_valor;
  end if;
  if v_condicao.tp_operador = 'LESS_THAN' then
    return v_resposta.answer_number is not null and v_resposta.answer_number < v_condicao.nu_valor;
  end if;
  if v_condicao.tp_operador = 'CONTAINS' then
    return position(lower(coalesce(v_condicao.tx_valor, '')) in lower(coalesce(v_resposta.answer_text, ''))) > 0;
  end if;

  -- EQUALS e NOT_EQUALS comparam a representação textual do valor gravado, para
  -- que a mesma regra sirva a texto, número, data e booleano sem multiplicar
  -- operadores por tipo.
  --
  -- `trim_scale` existe aqui por causa da paridade com o avaliador do frontend:
  -- a coluna é `numeric(18,6)`, então `5::text` sai como '5.000000' e nunca
  -- casaria com o '5' que o operador digitou nem com o `String(5)` do JavaScript.
  -- Divergência entre os dois avaliadores é pior que regra que não casa: a tela
  -- mostraria uma pergunta que o banco considera escondida.
  --
  -- DATETIME é a exceção conhecida: o banco serializa com fuso
  -- ('2026-08-13 12:00:00+00') e o input `datetime-local` não. Comparação de
  -- igualdade em DATETIME não é confiável nos dois lados — use ANSWERED,
  -- GREATER_THAN ou LESS_THAN.
  v_selecionada := lower(btrim(coalesce(
    v_resposta.answer_text,
    trim_scale(v_resposta.answer_number)::text,
    v_resposta.answer_boolean::text,
    v_resposta.answer_date::text,
    v_resposta.answer_datetime::text,
    ''
  ))) = lower(btrim(coalesce(v_condicao.tx_valor, '')));
  return case when v_condicao.tp_operador = 'EQUALS' then v_selecionada else not v_selecionada end;
end;
$$;

-- Visibilidade de um alvo: sem regra ativa, visível. A recursão é segura porque
-- `fc_regra_gera_ciclo` impede que um ciclo chegue a ser gravado.
create or replace function public.fc_alvo_visivel(p_submissao uuid, p_alvo uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_regra public.tb_regra_condicional%rowtype;
  v_total integer;
  v_atendidas integer;
  v_satisfeita boolean;
begin
  select * into v_regra
  from public.tb_regra_condicional
  where sq_alvo = p_alvo and st_ativo;

  if v_regra.sq_regra is null then
    return true;
  end if;

  select count(*)::integer,
         count(*) filter (where public.fc_condicao_atendida(p_submissao, sq_condicao))::integer
  into v_total, v_atendidas
  from public.tb_condicao_regra
  where sq_regra = v_regra.sq_regra;

  -- Regra sem condição não decide nada; deixar visível é o padrão seguro.
  if v_total = 0 then
    return true;
  end if;

  v_satisfeita := case when v_regra.tp_conector = 'ALL' then v_atendidas = v_total else v_atendidas > 0 end;
  return case when v_regra.tp_acao = 'SHOW' then v_satisfeita else not v_satisfeita end;
end;
$$;

-- Pergunta visível = seção visível e regra própria satisfeita.
create or replace function public.fc_pergunta_visivel(p_submissao uuid, p_pergunta uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public
as $$
declare
  v_secao uuid;
begin
  select section_id into v_secao from public.survey_questions where id = p_pergunta;
  if v_secao is null then
    return true;
  end if;
  if not public.fc_alvo_visivel(p_submissao, v_secao) then
    return false;
  end if;
  return public.fc_alvo_visivel(p_submissao, p_pergunta);
end;
$$;

-- ---------------------------------------------------------------------------
-- Superfície administrativa
-- ---------------------------------------------------------------------------

create or replace function public.fc_salvar_regra_condicional(
  p_alvo_tipo text,
  p_alvo uuid,
  p_acao text default 'SHOW',
  p_conector text default 'ALL',
  p_condicoes jsonb default '[]'::jsonb,
  p_descricao text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_pessoa uuid := public.current_person_id();
  v_tipo text := upper(btrim(coalesce(p_alvo_tipo, '')));
  v_acao text := upper(btrim(coalesce(p_acao, 'SHOW')));
  v_conector text := upper(btrim(coalesce(p_conector, 'ALL')));
  v_versao uuid;
  v_status text;
  v_regra uuid;
  v_condicao jsonb;
  v_origens uuid[] := array[]::uuid[];
  v_origem uuid;
  v_operador text;
  v_ordem integer := 0;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;
  if v_tipo not in ('QUESTION', 'SECTION') then
    raise exception 'Informe se a regra vale para uma pergunta ou para uma seção.';
  end if;
  if v_acao not in ('SHOW', 'HIDE') then
    raise exception 'A ação da regra precisa ser SHOW ou HIDE.';
  end if;
  if v_conector not in ('ALL', 'ANY') then
    raise exception 'O conector da regra precisa ser ALL ou ANY.';
  end if;

  if v_tipo = 'QUESTION' then
    select pergunta.survey_version_id into v_versao
    from public.survey_questions as pergunta where pergunta.id = p_alvo;
  else
    select secao.survey_version_id into v_versao
    from public.survey_sections as secao where secao.id = p_alvo;
  end if;
  if v_versao is null then
    raise exception 'Pergunta ou seção não localizada.';
  end if;

  -- Regra é estrutura do instrumento: muda enquanto a versão é rascunho, como
  -- seção e pergunta. Depois de publicada, alterar a lógica mudaria o que já foi
  -- respondido por quem já respondeu.
  select status into v_status from public.survey_versions where id = v_versao;
  if v_status <> 'DRAFT' then
    raise exception 'A lógica condicional só pode ser alterada enquanto a versão está em rascunho.';
  end if;

  -- Origens propostas, validadas antes de gravar: pergunta precisa existir, ser
  -- da mesma versão e não ser o próprio alvo.
  for v_condicao in select value from jsonb_array_elements(coalesce(p_condicoes, '[]'::jsonb)) loop
    v_origem := nullif(btrim(coalesce(v_condicao->>'questionId', '')), '')::uuid;
    v_operador := upper(btrim(coalesce(v_condicao->>'operator', '')));
    if v_origem is null then
      raise exception 'Toda condição precisa apontar uma pergunta de origem.';
    end if;
    if not exists (
      select 1 from public.survey_questions
      where id = v_origem and survey_version_id = v_versao
    ) then
      raise exception 'A pergunta de origem não pertence a esta versão da avaliação.';
    end if;
    if v_origem = p_alvo then
      raise exception 'Uma pergunta não pode condicionar a si mesma.';
    end if;
    if v_operador in ('SELECTED', 'NOT_SELECTED') and not exists (
      select 1 from public.question_options
      where id = nullif(btrim(coalesce(v_condicao->>'optionId', '')), '')::uuid
        and question_id = v_origem
    ) then
      raise exception 'A alternativa comparada não pertence à pergunta de origem.';
    end if;
    v_origens := v_origens || v_origem;
  end loop;

  if public.fc_regra_gera_ciclo(p_alvo, v_origens) then
    raise exception 'Esta regra cria uma dependência circular entre as perguntas.';
  end if;

  -- Substituição em bloco: a regra vigente do alvo sai e a nova entra na mesma
  -- transação, o que mantém o índice de unicidade satisfeito sem exigir que a
  -- tela apague antes de salvar.
  delete from public.tb_regra_condicional where sq_alvo = p_alvo;

  insert into public.tb_regra_condicional (
    sq_versao_pesquisa, tp_alvo, sq_alvo, tp_acao, tp_conector, ds_regra, au_usuario_inclusao
  ) values (
    v_versao, v_tipo, p_alvo, v_acao, v_conector, nullif(btrim(coalesce(p_descricao, '')), ''), v_pessoa
  ) returning sq_regra into v_regra;

  for v_condicao in select value from jsonb_array_elements(coalesce(p_condicoes, '[]'::jsonb)) loop
    v_ordem := v_ordem + 1;
    v_operador := upper(btrim(coalesce(v_condicao->>'operator', '')));
    insert into public.tb_condicao_regra (
      sq_regra, sq_pergunta_origem, tp_operador, sq_opcao, tx_valor, nu_valor, nu_ordem
    ) values (
      v_regra,
      (v_condicao->>'questionId')::uuid,
      v_operador,
      nullif(btrim(coalesce(v_condicao->>'optionId', '')), '')::uuid,
      nullif(btrim(coalesce(v_condicao->>'value', '')), ''),
      case when v_operador in ('GREATER_THAN', 'LESS_THAN')
        then nullif(btrim(coalesce(v_condicao->>'value', '')), '')::numeric
      end,
      v_ordem
    );
  end loop;

  insert into public.audit_events (
    actor_person_id, event_type, entity_type, entity_id, after_data, metadata
  ) values (
    v_pessoa, 'SURVEY_RULE_SAVED', 'CONDITIONAL_RULE', v_regra::text,
    jsonb_build_object('target', p_alvo, 'action', v_acao, 'connector', v_conector),
    '{}'::jsonb
  );

  return jsonb_build_object('status', 'OK', 'ruleId', v_regra, 'conditions', v_ordem);
end;
$$;

create or replace function public.fc_excluir_regra_condicional(p_alvo uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_pessoa uuid := public.current_person_id();
  v_versao uuid;
  v_status text;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  select sq_versao_pesquisa into v_versao
  from public.tb_regra_condicional where sq_alvo = p_alvo;
  if v_versao is null then
    return jsonb_build_object('status', 'OK', 'removed', 0);
  end if;

  select status into v_status from public.survey_versions where id = v_versao;
  if v_status <> 'DRAFT' then
    raise exception 'A lógica condicional só pode ser alterada enquanto a versão está em rascunho.';
  end if;

  delete from public.tb_regra_condicional where sq_alvo = p_alvo;

  insert into public.audit_events (
    actor_person_id, event_type, entity_type, entity_id, after_data, metadata
  ) values (
    v_pessoa, 'SURVEY_RULE_DELETED', 'CONDITIONAL_RULE', p_alvo::text, '{}'::jsonb, '{}'::jsonb
  );

  return jsonb_build_object('status', 'OK', 'removed', 1);
end;
$$;

create or replace function public.fc_listar_regras_condicionais(p_versao uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_result jsonb;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  select coalesce(jsonb_agg(item order by item->>'targetId'), '[]'::jsonb)
  into v_result
  from (
    select jsonb_build_object(
      'ruleId', regra.sq_regra,
      'targetType', regra.tp_alvo,
      'targetId', regra.sq_alvo,
      'action', regra.tp_acao,
      'connector', regra.tp_conector,
      'description', regra.ds_regra,
      'conditions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'conditionId', condicao.sq_condicao,
          'questionId', condicao.sq_pergunta_origem,
          'operator', condicao.tp_operador,
          'optionId', condicao.sq_opcao,
          'value', coalesce(condicao.tx_valor, condicao.nu_valor::text)
        ) order by condicao.nu_ordem)
        from public.tb_condicao_regra as condicao
        where condicao.sq_regra = regra.sq_regra
      ), '[]'::jsonb)
    ) as item
    from public.tb_regra_condicional as regra
    where regra.sq_versao_pesquisa = p_versao and regra.st_ativo
  ) as regras;

  return v_result;
end;
$$;

-- Regras do ciclo, para o runtime. Devolve só o que a pessoa já podia ver: a
-- mesma checagem de acesso de `get_public_survey_form`.
create or replace function public.fc_obter_regras_do_ciclo(p_codigo_ciclo text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'targetType', regra.tp_alvo,
    'targetId', regra.sq_alvo,
    'action', regra.tp_acao,
    'connector', regra.tp_conector,
    'conditions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'questionId', condicao.sq_pergunta_origem,
        'operator', condicao.tp_operador,
        'optionId', condicao.sq_opcao,
        'value', coalesce(condicao.tx_valor, condicao.nu_valor::text)
      ) order by condicao.nu_ordem)
      from public.tb_condicao_regra as condicao
      where condicao.sq_regra = regra.sq_regra
    ), '[]'::jsonb)
  ) order by regra.sq_alvo), '[]'::jsonb)
  from public.survey_applications as aplicacao
  join public.tb_regra_condicional as regra on regra.sq_versao_pesquisa = aplicacao.survey_version_id
  where aplicacao.code = btrim(p_codigo_ciclo)
    and regra.st_ativo
    and public.can_access_application(aplicacao.id);
$$;

revoke all on function public.fc_origens_da_regra(uuid) from public, anon;
revoke all on function public.fc_regra_gera_ciclo(uuid, uuid[]) from public, anon;
revoke all on function public.fc_condicao_atendida(uuid, uuid) from public, anon;
revoke all on function public.fc_alvo_visivel(uuid, uuid) from public, anon;
revoke all on function public.fc_pergunta_visivel(uuid, uuid) from public, anon;
revoke all on function public.fc_salvar_regra_condicional(text, uuid, text, text, jsonb, text) from public, anon;
revoke all on function public.fc_excluir_regra_condicional(uuid) from public, anon;
revoke all on function public.fc_listar_regras_condicionais(uuid) from public, anon;
revoke all on function public.fc_obter_regras_do_ciclo(text) from public, anon;

grant execute on function public.fc_condicao_atendida(uuid, uuid) to authenticated;
grant execute on function public.fc_alvo_visivel(uuid, uuid) to authenticated;
grant execute on function public.fc_pergunta_visivel(uuid, uuid) to authenticated;
grant execute on function public.fc_salvar_regra_condicional(text, uuid, text, text, jsonb, text) to authenticated;
grant execute on function public.fc_excluir_regra_condicional(uuid) to authenticated;
grant execute on function public.fc_listar_regras_condicionais(uuid) to authenticated;
grant execute on function public.fc_obter_regras_do_ciclo(text) to authenticated;

-- `fc_origens_da_regra` e `fc_regra_gera_ciclo` são internas do validador e não
-- têm chamador fora deste arquivo: ficam sem `execute` para authenticated.

-- ---------------------------------------------------------------------------
-- Envio: pergunta escondida não é pergunta pendente
-- ---------------------------------------------------------------------------

-- Sem esta parte, a primeira regra criada tornaria o instrumento impossível de
-- enviar: `submit_my_survey_submission` conta como pendente toda obrigatória sem
-- resposta, inclusive a que a lógica escondeu do participante. A função é
-- redefinida com a mesma assinatura — o bundle publicado continua chamando o
-- mesmo nome — e a única mudança é o filtro de visibilidade na contagem.
create or replace function public.submit_my_survey_submission(target_submission_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,auth as $$
declare
  v_person_id uuid:=public.current_person_id();
  v_submission public.submissions%rowtype;
  v_application public.survey_applications%rowtype;
  v_missing integer;
  v_submitted_at timestamptz:=now();
begin
  if v_person_id is null then raise exception 'Usuário não identificado.'; end if;
  select * into v_submission from public.submissions where id=target_submission_id for update;
  if v_submission.id is null or v_submission.respondent_person_id is distinct from v_person_id or v_submission.status<>'DRAFT' then raise exception 'A resposta não está disponível para envio.'; end if;
  select * into v_application from public.survey_applications where id=v_submission.application_id;
  if not public.application_accepts_responses(v_application.id) then raise exception 'O período de respostas está encerrado.'; end if;

  select count(*)::integer into v_missing
  from public.survey_questions q
  where q.survey_version_id=v_application.survey_version_id and q.required
    and public.fc_pergunta_visivel(v_submission.id, q.id)
    and not exists (
      select 1 from public.answers a where a.submission_id=v_submission.id and a.question_id=q.id and (
        (q.question_type in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE') and exists(select 1 from public.answer_options ao where ao.answer_id=a.id))
        or (q.question_type in ('SHORT_TEXT','LONG_TEXT') and nullif(btrim(a.answer_text),'') is not null)
        or (q.question_type in ('INTEGER','DECIMAL') and a.answer_number is not null)
        or (q.question_type='BOOLEAN' and a.answer_boolean is not null)
        or (q.question_type='DATE' and a.answer_date is not null)
        or (q.question_type='DATETIME' and a.answer_datetime is not null)
        or (q.question_type not in ('SCALE','SINGLE_CHOICE','MULTIPLE_CHOICE','SHORT_TEXT','LONG_TEXT','INTEGER','DECIMAL','BOOLEAN','DATE','DATETIME') and num_nonnulls(a.answer_text,a.answer_number,a.answer_boolean,a.answer_date,a.answer_datetime,a.answer_json)>0)
      )
    );
  if v_missing>0 then raise exception 'Existem % pergunta(s) obrigatória(s) sem resposta.',v_missing; end if;

  update public.submissions set status='SUBMITTED',submitted_at=v_submitted_at,updated_at=v_submitted_at,metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('submitted_from','PLATFORM_WEB_GENERIC') where id=v_submission.id;
  update public.application_participants set status='COMPLETED',completed_at=v_submitted_at,updated_at=v_submitted_at where id=v_submission.participant_id;
  insert into public.audit_events(actor_person_id,event_type,entity_type,entity_id,application_id,after_data,metadata)
  values(v_person_id,'SURVEY_SUBMISSION_SUBMITTED','SUBMISSION',v_submission.id::text,v_submission.application_id,jsonb_build_object('status','SUBMITTED'),'{}'::jsonb);
  return jsonb_build_object('status','OK','submissionStatus','SUBMITTED','submittedAt',v_submitted_at);
end;
$$;

revoke all on function public.submit_my_survey_submission(uuid) from public, anon;
grant execute on function public.submit_my_survey_submission(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Rollback: a remoção das tabelas leva junto as regras gravadas. A função de
-- envio precisa voltar à definição de 20260803165000, sem o filtro de
-- visibilidade — caso contrário ela referenciaria uma função inexistente.
-- begin;
--   drop table if exists public.tb_condicao_regra;
--   drop table if exists public.tb_regra_condicional;
--   drop function if exists public.fc_pergunta_visivel(uuid, uuid);
--   drop function if exists public.fc_alvo_visivel(uuid, uuid);
--   drop function if exists public.fc_condicao_atendida(uuid, uuid);
--   drop function if exists public.fc_regra_gera_ciclo(uuid, uuid[]);
--   drop function if exists public.fc_origens_da_regra(uuid);
--   drop function if exists public.fc_salvar_regra_condicional(text, uuid, text, text, jsonb, text);
--   drop function if exists public.fc_excluir_regra_condicional(uuid);
--   drop function if exists public.fc_listar_regras_condicionais(uuid);
--   drop function if exists public.fc_obter_regras_do_ciclo(text);
--   notify pgrst, 'reload schema';
-- commit;
