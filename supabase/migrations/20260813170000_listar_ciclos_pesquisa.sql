begin;

-- Lista os ciclos de uma pesquisa, do mais recente para o mais antigo.
--
-- O painel do CDDI nasceu com o código do ciclo fixo no frontend
-- ('CDDI-2026') e um `select` desabilitado exibindo esse único valor. Enquanto
-- existiu uma edição só, a limitação não aparecia; com a segunda, o painel
-- passaria a mostrar o ciclo errado sem oferecer como trocar.
--
-- A função é genérica de propósito: qualquer painel que precise escolher entre
-- edições de um instrumento usa a mesma chamada. Devolve `jsonb` com chaves em
-- camelCase, como as demais RPCs consumidas direto pelas telas.

create or replace function public.fc_listar_ciclos_pesquisa(p_codigo_pesquisa text)
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

  select coalesce(jsonb_agg(item order by item->>'opensAt' desc nulls last), '[]'::jsonb)
  into v_resultado
  from (
    select jsonb_build_object(
      'applicationId', aplicacao.id,
      'code', aplicacao.code,
      'name', aplicacao.name,
      'status', aplicacao.status,
      'opensAt', aplicacao.opens_at,
      'closesAt', aplicacao.closes_at,
      'participants', (
        select count(*)
        from public.application_participants participante
        where participante.application_id = aplicacao.id
          and participante.status not in ('BLOCKED', 'EXCLUDED')
      )
    ) as item
    from public.survey_applications as aplicacao
    join public.survey_versions as versao on versao.id = aplicacao.survey_version_id
    join public.surveys as pesquisa on pesquisa.id = versao.survey_id
    where pesquisa.code = btrim(p_codigo_pesquisa)
      -- Rascunho não tem público nem período: não é ciclo para acompanhar.
      and aplicacao.status <> 'DRAFT'
  ) as ciclos;

  return v_resultado;
end;
$$;

revoke all on function public.fc_listar_ciclos_pesquisa(text) from public, anon;
grant execute on function public.fc_listar_ciclos_pesquisa(text) to authenticated;

comment on function public.fc_listar_ciclos_pesquisa(text) is
  'Ciclos de uma pesquisa, do mais recente ao mais antigo, para os seletores de painel.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_listar_ciclos_pesquisa(text);
--   notify pgrst, 'reload schema';
-- commit;
