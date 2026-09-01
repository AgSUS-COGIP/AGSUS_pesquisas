begin;

create schema if not exists db_governanca;
revoke all on schema db_governanca from public, anon, authenticated;
grant usage on schema db_governanca to service_role;

create table if not exists db_governanca.tb_catalogo_objeto (
  sq_catalogo uuid not null default gen_random_uuid(),
  sg_schema_atual varchar(30) not null,
  no_objeto_atual varchar(63) not null,
  tp_objeto varchar(20) not null,
  no_objeto_proposto varchar(30),
  st_conformidade varchar(20) not null default 'PENDENTE',
  ds_justificativa text,
  ds_estrategia_migracao text,
  st_registro_ativo varchar(1) not null default 'S',
  au_usuario_inclusao uuid,
  dt_inclusao timestamptz not null default timezone('utc', now()),
  au_usuario_alteracao uuid,
  dt_alteracao timestamptz not null default timezone('utc', now()),
  constraint pk_tb_catalogo_objeto primary key (sq_catalogo),
  constraint ck_tb_catalogo_objeto_status check (
    st_conformidade in ('CONFORME', 'PENDENTE', 'EXCECAO', 'EM_MIGRACAO')
  ),
  constraint ck_tb_catalogo_objeto_ativo check (st_registro_ativo in ('S', 'N')),
  constraint uk_tb_catalogo_objeto_atual unique (sg_schema_atual, no_objeto_atual, tp_objeto),
  constraint ck_tb_catalogo_objeto_proposto check (
    no_objeto_proposto is null
    or (
      char_length(no_objeto_proposto) <= 30
      and no_objeto_proposto = lower(no_objeto_proposto)
      and no_objeto_proposto ~ '^[a-z0-9_]+$'
    )
  )
);

comment on schema db_governanca is
  'Objetos internos de governança de dados, não expostos pela Data API.';
comment on table db_governanca.tb_catalogo_objeto is
  'Catálogo de conformidade e migração dos objetos de banco conforme padrão institucional AgSUS.';
comment on column db_governanca.tb_catalogo_objeto.no_objeto_proposto is
  'Nome institucional proposto, usando adaptação PostgreSQL em minúsculas e sem identificadores entre aspas.';

create index if not exists in_tb_catalogo_objeto_status
  on db_governanca.tb_catalogo_objeto (st_conformidade, st_registro_ativo);

create index if not exists in_tb_catalogo_objeto_tipo
  on db_governanca.tb_catalogo_objeto (tp_objeto, sg_schema_atual);

alter table db_governanca.tb_catalogo_objeto enable row level security;

revoke all on db_governanca.tb_catalogo_objeto from public, anon, authenticated;
grant select, insert, update, delete on db_governanca.tb_catalogo_objeto to service_role;

insert into db_governanca.tb_catalogo_objeto (
  sg_schema_atual,
  no_objeto_atual,
  tp_objeto,
  no_objeto_proposto,
  st_conformidade,
  ds_justificativa,
  ds_estrategia_migracao
)
values
  ('public', 'people', 'TABELA', 'tb_pessoa', 'PENDENTE', 'Objeto legado em inglês e sem prefixo institucional.', 'Criar camada compatível, migrar consumidores e renomear somente após homologação.'),
  ('public', 'surveys', 'TABELA', 'tb_pesquisa', 'PENDENTE', 'Objeto legado em inglês e sem prefixo institucional.', 'Preservar APIs atuais durante migração gradual.'),
  ('public', 'survey_versions', 'TABELA', 'th_versao_pesquisa', 'PENDENTE', 'Objeto legado de histórico/versionamento.', 'Migrar mantendo imutabilidade das versões publicadas.'),
  ('public', 'survey_applications', 'TABELA', 'tb_aplicacao_pesquisa', 'PENDENTE', 'Objeto legado em inglês e sem prefixo institucional.', 'Migrar contratos de RPC antes do rename físico.'),
  ('public', 'survey_sections', 'TABELA', 'tb_secao_pesquisa', 'PENDENTE', 'Objeto legado em inglês e sem prefixo institucional.', 'Criar compatibilidade e migrar consultas do construtor.'),
  ('public', 'survey_questions', 'TABELA', 'tb_pergunta_pesquisa', 'PENDENTE', 'Objeto legado em inglês e sem prefixo institucional.', 'Migrar com preservação de IDs e versionamento.'),
  ('public', 'question_options', 'TABELA', 'tb_opcao_pergunta', 'PENDENTE', 'Objeto legado em inglês e sem prefixo institucional.', 'Migrar junto das perguntas e respostas.'),
  ('public', 'application_participants', 'RELACIONAMENTO', 'rl_aplicacao_pessoa', 'PENDENTE', 'Relacionamento N:N sem prefixo institucional.', 'Migrar sem alterar vínculos ativos.'),
  ('public', 'submissions', 'TABELA', 'tb_submissao', 'PENDENTE', 'Objeto transacional crítico em inglês.', 'Adotar migração com dupla leitura e testes de autosalvamento.'),
  ('public', 'answers', 'TABELA', 'tb_resposta', 'PENDENTE', 'Objeto transacional crítico em inglês.', 'Migrar com integridade por submissão e pergunta.'),
  ('public', 'answer_options', 'RELACIONAMENTO', 'rl_resposta_opcao', 'PENDENTE', 'Relacionamento N:N sem prefixo institucional.', 'Migrar junto da tabela de respostas.'),
  ('public', 'audit_events', 'LOG', 'tl_evento_auditoria', 'PENDENTE', 'Tabela de log sem prefixo institucional.', 'Migrar preservando trilha histórica e retenção.')
on conflict (sg_schema_atual, no_objeto_atual, tp_objeto) do update
set no_objeto_proposto = excluded.no_objeto_proposto,
    ds_justificativa = excluded.ds_justificativa,
    ds_estrategia_migracao = excluded.ds_estrategia_migracao,
    dt_alteracao = timezone('utc', now());

commit;
