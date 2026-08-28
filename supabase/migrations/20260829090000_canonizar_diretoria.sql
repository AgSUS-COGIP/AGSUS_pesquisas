-- Canonização da Diretoria.
--
-- Produção tinha a mesma diretoria escrita de duas formas, e o construtor de
-- público as tratava como opções distintas:
--
--   DAIS ......................................... 1 pessoa
--   DIRETORIA DE ATENCAO INTEGRAL A SAUDE ...... 417 pessoas
--   DIOP ......................................... 1 pessoa
--   DIRETORIA DE OPERACOES ..................... 394 pessoas
--   PRESIDENCIA .................................. 1 pessoa
--   DIRETORIA DA PRESIDENCIA ................... 209 pessoas
--
-- A normalização existente não resolve: ela cuida de caixa, acento e espaço
-- repetido, e `dais` não é variação ortográfica de
-- `diretoria de atencao integral a saude` — é outro texto. Equivalência
-- institucional precisa ser declarada.
--
-- ## Por que é seguro
--
-- Os três registros abreviados são `ADMIN_MANUAL`, sem histórico de importação.
-- Nenhuma aplicação tem `settings.audience.filters.directorate` preenchido, então
-- não há regra salva apontando para as siglas. Nenhuma função de negócio compara
-- literalmente `DAIS`, `DIOP` ou `PRESIDENCIA` — CDDI e telas administrativas só
-- leem e pesquisam `metadata.directorate`.
--
-- ## As quatro frentes
--
-- Corrigir os dados de hoje resolve hoje. As outras três fecham as portas por
-- onde a sigla voltaria:
--
--   1. os registros existentes;
--   2. a importação (`sync_people_base_rows`), para a próxima carga não
--      reintroduzir;
--   3. a edição administrativa (`update_platform_admin_person`), pelo mesmo
--      motivo;
--   4. a comparação do construtor de público, para uma chamada antiga que envie
--      a sigla continuar encontrando as mesmas pessoas.
--
-- Sem a quarta, uma integração que ainda mandasse `DAIS` passaria a selecionar
-- zero pessoas em silêncio — o pior desfecho possível, porque parece que a regra
-- simplesmente não alcança ninguém.
--
-- ## O que NÃO foi feito
--
-- Sem tabela de aliases, sem tabela de Diretoria, sem schema, sem coluna. As
-- três equivalências vivem numa função, que é onde uma decisão institucional
-- declarada em texto pertence enquanto forem três.
--
-- A regra vale **só para Diretoria**. Unidade, Coordenação, Cargo e Centro de
-- custo continuam comparados apenas por normalização ortográfica — aplicar
-- equivalência declarada a eles seria inventar sinônimos que ninguém aprovou.

begin;

-- ---------------------------------------------------------------------------
-- A equivalência declarada
-- ---------------------------------------------------------------------------

-- Devolve o nome institucional completo para as três siglas conhecidas e o
-- próprio valor, aparado, para qualquer outro. Serve tanto para gravar quanto
-- para comparar, e é isso que mantém escrita e leitura de acordo.
create or replace function sigav.fc_canonizar_diretoria(p_valor text)
returns text
language sql
stable
set search_path to 'pg_catalog', 'sigav'
as $function$
  select case sigav.fc_normalizar_rotulo(p_valor)
    when 'dais' then 'DIRETORIA DE ATENCAO INTEGRAL A SAUDE'
    when 'diop' then 'DIRETORIA DE OPERACOES'
    when 'presidencia' then 'DIRETORIA DA PRESIDENCIA'
    else nullif(btrim(coalesce(p_valor, '')), '')
  end;
$function$;

-- Comparação de Diretoria: canoniza os dois lados antes de normalizar. Existe
-- separada de `fc_dimensao_publico_atende` de propósito — a equivalência é
-- específica desta dimensão, e uma função genérica que a aplicasse a todas
-- criaria sinônimos onde não há decisão institucional.
--
-- É o que faz uma chamada antiga com `DAIS` continuar encontrando as 418
-- pessoas em vez de zero.
create or replace function sigav.fc_dimensao_diretoria_atende(p_valor text, p_selecionados jsonb)
returns boolean
language sql
stable
set search_path to 'pg_catalog', 'sigav'
as $function$
  select case
    when p_selecionados is null
      or jsonb_typeof(p_selecionados) <> 'array'
      or jsonb_array_length(p_selecionados) = 0
      then true
    else sigav.fc_normalizar_rotulo(sigav.fc_canonizar_diretoria(p_valor)) in (
      select sigav.fc_normalizar_rotulo(sigav.fc_canonizar_diretoria(valor))
      from jsonb_array_elements_text(p_selecionados) as escolhido(valor)
    )
  end;
$function$;

-- ---------------------------------------------------------------------------
-- Os registros existentes
-- ---------------------------------------------------------------------------

-- Auditado pessoa a pessoa, com o valor anterior preservado: são três linhas, e
-- um resumo agregado não permitiria desfazer nem entender caso por caso.
-- `actor_person_id` fica nulo — foi migration, não pessoa.
with alvos as (
  select id, metadata ->> 'directorate' as antes,
         sigav.fc_canonizar_diretoria(metadata ->> 'directorate') as depois
  from sigav.people
  where sigav.fc_normalizar_rotulo(metadata ->> 'directorate') in ('dais', 'diop', 'presidencia')
), atualizados as (
  update sigav.people p
  set metadata = jsonb_set(coalesce(p.metadata, '{}'::jsonb), '{directorate}', to_jsonb(a.depois)),
      updated_at = timezone('utc', now())
  from alvos a
  where p.id = a.id
  returning p.id
)
insert into sigav.audit_events(
  actor_person_id, event_type, entity_type, entity_id, before_data, after_data, metadata
)
select
  null,
  'PERSON_DIRECTORATE_CANONICALIZED',
  'PERSON',
  a.id::text,
  jsonb_build_object('directorate', a.antes),
  jsonb_build_object('directorate', a.depois),
  jsonb_build_object('source', 'MIGRATION_20260829', 'reason', 'institutional_alias')
from alvos a;

-- ---------------------------------------------------------------------------
-- Importação e edição administrativa canonizam antes de gravar
-- ---------------------------------------------------------------------------

-- Definições extraídas do banco vivo e alteradas numa linha cada: só o valor
-- gravado passa por `fc_canonizar_diretoria`. Os retratos antes/depois da
-- auditoria ficam intactos — eles registram o que havia, não o que deveria.

CREATE OR REPLACE FUNCTION sigav.sync_people_base_rows(p_rows jsonb, p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav', 'auth'
AS $function$
declare
  v_row jsonb; v_person sigav.people%rowtype; v_employee text; v_email text; v_status text;
  v_active boolean; v_source_key text; v_import_metadata jsonb;
  v_inserted integer:=0; v_updated integer:=0; v_identity_count integer:=0;
begin
  if auth.role()<>'service_role' and not sigav.can_manage_surveys() then raise exception 'Seu perfil não possui permissão para atualizar a base de pessoas.'; end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'O conteúdo da importação deve ser uma lista de pessoas.'; end if;

  for v_row in select value from jsonb_array_elements(p_rows)
  loop
    v_employee:=btrim(coalesce(v_row->>'employeeNumber',''));
    v_email:=lower(btrim(coalesce(v_row->>'institutionalEmail','')));
    v_status:=upper(btrim(coalesce(v_row->>'status','ATIVO')));
    v_source_key:=nullif(btrim(coalesce(v_row->>'participantKey',v_employee)),'');
    if v_employee='' or btrim(coalesce(v_row->>'fullName',''))='' then raise exception 'Matrícula e nome são obrigatórios em todas as linhas.'; end if;
    v_active:=v_status in ('ATIVO','NORMAL','ACTIVE','EM EXERCICIO','EM EXERCÍCIO');
    if v_status='' then v_active:=true; end if;

    select * into v_person from sigav.people p
    where p.employee_number=v_employee or (v_email<>'' and lower(btrim(coalesce(p.institutional_email,'')))=v_email)
    order by (p.employee_number=v_employee) desc,(p.auth_user_id is not null) desc,p.created_at limit 1 for update;

    v_import_metadata:=jsonb_strip_nulls(jsonb_build_object(
      'detailed_status',nullif(btrim(coalesce(v_row->>'detailedStatus','')),''),
      'directorate',sigav.fc_canonizar_diretoria(v_row->>'directorate'),
      'unit',nullif(btrim(coalesce(v_row->>'unit','')),''),
      'coordination',nullif(btrim(coalesce(v_row->>'coordination','')),''),
      'source_row',nullif(v_row->>'rowNumber',''),
      'last_import_batch_id',p_batch_id,
      'last_imported_at',timezone('utc',now())
    ));

    if v_person.id is null then
      insert into sigav.people(employee_number,full_name,institutional_email,job_title,cost_center,workplace,employment_status,active,source_system,source_key,metadata)
      values(v_employee,btrim(v_row->>'fullName'),nullif(v_email,''),nullif(btrim(coalesce(v_row->>'jobTitle','')),''),nullif(btrim(coalesce(v_row->>'costCenter','')),''),nullif(btrim(coalesce(v_row->>'workplace','')),''),coalesce(nullif(v_status,''),'ATIVO'),v_active,'AGSUS_PEOPLE_BASE',coalesce(v_source_key,v_employee),v_import_metadata)
      returning * into v_person;
      v_inserted:=v_inserted+1;
    else
      if exists(select 1 from sigav.people other where other.employee_number=v_employee and other.id<>v_person.id) then raise exception 'A matrícula % já pertence a outra pessoa.',v_employee; end if;
      update sigav.people set
        employee_number=v_employee,full_name=btrim(v_row->>'fullName'),institutional_email=coalesce(nullif(v_email,''),institutional_email),
        job_title=nullif(btrim(coalesce(v_row->>'jobTitle','')),''),cost_center=nullif(btrim(coalesce(v_row->>'costCenter','')),''),workplace=nullif(btrim(coalesce(v_row->>'workplace','')),''),
        employment_status=coalesce(nullif(v_status,''),employment_status,'ATIVO'),active=v_active,
        source_system=case when auth_user_id is null then 'AGSUS_PEOPLE_BASE' else source_system end,
        source_key=case when auth_user_id is null then coalesce(v_source_key,v_employee) else source_key end,
        metadata=coalesce(metadata,'{}'::jsonb)||v_import_metadata,updated_at=timezone('utc',now())
      where id=v_person.id returning * into v_person;
      v_updated:=v_updated+1;
    end if;

    if v_email<>'' and coalesce((v_row->>'emailEligibleForAccess')::boolean,false) then
      insert into sigav.person_access_identities(person_id,identity_type,email,status,source,metadata)
      values(v_person.id,'INSTITUTIONAL_EMAIL',v_email,case when v_person.auth_user_id is null then 'PENDING' else 'ACTIVE' end,'AGSUS_PEOPLE_BASE',jsonb_build_object('import_batch_id',p_batch_id))
      on conflict(person_id,identity_type,email) do update set
        status=case when v_person.auth_user_id is null then sigav.person_access_identities.status else 'ACTIVE' end,
        revoked_at=null,metadata=coalesce(sigav.person_access_identities.metadata,'{}'::jsonb)||jsonb_build_object('import_batch_id',p_batch_id),updated_at=timezone('utc',now());
      v_identity_count:=v_identity_count+1;
    end if;
  end loop;

  return jsonb_build_object('status','OK','inserted',v_inserted,'updated',v_updated,'identitiesProcessed',v_identity_count,'processed',v_inserted+v_updated);
end;
$function$

;

CREATE OR REPLACE FUNCTION sigav.update_platform_admin_person(target_person_id uuid, target_full_name text, target_institutional_email text DEFAULT NULL::text, target_job_title text DEFAULT NULL::text, target_cost_center text DEFAULT NULL::text, target_workplace text DEFAULT NULL::text, target_directorate text DEFAULT NULL::text, target_organizational_unit text DEFAULT NULL::text, target_coordination text DEFAULT NULL::text, target_employment_status text DEFAULT 'ATIVO'::text, target_active boolean DEFAULT true, target_justification text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'sigav', 'auth'
AS $function$
declare
  v_actor_id uuid;
  v_before sigav.people%rowtype;
  v_after sigav.people%rowtype;
  v_before_data jsonb;
  v_after_data jsonb;
  v_name text := btrim(coalesce(target_full_name, ''));
  v_email text := lower(btrim(coalesce(target_institutional_email, '')));
  v_status text := upper(btrim(coalesce(target_employment_status, 'ATIVO')));
  v_justification text := btrim(coalesce(target_justification, ''));
begin
  if not sigav.is_platform_administrator() then
    raise exception 'Acesso restrito ao Administrador da Plataforma.';
  end if;

  v_actor_id := sigav.current_person_id();
  if v_actor_id is null then
    raise exception 'Cadastro institucional do administrador não identificado.';
  end if;
  if length(v_justification) < 10 then
    raise exception 'Informe uma justificativa com pelo menos 10 caracteres.';
  end if;
  if v_name = '' then
    raise exception 'O nome completo é obrigatório.';
  end if;
  if v_status = '' then
    raise exception 'A situação funcional é obrigatória.';
  end if;
  if v_email <> '' and not sigav.is_allowed_institutional_email(v_email) then
    raise exception 'Informe um e-mail institucional AgSUS válido.';
  end if;

  select * into v_before
  from sigav.people
  where id = target_person_id
  for update;

  if v_before.id is null then
    raise exception 'Pessoa não encontrada.';
  end if;

  if v_email <> '' and exists (
    select 1
    from sigav.people other
    where other.id <> target_person_id
      and lower(btrim(coalesce(other.institutional_email, ''))) = v_email
  ) then
    raise exception 'O e-mail informado já pertence a outra pessoa.';
  end if;

  v_before_data := jsonb_strip_nulls(jsonb_build_object(
    'personId', v_before.id,
    'employeeNumber', v_before.employee_number,
    'fullName', v_before.full_name,
    'institutionalEmail', v_before.institutional_email,
    'jobTitle', v_before.job_title,
    'costCenter', v_before.cost_center,
    'workplace', v_before.workplace,
    'directorate', nullif(btrim(coalesce(v_before.metadata->>'directorate', '')), ''),
    'organizationalUnit', nullif(btrim(coalesce(v_before.metadata->>'unit', '')), ''),
    'coordination', nullif(btrim(coalesce(v_before.metadata->>'coordination', '')), ''),
    'employmentStatus', v_before.employment_status,
    'active', v_before.active
  ));

  update sigav.people
  set full_name = v_name,
      institutional_email = nullif(v_email, ''),
      job_title = nullif(btrim(coalesce(target_job_title, '')), ''),
      cost_center = nullif(btrim(coalesce(target_cost_center, '')), ''),
      workplace = nullif(btrim(coalesce(target_workplace, '')), ''),
      employment_status = v_status,
      active = coalesce(target_active, true),
      metadata = (
        coalesce(metadata, '{}'::jsonb) - 'directorate' - 'unit' - 'coordination'
      ) || jsonb_strip_nulls(jsonb_build_object(
        'directorate', sigav.fc_canonizar_diretoria(target_directorate),
        'unit', nullif(btrim(coalesce(target_organizational_unit, '')), ''),
        'coordination', nullif(btrim(coalesce(target_coordination, '')), ''),
        'last_admin_update_by', v_actor_id,
        'last_admin_update_at', timezone('utc', now()),
        'last_admin_update_justification', v_justification
      )),
      updated_at = timezone('utc', now())
  where id = target_person_id
  returning * into v_after;

  v_after_data := jsonb_strip_nulls(jsonb_build_object(
    'personId', v_after.id,
    'employeeNumber', v_after.employee_number,
    'fullName', v_after.full_name,
    'institutionalEmail', v_after.institutional_email,
    'jobTitle', v_after.job_title,
    'costCenter', v_after.cost_center,
    'workplace', v_after.workplace,
    'directorate', nullif(btrim(coalesce(v_after.metadata->>'directorate', '')), ''),
    'organizationalUnit', nullif(btrim(coalesce(v_after.metadata->>'unit', '')), ''),
    'coordination', nullif(btrim(coalesce(v_after.metadata->>'coordination', '')), ''),
    'employmentStatus', v_after.employment_status,
    'active', v_after.active
  ));

  insert into sigav.audit_events(
    actor_person_id,
    event_type,
    entity_type,
    entity_id,
    before_data,
    after_data,
    metadata
  ) values (
    v_actor_id,
    'PERSON_FUNCTIONAL_DATA_UPDATED',
    'PERSON',
    target_person_id::text,
    v_before_data,
    v_after_data,
    jsonb_build_object('justification', v_justification)
  );

  return jsonb_build_object(
    'status', 'OK',
    'personId', v_after.id,
    'employeeNumber', v_after.employee_number,
    'fullName', v_after.full_name
  );
end;
$function$

;

-- ---------------------------------------------------------------------------
-- O construtor de público passa a comparar Diretoria por equivalência
-- ---------------------------------------------------------------------------

-- Só a linha de `directorate` muda em cada uma. As outras quatro dimensões
-- continuam em `fc_dimensao_publico_atende`.

create or replace function sigav.fc_resolver_publico_avaliacao(p_regra jsonb)
returns table (sq_pessoa uuid, tp_origem text, st_excluida boolean)
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'sigav', 'auth'
as $function$
begin
  perform sigav.fc_validar_regra_publico(p_regra);

  return query
  with regra as (
    select
      coalesce(p_regra -> 'filters', '{}'::jsonb) as filtros,
      coalesce((p_regra ->> 'allEligible')::boolean, false) as todas,
      coalesce(p_regra -> 'includePersonIds', '[]'::jsonb) as incluidas,
      coalesce(p_regra -> 'excludePersonIds', '[]'::jsonb) as excluidas
  ),
  algum_filtro as (
    select exists (
      select 1
      from regra, jsonb_each(regra.filtros) as filtro(chave, valor)
      where jsonb_typeof(filtro.valor) = 'array'
        and jsonb_array_length(filtro.valor) > 0
    ) as ha
  ),
  ids_incluidos as (
    select valor::uuid as id
    from regra, jsonb_array_elements_text(regra.incluidas) as item(valor)
  ),
  ids_excluidos as (
    select valor::uuid as id
    from regra, jsonb_array_elements_text(regra.excluidas) as item(valor)
  ),
  por_filtro as (
    select p.id
    from sigav.people p, regra r, algum_filtro af
    where p.active
      and (
        r.todas
        or (
          af.ha
          and sigav.fc_dimensao_diretoria_atende(p.metadata ->> 'directorate',  r.filtros -> 'directorate')
          and sigav.fc_dimensao_publico_atende(p.metadata ->> 'unit',         r.filtros -> 'unit')
          and sigav.fc_dimensao_publico_atende(p.metadata ->> 'coordination', r.filtros -> 'coordination')
          and sigav.fc_dimensao_publico_atende(p.cost_center,                 r.filtros -> 'costCenter')
          and sigav.fc_dimensao_publico_atende(p.job_title,                   r.filtros -> 'jobTitle')
        )
      )
  ),
  por_inclusao as (
    select p.id
    from sigav.people p
    where p.active
      and p.id in (select id from ids_incluidos)
  ),
  reunidas as (
    select id, 'FILTRO' as origem from por_filtro
    union all
    select id, 'INCLUSAO' from por_inclusao
  )
  select
    r.id,
    min(r.origem),
    bool_or(r.id in (select id from ids_excluidos))
  from reunidas r
  group by r.id;
end;
$function$;

create or replace function sigav.fc_listar_dimensoes_publico(p_regra jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'sigav', 'auth'
as $function$
declare
  v_filtros jsonb;
  v_resultado jsonb;
begin
  if not sigav.can_manage_surveys() then
    return jsonb_build_object('status', 'FORBIDDEN');
  end if;

  perform sigav.fc_validar_regra_publico(p_regra);

  v_filtros := case
    when coalesce((p_regra ->> 'allEligible')::boolean, false) then '{}'::jsonb
    else coalesce(p_regra -> 'filters', '{}'::jsonb)
  end;

  with pessoas as (
    -- A Diretoria já entra canonizada, então o rótulo exibido é sempre o nome
    -- institucional completo — inclusive se algum registro futuro escapar com a
    -- sigla, ele se agrupa com os demais em vez de virar uma opção solitária.
    select sigav.fc_canonizar_diretoria(metadata ->> 'directorate') as diretoria,
           metadata ->> 'unit' as unidade,
           metadata ->> 'coordination' as coordenacao,
           cost_center as centro,
           job_title as cargo
    from sigav.people
    where active
  ),
  bruto as (
    select 'directorate' as dimensao, diretoria as valor
    from pessoas

    union all
    select 'unit', unidade
    from pessoas
    where sigav.fc_dimensao_diretoria_atende(diretoria, v_filtros -> 'directorate')

    union all
    select 'coordination', coordenacao
    from pessoas
    where sigav.fc_dimensao_diretoria_atende(diretoria, v_filtros -> 'directorate')
      and sigav.fc_dimensao_publico_atende(unidade, v_filtros -> 'unit')

    union all
    select 'costCenter', centro
    from pessoas
    where sigav.fc_dimensao_diretoria_atende(diretoria, v_filtros -> 'directorate')
      and sigav.fc_dimensao_publico_atende(unidade, v_filtros -> 'unit')
      and sigav.fc_dimensao_publico_atende(coordenacao, v_filtros -> 'coordination')

    union all
    select 'jobTitle', cargo
    from pessoas
    where sigav.fc_dimensao_diretoria_atende(diretoria, v_filtros -> 'directorate')
      and sigav.fc_dimensao_publico_atende(unidade, v_filtros -> 'unit')
      and sigav.fc_dimensao_publico_atende(coordenacao, v_filtros -> 'coordination')
      and sigav.fc_dimensao_publico_atende(centro, v_filtros -> 'costCenter')
  ),
  normalizado as (
    select dimensao, sigav.fc_normalizar_rotulo(valor) as chave, btrim(valor) as rotulo
    from bruto
    where sigav.fc_normalizar_rotulo(valor) is not null
  ),
  agrupado as (
    select dimensao, chave, count(*)::integer as total,
           mode() within group (order by rotulo) as rotulo
    from normalizado
    group by dimensao, chave
  ),
  por_dimensao as (
    select dimensao, jsonb_agg(
      jsonb_build_object('label', rotulo, 'count', total)
      order by rotulo
    ) as itens
    from agrupado
    group by dimensao
  ),
  -- A seleção também é canonizada antes de comparar: uma regra antiga com
  -- `DAIS` não pode ser reportada como incompatível agora que os dados usam o
  -- nome completo.
  escolhido as (
    select chave.dimensao, item.valor as rotulo,
           case when chave.dimensao = 'directorate'
                then sigav.fc_normalizar_rotulo(sigav.fc_canonizar_diretoria(item.valor))
                else sigav.fc_normalizar_rotulo(item.valor)
           end as chave
    from jsonb_each(v_filtros) as chave(dimensao, valores),
         jsonb_array_elements_text(chave.valores) as item(valor)
  ),
  incompativel as (
    select e.dimensao, jsonb_agg(e.rotulo order by e.rotulo) as itens
    from escolhido e
    where not exists (
      select 1 from agrupado a
      where a.dimensao = e.dimensao and a.chave = e.chave
    )
    group by e.dimensao
  )
  select jsonb_build_object(
    'status', 'OK',
    'dimensions', coalesce((select jsonb_object_agg(dimensao, itens) from por_dimensao), '{}'::jsonb),
    'incompatible', coalesce((select jsonb_object_agg(dimensao, itens) from incompativel), '{}'::jsonb)
  )
  into v_resultado;

  return v_resultado;
end;
$function$;

create or replace function sigav.fc_buscar_pessoas_publico(
  p_busca text default null,
  p_limite integer default 20,
  p_regra jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'sigav', 'auth'
as $function$
declare
  v_filtros jsonb;
  v_termo text;
  v_resultado jsonb;
begin
  if not sigav.can_manage_surveys() then
    return jsonb_build_object('status', 'FORBIDDEN');
  end if;

  perform sigav.fc_validar_regra_publico(p_regra);

  v_filtros := case
    when coalesce((p_regra ->> 'allEligible')::boolean, false) then '{}'::jsonb
    else coalesce(p_regra -> 'filters', '{}'::jsonb)
  end;
  v_termo := sigav.fc_normalizar_rotulo(p_busca);

  with encontradas as (
    select p.id, p.full_name, p.employee_number, p.job_title,
           p.metadata ->> 'unit' as unidade,
           sigav.fc_canonizar_diretoria(p.metadata ->> 'directorate') as diretoria
    from sigav.people p
    where p.active
      and sigav.fc_dimensao_diretoria_atende(p.metadata ->> 'directorate',  v_filtros -> 'directorate')
      and sigav.fc_dimensao_publico_atende(p.metadata ->> 'unit',         v_filtros -> 'unit')
      and sigav.fc_dimensao_publico_atende(p.metadata ->> 'coordination', v_filtros -> 'coordination')
      and sigav.fc_dimensao_publico_atende(p.cost_center,                 v_filtros -> 'costCenter')
      and sigav.fc_dimensao_publico_atende(p.job_title,                   v_filtros -> 'jobTitle')
      and (
        v_termo is null
        or sigav.fc_normalizar_rotulo(p.full_name) like '%' || v_termo || '%'
        or sigav.fc_normalizar_rotulo(p.employee_number) like '%' || v_termo || '%'
        or sigav.fc_normalizar_rotulo(p.institutional_email) like '%' || v_termo || '%'
        or sigav.fc_normalizar_rotulo(p.job_title) like '%' || v_termo || '%'
      )
    order by p.full_name
    limit least(greatest(coalesce(p_limite, 20), 1), 50)
  )
  select jsonb_build_object(
    'status', 'OK',
    'contextual', (select count(*) from jsonb_each(v_filtros) as f(chave, valores)
                   where jsonb_array_length(f.valores) > 0) > 0,
    'people', coalesce((
      select jsonb_agg(jsonb_build_object(
        'personId', id,
        'fullName', full_name,
        'employeeNumber', employee_number,
        'jobTitle', job_title,
        'unit', unidade,
        'directorate', diretoria
      ) order by full_name)
      from encontradas
    ), '[]'::jsonb)
  )
  into v_resultado;

  return v_resultado;
end;
$function$;

revoke all on function sigav.fc_canonizar_diretoria(text) from public, anon;
revoke all on function sigav.fc_dimensao_diretoria_atende(text, jsonb) from public, anon;

comment on function sigav.fc_canonizar_diretoria(text) is
  'Equivalência institucional de Diretoria: DAIS, DIOP e PRESIDENCIA devolvem o nome completo. Qualquer outro valor volta aparado. Vale só para Diretoria.';

comment on function sigav.fc_dimensao_diretoria_atende(text, jsonb) is
  'Comparação de Diretoria com equivalência aplicada aos dois lados, para que uma chamada antiga com a sigla continue encontrando as mesmas pessoas.';

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   -- Reverter os dados exige o registro de PERSON_DIRECTORATE_CANONICALIZED:
--   --   update sigav.people p
--   --   set metadata = jsonb_set(p.metadata, '{directorate}', e.before_data -> 'directorate')
--   --   from sigav.audit_events e
--   --   where e.event_type = 'PERSON_DIRECTORATE_CANONICALIZED' and e.entity_id = p.id::text;
--   -- E reaplicar as definições de 20260828234500 e das migrations que criaram
--   -- sync_people_base_rows e update_platform_admin_person.
--   drop function if exists sigav.fc_dimensao_diretoria_atende(text, jsonb);
--   drop function if exists sigav.fc_canonizar_diretoria(text);
--   notify pgrst, 'reload schema';
-- commit;
