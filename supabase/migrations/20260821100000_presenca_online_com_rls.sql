begin;

-- Presença online passa a ser gravada, e para de depender de canal Realtime.
--
-- O defeito
-- O desenho pretendido — todos anunciam que estão online, só perfis
-- configurados enxergam a lista — **já estava certo no banco**. Existem duas
-- políticas separadas em `realtime.messages`: leitura atrás de
-- `private.can_view_platform_presence()` e track atrás de
-- `private.can_track_platform_presence()`.
--
-- O que não funciona é o protocolo. O Realtime exige permissão de **leitura**
-- para *entrar* num canal privado, e sem entrar não há como fazer `track`. Logo
-- o portão de leitura bloqueia o anúncio também: quem não é perfil de
-- visualização é recusado no join, nunca aparece, e cada carregamento de página
-- registra `Unauthorized: You do not have permissions to read from this Channel
-- topic: platform-online` no log do Realtime.
--
-- Resultado em produção até 21/08/2026: a lista mostrava **apenas** perfis de
-- visualização, e todos os demais geravam erro a cada abertura de tela. O
-- recurso estava quebrado e barulhento ao mesmo tempo.
--
-- A correção
-- Canal privado é a ferramenta errada para "escrever sem ler". A presença passa
-- a ser uma tabela: cada pessoa grava a própria batida, e quem tem permissão lê
-- a lista por RPC. A autorização continua no banco, com os **mesmos** portões
-- de `private` — reimplementar a checagem de perfil aqui criaria a segunda
-- fonte que divergiria da primeira na correção seguinte.
--
-- As políticas de `realtime.messages` ficam onde estão de propósito: o bundle
-- publicado hoje ainda assina o canal, e removê-las antes do frontend novo
-- estar no ar tiraria a presença de quem hoje a vê. Ficam inertes assim que
-- nada mais assinar, e podem sair numa limpeza posterior.
--
-- Bônus obrigatório: `fc_obter_marca_plataforma()` volta a devolver as duas
-- chaves de presença. Elas existiam em `20260819135306` e foram perdidas quando
-- `20260820120000` redefiniu a função para acrescentar os textos de e-mail —
-- mesma classe de erro que apagou `nu_tentativas` da fila. Sem elas o cliente
-- caía nos padrões do código e podia mostrar o indicador a um perfil que o
-- banco recusa, o que **produzia** parte do erro descrito acima.

---------------------------------------------------------------------------
-- 1. Marca: as 17 chaves, sem perder nenhuma das duas frentes.
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
-- 2. A batida de presença.
--
-- Uma linha por pessoa, sobrescrita a cada batida — o histórico não interessa,
-- e guardá-lo faria a tabela crescer sem limite com dado descartável.
---------------------------------------------------------------------------
create table if not exists public.tb_presenca_online (
  sq_pessoa uuid not null,
  dt_visto_em timestamptz not null default timezone('utc', now()),
  constraint pk_presenca_online primary key (sq_pessoa),
  constraint fk_presenca_online_pessoa foreign key (sq_pessoa)
    references public.people (id) on delete cascade
);

comment on table public.tb_presenca_online is
  'Última batida de presença de cada pessoa. Sobrescrita, não acumulada: o histórico de quem esteve online é dado descartável.';

-- A leitura filtra por janela de tempo, então o índice é sobre ela.
create index if not exists in_presenca_online_visto
  on public.tb_presenca_online (dt_visto_em desc);

alter table public.tb_presenca_online enable row level security;
revoke all on table public.tb_presenca_online from public, anon, authenticated;

---------------------------------------------------------------------------
-- 3. Registrar a própria presença.
--
-- Não recebe identificador: a pessoa é sempre quem chamou. Rota com parâmetro
-- exigiria verificar que o parâmetro é o próprio chamador — verificação que se
-- esquece.
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
    raise exception 'Sessão sem cadastro institucional vinculado.';
  end if;

  -- Mesmo portão do track do Realtime: com a presença desligada na
  -- configuração, ninguém registra nada. Reusar o portão é o que impede duas
  -- regras divergentes para a mesma decisão.
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
  'Registra a batida de presença de quem chamou. Devolve DISABLED quando a presença está desligada na configuração.';

---------------------------------------------------------------------------
-- 4. Listar quem está online.
--
-- A janela de dois minutos tolera uma batida perdida sem deixar fantasma na
-- lista: o cliente bate a cada 45 segundos, então duas falhas seguidas são
-- necessárias para alguém desaparecer indevidamente.
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
  -- O mesmo portão que a política de leitura do Realtime usava. Quem não pode
  -- ver recebe erro, e não lista vazia: a tela precisa distinguir os dois.
  if not (select private.can_view_platform_presence()) then
    raise exception 'Acesso restrito aos perfis configurados para ver a presença.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(f) order by f."fullName"), '[]'::jsonb)
  into v_result
  from (
    select
      p.id as "personId",
      p.full_name as "fullName",
      p.metadata->>'avatar_url' as "avatarUrl",
      -- O código do perfil, não o rótulo: a tradução para português é da
      -- interface, como no resto do projeto.
      (
        select sr.code
        from public.person_role_assignments pra
        join public.system_roles sr on sr.id = pra.role_id
        where pra.person_id = p.id and pra.ends_at is null
        limit 1
      ) as "roleCode",
      pr.dt_visto_em as "onlineAt"
    from public.tb_presenca_online pr
    join public.people p on p.id = pr.sq_pessoa
    where pr.dt_visto_em > timezone('utc', now()) - interval '2 minutes'
      and p.active
    limit 200
  ) f;

  return v_result;
end;
$$;

revoke all on function public.fc_listar_presenca_online() from public, anon;
grant execute on function public.fc_listar_presenca_online() to authenticated;

comment on function public.fc_listar_presenca_online() is
  'Pessoas com batida de presença nos últimos 2 minutos. Restrita aos perfis configurados em tx_perfis_visualizacao_presenca.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_listar_presenca_online();
--   drop function if exists public.fc_registrar_presenca();
--   drop table if exists public.tb_presenca_online;
--   -- fc_obter_marca_plataforma precisa manter as 17 chaves; voltar a uma
--   -- versão anterior perde as de e-mail ou as de presença.
-- commit;
