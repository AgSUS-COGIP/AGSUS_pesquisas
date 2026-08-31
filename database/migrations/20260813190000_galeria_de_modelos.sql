begin;

-- Galeria de modelos de avaliação.
--
-- Um modelo é uma pesquisa como qualquer outra — mesma estrutura, mesmas
-- seções e perguntas —, marcada para servir de ponto de partida. Usar um
-- modelo é clonar (`fc_clonar_pesquisa`): não há mecanismo novo de cópia, e o
-- que já foi provado ali vale aqui, inclusive o remapeamento das regras
-- condicionais.
--
-- Por que uma marca na pesquisa, e não uma tabela separada
-- -------------------------------------------------------
-- Modelo e instrumento têm exatamente a mesma forma. Uma tabela paralela
-- duplicaria seções, perguntas e alternativas, e as duas cópias divergiriam na
-- primeira mudança de estrutura. Marcar é o suficiente para separar as duas
-- listas, e permite o caminho inverso: uma avaliação que deu certo vira modelo
-- sem migração de dados.

alter table public.surveys
  add column if not exists st_modelo boolean not null default false,
  add column if not exists tx_categoria_modelo text;

comment on column public.surveys.st_modelo is
  'Verdadeiro quando a pesquisa serve de ponto de partida na galeria de modelos, e não de instrumento em operação.';
comment on column public.surveys.tx_categoria_modelo is
  'Agrupamento do modelo na galeria (ex.: Capacitação, Clima, Serviços internos).';

-- Modelo não tem ciclo, público nem resposta. Deixá-lo no catálogo
-- administrativo misturaria ponto de partida com instrumento em operação, e o
-- operador poderia publicar um modelo por engano.
create or replace function public.list_managed_surveys()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'surveyId', s.id, 'code', s.code, 'name', s.name, 'description', s.description,
    'status', s.status, 'versionId', sv.id, 'versionNumber', sv.version_number,
    'versionStatus', sv.status, 'applicationId', sa.id, 'applicationCode', sa.code,
    'applicationName', sa.name, 'applicationStatus', sa.status,
    'opensAt', sa.opens_at, 'closesAt', sa.closes_at,
    'sections', (select count(*) from public.survey_sections sec where sec.survey_version_id = sv.id),
    'questions', (select count(*) from public.survey_questions q where q.survey_version_id = sv.id),
    'updatedAt', greatest(s.updated_at, sv.updated_at, coalesce(sa.updated_at, s.updated_at))
  ) order by greatest(s.updated_at, sv.updated_at, coalesce(sa.updated_at, s.updated_at)) desc), '[]'::jsonb)
  from public.surveys s
  join lateral (
    select * from public.survey_versions x where x.survey_id = s.id order by x.version_number desc limit 1
  ) sv on true
  left join lateral (
    select * from public.survey_applications a where a.survey_version_id = sv.id order by a.created_at desc limit 1
  ) sa on true
  where s.st_modelo = false;
$$;

revoke all on function public.list_managed_surveys() from public, anon;
grant execute on function public.list_managed_surveys() to authenticated;

-- Galeria propriamente dita.
create or replace function public.fc_listar_modelos_avaliacao()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_resultado jsonb;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  select coalesce(jsonb_agg(item order by item->>'category', item->>'name'), '[]'::jsonb)
  into v_resultado
  from (
    select jsonb_build_object(
      'surveyId', pesquisa.id,
      'code', pesquisa.code,
      'name', pesquisa.name,
      'description', pesquisa.description,
      'category', coalesce(pesquisa.tx_categoria_modelo, 'Geral'),
      'sections', (select count(*) from public.survey_sections s where s.survey_version_id = versao.id),
      'questions', (select count(*) from public.survey_questions q where q.survey_version_id = versao.id)
    ) as item
    from public.surveys as pesquisa
    join lateral (
      select * from public.survey_versions v
      where v.survey_id = pesquisa.id
      order by v.version_number desc limit 1
    ) as versao on true
    where pesquisa.st_modelo = true
  ) as modelos;

  return v_resultado;
end;
$$;

revoke all on function public.fc_listar_modelos_avaliacao() from public, anon;
grant execute on function public.fc_listar_modelos_avaliacao() to authenticated;

comment on function public.fc_listar_modelos_avaliacao() is
  'Modelos disponíveis na galeria, com contagem de seções e perguntas.';

-- Marca ou desmarca uma avaliação como modelo — é assim que um instrumento que
-- deu certo entra na galeria, sem duplicar nada.
create or replace function public.fc_definir_modelo_avaliacao(
  p_pesquisa uuid,
  p_modelo boolean,
  p_categoria text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_pesquisa public.surveys%rowtype;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  select * into v_pesquisa from public.surveys where id = p_pesquisa;
  if v_pesquisa.id is null then
    raise exception 'Avaliação não localizada.';
  end if;

  -- Instrumento com ciclo em operação não vira modelo: modelo é ponto de
  -- partida, e sair do catálogo administrativo esconderia um ciclo ativo de
  -- quem precisa operá-lo.
  if p_modelo and exists (
    select 1
    from public.survey_applications aplicacao
    join public.survey_versions versao on versao.id = aplicacao.survey_version_id
    where versao.survey_id = p_pesquisa
      and aplicacao.status in ('OPEN', 'SCHEDULED')
  ) then
    raise exception 'Esta avaliação tem ciclo aberto ou agendado. Encerre o ciclo antes de transformá-la em modelo.';
  end if;

  update public.surveys
  set st_modelo = p_modelo,
      tx_categoria_modelo = case when p_modelo then nullif(btrim(coalesce(p_categoria, '')), '') else null end,
      updated_at = now()
  where id = p_pesquisa;

  return jsonb_build_object('status', 'OK', 'surveyId', p_pesquisa, 'isTemplate', p_modelo);
end;
$$;

revoke all on function public.fc_definir_modelo_avaliacao(uuid, boolean, text) from public, anon;
grant execute on function public.fc_definir_modelo_avaliacao(uuid, boolean, text) to authenticated;

comment on function public.fc_definir_modelo_avaliacao(uuid, boolean, text) is
  'Marca ou desmarca uma avaliação como modelo da galeria. Recusa instrumento com ciclo aberto ou agendado.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_definir_modelo_avaliacao(uuid, boolean, text);
--   drop function if exists public.fc_listar_modelos_avaliacao();
--   alter table public.surveys drop column if exists st_modelo, drop column if exists tx_categoria_modelo;
--   -- `list_managed_surveys` precisa voltar à definição sem o filtro de modelo.
--   notify pgrst, 'reload schema';
-- commit;
