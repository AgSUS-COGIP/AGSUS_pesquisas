-- Todas as 37 tabelas de `sigav` já usam "DT_ALTERACAO". O ramo temporário
-- criado enquanto os lotes conviviam com `updated_at` deixou de ser necessário.

begin;

create or replace function sigav."FC_DEFINIR_DT_ALTERACAO"()
returns trigger
language plpgsql
set search_path = pg_catalog, sigav
as $function$
begin
  new."DT_ALTERACAO" := timezone('utc', now());
  return new;
end;
$function$;

do $verificacao$
declare
  v_fora text;
begin
  select string_agg(c.relname || ' :: ' || tg.tgname, ', ' order by c.relname, tg.tgname)
    into v_fora
    from pg_trigger tg
    join pg_class c on c.oid = tg.tgrelid
   where tg.tgfoid = 'sigav."FC_DEFINIR_DT_ALTERACAO"()'::regprocedure
     and not tg.tgisinternal
     and not exists (
       select 1
         from pg_attribute a
        where a.attrelid = c.oid
          and a.attname = 'DT_ALTERACAO'
          and a.attnum > 0
          and not a.attisdropped
     );

  if v_fora is not null then
    raise exception 'Gatilho de alteração ligado a tabela sem DT_ALTERACAO: %', v_fora;
  end if;

  raise notice 'compatibilidade temporária de DT_ALTERACAO removida';
end
$verificacao$;

commit;
