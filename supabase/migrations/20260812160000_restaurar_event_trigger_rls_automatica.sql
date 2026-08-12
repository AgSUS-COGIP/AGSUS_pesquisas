begin;

-- Restaura o mecanismo que liga RLS automaticamente em toda tabela criada em
-- `public`. Ele existe no banco de produção desde sempre, mas **nunca virou
-- arquivo**: foi aplicado por SQL direto, então nenhuma migration o cria.
--
-- Consequência prática, descoberta em 12/08/2026: o quality gate do CI executa
-- `supabase db reset`, que reconstrói o banco só a partir das migrations. Sem o
-- event trigger, as tabelas nascem **sem RLS**, e o teste `rls_exposed_tables`
-- — que afirma existirem zero tabelas expostas sem RLS — falha. O job "Supabase
-- migrations and RLS" quebrava em qualquer branch, não por causa das mudanças
-- de quem abriu o PR.
--
-- Isso também explica por que produção precisou de SQL aplicado à mão: o
-- repositório sozinho nunca reconstruiu o esquema.
--
-- O gatilho é uma rede de segurança, não a política em si: ele apenas garante
-- `enable row level security`. Cada tabela continua precisando das próprias
-- políticas — RLS ligada sem política nega tudo, o que é seguro mas inútil.
--
-- `create or replace` e `drop … if exists` deixam a migration reexecutável, e
-- inofensiva onde o objeto já existe (como no banco de produção atual).

create or replace function public.rls_auto_enable()
returns event_trigger
language plpgsql
security definer
set search_path to 'pg_catalog'
as $function$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    -- O segundo rótulo é montado por concatenação de propósito: `npm run
    -- db:naming` lê a migration como texto e leria a string literal
    -- 'CREATE TABLE AS' como a criação de uma tabela chamada "as".
    where command_tag in ('CREATE TABLE', 'CREATE TABLE' || ' AS', 'SELECT INTO')
      and object_type in ('table', 'partitioned table')
  loop
    if cmd.schema_name is not null
       and cmd.schema_name in ('public')
       and cmd.schema_name not in ('pg_catalog', 'information_schema')
       and cmd.schema_name not like 'pg_toast%'
       and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: RLS habilitada em %', cmd.object_identity;
      exception
        -- Falhar aqui abortaria o `create table` que disparou o gatilho. A
        -- tabela é criada mesmo assim, e o teste de RLS acusa a exposição.
        when others then
          raise log 'rls_auto_enable: não foi possível habilitar RLS em %', cmd.object_identity;
      end;
    else
      raise log 'rls_auto_enable: ignorado % (schema % fora da lista aplicada)', cmd.object_identity, cmd.schema_name;
    end if;
  end loop;
end;
$function$;

revoke all on function public.rls_auto_enable() from public, anon, authenticated, service_role;

drop event trigger if exists ensure_rls;
create event trigger ensure_rls
on ddl_command_end
execute function public.rls_auto_enable();

comment on function public.rls_auto_enable() is
  'Event trigger: habilita RLS em toda tabela criada no schema public. Rede de segurança — não substitui as políticas de cada tabela.';

commit;

-- Rollback:
-- begin;
--   drop event trigger if exists ensure_rls;
--   drop function if exists public.rls_auto_enable();
-- commit;
