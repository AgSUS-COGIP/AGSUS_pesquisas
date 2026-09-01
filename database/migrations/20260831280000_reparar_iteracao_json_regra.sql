-- No lote 6, `value` foi associado à coluna física "DS_VALOR" de
-- TB_OPCAO_PERGUNTA. Duas ocorrências, porém, são a coluna interna produzida
-- por jsonb_array_elements; qualificá-las como coluna física quebra a RPC.

begin;

do $reparo$
declare
  v_oid regprocedure := 'sigav."FC_SALVAR_REGRA_CONDICIONAL"(text,uuid,text,text,jsonb,text)'::regprocedure;
  v_definicao text;
  v_quantidade integer;
begin
  select pg_get_functiondef(v_oid::oid),
         (select count(*)
            from regexp_matches(
              pg_get_functiondef(v_oid::oid),
              'select "DS_VALOR" from jsonb_array_elements',
              'g'
            ))
    into v_definicao, v_quantidade;

  if v_quantidade <> 2 then
    raise exception 'FC_SALVAR_REGRA_CONDICIONAL: esperadas 2 iterações JSON para reparar; encontradas %', v_quantidade;
  end if;

  execute replace(
    v_definicao,
    'select "DS_VALOR" from jsonb_array_elements',
    'select value from jsonb_array_elements'
  );
end
$reparo$;

do $verificacao$
declare
  v_definicao text := pg_get_functiondef(
    'sigav."FC_SALVAR_REGRA_CONDICIONAL"(text,uuid,text,text,jsonb,text)'::regprocedure
  );
begin
  if v_definicao like '%select "DS_VALOR" from jsonb_array_elements%' then
    raise exception 'A iteração JSON ainda aponta para a coluna física DS_VALOR.';
  end if;

  if (select count(*) from regexp_matches(
        v_definicao,
        'select value from jsonb_array_elements',
        'g'
      )) <> 2 then
    raise exception 'A função não preservou as duas iterações sobre o JSON.';
  end if;

  raise notice 'iterações JSON de FC_SALVAR_REGRA_CONDICIONAL reparadas';
end
$verificacao$;

commit;
