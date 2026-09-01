begin;

-- Duas regras de operação de ciclo que faltavam no banco.
--
-- 1) Período no futuro. Até aqui, `create_survey_draft` e `manage_survey_cycle`
--    exigiam apenas que o encerramento fosse posterior à abertura — nada impedia
--    agendar um ciclo para uma data já passada. Um rascunho salvo em março e
--    publicado em agosto entrava em SCHEDULED com período vencido, e o ciclo
--    nascia inoperante: `OPEN` recusava ("O encerramento informado já passou")
--    sem que a tela tivesse avisado antes. A validação passa a acontecer na
--    gravação, que é onde o operador ainda pode corrigir.
--
--    A regra vale só para período **informado agora**. Ciclo já gravado com data
--    vencida continua legível e editável — é justamente ele que o operador
--    precisa abrir para corrigir. Por isso a checagem entra em UPDATE_PERIOD e
--    em create_survey_draft, não em PUBLISH: bloquear a publicação de um
--    rascunho vencido deixaria o usuário sem caminho de saída dentro da tela.
--    Quem avisa antes de publicar é o frontend, por toast, pedindo a correção
--    do período — e SCHEDULE/OPEN seguem barrando o período vencido no banco.
--
--    A tolerância de um minuto (`now() - interval '1 minute'`) absorve o atraso
--    entre o operador preencher "abertura = agora" e a requisição chegar ao
--    banco. Sem ela, escolher o horário corrente falharia por segundos.
--
-- 2) Exclusão de avaliação em rascunho. Não havia como remover uma avaliação
--    criada por engano: `delete_survey_question` apagava pergunta, e nada mais.
--    `fc_excluir_pesquisa_rascunho` remove a avaliação inteira, e só enquanto
--    ela é descartável — versão em DRAFT e nenhuma resposta gravada. Publicada
--    ou com submissão, a exclusão é recusada com a razão explícita, porque
--    apagar instrumento publicado destruiria o histórico de quem respondeu.

create or replace function public.create_survey_draft(
  p_code text,
  p_name text,
  p_description text,
  p_application_name text,
  p_opens_at timestamptz default null,
  p_closes_at timestamptz default null,
  p_anonymous boolean default false,
  p_allow_drafts boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_person_id uuid;
  v_survey_id uuid;
  v_version_id uuid;
  v_application_id uuid;
  v_code text;
begin
  if not public.can_manage_surveys() then
    raise exception 'Você não possui permissão para criar pesquisas.';
  end if;

  v_code := upper(regexp_replace(btrim(p_code), '[^A-Za-z0-9_-]+', '-', 'g'));
  if v_code = '' then raise exception 'Informe um código válido.'; end if;
  if btrim(p_name) = '' then raise exception 'Informe o nome da pesquisa.'; end if;
  if p_opens_at is not null and p_opens_at < now() - interval '1 minute' then
    raise exception 'A abertura não pode ser anterior à data e hora atuais.';
  end if;
  if p_closes_at is not null and p_opens_at is not null and p_closes_at <= p_opens_at then
    raise exception 'A data de encerramento deve ser posterior à abertura.';
  end if;
  if p_closes_at is not null and p_opens_at is null and p_closes_at <= now() then
    raise exception 'O encerramento não pode ser anterior à data e hora atuais.';
  end if;

  select id into v_person_id from public.people where auth_user_id = auth.uid() limit 1;

  insert into public.surveys (code, name, description, status, settings, created_by)
  values (v_code, btrim(p_name), nullif(btrim(p_description), ''), 'DRAFT', '{}'::jsonb, v_person_id)
  returning id into v_survey_id;

  insert into public.survey_versions (survey_id, version_number, title, description, status, schema_version, settings, created_by)
  values (v_survey_id, 1, btrim(p_name), nullif(btrim(p_description), ''), 'DRAFT', 1, '{}'::jsonb, v_person_id)
  returning id into v_version_id;

  insert into public.survey_applications (
    survey_version_id, code, name, opens_at, closes_at, status,
    allow_drafts, allow_resubmission, anonymous, settings, created_by
  ) values (
    v_version_id,
    v_code || '-1',
    coalesce(nullif(btrim(p_application_name), ''), btrim(p_name)),
    p_opens_at,
    p_closes_at,
    case when p_opens_at is not null then 'SCHEDULED' else 'DRAFT' end,
    p_allow_drafts,
    false,
    p_anonymous,
    '{}'::jsonb,
    v_person_id
  ) returning id into v_application_id;

  insert into public.survey_sections (survey_version_id, code, title, description, position, settings)
  values (v_version_id, 'INTRO', 'Introdução', 'Seção inicial da pesquisa.', 1, '{}'::jsonb);

  return jsonb_build_object(
    'status','OK',
    'surveyId',v_survey_id,
    'versionId',v_version_id,
    'applicationId',v_application_id,
    'code',v_code
  );
end;
$$;

grant execute on function public.create_survey_draft(text,text,text,text,timestamptz,timestamptz,boolean,boolean) to authenticated;

-- Máquina de estados do ciclo: mesma definição vigente
-- (20260803133200_fix_survey_cycle_reopening.sql), acrescida da checagem de
-- abertura no passado em UPDATE_PERIOD. REOPEN já exigia encerramento futuro;
-- agora a abertura também não pode retroceder.
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
  v_before jsonb;
  v_after jsonb;
  v_next_status text;
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
    if target_opens_at is null or target_closes_at is null then
      raise exception 'Informe o novo período para reabrir o ciclo.';
    end if;
    if target_closes_at <= greatest(target_opens_at, now()) then
      raise exception 'O novo encerramento deve estar no futuro e após a abertura.';
    end if;
    if v_version.status <> 'PUBLISHED' then
      raise exception 'A versão precisa estar publicada para reabrir o ciclo.';
    end if;

    v_next_status := case
      when target_opens_at > now() then 'SCHEDULED'
      else 'OPEN'
    end;

    update public.survey_applications
    set status = v_next_status,
        opens_at = target_opens_at,
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

-- Exclusão de avaliação ainda descartável.
--
-- O `delete` desce por cascade a partir de survey_versions (seções, perguntas e
-- alternativas), mas survey_applications referencia a versão com
-- `on delete restrict` — a aplicação é apagada explicitamente, antes da versão.
-- A ordem importa: aplicação → versão → pesquisa.
--
-- A auditoria é gravada **antes** do delete e com `application_id` nulo: a
-- coluna referencia survey_applications, e apagar a aplicação levaria o evento
-- junto (ou impediria o delete). O identificador do ciclo fica preservado em
-- `metadata`, que é jsonb e não tem chave estrangeira.
create or replace function public.fc_excluir_pesquisa_rascunho(p_pesquisa uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor uuid := public.current_person_id();
  v_survey public.surveys%rowtype;
  v_version_id uuid;
  v_publicadas integer;
  v_submissoes integer;
  v_aplicacoes jsonb;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração.';
  end if;

  select * into v_survey
  from public.surveys
  where id = p_pesquisa
  for update;
  if v_survey.id is null then
    raise exception 'Avaliação não encontrada.';
  end if;

  -- Publicada uma única vez, a avaliação deixa de ser descartável: a estrutura
  -- vira referência histórica de quem respondeu, mesmo que o ciclo esteja
  -- encerrado ou cancelado.
  select count(*)::integer into v_publicadas
  from public.survey_versions
  where survey_id = p_pesquisa
    and status <> 'DRAFT';
  if v_publicadas > 0 then
    raise exception 'Esta avaliação já foi publicada e não pode ser excluída. Cancele o ciclo para encerrá-la.';
  end if;

  select count(*)::integer into v_submissoes
  from public.submissions s
  join public.survey_applications a on a.id = s.application_id
  join public.survey_versions v on v.id = a.survey_version_id
  where v.survey_id = p_pesquisa;
  if v_submissoes > 0 then
    raise exception 'Esta avaliação já possui respostas registradas e não pode ser excluída.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', a.id, 'code', a.code, 'status', a.status)), '[]'::jsonb)
  into v_aplicacoes
  from public.survey_applications a
  join public.survey_versions v on v.id = a.survey_version_id
  where v.survey_id = p_pesquisa;

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
    'SURVEY_DELETED',
    'SURVEY',
    v_survey.id::text,
    null,
    jsonb_build_object(
      'code', v_survey.code,
      'name', v_survey.name,
      'status', v_survey.status,
      'applications', v_aplicacoes
    ),
    null,
    jsonb_build_object('surveyId', v_survey.id, 'applications', v_aplicacoes)
  );

  -- application_participants, cddi_leadership_links e demais dependentes do
  -- ciclo caem por cascade; submissions referencia com `restrict`, e por isso a
  -- checagem acima é a garantia de que nada será destruído junto.
  for v_version_id in
    select id from public.survey_versions where survey_id = p_pesquisa
  loop
    delete from public.survey_applications where survey_version_id = v_version_id;
  end loop;

  -- Seções, perguntas e alternativas caem por cascade a partir da versão.
  delete from public.survey_versions where survey_id = p_pesquisa;
  delete from public.surveys where id = p_pesquisa;

  return jsonb_build_object(
    'status', 'OK',
    'code', v_survey.code,
    'name', v_survey.name
  );
end;
$$;

revoke all on function public.fc_excluir_pesquisa_rascunho(uuid) from public, anon;
grant execute on function public.fc_excluir_pesquisa_rascunho(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_excluir_pesquisa_rascunho(uuid);
--   -- Restaurar create_survey_draft e manage_survey_cycle reaplicando
--   -- 20260731131500_create_survey_draft_rpc.sql e
--   -- 20260803133200_fix_survey_cycle_reopening.sql, nesta ordem.
--   notify pgrst, 'reload schema';
-- commit;
