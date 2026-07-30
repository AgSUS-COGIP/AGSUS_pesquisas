begin;

insert into public.organizational_units(code,name,unit_type,metadata)
values ('DOP','DIRETORIA DE OPERACOES','DIRETORIA','{"source":"CDDI_2026"}'::jsonb)
on conflict (code) where code is not null do update
set name=excluded.name,unit_type=excluded.unit_type,metadata=excluded.metadata,updated_at=timezone('utc',now());

insert into public.organizational_units(parent_id,code,name,unit_type,metadata)
select id,'UGP','UNIDADE DE GESTAO DE PESSOAS','UNIDADE','{"source":"CDDI_2026"}'::jsonb
from public.organizational_units where code='DOP'
on conflict (code) where code is not null do update
set parent_id=excluded.parent_id,name=excluded.name,unit_type=excluded.unit_type,metadata=excluded.metadata,updated_at=timezone('utc',now());

insert into public.organizational_units(parent_id,code,name,unit_type,metadata)
select id,'COGIP','COORDENACAO DE GESTAO DA INFORMACAO DE PESSOAL','COORDENACAO','{"source":"CDDI_2026"}'::jsonb
from public.organizational_units where code='UGP'
on conflict (code) where code is not null do update
set parent_id=excluded.parent_id,name=excluded.name,unit_type=excluded.unit_type,metadata=excluded.metadata,updated_at=timezone('utc',now());

insert into public.surveys(code,name,description,owner_unit_id,status,settings)
select 'CDDI','Ciclo de Devolutivas e Desenvolvimento Individual (CDDI)',
'Plataforma institucional de autoavaliação, avaliação da liderança e desenvolvimento individual.',id,'ACTIVE',
'{"legacy_script_version":"5.3","timezone":"America/Sao_Paulo","weights":{"behaviors":0.7,"development_level":0.3,"self":0.4,"leader":0.6},"score_min":1,"score_max":5,"text_limit":12000,"allow_iframe":true,"automatic_employee_number_link":false}'::jsonb
from public.organizational_units where code='COGIP'
on conflict (code) do update set name=excluded.name,description=excluded.description,owner_unit_id=excluded.owner_unit_id,status=excluded.status,settings=excluded.settings,updated_at=timezone('utc',now());

insert into public.survey_versions(survey_id,version_number,title,description,status,schema_version,settings,published_at)
select id,2026,'CDDI 2026','Versão institucional do ciclo 2026, migrada do aplicativo Google Apps Script.','PUBLISHED',1,
'{"cycle":"2026","competency_count":12,"calculation_version":"CDDI-2026-V1"}'::jsonb,
'2026-07-28 15:00:00-03'::timestamptz
from public.surveys where code='CDDI'
on conflict (survey_id,version_number) do update set title=excluded.title,description=excluded.description,status=excluded.status,settings=excluded.settings,published_at=excluded.published_at,updated_at=timezone('utc',now());

insert into public.survey_applications(survey_version_id,code,name,opens_at,closes_at,status,allow_drafts,allow_resubmission,anonymous,settings)
select sv.id,'CDDI-2026','Ciclo CDDI 2026','2026-07-28 15:00:00-03'::timestamptz,'2026-07-30 15:00:00-03'::timestamptz,'CLOSED',true,false,false,
'{"mode":"MIGRATED_LEGACY","source_spreadsheets":{"participants":"1YFz7gQBtJqXW-pLHzcWSVM4OOhQtDr8Mhfhhw_SNtAY","administration":"1do0QCNatZ0tw10Go590djcgiZN-52pQ-Jc9vUwRPxqM","results":"1znZt79NJnSxUbKFlXxo3dptnBnYWyygpo8UuvJhiRS8"},"leader_evaluation_rule":"ONE_PER_CYCLE","pdf_participant":"ACTIVE"}'::jsonb
from public.survey_versions sv join public.surveys s on s.id=sv.survey_id
where s.code='CDDI' and sv.version_number=2026
on conflict (code) do update set survey_version_id=excluded.survey_version_id,name=excluded.name,opens_at=excluded.opens_at,closes_at=excluded.closes_at,status=excluded.status,allow_drafts=excluded.allow_drafts,allow_resubmission=excluded.allow_resubmission,anonymous=excluded.anonymous,settings=excluded.settings,updated_at=timezone('utc',now());

create temporary table cddi_seed_competencies(
  code text primary key,
  title text not null,
  description text not null,
  position integer not null,
  legacy_name text not null,
  behaviors jsonb not null
) on commit drop;

insert into cddi_seed_competencies values
('C01','FOCO EM RESULTADO','Capacidade de direcionar o esforço para atingir os resultados esperados, definindo as melhores ações, mesmo em condições adversas, obedecendo ao binômio “qualidade e prazo”.',1,'Entregas e resultados','["Entrega atividades acordadas com qualidade e consistência.","Entrega atividades acordadas dentro do prazo estabelecido.","Apresenta volume de entregas adequado para o tempo e esforço dispendido."]'),
('C02','COMUNICAÇÃO','Capacidade de interagir com as pessoas, transmitindo a mensagem com coerência e clareza, promovendo feedback sempre que necessário e apresentando facilidade para ouvir, processar e compreender a mensagem.',2,'Comunicação','["Transmite ideias e informações em relação ao trabalho de forma clara e objetiva.","É capaz de ouvir o outro, buscando o equilíbrio de soluções satisfatórias nas propostas apresentadas pelas partes.","Utiliza a comunicação não violenta e institucional nos processos de trabalho."]'),
('C03','ORGANIZAÇÃO','Capacidade de organizar as ações de acordo com o planejado, estabelecendo prioridades, de forma a facilitar a execução das atividades sob sua demanda.',3,'Planejamento e organização','["Programa atividades e seleciona métodos para sua execução.","Reconhece e estabelece níveis de prioridade adequados ao seu processo de trabalho.","Demonstra atenção aos detalhes e ajustes finos nos seus processos de trabalho."]'),
('C04','RELACIONAMENTO INTERPESSOAL','Capacidade de se relacionar com as pessoas de forma empática, respeitando o outro, inclusive diante de situações conflitantes, demonstrando atitudes assertivas, comportamentos maduros e não combativos, de forma a facilitar a performance no trabalho.',4,'Relações profissionais','["Demonstra atitude profissional e respeitosa com os demais trabalhadores de diferentes níveis hierárquicos e aspectos culturais.","Em situações de conflito, é capaz de se expressar de forma assertiva e não violenta, priorizando soluções orientadas ao trabalho.","Age com responsabilidade afetiva, levando em consideração suas necessidades e as dos outros."]'),
('C05','TRABALHO EM EQUIPE','Capacidade de colaborar com todos os colegas de trabalho da instituição, desenvolvendo ações compartilhadas, preocupando-se com o crescimento profissional de todos e o alcance dos objetivos da organização.',5,'Trabalho em equipe','["Colabora com os colegas da equipe na realização de tarefas conjuntas.","Toma decisão levando em consideração seu nível de responsabilidade, não sendo omisso ou invasivo em relação às atribuições dos outros.","Trabalha de forma integrada com diferentes colegas e áreas, visando resultados institucionais e fortalecimento da equipe."]'),
('C06','DOMÍNIO TÉCNICO','Capacidade de demonstrar conhecimento dos elementos teóricos e práticos necessários à compreensão e execução de seu trabalho.',6,'Conhecimento técnico','["Demonstra conhecimento técnico necessário para o desenvolvimento das suas atividades.","Domina as atribuições que executa em seu trabalho.","Apresenta familiaridade com processos, rotinas e ferramentas necessárias para o desempenho de suas funções."]'),
('C07','DOMÍNIO TÉCNICO EM INTERCULTURALIDADE','Capacidade de reconhecer, compreender e atuar de forma adequada diante da diversidade cultural presente no contexto de trabalho e adaptar as práticas profissionais às especificidades dos diferentes grupos e territórios.',7,'Contexto social, cultural e territorial','["Analisa demandas considerando as especificidades sociais, culturais e territoriais dos contextos envolvidos.","Considera aspectos interculturais na comunicação e no desenvolvimento de suas atividades.","Atua em conformidade com os direitos dos povos indígenas e com as diretrizes da Saúde Indígena."]'),
('C08','ATUAÇÃO SISTÊMICA','Capacidade de compreender a interação e interdependência das partes que compõem a atividade, atuando de forma a facilitar as ações dos outros para o melhor resultado coletivo.',8,'Visão sistêmica e integração','["Ajusta prazos, prioridades e forma de execução a partir da leitura do impacto no encadeamento das atividades da equipe e de áreas correlatas.","Contribui para a integração operacional entre setores, adequando sua atuação às exigências do fluxo completo das atividades, e não apenas à sua tarefa individual.","Conduz suas atividades de maneira a apoiar o trabalho dos demais integrantes da equipe e o alcance dos objetivos comuns."]'),
('C09','COMPORTAMENTO PROFISSIONAL','Capacidade de respeitar as normas, regras e procedimentos estabelecidos pela organização e pela chefia imediata.',9,'Disciplina institucional','["Cumpre a carga horária de trabalho estabelecida, mantendo pontualidade e regularidade na jornada, sem atrasos recorrentes.","Atua em conformidade com os regulamentos internos e diretrizes superiores, demonstrando aderência aos processos institucionais.","Mantém aderência aos processos definidos, evitando improvisações que comprometam a padronização e a previsibilidade das entregas."]'),
('C10','PROATIVIDADE','Capacidade de demonstrar iniciativa dentro do trabalho, de forma independente, antecipando problemas, buscando e propondo sugestões de melhoria e efetuando decisões rápidas e pertinentes.',10,'Iniciativa e autonomia','["Demonstra interesse em se capacitar por iniciativa própria, atualizando-se e procurando aplicar os conhecimentos adquiridos em seu trabalho.","Propõe melhorias nos processos de trabalho a partir da observação de oportunidades de ajuste e otimização.","Demonstra autonomia na condução das atividades, tomando decisões adequadas dentro de sua esfera de atuação."]'),
('C11','ANÁLISE CRÍTICA','Capacidade de identificar e analisar criticamente a situação, buscando e selecionando alternativas pertinentes que oportunizem o melhor resultado, considerando limites e riscos.',11,'Análise crítica e decisão','["Analisa situações de trabalho de forma ampla e estruturada, considerando diferentes variáveis que incidem sobre suas ações e processos.","Avalia riscos e ganhos antes de realizar uma ação.","Questiona práticas e processos vigentes com base em evidências, propondo alternativas mais eficientes sem desconsiderar restrições reais."]'),
('C12','ADAPTABILIDADE','Capacidade de responder de forma ágil e construtiva às mudanças organizacionais, ajustando a atuação profissional a novos processos, tecnologias, prioridades e contextos de trabalho, preservando a qualidade das entregas e contribuindo para o alcance dos objetivos institucionais.',12,'Adaptabilidade e desenvolvimento','["Adapta-se com agilidade às mudanças nos processos de trabalho.","Reorganiza suas atividades conforme novas exigências do contexto, preservando a qualidade e a coerência dos resultados.","Reconhece lacunas no seu desenvolvimento profissional e toma ações para remediá-las."]');

with version_target as (
  select sv.id from public.survey_versions sv join public.surveys s on s.id=sv.survey_id
  where s.code='CDDI' and sv.version_number=2026
)
insert into public.survey_sections(survey_version_id,code,title,description,position,settings)
select v.id,c.code,c.title,c.description,c.position,
jsonb_build_object('module','CDDI','legacy_map_name',c.legacy_name,'weight_behaviors',0.7,'weight_development_level',0.3)
from version_target v cross join cddi_seed_competencies c
union all
select v.id,'FINAL','CONSIDERAÇÕES FINAIS','Registro de chefia responsável, devolutiva, ações de desenvolvimento e justificativa.',13,'{"module":"CDDI"}'::jsonb
from version_target v
on conflict (survey_version_id,code) where code is not null do update
set title=excluded.title,description=excluded.description,position=excluded.position,settings=excluded.settings,updated_at=timezone('utc',now());

with version_target as (
  select sv.id from public.survey_versions sv join public.surveys s on s.id=sv.survey_id
  where s.code='CDDI' and sv.version_number=2026
), behavior_questions as (
  select c.code section_code,c.code||'_B'||b.ordinality code,b.value title,b.ordinality::integer position
  from cddi_seed_competencies c cross join lateral jsonb_array_elements_text(c.behaviors) with ordinality b(value,ordinality)
), all_questions as (
  select section_code,code,title,'SCALE'::text question_type,true required,position,
  '{"min":1,"max":5,"integer":true,"min_label":"Nunca","max_label":"Sempre"}'::jsonb validation,
  '{}'::jsonb display_logic,'{"component":"BEHAVIOR","weight_group":0.7,"item_count":3}'::jsonb scoring,'{"module":"CDDI"}'::jsonb settings
  from behavior_questions
  union all
  select code,code||'_NIVEL','Como você avalia o nível de desenvolvimento nessa competência?','SCALE',true,4,
  '{"min":1,"max":5,"integer":true,"min_label":"Inicial","max_label":"Referência"}'::jsonb,'{}'::jsonb,
  '{"component":"DEVELOPMENT_LEVEL","weight":0.3}'::jsonb,'{"module":"CDDI"}'::jsonb
  from cddi_seed_competencies
  union all
  select * from (values
    ('FINAL','CHEFIA_RESPONSAVEL','Chefia responsável pelo ciclo','PERSON',true,1,'{"allowed_submission_types":["AUTO"]}'::jsonb,'{"submission_types":["AUTO"]}'::jsonb,'{}'::jsonb,'{"module":"CDDI","legacy_field":"E-mail chefia selecionada"}'::jsonb),
    ('FINAL','DEVOLUTIVA','Devolutiva / autoavaliação','LONG_TEXT',true,2,'{"max_length":12000}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{"module":"CDDI"}'::jsonb),
    ('FINAL','ACOES_DESENVOLVIMENTO','Ações de desenvolvimento','LONG_TEXT',true,3,'{"max_length":12000}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{"module":"CDDI"}'::jsonb),
    ('FINAL','JUSTIFICATIVA','Justificativa','LONG_TEXT',true,4,'{"max_length":12000}'::jsonb,'{}'::jsonb,'{}'::jsonb,'{"module":"CDDI"}'::jsonb)
  ) f(section_code,code,title,question_type,required,position,validation,display_logic,scoring,settings)
)
insert into public.survey_questions(survey_version_id,section_id,code,title,question_type,required,position,validation,display_logic,scoring,settings)
select v.id,ss.id,q.code,q.title,q.question_type,q.required,q.position,q.validation,q.display_logic,q.scoring,q.settings
from version_target v cross join all_questions q
join public.survey_sections ss on ss.survey_version_id=v.id and ss.code=q.section_code
on conflict (survey_version_id,code) do update
set section_id=excluded.section_id,title=excluded.title,question_type=excluded.question_type,required=excluded.required,position=excluded.position,validation=excluded.validation,display_logic=excluded.display_logic,scoring=excluded.scoring,settings=excluded.settings,updated_at=timezone('utc',now());

insert into public.question_options(question_id,code,label,value,score,position,metadata)
select q.id,n::text,
case when q.code like '%_NIVEL' then (array['Inicial','Em desenvolvimento','Adequado','Avançado','Referência'])[n]
else (array['Nunca','Raramente','Às vezes','Frequentemente','Sempre'])[n] end,
n::text,n::numeric,n,'{"module":"CDDI"}'::jsonb
from public.survey_questions q
join public.survey_versions sv on sv.id=q.survey_version_id
join public.surveys s on s.id=sv.survey_id
cross join generate_series(1,5) n
where s.code='CDDI' and sv.version_number=2026 and q.question_type='SCALE'
on conflict (question_id,code) do update
set label=excluded.label,value=excluded.value,score=excluded.score,position=excluded.position,active=true,metadata=excluded.metadata,updated_at=timezone('utc',now());

commit;
