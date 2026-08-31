begin;

-- ============================================================================
-- Correção: funções que ainda chamavam private.* depois da unificação
-- ============================================================================
--
-- `20260827170000_unificar_schemas_em_sigav.sql` transferiu as funções de
-- `private` para `sigav` e removeu o schema, mas não reescreveu os corpos que
-- as chamavam qualificadas. `ALTER FUNCTION ... SET SCHEMA` preserva
-- dependência de catálogo; corpo de função é texto e não acompanha. O
-- resultado é que quatro funções passaram a falhar em tempo de execução com
-- `schema "private" does not exist` — entre elas
-- `fc_obter_contexto_plataforma()`, que é o contrato de autorização de toda
-- tela autenticada.
--
-- POR QUE ISSO PASSOU PELA VALIDAÇÃO. A unificação foi conferida com
-- `PostgreSQL db reset` seguido de `PostgreSQL test db`, e ambos passaram. Passaram
-- porque o banco reconstruído **não continha o objeto que quebrou**:
-- `private.effective_platform_modules`, chamada por duas das quatro funções,
-- nasce em `20260826193000_fundar_permissoes_por_modulo.sql`, que existe em
-- `main` e ainda não tinha sido trazida para esta branch. O banco réplica veio
-- de produção, onde aquela migration já estava aplicada; o banco reconstruído
-- veio das migrations **desta branch**, que estava seis migrations atrás.
--
-- A lição é mais ampla do que "faltou uma migration": reconstruir o banco a
-- partir do histórico só prova o que aquele histórico contém, e o histórico de
-- uma branch de trabalho quase nunca é o de produção. Some-se a isso o que
-- `database/README.md` já registra em 10/08 e 14/08 — migration registrada como
-- aplicada cujos objetos não existem, e o contrário — e o resultado é o mesmo
-- conselho: a conferência que vale é contra uma cópia do banco réplica,
-- chamando as RPCs afetadas. É o que passou a ser feito.
--
-- Em banco onde nada aponte para `private` esta migration não encontra o que
-- corrigir e termina sem efeito — como deve ser.

do $correcao$
declare
  v_funcao record;
  v_definicao text;
  v_simbolo text;
  v_restantes bigint;
begin
  -- Toda função que estava em `private` foi para `sigav`, então a tradução é
  -- direta. Ainda assim, cada símbolo citado é conferido antes: reescrever
  -- `private.x` para `sigav.x` sem que `sigav.x` exista trocaria um erro por
  -- outro, e este é o tipo de defeito que só aparece quando alguém usa a tela.
  for v_simbolo in
    select distinct (regexp_matches(p.prosrc, 'private\.([a-z_][a-z0-9_]*)', 'g'))[1]
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'sigav'
       and p.prosrc like '%private.%'
  loop
    if not exists (
      select 1
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'sigav' and p.proname = v_simbolo
    ) and to_regclass('sigav.' || quote_ident(v_simbolo)) is null then
      raise exception 'private.% é citado mas não existe em sigav; a correção foi interrompida.', v_simbolo;
    end if;
  end loop;

  for v_funcao in
    select p.oid
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'sigav'
       and p.prosrc like '%private.%'
     order by p.proname, pg_get_function_identity_arguments(p.oid)
  loop
    v_definicao := pg_get_functiondef(v_funcao.oid);
    v_definicao := replace(v_definicao, 'private.', 'sigav.');
    execute v_definicao;
  end loop;

  -- Fecha contra os três schemas já removidos, não só contra `private`: se
  -- algum corpo tivesse ficado para trás apontando para `db_governanca` ou para
  -- a camada institucional antiga, o sintoma seria idêntico e igualmente
  -- silencioso até alguém abrir a tela.
  select count(*)
    into v_restantes
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'sigav'
     and (
       p.prosrc like '%private.%'
       or p.prosrc like '%db_governanca.%'
       or p.prosrc like '%"DB_PESQUISAS"%'
       or array_to_string(p.proconfig, ',') like '%private%'
       or array_to_string(p.proconfig, ',') like '%db_governanca%'
     );

  if v_restantes <> 0 then
    raise exception 'restaram % função(ões) apontando para schema já removido.', v_restantes;
  end if;
end;
$correcao$;

-- Mesma varredura nos demais tipos de objeto. Hoje nenhum deles referencia um
-- schema removido, mas a policy de RLS é o caso perigoso: como a aplicação
-- conecta como dono da tabela e dono não é submetido a RLS, uma policy quebrada
-- não produziria erro nenhum — ficaria adormecida até o dia em que a conexão
-- deixasse de ser a do dono.
do $conferencia$
declare
  v_quantidade bigint;
begin
  select
    (select count(*)
       from pg_policy p
      where coalesce(pg_get_expr(p.polqual, p.polrelid), '')
            || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') like '%private.%')
    + (select count(*)
         from pg_class c
         join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'sigav'
          and c.relkind in ('v', 'm')
          and pg_get_viewdef(c.oid, true) like '%private.%')
    + (select count(*)
         from pg_attrdef d
        where pg_get_expr(d.adbin, d.adrelid) like '%private.%')
    + (select count(*)
         from pg_constraint c
        where pg_get_constraintdef(c.oid, true) like '%private.%')
    + (select count(*)
         from pg_trigger t
        where not t.tgisinternal
          and pg_get_triggerdef(t.oid, true) like '%private.%')
    into v_quantidade;

  if v_quantidade <> 0 then
    raise exception 'há % objeto(s) não-função ainda referenciando private.', v_quantidade;
  end if;
end;
$conferencia$;

commit;

-- Rollback: não se aplica. Esta migration só substitui um qualificador inválido
-- por um válido; desfazê-la restauraria a falha.
