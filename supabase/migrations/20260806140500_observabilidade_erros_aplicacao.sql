begin;

create table if not exists public.tl_erro_aplicacao (
  sq_erro uuid not null default gen_random_uuid(),
  co_referencia varchar(80) not null,
  no_rota varchar(200) not null,
  tp_erro varchar(40) not null,
  ds_mensagem varchar(1000) not null,
  ds_contexto jsonb not null default '{}'::jsonb,
  st_ambiente varchar(20) not null default 'PRODUCAO',
  nu_http_status integer,
  dt_ocorrencia timestamptz not null default timezone('utc', now()),
  constraint pk_tl_erro_aplicacao primary key (sq_erro),
  constraint uk_tl_erro_aplicacao_ref unique (co_referencia),
  constraint ck_tl_erro_aplicacao_tipo check (
    tp_erro in ('CLIENTE', 'SERVIDOR', 'REDE', 'BANCO', 'DESCONHECIDO')
  ),
  constraint ck_tl_erro_aplicacao_amb check (
    st_ambiente in ('DESENVOLVIMENTO', 'HOMOLOGACAO', 'PRODUCAO')
  ),
  constraint ck_tl_erro_aplicacao_http check (
    nu_http_status is null or nu_http_status between 100 and 599
  )
);

comment on table public.tl_erro_aplicacao is
  'Registro técnico sanitizado de falhas da aplicação, sem conteúdo de respostas ou dados pessoais.';
comment on column public.tl_erro_aplicacao.co_referencia is
  'Código opaco exibido ao usuário para correlação com suporte técnico.';
comment on column public.tl_erro_aplicacao.ds_contexto is
  'Contexto técnico limitado; não deve conter resposta de pesquisa, nome, e-mail, matrícula ou token.';

create index if not exists in_tl_erro_aplicacao_data
  on public.tl_erro_aplicacao (dt_ocorrencia desc);

create index if not exists in_tl_erro_aplicacao_tipo
  on public.tl_erro_aplicacao (tp_erro, st_ambiente, dt_ocorrencia desc);

alter table public.tl_erro_aplicacao enable row level security;

revoke all on public.tl_erro_aplicacao from public, anon, authenticated;
grant select, insert, delete on public.tl_erro_aplicacao to service_role;

drop policy if exists tl_erro_aplicacao_service_role on public.tl_erro_aplicacao;
create policy tl_erro_aplicacao_service_role
on public.tl_erro_aplicacao
for all
to service_role
using (true)
with check (true);

commit;
