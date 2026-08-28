-- ============================================================================
-- Arquivos de imagem no banco, no lugar do Storage do Supabase
-- ============================================================================
--
-- Substitui os buckets `platform-assets` (arte de fundo da tela de acesso e
-- logotipos) e `survey-assets` (capa por ciclo de pesquisa). O terceiro bucket,
-- `avatars`, não entra aqui porque não é usado: a foto vem da conta Google, por
-- `sigav.sync_my_google_avatar()`, que lê `auth.identities`.
--
-- POR QUE NO BANCO: o volume é pequeno e fixo — logotipos e capas, não anexos
-- de usuário. Guardá-los numa tabela dispensa subir e credenciar um serviço de
-- objetos, entra no mesmo backup e na mesma réplica do resto do esquema, e
-- sobrevive intacto à mudança para hospedagem própria.
--
-- MUDANÇA DE ORIGEM, E O QUE ELA IMPLICA: os buckets eram públicos e serviam de
-- um domínio do Supabase. Agora os bytes saem da própria origem da aplicação,
-- por `/api/arquivos/<balde>/<caminho>`. A leitura continua aberta, como era —
-- a capa aparece em `/responder/[applicationCode]`, que é rota pública, e a
-- arte de fundo aparece antes do login. O que **não** se mantém é a tolerância
-- a SVG: num domínio separado um SVG malicioso era inócuo, servido da mesma
-- origem ele executaria script no contexto da aplicação. Daí o allowlist de
-- tipo abaixo aceitar apenas PNG, JPEG e WEBP.

begin;

-- ---------------------------------------------------------------------------
-- Tabela
-- ---------------------------------------------------------------------------

create table if not exists sigav.tb_arquivo (
  sq_arquivo      uuid        not null default gen_random_uuid(),
  co_balde        text        not null,
  ds_caminho      text        not null,
  tp_conteudo     text        not null,
  nu_tamanho      integer     not null,
  im_conteudo     bytea       not null,
  co_autor        uuid        null,
  dt_criacao      timestamptz not null default now(),
  dt_atualizacao  timestamptz not null default now(),

  constraint pk_tb_arquivo primary key (sq_arquivo),

  -- O par (balde, caminho) é o endereço lógico do arquivo e reproduz o que o
  -- Storage garantia: `upsert` no mesmo caminho substitui, não duplica. É por
  -- ele que `accessBackgroundPath` e `bannerPath`, já gravados na configuração,
  -- continuam resolvendo sem precisar ser reescritos.
  constraint uk_tb_arquivo_caminho unique (co_balde, ds_caminho),

  constraint ck_tb_arquivo_balde
    check (co_balde in ('platform-assets', 'survey-assets')),

  constraint ck_tb_arquivo_tipo
    check (tp_conteudo in ('image/png', 'image/jpeg', 'image/webp')),

  -- 5 MB é o maior dos dois limites que as telas já aplicavam (capa de
  -- pesquisa; a arte de acesso valida 2 MB no navegador). O teto existe aqui
  -- para que o limite seja do banco, e não só da interface que envia.
  constraint ck_tb_arquivo_tamanho
    check (nu_tamanho > 0 and nu_tamanho <= 5 * 1024 * 1024),

  constraint fk_tb_arquivo_autor
    foreign key (co_autor) references auth.users (id) on delete set null
);

create index if not exists in_fk_tb_arquivo_autor on sigav.tb_arquivo (co_autor);

comment on table sigav.tb_arquivo is
  'Imagens da plataforma (marca e capas de pesquisa), no lugar dos buckets do Supabase Storage. Servidas por /api/arquivos.';
comment on column sigav.tb_arquivo.co_balde is
  'Namespace herdado do nome do bucket, preservado para que os caminhos já gravados continuem válidos.';
comment on column sigav.tb_arquivo.im_conteudo is
  'Bytes da imagem. Escrita e leitura passam pelas RPCs fc_arq_*; nada consulta esta coluna direto.';

-- RLS habilitada para preservar o invariante verificado pela migração para
-- `sigav` ("nenhuma tabela do schema sem RLS"). Ela não é a barreira efetiva:
-- a aplicação conecta como `usr_sip_app`, dono da tabela, e dono não é
-- submetido a RLS sem `force`. Quem autoriza são as funções abaixo, que são
-- `security definer` e checam o papel, mais a lista de
-- `src/lib/db/rpc-permissions.ts`.
alter table sigav.tb_arquivo enable row level security;

revoke all on sigav.tb_arquivo from public;

-- ---------------------------------------------------------------------------
-- Gravar (cria ou substitui)
-- ---------------------------------------------------------------------------

create or replace function sigav.fc_arq_gravar(
  p_balde text,
  p_caminho text,
  p_tipo text,
  p_conteudo_base64 text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, sigav, auth
as $$
declare
  v_caminho text := btrim(coalesce(p_caminho, ''));
  v_conteudo bytea;
  v_tamanho integer;
  v_id uuid;
begin
  -- Mesma autoridade que decidia a escrita nas políticas dos dois buckets:
  -- quem administra pesquisas administra a marca e as capas.
  if not sigav.can_manage_surveys() then
    raise exception 'Sem permissão para gravar arquivos.' using errcode = '42501';
  end if;

  if v_caminho = '' then
    raise exception 'O caminho do arquivo é obrigatório.' using errcode = '22023';
  end if;

  -- Impede que um caminho escape do próprio balde ou monte um endereço que a
  -- rota de leitura interpretaria de outro modo.
  if v_caminho like '/%' or v_caminho like '%..%' then
    raise exception 'Caminho de arquivo inválido: %', v_caminho using errcode = '22023';
  end if;

  if coalesce(p_conteudo_base64, '') = '' then
    raise exception 'O conteúdo do arquivo é obrigatório.' using errcode = '22023';
  end if;

  v_conteudo := decode(p_conteudo_base64, 'base64');
  v_tamanho := octet_length(v_conteudo);

  insert into sigav.tb_arquivo (co_balde, ds_caminho, tp_conteudo, nu_tamanho, im_conteudo, co_autor)
  values (p_balde, v_caminho, p_tipo, v_tamanho, v_conteudo, auth.uid())
  on conflict on constraint uk_tb_arquivo_caminho do update
    set tp_conteudo    = excluded.tp_conteudo,
        nu_tamanho     = excluded.nu_tamanho,
        im_conteudo    = excluded.im_conteudo,
        co_autor       = excluded.co_autor,
        dt_atualizacao = now()
  returning sq_arquivo into v_id;

  return jsonb_build_object(
    'sqArquivo', v_id,
    'balde', p_balde,
    'caminho', v_caminho,
    'tamanho', v_tamanho,
    'url', '/api/arquivos/' || p_balde || '/' || v_caminho
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Listar (metadados; nunca os bytes)
-- ---------------------------------------------------------------------------

create or replace function sigav.fc_arq_listar(
  p_balde text,
  p_prefixo text default ''
)
returns table (
  caminho text,
  tipo text,
  tamanho integer,
  criado_em timestamptz,
  url text
)
language plpgsql
security definer
set search_path = pg_catalog, sigav, auth
as $$
begin
  if not sigav.can_manage_surveys() then
    raise exception 'Sem permissão para listar arquivos.' using errcode = '42501';
  end if;

  return query
    select a.ds_caminho,
           a.tp_conteudo,
           a.nu_tamanho,
           a.dt_criacao,
           '/api/arquivos/' || a.co_balde || '/' || a.ds_caminho
    from sigav.tb_arquivo a
    where a.co_balde = p_balde
      and a.ds_caminho like coalesce(nullif(btrim(p_prefixo), ''), '') || '%'
    order by a.dt_criacao desc
    limit 100;
end;
$$;

-- ---------------------------------------------------------------------------
-- Remover
-- ---------------------------------------------------------------------------

create or replace function sigav.fc_arq_remover(
  p_balde text,
  p_caminho text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, sigav, auth
as $$
declare
  v_removidos integer;
begin
  if not sigav.can_manage_surveys() then
    raise exception 'Sem permissão para remover arquivos.' using errcode = '42501';
  end if;

  delete from sigav.tb_arquivo
  where co_balde = p_balde and ds_caminho = btrim(coalesce(p_caminho, ''));

  get diagnostics v_removidos = row_count;

  -- Remover o que já não existe não é erro: a tela chama isto em rotinas de
  -- faxina, e falhar ali produziria mensagem de erro para um estado que já é o
  -- desejado.
  return jsonb_build_object('removidos', v_removidos);
end;
$$;

-- ---------------------------------------------------------------------------
-- Obter (leitura aberta, como eram os buckets públicos)
-- ---------------------------------------------------------------------------

create or replace function sigav.fc_arq_obter(
  p_balde text,
  p_caminho text
)
returns table (
  conteudo bytea,
  tipo text,
  tamanho integer,
  atualizado_em timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, sigav
as $$
  select a.im_conteudo, a.tp_conteudo, a.nu_tamanho, a.dt_atualizacao
  from sigav.tb_arquivo a
  where a.co_balde = p_balde
    and a.ds_caminho = btrim(coalesce(p_caminho, ''));
$$;

-- ---------------------------------------------------------------------------
-- Dono e execução
-- ---------------------------------------------------------------------------
--
-- Mesmo tratamento dado a `fc_srv_resolver_identidade_oauth`: os papéis
-- `anon`/`authenticated`/`service_role` existem na réplica local mas não no
-- cluster da empresa, então todo grant que os cite fica guardado por
-- `pg_roles`. Quem de fato executa é a conexão da aplicação (`usr_sip_app`); a
-- distinção de papel lógico está em `src/lib/db/rpc-permissions.ts`.

do $$
declare
  v_funcao text;
  v_funcoes text[] := array[
    'sigav.fc_arq_gravar(text, text, text, text)',
    'sigav.fc_arq_listar(text, text)',
    'sigav.fc_arq_remover(text, text)',
    'sigav.fc_arq_obter(text, text)'
  ];
begin
  foreach v_funcao in array v_funcoes loop
    execute format('revoke all on function %s from public', v_funcao);

    if exists (select 1 from pg_roles where rolname = 'usr_sip_app') then
      execute format('alter function %s owner to usr_sip_app', v_funcao);
      execute format('grant execute on function %s to usr_sip_app', v_funcao);
    end if;
  end loop;

  if exists (select 1 from pg_roles where rolname = 'usr_sip_app') then
    execute 'alter table sigav.tb_arquivo owner to usr_sip_app';
    execute 'grant select, insert, update, delete on sigav.tb_arquivo to usr_sip_app';
  end if;
end;
$$;

commit;

-- Rollback:
-- begin;
--   drop function if exists sigav.fc_arq_obter(text, text);
--   drop function if exists sigav.fc_arq_remover(text, text);
--   drop function if exists sigav.fc_arq_listar(text, text);
--   drop function if exists sigav.fc_arq_gravar(text, text, text, text);
--   drop table if exists sigav.tb_arquivo;
-- commit;
