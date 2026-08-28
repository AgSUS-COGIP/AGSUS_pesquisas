-- Seleção em cascata nas dimensões do público.
--
-- Até aqui as opções vinham de todas as pessoas ativas, sem olhar o que já
-- estava escolhido. Escolher `Diretoria = DAIS` e depois abrir Unidade
-- oferecia as 26 unidades da instituição, inclusive as que não têm ninguém na
-- DAIS. Quem opera não tem como saber quais combinações existem, e uma escolha
-- que resulta em zero pessoas só se descobre na prévia.
--
-- ## Cascata por prefixo, não faceta cruzada
--
-- A ordem é a da tela:
--
--   Diretoria → Unidade → Coordenação → Centro de custo → Cargo → Pessoa
--
-- Cada dimensão é restringida pelas **anteriores**, nunca pelas posteriores.
-- Escolher um Cargo não muda a lista de Diretorias.
--
-- A alternativa seria faceta cruzada, em que cada dimensão é restringida por
-- todas as outras. Ela informa mais, mas torna a tela imprevisível: mexer em
-- qualquer campo remexe todos os outros, e a regra de "remover só as seleções
-- posteriores incompatíveis" perderia sentido, porque qualquer seleção poderia
-- invalidar qualquer outra.
--
-- ## Não é hierarquia obrigatória
--
-- Dimensão anterior vazia não restringe nada. Sem Diretoria escolhida, Unidade
-- mostra todas as unidades — começar a regra direto por Unidade ou por Cargo
-- continua funcionando exatamente como antes.
--
-- ## Incompatibilidade é resolvida no banco
--
-- Trocar a Diretoria pode deixar uma Unidade escolhida fora do contexto. A
-- resposta informa quais seleções ficaram incompatíveis para a tela removê-las
-- e dizer o que fez.
--
-- Esse cálculo não pode viver no cliente: o rótulo exibido é a grafia **mais
-- frequente dentro do contexto** (`mode()`), e o contexto acabou de mudar. Ou
-- seja, o mesmo valor institucional pode ser rotulado "Coord de Gestão" numa
-- lista e "COORD DE GESTAO" na outra. Comparar textos no cliente marcaria como
-- incompatível uma seleção que continua válida. A comparação tem de acontecer
-- onde a normalização mora.
--
-- ## Sem tabela nova
--
-- As relações saem das próprias linhas de `people`: se existe alguém com
-- Diretoria X e Unidade Y, então Y pertence a X naquele contexto. Nenhuma
-- tabela de Diretoria, Unidade, Coordenação ou hierarquia foi criada.

begin;

-- A assinatura ganha um parâmetro, então `create or replace` criaria uma
-- sobrecarga em vez de substituir — e duas funções de mesmo nome com aridade
-- diferente é ambiguidade esperando acontecer. O `drop` é seguro aqui: a
-- versão sem parâmetro nasceu na migration anterior e ainda não chegou a
-- produção. Com o padrão no parâmetro novo, chamada sem argumento continua
-- resolvendo.
drop function if exists sigav.fc_listar_dimensoes_publico();

create or replace function sigav.fc_listar_dimensoes_publico(p_regra jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'sigav', 'auth'
as $function$
declare
  v_filtros jsonb;
  v_resultado jsonb;
begin
  if not sigav.can_manage_surveys() then
    return jsonb_build_object('status', 'FORBIDDEN');
  end if;

  -- Mesma validação da resolução: chave desconhecida é recusada aqui também,
  -- senão a tela ofereceria opções para uma regra que a prévia vai rejeitar.
  perform sigav.fc_validar_regra_publico(p_regra);
  v_filtros := coalesce(p_regra -> 'filters', '{}'::jsonb);

  with pessoas as (
    select metadata ->> 'directorate' as diretoria,
           metadata ->> 'unit' as unidade,
           metadata ->> 'coordination' as coordenacao,
           cost_center as centro,
           job_title as cargo
    from sigav.people
    where active
  ),
  -- Cada dimensão enxerga só o que as anteriores permitem. A primeira não tem
  -- anterior, então parte da base inteira.
  bruto as (
    select 'directorate' as dimensao, diretoria as valor
    from pessoas

    union all
    select 'unit', unidade
    from pessoas
    where sigav.fc_dimensao_publico_atende(diretoria, v_filtros -> 'directorate')

    union all
    select 'coordination', coordenacao
    from pessoas
    where sigav.fc_dimensao_publico_atende(diretoria, v_filtros -> 'directorate')
      and sigav.fc_dimensao_publico_atende(unidade, v_filtros -> 'unit')

    union all
    select 'costCenter', centro
    from pessoas
    where sigav.fc_dimensao_publico_atende(diretoria, v_filtros -> 'directorate')
      and sigav.fc_dimensao_publico_atende(unidade, v_filtros -> 'unit')
      and sigav.fc_dimensao_publico_atende(coordenacao, v_filtros -> 'coordination')

    union all
    select 'jobTitle', cargo
    from pessoas
    where sigav.fc_dimensao_publico_atende(diretoria, v_filtros -> 'directorate')
      and sigav.fc_dimensao_publico_atende(unidade, v_filtros -> 'unit')
      and sigav.fc_dimensao_publico_atende(coordenacao, v_filtros -> 'coordination')
      and sigav.fc_dimensao_publico_atende(centro, v_filtros -> 'costCenter')
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
  ),
  -- Seleções que deixaram de existir no contexto atual. Comparadas pela chave
  -- normalizada, não pelo texto exibido.
  escolhido as (
    select chave.dimensao, item.valor as rotulo, sigav.fc_normalizar_rotulo(item.valor) as chave
    from jsonb_each(v_filtros) as chave(dimensao, valores),
         jsonb_array_elements_text(chave.valores) as item(valor)
  ),
  incompativel as (
    select e.dimensao, jsonb_agg(e.rotulo order by e.rotulo) as itens
    from escolhido e
    where not exists (
      select 1 from agrupado a
      where a.dimensao = e.dimensao and a.chave = e.chave
    )
    group by e.dimensao
  )
  select jsonb_build_object(
    'status', 'OK',
    'dimensions', coalesce((select jsonb_object_agg(dimensao, itens) from por_dimensao), '{}'::jsonb),
    'incompatible', coalesce((select jsonb_object_agg(dimensao, itens) from incompativel), '{}'::jsonb)
  )
  into v_resultado;

  return v_resultado;
end;
$function$;

-- ---------------------------------------------------------------------------
-- Busca de pessoa dentro do contexto
-- ---------------------------------------------------------------------------

-- Pessoa é a última dimensão da ordem, então é restringida por todas as cinco
-- anteriores. Oferecer alguém de fora do contexto seria oferecer uma inclusão
-- que contradiz o critério montado logo acima, sem explicar por quê.
--
-- A restrição vale para a **oferta**, não para o efeito: inclusão individual
-- continua sendo adicional ao filtro, como sempre foi. O que muda é que a tela
-- para de sugerir a contradição.
drop function if exists sigav.fc_buscar_pessoas_publico(text, integer);

create or replace function sigav.fc_buscar_pessoas_publico(
  p_busca text default null,
  p_limite integer default 20,
  p_regra jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'sigav', 'auth'
as $function$
declare
  v_filtros jsonb;
  v_termo text;
  v_resultado jsonb;
begin
  if not sigav.can_manage_surveys() then
    return jsonb_build_object('status', 'FORBIDDEN');
  end if;

  perform sigav.fc_validar_regra_publico(p_regra);
  v_filtros := coalesce(p_regra -> 'filters', '{}'::jsonb);
  v_termo := sigav.fc_normalizar_rotulo(p_busca);

  with encontradas as (
    select p.id, p.full_name, p.employee_number, p.job_title,
           p.metadata ->> 'unit' as unidade,
           p.metadata ->> 'directorate' as diretoria
    from sigav.people p
    where p.active
      and sigav.fc_dimensao_publico_atende(p.metadata ->> 'directorate',  v_filtros -> 'directorate')
      and sigav.fc_dimensao_publico_atende(p.metadata ->> 'unit',         v_filtros -> 'unit')
      and sigav.fc_dimensao_publico_atende(p.metadata ->> 'coordination', v_filtros -> 'coordination')
      and sigav.fc_dimensao_publico_atende(p.cost_center,                 v_filtros -> 'costCenter')
      and sigav.fc_dimensao_publico_atende(p.job_title,                   v_filtros -> 'jobTitle')
      and (
        v_termo is null
        or sigav.fc_normalizar_rotulo(p.full_name) like '%' || v_termo || '%'
        or sigav.fc_normalizar_rotulo(p.employee_number) like '%' || v_termo || '%'
        or sigav.fc_normalizar_rotulo(p.institutional_email) like '%' || v_termo || '%'
        or sigav.fc_normalizar_rotulo(p.job_title) like '%' || v_termo || '%'
      )
    order by p.full_name
    limit least(greatest(coalesce(p_limite, 20), 1), 50)
  )
  select jsonb_build_object(
    'status', 'OK',
    -- `contextual` diz à tela se a lista está estreitada por filtro. Sem isso,
    -- "nenhuma pessoa encontrada" seria ambíguo entre "esse nome não existe" e
    -- "existe, mas fora do contexto que você montou".
    'contextual', (select count(*) from jsonb_each(v_filtros) as f(chave, valores)
                   where jsonb_array_length(f.valores) > 0) > 0,
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
  into v_resultado;

  return v_resultado;
end;
$function$;

revoke all on function sigav.fc_listar_dimensoes_publico(jsonb) from public, anon;
revoke all on function sigav.fc_buscar_pessoas_publico(text, integer, jsonb) from public, anon;

grant execute on function sigav.fc_listar_dimensoes_publico(jsonb) to authenticated;
grant execute on function sigav.fc_buscar_pessoas_publico(text, integer, jsonb) to authenticated;

comment on function sigav.fc_listar_dimensoes_publico(jsonb) is
  'Opções de cada dimensão restringidas pelas dimensões anteriores da ordem da tela. Devolve também as seleções que ficaram incompatíveis com o contexto atual.';

comment on function sigav.fc_buscar_pessoas_publico(text, integer, jsonb) is
  'Busca pessoas ativas dentro do contexto institucional já escolhido. Restringe a oferta, não o efeito: inclusão individual continua adicional ao filtro.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists sigav.fc_buscar_pessoas_publico(text, integer, jsonb);
--   drop function if exists sigav.fc_listar_dimensoes_publico(jsonb);
--   -- Recriar as versões de 20260828190000 a partir daquele arquivo.
--   notify pgrst, 'reload schema';
-- commit;
