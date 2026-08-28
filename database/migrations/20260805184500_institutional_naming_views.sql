begin;

-- Camada institucional de leitura conforme o Padrão de Nomenclatura AgSUS.
-- As tabelas operacionais existentes permanecem inalteradas para preservar
-- compatibilidade com funções, políticas RLS e aplicação em produção.

create schema if not exists "DB_PESQUISAS";
comment on schema "DB_PESQUISAS" is
  'Camada institucional de leitura do AgSUS Pesquisas, com objetos e colunas conforme o padrão semântico corporativo.';

grant usage on schema "DB_PESQUISAS" to authenticated, service_role;

create or replace view "DB_PESQUISAS"."VW_PESSOA"
with (security_invoker = true)
as
select
  p.id as "SQ_PESSOA",
  p.auth_user_id as "SQ_USUARIO_AUTENTICACAO",
  p.employee_number as "NU_MATRICULA",
  p.full_name as "NO_PESSOA",
  p.institutional_email as "DS_EMAIL_INSTITUCIONAL",
  p.job_title as "DS_CARGO",
  p.cost_center as "DS_CENTRO_CUSTO",
  p.organizational_unit_id as "SQ_UNIDADE_ORGANIZACIONAL",
  p.workplace as "DS_LOCAL_TRABALHO",
  p.employment_status as "ST_VINCULO",
  case when p.active then 'S' else 'N' end as "ST_REGISTRO_ATIVO",
  p.source_system as "CO_SISTEMA_ORIGEM",
  p.source_key as "CO_CHAVE_ORIGEM",
  p.metadata as "DS_METADADO",
  p.created_at as "DT_INCLUSAO",
  p.updated_at as "DT_ATUALIZACAO"
from public.people p;

create or replace view "DB_PESQUISAS"."VW_PESQUISA"
with (security_invoker = true)
as
select
  s.id as "SQ_PESQUISA",
  s.code as "CO_PESQUISA",
  s.name as "NO_PESQUISA",
  s.description as "DS_PESQUISA",
  s.owner_unit_id as "SQ_UNIDADE_RESPONSAVEL",
  s.status as "ST_PESQUISA",
  s.settings as "DS_CONFIGURACAO",
  s.created_by as "SQ_USUARIO_INCLUSAO",
  s.created_at as "DT_INCLUSAO",
  s.updated_at as "DT_ATUALIZACAO"
from public.surveys s;

create or replace view "DB_PESQUISAS"."VW_APLICACAO_PESQUISA"
with (security_invoker = true)
as
select
  a.id as "SQ_APLICACAO",
  a.survey_version_id as "SQ_VERSAO_PESQUISA",
  a.code as "CO_APLICACAO",
  a.name as "NO_APLICACAO",
  a.opens_at as "DT_ABERTURA",
  a.closes_at as "DT_ENCERRAMENTO",
  a.status as "ST_APLICACAO",
  case when a.allow_drafts then 'S' else 'N' end as "ST_PERMITE_RASCUNHO",
  case when a.allow_resubmission then 'S' else 'N' end as "ST_PERMITE_REENVIO",
  case when a.anonymous then 'S' else 'N' end as "ST_ANONIMA",
  a.access_mode as "TP_ACESSO",
  a.settings as "DS_CONFIGURACAO",
  a.created_by as "SQ_USUARIO_INCLUSAO",
  a.created_at as "DT_INCLUSAO",
  a.updated_at as "DT_ATUALIZACAO"
from public.survey_applications a;

create or replace view "DB_PESQUISAS"."VW_SUBMISSAO"
with (security_invoker = true)
as
select
  s.id as "SQ_SUBMISSAO",
  s.application_id as "SQ_APLICACAO",
  s.participant_id as "SQ_PARTICIPANTE",
  s.respondent_person_id as "SQ_PESSOA_RESPONDENTE",
  s.subject_person_id as "SQ_PESSOA_AVALIADA",
  s.submission_type as "TP_SUBMISSAO",
  s.status as "ST_SUBMISSAO",
  s.started_at as "DT_INICIO",
  s.submitted_at as "DT_ENVIO",
  s.version as "NU_VERSAO",
  s.calculated_result as "VL_RESULTADO",
  s.metadata as "DS_METADADO",
  s.created_at as "DT_INCLUSAO",
  s.updated_at as "DT_ATUALIZACAO"
from public.submissions s;

create or replace view "DB_PESQUISAS"."VW_RESPOSTA"
with (security_invoker = true)
as
select
  a.id as "SQ_RESPOSTA",
  a.submission_id as "SQ_SUBMISSAO",
  a.question_id as "SQ_PERGUNTA",
  a.answer_text as "DS_RESPOSTA",
  a.answer_number as "VL_RESPOSTA",
  a.answer_boolean as "ST_RESPOSTA_LOGICA",
  a.answer_date as "DT_RESPOSTA",
  a.answer_datetime as "DT_HR_RESPOSTA",
  a.answer_json as "DS_RESPOSTA_ESTRUTURADA",
  a.score as "VL_PONTUACAO",
  a.created_at as "DT_INCLUSAO",
  a.updated_at as "DT_ATUALIZACAO"
from public.answers a;

create or replace view "DB_PESQUISAS"."VW_RESPOSTA_OPCAO"
with (security_invoker = true)
as
select
  ao.answer_id as "SQ_RESPOSTA",
  ao.option_id as "SQ_OPCAO",
  ao.position as "NU_POSICAO",
  ao.created_at as "DT_INCLUSAO"
from public.answer_options ao;

create or replace view "DB_PESQUISAS"."VW_RESULTADO_COMPETENCIA"
with (security_invoker = true)
as
select
  r.id as "SQ_RESULTADO_COMPETENCIA",
  r.submission_id as "SQ_SUBMISSAO",
  r.competency_section_id as "SQ_SECAO_COMPETENCIA",
  r.behavior_average as "VL_MEDIA_COMPORTAMENTO",
  r.development_level as "VL_NIVEL_DESENVOLVIMENTO",
  r.result as "VL_RESULTADO",
  r.calculation_version as "CO_VERSAO_CALCULO",
  r.created_at as "DT_INCLUSAO",
  r.updated_at as "DT_ATUALIZACAO"
from public.cddi_competency_results r;

create or replace view "DB_PESQUISAS"."VW_RESULTADO_FINAL_CDDI"
with (security_invoker = true)
as
select
  r.id as "SQ_RESULTADO_FINAL",
  r.application_id as "SQ_APLICACAO",
  r.subject_person_id as "SQ_PESSOA_AVALIADA",
  r.auto_submission_id as "SQ_SUBMISSAO_AUTO",
  r.leader_submission_id as "SQ_SUBMISSAO_CHEFIA",
  r.auto_score as "VL_NOTA_AUTO",
  r.leader_score as "VL_NOTA_CHEFIA",
  r.final_score as "VL_NOTA_FINAL",
  r.status as "ST_RESULTADO",
  r.calculation_version as "CO_VERSAO_CALCULO",
  r.calculated_at as "DT_CALCULO",
  r.published_at as "DT_PUBLICACAO",
  r.metadata as "DS_METADADO",
  r.created_at as "DT_INCLUSAO",
  r.updated_at as "DT_ATUALIZACAO"
from public.cddi_final_results r;

comment on view "DB_PESQUISAS"."VW_PESSOA" is 'Visão institucional da base mestra de pessoas.';
comment on view "DB_PESQUISAS"."VW_PESQUISA" is 'Visão institucional do catálogo de pesquisas.';
comment on view "DB_PESQUISAS"."VW_APLICACAO_PESQUISA" is 'Visão institucional dos ciclos de aplicação.';
comment on view "DB_PESQUISAS"."VW_SUBMISSAO" is 'Visão institucional dos envios e rascunhos.';
comment on view "DB_PESQUISAS"."VW_RESPOSTA" is 'Visão institucional das respostas às perguntas.';
comment on view "DB_PESQUISAS"."VW_RESPOSTA_OPCAO" is 'Visão institucional das opções selecionadas.';
comment on view "DB_PESQUISAS"."VW_RESULTADO_COMPETENCIA" is 'Visão institucional dos resultados por competência CDDI.';
comment on view "DB_PESQUISAS"."VW_RESULTADO_FINAL_CDDI" is 'Visão institucional dos resultados finais CDDI.';

grant select on all tables in schema "DB_PESQUISAS" to authenticated, service_role;

commit;
