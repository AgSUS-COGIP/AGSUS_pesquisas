-- ============================================================================
-- Invariantes de schema — roda contra o banco REAL, não contra um reconstruído
-- ============================================================================
--
-- Uso (contra uma cópia descartável da réplica, que é o jeito seguro):
--
--   docker exec agsus-local psql -U postgres -c \
--     "create database db_conferencia template db_dataware"
--   docker cp database/tests/invariantes_schema.sql agsus-local:/tmp/inv.sql
--   docker exec agsus-local psql -U postgres -d db_conferencia \
--     -v ON_ERROR_STOP=1 -f /tmp/inv.sql
--
-- POR QUE NÃO É pgTAP. Os testes pgTAP rodam por `PostgreSQL test db`, sobre um
-- banco que o `PostgreSQL db reset` reconstrói a partir de `migrations/`. Esse
-- banco não é produção e não a representa: em 28/08/2026 ele tinha 56 policies
-- de RLS que a réplica não tem nenhuma, mantinha o schema `auth` do GoTrue com
-- tabelas que a aplicação não pode sequer transferir (pertencem a
-- `PostgreSQL_auth_admin`), e — o que causou o defeito daquele dia — não contém
-- os objetos criados no banco vivo fora do histórico de migrations. Uma
-- unificação de schemas passou lá e quebrou quatro funções em produção.
--
-- Este arquivo é SQL puro de propósito: roda com o psql em qualquer Postgres,
-- sem extensão de teste, contra o banco que de fato importa.
--
-- Não abre transação: é só leitura, e assim pode ser apontado para um banco em
-- uso sem prender lock. Falha com exceção na primeira violação.
--
-- Onde `sigav` divide a instância com outras aplicações (é o caso do
-- db_dataware), `public`, `sip` e `sigepsi` são ignorados de propósito: não
-- pertencem a este projeto.

do $invariantes$
declare
  v_quantidade bigint;
  v_detalhe text;
begin
  -- 1. sigav existe e é o schema da aplicação -------------------------------
  if not exists (select 1 from pg_namespace where nspname = 'sigav') then
    raise exception 'INVARIANTE 1: o schema sigav não existe.';
  end if;

  select count(*)
    into v_quantidade
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'sigav' and c.relkind in ('r', 'p');

  if v_quantidade = 0 then
    raise exception 'INVARIANTE 1: sigav não contém tabela alguma.';
  end if;
  raise notice 'ok 1 — sigav existe com % tabela(s)', v_quantidade;

  -- 2. Nenhum outro schema desta aplicação ----------------------------------
  -- `sip` e `sigepsi` são de outras aplicações e o `public` de uma instância
  -- compartilhada pertence ao administrador; nenhum é responsabilidade daqui.
  select count(*), coalesce(string_agg(nspname, ', ' order by nspname), '')
    into v_quantidade, v_detalhe
    from pg_namespace
   where nspname not like 'pg\_%'
     and nspname not in ('information_schema', 'sigav', 'public', 'sip', 'sigepsi');

  if v_quantidade <> 0 then
    raise exception 'INVARIANTE 2: schema(s) desta aplicação além de sigav: %', v_detalhe;
  end if;
  raise notice 'ok 2 — sigav é o único schema da aplicação';

  -- 3. Nada aponta para schema removido -------------------------------------
  -- A classe de defeito de 28/08. `ALTER ... SET SCHEMA` preserva dependência
  -- de catálogo, mas corpo de função, search_path, expressão de policy e
  -- definição de view são texto: continuam citando o nome antigo e só falham
  -- quando alguém usa a tela.
  with referencias(origem, definicao) as (
    select 'função ' || p.proname, p.prosrc
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'sigav'
    union all
    select 'search_path de ' || p.proname, array_to_string(p.proconfig, ',')
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'sigav'
    union all
    select 'view ' || c.relname, pg_get_viewdef(c.oid, true)
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'sigav' and c.relkind in ('v', 'm')
    union all
    select 'policy ' || p.polname || ' em ' || c.relname,
           coalesce(pg_get_expr(p.polqual, p.polrelid), '')
           || coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '')
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'sigav'
    union all
    select 'default de ' || c.relname || '.' || a.attname, pg_get_expr(d.adbin, d.adrelid)
      from pg_attrdef d
      join pg_class c on c.oid = d.adrelid
      join pg_namespace n on n.oid = c.relnamespace
      join pg_attribute a on a.attrelid = d.adrelid and a.attnum = d.adnum
     where n.nspname = 'sigav'
    union all
    select 'constraint ' || con.conname, pg_get_constraintdef(con.oid, true)
      from pg_constraint con
      join pg_class c on c.oid = con.conrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'sigav'
    union all
    select 'trigger ' || t.tgname, pg_get_triggerdef(t.oid, true)
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'sigav' and not t.tgisinternal
  )
  select count(*), coalesce(string_agg(distinct origem, ', '), '')
    into v_quantidade, v_detalhe
    from referencias
   where definicao like '%public.%'
      or definicao like '%private.%'
      or definicao like '%db_governanca.%'
      or definicao like '%"DB_PESQUISAS"%'
      or definicao like '%auth.%'
      or definicao like '%extensions.%';

  if v_quantidade <> 0 then
    raise exception 'INVARIANTE 3: % objeto(s) citando schema removido: %', v_quantidade, v_detalhe;
  end if;
  raise notice 'ok 3 — nenhum objeto cita schema removido';

  -- 4. RLS em toda tabela ---------------------------------------------------
  -- Não é a barreira efetiva (a aplicação conecta como dono, e dono não é
  -- submetido a RLS sem `force`), mas é o invariante que impede uma tabela
  -- nova de nascer exposta caso a conexão deixe de ser a do dono.
  select count(*), coalesce(string_agg(c.relname, ', ' order by c.relname), '')
    into v_quantidade, v_detalhe
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'sigav' and c.relkind in ('r', 'p') and not c.relrowsecurity;

  if v_quantidade <> 0 then
    raise exception 'INVARIANTE 4: % tabela(s) sem RLS: %', v_quantidade, v_detalhe;
  end if;
  raise notice 'ok 4 — todas as tabelas têm RLS habilitada';

  -- 5. Contrato de identidade ------------------------------------------------
  if to_regprocedure('sigav."FC_UID_SESSAO"()') is null
     or to_regprocedure('sigav."FC_PAPEL_SESSAO"()') is null
     or to_regprocedure('sigav."FC_CLAIMS_SESSAO"()') is null then
    raise exception 'INVARIANTE 5: falta alguma função de claims da sessão.';
  end if;

  if to_regclass('sigav."TB_USUARIO_IDENTIDADE"') is null
     or to_regclass('sigav."TB_IDENTIDADE_OAUTH"') is null then
    raise exception 'INVARIANTE 5: falta alguma tabela de identidade.';
  end if;

  select count(*)
    into v_quantidade
    from pg_constraint con
    join pg_class src on src.oid = con.conrelid
    join pg_class tgt on tgt.oid = con.confrelid
   where con.contype = 'f'
     and tgt.relname = 'TB_USUARIO_IDENTIDADE'
     and src.relname = 'TB_PESSOA';

  if v_quantidade <> 1 then
    raise exception 'INVARIANTE 5: tb_pessoa não está mais ligada a tb_usuario_identidade.';
  end if;
  raise notice 'ok 5 — contrato de identidade íntegro';

  -- 6. Vínculo pessoa↔conta sem órfão ---------------------------------------
  select count(*)
    into v_quantidade
    from sigav."TB_PESSOA" p
   where p."SQ_USUARIO_IDENTIDADE" is not null
     and not exists (
       select 1
         from sigav."TB_USUARIO_IDENTIDADE" u
        where u."SQ_USUARIO" = p."SQ_USUARIO_IDENTIDADE"
     );

  if v_quantidade <> 0 then
    raise exception 'INVARIANTE 6: % pessoa(s) apontam para conta inexistente.', v_quantidade;
  end if;
  raise notice 'ok 6 — nenhum vínculo de pessoa com conta inexistente';

  -- 6b. pgcrypto preservada dentro de sigav ---------------------------------
  -- A aplicação não depende dela (o hash de sessão anônima usa o sha256 nativo),
  -- mas a capacidade criptográfica deve continuar disponível e no schema certo.
  if not exists (
    select 1 from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto' and n.nspname = 'sigav'
  ) then
    raise exception 'INVARIANTE 6b: pgcrypto não está instalada em sigav.';
  end if;

  if encode(sigav.digest('teste', 'sha256'), 'hex')
     <> encode(pg_catalog.sha256(pg_catalog.convert_to('teste', 'UTF8')), 'hex') then
    raise exception 'INVARIANTE 6b: sigav.digest não concorda com o sha256 nativo.';
  end if;
  raise notice 'ok 6b — pgcrypto preservada e utilizável em sigav';

  -- 7. UTF-8 íntegro nas funções --------------------------------------------
  -- Detecta os dois defeitos de transporte que este projeto já sofreu: perda
  -- (efbfbd, irreversível) e dupla codificação (c383c2, recuperável).
  select count(*) filter (where encode(convert_to(pg_get_functiondef(p.oid), 'UTF8'), 'hex') like '%efbfbd%')
       + count(*) filter (where encode(convert_to(pg_get_functiondef(p.oid), 'UTF8'), 'hex') like '%c383c2%')
    into v_quantidade
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'sigav' and p.prokind = 'f';

  if v_quantidade <> 0 then
    raise exception 'INVARIANTE 7: % função(ões) com UTF-8 corrompido.', v_quantidade;
  end if;
  raise notice 'ok 7 — UTF-8 íntegro em todas as funções';

  -- 8. Só as roles da arquitetura decidem acesso ----------------------------
  -- Desde 20260828140000 a autorização é inteiramente da aplicação
  -- (rpc-permissions.ts e sigav."RL_PESSOA_MODULO"). Uma role do
  -- Postgres fora da arquitetura com privilégio em objeto de sigav
  -- significaria que voltou a existir um segundo caminho de acesso — e o
  -- segundo caminho é o que ninguém lembra de revisar.
  --
  -- Duas arquiteturas convivem, e o invariante aceita ambas pelo DONO do
  -- schema: no db_dataware da empresa a credencial única `usr_sip_app` é dona
  -- e única concessionária; na réplica local ela foi separada em
  -- `migration_user` (dona, DDL) e `app_user` (runtime, DML + EXECUTE via
  -- policies explícitas) — scripts/separar-usuarios-app-e-migration.sql.
  --
  -- A falha é sobre PRIVILÉGIO, não sobre existência: remover role do catálogo
  -- exige CREATEROLE, e role sem privilégio algum não é porta de entrada. Role
  -- legada que ainda exista vira aviso, com o script que a remove.
  declare
    v_dona_oid oid;
    v_dona_nome text;
  begin
    select n.nspowner, r.rolname
      into v_dona_oid, v_dona_nome
      from pg_namespace n
      join pg_roles r on r.oid = n.nspowner
     where n.nspname = 'sigav';

    if v_dona_nome not in ('usr_sip_app', 'migration_user') then
      raise exception 'INVARIANTE 8: o dono de sigav é "%" — esperava usr_sip_app (empresa) ou migration_user (local).',
        v_dona_nome;
    end if;

    with concessoes as (
      select a.grantee, 'tabela ' || c.relname as objeto
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
        cross join lateral aclexplode(c.relacl) a
       where n.nspname = 'sigav'
      union all
      -- Só função da aplicação: em `sigav` moram também as do pgcrypto, cujo
      -- dono é o administrador da instância. A ACL delas não está ao alcance de
      -- quem corrigiria a violação, e um invariante que ninguém pode satisfazer
      -- é ruído — as regressões possíveis estão todas em objeto da dona.
      select a.grantee, 'função ' || p.proname
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
        cross join lateral aclexplode(p.proacl) a
       where n.nspname = 'sigav'
         and p.proowner = v_dona_oid
      union all
      select a.grantee, 'schema sigav'
        from pg_namespace n
        cross join lateral aclexplode(n.nspacl) a
       where n.nspname = 'sigav'
      union all
      -- Policies: quem aparece numa policy de RLS enxerga linhas. Só app_user
      -- (e a dona, que dispensa policy) podem estar aqui.
      select pr.oid, 'policy ' || p.polname || ' em ' || c.relname
        from pg_policy p
        join pg_class c on c.oid = p.polrelid
        join pg_namespace n on n.oid = c.relnamespace
        cross join lateral unnest(p.polroles) papel(oid)
        join pg_roles pr on pr.oid = papel.oid
       where n.nspname = 'sigav'
    )
    select count(*), coalesce(string_agg(distinct r.rolname || ' em ' || co.objeto, ', '), '')
      into v_quantidade, v_detalhe
      from concessoes co
      join pg_roles r on r.oid = co.grantee
     where r.oid <> v_dona_oid
       and r.rolname <> 'app_user'
       and not r.rolsuper
       and r.rolname not like 'pg\_%';

    if v_quantidade <> 0 then
      raise exception 'INVARIANTE 8: % concessão(ões) a role fora da arquitetura (dona=%, runtime=app_user): %',
        v_quantidade, v_dona_nome, v_detalhe;
    end if;

    -- O runtime não pode ser dono de nada nem criar objetos: DDL é da dona.
    if exists (select 1 from pg_roles where rolname = 'app_user') then
      if has_schema_privilege('app_user', 'sigav', 'create') then
        raise exception 'INVARIANTE 8: app_user tem CREATE no schema sigav — runtime não faz DDL.';
      end if;
      select count(*) into v_quantidade from (
        select 1 from pg_class c where c.relowner = 'app_user'::regrole
        union all
        select 1 from pg_proc p where p.proowner = 'app_user'::regrole
      ) posse;
      if v_quantidade <> 0 then
        raise exception 'INVARIANTE 8: app_user é dona de % objeto(s) — runtime não possui nada.', v_quantidade;
      end if;
    end if;

    raise notice 'ok 8 — privilégios em sigav restritos à arquitetura (dona=%, runtime=app_user)', v_dona_nome;
  end;

  select count(*), coalesce(string_agg(rolname, ', ' order by rolname), '')
    into v_quantidade, v_detalhe
    from pg_roles
   where rolname in (
           'anon', 'authenticated', 'service_role', 'authenticator',
           'dashboard_user', 'pgbouncer', 'supabase_admin',
           'supabase_auth_admin', 'supabase_read_only_user',
           'supabase_storage_admin'
         );

  if v_quantidade <> 0 then
    raise notice 'aviso 8 — % role(s) legada(s) sem privilégio ainda no catálogo: %', v_quantidade, v_detalhe;
    raise notice '         o drop exige CREATEROLE: scripts/remover-roles-legadas-do-cluster.sql';
  end if;

  -- 9. Perfil de acesso tem uma morada só ----------------------------------
  -- Desde 20260828150000 as tabelas de perfil saíram do banco: autorização é
  -- `rl_pessoa_modulo` sobre `tb_modulo_plataforma`, e preset é interface
  -- (`src/lib/platform-access-presets.ts`). Duas moradas para a mesma decisão
  -- foi o que fez `system_roles` sobreviver quatro migrations depois de deixar
  -- de decidir nada — a que ninguém usa é a que ninguém revisa.
  select count(*), coalesce(string_agg(nome, ', ' order by nome), '')
    into v_quantidade, v_detalhe
    from (
      select c.relname as nome
        from pg_class c
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'sigav'
         and c.relname in ('system_roles', 'person_role_assignments',
                           'role_module_permissions')
      union all
      select p.proname
        from pg_proc p
        join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'sigav'
         and p.proname in ('fc_definir_perfil_pessoa', 'list_access_workspace')
    ) legado;

  if v_quantidade <> 0 then
    raise exception 'INVARIANTE 9: objeto de perfil legado de volta em sigav: %', v_detalhe;
  end if;

  if to_regclass('sigav."RL_PESSOA_MODULO"') is null
     or to_regclass('sigav."TB_MODULO_PLATAFORMA"') is null then
    raise exception 'INVARIANTE 9: falta a tabela que hoje decide o acesso.';
  end if;
  raise notice 'ok 9 — perfil de acesso só em RL_PESSOA_MODULO';

  -- 10. Gatilho não cita campo que a tabela não tem -------------------------
  -- A padronização de colunas (20260831180000 em diante) renomeia coluna por
  -- coluna, e gatilho é FUNÇÃO COMPARTILHADA: `FC_DEFINIR_DT_ALTERACAO` serve
  -- 17 tabelas. Renomear `updated_at` numa delas não toca no corpo da função, e
  -- corpo de PL/pgSQL só resolve campo de registro na EXECUÇÃO — a migration
  -- aplica limpa, a suíte passa, e o primeiro UPDATE em produção morre com
  -- `record "new" has no field "updated_at"`. Foi o que 20260831180000 causou em
  -- três tabelas e 20260831200000 reparou.
  --
  -- Duas formas de gatilho ficam de fora, porque para elas a citação direta não
  -- prova nada:
  --   • quem ramifica por `tg_table_name` (FC_EXIGIR_RASCUNHO_ESTRUT) cita
  --     campos de várias tabelas de propósito, e o ramo alheio nunca executa;
  --   • quem testa `to_jsonb(new) ? '...'` atende os dois estados da
  --     nomenclatura ao mesmo tempo. Desses exige-se o que de fato importa:
  --     que a tabela case com ALGUM ramo.
  select count(*), coalesce(string_agg(nome, '; ' order by nome), '')
    into v_quantidade, v_detalhe
    from (
      with citacoes as (
        select c.relname                                       as tabela,
               c.oid                                           as relid,
               tg.tgname::text                                  as gatilho,
               p.proname::text                                  as funcao,
               case when m[2] = '' then lower(m[3]) else m[3] end as campo,
               pg_get_functiondef(p.oid) ~ 'to_jsonb\(new\)[[:space:]]*\?' as dois_estados,
               pg_get_functiondef(p.oid) ~ 'tg_table_name'                    as por_tabela
          from pg_trigger tg
          join pg_class c on c.oid = tg.tgrelid
          join pg_proc  p on p.oid = tg.tgfoid
          cross join lateral regexp_matches(
            regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g'),
            '\m(new|old)\.("?)([a-zA-Z_][a-zA-Z_0-9]*)\2', 'gi') as m
         where c.relnamespace = 'sigav'::regnamespace
           and not tg.tgisinternal
      ), resolvidas as (
        select ct.*,
               exists (select 1 from pg_attribute a
                        where a.attrelid = ct.relid and a.attname = ct.campo
                          and a.attnum > 0 and not a.attisdropped) as existe
          from citacoes ct
      )
      select tabela || ' :: ' || gatilho || ' -> ' || funcao
             || ' (' || string_agg(distinct campo, ', ' order by campo) || ')' as nome
        from resolvidas
       where not por_tabela and not dois_estados and not existe
       group by tabela, gatilho, funcao
      union all
      select tabela || ' :: ' || gatilho || ' -> ' || funcao || ' (nenhum ramo vivo)'
        from resolvidas
       where dois_estados
       group by tabela, gatilho, funcao, relid
      having bool_or(existe) is not true
    ) quebradas;

  if v_quantidade <> 0 then
    raise exception 'INVARIANTE 10: gatilho cita campo que a tabela não tem: %', v_detalhe;
  end if;
  raise notice 'ok 10 — nenhum gatilho cita campo inexistente na tabela';

  -- 11. Corpo de função não cita constraint que não existe ------------------
  -- `on conflict on constraint X` guarda um IDENTIFICADOR, e identificador sem
  -- aspas dobra para minúscula. 20260831150000 pôs todas as constraints em
  -- MAIÚSCULAS e, no mesmo arquivo, recriou `FC_ARQ_GRAVAR` com o corpo antigo
  -- apontando para `uk_tb_arquivo_caminho` — que deixou de existir. Nada
  -- reclamou: o corpo é texto resolvido em execução. Quebrava a gravação da
  -- marca e das capas de pesquisa, e ficou assim até 20260831220000.
  --
  -- Mesma família do invariante 10, outra superfície: lá o campo do registro,
  -- aqui o nome da constraint.
  select count(*), coalesce(string_agg(nome, ', ' order by nome), '')
    into v_quantidade, v_detalhe
    from (
      select distinct p.proname || ' -> ' || m[2] as nome
        from pg_proc p
        cross join lateral regexp_matches(
          regexp_replace(pg_get_functiondef(p.oid), '--[^' || chr(10) || ']*', '', 'g'),
          'on[[:space:]]+constraint[[:space:]]+("?)([a-zA-Z_][a-zA-Z_0-9]*)\1', 'gi') as m
       where p.pronamespace = 'sigav'::regnamespace
         and p.prokind = 'f'
         and not exists (
           select 1 from pg_constraint con
             join pg_class rel on rel.oid = con.conrelid
            where rel.relnamespace = 'sigav'::regnamespace
              and con.conname = case when m[1] = '' then lower(m[2]) else m[2] end)
    ) citacoes;

  if v_quantidade <> 0 then
    raise exception 'INVARIANTE 11: função cita constraint que não existe: %', v_detalhe;
  end if;
  raise notice 'ok 11 — nenhuma função cita constraint inexistente';

  -- 12. Toda coluna física segue o vocabulário institucional ---------------
  select count(*), coalesce(string_agg(nome, ', ' order by nome), '')
    into v_quantidade, v_detalhe
    from (
      select c.relname || '.' || a.attname as nome
        from pg_attribute a
        join pg_class c on c.oid = a.attrelid
       where c.relnamespace = 'sigav'::regnamespace
         and c.relkind in ('r', 'p')
         and a.attnum > 0
         and not a.attisdropped
         and (
           a.attname <> upper(a.attname)
           or length(a.attname) > 30
           or a.attname !~ '^(CO|SQ|DT|HR|DS|NO|NU|QT|VL|TX|SG|ST|TP|IM|CG|AU)_[A-Z0-9_]+$'
         )
    ) divergentes;

  if v_quantidade <> 0 then
    raise exception 'INVARIANTE 12: coluna fora do padrão institucional: %', v_detalhe;
  end if;
  raise notice 'ok 12 — todas as 415 colunas seguem o padrão institucional';

  raise notice '--- todos os invariantes passaram ---';
end;
$invariantes$;
