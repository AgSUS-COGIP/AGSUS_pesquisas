begin;

-- Uma avaliação criada por clonagem (inclusive pela galeria de modelos)
-- recebia pesquisa e versão, mas não recebia `survey_applications`. O
-- construtor continuava funcionando, porém toda a operação seguinte dependia
-- desse registro: publicar, definir período, iniciar, interromper e arquivar.
--
-- A implementação original fica como função interna de cópia da estrutura. A
-- RPC pública passa a completar o agregado com um ciclo em rascunho, sem
-- período, público ou respostas. Assim o ciclo de origem continua sem ser
-- copiado, mas a nova avaliação já possui o recurso operacional obrigatório.
alter function public.fc_clonar_pesquisa(uuid, text, text)
  rename to fc_clonar_pesquisa_estrutura;

revoke all on function public.fc_clonar_pesquisa_estrutura(uuid, text, text)
  from public, anon, authenticated;

comment on function public.fc_clonar_pesquisa_estrutura(uuid, text, text) is
  'Função interna que copia a estrutura da avaliação; fc_clonar_pesquisa completa a cópia com um ciclo em rascunho.';

create function public.fc_clonar_pesquisa(
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
  v_resultado jsonb;
  v_pesquisa uuid;
  v_versao uuid;
  v_aplicacao uuid;
  v_codigo text;
  v_nome text;
begin
  -- A função interna mantém as validações de papel, origem e estrutura. Se a
  -- criação do ciclo falhar, a mesma transação desfaz também toda a cópia.
  v_resultado := public.fc_clonar_pesquisa_estrutura(p_pesquisa, p_nome, p_codigo);
  v_pesquisa := (v_resultado ->> 'surveyId')::uuid;
  v_codigo := v_resultado ->> 'code';
  v_nome := v_resultado ->> 'name';

  select id
  into v_versao
  from public.survey_versions
  where survey_id = v_pesquisa
  order by version_number desc
  limit 1;

  insert into public.survey_applications (
    survey_version_id, code, name, opens_at, closes_at, status,
    allow_drafts, allow_resubmission, anonymous, access_mode,
    nu_limiar_anonimato, st_notificacao_email, settings, created_by
  ) values (
    v_versao, v_codigo || '-1', v_nome, null, null, 'DRAFT',
    true, false, false, 'RESTRICTED', 5, false, '{}'::jsonb,
    public.current_person_id()
  )
  returning id into v_aplicacao;

  return v_resultado || jsonb_build_object('applicationId', v_aplicacao);
end;
$$;

revoke all on function public.fc_clonar_pesquisa(uuid, text, text)
  from public, anon;
grant execute on function public.fc_clonar_pesquisa(uuid, text, text)
  to authenticated;

comment on function public.fc_clonar_pesquisa(uuid, text, text) is
  'Duplica a estrutura numa avaliação nova e cria seu ciclo em rascunho, sem copiar período, público, respostas ou histórico.';

-- Repara avaliações já clonadas. Modelos permanecem sem ciclo por definição;
-- para toda avaliação operacional, a versão mais recente precisa ter uma
-- aplicação para que `manage_survey_cycle` consiga atuar.
with versoes_recentes as (
  select pesquisa.id as pesquisa_id,
         pesquisa.code as pesquisa_codigo,
         pesquisa.name as pesquisa_nome,
         pesquisa.created_by as criado_por,
         versao.id as versao_id,
         versao.version_number as numero_versao
  from public.surveys pesquisa
  join lateral (
    select item.id, item.version_number
    from public.survey_versions item
    where item.survey_id = pesquisa.id
    order by item.version_number desc
    limit 1
  ) versao on true
  where not pesquisa.st_modelo
), ciclos_ausentes as (
  select recente.*,
         recente.pesquisa_codigo || '-' || recente.numero_versao::text as codigo_base
  from versoes_recentes recente
  where not exists (
    select 1
    from public.survey_applications aplicacao
    where aplicacao.survey_version_id = recente.versao_id
  )
)
insert into public.survey_applications (
  survey_version_id, code, name, opens_at, closes_at, status,
  allow_drafts, allow_resubmission, anonymous, access_mode,
  nu_limiar_anonimato, st_notificacao_email, settings, created_by
)
select
  ausente.versao_id,
  case
    when exists (
      select 1 from public.survey_applications existente
      where existente.code = ausente.codigo_base
    ) then ausente.codigo_base || '-' || left(replace(ausente.versao_id::text, '-', ''), 8)
    else ausente.codigo_base
  end,
  ausente.pesquisa_nome,
  null, null, 'DRAFT', true, false, false, 'RESTRICTED', 5, false,
  '{}'::jsonb, ausente.criado_por
from ciclos_ausentes ausente;

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_clonar_pesquisa(uuid, text, text);
--   alter function public.fc_clonar_pesquisa_estrutura(uuid, text, text)
--     rename to fc_clonar_pesquisa;
--   grant execute on function public.fc_clonar_pesquisa(uuid, text, text)
--     to authenticated;
--   -- Os ciclos reparados e os criados depois desta migration são dados úteis
--   -- e não devem ser removidos no rollback.
--   notify pgrst, 'reload schema';
-- commit;
