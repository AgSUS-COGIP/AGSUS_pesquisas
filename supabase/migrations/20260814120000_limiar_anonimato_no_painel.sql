begin;

-- Limiar mínimo de respondentes no painel de pesquisa.
--
-- O problema que isto resolve
-- --------------------------
-- Guardar a resposta sem nome não basta. Um painel entrega a resposta
-- individual por dedução quando o grupo é pequeno: numa pesquisa anônima com
-- três respostas, "média 1,3 de 5" significa que as três pessoas responderam
-- perto de 1 — e quem conhece o grupo sabe quem são. Com duas respostas, o
-- conjunto de combinações possíveis é pequeno o bastante para adivinhar.
--
-- `nu_limiar_anonimato` (padrão 5) define o mínimo para um recorte poder
-- aparecer. Abaixo disso o painel devolve o recorte **suprimido**, sem os
-- números — e diz que suprimiu, para o operador não confundir com ausência de
-- resposta.
--
-- Onde a supressão se aplica, e onde não
-- --------------------------------------
-- Só a ciclos marcados como anônimos. O CDDI é nominal por natureza — a
-- devolutiva individual e a avaliação da chefia exigem identificação —, e
-- aplicar o limiar ali quebraria o produto em vez de proteger alguém.
--
-- Este painel agrega o ciclo inteiro; ele **não** fatia por unidade ou
-- diretoria. Isso importa porque muda o vetor de ataque: não existe aqui o caso
-- clássico de subtrair um recorte exibido do total para recuperar o recorte
-- escondido. O que existe é o agregado global, e é ele que o limiar cobre.
-- Quando este painel ganhar recortes por grupo, a supressão do complemento
-- precisará entrar junto — senão a subtração desfaz a proteção.
--
-- Dois vazamentos que o limiar sozinho não fecharia
-- ------------------------------------------------
-- 1. **O horário de envio.** A tela mostrava "Enviada em …" ao lado de cada
--    texto livre. Quem administra também enxerga quando cada pessoa concluiu,
--    em `application_participants` — cruzar as duas listas devolve o nome. Em
--    ciclo anônimo o horário deixa de ser devolvido.
--
-- 2. **A ordem das respostas.** Ordenar por data de envio entrega a sequência
--    de quem respondeu, mesmo sem mostrar a data. Em ciclo anônimo a ordem
--    passa a ser por `md5` do texto: estável entre chamadas, sem relação com o
--    tempo.

create or replace function public.fc_obter_painel_pesquisa(target_application_code text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $function$
declare
  v_application_id uuid;
  v_anonimo boolean;
  v_limiar integer;
  v_payload jsonb;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  select id, coalesce(anonymous, false), coalesce(nu_limiar_anonimato, 5)
  into v_application_id, v_anonimo, v_limiar
  from public.survey_applications
  where code = btrim(target_application_code)
  limit 1;

  if v_application_id is null then
    raise exception 'Pesquisa ou ciclo não localizado.';
  end if;

  -- Ciclo identificado não sofre supressão: limiar zero nunca é atingido.
  -- Assim a mudança é inerte para tudo que já existe.
  if not v_anonimo then
    v_limiar := 0;
  end if;

  with app as (
    select sa.*, sv.title version_title, sv.description version_description,
      sv.version_number, s.code survey_code, s.name survey_name,
      s.description survey_description
    from public.survey_applications sa
    join public.survey_versions sv on sv.id = sa.survey_version_id
    join public.surveys s on s.id = sv.survey_id
    where sa.id = v_application_id
  ), latest_submissions as (
    select distinct on (s.participant_id)
      s.id, s.participant_id, s.status, s.updated_at
    from public.submissions s
    where s.application_id = v_application_id
      and s.participant_id is not null
    order by s.participant_id, s.updated_at desc
  ), participant_summary as (
    /*
      O acompanhamento tem duas fontes, porque as duas jornadas guardam o
      progresso em lugares diferentes.

      Em ciclo identificado, a submissão aponta para o participante e o estado
      dela é a fonte. Em ciclo **anônimo** a submissão não tem `participant_id`
      — é justamente isso que garante o anonimato —, então nada casaria no
      `join` e o painel diria que ninguém respondeu, mesmo com o ciclo inteiro
      concluído. Ali quem sabe do progresso é `application_participants`, que
      registra a participação sem registrar o conteúdo.

      Saber que alguém respondeu é diferente de saber o que respondeu: o
      acompanhamento continua possível sem quebrar o anonimato.
    */
    select
      count(*) total,
      count(*) filter (
        where case when v_anonimo then ap.status = 'IN_PROGRESS' else sub.status = 'DRAFT' end
      ) drafts,
      count(*) filter (
        where case when v_anonimo then ap.status = 'COMPLETED' else sub.status in ('SUBMITTED', 'VALIDATED') end
      ) submitted,
      count(*) filter (
        where case when v_anonimo then ap.status in ('ELIGIBLE', 'INVITED') else sub.id is null end
      ) not_started
    from public.application_participants ap
    left join latest_submissions sub on sub.participant_id = ap.id
    where ap.application_id = v_application_id
      -- Quem está bloqueado ou excluído não pode responder: manter no
      -- denominador faria a taxa de conclusão nunca chegar a 100%.
      and ap.status not in ('BLOCKED', 'EXCLUDED')
  ), question_rows as (
    select q.id, q.code, q.title, q.description, q.question_type, q.position,
      sec.id section_id, sec.title section_title, sec.position section_position
    from public.survey_questions q
    join public.survey_sections sec on sec.id = q.section_id
    join app on app.survey_version_id = q.survey_version_id
  ), submitted_answers as (
    select a.*, s.submitted_at
    from public.answers a
    join public.submissions s on s.id = a.submission_id
    where s.application_id = v_application_id
      and s.status in ('SUBMITTED', 'VALIDATED')
  ), option_counts as (
    select a.question_id, ao.option_id, count(*) answer_count
    from public.answer_options ao
    join submitted_answers a on a.id = ao.answer_id
    group by a.question_id, ao.option_id
  )
  select jsonb_build_object(
    'status', 'OK',
    'generatedAt', timezone('utc', now()),
    -- A tela precisa saber que o ciclo é anônimo e qual o limiar, para explicar
    -- a supressão em vez de mostrar um vazio inexplicado.
    'anonymous', v_anonimo,
    'threshold', v_limiar,
    'application', (
      select jsonb_build_object(
        'id', id,
        'code', code,
        'name', name,
        'status', status,
        'opensAt', opens_at,
        'closesAt', closes_at,
        'surveyCode', survey_code,
        'surveyName', survey_name,
        'surveyDescription', coalesce(survey_description, version_description),
        'versionTitle', version_title,
        'versionNumber', version_number
      ) from app
    ),
    'summary', (
      select jsonb_build_object(
        'totalParticipants', total,
        'drafts', drafts,
        'submitted', submitted,
        'notStarted', not_started,
        'completionRate', case when total = 0 then 0 else round(submitted::numeric * 100 / total, 1) end
      ) from participant_summary
    ),
    'questions', coalesce((
      select jsonb_agg(item order by ordem_secao, ordem)
      from (
        select
          qr.section_position as ordem_secao,
          qr.position as ordem,
          jsonb_build_object(
            'id', qr.id,
            'code', qr.code,
            'title', qr.title,
            'description', qr.description,
            'type', qr.question_type,
            'position', qr.position,
            'sectionId', qr.section_id,
            'sectionTitle', qr.section_title,
            'sectionPosition', qr.section_position,
            -- A contagem continua visível mesmo quando o conteúdo é suprimido:
            -- saber que houve poucas respostas é informação de acompanhamento,
            -- e é ela que justifica a supressão a quem lê.
            'responseCount', respostas.total,
            'suppressed', respostas.total < v_limiar,
            'options', case
              when respostas.total < v_limiar then '[]'::jsonb
              else coalesce((
                select jsonb_agg(jsonb_build_object(
                  'id', o.id,
                  'label', o.label,
                  'value', o.value,
                  'count', coalesce(oc.answer_count, 0)
                ) order by o.position)
                from public.question_options o
                left join option_counts oc on oc.question_id = qr.id and oc.option_id = o.id
                where o.question_id = qr.id and o.active
              ), '[]'::jsonb)
            end,
            'textResponses', case
              when respostas.total < v_limiar then '[]'::jsonb
              else coalesce((
                select jsonb_agg(jsonb_build_object(
                  'text', left(sample.answer_text, 1000),
                  -- Ciclo anônimo não devolve o horário: cruzado com a data de
                  -- conclusão de cada participante, ele reconstrói o nome.
                  'submittedAt', case when v_anonimo then null else sample.submitted_at end
                ) order by sample.ordenacao)
                from (
                  select
                    a.answer_text,
                    a.submitted_at,
                    -- Em ciclo anônimo a ordem não pode acompanhar o tempo, ou
                    -- entrega a sequência de quem respondeu. `md5` do texto é
                    -- estável entre chamadas e não guarda relação com o envio.
                    case when v_anonimo then md5(a.answer_text) else to_char(a.submitted_at, 'YYYYMMDDHH24MISS') end as ordenacao
                  from submitted_answers a
                  where a.question_id = qr.id
                    and nullif(btrim(a.answer_text), '') is not null
                  order by ordenacao desc
                  limit 100
                ) sample
              ), '[]'::jsonb)
            end
          ) as item
        from question_rows qr
        cross join lateral (
          select count(*)::integer as total
          from submitted_answers a
          where a.question_id = qr.id
        ) respostas
      ) perguntas
    ), '[]'::jsonb)
  ) into v_payload;

  return v_payload;
end;
$function$;

revoke all on function public.fc_obter_painel_pesquisa(text) from public, anon;
grant execute on function public.fc_obter_painel_pesquisa(text) to authenticated;

comment on function public.fc_obter_painel_pesquisa(text) is
  'Painel de uma pesquisa. Em ciclo anônimo, suprime pergunta com menos respostas que nu_limiar_anonimato e remove horário e ordem temporal dos textos livres.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   -- Restaurar a definição anterior, sem supressão. Não recomendado em ciclo
--   -- anônimo: sem o limiar, três respostas identificam quem respondeu.
-- commit;
