-- Manutenção antes do pico de respostas de um ciclo.
--
-- QUANDO RODAR: na véspera da divulgação em massa e, se o ciclo for longo, uma
-- vez por semana enquanto ele estiver aberto.
--
-- POR QUE EXISTE: em 12/08/2026 o painel de monitoramento levava 961 ms em
-- média. A causa não era a consulta — era `VACUUM` que nunca havia rodado
-- nessas tabelas. Com o mapa de visibilidade desatualizado, o banco relia o
-- disco à toa: a leitura de `people` (1.029 linhas) levava 47,7 ms. Depois do
-- VACUUM caiu para 0,76 ms, e a consulta inteira foi de 96 ms para 14 ms.
--
-- O volume cresce durante o ciclo: `answers` sai de algumas centenas para
-- dezenas de milhares (52 perguntas por participante). Estatísticas velhas
-- levam o planejador a escolher planos ruins justamente quando há mais gente
-- respondendo.
--
-- SEGURANÇA: `vacuum (analyze)` não altera dado nem bloqueia leitura ou
-- escrita. As consultas de diagnóstico são todas somente leitura.
--
-- Rode no SQL Editor do Supabase, bloco a bloco.

-- ---------------------------------------------------------------------------
-- 1. Manutenção das tabelas quentes
--
-- `vacuum` não roda dentro de transação: execute estas linhas isoladamente,
-- sem envolver em begin/commit.
-- ---------------------------------------------------------------------------
vacuum (analyze) public.people;
vacuum (analyze) public.application_participants;
vacuum (analyze) public.cddi_leadership_links;
vacuum (analyze) public.submissions;
vacuum (analyze) public.answers;
vacuum (analyze) public.answer_options;

-- ---------------------------------------------------------------------------
-- 2. Confirmação da manutenção
--
-- `linhas_mortas` alto em relação a `linhas` indica que o autovacuum não está
-- acompanhando o ritmo de gravação — repita o bloco 1 com mais frequência.
-- ---------------------------------------------------------------------------
select relname                                            as tabela,
       n_live_tup                                         as linhas,
       n_dead_tup                                         as linhas_mortas,
       greatest(last_vacuum, last_autovacuum)             as ultimo_vacuum,
       greatest(last_analyze, last_autoanalyze)           as ultimo_analyze,
       pg_size_pretty(pg_total_relation_size(relid))      as tamanho
from pg_stat_user_tables
where relname in ('people', 'application_participants', 'cddi_leadership_links',
                  'submissions', 'answers', 'answer_options')
order by n_dead_tup desc;

-- ---------------------------------------------------------------------------
-- 3. Consultas mais lentas da aplicação
--
-- Só as chamadas via PostgREST — o que os navegadores realmente executam.
-- Referência medida em 12/08/2026, com o banco já limpo:
--   save_my_cddi_answer ~4,5 ms · fc_obter_contexto_plataforma ~11,6 ms
--   get_public_survey_form ~30 ms
-- Média acima de 200 ms num caminho de resposta merece investigação.
-- ---------------------------------------------------------------------------
select substring(query from '"public"\."([a-z_0-9]+)"') as rpc,
       calls                                            as chamadas,
       round(mean_exec_time::numeric, 1)                as media_ms,
       round(max_exec_time::numeric, 1)                 as pior_ms
from pg_stat_statements
where query like '%pgrst_call%'
  and substring(query from '"public"\."([a-z_0-9]+)"') is not null
order by mean_exec_time desc
limit 20;

-- Zera o acumulado para medir só a janela do pico (opcional):
-- select pg_stat_statements_reset();

-- ---------------------------------------------------------------------------
-- 4. Conexões em uso
--
-- A instância Micro permite 60 conexões. O navegador fala com o PostgREST, que
-- agrupa conexões — 1.000 pessoas não viram 1.000 conexões. Se este número
-- encostar no limite durante o pico, é sinal de que o compute precisa subir.
-- ---------------------------------------------------------------------------
select current_setting('max_connections')                     as limite,
       count(*)                                               as em_uso,
       count(*) filter (where state = 'active')               as executando,
       count(*) filter (where state = 'idle in transaction')  as presas_em_transacao
from pg_stat_activity;

-- ---------------------------------------------------------------------------
-- 5. Andamento do ciclo
--
-- Confronta participantes, vínculos de chefia e submissões. Pessoa sem chefia
-- fica bloqueada na etapa de identificação — a fila de correção está em
-- Administração › Equipes.
-- ---------------------------------------------------------------------------
select a.code                                                                  as ciclo,
       a.status,
       a.closes_at                                                             as encerra_em,
       (select count(*) from public.application_participants ap
         where ap.application_id = a.id)                                       as participantes,
       (select count(distinct l.subordinate_person_id) from public.cddi_leadership_links l
         where l.application_id = a.id and l.status = 'ACTIVE' and l.valid_to is null) as com_chefia,
       (select count(*) from public.submissions s
         where s.application_id = a.id and s.status = 'DRAFT')                  as em_andamento,
       (select count(*) from public.submissions s
         where s.application_id = a.id and s.status in ('SUBMITTED', 'VALIDATED')) as enviadas
from public.survey_applications a
where a.status in ('OPEN', 'SCHEDULED')
order by a.closes_at;

-- ---------------------------------------------------------------------------
-- 6. Ritmo de resposta nas últimas 24 h
--
-- Mostra se a carga está diluída ou concentrada. Concentração forte perto do
-- prazo é o cenário que justifica subir o compute antes.
-- ---------------------------------------------------------------------------
select date_trunc('hour', s.updated_at)              as hora,
       count(*)                                      as submissoes_tocadas,
       count(*) filter (where s.submitted_at is not null) as enviadas
from public.submissions s
where s.updated_at > timezone('utc', now()) - interval '24 hours'
group by 1
order by 1 desc;
