begin;

-- A pré-amostra passa a ser decidida no cadastro da avaliação, junto de
-- "Permitir rascunhos" e "Avaliação anônima", e não só nas propriedades do
-- ciclo. A decisão do cadastro é uma **intenção**: declara que este ciclo será
-- validado antes de ir à população, mas não escolhe ninguém.
--
-- Por que intenção e não a configuração inteira: `fc_configurar_pre_amostra`
-- exige público já vinculado ao ciclo (recusa `INSTITUTIONAL` e exige ao menos
-- três elegíveis), e no cadastro o ciclo nasce vazio — não há de quem sortear.
-- Selecionar quem responde continua sendo passo das propriedades; o que o
-- cadastro grava é o compromisso, para que a tela de operação cobre a
-- configuração antes de alguém abrir o ciclo para todos por distração.
--
-- Por que uma função nova em vez de um parâmetro em `create_survey_draft`:
-- `create or replace` não altera a lista de argumentos, e criar a sobrecarga de
-- nove argumentos deixaria o PostgREST ambíguo entre ela e a de oito quando a
-- chamada omitisse o parâmetro novo — o mesmo motivo que já levou o catálogo a
-- ter uma função por visão em vez de um argumento (ver `GET /api/avaliacoes`).
-- Trocar a assinatura exigiria `drop function`, que é mudança quebrante para
-- todo bundle já publicado. O frontend grava a intenção logo depois de criar o
-- rascunho, numa segunda chamada.
-- 
-- A intenção vive em `settings.preSample.intended`, ao lado de `phase`, e é
-- escrita por merge para não apagar as chaves que `fc_configurar_pre_amostra`
-- grava no mesmo objeto.

create or replace function sigav.fc_definir_intencao_pre_amostra(
  target_survey_id uuid,
  target_intended boolean
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, sigav, auth
as $$
declare
  v_actor uuid := sigav.current_person_id();
  v_application sigav.survey_applications%rowtype;
  v_phase text;
  v_previous boolean;
begin
  if not sigav.can_manage_surveys() then
    raise exception 'Acesso restrito à administração.';
  end if;
  if target_intended is null then
    raise exception 'Informe se este ciclo terá pré-amostra.';
  end if;

  -- Mesma resolução de "o ciclo" das demais funções de operação: versão mais
  -- recente, aplicação mais recente dentro dela.
  select a.* into v_application
  from sigav.survey_applications a
  join sigav.survey_versions v on v.id = a.survey_version_id
  where v.survey_id = target_survey_id
  order by v.version_number desc, a.created_at desc
  limit 1 for update of a;

  if v_application.id is null then
    raise exception 'Ciclo de aplicação não encontrado.';
  end if;

  v_phase := coalesce(v_application.settings #>> '{preSample,phase}', 'DISABLED');
  v_previous := coalesce((v_application.settings #>> '{preSample,intended}')::boolean, false);

  -- Prever validação é ato de preparação. Depois de o ciclo abrir, quem governa
  -- o acesso é a fase, e mexer no plano só produziria um registro enganoso.
  if v_application.status not in ('DRAFT', 'SCHEDULED') then
    raise exception 'A pré-amostra só pode ser prevista enquanto o ciclo está em rascunho ou agendado.';
  end if;

  -- Dispensar a validação depois de o grupo já ter sido sorteado ou liberado
  -- descreveria como "sem pré-amostra" um ciclo que tem uma. Quem quiser voltar
  -- atrás precisa desfazer a configuração, não o plano.
  if not target_intended and v_phase <> 'DISABLED' then
    raise exception 'A pré-amostra deste ciclo já foi configurada e não pode ser dispensada.';
  end if;

  update sigav.survey_applications
  set settings = coalesce(settings, '{}'::jsonb)
        || jsonb_build_object(
             'preSample',
             coalesce(settings -> 'preSample', '{}'::jsonb)
               || jsonb_build_object('intended', target_intended)
           ),
      updated_at = timezone('utc', now())
  where id = v_application.id;

  insert into sigav.audit_events(
    actor_person_id, event_type, entity_type, entity_id, application_id,
    before_data, after_data, metadata
  )
  values (
    v_actor, 'SURVEY_PRE_SAMPLE_INTENDED', 'SURVEY_APPLICATION',
    v_application.id::text, v_application.id,
    jsonb_build_object('intended', v_previous),
    jsonb_build_object('intended', target_intended),
    jsonb_build_object('surveyId', target_survey_id, 'phase', v_phase)
  );

  return jsonb_build_object(
    'status', 'OK',
    'applicationId', v_application.id,
    'intended', target_intended,
    'phase', v_phase,
    'applicationStatus', v_application.status
  );
end;
$$;

-- Leitura própria, e não uma chave nova em `fc_obter_pre_amostra`: aquela função
-- está sendo movida de schema em outra frente de trabalho, e redefinir a mesma
-- função em duas migrations é exatamente como este projeto já perdeu
-- `nu_tentativas` e as chaves de presença de `fc_obter_marca_plataforma` — a
-- última definição aplicada vence, em silêncio. Duas funções independentes
-- custam uma chamada a mais e não colidem.
create or replace function sigav.fc_obter_intencao_pre_amostra(target_survey_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, sigav, auth
as $$
declare
  v_application sigav.survey_applications%rowtype;
begin
  if not sigav.can_manage_surveys() then
    raise exception 'Acesso restrito à administração.';
  end if;

  select a.* into v_application
  from sigav.survey_applications a
  join sigav.survey_versions v on v.id = a.survey_version_id
  where v.survey_id = target_survey_id
  order by v.version_number desc, a.created_at desc
  limit 1;

  if v_application.id is null then
    raise exception 'Ciclo de aplicação não encontrado.';
  end if;

  return jsonb_build_object(
    'status', 'OK',
    'applicationId', v_application.id,
    'intended', coalesce((v_application.settings #>> '{preSample,intended}')::boolean, false),
    'phase', coalesce(v_application.settings #>> '{preSample,phase}', 'DISABLED'),
    'applicationStatus', v_application.status
  );
end;
$$;

revoke all on function sigav.fc_definir_intencao_pre_amostra(uuid, boolean) from public, anon;
revoke all on function sigav.fc_obter_intencao_pre_amostra(uuid) from public, anon;
grant execute on function sigav.fc_definir_intencao_pre_amostra(uuid, boolean) to authenticated;
grant execute on function sigav.fc_obter_intencao_pre_amostra(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists sigav.fc_obter_intencao_pre_amostra(uuid);
--   drop function if exists sigav.fc_definir_intencao_pre_amostra(uuid, boolean);
--   -- A chave `intended` gravada em settings fica inerte sem as funções acima;
--   -- removê-la das aplicações existentes é opcional:
--   -- update sigav.survey_applications
--   --    set settings = settings #- '{preSample,intended}'
--   --  where settings #> '{preSample,intended}' is not null;
--   notify pgrst, 'reload schema';
-- commit;
