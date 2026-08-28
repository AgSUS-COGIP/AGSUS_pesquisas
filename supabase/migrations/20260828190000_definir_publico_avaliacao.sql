-- Fase 1 — Definir público da avaliação.
--
-- Transforma a área de participantes de "pesquisar pessoa e vincular uma a uma"
-- em construtor de público. Seis dimensões: Diretoria, Unidade, Coordenação,
-- Centro de custo, Cargo e Pessoa.
--
-- ## Onde a regra mora
--
-- `survey_applications.settings -> 'audience'`, seguindo a convenção que
-- `settings -> 'visualIdentity'` já estabeleceu. É configuração documental do
-- ciclo: não tem identidade própria, não tem relacionamento próprio, não exige
-- integridade referencial e não é objeto de consulta relacional crítica.
-- Nenhuma tabela nova, nenhum schema novo.
--
-- O snapshot continua sendo `application_participants` e **não** é duplicado
-- dentro de `settings`: lá ficam a regra e o resumo da aplicação, nunca a lista
-- de pessoas resolvidas.
--
-- ## Elegibilidade
--
-- `people.active = true`, e só isso. A importação já normaliza as diferentes
-- situações institucionais nessa coluna, então `employment_status` não é regra
-- de negócio deste fluxo. As RPCs legadas continuam com os predicados delas —
-- convergi-las é trabalho à parte, registrado como pendência.
--
-- ## Por que prévia e aplicação não podem divergir
--
-- O critério de aceite exige que o número mostrado antes de gravar seja o número
-- gravado. Duas consultas parecidas divergem no primeiro ajuste que alguém fizer
-- em uma só. Por isso existe `fc_resolver_publico_avaliacao`: prévia e aplicação
-- **chamam a mesma função**, e a igualdade é estrutural, não combinada.
--
-- A prévia é declarada `stable`. Não é documentação: o PostgreSQL recusa
-- gravação em função não-volátil, então "prévia não muta nada" passa a ser
-- garantia do banco. Foi por isso que `list_my_survey_catalog` e as vizinhas
-- deixaram de ser `stable` quando passaram a materializar a abertura de ciclo.

begin;

-- ---------------------------------------------------------------------------
-- Normalização
-- ---------------------------------------------------------------------------

-- `unaccent_lower` já resolve caixa e acento. Falta colapsar espaço interno:
-- "Coordenação  de   Gestão" e "Coordenação de Gestão" são a mesma coordenação
-- para quem trabalha, e produção tem 141 valores distintos que caem para 138
-- quando normalizados. Igualdade bruta fragmentaria opções equivalentes na tela.
--
-- O valor original nunca é alterado na base. Isto existe só para comparar.
create or replace function sigav.fc_normalizar_rotulo(p_valor text)
returns text
language sql
stable
set search_path to 'pg_catalog', 'sigav'
as $function$
  select nullif(
    sigav.unaccent_lower(regexp_replace(btrim(coalesce(p_valor, '')), '\s+', ' ', 'g')),
    ''
  );
$function$;

-- Uma dimensão sem seleção não restringe nada — é o que torna "AND entre
-- dimensões" utilizável: quem escolhe só Cargo não precisa preencher as outras
-- quatro. Com seleção, vale `OR` entre os valores escolhidos.
create or replace function sigav.fc_dimensao_publico_atende(p_valor text, p_selecionados jsonb)
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'sigav'
as $function$
  select case
    when p_selecionados is null
      or jsonb_typeof(p_selecionados) <> 'array'
      or jsonb_array_length(p_selecionados) = 0
      then true
    else sigav.fc_normalizar_rotulo(p_valor) in (
      select sigav.fc_normalizar_rotulo(valor)
      from jsonb_array_elements_text(p_selecionados) as escolhido(valor)
    )
  end;
$function$;

-- ---------------------------------------------------------------------------
-- Resolução da regra — fonte única de verdade da Fase 1
-- ---------------------------------------------------------------------------

-- Devolve também quem foi excluído, marcado: a aplicação precisa saber quem
-- casou com a regra e foi retirado de propósito, para registrar `EXCLUDED` no
-- snapshot em vez de simplesmente não vincular. Sem esse rastro, um recálculo
-- futuro readmitiria a pessoa sem ninguém perceber.
--
-- Regra do conjunto vazio: sem `allEligible` e sem nenhum filtro preenchido, o
-- resultado por filtro é **vazio**, não "todo mundo". Fazer ausência de critério
-- significar a instituição inteira transforma um formulário em branco em 1.030
-- vínculos.
create or replace function sigav.fc_resolver_publico_avaliacao(p_regra jsonb)
returns table (sq_pessoa uuid, tp_origem text, st_excluida boolean)
language sql
stable
security definer
set search_path to 'pg_catalog', 'sigav', 'auth'
as $function$
  with regra as (
    select
      coalesce(p_regra -> 'filters', '{}'::jsonb) as filtros,
      coalesce((p_regra ->> 'allEligible')::boolean, false) as todas,
      coalesce(p_regra -> 'includePersonIds', '[]'::jsonb) as incluidas,
      coalesce(p_regra -> 'excludePersonIds', '[]'::jsonb) as excluidas
  ),
  algum_filtro as (
    select exists (
      select 1
      from regra, jsonb_each(regra.filtros) as filtro(chave, valor)
      where jsonb_typeof(filtro.valor) = 'array'
        and jsonb_array_length(filtro.valor) > 0
    ) as ha
  ),
  ids_incluidos as (
    select valor::uuid as id
    from regra, jsonb_array_elements_text(regra.incluidas) as item(valor)
  ),
  ids_excluidos as (
    select valor::uuid as id
    from regra, jsonb_array_elements_text(regra.excluidas) as item(valor)
  ),
  por_filtro as (
    select p.id
    from sigav.people p, regra r, algum_filtro af
    where p.active
      and (
        r.todas
        or (
          af.ha
          and sigav.fc_dimensao_publico_atende(p.metadata ->> 'directorate',  r.filtros -> 'directorate')
          and sigav.fc_dimensao_publico_atende(p.metadata ->> 'unit',         r.filtros -> 'unit')
          and sigav.fc_dimensao_publico_atende(p.metadata ->> 'coordination', r.filtros -> 'coordination')
          and sigav.fc_dimensao_publico_atende(p.cost_center,                 r.filtros -> 'costCenter')
          and sigav.fc_dimensao_publico_atende(p.job_title,                   r.filtros -> 'jobTitle')
        )
      )
  ),
  -- Inclusão individual é adicional ao filtro, mas não é passe livre: a
  -- elegibilidade é a mesma para todo mundo. Quem for incluído e não estiver
  -- ativo simplesmente não entra, e a prévia informa quantos foram nesse caso.
  por_inclusao as (
    select p.id
    from sigav.people p
    where p.active
      and p.id in (select id from ids_incluidos)
  ),
  reunidas as (
    select id, 'FILTRO' as origem from por_filtro
    union all
    select id, 'INCLUSAO' from por_inclusao
  )
  select
    r.id,
    -- 'FILTRO' < 'INCLUSAO' na ordenação de texto: quem casou com o filtro é
    -- reportado como tal mesmo que também tenha sido incluído à mão.
    min(r.origem),
    bool_or(r.id in (select id from ids_excluidos))
  from reunidas r
  group by r.id;
$function$;

-- ---------------------------------------------------------------------------
-- Catálogo de opções por dimensão
-- ---------------------------------------------------------------------------

-- Agrupa pelo valor normalizado e devolve como rótulo a grafia **mais
-- frequente** de cada grupo (`mode()`). Assim as variações equivalentes viram
-- uma opção só na tela, e o rótulo continua sendo texto institucional real, não
-- um valor inventado nem a versão sem acento.
create or replace function sigav.fc_listar_dimensoes_publico()
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'sigav', 'auth'
as $function$
  with pessoas as (
    select metadata, cost_center, job_title
    from sigav.people
    where active
  ),
  bruto as (
    select 'directorate' as dimensao, metadata ->> 'directorate' as valor from pessoas
    union all select 'unit',         metadata ->> 'unit'         from pessoas
    union all select 'coordination', metadata ->> 'coordination' from pessoas
    union all select 'costCenter',   cost_center                 from pessoas
    union all select 'jobTitle',     job_title                   from pessoas
  ),
  normalizado as (
    select dimensao, sigav.fc_normalizar_rotulo(valor) as chave, btrim(valor) as rotulo
    from bruto
    where sigav.fc_normalizar_rotulo(valor) is not null
  ),
  agrupado as (
    select dimensao, chave, count(*)::integer as total,
           mode() within group (order by rotulo) as rotulo
    from normalizado
    group by dimensao, chave
  ),
  por_dimensao as (
    select dimensao, jsonb_agg(
      jsonb_build_object('label', rotulo, 'count', total)
      order by rotulo
    ) as itens
    from agrupado
    group by dimensao
  )
  select case
    when not sigav.can_manage_surveys()
      then jsonb_build_object('status', 'FORBIDDEN')
    else jsonb_build_object(
      'status', 'OK',
      'dimensions', coalesce((select jsonb_object_agg(dimensao, itens) from por_dimensao), '{}'::jsonb)
    )
  end;
$function$;

-- ---------------------------------------------------------------------------
-- Prévia — leitura pura, garantida pelo `stable`
-- ---------------------------------------------------------------------------

create or replace function sigav.fc_previsualizar_publico_avaliacao(
  p_aplicacao uuid,
  p_regra jsonb,
  p_limite_amostra integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'sigav', 'auth'
as $function$
declare
  v_resultado jsonb;
begin
  if not sigav.can_manage_surveys() then
    raise exception 'Seu perfil não possui permissão para definir o público da avaliação.';
  end if;
  if not exists (select 1 from sigav.survey_applications where id = p_aplicacao) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  with resolvido as (
    select * from sigav.fc_resolver_publico_avaliacao(p_regra)
  ),
  vinculo as (
    select r.sq_pessoa, r.tp_origem, r.st_excluida, ap.status as situacao_atual
    from resolvido r
    left join sigav.application_participants ap
      on ap.application_id = p_aplicacao
     and ap.person_id = r.sq_pessoa
     and ap.participant_role = 'RESPONDENT'
  ),
  inclusoes_pedidas as (
    select valor::uuid as id
    from jsonb_array_elements_text(coalesce(p_regra -> 'includePersonIds', '[]'::jsonb)) as item(valor)
  )
  select jsonb_build_object(
    'status', 'OK',
    -- Público efetivo: já sem os excluídos. É o número que a tela mostra.
    'matchedCount', (select count(*) from vinculo where not st_excluida),
    'alreadyLinkedCount', (select count(*) from vinculo
                           where not st_excluida
                             and situacao_atual is not null
                             and situacao_atual <> 'EXCLUDED'),
    'newLinkCount', (select count(*) from vinculo
                     where not st_excluida
                       and (situacao_atual is null or situacao_atual = 'EXCLUDED')),
    'excludedCount', (select count(*) from vinculo where st_excluida),
    -- Inclusão individual de quem não está ativo: não entra, e a tela precisa
    -- dizer isso em vez de a pessoa sumir sem explicação.
    'ineligibleIncludedCount', (select count(*) from inclusoes_pedidas i
                                where not exists (select 1 from sigav.people p where p.id = i.id and p.active)),
    'sample', coalesce((
      select jsonb_agg(item order by item ->> 'fullName')
      from (
        select jsonb_build_object(
          'personId', p.id,
          'fullName', p.full_name,
          'jobTitle', p.job_title,
          'unit', p.metadata ->> 'unit',
          'directorate', p.metadata ->> 'directorate',
          'origin', v.tp_origem,
          'alreadyLinked', v.situacao_atual is not null and v.situacao_atual <> 'EXCLUDED'
        ) as item
        from vinculo v
        join sigav.people p on p.id = v.sq_pessoa
        where not v.st_excluida
        order by p.full_name
        limit greatest(coalesce(p_limite_amostra, 50), 0)
      ) amostra
    ), '[]'::jsonb)
  )
  into v_resultado;

  return v_resultado;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Aplicação — mutação explícita, uma transação só
-- ---------------------------------------------------------------------------

-- Corpo de função é atômico: 5, 500 ou 1.030 pessoas entram de uma vez ou não
-- entram. Não há fatiamento em lotes de mil, e o cliente nunca envia milhares de
-- identificadores — ele envia a regra, e o servidor a resolve.
--
-- A ordem importa: vincula primeiro, exclui por último. Exclusão sempre vence.
create or replace function sigav.fc_aplicar_publico_avaliacao(
  p_aplicacao uuid,
  p_regra jsonb,
  p_perfil_acesso text default 'PARTICIPANTE'
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'sigav', 'auth'
as $function$
declare
  v_ator uuid := sigav.current_person_id();
  v_vinculadas integer := 0;
  v_reativadas integer := 0;
  v_mantidas integer := 0;
  v_excluidas integer := 0;
  v_regra_gravada jsonb;
begin
  if not sigav.can_manage_surveys() then
    raise exception 'Seu perfil não possui permissão para definir o público da avaliação.';
  end if;
  if not exists (select 1 from sigav.survey_applications where id = p_aplicacao) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  create temporary table tmp_publico_resolvido on commit drop as
  select r.sq_pessoa, r.tp_origem, r.st_excluida, ap.status as situacao_anterior
  from sigav.fc_resolver_publico_avaliacao(p_regra) r
  left join sigav.application_participants ap
    on ap.application_id = p_aplicacao
   and ap.person_id = r.sq_pessoa
   and ap.participant_role = 'RESPONDENT';

  select
    count(*) filter (where not st_excluida and situacao_anterior is null),
    count(*) filter (where not st_excluida and situacao_anterior = 'EXCLUDED'),
    count(*) filter (where not st_excluida and situacao_anterior is not null and situacao_anterior <> 'EXCLUDED'),
    count(*) filter (where st_excluida)
  into v_vinculadas, v_reativadas, v_mantidas, v_excluidas
  from tmp_publico_resolvido;

  -- 1. Materializa quem entra.
  insert into sigav.application_participants(
    application_id, person_id, participant_role, status, access_profile, invited_at, metadata
  )
  select
    p_aplicacao,
    sq_pessoa,
    'RESPONDENT',
    'ELIGIBLE',
    nullif(btrim(p_perfil_acesso), ''),
    timezone('utc', now()),
    jsonb_build_object(
      'assigned_by', v_ator,
      'assigned_at', timezone('utc', now()),
      'source', 'ADMIN_AUDIENCE_BUILDER',
      'origin', tp_origem
    )
  from tmp_publico_resolvido
  where not st_excluida
  on conflict (application_id, person_id, participant_role) do update
    set status = 'ELIGIBLE',
        access_profile = coalesce(nullif(btrim(excluded.access_profile), ''), sigav.application_participants.access_profile),
        invited_at = coalesce(sigav.application_participants.invited_at, excluded.invited_at),
        metadata = coalesce(sigav.application_participants.metadata, '{}'::jsonb) || excluded.metadata,
        updated_at = timezone('utc', now());

  -- 2. Exclusões por último, e só para quem casou com a regra. Marcar
  -- `EXCLUDED` em vez de não vincular preserva o rastro da decisão: a pessoa
  -- entrou no critério e foi retirada de propósito. Sem isso, um recálculo
  -- futuro a readmitiria em silêncio.
  insert into sigav.application_participants(
    application_id, person_id, participant_role, status, access_profile, metadata
  )
  select
    p_aplicacao,
    sq_pessoa,
    'RESPONDENT',
    'EXCLUDED',
    nullif(btrim(p_perfil_acesso), ''),
    jsonb_build_object(
      'excluded_by', v_ator,
      'excluded_at', timezone('utc', now()),
      'source', 'ADMIN_AUDIENCE_BUILDER'
    )
  from tmp_publico_resolvido
  where st_excluida
  on conflict (application_id, person_id, participant_role) do update
    set status = 'EXCLUDED',
        metadata = coalesce(sigav.application_participants.metadata, '{}'::jsonb) || excluded.metadata,
        updated_at = timezone('utc', now());

  -- 3. Persiste a regra. Só a regra e o resumo — a lista de pessoas resolvidas
  -- vive em `application_participants` e não é duplicada aqui.
  v_regra_gravada := jsonb_build_object(
    'version', 1,
    'filters', coalesce(p_regra -> 'filters', '{}'::jsonb),
    'allEligible', coalesce((p_regra ->> 'allEligible')::boolean, false),
    'includePersonIds', coalesce(p_regra -> 'includePersonIds', '[]'::jsonb),
    'excludePersonIds', coalesce(p_regra -> 'excludePersonIds', '[]'::jsonb),
    'appliedAt', timezone('utc', now()),
    'appliedBy', v_ator,
    'resultCount', v_vinculadas + v_reativadas + v_mantidas
  );

  update sigav.survey_applications
  set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('audience', v_regra_gravada),
      updated_at = timezone('utc', now())
  where id = p_aplicacao;

  -- 4. Auditoria pelo mecanismo existente. A regra inteira entra em `after_data`
  -- para que a decisão seja reconstruível depois — é o que o critério de
  -- recuperabilidade pede.
  insert into sigav.audit_events(
    actor_person_id, event_type, entity_type, entity_id, application_id, after_data, metadata
  ) values (
    v_ator,
    'APPLICATION_AUDIENCE_APPLIED',
    'SURVEY_APPLICATION',
    p_aplicacao::text,
    p_aplicacao,
    v_regra_gravada,
    jsonb_build_object(
      'source', 'ADMIN_AUDIENCE_BUILDER',
      'assignedCount', v_vinculadas,
      'reactivatedCount', v_reativadas,
      'keptCount', v_mantidas,
      'excludedCount', v_excluidas
    )
  );

  return jsonb_build_object(
    'status', 'OK',
    'assignedCount', v_vinculadas,
    'reactivatedCount', v_reativadas,
    'keptCount', v_mantidas,
    'excludedCount', v_excluidas,
    'audience', v_regra_gravada
  );
end;
$function$;

-- ---------------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------------

revoke all on function sigav.fc_normalizar_rotulo(text) from public, anon;
revoke all on function sigav.fc_dimensao_publico_atende(text, jsonb) from public, anon;
revoke all on function sigav.fc_resolver_publico_avaliacao(jsonb) from public, anon;
revoke all on function sigav.fc_listar_dimensoes_publico() from public, anon;
revoke all on function sigav.fc_previsualizar_publico_avaliacao(uuid, jsonb, integer) from public, anon;
revoke all on function sigav.fc_aplicar_publico_avaliacao(uuid, jsonb, text) from public, anon;

grant execute on function sigav.fc_listar_dimensoes_publico() to authenticated;
grant execute on function sigav.fc_previsualizar_publico_avaliacao(uuid, jsonb, integer) to authenticated;
grant execute on function sigav.fc_aplicar_publico_avaliacao(uuid, jsonb, text) to authenticated;

-- Os três helpers não recebem grant: são chamados de dentro de funções
-- `security definer`, que executam como o dono e dispensam `execute` de quem
-- chamou. Mesmo desenho de `fc_abrir_ciclos_agendados`.

comment on function sigav.fc_resolver_publico_avaliacao(jsonb) is
  'Resolve a regra de público em pessoas. Fonte única consumida pela prévia e pela aplicação, para que o número mostrado seja o número gravado. Elegibilidade: people.active.';

comment on function sigav.fc_previsualizar_publico_avaliacao(uuid, jsonb, integer) is
  'Prévia do público. Declarada stable de propósito: o PostgreSQL recusa gravação em função não-volátil, então a leitura pura é garantia do banco.';

comment on function sigav.fc_aplicar_publico_avaliacao(uuid, jsonb, text) is
  'Materializa o público em application_participants numa única transação, aplica exclusões por último, grava a regra em settings.audience e audita em APPLICATION_AUDIENCE_APPLIED.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists sigav.fc_aplicar_publico_avaliacao(uuid, jsonb, text);
--   drop function if exists sigav.fc_previsualizar_publico_avaliacao(uuid, jsonb, integer);
--   drop function if exists sigav.fc_listar_dimensoes_publico();
--   drop function if exists sigav.fc_resolver_publico_avaliacao(jsonb);
--   drop function if exists sigav.fc_dimensao_publico_atende(text, jsonb);
--   drop function if exists sigav.fc_normalizar_rotulo(text);
--   notify pgrst, 'reload schema';
-- commit;
