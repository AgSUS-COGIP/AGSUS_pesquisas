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
-- 1. Tabela alcançável pela API tem política, não apenas RLS ligada
--
-- RLS sem política **nega tudo**, então a ausência de política não é falha por
-- si: quatro tabelas de catálogo (`platform_modules`, `role_module_permissions`,
-- `person_module_permissions`, `tb_config_plataforma`) são deliberadamente
-- trancadas assim, sem grant nenhum, e só se leem por função `security definer`.
--
-- O que seria perigoso é a combinação inversa: privilégio concedido a `anon` ou
-- `authenticated` **sem** política que restrinja as linhas. É esse o invariante
-- verificado aqui.
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
      and exists (
        select 1 from information_schema.role_table_grants grant_row
        where grant_row.table_schema = 'public'
          and grant_row.table_name = relation.relname
          and grant_row.grantee in ('anon', 'authenticated')
      )
  ),
  0::bigint,
  'nenhuma tabela concede privilégio a anon/authenticated sem política de RLS que limite as linhas'
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
-- 5. Só a marca da plataforma é executável por anon
--
-- `fc_obter_marca_plataforma()` precisa ser pública: é ela que entrega
-- logotipo, nome institucional e cor para a tela de acesso, onde ninguém está
-- autenticado ainda. Não devolve dado pessoal.
--
-- Qualquer outra função `security definer` alcançável por `anon` é exposição —
-- o teste falha e nomeia a função, em vez de só contar.
-- ---------------------------------------------------------------------------
select is(
  (
    select coalesce(string_agg(proc.proname, ', ' order by proc.proname), '')
    from pg_catalog.pg_proc proc
    join pg_catalog.pg_namespace namespace on namespace.oid = proc.pronamespace
    where namespace.nspname = 'public'
      and proc.prosecdef = true
      and has_function_privilege('anon', proc.oid, 'execute')
      and proc.proname <> 'fc_obter_marca_plataforma'
  ),
  '',
  'nenhuma função security definer além da marca da plataforma é executável por anon'
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
