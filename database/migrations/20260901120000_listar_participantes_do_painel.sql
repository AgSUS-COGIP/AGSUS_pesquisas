begin;

-- ---------------------------------------------------------------------------
-- Lista operacional de participantes do painel
-- ---------------------------------------------------------------------------
--
-- O painel respondia "quantos" e nunca "quem". Para operar um ciclo — cobrar
-- quem não começou, saber se a pendência está concentrada numa unidade — é
-- preciso a lista, e ela precisa de recorte e de página.
--
-- ## Por que uma função nova, e não um campo a mais no painel
--
-- `fc_obter_painel_pesquisa` tem 260 linhas e devolve o instrumento inteiro num
-- único JSON. Acrescentar ali uma lista paginada significaria recalcular tudo a
-- cada troca de página, e redefinir a função inteira para isso.
--
-- Redefini-la seria arriscado por um motivo concreto: a definição em arquivo,
-- de `20260814120000`, ainda diz `can_manage_surveys()`. Quem trocou o guard
-- foi `20260827131000_autorizar_gestor_paineis.sql`, reescrevendo a função
-- **viva** com `pg_get_functiondef`. Um `create or replace` copiado do arquivo
-- reintroduziria o guard antigo e tiraria o Gestor dos Painéis outra vez, sem
-- que nada acusasse.
--
-- Função separada evita os dois problemas e ainda deixa a paginação barata.
--
-- ## Anonimato: por que esta lista é segura por construção
--
-- Ela lê `application_participants` e `people`. Não toca em `submissions` nem
-- em `answers`.
--
-- Isso importa porque o anonimato aqui é estrutural: numa submissão anônima,
-- `participant_id`, `respondent_person_id` e `subject_person_id` são **todos
-- nulos**, e a ponte pessoa↔submissão vive em `tb_bilhete_anonimo`, que tem RLS
-- permitindo apenas `sq_pessoa = current_person_id()` — ninguém lê o bilhete
-- alheio.
--
-- Ou seja: dizer que fulano respondeu não revela o que ele respondeu, porque
-- não existe caminho de leitura entre as duas coisas. É exatamente a distinção
-- que o requisito pede — acompanhamento operacional sim, vínculo entre
-- identidade e resposta não.
--
-- ## Filtros: os mesmos do público, de propósito
--
-- As dimensões organizacionais reusam `sigav.fc_dimensao_publico_atende`, a
-- mesma função que resolve a regra de público. Assim "Diretoria de Operações"
-- no filtro do painel e na definição do público significam o mesmo conjunto de
-- pessoas — por construção, e não por coincidência de duas implementações.

-- Valores distintos de uma dimensão entre os participantes de um ciclo.
--
-- Existe para que a lista de opções do filtro venha do próprio ciclo, e não do
-- catálogo institucional inteiro — opção que não tem ninguém neste ciclo é
-- clique que devolve lista vazia. `stable` permite ao planejador reaproveitar o
-- resultado dentro da mesma consulta, já que ela é chamada cinco vezes.
create or replace function sigav.fc_valores_de_dimensao(
  p_aplicacao uuid,
  p_dimensao text
)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, sigav
as $function$
  /*
    Agrupa pela forma normalizada e exibe uma grafia canônica.

    Sem isso, "Coord de Gestão" e "COORD DE GESTAO" apareceriam como duas
    opções, enquanto o filtro — que normaliza, porque reusa
    `fc_dimensao_publico_atende` — devolveria as mesmas pessoas para as duas.
    Duas entradas na lista com resultado idêntico é a interface dizendo que há
    uma diferença que não existe.

    ## Por que não `mode()`

    `mode() within group` devolve o valor mais frequente, mas **não define qual
    vence no empate** — o resultado depende da ordem em que o planejador leu as
    linhas. Duas grafias com a mesma contagem fariam a opção alternar entre
    execuções, e um filtro salvo apontaria para um rótulo que sumiu da lista.

    A escolha aqui é explícita: mais frequente primeiro, e o menor valor
    alfabético como desempate. Mesma entrada, mesma saída, sempre.
  */
  select coalesce(jsonb_agg(rotulo order by rotulo), '[]'::jsonb)
  from (
    select distinct on (chave) valor as rotulo
    from (
      select
        sigav.fc_normalizar_rotulo(valor) as chave,
        valor,
        count(*) as ocorrencias
      from (
        select btrim(
          case p_dimensao
            when 'directorate'  then p.metadata ->> 'directorate'
            when 'unit'         then p.metadata ->> 'unit'
            when 'coordination' then p.metadata ->> 'coordination'
            when 'costCenter'   then p.cost_center
            when 'jobTitle'     then p.job_title
          end
        ) as valor
        from sigav.application_participants ap
        join sigav.people p on p.id = ap.person_id
        where ap.application_id = p_aplicacao
      ) bruto
      where sigav.fc_normalizar_rotulo(valor) is not null
      group by sigav.fc_normalizar_rotulo(valor), valor
    ) contadas
    order by chave, ocorrencias desc, valor asc
  ) canonico;
$function$;

/*
  Helper interno: **nenhum grant**, nem a `authenticated`.

  Ela é `security definer` e não tem guard próprio — quem a protege é
  `fc_listar_participantes_do_painel`, que confere `DASHBOARDS` antes de
  chamá-la. Concedida diretamente, viraria uma porta lateral: qualquer sessão
  autenticada leria a composição organizacional de qualquer ciclo passando o
  identificador, sem passar pelo guard.

  Chamada de dentro de uma `security definer`, ela executa como o dono e
  dispensa `execute` do papel de quem chamou — mesmo padrão de
  `fc_abrir_ciclos_agendados`.
*/
revoke execute on function sigav.fc_valores_de_dimensao(uuid, text) from public, anon, authenticated;

create or replace function sigav.fc_listar_participantes_do_painel(
  target_application_code text,
  p_filtros jsonb default '{}'::jsonb,
  p_pagina integer default 1,
  p_tamanho integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, sigav, auth
as $function$
declare
  v_application_id uuid;
  v_pagina integer;
  v_tamanho integer;
  v_total integer;
  v_situacao jsonb;
  v_busca text;
  v_linhas jsonb;
  v_dimensoes jsonb;
begin
  -- Mesmo guard do painel. Escrito por extenso, e não herdado de uma definição
  -- anterior, para que uma leitura do arquivo mostre a regra que vale.
  if not sigav.has_platform_module('DASHBOARDS') then
    raise exception 'Acesso restrito ao módulo de Painéis.';
  end if;

  select id into v_application_id
  from sigav.survey_applications
  where code = btrim(target_application_code)
  limit 1;

  if v_application_id is null then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  -- Página e tamanho são saneados aqui, e não confiados a quem chama: um
  -- tamanho enorme viraria varredura da base inteira numa rota autenticada.
  v_pagina := greatest(1, coalesce(p_pagina, 1));
  v_tamanho := least(200, greatest(1, coalesce(p_tamanho, 50)));

  v_situacao := p_filtros -> 'situacao';
  v_busca := nullif(btrim(coalesce(p_filtros ->> 'busca', '')), '');

  with elegiveis as (
    select
      ap.id,
      p.full_name,
      p.employee_number,
      p.job_title,
      p.metadata ->> 'unit' as unidade,
      p.metadata ->> 'directorate' as diretoria,
      ap.status,
      ap.started_at,
      ap.completed_at
    from sigav.application_participants ap
    join sigav.people p on p.id = ap.person_id
    where ap.application_id = v_application_id
      and sigav.fc_dimensao_publico_atende(p.metadata ->> 'directorate',  p_filtros -> 'directorate')
      and sigav.fc_dimensao_publico_atende(p.metadata ->> 'unit',         p_filtros -> 'unit')
      and sigav.fc_dimensao_publico_atende(p.metadata ->> 'coordination', p_filtros -> 'coordination')
      and sigav.fc_dimensao_publico_atende(p.cost_center,                 p_filtros -> 'costCenter')
      and sigav.fc_dimensao_publico_atende(p.job_title,                   p_filtros -> 'jobTitle')
      and (
        v_situacao is null
        or jsonb_typeof(v_situacao) <> 'array'
        or jsonb_array_length(v_situacao) = 0
        or ap.status in (select jsonb_array_elements_text(v_situacao))
      )
      and (
        v_busca is null
        or p.full_name ilike '%' || v_busca || '%'
        or p.employee_number ilike '%' || v_busca || '%'
        -- A busca continua alcançando o e-mail, que apenas não volta ao
        -- navegador: filtrar por ele é útil, exibi-lo numa lista que não o
        -- mostra seria expor dado pessoal sem propósito.
        or coalesce(p.institutional_email, '') ilike '%' || v_busca || '%'
        or coalesce(p.job_title, '') ilike '%' || v_busca || '%'
      )
  ),
  ordenadas as (
    select
      e.*,
      /*
        Quem ainda não começou aparece primeiro: esta é a lista de cobrança, e a
        ordem responde "com quem falar agora". `full_name` desempata para que a
        página 2 não repita nem pule ninguém entre duas chamadas — sem critério
        estável, paginar sobre empate perde linhas em silêncio.
      */
      row_number() over (
        order by
          case e.status
            when 'ELIGIBLE' then 0
            when 'INVITED' then 1
            when 'IN_PROGRESS' then 2
            when 'COMPLETED' then 3
            else 4
          end,
          e.full_name,
          e.id
      ) as ordem,
      -- O total vem da mesma passagem, já com os filtros aplicados: contar
      -- numa segunda consulta abriria espaço para o total discordar da lista.
      count(*) over () as total
    from elegiveis e
  )
  select
    coalesce(max(o.total), 0)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'fullName', o.full_name,
          'employeeNumber', o.employee_number,
          'jobTitle', o.job_title,
          'unit', o.unidade,
          'directorate', o.diretoria,
          'status', o.status,
          'startedAt', o.started_at,
          'completedAt', o.completed_at
        )
        order by o.ordem
      ) filter (
        where o.ordem > (v_pagina - 1)::bigint * v_tamanho
          and o.ordem <= v_pagina::bigint * v_tamanho
      ),
      '[]'::jsonb
    )
  into v_total, v_linhas
  from ordenadas o;

  /*
    As opções de filtro saem daqui, e não de `fc_listar_dimensoes_publico`.

    Duas razões. Aquela função exige `can_manage_surveys()`, que o Gestor não
    tem embora tenha `DASHBOARDS` — reusá-la deixaria o Gestor com o painel e
    sem filtros. E ela lista a instituição inteira, então ofereceria unidades
    que não têm ninguém neste ciclo, cujo clique devolveria lista vazia.

    O conjunto é o do ciclo **sem filtro aplicado**, de propósito: opção que
    desaparece conforme se filtra deixa quem está filtrando sem caminho de
    volta.
  */
  select jsonb_build_object(
    'directorate', sigav.fc_valores_de_dimensao(v_application_id, 'directorate'),
    'unit',        sigav.fc_valores_de_dimensao(v_application_id, 'unit'),
    'coordination',sigav.fc_valores_de_dimensao(v_application_id, 'coordination'),
    'costCenter',  sigav.fc_valores_de_dimensao(v_application_id, 'costCenter'),
    'jobTitle',    sigav.fc_valores_de_dimensao(v_application_id, 'jobTitle')
  )
  into v_dimensoes;

  return jsonb_build_object(
    'total', v_total,
    'pagina', v_pagina,
    'tamanho', v_tamanho,
    'participantes', v_linhas,
    'dimensoes', v_dimensoes
  );
end;
$function$;

-- `20260803133300` aplicou a revogação em massa num bloco `do $$` executado uma
-- única vez: função criada depois dele precisa repetir os grants à mão, senão
-- nasce executável por `public` e `anon`.
revoke execute on function sigav.fc_listar_participantes_do_painel(text, jsonb, integer, integer) from public, anon;
grant execute on function sigav.fc_listar_participantes_do_painel(text, jsonb, integer, integer) to authenticated;

comment on function sigav.fc_listar_participantes_do_painel(text, jsonb, integer, integer) is
  'Lista paginada de participantes de um ciclo, com filtros organizacionais. '
  'Lê apenas application_participants e people — nunca submissions ou answers —, '
  'de modo que acompanhar participação jamais liga identidade a resposta.';

commit;

-- Rollback:
-- begin;
--   drop function if exists sigav.fc_listar_participantes_do_painel(text, jsonb, integer, integer);
--   drop function if exists sigav.fc_valores_de_dimensao(uuid, text);
-- commit;
