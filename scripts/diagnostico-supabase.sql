-- Diagnóstico do banco: confronta o que a aplicação espera com o que existe.
--
-- SOMENTE LEITURA — nenhuma consulta abaixo altera dados ou estrutura.
-- Rode no SQL Editor do Supabase (projeto de produção) e devolva a saída de
-- cada bloco. O objetivo é achar divergência entre o repositório e o banco:
-- migration registrada sem os objetos, função que a tela chama e não existe,
-- perfil acumulado, resíduo de logotipo na marca.
--
-- Contexto: o banco de produção já divergiu do histórico em 10/08/2026, porque
-- parte do esquema foi criada por SQL direto, sem registro. Ver
-- docs/operacao-permissoes.md.

-- ---------------------------------------------------------------------------
-- 1. Histórico de migrations registrado no banco
-- ---------------------------------------------------------------------------
select version
from supabase_migrations.schema_migrations
order by version;

-- ---------------------------------------------------------------------------
-- 2. Funções que o frontend chama: existem no banco?
--
-- `presente = false` é conflito real — a tela quebra com
-- "Could not find the function ... in the schema cache".
-- ---------------------------------------------------------------------------
with esperadas(nome) as (
  values
    ('add_person_to_my_team'),
    ('assign_admin_all_available_participants'),
    ('assign_admin_application_participant'),
    ('assign_admin_application_participants_bulk'),
    ('create_and_assign_admin_participant'),
    ('create_survey_draft'),
    ('delete_survey_question'),
    ('fc_atualizar_marca_plataforma'),
    ('fc_definir_perfil_pessoa'),
    ('fc_excluir_pesquisa_rascunho'),
    ('fc_listar_ciclos_lideranca'),
    ('fc_obter_contexto_plataforma'),
    ('fc_obter_marca_plataforma'),
    ('fc_obter_minha_equipe'),
    ('fc_pesquisar_equipe'),
    ('get_admin_people_base_summary'),
    ('get_cddi_monitoring_dashboard'),
    ('get_my_cddi_identity'),
    ('get_public_survey_form'),
    ('get_survey_builder'),
    ('get_survey_dashboard'),
    ('get_survey_operations'),
    ('list_access_workspace'),
    ('list_admin_application_participants'),
    ('list_admin_participant_applications'),
    ('list_managed_surveys'),
    ('list_my_survey_catalog'),
    ('list_platform_admin_leadership_links'),
    ('list_platform_admin_person_audit'),
    ('manage_survey_cycle'),
    ('remove_person_from_my_team'),
    ('resolve_authenticated_person'),
    ('save_my_cddi_answer'),
    ('save_my_survey_answer'),
    ('search_admin_people_for_application'),
    ('search_platform_admin_people'),
    ('set_admin_application_participant_status'),
    ('set_platform_admin_leadership_link'),
    ('start_or_resume_my_cddi_submission'),
    ('start_or_resume_my_survey_submission'),
    ('submit_my_cddi_submission'),
    ('submit_my_survey_submission'),
    ('sync_cddi_manager_rows'),
    ('sync_my_google_avatar'),
    ('sync_people_base_rows'),
    ('update_application_visual_settings'),
    ('update_platform_admin_person')
)
select e.nome,
       exists (
         select 1
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public' and p.proname = e.nome
       ) as presente
from esperadas e
order by presente, e.nome;

-- ---------------------------------------------------------------------------
-- 3. Tabelas de `public` sem RLS — cada linha aqui é exposição de dados
-- ---------------------------------------------------------------------------
select c.relname as tabela
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relkind = 'r'
  and c.relrowsecurity = false
order by c.relname;

-- ---------------------------------------------------------------------------
-- 4. Perfis: catálogo e exclusividade
--
-- A segunda consulta deve devolver zero. Qualquer valor acima disso significa
-- perfil acumulado, que o índice `in_perfil_unico_vigente` deveria impedir.
-- ---------------------------------------------------------------------------
select code, name from public.system_roles order by code;

select count(*) as pessoas_com_mais_de_um_perfil_vigente
from (
  select person_id
  from public.person_role_assignments
  where ends_at is null
  group by person_id
  having count(*) > 1
) as acumulados;

-- O índice que garante a exclusividade existe?
select indexname
from pg_indexes
where schemaname = 'public'
  and tablename = 'person_role_assignments';

-- ---------------------------------------------------------------------------
-- 5. Marca da plataforma: resíduo de logotipo
--
-- A aplicação passou a usar sempre o logotipo institucional fixo. Se as colunas
-- abaixo vierem preenchidas, é o registro antigo que causava o conflito da
-- barra lateral — some ao salvar a identidade uma vez pela tela.
-- ---------------------------------------------------------------------------
select co_configuracao,
       no_organizacao,
       no_produto,
       co_cor_principal,
       tx_url_logotipo is not null as tem_logotipo_gravado,
       tx_caminho
from public.tb_config_plataforma;

-- ---------------------------------------------------------------------------
-- 6. Volume atual — dimensiona a carga real do ciclo
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.people)                  as pessoas,
  (select count(*) from public.people where active)     as pessoas_ativas,
  (select count(*) from public.survey_applications)     as ciclos,
  (select count(*) from public.application_participants) as vinculos_participante,
  (select count(*) from public.submissions)             as submissoes,
  (select count(*) from public.answers)                 as respostas;

-- ---------------------------------------------------------------------------
-- 7. Ciclos e situação — confronta com o que a interface mostra
-- ---------------------------------------------------------------------------
select a.code   as ciclo,
       s.code   as pesquisa,
       a.status,
       a.opens_at,
       a.closes_at,
       (select count(*) from public.application_participants ap where ap.application_id = a.id) as participantes,
       (select count(*) from public.submissions sub where sub.application_id = a.id and sub.status in ('SUBMITTED','VALIDATED')) as enviadas
from public.survey_applications a
join public.survey_versions v on v.id = a.version_id
join public.surveys s on s.id = v.survey_id
order by a.created_at desc;
