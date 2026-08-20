begin;

-- Central de e-mails: textos configuráveis, envio dirigido e visibilidade.
--
-- Três problemas, um assunto só
--
-- 1. **O e-mail não se identificava.** O corpo era montado em código
--    (`src/lib/participant-emails.ts`), não dizia o nome do sistema, não
--    explicava que o acesso é com a conta institucional do Google e não contava
--    o que a avaliação é. Link sem remetente reconhecível e sem explicação é o
--    formato que se ensina a não clicar.
--
-- 2. **Não havia como enviar para alguém em particular.** A única alavanca era
--    o interruptor do ciclo: ligado, todos os elegíveis recebem. Testar com uma
--    pessoa exigia criar um ciclo descartável — e cobrar quem falta, no meio de
--    um ciclo, era impossível.
--
-- 3. **Ninguém conseguia ver o que aconteceu.** `tl_email_participante` não tem
--    grant nem leitor: em 20/08/2026 a plataforma tinha zero envios registrados
--    e nenhuma tela dizia isso. Só uma consulta direta ao banco revelava.
--
-- Onde cada texto mora
-- Nome, prazo e link vêm do ciclo. **O que a avaliação é** vem de
-- `surveys.description`, já editada no construtor — a migration só a faz chegar
-- ao payload, em vez de criar um segundo campo que divergiria dela. **Instrução
-- de acesso e rodapé** são institucionais, repetem-se em todo ciclo, e passam a
-- morar aqui.
--
-- Por que funções novas, e não parâmetros novos
-- Acrescentar parâmetro a uma RPC publicada **não** a redefine: cria sobrecarga,
-- e o PostgREST passa a ter duas candidatas. É a classe de falha de 10/08/2026.
-- Por isso `fc_reivindicar_emails()` mantém a assinatura vazia e ganha uma irmã
-- `fc_reivindicar_emails_lote(integer)`; a antiga vira ponte para a nova.
-- `fc_obter_marca_plataforma()` também mantém a assinatura — acrescentar chave
-- ao jsonb de retorno é seguro, quem não a conhece a ignora.

---------------------------------------------------------------------------
-- 1. Textos institucionais do e-mail.
---------------------------------------------------------------------------
alter table public.tb_config_plataforma
  add column if not exists tx_instrucao_email text,
  add column if not exists tx_rodape_email text;

comment on column public.tb_config_plataforma.tx_instrucao_email is
  'Frase que explica ao participante como acessar a plataforma, no corpo do e-mail. Nulo usa o padrão do código.';
comment on column public.tb_config_plataforma.tx_rodape_email is
  'Assinatura institucional no rodapé do e-mail. Nulo usa o padrão do código.';

---------------------------------------------------------------------------
-- 2. Envio dirigido: tipo novo e unicidade que deixa de valer para ele.
--
-- A chave única `(aplicação, pessoa, tipo)` é o que impede e-mail automático em
-- dobro, e continua valendo — **para os automáticos**. Se o envio manual usasse
-- a mesma regra, o primeiro lembrete bloquearia todos os seguintes em silêncio,
-- e quem já tivesse recebido a abertura nunca receberia uma cobrança.
--
-- Por isso a constraint vira um índice único **parcial**, restrito aos dois
-- tipos automáticos. Linha manual é append-only: cada disparo é um registro
-- próprio, e o histórico mostra os três lembretes que a pessoa recebeu em vez
-- de fingir que houve um só.
--
-- O que protege contra o clique duplo não é mais a unicidade, e sim a regra de
-- negócio de `fc_agendar_envio_manual`: já existe manual PROCESSANDO para a
-- pessoa naquele ciclo, não enfileira outro.
---------------------------------------------------------------------------
alter table public.tl_email_participante
  drop constraint if exists ck_email_participante_tipo;
alter table public.tl_email_participante
  add constraint ck_email_participante_tipo
  check (tp_email in ('research_opened', 'research_expiring_24h', 'manual_reminder'));

alter table public.tl_email_participante
  drop constraint if exists uk_email_participante;

create unique index if not exists in_email_partic_auto_unico
  on public.tl_email_participante (sq_aplicacao, sq_pessoa, tp_email)
  where tp_email in ('research_opened', 'research_expiring_24h');

-- Histórico é sempre lido por ciclo e do mais recente para o mais antigo.
create index if not exists in_email_partic_historico
  on public.tl_email_participante (sq_aplicacao, dt_criacao desc);

comment on index public.in_email_partic_auto_unico is
  'Impede e-mail automático em dobro. Parcial de propósito: envio manual é append-only, para permitir mais de um lembrete à mesma pessoa.';

---------------------------------------------------------------------------
-- 3. Leitura da marca: mesma assinatura, duas chaves a mais.
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
    'updatedAt', dt_alteracao
  )
  from public.tb_config_plataforma
  where co_configuracao = 1;
$$;

revoke all on function public.fc_obter_marca_plataforma() from public;
grant execute on function public.fc_obter_marca_plataforma() to anon, authenticated;

---------------------------------------------------------------------------
-- 4. Escrita dos textos do e-mail.
---------------------------------------------------------------------------
create or replace function public.fc_definir_textos_email(
  p_instrucao text default null,
  p_rodape text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_instrucao text := nullif(btrim(coalesce(p_instrucao, '')), '');
  v_rodape text := nullif(btrim(coalesce(p_rodape, '')), '');
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  -- Os limites são maiores que os da tela de acesso porque aqui o texto ocupa
  -- um parágrafo de e-mail, e não uma linha de cartão. Ainda assim há limite:
  -- corpo longo demais é cortado pelo Gmail atrás de "mensagem truncada", e a
  -- parte escondida costuma ser justamente o rodapé que identifica o remetente.
  if v_instrucao is not null and length(v_instrucao) > 400 then
    raise exception 'A instrução de acesso deve ter no máximo 400 caracteres.';
  end if;
  if v_rodape is not null and length(v_rodape) > 400 then
    raise exception 'O rodapé deve ter no máximo 400 caracteres.';
  end if;

  update public.tb_config_plataforma
  set tx_instrucao_email = v_instrucao,
      tx_rodape_email = v_rodape,
      au_usuario_alteracao = public.current_person_id(),
      dt_alteracao = timezone('utc', now())
  where co_configuracao = 1;

  return jsonb_build_object(
    'status', 'OK',
    'emailInstruction', v_instrucao,
    'emailFooter', v_rodape
  );
end;
$$;

revoke all on function public.fc_definir_textos_email(text, text) from public, anon;
grant execute on function public.fc_definir_textos_email(text, text) to authenticated;

comment on function public.fc_definir_textos_email(text, text) is
  'Define a instrução de acesso e o rodapé do e-mail aos participantes. Vazio restaura o texto padrão do código.';

---------------------------------------------------------------------------
-- 5. Reivindicação em lote.
--
-- Derivada da definição vigente de `fc_reivindicar_emails()`, extraída do banco
-- por pg_get_functiondef. Quatro mudanças, todas deliberadas:
--
--   a) o payload devolve a descrição da avaliação e os textos institucionais;
--   b) a configuração entra por LEFT JOIN — com CROSS JOIN, instalação sem a
--      linha de configuração deixaria de reivindicar **qualquer** e-mail, em
--      silêncio;
--   c) o tipo `manual_reminder` entra na fila **sem exigir** a opção automática
--      do ciclo: envio dirigido é ato explícito de quem opera, e exigir o
--      interruptor tornaria impossível cobrar quem falta num ciclo que não usa
--      aviso automático;
--   d) `p_limite` corta o quanto volta por chamada. O insert continua marcando
--      todos — é barato e mantém a fila completa; o que o lote controla é
--      quantos o processo tenta enviar de uma vez.
--
-- O item (d) é o que torna o CDDI viável. O despacho envia em laço sequencial,
-- uma conexão SMTP por mensagem: 1021 envios não cabem no tempo de uma função
-- serverless. Devolver em lotes permite que a interface administrativa chame
-- várias vezes, mostrando progresso, sem nenhuma chamada longa.
---------------------------------------------------------------------------
create or replace function public.fc_reivindicar_emails_lote(p_limite integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_result jsonb;
  v_limite integer := greatest(1, least(coalesce(p_limite, 100), 500));
begin
  -- Restrita ao processamento interno. A guarda fica no corpo — e não só no
  -- grant — porque o gate de contratos de RPC exige EXECUTE de authenticated
  -- em toda chamada presente no código; aqui, como em toda RPC do projeto, a
  -- barreira real é a validação interna. `auth.role()` nulo é sessão direta
  -- de banco (testes, manutenção), que já tem privilégio total.
  if coalesce(auth.role(), 'service_role') <> 'service_role' then
    raise exception 'Acesso restrito ao processamento interno.';
  end if;

  -- Materializa aberturas agendadas cuja data chegou: sem isto, um ciclo
  -- SCHEDULED que ninguém abriu no navegador nunca dispararia o e-mail.
  perform public.fc_abrir_ciclos_agendados();

  -- Rearma os envios que falharam e cuja janela continua válida. As mesmas
  -- condições do claim valem aqui: pessoa que saiu do ciclo, foi bloqueada
  -- ou concluiu entre a falha e o reprocessamento não volta para a fila.
  update public.tl_email_participante t
  set st_envio = 'PROCESSANDO',
      ds_erro = null,
      dt_atualizacao = timezone('utc', now())
  from public.survey_applications a,
       public.application_participants ap,
       public.people p
  where a.id = t.sq_aplicacao
    and ap.application_id = t.sq_aplicacao
    and ap.person_id = t.sq_pessoa
    and p.id = t.sq_pessoa
    and t.st_envio = 'FALHOU'
    and a.status = 'OPEN'
    and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
    and p.active
    and p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    and (
      t.tp_email = 'manual_reminder'
      or (
        a.st_notificacao_email
        and (
          (t.tp_email = 'research_opened'
            and (a.closes_at is null or a.closes_at > now()))
          or
          (t.tp_email = 'research_expiring_24h'
            and a.closes_at is not null
            and a.closes_at > now()
            and a.closes_at <= now() + interval '24 hours')
        )
      )
    );

  -- Enfileira os automáticos que ainda não existem. O índice parcial é o que
  -- garante "no máximo um por (ciclo, pessoa, tipo)".
  insert into public.tl_email_participante (sq_aplicacao, sq_pessoa, tp_email)
  select a.id, p.id, e.tp_email
  from public.survey_applications a
  join public.application_participants ap on ap.application_id = a.id
  join public.people p on p.id = ap.person_id
  cross join lateral (values ('research_opened'), ('research_expiring_24h')) as e(tp_email)
  where a.st_notificacao_email
    and a.status = 'OPEN'
    and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
    and p.active
    and p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
    and (
      (e.tp_email = 'research_opened'
        and (a.closes_at is null or a.closes_at > now()))
      or
      (e.tp_email = 'research_expiring_24h'
        and a.closes_at is not null
        and a.closes_at > now()
        and a.closes_at <= now() + interval '24 hours')
    )
  on conflict (sq_aplicacao, sq_pessoa, tp_email)
    where tp_email in ('research_opened', 'research_expiring_24h')
  do nothing;

  -- Devolve até `v_limite` envios PROCESSANDO que continuam elegíveis. Linhas
  -- órfãs de uma execução que morreu entre o claim e o envio voltam aqui — é a
  -- recuperação de falha; a checagem de elegibilidade impede que uma pessoa
  -- retirada do ciclo nesse meio-tempo receba a mensagem.
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', f.sq_email,
    'applicationId', f.sq_aplicacao,
    'personId', f.sq_pessoa,
    'kind', f.tp_email,
    'personName', f.full_name,
    'personEmail', f.institutional_email,
    'applicationName', f.name,
    'applicationCode', f.code,
    'surveyCode', f.survey_code,
    'closesAt', f.closes_at,
    'surveyDescription', f.description,
    'organizationName', f.no_organizacao,
    'productName', f.no_produto,
    'emailInstruction', f.tx_instrucao_email,
    'emailFooter', f.tx_rodape_email
  )), '[]'::jsonb)
  into v_result
  from (
    select t.sq_email, t.sq_aplicacao, t.sq_pessoa, t.tp_email,
           p.full_name, p.institutional_email,
           a.name, a.code, a.closes_at,
           s.code as survey_code, s.description,
           cfg.no_organizacao, cfg.no_produto,
           cfg.tx_instrucao_email, cfg.tx_rodape_email
    from public.tl_email_participante t
    join public.survey_applications a on a.id = t.sq_aplicacao
    join public.survey_versions sv on sv.id = a.survey_version_id
    join public.surveys s on s.id = sv.survey_id
    join public.application_participants ap on ap.application_id = t.sq_aplicacao and ap.person_id = t.sq_pessoa
    join public.people p on p.id = t.sq_pessoa
    -- Textos institucionais do e-mail. LEFT JOIN de propósito: configuração
    -- ausente faz o template cair no padrão do código, e nunca impede o envio.
    left join public.tb_config_plataforma cfg on cfg.co_configuracao = 1
    where t.st_envio = 'PROCESSANDO'
      and a.status = 'OPEN'
      and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
      and p.active
      and p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      and (
        t.tp_email = 'manual_reminder'
        or (
          a.st_notificacao_email
          and (
            (t.tp_email = 'research_opened'
              and (a.closes_at is null or a.closes_at > now()))
            or
            (t.tp_email = 'research_expiring_24h'
              and a.closes_at is not null
              and a.closes_at > now()
              and a.closes_at <= now() + interval '24 hours')
          )
        )
      )
    -- Manual primeiro: é ato deliberado de quem está olhando a tela agora e
    -- esperando o resultado. Depois, o mais antigo na fila.
    order by (t.tp_email = 'manual_reminder') desc, t.dt_criacao
    limit v_limite
  ) f;

  return v_result;
end;
$$;

revoke all on function public.fc_reivindicar_emails_lote(integer) from public, anon;
grant execute on function public.fc_reivindicar_emails_lote(integer) to authenticated;

comment on function public.fc_reivindicar_emails_lote(integer) is
  'Service role apenas. Reivindica até p_limite envios pendentes e devolve o payload de cada um. Substitui fc_reivindicar_emails(), que passou a delegar aqui.';

---------------------------------------------------------------------------
-- 6. Ponte: a assinatura antiga continua existindo.
--
-- Nada no navegador a chama (é service role), mas o despachador publicado a
-- chama pelo nome. Removê-la antes do deploy novo reproduziria 10/08/2026.
---------------------------------------------------------------------------
create or replace function public.fc_reivindicar_emails()
returns jsonb
language sql
security definer
set search_path = pg_catalog, public
as $$
  select public.fc_reivindicar_emails_lote(500);
$$;

revoke all on function public.fc_reivindicar_emails() from public, anon;
grant execute on function public.fc_reivindicar_emails() to authenticated;

comment on function public.fc_reivindicar_emails() is
  'Ponte de compatibilidade: delega a fc_reivindicar_emails_lote(500). Use a versão com limite em código novo.';

---------------------------------------------------------------------------
-- 7. Envio dirigido: enfileira lembrete para pessoas escolhidas.
--
-- Não envia nada — enfileira. Quem envia continua sendo a rota de tarefa, pelo
-- mesmo caminho dos automáticos, com o mesmo registro de desfecho. É o que
-- mantém uma fonte só de verdade sobre o que saiu.
---------------------------------------------------------------------------
create or replace function public.fc_agendar_envio_manual(
  p_aplicacao uuid,
  p_pessoas uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor uuid := public.current_person_id();
  v_application public.survey_applications%rowtype;
  v_pedidas integer := coalesce(array_length(p_pessoas, 1), 0);
  v_enfileiradas integer := 0;
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  if p_aplicacao is null then
    raise exception 'Informe o ciclo.';
  end if;

  if v_pedidas = 0 then
    raise exception 'Selecione ao menos uma pessoa.';
  end if;

  -- Teto por disparo. Não é limite técnico do banco, e sim proteção contra o
  -- clique acidental que atinge a base inteira: a cota diária de envio da conta
  -- institucional do Google é finita, e estourá-la derruba também os e-mails de
  -- quem realmente precisa receber.
  if v_pedidas > 1500 then
    raise exception 'Selecione no máximo 1500 pessoas por disparo.';
  end if;

  select * into v_application
  from public.survey_applications
  where id = p_aplicacao;

  if v_application.id is null then
    raise exception 'Ciclo não encontrado.';
  end if;

  if v_application.status <> 'OPEN' then
    raise exception 'O ciclo precisa estar aberto para receber envios.';
  end if;

  -- Só entra quem é participante elegível, está ativo e tem e-mail com forma
  -- válida — as mesmas condições do envio automático. A seleção da tela não é
  -- autoridade: ela pode estar velha em relação ao banco.
  --
  -- `not exists` de manual PROCESSANDO é o que substitui a unicidade que este
  -- tipo deixou de ter: protege do clique duplo sem impedir um segundo lembrete
  -- legítimo depois que o primeiro terminou.
  with elegiveis as (
    select p.id
    from public.people p
    join public.application_participants ap
      on ap.person_id = p.id and ap.application_id = p_aplicacao
    where p.id = any(p_pessoas)
      and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
      and p.active
      and p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'
      and not exists (
        select 1 from public.tl_email_participante t
        where t.sq_aplicacao = p_aplicacao
          and t.sq_pessoa = p.id
          and t.tp_email = 'manual_reminder'
          and t.st_envio = 'PROCESSANDO'
      )
  )
  insert into public.tl_email_participante (sq_aplicacao, sq_pessoa, tp_email)
  select p_aplicacao, e.id, 'manual_reminder'
  from elegiveis e;

  get diagnostics v_enfileiradas = row_count;

  insert into public.audit_events(
    actor_person_id, event_type, entity_type, entity_id, application_id,
    before_data, after_data, metadata
  )
  values (
    v_actor, 'EMAIL_MANUAL_QUEUED', 'survey_application', p_aplicacao, p_aplicacao,
    null, null,
    jsonb_build_object('solicitadas', v_pedidas, 'enfileiradas', v_enfileiradas)
  );

  return jsonb_build_object(
    'status', 'OK',
    'solicitadas', v_pedidas,
    'enfileiradas', v_enfileiradas,
    -- A diferença não é erro: é gente que saiu do ciclo, foi bloqueada, está
    -- sem e-mail válido ou já tem um lembrete na fila. A tela mostra o número
    -- para ninguém concluir que "enviou para os 300" quando foram 287.
    'ignoradas', v_pedidas - v_enfileiradas
  );
end;
$$;

revoke all on function public.fc_agendar_envio_manual(uuid, uuid[]) from public, anon;
grant execute on function public.fc_agendar_envio_manual(uuid, uuid[]) to authenticated;

comment on function public.fc_agendar_envio_manual(uuid, uuid[]) is
  'Enfileira lembrete manual para as pessoas escolhidas de um ciclo aberto. Não envia: o despacho é o mesmo dos automáticos.';

---------------------------------------------------------------------------
-- 8. Audiência do ciclo, com a situação de resposta de cada pessoa.
--
-- É o que a tela precisa para "cobrar quem falta" ser uma ação e não uma
-- planilha. A situação considera só a resposta **da própria pessoa sobre si**:
-- no CDDI quem lidera equipe também responde avaliações de outros, e contar
-- essas marcaria a chefia como concluída sem que a autoavaliação existisse.
---------------------------------------------------------------------------
create or replace function public.fc_listar_audiencia_email(
  p_aplicacao uuid,
  p_situacao text default 'ALL',
  p_busca text default null,
  p_limite integer default 500
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_result jsonb;
  v_limite integer := greatest(1, least(coalesce(p_limite, 500), 2000));
  v_busca text := nullif(btrim(coalesce(p_busca, '')), '');
  v_situacao text := upper(coalesce(nullif(btrim(p_situacao), ''), 'ALL'));
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  if v_situacao not in ('ALL', 'PENDING', 'DRAFT', 'DONE') then
    raise exception 'Situação inválida. Use ALL, PENDING, DRAFT ou DONE.';
  end if;

  select coalesce(jsonb_agg(to_jsonb(f) order by f."fullName"), '[]'::jsonb)
  into v_result
  from (
    select
      p.id as "personId",
      p.full_name as "fullName",
      p.employee_number as "employeeNumber",
      p.institutional_email as email,
      ap.status as "participantStatus",
      d.situacao as situation,
      d.ultimo_envio as "lastEmailAt",
      d.ultimo_tipo as "lastEmailKind",
      d.ultimo_estado as "lastEmailStatus",
      -- E-mail malformado é motivo silencioso de não recebimento. A tela
      -- precisa poder dizer isso em vez de mostrar a pessoa como ignorada.
      (p.institutional_email ~* '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$') as "emailValido"
    from public.application_participants ap
    join public.people p on p.id = ap.person_id
    cross join lateral (
      select
        case
          when ap.completed_at is not null
            or exists (
              select 1 from public.submissions sb
              where sb.application_id = ap.application_id
                and sb.respondent_person_id = p.id
                and (sb.subject_person_id is null or sb.subject_person_id = p.id)
                and sb.status in ('SUBMITTED', 'VALIDATED')
            ) then 'DONE'
          when exists (
              select 1 from public.submissions sb
              where sb.application_id = ap.application_id
                and sb.respondent_person_id = p.id
                and (sb.subject_person_id is null or sb.subject_person_id = p.id)
                and sb.status = 'DRAFT'
            ) then 'DRAFT'
          else 'PENDING'
        end as situacao,
        (select t.dt_criacao from public.tl_email_participante t
          where t.sq_aplicacao = ap.application_id and t.sq_pessoa = p.id
          order by t.dt_criacao desc limit 1) as ultimo_envio,
        (select t.tp_email from public.tl_email_participante t
          where t.sq_aplicacao = ap.application_id and t.sq_pessoa = p.id
          order by t.dt_criacao desc limit 1) as ultimo_tipo,
        (select t.st_envio from public.tl_email_participante t
          where t.sq_aplicacao = ap.application_id and t.sq_pessoa = p.id
          order by t.dt_criacao desc limit 1) as ultimo_estado
    ) d
    where ap.application_id = p_aplicacao
      and ap.status in ('ELIGIBLE', 'INVITED', 'IN_PROGRESS')
      and p.active
      and (v_situacao = 'ALL' or d.situacao = v_situacao)
      and (
        v_busca is null
        or public.unaccent_lower(p.full_name) like '%' || public.unaccent_lower(v_busca) || '%'
        or p.employee_number like '%' || v_busca || '%'
        or public.unaccent_lower(p.institutional_email) like '%' || public.unaccent_lower(v_busca) || '%'
      )
    limit v_limite
  ) f;

  return v_result;
end;
$$;

revoke all on function public.fc_listar_audiencia_email(uuid, text, text, integer) from public, anon;
grant execute on function public.fc_listar_audiencia_email(uuid, text, text, integer) to authenticated;

comment on function public.fc_listar_audiencia_email(uuid, text, text, integer) is
  'Participantes elegíveis do ciclo com a situação de resposta e o último e-mail de cada um. Alimenta a seleção de destinatários.';

---------------------------------------------------------------------------
-- 9. Histórico de envios e resumo por ciclo.
--
-- A tabela não tem grant para authenticated e não vai ganhar: a leitura passa
-- por esta função, que exige papel administrativo.
---------------------------------------------------------------------------
create or replace function public.fc_listar_envios_email(
  p_aplicacao uuid default null,
  p_situacao text default 'ALL',
  p_limite integer default 200
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_result jsonb;
  v_limite integer := greatest(1, least(coalesce(p_limite, 200), 1000));
  v_situacao text := upper(coalesce(nullif(btrim(p_situacao), ''), 'ALL'));
begin
  if not public.can_manage_surveys() then
    raise exception 'Acesso restrito à administração de avaliações.';
  end if;

  if v_situacao not in ('ALL', 'PROCESSANDO', 'ENVIADO', 'FALHOU') then
    raise exception 'Situação inválida. Use ALL, PROCESSANDO, ENVIADO ou FALHOU.';
  end if;

  select jsonb_build_object(
    'resumo', (
      select coalesce(jsonb_object_agg(x.st_envio, x.total), '{}'::jsonb)
      from (
        select t.st_envio, count(*) as total
        from public.tl_email_participante t
        where p_aplicacao is null or t.sq_aplicacao = p_aplicacao
        group by t.st_envio
      ) x
    ),
    'envios', (
      select coalesce(jsonb_agg(to_jsonb(f) order by f.dt_criacao desc), '[]'::jsonb)
      from (
        select t.sq_email as id,
               t.tp_email as kind,
               t.st_envio as status,
               t.ds_erro as erro,
               t.dt_criacao as "createdAt",
               t.dt_envio as "sentAt",
               p.full_name as "personName",
               p.institutional_email as "personEmail",
               a.code as "applicationCode",
               a.name as "applicationName"
        from public.tl_email_participante t
        join public.people p on p.id = t.sq_pessoa
        join public.survey_applications a on a.id = t.sq_aplicacao
        where (p_aplicacao is null or t.sq_aplicacao = p_aplicacao)
          and (v_situacao = 'ALL' or t.st_envio = v_situacao)
        order by t.dt_criacao desc
        limit v_limite
      ) f
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.fc_listar_envios_email(uuid, text, integer) from public, anon;
grant execute on function public.fc_listar_envios_email(uuid, text, integer) to authenticated;

comment on function public.fc_listar_envios_email(uuid, text, integer) is
  'Histórico de e-mails aos participantes, com resumo por situação. Leitura administrativa de tl_email_participante.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop function if exists public.fc_listar_envios_email(uuid, text, integer);
--   drop function if exists public.fc_listar_audiencia_email(uuid, text, text, integer);
--   drop function if exists public.fc_agendar_envio_manual(uuid, uuid[]);
--   drop function if exists public.fc_reivindicar_emails_lote(integer);
--   drop function if exists public.fc_definir_textos_email(text, text);
--   drop index if exists public.in_email_partic_historico;
--   drop index if exists public.in_email_partic_auto_unico;
--   delete from public.tl_email_participante where tp_email = 'manual_reminder';
--   alter table public.tl_email_participante
--     drop constraint if exists ck_email_participante_tipo,
--     add constraint ck_email_participante_tipo
--       check (tp_email in ('research_opened', 'research_expiring_24h')),
--     add constraint uk_email_participante unique (sq_aplicacao, sq_pessoa, tp_email);
--   alter table public.tb_config_plataforma
--     drop column if exists tx_instrucao_email,
--     drop column if exists tx_rodape_email;
--   -- fc_obter_marca_plataforma e fc_reivindicar_emails precisam ser
--   -- restauradas a partir de 20260817160000 e 20260818130000.
-- commit;
