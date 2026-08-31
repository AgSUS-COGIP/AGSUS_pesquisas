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
-- Validação da regra
-- ---------------------------------------------------------------------------

-- Sem isto, `{"filters":{"foo":["bar"]}}` selecionava a instituição inteira.
--
-- O mecanismo: "existe algum filtro preenchido?" olhava qualquer chave de
-- `filters`, então uma chave desconhecida ligava a busca por filtro. Mas os
-- predicados só conhecem cinco dimensões, e dimensão ausente "não restringe" —
-- por boa razão, é o que permite filtrar só por Cargo sem preencher as outras
-- quatro. Juntas, as duas decisões corretas produziam o resultado errado: busca
-- ligada, nenhuma restrição, todas as pessoas ativas.
--
-- Isso furava a garantia de que só `allEligible` representa a instituição
-- inteira — e o furo era silencioso, porque `foo` não pertence a nenhum lugar e
-- ninguém erraria de propósito. Erro de digitação numa integração bastaria.
--
-- A validação vive no banco, não no TypeScript: a RPC é a fronteira, e o cliente
-- não é o único caminho até ela.
create or replace function sigav.fc_validar_regra_publico(p_regra jsonb)
returns void
language plpgsql
immutable
set search_path to 'pg_catalog', 'sigav'
as $function$
declare
  v_dimensoes constant text[] := array['directorate', 'unit', 'coordination', 'costCenter', 'jobTitle'];
  v_chave text;
  v_lista text;
begin
  if p_regra is null or jsonb_typeof(p_regra) <> 'object' then
    raise exception 'Regra de público inválida: era esperado um objeto.';
  end if;

  if p_regra ? 'filters' then
    if jsonb_typeof(p_regra -> 'filters') <> 'object' then
      raise exception 'Regra de público inválida: "filters" precisa ser um objeto de dimensões.';
    end if;

    for v_chave in select jsonb_object_keys(p_regra -> 'filters') loop
      if not (v_chave = any (v_dimensoes)) then
        raise exception 'Regra de público inválida: dimensão desconhecida "%". Dimensões aceitas: %.',
          v_chave, array_to_string(v_dimensoes, ', ');
      end if;
      if jsonb_typeof(p_regra -> 'filters' -> v_chave) <> 'array' then
        raise exception 'Regra de público inválida: a dimensão "%" precisa ser uma lista de valores.', v_chave;
      end if;
    end loop;
  end if;

  if p_regra ? 'allEligible' and jsonb_typeof(p_regra -> 'allEligible') <> 'boolean' then
    raise exception 'Regra de público inválida: "allEligible" precisa ser verdadeiro ou falso.';
  end if;

  -- Listas de pessoas: array de identificadores. Sem esta checagem, o `::uuid`
  -- lá adiante devolveria erro de conversão, que não diz a quem opera o que
  -- fazer a respeito.
  foreach v_lista in array array['includePersonIds', 'excludePersonIds'] loop
    if p_regra ? v_lista then
      if jsonb_typeof(p_regra -> v_lista) <> 'array' then
        raise exception 'Regra de público inválida: "%" precisa ser uma lista de identificadores.', v_lista;
      end if;
      if exists (
        select 1
        from jsonb_array_elements(p_regra -> v_lista) as item(valor)
        where jsonb_typeof(item.valor) <> 'string'
           or item.valor #>> '{}' !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
      ) then
        raise exception 'Regra de público inválida: "%" contém identificador que não é um UUID.', v_lista;
      end if;
    end if;
  end loop;
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
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'sigav', 'auth'
as $function$
begin
  -- Antes de qualquer leitura. Regra malformada não deve produzir resultado
  -- nenhum — e muito menos um resultado grande, que é o modo de falhar que
  -- passa despercebido. Como prévia, plano e aplicação descem por aqui, validar
  -- neste ponto cobre os três de uma vez.
  perform sigav.fc_validar_regra_publico(p_regra);

  return query
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
end;
$function$;

-- ---------------------------------------------------------------------------
-- Plano de transição — o que acontece com cada pessoa
-- ---------------------------------------------------------------------------

-- Resolver a regra diz *quem* o critério alcança. Isto diz *o que fazer* com
-- cada pessoa, considerando o snapshot que já existe. São perguntas diferentes,
-- e a segunda é onde mora o risco: aplicar uma regra não pode desfazer trabalho
-- nem apagar decisão administrativa.
--
-- Prévia e aplicação chamam esta função. Se cada uma tivesse a sua tabela de
-- decisão, o número mostrado deixaria de descrever o efeito no primeiro ajuste
-- feito em uma só — que é o mesmo motivo de `fc_resolver_publico_avaliacao`
-- existir.
--
-- ## As regras, e por que cada uma
--
--   nova pessoa que casa            -> ELIGIBLE
--   ELIGIBLE / INVITED que casa     -> preserva
--       INVITED registra que o convite saiu. Rebaixar para ELIGIBLE apagaria
--       esse fato e faria a pessoa parecer nunca avisada.
--   IN_PROGRESS / COMPLETED         -> preserva, casando ou não
--       Trabalho feito não é revogável por mudança de critério. Quem já
--       respondeu continua no ciclo mesmo que a regra nova não o alcance.
--   BLOCKED que casa                -> preserva
--       Bloqueio é ato administrativo deliberado sobre aquela pessoa, feito na
--       tela de gestão. Uma regra de público reaplicada não pode levantá-lo sem
--       ninguém pedir. `can_access_application` e o runtime já barram BLOCKED.
--   EXCLUDED que casa e não está
--   em excludePersonIds             -> ELIGIBLE (reativa)
--       EXCLUDED significa "fora do público", e a regra nova diz que está
--       dentro. Reativar aqui é obedecer à regra, não ignorá-la.
--   qualquer um em excludePersonIds -> EXCLUDED
--       Exclusão explícita vence tudo, por último.
--   ELIGIBLE / INVITED que deixou
--   de casar                        -> EXCLUDED
--       Sem isto, trocar Diretoria A por Diretoria B deixaria A+B no público
--       enquanto `settings.audience` registra só B. O snapshot precisa
--       corresponder à regra aplicada.
--
-- Nada é apagado: `EXCLUDED` conserva a linha, o histórico e as respostas.
create or replace function sigav.fc_planejar_publico_avaliacao(
  p_aplicacao uuid,
  p_regra jsonb
)
returns table (
  sq_pessoa uuid,
  st_casa boolean,
  st_excluida boolean,
  tp_situacao text,
  tp_situacao_nova text
)
language sql
stable
security definer
set search_path to 'pg_catalog', 'sigav', 'auth'
as $function$
  with resolvido as (
    select * from sigav.fc_resolver_publico_avaliacao(p_regra)
  ),
  vinculo_atual as (
    select person_id, status
    from sigav.application_participants
    where application_id = p_aplicacao
      and participant_role = 'RESPONDENT'
  ),
  -- `full outer join` porque as duas pontas importam: quem a regra alcança e
  -- ainda não está vinculado, e quem está vinculado e a regra deixou de
  -- alcançar. Um `left join` só enxergaria a primeira.
  combinado as (
    select
      coalesce(r.sq_pessoa, v.person_id) as pessoa,
      r.sq_pessoa is not null as casa,
      coalesce(r.st_excluida, false) as excluida,
      v.status as situacao
    from resolvido r
    full outer join vinculo_atual v on v.person_id = r.sq_pessoa
  )
  select
    pessoa,
    casa,
    excluida,
    situacao,
    case
      -- BLOCKED antes de tudo, **inclusive antes da exclusão explícita**.
      --
      -- Com a exclusão vindo primeiro, existia um caminho de dois passos que
      -- levantava o bloqueio sem ninguém pedir: bloquear a pessoa, excluí-la
      -- pela regra (BLOCKED -> EXCLUDED) e reaplicar sem a exclusão
      -- (EXCLUDED -> ELIGIBLE). O construtor de público desfazia uma sanção
      -- administrativa por um caminho que não se anuncia em lugar nenhum.
      --
      -- A exclusão continua registrada na regra e na auditoria; ela só não
      -- apaga o estado mais forte. Para liberar, usa-se a gestão do público
      -- vinculado, que é onde o bloqueio foi criado.
      when situacao = 'BLOCKED' then 'BLOCKED'
      -- Exclusão explícita vence o resto.
      when excluida then 'EXCLUDED'
      -- Progresso é intocável, casando ou não.
      when situacao in ('IN_PROGRESS', 'COMPLETED') then situacao
      when casa then
        case
          when situacao is null then 'ELIGIBLE'
          when situacao = 'EXCLUDED' then 'ELIGIBLE'
          else situacao
        end
      -- Deixou de casar e não tem progresso: sai do público.
      when situacao in ('ELIGIBLE', 'INVITED') then 'EXCLUDED'
      else situacao
    end
  from combinado;
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
-- Busca de pessoa, para inclusão e exclusão individual
-- ---------------------------------------------------------------------------

-- `search_admin_people_for_application` já busca pessoas, mas **não serve
-- aqui**: ela exige `active and employment_status = 'ATIVO'`, enquanto a
-- elegibilidade desta fase é `active` e só. Reusá-la deixaria invisível no
-- seletor justamente quem a regra considera elegível — a pessoa não apareceria
-- na busca, mas entraria pelo filtro, e ninguém entenderia por quê.
--
-- Duas telas com dois conjuntos elegíveis diferentes é o tipo de divergência que
-- já custou uma reconciliação neste repositório. Enquanto os predicados legados
-- não convergirem, esta busca usa o desta fase.
create or replace function sigav.fc_buscar_pessoas_publico(
  p_busca text default null,
  p_limite integer default 20
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'sigav', 'auth'
as $function$
  with termo as (
    select sigav.fc_normalizar_rotulo(p_busca) as valor
  ),
  encontradas as (
    select p.id, p.full_name, p.employee_number, p.job_title,
           p.metadata ->> 'unit' as unidade,
           p.metadata ->> 'directorate' as diretoria
    from sigav.people p, termo t
    where p.active
      and (
        t.valor is null
        or sigav.fc_normalizar_rotulo(p.full_name) like '%' || t.valor || '%'
        or sigav.fc_normalizar_rotulo(p.employee_number) like '%' || t.valor || '%'
        or sigav.fc_normalizar_rotulo(p.institutional_email) like '%' || t.valor || '%'
        -- Cargo também: "assessor" é a forma mais natural de achar um grupo de
        -- pessoas para incluir de uma vez, e sem isso a única saída seria o
        -- filtro de dimensão — que resolve outro problema, o de compor a regra.
        or sigav.fc_normalizar_rotulo(p.job_title) like '%' || t.valor || '%'
      )
    order by p.full_name
    -- Teto rígido: a lista é um seletor, não um relatório. `least` impede que
    -- um parâmetro grande transforme a busca em varredura da base inteira.
    limit least(greatest(coalesce(p_limite, 20), 1), 50)
  )
  select case
    when not sigav.can_manage_surveys()
      then jsonb_build_object('status', 'FORBIDDEN')
    else jsonb_build_object(
      'status', 'OK',
      'people', coalesce((
        select jsonb_agg(jsonb_build_object(
          'personId', id,
          'fullName', full_name,
          'employeeNumber', employee_number,
          'jobTitle', job_title,
          'unit', unidade,
          'directorate', diretoria
        ) order by full_name)
        from encontradas
      ), '[]'::jsonb)
    )
  end;
$function$;

-- ---------------------------------------------------------------------------
-- Prévia — leitura pura, garantida pelo `stable`
-- ---------------------------------------------------------------------------


-- ---------------------------------------------------------------------------
-- Prévia — leitura pura, garantida pelo `stable`
-- ---------------------------------------------------------------------------

-- A prévia descreve o **efeito da aplicação**, não só o alcance do critério.
-- Um número que diz "284 pessoas" sem contar que 12 delas continuam bloqueadas
-- e 30 vão sair do público descreve outra operação que não a que vai acontecer.
--
-- Daí os dois totais:
--   `matchedCount`   — quem o critério alcança, já sem as exclusões explícitas;
--   `effectiveCount` — quantas pessoas ficam com acesso depois de aplicar.
--
-- Eles diferem quando há bloqueio administrativo (casa mas segue barrado) ou
-- progresso preservado (não casa mais, mas já começou e permanece).
-- `effectiveCount` é o que precisa bater com o snapshot.
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

  with plano as (
    select * from sigav.fc_planejar_publico_avaliacao(p_aplicacao, p_regra)
  ),
  inclusoes_pedidas as (
    select valor::uuid as id
    from jsonb_array_elements_text(coalesce(p_regra -> 'includePersonIds', '[]'::jsonb)) as item(valor)
  )
  select jsonb_build_object(
    'status', 'OK',
    'matchedCount', (select count(*) from plano where st_casa and not st_excluida),
    -- O total que o snapshot terá com acesso. É este que os testes comparam
    -- com a contagem real depois de aplicar.
    'effectiveCount', (select count(*) from plano where tp_situacao_nova not in ('BLOCKED', 'EXCLUDED')),
    'newLinkCount', (select count(*) from plano where tp_situacao is null and tp_situacao_nova = 'ELIGIBLE'),
    'reactivatedCount', (select count(*) from plano where tp_situacao = 'EXCLUDED' and tp_situacao_nova = 'ELIGIBLE'),
    'keptCount', (select count(*) from plano
                  where tp_situacao is not null
                    and tp_situacao = tp_situacao_nova
                    and tp_situacao_nova not in ('BLOCKED', 'EXCLUDED')),
    -- Exclusões que de fato tomaram efeito. Quem estava bloqueado e foi
    -- excluído continua bloqueado, então não conta como exclusão.
    'excludedCount', (select count(*) from plano where st_excluida and tp_situacao_nova = 'EXCLUDED'),
    -- Quem sai do público por ter deixado de casar com a regra. Sem este
    -- número, reduzir um público pareceria não fazer nada.
    'removedCount', (select count(*) from plano
                     where not st_casa
                       and tp_situacao in ('ELIGIBLE', 'INVITED')
                       and tp_situacao_nova = 'EXCLUDED'),
    -- Quem já começou ou concluiu e não casa mais: permanece, de propósito.
    'retainedWithProgressCount', (select count(*) from plano
                                  where not st_casa
                                    and tp_situacao in ('IN_PROGRESS', 'COMPLETED')),
    -- Casa com a regra mas segue bloqueado por decisão administrativa.
    'blockedKeptCount', (select count(*) from plano
                         where st_casa and tp_situacao_nova = 'BLOCKED'),
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
          'currentStatus', pl.tp_situacao,
          'nextStatus', pl.tp_situacao_nova,
          'alreadyLinked', pl.tp_situacao is not null
        ) as item
        from plano pl
        join sigav.people p on p.id = pl.sq_pessoa
        where pl.tp_situacao_nova not in ('BLOCKED', 'EXCLUDED')
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
-- ## Reconciliação, não só adição
--
-- Aplicar uma regra é substituir o público, não somar ao anterior. Sem isso,
-- trocar Diretoria A por Diretoria B deixaria A+B vinculados enquanto
-- `settings.audience` registraria só B — o snapshot deixaria de descrever a
-- regra, e ninguém teria como notar.
--
-- Quem deixou de casar sai por `EXCLUDED`, que preserva a linha, o histórico e
-- as respostas. Nada é apagado. Quem já começou ou concluiu **permanece**:
-- trabalho feito não é revogável por mudança de critério.
--
-- ## Uma transação, uma passagem
--
-- O plano é calculado uma vez e alimenta gravação e contagem no mesmo comando.
-- CTE que modifica dados executa integralmente ainda que a consulta principal
-- não leia o retorno dela, então `gravados` roda e as contagens saem de `plano`
-- sem precisar de tabela temporária nem de recalcular a regra.
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
  v_novos integer := 0;
  v_reativados integer := 0;
  v_mantidos integer := 0;
  v_excluidos integer := 0;
  v_removidos integer := 0;
  v_preservados integer := 0;
  v_bloqueados integer := 0;
  v_efetivo integer := 0;
  v_regra_gravada jsonb;
begin
  if not sigav.can_manage_surveys() then
    raise exception 'Seu perfil não possui permissão para definir o público da avaliação.';
  end if;
  if not exists (select 1 from sigav.survey_applications where id = p_aplicacao) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  with plano as (
    select * from sigav.fc_planejar_publico_avaliacao(p_aplicacao, p_regra)
  ),
  gravados as (
    insert into sigav.application_participants(
      application_id, person_id, participant_role, status, access_profile, invited_at, metadata
    )
    select
      p_aplicacao,
      pl.sq_pessoa,
      'RESPONDENT',
      pl.tp_situacao_nova,
      nullif(btrim(p_perfil_acesso), ''),
      -- Só quem entra no público ganha `invited_at`. Marcar a data em quem está
      -- saindo registraria um convite que não houve.
      case when pl.tp_situacao_nova = 'ELIGIBLE' then timezone('utc', now()) end,
      -- A razão fica no registro: "excluída de propósito" e "deixou de casar
      -- com a regra" produzem o mesmo estado e são decisões diferentes.
      case
        when pl.st_excluida then jsonb_build_object(
          'excluded_by', v_ator,
          'excluded_at', timezone('utc', now()),
          'source', 'ADMIN_AUDIENCE_BUILDER',
          'reason', 'explicit_exclusion'
        )
        when pl.tp_situacao_nova = 'EXCLUDED' then jsonb_build_object(
          'removed_by', v_ator,
          'removed_at', timezone('utc', now()),
          'source', 'ADMIN_AUDIENCE_BUILDER',
          'reason', 'rule_no_longer_matches'
        )
        else jsonb_build_object(
          'assigned_by', v_ator,
          'assigned_at', timezone('utc', now()),
          'source', 'ADMIN_AUDIENCE_BUILDER',
          'origin', pl.st_casa
        )
      end
    from plano pl
    -- Só o que muda é gravado. Sem este filtro, reaplicar a mesma regra
    -- carimbaria `updated_at` na tabela inteira sem nada ter mudado.
    where pl.tp_situacao is distinct from pl.tp_situacao_nova
    on conflict (application_id, person_id, participant_role) do update
      set status = excluded.status,
          -- O existente vem primeiro. `p_perfil_acesso` é o padrão para vínculo
          -- **novo**; usá-lo aqui reclassificaria quem já tem perfil próprio —
          -- reaplicar a regra rebaixaria a pessoa ao padrão sem ninguém pedir.
          access_profile = coalesce(sigav.application_participants.access_profile, excluded.access_profile),
          invited_at = coalesce(sigav.application_participants.invited_at, excluded.invited_at),
          metadata = coalesce(sigav.application_participants.metadata, '{}'::jsonb) || excluded.metadata,
          updated_at = timezone('utc', now())
    returning 1
  )
  select
    count(*) filter (where tp_situacao is null and tp_situacao_nova = 'ELIGIBLE'),
    count(*) filter (where tp_situacao = 'EXCLUDED' and tp_situacao_nova = 'ELIGIBLE'),
    count(*) filter (where tp_situacao is not null
                       and tp_situacao = tp_situacao_nova
                       and tp_situacao_nova not in ('BLOCKED', 'EXCLUDED')),
    count(*) filter (where st_excluida and tp_situacao_nova = 'EXCLUDED'),
    count(*) filter (where not st_casa
                       and tp_situacao in ('ELIGIBLE', 'INVITED')
                       and tp_situacao_nova = 'EXCLUDED'),
    count(*) filter (where not st_casa and tp_situacao in ('IN_PROGRESS', 'COMPLETED')),
    count(*) filter (where st_casa and tp_situacao_nova = 'BLOCKED'),
    count(*) filter (where tp_situacao_nova not in ('BLOCKED', 'EXCLUDED'))
  into v_novos, v_reativados, v_mantidos, v_excluidos, v_removidos, v_preservados, v_bloqueados, v_efetivo
  from plano;

  -- Persiste a regra. Só a regra e o resumo — a lista de pessoas resolvidas
  -- vive em `application_participants` e não é duplicada aqui.
  v_regra_gravada := jsonb_build_object(
    'version', 1,
    'filters', coalesce(p_regra -> 'filters', '{}'::jsonb),
    'allEligible', coalesce((p_regra ->> 'allEligible')::boolean, false),
    'includePersonIds', coalesce(p_regra -> 'includePersonIds', '[]'::jsonb),
    'excludePersonIds', coalesce(p_regra -> 'excludePersonIds', '[]'::jsonb),
    'appliedAt', timezone('utc', now()),
    'appliedBy', v_ator,
    'resultCount', v_efetivo
  );

  update sigav.survey_applications
  set settings = coalesce(settings, '{}'::jsonb) || jsonb_build_object('audience', v_regra_gravada),
      updated_at = timezone('utc', now())
  where id = p_aplicacao;

  -- Auditoria pelo mecanismo existente. A regra inteira entra em `after_data`
  -- para que a decisão seja reconstruível depois, e os números da transição vão
  -- em `metadata` — inclusive os que descrevem o que **não** foi mexido.
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
      'assignedCount', v_novos,
      'reactivatedCount', v_reativados,
      'keptCount', v_mantidos,
      'excludedCount', v_excluidos,
      'removedCount', v_removidos,
      'retainedWithProgressCount', v_preservados,
      'blockedKeptCount', v_bloqueados,
      'effectiveCount', v_efetivo
    )
  );

  return jsonb_build_object(
    'status', 'OK',
    'assignedCount', v_novos,
    'reactivatedCount', v_reativados,
    'keptCount', v_mantidos,
    'excludedCount', v_excluidos,
    'removedCount', v_removidos,
    'retainedWithProgressCount', v_preservados,
    'blockedKeptCount', v_bloqueados,
    'effectiveCount', v_efetivo,
    'audience', v_regra_gravada
  );
end;
$function$;
-- ---------------------------------------------------------------------------
-- Privilégios
-- ---------------------------------------------------------------------------

revoke all on function sigav.fc_normalizar_rotulo(text) from public;
revoke all on function sigav.fc_validar_regra_publico(jsonb) from public;
revoke all on function sigav.fc_dimensao_publico_atende(text, jsonb) from public;
revoke all on function sigav.fc_resolver_publico_avaliacao(jsonb) from public;
revoke all on function sigav.fc_planejar_publico_avaliacao(uuid, jsonb) from public;
revoke all on function sigav.fc_listar_dimensoes_publico() from public;
revoke all on function sigav.fc_buscar_pessoas_publico(text, integer) from public;
revoke all on function sigav.fc_previsualizar_publico_avaliacao(uuid, jsonb, integer) from public;
revoke all on function sigav.fc_aplicar_publico_avaliacao(uuid, jsonb, text) from public;

-- NOTA DE MERGE (31/08/2026): os `grant execute ... to authenticated` que
-- acompanhavam este bloco foram removidos ao integrar esta migration na branch
-- do schema único. As roles do contrato PostgREST saíram do cluster em
-- 20260828140000_remover_roles_legadas_do_cluster.sql, e nomeá-las aqui faria a
-- migration falhar com "role does not exist". Quem executa é a dona das funções
-- (por posse) e, onde a credencial de runtime é separada, a `app_user` recebe
-- EXECUTE pelos default privileges. O `revoke ... from public` continua: PUBLIC
-- não é role, é a ausência de restrição.


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
--   drop function if exists sigav.fc_buscar_pessoas_publico(text, integer);
--   drop function if exists sigav.fc_listar_dimensoes_publico();
--   drop function if exists sigav.fc_planejar_publico_avaliacao(uuid, jsonb);
--   drop function if exists sigav.fc_resolver_publico_avaliacao(jsonb);
--   drop function if exists sigav.fc_validar_regra_publico(jsonb);
--   drop function if exists sigav.fc_dimensao_publico_atende(text, jsonb);
--   drop function if exists sigav.fc_normalizar_rotulo(text);
--   notify pgrst, 'reload schema';
-- commit;
