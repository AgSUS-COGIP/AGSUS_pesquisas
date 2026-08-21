begin;

-- Presenca online passa a ser gravada e deixa de depender de canal Realtime.
--
-- O canal privado exigia permissao de leitura para entrar, portanto quem podia
-- apenas anunciar presenca era recusado antes de fazer track. A tabela abaixo
-- separa as duas operacoes: toda pessoa autenticada vinculada pode registrar a
-- propria batida; somente os perfis configurados podem consultar a lista.
--
-- A funcao de marca tambem volta a entregar, no mesmo contrato, as chaves de
-- e-mail e presenca que haviam sido perdidas em redefinicoes sucessivas.

---------------------------------------------------------------------------
-- 1. Marca: preservar todas as chaves atuais.
---------------------------------------------------------------------------
create or replace function public.fc_obter_marca_plataforma()
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select jsonb_build_object(
    'organizationName', no_organizacao,
    'productName', no_produto,
    'productDescription', ds_produto,
    'logoUrl', tx_url_logotipo,
    'logoPath', tx_caminho_logotipo,
    'primaryColor', co_cor_principal,
    'sidebarColor', co_cor_barra_lateral,
    'accessBackgroundUrl', tx_url_fundo_acesso,
    'accessBackgroundPath', tx_caminho_fundo_acesso,
    'accessPanelColor', co_cor_painel_acesso,
    'accessGreeting', tx_saudacao_acesso,
    'accessInstruction', tx_instrucao_acesso,
    'emailInstruction', tx_instrucao_email,
    'emailFooter', tx_rodape_email,
    'onlinePresenceEnabled', fl_presenca_online_ativa,
    'onlinePresenceViewerRoles', tx_perfis_visualizacao_presenca,
    'updatedAt', dt_alteracao
  )
  from public.tb_config_plataforma
  where co_configuracao = 1;
$$;

revoke all on function public.fc_obter_marca_plataforma() from public;
grant execute on function public.fc_obter_marca_plataforma() to anon, authenticated;

---------------------------------------------------------------------------
-- 2. Ultima batida por pessoa. Nao ha historico acumulado.
---------------------------------------------------------------------------
create table if not exists public.tb_presenca_online (
  sq_pessoa uuid not null,
  dt_visto_em timestamptz not null default timezone('utc', now()),
  constraint pk_presenca_online primary key (sq_pessoa),
  constraint fk_presenca_online_pessoa foreign key (sq_pessoa)
    references public.people (id) on delete cascade
);

comment on table public.tb_presenca_online is
  'Ultima batida de presenca de cada pessoa. Sobrescrita, nao acumulada: o historico de quem esteve online e dado descartavel.';

create index if not exists in_presenca_online_visto
  on public.tb_presenca_online (dt_visto_em desc);

alter table public.tb_presenca_online enable row level security;
revoke all on table public.tb_presenca_online from public, anon, authenticated;

---------------------------------------------------------------------------
-- 3. Registrar a propria presenca.
---------------------------------------------------------------------------
create or replace function public.fc_registrar_presenca()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_pessoa uuid := public.current_person_id();
begin
  if v_pessoa is null then
    raise exception 'Sessao sem cadastro institucional vinculado.';
  end if;

  if not (select private.can_track_platform_presence()) then
    return jsonb_build_object('status', 'DISABLED');
  end if;

  insert into public.tb_presenca_online (sq_pessoa, dt_visto_em)
  values (v_pessoa, timezone('utc', now()))
  on conflict (sq_pessoa) do update
    set dt_visto_em = timezone('utc', now());

  return jsonb_build_object('status', 'OK');
end;
$$;

revoke all on function public.fc_registrar_presenca() from public, anon;
grant execute on function public.fc_registrar_presenca() to authenticated;

comment on function public.fc_registrar_presenca() is
  'Registra a batida de presenca de quem chamou. Devolve DISABLED quando a presenca esta desligada na configuracao.';

---------------------------------------------------------------------------
-- 4. Listar quem esta online.
--
-- O contrato continua sendo um array JSON para manter compatibilidade com o
-- frontend atual. O recorte de 200 e definido pelas batidas mais recentes antes
-- da ordenacao alfabetica da resposta, evitando subconjunto arbitrario.
---------------------------------------------------------------------------
create or replace function public.fc_listar_presenca_online()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_result jsonb;
begin
  if not (select private.can_view_platform_presence()) then
    raise exception 'Acesso restrito aos perfis configurados para ver a presença.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(f) order by f."fullName", f."personId"), '[]'::jsonb)
  into v_result
  from (
    select
      p.id as "personId",
      p.full_name as "fullName",
      p.metadata->>'avatar_url' as "avatarUrl",
      (
        select sr.code
        from public.person_role_assignments pra
        join public.system_roles sr on sr.id = pra.role_id
        where pra.person_id = p.id
          and pra.starts_at <= timezone('utc', now())
          and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
        order by pra.starts_at desc, sr.code
        limit 1
      ) as "roleCode",
      pr.dt_visto_em as "onlineAt"
    from public.tb_presenca_online pr
    join public.people p on p.id = pr.sq_pessoa
    where pr.dt_visto_em > timezone('utc', now()) - interval '2 minutes'
      and p.active
    order by pr.dt_visto_em desc, p.full_name, p.id
    limit 200
  ) f;

  return v_result;
end;
$$;

revoke all on function public.fc_listar_presenca_online() from public, anon;
grant execute on function public.fc_listar_presenca_online() to authenticated;

comment on function public.fc_listar_presenca_online() is
  'Pessoas com batida de presenca nos ultimos 2 minutos. Restrita aos perfis configurados em tx_perfis_visualizacao_presenca.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_listar_presenca_online();
--   drop function if exists public.fc_registrar_presenca();
--   drop table if exists public.tb_presenca_online;
--   -- fc_obter_marca_plataforma precisa manter todas as chaves atuais.
-- commit;
