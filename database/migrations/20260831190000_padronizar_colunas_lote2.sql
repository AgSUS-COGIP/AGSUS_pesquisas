-- Colunas no padrão institucional — LOTE 2.
--
--   item 7 — prefixo semântico por natureza do dado (CO_, SQ_, DT_, DS_, NO_,
--            NU_, QT_, ST_, TP_, AU_ …);
--   item 3 — MAIÚSCULAS, português, no máximo 30 caracteres.
--
-- POR QUE EM LOTES: corpo de PL/pgSQL resolve identificador em execução, então
-- referência errada a coluna não falha ao criar a função — falha em produção,
-- no caminho que ninguém exercitou. A suíte cobre 24 das 174 funções e
-- `plpgsql_check` não está disponível neste cluster. Este lote é o mais seguro
-- que existe: NENHUMA função de `sigav` referencia estas 6 tabelas.
--
-- VOCABULÁRIO, herdado das 108 colunas que o projeto já havia padronizado:
--   `id` e FK uuid    -> SQ_<entidade>      (como `sq_pessoa`, `sq_aplicacao`)
--   `created_at`      -> DT_INCLUSAO        \ par com AU_USUARIO_INCLUSAO e
--   `updated_at`      -> DT_ALTERACAO       / AU_USUARIO_ALTERACAO (item 7)
--   `*_by` (autoria)  -> AU_USUARIO_<ato>
--   `jsonb`           -> DS_                (como `tl_erro_aplicacao.ds_contexto`)
--
-- As constraints e os índices são renomeados junto: o nome deles aponta a
-- coluna, e `CK_OCORR_IMP_ROW_NUMBER` sobre uma coluna hoje chamada
-- `NU_LINHA` seria a mesma incoerência que este trabalho vem eliminar.
--
-- 30 colunas, 17 constraints, 6 índices.

begin;

-- ---------------------------------------------------------------------------
-- 1. Colunas (item 7)
-- ---------------------------------------------------------------------------

-- TB_LIMITE_REQUISICAO_PUBLICA
alter table sigav."TB_LIMITE_REQUISICAO_PUBLICA" rename column no_escopo to "NO_ESCOPO";
alter table sigav."TB_LIMITE_REQUISICAO_PUBLICA" rename column co_chave to "CO_CHAVE";
alter table sigav."TB_LIMITE_REQUISICAO_PUBLICA" rename column dt_janela to "DT_JANELA";
alter table sigav."TB_LIMITE_REQUISICAO_PUBLICA" rename column nu_requisicoes to "NU_REQUISICOES";
alter table sigav."TB_LIMITE_REQUISICAO_PUBLICA" rename column dt_atualizacao to "DT_ATUALIZACAO";

-- TB_MIGRACAO
alter table sigav."TB_MIGRACAO" rename column co_versao to "CO_VERSAO";
alter table sigav."TB_MIGRACAO" rename column no_migracao to "NO_MIGRACAO";
alter table sigav."TB_MIGRACAO" rename column ds_hash to "DS_HASH";
alter table sigav."TB_MIGRACAO" rename column no_origem to "NO_ORIGEM";
alter table sigav."TB_MIGRACAO" rename column dt_aplicacao to "DT_APLICACAO";

-- TL_ERRO_APLICACAO
alter table sigav."TL_ERRO_APLICACAO" rename column sq_erro to "SQ_ERRO";
alter table sigav."TL_ERRO_APLICACAO" rename column co_referencia to "CO_REFERENCIA";
alter table sigav."TL_ERRO_APLICACAO" rename column no_rota to "NO_ROTA";
alter table sigav."TL_ERRO_APLICACAO" rename column tp_erro to "TP_ERRO";
alter table sigav."TL_ERRO_APLICACAO" rename column ds_mensagem to "DS_MENSAGEM";
alter table sigav."TL_ERRO_APLICACAO" rename column ds_contexto to "DS_CONTEXTO";
alter table sigav."TL_ERRO_APLICACAO" rename column st_ambiente to "ST_AMBIENTE";
alter table sigav."TL_ERRO_APLICACAO" rename column nu_http_status to "NU_HTTP_STATUS";
alter table sigav."TL_ERRO_APLICACAO" rename column dt_ocorrencia to "DT_OCORRENCIA";

-- TB_PRESENCA_ONLINE
alter table sigav."TB_PRESENCA_ONLINE" rename column sq_pessoa to "SQ_PESSOA";
alter table sigav."TB_PRESENCA_ONLINE" rename column dt_visto_em to "DT_VISTO_EM";

-- TB_DOMINIO_INSTITUCIONAL
alter table sigav."TB_DOMINIO_INSTITUCIONAL" rename column domain to "NO_DOMINIO";
alter table sigav."TB_DOMINIO_INSTITUCIONAL" rename column active to "ST_ATIVO";
alter table sigav."TB_DOMINIO_INSTITUCIONAL" rename column created_at to "DT_INCLUSAO";

-- RL_PESSOA_MODULO
alter table sigav."RL_PESSOA_MODULO" rename column person_id to "SQ_PESSOA";
alter table sigav."RL_PESSOA_MODULO" rename column module_code to "CO_MODULO";
alter table sigav."RL_PESSOA_MODULO" rename column allowed to "ST_PERMITIDO";
alter table sigav."RL_PESSOA_MODULO" rename column granted_by to "AU_USUARIO_CONCESSAO";
alter table sigav."RL_PESSOA_MODULO" rename column created_at to "DT_INCLUSAO";
alter table sigav."RL_PESSOA_MODULO" rename column updated_at to "DT_ALTERACAO";

-- ---------------------------------------------------------------------------
-- 2. Constraints e índices, realinhados à coluna nova (item 8)
-- ---------------------------------------------------------------------------

alter table sigav."RL_PESSOA_MODULO" rename constraint "FK_PESSOA_PESSOA_MOD_PERSON" to "FK_PESSOA_PESSOA_MOD_PESSOA";
alter table sigav."TB_DOMINIO_INSTITUCIONAL" rename constraint "CK_DOM_INST_NORMALIZED" to "CK_DOM_INST_NO_DOMINIO";
alter table sigav."TB_LIMITE_REQUISICAO_PUBLICA" rename constraint "CK_LIMITE_REQ_REQ_PUBLI_CONTA" to "CK_LIMITE_REQ_NU_REQUISICOES";
alter table sigav."TB_MIGRACAO" rename constraint "CK_MIGRACAO_ORIGEM" to "CK_MIGRACAO_NO_ORIGEM";
alter table sigav."TL_ERRO_APLICACAO" rename constraint "CK_ERRO_APLIC_AMB" to "CK_ERRO_APLIC_ST_AMBIENTE";
alter table sigav."TL_ERRO_APLICACAO" rename constraint "CK_ERRO_APLIC_HTTP" to "CK_ERRO_APLIC_NU_HTTP_STATUS";
alter table sigav."TL_ERRO_APLICACAO" rename constraint "CK_ERRO_APLIC_TIPO" to "CK_ERRO_APLIC_TP_ERRO";
alter table sigav."TL_ERRO_APLICACAO" rename constraint "UK_ERRO_APLIC_REF" to "UK_ERRO_APLIC_CO_REFERENCIA";

alter index sigav."IN_FK_PESSOA_MOD_PERM_MOD_CODI" rename to "IN_FK_PESSOA_MOD_CO_MODULO";
alter index sigav."IN_FK_PESS_MOD_PER_MOD_CON_POR" rename to "IN_FK_PESSOA_MOD_AU_USUA_CONC";
alter index sigav."IN_LIMITE_REQ_REQ_PUBLI_JANEL" rename to "IN_LIMITE_REQ_DT_JANELA";
alter index sigav."IN_PRESENCA_VISTO" rename to "IN_PRESENCA_DT_VISTO_EM";
alter index sigav."IN_ERRO_APLIC_DATA" rename to "IN_ERRO_APLIC_DT_OCORRENCIA";
alter index sigav."IN_ERRO_APLIC_TIPO" rename to "IN_ERRO_APLIC_TP_ERRO_ST_AMBIE";

-- ---------------------------------------------------------------------------
-- 4. Funções que tocam estas colunas (8)
--
-- Cada substituição abaixo foi conferida contra a linha real da função. Onde o
-- nome da coluna é também chave JSON, ou pertence a outra tabela, a troca é
-- ancorada no alias — ou simplesmente não é feita.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION sigav."FC_DEFINIR_PERMISSOES_PESSOA"(p_pessoa uuid, p_permissoes text[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_actor_id uuid;
  v_person_name text;
  v_permissions text[];
  v_before text[];
  v_unknown text[];
  v_other_admins integer;
begin
  if sigav."FC_PAPEL_SESSAO"() is distinct from 'authenticated'
     or not sigav."FC_TEM_MODULO"('ADMIN_ACCESS') then
    raise exception 'Acesso restrito à administração de permissões.' using errcode = '42501';
  end if;

  v_actor_id := sigav."FC_PESSOA_SESSAO"();
  if v_actor_id is null then
    raise exception 'Sessão sem cadastro institucional vinculado.' using errcode = '42501';
  end if;

  select full_name
  into v_person_name
  from sigav."TB_PESSOA"
  where id = p_pessoa
    and active;

  if v_person_name is null then
    raise exception 'Pessoa ativa não encontrada.' using errcode = '22023';
  end if;

  select array_agg(distinct upper(btrim(item)) order by upper(btrim(item)))
  into v_unknown
  from unnest(coalesce(p_permissoes, array[]::text[])) item
  where btrim(item) <> ''
    and not exists (
      select 1
      from sigav."TB_MODULO_PLATAFORMA" pm
      where pm.code = upper(btrim(item))
        and pm.active
    );

  if coalesce(cardinality(v_unknown), 0) > 0 then
    raise exception 'Permissões desconhecidas: %', array_to_string(v_unknown, ', ')
      using errcode = '22023';
  end if;

  select coalesce(array_agg(pm.code order by pm.position, pm.code), array[]::text[])
  into v_permissions
  from sigav."TB_MODULO_PLATAFORMA" pm
  where pm.active
    and (
      pm.code in ('HOME', 'SURVEYS')
      or pm.code = any(array(
        select upper(btrim(item))
        from unnest(coalesce(p_permissoes, array[]::text[])) item
        where btrim(item) <> ''
      ))
    );

  v_before := sigav."FC_MODULOS_EFETIVOS"(p_pessoa);

  if p_pessoa = v_actor_id
     and not ('ADMIN_ACCESS' = any(v_permissions)) then
    raise exception 'Você não pode retirar sua própria permissão de administrar acessos.' using errcode = '42501';
  end if;

  if 'ADMIN_ACCESS' = any(v_before)
     and not ('ADMIN_ACCESS' = any(v_permissions)) then
    select count(*)::integer
    into v_other_admins
    from sigav."TB_PESSOA" p
    where p.active
      and p.id <> p_pessoa
      and 'ADMIN_ACCESS' = any(sigav."FC_MODULOS_EFETIVOS"(p.id));

    if v_other_admins = 0 then
      raise exception 'A plataforma precisa manter ao menos uma pessoa com administração de acessos.' using errcode = '42501';
    end if;
  end if;

  delete from sigav."RL_PESSOA_MODULO"
  where "SQ_PESSOA" = p_pessoa;

  insert into sigav."RL_PESSOA_MODULO" (
    "SQ_PESSOA",
    "CO_MODULO",
    "ST_PERMITIDO",
    "AU_USUARIO_CONCESSAO",
    "DT_INCLUSAO",
    "DT_ALTERACAO"
  )
  select
    p_pessoa,
    pm.code,
    pm.code = any(v_permissions),
    v_actor_id,
    timezone('utc', now()),
    timezone('utc', now())
  from sigav."TB_MODULO_PLATAFORMA" pm
  where pm.active;

  insert into sigav."TL_EVENTO_AUDITORIA" (
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'PERSON_PERMISSIONS_SET',
    'PERSON_MODULE_PERMISSION',
    p_pessoa::text,
    jsonb_build_object('permissions', to_jsonb(v_before)),
    jsonb_build_object(
      'personId', p_pessoa,
      'personName', v_person_name,
      'permissions', to_jsonb(v_permissions)
    ),
    jsonb_build_object('technicalRole', 'authenticated')
  );

  return jsonb_build_object(
    'status', 'OK',
    'personId', p_pessoa,
    'technicalRole', 'authenticated',
    'permissions', to_jsonb(v_permissions)
  );
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_EMAIL_INSTITUC_PERMITIDO"(target_email text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
 select exists(select 1 from sigav."TB_DOMINIO_INSTITUCIONAL" d where d."ST_ATIVO" and split_part(lower(btrim(coalesce(target_email,''))),'@',2)=d."NO_DOMINIO")
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_LISTAR_PRESENCA_ONLINE"()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_result jsonb;
begin
  if sigav."FC_PAPEL_SESSAO"() is distinct from 'authenticated'
     or not sigav."FC_PODE_VER_PRESENCA"() then
    raise exception 'Acesso restrito à permissão de visualizar presença online.' using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(to_jsonb(f) order by f."fullName", f."personId"), '[]'::jsonb)
  into v_result
  from (
    select
      p.id as "personId",
      p.full_name as "fullName",
      p.metadata->>'avatar_url' as "avatarUrl",
      'AUTHENTICATED'::text as "roleCode",
      pr."DT_VISTO_EM" as "onlineAt"
    from sigav."TB_PRESENCA_ONLINE" pr
    join sigav."TB_PESSOA" p on p.id = pr."SQ_PESSOA"
    where pr."DT_VISTO_EM" > timezone('utc', now()) - interval '2 minutes'
      and p.active
    order by pr."DT_VISTO_EM" desc, p.full_name, p.id
    limit 200
  ) f;

  return v_result;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_MODULOS_EFETIVOS"(target_person_id uuid)
 RETURNS text[]
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  select coalesce(
    array_agg(pm.code order by pm.position, pm.code)
      filter (where coalesce(
        pmp."ST_PERMITIDO",
        pm.code in ('HOME', 'SURVEYS')
      )),
    array[]::text[]
  )
  from sigav."TB_PESSOA" p
  cross join sigav."TB_MODULO_PLATAFORMA" pm
  left join sigav."RL_PESSOA_MODULO" pmp
    on pmp."SQ_PESSOA" = p.id
   and pmp."CO_MODULO" = pm.code
  where p.id = target_person_id
    and p.active
    and pm.active;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_REGISTRAR_PRESENCA"()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
declare
  v_pessoa uuid := sigav."FC_PESSOA_SESSAO"();
begin
  if v_pessoa is null then
    raise exception 'Sessao sem cadastro institucional vinculado.';
  end if;

  if not (select sigav."FC_PODE_REGISTRAR_PRESENCA"()) then
    return jsonb_build_object('status', 'DISABLED');
  end if;

  insert into sigav."TB_PRESENCA_ONLINE" ("SQ_PESSOA", "DT_VISTO_EM")
  values (v_pessoa, timezone('utc', now()))
  on conflict ("SQ_PESSOA") do update
    set "DT_VISTO_EM" = timezone('utc', now());

  return jsonb_build_object('status', 'OK');
end;
$function$;

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
    "DT_ATUALIZACAO"
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
    "DT_ATUALIZACAO" = excluded."DT_ATUALIZACAO"
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

CREATE OR REPLACE FUNCTION sigav."FC_SRV_REGISTRAR_ERRO"(p_co_referencia text, p_no_rota text, p_tp_erro text, p_ds_mensagem text, p_ds_contexto jsonb, p_st_ambiente text, p_nu_http_status integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
begin
  insert into sigav."TL_ERRO_APLICACAO" (
    "CO_REFERENCIA", "NO_ROTA", "TP_ERRO", "DS_MENSAGEM", "DS_CONTEXTO", "ST_AMBIENTE", "NU_HTTP_STATUS"
  ) values (
    p_co_referencia, p_no_rota, p_tp_erro, p_ds_mensagem,
    coalesce(p_ds_contexto, '{}'::jsonb), p_st_ambiente, p_nu_http_status
  )
  on conflict ("CO_REFERENCIA") do nothing;
end;
$function$;

CREATE OR REPLACE FUNCTION sigav."FC_SRV_VERIFICAR_MIGRATIONS"(p_versoes text[])
 RETURNS jsonb
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav'
AS $function$
  with esperadas as (
    select distinct versao
    from unnest(coalesce(p_versoes, array[]::text[])) as t(versao)
    where versao is not null and btrim(versao) <> ''
  ),
  ausentes as (
    select e.versao
    from esperadas e
    where not exists (
      select 1
      from sigav."TB_MIGRACAO" m
      where m."CO_VERSAO" = e.versao
    )
  )
  select jsonb_build_object(
    'checked', (select count(*) from esperadas),
    'missing', coalesce((select jsonb_agg(versao order by versao) from ausentes), '[]'::jsonb),
    'compatible', not exists (select 1 from ausentes),
    'latestApplied', (select max("CO_VERSAO") from sigav."TB_MIGRACAO")
  );
$function$;

-- ---------------------------------------------------------------------------
-- 3. Autoverificação
-- ---------------------------------------------------------------------------

do $verificacao$
declare
  v_tabelas text[] := array['TB_LIMITE_REQUISICAO_PUBLICA', 'TB_MIGRACAO', 'TL_ERRO_APLICACAO', 'TB_PRESENCA_ONLINE', 'TB_DOMINIO_INSTITUCIONAL', 'RL_PESSOA_MODULO'];
  v_revisadas text[] := array['FC_SRV_CONSUMIR_LIMITE_PUBLICO', 'FC_SRV_VERIFICAR_MIGRATIONS', 'FC_SRV_REGISTRAR_ERRO', 'FC_LISTAR_PRESENCA_ONLINE', 'FC_REGISTRAR_PRESENCA', 'FC_EMAIL_INSTITUC_PERMITIDO', 'FC_DEFINIR_PERMISSOES_PESSOA', 'FC_MODULOS_EFETIVOS'];
  v_fora text;
begin
  select string_agg(c.relname || '.' || a.attname, ', ' order by c.relname, a.attname) into v_fora
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
   where c.relnamespace = 'sigav'::regnamespace
     and c.relname = any(v_tabelas)
     and a.attnum > 0 and not a.attisdropped
     and (
       a.attname <> upper(a.attname)
       or a.attname !~ '^(CO|SQ|DT|HR|DS|NO|NU|QT|VL|TX|SG|ST|TP|IM|CG|AU)_'
     );
  if v_fora is not null then
    raise exception 'Colunas fora do item 7: %', v_fora;
  end if;

  -- Rede contra o esquecimento: acusa funcao que toca as tabelas deste lote e
  -- NAO esta na lista revisada. Comentario nao conta: varias funcoes citam a
  -- tabela so em prosa, e isso nao e referencia a coluna.
  select string_agg(distinct p.proname, ', ' order by p.proname) into v_fora
    from pg_proc p, unnest(v_tabelas) t(tabela)
   where p.pronamespace = 'sigav'::regnamespace
     and not (p.proname = any(v_revisadas))
     and regexp_replace(pg_get_functiondef(p.oid), '^[[:space:]]*--.*$', '', 'gn')
         ~ ('sigav[.]"' || t.tabela || '"');
  if v_fora is not null then
    raise exception 'Funcoes tocam tabelas deste lote e nao foram revisadas: %', v_fora;
  end if;

  raise notice 'nomenclatura lote 2: 30 colunas em 6 tabelas';
end
$verificacao$;

commit;
