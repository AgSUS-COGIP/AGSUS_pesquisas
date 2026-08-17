begin;

-- Seletor não oferece ciclo de avaliação arquivada nem ciclo cancelado.
--
-- O defeito, como ele aparece
-- ---------------------------
-- Cancelar um ciclo pelo catálogo arquiva a avaliação: `manage_survey_cycle`
-- com `CANCEL` grava `surveys.dt_arquivamento` (20260814090000). O catálogo
-- respeita isso — `list_managed_surveys` filtra `dt_arquivamento is null` — e a
-- avaliação some de `/admin/pesquisas`. Para quem opera, ela deixou de existir.
--
-- `list_admin_participant_applications` não respeitava, e não por esquecimento
-- de uma cláusula: ela **não fazia join com `public.surveys`**. Não tinha como
-- saber que a avaliação estava arquivada. Também não filtrava `status`, então
-- os cinco valores possíveis entravam, cancelado inclusive.
--
-- O efeito não é um item a mais no fim da lista. A função ordena por `code` e
-- as três telas que a consomem fazem `setApplicationId(rows[0]?.id)` —
-- `admin-participant-management`, `admin-participant-bulk-selector` e
-- `admin-people-teams-management`, esta última em `/admin/equipes`. Um ciclo
-- cancelado cujo código venha antes no alfabeto vira a **seleção padrão** de
-- toda abertura da tela. Foi o que aconteceu com `BOMDIA-1`, arquivado em
-- 13/08/2026, que passou a abrir na frente de `CDDI-2026`.
--
-- E ele não sai sozinho: `fc_expirar_pesquisas_arq` só remove arquivada sem
-- submissões **e sem versão fora de `DRAFT`**. Avaliação publicada fica
-- arquivada indefinidamente, de propósito, para preservar histórico. Sem esta
-- correção, o ciclo cancelado é permanente na tela.
--
-- A regra não é nova
-- ------------------
-- "Seletor não oferece ciclo de avaliação arquivada" é o que
-- `list_managed_surveys` já pratica. Aqui ela só passa a valer nos outros
-- lugares que agem sobre um ciclo. Nada é destruído: a avaliação continua
-- arquivada, listada por `fc_listar_pesquisas_arq` e restaurável por
-- `UNARCHIVE`.
--
-- Onde a regra vale e onde não vale
-- ---------------------------------
-- Vale nas três funções que alimentam **ação** sobre um ciclo:
--
--   list_admin_participant_applications  vincular pessoas ao ciclo
--   fc_listar_ciclos_lideranca           avaliar a equipe
--   fc_obter_ciclo_cddi_vigente          o ciclo em que a pessoa responde
--
-- Nas duas primeiras não faz sentido agir sobre ciclo cancelado. Na terceira é
-- semântica: "vigente" não pode ser cancelado — hoje ela aceitava, porque
-- filtrava apenas `DRAFT`, e o `else 2` da ordenação deixava o cancelado
-- elegível quando não houvesse `OPEN` nem `SCHEDULED`.
--
-- **`fc_listar_ciclos_pesquisa` fica fora de propósito.** Ela alimenta o painel
-- e `/admin/respostas`, que são superfícies de **leitura** sobre uma avaliação
-- já escolhida. Esconder ciclo cancelado ali esconderia respostas coletadas
-- antes do cancelamento — o oposto de preservar histórico. Se um dia a lista de
-- avaliações dessas telas passar a oferecer arquivadas, o filtro entra lá, não
-- aqui.
--
-- Acentos corrompidos
-- -------------------
-- `list_admin_participant_applications` guardava as duas mensagens de erro com
-- dupla codificação (`permissÃ£o`), vindas de `20260812170000` — a única
-- migration do repositório com esse defeito, e a mesma origem do
-- `SEM INFORMAÇÃO` corrompido já corrigido no painel do CDDI. Corrigido aqui
-- porque a função está sendo reescrita de qualquer forma. As outras cinco RPCs
-- de participantes afetadas pelo mesmo arquivo continuam corrompidas e pedem
-- migration própria.
--
-- Os corpos abaixo são os que estavam em produção, com essas mudanças e nada
-- mais. Foram extraídos do próprio banco em bytes, e não como texto, para não
-- introduzir corrupção nova ao reescrevê-los.

---------------------------------------------------------------------------
-- Vincular pessoas a um ciclo.
---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.list_admin_participant_applications()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
begin
  if not public.can_manage_surveys() then
    raise exception 'Seu perfil não possui permissão para gerenciar participantes.';
  end if;

  return (
    select coalesce(jsonb_agg(item order by item->>'code'), '[]'::jsonb)
    from (
      select jsonb_build_object(
        'id', sa.id,
        'code', sa.code,
        'name', sa.name,
        'status', sa.status,
        'accessMode', sa.access_mode,
        'opensAt', sa.opens_at,
        'closesAt', sa.closes_at,
        'participantCount', count(ap.id),
        'completedCount', count(ap.id) filter (where ap.status = 'COMPLETED')
      ) as item
      from public.survey_applications sa
      -- O join existe para chegar em `surveys.dt_arquivamento`. Sem ele a
      -- função não tinha como saber que a avaliação foi arquivada.
      join public.survey_versions sv on sv.id = sa.survey_version_id
      join public.surveys s on s.id = sv.survey_id
      left join public.application_participants ap
        on ap.application_id = sa.id
       and ap.participant_role = 'RESPONDENT'
       and ap.status <> 'EXCLUDED'
      where s.dt_arquivamento is null
        and sa.status <> 'CANCELLED'
      -- Agrupar pela chave primária basta: as demais colunas de `sa` dependem
      -- funcionalmente dela, e os dois joins são 1:1 por chave estrangeira.
      group by sa.id
    ) q
  );
end;
$function$;

---------------------------------------------------------------------------
-- Ciclos em que a pessoa lidera equipe (seletor de `/equipe`).
---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fc_listar_ciclos_lideranca()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
declare
  v_person_id uuid;
  v_result jsonb;
begin
  v_person_id := public.current_person_id();
  if v_person_id is null then
    raise exception 'Cadastro institucional não identificado.';
  end if;

  select coalesce(jsonb_agg(cycle order by cycle_sort desc), '[]'::jsonb)
  into v_result
  from (
    select
      jsonb_build_object(
        'id', sa.id,
        'code', sa.code,
        'name', sa.name,
        'status', sa.status,
        'opensAt', sa.opens_at,
        'closesAt', sa.closes_at
      ) as cycle,
      coalesce(sa.closes_at, sa.opens_at, sa.created_at) as cycle_sort
    from public.survey_applications sa
    join public.survey_versions sv on sv.id = sa.survey_version_id
    join public.surveys s on s.id = sv.survey_id
    where s.dt_arquivamento is null
      and sa.status <> 'CANCELLED'
      and exists (
        select 1
        from public.cddi_leadership_links l
        where l.application_id = sa.id
          and l.leader_person_id = v_person_id
          and l.status = 'ACTIVE'
          and l.valid_to is null
      )
  ) cycles;

  return v_result;
end;
$function$;

---------------------------------------------------------------------------
-- O ciclo do CDDI em que a pessoa responde.
---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fc_obter_ciclo_cddi_vigente()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'auth'
AS $function$
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
    and pesquisa.dt_arquivamento is null
    -- Rascunho não tem público nem período; cancelado não é vigente. Sem esta
    -- segunda condição o `else 2` da ordenação abaixo elegia o cancelado
    -- quando não houvesse ciclo aberto nem agendado.
    and aplicacao.status not in ('DRAFT', 'CANCELLED')
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
$function$;

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   -- Restaurar as definições anteriores traz de volta o ciclo cancelado como
--   -- seleção padrão de /admin/participantes e /admin/equipes.
-- commit;
