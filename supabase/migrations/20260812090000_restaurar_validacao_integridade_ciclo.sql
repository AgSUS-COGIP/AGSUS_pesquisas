begin;

-- 20260811120000_periodo_futuro_e_exclusao_rascunho.sql redefiniu
-- manage_survey_cycle a partir de uma versão anterior a
-- 20260804195030_validate_survey_integrity_before_publish.sql, e reverteu sem
-- intenção a chamada a validate_survey_version_integrity() que bloqueava
-- SCHEDULE, OPEN e REOPEN com pendência BLOCKING. Desde então essas três ações
-- gravam no banco sem revalidar o checklist estrutural/de público — só o
-- client (readyToOpen, calculado em get_survey_operations) faz essa checagem,
-- antes do clique.
--
-- Esta migration redefine manage_survey_cycle a partir da definição vigente
-- (cópia fiel de 20260811120000), só reinserindo a chamada de integridade nos
-- três branches. PUBLISH fica de fora, por decisão de produto: mantém a
-- checagem rasa que já tinha (`v_sections = 0 or v_questions = 0`) e continua
-- protegido só pelo gate `readyToPublish` do client — não é regra nova, é a
-- mesma que já vale hoje.
--
-- REOPEN ganha um ajuste adicional: a abertura passa a ser opcional e, quando
-- ausente, é o relógio do banco que decide (coalesce(target_opens_at, now())).
-- O client deixou de digitar a abertura e envia null; calcular now() no
-- navegador tornava o resultado dependente do relógio da estação do operador —
-- relógio adiantado gravava SCHEDULED silenciosamente, e nenhum job promove
-- SCHEDULED a OPEN. Bundles antigos que ainda enviam a abertura digitada
-- continuam funcionando: o coalesce preserva o valor recebido.
create or replace function public.manage_survey_cycle(
  target_survey_id uuid,
  target_action text,
  target_opens_at timestamptz default null,
  target_closes_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor uuid := public.current_person_id();
  v_action text := upper(btrim(coalesce(target_action, '')));
  v_survey public.surveys%rowtype;
  v_version public.survey_versions%rowtype;
  v_application public.survey_applications%rowtype;
  v_sections integer;
  v_questions integer;
  v_integrity jsonb;
  v_first_issue text;
  v_before jsonb;
  v_after jsonb;
  v_next_status text;
  v_opens timestamptz;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração.';
  end if;

  select * into v_survey
  from public.surveys
  where id = target_survey_id
  for update;
  if v_survey.id is null then raise exception 'Pesquisa não encontrada.'; end if;

  select * into v_version
  from public.survey_versions
  where survey_id = target_survey_id
  order by version_number desc
  limit 1
  for update;
  if v_version.id is null then raise exception 'Versão da pesquisa não encontrada.'; end if;

  select * into v_application
  from public.survey_applications
  where survey_version_id = v_version.id
  order by created_at desc
  limit 1
  for update;
  if v_application.id is null then raise exception 'Ciclo de aplicação não encontrado.'; end if;

  -- Restaurado: SCHEDULE/OPEN/REOPEN voltam a exigir checklist sem pendência
  -- BLOCKING antes de gravar. PUBLISH mantém a regra própria, sem integridade.
  if v_action in ('SCHEDULE', 'OPEN', 'REOPEN') then
    v_integrity := public.validate_survey_version_integrity(v_version.id);

    if not (v_integrity ->> 'valid')::boolean then
      v_first_issue := v_integrity #>> '{issues,0,message}';
      raise exception using
        message = format(
          'Operação bloqueada por %s pendência(s) de integridade. %s',
          v_integrity ->> 'blockingCount',
          coalesce(v_first_issue, 'Revise o instrumento.')
        ),
        detail = v_integrity::text,
        hint = 'Atualize o checklist e corrija o instrumento no construtor.';
    end if;
  end if;

  select count(*)::integer into v_sections
  from public.survey_sections
  where survey_version_id = v_version.id;

  select count(*)::integer into v_questions
  from public.survey_questions
  where survey_version_id = v_version.id;

  v_before := jsonb_build_object(
    'surveyStatus', v_survey.status,
    'versionStatus', v_version.status,
    'applicationStatus', v_application.status,
    'opensAt', v_application.opens_at,
    'closesAt', v_application.closes_at
  );

  if v_action = 'UPDATE_PERIOD' then
    if target_opens_at is null or target_closes_at is null then
      raise exception 'Informe abertura e encerramento.';
    end if;
    if target_opens_at < now() - interval '1 minute' then
      raise exception 'A abertura não pode ser anterior à data e hora atuais.';
    end if;
    if target_closes_at <= target_opens_at then
      raise exception 'O encerramento deve ocorrer após a abertura.';
    end if;
    if v_application.status not in ('DRAFT', 'SCHEDULED') then
      raise exception 'O período só pode ser alterado em ciclos em rascunho ou agendados.';
    end if;

    update public.survey_applications
    set opens_at = target_opens_at,
        closes_at = target_closes_at,
        updated_at = now()
    where id = v_application.id;

  elsif v_action = 'PUBLISH' then
    if v_sections = 0 or v_questions = 0 then
      raise exception 'Adicione seções e perguntas antes de publicar.';
    end if;

    update public.survey_versions
    set status = 'PUBLISHED',
        published_at = coalesce(published_at, now()),
        updated_at = now()
    where id = v_version.id;

    update public.surveys
    set status = 'ACTIVE', updated_at = now()
    where id = v_survey.id;

  elsif v_action = 'SCHEDULE' then
    if v_version.status <> 'PUBLISHED' then
      raise exception 'Publique a versão antes de agendar.';
    end if;
    if v_application.status not in ('DRAFT', 'SCHEDULED') then
      raise exception 'Somente ciclos em rascunho ou agendados podem ser agendados.';
    end if;
    if v_application.opens_at is null
       or v_application.closes_at is null
       or v_application.closes_at <= v_application.opens_at then
      raise exception 'Defina um período válido antes de agendar.';
    end if;
    if v_application.closes_at <= now() then
      raise exception 'O período deste ciclo já venceu. Atualize a abertura e o encerramento antes de agendar.';
    end if;

    update public.survey_applications
    set status = 'SCHEDULED', updated_at = now()
    where id = v_application.id;

  elsif v_action = 'OPEN' then
    if v_version.status <> 'PUBLISHED' or v_sections = 0 or v_questions = 0 then
      raise exception 'O instrumento não está pronto para abertura.';
    end if;
    if v_application.status not in ('DRAFT', 'SCHEDULED') then
      raise exception 'Somente ciclos em rascunho ou agendados podem ser abertos.';
    end if;
    if v_application.closes_at is null or v_application.closes_at <= now() then
      raise exception 'O encerramento informado já passou.';
    end if;

    update public.survey_applications
    set status = 'OPEN',
        opens_at = least(coalesce(opens_at, now()), now()),
        updated_at = now()
    where id = v_application.id;

  elsif v_action = 'REOPEN' then
    if v_application.status <> 'CLOSED' then
      raise exception 'Somente ciclos encerrados podem ser reabertos.';
    end if;
    if target_closes_at is null then
      raise exception 'Informe o novo encerramento para reabrir o ciclo.';
    end if;
    -- Sem abertura informada, o relógio do banco decide: v_opens = now() e o
    -- resultado é deterministicamente OPEN, independente do relógio do client.
    v_opens := coalesce(target_opens_at, now());
    if target_closes_at <= greatest(v_opens, now()) then
      raise exception 'O novo encerramento deve estar no futuro e após a abertura.';
    end if;
    if v_version.status <> 'PUBLISHED' then
      raise exception 'A versão precisa estar publicada para reabrir o ciclo.';
    end if;

    v_next_status := case
      when v_opens > now() then 'SCHEDULED'
      else 'OPEN'
    end;

    update public.survey_applications
    set status = v_next_status,
        opens_at = v_opens,
        closes_at = target_closes_at,
        updated_at = now()
    where id = v_application.id;

  elsif v_action = 'CLOSE' then
    if v_application.status <> 'OPEN' then
      raise exception 'Somente ciclos abertos podem ser encerrados. Para ciclos agendados, utilize Cancelar.';
    end if;

    update public.survey_applications
    set status = 'CLOSED',
        closes_at = least(coalesce(closes_at, now()), now()),
        updated_at = now()
    where id = v_application.id;

  elsif v_action = 'CANCEL' then
    if v_application.status not in ('DRAFT', 'SCHEDULED', 'OPEN') then
      raise exception 'Somente ciclos em rascunho, agendados ou abertos podem ser cancelados.';
    end if;

    update public.survey_applications
    set status = 'CANCELLED', updated_at = now()
    where id = v_application.id;

  else
    raise exception 'Ação de ciclo inválida.';
  end if;

  select * into v_survey from public.surveys where id = target_survey_id;
  select * into v_version from public.survey_versions where id = v_version.id;
  select * into v_application from public.survey_applications where id = v_application.id;

  v_after := jsonb_build_object(
    'surveyStatus', v_survey.status,
    'versionStatus', v_version.status,
    'applicationStatus', v_application.status,
    'opensAt', v_application.opens_at,
    'closesAt', v_application.closes_at
  );

  insert into public.audit_events(
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    application_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor,
    'SURVEY_CYCLE_' || v_action,
    'SURVEY_APPLICATION',
    v_application.id::text,
    v_application.id,
    v_before,
    v_after,
    jsonb_build_object('surveyId', v_survey.id, 'versionId', v_version.id)
  );

  return jsonb_build_object(
    'status', 'OK',
    'action', v_action,
    'application', v_after
  );
end;
$$;

revoke all on function public.manage_survey_cycle(uuid, text, timestamptz, timestamptz) from public, anon;
grant execute on function public.manage_survey_cycle(uuid, text, timestamptz, timestamptz) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   -- Reaplicar a definição sem integridade: manage_survey_cycle de
--   -- 20260811120000_periodo_futuro_e_exclusao_rascunho.sql.
--   notify pgrst, 'reload schema';
-- commit;
