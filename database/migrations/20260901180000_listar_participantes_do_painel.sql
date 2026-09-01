-- Lista operacional de participantes de um ciclo.
--
-- ## O que esta migration não faz
--
-- Nenhuma tabela, nenhuma coluna, nenhum schema. São duas funções e nada mais.
--
-- ## Por que função nova, e não um campo a mais no painel
--
-- `FC_OBTER_PAINEL_PESQUISA` devolve o instrumento inteiro num JSON. Acrescentar
-- ali uma lista paginada obrigaria a recalcular tudo a cada troca de página, e
-- redefinir aquela função é arriscado: o guard dela já foi reescrito sobre a
-- definição viva, e um `create or replace` copiado de um arquivo antigo
-- reintroduziria a regra anterior sem que nada acusasse.
--
-- ## Anonimato garantido pela estrutura
--
-- A função lê apenas `RL_APLICACAO_PESSOA` e `TB_PESSOA`. **Não toca
-- `TB_SUBMISSAO` nem `TB_RESPOSTA`.** Em ciclo anônimo a ponte pessoa↔submissão
-- vive em `TB_BILHETE_ANONIMO`, restrita a quem é dono do bilhete; sem
-- referência às tabelas de resposta, não existe caminho de leitura entre quem
-- participou e o que respondeu. Dizer que alguém enviou não revela o envio.
--
-- Um teste lê a definição viva e falha se `TB_SUBMISSAO` ou `TB_RESPOSTA`
-- aparecerem aqui — a garantia deixa de depender do cuidado de quem escrever o
-- próximo join.
--
-- ## Filtros: os mesmos do público, de propósito
--
-- As dimensões organizacionais reusam `FC_DIMENSAO_PUBLICO_ATENDE`, a mesma
-- função que resolve a regra de público. Assim "Diretoria de Operações" no
-- filtro do painel e na definição do público significam o mesmo conjunto de
-- pessoas por construção, e não por coincidência de duas implementações.
--
-- ## Autorização depois da unificação do banco
--
-- Não há mais `anon`/`authenticated`/`service_role` no cluster: a conexão é
-- única (`usr_sip_app`) e quem pode chamar cada RPC é decidido em
-- `src/lib/db/rpc-permissions.ts`. Aqui ficam só as duas garantias que
-- pertencem ao banco — `revoke all ... from public` e o guard de módulo dentro
-- do corpo da função.

begin;

-- Valores distintos de uma dimensão entre os participantes de um ciclo.
--
-- Existe para que a lista de opções do filtro venha do próprio ciclo, e não do
-- catálogo institucional inteiro — opção sem ninguém neste ciclo é clique que
-- devolve lista vazia. `stable` permite ao planejador reaproveitar o resultado
-- dentro da mesma consulta, já que ela é chamada cinco vezes.
create or replace function sigav."FC_VALORES_DE_DIMENSAO"(
  p_aplicacao uuid,
  p_dimensao text
)
returns jsonb
language sql
stable
security definer
set search_path to 'pg_catalog', 'sigav'
as $function$
  /*
    Agrupa pela forma normalizada e exibe uma grafia canônica.

    Sem isso, "Coord de Gestão" e "COORD DE GESTAO" apareceriam como duas
    opções, enquanto o filtro — que normaliza, porque reusa
    `FC_DIMENSAO_PUBLICO_ATENDE` — devolveria as mesmas pessoas para as duas.
    Duas entradas com resultado idêntico é a interface afirmando uma diferença
    que não existe.

    ## Por que não `mode()`

    `mode() within group` devolve o mais frequente, mas **não define quem vence
    no empate** — o resultado depende da ordem em que o planejador leu as
    linhas. Duas grafias com a mesma contagem fariam a opção alternar entre
    execuções, e um filtro salvo apontaria para um rótulo que sumiu da lista.

    A escolha aqui é explícita: mais frequente primeiro, menor valor alfabético
    como desempate. Mesma entrada, mesma saída, sempre.
  */
  select coalesce(jsonb_agg(rotulo order by rotulo), '[]'::jsonb)
  from (
    select distinct on (chave) valor as rotulo
    from (
      select
        sigav."FC_NORMALIZAR_ROTULO"(valor) as chave,
        valor,
        count(*) as ocorrencias
      from (
        select btrim(
          case p_dimensao
            when 'directorate'  then p."DS_METADADO" ->> 'directorate'
            when 'unit'         then p."DS_METADADO" ->> 'unit'
            when 'coordination' then p."DS_METADADO" ->> 'coordination'
            when 'costCenter'   then p."CO_CENTRO_CUSTO"
            when 'jobTitle'     then p."NO_CARGO"
          end
        ) as valor
        from sigav."RL_APLICACAO_PESSOA" ap
        join sigav."TB_PESSOA" p on p."SQ_PESSOA" = ap."SQ_PESSOA"
        where ap."SQ_APLICACAO" = p_aplicacao
      ) bruto
      where sigav."FC_NORMALIZAR_ROTULO"(valor) is not null
      group by sigav."FC_NORMALIZAR_ROTULO"(valor), valor
    ) contadas
    order by chave, ocorrencias desc, valor asc
  ) canonico;
$function$;

/*
  Helper interno, e é aqui que a arquitetura nova muda a forma da garantia.

  Antes, o que a mantinha interna era `revoke execute ... from authenticated`:
  o PostgREST recusava a chamada direta porque a sessão não tinha o privilégio.
  Sem as roles do Postgres, esse mecanismo deixou de existir.

  A proteção passou a ser a **ausência de `FC_VALORES_DE_DIMENSAO` em
  `src/lib/db/rpc-permissions.ts`**: o adaptador recusa com 42501 qualquer nome
  fora do allowlist, antes de abrir transação. É a mesma garantia, expressa onde
  a arquitetura nova a expressa, e o cabeçalho daquele arquivo descreve
  exatamente este caso.

  O `revoke ... from public` continua valendo pelo motivo de sempre: função
  criada depois da revogação em massa nasce executável por `public`.

  Chamada de dentro de outra `security definer`, ela executa como o dono e
  dispensa privilégio de quem chamou.
*/
revoke all on function sigav."FC_VALORES_DE_DIMENSAO"(uuid, text) from public;

create or replace function sigav."FC_LISTAR_PARTIC_PAINEL"(
  target_application_code text,
  p_filtros jsonb default '{}'::jsonb,
  p_pagina integer default 1,
  p_tamanho integer default 50
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'sigav'
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
  -- Mesmo guard do painel, escrito por extenso e não herdado, para que uma
  -- leitura do arquivo mostre a regra que vale. A rota também confere, mas por
  -- cortesia — a garantia é esta.
  if not sigav."FC_TEM_MODULO"('DASHBOARDS') then
    raise exception 'Acesso restrito ao módulo de Painéis.'
      using errcode = '42501';
  end if;

  select "SQ_APLICACAO" into v_application_id
  from sigav."TB_APLICACAO_PESQUISA"
  where "CO_APLICACAO" = btrim(target_application_code)
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
      ap."SQ_PARTICIPANTE" as id,
      p."NO_PESSOA" as nome,
      p."CO_MATRICULA" as matricula,
      p."NO_CARGO" as cargo,
      p."DS_METADADO" ->> 'unit' as unidade,
      p."DS_METADADO" ->> 'directorate' as diretoria,
      ap."ST_SITUACAO" as situacao,
      ap."DT_INICIO" as iniciado_em,
      ap."DT_CONCLUSAO" as concluido_em
    from sigav."RL_APLICACAO_PESSOA" ap
    join sigav."TB_PESSOA" p on p."SQ_PESSOA" = ap."SQ_PESSOA"
    where ap."SQ_APLICACAO" = v_application_id
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p."DS_METADADO" ->> 'directorate',  p_filtros -> 'directorate')
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p."DS_METADADO" ->> 'unit',         p_filtros -> 'unit')
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p."DS_METADADO" ->> 'coordination', p_filtros -> 'coordination')
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p."CO_CENTRO_CUSTO",                p_filtros -> 'costCenter')
      and sigav."FC_DIMENSAO_PUBLICO_ATENDE"(p."NO_CARGO",                       p_filtros -> 'jobTitle')
      and (
        v_situacao is null
        or jsonb_typeof(v_situacao) <> 'array'
        or jsonb_array_length(v_situacao) = 0
        or ap."ST_SITUACAO" in (select jsonb_array_elements_text(v_situacao))
      )
      and (
        v_busca is null
        or p."NO_PESSOA" ilike '%' || v_busca || '%'
        or p."CO_MATRICULA" ilike '%' || v_busca || '%'
        -- A busca continua alcançando o e-mail, que apenas não volta ao
        -- navegador: filtrar por ele é útil, devolvê-lo a uma lista que não o
        -- exibe seria expor dado pessoal sem propósito.
        or coalesce(p."DS_EMAIL_INSTITUCIONAL", '') ilike '%' || v_busca || '%'
        or coalesce(p."NO_CARGO", '') ilike '%' || v_busca || '%'
      )
  ),
  ordenadas as (
    select
      e.*,
      /*
        Quem ainda não começou aparece primeiro: esta é a lista de cobrança, e a
        ordem responde "com quem falar agora". O nome desempata para que a
        página 2 não repita nem pule ninguém entre duas chamadas — sem critério
        estável, paginar sobre empate perde linhas em silêncio.
      */
      row_number() over (
        order by
          case e.situacao
            when 'ELIGIBLE' then 0
            when 'INVITED' then 1
            when 'IN_PROGRESS' then 2
            when 'COMPLETED' then 3
            else 4
          end,
          e.nome,
          e.id
      ) as ordem,
      -- O total sai da mesma passagem, já com os filtros aplicados: contar numa
      -- segunda consulta abriria espaço para o total discordar da lista.
      count(*) over () as total
    from elegiveis e
  )
  select
    coalesce(max(o.total), 0)::integer,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'id', o.id,
          'fullName', o.nome,
          'employeeNumber', o.matricula,
          'jobTitle', o.cargo,
          'unit', o.unidade,
          'directorate', o.diretoria,
          'status', o.situacao,
          'startedAt', o.iniciado_em,
          'completedAt', o.concluido_em
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
    As opções de filtro saem daqui, e não de `FC_LISTAR_DIMENSOES_PUBLICO`.

    Duas razões. Aquela função exige `FC_PODE_GERIR_PESQUISA()`, que o Gestor
    não tem embora tenha `DASHBOARDS` — reusá-la deixaria o Gestor com o painel
    e sem filtros. E ela lista a instituição inteira, então ofereceria unidades
    sem ninguém neste ciclo, cujo clique devolveria lista vazia.

    O conjunto é o do ciclo **sem filtro aplicado**, de propósito: opção que
    desaparece conforme se filtra deixa quem está filtrando sem caminho de volta.
  */
  select jsonb_build_object(
    'directorate', sigav."FC_VALORES_DE_DIMENSAO"(v_application_id, 'directorate'),
    'unit',        sigav."FC_VALORES_DE_DIMENSAO"(v_application_id, 'unit'),
    'coordination',sigav."FC_VALORES_DE_DIMENSAO"(v_application_id, 'coordination'),
    'costCenter',  sigav."FC_VALORES_DE_DIMENSAO"(v_application_id, 'costCenter'),
    'jobTitle',    sigav."FC_VALORES_DE_DIMENSAO"(v_application_id, 'jobTitle')
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

-- Função criada depois da revogação em massa nasce executável por `public`.
revoke all on function sigav."FC_LISTAR_PARTIC_PAINEL"(text, jsonb, integer, integer) from public;

comment on function sigav."FC_LISTAR_PARTIC_PAINEL"(text, jsonb, integer, integer) is
  'Lista paginada de participantes de um ciclo, com filtros organizacionais. '
  'Lê apenas RL_APLICACAO_PESSOA e TB_PESSOA — nunca TB_SUBMISSAO ou TB_RESPOSTA —, '
  'de modo que acompanhar participação jamais liga identidade a resposta.';

commit;

-- Rollback:
-- begin;
--   drop function if exists sigav."FC_LISTAR_PARTIC_PAINEL"(text, jsonb, integer, integer);
--   drop function if exists sigav."FC_VALORES_DE_DIMENSAO"(uuid, text);
-- commit;
