begin;

-- ============================================================================
-- Preservar as funções do pgcrypto dentro de sigav, e encerrar `extensions`
-- ============================================================================
--
-- `20260828100000` removeu a **dependência** da aplicação em pgcrypto, trocando
-- `digest(token,'sha256')` pelo `sha256()` nativo, e a partir daí tratava a
-- extensão como descartável. A decisão agora é outra: as 36 funções da extensão
-- (`crypt`, `gen_salt`, `hmac`, `pgp_*`, `armor`, `encrypt`…) são capacidade
-- criptográfica do banco e devem ser **preservadas**, só que dentro de `sigav`,
-- que é o único schema desta aplicação.
--
-- As duas coisas convivem sem conflito: o caminho quente continua no `sha256()`
-- nativo, que não depende de extensão alguma, e o pgcrypto fica disponível para
-- quem precisar de cifragem simétrica, PGP ou hash de senha.
--
-- ---------------------------------------------------------------------------
-- Por que isto é possível sem superusuário
-- ---------------------------------------------------------------------------
-- pgcrypto é uma extensão **trusted** (`pg_available_extension_versions.trusted
-- = true`, desde o PostgreSQL 13). Extensão confiável pode ser instalada por
-- quem tem apenas `CREATE` no schema de destino — e `usr_sip_app` é dono de
-- `sigav`. Verificado: a instalação abaixo roda com a própria credencial da
-- aplicação, sem elevação.
--
-- `ALTER EXTENSION ... SET SCHEMA` é diferente: exige ser **dono da extensão**.
-- Onde a extensão pertencer ao administrador da instância (é o caso comum em
-- db_dataware), esse caminho é recusado, e a migration avisa em vez de falhar.
--
-- ---------------------------------------------------------------------------
-- Colisão de nomes: verificada, não presumida
-- ---------------------------------------------------------------------------
-- Nenhum dos 36 nomes do pgcrypto coincide com função já existente em `sigav`.
-- O único nome que passa a existir duas vezes no banco é `gen_random_uuid()`,
-- que também é nativa de `pg_catalog` desde o PostgreSQL 13. Isso não é
-- ambiguidade: com o `search_path` do projeto (`pg_catalog, sigav`), o
-- `pg_catalog` vem primeiro e vence. Os defaults já existentes tampouco mudam —
-- eles não guardam texto, guardam a função resolvida, e estão presos à nativa
-- (que, por ser objeto pinado do sistema, sequer registra dependência).
--
-- ---------------------------------------------------------------------------
-- Nomenclatura
-- ---------------------------------------------------------------------------
-- As funções da extensão não seguem o prefixo `fc_` do padrão institucional, e
-- não há como renomeá-las: pertencem à extensão, que as recria com os nomes
-- dela a cada `CREATE EXTENSION`. A exceção fica registrada em
-- `sigav.tb_catalogo_objeto`, que é o mecanismo que este projeto já usa para
-- documentar desvio de nomenclatura.

do $pgcrypto$
declare
  v_schema_atual text;
  v_restantes bigint;
begin
  select n.nspname
    into v_schema_atual
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
   where e.extname = 'pgcrypto';

  if v_schema_atual is null then
    -- Caminho normal depois de 20260828100000: a extensão foi removida junto
    -- com o schema `extensions`, e aqui ela volta já no lugar certo.
    create extension pgcrypto with schema sigav;
    raise notice 'pgcrypto instalada em sigav.';
  elsif v_schema_atual = 'sigav' then
    raise notice 'pgcrypto já está em sigav; nada a fazer.';
  else
    begin
      execute 'alter extension pgcrypto set schema sigav';
      raise notice 'pgcrypto transferida de % para sigav.', v_schema_atual;
    exception
      when insufficient_privilege then
        raise notice 'pgcrypto pertence ao administrador da instância e permanece em %; peça a ele: alter extension pgcrypto set schema sigav;', v_schema_atual;
        return;
    end;
  end if;

  -- Só agora o schema antigo pode sair, e só se estiver realmente vazio: em
  -- instância compartilhada ele pode abrigar extensão de outra aplicação.
  if exists (select 1 from pg_namespace where nspname = 'extensions') then
    select
      (select count(*) from pg_extension where extnamespace = 'extensions'::regnamespace)
      + (select count(*)
           from pg_class c join pg_namespace n on n.oid = c.relnamespace
          where n.nspname = 'extensions')
      + (select count(*)
           from pg_proc p join pg_namespace n on n.oid = p.pronamespace
          where n.nspname = 'extensions')
      into v_restantes;

    if v_restantes <> 0 then
      raise notice 'schema extensions ainda abriga % objeto(s) de terceiros; mantido.', v_restantes;
    else
      begin
        drop schema extensions restrict;
        raise notice 'schema extensions removido.';
      exception
        when insufficient_privilege then
          raise notice 'sem privilégio para remover o schema extensions; peça ao administrador: drop schema extensions;';
      end;
    end if;
  end if;
end;
$pgcrypto$;

-- ---------------------------------------------------------------------------
-- Registrar a exceção de nomenclatura
-- ---------------------------------------------------------------------------

insert into sigav.tb_catalogo_objeto (
  sg_schema_atual, no_objeto_atual, tp_objeto,
  st_conformidade, ds_justificativa, ds_estrategia_migracao
)
values (
  'sigav', 'pgcrypto', 'EXTENSAO', 'EXCECAO',
  'Funcoes da extensao pgcrypto (digest, crypt, gen_salt, hmac, pgp_*) nao seguem o prefixo fc_ do padrao institucional.',
  'Nao se aplica: os nomes pertencem a extensao e sao recriados por CREATE EXTENSION. Excecao permanente, aprovada junto com a unificacao de schemas.'
)
on conflict (sg_schema_atual, no_objeto_atual, tp_objeto) do update
set st_conformidade = excluded.st_conformidade,
    ds_justificativa = excluded.ds_justificativa,
    ds_estrategia_migracao = excluded.ds_estrategia_migracao,
    dt_alteracao = timezone('utc', now());

-- ---------------------------------------------------------------------------
-- Validação de fechamento
-- ---------------------------------------------------------------------------

do $conferencia$
declare
  v_quantidade bigint;
begin
  -- A extensão precisa ter chegado a sigav para que a preservação tenha
  -- acontecido de fato; se ficou pelo caminho, o aviso acima já explicou por
  -- quê, e falhar aqui apagaria esse aviso junto com a transação.
  if not exists (
    select 1 from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto' and n.nspname = 'sigav'
  ) then
    raise notice 'ATENÇÃO: pgcrypto não está em sigav ao final da migration.';
    return;
  end if;

  select count(*)
    into v_quantidade
    from pg_proc p
    join pg_depend d on d.objid = p.oid
    join pg_extension e on e.oid = d.refobjid
   where e.extname = 'pgcrypto';

  if v_quantidade = 0 then
    raise exception 'pgcrypto está registrada mas não trouxe função alguma.';
  end if;

  raise notice 'pgcrypto preservada em sigav com % função(ões).', v_quantidade;

  -- Prova de que a capacidade está utilizável, não só instalada.
  if encode(sigav.digest('teste', 'sha256'), 'hex')
     <> encode(pg_catalog.sha256(pg_catalog.convert_to('teste', 'UTF8')), 'hex') then
    raise exception 'sigav.digest não concorda com o sha256 nativo.';
  end if;
end;
$conferencia$;

commit;

-- Rollback:
-- begin;
--   -- Só remove a extensão; não recria o schema `extensions`, que não faz
--   -- falta. As três funções de sessão anônima usam `sha256()` nativo desde
--   -- 20260828100000 e não voltam a depender dela.
--   drop extension if exists pgcrypto;
--   delete from sigav.tb_catalogo_objeto
--    where sg_schema_atual = 'sigav' and no_objeto_atual = 'pgcrypto' and tp_objeto = 'EXTENSAO';
-- commit;
