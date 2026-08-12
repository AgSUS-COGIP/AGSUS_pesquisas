-- RLS efetiva: o que cada papel realmente enxerga.
--
-- `rls_exposed_tables.sql` responde "a RLS está habilitada?". Este arquivo
-- responde a pergunta que importa: **habilitada com quais políticas?** Uma
-- tabela pode ter `relrowsecurity = true` e ainda assim uma política
-- `using (true)` que libera tudo — o flag ficaria verde e o dado, exposto.
--
-- Também cobre as duas regressões corrigidas na mesma leva:
--   · participante bloqueado fora do denominador do painel;
--   · aplicação nova não pode nascer anônima enquanto o anonimato não for
--     estrutural.

begin;

select plan(9);

-- ---------------------------------------------------------------------------
-- 1. Toda tabela exposta tem política, não apenas RLS ligada
-- ---------------------------------------------------------------------------
select is(
  (
    select count(*)::bigint
    from pg_catalog.pg_class relation
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and relation.relrowsecurity = true
      and not exists (
        select 1 from pg_catalog.pg_policy policy
        where policy.polrelid = relation.oid
      )
  ),
  0::bigint,
  'nenhuma tabela com RLS habilitada ficou sem política — RLS sem política nega tudo e mascara erro de configuração'
);

-- ---------------------------------------------------------------------------
-- 2. Nenhuma política de leitura libera irrestritamente as tabelas sensíveis
--
-- `using (true)` numa tabela de pessoas ou respostas equivale a não ter RLS.
-- ---------------------------------------------------------------------------
select is(
  (
    select count(*)::bigint
    from pg_catalog.pg_policy policy
    join pg_catalog.pg_class relation on relation.oid = policy.polrelid
    join pg_catalog.pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in ('people', 'answers', 'submissions', 'answer_options',
                               'person_access_identities', 'cddi_leadership_links')
      and policy.polcmd in ('r', '*')
      and pg_catalog.pg_get_expr(policy.polqual, policy.polrelid) = 'true'
  ),
  0::bigint,
  'nenhuma tabela sensível tem política de leitura irrestrita (using true)'
);

-- ---------------------------------------------------------------------------
-- 3. `anon` não alcança dado de negócio
-- ---------------------------------------------------------------------------
select is(
  (
    select count(*)::bigint
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee = 'anon'
      and table_name in ('people', 'answers', 'submissions', 'application_participants')
  ),
  0::bigint,
  'o papel anon não recebeu privilégio sobre pessoas, respostas, submissões ou participantes'
);

-- ---------------------------------------------------------------------------
-- 4. Funções privilegiadas têm search_path fixo
--
-- `security definer` sem `search_path` permite sequestro por schema no caminho
-- de busca do chamador.
-- ---------------------------------------------------------------------------
select is(
  (
    select count(*)::bigint
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.prosecdef = true
      and not exists (
        select 1 from unnest(coalesce(proc.proconfig, array[]::text[])) as config
        where config like 'search_path=%'
      )
  ),
  0::bigint,
  'toda função security definer de public fixa o search_path'
);

-- ---------------------------------------------------------------------------
-- 5. Nenhuma função interna executável por anon
-- ---------------------------------------------------------------------------
select is(
  (
    select count(*)::bigint
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.prosecdef = true
      and has_function_privilege('anon', proc.oid, 'execute')
  ),
  0::bigint,
  'nenhuma função security definer é executável pelo papel anon'
);

-- ---------------------------------------------------------------------------
-- 6. Denominador do painel ignora participante bloqueado
--
-- Regressão: a função excluía 'REMOVED' e 'INELIGIBLE' — valores que a
-- constraint nem permite — e deixava 'BLOCKED' entrar na conta.
-- ---------------------------------------------------------------------------
select ok(
  pg_catalog.pg_get_functiondef('public.fc_obter_painel_pesquisa(text)'::regprocedure)
    like '%not in (''BLOCKED'', ''EXCLUDED'')%',
  'fc_obter_painel_pesquisa exclui participantes BLOCKED do denominador'
);

select ok(
  pg_catalog.pg_get_functiondef('public.fc_obter_painel_pesquisa(text)'::regprocedure)
    not like '%INELIGIBLE%',
  'fc_obter_painel_pesquisa não filtra mais por status inexistente na constraint'
);

-- ---------------------------------------------------------------------------
-- 7. Aplicação nova não pode nascer anônima
-- ---------------------------------------------------------------------------
select ok(
  exists (
    select 1 from pg_catalog.pg_trigger
    where tgname = 'tba_aplicacao_anonima'
      and tgrelid = 'public.survey_applications'::regclass
      and not tgisinternal
  ),
  'o gatilho que bloqueia aplicação anônima está ativo'
);

-- ---------------------------------------------------------------------------
-- 8. O bloqueio não invalida o histórico já existente
--
-- Linha marcada como anônima antes do bloqueio continua legível; o gatilho só
-- atua na transição para anônimo.
-- ---------------------------------------------------------------------------
select lives_ok(
  $$ select count(*) from public.survey_applications where anonymous = true $$,
  'aplicações anônimas históricas continuam consultáveis após o bloqueio'
);

select * from finish();

rollback;
