-- `allEligible` desliga o contexto institucional.
--
-- A cascata restringia a busca de Pessoa pelos filtros de dimensão mesmo quando
-- `allEligible = true`. Mas `allEligible` significa "toda a instituição
-- elegível": a resolução da regra **ignora** os filtros nesse caso, então
-- restringir a busca por eles fazia a tela obedecer a um critério que a regra
-- não usa.
--
-- O efeito prático aparecia na exclusão individual. Com `allEligible` marcado, o
-- público é todo mundo — e é justamente aí que tirar uma pessoa específica faz
-- mais sentido. Se ainda houvesse uma Diretoria escolhida antes de marcar a
-- caixa, a busca continuava presa a ela e não oferecia quem estava fora, embora
-- essa pessoa estivesse no público.
--
-- Nada some: os filtros continuam gravados na regra. Eles apenas deixam de
-- restringir enquanto `allEligible` estiver ligado, que é exatamente o que
-- `fc_resolver_publico_avaliacao` já fazia. As duas passam a concordar.
--
-- A listagem de dimensões recebe a mesma regra pelo mesmo motivo: manter
-- `allEligible` significando uma coisa na resolução e outra na oferta é como as
-- divergências deste projeto começaram.

begin;

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

  perform sigav.fc_validar_regra_publico(p_regra);

  -- Com `allEligible`, os filtros não participam da regra — então também não
  -- restringem a oferta. `'{}'` faz cada `fc_dimensao_publico_atende` devolver
  -- verdadeiro, sem precisar de um caminho separado na consulta.
  v_filtros := case
    when coalesce((p_regra ->> 'allEligible')::boolean, false) then '{}'::jsonb
    else coalesce(p_regra -> 'filters', '{}'::jsonb)
  end;

  with pessoas as (
    select metadata ->> 'directorate' as diretoria,
           metadata ->> 'unit' as unidade,
           metadata ->> 'coordination' as coordenacao,
           cost_center as centro,
           job_title as cargo
    from sigav.people
    where active
  ),
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

  -- `allEligible` desliga o contexto: o público é toda a instituição, e a busca
  -- precisa alcançar toda a instituição — inclusive para excluir alguém.
  v_filtros := case
    when coalesce((p_regra ->> 'allEligible')::boolean, false) then '{}'::jsonb
    else coalesce(p_regra -> 'filters', '{}'::jsonb)
  end;
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
    -- Derivado de `v_filtros`, não da regra crua: com `allEligible` ligado a
    -- lista não está estreitada, e dizer o contrário faria a tela explicar uma
    -- ausência que não existe.
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

comment on function sigav.fc_listar_dimensoes_publico(jsonb) is
  'Opções de cada dimensão restringidas pelas dimensões anteriores da ordem da tela. Com allEligible ligado, os filtros não restringem. Devolve também as seleções incompatíveis com o contexto atual.';

comment on function sigav.fc_buscar_pessoas_publico(text, integer, jsonb) is
  'Busca pessoas ativas dentro do contexto institucional escolhido. Com allEligible ligado, alcança toda a instituição. Restringe a oferta, não o efeito.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   -- Reaplicar as definições de 20260828220000, que restringem por filtro
--   -- mesmo com allEligible ligado.
--   notify pgrst, 'reload schema';
-- commit;
