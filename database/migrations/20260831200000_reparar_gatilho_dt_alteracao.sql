-- Repara `FC_DEFINIR_DT_ALTERACAO`, que ficou apontando para uma coluna que já
-- não existe em três tabelas.
--
-- O DEFEITO, e como ele passou. 20260831180000 renomeou `updated_at` para
-- `DT_ALTERACAO` em TB_CORRECAO_VINCULO_CDDI, TB_PREFERENCIA_USUARIO e
-- TB_UNIDADE_ORGANIZACIONAL. Essas três tabelas têm gatilho `before update`
-- ligado a esta função, que é COMPARTILHADA por 17 tabelas e atribui
-- `new.updated_at`. Renomear a coluna não toca no corpo da função — e corpo de
-- PL/pgSQL resolve campo de registro em EXECUÇÃO. Resultado: `create or replace`
-- não reclamou, a migration aplicou limpa, os testes passaram (nenhum deles
-- atualiza linha dessas três tabelas) e qualquer UPDATE em produção falharia
-- com `record "new" has no field "updated_at"`.
--
-- Verificado no banco, antes deste reparo:
--   update sigav."TB_UNIDADE_ORGANIZACIONAL" set "NO_UNIDADE" = ...
--   ERROR: record "new" has no field "updated_at"
--
-- A CORREÇÃO. A função passa a servir tabela nos DOIS estados de nomenclatura,
-- testando qual coluna a tabela tem. Foi essa a escolha, e não uma lista de
-- tabelas dentro da função, porque a lista precisaria de edição a cada lote de
-- colunas e o esquecimento voltaria a aparecer só em produção. Assim o gatilho
-- é indiferente à ordem em que os lotes chegam.
--
-- O ramo `updated_at` morre sozinho: quando o último lote de colunas passar,
-- nenhuma tabela terá mais essa coluna, e o ramo sai daqui.
--
-- Por que `to_jsonb(new) ? ...` e não um `exception when undefined_column`:
-- bloco de exceção em gatilho abre subtransação por linha, e engoliria também
-- um erro de digitação de verdade.
--
-- Por que dois `:=` estáticos, um em cada ramo, em vez de reconstruir o
-- registro com `jsonb_populate_record`: o ramo não tomado nunca é executado, e
-- só a execução resolve o campo. Assim nenhuma coluna passa por jsonb e volta —
-- o gatilho continua alterando um campo só.

begin;

create or replace function sigav."FC_DEFINIR_DT_ALTERACAO"()
 returns trigger
 language plpgsql
 set search_path to 'pg_catalog', 'sigav'
as $function$
begin
  if to_jsonb(new) ? 'DT_ALTERACAO' then
    new."DT_ALTERACAO" := timezone('utc', now());
  else
    -- Tabela ainda não padronizada. Ramo temporário: ver o cabeçalho.
    new.updated_at := timezone('utc', now());
  end if;
  return new;
end;
$function$;

do $verificacao$
declare
  v_fora   text;
  v_antes  text;
  v_depois text;
begin
  -- Prova pelos dois estados. TB_UNIDADE_ORGANIZACIONAL é a tabela que o
  -- defeito derrubou (já padronizada); TB_PESSOA ainda tem `updated_at`.
  --
  -- A data entra ANTIGA de propósito: `now()` é o instante em que a transação
  -- começou, então comparar o antes e o depois de uma linha inserida agora
  -- mostraria o mesmo valor mesmo com o gatilho funcionando — o teste acusaria
  -- defeito onde não há.
  insert into sigav."TB_UNIDADE_ORGANIZACIONAL" ("CO_UNIDADE", "NO_UNIDADE", "DT_ALTERACAO")
  values ('ZZ-VERIFICACAO-GATILHO', 'linha de verificação', timestamptz '2000-01-01 00:00:00+00')
  returning "DT_ALTERACAO"::text into v_antes;

  update sigav."TB_UNIDADE_ORGANIZACIONAL"
     set "NO_UNIDADE" = 'linha de verificação (alterada)'
   where "CO_UNIDADE" = 'ZZ-VERIFICACAO-GATILHO'
  returning "DT_ALTERACAO"::text into v_depois;

  if v_depois is null or v_depois = v_antes then
    raise exception 'VERIFICAÇÃO: o gatilho não gravou DT_ALTERACAO no UPDATE (antes=%, depois=%)',
      v_antes, v_depois;
  end if;

  delete from sigav."TB_UNIDADE_ORGANIZACIONAL" where "CO_UNIDADE" = 'ZZ-VERIFICACAO-GATILHO';

  -- O outro ramo não é provado aqui de propósito. Ele é o comportamento que já
  -- existia, sobre 14 tabelas que a aplicação atualiza o tempo todo, e a suíte
  -- passa por ele em cada teste que altera pessoa ou submissão. Fabricar aqui
  -- uma linha descartável em TB_PESSOA — tabela auditada, com gatilho de
  -- trilha — custaria mais do que prova.

  -- E a rede geral: nenhuma tabela com este gatilho pode estar sem as duas
  -- colunas. Sem esta checagem, uma tabela nova entraria muda no gatilho.
  select string_agg(c.relname, ', ' order by c.relname) into v_fora
    from pg_trigger tg
    join pg_class c on c.oid = tg.tgrelid
   where c.relnamespace = 'sigav'::regnamespace
     and not tg.tgisinternal
     and tg.tgfoid = 'sigav."FC_DEFINIR_DT_ALTERACAO"()'::regprocedure
     and not exists (select 1 from pg_attribute a
                      where a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
                        and a.attname in ('DT_ALTERACAO', 'updated_at'));
  if v_fora is not null then
    raise exception 'VERIFICAÇÃO: tabela com o gatilho e sem coluna para gravar: %', v_fora;
  end if;

  select format('%s padronizada(s), %s ainda com updated_at',
                count(*) filter (where padronizada),
                count(*) filter (where not padronizada))
    into v_fora
    from (
      select exists (select 1 from pg_attribute a
                      where a.attrelid = c.oid and a.attname = 'DT_ALTERACAO') as padronizada
        from pg_trigger tg
        join pg_class c on c.oid = tg.tgrelid
       where c.relnamespace = 'sigav'::regnamespace
         and not tg.tgisinternal
         and tg.tgfoid = 'sigav."FC_DEFINIR_DT_ALTERACAO"()'::regprocedure
    ) estado;

  raise notice 'gatilho de DT_ALTERACAO serve os dois estados: %', v_fora;
end
$verificacao$;

commit;
