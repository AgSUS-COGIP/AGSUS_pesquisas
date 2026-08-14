begin;

-- Arquivamento de avaliação, com expiração automática em 30 dias.
--
-- "Finalizar avaliação" (ação CANCEL do ciclo) até aqui só cancelava o ciclo
-- de aplicação (`survey_applications.status = 'CANCELLED'`) e não tinha
-- volta — a avaliação continuava para sempre no catálogo administrativo,
-- misturada com as ativas. A partir de agora, finalizar também arquiva a
-- pesquisa: ela some do catálogo padrão, fica disponível por até 30 dias numa
-- lista à parte ("avaliações arquivadas") e, se ninguém agir, é excluída.
--
-- Não há infraestrutura de job agendado neste projeto (sem pg_cron, sem
-- Vercel Cron) e criar uma agora seria desproporcional a esta necessidade. A
-- expiração é avaliada de forma preguiçosa: as duas RPCs de listagem chamam
-- `fc_expirar_pesquisas_arq()` antes de montar o resultado. O catálogo se
-- autolimpa sempre que alguém o abre, sem depender de nada externo.

-- Colunas do recurso de modelos.
--
-- Quando este arquivo foi escrito, `st_modelo` e `tx_categoria_modelo` existiam
-- no banco de produção sem constar de nenhuma migration — tinham sido aplicadas
-- por SQL direto, como já aconteceu antes neste projeto (ver
-- docs/operacao-permissoes.md). Declará-las aqui era o que impedia a cláusula
-- `st_modelo = false` de `list_managed_surveys` de quebrar um banco
-- reconstruído do zero (`supabase db reset`, usado pelo CI).
--
-- Desde então `20260813190000_galeria_de_modelos.sql` passou a versioná-las, e
-- roda antes desta migration — o passo abaixo virou redundante. Fica por ser
-- inerte: `if not exists` não altera coluna existente, e removê-lo agora só
-- criaria diferença entre este arquivo e o que já rodou em produção.
alter table public.surveys
  add column if not exists st_modelo boolean not null default false;

alter table public.surveys
  add column if not exists tx_categoria_modelo text;

alter table public.surveys
  add column if not exists dt_arquivamento timestamptz;

comment on column public.surveys.dt_arquivamento is
  'Carimbo de quando a avaliação foi arquivada. Nulo = ativa. Preenchida há mais de 30 dias = candidata a exclusão automática (ver fc_expirar_pesquisas_arq).';

-- Expira arquivamentos vencidos antes de qualquer listagem.
--
-- Segue o mesmo cuidado de `fc_excluir_pesquisa_rascunho`: só remove o que é
-- seguro remover. Avaliação publicada ou com submissões preserva histórico —
-- fica arquivada indefinidamente, sem expirar, em vez de destruir respostas de
-- quem participou.
--
-- O laço interno usa variável própria (`v_versao`). Reaproveitar o registro do
-- laço externo o sobrescreveria, e os `delete` finais passariam a receber o id
-- da versão no lugar do id da pesquisa — apagando nada e reinserindo o mesmo
-- evento de auditoria a cada chamada.
create or replace function public.fc_expirar_pesquisas_arq()
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_pesquisa record;
  v_versao uuid;
begin
  for v_pesquisa in
    select s.id, s.code, s.name
    from public.surveys s
    where s.dt_arquivamento is not null
      and s.dt_arquivamento < now() - interval '30 days'
      and not exists (
        select 1
        from public.submissions sub
        join public.survey_applications a on a.id = sub.application_id
        join public.survey_versions v on v.id = a.survey_version_id
        where v.survey_id = s.id
      )
      and not exists (
        select 1
        from public.survey_versions v
        where v.survey_id = s.id
          and v.status <> 'DRAFT'
      )
    for update of s skip locked
  loop
    -- A auditoria é gravada antes do delete e com `application_id` nulo: a
    -- coluna referencia survey_applications, que será apagada em seguida.
    insert into public.audit_events(
      actor_person_id, event_type, entity_type, entity_id, application_id,
      before_data, after_data, metadata
    ) values (
      null, 'SURVEY_ARCHIVE_EXPIRED', 'SURVEY', v_pesquisa.id::text, null,
      jsonb_build_object('code', v_pesquisa.code, 'name', v_pesquisa.name),
      null,
      jsonb_build_object('surveyId', v_pesquisa.id, 'reason', 'archived_over_30_days')
    );

    -- survey_applications referencia a versão com `on delete restrict`, então
    -- é apagada explicitamente antes dela.
    for v_versao in
      select id from public.survey_versions where survey_id = v_pesquisa.id
    loop
      delete from public.survey_applications where survey_version_id = v_versao;
    end loop;

    delete from public.survey_versions where survey_id = v_pesquisa.id;
    delete from public.surveys where id = v_pesquisa.id;
  end loop;
end;
$$;

revoke all on function public.fc_expirar_pesquisas_arq() from public, anon;
grant execute on function public.fc_expirar_pesquisas_arq() to authenticated;

-- `manage_survey_cycle`: CANCEL passa a arquivar a pesquisa junto, e ganha as
-- ações ARCHIVE (arquivar direto do catálogo) e UNARCHIVE (restaurar dentro da
-- janela de 30 dias, reversível porque nada foi apagado ainda).
--
-- ARCHIVE, diferente de CANCEL, não age sobre o ciclo: ele exige que o ciclo
-- já esteja parado (fora de SCHEDULED/OPEN). Arquivar uma avaliação em
-- andamento esconderia do catálogo um ciclo que ainda recebe resposta — quem
-- quer interromper usa Pausar ou Finalizar, que dizem isso ao operador.
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
    'closesAt', v_application.closes_at,
    'archivedAt', v_survey.dt_arquivamento
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

    -- Finalizar arquiva na mesma operação: some do catálogo padrão e entra na
    -- janela de 30 dias que antecede a exclusão automática.
    update public.surveys
    set dt_arquivamento = now(), updated_at = now()
    where id = v_survey.id;

  elsif v_action = 'ARCHIVE' then
    if v_survey.dt_arquivamento is not null then
      raise exception 'Esta avaliação já está arquivada.';
    end if;
    if v_application.status in ('SCHEDULED', 'OPEN') then
      raise exception 'Interrompa o ciclo antes de arquivar — use Pausar ou Finalizar.';
    end if;

    update public.surveys
    set dt_arquivamento = now(), updated_at = now()
    where id = v_survey.id;

  elsif v_action = 'UNARCHIVE' then
    if v_survey.dt_arquivamento is null then
      raise exception 'Esta avaliação não está arquivada.';
    end if;

    update public.surveys
    set dt_arquivamento = null, updated_at = now()
    where id = v_survey.id;

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
    'closesAt', v_application.closes_at,
    'archivedAt', v_survey.dt_arquivamento
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

-- `list_managed_surveys`: mantém a assinatura **sem argumento**.
--
-- A tentação era acrescentar `p_incluir_arquivadas boolean default false` e
-- servir as duas visões pela mesma função. Isso quebraria o catálogo: uma
-- função com argumento opcional não substitui a de zero argumentos, cria uma
-- sobrecarga ao lado dela, e a chamada sem argumento — que é a que todo bundle
-- publicado faz — passa a ser ambígua para o Postgres. A visão de arquivadas
-- ganhou função própria (`fc_listar_pesquisas_arquivadas`).
--
-- Duas coisas da definição que estava viva no banco são preservadas de
-- propósito: o filtro `st_modelo = false`, que mantém os modelos fora do
-- catálogo de avaliações, e o retorno em camelCase consumido pela tela.
--
-- A verificação `can_manage_surveys()` é **restaurada**: a definição em
-- produção a havia perdido, deixando uma função `security definer` com
-- `execute` para `authenticated` capaz de enumerar todas as avaliações da
-- plataforma a qualquer pessoa autenticada, inclusive participante comum.
create or replace function public.list_managed_surveys()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare v_result jsonb;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  perform public.fc_expirar_pesquisas_arq();

  select coalesce(jsonb_agg(jsonb_build_object(
    'surveyId', s.id,
    'code', s.code,
    'name', s.name,
    'description', s.description,
    'status', s.status,
    'archivedAt', s.dt_arquivamento,
    'versionId', sv.id,
    'versionNumber', sv.version_number,
    'versionStatus', sv.status,
    'applicationId', sa.id,
    'applicationCode', sa.code,
    'applicationName', sa.name,
    'applicationStatus', sa.status,
    'opensAt', sa.opens_at,
    'closesAt', sa.closes_at,
    'sections', (select count(*) from public.survey_sections sec where sec.survey_version_id = sv.id),
    'questions', (select count(*) from public.survey_questions q where q.survey_version_id = sv.id),
    'updatedAt', greatest(s.updated_at, sv.updated_at, coalesce(sa.updated_at, s.updated_at))
  ) order by greatest(s.updated_at, sv.updated_at, coalesce(sa.updated_at, s.updated_at)) desc), '[]'::jsonb)
  into v_result
  from public.surveys s
  join lateral (
    select * from public.survey_versions x where x.survey_id = s.id order by x.version_number desc limit 1
  ) sv on true
  left join lateral (
    select * from public.survey_applications a where a.survey_version_id = sv.id order by a.created_at desc limit 1
  ) sa on true
  where s.st_modelo = false
    and s.dt_arquivamento is null;

  return v_result;
end;
$$;

revoke all on function public.list_managed_surveys() from public, anon;
grant execute on function public.list_managed_surveys() to authenticated;

-- Avaliações arquivadas, para a visão à parte do catálogo.
--
-- Mesmo formato de `list_managed_surveys`, invertendo só o filtro de
-- arquivamento — a tela reaproveita o mesmo cartão. Ordena pelo arquivamento
-- mais recente, que é a ordem em que o operador procura o que acabou de
-- finalizar.
create or replace function public.fc_listar_pesquisas_arq()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare v_result jsonb;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  perform public.fc_expirar_pesquisas_arq();

  select coalesce(jsonb_agg(jsonb_build_object(
    'surveyId', s.id,
    'code', s.code,
    'name', s.name,
    'description', s.description,
    'status', s.status,
    'archivedAt', s.dt_arquivamento,
    'versionId', sv.id,
    'versionNumber', sv.version_number,
    'versionStatus', sv.status,
    'applicationId', sa.id,
    'applicationCode', sa.code,
    'applicationName', sa.name,
    'applicationStatus', sa.status,
    'opensAt', sa.opens_at,
    'closesAt', sa.closes_at,
    'sections', (select count(*) from public.survey_sections sec where sec.survey_version_id = sv.id),
    'questions', (select count(*) from public.survey_questions q where q.survey_version_id = sv.id),
    'updatedAt', greatest(s.updated_at, sv.updated_at, coalesce(sa.updated_at, s.updated_at))
  ) order by s.dt_arquivamento desc), '[]'::jsonb)
  into v_result
  from public.surveys s
  join lateral (
    select * from public.survey_versions x where x.survey_id = s.id order by x.version_number desc limit 1
  ) sv on true
  left join lateral (
    select * from public.survey_applications a where a.survey_version_id = sv.id order by a.created_at desc limit 1
  ) sa on true
  where s.st_modelo = false
    and s.dt_arquivamento is not null;

  return v_result;
end;
$$;

revoke all on function public.fc_listar_pesquisas_arq() from public, anon;
grant execute on function public.fc_listar_pesquisas_arq() to authenticated;

comment on function public.fc_listar_pesquisas_arq() is
  'Avaliações arquivadas aguardando exclusão automática, para a visão de arquivadas do catálogo administrativo.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_listar_pesquisas_arq();
--   drop function if exists public.fc_expirar_pesquisas_arq();
--   -- Restaura manage_survey_cycle sem ARCHIVE/UNARCHIVE e sem arquivar em
--   -- CANCEL, reaplicando 20260811120000_periodo_futuro_e_exclusao_rascunho.sql.
--   -- Restaura list_managed_surveys sem o filtro de arquivamento (mantendo
--   -- `st_modelo = false`), reaplicando a definição vigente em produção.
--   alter table public.surveys drop column if exists dt_arquivamento;
--   -- st_modelo e tx_categoria_modelo NÃO são removidas: pertencem ao recurso
--   -- de modelos, que esta migration apenas versionou.
--   notify pgrst, 'reload schema';
-- commit;
