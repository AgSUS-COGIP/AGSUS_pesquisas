begin;

-- Endurecimento da retenção de rascunhos anônimos antes da integração.
--
-- A migration 20260824120000 instala o mecanismo. Esta complementar fecha
-- três garantias que precisam ser explícitas no banco:
--   1. só apagar DRAFT realmente sem identidade;
--   2. dar índice à varredura periódica por updated_at;
--   3. não tratar ausência de claim como service_role no invólucro interno.

create index if not exists in_sub_anon_rasc_updated
  on public.submissions (updated_at)
  where status = 'DRAFT'
    and (metadata->>'origin') = 'PUBLIC_ANONYMOUS_LINK'
    and participant_id is null
    and respondent_person_id is null
    and subject_person_id is null;

create or replace function public.fc_expirar_rascunhos_anonimos()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_dias integer;
  v_apagados integer;
begin
  select nu_dias_retencao_rascunho_anonimo into v_dias
  from public.tb_config_plataforma
  where co_configuracao = 1;

  if v_dias is null then
    return 0;
  end if;

  delete from public.submissions s
  where s.status = 'DRAFT'
    and s.metadata->>'origin' = 'PUBLIC_ANONYMOUS_LINK'
    -- O marcador de origem descreve como a submissão nasceu; estas três
    -- condições garantem também o estado atual. Se algum vínculo institucional
    -- tiver sido associado depois, a retenção anônima não pode apagar a linha.
    and s.participant_id is null
    and s.respondent_person_id is null
    and s.subject_person_id is null
    and s.updated_at < timezone('utc', now()) - make_interval(days => v_dias);

  get diagnostics v_apagados = row_count;

  if v_apagados > 0 then
    insert into public.audit_events(
      actor_person_id, event_type, entity_type, entity_id, application_id,
      before_data, after_data, metadata
    )
    values (
      null, 'ANONYMOUS_DRAFTS_EXPIRED', 'submissions', null, null, null, null,
      jsonb_build_object('apagados', v_apagados, 'diasRetencao', v_dias)
    );
  end if;

  return v_apagados;
end;
$$;

revoke all on function public.fc_expirar_rascunhos_anonimos() from public, anon, authenticated;

create or replace function public.fc_srv_expirar_rascunhos_anon()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$;
begin
  -- A ACL abaixo é a barreira principal. A claim é defesa em profundidade:
  -- ausência de JWT/role é recusada, nunca promovida implicitamente a
  -- service_role.
  if coalesce(auth.jwt()->>'role', '') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  return public.fc_expirar_rascunhos_anonimos();
end;
$$;

revoke all on function public.fc_srv_expirar_rascunhos_anon() from public, anon, authenticated;
grant execute on function public.fc_srv_expirar_rascunhos_anon() to service_role;

comment on index public.in_sub_anon_rasc_updated is
  'Acelera a expiração de DRAFT público anônimo sem qualquer vínculo de identidade, ordenado pelo último uso.';

notify pgrst, 'reload schema';

commit;

-- Rollback desta migration complementar:
-- begin;
--   drop index if exists public.in_sub_anon_rasc_updated;
--   -- As definições anteriores das duas funções estão em
--   -- 20260824120000_expirar_rascunhos_anonimos.sql. Em rollback completo da
--   -- funcionalidade, remover também fc_srv_expirar_rascunhos_anon(),
--   -- fc_expirar_rascunhos_anonimos(), fc_definir_retencao_anonima(integer),
--   -- a constraint e a coluna de retenção.
-- commit;
