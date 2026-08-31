-- Reconciliação de drift: `sigav.assign_admin_all_available_participants`.
--
-- Esta migration NÃO altera produção funcionalmente. Ela alinha a definição
-- versionada ao que produção já executa, para que
--
--   reconstrução pela main == produção atual
--
-- volte a ser verdade nesta função.
--
-- ## A divergência
--
--                     | main reconstruída                  | produção
--   ------------------|------------------------------------|--------------------
--   pessoa ativa      | p.active                           | p.active
--   situação          | in ('ATIVO', 'NORMAL'), normalizada| = 'ATIVO'
--   exclusão por flag | leadership_reference_only          | evaluation_exempt
--
-- Ou seja: a definição versionada era mais permissiva em `employment_status` e
-- excluía um conjunto diferente de pessoas.
--
-- ## Por que persistiu sem ninguém ver
--
-- `20260826180000_migrar_schema_sigav.sql` reposiciona funções com
-- `alter function ... set schema`. O próprio arquivo registra, na linha 8, que
-- corpos de função são texto e não são reescritos por essa operação. Então o
-- corpo que produção tinha antes da mudança de schema continuou valendo, e
-- nenhuma migration posterior redefiniu esta função.
--
-- O portão `Database reconstruction` também não veria: ele reconstrói do zero,
-- e do zero a versão da main sempre vence. Ele prova que as migrations são
-- aplicáveis — não que produção corresponde a elas. Deriva desse tipo é
-- invisível para ele por construção.
--
-- ## ATENÇÃO — uma linha precisa de conferência humana
--
-- `evaluation_exempt` não existe em nenhum outro ponto deste repositório: não é
-- coluna de `sigav.people` e não aparece em migration alguma. A versão de
-- produção, portanto, foi escrita fora do histórico versionado.
--
-- Isso significa que a **forma** da expressão abaixo é inferida: ela espelha a
-- de `leadership_reference_only`, que é a única referência de estilo que existe
-- no repositório. A semântica pretendida — "pessoa marcada como isenta não
-- entra" — está correta, mas a expressão exata usada em produção precisa ser
-- conferida contra `pg_get_functiondef` antes do merge.
--
-- A diferença prática entre as formas candidatas aparece só com valor
-- malformado em `metadata`: `::boolean` sobre texto que não é booleano levanta
-- erro, enquanto uma comparação textual não levantaria.
--
-- ## Escopo
--
-- Autorização, grants, auditoria, contagens, retorno e o upsert permanecem
-- idênticos. A regra futura da Fase 1 (`people.active = true` como critério
-- canônico) **não** entra aqui de propósito: este PR reconcilia, não evolui.

create or replace function sigav.assign_admin_all_available_participants(
  target_application_id uuid,
  target_access_profile text default 'PARTICIPANTE'
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'sigav', 'auth'
as $function$
declare
  v_actor uuid := sigav.current_person_id();
  v_assigned integer := 0;
  v_reactivated integer := 0;
  v_skipped integer := 0;
begin
  if not sigav.can_manage_surveys() then
    raise exception 'Seu perfil não possui permissão para vincular participantes.';
  end if;
  if not exists(select 1 from sigav.survey_applications where id = target_application_id) then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  with candidates as (
    select p.id, ap.status
    from sigav.people p
    left join sigav.application_participants ap
      on ap.application_id = target_application_id
     and ap.person_id = p.id
     and ap.participant_role = 'RESPONDENT'
    where p.active
      -- Sem `upper`/`btrim` e sem 'NORMAL': é o predicado que produção executa.
      and p.employment_status = 'ATIVO'
      and coalesce((p.metadata->>'evaluation_exempt')::boolean, false) = false
  ), upserted as (
    insert into sigav.application_participants(
      application_id, person_id, participant_role, status, access_profile, invited_at, metadata
    )
    select
      target_application_id,
      id,
      'RESPONDENT',
      'ELIGIBLE',
      nullif(btrim(target_access_profile), ''),
      timezone('utc', now()),
      jsonb_build_object('assigned_by', v_actor, 'assigned_at', timezone('utc', now()), 'source', 'ADMIN_ALL_AVAILABLE')
    from candidates
    where status is null or status in ('BLOCKED', 'EXCLUDED')
    on conflict(application_id, person_id, participant_role) do update
      set status = 'ELIGIBLE',
          access_profile = coalesce(nullif(btrim(excluded.access_profile), ''), sigav.application_participants.access_profile),
          invited_at = coalesce(sigav.application_participants.invited_at, excluded.invited_at),
          metadata = coalesce(sigav.application_participants.metadata, '{}'::jsonb) || excluded.metadata,
          updated_at = timezone('utc', now())
    returning person_id
  )
  select
    count(*) filter(where c.status is null),
    count(*) filter(where c.status in ('BLOCKED', 'EXCLUDED')),
    count(*) filter(where c.status not in ('BLOCKED', 'EXCLUDED') and c.status is not null)
  into v_assigned, v_reactivated, v_skipped
  from candidates c;

  insert into sigav.audit_events(
    actor_person_id, event_type, entity_type, entity_id, application_id, after_data, metadata
  ) values (
    v_actor,
    'PARTICIPANT_ALL_AVAILABLE_ASSIGNMENT_COMPLETED',
    'SURVEY_APPLICATION',
    target_application_id::text,
    target_application_id,
    jsonb_build_object('assignedCount', v_assigned, 'reactivatedCount', v_reactivated, 'skippedCount', v_skipped),
    jsonb_build_object('source', 'ADMIN_ALL_AVAILABLE')
  );

  return jsonb_build_object(
    'status', 'OK',
    'assignedCount', v_assigned,
    'reactivatedCount', v_reactivated,
    'skippedCount', v_skipped
  );
end;
$function$;

-- Privilégios repetidos na íntegra para que a definição versionada seja
-- determinística: reconstruir do zero não deve depender de migration anterior.
revoke all on function sigav.assign_admin_all_available_participants(uuid, text) from public;

-- NOTA DE MERGE (31/08/2026): os `grant execute ... to authenticated` que
-- acompanhavam este bloco foram removidos ao integrar esta migration na branch
-- do schema único. As roles do contrato PostgREST saíram do cluster em
-- 20260828140000_remover_roles_legadas_do_cluster.sql, e nomeá-las aqui faria a
-- migration falhar com "role does not exist". Quem executa é a dona das funções
-- (por posse) e, onde a credencial de runtime é separada, a `app_user` recebe
-- EXECUTE pelos default privileges. O `revoke ... from public` continua: PUBLIC
-- não é role, é a ausência de restrição.

comment on function sigav.assign_admin_all_available_participants(uuid, text) is
  'Vincula todas as pessoas elegíveis ao ciclo. Elegibilidade: active, employment_status = ''ATIVO'' e metadata.evaluation_exempt ausente ou falso. Definição reconciliada com produção em 28/08/2026.';

notify pgrst, 'reload schema';
