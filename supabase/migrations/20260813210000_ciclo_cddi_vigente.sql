begin;

-- Resolve qual ciclo do CDDI a pessoa autenticada deve responder.
--
-- O problema
-- ----------
-- `/cddi` tinha o código `CDDI-2026` escrito em três chamadas. Enquanto
-- existiu uma edição só, funcionou. Com a segunda, a tela continuaria buscando
-- a primeira: as pessoas abririam o instrumento do ciclo encerrado, e o erro
-- não diria por quê.
--
-- A regra de escolha
-- ------------------
-- Vale o ciclo em que a pessoa **participa**, não o mais recente do catálogo —
-- alguém incluído no ciclo 1 e fora do 2 precisa continuar vendo o 1 enquanto
-- ele estiver aberto. Entre os ciclos de que participa, a ordem é:
--
--   1. aberto  — é o que exige ação agora;
--   2. agendado — o próximo, para a tela poder explicar que ainda não abriu;
--   3. o mais recente, para consulta do que já foi respondido.
--
-- Devolve `null` quando a pessoa não participa de nenhum ciclo do CDDI. A tela
-- trata isso como ausência de convite, que é diferente de erro.

create or replace function public.fc_obter_ciclo_cddi_vigente()
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_pessoa uuid := public.current_person_id();
  v_resultado jsonb;
begin
  if v_pessoa is null then
    raise exception 'Sessão não identificada.';
  end if;

  select jsonb_build_object(
    'applicationId', aplicacao.id,
    'code', aplicacao.code,
    'name', aplicacao.name,
    'status', aplicacao.status,
    'opensAt', aplicacao.opens_at,
    'closesAt', aplicacao.closes_at
  )
  into v_resultado
  from public.survey_applications as aplicacao
  join public.survey_versions as versao on versao.id = aplicacao.survey_version_id
  join public.surveys as pesquisa on pesquisa.id = versao.survey_id
  where pesquisa.code = 'CDDI'
    and aplicacao.status <> 'DRAFT'
    and exists (
      select 1
      from public.application_participants as participante
      where participante.application_id = aplicacao.id
        and participante.person_id = v_pessoa
        and participante.status not in ('BLOCKED', 'EXCLUDED')
    )
  order by
    case aplicacao.status when 'OPEN' then 0 when 'SCHEDULED' then 1 else 2 end,
    aplicacao.opens_at desc nulls last
  limit 1;

  return v_resultado;
end;
$$;

revoke all on function public.fc_obter_ciclo_cddi_vigente() from public, anon;
grant execute on function public.fc_obter_ciclo_cddi_vigente() to authenticated;

comment on function public.fc_obter_ciclo_cddi_vigente() is
  'Ciclo do CDDI que a pessoa autenticada deve responder: aberto, senão agendado, senão o mais recente de que participa. Null quando não participa de nenhum.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_obter_ciclo_cddi_vigente();
--   notify pgrst, 'reload schema';
-- commit;
