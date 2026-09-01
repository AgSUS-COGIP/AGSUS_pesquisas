-- Fecha a última divergência de vocabulário nas datas de auditoria de linha.
--
-- O padrão institucional manda o prefixo (item 7, DT_) e não escolhe a palavra.
-- Mas o projeto ficou com duas para o mesmo conceito: 14 tabelas com
-- `DT_INCLUSAO`/`DT_ALTERACAO` — que é o par do exemplo do manual, junto de
-- `AU_USUARIO_INCLUSAO`/`AU_USUARIO_ALTERACAO` — e esta, sozinha, com
-- `DT_ATUALIZACAO`, herdada de 20260831190000.
--
-- Duas palavras para a mesma coisa é a incoerência que este trabalho existe
-- para tirar, e aqui custa uma coluna e três linhas de uma função.
--
-- A coluna guarda o instante da última alteração do contador da janela: é
-- auditoria de linha, o mesmo sentido que `DT_ALTERACAO` tem nas outras.

begin;

alter table sigav."TB_LIMITE_REQUISICAO_PUBLICA"
  rename column "DT_ATUALIZACAO" to "DT_ALTERACAO";

CREATE OR REPLACE FUNCTION sigav."FC_SRV_CONSUMIR_LIMITE_PUBLICO"(target_scope text, target_key_hash text, target_limit integer, target_window_seconds integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_now timestamptz := clock_timestamp();
  v_window_start timestamptz;
  v_count integer;
  v_retry_after integer;
begin
  if target_scope is null or btrim(target_scope) = '' or length(target_scope) > 80 then
    raise exception 'Escopo de rate limit inválido.';
  end if;

  if target_key_hash is null or target_key_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Chave de rate limit inválida.';
  end if;

  if target_limit is null or target_limit < 1 or target_limit > 10000 then
    raise exception 'Limite de requisições inválido.';
  end if;

  if target_window_seconds is null or target_window_seconds < 1 or target_window_seconds > 86400 then
    raise exception 'Janela de rate limit inválida.';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from v_now) / target_window_seconds) * target_window_seconds
  );

  insert into sigav."TB_LIMITE_REQUISICAO_PUBLICA" (
    "NO_ESCOPO",
    "CO_CHAVE",
    "DT_JANELA",
    "NU_REQUISICOES",
    "DT_ALTERACAO"
  ) values (
    btrim(target_scope),
    target_key_hash,
    v_window_start,
    1,
    v_now
  )
  on conflict ("NO_ESCOPO", "CO_CHAVE", "DT_JANELA")
  do update set
    "NU_REQUISICOES" = sigav."TB_LIMITE_REQUISICAO_PUBLICA"."NU_REQUISICOES" + 1,
    "DT_ALTERACAO" = excluded."DT_ALTERACAO"
  returning "NU_REQUISICOES" into v_count;

  -- Limpeza probabilística evita crescimento indefinido sem executar DELETE em
  -- toda requisição pública. O índice por janela mantém a coleta barata.
  if random() < 0.02 then
    delete from sigav."TB_LIMITE_REQUISICAO_PUBLICA"
    where "DT_JANELA" < v_now - interval '2 days';
  end if;

  v_retry_after := greatest(
    1,
    ceil(extract(epoch from (
      (v_window_start + make_interval(secs => target_window_seconds)) - v_now
    )))::integer
  );

  return jsonb_build_object(
    'allowed', v_count <= target_limit,
    'remaining', greatest(target_limit - v_count, 0),
    'retryAfter', v_retry_after
  );
end;
$function$;

do $verificacao$
declare
  v_fora text;
begin
  -- Nenhuma coluna de DT_ com a palavra antiga, em nenhuma tabela.
  select string_agg(cl.relname || '.' || a.attname, ', ' order by cl.relname) into v_fora
    from pg_attribute a
    join pg_class cl on cl.oid = a.attrelid
   where cl.relnamespace = 'sigav'::regnamespace and cl.relkind = 'r'
     and a.attnum > 0 and not a.attisdropped
     and upper(a.attname) in ('DT_ATUALIZACAO', 'DT_CRIACAO');
  if v_fora is not null then
    raise exception 'VERIFICAÇÃO: ainda há coluna com a grafia antiga: %', v_fora;
  end if;

  -- E nenhum corpo de função citando a coluna que deixou de existir.
  select string_agg(distinct p.proname, ', ' order by p.proname) into v_fora
    from pg_proc p
   where p.pronamespace = 'sigav'::regnamespace
     and pg_get_functiondef(p.oid) ~ '"DT_ATUALIZACAO"';
  if v_fora is not null then
    raise exception 'VERIFICAÇÃO: função ainda cita "DT_ATUALIZACAO": %', v_fora;
  end if;

  -- A função executa? Consumir o limite de um escopo de teste e desfazer.
  -- A chave é validada como sha256 hexadecimal pela própria função.
  perform sigav."FC_SRV_CONSUMIR_LIMITE_PUBLICO"(
    'zz-verificacao', encode(sha256('verificacao'::bytea), 'hex'), 1, 60);
  delete from sigav."TB_LIMITE_REQUISICAO_PUBLICA"
   where "NO_ESCOPO" = 'zz-verificacao';

  raise notice 'datas de auditoria de linha com uma grafia só: DT_INCLUSAO/DT_ALTERACAO';
end
$verificacao$;

commit;
