begin;

-- Impede, no banco, que uma pessoa acumule mais de um perfil vigente.
--
-- Até aqui a exclusividade era só convenção: `fc_definir_perfil_pessoa` concede
-- um perfil e encerra os demais, e `resolvePlatformRole()` escolhe o de maior
-- privilégio quando encontra vários. Mas nada impedia o estado inválido de
-- existir — bastava uma migration antiga, uma correção manual no editor ou uma
-- RPC futura para reintroduzir acumulação, e a plataforma passaria a decidir
-- acesso por desempate em vez de por perfil declarado.
--
-- A garantia passa a ser estrutural: índice único parcial sobre as atribuições
-- **vigentes**. Histórico continua livre — quantas atribuições encerradas a
-- pessoa tiver, em qualquer ordem, é registro e não conflita.

-- 1) Consolida quem ainda acumula, mantendo o perfil de maior privilégio.
--    Repete o item 2 de 20260810120000 porque aquela migration pode não ter sido
--    aplicada por inteiro em todos os ambientes — e sem isso o índice do passo 2
--    falharia ao ser criado.
update public.person_role_assignments pra
set ends_at = timezone('utc', now())
where pra.starts_at <= timezone('utc', now())
  and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
  and exists (
    select 1
    from public.person_role_assignments outro
    join public.system_roles sr_outro on sr_outro.id = outro.role_id
    join public.system_roles sr_atual on sr_atual.id = pra.role_id
    where outro.person_id = pra.person_id
      and outro.id <> pra.id
      and outro.starts_at <= timezone('utc', now())
      and (outro.ends_at is null or outro.ends_at > timezone('utc', now()))
      and array_position(
            array['ADMINISTRATOR', 'SURVEY_MANAGER', 'LEADER', 'RESPONDENT'],
            sr_outro.code
          )
          < array_position(
            array['ADMINISTRATOR', 'SURVEY_MANAGER', 'LEADER', 'RESPONDENT'],
            sr_atual.code
          )
  );

-- Empate por privilégio idêntico (duas atribuições vigentes do mesmo papel, que
-- a unique key antiga permitia quando os `starts_at` diferiam): mantém a mais
-- recente e encerra as outras.
update public.person_role_assignments pra
set ends_at = timezone('utc', now())
where pra.starts_at <= timezone('utc', now())
  and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
  and exists (
    select 1
    from public.person_role_assignments outro
    where outro.person_id = pra.person_id
      and outro.id <> pra.id
      and outro.starts_at <= timezone('utc', now())
      and (outro.ends_at is null or outro.ends_at > timezone('utc', now()))
      and (outro.starts_at, outro.id) > (pra.starts_at, pra.id)
  );

-- 2) A garantia estrutural.
--
--    `ends_at is null` é a definição de vigência usada em todo o projeto
--    (has_active_role, fc_obter_contexto_plataforma, list_access_workspace
--    checam `ends_at is null or ends_at > now()`). O índice cobre o caso
--    `is null`, que é o que as RPCs criam ao conceder — atribuição com prazo
--    futuro é cenário que o modelo atual não usa.
--
--    Índice parcial, e não constraint: `unique` exigiria coluna gerada, e a
--    condição depende de nulidade, não de valor.
create unique index if not exists in_perfil_unico_vigente
  on public.person_role_assignments (person_id)
  where ends_at is null;

comment on index public.in_perfil_unico_vigente is
  'Perfis sao mutuamente exclusivos: uma pessoa tem no maximo um perfil vigente. Historico encerrado (ends_at preenchido) nao conflita.';

-- 3) `fc_definir_perfil_pessoa` precisa encerrar antes de conceder.
--
--    A versão de 20260810120000 concedia primeiro e encerrava depois, para que
--    uma falha parcial nunca deixasse a pessoa sem acesso. Com o índice do passo
--    2 essa ordem passa a violar a unicidade: o insert do perfil novo acontece
--    enquanto o antigo ainda está vigente.
--
--    A ordem se inverte, e a proteção original continua válida por outro motivo:
--    a função é uma transação única, então encerrar e conceder são atômicos —
--    se o insert falhar, o encerramento é revertido junto e a pessoa mantém o
--    perfil que tinha.
create or replace function public.fc_definir_perfil_pessoa(
  p_pessoa uuid,
  p_perfil text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, auth
as $$
declare
  v_actor_id uuid;
  v_role_code text;
  v_role_id uuid;
  v_role_name text;
  v_person_name text;
  v_previous text[];
  v_assignment_id uuid;
begin
  if not public.is_platform_administrator() then
    raise exception 'Apenas o Superadmin pode alterar o perfil de acesso de uma pessoa.';
  end if;

  v_actor_id := public.current_person_id();
  v_role_code := upper(btrim(coalesce(p_perfil, '')));

  if v_role_code not in ('ADMINISTRATOR', 'SURVEY_MANAGER', 'LEADER', 'RESPONDENT') then
    raise exception 'Perfil inválido. Use Superadmin, Admin, Avaliador ou Participante.';
  end if;

  select id, name into v_role_id, v_role_name
  from public.system_roles
  where code = v_role_code;
  if v_role_id is null then
    raise exception 'Perfil não encontrado no catálogo.';
  end if;

  select full_name into v_person_name
  from public.people
  where id = p_pessoa and active;
  if v_person_name is null then
    raise exception 'Pessoa ativa não encontrada.';
  end if;

  -- O Superadmin não pode rebaixar a si mesmo: sobraria a plataforma sem quem
  -- administra perfis.
  if p_pessoa = v_actor_id and v_role_code <> 'ADMINISTRATOR' then
    raise exception 'Você não pode retirar seu próprio perfil de Superadmin.';
  end if;

  select coalesce(array_agg(distinct sr.code order by sr.code), array[]::text[])
  into v_previous
  from public.person_role_assignments pra
  join public.system_roles sr on sr.id = pra.role_id
  where pra.person_id = p_pessoa
    and pra.starts_at <= timezone('utc', now())
    and (pra.ends_at is null or pra.ends_at > timezone('utc', now()));

  -- Encerra todo perfil vigente diferente do escolhido, liberando o índice
  -- único antes da concessão.
  update public.person_role_assignments
  set ends_at = timezone('utc', now())
  where person_id = p_pessoa
    and role_id <> v_role_id
    and starts_at <= timezone('utc', now())
    and (ends_at is null or ends_at > timezone('utc', now()));

  -- Reaproveita a atribuição vigente quando a pessoa já tem o perfil, em vez de
  -- duplicar.
  select pra.id into v_assignment_id
  from public.person_role_assignments pra
  where pra.person_id = p_pessoa
    and pra.role_id = v_role_id
    and pra.starts_at <= timezone('utc', now())
    and (pra.ends_at is null or pra.ends_at > timezone('utc', now()))
  order by pra.starts_at desc
  limit 1;

  if v_assignment_id is null then
    insert into public.person_role_assignments (person_id, role_id, starts_at, assigned_by)
    values (p_pessoa, v_role_id, timezone('utc', now()), v_actor_id)
    returning id into v_assignment_id;
  end if;

  insert into public.audit_events (
    actor_person_id, event_type, entity_type, entity_id, before_data, after_data, metadata
  ) values (
    v_actor_id,
    'PERSON_PROFILE_SET',
    'PERSON_ROLE_ASSIGNMENT',
    v_assignment_id::text,
    jsonb_build_object('roles', to_jsonb(v_previous)),
    jsonb_build_object(
      'personId', p_pessoa,
      'personName', v_person_name,
      'roleCode', v_role_code,
      'roleName', v_role_name
    ),
    jsonb_build_object('migration', '20260810140000_perfil_unico_por_pessoa')
  );

  return jsonb_build_object(
    'status', 'OK',
    'personName', v_person_name,
    'roleCode', v_role_code,
    'roleName', v_role_name
  );
end;
$$;

revoke all on function public.fc_definir_perfil_pessoa(uuid, text) from public, anon;
grant execute on function public.fc_definir_perfil_pessoa(uuid, text) to authenticated;

-- 4) Auditoria da mudança de garantia.
insert into public.audit_events (event_type, entity_type, entity_id, after_data, metadata)
values (
  'ROLE_EXCLUSIVITY_ENFORCED',
  'SYSTEM_ROLE',
  'ROLE_MODEL_2026_EXCLUSIVE',
  jsonb_build_object(
    'constraint', 'in_perfil_unico_vigente',
    'scope', 'person_role_assignments where ends_at is null'
  ),
  jsonb_build_object('migration', '20260810140000_perfil_unico_por_pessoa')
);

notify pgrst, 'reload schema';

commit;

-- Rollback:
-- begin;
--   drop index if exists public.in_perfil_unico_vigente;
--   -- As atribuicoes encerradas pelo passo 1 nao voltam automaticamente;
--   -- consultar audit_events para reconstituir, se necessario.
-- commit;
