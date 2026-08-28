begin;

-- ============================================================================
-- Unificação de schemas: private, db_governanca e "DB_PESQUISAS" em sigav
-- ============================================================================
--
-- A separação em quatro schemas (sigav, private, db_governanca, "DB_PESQUISAS")
-- vem da era database/PostgREST, onde "não exposto pela Data API" era uma
-- fronteira real: o schema listado em Exposed schemas decidia o que o
-- PostgREST alcançava, e cada um tinha grants por papel (anon/authenticated/
-- service_role) que o Postgres aplicava sozinho.
--
-- Essa fronteira não existe mais. Desde a migração para db_dataware, a
-- aplicação conecta com uma única credencial (usr_sip_app, sem CREATEROLE) e
-- quem decide se uma chamada é permitida é RPC_PERMISSIONS, em
-- src/lib/db/rpc-permissions.ts — não o schema onde a função mora, nem um
-- papel Postgres que hoje só existe na réplica local (ver o cabeçalho daquele
-- arquivo). Manter quatro schemas por esse motivo virou só burocracia: mais um
-- lugar para procurar uma função, mais um schema para lembrar de replicar
-- (scripts/replicar-banco-local.mjs).
--
-- O que esta migration move, sem recriar dado ou lógica:
--   - private: as duas funções auxiliares de RLS (can_audit_platform,
--     can_edit_submission) — já com corpo e search_path qualificados para
--     sigav desde 20260826180000_migrar_schema_sigav.sql, então a
--     transferência de schema não exige recompilar nada.
--   - db_governanca: a tabela e a view do catálogo de conformidade de
--     nomenclatura.
--   - "DB_PESQUISAS": as oito views institucionais para consumo externo
--     (Power BI). Além de mudar de schema, saem da grafia maiúscula entre
--     aspas (VW_PESSOA, SQ_PESSOA) para o padrão do projeto — ver
--     docs/database-naming-standard.md, que já explica por que este projeto
--     usa em minúsculas os mesmos prefixos do padrão institucional AgSUS:
--     identificador entre aspas em maiúsculas atrapalha portabilidade e
--     manutenção, exatamente o problema que esta migration resolve. Nada em
--     src/ referencia essas views, então o rename não exige publicar nova
--     versão da aplicação — só avisar quem consome essas views fora do
--     repositório (relatório de BI), se houver.
--
-- Cada schema de origem é tratado como opcional: "DB_PESQUISAS" nunca chegou
-- a existir em db_dataware (só nasce em banco que reproduz o histórico
-- completo via `PostgreSQL db reset`), e o guard `if exists` cobre os dois
-- ambientes sem precisar de dois arquivos de migration.

do $migration$
declare
  objeto record;
  coluna record;
  v_nome_destino text;
  v_quantidade bigint;
begin
  -- --------------------------------------------------------------------
  -- private → sigav
  -- --------------------------------------------------------------------
  -- São quatro funções hoje (can_audit_platform, can_edit_submission,
  -- can_track_platform_presence, can_view_platform_presence — as duas
  -- últimas de 20260819135306_configurar_presenca_online.sql), todas já
  -- recompiladas para `sigav.` e `search_path = pg_catalog, sigav, auth` por
  -- 20260826180000_migrar_schema_sigav.sql. Em vez de listar esse número à
  -- mão, a transferência percorre o que de fato existe no schema — a
  -- validação de fechamento logo abaixo é o que garante que nada ficou para
  -- trás.
  if exists (select 1 from pg_namespace where nspname = 'private') then
    for objeto in
      select p.oid, p.proname, pg_get_function_identity_arguments(p.oid) as argumentos
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'private'
       order by p.proname
    loop
      execute format('alter function private.%I(%s) set schema sigav', objeto.proname, objeto.argumentos);
    end loop;

    select count(*)
      into v_quantidade
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private';

    if v_quantidade <> 0 then
      raise exception 'schema private ainda contém % função(ões) após a transferência; consolidação interrompida.', v_quantidade;
    end if;

    drop schema private;
  end if;

  -- --------------------------------------------------------------------
  -- db_governanca → sigav
  -- --------------------------------------------------------------------
  if exists (select 1 from pg_namespace where nspname = 'db_governanca') then
    if to_regclass('db_governanca.tb_catalogo_objeto') is not null then
      alter table db_governanca.tb_catalogo_objeto set schema sigav;
    end if;

    if to_regclass('db_governanca.vw_resumo_migracao') is not null then
      alter view db_governanca.vw_resumo_migracao set schema sigav;
    end if;

    select count(*)
      into v_quantidade
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'db_governanca';

    if v_quantidade <> 0 then
      raise exception 'schema db_governanca ainda contém % objeto(s) além dos dois esperados; consolidação interrompida.', v_quantidade;
    end if;

    drop schema db_governanca;
  end if;

  -- --------------------------------------------------------------------
  -- "DB_PESQUISAS" → sigav, renomeada para o padrão do projeto
  -- --------------------------------------------------------------------
  if exists (select 1 from pg_namespace where nspname = 'DB_PESQUISAS') then
    for objeto in
      select c.oid, c.relname
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'DB_PESQUISAS'
         and c.relkind = 'v'
       order by c.relname
    loop
      v_nome_destino := lower(objeto.relname);

      if to_regclass('sigav.' || v_nome_destino) is not null then
        raise exception 'sigav.% já existe; não é possível mover "DB_PESQUISAS".%', v_nome_destino, objeto.relname;
      end if;

      execute format('alter view %I.%I set schema sigav', 'DB_PESQUISAS', objeto.relname);
      execute format('alter view sigav.%I rename to %I', objeto.relname, v_nome_destino);

      -- Colunas destas views são aliases definidos no corpo da consulta
      -- (SQ_PESSOA, NO_PESSOA...), não nomes físicos herdados de outra
      -- tabela — por isso renomear é seguro e não afeta a tabela de origem.
      for coluna in
        select attname
          from pg_attribute
         where attrelid = objeto.oid
           and attnum > 0
           and not attisdropped
           and attname <> lower(attname)
         order by attnum
      loop
        execute format('alter view sigav.%I rename column %I to %I', v_nome_destino, coluna.attname, lower(coluna.attname));
      end loop;
    end loop;

    select count(*)
      into v_quantidade
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'DB_PESQUISAS';

    if v_quantidade <> 0 then
      raise exception 'schema "DB_PESQUISAS" ainda contém % objeto(s) após mover as views; consolidação interrompida.', v_quantidade;
    end if;

    drop schema "DB_PESQUISAS";
  end if;

  -- Nenhuma tabela pode ficar sem RLS depois da consolidação — mesma
  -- validação de fechamento de 20260826180000_migrar_schema_sigav.sql.
  select count(*)
    into v_quantidade
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'sigav'
     and c.relkind in ('r', 'p')
     and not c.relrowsecurity;

  if v_quantidade <> 0 then
    raise exception 'a validação final encontrou % tabela(s) de sigav sem RLS.', v_quantidade;
  end if;
end;
$migration$;

comment on schema sigav is
  'Domínio transacional e superfície da Data API da plataforma SIGAV. Único schema de aplicação — private, db_governanca e "DB_PESQUISAS" foram consolidados aqui.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   create schema if not exists private authorization pg_database_owner;
--   revoke all on schema private from public, anon, authenticated, service_role;
--   alter function sigav.can_audit_platform() set schema private;
--   alter function sigav.can_edit_submission(uuid) set schema private;
--
--   create schema if not exists db_governanca authorization pg_database_owner;
--   revoke all on schema db_governanca from public, anon, authenticated;
--   grant usage on schema db_governanca to service_role;
--   alter table sigav.tb_catalogo_objeto set schema db_governanca;
--   alter view sigav.vw_resumo_migracao set schema db_governanca;
--
--   create schema if not exists "DB_PESQUISAS" authorization pg_database_owner;
--   grant usage on schema "DB_PESQUISAS" to authenticated, service_role;
--   -- Para cada view movida (vw_pessoa, vw_pesquisa, vw_aplicacao_pesquisa,
--   -- vw_submissao, vw_resposta, vw_resposta_opcao, vw_resultado_competencia,
--   -- vw_resultado_final_cddi): renomear cada coluna de volta para o nome
--   -- maiúsculo original, renomear a view para "VW_NOME" e mover para
--   -- "DB_PESQUISAS" — na ordem inversa desta migration, usando os nomes de
--   -- 20260805184500_institutional_naming_views.sql como referência.
-- commit;
