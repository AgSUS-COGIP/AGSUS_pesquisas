begin;

-- O schema `public` é a superfície padrão do PostgreSQL e não representa o
-- domínio da aplicação. Esta migration transfere os objetos da plataforma para
-- `sigav` sem recriá-los: OIDs, dados, constraints, índices, políticas RLS,
-- triggers, grants e dependências externas são preservados pelo PostgreSQL.
--
-- Corpos de funções são texto e não são reescritos por `set schema`. Depois da
-- transferência, eles são recompilados com os qualificadores e search_paths
-- novos. A operação inteira ocorre na mesma transação.

do $migration$
declare
  objeto record;
  definicao text;
  quantidade bigint;
begin
  if exists (select 1 from pg_namespace where nspname = 'sigav') then
    -- Produção já passou por uma migração manual para `sigav`. É seguro
    -- concluir a padronização desde que não existam objetos da aplicação
    -- distribuídos entre os dois schemas.
    select
      (select count(*)
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public'
          and c.relkind in ('r', 'p', 'f', 'S', 'v', 'm'))
      + (select count(*)
           from pg_proc p
           join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'public')
    into quantidade;

    if quantidade <> 0 then
      raise exception 'Os schemas public e sigav contêm objetos da aplicação ao mesmo tempo; a migração foi interrompida para evitar uma mistura de estados.';
    end if;
  else
    create schema sigav authorization pg_database_owner;
  end if;

  -- O migrador cobre todas as classes atualmente usadas pela aplicação. Uma
  -- classe nova deve ser tratada explicitamente, nunca deixada em `public` sem
  -- que a migration perceba.
  select
    (select count(*)
       from pg_operator o
       join pg_namespace n on n.oid = o.oprnamespace
      where n.nspname = 'public')
    + (select count(*)
         from pg_collation o
         join pg_namespace n on n.oid = o.collnamespace
        where n.nspname = 'public')
    + (select count(*)
         from pg_conversion o
         join pg_namespace n on n.oid = o.connamespace
        where n.nspname = 'public')
    + (select count(*)
         from pg_ts_config o
         join pg_namespace n on n.oid = o.cfgnamespace
        where n.nspname = 'public')
    + (select count(*)
         from pg_ts_dict o
         join pg_namespace n on n.oid = o.dictnamespace
        where n.nspname = 'public')
    + (select count(*)
         from pg_opclass o
         join pg_namespace n on n.oid = o.opcnamespace
        where n.nspname = 'public')
    + (select count(*)
         from pg_opfamily o
         join pg_namespace n on n.oid = o.opfnamespace
        where n.nspname = 'public')
  into quantidade;

  if quantidade <> 0 then
    raise exception 'O schema public contém % objeto(s) de classe ainda não suportada pelo migrador.', quantidade;
  end if;

  comment on schema sigav is
    'Domínio transacional e superfície da Data API da plataforma SIGAV.';

  revoke create on schema sigav from public;
  grant usage on schema sigav to postgres, anon, authenticated, service_role;

  -- Tipos independentes precisam chegar antes das relações e rotinas que os
  -- usam. Tipos de linha e arrays pertencentes a tabelas mudam junto com elas.
  for objeto in
    select t.typname, t.typtype
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      left join pg_class c on c.reltype = t.oid
     where n.nspname = 'public'
       and c.oid is null
       and t.typtype in ('c', 'd', 'e', 'r', 'm')
       and not exists (
         select 1
           from pg_depend d
          where d.classid = 'pg_type'::regclass
            and d.objid = t.oid
            and d.deptype = 'e'
       )
     order by t.typname
  loop
    if objeto.typtype = 'd' then
      execute format('alter domain public.%I set schema sigav', objeto.typname);
    else
      execute format('alter type public.%I set schema sigav', objeto.typname);
    end if;
  end loop;

  -- Tabelas carregam consigo índices, constraints, tipos de linha, sequências
  -- identity/serial vinculadas, triggers e políticas RLS.
  for objeto in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('r', 'p', 'f')
       and not exists (
         select 1
           from pg_depend d
          where d.classid = 'pg_class'::regclass
            and d.objid = c.oid
            and d.deptype = 'e'
       )
     order by c.relname
  loop
    execute format('alter table public.%I set schema sigav', objeto.relname);
  end loop;

  -- Sequências não vinculadas a uma coluna não acompanham uma tabela.
  for objeto in
    select c.relname
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind = 'S'
       and not exists (
         select 1
           from pg_depend d
          where d.classid = 'pg_class'::regclass
            and d.objid = c.oid
            and d.deptype = 'e'
       )
     order by c.relname
  loop
    execute format('alter sequence public.%I set schema sigav', objeto.relname);
  end loop;

  -- Views são transferidas depois das relações-base. Suas dependências são por
  -- OID, portanto as definições passam a resolver as tabelas em `sigav`.
  for objeto in
    select c.relname, c.relkind
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public'
       and c.relkind in ('v', 'm')
       and not exists (
         select 1
           from pg_depend d
          where d.classid = 'pg_class'::regclass
            and d.objid = c.oid
            and d.deptype = 'e'
       )
     order by c.relkind, c.relname
  loop
    if objeto.relkind = 'm' then
      execute format('alter materialized view public.%I set schema sigav', objeto.relname);
    else
      execute format('alter view public.%I set schema sigav', objeto.relname);
    end if;
  end loop;

  -- Todas as rotinas atuais são funções comuns (`prokind = f`). O guard abaixo
  -- impede que uma aggregate/procedure futura seja silenciosamente ignorada.
  select count(*)
    into quantidade
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public'
     and p.prokind <> 'f'
     and not exists (
       select 1
         from pg_depend d
        where d.classid = 'pg_proc'::regclass
          and d.objid = p.oid
          and d.deptype = 'e'
     );

  if quantidade <> 0 then
    raise exception 'O schema public contém % rotina(s) que não são funções comuns.', quantidade;
  end if;

  for objeto in
    select p.proname, pg_get_function_identity_arguments(p.oid) as argumentos
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prokind = 'f'
       and not exists (
         select 1
           from pg_depend d
          where d.classid = 'pg_proc'::regclass
            and d.objid = p.oid
            and d.deptype = 'e'
       )
     order by p.proname, pg_get_function_identity_arguments(p.oid)
  loop
    execute format(
      'alter function public.%I(%s) set schema sigav',
      objeto.proname,
      objeto.argumentos
    );
  end loop;

  -- `ALTER ... SET SCHEMA` preserva dependências de catálogo, mas corpos e
  -- configurações de função são textuais. Recompilar mantém OID, owner e ACL.
  for objeto in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('sigav', 'private')
       and p.prokind = 'f'
       and (
         p.prosrc like '%public.%'
         or p.prosrc like '%''public''%'
         or array_to_string(p.proconfig, ',') like '%public%'
       )
     order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
  loop
    definicao := pg_get_functiondef(objeto.oid);
    definicao := replace(definicao, 'public.', 'sigav.');
    definicao := replace(definicao, '''public''', '''sigav''');
    execute definicao;
  end loop;

  -- O catálogo descreve a localização atual dos objetos legados.
  if to_regclass('db_governanca.tb_catalogo_objeto') is not null then
    update db_governanca.tb_catalogo_objeto
       set sg_schema_atual = 'sigav',
           dt_alteracao = timezone('utc', now())
     where sg_schema_atual = 'public';
  end if;

  -- Falha fechada: ao final não pode sobrar nenhum objeto da aplicação em
  -- `public`, nem qualificador antigo em funções controladas pelo projeto.
  select
    (select count(*)
       from pg_class c
       join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relkind in ('r', 'p', 'f', 'S', 'v', 'm'))
    + (select count(*)
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public')
    + (select count(*)
         from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('sigav', 'private')
          and (
            p.prosrc like '%public.%'
            or p.prosrc like '%''public''%'
            or array_to_string(p.proconfig, ',') like '%public%'
          ))
  into quantidade;

  if quantidade <> 0 then
    raise exception 'A validação final encontrou % referência(s) ou objeto(s) ainda vinculados a public.', quantidade;
  end if;

  select count(*)
    into quantidade
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'sigav'
     and c.relkind in ('r', 'p')
     and not c.relrowsecurity;

  if quantidade <> 0 then
    raise exception 'A validação final encontrou % tabela(s) do schema sigav sem RLS.', quantidade;
  end if;
end;
$migration$;

-- Mantém o comportamento atual do projeto para objetos futuros. Grants de
-- objetos já existentes foram preservados durante a transferência.
alter default privileges for role postgres in schema sigav
  grant select, insert, update, delete, truncate, references, trigger
  on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema sigav
  grant usage, select, update on sequences to anon, authenticated, service_role;
alter default privileges for role postgres in schema sigav
  grant execute on functions to anon, authenticated, service_role;

notify pgrst, 'reload schema';

commit;

-- Rollback operacional (executar somente com a Data API já apontada novamente
-- para `public`): aplicar a operação inversa em nova migration, substituindo
-- `sigav.` por `public.` nos corpos/search_paths, transferindo rotinas, views,
-- tabelas, sequências e tipos de volta, e só então removendo o schema `sigav`.
-- Não use `drop schema ... cascade`: os dados permanecem nas relações movidas.
