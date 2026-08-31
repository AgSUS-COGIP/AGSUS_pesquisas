begin;

-- Remoção da resposta de uma pessoa, pelo Superadmin, em dois modos.
--
-- Por que dois modos, e não um
-- ----------------------------
-- Os casos que motivam a operação são diferentes entre si:
--
--   INVALIDATE — a pessoa respondeu por engano, respondeu pela pessoa errada, ou
--     o instrumento mudou depois. A resposta sai dos painéis e do cálculo, mas o
--     registro de que existiu permanece. É reversível na prática: basta a pessoa
--     responder de novo, e a submissão anulada continua auditável.
--
--   DELETE — a resposta contém dado que não podia ter sido gravado. Aí anular
--     não basta: o conteúdo precisa sair da base. Não há volta.
--
-- Tratar os dois como a mesma coisa forçaria escolher entre perder histórico
-- sempre ou nunca conseguir remover o que não pode ficar.
--
-- Exclusiva do Superadmin
-- -----------------------
-- `is_platform_administrator()`, não `can_manage_surveys()`: apagar resposta
-- alheia é administração global, não operação de pesquisa.
--
-- A auditoria é gravada **antes** do delete, com o retrato do que existia — do
-- contrário o modo DELETE apagaria também a própria evidência da operação.

create or replace function public.fc_remover_resposta_pessoa(
  p_submissao uuid,
  p_modo text default 'INVALIDATE',
  p_motivo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_pessoa uuid := public.current_person_id();
  v_modo text := upper(btrim(coalesce(p_modo, 'INVALIDATE')));
  v_motivo text := nullif(btrim(coalesce(p_motivo, '')), '');
  v_submissao public.submissions%rowtype;
  v_retrato jsonb;
  v_respostas integer;
begin
  if not public.is_platform_administrator() then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;
  if v_modo not in ('INVALIDATE', 'DELETE') then
    raise exception 'Modo inválido. Use INVALIDATE para anular ou DELETE para apagar.';
  end if;
  -- Justificativa obrigatória: a operação mexe na resposta de outra pessoa, e
  -- quem auditar depois precisa saber por quê.
  if v_motivo is null or length(v_motivo) < 10 then
    raise exception 'Descreva o motivo da remoção com pelo menos 10 caracteres.';
  end if;

  select * into v_submissao from public.submissions where id = p_submissao for update;
  if v_submissao.id is null then
    raise exception 'Resposta não localizada.';
  end if;

  select count(*)::integer into v_respostas from public.answers where submission_id = p_submissao;

  -- Retrato do que existia, gravado na auditoria antes de qualquer alteração.
  select jsonb_build_object(
    'submissionId', v_submissao.id,
    'status', v_submissao.status,
    'submissionType', v_submissao.submission_type,
    'submittedAt', v_submissao.submitted_at,
    'answers', v_respostas,
    'respondent', jsonb_build_object(
      'personId', pessoa.id, 'employeeNumber', pessoa.employee_number, 'fullName', pessoa.full_name
    ),
    'application', jsonb_build_object('id', aplicacao.id, 'code', aplicacao.code, 'name', aplicacao.name)
  )
  into v_retrato
  from public.survey_applications as aplicacao
  left join public.people as pessoa on pessoa.id = v_submissao.respondent_person_id
  where aplicacao.id = v_submissao.application_id;

  insert into public.audit_events (
    actor_person_id, event_type, entity_type, entity_id, application_id, before_data, metadata
  ) values (
    v_pessoa,
    case when v_modo = 'DELETE' then 'SUBMISSION_DELETED' else 'SUBMISSION_INVALIDATED' end,
    'SUBMISSION', v_submissao.id::text, v_submissao.application_id, v_retrato,
    jsonb_build_object('reason', v_motivo, 'mode', v_modo)
  );

  if v_modo = 'INVALIDATE' then
    -- As respostas continuam gravadas; o que muda é o estado da submissão, e é
    -- ele que os painéis e o cálculo leem.
    update public.submissions
    set status = 'INVALIDATED',
        updated_at = now(),
        metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
          'invalidatedBy', v_pessoa, 'invalidatedAt', now(), 'invalidationReason', v_motivo
        )
    where id = p_submissao;
  else
    -- De baixo para cima, como toda remoção neste banco.
    delete from public.cddi_competency_results where submission_id = p_submissao;
    update public.cddi_final_results set auto_submission_id = null where auto_submission_id = p_submissao;
    update public.cddi_final_results set leader_submission_id = null where leader_submission_id = p_submissao;
    delete from public.answer_options where answer_id in (
      select id from public.answers where submission_id = p_submissao
    );
    delete from public.answers where submission_id = p_submissao;
    delete from public.submissions where id = p_submissao;
  end if;

  -- A pessoa volta a constar como pendente no ciclo: sem isso, o painel
  -- continuaria contando como concluída uma resposta que não existe mais.
  update public.application_participants
  set status = 'ELIGIBLE', completed_at = null, updated_at = now()
  where application_id = v_submissao.application_id
    and person_id = v_submissao.respondent_person_id
    and status = 'COMPLETED';

  return jsonb_build_object(
    'status', 'OK',
    'mode', v_modo,
    'submissionId', p_submissao,
    'answers', v_respostas
  );
end;
$$;

revoke all on function public.fc_remover_resposta_pessoa(uuid, text, text) from public, anon;
grant execute on function public.fc_remover_resposta_pessoa(uuid, text, text) to authenticated;

comment on function public.fc_remover_resposta_pessoa(uuid, text, text) is
  'Anula (INVALIDATE) ou apaga (DELETE) a resposta de um participante. Exclusiva do Superadmin, com motivo obrigatório e auditoria do estado anterior.';

-- Respostas de um ciclo, para a tela que escolhe qual remover.
create or replace function public.fc_listar_respostas_ciclo(
  p_codigo_ciclo text,
  p_busca text default null,
  p_limite integer default 100
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_busca text := lower(btrim(coalesce(p_busca, '')));
  v_limite integer := least(greatest(coalesce(p_limite, 100), 1), 500);
  v_resultado jsonb;
begin
  if not public.is_platform_administrator() then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;

  select coalesce(jsonb_agg(item order by item->>'fullName'), '[]'::jsonb)
  into v_resultado
  from (
    select jsonb_build_object(
      'submissionId', submissao.id,
      'personId', pessoa.id,
      'fullName', pessoa.full_name,
      'employeeNumber', pessoa.employee_number,
      'institutionalEmail', pessoa.institutional_email,
      'submissionType', submissao.submission_type,
      'status', submissao.status,
      'submittedAt', submissao.submitted_at,
      'answers', (select count(*) from public.answers resposta where resposta.submission_id = submissao.id),
      'subjectName', avaliado.full_name
    ) as item
    from public.submissions as submissao
    join public.survey_applications as aplicacao on aplicacao.id = submissao.application_id
    left join public.people as pessoa on pessoa.id = submissao.respondent_person_id
    left join public.people as avaliado on avaliado.id = submissao.subject_person_id
    where aplicacao.code = btrim(p_codigo_ciclo)
      and (
        v_busca = ''
        or lower(coalesce(pessoa.full_name, '')) like '%' || v_busca || '%'
        or lower(coalesce(pessoa.employee_number, '')) like '%' || v_busca || '%'
        or lower(coalesce(pessoa.institutional_email, '')) like '%' || v_busca || '%'
      )
    order by pessoa.full_name
    limit v_limite
  ) as respostas;

  return v_resultado;
end;
$$;

revoke all on function public.fc_listar_respostas_ciclo(text, text, integer) from public, anon;
grant execute on function public.fc_listar_respostas_ciclo(text, text, integer) to authenticated;

comment on function public.fc_listar_respostas_ciclo(text, text, integer) is
  'Respostas de um ciclo, com respondente e situação, para a remoção administrativa.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_remover_resposta_pessoa(uuid, text, text);
--   drop function if exists public.fc_listar_respostas_ciclo(text, text, integer);
--   notify pgrst, 'reload schema';
-- commit;
