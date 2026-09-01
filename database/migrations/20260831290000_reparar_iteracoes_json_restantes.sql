-- O mesmo nome interno `value` de jsonb_array_elements aparece em mais três
-- RPCs. Ele não é a coluna física "DS_VALOR" de TB_OPCAO_PERGUNTA.

begin;

do $reparo$
declare
  v_funcao record;
  v_total integer := 0;
begin
  for v_funcao in
    select p.oid, p.proname, pg_get_functiondef(p.oid) as definicao
      from pg_proc p
     where p.pronamespace = 'sigav'::regnamespace
       and pg_get_functiondef(p.oid) ~ 'select "DS_VALOR"[^\n]*from jsonb_array_elements'
  loop
    v_total := v_total + (
      select count(*)
        from regexp_matches(
          v_funcao.definicao,
          'select "DS_VALOR"([^\n]*from jsonb_array_elements)',
          'g'
        )
    );

    execute regexp_replace(
      v_funcao.definicao,
      'select "DS_VALOR"([^\n]*from jsonb_array_elements)',
      'select value\1',
      'g'
    );
  end loop;

  if v_total <> 3 then
    raise exception 'Esperadas 3 iterações JSON restantes para reparar; encontradas %', v_total;
  end if;
end
$reparo$;

do $verificacao$
declare
  v_fora text;
begin
  select string_agg(p.proname, ', ' order by p.proname)
    into v_fora
    from pg_proc p
   where p.pronamespace = 'sigav'::regnamespace
     and pg_get_functiondef(p.oid) ~ 'select "DS_VALOR"[^\n]*from jsonb_array_elements';

  if v_fora is not null then
    raise exception 'Funções ainda confundem value de JSON com DS_VALOR: %', v_fora;
  end if;

  raise notice 'iterações JSON restantes reparadas';
end
$verificacao$;

commit;
